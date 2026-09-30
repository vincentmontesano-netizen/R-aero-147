import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { appSettings } from "../drizzle/schema";
import { appRouter } from "./routers";
import { getDb, getSetting, loadSettingsIntoEnv } from "./db";
import * as settingsDb from "./db";
import { emailTransport, emailTransportSetting } from "./emailTransport";
import { isEmailConfigured } from "./email";
import type { TrpcContext } from "./_core/context";

const url = process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)("admin email transport settings · PostgreSQL, no provider calls", () => {
  const input = { provider: "hostinger" as const, mailboxId: "ACfixture", mailboxEmail: "mailbox@example.test", token: "private-fixture-token" };
  let previous: typeof appSettings.$inferSelect | undefined;
  const fetchMock = vi.fn();
  const caller = (role: string | null) => appRouter.createCaller({
    user: role ? { id: 1, role } : null, req: {}, res: {},
  } as TrpcContext);
  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", url!); vi.stubEnv(emailTransportSetting, "");
    vi.stubGlobal("fetch", fetchMock);
    const db = (await getDb())!;
    [previous] = await db.select().from(appSettings).where(eq(appSettings.key, emailTransportSetting));
  });
  afterAll(async () => {
    const db = (await getDb())!;
    await db.delete(appSettings).where(eq(appSettings.key, emailTransportSetting));
    if (previous) await db.insert(appSettings).values(previous);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllEnvs(); vi.unstubAllGlobals();
  });

  it("allows an administrator to persist the complete transport atomically without returning its secret", async () => {
    expect(await caller("admin").admin.settings.setEmailTransport(input)).toEqual({ ok: true });
    expect(JSON.parse((await getSetting(emailTransportSetting))!)).toEqual(input);
    expect(emailTransport()).toEqual(input); expect(isEmailConfigured()).toBe(true);
    const status = await caller("admin").admin.settings.get();
    expect(status.emailTransport).toEqual({ provider: "hostinger", mailboxId: input.mailboxId, mailboxEmail: input.mailboxEmail, tokenSet: true });
    expect(JSON.stringify(status)).not.toContain(input.token);
  });

  it("preserves a blank token, reloads after restart and persists an explicit clear without restoring an environment fallback", async () => {
    await caller("admin").admin.settings.setEmailTransport({ ...input, token: "" });
    expect(emailTransport()?.token).toBe(input.token);
    delete process.env[emailTransportSetting];
    await loadSettingsIntoEnv(); expect(emailTransport()).toEqual(input);
    await caller("admin").admin.settings.setEmailTransport({ ...input, token: "", clearToken: true });
    expect(isEmailConfigured()).toBe(false);
    process.env[emailTransportSetting] = JSON.stringify(input);
    await loadSettingsIntoEnv(); expect(emailTransport()?.token).toBe(""); expect(isEmailConfigured()).toBe(false);
    const status = await caller("admin").admin.settings.get(); expect(status.emailTransport.tokenSet).toBe(false);
  });

  it("rejects invalid activation, mailbox paths and conflicting secret operations without changing saved settings", async () => {
    const before = await getSetting(emailTransportSetting);
    for (const invalid of [{ ...input, token: "" }, { ...input, mailboxId: "../outside" }, { ...input, mailboxEmail: "invalid" }, { ...input, token: "secret\r\nheader" }, { ...input, clearToken: true }]) {
      await expect(caller("admin").admin.settings.setEmailTransport(invalid)).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(await getSetting(emailTransportSetting)).toBe(before);
    }
  });

  it.each([null, "user", "instructor", "company_manager"])("denies settings, test sending and inbox access for %s", async role => {
    const actor = caller(role);
    for (const call of [
      () => actor.admin.settings.get(), () => actor.admin.settings.setEmailTransport(input),
      () => actor.admin.settings.sendTestEmail({ to: "recipient@example.test" }),
      () => actor.admin.inbox.list({}), () => actor.admin.inbox.message({ uid: 1 }),
    ]) await expect(call()).rejects.toMatchObject({ code: role === null ? "UNAUTHORIZED" : "FORBIDDEN" });
  });

  it("switches explicitly back to SMTP and retains the API token for later selection", async () => {
    await caller("admin").admin.settings.setEmailTransport(input);
    await caller("admin").admin.settings.setEmailTransport({ ...input, provider: "smtp", token: "" });
    expect(emailTransport()).toEqual({ ...input, provider: "smtp" });
  });

  it("never returns database query parameters containing the token when persistence fails", async () => {
    const before = await getSetting(emailTransportSetting);
    const failure = vi.spyOn(settingsDb, "setSetting").mockRejectedValueOnce(new Error(`Failed query params: ${input.token}`));
    try {
      await expect(caller("admin").admin.settings.setEmailTransport(input)).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR", message: "Enregistrement de la configuration e-mail impossible.",
      });
      expect(await getSetting(emailTransportSetting)).toBe(before);
    } finally { failure.mockRestore(); }
  });
});
