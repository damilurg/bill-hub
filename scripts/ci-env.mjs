// Disposable CI configuration. Never use these credentials for a real deployment.
import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { hashPassword } from '../lib/auth.mjs';
if (!process.env.CI || !process.env.SMOKE_PASSWORD)
  throw new Error('This script is only for CI. For deployment use scripts/setup.mjs.');
writeFileSync(
  '.env.ci',
  `APP_URL=${process.env.SMOKE_URL}\nADMIN_USERNAME=admin\nADMIN_PASSWORD_HASH=${hashPassword(process.env.SMOKE_PASSWORD)}\nSESSION_SECRET=${randomBytes(32).toString('hex')}\nLIVE_SUBMISSIONS_ENABLED=false\n`,
  { mode: 0o600 },
);
