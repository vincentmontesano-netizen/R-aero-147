import type Stripe from "stripe";
import { eq, and, desc, sql } from "drizzle-orm";
import { getDb } from "./db";
import { orders, orderItems, enrollments, trainingLicenses, refundObservations } from "../drizzle/schema";

export function euroCents(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error("Montant EUR invalide.");
  const [whole, decimals = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(decimals.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > 99_999_999) throw new Error("Montant EUR hors limites.");
  return cents;
}
/** Accept only server-retrieved or signature-verified Stripe sessions. Never expose this as a client payload. */
export async function fulfillPaidCheckout(session: Stripe.Checkout.Session) {
  if (session.mode !== "payment" || session.payment_status !== "paid") return { status: "pending" };
  const orderId = Number(session.metadata?.order_id), userId = Number(session.metadata?.user_id);
  if (!Number.isSafeInteger(orderId) || orderId < 1 || !Number.isSafeInteger(userId) || userId < 1) throw new Error("Référence de paiement invalide.");
  const db = (await getDb())!;
  return db.transaction(async tx => {
    const intentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (!intentId) throw new Error("Référence Stripe PaymentIntent absente.");
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`stripe-intent:${intentId}`}))`);
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order || order.userId !== userId || order.stripeSessionId !== session.id || session.client_reference_id !== String(userId)) throw new Error("Le paiement ne correspond pas à la commande.");
    if (session.currency !== "eur" || session.amount_total !== euroCents(order.totalTtc)) throw new Error("Montant ou devise du paiement incohérent.");
    if (order.status === "refunded" || order.status === "cancelled") return { status: order.status };
    const [refund] = await tx.select().from(refundObservations).where(eq(refundObservations.paymentIntentId, intentId)).orderBy(desc(refundObservations.eventCreated), desc(refundObservations.refundedCents)).limit(1);
    if (refund && (refund.currency !== "eur" || refund.amountCents !== euroCents(order.totalTtc))) throw new Error("Remboursement incohérent avec la commande.");
    if (refund) await tx.update(orders).set({ refundedAmountCents: refund.refundedCents }).where(eq(orders.id, order.id));
    if (refund?.fullyRefunded) {
      await tx.update(orders).set({ status: "refunded", stripePaymentIntentId: intentId }).where(eq(orders.id, order.id));
      return { status: "refunded" };
    }
    if (order.fulfilledAt) return { status: "paid" };
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    if (!items.length || items.some(i => !i.trainingVersionId)) throw new Error("La commande doit contenir des versions de formation identifiées.");
    await tx.update(orders).set({ status: "paid", stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null }).where(eq(orders.id, order.id));
    for (const item of items) {
      const quantity = item.quantity ?? 1;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100 || (!order.companyId && quantity !== 1)) throw new Error("Quantité de licences invalide.");
      for (let seatIndex = 1; seatIndex <= quantity; seatIndex++) {
        const [license] = await tx.insert(trainingLicenses).values({ orderId: order.id, orderItemId: item.id, seatIndex, trainingId: item.trainingId,
          trainingVersionId: item.trainingVersionId!, ownerUserId: order.userId, ownerOrgId: order.companyId,
          assignedUserId: order.companyId ? null : order.userId, assignedBy: order.companyId ? null : order.userId, assignedAt: order.companyId ? null : new Date() }).returning();
        if (!order.companyId) {
          const [enrollment] = await tx.insert(enrollments).values({ userId: order.userId, orderId: order.id, trainingId: item.trainingId, trainingLicenseId: license.id }).returning();
          await tx.update(trainingLicenses).set({ enrollmentId: enrollment.id }).where(eq(trainingLicenses.id, license.id));
        }
      }
    }
    await tx.update(orders).set({ fulfilledAt: new Date() }).where(eq(orders.id, order.id));
    return { status: "paid" };
  });
}

export function paymentOrigin(requested: string) {
  const target = new URL(process.env.PUBLIC_APP_URL || requested);
  const request = new URL(requested);
  if (target.username || target.password || target.pathname !== "/" || target.search || target.hash || request.origin !== target.origin) throw new Error("Origine de retour invalide.");
  if (!process.env.PUBLIC_APP_URL && (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname))) throw new Error("PUBLIC_APP_URL doit être configurée.");
  if (target.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && target.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname))) throw new Error("Origine HTTPS requise.");
  return target.origin;
}
