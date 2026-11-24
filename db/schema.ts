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
export const receipts = sqliteTable(
  'utility_receipts',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    period: text('period').notNull(),
    category: text('category').notNull(),
    title: text('title').notNull(),
    account: text('account').notNull(),
    amount: text('amount').notNull(),
    paidAmount: text('paid_amount').notNull(),
    status: text('status').notNull(),
    dueDate: text('due_date').notNull(),
    paidDate: text('paid_date').notNull(),
    items: text('items').notNull(),
    fileName: text('file_name').notNull(),
    fileData: text('file_data').notNull(),
    paymentMethod: text('payment_method').default('').notNull(),
    transactionId: text('transaction_id').default('').notNull(),
    paidFileName: text('paid_file_name').default('').notNull(),
    paidFileData: text('paid_file_data').default('').notNull(),
    notes: text('notes').notNull(),
    created: text('created').notNull(),
    updated: text('updated').notNull(),
  },
  (t) => [
    uniqueIndex('receipt_owner_period_category_account').on(
      t.owner,
      t.period,
      t.category,
      t.account,
    ),
  ],
);
