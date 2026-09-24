import { afterAll, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { COOKIE_NAME } from "../shared/const";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { establishSession, NATIVE_SESSION_MS, sessionCredential } from "./_core/sessionTransport";

const prior = ENV.cookieSecret;
ENV.cookieSecret = "native-session-test-signing-key-over-32-characters";
afterAll(() => { ENV.cookieSecret = prior; });
const user = { openId: "native-session-test", name: "Test Learner", sessionVersion: 4 };

describe("native and browser session transports", () => {
  it("keeps browser credentials in an HttpOnly cookie, never in the response body", async () => {
    const cookie = vi.fn();
    expect(await establishSession({ headers: {}, protocol: "https" } as never, { cookie } as never, user)).toEqual({});
    expect(cookie).toHaveBeenCalledWith(COOKIE_NAME, expect.any(String), expect.objectContaining({ httpOnly: true, secure: true, sameSite: "lax" }));
    const token = cookie.mock.calls[0][1];
    expect(await sdk.verifySession(token)).toMatchObject({ openId: user.openId, sessionVersion: 4 });
    expect(await sdk.verifySession(token, "native")).toBeNull();
  });

  it("issues a bounded native credential without creating a browser cookie", async () => {
    const cookie = vi.fn();
    const result = await establishSession({ headers: { "x-raero-client": "native" } } as never, { cookie } as never, user);
    expect(cookie).not.toHaveBeenCalled();
    expect(await sdk.verifySession(result.nativeSession?.token, "native")).toMatchObject({ openId: user.openId, sessionVersion: 4 });
    expect(await sdk.verifySession(result.nativeSession?.token)).toBeNull();
    expect(new Date(result.nativeSession!.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(NATIVE_SESSION_MS);
    expect(new Date(result.nativeSession!.expiresAt).getTime() - Date.now()).toBeGreaterThan(NATIVE_SESSION_MS - 5000);
  });

  it("preserves old signed browser sessions without accepting them as native", async () => {
    const token = await new SignJWT({ ...user, appId: ENV.appId }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(new TextEncoder().encode(ENV.cookieSecret));
    expect(await sdk.verifySession(token)).toMatchObject({ openId: user.openId });
    expect(await sdk.verifySession(token, "native")).toBeNull();
  });

  it("never falls back to a valid cookie for a malformed Authorization header", () => {
    for (const authorization of ["", "Basic abc", "Bearer one", "Bearer a.b.c extra", "Bearer a.b.c\n"]) {
      expect(sessionCredential({ cookie: `${COOKIE_NAME}=valid-cookie`, authorization })).toEqual({ token: undefined, transport: "native" });
    }
    expect(sessionCredential({ cookie: `${COOKIE_NAME}=browser` })).toEqual({ token: "browser", transport: "cookie" });
    expect(sessionCredential({ authorization: "Bearer a.b.c" })).toEqual({ token: "a.b.c", transport: "native" });
  });

  it("rejects expired and altered native credentials", async () => {
    const expired = await sdk.createSessionToken(user.openId, { ...user, transport: "native", expiresInMs: -1000 });
    expect(await sdk.verifySession(expired, "native")).toBeNull();
    const token = await sdk.createSessionToken(user.openId, { ...user, transport: "native" });
    const parts = token.split("."); parts[1] = Buffer.from(JSON.stringify({ ...user, sessionVersion: 0 })).toString("base64url");
    expect(await sdk.verifySession(parts.join("."), "native")).toBeNull();
  });
});
