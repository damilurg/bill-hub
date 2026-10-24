import { testCookie } from './test-env.mjs';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// Execute the actual route handlers and Drizzle SQL against SQLite.
// Production SQLite driver and migrations; all provider HTTP is mocked.
const root = fileURLToPath(new URL('../', import.meta.url));
process.env.DATABASE_PATH = ':memory:';
const { getSqlite } = await import('../db/sqlite.mjs');
const { migrate } = await import('../scripts/migrate.mjs');
const sqlite = getSqlite();
migrate();
registerHooks({
  resolve(specifier, context, next) {
    let target;
    if (specifier.startsWith('@/')) target = path.join(root, specifier.slice(2));
    else if (
      context.parentURL?.startsWith(pathToFileURL(root).href) &&
      specifier.startsWith('.') &&
      !path.extname(specifier)
    )
      target = fileURLToPath(new URL(specifier, context.parentURL));
    if (target) {
      if (existsSync(target) && statSync(target).isDirectory())
        target = path.join(target, 'index.ts');
      else if (!path.extname(target)) target += '.ts';
      return next(pathToFileURL(target).href, context);
    }
    return next(specifier, context);
  },
});
const RealDate = Date;
let clock = '2026-10-22T12:00:00Z';
globalThis.Date = class extends RealDate {
  constructor(...args) {
    if (args.length) super(...args);
    else super(clock);
  }
  static now() {
    return new RealDate(clock).getTime();
  }
};
let posts = 0,
  behavior = 'ok';
