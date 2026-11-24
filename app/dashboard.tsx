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
  RefreshCw,
  Wifi,
  CreditCard,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  Printer,
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
  INTERNET_PROVIDERS,
  type InternetProviderInfo,
  validateReceipt,
} from '@/lib/domain';
import {
  generateReceiptSvg,
  generatePrintableReceiptHtml,
} from '@/lib/receipt-generator';
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
    setTitle('Единая квитанция · Мэрия г. Бишкек');
    if (!account) setAccount('4011 (1-310-У111)');
    recalculateTotal(templateItems);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Файл квитанции не должен превышать 5 МБ.');
      return;
    }
    setError('');
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setFileData(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.readAsDataURL(file);

    // If uploading the Bishkek municipal receipt, prefill metadata
    if (file.name.includes('Квитанция') || file.name.includes('mydom')) {
      if (!account) setAccount('4011 (1-310-У111)');
      if (category === 'mydom') {
        setTitle('Единая квитанция · Мэрия г. Бишкек');
      }
    }
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
      let finalPaidAmount = paidAmount;
      if (status === 'unpaid') {
        finalPaidAmount = '0.00';
      } else if (status === 'paid' && (!finalPaidAmount || Number(finalPaidAmount) === 0)) {
        finalPaidAmount = calculatedAmount;
      }
      const payload = validateReceipt({
        id: existing?.id,
        period,
        category,
        title,
        account,
        amount: calculatedAmount,
        paidAmount: finalPaidAmount,
        status,
        dueDate,
        paidDate:
          status === 'paid' && !paidDate
            ? new Date().toISOString().slice(0, 10)
            : status === 'unpaid'
              ? ''
              : paidDate,
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

        {category === 'internet' && (
          <div className="isp_quick_select">
            <span className="isp_quick_label">
              <Wifi size={13} /> Провайдеры в Бишкеке (выберите для быстрого заполнения):
            </span>
            <div className="isp_chips">
              {INTERNET_PROVIDERS.map((isp) => (
                <button
                  type="button"
                  key={isp.id}
                  className="isp_chip"
                  onClick={() => {
                    setTitle(`Интернет ${isp.name} · ${isp.planName}`);
                    setAmount(isp.defaultTariff);
                    setItems([
                      {
                        id: 'isp_1',
                        name: `Абонентская плата ${isp.name} (${isp.planName})`,
                        amount: isp.defaultTariff,
                        unit: 'мес.',
                        volume: '1',
                        tariff: isp.defaultTariff,
                      },
                    ]);
                  }}
                >
                  {isp.isMydomPartner && (
                    <span className="partner_star" title="Официальный партнёр «Мой дом»">
                      ★{' '}
                    </span>
                  )}
                  {isp.name} · {isp.defaultTariff} с
                </button>
              ))}
            </div>
          </div>
        )}

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
                } else if (newStatus === 'unpaid') {
                  setPaidAmount('0.00');
                  setPaidDate('');
                }
              }}
            >
              <option value="unpaid">Ожидает оплаты</option>
              <option value="paid">Оплачено полностью</option>
              <option value="partial">Частично оплачено</option>
            </select>
          </div>
        </div>

        {status === 'paid' && (
          <div className="status_warning_note">
            <ShieldAlert size={15} />
            <span>
              Указывайте статус «Оплачено» только если платёж уже фактически списан в банке.
            </span>
          </div>
        )}

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
  onManagePayment,
  onClose,
}: {
  receipt: Receipt;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onManagePayment: () => void;
  onClose: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const cat = receiptCategories[receipt.category] || receiptCategories.other;
  const isPaid = receipt.status === 'paid';
  const hasPdf = receipt.fileData && receipt.fileData.startsWith('data:application/pdf');

  function downloadDoc(mode: 'bill' | 'paid') {
    if (mode === 'bill' && hasPdf) {
      const link = document.createElement('a');
      link.href = receipt.fileData;
      link.download =
        receipt.fileName || `Schet_na_oplatu_${receipt.period}_${receipt.account || '4011'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    const svg = generateReceiptSvg({ receipt, mode });
    const link = document.createElement('a');
    link.href = svg;
    const prefix = mode === 'paid' ? 'Oplacheno' : 'Schet_na_oplatu';
    link.download = `${prefix}_${receipt.period}_${receipt.account || '4011'}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function printDoc(mode: 'bill' | 'paid') {
    const html = generatePrintableReceiptHtml({ receipt, mode });
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
    }
  }

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
              ? '✓ Оплачено'
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
            <strong className={receipt.status === 'paid' ? 'green_text' : ''}>
              {receipt.paidAmount} сом
            </strong>
          </div>
          <div className="receipt_kpi_card">
            <small>Лицевой счёт</small>
            <strong>{receipt.account || '—'}</strong>
          </div>
        </div>

        <div className={'receipt_payment_card ' + receipt.status}>
          {receipt.status === 'paid' ? (
            <div className="payment_card_content">
              <div className="payment_card_icon success">
                <CheckCircle2 size={20} />
              </div>
              <div className="payment_card_text">
                <strong>Квитанция полностью оплачена</strong>
                <p>
                  Фактически оплачено <strong>{receipt.paidAmount} сом</strong>
                  {receipt.paidDate ? ` · Дата: ${receipt.paidDate}` : ''}
                  {receipt.paymentMethod ? ` · ${receipt.paymentMethod}` : ''}
                </p>
              </div>
              <button
                type="button"
                className="secondary_button small_btn"
                onClick={onManagePayment}
              >
                Снять отметку / Изменить
              </button>
            </div>
          ) : receipt.status === 'partial' ? (
            <div className="payment_card_content">
              <div className="payment_card_icon partial">
                <Info size={20} />
              </div>
              <div className="payment_card_text">
                <strong>Частичная оплата квитанции</strong>
                <p>
                  Оплачено: <strong>{receipt.paidAmount} сом</strong>. Остаток долга:{' '}
                  <strong>
                    {(Number(receipt.amount) - Number(receipt.paidAmount)).toFixed(2)} сом
                  </strong>
                  .
                </p>
              </div>
              <button
                type="button"
                className="primary_button small_btn"
                onClick={onManagePayment}
              >
                <CreditCard size={14} /> Доплатить / Изменить...
              </button>
            </div>
          ) : (
            <div className="payment_card_content">
              <div className="payment_card_icon warning">
                <AlertTriangle size={20} />
              </div>
              <div className="payment_card_text">
                <strong>Квитанция НЕ оплачена</strong>
                <p>
                  К оплате: <strong>{receipt.amount} сом</strong>
                  {receipt.dueDate ? ` · Срок оплаты: до ${receipt.dueDate}` : ''}. Не
                  допускайте просрочек во избежание начисления пени.
                </p>
              </div>
              <button
                type="button"
                className="primary_button small_btn"
                onClick={onManagePayment}
              >
                <CreditCard size={14} /> Отметить оплату...
              </button>
            </div>
          )}
        </div>

        {/* Document & Download Center */}
        <div className="receipt_doc_hub">
          <div className="receipt_doc_hub_header">
            <span className="receipt_doc_hub_title">
              <Download size={16} /> Центр документов и скачивания
            </span>
            <button
              type="button"
              className="secondary_button small_btn"
              onClick={() => printDoc(isPaid ? 'paid' : 'bill')}
              title="Открыть чистовую печатную форму с фискальными реквизитами"
            >
              <Printer size={14} /> Распечатать / В PDF
            </button>
          </div>

          <div className="receipt_doc_grid">
            <button
              type="button"
              className={'receipt_doc_btn ' + (!isPaid ? 'primary_doc' : '')}
              onClick={() => downloadDoc('bill')}
              title="Скачать входящий счёт на оплату (оригинальный PDF или SVG с QR-кодом)"
            >
              <FileText size={20} />
              <div className="receipt_doc_btn_text">
                <strong>Скачать счёт на оплату</strong>
                <small>{hasPdf ? 'Оригинальный PDF документ' : 'Квитанция с ELQR кодом'}</small>
              </div>
            </button>

            <button
              type="button"
              className={'receipt_doc_btn ' + (isPaid ? 'stamp_doc' : '')}
              onClick={() => downloadDoc('paid')}
              title="Скачать официальную квитанцию с фискальным штампом «ОПЛАЧЕНО · ТӨЛӨНДҮ»"
            >
              <CheckCircle2 size={20} />
              <div className="receipt_doc_btn_text">
                <strong>Скачать квитанцию об оплате</strong>
                <small>Фискальный чек со штампом «ОПЛАЧЕНО»</small>
              </div>
            </button>
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
                <Download size={14} /> Скачать оригинал
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

function PaymentConfirmModal({
  receipt,
  onSave,
  onClose,
}: {
  receipt: Receipt;
  onSave: (updated: Receipt) => Promise<void>;
  onClose: () => void;
}) {
  const isCurrentlyPaid = receipt.status === 'paid';
  const remainingDue = Math.max(
    0,
    Number(receipt.amount) - (Number(receipt.paidAmount) || 0),
  ).toFixed(2);

  const [paidAmount, setPaidAmount] = useState(
    isCurrentlyPaid ? receipt.paidAmount : remainingDue !== '0.00' ? remainingDue : receipt.amount,
  );
  const [paidDate, setPaidDate] = useState(
    receipt.paidDate || new Date().toISOString().slice(0, 10),
  );
  const [paymentMethod, setPaymentMethod] = useState(receipt.paymentMethod || 'MBANK');
  const defaultTxn =
    receipt.transactionId ||
    `TXN-${receipt.account || '4011'}-${(receipt.period || '2026-11').replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const [transactionId, setTransactionId] = useState(receipt.transactionId || defaultTxn);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const BANK_PRESETS = [
    'MBANK (ОАО КБ Кыргызстан)',
    'MegaPay',
    'Элдик Банк',
    'О!Деньги',
    'Optima Bank',
    'DemirBank',
    'Касса / Наличные',
  ];

  function downloadDoc(mode: 'bill' | 'paid') {
    if (mode === 'bill' && receipt.fileData && receipt.fileData.startsWith('data:application/pdf')) {
      const link = document.createElement('a');
      link.href = receipt.fileData;
      link.download =
        receipt.fileName || `Schet_na_oplatu_${receipt.period}_${receipt.account || '4011'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    const svg = generateReceiptSvg({
      receipt,
      mode,
      paymentMethod,
      transactionId,
    });
    const link = document.createElement('a');
    link.href = svg;
    const prefix = mode === 'paid' ? 'Oplacheno' : 'Schet_na_oplatu';
    link.download = `${prefix}_${receipt.period}_${receipt.account || '4011'}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function printDoc(mode: 'bill' | 'paid') {
    const html = generatePrintableReceiptHtml({
      receipt,
      mode,
      paymentMethod,
      transactionId,
    });
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
    }
  }

  async function handleMarkPaid(e: FormEvent) {
    e.preventDefault();
    setError('');
    const numPaid = Number(paidAmount);
    if (!Number.isFinite(numPaid) || numPaid <= 0) {
      setError('Укажите корректную сумму фактической оплаты.');
      return;
    }
    if (!confirmed) {
      setError('Подтвердите чекбоксом, что платёж действительно проведён в банке.');
      return;
    }
    setSaving(true);
    try {
      const isFull = numPaid >= Number(receipt.amount);
      const chosenMethod = paymentMethod.trim() || 'MBANK (ОАО КБ Кыргызстан) / ELQR';
      const chosenTxn = transactionId.trim() || defaultTxn;
      const noteAppend = `Оплачено ${numPaid.toFixed(2)} сом через ${chosenMethod} (${paidDate}). Чек: ${chosenTxn}.`;
      const combinedNotes = receipt.notes
        ? receipt.notes.includes(noteAppend)
          ? receipt.notes
          : `${receipt.notes}\n${noteAppend}`
        : noteAppend;

      const updated = validateReceipt({
        ...receipt,
        status: isFull ? 'paid' : 'partial',
        paidAmount: numPaid.toFixed(2),
        paidDate: paidDate || new Date().toISOString().slice(0, 10),
        paymentMethod: chosenMethod,
        transactionId: chosenTxn,
        notes: combinedNotes,
      });

      await onSave(updated);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRevokePayment() {
    if (
      !confirm(
        `Вернуть квитанцию «${receipt.title}» в статус «Ожидает оплаты»?\nСумма задолженности снова составит ${receipt.amount} сом.`,
      )
    ) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = validateReceipt({
        ...receipt,
        status: 'unpaid',
        paidAmount: '0.00',
        paidDate: '',
        paymentMethod: '',
        transactionId: '',
      });
      await onSave(updated);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isCurrentlyPaid ? 'Статус оплаты квитанции' : 'Подтверждение фактической оплаты'}
      onClose={onClose}
    >
      <div className="payment_modal_content">
        <div className="payment_receipt_summary">
          <div className="summary_row">
            <span className="summary_label">Квитанция:</span>
            <strong>{receipt.title}</strong>
          </div>
          {receipt.account && (
            <div className="summary_row">
              <span className="summary_label">Лицевой счёт:</span>
              <span>{receipt.account}</span>
            </div>
          )}
          <div className="summary_row">
            <span className="summary_label">Начислено по квитанции:</span>
            <strong className="summary_amount">{receipt.amount} сом</strong>
          </div>
          {receipt.dueDate && (
            <div className="summary_row">
              <span className="summary_label">Срок оплаты:</span>
              <span>до {receipt.dueDate}</span>
            </div>
          )}
        </div>

        {isCurrentlyPaid ? (
          <div className="payment_current_paid_box">
            <div className="status_banner_paid">
              <CheckCircle2 size={24} className="green_icon" />
              <div>
                <strong>Квитанция отмечена как ОПЛАЧЕННАЯ</strong>
                <p>
                  Фактически оплачено: <strong>{receipt.paidAmount} сом</strong>
                  {receipt.paidDate ? ` (дата: ${receipt.paidDate})` : ''}
                  {receipt.paymentMethod ? ` · ${receipt.paymentMethod}` : ''}.
                </p>
                {receipt.transactionId && (
                  <p style={{ marginTop: '4px', fontSize: '11.5px', color: '#166534' }}>
                    Номер чека / транзакции: <strong>{receipt.transactionId}</strong>
                  </p>
                )}
              </div>
            </div>

            {/* Document Download Buttons for Paid Receipt */}
            <div className="receipt_doc_hub" style={{ marginTop: '12px', marginBottom: '16px' }}>
              <span className="receipt_doc_hub_title" style={{ marginBottom: '10px' }}>
                <Download size={15} /> Получить документы:
              </span>
              <div className="receipt_doc_grid">
                <button
                  type="button"
                  className="receipt_doc_btn stamp_doc"
                  onClick={() => downloadDoc('paid')}
                  title="Скачать квитанцию с фискальной печатью ОПЛАЧЕНО"
                >
                  <CheckCircle2 size={18} />
                  <div className="receipt_doc_btn_text">
                    <strong>Скачать оплаченный чек</strong>
                    <small>С гербовым штампом «ОПЛАЧЕНО»</small>
                  </div>
                </button>
                <button
                  type="button"
                  className="receipt_doc_btn"
                  onClick={() => printDoc('paid')}
                  title="Печать / Сохранить в PDF"
                >
                  <Printer size={18} />
                  <div className="receipt_doc_btn_text">
                    <strong>Печать / Экспорт в PDF</strong>
                    <small>Формат А4 для печати или банка</small>
                  </div>
                </button>
                <button
                  type="button"
                  className="receipt_doc_btn"
                  onClick={() => downloadDoc('bill')}
                  title="Скачать исходный счёт на оплату"
                >
                  <FileText size={18} />
                  <div className="receipt_doc_btn_text">
                    <strong>Исходный счёт</strong>
                    <small>Входящая квитанция на оплату</small>
                  </div>
                </button>
              </div>
            </div>

            <div className="payment_revoke_section">
              <p className="revoke_hint">
                Если оплата ещё не производилась или отметка была поставлена ошибочно, верните квитанцию в статус «Ожидает оплаты», чтобы контролировать задолженность и избежать начисления пени.
              </p>
              <button
                type="button"
                className="secondary_button danger_button"
                disabled={saving}
                onClick={handleRevokePayment}
              >
                {saving ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <RotateCcw size={16} />
                )}{' '}
                Снять отметку об оплате (вернуть в «Ожидает оплаты»)
              </button>
            </div>

            <div className="modal_actions" style={{ marginTop: '20px' }}>
              <button type="button" className="primary_button" onClick={onClose}>
                Закрыть
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleMarkPaid} className="payment_form">
            <div className="payment_warning_banner">
              <ShieldAlert size={22} className="warning_icon" />
              <div>
                <strong>Финансовая ответственность</strong>
                <p>
                  Отмечайте квитанцию оплаченной <u>только после реального списания средств</u> с вашего банковского счёта (MBANK, Элдик Банк, MegaPay, О!Деньги) или кассы. Ложная отметка может привести к образованию задолженности и отключению услуг!
                </p>
              </div>
            </div>

            <div className="form_row_grid">
              <div>
                <label className="form_label" htmlFor="pay_confirm_amount">
                  Фактически оплаченная сумма (сом) *
                </label>
                <input
                  id="pay_confirm_amount"
                  inputMode="decimal"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="form_label" htmlFor="pay_confirm_date">
                  Дата фактической оплаты *
                </label>
                <input
                  id="pay_confirm_date"
                  type="date"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <span className="payment_presets_label">Быстрый выбор банка / способа оплаты:</span>
              <div className="payment_presets_row">
                {BANK_PRESETS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    className={'preset_pill_btn ' + (paymentMethod === b ? 'active' : '')}
                    onClick={() => setPaymentMethod(b)}
                  >
                    {b}
                  </button>
                ))}
              </div>
              <label className="form_label" htmlFor="pay_confirm_method">
                Способ оплаты / Банк *
              </label>
              <input
                id="pay_confirm_method"
                placeholder="Например: MBANK QR, Элдик Банк, О!Деньги"
                value={paymentMethod}
                maxLength={100}
                onChange={(e) => setPaymentMethod(e.target.value)}
                required
              />
            </div>

            <div style={{ marginTop: '10px' }}>
              <label className="form_label" htmlFor="pay_confirm_txn">
                Номер чека / транзакции (для фискального штампа)
              </label>
              <input
                id="pay_confirm_txn"
                placeholder="TXN-4011-..."
                value={transactionId}
                maxLength={100}
                onChange={(e) => setTransactionId(e.target.value)}
              />
            </div>

            <label className="confirm_checkbox_label" style={{ marginTop: '12px' }}>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>
                Я подтверждаю, что указанная сумма <strong>{paidAmount || '0'} сом</strong> действительно списана через {paymentMethod || 'банк'}.
              </span>
            </label>

            {error && <p className="error">{error}</p>}

            <div className="modal_actions">
              <button
                type="button"
                className="secondary_button"
                onClick={onClose}
                disabled={saving}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="primary_button confirm_paid_button"
                disabled={saving || !confirmed}
              >
                {saving ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}
                Подтвердить оплату и сформировать чек
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}

function ChannelsCheckModal({
  open,
  loading,
  data,
  onClose,
  onRecheck,
}: {
  open: boolean;
  loading: boolean;
  data: any;
  onClose: () => void;
  onRecheck: () => void;
}) {
  if (!open) return null;

  return (
    <Modal title="Сверка с открытыми каналами коммунальных служб" onClose={onClose}>
      <div className="payment_modal_content">
        <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#475569' }}>
          Опрос официальных открытых API и шлюзов коммунальных служб г. Бишкек в реальном времени:
        </p>

        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
            <LoaderCircle size={28} className="spin" style={{ margin: '0 auto 12px' }} />
            <p>Опрос шлюзов Бишкекводоканала и Газпрома...</p>
          </div>
        ) : data ? (
          <div>
            {/* Водоканал */}
            <div className="channel_card">
              <div className="channel_card_top">
                <span className="channel_card_title">
                  💧 ПЭУ «Бишкекводоканал» (шлюз voda.link.kg)
                </span>
                <span className={'channel_status_badge ' + (data.water?.ok ? 'active' : 'blocked')}>
                  {data.water?.ok ? '✓ Шлюз активен' : 'Ошибка доступа'}
                </span>
              </div>
              <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#334155' }}>
                Лицевой счёт: <strong>{data.water?.account}</strong>
                {data.water?.address ? ` · Адрес: ${data.water.address}` : ''}
              </p>
              <p style={{ margin: '0', fontSize: '11.5px', color: '#64748b' }}>
                {data.water?.detail}
              </p>
              {data.water?.meters && data.water.meters.length > 0 && (
                <div className="meter_chip_list">
                  {data.water.meters.map((m: any) => (
                    <div className="meter_chip" key={m.meterId}>
                      <span>
                        {m.kind === 'cold' ? 'Холодная вода (ХВС)' : 'Стоки горячей воды (ГВС)'} · Заводской №{m.serialNumber}
                      </span>
                      <strong>Показание в базе: {m.previousReading} м³</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Газпром */}
            <div className="channel_card">
              <div className="channel_card_top">
                <span className="channel_card_title">
                  🔥 ОсОО «Газпром Кыргызстан» (REST API api.gazprom.kg)
                </span>
                <span className={'channel_status_badge ' + (data.gas?.ok ? 'active' : 'blocked')}>
                  {data.gas?.ok ? '✓ API доступен' : 'Недоступен'}
                </span>
              </div>
              <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#334155' }}>
                Лицевой счёт: <strong>{data.gas?.account}</strong>
              </p>
              <p style={{ margin: '0', fontSize: '11.5px', color: '#64748b' }}>
                {data.gas?.detail}
              </p>
            </div>

            {/* НЭСК */}
            <div className="channel_card">
              <div className="channel_card_top">
                <span className="channel_card_title">
                  ⚡ ОАО «НЭСК» / Бишкекский энергосбыт (Телеметрия АСКУЭ)
                </span>
                <span className="channel_status_badge active">✓ АСКУЭ Активен</span>
              </div>
              <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#334155' }}>
                Лицевой счёт: <strong>{data.electricity?.account}</strong>
              </p>
              <p style={{ margin: '0', fontSize: '11.5px', color: '#64748b' }}>
                {data.electricity?.detail}
              </p>
            </div>
          </div>
        ) : null}

        <div className="modal_actions" style={{ marginTop: '16px' }}>
          <button
            type="button"
            className="secondary_button"
            onClick={onRecheck}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Повторить опрос
          </button>
          <button type="button" className="primary_button" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </Modal>
  );
}

function MydomSettingsModal({
  open,
  settings,
  syncing,
  onClose,
  onChange,
  onSync,
}: {
  open: boolean;
  settings: { account: string; phone: string; token: string; autoSync: boolean };
  syncing: boolean;
  onClose: () => void;
  onChange: (s: { account: string; phone: string; token: string; autoSync: boolean }) => void;
  onSync: () => Promise<void>;
}) {
  const [tokenHelp, setTokenHelp] = useState(false);
  if (!open) return null;

  return (
    <Modal title="Подключение «Мой дом» (mydom.kg)" onClose={onClose}>
      <div className="mydom_modal_content">
        <div className="mydom_brand_header">
          <div className="mydom_badge_icon">
            <Building2 size={24} />
          </div>
          <div>
            <h3>Автоматическое получение квитанций</h3>
            <p>
              Приложение «Мой дом» (kg.mydom.one) формирует единую квитанцию по ТСЖ, лифту,
              «Тазалыку», воде и теплу. Bill-Hub умеет автоматически скачивать и сверять начисления.
            </p>
          </div>
        </div>

        <div className="form_group">
          <label htmlFor="mydom_account">Лицевой счёт абонента / Номер договора</label>
          <input
            id="mydom_account"
            type="text"
            className="input"
            value={settings.account}
            placeholder="Например, 3180429"
            onChange={(e) => onChange({ ...settings, account: e.target.value })}
          />
          <small className="help_text">
            Указан на бумажной квитанции или в приложении «Мой дом» в карточке квартиры.
          </small>
        </div>

        <div className="form_group">
          <label htmlFor="mydom_phone">Номер телефона (привязанный к приложению)</label>
          <input
            id="mydom_phone"
            type="tel"
            className="input"
            value={settings.phone}
            placeholder="+996 700 000 000"
            onChange={(e) => onChange({ ...settings, phone: e.target.value })}
          />
        </div>

        <div className="form_group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label htmlFor="mydom_token">Токен авторизации сессии (опционально)</label>
            <button
              type="button"
              className="text_button"
              style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              onClick={() => setTokenHelp(!tokenHelp)}
            >
              <HelpCircle size={13} /> {tokenHelp ? 'Скрыть подсказку' : 'Как получить токен?'}
            </button>
          </div>
          <input
            id="mydom_token"
            type="password"
            className="input font_mono"
            value={settings.token}
            placeholder="Bearer token или batir_session"
            onChange={(e) => onChange({ ...settings, token: e.target.value })}
          />
          {tokenHelp ? (
            <div className="token_help_callout">
              <Info size={16} />
              <div style={{ fontSize: '0.82rem', lineHeight: '1.4' }}>
                Поскольку приложение «Мой дом» закрыто авторизацией (SMS-коды), для прямой фоновой
                выгрузки из личного кабинета требуется токен. Вы можете скопировать Bearer токен из
                заголовка <code>Authorization</code> в DevTools (сеть) на сайте{' '}
                <code>batir.mydom.kg</code> или в мобильном перехватчике. Без токена система
                использует автоматическую синхронизацию по лицевому счёту и шаблону вашего ТСЖ.
              </div>
            </div>
          ) : (
            <small className="help_text">
              Для прямого API-доступа к личному кабинету жильца batir.mydom.kg
            </small>
          )}
        </div>

        <div className="form_group">
          <label
            className="checkbox_label"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <input
              type="checkbox"
              checked={settings.autoSync}
              onChange={(e) => onChange({ ...settings, autoSync: e.target.checked })}
            />
            <span>Автоматически проверять квитанцию каждого 5-го числа месяца</span>
          </label>
        </div>

        <div className="modal_actions" style={{ marginTop: '20px' }}>
          <button type="button" className="secondary_button" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="primary_button"
            disabled={syncing}
            onClick={onSync}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={15} className={syncing ? 'spin' : ''} />
            {syncing ? 'Синхронизация...' : 'Загрузить квитанцию сейчас'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function InternetSettingsModal({
  open,
  settings,
  period,
  onClose,
  onChange,
  onCreateReceipt,
}: {
  open: boolean;
  settings: {
    providerId: string;
    providerName: string;
    account: string;
    plan: string;
    tariff: string;
    syncWithMydom: boolean;
  };
  period: string;
  onClose: () => void;
  onChange: (s: {
    providerId: string;
    providerName: string;
    account: string;
    plan: string;
    tariff: string;
    syncWithMydom: boolean;
  }) => void;
  onCreateReceipt: () => Promise<void>;
}) {
  const [createdNotice, setCreatedNotice] = useState(false);
  if (!open) return null;

  const currentIsp =
    INTERNET_PROVIDERS.find((p) => p.id === settings.providerId) || INTERNET_PROVIDERS[0];

  return (
    <Modal title="Подключение интернета и ТВ" onClose={onClose}>
      <div className="mydom_modal_content">
        <div
          className="mydom_brand_header"
          style={{ background: '#ecfeff', borderColor: '#a5f3fc' }}
        >
          <div className="mydom_badge_icon" style={{ background: '#0891b2' }}>
            <Wifi size={24} />
          </div>
          <div>
            <h3 style={{ color: '#0e7490' }}>
              {currentIsp.name} {currentIsp.isMydomPartner && '· Официальный партнёр «Мой дом»'}
            </h3>
            <p style={{ color: '#155e75' }}>
              Платформа «Мой дом» интегрирована с Homeline и поддерживает учёт всех провайдеров
              Бишкека. Счета за интернет сохраняются в общий архив и сверяются с расходами квартиры.
            </p>
          </div>
        </div>

        <div className="form_group">
          <label htmlFor="isp_provider_select">Интернет-провайдер в вашем доме</label>
          <select
            id="isp_provider_select"
            className="input"
            value={settings.providerId}
            onChange={(e) => {
              const selected = INTERNET_PROVIDERS.find((p) => p.id === e.target.value);
              if (selected) {
                onChange({
                  ...settings,
                  providerId: selected.id,
                  providerName: selected.name,
                  plan: selected.planName,
                  tariff: selected.defaultTariff,
                });
              }
            }}
          >
            {INTERNET_PROVIDERS.map((isp) => (
              <option key={isp.id} value={isp.id}>
                {isp.name} {isp.isMydomPartner ? '★ (Партнёр Мой дом)' : ''} · от{' '}
                {isp.defaultTariff} с
              </option>
            ))}
          </select>
        </div>

        <div className="form_group">
          <label htmlFor="isp_account">Лицевой счёт / Логин абонента</label>
          <input
            id="isp_account"
            type="text"
            className="input"
            value={settings.account}
            placeholder="Например, HL-84920"
            onChange={(e) => onChange({ ...settings, account: e.target.value })}
          />
          <small className="help_text">
            Указан в договоре на интернет или в чеке оплаты (MegaPay, MBANK, О!Деньги).
          </small>
        </div>

        <div className="form_row_grid">
          <div>
            <label className="form_label" htmlFor="isp_plan">
              Тарифный план
            </label>
            <input
              id="isp_plan"
              className="input"
              value={settings.plan}
              placeholder="Например, Стандарт 100 Мбит/с"
              onChange={(e) => onChange({ ...settings, plan: e.target.value })}
            />
          </div>
          <div>
            <label className="form_label" htmlFor="isp_tariff">
              Абонплата (сом/мес)
            </label>
            <input
              id="isp_tariff"
              className="input"
              value={settings.tariff}
              placeholder="850.00"
              onChange={(e) => onChange({ ...settings, tariff: e.target.value })}
            />
          </div>
        </div>

        <div className="form_group">
          <label
            className="checkbox_label"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <input
              type="checkbox"
              checked={settings.syncWithMydom}
              onChange={(e) => onChange({ ...settings, syncWithMydom: e.target.checked })}
            />
            <span>Учитывать расходы на интернет в квитанциях «Мой дом»</span>
          </label>
        </div>

        <div className="modal_actions" style={{ marginTop: '20px' }}>
          <button type="button" className="secondary_button" onClick={onClose}>
            Закрыть
          </button>
          <button
            type="button"
            className="primary_button"
            style={{ background: '#0891b2', borderColor: '#0891b2' }}
            disabled={createdNotice}
            onClick={async () => {
              setCreatedNotice(true);
              await onCreateReceipt();
              onClose();
            }}
          >
            <Plus size={15} /> Создать квитанцию за {monthLabel(period)}
          </button>
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
    [paymentReceipt, setPaymentReceipt] = useState<Receipt | null>(null),
    [receiptFilter, setReceiptFilter] = useState<'all' | 'unpaid' | 'paid'>('all'),
    [values, setValues] = useState<Record<string, Record<string, string>>>({}),
    [editing, setEditing] = useState<ProviderId | null>(null),
    [demo, setDemo] = useState(false),
    [busy, setBusy] = useState(''),
    [notice, setNotice] = useState(''),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [review, setReview] = useState(false),
    [checked, setChecked] = useState(false),
    [filter, setFilter] = useState('all'),
    [syncingMydom, setSyncingMydom] = useState(false),
    [mydomModalOpen, setMydomModalOpen] = useState(false),
    [mydomSettings, setMydomSettings] = useState({
      account: '4011',
      phone: '',
      token: '',
      autoSync: true,
    }),
    [internetModalOpen, setInternetModalOpen] = useState(false),
    [internetSettings, setInternetSettings] = useState({
      providerId: 'homeline',
      providerName: 'Homeline (Хоумлайн)',
      account: 'HL-84920',
      plan: 'Стандарт (100 Мбит/с)',
      tariff: '850.00',
      syncWithMydom: true,
    }),
    [channelsModalOpen, setChannelsModalOpen] = useState(false),
    [checkingChannels, setCheckingChannels] = useState(false),
    [channelsData, setChannelsData] = useState<any>(null);
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
        title: 'Единая квитанция · Мэрия г. Бишкек',
        account: '4011 (1-310-У111)',
        amount: '716.46',
        paidAmount: '0.00',
        status: 'unpaid',
        dueDate: bishkekPeriod() + '-25',
        paidDate: '',
        fileName: 'Квитанция_2026-11-24 15:09:47.298462.pdf',
        fileData: '',
        notes: 'мкр. Асанбай д. 17 кв. 80. Абонент: Воробьева В.И. Площадь: 34.60 м². Проживающих: 2 чел.',
        items: [
          {
            id: '1',
            name: 'МП «Бишкектеплосеть» — Отопление и ГВС (л/с 1206080-0)',
            amount: '632.00',
            unit: 'мес.',
            volume: '1',
            tariff: '632.00',
          },
          {
            id: '2',
            name: 'МП «Тазалык» — Вывоз ТБО (л/с 9944461-0, 2 чел.)',
            amount: '84.46',
            unit: 'чел.',
            volume: '2',
            tariff: '41.00',
          },
          {
            id: '3',
            name: 'ПЭУ «Бишкекводоканал» — Холодная вода и стоки (л/с 1291067-0)',
            amount: '0.00',
            unit: 'м³',
            volume: '0',
            tariff: '0.00',
          },
          {
            id: '4',
            name: 'ОсОО «Газпром Кыргызстан» — Природный газ (л/с 011701957)',
            amount: '0.00',
            unit: 'м³',
            volume: '0',
            tariff: '0.00',
          },
        ],
      },
      {
        id: 'demo_nesk_1',
        period: bishkekPeriod(),
        category: 'electricity',
        title: 'Счёт за электроэнергию · ОАО «НЭСК»',
        account: '319177353',
        amount: '1095.52',
        paidAmount: '0.00',
        status: 'unpaid',
        dueDate: bishkekPeriod() + '-30',
        paidDate: '',
        fileName: 'Квитанция_2026-11-24 15:09:47.298462.pdf',
        fileData: '',
        notes: 'ОАО «НЭСК» / Бишкекский энергосбыт. мкр. Асанбай д. 17 кв. 80. Показания: 77274 → 77942. Расход: 668 кВт·ч.',
        items: [
          {
            id: 'n1',
            name: 'Электроэнергия ОАО «НЭСК» (показания 77274 → 77942, расход 668 кВт·ч)',
            amount: '1095.52',
            unit: 'кВт·ч',
            volume: '668',
            tariff: '1.64',
          },
        ],
      },
      {
        id: 'demo_homeline_1',
        period: bishkekPeriod(),
        category: 'internet',
        title: 'Интернет Homeline · Стандарт 100 Мбит/с',
        account: 'HL-84920',
        amount: '850.00',
        paidAmount: '0.00',
        status: 'unpaid',
        dueDate: bishkekPeriod() + '-01',
        paidDate: '',
        fileName: 'homeline_receipt.pdf',
        fileData: '',
        notes: 'Официальный интернет-партнёр «Мой дом». Безлимитный GPON интернет.',
        items: [
          {
            id: 'hl1',
            name: 'Абонентская плата (Безлимитный GPON 100 Мбит/с)',
            amount: '850.00',
            unit: 'мес.',
            volume: '1',
            tariff: '850.00',
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
  async function saveReceiptPayment(updated: Receipt) {
    if (demo) {
      setReceipts((rs) => rs.map((x) => (x.id === updated.id ? updated : x)));
      setNotice(
        updated.status === 'paid'
          ? 'Квитанция подтверждена как оплаченная.'
          : updated.status === 'partial'
            ? 'Частичная оплата сохранена.'
            : 'Статус квитанции изменён на: к оплате.',
      );
      return;
    }
    await api('receipts', updated);
    await reload();
    setNotice(
      updated.status === 'paid'
        ? 'Квитанция подтверждена как оплаченная.'
        : updated.status === 'partial'
          ? 'Частичная оплата сохранена.'
          : 'Статус квитанции изменён на: к оплате.',
    );
  }
  async function checkOpenChannels() {
    if (demo) {
      setCheckingChannels(true);
      setTimeout(() => {
        setCheckingChannels(false);
        setChannelsData({
          water: {
            ok: true,
            account: '1291067-0',
            address: 'мкр. Асанбай д. 17 кв. 80',
            meters: [
              { meterId: '1', serialNumber: '922', kind: 'cold', previousReading: '922' },
              { meterId: '2', serialNumber: '5', kind: 'hot', previousReading: '5' },
            ],
            detail: 'Бишкекводоканал: в базе зарегистрировано водомеров: 2 шт. Шлюз активен.',
          },
          gas: {
            ok: true,
            account: '011701957',
            status: 'active',
            detail: 'Официальный публичный REST API Газпром Кыргызстан активен. Шлюз готов к приёму показаний.',
          },
          electricity: {
            ok: true,
            account: '319177353',
            status: 'active',
            detail: 'ОАО «НЭСК» (Бишкекский энергосбыт): умный счётчик АСКУЭ №77274 активен.',
          },
        });
        setChannelsModalOpen(true);
      }, 500);
      return;
    }
    setCheckingChannels(true);
    try {
      const res = await api('providers/check');
      if (res?.ok) {
        setChannelsData(res.channels);
        setChannelsModalOpen(true);
        setNotice('Сверка по открытым каналам поставщиков успешно выполнена.');
      } else {
        setNotice(res?.error || 'Не удалось выполнить сверку каналов.');
      }
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setCheckingChannels(false);
    }
  }

  async function syncAllReceipts() {
    if (demo) {
      setSyncingMydom(true);
      setTimeout(() => {
        setSyncingMydom(false);
        setNotice('Квитанции Мэрии и НЭСК синхронизированы (демо-режим).');
      }, 500);
      return;
    }
    setSyncingMydom(true);
    try {
      const res = await api('receipts/sync', {
        category: 'all',
        account: mydomSettings.account || '4011',
        period,
      });
      if (res?.receipts && res.receipts.length > 0) {
        setReceipts((prev) => {
          const map = new Map(prev.map((r) => [r.id, r]));
          for (const item of res.receipts) {
            map.set(item.id, item);
          }
          return Array.from(map.values());
        });
        setNotice(`Синхронизировано квитанций: ${res.receipts.length} за ${monthLabel(period)} (Мэрия и НЭСК).`);
      } else if (res?.receipt) {
        setReceipts((prev) => [res.receipt, ...prev.filter((r) => r.id !== res.receipt.id)]);
        setNotice(`Квитанция за ${monthLabel(period)} синхронизирована.`);
      }
    } catch (e: unknown) {
      setNotice(e instanceof Error ? e.message : 'Ошибка синхронизации квитанций.');
    } finally {
      setSyncingMydom(false);
    }
  }

  function downloadReceiptDoc(r: Receipt, mode: 'bill' | 'paid') {
    if (mode === 'bill' && r.fileData && r.fileData.startsWith('data:application/pdf')) {
      const link = document.createElement('a');
      link.href = r.fileData;
      link.download = r.fileName || `Schet_na_oplatu_${r.period}_${r.account || '4011'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    const svg = generateReceiptSvg({ receipt: r, mode });
    const link = document.createElement('a');
    link.href = svg;
    const prefix = mode === 'paid' ? 'Oplacheno' : 'Schet_na_oplatu';
    link.download = `${prefix}_${r.period}_${r.account || '4011'}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function printReceiptDoc(r: Receipt, mode: 'bill' | 'paid') {
    const html = generatePrintableReceiptHtml({ receipt: r, mode });
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
    }
  }

  async function syncMydom() {
    if (demo) {
      setSyncingMydom(true);
      setTimeout(() => {
        setSyncingMydom(false);
        setNotice('Квитанция «Мой дом» синхронизирована (демо-режим).');
        if (mydomModalOpen) setMydomModalOpen(false);
      }, 600);
      return;
    }
    if (!authenticated) {
      setNotice('Войдите, чтобы синхронизировать квитанции.');
      return;
    }
    setSyncingMydom(true);
    try {
      const res = await api('receipts/sync', {
        account: mydomSettings.account,
        phone: mydomSettings.phone,
        token: mydomSettings.token,
        period,
      });
      if (res?.receipt) {
        setReceipts((prev) => {
          const others = prev.filter(
            (r) =>
              r.id !== res.receipt.id &&
              !(
                r.period === res.receipt.period &&
                r.category === res.receipt.category &&
                r.account === res.receipt.account
              ),
          );
          return [res.receipt, ...others];
        });
        setNotice(
          `Квитанция «Мой дом» за ${monthLabel(period)} успешно загружена (${res.receipt.amount} сом).`,
        );
        if (mydomModalOpen) setMydomModalOpen(false);
      }
    } catch (e: unknown) {
      setNotice(e instanceof Error ? e.message : 'Ошибка синхронизации с «Мой дом».');
    } finally {
      setSyncingMydom(false);
    }
  }
  async function createInternetReceipt() {
    const r: Receipt = {
      id: `internet_${period}_${internetSettings.providerId}`,
      period,
      category: 'internet',
      title: `Интернет ${internetSettings.providerName} · ${internetSettings.plan}`,
      account: internetSettings.account,
      amount: internetSettings.tariff,
      paidAmount: '0.00',
      status: 'unpaid',
      dueDate: `${period}-01`,
      paidDate: '',
      items: [
        {
          id: 'isp_item_1',
          name: `Абонентская плата ${internetSettings.providerName} (${internetSettings.plan})`,
          amount: internetSettings.tariff,
          unit: 'мес.',
          volume: '1',
          tariff: internetSettings.tariff,
        },
      ],
      fileName: '',
      fileData: '',
      notes: `Провайдер ${internetSettings.providerName}. Абонентский счёт: ${internetSettings.account}. Оплата до 1-го числа месяца.`,
    };
    await saveReceipt(r);
    setNotice(`Квитанция за интернет (${internetSettings.providerName}) добавлена.`);
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
              {n.id === 'connections' && <span className="nav_count">6</span>}
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
                  <div className="receipt_actions_cluster">
                    <button
                      type="button"
                      className="secondary_button sync_mydom_button"
                      disabled={syncingMydom}
                      title="Загрузить начисления и квитанцию из сервиса Мой дом"
                      onClick={syncMydom}
                    >
                      <RefreshCw size={14} className={syncingMydom ? 'spin' : ''} />
                      <span>{syncingMydom ? 'Синхронизация...' : '⚡ Мой дом'}</span>
                    </button>
                    <button className="primary_button" onClick={() => setEditingReceipt('new')}>
                      <Plus size={16} /> Добавить квитанцию
                    </button>
                  </div>
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
                  <button
                    className="secondary_button"
                    onClick={checkOpenChannels}
                    disabled={checkingChannels}
                    title="Опросить открытые шлюзы Бишкекводоканала и Газпрома"
                  >
                    <RefreshCw size={15} className={checkingChannels ? 'spin' : ''} />
                    {checkingChannels ? 'Опрос...' : 'Сверить открытые каналы'}
                  </button>
                  <button
                    className="secondary_button"
                    onClick={syncAllReceipts}
                    disabled={syncingMydom}
                    title="Синхронизировать начисления Мэрии г. Бишкек (4011) и ОАО НЭСК (319177353)"
                  >
                    <Sparkles size={15} className={syncingMydom ? 'spin' : ''} />
                    {syncingMydom ? 'Сбор...' : 'Синхронизировать квитанции'}
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
                              ? '✓ Оплачено'
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
                          <div className={'receipt_card_sum ' + r.status}>
                            <span className="sum_caption">
                              {r.status === 'paid'
                                ? 'Оплачено:'
                                : r.status === 'partial'
                                  ? 'Остаток долга:'
                                  : 'К оплате:'}
                            </span>
                            <div className="sum_val_line">
                              <strong>
                                {r.status === 'paid'
                                  ? r.paidAmount || r.amount
                                  : r.status === 'partial'
                                    ? (Number(r.amount) - Number(r.paidAmount)).toFixed(2)
                                    : r.amount}
                              </strong>
                              <span> сом</span>
                            </div>
                            {r.status === 'partial' && (
                              <small className="partial_detail">
                                из {r.amount} с. (оплачено {r.paidAmount} с.)
                              </small>
                            )}
                          </div>
                          {r.dueDate && r.status !== 'paid' && (
                            <p className="receipt_card_due">
                              <CalendarDays size={13} /> Срок оплаты: до {r.dueDate}
                            </p>
                          )}
                          {r.paidDate && r.status === 'paid' && (
                            <p className="receipt_card_due is_paid_date">
                              <CheckCircle2 size={13} /> Оплачено: {r.paidDate}
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
                            onClick={() => setPaymentReceipt(r)}
                            title={
                              r.status === 'paid'
                                ? 'Квитанция оплачена. Нажмите для просмотра или отмены'
                                : 'Открыть подтверждение оплаты'
                            }
                          >
                            {r.status === 'paid' ? (
                              <>
                                <Check size={14} />
                                <span>Оплачено · Изменить</span>
                              </>
                            ) : (
                              <>
                                <CreditCard size={14} />
                                <span>Отметить оплату...</span>
                              </>
                            )}
                          </button>
                          <div className="receipt_card_actions">
                            <button
                              type="button"
                              className="icon_button"
                              title="Скачать счёт на оплату (приходящая квитанция)"
                              onClick={() => downloadReceiptDoc(r, 'bill')}
                            >
                              <FileText size={16} />
                            </button>
                            {r.status === 'paid' && (
                              <button
                                type="button"
                                className="icon_button"
                                style={{ color: '#16a34a' }}
                                title="Скачать оплаченную квитанцию с фискальным штампом"
                                onClick={() => downloadReceiptDoc(r, 'paid')}
                              >
                                <CheckCircle2 size={16} />
                              </button>
                            )}
                            <button
                              type="button"
                              className="icon_button"
                              title="Распечатать / Сохранить в PDF"
                              onClick={() => printReceiptDoc(r, r.status === 'paid' ? 'paid' : 'bill')}
                            >
                              <Printer size={16} />
                            </button>
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
                  type="button"
                  className="secondary_button"
                  onClick={() => setMydomModalOpen(true)}
                >
                  <Settings2 size={16} /> Настроить синхронизацию
                </button>
              </article>
              <article className="connection_card isp_special">
                <span className="provider_icon" style={{ background: '#ecfeff', color: '#0891b2' }}>
                  <Wifi size={24} />
                </span>
                <div>
                  <div className="connection_title">
                    <h2>Интернет и ТВ (Homeline и др.)</h2>
                    <span className="status_pill available">Партнёр Мой дом</span>
                  </div>
                  <p>
                    Homeline — официальный интернет-партнёр платформы «Мой дом». Также
                    поддерживаются Aknet, Megaline, Saima Telecom, FastNet и Кыргызтелеком. Счета
                    можно вести отдельно или объединять в единую квитанцию квартиры.
                  </p>
                  <small>
                    {internetSettings.account
                      ? `Подключен: ${internetSettings.providerName} · Л/С: ${internetSettings.account} · ${internetSettings.tariff} с/мес`
                      : 'Провайдер ещё не привязан к вашей квартире'}
                  </small>
                  <div className="connection_links">
                    <a
                      href={
                        INTERNET_PROVIDERS.find((p) => p.id === internetSettings.providerId)?.url ||
                        'https://homeline.kg'
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      Сайт провайдера <ArrowUpRight size={14} />
                    </a>
                    <a
                      href={
                        INTERNET_PROVIDERS.find((p) => p.id === internetSettings.providerId)
                          ?.cabinetUrl || 'https://bill.homeline.kg'
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      Личный кабинет <ArrowUpRight size={14} />
                    </a>
                  </div>
                </div>
                <button
                  type="button"
                  className="secondary_button"
                  onClick={() => setInternetModalOpen(true)}
                >
                  <Settings2 size={16} /> Настроить интернет
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
          onManagePayment={() => {
            const target = viewingReceipt;
            setViewingReceipt(null);
            setPaymentReceipt(target);
          }}
          onClose={() => setViewingReceipt(null)}
        />
      )}
      {paymentReceipt && (
        <PaymentConfirmModal
          receipt={paymentReceipt}
          onSave={saveReceiptPayment}
          onClose={() => setPaymentReceipt(null)}
        />
      )}
      <MydomSettingsModal
        open={mydomModalOpen}
        settings={mydomSettings}
        syncing={syncingMydom}
        onClose={() => setMydomModalOpen(false)}
        onChange={setMydomSettings}
        onSync={syncMydom}
      />
      <InternetSettingsModal
        open={internetModalOpen}
        settings={internetSettings}
        period={period}
        onClose={() => setInternetModalOpen(false)}
        onChange={setInternetSettings}
        onCreateReceipt={createInternetReceipt}
      />
      <ChannelsCheckModal
        open={channelsModalOpen}
        loading={checkingChannels}
        data={channelsData}
        onClose={() => setChannelsModalOpen(false)}
        onRecheck={checkOpenChannels}
      />
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
