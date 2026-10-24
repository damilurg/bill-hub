import { cookies } from 'next/headers';
import Dashboard from './dashboard';
import { COOKIE_NAME, verifySession } from '@/lib/auth.mjs';
import { getConfig } from '@/lib/config.mjs';
export const dynamic = 'force-dynamic';
export default async function Home() {
  return (
    <Dashboard
      authenticated={Boolean(verifySession((await cookies()).get(COOKIE_NAME)?.value))}
      liveEnabled={getConfig().live}
    />
  );
}
