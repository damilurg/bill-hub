import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync, backup } from 'node:sqlite';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { migrate } from '../scripts/migrate.mjs';
test('migration is repeatable and refuses edited applied SQL', () => {
  const db = new DatabaseSync(':memory:'),
    directory = mkdtempSync(join(tmpdir(), 'bill-migration-'));
  try {
    writeFileSync(join(directory, '0001_test.sql'), 'CREATE TABLE fixture (id TEXT);');
    migrate(db, directory);
    migrate(db, directory);
    assert.equal(db.prepare('SELECT count(*) AS n FROM _bill_hub_migrations').get().n, 1);
    writeFileSync(join(directory, '0001_test.sql'), 'DROP TABLE fixture;');
    assert.throws(() => migrate(db, directory), /modified/);
    assert.equal(db.prepare('SELECT count(*) AS n FROM fixture').get().n, 0);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
test('online SQLite backup contains committed WAL data and can be reopened', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bill-backup-'));
  const db = new DatabaseSync(join(directory, 'live.sqlite'));
  try {
    db.exec('PRAGMA journal_mode = WAL;');
    migrate(db);
    db.prepare('INSERT INTO utility_accounts VALUES (?, ?, ?, ?, ?, ?)').run(
      'fixture',
      'owner',
      'water',
      '000000123',
      '[]',
      'test',
    );
    await backup(db, join(directory, 'backup.sqlite'));
    const restored = new DatabaseSync(join(directory, 'backup.sqlite'), { readOnly: true });
    try {
      assert.equal(restored.prepare('PRAGMA quick_check').get().quick_check, 'ok');
      assert.equal(
        restored.prepare('SELECT account FROM utility_accounts').get().account,
        '000000123',
      );
    } finally {
      restored.close();
    }
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
