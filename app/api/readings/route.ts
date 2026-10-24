import { and, eq, inArray, desc, lte } from 'drizzle-orm';
import { getDb } from '@/db';
import { accounts, readings } from '@/db/schema';
import { failure, identity, json, readJson } from '@/lib/api';
import {
  providerId,
  validatePeriod,
  validateValues,
  ValidationError,
  type Meter,
  type ReadingValue,
  toMilli,
} from '@/lib/domain';
export async function POST(request: Request) {
  try {
    const owner = identity(request, true),
      input = await readJson(request),
      provider = providerId(input?.provider),
      period = validatePeriod(input?.period),
      db = getDb();
    const [a] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.owner, owner), eq(accounts.provider, provider)));
    if (!a) throw new ValidationError('Сначала добавьте лицевой счёт.');
    const meters: Meter[] = JSON.parse(a.meters);
    const [last] = await db
      .select()
      .from(readings)
      .where(
        and(
          eq(readings.owner, owner),
          eq(readings.provider, provider),
          eq(readings.account, a.account),
          eq(readings.status, 'confirmed'),
          lte(readings.period, period),
        ),
      )
      .orderBy(desc(readings.period))
      .limit(1);
    if (last)
      for (const old of JSON.parse(last.values) as ReadingValue[]) {
        const m = meters.find((m) => m.id === old.meterId);
        if (m && (m.previous === '' || toMilli(m.previous) < toMilli(old.value)))
          m.previous = old.value;
      }
    const values = validateValues({ ...a, provider, meters }, input?.values),
      created = new Date().toISOString();
    const row = await db
      .insert(readings)
      .values({
        id: crypto.randomUUID(),
        owner,
        provider,
        account: a.account,
        period,
        values: JSON.stringify(values),
        status: 'draft',
        detail: 'Сохранено у вас. Поставщику не отправлено.',
        created,
      })
      .onConflictDoUpdate({
        target: [readings.owner, readings.provider, readings.period],
        set: {
          values: JSON.stringify(values),
          account: a.account,
          status: 'draft',
          detail: 'Сохранено у вас. Поставщику не отправлено.',
          created,
        },
        setWhere: inArray(readings.status, ['draft', 'blocked', 'rejected']),
      })
      .returning({ id: readings.id });
    if (!row.length)
      return json(
        {
          error:
            'Запись уже отправлялась. Сначала проверьте её статус; автоматическая перезапись выключена.',
        },
        409,
      );
    return json({ ok: true, status: 'draft' });
  } catch (e) {
    return failure(e);
  }
}
