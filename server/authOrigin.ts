/** Public document and recovery links use deployment configuration, never browser input. */
export function canonicalAppOrigin(): string {
  const configured = process.env.PUBLIC_APP_URL?.trim() || process.env.APP_ORIGIN?.trim();
  const production = process.env.NODE_ENV === 'production';
  if (!configured && production) throw new Error('Canonical application origin is missing');
  const target = new URL(configured || 'http://localhost:3000');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
  if (target.username || target.password || target.pathname !== '/' || target.search || target.hash ||
      (target.protocol !== 'https:' && !(target.protocol === 'http:' && !production && local))) {
    throw new Error('Canonical application origin must be an HTTPS origin');
  }
  return target.origin;
}

export const passwordResetOrigin=canonicalAppOrigin;
