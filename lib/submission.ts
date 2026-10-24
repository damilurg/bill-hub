import type { GasResult } from './gas-adapter.ts';
export interface SubmissionStore {
  claim(key: string): Promise<boolean>;
  finish(key: string, result: GasResult): Promise<void>;
}
export async function dispatchOnce(
  key: string,
  store: SubmissionStore,
  send: () => Promise<GasResult>,
) {
  if (!(await store.claim(key)))
    return {
      status: 'duplicate' as const,
      detail: 'Эта отправка уже обрабатывается или завершена.',
    };
  let result: GasResult;
  try {
    result = await send();
  } catch {
    result = { status: 'unknown', detail: 'Результат неизвестен. Нужна проверка поставщика.' };
  }
  await store.finish(key, result);
  return result;
}
