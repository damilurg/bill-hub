import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateReceiptSvg,
  generatePrintableReceiptHtml,
} from '../lib/receipt-generator.ts';
import { checkWaterMeters } from '../lib/water-adapter.ts';
import { checkGasStatus } from '../lib/gas-adapter.ts';
import type { Receipt } from '../lib/domain.ts';

const sampleReceipt: Receipt = {
  id: 'rec-test-1',
  category: 'mydom',
  title: 'Единая квитанция · Мэрия г. Бишкек',
  period: '2026-11',
  amount: '716.46',
  dueDate: '2026-11-25',
  status: 'unpaid',
  account: '4011',
  paidAmount: '0.00',
  paidDate: '',
  fileName: '',
  fileData: '',
  notes: '',
  items: [
    { id: '1', name: 'Бишкектеплосеть (отопление и ГВС)', amount: '350.00', tariff: '1248.00', volume: '0.28', unit: 'Гкал' },
    { id: '2', name: 'МП «Тазалык» (вывоз мусора)', amount: '185.00', tariff: '92.50', volume: '2', unit: 'чел.' },
    { id: '3', name: 'ПЭУ «Бишкекводоканал»', amount: '181.46', tariff: '10.45', volume: '17.36', unit: 'м³' },
  ],
};

const samplePaidReceipt: Receipt = {
  ...sampleReceipt,
  status: 'paid',
  paidAmount: '716.46',
  paidDate: '2026-11-20',
  paymentMethod: 'MBANK (ОАО КБ Кыргызстан) / ELQR',
  transactionId: 'TXN-4011-202611-8842',
};

test('generateReceiptSvg in bill mode generates vector SVG with ELQR and unpaid status', () => {
  const uri = generateReceiptSvg({
    receipt: sampleReceipt,
    mode: 'bill',
    address: 'мкр. Асанбай д. 17 кв. 80',
    subscriber: 'Воробьева В.И.',
  });

  assert.ok(uri.startsWith('data:image/svg+xml;utf8,'));
  const svg = decodeURIComponent(uri);
  assert.ok(svg.includes('4011'));
  assert.ok(svg.includes('716.46'));
  assert.ok(svg.includes('Воробьева В.И.'));
  assert.ok(svg.includes('мкр. Асанбай д. 17 кв. 80'));
  assert.ok(svg.includes('ELQR'));
  assert.ok(svg.includes('К ОПЛАТЕ'));
  assert.ok(svg.includes('Бишкектеплосеть'));
  assert.ok(svg.includes('Тазалык'));
  assert.ok(svg.includes('Бишкекводоканал'));
});

test('generateReceiptSvg in paid mode generates official receipt with fiscal stamp and seal', () => {
  const uri = generateReceiptSvg({
    receipt: samplePaidReceipt,
    mode: 'paid',
    address: 'мкр. Асанбай д. 17 кв. 80',
    subscriber: 'Воробьева В.И.',
    paymentMethod: 'MBANK (ОАО КБ Кыргызстан) / ELQR',
    transactionId: 'TXN-4011-202611-8842',
  });

  assert.ok(uri.startsWith('data:image/svg+xml;utf8,'));
  const svg = decodeURIComponent(uri);
  assert.ok(svg.includes('ОПЛАЧЕНО · ТӨЛӨНДҮ'));
  assert.ok(svg.includes('БИШКЕК ШААРЫНЫН МЭРИЯСЫ'));
  assert.ok(svg.includes('TXN-4011-202611-8842'));
  assert.ok(svg.includes('MBANK'));
  assert.ok(svg.includes('716.46 с.'));
  assert.ok(svg.includes('0.00 с.'));
});

