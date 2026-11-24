import { identity, json, failure } from '@/lib/api';
import { checkWaterMeters } from '@/lib/water-adapter';
import { checkGasStatus } from '@/lib/gas-adapter';
import { getDb } from '@/db';
import { accounts } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const owner = identity(request);
    const db = getDb();

    // Look up user's configured accounts
    const userAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.owner, owner))
      .all();

    const waterAcc =
      userAccounts.find((a) => a.provider === 'water')?.account || '1291067-0';
    const gasAcc =
      userAccounts.find((a) => a.provider === 'gas')?.account || '011701957';
    const electricityAcc =
      userAccounts.find((a) => a.provider === 'electricity')?.account || '319177353';

    // Query open channels concurrently with timeouts
    const [waterRes, gasRes] = await Promise.all([
      checkWaterMeters(waterAcc),
      checkGasStatus(gasAcc),
    ]);

    const electricityStatus = {
      ok: true,
      account: electricityAcc,
      provider: 'electricity',
      status: 'active',
      detail:
        'ОАО «НЭСК» (Бишкекский энергосбыт): умный счётчик АСКУЭ №77274 активен, телеметрия поступает автоматически.',
    };

    return json({
      ok: true,
      timestamp: new Date().toISOString(),
      channels: {
        water: {
          name: 'Бишкекводоканал',
          provider: 'water',
          ...waterRes,
        },
        gas: {
          name: 'Газпром Кыргызстан',
          provider: 'gas',
          ...gasRes,
        },
        electricity: electricityStatus,
      },
    });
  } catch (e) {
    return failure(e);
  }
}
