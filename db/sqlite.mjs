import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
let connection;
export function databasePath() {
  return process.env.DATABASE_PATH || resolve('data/bill-hub.sqlite');
}
export function getSqlite() {
  if (!connection) {
    const file = databasePath();
    if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
    connection = new DatabaseSync(file);
    connection.exec(
      'PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;',
    );
  }
  return connection;
}
export async function remoteQuery(sql, params, method) {
  const statement = getSqlite().prepare(sql);
  if (method === 'run') {
    statement.run(...params);
    return { rows: [] };
  }
  statement.setReturnArrays(true);
  return { rows: method === 'get' ? statement.get(...params) || [] : statement.all(...params) };
}
