/** Disposable E2E provider adapter. Never loaded by the normal application. */
import Stripe from "stripe";
import nodemailer from "nodemailer";
import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
const origin = process.env.PUBLIC_APP_URL;
if (process.env.RAERO_E2E_SIMULATION !== "1" || process.env.NODE_ENV !== "test" ||
    process.env.STRIPE_SECRET_KEY !== "sk_test_local_fixture_only" ||
    !origin || !["127.0.0.1", "localhost"].includes(new URL(origin).hostname)) {
  throw new Error("The Stripe simulator requires the dedicated local E2E environment.");
}
// Synthetic issuer only in this isolated simulator; no legal identity is invented for production.
process.env.INVOICE_ISSUER_JSON ||= JSON.stringify({name:'Émetteur de recette — spécimen',address:'1 avenue des essais, 75000 Paris',country:'FR',registration:'RECETTE-SANS-VALEUR',taxId:'SPECIMEN',email:'issuer@example.invalid',legalDetails:'Document de test sans valeur comptable.',paymentTerms:'Paiement simulé uniquement.',taxStatement:'TVA simulée pour la recette.'});
Object.assign(process.env,{SMTP_HOST:'smtp.fixture.invalid',SMTP_PORT:'587',SMTP_USER:'mailbox@example.invalid',SMTP_PASS:'local_fixture_only',SMTP_FROM:'Recette <mailbox@example.invalid>',ADMIN_NOTIFY_EMAIL:'admin@example.invalid'});
// Capture email locally so reset and 2FA use the real app flow without sending mail.
nodemailer.createTransport=()=>({sendMail:async message=>{
  const path='/tmp/raero-e2e-mail.json',messages=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):[];
  messages.push({...message,createdAt:new Date().toISOString()});writeFileSync(path,JSON.stringify(messages),{mode:0o600});
  return {accepted:(Array.isArray(message.to)?message.to:[message.to]),rejected:[],messageId:`fixture-${randomUUID()}`};
}});
const statePath = "/tmp/raero-e2e-stripe.json";
export const readState = () => existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : { sessions: {}, keys: {} };
export const saveState = state => {
  const temporary = `${statePath}.${process.pid}`;
  writeFileSync(temporary, JSON.stringify(state), { mode: 0o600 });
  renameSync(temporary, statePath);
};
const prototype = Object.getPrototypeOf(new Stripe(process.env.STRIPE_SECRET_KEY).checkout.sessions);
prototype.create = async function (params, options) {
  const state = readState();
  if (options?.idempotencyKey && state.keys[options.idempotencyKey]) return state.sessions[state.keys[options.idempotencyKey]];
  if (params.mode !== "payment") throw new Error("This E2E adapter currently simulates single payments only.");
  const id = `cs_test_${randomUUID()}`;
  const session = { id, object: "checkout.session", mode: params.mode, status: "open", payment_status: "unpaid",
    currency: "eur", amount_total: params.line_items.reduce((sum, item) => sum + item.price_data.unit_amount * item.quantity, 0),
    client_reference_id: params.client_reference_id, metadata: params.metadata, payment_intent: null,
    success_url: params.success_url, cancel_url: params.cancel_url, url: `${origin}/__e2e/checkout?session_id=${id}` };
  state.sessions[id] = session;
  if (options?.idempotencyKey) state.keys[options.idempotencyKey] = id;
  saveState(state); return session;
};
prototype.retrieve = async function (id) {
  const session = readState().sessions[id];
  if (!session) throw new Error("Unknown E2E checkout session");
  return session;
};
prototype.expire = async function (id) {
  const state = readState(), session = state.sessions[id];
  if (!session || session.status !== "open") throw new Error("E2E checkout is not open");
  session.status = "expired"; session.url = null; saveState(state); return session;
};
// Fail locally if a test reaches a provider call that this adapter does not implement.
Stripe._requestSenderFactory = () => ({
  _request() { throw new Error("Unsimulated Stripe call: outbound provider access is disabled in E2E."); },
  _rawRequest() { throw new Error("Unsimulated Stripe call: outbound provider access is disabled in E2E."); },
});
