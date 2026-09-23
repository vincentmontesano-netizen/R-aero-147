import type { NextFunction, Request, Response } from "express";

/** Baseline browser hardening that cannot break Jitsi, Stripe or external course media:
 *  no CSP here (inline styles, third-party iframes and media hosts vary per course). */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // The app embeds others (Jitsi, PDF previews of its own files) but is never embedded itself.
  res.set("X-Frame-Options", "SAMEORIGIN");
  res.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  if (req.secure) res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
}
