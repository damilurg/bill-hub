import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { accounts, readings, receipts } from '@/db/schema';
import { failure, identity, json } from '@/lib/api';
export async function GET(request: Request) {
  try {
    const owner = identity(request),
      db = getDb();
    const [a, r, rec] = await Promise.all([
      db.select().from(accounts).where(eq(accounts.owner, owner)),
      db.select().from(readings).where(eq(readings.owner, owner)),
      db.select().from(receipts).where(eq(receipts.owner, owner)),
    ]);
    return json({
      accounts: a.map(({ owner: _o, id: _id, ...v }) => ({ ...v, meters: JSON.parse(v.meters) })),
      readings: r.map(({ owner: _o, ...v }) => ({ ...v, values: JSON.parse(v.values) })),
      receipts: rec.map(({ owner: _o, ...v }) => ({
        ...v,
        paidAmount: v.paidAmount,
        dueDate: v.dueDate,
        paidDate: v.paidDate,
        fileName: v.fileName,
        fileData: v.fileData,
        items: JSON.parse(v.items),
      })),
    });
  } catch (e) {
    return failure(e);
  }
}
