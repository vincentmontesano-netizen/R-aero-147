/** Only app-relative destinations may survive a login. Authentication and API
 * endpoints are excluded to avoid loops and replaying endpoint URLs. */
export function safeLoginReturn(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/') || value.startsWith('//')) return;
  if (/[\\\u0000-\u0020\u007f]/.test(value)) return;
  try {
    const url = new URL(value, 'https://app.invalid');
    const path = decodeURIComponent(url.pathname);
    if (url.origin !== 'https://app.invalid' || /[\\\u0000-\u0020\u007f%]/.test(path) || path.startsWith('//')) return;
    if (/^\/(api|login|register|reset-password)(\/|$)/i.test(path)) return;
    return url.pathname + url.search + url.hash;
  } catch { return; }
}

/** Each role lands on the space it works in: training managers on their company space. */
const HOME_BY_ROLE: Record<string, string> = { admin: '/admin', company_manager: '/entreprise' };

export function loginDestination(search: string, role: string): string {
  const values = new URLSearchParams(search).getAll('returnTo');
  return (values.length === 1 ? safeLoginReturn(values[0]) : undefined) ?? HOME_BY_ROLE[role] ?? '/dashboard';
}
