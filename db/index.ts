import { drizzle } from 'drizzle-orm/sqlite-proxy';
import * as schema from './schema';
import { remoteQuery } from './sqlite.mjs';
export function getDb() {
  return drizzle(remoteQuery, { schema });
}
