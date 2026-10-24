import { normalizeReading, toMilli } from './domain.ts';
export type WaterMeter = {
  HYDID: string;
  HYDNUM: string;
  HG: 'H' | 'G';
  POKAZAN: string;
  ADDRESS: string;
  BRANCHID: string;
  CLIENTID: string;
  VODPP: string;
};
// Observed contract only. Not invoked in production until provider access is verified.
export function waterPayload(
  account: string,
  meters: WaterMeter[],
  values: Record<string, string>,
) {
  if (!meters.length || Object.keys(values).length !== meters.length)
    throw new Error('Нужны показания всех водомеров, включая горячую воду для стоков.');
  return {
    mode: 'upSert',
    account,
    data: meters.map((m) => {
      const value = normalizeReading(values[m.HYDID + ':' + m.HYDNUM]);
      if (value.includes('.'))
        throw new Error('Подтвердите целое показание; автоматического округления нет.');
      if (toMilli(value) < toMilli(m.POKAZAN)) throw new Error('Показание меньше предыдущего.');
      return {
        'data-address': m.ADDRESS,
        'data-branchid': m.BRANCHID,
        'data-clientid': m.CLIENTID,
        'data-hg': m.HG,
        'data-hydid': m.HYDID,
        'data-hydnum': m.HYDNUM,
        'data-vodpp': m.VODPP,
        value,
      };
    }),
  };
}
export function waterReceipt(input: unknown, expected: number) {
  const r = input as {
    ok?: unknown;
    result?: { ID_ROW?: unknown; insert?: unknown; update?: unknown };
  };
  const ids = r?.result?.ID_ROW,
    inserts = r?.result?.insert,
    updates = r?.result?.update;
  if (
    r?.ok !== true ||
    !Array.isArray(ids) ||
    ids.length !== expected ||
    expected < 1 ||
    ids.some((x) => !/^[1-9]\d*$/.test(String(x))) ||
    new Set(ids.map(String)).size !== ids.length
  )
    return 'unknown';
  return ids.every(
    (_, i) =>
      (Array.isArray(inserts) && inserts[i] === 1) ||
      (Array.isArray(updates) && [0, 1].includes(updates[i])),
  )
    ? 'confirmed'
    : 'unknown';
}
