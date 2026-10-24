import { createSession, loginLimiter, sessionCookie, verifyPassword } from '@/lib/auth.mjs';
import { failure, json, readJson, sameOrigin } from '@/lib/api';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const input = await readJson(request);
    const wait = loginLimiter.reserve();
    if (wait) {
      const response = json({ error: 'Слишком много попыток. Попробуйте через 15 минут.' }, 429);
      response.headers.set('Retry-After', String(wait));
      return response;
    }
    if (!(await verifyPassword(input?.username, input?.password)))
      return json({ error: 'Неверный логин или пароль.' }, 401);
    loginLimiter.reset();
    const response = json({ ok: true });
    response.headers.set('Set-Cookie', sessionCookie(createSession()));
    return response;
  } catch (e) {
    return failure(e);
  }
}
