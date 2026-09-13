import { createHash, randomUUID } from "node:crypto";
import { and, eq, desc, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { orders, orderItems, trainings, checkoutAttempts, quoteRequests, users, messages } from "../drizzle/schema";
import { euroCents, paymentOrigin, fulfillPaidCheckout } from "./paymentVerification";
import { requireManagedCompany } from "./companyTraining";

type CartInput = {
  userId: number; userEmail: string; userName: string; companyId?: number; origin: string;
  cartItems: Array<{ id: number; trainingId: number; quantity: number; training: any }>;
};
type QuoteInput = Omit<CartInput, "cartItems"> & {
  actor: { id: number; role: string }; quoteId: number;
  items: Array<{ trainingId: number; title: string; quantity: number; unitPriceHt: number; unitPriceTtc: number }>;
};
export function prepareCartCheckout(params: CartInput) { return prepareCheckout(params); }
export async function prepareQuoteCheckout(params: QuoteInput) {
  if (params.actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
  return prepareCheckout(params);
}
async function prepareCheckout(params: CartInput | QuoteInput) {
  const db = (await getDb())!;
  const origin = paymentOrigin(params.origin);
  const quote = "quoteId" in params ? params : null;
  const items = "quoteId" in params ? params.items : params.cartItems;
  if (!items.length || items.length > 100) throw new Error("Panier vide ou trop volumineux.");
  if (new Set(items.map(i => i.trainingId)).size !== items.length) throw new Error("Regroupez les places d’une formation sur une seule ligne.");
  if (quote?.items.some(i => !i.title.trim() || i.title.length > 255)) throw new Error("Libellé de formation invalide.");
  return db.transaction(async tx => {
    // Serialize identical requests across processes before creating the order.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`checkout-buyer:${params.userId}`}))`);
    let quoteFingerprint: string | undefined;
    if (quote) {
      const [request] = await tx.select().from(quoteRequests).where(eq(quoteRequests.id, quote.quoteId)).for("update");
      const [actor] = await tx.select().from(users).where(eq(users.id, quote.actor.id)).for("share");
      if (!actor || actor.role !== "admin" || actor.status !== "active") throw new TRPCError({code:"FORBIDDEN"});
      const [buyer] = await tx.select().from(users).where(eq(users.id, params.userId));
      if (!request || !buyer || buyer.status !== "active" || (request.userId != null ? request.userId !== buyer.id : request.contactEmail.toLowerCase() !== buyer.email?.toLowerCase())) throw new TRPCError({ code: "FORBIDDEN", message: "Acheteur du devis incohérent." });
      if (request.status === "refused") throw new Error("Ce devis est refusé.");
      if (request.companyId && request.companyId !== params.companyId) throw new Error("Compagnie du devis incohérente.");
      if (params.companyId) await requireManagedCompany(buyer, params.companyId);
      const terms = [...quote.items].sort((a, b) => a.trainingId - b.trainingId).map(i => ({ trainingId: i.trainingId, title: i.title.trim(), quantity: i.quantity, ht: euroCents(String(i.unitPriceHt)), ttc: euroCents(String(i.unitPriceTtc)) }));
      quoteFingerprint = createHash("sha256").update(JSON.stringify({ quoteId: quote.quoteId, userId: params.userId, companyId: params.companyId ?? null, terms })).digest("hex");
      const previous = await tx.select().from(orders).where(eq(orders.quoteRequestId, quote.quoteId)).orderBy(desc(orders.id));
      if (previous.some(o => o.status === "paid" || o.status === "refunded")) throw new Error("Ce devis a déjà été réglé. Créez un nouveau devis pour un autre achat.");
      const pending = previous.filter(o => o.status === "pending");
      if (pending.length) {
        const [attempt] = await tx.select().from(checkoutAttempts).where(eq(checkoutAttempts.orderId, pending[0].id));
        if (pending.length !== 1 || !attempt || attempt.fingerprint !== quoteFingerprint) throw new Error("Une commande existe déjà pour ce devis. Rapprochez ou expirez sa session avant de modifier les conditions.");
        return attempt;
      }
    }
    const lines = [];
    for (const item of [...items].sort((a, b) => a.trainingId - b.trainingId)) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100 || (!params.companyId && item.quantity !== 1)) throw new Error("Choisissez une compagnie pour acheter plusieurs places.");
      const [course] = await tx.select().from(trainings).where(eq(trainings.id, item.trainingId)).for("share");
      if (!course?.isPublished || !course.publishedVersionId || course.archivedAt || course.ownerOrgId != null) throw new Error("Formation indisponible à l’achat.");
      const ht = euroCents(String("unitPriceHt" in item ? item.unitPriceHt : course.priceHt));
      const ttc = euroCents(String("unitPriceTtc" in item ? item.unitPriceTtc : course.priceTtc));
      if (ttc < ht || ttc <= 0) throw new Error("Tarif de formation invalide.");
      if ("training" in item && (course.publishedVersionId !== item.training?.publishedVersionId || ht !== euroCents(String(item.training?.priceHt)) || ttc !== euroCents(String(item.training?.priceTtc)))) throw new Error("Le catalogue a changé. Actualisez le panier avant paiement.");
      lines.push({ trainingId: course.id, versionId: course.publishedVersionId, title: "title" in item ? item.title.trim() : course.title, quantity: item.quantity, ht, ttc });
    }
    const fingerprint = quoteFingerprint ?? createHash("sha256").update(JSON.stringify({ userId: params.userId, companyId: params.companyId ?? null, lines })).digest("hex");
    const [existing] = await tx.select({ attempt: checkoutAttempts }).from(checkoutAttempts).innerJoin(orders, eq(orders.id, checkoutAttempts.orderId))
      .where(and(eq(checkoutAttempts.fingerprint, fingerprint), eq(orders.status, "pending"))).orderBy(desc(checkoutAttempts.orderId)).limit(1);
    if (existing) return existing.attempt;
    const totalHt = lines.reduce((sum, l) => sum + l.ht * l.quantity, 0);
    const totalTtc = lines.reduce((sum, l) => sum + l.ttc * l.quantity, 0);
    euroCents((totalHt / 100).toFixed(2));
    euroCents((totalTtc / 100).toFixed(2));
    const [order] = await tx.insert(orders).values({ userId: params.userId, companyId: params.companyId, quoteRequestId: quote?.quoteId, status: "pending", totalHt: (totalHt / 100).toFixed(2), totalTtc: (totalTtc / 100).toFixed(2), vatAmount: ((totalTtc - totalHt) / 100).toFixed(2), vatRate: "20.00" }).returning();
    await tx.insert(orderItems).values(lines.map(l => ({ orderId: order.id, trainingId: l.trainingId, trainingVersionId: l.versionId, quantity: l.quantity, unitPriceHt: (l.ht / 100).toFixed(2), unitPriceTtc: (l.ttc / 100).toFixed(2) })));
    const payload: Stripe.Checkout.SessionCreateParams = {
      mode: "payment", payment_method_types: ["card"], allow_promotion_codes: false,
      customer_email: params.userEmail, client_reference_id: String(params.userId),
      metadata: { user_id: String(params.userId), order_id: String(order.id), ...(quote ? { quote_id: String(quote.quoteId) } : {}) },
      payment_intent_data: { metadata: { user_id: String(params.userId), order_id: String(order.id) } },
      line_items: lines.map(l => ({ price_data: { currency: "eur", product_data: { name: l.title }, unit_amount: l.ttc }, quantity: l.quantity })),
      expires_at: Math.floor(Date.now() / 1000) + 4 * 3600,
      success_url: `${origin}/dashboard?payment=success&order=${order.id}`, cancel_url: `${origin}/${quote ? "mes-devis" : "cart"}?payment=cancelled`,
    };
    const [attempt] = await tx.insert(checkoutAttempts).values({ orderId: order.id, fingerprint, requestKey: `raero-checkout-${randomUUID()}`, payload, retryUntil: new Date(Date.now() + 3 * 3600_000) }).returning();
    if (quote) {
      await tx.execute(sql`SELECT set_config('raero.quote_actor_id', ${String(quote.actor.id)}, true)`);
      await tx.update(quoteRequests).set({ status: "accepted", userId: params.userId }).where(eq(quoteRequests.id, quote.quoteId));
      await tx.insert(messages).values({ quoteRequestId: quote.quoteId, fromUserId: quote.actor.id, toUserId: params.userId, content: `Commande #${order.id} préparée à partir du devis. Le paiement peut être repris depuis votre tableau de bord.` });
    }
    return attempt;
  });
}

