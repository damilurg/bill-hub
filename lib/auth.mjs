import { createHmac, randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { getConfig } from './config.mjs';
const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const COOKIE_NAME = 'bill_hub_session';
export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 16 || password.length > 256)
    throw new Error('Password must contain 16–256 characters.');
  const salt = randomBytes(16).toString('hex');
  return `scrypt-v1:${salt}:${scryptSync(password, salt, 64, options).toString('hex')}`;
}
export async function verifyPassword(username, password) {
  const config = getConfig();
  if (typeof username !== 'string' || typeof password !== 'string' || password.length > 256)
    return false;
  const [, salt, expected] = config.passwordHash.split(':');
  const actual = await derive(password, salt, 64, options);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex')) && username === config.username;
}
function signature(data) {
  return createHmac('sha256', Buffer.from(getConfig().secret, 'hex'))
    .update(data)
    .digest('base64url');
}
export function createSession(now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const data = Buffer.from(
    JSON.stringify({ v: 1, sub: 'owner', iat, exp: iat + SESSION_SECONDS }),
  ).toString('base64url');
  return `${data}.${signature(data)}`;
}
export function verifySession(token, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 2048) return null;
  const pieces = token.split('.');
  if (pieces.length !== 2 || !pieces.every((p) => /^[A-Za-z0-9_-]+$/.test(p))) return null;
  const [data, sig] = pieces;
  const expected = signature(data);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
    return null;
  try {
    const value = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    const seconds = Math.floor(now / 1000);
    if (
      value.v !== 1 ||
      value.sub !== 'owner' ||
      !Number.isInteger(value.iat) ||
      !Number.isInteger(value.exp) ||
      value.iat > seconds + 30 ||
      value.exp <= seconds ||
      value.exp - value.iat !== SESSION_SECONDS
    )
      return null;
    return 'owner';
  } catch {
    return null;
  }
}
export function sessionFromRequest(request) {
  const token = (request.headers.get('cookie') || '')
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(COOKIE_NAME + '='))
    ?.slice(COOKIE_NAME.length + 1);
  return verifySession(token);
}
export function sessionCookie(token, clear = false) {
  return `${COOKIE_NAME}=${clear ? '' : token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : SESSION_SECONDS}${getConfig().secure ? '; Secure' : ''}`;
}
// One private household instance: a process-wide limit avoids trusting proxy IP headers.
// State resets on restart. Add a reverse-proxy limit for an Internet-facing server.
export class LoginLimiter {
  attempts = 0;
  until = 0;
  reserve(now = Date.now()) {
    if (now >= this.until) {
      this.attempts = 0;
      this.until = now + 15 * 60 * 1000;
    }
    if (this.attempts >= 8) return Math.ceil((this.until - now) / 1000);
    this.attempts++;
    return 0;
  }
  reset() {
    this.attempts = 0;
    this.until = 0;
  }
}
export const loginLimiter = new LoginLimiter();
