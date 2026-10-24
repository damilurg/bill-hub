import { eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { accounts, readings } from '@/db/schema';
import { failure, identity } from '@/lib/api';
export async function GET(request: Request) {
  try {
    const owner = identity(request),
      db = getDb();
    const [a, r] = await Promise.all([
      db.select().from(accounts).where(eq(accounts.owner, owner)),
      db.select().from(readings).where(eq(readings.owner, owner)),
    ]);
    return new Response(
      JSON.stringify(
        {
          format: 1,
          exportedAt: new Date().toISOString(),
          accounts: a.map(({ owner: _o, ...v }) => ({ ...v, meters: JSON.parse(v.meters) })),
          readings: r.map(({ owner: _o, ...v }) => ({ ...v, values: JSON.parse(v.values) })),
        },
        null,
        2,
      ),
      {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="bill-hub-readings.json"',
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (e) {
    return failure(e);
  }
}
