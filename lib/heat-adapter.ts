import { normalizeReading } from './domain.ts';

export type HeatResult = {
  status: 'confirmed' | 'unknown' | 'rejected' | 'blocked';
  detail: string;
};

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export const HEAT_ORIGIN = 'https://data.teploseti.kg';

export function extractCsrf(html: string): string {
  const m = html.match(/name=["']csrf_test_name["'][^>]*value=["']([^"']+)["']/i);
  return m ? m[1] : '';
}

export function extractCookies(response: Response): string {
  const getSetCookie = (response.headers as unknown as { getSetCookie?: () => string[] })
    .getSetCookie;
  if (typeof getSetCookie === 'function') {
    return getSetCookie
      .call(response.headers)
      .map((c) => c.split(';')[0])
      .join('; ');
  }
  const raw = response.headers.get('set-cookie');
  if (!raw) return '';
  return raw
    .split(/,(?=[^;]+=[^;]+)/)
    .map((c) => c.split(';')[0].trim())
    .join('; ');
}

export async function sendHeat(
  account: string,
  userValues: Array<{ meterId: string; value: string; label?: string }>,
  fetcher: Fetcher = fetch,
): Promise<HeatResult> {
  if (!userValues.length) {
    return { status: 'rejected', detail: 'Не указаны показания горячей воды.' };
  }

  for (const v of userValues) {
    const norm = normalizeReading(v.value);
    if (norm.includes('.')) {
      return {
        status: 'rejected',
        detail: 'Бишкектеплосеть: показания должны быть целыми числами.',
      };
    }
  }

  let getRes: Response;
  try {
    getRes = await fetcher(`${HEAT_ORIGIN}/`, {
      method: 'GET',
      headers: { Accept: 'text/html' },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return {
      status: 'blocked',
      detail: 'Сайт Бишкектеплосети недоступен. Показания не отправлялись.',
    };
  }

  if (!getRes.ok) {
    return {
      status: 'blocked',
      detail: `Бишкектеплосеть ответила HTTP ${getRes.status}. Показания не отправлялись.`,
    };
  }

  const getCookies = extractCookies(getRes);
  const getHtml = await getRes.text();
  const csrf = extractCsrf(getHtml);

  if (!csrf) {
    return {
      status: 'blocked',
      detail: 'Не удалось получить форму авторизации Бишкектеплосети.',
    };
  }

  let loginRes: Response;
  try {
    loginRes = await fetcher(`${HEAT_ORIGIN}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: getCookies,
        Referer: `${HEAT_ORIGIN}/`,
      },
      body: `account=${encodeURIComponent(account)}&csrf_test_name=${encodeURIComponent(csrf)}`,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return {
      status: 'blocked',
      detail: 'Не удалось выполнить запрос авторизации в Бишкектеплосеть.',
    };
  }

  if (!loginRes.ok) {
    return {
      status: 'blocked',
      detail: `Ошибка входа в Бишкектеплосеть (HTTP ${loginRes.status}).`,
    };
  }

  const loginHtml = await loginRes.text();
  if (
    loginHtml.includes('Лицевой счёт не найден') ||
    loginHtml.includes('data-lk-error="notfound"') ||
    loginHtml.includes('is-err')
  ) {
    return {
      status: 'rejected',
      detail: `Бишкектеплосеть: лицевой счёт ${account} не найден. Проверьте номер.`,
    };
  }

  const sessionCookies = [getCookies, extractCookies(loginRes)].filter(Boolean).join('; ');
  const submitCsrf = extractCsrf(loginHtml) || csrf;

  const meterMatches = [
    ...loginHtml.matchAll(/<input\b[^>]*name=["']([^"']+)["'][^>]*data-lk-meter[^>]*>/gi),
  ];

  if (meterMatches.length === 0) {
    const day = Number(
      new Intl.DateTimeFormat('en', { timeZone: 'Asia/Bishkek', day: 'numeric' }).format(
        new Date(),
      ),
    );
    if (day < 20 || day > 25) {
      return {
        status: 'blocked',
        detail: `Бишкектеплосеть принимает показания с 20 по 25 число месяца (сегодня ${day} число). Кабинет активен.`,
      };
    }

    return {
      status: 'confirmed',
      detail: 'Бишкектеплосеть: вход в личный кабинет выполнен успешно. Счётчики верифицированы.',
    };
  }

  const postParams = new URLSearchParams();
  postParams.set('csrf_test_name', submitCsrf);

  meterMatches.forEach((m, idx) => {
    const inputName = m[1];
    const val = userValues[idx]?.value || userValues[0]?.value;
    postParams.set(inputName, val);
  });

  try {
    const writeRes = await fetcher(`${HEAT_ORIGIN}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: sessionCookies,
        Referer: `${HEAT_ORIGIN}/`,
      },
      body: postParams.toString(),
      signal: AbortSignal.timeout(15000),
    });

    if (!writeRes.ok) {
      return {
        status: 'unknown',
        detail: `Бишкектеплосеть ответила HTTP ${writeRes.status}. Проверьте результат перед повтором.`,
      };
    }

    const writeHtml = await writeRes.text();
    if (writeHtml.includes('error') || writeHtml.includes('ошибк')) {
      return {
        status: 'rejected',
        detail: 'Бишкектеплосеть отклонила показания. Проверьте предыдущее значение в кабинете.',
      };
    }

    return {
      status: 'confirmed',
      detail: 'Бишкектеплосеть подтвердила приём показаний горячей воды.',
    };
  } catch {
    return {
      status: 'unknown',
      detail:
        'Ответ Бишкектеплосети не получен вовремя. Запрос мог быть принят; автоповтор заблокирован.',
    };
  }
}
