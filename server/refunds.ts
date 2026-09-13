import { TRPCError } from "@trpc/server";
import type Stripe from "stripe";
import { eq, desc, sql, and, isNull } from "drizzle-orm";
import { getDb } from "./db";
import { refundObservations, orders, trainingLicenses } from "../drizzle/schema";
import { euroCents } from "./paymentVerification";
/** Store signature-verified or server-retrieved cumulative charge observations, including refunds arriving before fulfillment. */
export async function recordChargeRefund(eventId: string, eventCreated: number, charge: Stripe.Charge) {
  const intentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!intentId) return;
  if (!Number.isSafeInteger(charge.amount) || !Number.isSafeInteger(charge.amount_refunded) || charge.amount < 0 || charge.amount_refunded < 0 || charge.amount_refunded > charge.amount || charge.refunded !== (charge.amount_refunded === charge.amount)) throw new Error("Observation de remboursement incohérente.");
  const db = (await getDb())!;
  await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`stripe-intent:${intentId}`}))`);
    await tx.insert(refundObservations).values({ eventId, eventCreated, paymentIntentId: intentId, chargeId: charge.id,
      amountCents: charge.amount, refundedCents: charge.amount_refunded, currency: charge.currency, fullyRefunded: charge.refunded }).onConflictDoNothing();
    const [order] = await tx.select().from(orders).where(eq(orders.stripePaymentIntentId, intentId)).for("update");
    if (!order) return; // Retained for reconciliation by the later paid Checkout event.
    const [latest] = await tx.select().from(refundObservations).where(eq(refundObservations.paymentIntentId, intentId)).orderBy(desc(refundObservations.eventCreated), desc(refundObservations.refundedCents)).limit(1);
    if (latest.currency !== "eur" || latest.amountCents !== euroCents(order.totalTtc)) throw new Error("Le remboursement ne correspond pas au montant de la commande.");
    await tx.update(orders).set({ refundedAmountCents: latest.refundedCents, ...(latest.fullyRefunded ? { status: "refunded" as const } : {}) }).where(eq(orders.id, order.id));
    if (latest.fullyRefunded) await tx.update(trainingLicenses).set({ revokedAt: new Date() }).where(and(eq(trainingLicenses.orderId, order.id), isNull(trainingLicenses.revokedAt)));
  });
}

export async function orderRefundHistory(actor: { id: number; role: string }, orderId: number) {
  const db = (await getDb())!;
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new TRPCError({ code: "NOT_FOUND" });
  if (actor.role !== "admin" && actor.id !== order.userId) {
    if (!order.companyId) throw new TRPCError({ code: "FORBIDDEN" });
    await (await import("./companyTraining")).requireManagedCompany(actor, order.companyId);
  }
  if (!order.stripePaymentIntentId) return [];
  return db.select({ eventCreated: refundObservations.eventCreated, refundedCents: refundObservations.refundedCents, fullyRefunded: refundObservations.fullyRefunded })
    .from(refundObservations).where(eq(refundObservations.paymentIntentId, order.stripePaymentIntentId)).orderBy(desc(refundObservations.eventCreated), desc(refundObservations.refundedCents));
}
