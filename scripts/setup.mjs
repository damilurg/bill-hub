import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { hashPassword } from '../lib/auth.mjs';
const urlIndex = process.argv.indexOf('--url');
const origin = new URL(urlIndex >= 0 ? process.argv[urlIndex + 1] : 'http://localhost:3000');
if (
  !['http:', 'https:'].includes(origin.protocol) ||
  origin.username ||
  origin.password ||
  origin.pathname !== '/' ||
  origin.search ||
  origin.hash
)
  throw new Error('Use --url with an http(s) origin, for example https://bills.example.com');
const password = randomBytes(24).toString('base64url');
const text = `APP_URL=${origin.origin}\nADMIN_USERNAME=admin\nADMIN_PASSWORD_HASH=${hashPassword(password)}\nSESSION_SECRET=${randomBytes(32).toString('hex')}\nLIVE_SUBMISSIONS_ENABLED=false\n`;
try {
  writeFileSync('.env', text, { flag: 'wx', mode: 0o600 });
} catch (error) {
  if (error.code === 'EEXIST') throw new Error('.env already exists; it was not modified.');
  throw error;
}
console.log(
  `Created .env. Save these credentials in your password manager:\nLogin: admin\nPassword: ${password}\nURL: ${origin.origin}\nReal submissions are disabled until you set LIVE_SUBMISSIONS_ENABLED=true.`,
);
