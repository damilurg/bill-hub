import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sendGas,
  gasPayload,
  gasReceipt,
  extractPublicClientKey,
  extractPublicScript,
  GAS_ENDPOINT,
  type Fetcher,
} from '../lib/gas-adapter.ts';
import {
  waterPayload,
  waterReceipt,
  sendWater,
  matchWaterValues,
  type WaterMeter,
} from '../lib/water-adapter.ts';
import { sendHeat, extractCsrf } from '../lib/heat-adapter.ts';

const good = { consumption: 5, payAmount: 100, tariff: 20 };
function mock(response: () => Promise<Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher: Fetcher = async (url, init) => {
    calls.push({ url, init });
    if (calls.length === 1)
      return new Response('<script type="module" src="/assets/index-example.js"></script>');
    if (calls.length === 2) return new Response('set("api-token","public-test-key")');
    return response();
  };
  return { calls, fetcher };
}
test('gas serial remains a string; payload matches actual form', () =>
  assert.deepEqual(gasPayload('000000001', '123'), { account: '000000001', reading: 123 }));
test('gas rejects fractional/zero/out-of-range inputs before network', async () => {
  let calls = 0;
  await assert.rejects(
    sendGas('000000001', '3.2', async () => {
      calls++;
      return new Response();
    }),
  );
  assert.equal(calls, 0);
});
test('bootstrap only accepts observed same-origin script shape', () => {
  assert.equal(
    extractPublicScript('<script src="/assets/index-Ab1.js"></script>'),
    'https://www.gazprom.kg/assets/index-Ab1.js',
  );
  assert.throws(() => extractPublicScript('<script src="https://evil.test/key.js"></script>'));
  assert.throws(() => extractPublicScript('<script src="/assets/../../private.js"></script>'));
  assert.throws(() => extractPublicClientKey('unrecognized'));
});
test('sends correct endpoint, anonymous headers and one write', async () => {
  const { calls, fetcher } = mock(async () => Response.json(good));
  const r = await sendGas('000000001', '123', fetcher);
  assert.equal(r.status, 'confirmed');
  assert.equal(calls.length, 3);
  assert.equal(calls[2].url, GAS_ENDPOINT);
  assert.deepEqual(JSON.parse(String(calls[2].init?.body)), { account: '000000001', reading: 123 });
  assert.equal((calls[2].init?.headers as Record<string, string>)['auth-token'], undefined);
  assert.equal(calls[2].init?.redirect, 'error');
});
test('does not post when public client bootstrap fails', async () => {
  let n = 0;
  const r = await sendGas('000000001', '123', async () => {
    n++;
    return new Response('unavailable', { status: 503 });
  });
  assert.equal(r.status, 'blocked');
  assert.equal(n, 1);
});
test('409 is a rejection; no automatic recalculation', async () => {
  const { calls, fetcher } = mock(async () => Response.json({ message: 'low' }, { status: 409 }));
  assert.equal((await sendGas('000000001', '123', fetcher)).status, 'rejected');
  assert.equal(calls.length, 3);
});
test('timeout after write stays unknown and is never retried', async () => {
  const { calls, fetcher } = mock(async () => {
    throw new Error('timeout');
  });
  assert.equal((await sendGas('000000001', '123', fetcher)).status, 'unknown');
  assert.equal(calls.length, 3);
});
test('HTTP 500 and HTML with HTTP 200 never count as accepted', async () => {
  for (const response of [
    () => Promise.resolve(new Response('error', { status: 500 })),
    () => Promise.resolve(new Response('<html>login</html>')),
  ]) {
    const { fetcher } = mock(response);
    assert.equal((await sendGas('000000001', '123', fetcher)).status, 'unknown');
  }
});
test('receipt requires provider calculation fields with actual numbers', () => {
  for (const v of [
    null,
    {},
    true,
    [],
    { ok: true },
    { ...good, success: false },
    { ...good, consumption: -1 },
    { ...good, tariff: null },
    { ...good, payAmount: '' },
  ])
    assert.equal(gasReceipt(v).status, 'unknown');
  assert.equal(gasReceipt({ ...good, payAmount: '100.00' }).status, 'confirmed');
});
const meters: WaterMeter[] = [
  {
    HYDID: '1',
    HYDNUM: 'cold-1',
    HG: 'H',
    POKAZAN: '10',
    ADDRESS: 'test',
    BRANCHID: '',
    CLIENTID: '',
    VODPP: '',
  },
  {
    HYDID: '2',
    HYDNUM: 'hot-2',
    HG: 'G',
    POKAZAN: '3',
    ADDRESS: 'test',
    BRANCHID: '',
    CLIENTID: '',
    VODPP: '',
  },
];
test('water maps both cold and hot drainage IDs without guessing', () => {
  const p = waterPayload('000001', meters, { '1:cold-1': '11', '2:hot-2': '4' });
  assert.equal(p.mode, 'upSert');
  assert.deepEqual(
    p.data.map((x) => [x['data-hg'], x['data-hydid'], x.value]),
    [
      ['H', '1', '11'],
      ['G', '2', '4'],
    ],
  );
});
test('water rejects incomplete meter list and refuses silent rounding', () => {
  assert.throws(() => waterPayload('000001', meters, { '1:cold-1': '11' }));
  assert.throws(() => waterPayload('000001', meters, { '1:cold-1': '11.1', '2:hot-2': '4' }));
});
test('water confirmation requires IDs and flags for every meter', () => {
  assert.equal(
    waterReceipt({ ok: true, result: { ID_ROW: [21, 22], insert: [1, 1] } }, 2),
    'confirmed',
  );
  for (const r of [
    { ok: true },
    { ok: true, result: { ID_ROW: [21] } },
    { ok: true, result: { ID_ROW: [21, 21], insert: [1, 1] } },
    { ok: true, result: { ID_ROW: [21, 22] } },
  ])
    assert.equal(waterReceipt(r, 2), 'unknown');
});

