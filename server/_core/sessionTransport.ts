import type { Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

export const NATIVE_SESSION_MS = 30 * 24 * 60 * 60 * 1000;

/** Authorization takes precedence: an invalid bearer must never fall back to a cookie. */
export function sessionCredential(headers: Request["headers"]) {
  if (headers.authorization !== undefined) {
    const value = headers.authorization;
    const match = typeof value === "string" && value.length < 8192
      ? /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(value)
      : null;
    return { token: match?.[1], transport: "native" as const };
  }
  return { token: parseCookieHeader(headers.cookie ?? "")[COOKIE_NAME], transport: "cookie" as const };
}

/** Called only after password/second-factor verification or successful registration. */
export async function establishSession(
  req: Request,
  res: Response,
  user: { openId: string; name: string | null; sessionVersion: number },
): Promise<{ nativeSession?: { token: string; expiresAt: string } }> {
  const native = req.headers["x-raero-client"] === "native";
  const expiresInMs = native ? NATIVE_SESSION_MS : ONE_YEAR_MS;
  const token = await sdk.createSessionToken(user.openId, {
    name: user.name ?? "",
    sessionVersion: user.sessionVersion,
    expiresInMs,
    transport: native ? "native" : "cookie",
  });
  if (native) {
    // No cookie on native sign-in. The app puts this credential in Keychain /
    // Android Keystore-backed storage and sends it only to the configured API.
    return { nativeSession: { token, expiresAt: new Date(Date.now() + expiresInMs).toISOString() } };
  }
  res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
  return {};
}
