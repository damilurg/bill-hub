import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const accounts = sqliteTable(
  'utility_accounts',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    provider: text('provider').notNull(),
    account: text('account').notNull(),
    meters: text('meters').notNull(),
    updated: text('updated').notNull(),
  },
  (t) => [uniqueIndex('account_owner_provider').on(t.owner, t.provider)],
);
export const readings = sqliteTable(
  'utility_readings',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    provider: text('provider').notNull(),
    account: text('account').notNull(),
    period: text('period').notNull(),
    values: text('values').notNull(),
    status: text('status').notNull(),
    detail: text('detail').notNull(),
    created: text('created').notNull(),
  },
  (t) => [uniqueIndex('reading_owner_provider_period').on(t.owner, t.provider, t.period)],
);
