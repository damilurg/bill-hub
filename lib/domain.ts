export const PROVIDERS = ['water', 'heat', 'gas', 'electricity'] as const;
export type ProviderId = (typeof PROVIDERS)[number];
export type Meter = {
  id: string;
  label: string;
  previous: string;
  kind: 'cold' | 'hot' | 'gas' | 'electricity';
};
export type Account = { provider: ProviderId; account: string; meters: Meter[]; updated?: string };
export type ReadingValue = {
  meterId: string;
  label: string;
  value: string;
  previous: string;
  unit: string;
};
export type Reading = {
  id: string;
  provider: ProviderId;
  account: string;
  period: string;
  values: ReadingValue[];
  status: string;
  detail: string;
  created: string;
};
export const providers: Record<
  ProviderId,
  {
    name: string;
    company: string;
    unit: string;
    url: string;
    badge: string;
    explanation: string;
    api: string;
  }
> = {
  water: {
    name: 'Вода',
    company: 'Бишкекводоканал',
    unit: 'м³',
    url: 'https://voda.link.kg/send/',
    badge: 'Нужно подключение',
    explanation:
      'Для автоотправки нужно проверить вход, регистрацию устройства и счётчики на вашем лицевом счёте.',
    api: 'JSON-запросы сайта найдены. Автоотправка пока выключена.',
  },
  heat: {
    name: 'Горячая вода',
    company: 'Бишкектеплосеть',
    unit: 'м³',
    url: 'https://data.teploseti.kg/',
    badge: 'Личный кабинет',
    explanation:
      'Запрос отправки доступен после входа в официальный кабинет. Его контракт ещё нужно проверить.',
    api: 'Личный кабинет найден. API отправки не подтверждён.',
  },
  gas: {
    name: 'Газ',
    company: 'Газпром Кыргызстан',
    unit: 'м³',
    url: 'https://www.gazprom.kg/',
    badge: 'API готов',
    explanation:
      'Отправка через запрос официальной формы. Нужны 9 цифр лицевого счёта и целые показания. На вашем счёте ещё не проверено.',
    api: 'Адаптер официальной формы готов. Первая реальная отправка — после вашей проверки.',
  },
  electricity: {
    name: 'Свет',
    company: 'НЭСК · Мой свет',
    unit: 'кВт·ч',
    url: 'https://www.nesk.kg/ru/abonentam/moj-svet/',
    badge: 'Уточнить счётчик',
    explanation:
      'Если установлен АСКУЭ, показания передаются автоматически. Ручной API не подтверждён; здесь можно вести свой учёт.',
    api: 'Баланс и начисления доступны. Ручная отправка не подтверждена.',
  },
};
export class ValidationError extends Error {}
export function providerId(v: unknown): ProviderId {
  if (!PROVIDERS.includes(v as ProviderId)) throw new ValidationError('Неизвестный поставщик.');
  return v as ProviderId;
}
export function normalizeReading(input: unknown): string {
  if (typeof input !== 'string' && typeof input !== 'number')
    throw new ValidationError('Введите показание счётчика.');
  const v = String(input).trim().replace(',', '.');
  if (!/^\d{1,9}(\.\d{1,3})?$/.test(v))
    throw new ValidationError('Введите число от 0 до 999999999, до трёх знаков после запятой.');
  const [w, d = ''] = v.split('.');
  return String(Number(w)) + (d.replace(/0+$/, '') ? '.' + d.replace(/0+$/, '') : '');
}
export function toMilli(v: string): number {
  const [w, d = ''] = normalizeReading(v).split('.');
  return Number(w) * 1000 + Number(d.padEnd(3, '0'));
}
export function validateAccount(input: unknown): Account {
  if (!input || typeof input !== 'object') throw new ValidationError('Проверьте лицевой счёт.');
  const a = input as Record<string, unknown>,
    provider = providerId(a.provider),
    account = String(a.account ?? '').trim();
  if (!/^[0-9][0-9-]{3,29}$/.test(account))
    throw new ValidationError('Лицевой счёт: 4–30 цифр и дефисов.');
  if (provider === 'gas' && !/^\d{9}$/.test(account))
    throw new ValidationError('Газпром: лицевой счёт должен содержать 9 цифр.');
  if (
    !Array.isArray(a.meters) ||
    !a.meters.length ||
    a.meters.length > 12 ||
    (provider === 'gas' && a.meters.length !== 1)
  )
    throw new ValidationError('Добавьте счётчики. Для газа поддерживается один счётчик.');
  const meters = a.meters.map((m: Record<string, unknown>) => {
    if (!m || typeof m !== 'object' || !/^[a-zA-Z0-9_-]{1,80}$/.test(String(m.id)))
      throw new ValidationError('Некорректный идентификатор счётчика.');
    const label = String(m.label ?? '').trim();
    if (!label || label.length > 80)
      throw new ValidationError('Укажите название счётчика до 80 символов.');
    const kinds =
      provider === 'water' ? ['cold', 'hot'] : provider === 'heat' ? ['hot'] : [provider];
    if (!kinds.includes(String(m.kind))) throw new ValidationError('Проверьте тип счётчика.');
    return {
      id: String(m.id),
      label,
      kind: m.kind as Meter['kind'],
      previous: m.previous === '' || m.previous === undefined ? '' : normalizeReading(m.previous),
    };
  });
  if (new Set(meters.map((m) => m.id)).size !== meters.length)
    throw new ValidationError('Идентификаторы счётчиков должны отличаться.');
  return { provider, account, meters };
}
export function bishkekPeriod(date = new Date()): string {
  const p = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Bishkek',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  return `${p.find((v) => v.type === 'year')!.value}-${p.find((v) => v.type === 'month')!.value}`;
}
export function validatePeriod(v: unknown, now = new Date()): string {
  if (typeof v !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(v))
    throw new ValidationError('Некорректный месяц.');
  if (v > bishkekPeriod(now))
    throw new ValidationError('Нельзя сохранить показания за будущий месяц.');
  return v;
}
export function validateValues(a: Account, input: unknown): ReadingValue[] {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new ValidationError('Введите показания всех счётчиков.');
  const values = input as Record<string, unknown>;
  if (
    Object.keys(values).length !== a.meters.length ||
    Object.keys(values).some((id) => !a.meters.some((m) => m.id === id))
  )
    throw new ValidationError('Показания должны соответствовать всем счётчикам.');
  return a.meters.map((m) => {
    const value = normalizeReading(values[m.id]);
    if (m.previous !== '' && toMilli(value) < toMilli(m.previous))
      throw new ValidationError(
        `${m.label}: новое показание меньше предыдущего. При замене счётчика обновите начальное значение в настройках.`,
      );
    if (a.provider === 'gas' && (!/^\d{1,7}$/.test(value) || Number(value) === 0))
      throw new ValidationError('Газпром: целое показание от 1 до 9999999, только чёрные цифры.');
    return {
      meterId: m.id,
      label: m.label,
      previous: m.previous,
      value,
      unit: providers[a.provider].unit,
    };
  });
}
export function manualMessage(
  r: Pick<Reading, 'provider' | 'account' | 'period' | 'values'>,
): string {
  return `${providers[r.provider].company}\nЛицевой счёт: ${r.account}\nПериод: ${r.period}\n${r.values.map((v) => `${v.label}: ${v.value} ${v.unit}`).join('\n')}`;
}
