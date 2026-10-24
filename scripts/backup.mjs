import { backup } from 'node:sqlite';
import { chmodSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { databasePath, getSqlite } from '../db/sqlite.mjs';
export async function backupTo(destination) {
  const file = resolve(destination);
  if (file === resolve(databasePath()))
    throw new Error('Backup must not replace the active database.');
  mkdirSync(dirname(file), { recursive: true });
  await backup(getSqlite(), file);
  chmodSync(file, 0o600);
  return file;
}
const destination =
  process.argv[2] ||
  resolve(
    dirname(databasePath()),
    'backups',
    `bill-hub-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`,
  );
console.log(await backupTo(destination));
