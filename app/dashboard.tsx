'use client';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  House,
  Droplets,
  Flame,
  Zap,
  Waves,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Settings2,
  History,
  LayoutGrid,
  Link2,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Check,
  CheckCircle2,
  Info,
  X,
  Copy,
  Download,
  LoaderCircle,
  CalendarDays,
  HelpCircle,
  LockKeyhole,
} from 'lucide-react';
import {
  PROVIDERS,
  providers,
  bishkekPeriod,
  validateAccount,
  validateValues,
  manualMessage,
  type Account,
  type Meter,
  type ProviderId,
  type Reading,
} from '@/lib/domain';
const icons = { water: Droplets, heat: Waves, gas: Flame, electricity: Zap };
const statusLabels: Record<string, string> = {
  draft: 'Черновик',
  confirmed: 'Принято',
  unknown: 'Нужна проверка',
  sending: 'Ожидает ответа',
  rejected: 'Отклонено',
  blocked: 'Не отправлено',
};
const editable = (r?: Reading) => !r || ['draft', 'blocked', 'rejected'].includes(r.status);
function monthLabel(period: string) {
  return new Intl.DateTimeFormat('ru', { month: 'long', year: 'numeric', timeZone: 'Asia/Bishkek' })
    .format(new Date(period + '-15T12:00:00Z'))
    .replace(' г.', '');
}
function shiftMonth(period: string, step: number) {
  const d = new Date(period + '-15T12:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + step);
  return d.toISOString().slice(0, 7);
}
async function api(path: string, body?: unknown) {
  const r = await fetch('/api/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      r.status === 401 ? 'Войдите, чтобы сохранить данные.' : 'Сервис временно недоступен.',
    );
  }
  if (!r.ok) throw new Error(data.error || data.detail || 'Не удалось выполнить запрос.');
  return data;
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const d = ref.current;
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="dialog_title"
    >
      <div className="modal_top">
        <h2 id="dialog_title">{title}</h2>
        <button className="icon_button" onClick={onClose} aria-label="Закрыть">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function newMeter(p: ProviderId): Meter {
  return {
    id: crypto.randomUUID(),
    label:
      p === 'water'
        ? 'Холодная вода'
        : p === 'heat'
          ? 'Горячая вода'
          : p === 'gas'
            ? 'Счётчик газа'
            : 'Счётчик света',
    previous: '',
    kind: p === 'water' ? 'cold' : p === 'heat' ? 'hot' : p,
  };
}
function AccountModal({
  provider,
  existing,
  onSave,
  onClose,
}: {
  provider: ProviderId;
  existing?: Account;
  onSave: (a: Account) => Promise<void>;
  onClose: () => void;
}) {
  const [account, setAccount] = useState(existing?.account || ''),
    [meters, setMeters] = useState<Meter[]>(existing?.meters || [newMeter(provider)]),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false);
  const update = (i: number, patch: Partial<Meter>) =>
    setMeters((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  async function save(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSave(validateAccount({ provider, account, meters }));
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal title={existing ? 'Настройки счёта' : 'Добавить лицевой счёт'} onClose={onClose}>
      <form onSubmit={save}>
        <p className="modal_subtitle">{providers[provider].company}</p>
        <label className="form_label" htmlFor="account_number">
          Лицевой счёт
        </label>
        <input
          id="account_number"
          autoFocus
          inputMode="numeric"
          autoComplete="off"
          placeholder={provider === 'gas' ? '9 цифр из квитанции' : 'Номер из вашей квитанции'}
          maxLength={30}
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          required
        />
        <p className="field_hint">
          Номер сохранится в вашем личном кабинете. Это ещё не подтверждение подключения к
          поставщику.
        </p>
        <div className="form_divider" />
        <h3>Счётчики</h3>
        {meters.map((m, i) => (
          <div className="meter_setup" key={m.id}>
            <div className="meter_setup_top">
              <label className="form_label" htmlFor={'label_' + m.id}>
                Название
              </label>
              {meters.length > 1 && (
                <button
                  type="button"
                  className="text_button danger"
                  onClick={() => setMeters((ms) => ms.filter((v) => v.id !== m.id))}
                >
                  Убрать
                </button>
              )}
            </div>
            <input
              id={'label_' + m.id}
              value={m.label}
              maxLength={80}
              onChange={(e) => update(i, { label: e.target.value })}
              required
            />
            {provider === 'water' && (
              <label className="form_label">
                Тип воды
                <select
                  value={m.kind}
                  onChange={(e) => update(i, { kind: e.target.value as Meter['kind'] })}
                >
                  <option value="cold">Холодная вода</option>
                  <option value="hot">Горячая вода · стоки</option>
                </select>
              </label>
            )}
            <label className="form_label" htmlFor={'previous_' + m.id}>
              Предыдущее показание <span>· необязательно</span>
            </label>
            <input
              id={'previous_' + m.id}
              inputMode="decimal"
              placeholder="Например, 125"
              value={m.previous}
              onChange={(e) => update(i, { previous: e.target.value })}
            />
          </div>
        ))}
        {provider !== 'gas' && meters.length < 12 && (
          <button
            type="button"
            className="text_button"
            onClick={() => setMeters((ms) => [...ms, newMeter(provider)])}
          >
            <Plus size={16} /> Ещё счётчик
          </button>
        )}
        {provider === 'water' && (
          <div className="inline_note">
            <Info size={17} />
            <span>
              Водоканал также запрашивает горячую воду для учёта стоков. Добавьте её отдельным
              счётчиком, если она есть в вашем кабинете.
            </span>
          </div>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal_actions">
          <button type="button" className="secondary_button" onClick={onClose}>
            Отмена
          </button>
          <button className="primary_button" disabled={saving}>
            {saving ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />} Сохранить
            счёт
          </button>
        </div>
      </form>
    </Modal>
  );
}
export default function Dashboard({
  authenticated,
  liveEnabled,
}: {
  authenticated: boolean;
  liveEnabled: boolean;
}) {
  const [view, setView] = useState<'readings' | 'history' | 'connections'>('readings'),
    [period, setPeriod] = useState(bishkekPeriod()),
    [accounts, setAccounts] = useState<Account[]>([]),
    [readings, setReadings] = useState<Reading[]>([]),
    [values, setValues] = useState<Record<string, Record<string, string>>>({}),
    [editing, setEditing] = useState<ProviderId | null>(null),
    [demo, setDemo] = useState(false),
    [busy, setBusy] = useState(''),
    [notice, setNotice] = useState(''),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [review, setReview] = useState(false),
    [checked, setChecked] = useState(false),
    [filter, setFilter] = useState('all');
  const active = readings.filter((r) => r.period === period),
    saved = active.length,
    confirmed = active.filter((r) => r.status === 'confirmed').length;
  async function reload() {
    if (!authenticated) return;
    const d = await api('state');
    setAccounts(d.accounts);
    setReadings(d.readings);
  }
  useEffect(() => {
    if (authenticated) reload().catch((e) => setNotice(e.message));
  }, [authenticated]);
  const loadedPeriod = useRef(period);
  useEffect(() => {
    const savedValues = Object.fromEntries(
      readings
        .filter((r) => r.period === period)
        .map((r) => [r.provider, Object.fromEntries(r.values.map((v) => [v.meterId, v.value]))]),
    );
    const changed = loadedPeriod.current !== period;
    loadedPeriod.current = period;
    setValues((current) => (changed ? savedValues : { ...savedValues, ...current }));
  }, [period, readings]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 9000);
    return () => clearTimeout(t);
  }, [notice]);
  function enterDemo() {
    setDemo(true);
    setPeriod(bishkekPeriod());
    setReadings([]);
    setErrors({});
    setValues({});
    setAccounts(
      PROVIDERS.map((p, i) => ({
        provider: p,
        account: p === 'gas' ? '000000001' : '00000000' + (i + 1),
        meters: [
          {
            id: 'example_' + p,
            label: providers[p].name,
            kind: p === 'water' ? 'cold' : p === 'heat' ? 'hot' : p,
            previous: ['128', '54', '420', '3082'][i],
          },
        ],
      })),
    );
    setNotice('Пример: данные вымышленные, запросы поставщикам отключены.');
  }
  async function exitDemo() {
    setDemo(false);
    setAccounts([]);
    setReadings([]);
    setValues({});
    if (authenticated)
      try {
        await reload();
      } catch (e) {
        setNotice((e as Error).message);
      }
  }
  async function saveAccount(a: Account) {
    if (demo) {
      setAccounts((v) => [...v.filter((x) => x.provider !== a.provider), a]);
      setValues((v) => ({ ...v, [a.provider]: {} }));
      return;
    }
    if (!authenticated) throw new Error('Войдите, чтобы добавить счёт, или откройте пример.');
    await api('accounts', a);
    setValues((v) => ({ ...v, [a.provider]: {} }));
    await reload();
    setNotice('Лицевой счёт сохранён.');
  }
  async function saveOne(provider: ProviderId, notify = true) {
    const a = accounts.find((a) => a.provider === provider);
    if (!a) return;
    const data = Object.fromEntries(a.meters.map((m) => [m.id, values[provider]?.[m.id] ?? '']));
    validateValues(a, data);
    if (demo) {
      const r: Reading = {
        id: 'example_' + provider,
        provider,
        period,
        account: a.account,
        values: validateValues(a, data),
        status: 'draft',
        detail: 'Пример. Никуда не отправлено.',
        created: new Date().toISOString(),
      };
      setReadings((v) => [
        ...v.filter((x) => !(x.provider === provider && x.period === period)),
        r,
      ]);
    } else {
      await api('readings', { provider, period, values: data });
    }
    if (notify) setNotice('Черновик сохранён. Поставщику пока не отправлено.');
  }
  async function saveCard(provider: ProviderId) {
    setBusy(provider);
    setErrors((v) => ({ ...v, [provider]: '' }));
    try {
      await saveOne(provider);
      if (!demo) await reload();
    } catch (e) {
      setErrors((v) => ({ ...v, [provider]: (e as Error).message }));
    } finally {
      setBusy('');
    }
  }
  async function prepare() {
    setBusy('all');
    setErrors({});
    try {
      const candidates = accounts.filter(
        (a) =>
          editable(active.find((r) => r.provider === a.provider)) &&
          Object.values(values[a.provider] || {}).some((v) => v.trim() !== ''),
      );
      let valid = true;
      for (const a of candidates) {
        try {
          validateValues(
            a,
            Object.fromEntries(a.meters.map((m) => [m.id, values[a.provider]?.[m.id] ?? ''])),
          );
        } catch (e) {
          valid = false;
          setErrors((v) => ({ ...v, [a.provider]: (e as Error).message }));
        }
      }
      if (!valid) return;
      for (const a of candidates) await saveOne(a.provider, false);
      if (!demo) await reload();
      setChecked(false);
      setReview(true);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  async function send() {
    const gas = active.find((r) => r.provider === 'gas');
    if (!gas || demo || !checked) return;
    setBusy('send');
    try {
      const result = await api('submit', { id: gas.id, version: gas.created, confirmed: true });
      setNotice(
        result.status === 'confirmed' ? 'Газпром подтвердил приём показаний.' : result.detail,
      );
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      try {
        await reload();
      } catch {}
      setBusy('');
      setChecked(false);
    }
  }
  async function copy(r: Reading) {
    try {
      await navigator.clipboard.writeText(manualMessage(r));
      setNotice('Показания скопированы. Вставьте их в форму поставщика.');
    } catch {
      setNotice('Не удалось скопировать. Значения доступны в истории.');
    }
  }
  const gasDraft = active.find((r) => r.provider === 'gas' && editable(r));
  const filtered = readings
    .filter((r) => filter === 'all' || r.provider === filter)
    .sort((a, b) => b.period.localeCompare(a.period) || b.created.localeCompare(a.created));
  return (
    <div className="app_shell">
      <aside className="sidebar">
        <a href="/" className="brand">
          <span className="brand_mark">
            <House size={25} strokeWidth={1.7} />
          </span>
          <span>
            Bill Hub<span className="brand_dot">.</span>
            <small>ВСЁ ПОД КОНТРОЛЕМ</small>
          </span>
        </a>
        <div className="home_card">
          <span className="home_icon">
            <House size={20} />
          </span>
          <div>
            <strong>Мой дом</strong>
            <small>Бишкек, Кыргызстан</small>
          </div>
          <span className="home_dot" />
        </div>
        <span className="nav_caption">МОЙ КАБИНЕТ</span>
        <nav aria-label="Основная навигация">
          {(
            [
              { id: 'readings', label: 'Показания', icon: LayoutGrid },
              { id: 'history', label: 'История', icon: History },
              { id: 'connections', label: 'Подключения', icon: Link2 },
            ] as const
          ).map((n) => (
            <button
              key={n.id}
              className={'nav_item ' + (view === n.id ? 'active' : '')}
              onClick={() => setView(n.id)}
              aria-current={view === n.id ? 'page' : undefined}
            >
              <n.icon size={19} />
              {n.label}
              {n.id === 'connections' && <span className="nav_count">4</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar_bottom">
          <div className="private_note">
            <ShieldCheck size={21} />
            <div>
              <strong>Только для вас</strong>
              <p>
                Лицевые счета и история
                <br />в личном кабинете.
              </p>
            </div>
          </div>
          <button className="text_button muted" onClick={demo ? exitDemo : enterDemo}>
            <HelpCircle size={17} />
            {demo ? 'Выйти из примера' : 'Посмотреть пример'}
          </button>
          <div className="sidebar_footer">
            Сделано для спокойного быта <span>↗</span>
          </div>
        </div>
      </aside>
      <div className="main_shell">
        <header className="topbar">
          <div className="breadcrumb">
            <House size={16} />
            <span>Мой дом</span>
            <span>/</span>
            <strong>
              {view === 'readings' ? 'Показания' : view === 'history' ? 'История' : 'Подключения'}
            </strong>
          </div>
          <div className="topbar_right">
            <span className="private_badge">
              <LockKeyhole size={13} /> Личный кабинет
            </span>
            {authenticated && (
              <button
                className="text_button"
                onClick={async () => {
                  await api('auth/logout', {});
                  window.location.assign('/login');
                }}
              >
                Выйти
              </button>
            )}
            <button
              className="avatar"
              aria-label="Настройки счетов"
              onClick={() => setView('connections')}
            >
              Д
            </button>
          </div>
        </header>
        {demo && (
          <div className="demo_banner">
            <Info size={16} />
            <span>Режим примера · вымышленные данные · отправка отключена</span>
            <button onClick={exitDemo}>
              Выйти из примера <X size={14} />
            </button>
          </div>
        )}
        {!authenticated && !demo && (
          <div className="signin_banner">
            <span>Войдите, чтобы сохранять показания и пользоваться отправкой.</span>
            <a href="/login" target="_top">
              Войти <ArrowRight size={15} />
            </a>
            <button onClick={enterDemo}>Посмотреть пример</button>
          </div>
        )}
        <main>
          <div className="page_heading">
            <div>
              <div className="eyebrow">
                <span /> ВАШ ДОМАШНИЙ ПОМОЩНИК
              </div>
              <h1>
                {view === 'readings' ? (
                  <>
                    Показания.
                    <br className="mobile_break" /> В одном месте.
                  </>
                ) : view === 'history' ? (
                  'Всё осталось в истории.'
                ) : (
                  'Каждому счёту — своё место.'
                )}
              </h1>
              <p>
                {view === 'readings'
                  ? 'Вода, тепло, газ и свет. Меньше вкладок, больше спокойствия.'
                  : view === 'history'
                    ? 'Ваши черновики, ответы поставщиков и сохранённые показания.'
                    : 'Добавьте лицевые счета и проверьте, как передаются показания.'}
              </p>
            </div>
            {view === 'readings' ? (
              <div className="month_switch">
                <button
                  className="icon_button"
                  aria-label="Предыдущий месяц"
                  onClick={() => setPeriod(shiftMonth(period, -1))}
                >
                  <ChevronLeft size={17} />
                </button>
                <CalendarDays size={16} />
                <span>{monthLabel(period)}</span>
                <button
                  className="icon_button"
                  aria-label="Следующий месяц"
                  disabled={period >= bishkekPeriod()}
                  onClick={() => setPeriod(shiftMonth(period, 1))}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            ) : (
              <a
                className={'secondary_button ' + (!authenticated || demo ? 'disabled_link' : '')}
                href={authenticated && !demo ? '/api/export' : undefined}
                aria-disabled={!authenticated || demo}
              >
                <Download size={16} /> Экспорт JSON
              </a>
            )}
          </div>
          {view === 'readings' && (
            <>
              <section className="overview" aria-label="Сводка">
                <div>
                  <span className="stat_icon">
                    <Link2 size={18} />
                  </span>
                  <p>
                    <strong>
                      {accounts.length}
                      <span> / 4</span>
                    </strong>
                    <small>лицевых счёта добавлено</small>
                  </p>
                </div>
                <div>
                  <span className="stat_icon">
                    <History size={18} />
                  </span>
                  <p>
                    <strong>
                      {saved}
                      <span> / 4</span>
                    </strong>
                    <small>записей за этот месяц</small>
                  </p>
                </div>
                <div>
                  <span className="stat_icon green">
                    <CheckCircle2 size={18} />
                  </span>
                  <p>
                    <strong>
                      {confirmed}
                      <span> / 4</span>
                    </strong>
                    <small>принято поставщиком</small>
                  </p>
                </div>
                <div className="overview_hint">
                  <ShieldCheck size={19} />
                  <span>
                    Каждая отправка
                    <br />с проверкой результата
                  </span>
                </div>
              </section>
              <div className="workspace_grid">
                <section className="reading_section">
                  <div className="section_heading">
                    <h2>
                      Ваши счётчики <span>04</span>
                    </h2>
                    <button className="text_button" onClick={() => setView('connections')}>
                      <Settings2 size={15} /> Настроить
                    </button>
                  </div>
                  <div className="meter_grid">
                    {PROVIDERS.map((p) => {
                      const meta = providers[p],
                        Icon = icons[p],
                        a = accounts.find((a) => a.provider === p),
                        r = active.find((r) => r.provider === p),
                        locked = !editable(r);
                      return (
                        <article key={p} className={'meter_card ' + p}>
                          <div className="meter_card_header">
                            <span className={'provider_icon ' + p}>
                              <Icon size={23} strokeWidth={1.7} />
                            </span>
                            <span
                              className={
                                'status_pill ' +
                                (r?.status === 'confirmed'
                                  ? 'success'
                                  : p === 'gas'
                                    ? 'available'
                                    : '')
                              }
                            >
                              {r
                                ? statusLabels[r.status]
                                : p === 'gas'
                                  ? liveEnabled
                                    ? 'API готов'
                                    : 'Передача выключена'
                                  : meta.badge}
                            </span>
                            {a && (
                              <button
                                className="icon_button"
                                aria-label={'Настроить ' + meta.name}
                                onClick={() => setEditing(p)}
                              >
                                <Settings2 size={16} />
                              </button>
                            )}
                          </div>
                          <h3>{meta.name}</h3>
                          <p className="provider_name">{meta.company}</p>
                          {a ? (
                            <>
                              <div className="account_line">
                                Лицевой счёт <span>••••{a.account.slice(-4)}</span>
                              </div>
                              {a.meters.map((m) => (
                                <div className="reading_field" key={m.id}>
                                  <label htmlFor={'read_' + m.id}>
                                    {a.meters.length > 1 ? m.label : 'Текущее показание'}
                                    <span>было {m.previous !== '' ? m.previous : '—'}</span>
                                  </label>
                                  <div className={'input_unit ' + (locked ? 'locked' : '')}>
                                    <input
                                      id={'read_' + m.id}
                                      aria-label={meta.name + ' · ' + m.label}
                                      inputMode={p === 'gas' ? 'numeric' : 'decimal'}
                                      placeholder="Введите значение"
                                      value={values[p]?.[m.id] ?? ''}
                                      disabled={locked}
                                      onChange={(e) =>
                                        setValues((v) => ({
                                          ...v,
                                          [p]: { ...v[p], [m.id]: e.target.value },
                                        }))
                                      }
                                    />
                                    <span>{meta.unit}</span>
                                  </div>
                                  {values[p]?.[m.id] &&
                                    m.previous !== '' &&
                                    Number.isFinite(Number(values[p][m.id].replace(',', '.'))) && (
                                      <small className="consumption">
                                        Расход:{' '}
                                        {(
                                          Number(values[p][m.id].replace(',', '.')) -
                                          Number(m.previous)
                                        ).toLocaleString('ru', { maximumFractionDigits: 3 })}{' '}
                                        {meta.unit}
                                      </small>
                                    )}
                                </div>
                              ))}
                              {errors[p] && (
                                <p className="error" role="alert">
                                  {errors[p]}
                                </p>
                              )}
                              {r && !editable(r) && <p className="result_note">{r.detail}</p>}
                              <div className="meter_card_footer">
                                <span>
                                  {r ? (
                                    <>
                                      <span
                                        className={
                                          'tiny_dot ' + (r.status === 'confirmed' ? 'green' : '')
                                        }
                                      />
                                      {statusLabels[r.status]}
                                    </>
                                  ) : (
                                    'Показания ещё не сохранены'
                                  )}
                                </span>
                                {!locked && (
                                  <button
                                    className="text_button"
                                    disabled={Boolean(busy)}
                                    onClick={() => saveCard(p)}
                                  >
                                    {busy === p ? (
                                      <LoaderCircle size={15} className="spin" />
                                    ) : (
                                      <Check size={15} />
                                    )}{' '}
                                    Сохранить
                                  </button>
                                )}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="empty_meter">
                                <div>
                                  <span>Предыдущее</span>
                                  <strong>
                                    — <small>{meta.unit}</small>
                                  </strong>
                                </div>
                                <div className="empty_input">
                                  Текущее показание<span>{meta.unit}</span>
                                </div>
                              </div>
                              <div className="meter_card_footer">
                                <span>Счёт не добавлен</span>
                                <button className="text_button" onClick={() => setEditing(p)}>
                                  <Plus size={16} /> Добавить
                                </button>
                              </div>
                            </>
                          )}
                        </article>
                      );
                    })}
                  </div>
                  <div className="batch_bar">
                    <div>
                      <span className="batch_icon">
                        <Check size={18} />
                      </span>
                      <div>
                        <strong>Проверьте цифры — и готово</strong>
                        <p>
                          {liveEnabled
                            ? 'Газ можно отправить здесь. Для остальных подготовим данные.'
                            : 'Сохраните показания и подготовьте данные для поставщиков.'}
                        </p>
                      </div>
                    </div>
                    <button
                      className="primary_button"
                      disabled={Boolean(busy) || !accounts.length}
                      onClick={prepare}
                    >
                      {busy === 'all' ? <LoaderCircle size={17} className="spin" /> : null}{' '}
                      Проверить и отправить <ArrowRight size={17} />
                    </button>
                  </div>
                  <p className="bottom_note">
                    <LockKeyhole size={13} /> Сохранённый черновик не означает отправку. Ответ
                    поставщика появится отдельно.
                  </p>
                </section>
                <aside className="right_rail">
                  <section className="month_card">
                    <div className="rail_kicker">
                      <span className="tiny_dot green" /> ЭТОТ МЕСЯЦ
                    </div>
                    <h2>
                      Один маленький
                      <br />
                      пункт в делах.
                    </h2>
                    <p>
                      Снимите показания со всех
                      <br />
                      счётчиков за один подход.
                    </p>
                    <div className="progress_row">
                      <strong>{saved} из 4</strong>
                      <span>записей сохранено</span>
                    </div>
                    <div className="progress_track">
                      <div style={{ width: `${(saved / 4) * 100}%` }} />
                    </div>
                    <div className="rail_steps">
                      {PROVIDERS.map((p) => (
                        <div key={p}>
                          <span
                            className={
                              active.some((r) => r.provider === p)
                                ? 'step_check done'
                                : 'step_check'
                            }
                          >
                            {active.some((r) => r.provider === p) ? <Check size={11} /> : null}
                          </span>
                          {providers[p].name}
                          <small>
                            {active.some((r) => r.provider === p)
                              ? statusLabels[active.find((r) => r.provider === p)!.status]
                              : '—'}
                          </small>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="deadline_card">
                    <span className="calendar_icon">
                      <CalendarDays size={21} />
                    </span>
                    <h3>Когда передавать?</h3>
                    <div>
                      <span>Горячая вода</span>
                      <strong>20–25 числа</strong>
                    </div>
                    <div>
                      <span>Газ · рекомендация</span>
                      <strong>15–30 числа</strong>
                    </div>
                    <p>
                      Сроки воды уточняйте в своём кабинете. Для света проверьте, установлен ли
                      АСКУЭ.
                    </p>
                    <button className="text_button" onClick={() => setView('connections')}>
                      О подключениях <ArrowUpRight size={14} />
                    </button>
                  </section>
                  <div className="small_tip">
                    <Info size={18} />
                    <p>
                      Горячая вода может понадобиться и теплосетям, и водоканалу — для учёта стоков.
                    </p>
                  </div>
                </aside>
              </div>
            </>
          )}
          {view === 'connections' && (
            <section className="connections">
              <div className="connections_intro">
                <Info size={20} />
                <p>
                  Номер счёта и подключение к поставщику — разные шаги. Ниже показано, что уже умеет
                  каждый сервис. Проверено 22 октября 2026.
                </p>
              </div>
              {PROVIDERS.map((p) => {
                const Icon = icons[p],
                  a = accounts.find((a) => a.provider === p);
                return (
                  <article className="connection_card" key={p}>
                    <span className={'provider_icon ' + p}>
                      <Icon size={24} />
                    </span>
                    <div>
                      <div className="connection_title">
                        <h2>{providers[p].company}</h2>
                        <span className={'status_pill ' + (p === 'gas' ? 'available' : '')}>
                          {providers[p].badge}
                        </span>
                      </div>
                      <p>{providers[p].explanation}</p>
                      <small>
                        {a
                          ? 'Лицевой счёт: ••••' +
                            a.account.slice(-4) +
                            ' · ' +
                            a.meters.length +
                            ' счётчик(а)'
                          : 'Лицевой счёт ещё не добавлен'}
                      </small>
                      <div className="connection_links">
                        <a href={providers[p].url} target="_blank" rel="noreferrer">
                          Сайт поставщика <ArrowUpRight size={14} />
                        </a>
                        {p === 'heat' && (
                          <a
                            href="https://www.teploseti.kg/content/articles_view/1297"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Правила передачи <ArrowUpRight size={14} />
                          </a>
                        )}
                        {p === 'gas' && (
                          <a
                            href="https://www.gazprom.kg/consumers/news/530"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Сроки и инструкция <ArrowUpRight size={14} />
                          </a>
                        )}
                      </div>
                    </div>
                    <button className="secondary_button" onClick={() => setEditing(p)}>
                      {a ? <Settings2 size={16} /> : <Plus size={16} />}{' '}
                      {a ? 'Настроить' : 'Добавить счёт'}
                    </button>
                  </article>
                );
              })}
              <div className="inline_note">
                <ShieldCheck size={20} />
                <span>
                  Автоотправка воды и теплосети включится после проверки доступа на вашем счёте.
                  CAPTCHA и требования входа не обходятся. Показания самостоятельно не
                  придумываются.
                </span>
              </div>
            </section>
          )}
          {view === 'history' && (
            <section className="history_section">
              <div className="section_heading">
                <h2>
                  Журнал показаний <span>{filtered.length}</span>
                </h2>
                <select
                  aria-label="Фильтр поставщиков"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">Все поставщики</option>
                  {PROVIDERS.map((p) => (
                    <option value={p} key={p}>
                      {providers[p].name}
                    </option>
                  ))}
                </select>
              </div>
              {!filtered.length ? (
                <div className="empty_history">
                  <span>
                    <History size={30} />
                  </span>
                  <h2>История начинается с первого показания</h2>
                  <p>
                    Добавьте счёт и сохраните цифры.
                    <br />
                    Здесь останутся значения и результат каждой отправки.
                  </p>
                  <button className="primary_button" onClick={() => setView('readings')}>
                    Перейти к показаниям <ArrowRight size={16} />
                  </button>
                </div>
              ) : (
                <div className="history_list">
                  {filtered.map((r) => {
                    const Icon = icons[r.provider];
                    return (
                      <article className="history_row" key={r.id}>
                        <div className="history_row_top">
                          <span className={'provider_icon ' + r.provider}>
                            <Icon size={20} />
                          </span>
                          <div>
                            <h3>{providers[r.provider].name}</h3>
                            <small>
                              {monthLabel(r.period)} · ••••{r.account.slice(-4)}
                            </small>
                          </div>
                          <span
                            className={'status_pill ' + (r.status === 'confirmed' ? 'success' : '')}
                          >
                            {statusLabels[r.status]}
                          </span>
                        </div>
                        <div className="history_values">
                          {r.values.map((v) => (
                            <div key={v.meterId}>
                              <span>{v.label}</span>
                              <strong>
                                {v.value} <small>{v.unit}</small>
                              </strong>
                            </div>
                          ))}
                        </div>
                        <p className="history_detail">{r.detail}</p>
                        <div className="history_actions">
                          <small>
                            {new Intl.DateTimeFormat('ru', {
                              timeZone: 'Asia/Bishkek',
                              dateStyle: 'short',
                              timeStyle: 'short',
                            }).format(new Date(r.created))}{' '}
                            · Бишкек
                          </small>
                          <button className="text_button" onClick={() => copy(r)}>
                            <Copy size={14} /> Скопировать
                          </button>
                          <a href={providers[r.provider].url} target="_blank" rel="noreferrer">
                            Проверить у поставщика <ArrowUpRight size={14} />
                          </a>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}
          <footer className="page_footer">
            <span>
              Bill Hub. <span>Маленькие дела. Большое спокойствие.</span>
            </span>
            <span>Asia/Bishkek · UTC+6</span>
          </footer>
        </main>
      </div>
      {editing && (
        <AccountModal
          provider={editing}
          existing={accounts.find((a) => a.provider === editing)}
          onSave={saveAccount}
          onClose={() => setEditing(null)}
        />
      )}
      {review && (
        <Modal
          title="Проверка перед отправкой"
          onClose={() => {
            if (busy !== 'send') setReview(false);
          }}
        >
          <p className="modal_subtitle">
            {monthLabel(period)} ·{' '}
            {demo
              ? 'Режим примера. Отправка отключена.'
              : 'Сверьте лицевые счета и значения со счётчиками.'}
          </p>
          {!active.length ? (
            <div className="inline_note">
              <Info size={18} />
              <span>Сначала введите и сохраните хотя бы одно показание.</span>
            </div>
          ) : (
            active.map((r) => (
              <div className="review_item" key={r.id}>
                <div>
                  <strong>{providers[r.provider].company}</strong>
                  <span className={'status_pill ' + (r.status === 'confirmed' ? 'success' : '')}>
                    {r.provider === 'gas' && editable(r)
                      ? 'Готово к отправке'
                      : statusLabels[r.status]}
                  </span>
                </div>
                <p>
                  Лицевой счёт: <strong>{r.account}</strong>
                </p>
                {r.values.map((v) => (
                  <div className="review_value" key={v.meterId}>
                    <span>{v.label}</span>
                    <strong>
                      {v.value} {v.unit}
                    </strong>
                  </div>
                ))}
                {r.provider !== 'gas' ? (
                  <>
                    <p className="field_hint">{providers[r.provider].explanation}</p>
                    <div className="review_links">
                      <button className="text_button" onClick={() => copy(r)}>
                        <Copy size={14} /> Копировать
                      </button>
                      <a href={providers[r.provider].url} target="_blank" rel="noreferrer">
                        Открыть поставщика <ArrowUpRight size={14} />
                      </a>
                    </div>
                  </>
                ) : (
                  !editable(r) && <p className="field_hint">{r.detail}</p>
                )}
              </div>
            ))
          )}
          {gasDraft && (
            <label className="confirm_check">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                disabled={demo || busy === 'send'}
              />
              <span>
                Я проверил лицевой счёт и показания газа. Отправить эти данные поставщику.
              </span>
            </label>
          )}
          <div className="modal_actions">
            <button
              className="secondary_button"
              disabled={busy === 'send'}
              onClick={() => setReview(false)}
            >
              Закрыть
            </button>
            {gasDraft && (
              <button
                className="primary_button"
                disabled={
                  !checked || demo || !liveEnabled || Boolean(busy) || period !== bishkekPeriod()
                }
                onClick={send}
              >
                {busy === 'send' ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <ArrowUpRight size={17} />
                )}{' '}
                Отправить газ
              </button>
            )}
          </div>
          {gasDraft && !liveEnabled && (
            <p className="field_hint">Отправка поставщикам выключена владельцем сервера.</p>
          )}
          {gasDraft && period !== bishkekPeriod() && (
            <p className="field_hint">Архивные показания сохраняются только для вашего учёта.</p>
          )}
        </Modal>
      )}
      {notice && (
        <div className="toast" role="status">
          <Info size={18} />
          <span>{notice}</span>
          <button aria-label="Скрыть уведомление" onClick={() => setNotice('')}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
