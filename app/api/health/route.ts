import { getSqlite } from '@/db/sqlite.mjs';
export const dynamic = 'force-dynamic';
export function GET() {
  try {
    getSqlite().prepare('SELECT id FROM utility_accounts LIMIT 1').all();
    return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503 });
  }
}
