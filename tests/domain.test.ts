import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeReading,
  validateAccount,
  validateValues,
  bishkekPeriod,
  validatePeriod,
  toMilli,
  type Account,
} from '../lib/domain.ts';
const water: Account = {
  provider: 'water',
  account: '000000123',
  meters: [
    { id: 'cold', kind: 'cold', label: 'Холодная', previous: '10' },
    { id: 'hot', kind: 'hot', label: 'Стоки', previous: '2' },
  ],
};
test('preserves account leading zeros', () =>
  assert.equal(validateAccount(water).account, '000000123'));
test('normalizes comma decimals without rounding', () => {
  assert.equal(normalizeReading(' 0012,340 '), '12.34');
  assert.equal(toMilli('0.001'), 1);
});
test('rejects empty, negative, exponent, Infinity, mixed separators and trailing junk', () => {
  for (const v of [
    '',
    ' ',
    '-1',
    '1e5',
    'Infinity',
    'NaN',
    '12abc',
    '1,234.56',
    '1.1234',
    null,
    {},
    '1000000000',
  ])
    assert.throws(() => normalizeReading(v));
});
test('zero consumption is valid', () =>
  assert.equal(validateValues(water, { cold: '10', hot: '2' })[0].value, '10'));
test('cold and hot drainage meters must both be provided', () =>
  assert.throws(() => validateValues(water, { cold: '11' })));
test('rejects lower and unexpected meter readings', () => {
  assert.throws(() => validateValues(water, { cold: '9', hot: '3' }));
  assert.throws(() => validateValues(water, { cold: '11', hot: '3', foreign: '2' }));
});
test('rejects duplicate IDs and wrong utility meter kind', () => {
  assert.throws(() => validateAccount({ ...water, meters: [water.meters[0], water.meters[0]] }));
  assert.throws(() => validateAccount({ ...water, meters: [{ ...water.meters[0], kind: 'gas' }] }));
});
test('gas account is exactly 9 digits and has one meter', () => {
  const g = {
    provider: 'gas',
    account: '000000001',
    meters: [{ id: 'g', kind: 'gas', label: 'Газ', previous: '5' }],
  };
  const a = validateAccount(g);
  assert.equal(a.account, '000000001');
  assert.throws(() => validateAccount({ ...g, account: '123' }));
  assert.throws(() => validateAccount({ ...g, meters: [...g.meters, ...g.meters] }));
  assert.throws(() => validateValues(a, { g: '5.1' }));
  assert.throws(() => validateValues(a, { g: '0' }));
  assert.throws(() => validateValues(a, { g: '10000000' }));
});
test('period uses Bishkek month at UTC boundary', () =>
  assert.equal(bishkekPeriod(new Date('2026-10-31T18:01:00Z')), '2026-11'));
test('rejects invalid and future month', () => {
  const now = new Date('2026-10-22T12:00:00Z');
  assert.throws(() => validatePeriod('2026-13', now));
  assert.throws(() => validatePeriod('2026-11', now));
  assert.equal(validatePeriod('2026-10', now), '2026-10');
});
