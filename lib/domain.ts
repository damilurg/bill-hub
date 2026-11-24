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
    badge: 'API готов',
    explanation:
      'Автоотправка в Бишкекводоканал по лицевому счёту через официальный шлюз (voda.link.kg).',
    api: 'Адаптер voda.link.kg активен.',
  },
  heat: {
    name: 'Горячая вода',
    company: 'Бишкектеплосеть',
    unit: 'м³',
    url: 'https://data.teploseti.kg/',
    badge: 'Кабинет подключен',
    explanation:
      'Автоотправка в Бишкектеплосеть (data.teploseti.kg). Приём показаний с 20 по 25 число.',
    api: 'Адаптер data.teploseti.kg активен.',
  },
  gas: {
    name: 'Газ',
    company: 'Газпром Кыргызстан',
    unit: 'м³',
    url: 'https://www.gazprom.kg/',
    badge: 'API готов',
    explanation:
      'Прямая отправка в Газпром Кыргызстан по 9-значному лицевому счёту (с 10 по 31 число).',
    api: 'Адаптер официального API Газпрома активен.',
  },
  electricity: {
    name: 'Свет',
    company: 'НЭСК · Мой свет',
    unit: 'кВт·ч',
    url: 'https://www.nesk.kg/ru/abonentam/moj-svet/',
    badge: 'АСКУЭ · Авто',
    explanation:
      'АСКУЭ передаёт данные счётчика в НЭСК автоматически. В сервисе фиксируется журнал для сверки.',
    api: 'Умный счётчик АСКУЭ передаёт показания напрямую.',
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

export const RECEIPT_CATEGORIES = [
  'mydom',
  'tszh',
  'water',
  'heat',
  'gas',
  'electricity',
  'other',
] as const;
export type ReceiptCategory = (typeof RECEIPT_CATEGORIES)[number];

export type ReceiptItem = {
  id: string;
  name: string;
  amount: string;
  unit?: string;
  volume?: string;
  tariff?: string;
};

export type Receipt = {
  id: string;
  period: string;
  category: ReceiptCategory;
  title: string;
  account: string;
  amount: string;
  paidAmount: string;
  status: 'unpaid' | 'paid' | 'partial';
  dueDate: string;
  paidDate: string;
  items: ReceiptItem[];
  fileName: string;
  fileData: string;
  notes: string;
  created?: string;
  updated?: string;
};

export const receiptCategories: Record<
  ReceiptCategory,
  { name: string; defaultTitle: string; badge: string; color: string }
> = {
  mydom: {
    name: 'Мой дом',
    defaultTitle: 'Единая квитанция · Мой дом',
    badge: 'Единая квитанция',
    color: '#10b981',
  },
  tszh: {
    name: 'ТСЖ / УК',
    defaultTitle: 'Квитанция ТСЖ',
    badge: 'Управление домом',
    color: '#6366f1',
  },
  water: {
    name: 'Бишкекводоканал',
    defaultTitle: 'Квитанция за воду и стоки',
    badge: 'ХВС / ГВС',
    color: '#0284c7',
  },
  heat: {
    name: 'Бишкектеплосеть',
    defaultTitle: 'Квитанция за отопление',
    badge: 'Отопление',
    color: '#ea580c',
  },
  gas: {
    name: 'Газпром Кыргызстан',
    defaultTitle: 'Квитанция за газ',
    badge: 'Газ',
    color: '#d97706',
  },
  electricity: {
    name: 'НЭСК · Свет',
    defaultTitle: 'Квитанция за электроэнергию',
    badge: 'Электроэнергия',
    color: '#9333ea',
  },
  other: {
    name: 'Прочая услуга',
    defaultTitle: 'Счёт на оплату',
    badge: 'Квитанция',
    color: '#64748b',
  },
};

export const MYDOM_DEFAULT_ITEMS: Array<{
  name: string;
  unit?: string;
  tariff?: string;
  volume?: string;
}> = [
  { name: 'Содержание дома / ТСЖ', unit: 'м²', tariff: '25.00', volume: '65' },
  { name: 'Обслуживание лифта', unit: 'мес.', tariff: '200.00', volume: '1' },
  { name: 'Вывоз ТБО (Тазалык)', unit: 'чел.', tariff: '45.00', volume: '3' },
  { name: 'Холодное водоснабжение и стоки', unit: 'м³', tariff: '15.40', volume: '14' },
  { name: 'Горячее водоснабжение и отопление', unit: 'м³', tariff: '89.50', volume: '6' },
  { name: 'Электроэнергия (НЭСК)', unit: 'кВт·ч', tariff: '1.37', volume: '160' },
  { name: 'Природный газ (Газпром)', unit: 'м³', tariff: '20.15', volume: '22' },
  { name: 'Домофон и видеонаблюдение', unit: 'мес.', tariff: '80.00', volume: '1' },
];

export function normalizeMoney(input: unknown): string {
  if (input === '' || input === undefined || input === null) return '0.00';
  const s = String(input).trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s))
    throw new ValidationError('Введите корректную сумму в сомах (например, 1450.50).');
  const num = Number(s);
  if (!Number.isFinite(num) || num < 0 || num > 10_000_000)
    throw new ValidationError('Сумма должна быть в пределах от 0 до 10 000 000 сом.');
  return num.toFixed(2);
}

