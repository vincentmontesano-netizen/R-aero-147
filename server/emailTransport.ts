import { z } from "zod";

// One persisted setting keeps provider, mailbox and secret together across restarts.
export const emailTransportSchema = z.object({
  provider: z.enum(["smtp", "hostinger"]),
  mailboxId: z.string().trim().max(100).regex(/^[A-Za-z0-9_-]*$/),
  mailboxEmail: z.union([z.literal(""), z.string().trim().email()]),
  token: z.string().trim().max(4096).regex(/^[\x21-\x7e]*$/),
});
export type EmailTransport = z.infer<typeof emailTransportSchema>;
export const emailTransportSetting = "EMAIL_TRANSPORT_CONFIG";

export function emailTransport(): EmailTransport | null {
  const raw = process.env[emailTransportSetting];
  if (!raw) return { provider: "smtp", mailboxId: "", mailboxEmail: "", token: "" };
  try {
    const parsed = emailTransportSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

export function hostingerMailConfigured(config = emailTransport()): boolean {
  return !!(config?.provider === "hostinger" && config.mailboxId && config.mailboxEmail && config.token);
}

export function emailTransportStatus() {
  const config = emailTransport();
  return {
    provider: config?.provider ?? "invalid",
    mailboxId: config?.mailboxId ?? "",
    mailboxEmail: config?.mailboxEmail ?? "",
    tokenSet: !!config?.token,
  };
}
