export function getConfig(env = process.env) {
  let url;
  try {
    url = new URL(env.APP_URL || '');
  } catch {
    throw new Error('APP_URL must be an absolute URL. Run npm run setup.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('APP_URL must contain only the public origin.');
  const username = env.ADMIN_USERNAME || 'admin';
  if (!/^[a-zA-Z0-9_.-]{1,80}$/.test(username)) throw new Error('Invalid ADMIN_USERNAME.');
  const passwordHash = env.ADMIN_PASSWORD_HASH || '';
  if (!/^scrypt-v1:[a-f0-9]{32}:[a-f0-9]{128}$/.test(passwordHash))
    throw new Error('ADMIN_PASSWORD_HASH is missing or invalid. Run npm run setup.');
  const secret = env.SESSION_SECRET || '';
  if (!/^[a-f0-9]{64,128}$/.test(secret))
    throw new Error('SESSION_SECRET must contain 32–64 random bytes in hexadecimal.');
  const live = env.LIVE_SUBMISSIONS_ENABLED || 'false';
  if (!['true', 'false'].includes(live))
    throw new Error('LIVE_SUBMISSIONS_ENABLED must be true or false.');
  return {
    origin: url.origin,
    secure: url.protocol === 'https:',
    username,
    passwordHash,
    secret,
    live: live === 'true',
  };
}
