import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { readings } from '@/db/schema';
import { failure, identity, json, readJson } from '@/lib/api';
import { bishkekPeriod, ValidationError } from '@/lib/domain';
import { sendGas, gasPayload } from '@/lib/gas-adapter';
import { getConfig } from '@/lib/config.mjs';
import { dispatchOnce } from '@/lib/submission';
export async function POST(request: Request) {
  try {
    const owner = identity(request, true);
    if (!getConfig().live)
      return json({ error: 'Передача поставщикам отключена в настройках сервера.' }, 422);
    const input = await readJson(request),
      db = getDb();
    if (
      input?.confirmed !== true ||
      typeof input?.id !== 'string' ||
      typeof input?.version !== 'string'
    )
      throw new ValidationError('Проверьте и подтвердите показания перед отправкой.');
    const [r] = await db
      .select()
      .from(readings)
      .where(and(eq(readings.owner, owner), eq(readings.id, input.id)));
    if (!r) return json({ error: 'Запись не найдена.' }, 404);
    if (r.provider !== 'gas')
      return json({ error: 'Автоотправка этого поставщика пока не подключена.' }, 422);
    if (r.period !== bishkekPeriod())
      throw new ValidationError('Поставщику можно отправить только текущий месяц.');
    const day = Number(
      new Intl.DateTimeFormat('en', { timeZone: 'Asia/Bishkek', day: 'numeric' }).format(
        new Date(),
      ),
    );
    if (day < 10)
      throw new ValidationError(
        'Официальная форма газа открывается с 10 числа; рекомендуемый срок — 15–30.',
      );
    const values = JSON.parse(r.values);
    if (values.length !== 1) throw new ValidationError('Проверьте счётчик газа.');
    gasPayload(r.account, values[0].value);
    const result = await dispatchOnce(
      r.id,
      {
        async claim(id) {
          const rows = await db
            .update(readings)
            .set({
              status: 'sending',
              detail: 'Запрос отправляется. Не повторяйте его до проверки результата.',
            })
            .where(
              and(
                eq(readings.id, id),
                eq(readings.owner, owner),
                eq(readings.created, input.version),
                inArray(readings.status, ['draft', 'blocked', 'rejected']),
              ),
            )
            .returning({ id: readings.id });
          return rows.length === 1;
        },
        async finish(id, result) {
          await db
            .update(readings)
            .set({ status: result.status, detail: result.detail })
            .where(
              and(eq(readings.id, id), eq(readings.owner, owner), eq(readings.status, 'sending')),
            );
        },
      },
      () => sendGas(r.account, values[0].value),
    );
    return json(result, result.status === 'duplicate' ? 409 : 200);
  } catch (e) {
    return failure(e);
  }
}
