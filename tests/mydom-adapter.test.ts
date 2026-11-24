import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateMydomReceiptSvg,
  createDefaultMydomItems,
  syncMydomReceipt,
} from '../lib/mydom-adapter.ts';

test('createDefaultMydomItems returns standard Bishkek municipal breakdown', () => {
  const items = createDefaultMydomItems('2026-11');
  assert.ok(items.length >= 5);
  const names = items.map((i) => i.name);
  assert.ok(names.some((n) => n.includes('ТСЖ')));
  assert.ok(names.some((n) => n.includes('лифт')));
  assert.ok(names.some((n) => n.includes('Тазалык')));
  assert.ok(names.some((n) => n.includes('Бишкекводоканал')));
  assert.ok(names.some((n) => n.includes('Homeline')));
});

test('generateMydomReceiptSvg outputs valid data URI with ELQR and amounts', () => {
  const items = createDefaultMydomItems('2026-11');
  const uri = generateMydomReceiptSvg({
    title: 'Единая квитанция · Мой дом',
    account: '3180429',
    period: '2026-11',
    amount: '2985.60',
    items,
  });

  assert.ok(uri.startsWith('data:image/svg+xml;utf8,'));
  assert.ok(decodeURIComponent(uri).includes('Мой дом'));
  assert.ok(decodeURIComponent(uri).includes('3180429'));
  assert.ok(decodeURIComponent(uri).includes('ELQR'));
});

test('syncMydomReceipt returns validated receipt structure without token', async () => {
  const res = await syncMydomReceipt({
    account: '3180429',
    period: '2026-11',
  });

  assert.equal(res.ok, true);
  assert.equal(res.receipt.category, 'mydom');
  assert.equal(res.receipt.period, '2026-11');
  assert.equal(res.receipt.status, 'unpaid');
  assert.ok(res.receipt.items.length >= 5);
  assert.ok(parseFloat(res.receipt.amount) > 0);
  assert.ok(res.receipt.fileData.startsWith('data:image/svg+xml'));
});

test('syncMydomReceipt handles live mock response when token is supplied', async () => {
  const mockFetcher = async () =>
    new Response(
      JSON.stringify({
        total: '3500.00',
        items: [
          { id: '1', name: 'ТСЖ Южные Ворота', amount: '2000.00' },
          { id: '2', name: 'Отопление и горячая вода', amount: '1500.00' },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );

  const res = await syncMydomReceipt(
    {
      account: '3180429',
      period: '2026-11',
      token: 'valid-test-bearer-token-12345',
    },
    mockFetcher,
  );

  assert.equal(res.ok, true);
  assert.equal(res.source, 'api');
  assert.equal(res.receipt.amount, '3500.00');
  assert.equal(res.receipt.items.length, 2);
  assert.equal(res.receipt.items[0].name, 'ТСЖ Южные Ворота');
});
