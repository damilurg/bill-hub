import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { accounts, readings } from '@/db/schema';
import { failure, identity, json } from '@/lib/api';
export async function GET(request: Request) {
  try {
    const owner = identity(request),
      db = getDb();
    const [a, r] = await Promise.all([
      db.select().from(accounts).where(eq(accounts.owner, owner)),
      db.select().from(readings).where(eq(readings.owner, owner)),
    ]);
    return json({
      accounts: a.map(({ owner: _o, id: _id, ...v }) => ({ ...v, meters: JSON.parse(v.meters) })),
      readings: r.map(({ owner: _o, ...v }) => ({ ...v, values: JSON.parse(v.values) })),
    });
  } catch (e) {
    return failure(e);
  }
}
