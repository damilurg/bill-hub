// Contract observed in the official public Vue client, 2026-10-22.
export type GasResult = {
  status: 'confirmed' | 'unknown' | 'rejected' | 'blocked';
  detail: string;
};
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
const ORIGIN = 'https://www.gazprom.kg';
export const GAS_ENDPOINT = 'https://api.gazprom.kg/api/v1/facility/readings';
let publicBootstrap: { value: string; expires: number } | undefined;
export function extractPublicClientKey(script: string): string {
  const key = script.match(/\("api-token","([^"\n]+)"\)/)?.[1];
  if (!key || key.length > 512) throw new Error('Изменился формат официального клиента.');
  return key;
}
export function extractPublicScript(html: string): string {
  const path = html.match(/<script\b[^>]*\bsrc=["'](\/assets\/index-[a-zA-Z0-9_-]+\.js)["']/)?.[1];
  if (!path) throw new Error('Не найден официальный клиент.');
  return ORIGIN + path;
}
async function bootstrap(fetcher: Fetcher): Promise<string> {
  if (publicBootstrap && publicBootstrap.expires > Date.now() && fetcher === fetch)
    return publicBootstrap.value;
  const opts = { redirect: 'error' as const, signal: AbortSignal.timeout(10000) };
  const home = await fetcher(ORIGIN + '/', opts);
  if (!home.ok) throw new Error('Сайт поставщика недоступен.');
  const script = await fetcher(extractPublicScript(await home.text()), {
    ...opts,
    signal: AbortSignal.timeout(10000),
  });
  if (!script.ok) throw new Error('Клиент поставщика недоступен.');
  const value = extractPublicClientKey(await script.text());
  if (fetcher === fetch) publicBootstrap = { value, expires: Date.now() + 15 * 60000 };
  return value;
}
export function gasPayload(account: string, reading: string) {
  if (!/^\d{9}$/.test(account) || !/^\d{1,7}$/.test(reading) || Number(reading) < 1)
    throw new Error('Некорректные данные для Газпрома.');
  return { account, reading: Number(reading) };
}
export function gasReceipt(data: unknown): GasResult {
  if (!data || typeof data !== 'object' || Array.isArray(data))
    return {
      status: 'unknown',
      detail:
        'Получен неожиданный ответ. Проверьте результат у поставщика перед повторной отправкой.',
    };
  const d = data as Record<string, unknown>;
  const numeric = (v: unknown) =>
    (typeof v === 'number' || (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v))) &&
    Number.isFinite(Number(v)) &&
    Number(v) >= 0;
  if (
    d.error ||
    d.success === false ||
    !['consumption', 'payAmount', 'tariff'].every((k) => numeric(d[k]))
  )
    return {
      status: 'unknown',
      detail: 'Ответ не подтверждает приём. Проверьте лицевой счёт на сайте Газпрома.',
    };
  return {
    status: 'confirmed',
    detail: `Поставщик вернул расчёт: расход ${d.consumption} м³; к оплате ${d.payAmount} сом; тариф ${d.tariff}. Отдельный номер квитанции API не возвращает.`,
  };
}
export async function sendGas(
  account: string,
  reading: string,
  fetcher: Fetcher = fetch,
): Promise<GasResult> {
  const body = gasPayload(account, reading);
  let publicKey: string;
  try {
    publicKey = await bootstrap(fetcher);
  } catch {
    return {
      status: 'blocked',
      detail: 'Не удалось загрузить официальный клиент. Показания не отправлялись.',
    };
  }
  try {
    const r = await fetcher(GAS_ENDPOINT, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Lang: 'ru',
        'api-token': publicKey,
      },
      body: JSON.stringify(body),
    });
    if (r.status === 409)
      return {
        status: 'rejected',
        detail:
          'Газпром отклонил показание: проверьте предыдущее значение в кабинете. Автоматический перерасчёт не выполнялся.',
      };
    if (!r.ok)
      return {
        status: 'unknown',
        detail: `Поставщик ответил HTTP ${r.status}. Повторная отправка заблокирована до проверки результата.`,
      };
    return gasReceipt(await r.json());
  } catch {
    return {
      status: 'unknown',
      detail:
        'Ответ не получен. Запрос мог быть принят; проверьте сайт Газпрома. Автоповтор выключен.',
    };
  }
}
