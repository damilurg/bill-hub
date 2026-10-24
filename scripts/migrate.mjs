import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { getSqlite } from '../db/sqlite.mjs';
export function migrate(
  db = getSqlite(),
  directory = fileURLToPath(new URL('../drizzle/', import.meta.url)),
) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS _bill_hub_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)',
  );
  const files = readdirSync(directory)
    .filter((f) => /^\d+.*\.sql$/.test(f))
    .sort();
  for (const name of files) {
    const sql = readFileSync(resolve(directory, name), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    db.exec('BEGIN IMMEDIATE');
    try {
      const existing = db
        .prepare('SELECT checksum FROM _bill_hub_migrations WHERE name = ?')
        .get(name);
      if (existing && existing.checksum !== checksum)
        throw new Error(`Applied migration was modified: ${name}`);
      if (!existing) {
        db.exec(sql);
        db.prepare('INSERT INTO _bill_hub_migrations VALUES (?, ?, ?)').run(
          name,
          checksum,
          new Date().toISOString(),
        );
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  migrate();
  console.log('Database migrations complete.');
}
