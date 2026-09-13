import { prepareSubscriptionCheckout, pendingSubscriptionCheckout, resumeSubscriptionCheckout } from "./subscriptionCheckout";
import { hasSubscriptionCapacity } from "../shared/subscriptionCapacity";
import { paymentOrigin } from "./paymentVerification";
/** Stripe-backed subscriptions. Missing configuration never activates paid access. */
import Stripe from "stripe";
import { getStripe } from "./stripe";
import {
  getDb, getCompanyById, getRegulatoryTrainings, getCompanyActiveEmployees,
  ensureEnrollmentForEmployee, upsertRecurrency, findCompanyByStripeCustomerId,
} from "./db";

import { eq, sql } from "drizzle-orm";
import { companies } from "../drizzle/schema";

export type SubscriptionPlan = "standard" | "all_inclusive";

const prices = (): Record<SubscriptionPlan, string | undefined> => ({
  standard: process.env.STRIPE_PRICE_STANDARD_SEAT,
  all_inclusive: process.env.STRIPE_PRICE_ALL_INCLUSIVE,
});

// Grant (and renew when expired) access to all regulatory modules for every active
// employee, and (re)set their recurrencies. Employees without a user account are
// tracked via recurrencies only (v1).
export async function activateSubscriptionAccess(companyId: number) {
  const company = await getCompanyById(companyId);
  if (!company || company.status !== "ACTIVE" || company.subscriptionType === "none" || company.subscriptionStatus !== "active" || !company.subscriptionExpiresAt || company.subscriptionExpiresAt.getTime() <= Date.now()) return;
  const regs = await getRegulatoryTrainings();
  const employees = await getCompanyActiveEmployees(companyId);
  if (!hasSubscriptionCapacity(company, employees.length)) return;
  for (const emp of employees) {
    for (const t of regs) {
      await upsertRecurrency({ companyId, employeeId: emp.id, trainingId: t.id, periodMonths: t.recurrencyMonths ?? 24 });
      if (emp.userId) await ensureEnrollmentForEmployee(emp.userId, t.id, t.recurrencyMonths, companyId, emp.id, true);
    }
  }
}

// Renewal preserves historical enrollments and never resets qualification deadlines.
export async function renewSubscriptionAccess(companyId: number) {
  await activateSubscriptionAccess(companyId);
}

export async function createSubscriptionCheckoutSession(params: {
  companyId: number; plan: SubscriptionPlan; origin: string; userEmail?: string; userId?: number; billingPage?: boolean;
}): Promise<{ url: string }> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Abonnement indisponible : Stripe doit être configuré.");
  const price = prices()[params.plan];
  if (!price) throw new Error("Prix Stripe non configuré pour cette formule.");
  const attempt = await prepareSubscriptionCheckout(params, price);
  return resumeSubscriptionCheckout(stripe, params.companyId, attempt.id);
}

export async function createBillingPortalSession(companyId: number, origin: string, billingPage = false): Promise<{ url: string }> {
  const stripe = getStripe();
  const company = await getCompanyById(companyId);
  if (!stripe || !company?.stripeCustomerId) {
    throw new Error("Portail de facturation indisponible : client Stripe absent.");
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: company.stripeCustomerId,
    return_url: `${paymentOrigin(origin)}${billingPage ? `/abonnements?companyId=${companyId}` : "/entreprise"}`,
  });
  return { url: session.url };
}

// Both webhook and browser confirmation fetch current Stripe state under a DB lock.
export async function confirmSubscription(companyId: number): Promise<{ status: string }> {
  const stripe = getStripe();
  const company = await getCompanyById(companyId);
  if (!company) return { status: "not_found" };
  if (!stripe) return { status: "requires_review" };
  if (!company.stripeSubscriptionId) {
    const pending = await pendingSubscriptionCheckout(companyId);
    if (!pending) return { status: "requires_review" };
    try { return { status: (await resumeSubscriptionCheckout(stripe, companyId, pending.id, false)).status }; }
    catch { return { status: "requires_review" }; }
  }
  if (company.stripeSubscriptionId.startsWith("demo_")) return { status: "requires_review" };
  try {
    return { status: await reconcileSubscription(stripe, companyId, company.stripeSubscriptionId) };
  } catch {
    return { status: "requires_review" };
  }
}

function stripeId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id;
}

