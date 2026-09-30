import { z } from "zod";
import { simpleParser } from "mailparser";
import { emailTransport, hostingerMailConfigured } from "./emailTransport";
import type { InboxMessage } from "./inbox";

const origin = "https://api.mail.hostinger.com";
const unavailable = "Configuration Mail API Hostinger absente ou invalide.";
const readFailure = "Lecture Hostinger impossible. Vérifiez la configuration ou réessayez plus tard.";

async function readBody(response: Response, maxBytes: number) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error(readFailure);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error(readFailure);
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally { await reader.cancel().catch(() => {}); }
}

async function request(path: string, init: RequestInit = {}) {
  const config = emailTransport();
  if (!config || !hostingerMailConfigured(config)) throw new Error(unavailable);
  return fetch(`${origin}/api/v1/mailboxes/${encodeURIComponent(config.mailboxId)}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${config.token}`, Accept: "application/json", ...init.headers },
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
}

/** No retry: a timeout can occur after the provider has already accepted the email. */
export async function sendHostingerEmail(opts: { to: string; subject: string; html: string; text?: string }) {
  if (!hostingerMailConfigured()) return { sent: false, error: unavailable };
  if (!z.string().email().safeParse(opts.to).success) return { sent: false, error: "Adresse destinataire invalide." };
  try {
    const response = await request("/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: [opts.to], displayName: "R-AERO Academy", subject: opts.subject, html: opts.html, ...(opts.text === undefined ? {} : { text: opts.text }) }),
    });
    await response.body?.cancel();
    if (response.status === 204) return { sent: true };
    if (response.status === 401 || response.status === 403) return { sent: false, error: "Authentification Mail API Hostinger refusée. Vérifiez le jeton et la boîte autorisée." };
  } catch { /* Never expose a provider response, recipient, body or credential. */ }
  return { sent: false, error: "Envoi Hostinger non confirmé. Vérifiez le fournisseur avant toute nouvelle tentative." };
}

const messageList = z.object({ data: z.array(z.object({
  uid: z.number().int().positive(),
  from: z.object({ name: z.string(), address: z.string() }).nullable(),
  subject: z.string().nullable(),
  date: z.string().datetime({ offset: true }),
  unseen: z.boolean(),
})).max(100) });

export async function fetchHostingerInbox(limit: number): Promise<InboxMessage[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error("Limite de messages invalide.");
  try {
    const response = await request(`/folders/INBOX/messages?page=1&perPage=${limit}&sort=-uid`);
    if (response.status !== 200) { await response.body?.cancel(); throw new Error(readFailure); }
    const parsed = messageList.parse(JSON.parse((await readBody(response, 2 * 1024 * 1024)).toString("utf8")));
    return parsed.data.slice(0, limit).map(message => ({
      uid: message.uid, from: message.from?.address ?? "", fromName: message.from?.name || null,
      subject: message.subject ?? "(sans objet)", date: message.date, seen: !message.unseen, snippet: "",
    }));
  } catch { throw new Error(readFailure); }
}

export async function fetchHostingerMessage(uid: number) {
  if (!Number.isSafeInteger(uid) || uid < 1) throw new Error("Identifiant de message invalide.");
  try {
    // Hostinger marks the message Seen when /source is read (verified against the
    // real API). The inbox warns before opening and refreshes its read indicators.
    const response = await request(`/folders/INBOX/messages/${uid}/source`, { headers: { Accept: "message/rfc822" } });
    if (response.status !== 200 || !response.headers.get("content-type")?.toLowerCase().startsWith("message/rfc822")) {
      await response.body?.cancel(); throw new Error(readFailure);
    }
    const parsed = await simpleParser(await readBody(response, 20 * 1024 * 1024), { skipImageLinks: true });
    return { subject: parsed.subject ?? "(sans objet)", from: parsed.from?.text ?? "",
      date: parsed.date ? parsed.date.toISOString() : null, text: parsed.text ?? "", html: typeof parsed.html === "string" ? parsed.html : null };
  } catch { throw new Error(readFailure); }
}
