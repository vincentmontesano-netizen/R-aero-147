import { ONE_YEAR_MS } from "@shared/const";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./env";

// Local session signing/verification (email + password auth).
// JWTs are signed with JWT_SECRET; no external auth server is involved.

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
  sessionVersion: number;
};

class SessionService {
  private getSessionSecret() {
    return new TextEncoder().encode(ENV.cookieSecret);
  }

  /** Create a signed session token for a user openId. */
  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string; sessionVersion: number }
  ): Promise<string> {
    return this.signSession(
      { openId, appId: ENV.appId, name: options.name || "", sessionVersion: options.sessionVersion },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
      sessionVersion: payload.sessionVersion,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(this.getSessionSecret());
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<SessionPayload | null> {
    if (!cookieValue) return null;
    try {
      const { payload } = await jwtVerify(cookieValue, this.getSessionSecret(), {
        algorithms: ["HS256"],
      });
      const { openId, appId, name } = payload as Record<string, unknown>;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        return null;
      }
      // Existing signed cookies represent version zero until a security change.
      const sessionVersion = payload.sessionVersion === undefined ? 0 : payload.sessionVersion;
      if (appId !== ENV.appId || !Number.isSafeInteger(sessionVersion) || (sessionVersion as number) < 0) return null;
      return { openId, appId, name, sessionVersion: sessionVersion as number };
    } catch {
      return null;
    }
  }
}

export const sdk = new SessionService();