function invoiceSubscription(invoice: Stripe.Invoice) {
  // Legacy webhook versions used a top-level subscription field.
  const legacy = invoice as Stripe.Invoice & { subscription?: string | { id: string } | null };
  return stripeId(invoice.parent?.subscription_details?.subscription ?? legacy.subscription);
}

/** Metadata identifies the organization; only configured recurring prices define its plan. */
export function subscriptionTerms(sub: Stripe.Subscription) {
  const configured = prices();
  const item = sub.items.data[0];
  const matches = (Object.keys(configured) as SubscriptionPlan[]).filter(plan => configured[plan] && configured[plan] === item?.price.id);
  const plan = matches.length === 1 ? matches[0] : null;
  const quantity = item?.quantity ?? 0;
  const end = item?.current_period_end;
  if (sub.items.has_more || sub.items.data.length !== 1 || !plan || !item.price.recurring || item.price.currency !== "eur" ||
      !Number.isSafeInteger(quantity) || quantity < 1 || (plan === "all_inclusive" && quantity !== 1) || !Number.isSafeInteger(end)) {
    return null;
  }
  return { plan, quantity, expiresAt: new Date(end * 1000) };
}

export async function reconcileSubscription(stripe: Stripe, companyId: number, subscriptionId: string, expectedCustomer?: string) {
  const db = await getDb();
  if (!db) throw new Error("Base de données indisponible.");
  const status = await db.transaction(async tx => {
    // Retrieve after serialization: old webhook snapshots and overlapping requests cannot regress state.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`subscription:${companyId}`}))`);
    const [company] = await tx.select().from(companies).where(eq(companies.id, companyId)).for("update");
    if (!company) throw new Error("Société introuvable.");
    if (company.stripeSubscriptionId && company.stripeSubscriptionId !== subscriptionId) {
      // An event for an old or second subscription must never replace the current binding.
      return "requires_review";
    }
    const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["latest_invoice"] });
    const customer = stripeId(sub.customer);
    if (sub.id !== subscriptionId || sub.metadata.company_id !== String(companyId) || !customer ||
        (expectedCustomer && expectedCustomer !== customer) || (company.stripeCustomerId && company.stripeCustomerId !== customer)) {
      throw new Error("Références Stripe de l’abonnement incohérentes.");
    }
    const terms = subscriptionTerms(sub);
    const invoice = typeof sub.latest_invoice === "object" ? sub.latest_invoice : null;
    // No paid entitlements for trials, draft/open invoices, unknown prices or expired periods.
    const paid = invoice?.status === "paid" && invoiceSubscription(invoice) === sub.id && stripeId(invoice.customer) === customer && invoice.currency === "eur";
    const active = sub.status === "active" && paid && terms && terms.expiresAt.getTime() > Date.now();
    const state = sub.status === "active" && !active ? "requires_review" : sub.status;
    await tx.update(companies).set({
      subscriptionType: active ? terms.plan : "none", subscriptionStatus: state,
      subscriptionExpiresAt: terms?.expiresAt ?? null,
      subscriptionQuantity: terms?.quantity ?? null,
      stripeSubscriptionId: sub.id, stripeCustomerId: customer,
    }).where(eq(companies.id, companyId));
    return state;
  });
  if (status === "active") await activateSubscriptionAccess(companyId);
  return status;
}

// Event payloads only identify the resource to reconcile, never establish payment/access state.
export async function handleSubscriptionWebhookEvent(event: Stripe.Event): Promise<boolean> {
  let companyId: number | undefined;
  let subscriptionId: string | undefined;
  let customerId: string | undefined;
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") return false;
      companyId = Number(session.client_reference_id ?? session.metadata?.company_id);
      subscriptionId = stripeId(session.subscription);
      customerId = stripeId(session.customer);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      customerId = stripeId(sub.customer);
      companyId = Number(sub.metadata?.company_id) || (customerId ? (await findCompanyByStripeCustomerId(customerId))?.id : undefined);
      subscriptionId = sub.id;
      break;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      subscriptionId = invoiceSubscription(invoice);
      if (!subscriptionId) return true; // A standalone invoice conveys no subscription entitlement.
      customerId = stripeId(invoice.customer);
      companyId = customerId ? (await findCompanyByStripeCustomerId(customerId))?.id : undefined;
      break;
    }
    default: return false;
  }
  if (!companyId || !Number.isSafeInteger(companyId) || companyId < 1 || !subscriptionId) return true;
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe indisponible pour vérifier l’abonnement.");
  await reconcileSubscription(stripe, companyId, subscriptionId, customerId);
  return true;
}