globalThis.fetch = async (url, options) => {
  if (url === 'https://www.gazprom.kg/')
    return new Response('<script src="/assets/index-Test.js"></script>');
  if (url === 'https://www.gazprom.kg/assets/index-Test.js')
    return new Response('set("api-token","test-only-public-key")');
  if (url === 'https://api.gazprom.kg/api/v1/facility/readings') {
    assert.equal(options.method, 'POST');
    posts++;
    if (behavior === 'timeout') throw new Error('Simulated lost reply');
    if (behavior === 'reject') return Response.json({ message: 'lower reading' }, { status: 409 });
    return Response.json({ consumption: 2, payAmount: 40, tariff: 20 });
  }
  throw new Error('Unexpected external request blocked by test: ' + url);
};
const routes = {
  accounts: await import('../app/api/accounts/route.ts'),
  readings: await import('../app/api/readings/route.ts'),
  state: await import('../app/api/state/route.ts'),
  submit: await import('../app/api/submit/route.ts'),
  export: await import('../app/api/export/route.ts'),
};
async function request(route, body, user = 'alice', origin = 'https://app.test') {
  const headers = { 'Content-Type': 'application/json', Origin: origin };
  if (user === 'alice') headers.cookie = testCookie();
  else if (user) headers['oai-authenticated-user-id'] = user;
  const req = new Request('https://app.test/api/' + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const res = await routes[route][body === undefined ? 'GET' : 'POST'](req);
  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = raw;
  }
  return { status: res.status, data };
}
const water = {
  provider: 'water',
  account: '000000123',
  meters: [
    { id: 'cold', kind: 'cold', label: 'Cold fixture', previous: '10' },
    { id: 'hot', kind: 'hot', label: 'Drainage fixture', previous: '2' },
  ],
};
const gas = {
  provider: 'gas',
  account: '000000001',
  meters: [{ id: 'g', kind: 'gas', label: 'Gas fixture', previous: '10' }],
};
async function gasDraft() {
  assert.equal((await request('accounts', gas)).status, 200);
  assert.equal(
    (await request('readings', { provider: 'gas', period: '2026-10', values: { g: '12' } })).status,
    200,
  );
  return (await request('state')).data.readings[0];
}
const send = (r) => request('submit', { id: r.id, version: r.created, confirmed: true });
beforeEach(() => {
  sqlite.exec('DELETE FROM utility_readings; DELETE FROM utility_accounts;');
  posts = 0;
  behavior = 'ok';
  clock = '2026-10-22T12:00:00Z';
  process.env.LIVE_SUBMISSIONS_ENABLED = 'true';
});
test('routes: missing identity and foreign Origin rejected', async () => {
  assert.equal((await request('state', undefined, null)).status, 401);
  assert.equal((await request('accounts', water, 'alice', 'https://evil.test')).status, 403);
  assert.equal((await request('state')).data.accounts.length, 0);
});
test('routes: save preserves leading zeros and owner isolation', async () => {
  assert.equal((await request('accounts', water)).status, 200);
  assert.equal((await request('state')).data.accounts[0].account, '000000123');
  assert.equal((await request('state', undefined, 'bob')).status, 401);
  assert.equal((await request('export', undefined, 'bob')).status, 401);
});
test('routes: reject lower/incomplete values, upsert one monthly draft', async () => {
  await request('accounts', water);
  assert.equal(
    (
      await request('readings', {
        provider: 'water',
        period: '2026-10',
        values: { cold: '9', hot: '3' },
      })
    ).status,
    400,
  );
  assert.equal(
    (await request('readings', { provider: 'water', period: '2026-10', values: { cold: '11' } }))
      .status,
    400,
  );
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await request('readings', {
          provider: 'water',
          period: '2026-10',
          values: { cold: '11', hot: '3' },
        })
      ).status,
      200,
    );
  assert.equal((await request('state')).data.readings.length, 1);
  assert.equal(posts, 0);
});
test('routes: confirmation, ownership and stale version gate every write', async () => {
  const r = await gasDraft();
  assert.equal(
    (await request('submit', { id: r.id, version: r.created, confirmed: false })).status,
    400,
  );
  assert.equal(
    (await request('submit', { id: r.id, version: r.created, confirmed: true }, 'bob')).status,
    401,
  );
  assert.equal(
    (await request('submit', { id: r.id, version: 'stale', confirmed: true })).status,
    409,
  );
  assert.equal(posts, 0);
});
test('routes: atomic SQL claim permits one concurrent send only', async () => {
  const r = await gasDraft();
  const result = await Promise.all([send(r), send(r)]);
  assert.deepEqual(result.map((v) => v.status).sort(), [200, 409]);
  assert.equal(posts, 1);
  assert.equal((await request('state')).data.readings[0].status, 'confirmed');
});
test('routes: confirmed submission cannot be overwritten or sent twice', async () => {
  const r = await gasDraft();
  assert.equal((await send(r)).data.status, 'confirmed');
  assert.equal(
    (await request('readings', { provider: 'gas', period: '2026-10', values: { g: '13' } })).status,
    409,
  );
  assert.equal((await send(r)).status, 409);
  assert.equal(posts, 1);
});
test('routes: uncertain delivery persists and prevents retries/edits', async () => {
  const r = await gasDraft();
  behavior = 'timeout';
  assert.equal((await send(r)).data.status, 'unknown');
  assert.equal((await send(r)).status, 409);
  assert.equal(
    (await request('readings', { provider: 'gas', period: '2026-10', values: { g: '13' } })).status,
    409,
  );
  assert.equal((await request('state')).data.readings[0].status, 'unknown');
  assert.equal(posts, 1);
});
test('routes: provider rejection is stored without recalculation', async () => {
  const r = await gasDraft();
  behavior = 'reject';
  assert.equal((await send(r)).data.status, 'rejected');
  assert.equal((await request('state')).data.readings[0].status, 'rejected');
  assert.equal(posts, 1);
});
test('routes: next month checks the last accepted value', async () => {
  const r = await gasDraft();
  await send(r);
  clock = '2026-11-22T12:00:00Z';
  assert.equal(
    (await request('readings', { provider: 'gas', period: '2026-11', values: { g: '11' } })).status,
    400,
  );
  assert.equal(
    (await request('readings', { provider: 'gas', period: '2026-11', values: { g: '12' } })).status,
    200,
  );
});
test('routes: archived period and early-month submission blocked', async () => {
  const r = await gasDraft();
  clock = '2026-11-22T12:00:00Z';
  assert.equal((await send(r)).status, 400);
  clock = '2026-10-05T12:00:00Z';
  assert.equal((await send(r)).status, 400);
  assert.equal(posts, 0);
});
test('routes: unsupported providers never reach the gas adapter', async () => {
  await request('accounts', water);
  await request('readings', {
    provider: 'water',
    period: '2026-10',
    values: { cold: '11', hot: '3' },
  });
  const r = (await request('state')).data.readings[0];
  assert.equal((await send(r)).status, 422);
  assert.equal(posts, 0);
});

test('routes: server switch blocks real submissions before provider access', async () => {
  const r = await gasDraft();
  process.env.LIVE_SUBMISSIONS_ENABLED = 'false';
  assert.equal((await send(r)).status, 422);
  assert.equal(posts, 0);
  assert.equal((await request('state')).data.readings[0].status, 'draft');
});