export async function resumeOrderCheckout(stripe: Stripe, actor: { id: number; role: string }, orderId: number): Promise<{ url: string; orderId: number }> {
  const db = (await getDb())!;
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order || order.userId !== actor.id) throw new TRPCError({ code: "NOT_FOUND" });
  if (order.companyId) await requireManagedCompany(actor, order.companyId);
  if (order.status !== "pending") throw new Error("Cette commande ne peut plus être payée. Consultez son état dans votre tableau de bord.");
  const [attempt] = await db.select().from(checkoutAttempts).where(eq(checkoutAttempts.orderId, orderId));
  let session: Stripe.Checkout.Session;
  if (order.stripeSessionId) session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
  else {
    // Never reuse an unlinked request beyond the safe retry window: Stripe may
    // eventually prune idempotency keys. Reconciliation is required in that case.
    if (!attempt || attempt.retryUntil.getTime() <= Date.now()) throw new Error("La session doit être rapprochée par le support avant une nouvelle tentative.");
    session = await stripe.checkout.sessions.create(attempt.payload, { idempotencyKey: attempt.requestKey });
    await db.transaction(async tx => {
      const [current] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
      if (current.stripeSessionId && current.stripeSessionId !== session.id) throw new Error("Session de paiement incohérente.");
      await tx.update(orders).set({ stripeSessionId: session.id }).where(eq(orders.id, orderId));
    });
  }
  if (session.metadata?.order_id !== String(orderId) || session.client_reference_id !== String(actor.id)) throw new Error("Session de paiement incohérente.");
  if (session.status === "expired") {
    await db.update(orders).set({ status: "cancelled" }).where(and(eq(orders.id, orderId), eq(orders.status, "pending")));
    throw new Error("Session expirée. Vous pouvez relancer le paiement depuis le panier.");
  }
  if (session.status === "complete") {
    await fulfillPaidCheckout(session);
    return { url: `${new URL(session.success_url!).origin}/dashboard?order=${orderId}`, orderId };
  }
  if (session.status !== "open" || !session.url) throw new Error("Session de paiement indisponible.");
  return { url: session.url, orderId };
}
