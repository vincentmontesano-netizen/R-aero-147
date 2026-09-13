import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { TRPCError } from "@trpc/server";
import { and, eq, ne, desc, sql } from "drizzle-orm";
import { getDb } from "./db";
import { orders, paymentReconciliations } from "../drizzle/schema";
import { euroCents, fulfillPaidCheckout } from "./paymentVerification";
import { recordChargeRefund } from "./refunds";

type Actor = { id: number; role: string };
function requireAdmin(actor: Actor) {
  if (actor.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
}
export async function reconciliationHistory(actor: Actor, orderId: number) {
  requireAdmin(actor);
  const db = (await getDb())!;
  return db.select().from(paymentReconciliations).where(eq(paymentReconciliations.orderId, orderId)).orderBy(desc(paymentReconciliations.id)).limit(50);
}

/** Retrieve authoritative Stripe state; the browser supplies only an identifier. */
export async function reconcilePayment(stripe: Stripe, actor: Actor, orderId: number, suppliedSessionId?: string) {
  requireAdmin(actor);
  const db = (await getDb())!;
  const [initial] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!initial) throw new TRPCError({ code: "NOT_FOUND" });
  const sessionId = suppliedSessionId || initial.stripeSessionId;
  if (!sessionId || !/^cs_[A-Za-z0-9_]{1,250}$/.test(sessionId)) throw new Error("Indiquez l’identifiant de session Checkout retrouvé dans Stripe.");
  if (initial.stripeSessionId && initial.stripeSessionId !== sessionId) throw new Error("La commande est déjà liée à une autre session.");
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent.latest_charge"] });
  if (session.id !== sessionId || session.mode !== "payment" || session.metadata?.order_id !== String(orderId) || session.metadata?.user_id !== String(initial.userId) || session.client_reference_id !== String(initial.userId) || session.currency !== "eur" || session.amount_total !== euroCents(initial.totalTtc)) throw new Error("La session Stripe ne correspond pas à la commande, à l’acheteur ou au montant.");
  if (!["open", "complete", "expired"].includes(session.status ?? "") || !["paid", "unpaid"].includes(session.payment_status)) throw new Error("État de paiement nécessitant une analyse complémentaire.");
  if (session.payment_status === "paid" && session.status !== "complete") throw new Error("État de session incohérent.");
  // A paid Checkout session remains paid after a refund. Read the charge before
  // granting access, including when its refund webhook was never received.
  let refundCharge: Stripe.Charge | undefined;
  if (session.payment_status === "paid") {
    const intent = session.payment_intent;
    const charge = typeof intent === "object" && intent ? intent.latest_charge : null;
    if (!intent || typeof intent === "string" || intent.status !== "succeeded" || !charge || typeof charge === "string" || charge.currency !== "eur" || charge.amount !== session.amount_total || !charge.paid) throw new Error("Le paiement et ses remboursements doivent être vérifiés avant activation.");
    if (charge.disputed) throw new Error("Ce paiement est contesté. Traitez la contestation avant toute activation.");
    if (!Number.isSafeInteger(charge.amount_refunded) || charge.amount_refunded < 0 || charge.amount_refunded > charge.amount || charge.refunded !== (charge.amount_refunded === charge.amount)) throw new Error("Montant remboursé incohérent.");
    const chargeIntent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
    if (chargeIntent !== intent.id) throw new Error("Charge Stripe incohérente.");
    if (charge.amount_refunded > 0) refundCharge = charge;
  }
  await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`stripe-session:${sessionId}`}))`);
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    const [other] = await tx.select({ id: orders.id }).from(orders).where(and(eq(orders.stripeSessionId, sessionId), ne(orders.id, orderId))).limit(1);
    if (other || (order.stripeSessionId && order.stripeSessionId !== sessionId) || order.userId !== initial.userId || order.totalTtc !== initial.totalTtc) throw new Error("Le rapprochement est en conflit avec une modification de commande.");
    await tx.insert(paymentReconciliations).values({ orderId, actorId: actor.id, sessionId, sessionStatus: session.status!, paymentStatus: session.payment_status, amountCents: session.amount_total!, currency: session.currency!, previousOrderStatus: order.status });
    await tx.update(orders).set({ stripeSessionId: sessionId, ...(session.status === "expired" && order.status === "pending" ? { status: "cancelled" as const } : {}) }).where(eq(orders.id, orderId));
  });
  if (refundCharge) await recordChargeRefund(`reconcile_${randomUUID()}`, Math.floor(Date.now() / 1000), refundCharge);
  if (session.payment_status === "paid") return fulfillPaidCheckout(session);
  const [current] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, orderId));
  return current;
}
