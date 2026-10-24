// Integration smoke check. Use only against an isolated test instance: it writes fixtures.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashPassword } from '../lib/auth.mjs';
const mode = process.argv[2] || 'local';
if (!['local', 'write', 'verify'].includes(mode))
  throw new Error('Usage: node scripts/http-smoke.mjs [local|write|verify]');
const local = mode === 'local';
const origin = process.env.SMOKE_URL || 'http://127.0.0.1:3123';
const password = process.env.SMOKE_PASSWORD || (local ? 'isolated-local-smoke-password' : '');
if (!password) throw new Error('SMOKE_PASSWORD is required for a remote test instance.');
let child,
  directory,
  serverOutput = '';
async function start() {
  const env = {
    ...process.env,
    APP_URL: origin,
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD_HASH: hashPassword(password),
    SESSION_SECRET: 'cd'.repeat(32),
    DATABASE_PATH: join(directory, 'test.sqlite'),
    LIVE_SUBMISSIONS_ENABLED: 'false',
    PORT: new URL(origin).port,
    HOSTNAME: '127.0.0.1',
    NEXT_TELEMETRY_DISABLED: '1',
  };
  // Exercise the exact standalone entrypoint packaged in Docker, including migrations.
  const preflight = spawn(process.execPath, ['scripts/preflight.mjs'], { env, stdio: 'pipe' });
  let output = '';
  preflight.stderr.on('data', (chunk) => {
    output += chunk;
  });
  const [code] = await once(preflight, 'exit');
  assert.equal(code, 0, output);
  child = spawn(process.execPath, ['.next/standalone/server.js'], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (const stream of [child.stdout, child.stderr])
    stream.on('data', (chunk) => {
      serverOutput += chunk;
    });
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  const current = child;
  child = undefined;
  const finished = once(current, 'exit');
  current.kill('SIGTERM');
  const timer = setTimeout(() => current.kill('SIGKILL'), 5000);
  await finished;
  clearTimeout(timer);
}
async function healthy() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(origin + '/api/health', { signal: AbortSignal.timeout(1000) })).ok) return;
    } catch {}
    if (child?.exitCode !== null && child?.exitCode !== undefined) throw new Error(serverOutput);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Health check timed out. ' + serverOutput);
}
async function request(route, body, cookie, from = origin, extra = {}) {
  return fetch(origin + '/api/' + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Origin: from,
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...extra,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
async function login() {
  const res = await request('auth/login', { username: 'admin', password });
  assert.equal(res.status, 200, await res.clone().text());
  const cookie = res.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly; SameSite=Strict/);
  return cookie.split(';')[0];
}
async function verify(cookie) {
  const state = await request('state', undefined, cookie);
  assert.equal(state.status, 200);
  const data = await state.json();
  assert.equal(data.accounts[0].account, '000000123');
  assert.equal(data.readings.length, 1);
  assert.equal(data.readings[0].values[0].value, '11');
  assert.equal(data.readings[0].status, 'draft');
}
try {
  if (local) {
    directory = mkdtempSync(join(tmpdir(), 'bill-http-'));
    await start();
  }
  await healthy();
  const loginPage = await fetch(origin + '/login');
  assert.equal(loginPage.status, 200);
  const html = await loginPage.text();
  assert.match(html, /Bill Hub/);
  const css = html.match(/href="([^"]+\.css[^"]*)"/);
  assert.ok(css, 'Login page has stylesheet');
  assert.equal((await fetch(origin + css[1].replaceAll('&amp;', '&'))).status, 200);
  assert.equal((await fetch(origin + '/favicon.svg')).status, 200);
  assert.equal((await request('state')).status, 401);
  assert.equal(
    (await request('state', undefined, undefined, origin, { 'oai-authenticated-user-id': 'owner' }))
      .status,
    401,
  );
  assert.equal(
    (await request('auth/login', { username: 'admin', password }, undefined, 'https://evil.test'))
      .status,
    403,
  );
  assert.equal((await request('auth/login', { username: 'admin', password: 'wrong' })).status, 401);
  const cookie = await login();
  if (mode !== 'verify') {
    const account = {
      provider: 'water',
      account: '000000123',
      meters: [{ id: 'smoke-water', kind: 'cold', label: 'Test fixture', previous: '10' }],
    };
    assert.equal((await request('accounts', account, cookie, 'https://evil.test')).status, 403);
    assert.equal((await request('accounts', account, cookie)).status, 200);
    const period = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Bishkek',
      year: 'numeric',
      month: '2-digit',
    }).format(new Date());
    assert.equal(
      (
        await request(
          'readings',
          { provider: 'water', period, values: { 'smoke-water': '9' } },
          cookie,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          'readings',
          { provider: 'water', period, values: { 'smoke-water': '11' } },
          cookie,
        )
      ).status,
      200,
    );
    assert.equal(
      (await request('submit', { id: 'fixture', version: 'fixture', confirmed: true }, cookie))
        .status,
      422,
    );
  }
  await verify(cookie);
  const exported = await request('export', undefined, cookie);
  assert.equal(exported.status, 200);
  assert.equal((await exported.json()).accounts.length, 1);
  if (local) {
    await stop();
    await start();
    await healthy();
    await verify(cookie);
  }
  const out = await request('auth/logout', {}, cookie);
  assert.equal(out.status, 200);
  assert.match(out.headers.get('set-cookie'), /Max-Age=0/);
  console.log(
    `HTTP smoke passed (${mode}): authentication, CSRF, validation, export${local || mode === 'verify' ? ', persisted data after restart' : ''}. No provider submissions.`,
  );
} finally {
  await stop();
  if (directory) rmSync(directory, { recursive: true, force: true });
}
