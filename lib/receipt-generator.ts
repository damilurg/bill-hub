import type { Receipt, ReceiptItem } from './domain.ts';

export type ReceiptSvgParams = {
  receipt: Receipt;
  mode: 'bill' | 'paid';
  address?: string;
  subscriber?: string;
  paymentMethod?: string;
  transactionId?: string;
};

/**
 * Generates an SVG vector graphic representing either:
 * - 'bill': Incoming invoice / bill for payment with ELQR, status UNPAID, itemized breakdown.
 * - 'paid': Official receipt / payment certificate with fiscal stamp «ОПЛАЧЕНО · ТӨЛӨНДҮ», circular seal, transaction ID, 0 debt.
 */
export function generateReceiptSvg(params: ReceiptSvgParams): string {
  const { receipt, mode } = params;
  const isPaid = mode === 'paid';
  const address = params.address || 'мкр. Асанбай д. 17 кв. 80';
  const subscriber = params.subscriber || 'Воробьева В.И.';
  const paymentMethod =
    params.paymentMethod || receipt.paymentMethod || 'MBANK (ОАО КБ Кыргызстан) / ELQR';
  const transactionId =
    params.transactionId ||
    receipt.transactionId ||
    `TXN-${receipt.account || '4011'}-${(receipt.period || '2026-11').replace('-', '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const paidDate =
    receipt.paidDate || new Date().toISOString().slice(0, 10);
  const paidAmount = receipt.paidAmount && Number(receipt.paidAmount) > 0 ? receipt.paidAmount : receipt.amount;

  const [year, month] = (receipt.period || '2026-11').split('-');
  const monthNames = [
    'Январь',
    'Февраль',
    'Март',
    'Апрель',
    'Май',
    'Июнь',
    'Июль',
    'Август',
    'Сентябрь',
    'Октябрь',
    'Ноябрь',
    'Декабрь',
  ];
  const monthName = monthNames[parseInt(month, 10) - 1] || month;
  const periodLabel = `${monthName} ${year} г.`;

  // Color scheme by category
  let gradStart = '#059669';
  let gradEnd = '#10b981';
  let badgeText = 'Единая квитанция · Мэрия г. Бишкек';
  let subText = 'Платформа «Мой дом» (mydom.kg) · Бирдиктүү дүмүрчөк';

  if (receipt.category === 'electricity') {
    gradStart = '#7c3aed';
    gradEnd = '#9333ea';
    badgeText = 'ОАО «НЭСК» · Бишкекский энергосбыт';
    subText = 'Счёт за электроэнергию (Система АСКУЭ)';
  } else if (receipt.category === 'water') {
    gradStart = '#0284c7';
    gradEnd = '#0ea5e9';
    badgeText = 'ПЭУ «Бишкекводоканал»';
    subText = 'Квитанция за холодную воду и водоотведение';
  } else if (receipt.category === 'gas') {
    gradStart = '#d97706';
    gradEnd = '#f59e0b';
    badgeText = 'ОсОО «Газпром Кыргызстан»';
    subText = 'Квитанция за природный газ';
  }

  // Rows of items
  const items: ReceiptItem[] =
    receipt.items && receipt.items.length > 0
      ? receipt.items
      : [{ id: '1', name: receipt.title, amount: receipt.amount, volume: '1', unit: 'усл.' }];

  const rowsSvg = items
    .slice(0, 7)
    .map((item, idx) => {
      const y = 205 + idx * 24;
      const bg = idx % 2 === 0 ? 'fill="#f8fafc"' : 'fill="#ffffff"';
      return `
        <rect x="24" y="${y - 16}" width="712" height="22" ${bg} rx="3" />
        <text x="32" y="${y}" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="#1e293b">${idx + 1}. ${escapeXml(item.name.slice(0, 52))}</text>
        <text x="460" y="${y}" font-family="monospace, monospace" font-size="10.5" fill="#64748b" text-anchor="middle">${item.volume || '1'} ${item.unit || 'усл.'}</text>
        <text x="570" y="${y}" font-family="monospace, monospace" font-size="10.5" fill="#64748b" text-anchor="end">${item.tariff || item.amount} с.</text>
        <text x="720" y="${y}" font-family="monospace, monospace" font-size="11.5" font-weight="700" fill="#0f172a" text-anchor="end">${item.amount} с.</text>
      `;
    })
    .join('');

  // Mode-dependent bottom blocks
  const bottomSection = isPaid
    ? `
      <!-- PAID FISCAL STAMP BOX -->
      <g transform="translate(24, 400)">
        <!-- Stamp container -->
        <rect x="0" y="0" width="460" height="150" rx="10" fill="#f0fdf4" stroke="#16a34a" stroke-width="2" stroke-dasharray="8 4" />
        <rect x="4" y="4" width="452" height="142" rx="8" fill="none" stroke="#22c55e" stroke-width="1" />

        <!-- Stamp Header -->
        <text x="24" y="32" font-family="system-ui, sans-serif" font-weight="900" font-size="18" fill="#15803d" letter-spacing="2">★ ОПЛАЧЕНО · ТӨЛӨНДҮ ★</text>
        <text x="340" y="30" font-family="monospace" font-size="11" font-weight="700" fill="#166534">100% ОПЛАТА</text>

        <!-- Stamp details -->
        <text x="24" y="58" font-family="system-ui, sans-serif" font-size="11" fill="#334155">Дата и время оплаты: <tspan font-weight="700" fill="#0f172a">${paidDate} 15:40:00</tspan></text>
        <text x="24" y="78" font-family="system-ui, sans-serif" font-size="11" fill="#334155">Сумма платежа: <tspan font-weight="800" font-size="12" fill="#15803d">${paidAmount} сом</tspan></text>
        <text x="24" y="98" font-family="system-ui, sans-serif" font-size="11" fill="#334155">Шлюз / Банк: <tspan font-weight="600" fill="#0f172a">${escapeXml(paymentMethod)}</tspan></text>
        <text x="24" y="118" font-family="monospace" font-size="10.5" fill="#475569">Чек/Транзакция: <tspan font-weight="700" fill="#0f172a">${escapeXml(transactionId)}</tspan></text>
        <text x="24" y="136" font-family="system-ui, sans-serif" font-size="10" fill="#16a34a">✓ Электронная квитанция заверена. Задолженность отсутствует.</text>

        <!-- Circular Stamp Seal Simulation -->
        <g transform="translate(390, 75)">
          <circle cx="0" cy="0" r="42" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-dasharray="3 2" opacity="0.85" />
          <circle cx="0" cy="0" r="36" fill="none" stroke="#15803d" stroke-width="1.2" opacity="0.8" />
          <path id="circleTextPath" d="M -28,0 A 28,28 0 1,1 28,0" fill="none" />
          <text font-family="system-ui, sans-serif" font-size="6" font-weight="700" fill="#15803d" text-anchor="middle">
            <textPath href="#circleTextPath" startOffset="50%">БИШКЕК ШААРЫНЫН МЭРИЯСЫ</textPath>
          </text>
          <text x="0" y="2" font-family="system-ui, sans-serif" font-size="9" font-weight="900" fill="#166534" text-anchor="middle">ТӨЛӨНДҮ</text>
          <text x="0" y="13" font-family="system-ui, sans-serif" font-size="7" font-weight="700" fill="#166534" text-anchor="middle">ОПЛАЧЕНО</text>
          <text x="0" y="24" font-family="monospace" font-size="6" fill="#15803d" text-anchor="middle">${paidDate}</text>
        </g>
      </g>

      <!-- Paid Total box -->
      <g transform="translate(500, 400)">
        <rect x="0" y="0" width="236" height="150" rx="10" fill="#ecfdf5" stroke="#10b981" stroke-width="2" />
        <text x="118" y="32" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#065f46" text-anchor="middle">ИТОГО ОПЛАЧЕНО</text>
        <text x="118" y="70" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="#047857" text-anchor="middle">${paidAmount} с.</text>
        <line x1="20" y1="88" x2="216" y2="88" stroke="#a7f3d0" stroke-width="1.5" />
        <text x="118" y="110" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="#047857" text-anchor="middle">Остаток долга: 0.00 сом</text>
        <text x="118" y="130" font-family="system-ui, sans-serif" font-size="9.5" fill="#059669" text-anchor="middle">Платёжный документ действителен</text>
      </g>
    `
    : `
      <!-- BILL UNPAID / ELQR PAYMENT SECTION -->
      <g transform="translate(24, 400)">
        <!-- ELQR Container -->
        <rect x="0" y="0" width="460" height="150" rx="10" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" />

        <!-- Simulated Vector QR -->
        <g transform="translate(20, 20)">
          <rect x="0" y="0" width="110" height="110" rx="6" fill="#ffffff" stroke="#94a3b8" />
          <!-- QR markers -->
          <rect x="10" y="10" width="28" height="28" fill="#0f172a" rx="3" />
          <rect x="15" y="15" width="18" height="18" fill="#ffffff" />
          <rect x="20" y="20" width="8" height="8" fill="#0f172a" />

          <rect x="72" y="10" width="28" height="28" fill="#0f172a" rx="3" />
          <rect x="77" y="15" width="18" height="18" fill="#ffffff" />
          <rect x="82" y="20" width="8" height="8" fill="#0f172a" />

          <rect x="10" y="72" width="28" height="28" fill="#0f172a" rx="3" />
          <rect x="15" y="77" width="18" height="18" fill="#ffffff" />
          <rect x="20" y="82" width="8" height="8" fill="#0f172a" />

          <rect x="46" y="20" width="16" height="16" fill="#059669" rx="2" />
          <rect x="46" y="46" width="18" height="18" fill="#0f172a" rx="2" />
          <rect x="72" y="52" width="14" height="14" fill="#0f172a" rx="2" />
          <rect x="46" y="74" width="16" height="24" fill="#0f172a" rx="2" />
          <rect x="74" y="74" width="24" height="16" fill="#059669" rx="2" />
        </g>

        <!-- ELQR Text -->
        <text x="150" y="38" font-family="system-ui, sans-serif" font-weight="800" font-size="16" fill="#059669">Единый ELQR Кыргызстана</text>
        <text x="150" y="58" font-family="system-ui, sans-serif" font-size="11" fill="#475569">Сканируйте приложением любого банка:</text>
        <text x="150" y="76" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="#0f172a">MBANK, Элдик Банк, MegaPay, О!Деньги, Optima</text>
        <line x1="150" y1="88" x2="440" y2="88" stroke="#e2e8f0" stroke-width="1" />
        <text x="150" y="106" font-family="monospace" font-size="11" fill="#64748b">Код плательщика: <tspan font-weight="700" fill="#0f172a">${receipt.account || '4011'}</tspan></text>
        <text x="150" y="124" font-family="system-ui, sans-serif" font-size="10.5" fill="#e11d48">Срок оплаты: до ${receipt.dueDate || `${receipt.period}-25`}</text>
      </g>

      <!-- Bill Total box -->
      <g transform="translate(500, 400)">
        <rect x="0" y="0" width="236" height="150" rx="10" fill="#fff1f2" stroke="#f43f5e" stroke-width="2" />
        <text x="118" y="32" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#9f1239" text-anchor="middle">ИТОГО К ОПЛАТЕ</text>
        <text x="118" y="72" font-family="system-ui, sans-serif" font-weight="900" font-size="28" fill="#be123c" text-anchor="middle">${receipt.amount} с.</text>
        <line x1="20" y1="88" x2="216" y2="88" stroke="#fecdd3" stroke-width="1.5" />
        <text x="118" y="110" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="#e11d48" text-anchor="middle">Статус: К ОПЛАТЕ</text>
        <text x="118" y="130" font-family="system-ui, sans-serif" font-size="9.5" fill="#9f1239" text-anchor="middle">Оплатите во избежание пени</text>
      </g>
    `;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 580" width="100%" height="100%">
    <defs>
      <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${gradStart}" />
        <stop offset="100%" stop-color="${gradEnd}" />
      </linearGradient>
      <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.08"/>
      </filter>
    </defs>

    <!-- Background card -->
    <rect x="10" y="10" width="740" height="560" rx="14" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" filter="url(#shadow)" />

    <!-- Header bar -->
    <rect x="10" y="10" width="740" height="74" rx="14" fill="url(#headerGrad)" />
    <rect x="10" y="60" width="740" height="24" fill="url(#headerGrad)" />

    <!-- Logo / Brand Icon -->
    <circle cx="50" cy="48" r="22" fill="#ffffff" />
    <text x="50" y="55" font-family="system-ui, sans-serif" font-weight="900" font-size="19" fill="${gradStart}" text-anchor="middle">${receipt.category === 'electricity' ? '⚡' : 'M'}</text>
    <text x="84" y="44" font-family="system-ui, sans-serif" font-weight="700" font-size="17" fill="#ffffff">${escapeXml(badgeText)}</text>
    <text x="84" y="63" font-family="system-ui, sans-serif" font-size="12" fill="#e0f2fe">${escapeXml(subText)}</text>

    <!-- Period & Document Type badge -->
    <rect x="540" y="22" width="194" height="50" rx="8" fill="#ffffff" fill-opacity="0.2" stroke="#ffffff" stroke-opacity="0.35" />
    <text x="637" y="38" font-family="system-ui, sans-serif" font-size="9.5" font-weight="600" fill="#ffffff" text-anchor="middle">${isPaid ? 'ОФИЦИАЛЬНАЯ КВИТАНЦИЯ' : 'ПЛАТЁЖНЫЙ ДОКУМЕНТ'}</text>
    <text x="637" y="58" font-family="system-ui, sans-serif" font-weight="800" font-size="14" fill="#ffffff" text-anchor="middle">${periodLabel}</text>

    <!-- Meta Info Box -->
    <rect x="24" y="96" width="712" height="60" rx="8" fill="#f8fafc" stroke="#e2e8f0" />
    <text x="40" y="118" font-family="system-ui, sans-serif" font-size="11" fill="#64748b">Лицевой счёт / Код: <tspan font-weight="700" fill="#0f172a">${escapeXml(receipt.account || '4011')}</tspan></text>
    <text x="360" y="118" font-family="system-ui, sans-serif" font-size="11" fill="#64748b">Абонент: <tspan font-weight="600" fill="#0f172a">${escapeXml(subscriber)}</tspan></text>
    <text x="40" y="140" font-family="system-ui, sans-serif" font-size="11" fill="#64748b">Адрес: <tspan font-weight="600" fill="#0f172a">${escapeXml(address)}</tspan></text>
    <text x="360" y="140" font-family="system-ui, sans-serif" font-size="11" fill="#64748b">Площадь / Проживающих: <tspan font-weight="600" fill="#0f172a">34.60 м² · 2 чел.</tspan></text>

    <!-- Table Header -->
    <rect x="24" y="166" width="712" height="24" rx="4" fill="#f1f5f9" />
    <text x="32" y="182" font-family="system-ui, sans-serif" font-weight="700" font-size="10" fill="#475569">ВИД УСЛУГИ / ПОСТАВЩИК</text>
    <text x="460" y="182" font-family="system-ui, sans-serif" font-weight="700" font-size="10" fill="#475569" text-anchor="middle">ОБЪЁМ</text>
    <text x="570" y="182" font-family="system-ui, sans-serif" font-weight="700" font-size="10" fill="#475569" text-anchor="end">ТАРИФ</text>
    <text x="720" y="182" font-family="system-ui, sans-serif" font-weight="700" font-size="10" fill="#475569" text-anchor="end">СУММА</text>

    <!-- Table Rows -->
    ${rowsSvg}

    <!-- Bottom Section (Paid stamp vs Bill ELQR) -->
    ${bottomSection}
  </svg>`;

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function escapeXml(unsafe: string): string {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates an A4-optimized printable HTML document that can be opened in a new tab or iframe
 * and directly triggered via window.print() to save as a PDF.
 */
export function generatePrintableReceiptHtml(params: ReceiptSvgParams): string {
  const { receipt, mode } = params;
  const isPaid = mode === 'paid';
  const address = params.address || 'мкр. Асанбай д. 17 кв. 80';
  const subscriber = params.subscriber || 'Воробьева В.И.';
  const paymentMethod =
    params.paymentMethod || receipt.paymentMethod || 'MBANK (ОАО КБ Кыргызстан) / ELQR';
  const transactionId =
    params.transactionId ||
    receipt.transactionId ||
    `TXN-${receipt.account || '4011'}-${(receipt.period || '2026-11').replace('-', '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const paidDate =
    receipt.paidDate || new Date().toISOString().slice(0, 10);
  const paidAmount = receipt.paidAmount && Number(receipt.paidAmount) > 0 ? receipt.paidAmount : receipt.amount;

  const [year, month] = (receipt.period || '2026-11').split('-');
  const monthNames = [
    'Январь',
    'Февраль',
    'Март',
    'Апрель',
    'Май',
    'Июнь',
    'Июль',
    'Август',
    'Сентябрь',
    'Октябрь',
    'Ноябрь',
    'Декабрь',
  ];
  const monthName = monthNames[parseInt(month, 10) - 1] || month;
  const periodLabel = `${monthName} ${year} г.`;

  const items =
    receipt.items && receipt.items.length > 0
      ? receipt.items
      : [{ id: '1', name: receipt.title, amount: receipt.amount, volume: '1', unit: 'усл.' }];

  const rowsHtml = items
    .map(
      (it, idx) => `
      <tr>
        <td>${idx + 1}. ${escapeXml(it.name)}</td>
        <td style="text-align: center;">${escapeXml(it.volume || '1')} ${escapeXml(it.unit || '')}</td>
        <td style="text-align: right;">${escapeXml(it.tariff || it.amount)} сом</td>
        <td style="text-align: right; font-weight: bold;">${escapeXml(it.amount)} сом</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>${isPaid ? 'Квитанция об оплате' : 'Счёт на оплату'} — ${escapeXml(receipt.title)} (${escapeXml(receipt.period)})</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 20px;
      line-height: 1.4;
    }
    .sheet {
      max-width: 800px;
      margin: 0 auto;
      border: 1px solid #e2e8f0;
      padding: 24px;
      border-radius: 8px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #059669;
      padding-bottom: 14px;
      margin-bottom: 16px;
    }
    .title_main {
      font-size: 20px;
      font-weight: 800;
      color: #059669;
      margin: 0 0 4px 0;
    }
    .title_sub {
      font-size: 13px;
      color: #64748b;
      margin: 0;
    }
    .badge_period {
      text-align: right;
    }
    .badge_period h3 {
      margin: 0;
      font-size: 16px;
      color: #0f172a;
    }
    .badge_period span {
      font-size: 11px;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 600;
    }
    .meta_grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
      background: #f8fafc;
      padding: 12px 16px;
      border-radius: 6px;
      margin-bottom: 16px;
      font-size: 13px;
    }
    .meta_grid strong {
      color: #0f172a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 13px;
    }
    th {
      background: #f1f5f9;
      text-align: left;
      padding: 8px 10px;
      font-size: 11px;
      text-transform: uppercase;
      color: #475569;
      border-bottom: 1px solid #cbd5e1;
    }
    td {
      padding: 8px 10px;
      border-bottom: 1px solid #e2e8f0;
    }
    tr:nth-child(even) td {
      background: #fcfdfe;
    }
    .stamp_box {
      border: 2px dashed #16a34a;
      background: #f0fdf4;
      padding: 14px 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      position: relative;
    }
    .stamp_title {
      font-size: 18px;
      font-weight: 900;
      color: #15803d;
      margin: 0 0 8px 0;
      letter-spacing: 1px;
    }
    .stamp_grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 16px;
      font-size: 12.5px;
    }
    .total_box {
      background: #ecfdf5;
      border: 1px solid #10b981;
      padding: 16px 20px;
      border-radius: 8px;
      text-align: right;
    }
    .total_box.unpaid {
      background: #fff1f2;
      border-color: #f43f5e;
    }
    .total_title {
      font-size: 12px;
      text-transform: uppercase;
      font-weight: 700;
      color: #065f46;
      margin: 0;
    }
    .total_box.unpaid .total_title {
      color: #9f1239;
    }
    .total_amount {
      font-size: 26px;
      font-weight: 900;
      color: #047857;
      margin: 4px 0 0 0;
    }
    .total_box.unpaid .total_amount {
      color: #be123c;
    }
    .footer_note {
      margin-top: 24px;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
      border-top: 1px solid #f1f5f9;
      padding-top: 12px;
    }
    @media print {
      body { padding: 0; }
      .sheet { border: none; padding: 0; max-width: 100%; }
      .no-print { display: none !important; }
    }
    .print_btn_bar {
      margin-bottom: 16px;
      text-align: right;
    }
    .print_btn {
      background: #059669;
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="print_btn_bar no-print">
    <button class="print_btn" onclick="window.print()">Распечатать / Сохранить в PDF</button>
  </div>
  <div class="sheet">
    <div class="header">
      <div>
        <h1 class="title_main">${isPaid ? 'Официальная квитанция об оплате' : 'Счёт на оплату (Квитанция)'}</h1>
        <p class="title_sub">${escapeXml(receipt.title)} · Платформа ЖКХ г. Бишкек</p>
      </div>
      <div class="badge_period">
        <span>Расчётный месяц</span>
        <h3>${periodLabel}</h3>
      </div>
    </div>

    <div class="meta_grid">
      <div>Лицевой счёт: <strong>${escapeXml(receipt.account || '4011')}</strong></div>
      <div>Абонент: <strong>${escapeXml(subscriber)}</strong></div>
      <div>Адрес: <strong>${escapeXml(address)}</strong></div>
      <div>Параметры: <strong>34.60 м² · 2 проживающих</strong></div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Вид услуги / Поставщик</th>
          <th style="text-align: center;">Объём</th>
          <th style="text-align: right;">Тариф</th>
          <th style="text-align: right;">Сумма</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    ${
      isPaid
        ? `
      <div class="stamp_box">
        <div class="stamp_title">★ ОПЛАЧЕНО · ТӨЛӨНДҮ ★</div>
        <div class="stamp_grid">
          <div>Дата платежа: <strong>${paidDate} 15:40</strong></div>
          <div>Сумма платежа: <strong style="color: #15803d;">${paidAmount} сом</strong></div>
          <div>Способ оплаты: <strong>${escapeXml(paymentMethod)}</strong></div>
          <div>Транзакция/Чек: <strong>${escapeXml(transactionId)}</strong></div>
        </div>
        <p style="margin: 8px 0 0 0; font-size: 11.5px; color: #166534;">
          ✓ Платёж подтверждён банком. Задолженность полностью погашена. Электронный чек имеет юридическую силу.
        </p>
      </div>
      <div class="total_box">
        <div class="total_title">Оплачено полностью</div>
        <div class="total_amount">${paidAmount} сом</div>
        <div style="font-size: 12px; color: #059669; margin-top: 4px;">Остаток задолженности: 0.00 сом</div>
      </div>
    `
        : `
      <div class="total_box unpaid">
        <div class="total_title">Итого к оплате (до ${receipt.dueDate || `${receipt.period}-25`})</div>
        <div class="total_amount">${receipt.amount} сом</div>
        <div style="font-size: 12px; color: #e11d48; margin-top: 4px;">
          Оплата через ELQR, MBANK, Элдик Банк, MegaPay, О!Деньги по коду плательщика ${escapeXml(receipt.account || '4011')}
        </div>
      </div>
    `
    }

    <div class="footer_note">
      Документ сформирован системой Bill-Hub · г. Бишкек · Официальный шлюз муниципальных коммунальных начислений
    </div>
  </div>
</body>
</html>`;
}
