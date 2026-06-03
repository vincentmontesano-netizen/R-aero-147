// Read-only IMAP inbox for the admin "Réception" tab. Credentials are reused from the
// SMTP mailbox config (Hostinger uses the same login for IMAP + SMTP). Lazy + defensive:
// every call connects, fetches, and disconnects; failures surface as clear messages.
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

function imapConfig() {
  return {
    host: (process.env.IMAP_HOST || "").trim() || "imap.hostinger.com",
    port: process.env.IMAP_PORT ? Number(process.env.IMAP_PORT) : 993,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  };
}

export function isInboxConfigured(): boolean {
  const c = imapConfig();
  return !!(c.host && c.user && c.pass);
}

function newClient(): ImapFlow {
  const c = imapConfig();
  return new ImapFlow({ host: c.host, port: c.port, secure: c.port === 993, auth: { user: c.user!, pass: c.pass! }, logger: false });
}

export type InboxMessage = { uid: number; from: string; fromName: string | null; subject: string; date: string | null; seen: boolean; snippet: string };

/** Fetch the latest `limit` messages from INBOX (envelope + short snippet). */
export async function fetchInbox(limit = 25): Promise<InboxMessage[]> {
  if (!isInboxConfigured()) throw new Error("IMAP non configuré (renseignez la boîte mail dans Emails → SMTP).");
  const client = newClient();
  const out: InboxMessage[] = [];
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const total = (client.mailbox && typeof client.mailbox !== "boolean" ? client.mailbox.exists : 0) || 0;
      if (total === 0) return [];
      const start = Math.max(1, total - limit + 1);
      for await (const msg of client.fetch(`${start}:*`, { uid: true, envelope: true, flags: true, bodyParts: ["1"] })) {
        const env = msg.envelope;
        const fromAddr = env?.from?.[0];
        let snippet = "";
        const part = msg.bodyParts?.get("1");
        if (part) snippet = part.toString("utf8").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
        out.push({
          uid: msg.uid,
          from: fromAddr?.address ?? "",
          fromName: fromAddr?.name || null,
          subject: env?.subject ?? "(sans objet)",
          date: env?.date ? new Date(env.date).toISOString() : null,
          seen: !!msg.flags?.has("\\Seen"),
          snippet,
        });
      }
    } finally { lock.release(); }
  } finally {
    await client.logout().catch(() => {});
  }
  // newest first
  return out.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

/** Full body of one message (by UID), parsed to text/html. */
export async function fetchMessage(uid: number): Promise<{ subject: string; from: string; date: string | null; text: string; html: string | null }> {
  if (!isInboxConfigured()) throw new Error("IMAP non configuré.");
  const client = newClient();
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const dl = await client.download(String(uid), undefined, { uid: true });
      if (!dl?.content) throw new Error("Message introuvable.");
      const parsed = await simpleParser(dl.content as any);
      return {
        subject: parsed.subject ?? "(sans objet)",
        from: parsed.from?.text ?? "",
        date: parsed.date ? parsed.date.toISOString() : null,
        text: parsed.text ?? "",
        html: typeof parsed.html === "string" ? parsed.html : null,
      };
    } finally { lock.release(); }
  } finally {
    await client.logout().catch(() => {});
  }
}