export function validateReceipt(input: unknown): Receipt {
  if (!input || typeof input !== 'object') throw new ValidationError('Проверьте данные квитанции.');
  const r = input as Record<string, unknown>;
  const id = String(r.id || crypto.randomUUID()).trim();
  const period = validatePeriod(r.period);
  const cat = String(r.category || 'mydom') as ReceiptCategory;
  if (!RECEIPT_CATEGORIES.includes(cat))
    throw new ValidationError('Неизвестная категория квитанции.');
  const title = String(r.title || receiptCategories[cat].defaultTitle)
    .trim()
    .slice(0, 120);
  if (!title) throw new ValidationError('Укажите название квитанции.');
  const account = String(r.account || '')
    .trim()
    .slice(0, 40);
  const amount = normalizeMoney(r.amount);
  const paidAmount = normalizeMoney(r.paidAmount);
  let status = String(r.status || 'unpaid');
  if (!['unpaid', 'paid', 'partial'].includes(status)) status = 'unpaid';
  if (Number(paidAmount) >= Number(amount) && Number(amount) > 0) {
    status = 'paid';
  } else if (Number(paidAmount) > 0 && Number(paidAmount) < Number(amount)) {
    status = 'partial';
  }
  const dueDate = String(r.dueDate || '')
    .trim()
    .slice(0, 10);
  const paidDate = String(r.paidDate || '')
    .trim()
    .slice(0, 10);
  const fileName = String(r.fileName || '')
    .trim()
    .slice(0, 120);
  const fileData = typeof r.fileData === 'string' ? r.fileData : '';
  const notes = String(r.notes || '')
    .trim()
    .slice(0, 500);

  let items: ReceiptItem[] = [];
  if (Array.isArray(r.items)) {
    items = r.items.slice(0, 40).map((it, idx) => {
      const item = (it || {}) as Record<string, unknown>;
      return {
        id: String(item.id || 'item_' + (idx + 1)),
        name: String(item.name || 'Услуга')
          .trim()
          .slice(0, 100),
        amount: normalizeMoney(item.amount),
        unit: item.unit ? String(item.unit).trim().slice(0, 20) : undefined,
        volume: item.volume ? String(item.volume).trim().slice(0, 20) : undefined,
        tariff: item.tariff ? String(item.tariff).trim().slice(0, 20) : undefined,
      };
    });
  }

  return {
    id,
    period,
    category: cat,
    title,
    account,
    amount,
    paidAmount,
    status: status as Receipt['status'],
    dueDate,
    paidDate,
    items,
    fileName,
    fileData,
    notes,
    created: typeof r.created === 'string' ? r.created : undefined,
    updated: typeof r.updated === 'string' ? r.updated : undefined,
  };
}
