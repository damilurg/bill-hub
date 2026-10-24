import { ValidationError } from './domain.ts';
import { sessionFromRequest } from './auth.mjs';
import { getConfig } from './config.mjs';
export function sameOrigin(request: Request) {
  if (
    request.headers.get('origin') !== getConfig().origin ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    throw new Response('Недопустимый источник запроса.', { status: 403 });
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
    throw new Response('Ожидается JSON.', { status: 415 });
}
export function identity(request: Request, mutate = false): string {
  const owner = sessionFromRequest(request);
  if (!owner) throw new Response('Требуется вход.', { status: 401 });
  if (mutate) sameOrigin(request);
  return owner;
}
export async function readJson(request: Request) {
  if (Number(request.headers.get('content-length')) > 20000)
    throw new ValidationError('Слишком большой запрос.');
  const reader = request.body?.getReader();
  if (!reader) throw new ValidationError('Ожидается JSON.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 20000) {
        await reader.cancel();
        throw new ValidationError('Слишком большой запрос.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ValidationError('Некорректный JSON.');
  }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
export function failure(e: unknown) {
  if (e instanceof Response) return e;
  if (e instanceof ValidationError) return json({ error: e.message }, 400);
  return json({ error: 'Операция не завершена. Обновите историю перед повтором.' }, 500);
}
