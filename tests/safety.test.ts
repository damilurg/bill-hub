import { testCookie } from './test-env.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identity, readJson } from '../lib/api.ts';
import { dispatchOnce, type SubmissionStore } from '../lib/submission.ts';
import type { GasResult } from '../lib/gas-adapter.ts';
const request = (headers: Record<string, string>) =>
  new Request('https://app.test/api/submit', { method: 'POST', headers });
test('API requires authenticated owner', () =>
  assert.throws(
    () => identity(request({})),
    (e: unknown) => e instanceof Response && e.status === 401,
  ));
test('mutations reject cross-origin and non-JSON requests', () => {
  for (const headers of [
    { cookie: testCookie(), origin: 'https://evil.test', 'content-type': 'application/json' },
    { cookie: testCookie(), origin: 'https://app.test', 'content-type': 'text/plain' },
    {
      cookie: testCookie(),
      origin: 'https://app.test',
      'content-type': 'application/json',
      'sec-fetch-site': 'cross-site',
    },
  ])
    assert.throws(() => identity(request(headers as Record<string, string>), true));
});
test('same-origin mutation uses verified session', () =>
  assert.equal(
    identity(
      request({
        cookie: testCookie(),
        origin: 'https://app.test',
        'content-type': 'application/json',
      }),
      true,
    ),
    'owner',
  ));
test('spoofed hosting headers do not authenticate', () =>
  assert.throws(
    () => identity(request({ 'oai-authenticated-user-id': 'owner' })),
    (e: unknown) => e instanceof Response && e.status === 401,
  ));
test('malformed and oversized JSON rejected', async () => {
  for (const body of ['{bad', ' '.repeat(20001)])
    await assert.rejects(readJson(new Request('https://app.test', { method: 'POST', body })));
});
function store() {
  const claimed = new Set<string>(),
    results = new Map<string, GasResult>();
  const db: SubmissionStore = {
    async claim(k) {
      if (claimed.has(k)) return false;
      claimed.add(k);
      return true;
    },
    async finish(k, r) {
      results.set(k, r);
    },
  };
  return { db, results };
}
test('simultaneous duplicate clicks cause only one provider write', async () => {
  const { db } = store();
  let calls = 0;
  const send = async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 5));
    return { status: 'confirmed' as const, detail: 'receipt' };
  };
  const results = await Promise.all([
    dispatchOnce('same', db, send),
    dispatchOnce('same', db, send),
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(results.map((r) => r.status).sort(), ['confirmed', 'duplicate']);
});
test('uncertain outcome cannot automatically retry the same key', async () => {
  const { db, results } = store();
  let calls = 0;
  const send = async () => {
    calls++;
    throw new Error('lost response');
  };
  assert.equal((await dispatchOnce('same', db, send)).status, 'unknown');
  assert.equal((await dispatchOnce('same', db, send)).status, 'duplicate');
  assert.equal(calls, 1);
  assert.equal(results.get('same')?.status, 'unknown');
});
test('persist failure leaves the claim locked, preventing blind retry', async () => {
  const { db } = store();
  db.finish = async () => {
    throw new Error('database unavailable');
  };
  let calls = 0;
  const send = async () => {
    calls++;
    return { status: 'confirmed' as const, detail: 'receipt' };
  };
  await assert.rejects(dispatchOnce('same', db, send));
  assert.equal((await dispatchOnce('same', db, send)).status, 'duplicate');
  assert.equal(calls, 1);
});
