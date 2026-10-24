import { hashPassword, createSession } from '../lib/auth.mjs';
export const password = 'test-only-password-do-not-deploy';
process.env.APP_URL = 'https://app.test';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD_HASH = hashPassword(password);
process.env.SESSION_SECRET = 'ab'.repeat(32);
process.env.LIVE_SUBMISSIONS_ENABLED = 'true';
export const testCookie = () => `bill_hub_session=${createSession()}`;
