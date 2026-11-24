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
  Receipt as ReceiptIcon,
  FileText,
  Upload,
  Trash2,
  Eye,
  Sparkles,
  Building2,
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
  type Receipt,
  type ReceiptItem,
  type ReceiptCategory,
  receiptCategories,
  MYDOM_DEFAULT_ITEMS,
  RECEIPT_CATEGORIES,
  validateReceipt,
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

function ReceiptModal({
  existing,
  defaultPeriod,
  onSave,
  onClose,
}: {
  existing?: Receipt | null;
  defaultPeriod: string;
  onSave: (r: Receipt) => Promise<void>;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<ReceiptCategory>(existing?.category || 'mydom');
  const [title, setTitle] = useState(
    existing?.title || receiptCategories[existing?.category || 'mydom'].defaultTitle,
  );
  const [account, setAccount] = useState(existing?.account || '');
  const [period, setPeriod] = useState(existing?.period || defaultPeriod);
  const [amount, setAmount] = useState(existing?.amount || '');
  const [paidAmount, setPaidAmount] = useState(existing?.paidAmount || '0.00');
  const [status, setStatus] = useState<Receipt['status']>(existing?.status || 'unpaid');
  const [dueDate, setDueDate] = useState(existing?.dueDate || `${defaultPeriod}-25`);
  const [paidDate, setPaidDate] = useState(existing?.paidDate || '');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [fileName, setFileName] = useState(existing?.fileName || '');
  const [fileData, setFileData] = useState(existing?.fileData || '');
  const [items, setItems] = useState<ReceiptItem[]>(
    existing?.items?.length
      ? existing.items
      : (existing?.category || category) === 'mydom'
        ? MYDOM_DEFAULT_ITEMS.map((it, i) => ({
            id: 'item_' + (i + 1),
            name: it.name,
            amount: (Number(it.tariff || 0) * Number(it.volume || 1)).toFixed(2),
            unit: it.unit,
            volume: it.volume,
            tariff: it.tariff,
          }))
        : [],
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function recalculateTotal(newItems: ReceiptItem[]) {
    const sum = newItems.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
    if (sum > 0) setAmount(sum.toFixed(2));
  }

  function applyMydomTemplate() {
    const templateItems: ReceiptItem[] = MYDOM_DEFAULT_ITEMS.map((it, i) => ({
      id: 'item_' + (i + 1),
      name: it.name,
      amount: (Number(it.tariff || 0) * Number(it.volume || 1)).toFixed(2),
      unit: it.unit,
      volume: it.volume,
      tariff: it.tariff,
    }));
    setItems(templateItems);
    setCategory('mydom');
    setTitle('Единая квитанция · Мой дом');
    recalculateTotal(templateItems);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Файл квитанции не должен превышать 2 МБ.');
      return;
    }
    setError('');
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setFileData(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const calculatedAmount =
        amount ||
        (items.length
          ? items.reduce((s, it) => s + (Number(it.amount) || 0), 0).toFixed(2)
          : '0.00');
      const payload = validateReceipt({
        id: existing?.id,
        period,
        category,
        title,
        account,
        amount: calculatedAmount,
        paidAmount,
        status,
        dueDate,
        paidDate: status === 'paid' && !paidDate ? new Date().toISOString().slice(0, 10) : paidDate,
        items,
        fileName,
        fileData,
        notes,
        created: existing?.created,
      });
      await onSave(payload);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={existing ? 'Редактировать квитанцию' : 'Добавить квитанцию'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="receipt_form">
        <div className="receipt_category_picker">
          <label className="form_label">Категория квитанции</label>
          <div className="category_chips">
            {RECEIPT_CATEGORIES.map((cat) => (
              <button
                type="button"
                key={cat}
                className={'category_chip' + (category === cat ? ' active' : '')}
                onClick={() => {
                  setCategory(cat);
                  if (!existing) setTitle(receiptCategories[cat].defaultTitle);
                }}
              >
                {receiptCategories[cat].name}
              </button>
            ))}
          </div>
        </div>

        <div className="form_row_grid">
          <div>
            <label className="form_label" htmlFor="receipt_title">
              Название
            </label>
            <input
              id="receipt_title"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="form_label" htmlFor="receipt_account">
              Лицевой счёт
            </label>
            <input
              id="receipt_account"
              placeholder="Например, 3180429"
              value={account}
              maxLength={40}
              onChange={(e) => setAccount(e.target.value)}
            />
          </div>
        </div>

        <div className="form_row_grid three_col">
          <div>
            <label className="form_label" htmlFor="receipt_period">
              Месяц
            </label>
            <input
              id="receipt_period"
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="form_label" htmlFor="receipt_due_date">
              Оплатить до
            </label>
            <input
              id="receipt_due_date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div>
            <label className="form_label" htmlFor="receipt_status">
              Статус оплаты
            </label>
            <select
              id="receipt_status"
              value={status}
              onChange={(e) => {
                const newStatus = e.target.value as Receipt['status'];
                setStatus(newStatus);
                if (newStatus === 'paid' && (!paidAmount || paidAmount === '0.00')) {
                  setPaidAmount(amount);
                }
              }}
            >
              <option value="unpaid">Ожидает оплаты</option>
              <option value="paid">Оплачено полностью</option>
              <option value="partial">Частично оплачено</option>
            </select>
          </div>
        </div>

        <div className="form_row_grid">
          <div>
            <label className="form_label" htmlFor="receipt_amount">
              Итого к оплате (сом)
            </label>
            <input
              id="receipt_amount"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="form_label" htmlFor="receipt_paid_amount">
              Оплачено (сом)
            </label>
            <input
              id="receipt_paid_amount"
              inputMode="decimal"
              placeholder="0.00"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
            />
          </div>
        </div>

        <div className="receipt_items_section">
          <div className="receipt_items_header">
            <h4>Статьи начислений ({items.length})</h4>
            <div className="receipt_items_actions">
              <button type="button" className="text_button" onClick={applyMydomTemplate}>
                <Sparkles size={14} /> Шаблон «Мой дом»
              </button>
              <button
                type="button"
                className="text_button"
                onClick={() => {
                  const newItems = [
                    ...items,
                    { id: 'item_' + (items.length + 1), name: '', amount: '0.00' },
                  ];
                  setItems(newItems);
                }}
              >
                <Plus size={14} /> Добавить строку
              </button>
            </div>
          </div>

          <div className="receipt_items_list">
            {items.map((it, idx) => (
              <div className="receipt_item_row" key={it.id || idx}>
                <input
                  placeholder="Статья (напр., Лифт)"
                  value={it.name}
                  className="item_name_input"
                  onChange={(e) => {
                    const updated = items.map((x, j) =>
                      j === idx ? { ...x, name: e.target.value } : x,
                    );
                    setItems(updated);
                  }}
                />
                <input
                  placeholder="Сумма"
                  value={it.amount}
                  className="item_amount_input"
                  inputMode="decimal"
                  onChange={(e) => {
                    const updated = items.map((x, j) =>
                      j === idx ? { ...x, amount: e.target.value } : x,
                    );
                    setItems(updated);
                    recalculateTotal(updated);
                  }}
                />
                <button
                  type="button"
                  className="icon_button danger_icon"
                  onClick={() => {
                    const updated = items.filter((_, j) => j !== idx);
                    setItems(updated);
                    recalculateTotal(updated);
                  }}
                  aria-label="Удалить строку"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="receipt_attachment_box">
          <label className="form_label">Прикрепить файл (PDF или фото квитанции)</label>
          <div className="file_upload_row">
            <input
              type="file"
              id="receipt_file_input"
              accept=".pdf,image/*"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <label htmlFor="receipt_file_input" className="secondary_button upload_label_btn">
              <Upload size={15} /> {fileName ? 'Заменить файл' : 'Загрузить файл / скан'}
            </label>
            {fileName && (
              <div className="attached_file_badge">
                <FileText size={15} />
                <span>{fileName}</span>
                <button
                  type="button"
                  className="icon_button"
                  onClick={() => {
                    setFileName('');
                    setFileData('');
                  }}
                  aria-label="Удалить файл"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="form_label" htmlFor="receipt_notes">
            Примечания
          </label>
          <input
            id="receipt_notes"
            placeholder="Номер чека, комментарий, подробности..."
            value={notes}
            maxLength={200}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && <p className="error">{error}</p>}

        <div className="modal_actions">
          <button type="button" className="secondary_button" onClick={onClose}>
            Отмена
          </button>
          <button className="primary_button" disabled={saving}>
            {saving ? <LoaderCircle size={17} className="spin" /> : <Check size={17} />} Сохранить
            квитанцию
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ReceiptViewModal({
  receipt,
  onEdit,
  onDelete,
  onClose,
}: {
  receipt: Receipt;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const cat = receiptCategories[receipt.category] || receiptCategories.other;

  return (
    <Modal title={receipt.title} onClose={onClose}>
      <div className="receipt_view_modal">
        <div className="receipt_view_topbar">
          <span
            className="receipt_category_badge"
            style={{ backgroundColor: cat.color + '18', color: cat.color }}
          >
            {cat.name}
          </span>
          <span className={'receipt_status_pill ' + receipt.status}>
            {receipt.status === 'paid'
              ? 'Оплачено'
              : receipt.status === 'partial'
                ? 'Частично'
                : 'Ожидает оплаты'}
          </span>
        </div>

        <div className="receipt_view_kpis">
          <div className="receipt_kpi_card">
            <small>К оплате</small>
            <strong>{receipt.amount} сом</strong>
          </div>
          <div className="receipt_kpi_card">
            <small>Оплачено</small>
            <strong className="green_text">{receipt.paidAmount} сом</strong>
          </div>
          <div className="receipt_kpi_card">
            <small>Лицевой счёт</small>
            <strong>{receipt.account || '—'}</strong>
          </div>
        </div>

        {receipt.dueDate && (
          <p className="receipt_due_info">
            <CalendarDays size={15} /> Срок оплаты: до {receipt.dueDate}
            {receipt.paidDate && ` · Оплачено: ${receipt.paidDate}`}
          </p>
        )}

        {receipt.fileData && (
          <div className="receipt_file_preview_box">
            <div className="receipt_file_header">
              <div className="receipt_file_info">
                <FileText size={18} />
                <span>{receipt.fileName || 'Квитанция'}</span>
              </div>
              <a
                href={receipt.fileData}
                download={receipt.fileName || 'receipt.pdf'}
                className="secondary_button small_btn"
              >
                <Download size={14} /> Скачать
              </a>
            </div>
            {receipt.fileData.startsWith('data:image/') ? (
              <img
                src={receipt.fileData}
                alt={receipt.fileName}
                className="receipt_image_preview"
              />
            ) : receipt.fileData.startsWith('data:application/pdf') ? (
              <iframe
                src={receipt.fileData}
                title={receipt.fileName}
                className="receipt_pdf_frame"
              />
            ) : null}
          </div>
        )}

        {receipt.items && receipt.items.length > 0 && (
          <div className="receipt_view_items">
            <h4>Расшифровка начислений</h4>
            <table className="receipt_table">
              <thead>
                <tr>
                  <th>Услуга / Статья</th>
                  <th>Объём</th>
                  <th>Тариф</th>
                  <th style={{ textAlign: 'right' }}>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((it, idx) => (
                  <tr key={it.id || idx}>
                    <td>{it.name}</td>
                    <td>{it.volume ? `${it.volume} ${it.unit || ''}` : '—'}</td>
                    <td>{it.tariff ? `${it.tariff} сом` : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{it.amount} сом</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {receipt.notes && (
          <div className="receipt_notes_box">
            <Info size={16} />
            <p>{receipt.notes}</p>
          </div>
        )}

        <div className="modal_actions">
          <button
            type="button"
            className="secondary_button danger_text"
            disabled={deleting}
            onClick={async () => {
              if (!confirm('Удалить эту квитанцию?')) return;
              setDeleting(true);
              try {
                await onDelete();
                onClose();
              } finally {
                setDeleting(false);
              }
            }}
          >
            <Trash2 size={16} /> Удалить
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="secondary_button"
              onClick={() => {
                onClose();
                onEdit();
              }}
            >
              <Settings2 size={16} /> Редактировать
            </button>
            <button type="button" className="primary_button" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

const METER_SPECS: Record<ProviderId, string> = {
  water: 'СВК-15 · КЛАСС B · Qn 1.5 m³/h',
  gas: 'G-4 · ТАХИОМЕТРИЧЕСКИЙ · PN 0.05',
  heat: 'ГВС-15 · ДО 90°C · ДУ 15',
  electricity: 'АСКУЭ · ОДНОФАЗНЫЙ · 220V 50Hz',
};

function MeterDial({
  provider,
  value,
  previous,
  unit,
  disabled,
  meterId,
  meterLabel,
  account,
  onChange,
}: {
  provider: ProviderId;
  value: string;
  previous: string;
  unit: string;
  disabled: boolean;
  meterId: string;
  meterLabel: string;
  account: string;
  onChange: (val: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const cleanVal = (value ?? '').trim();
  const sepIdx = cleanVal.search(/[,.]/);
  const hasSep = sepIdx !== -1;
  const rawInt = hasSep ? cleanVal.slice(0, sepIdx) : cleanVal;
  const rawFrac = hasSep ? cleanVal.slice(sepIdx + 1) : '';

  const defaultIntLen = provider === 'gas' ? 7 : provider === 'electricity' ? 6 : 5;
  const intLen = Math.max(defaultIntLen, rawInt.length);
  const paddedInt = rawInt.padStart(intLen, '0');
  const leadingZerosCount = rawInt.length > 0 ? intLen - rawInt.length : intLen;

  const numCur = Number(cleanVal.replace(',', '.'));
  const numPrev = Number(previous.replace(',', '.'));
  const hasDiff =
    cleanVal !== '' && previous !== '' && Number.isFinite(numCur) && Number.isFinite(numPrev);
  const diff = hasDiff ? numCur - numPrev : null;
  const isFlowing = focused || (hasDiff && diff !== null && diff > 0);

  return (
    <div
      className={
        'meter_faceplate ' +
        provider +
        (focused ? ' is_focused' : '') +
        (disabled ? ' is_locked' : '')
      }
      onClick={() => inputRef.current?.focus()}
    >
      <span className="meter_screw tl" aria-hidden="true" />
      <span className="meter_screw tr" aria-hidden="true" />
      <span className="meter_screw bl" aria-hidden="true" />
      <span className="meter_screw br" aria-hidden="true" />

      <div className="meter_faceplate_header">
        <span className="meter_spec_tag">{METER_SPECS[provider]}</span>
        <span className="meter_serial_tag">№ ••••{account.slice(-4)}</span>
      </div>

      <div className="meter_drum_window">
        <div className="meter_acrylic_glare" aria-hidden="true" />

        <div
          className={'meter_impeller_port' + (isFlowing ? ' active_flow' : '')}
          title={isFlowing ? 'Расход зафиксирован (крыльчатка вращается)' : 'Крыльчатка расхода'}
        >
          <span className="meter_impeller_jewel" />
          <svg
            className={'meter_impeller' + (isFlowing ? ' spinning' : '')}
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 2l1.9 4.3 4.3-1.9-1.9 4.3 4.3 1.9-4.3 1.9 1.9 4.3-4.3-1.9-1.9 4.3-1.9-4.3-4.3 1.9 1.9-4.3-4.3-1.9 4.3-1.9-1.9-4.3 4.3 1.9z" />
          </svg>
        </div>

        <div className="meter_drums_rack">
          {paddedInt.split('').map((digit, idx) => {
            const isDimmed = idx < leadingZerosCount;
            const isCursor =
              focused &&
              idx ===
                (rawInt.length === 0
                  ? intLen - 1
                  : Math.min(intLen - 1, leadingZerosCount + rawInt.length - 1));
            return (
              <div
                key={'int_' + idx}
                className={
                  'drum_wheel' + (isDimmed ? ' dimmed' : '') + (isCursor ? ' cursor_target' : '')
                }
              >
                <span>{digit}</span>
              </div>
            );
          })}

          {hasSep && (
            <>
              <div className="drum_separator">,</div>
              {rawFrac.split('').map((digit, idx) => (
                <div key={'frac_' + idx} className="drum_wheel red">
                  <span>{digit}</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="meter_unit_plaque">
          {disabled ? (
            <span className="meter_seal_badge" title="Счётчик зафиксирован / опломбирован">
              <LockKeyhole size={11} /> ПЛОМБА
            </span>
          ) : (
            <span className="meter_unit_text">{unit}</span>
          )}
        </div>

        <input
          ref={inputRef}
          id={'read_' + meterId}
          className="meter_hidden_input"
          aria-label={meterLabel}
          inputMode={provider === 'gas' ? 'numeric' : 'decimal'}
          value={value}
          disabled={disabled}
          autoComplete="off"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>

      <div className="meter_faceplate_footer">
        <span className="meter_dial_model">{meterLabel}</span>
        {hasDiff && diff !== null ? (
          <span
            className={
              'meter_delta_pill ' + (diff > 0 ? 'positive' : diff === 0 ? 'zero' : 'negative')
            }
          >
            Расход: {diff > 0 ? '+' : ''}
            {diff.toLocaleString('ru', { maximumFractionDigits: 3 })} {unit}
          </span>
        ) : (
          <span className="meter_delta_pill idle">
            было: {previous !== '' ? previous : '—'} {previous !== '' ? unit : ''}
          </span>
        )}
      </div>
    </div>
  );
}

function EmptyMeterDial({ provider, unit }: { provider: ProviderId; unit: string }) {
  const defaultIntLen = provider === 'gas' ? 7 : provider === 'electricity' ? 6 : 5;
  return (
    <div className={'meter_faceplate ' + provider + ' is_empty'}>
      <span className="meter_screw tl" aria-hidden="true" />
      <span className="meter_screw tr" aria-hidden="true" />
      <span className="meter_screw bl" aria-hidden="true" />
      <span className="meter_screw br" aria-hidden="true" />

      <div className="meter_faceplate_header">
        <span className="meter_spec_tag">{METER_SPECS[provider]}</span>
        <span className="meter_serial_tag">СЧЁТ НЕ ПОДКЛЮЧЁН</span>
      </div>

      <div className="meter_drum_window">
        <div className="meter_acrylic_glare" aria-hidden="true" />
        <div className="meter_impeller_port">
          <span className="meter_impeller_jewel dim" />
          <svg className="meter_impeller inactive" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l1.9 4.3 4.3-1.9-1.9 4.3 4.3 1.9-4.3 1.9 1.9 4.3-4.3-1.9-1.9 4.3-1.9-4.3-4.3 1.9 1.9-4.3-4.3-1.9 4.3-1.9-1.9-4.3 4.3 1.9z" />
          </svg>
        </div>

        <div className="meter_drums_rack">
          {Array.from({ length: defaultIntLen }).map((_, idx) => (
            <div key={idx} className="drum_wheel dimmed">
              <span>0</span>
            </div>
          ))}
        </div>

        <div className="meter_unit_plaque">
          <span className="meter_unit_text">{unit}</span>
        </div>
      </div>

      <div className="meter_faceplate_footer">
        <span className="meter_dial_model">Гнездо прибора учёта</span>
        <span className="meter_delta_pill idle">Не установлен</span>
      </div>
    </div>
  );
}

export default function Dashboard({
  authenticated,
  liveEnabled,
}: {
  authenticated: boolean;
  liveEnabled: boolean;
}) {
  const [view, setView] = useState<'readings' | 'receipts' | 'history' | 'connections'>('readings'),
    [period, setPeriod] = useState(bishkekPeriod()),
    [accounts, setAccounts] = useState<Account[]>([]),
    [readings, setReadings] = useState<Reading[]>([]),
    [receipts, setReceipts] = useState<Receipt[]>([]),
    [editingReceipt, setEditingReceipt] = useState<Receipt | null | 'new'>(null),
    [viewingReceipt, setViewingReceipt] = useState<Receipt | null>(null),
    [receiptFilter, setReceiptFilter] = useState<'all' | 'unpaid' | 'paid'>('all'),
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
    confirmed = active.filter((r) => r.status === 'confirmed').length,
    monthlyReceipts = receipts.filter((r) => r.period === period),
    unpaidCount = receipts.filter((r) => r.status === 'unpaid').length,
    totalInvoiced = monthlyReceipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
    totalPaid = monthlyReceipts.reduce((sum, r) => sum + (Number(r.paidAmount) || 0), 0),
    totalRemaining = Math.max(0, totalInvoiced - totalPaid),
    filteredReceipts = monthlyReceipts.filter((r) => {
      if (receiptFilter === 'unpaid') return r.status === 'unpaid' || r.status === 'partial';
      if (receiptFilter === 'paid') return r.status === 'paid';
      return true;
    });
  async function reload() {
    if (!authenticated) return;
    const d = await api('state');
    setAccounts(d.accounts);
    setReadings(d.readings);
    setReceipts(d.receipts || []);
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
    const demoReceipts: Receipt[] = [
      {
        id: 'demo_mydom_1',
        period: bishkekPeriod(),
        category: 'mydom',
        title: 'Единая квитанция · Мой дом',
        account: '3180429',
        amount: '2985.60',
        paidAmount: '0.00',
        status: 'unpaid',
        dueDate: bishkekPeriod() + '-25',
        paidDate: '',
        fileName: 'mydom_receipt_2026.pdf',
        fileData: '',
        notes: 'ТСЖ «Южные Ворота», кв. 42. Включены городские службы и расходы дома.',
        items: [
          {
            id: '1',
            name: 'Техническое обслуживание дома',
            amount: '1625.00',
            unit: 'м²',
            volume: '65',
            tariff: '25.00',
          },
          {
            id: '2',
            name: 'Обслуживание пассажирского лифта',
            amount: '220.00',
            unit: 'мес.',
            volume: '1',
            tariff: '220.00',
          },
          {
            id: '3',
            name: 'Вывоз ТБО (МП «Тазалык»)',
            amount: '135.00',
            unit: 'чел.',
            volume: '3',
            tariff: '45.00',
          },
          {
            id: '4',
            name: 'Холодное водоснабжение и стоки',
            amount: '215.60',
            unit: 'м³',
            volume: '14',
            tariff: '15.40',
          },
          {
            id: '5',
            name: 'Горячее водоснабжение и подогрев',
            amount: '480.00',
            unit: 'м³',
            volume: '6',
            tariff: '80.00',
          },
          {
            id: '6',
            name: 'Домофонная связь',
            amount: '80.00',
            unit: 'мес.',
            volume: '1',
            tariff: '80.00',
          },
          {
            id: '7',
            name: 'Охрана и видеонаблюдение территории',
            amount: '230.00',
            unit: 'мес.',
            volume: '1',
            tariff: '230.00',
          },
        ],
      },
      {
        id: 'demo_gas_1',
        period: bishkekPeriod(),
        category: 'gas',
        title: 'Газпром Кыргызстан',
        account: '000000001',
        amount: '443.30',
        paidAmount: '443.30',
        status: 'paid',
        dueDate: bishkekPeriod() + '-30',
        paidDate: bishkekPeriod() + '-18',
        fileName: 'gazprom_receipt.pdf',
        fileData: '',
        notes: 'Оплачено через MBANK QR.',
        items: [
          {
            id: 'g1',
            name: 'Природный газ (счётчик)',
            amount: '443.30',
            unit: 'м³',
            volume: '22',
            tariff: '20.15',
          },
        ],
      },
    ];
    setReceipts(demoReceipts);
    setNotice('Пример: данные вымышленные, запросы поставщикам отключены.');
  }
  async function exitDemo() {
    setDemo(false);
    setAccounts([]);
    setReadings([]);
    setReceipts([]);
    setValues({});
    if (authenticated)
      try {
        await reload();
      } catch (e) {
        setNotice((e as Error).message);
      }
  }
  async function saveReceipt(r: Receipt) {
    if (demo) {
      setReceipts((rs) => {
        const idx = rs.findIndex((x) => x.id === r.id);
        return idx >= 0 ? rs.map((x, i) => (i === idx ? r : x)) : [r, ...rs];
      });
      setNotice('Квитанция сохранена.');
      return;
    }
    await api('receipts', r);
    await reload();
    setNotice('Квитанция успешно сохранена в архиве.');
  }
  async function deleteReceipt(id: string) {
    if (demo) {
      setReceipts((rs) => rs.filter((x) => x.id !== id));
      setNotice('Квитанция удалена.');
      return;
    }
    await fetch('/api/receipts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await reload();
    setNotice('Квитанция удалена.');
  }
  async function toggleReceiptPaid(r: Receipt) {
    const isNowPaid = r.status !== 'paid';
    const updated: Receipt = {
      ...r,
      status: isNowPaid ? 'paid' : 'unpaid',
      paidAmount: isNowPaid ? r.amount : '0.00',
      paidDate: isNowPaid ? new Date().toISOString().slice(0, 10) : '',
    };
    if (demo) {
      setReceipts((rs) => rs.map((x) => (x.id === r.id ? updated : x)));
      setNotice(isNowPaid ? 'Квитанция отмечена оплаченной.' : 'Статус изменён на: к оплате.');
      return;
    }
    await api('receipts', updated);
    await reload();
    setNotice(isNowPaid ? 'Квитанция отмечена оплаченной.' : 'Статус изменён на: к оплате.');
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
  async function send(readingToSend?: Reading) {
    const target = readingToSend || active.find((r) => editable(r));
    if (!target || demo || !checked) return;
    setBusy('send-' + target.id);
    try {
      const result = await api('submit', {
        id: target.id,
        version: target.created,
        confirmed: true,
      });
      setNotice(
        result.status === 'confirmed'
          ? `${providers[target.provider].company}: показания успешно приняты.`
          : result.detail,
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
  async function sendAll() {
    const targets = active.filter((r) => editable(r));
    if (!targets.length || demo || !checked) return;
    setBusy('send-all');
    const results: string[] = [];
    for (const target of targets) {
      try {
        const result = await api('submit', {
          id: target.id,
          version: target.created,
          confirmed: true,
        });
        results.push(
          `${providers[target.provider].name}: ${result.status === 'confirmed' ? 'Принято' : result.detail}`,
        );
      } catch (e) {
        results.push(`${providers[target.provider].name}: ${(e as Error).message}`);
      }
    }
    setNotice(results.join(' | '));
    try {
      await reload();
    } catch {}
    setBusy('');
    setChecked(false);
  }
  async function copy(r: Reading) {
    try {
      await navigator.clipboard.writeText(manualMessage(r));
      setNotice('Показания скопированы. Вставьте их в форму поставщика.');
    } catch {
      setNotice('Не удалось скопировать. Значения доступны в истории.');
    }
  }
  const editableDrafts = active.filter((r) => editable(r));
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
              { id: 'receipts', label: 'Квитанции', icon: ReceiptIcon },
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
              {n.id === 'receipts' && unpaidCount > 0 && (
                <span className="nav_count warning">{unpaidCount}</span>
              )}
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
              {view === 'readings'
                ? 'Показания'
                : view === 'receipts'
                  ? 'Квитанции'
                  : view === 'history'
                    ? 'История'
                    : 'Подключения'}
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
                ) : view === 'receipts' ? (
                  <>
                    Квитанции.
                    <br className="mobile_break" /> Единый архив счетов.
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
                  : view === 'receipts'
                    ? 'Единая квитанция «Мой дом», ТСЖ и городские службы. Учёт начислений и сверка со счётчиками.'
                    : view === 'history'
                      ? 'Ваши черновики, ответы поставщиков и сохранённые показания.'
                      : 'Добавьте лицевые счета и проверьте, как передаются показания.'}
              </p>
            </div>
            {view === 'readings' || view === 'receipts' ? (
              <div className="heading_controls_cluster">
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
                {view === 'receipts' && (
                  <button className="primary_button" onClick={() => setEditingReceipt('new')}>
                    <Plus size={16} /> Добавить квитанцию
                  </button>
                )}
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
                                <MeterDial
                                  key={m.id}
                                  provider={p}
                                  value={values[p]?.[m.id] ?? ''}
                                  previous={m.previous}
                                  unit={meta.unit}
                                  disabled={locked}
                                  meterId={m.id}
                                  meterLabel={a.meters.length > 1 ? m.label : 'Текущее показание'}
                                  account={a.account}
                                  onChange={(val) =>
                                    setValues((v) => ({
                                      ...v,
                                      [p]: { ...v[p], [m.id]: val },
                                    }))
                                  }
                                />
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
                                <EmptyMeterDial provider={p} unit={meta.unit} />
                                <div className="meter_card_footer">
                                  <span>Счёт не добавлен</span>
                                  <button className="text_button" onClick={() => setEditing(p)}>
                                    <Plus size={16} /> Добавить
                                  </button>
                                </div>
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
          {view === 'receipts' && (
            <section className="receipts_section">
              <div className="receipts_overview">
                <div className="receipt_kpi_card">
                  <div className="kpi_top">
                    <span className="stat_icon">
                      <ReceiptIcon size={18} />
                    </span>
                    <small>Всего начислено</small>
                  </div>
                  <strong>
                    {totalInvoiced.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}{' '}
                    <span>сом</span>
                  </strong>
                </div>

                <div className="receipt_kpi_card">
                  <div className="kpi_top">
                    <span className="stat_icon green">
                      <CheckCircle2 size={18} />
                    </span>
                    <small>Оплачено</small>
                  </div>
                  <strong className="green_text">
                    {totalPaid.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}{' '}
                    <span>сом</span>
                  </strong>
                </div>

                <div className="receipt_kpi_card">
                  <div className="kpi_top">
                    <span className={'stat_icon ' + (totalRemaining > 0 ? 'orange' : 'green')}>
                      <CalendarDays size={18} />
                    </span>
                    <small>Остаток к оплате</small>
                  </div>
                  <strong className={totalRemaining > 0 ? 'orange_text' : 'green_text'}>
                    {totalRemaining.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}{' '}
                    <span>сом</span>
                  </strong>
                </div>

                <div className="receipt_kpi_card">
                  <div className="kpi_top">
                    <span className="stat_icon">
                      <Building2 size={18} />
                    </span>
                    <small>В архиве за месяц</small>
                  </div>
                  <strong>
                    {monthlyReceipts.length}
                    <span> квитанций</span>
                  </strong>
                </div>
              </div>

              {active.length > 0 && (
                <div className="receipt_crosscheck_banner">
                  <div className="crosscheck_icon">
                    <Sparkles size={20} />
                  </div>
                  <div className="crosscheck_content">
                    <strong>Сверка с переданными показаниями приборов учёта</strong>
                    <p>
                      За {monthLabel(period)} в Bill-Hub зафиксированы показания:{' '}
                      {active
                        .flatMap((r) => r.values)
                        .map((v) => `${v.label}: ${v.value} ${v.unit}`)
                        .join(' · ')}
                      . Объёмы воды, газа и электричества можно сверить со строками в квитанции «Мой
                      дом».
                    </p>
                  </div>
                </div>
              )}

              <div className="receipts_toolbar">
                <div className="receipts_filter_tabs">
                  <button
                    className={'tab_pill ' + (receiptFilter === 'all' ? 'active' : '')}
                    onClick={() => setReceiptFilter('all')}
                  >
                    Все ({monthlyReceipts.length})
                  </button>
                  <button
                    className={'tab_pill ' + (receiptFilter === 'unpaid' ? 'active' : '')}
                    onClick={() => setReceiptFilter('unpaid')}
                  >
                    Ожидают оплаты (
                    {
                      monthlyReceipts.filter((r) => r.status === 'unpaid' || r.status === 'partial')
                        .length
                    }
                    )
                  </button>
                  <button
                    className={'tab_pill ' + (receiptFilter === 'paid' ? 'active' : '')}
                    onClick={() => setReceiptFilter('paid')}
                  >
                    Оплаченные ({monthlyReceipts.filter((r) => r.status === 'paid').length})
                  </button>
                </div>

                <div className="receipts_toolbar_actions">
                  <button className="secondary_button" onClick={() => setEditingReceipt('new')}>
                    <Sparkles size={15} /> Шаблон «Мой дом»
                  </button>
                  <button className="primary_button" onClick={() => setEditingReceipt('new')}>
                    <Plus size={16} /> Добавить квитанцию
                  </button>
                </div>
              </div>

              {filteredReceipts.length === 0 ? (
                <div className="empty_receipts_state">
                  <div className="empty_icon_box">
                    <ReceiptIcon size={36} />
                  </div>
                  <h3>В архиве пока нет квитанций за {monthLabel(period)}</h3>
                  <p>
                    Сохраняйте единые квитанции из сервиса «Мой дом», счета ТСЖ и квитанции
                    коммунальных служб. Вы сможете отслеживать историю начислений, контролировать
                    оплату и прикреплять сканы или PDF.
                  </p>
                  <div className="empty_actions">
                    <button className="primary_button" onClick={() => setEditingReceipt('new')}>
                      <Sparkles size={16} /> Создать квитанцию «Мой дом»
                    </button>
                  </div>
                </div>
              ) : (
                <div className="receipts_grid">
                  {filteredReceipts.map((r) => {
                    const cat = receiptCategories[r.category] || receiptCategories.other;
                    return (
                      <article className="receipt_card" key={r.id}>
                        <div className="receipt_card_header">
                          <span
                            className="receipt_category_badge"
                            style={{ backgroundColor: cat.color + '16', color: cat.color }}
                          >
                            {cat.badge}
                          </span>
                          <span className={'receipt_status_pill ' + r.status}>
                            {r.status === 'paid'
                              ? 'Оплачено'
                              : r.status === 'partial'
                                ? 'Частично'
                                : 'Ожидает оплаты'}
                          </span>
                        </div>

                        <div className="receipt_card_body">
                          <h3 onClick={() => setViewingReceipt(r)}>{r.title}</h3>
                          {r.account && (
                            <p className="receipt_card_account">
                              Лицевой счёт: <strong>{r.account}</strong>
                            </p>
                          )}
                          <div className="receipt_card_sum">
                            <strong>{r.amount}</strong>
                            <span> сом</span>
                          </div>
                          {r.dueDate && (
                            <p className="receipt_card_due">
                              <CalendarDays size={13} /> Срок оплаты: до {r.dueDate}
                            </p>
                          )}

                          {r.fileName && (
                            <div
                              className="receipt_attached_tag"
                              onClick={() => setViewingReceipt(r)}
                              title="Нажмите для просмотра"
                            >
                              <FileText size={14} />
                              <span>{r.fileName}</span>
                            </div>
                          )}

                          {r.items && r.items.length > 0 && (
                            <div className="receipt_items_teaser">
                              <div className="teaser_header">
                                <small>Статьи начислений ({r.items.length}):</small>
                              </div>
                              <ul className="teaser_list">
                                {r.items.slice(0, 3).map((it, idx) => (
                                  <li key={it.id || idx}>
                                    <span>{it.name}</span>
                                    <strong>{it.amount} с.</strong>
                                  </li>
                                ))}
                                {r.items.length > 3 && (
                                  <li className="teaser_more">
                                    <button
                                      type="button"
                                      className="text_button"
                                      onClick={() => setViewingReceipt(r)}
                                    >
                                      + ещё {r.items.length - 3} стать(и/ей)...
                                    </button>
                                  </li>
                                )}
                              </ul>
                            </div>
                          )}
                        </div>

                        <div className="receipt_card_footer">
                          <button
                            type="button"
                            className={
                              'status_toggle_btn ' + (r.status === 'paid' ? 'is_paid' : 'is_unpaid')
                            }
                            onClick={() => toggleReceiptPaid(r)}
                          >
                            <Check size={14} />
                            {r.status === 'paid' ? 'Оплачено' : 'Отметить оплаченным'}
                          </button>
                          <div className="receipt_card_actions">
                            <button
                              type="button"
                              className="icon_button"
                              title="Подробнее и просмотр"
                              onClick={() => setViewingReceipt(r)}
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              type="button"
                              className="icon_button"
                              title="Редактировать"
                              onClick={() => setEditingReceipt(r)}
                            >
                              <Settings2 size={16} />
                            </button>
                            <button
                              type="button"
                              className="icon_button danger_icon"
                              title="Удалить"
                              onClick={() => deleteReceipt(r.id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
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
              <article className="connection_card mydom_special">
                <span className="provider_icon" style={{ background: '#ecfdf5', color: '#10b981' }}>
                  <Building2 size={24} />
                </span>
                <div>
                  <div className="connection_title">
                    <h2>Мой дом (mydom.kg)</h2>
                    <span className="status_pill available">Единая квитанция</span>
                  </div>
                  <p>
                    Цифровая платформа ЖКХ Бишкека. Объединяет счета ТСЖ, вывоз мусора «Тазалык»,
                    лифт, воду, тепло и свет в одну квитанцию с QR-кодом для оплаты через MBANK,
                    MegaPay и Элдик.
                  </p>
                  <small>
                    Лицевой счёт «Мой дом» позволяет вести единый учёт всех начислений по вашей
                    квартире.
                  </small>
                  <div className="connection_links">
                    <a href="https://mydom.kg" target="_blank" rel="noreferrer">
                      Официальный сайт mydom.kg <ArrowUpRight size={14} />
                    </a>
                  </div>
                </div>
                <button
                  className="secondary_button"
                  onClick={() => {
                    setView('receipts');
                    setEditingReceipt('new');
                  }}
                >
                  <Plus size={16} /> Квитанция Мой дом
                </button>
              </article>
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
                {!editable(r) ? (
                  <p className="field_hint">{r.detail}</p>
                ) : (
                  <>
                    <p className="field_hint">{providers[r.provider].explanation}</p>
                    <div className="review_links">
                      <button
                        className="primary_button"
                        style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}
                        disabled={
                          !checked ||
                          demo ||
                          !liveEnabled ||
                          Boolean(busy) ||
                          period !== bishkekPeriod()
                        }
                        onClick={() => send(r)}
                      >
                        {busy === 'send-' + r.id ? (
                          <LoaderCircle size={14} className="spin" />
                        ) : (
                          <ArrowUpRight size={14} />
                        )}{' '}
                        Отправить {providers[r.provider].name}
                      </button>
                      <button className="text_button" onClick={() => copy(r)}>
                        <Copy size={14} /> Копировать
                      </button>
                      <a href={providers[r.provider].url} target="_blank" rel="noreferrer">
                        Сайт <ArrowUpRight size={14} />
                      </a>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
          {editableDrafts.length > 0 && (
            <label className="confirm_check">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                disabled={demo || Boolean(busy)}
              />
              <span>Я проверил лицевые счета и показания. Отправить эти данные поставщикам.</span>
            </label>
          )}
          <div className="modal_actions">
            <button
              className="secondary_button"
              disabled={Boolean(busy)}
              onClick={() => setReview(false)}
            >
              Закрыть
            </button>
            {editableDrafts.length > 0 && (
              <button
                className="primary_button"
                disabled={
                  !checked || demo || !liveEnabled || Boolean(busy) || period !== bishkekPeriod()
                }
                onClick={sendAll}
              >
                {busy === 'send-all' ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <ArrowUpRight size={17} />
                )}{' '}
                Отправить все ({editableDrafts.length})
              </button>
            )}
          </div>
          {editableDrafts.length > 0 && !liveEnabled && (
            <p className="field_hint">Отправка поставщикам выключена владельцем сервера.</p>
          )}
          {editableDrafts.length > 0 && period !== bishkekPeriod() && (
            <p className="field_hint">Архивные показания сохраняются только для вашего учёта.</p>
          )}
        </Modal>
      )}
      {editingReceipt && (
        <ReceiptModal
          existing={editingReceipt === 'new' ? null : editingReceipt}
          defaultPeriod={period}
          onSave={saveReceipt}
          onClose={() => setEditingReceipt(null)}
        />
      )}
      {viewingReceipt && (
        <ReceiptViewModal
          receipt={viewingReceipt}
          onEdit={() => {
            const target = viewingReceipt;
            setViewingReceipt(null);
            setEditingReceipt(target);
          }}
          onDelete={async () => {
            await deleteReceipt(viewingReceipt.id);
            setViewingReceipt(null);
          }}
          onClose={() => setViewingReceipt(null)}
        />
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
