/**
 * "Conformité-as-a-subscription" — recurring B2B billing tied to the recyclage cycle.
 * Reuses getStripe() from stripe.ts. Falls back to a fully-functional DEMO mode when no
 * Stripe key is configured (subscription activated instantly), consistent with the
 * one-off checkout demo flow.
 */
import Stripe from "stripe";
import { getStripe } from "./stripe";
import {
  getCompanyById, setCompanySubscription, getRegulatoryTrainings, getCompanyActiveEmployees,
  ensureEnrollmentForEmployee, upsertRecurrency, findCompanyByStripeCustomerId,
} from "./db";
import { nanoid } from "nanoid";

export type SubscriptionPlan = "standard" | "all_inclusive";

const PRICE_ENV: Record<SubscriptionPlan, string | undefined> = {
  standard: process.env.STRIPE_PRICE_STANDARD_SEAT,
  all_inclusive: process.env.STRIPE_PRICE_ALL_INCLUSIVE,
};

// Grant (and renew when expired) access to all regulatory modules for every active
// employee, and (re)set their recurrencies. Employees without a user account are
// tracked via recurrencies only (v1).
export async function activateSubscriptionAccess(companyId: number) {
  const regs = await getRegulatoryTrainings();
  const employees = await getCompanyActiveEmployees(companyId);
  for (const emp of employees) {
    for (const t of regs) {
      await upsertRecurrency({ companyId, employeeId: emp.id, trainingId: t.id, periodMonths: t.recurrencyMonths ?? 24 });
      if (emp.userId) await ensureEnrollmentForEmployee(emp.userId, t.id, t.recurrencyMonths);
    }
  }
}

// Renewal is the same idempotent operation: expired enrollments are reopened and
// recurrency due-dates pushed forward by one cycle.
export async function renewSubscriptionAccess(companyId: number) {
  await activateSubscriptionAccess(companyId);
}

export async function createSubscriptionCheckoutSession(params: {
  companyId: number; plan: SubscriptionPlan; origin: string; userEmail?: string;
}): Promise<{ url: string }> {
  const stripe = getStripe();
  const company = await getCompanyById(params.companyId);
  if (!company) throw new Error("Société introuvable.");

  // ── Demo mode: no Stripe key → activate immediately ──
  if (!stripe) {
    const expiresAt = new Date(); expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    await setCompanySubscription(params.companyId, {
      subscriptionType: params.plan, subscriptionStatus: "active",
      subscriptionExpiresAt: expiresAt, stripeSubscriptionId: `demo_sub_${nanoid(10)}`,
    });
    await activateSubscriptionAccess(params.companyId);
    return { url: `${params.origin}/entreprise?subscription=success&demo=1` };
  }

  const price = PRICE_ENV[params.plan];
  if (!price) throw new Error(`Prix Stripe non configuré pour le plan « ${params.plan} » (variable STRIPE_PRICE_*).`);
  const seats = params.plan === "standard"
    ? Math.max(1, (await getCompanyActiveEmployees(params.companyId)).length)
    : 1;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: seats }],
    customer: company.stripeCustomerId ?? undefined,
    customer_email: company.stripeCustomerId ? undefined : params.userEmail,
    client_reference_id: String(params.companyId),
    subscription_data: { metadata: { company_id: String(params.companyId), plan: params.plan } },
    metadata: { company_id: String(params.companyId), plan: params.plan },
    allow_promotion_codes: true,
    success_url: `${params.origin}/entreprise?subscription=success`,
    cancel_url: `${params.origin}/entreprise?subscription=cancelled`,
  });
  return { url: session.url! };
}

export async function createBillingPortalSession(companyId: number, origin: string): Promise<{ url: string }> {
  const stripe = getStripe();
  const company = await getCompanyById(companyId);
  if (!stripe || !company?.stripeCustomerId) {
    throw new Error("Portail de facturation indisponible (mode démo ou client Stripe absent).");
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: company.stripeCustomerId,
    return_url: `${origin}/entreprise`,
  });
  return { url: session.url };
}

// Fallback when the buyer returns and no webhook is configured. Idempotent.
export async function confirmSubscription(companyId: number): Promise<{ status: string }> {
  const stripe = getStripe();
  const company = await getCompanyById(companyId);
  if (!company) return { status: "not_found" };
  if (!stripe || !company.stripeSubscriptionId || company.stripeSubscriptionId.startsWith("demo_")) {
    return { status: company.subscriptionStatus ?? "none" };
  }
  try {
    const sub = await stripe.subscriptions.retrieve(company.stripeSubscriptionId);
    await applySubscriptionState(companyId, sub);
    return { status: sub.status };
  } catch {
    return { status: company.subscriptionStatus ?? "unknown" };
  }
}

async function applySubscriptionState(companyId: number, sub: Stripe.Subscription) {
  const active = sub.status === "active" || sub.status === "trialing";
  const plan = (sub.metadata?.plan as SubscriptionPlan) || "standard";
  const periodEnd = (sub as any).current_period_end as number | undefined;
  await setCompanySubscription(companyId, {
    subscriptionType: active ? plan : "none",
    subscriptionStatus: sub.status,
    subscriptionExpiresAt: periodEnd ? new Date(periodEnd * 1000) : null,
    stripeSubscriptionId: sub.id,
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
  });
  if (active) await activateSubscriptionAccess(companyId);
}

// Handle subscription-related Stripe events. Returns true if the event was handled here.
export async function handleSubscriptionWebhookEvent(event: Stripe.Event): Promise<boolean> {
  const stripe = getStripe();
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") return false;
      const companyId = Number(session.client_reference_id ?? session.metadata?.company_id);
      if (!companyId) return true;
      await setCompanySubscription(companyId, {
        stripeCustomerId: typeof session.customer === "string" ? session.customer : (session.customer as any)?.id ?? null,
        stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : (session.subscription as any)?.id ?? null,
      });
      if (stripe && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        await applySubscriptionState(companyId, sub);
      }
      return true;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const custId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const companyId = Number(sub.metadata?.company_id) || (await findCompanyByStripeCustomerId(custId))?.id;
      if (!companyId) return true;
      if (event.type === "customer.subscription.deleted") {
        await setCompanySubscription(companyId, { subscriptionType: "none", subscriptionStatus: "canceled", subscriptionExpiresAt: null });
      } else {
        await applySubscriptionState(companyId, sub);
      }
      return true;
    }
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const custId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!custId) return true;
      const company = await findCompanyByStripeCustomerId(custId);
      if (company) await renewSubscriptionAccess(company.id);
      return true;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const custId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (custId) {
        const company = await findCompanyByStripeCustomerId(custId);
        if (company) await setCompanySubscription(company.id, { subscriptionStatus: "past_due" });
      }
      return true;
    }
    default:
      return false;
  }
}
