import { afterEach, beforeEach, expect, it, vi } from "vitest";
const transport = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn(() => transport) } }));
import { emailTransportSetting, emailTransportStatus } from "./emailTransport";
import { adminNotifyEmail, isEmailConfigured, sendEmail } from "./email";
import { fetchInbox, fetchMessage, isInboxConfigured } from "./inbox";

const config = { provider: "hostinger", mailboxId: "ACfixture", mailboxEmail: "mailbox@example.test", token: "private-mail-token" };
const mail = { to: "recipient@example.test", subject: "Private subject", html: "<p>Private content</p>", text: "Private text" };
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.stubEnv(emailTransportSetting, JSON.stringify(config));
  vi.stubEnv("ADMIN_NOTIFY_EMAIL", "");
  vi.stubEnv("SMTP_HOST", "smtp.example.test"); vi.stubEnv("SMTP_USER", "legacy@example.test"); vi.stubEnv("SMTP_PASS", "legacy-password");
  vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); transport.sendMail.mockReset();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("uses the fixed official origin, selected mailbox, bearer token, timeout and exact send contract", async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  expect(isEmailConfigured()).toBe(true); expect(isInboxConfigured()).toBe(true);
  expect(adminNotifyEmail()).toBe(config.mailboxEmail);
  expect(await sendEmail(mail)).toEqual({ sent: true });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("https://api.mail.hostinger.com/api/v1/mailboxes/ACfixture/send");
  expect(init).toMatchObject({ method: "POST", redirect: "error", headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" } });
  expect(init?.signal).toBeInstanceOf(AbortSignal);
  expect(JSON.parse(init?.body as string)).toEqual({ ...mail, to: [mail.to], displayName: "R-AERO Academy" });
  expect(transport.sendMail).not.toHaveBeenCalled();
  expect(emailTransportStatus()).toEqual({ provider: "hostinger", mailboxId: config.mailboxId, mailboxEmail: config.mailboxEmail, tokenSet: true });
});

it.each([200, 202, 301, 401, 403, 422, 429, 500, 502, 504])("does not accept HTTP %s as proof of sending, retry or disclose the response", async status => {
  fetchMock.mockResolvedValue(new Response("private-mail-token recipient@example.test Private content", { status }));
  const result = await sendEmail(mail);
  expect(result.sent).toBe(false); expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(result)).not.toMatch(/private-mail-token|recipient@example|Private content/);
  expect(transport.sendMail).not.toHaveBeenCalled();
});

it("keeps uncertain network failures generic and never repeats an attempt", async () => {
  fetchMock.mockRejectedValue(new Error("private-mail-token recipient@example.test Private content"));
  const warn = vi.spyOn(console, "warn"); const log = vi.spyOn(console, "log");
  const result = await sendEmail(mail);
  expect(result.sent).toBe(false); expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(JSON.stringify([result, warn.mock.calls, log.mock.calls])).not.toMatch(/private-mail-token|recipient@example|Private content/);
});

it("fails closed for malformed or incomplete API settings despite working SMTP credentials", async () => {
  for (const raw of ["not-json", JSON.stringify({ ...config, provider: "unknown" }), ...["mailboxId", "mailboxEmail", "token"].map(key => JSON.stringify({ ...config, [key]: "" })), JSON.stringify({ ...config, mailboxId: "../another-mailbox" })]) {
    vi.stubEnv(emailTransportSetting, raw);
    expect(isEmailConfigured()).toBe(false); expect(isInboxConfigured()).toBe(false);
    expect((await sendEmail(mail)).sent).toBe(false);
    await expect(fetchInbox()).rejects.toThrow(); await expect(fetchMessage(1)).rejects.toThrow();
  }
  expect(fetchMock).not.toHaveBeenCalled(); expect(transport.sendMail).not.toHaveBeenCalled();
});

it("keeps existing SMTP installations and explicit SMTP selection operational", async () => {
  for (const raw of ["", JSON.stringify({ ...config, provider: "smtp" })]) {
    vi.stubEnv(emailTransportSetting, raw);
    transport.sendMail.mockResolvedValueOnce({ accepted: [mail.to], rejected: [] });
    expect(isEmailConfigured()).toBe(true); expect(isInboxConfigured()).toBe(true);
    expect(await sendEmail(mail)).toEqual({ sent: true });
    expect(adminNotifyEmail()).toBe("legacy@example.test");
  }
  expect(fetchMock).not.toHaveBeenCalled();
});

it("maps inbox metadata without fetching bodies or marking messages seen", async () => {
  fetchMock.mockResolvedValue(Response.json({ data: [
    { uid: 9, from: { name: "Sender", address: "sender@example.test" }, subject: "Subject", date: "2026-09-30T09:00:00Z", unseen: true },
    { uid: 8, from: null, subject: null, date: "2026-09-29T09:00:00Z", unseen: false },
  ] }));
  expect(await fetchInbox(2)).toEqual([
    { uid: 9, from: "sender@example.test", fromName: "Sender", subject: "Subject", date: "2026-09-30T09:00:00Z", seen: false, snippet: "" },
    { uid: 8, from: "", fromName: null, subject: "(sans objet)", date: "2026-09-29T09:00:00Z", seen: true, snippet: "" },
  ]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe("https://api.mail.hostinger.com/api/v1/mailboxes/ACfixture/folders/INBOX/messages?page=1&perPage=2&sort=-uid");
});

it("reads RFC822 source rather than the /text endpoint that marks Seen", async () => {
  const source = ["From: Sender <sender@example.test>", "Subject: Test body", "Date: Wed, 30 Sep 2026 09:00:00 +0000", "Content-Type: text/html; charset=utf-8", "", "<p>Message content</p>"].join("\r\n");
  fetchMock.mockResolvedValue(new Response(source, { headers: { "Content-Type": "message/rfc822" } }));
  expect(await fetchMessage(9)).toMatchObject({ subject: "Test body", html: "<p>Message content</p>", date: "2026-09-30T09:00:00.000Z" });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe("https://api.mail.hostinger.com/api/v1/mailboxes/ACfixture/folders/INBOX/messages/9/source");
});

it("validates identifiers, limits and recipients before contacting Hostinger", async () => {
  for (const uid of [0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1]) await expect(fetchMessage(uid)).rejects.toThrow();
  for (const limit of [0, 51, 1.5, NaN]) await expect(fetchInbox(limit)).rejects.toThrow();
  expect((await sendEmail({ ...mail, to: "recipient@example.test\r\nBcc: other@example.test" })).sent).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("rejects malformed provider data and hides errors on inbox reads", async () => {
  for (const response of [Response.json({ data: "private-mail-token" }), new Response("private-mail-token", { status: 403 }), Response.json({ data: [{ uid: -1 }] })]) {
    fetchMock.mockResolvedValueOnce(response);
    await expect(fetchInbox()).rejects.toThrow("Lecture Hostinger impossible.");
  }
  fetchMock.mockResolvedValueOnce(Response.json({ secret: "private-mail-token" }));
  await expect(fetchMessage(9)).rejects.toThrow("Lecture Hostinger impossible.");
});
