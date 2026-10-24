import { test } from 'node:test';
import assert from 'node:assert/strict';
import { password, testCookie } from './test-env.mjs';
import {
  createSession,
  verifySession,
  verifyPassword,
  sessionCookie,
  sessionFromRequest,
  LoginLimiter,
  SESSION_SECONDS,
} from '../lib/auth.mjs';
import { getConfig } from '../lib/config.mjs';
test('password hashing checks credentials without plaintext storage', async () => {
  assert.equal(await verifyPassword('admin', password), true);
  assert.equal(await verifyPassword('wrong', password), false);
  assert.equal(await verifyPassword('admin', 'wrong'), false);
  assert.equal(await verifyPassword('admin', 'a'.repeat(257)), false);
  assert.equal(process.env.ADMIN_PASSWORD_HASH.includes(password), false);
});
test('signed sessions reject tampering, expiry and future creation', () => {
  const now = Date.now(),
    token = createSession(now);
  assert.equal(verifySession(token, now), 'owner');
  assert.equal(verifySession(token, now + SESSION_SECONDS * 1000), null);
  assert.equal(verifySession(createSession(now + 60000), now), null);
  assert.equal(verifySession(token.slice(0, -1) + '!'), null);
  assert.equal(verifySession('e30.' + token.split('.')[1]), null);
  assert.equal(verifySession(token + '.extra'), null);
});
test('cookie is HTTP-only, Strict and Secure for HTTPS', () => {
  assert.match(sessionCookie('fixture'), /HttpOnly; SameSite=Strict/);
  assert.match(sessionCookie('fixture'), /; Secure$/);
  assert.match(sessionCookie('', true), /Max-Age=0/);
  assert.equal(
    sessionFromRequest(
      new Request('https://app.test', { headers: { cookie: `other=1; ${testCookie()}` } }),
    ),
    'owner',
  );
});
test('single-household login limit cannot be evaded by changing username or IP headers', () => {
  const limiter = new LoginLimiter();
  for (let i = 0; i < 8; i++) assert.equal(limiter.reserve(1000), 0);
  assert.equal(limiter.reserve(1000), 900);
  assert.equal(limiter.reserve(901000), 0);
  limiter.reset();
  assert.equal(limiter.reserve(901000), 0);
});
test('configuration fails closed and origin must not contain credentials or a path', () => {
  for (const change of [
    { SESSION_SECRET: 'bad' },
    { ADMIN_PASSWORD_HASH: '' },
    { APP_URL: 'https://app.test/path' },
    { APP_URL: 'https://user:secret@app.test' },
    { LIVE_SUBMISSIONS_ENABLED: 'yes' },
  ])
    assert.throws(() => getConfig({ ...process.env, ...change }));
  assert.equal(getConfig().origin, 'https://app.test');
});
