import { spawn } from 'node:child_process';
import { getConfig } from '../lib/config.mjs';
import { migrate } from './migrate.mjs';
getConfig();
migrate();
const child = spawn(process.execPath, ['.next/standalone/server.js'], {
  stdio: 'inherit',
  env: { ...process.env, HOSTNAME: process.env.BIND_HOST || '0.0.0.0' },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 1));
child.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});
