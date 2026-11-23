import { normalizeReading, toMilli } from './domain.ts';
export type WaterMeter = {
  HYDID: string;
  HYDNUM: string;
  HG: 'H' | 'G';
  POKAZAN: string;
  ADDRESS: string;
  BRANCHID: string;
  CLIENTID: string;
  VODPP: string;
};
export type WaterResult = {
  status: 'confirmed' | 'unknown' | 'rejected' | 'blocked';
  detail: string;
};
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export const WATER_ORIGIN = 'https://voda.link.kg';

export function matchWaterValues(
  meters: WaterMeter[],
  userValues: Array<{ meterId: string; value: string; kind?: 'cold' | 'hot'; label?: string }>,
): Record<string, string> {
  const map: Record<string, string> = {};
  const usedUserIndices = new Set<number>();

  for (const m of meters) {
    const key = `${m.HYDID}:${m.HYDNUM}`;
    let idx = userValues.findIndex(
      (v, i) =>
        !usedUserIndices.has(i) &&
        (v.meterId === key ||
          v.meterId === m.HYDNUM ||
          v.meterId === m.HYDID ||
          (v.label && v.label.includes(m.HYDNUM))),
    );

    if (idx === -1) {
      const neededKind = m.HG === 'H' ? 'cold' : 'hot';
      const kindMatches = userValues
        .map((v, i) => ({ v, i }))
        .filter(({ v, i }) => !usedUserIndices.has(i) && v.kind === neededKind);

      if (kindMatches.length === 1) {
        idx = kindMatches[0].i;
      }
    }

    if (idx !== -1) {
      usedUserIndices.add(idx);
      map[key] = userValues[idx].value;
    }
  }

  return map;
}

export function waterPayload(
  account: string,
  meters: WaterMeter[],
  values: Record<string, string>,
) {
  if (!meters.length || Object.keys(values).length !== meters.length)
    throw new Error('Нужны показания всех водомеров, включая горячую воду для стоков.');
  return {
    mode: 'upSert',
    account,
    data: meters.map((m) => {
      const value = normalizeReading(values[m.HYDID + ':' + m.HYDNUM]);
      if (value.includes('.'))
        throw new Error('Подтвердите целое показание; автоматического округления нет.');
      return {
        'data-address': m.ADDRESS || '',
        'data-branchid': m.BRANCHID || '',
        'data-clientid': m.CLIENTID || '',
        'data-hg': m.HG || '',
        'data-hydid': String(m.HYDID ?? ''),
        'data-hydnum': String(m.HYDNUM ?? ''),
        'data-vodpp': String(m.VODPP ?? ''),
        value,
      };
    }),
  };
}

export function waterReceipt(input: unknown, expected: number) {
  const r = input as {
    ok?: unknown;
    result?: { ID_ROW?: unknown; insert?: unknown; update?: unknown };
  };
  const ids = r?.result?.ID_ROW,
    inserts = r?.result?.insert,
    updates = r?.result?.update;
  if (
    r?.ok !== true ||
    !Array.isArray(ids) ||
    ids.length !== expected ||
    expected < 1 ||
    ids.some((x) => !/^[1-9]\d*$/.test(String(x))) ||
    new Set(ids.map(String)).size !== ids.length
  )
    return 'unknown';
  return ids.every(
    (_, i) =>
      (Array.isArray(inserts) && inserts[i] === 1) ||
      (Array.isArray(updates) && [0, 1].includes(updates[i])),
  )
    ? 'confirmed'
    : 'unknown';
}

export async function sendWater(
  account: string,
  userValues: Array<{ meterId: string; value: string; kind?: 'cold' | 'hot'; label?: string }>,
  fetcher: Fetcher = fetch,
): Promise<WaterResult> {
  let loginRes: Response;
  try {
    loginRes = await fetcher(`${WATER_ORIGIN}/send/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ mode: 'login', data: account }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return {
      status: 'blocked',
      detail: 'Сайт Бишкекводоканала недоступен. Показания не отправлялись.',
    };
  }

  if (!loginRes.ok) {
    return {
      status: 'blocked',
      detail: `Бишкекводоканал ответил HTTP ${loginRes.status}. Показания не отправлялись.`,
    };
  }

  let loginData: unknown;
  try {
    loginData = await loginRes.json();
  } catch {
    return {
      status: 'blocked',
      detail: 'Получен некорректный ответ от Бишкекводоканала. Показания не отправлялись.',
    };
  }

  if (!Array.isArray(loginData) || loginData[0] === 0) {
    return {
      status: 'rejected',
      detail: `Бишкекводоканал: лицевой счёт ${account} не найден. Проверьте номер счёта.`,
    };
  }

  const sessionPath = String(loginData[1] || '');
  if (!sessionPath) {
    return {
      status: 'blocked',
      detail: 'Не удалось получить путь сессии от Бишкекводоканала.',
    };
  }

  let formRes: Response;
  try {
    formRes = await fetcher(`${WATER_ORIGIN}/send/${sessionPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ mode: 'loadForm', account }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return {
      status: 'blocked',
      detail: 'Не удалось загрузить счётчики с портала Бишкекводоканала.',
    };
  }

  if (!formRes.ok) {
    return {
      status: 'blocked',
      detail: `Ошибка загрузки формы Бишкекводоканала (HTTP ${formRes.status}).`,
    };
  }

  let formData: Record<string, unknown>;
  try {
    formData = (await formRes.json()) as Record<string, unknown>;
  } catch {
    return {
      status: 'blocked',
      detail: 'Не удалось прочитать список водомеров Бишкекводоканала.',
    };
  }

  const waterMeters: WaterMeter[] = (formData?.waterMeters as WaterMeter[]) || [];
  if (!Array.isArray(waterMeters) || waterMeters.length === 0) {
    return {
      status: 'rejected',
      detail: 'В Бишкекводоканале не найдены зарегистрированные водомеры по этому счёту.',
    };
  }

  const valuesMap = matchWaterValues(waterMeters, userValues);
  if (Object.keys(valuesMap).length !== waterMeters.length) {
    return {
      status: 'rejected',
      detail: `Нужны показания для всех водомеров (${waterMeters.length} шт.), включая холодную воду и горячую для стоков. Сопоставлено: ${Object.keys(valuesMap).length}.`,
    };
  }

  let payload;
  try {
    payload = waterPayload(account, waterMeters, valuesMap);
  } catch (e) {
    return {
      status: 'rejected',
      detail: (e as Error).message,
    };
  }

  try {
    const writeRes = await fetcher(`${WATER_ORIGIN}/send/${sessionPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    if (!writeRes.ok) {
      return {
        status: 'unknown',
        detail: `Бишкекводоканал ответил HTTP ${writeRes.status}. Проверьте результат перед повтором.`,
      };
    }

    const writeData = await writeRes.json();
    const receipt = waterReceipt(writeData, waterMeters.length);
    if (receipt === 'confirmed') {
      return {
        status: 'confirmed',
        detail: `Бишкекводоканал подтвердил приём показаний: сохранено счётчиков — ${waterMeters.length}.`,
      };
    }
    return {
      status: 'unknown',
      detail:
        'Бишкекводоканал вернул ответ без подтверждения. Проверьте показания на сайте voda.link.kg.',
    };
  } catch {
    return {
      status: 'unknown',
      detail:
        'Ответ от Бишкекводоканала не получен вовремя. Запрос мог быть принят; автоповтор заблокирован.',
    };
  }
}
