import { getDb } from '@/db';
import { accounts } from '@/db/schema';
import { failure, identity, json, readJson } from '@/lib/api';
import { validateAccount } from '@/lib/domain';
export async function POST(request: Request) {
  try {
    const owner = identity(request, true),
      a = validateAccount(await readJson(request)),
      updated = new Date().toISOString();
    await getDb()
      .insert(accounts)
      .values({ id: crypto.randomUUID(), owner, ...a, meters: JSON.stringify(a.meters), updated })
      .onConflictDoUpdate({
        target: [accounts.owner, accounts.provider],
        set: { account: a.account, meters: JSON.stringify(a.meters), updated },
      });
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
