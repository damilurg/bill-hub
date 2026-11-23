export type ProviderResult = {
  status: 'confirmed' | 'unknown' | 'rejected' | 'blocked';
  detail: string;
};
export type SubmissionResult =
  | ProviderResult
  | {
      status: 'duplicate';
      detail: string;
    };

export interface SubmissionStore {
  claim(key: string): Promise<boolean>;
  finish(key: string, result: ProviderResult): Promise<void>;
}
export async function dispatchOnce(
  key: string,
  store: SubmissionStore,
  send: () => Promise<ProviderResult>,
): Promise<SubmissionResult> {
  if (!(await store.claim(key)))
    return {
      status: 'duplicate' as const,
      detail: 'Эта отправка уже обрабатывается или завершена.',
    };
  let result: SubmissionResult;
  try {
    result = await send();
  } catch {
    result = { status: 'unknown', detail: 'Результат неизвестен. Нужна проверка поставщика.' };
  }
  await store.finish(key, result);
  return result;
}
