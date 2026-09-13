import type { CookieOptions, Request } from 'express';

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, 'domain' | 'httpOnly' | 'path' | 'sameSite' | 'secure'> {
  // req.protocol is derived by Express using the explicit trusted proxy list.
  // Production sessions require HTTPS even if that list is missing/misconfigured.
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' || req.protocol === 'https',
  };
}