test('matchWaterValues maps by composite key, id or kind', () => {
  const values = [
    { meterId: 'cold-meter', kind: 'cold' as const, value: '15' },
    { meterId: 'hot-meter', kind: 'hot' as const, value: '8' },
  ];
  const mapped = matchWaterValues(meters, values);
  assert.deepEqual(mapped, { '1:cold-1': '15', '2:hot-2': '8' });
});

test('sendWater handles complete flow, rejection and unknown', async () => {
  const userVals = [
    { meterId: '1:cold-1', kind: 'cold' as const, value: '15' },
    { meterId: '2:hot-2', kind: 'hot' as const, value: '8' },
  ];

  // 1. Successful flow
  const goodFetcher: Fetcher = async (url, init) => {
    if (url === 'https://voda.link.kg/send/') return Response.json([1, 'hash123']);
    const body = JSON.parse(String(init?.body || '{}'));
    if (body.mode === 'loadForm') {
      return Response.json({
        waterMeters: meters,
        glob_update_pok: '2026-11-01',
      });
    }
    return Response.json({ ok: true, result: { ID_ROW: [101, 102], insert: [1, 1] } });
  };
  const res = await sendWater('000001', userVals, goodFetcher);
  assert.equal(res.status, 'confirmed');

  // 2. Account not found
  const notFoundFetcher: Fetcher = async () => Response.json([0, '000001']);
  const rej = await sendWater('000001', userVals, notFoundFetcher);
  assert.equal(rej.status, 'rejected');

  // 3. Network failure
  const failFetcher: Fetcher = async () => {
    throw new Error('network down');
  };
  const blocked = await sendWater('000001', userVals, failFetcher);
  assert.equal(blocked.status, 'blocked');
});

test('sendHeat handles csrf, login, meter post and errors', async () => {
  const csrf = extractCsrf('<input type="hidden" name="csrf_test_name" value="token123">');
  assert.equal(csrf, 'token123');

  // 1. Decimal rejected
  const dec = await sendHeat('1234567-1', [{ meterId: 'm1', value: '10.5' }]);
  assert.equal(dec.status, 'rejected');

  // 2. Account not found
  const notFoundFetcher: Fetcher = async (url, init) => {
    if (init?.method === 'GET') {
      return new Response('<input type="hidden" name="csrf_test_name" value="tok">');
    }
    return new Response('<div data-lk-error="notfound">Лицевой счёт не найден</div>');
  };
  const rej = await sendHeat('9999999-9', [{ meterId: 'm1', value: '15' }], notFoundFetcher);
  assert.equal(rej.status, 'rejected');

  // 3. Successful flow
  const okFetcher: Fetcher = async (url, init) => {
    if (init?.method === 'GET') {
      return new Response('<input type="hidden" name="csrf_test_name" value="tok">', {
        headers: { 'set-cookie': 'ci_session=sess123' },
      });
    }
    const body = String(init?.body || '');
    if (body.includes('account=')) {
      return new Response(
        '<input type="hidden" name="csrf_test_name" value="tok2"><input name="meter[1]" data-lk-meter data-prev="10">',
      );
    }
    return new Response('<div>Показания приняты</div>');
  };
  const ok = await sendHeat('1234567-1', [{ meterId: 'm1', value: '15' }], okFetcher);
  assert.equal(ok.status, 'confirmed');
});