test('generatePrintableReceiptHtml outputs clean A4 printable document', () => {
  const billHtml = generatePrintableReceiptHtml({
    receipt: sampleReceipt,
    mode: 'bill',
  });
  assert.ok(billHtml.includes('<!DOCTYPE html>'));
  assert.ok(billHtml.includes('size: A4 portrait'));
  assert.ok(billHtml.includes('Счёт на оплату (Квитанция)'));
  assert.ok(billHtml.includes('window.print()'));
  assert.ok(billHtml.includes('716.46 сом'));

  const paidHtml = generatePrintableReceiptHtml({
    receipt: samplePaidReceipt,
    mode: 'paid',
  });
  assert.ok(paidHtml.includes('<!DOCTYPE html>'));
  assert.ok(paidHtml.includes('Официальная квитанция об оплате'));
  assert.ok(paidHtml.includes('★ ОПЛАЧЕНО · ТӨЛӨНДҮ ★'));
  assert.ok(paidHtml.includes('TXN-4011-202611-8842'));
  assert.ok(paidHtml.includes('MBANK'));
});

test('checkWaterMeters queries voda.link.kg and returns registered meters', async () => {
  const mockFetcher = async (url: string, init?: RequestInit): Promise<Response> => {
    if (url.includes('/send/') && init?.body && typeof init.body === 'string') {
      const parsed = JSON.parse(init.body);
      if (parsed.mode === 'login') {
        return new Response(JSON.stringify([1, 'sess_abc123']), { status: 200 });
      }
      if (parsed.mode === 'loadForm') {
        return new Response(
          JSON.stringify({
            waterMeters: [
              {
                HYDID: '101',
                HYDNUM: '1206080-0',
                HG: 'H',
                POKAZAN: '315',
                ADDRESS: 'мкр. Асанбай д. 17 кв. 80',
                BRANCHID: '1',
                CLIENTID: '1291067',
                VODPP: '0',
              },
              {
                HYDID: '102',
                HYDNUM: '1206080-1',
                HG: 'G',
                POKAZAN: '180',
                ADDRESS: 'мкр. Асанбай д. 17 кв. 80',
                BRANCHID: '1',
                CLIENTID: '1291067',
                VODPP: '0',
              },
            ],
          }),
          { status: 200 },
        );
      }
    }
    return new Response('Not found', { status: 404 });
  };

  const result = await checkWaterMeters('1291067-0', mockFetcher);
  assert.equal(result.ok, true);
  assert.equal(result.account, '1291067-0');
  assert.equal(result.meters.length, 2);
  assert.equal(result.meters[0].serialNumber, '1206080-0');
  assert.equal(result.meters[0].kind, 'cold');
  assert.equal(result.meters[0].previousReading, '315');
  assert.equal(result.meters[1].serialNumber, '1206080-1');
  assert.equal(result.meters[1].kind, 'hot');
  assert.equal(result.address, 'мкр. Асанбай д. 17 кв. 80');
});

test('checkWaterMeters handles server unreachable or invalid login', async () => {
  const failFetcher = async (): Promise<Response> => {
    throw new Error('Connection refused');
  };
  const resFail = await checkWaterMeters('1291067-0', failFetcher);
  assert.equal(resFail.ok, false);
  assert.equal(resFail.meters.length, 0);

  const notFoundFetcher = async (): Promise<Response> => {
    return new Response(JSON.stringify([0, 'not_found']), { status: 200 });
  };
  const resNotFound = await checkWaterMeters('0000000-0', notFoundFetcher);
  assert.equal(resNotFound.ok, false);
  assert.ok(resNotFound.detail.includes('не найден'));
});

test('checkGasStatus validates account format and queries Gazprom client bootstrap', async () => {
  // Invalid account
  const invalidRes = await checkGasStatus('123');
  assert.equal(invalidRes.ok, false);
  assert.equal(invalidRes.status, 'blocked');

  // Valid account with mock bootstrap
  const mockFetcher = async (url: string): Promise<Response> => {
    if (url.includes('gazprom.kg/assets/')) {
      return new Response('set("api-token","public_client_key_gazprom_99")', {
        status: 200,
      });
    }
    if (url.includes('gazprom.kg')) {
      return new Response(
        `<html><body><script type="module" src="/assets/index-sample.js"></script></body></html>`,
        { status: 200 },
      );
    }
    return new Response('Not found', { status: 404 });
  };

  const validRes = await checkGasStatus('011701957', mockFetcher);
  assert.equal(validRes.ok, true);
  assert.equal(validRes.status, 'active');
  assert.ok(validRes.detail.includes('активен'));
});
