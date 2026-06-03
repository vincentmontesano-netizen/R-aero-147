/**
 * Minimal SMTP email sender. No-op (logs only) when SMTP_* env vars are absent,
 * so the whole app stays testable without an email provider — consistent with the
 * Stripe "demo mode" philosophy. Configure SMTP_HOST / SMTP_PORT / SMTP_USER /
 * SMTP_PASS / SMTP_FROM in .env to enable real delivery.
 */
import nodemailer from "nodemailer";

// SMTP config is read LAZILY from process.env (populated from .env AND from the admin
// Settings UI via app_settings → setSetting writes process.env). The transporter is
// cached and rebuilt only when credentials change, so changing settings at runtime
// takes effect on the next send without a restart.
function smtpConfig() {
  return {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM ?? "R-AERO Academy <no-reply@r-aero.academy>",
  };
}

let transporter: nodemailer.Transporter | null = null;
let transportSig = "";

function getTransport(): nodemailer.Transporter | null {
  const { host, port, user, pass } = smtpConfig();
  if (!host || !user || !pass) { transporter = null; transportSig = ""; return null; }
  const sig = `${host}:${port}:${user}:${pass}`;
  if (transporter && sig === transportSig) return transporter;
  transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  transportSig = sig;
  return transporter;
}

export function isEmailConfigured(): boolean {
  const { host, user, pass } = smtpConfig();
  return !!(host && user && pass);
}

/** Address that receives event alerts (new quote, ticket, reply, signup).
 *  Defaults to ADMIN_NOTIFY_EMAIL, else the SMTP user. */
export function adminNotifyEmail(): string | null {
  return process.env.ADMIN_NOTIFY_EMAIL?.trim() || smtpConfig().user || null;
}

export async function sendEmail(opts: { to: string; subject: string; html: string; text?: string }): Promise<{ sent: boolean; error?: string }> {
  const tx = getTransport();
  if (!tx) {
    console.log(`[email] (SMTP non configuré — ignoré) → ${opts.to} : ${opts.subject}`);
    return { sent: false, error: "SMTP non configuré." };
  }
  try {
    await tx.sendMail({ from: smtpConfig().from, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text });
    console.log(`[email] envoyé → ${opts.to} : ${opts.subject}`);
    return { sent: true };
  } catch (e: any) {
    const msg = e?.response || e?.message || String(e);
    console.warn("[email] échec d'envoi:", msg);
    return { sent: false, error: msg };
  }
}

// Generic branded wrapper for ad-hoc admin/alert emails.
export function simpleEmail(title: string, bodyHtml: string): { html: string } {
  return { html: SHELL(title, bodyHtml) };
}

// ─── Templates ────────────────────────────────────────────────────────────────
const SHELL = (title: string, body: string) => `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#1a2433">
    <div style="background:#0f1b2d;padding:20px 24px;border-radius:12px 12px 0 0">
      <span style="color:#d4a64a;font-weight:700;letter-spacing:.5px">R-AERO TRAINING ACADEMY</span>
    </div>
    <div style="border:1px solid #e6e1d6;border-top:none;border-radius:0 0 12px 12px;padding:24px">
      <h2 style="margin:0 0 12px;font-size:18px">${title}</h2>
      ${body}
      <p style="color:#7a8290;font-size:12px;margin-top:24px">Organisme de formation agréé EASA Part-147 · Cet email est généré automatiquement.</p>
    </div>
  </div>`;

export function orderConfirmationEmail(params: { name: string; orderId: number; totalTtc: string; items: { title: string; quantity: number }[] }): { subject: string; html: string } {
  const rows = params.items.map((i) => `<li>${i.title}${i.quantity > 1 ? ` × ${i.quantity}` : ""}</li>`).join("");
  return {
    subject: `Confirmation de commande #${params.orderId} — R-AERO Academy`,
    html: SHELL("Merci pour votre commande", `
      <p>Bonjour ${params.name || ""},</p>
      <p>Votre commande <strong>#${params.orderId}</strong> est confirmée. Vos accès e-learning sont activés.</p>
      <ul>${rows}</ul>
      <p>Total TTC : <strong>${params.totalTtc} €</strong></p>
      <p>Retrouvez vos formations dans votre tableau de bord.</p>`),
  };
}

export function twoFactorCodeEmail(params: { name: string; code: string }): { subject: string; html: string } {
  return {
    subject: `Votre code de connexion R-AERO : ${params.code}`,
    html: SHELL("Code de connexion", `
      <p>Bonjour ${params.name || ""},</p>
      <p>Voici votre code de connexion à usage unique (valable 10 minutes) :</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:6px;color:#0f1b2d;margin:16px 0">${params.code}</p>
      <p style="font-size:12px;color:#7a8290">Si vous n'êtes pas à l'origine de cette connexion, ignorez cet email et changez votre mot de passe.</p>`),
  };
}

export function passwordResetEmail(params: { name: string; link: string }): { subject: string; html: string } {
  return {
    subject: "Réinitialisation de votre mot de passe — R-AERO Academy",
    html: SHELL("Réinitialisation du mot de passe", `
      <p>Bonjour ${params.name || ""},</p>
      <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous (lien valable 1 heure) :</p>
      <p style="margin:20px 0"><a href="${params.link}" style="background:#0f1b2d;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Définir un nouveau mot de passe</a></p>
      <p style="font-size:12px;color:#7a8290">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — votre mot de passe reste inchangé.</p>
      <p style="font-size:12px;color:#7a8290">Ou copiez ce lien : ${params.link}</p>`),
  };
}

export function expiryReminderEmail(params: { name: string; trainingTitle: string; dueLabel: string }): { subject: string; html: string } {
  return {
    subject: `Échéance de recyclage : ${params.trainingTitle}`,
    html: SHELL("Rappel d'échéance de formation", `
      <p>Bonjour ${params.name || ""},</p>
      <p>La formation <strong>${params.trainingTitle}</strong> ${params.dueLabel}.</p>
      <p>Pensez à planifier votre recyclage pour rester conforme Part-147.</p>`),
  };
}
