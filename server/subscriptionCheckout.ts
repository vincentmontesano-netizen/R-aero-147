import { randomUUID } from "node:crypto";
import { and, eq, ne, desc, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { getDb } from "./db";
import { companies, employees, subscriptionCheckouts, subscriptionCheckoutClosures } from "../drizzle/schema";
import { paymentOrigin } from "./paymentVerification";
import { reconcileSubscription, type SubscriptionPlan } from "./subscription";

type Input = { companyId: number; plan: SubscriptionPlan; origin: string; userEmail?: string; userId?: number; billingPage?: boolean };
export async function prepareSubscriptionCheckout(params: Input, price: string) {
  const db = (await getDb())!;
  const origin = paymentOrigin(params.origin);
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`subscription-checkout:${params.companyId}`}))`);
    const [company] = await tx.select().from(companies).where(eq(companies.id, params.companyId)).for("update");
    if (!company || company.status !== "ACTIVE") throw new Error("Compagnie inactive ou introuvable.");
    if (company.stripeSubscriptionId) throw new Error("Un abonnement est déjà rattaché : utilisez le portail de facturation ou demandez un rapprochement.");
    const [pending] = await tx.select().from(subscriptionCheckouts).where(and(eq(subscriptionCheckouts.companyId, company.id), ne(subscriptionCheckouts.status, "expired")));
    if (pending) {
      if (pending.plan !== params.plan) throw new Error("Une souscription est déjà en cours. Reprenez ou expirez cette session avant de choisir une autre formule.");
      return pending;
    }
    const roster = await tx.select({ id: employees.id }).from(employees).where(and(eq(employees.companyId, company.id), eq(employees.isActive, true)));
    const quantity = params.plan === "standard" ? Math.max(1, roster.length) : 1;
    const id = randomUUID();
    const destination = params.billingPage ? `/abonnements?companyId=${company.id}&` : "/entreprise?";
    const metadata = { company_id: String(company.id), plan: params.plan, checkout_attempt_id: id };
    const payload: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription", line_items: [{ price, quantity }],
      ...(company.stripeCustomerId ? { customer: company.stripeCustomerId } : params.userEmail ? { customer_email: params.userEmail } : {}),
      client_reference_id: String(company.id), subscription_data: { metadata }, metadata,
      allow_promotion_codes: true, expires_at: Math.floor(Date.now() / 1000) + 4 * 3600,
      success_url: `${origin}${destination}subscription=success`, cancel_url: `${origin}${destination}subscription=cancelled`,
    };
    const [attempt] = await tx.insert(subscriptionCheckouts).values({ id, companyId: company.id, requestedBy: params.userId, plan: params.plan, quantity, payload, requestKey: `raero-subscription-${id}`, retryUntil: new Date(Date.now() + 3 * 3600000) }).returning();
    return attempt;
  });
}

export async function pendingSubscriptionCheckout(companyId: number) {
  const db = (await getDb())!;
  return (await db.select().from(subscriptionCheckouts).where(and(eq(subscriptionCheckouts.companyId, companyId), ne(subscriptionCheckouts.status, "expired"))).orderBy(desc(subscriptionCheckouts.createdAt)).limit(1))[0] ?? null;
}

export async function resumeSubscriptionCheckout(stripe: Stripe, companyId: number, attemptId: string, createIfMissing = true, expireRequestedBy?: number): Promise<{ url: string; status: string }> {
  const db = (await getDb())!;
  const result = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`subscription-checkout:${companyId}`}))`);
    const [attempt] = await tx.select().from(subscriptionCheckouts).where(and(eq(subscriptionCheckouts.id, attemptId), eq(subscriptionCheckouts.companyId, companyId))).for("update");
    if (!attempt) throw new Error("Souscription introuvable.");
    const [company] = await tx.select().from(companies).where(eq(companies.id, companyId)).for("update");
    if (!company || company.status !== "ACTIVE") throw new Error("Compagnie inactive ou introuvable.");
    if (!attempt.sessionId && company.stripeSubscriptionId) throw new Error("Un abonnement est déjà rattaché. Actualisez son état.");
    if (attempt.status === "expired") {
      if (expireRequestedBy) return { session: { status: "expired" } as Stripe.Checkout.Session, destination: attempt.payload.success_url! };
      throw new Error("Cette session a expiré. Vous pouvez choisir une nouvelle formule.");
    }
    let session: Stripe.Checkout.Session;
    if (attempt.sessionId) session = await stripe.checkout.sessions.retrieve(attempt.sessionId);
    else {
      if (expireRequestedBy || !createIfMissing || attempt.retryUntil.getTime() <= Date.now()) throw new Error("Session à rapprocher par l’assistance avant une nouvelle souscription.");
      session = await stripe.checkout.sessions.create(attempt.payload, { idempotencyKey: attempt.requestKey });
    }
    const validate = (session: Stripe.Checkout.Session) => {
      const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (!session.id || session.mode !== "subscription" || session.client_reference_id !== String(companyId) || session.metadata?.checkout_attempt_id !== attempt.id ||
        (attempt.sessionId && attempt.sessionId !== session.id) || (attempt.payload.customer && attempt.payload.customer !== customer)) throw new Error("Références de session incohérentes.");
    };
    validate(session);
    if (expireRequestedBy && session.status === "open") {
      try { session = await stripe.checkout.sessions.expire(session.id); }
      catch { session = await stripe.checkout.sessions.retrieve(session.id); }
      validate(session);
      if (session.status === "open") throw new Error("Fermeture non confirmée par Stripe. Vérifiez à nouveau avant de changer de formule.");
    }
    const linkedSubscription = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    if (company.stripeSubscriptionId && session.status !== "expired" && (session.status !== "complete" || linkedSubscription !== company.stripeSubscriptionId)) throw new Error("Un autre abonnement est déjà rattaché. Rapprochement nécessaire.");
    if (!["open", "complete", "expired"].includes(session.status ?? "")) throw new Error("État de session indisponible.");
    if (session.status === "open" && !session.url) throw new Error("Lien de paiement indisponible.");
    await tx.update(subscriptionCheckouts).set({ sessionId: session.id, status: session.status === "open" ? "pending" : session.status! }).where(eq(subscriptionCheckouts.id, attempt.id));
    if (expireRequestedBy && (session.status === "complete" || session.status === "expired")) {
      await tx.insert(subscriptionCheckoutClosures).values({ attemptId: attempt.id, requestedBy: expireRequestedBy, observedStatus: session.status }).onConflictDoNothing();
    }
    return { session, destination: attempt.payload.success_url! };
  });
  if (result.session.status === "expired") {
    if (expireRequestedBy) return { url: result.destination, status: "expired" };
    throw new Error("Cette session a expiré. Vous pouvez choisir une nouvelle formule.");
  }
  if (result.session.status === "open") return { url: result.session.url!, status: "pending" };
  const subscriptionId = typeof result.session.subscription === "string" ? result.session.subscription : result.session.subscription?.id;
  const customerId = typeof result.session.customer === "string" ? result.session.customer : result.session.customer?.id;
  if (!subscriptionId || !customerId) throw new Error("Abonnement à rapprocher.");
  const status = await reconcileSubscription(stripe, companyId, subscriptionId, customerId);
  return { url: result.destination, status };
}
