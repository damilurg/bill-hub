import { sessionCookie } from '@/lib/auth.mjs';
import { failure, identity, json } from '@/lib/api';
export async function POST(request: Request) {
  try {
    identity(request, true);
    const response = json({ ok: true });
    response.headers.set('Set-Cookie', sessionCookie('', true));
    return response;
  } catch (e) {
    return failure(e);
  }
}
