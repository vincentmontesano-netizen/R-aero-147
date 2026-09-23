import { TRPCError } from "@trpc/server";
import { recordChargeRefund } from "./refunds";
import { fulfillPaidCheckout } from "./paymentVerification";
import Stripe from "stripe";
import { getDb, isWebhookProcessed, markWebhookProcessed } from "./db";
import { handleSubscriptionWebhookEvent } from "./subscription";
import { orders } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ─── Stripe client ────────────────────────────────────────────────────────────
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

// ─── Create checkout session ──────────────────────────────────────────────────
export async function createCheckoutSession(params: {
  userId: number;
  userEmail: string;
  userName: string;
  userRole?: string;
  companyId?: number;
  cartItems: Array<{ id: number; trainingId: number; quantity: number; training: any }>;
  origin: string;
}): Promise<{ url: string; orderId: number } | null> {
  const stripe = getStripe();
  if (!stripe) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Paiement indisponible : Stripe doit être configuré." });

  const { prepareCartCheckout, resumeOrderCheckout } = await import("./checkoutAttempts");
  const attempt = await prepareCartCheckout(params);
  return resumeOrderCheckout(stripe, { id: params.userId, role: params.userRole ?? "user" }, attempt.orderId);
}

// ─── Convert an accepted quote into an order + Stripe checkout ────────────────
// Mirrors createCheckoutSession but with explicit (negotiated) line items, links the
// order to the quote and marks the quote accepted. Payment is verified through Stripe.
export async function createQuoteCheckout(params: {
  quoteId: number;
  actor: { id: number; role: string };
  userRole?: string;
  userId: number;
  userEmail: string;
  userName: string;
  companyId?: number;
  items: Array<{ trainingId: number; title: string; quantity: number; unitPriceHt: number; unitPriceTtc: number }>;
  origin: string;
}): Promise<{ url: string; orderId: number } | null> {
  const stripe = getStripe();
  if (!stripe) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Paiement indisponible : Stripe doit être configuré." });
  const { prepareQuoteCheckout, resumeOrderCheckout } = await import("./checkoutAttempts");
  const attempt = await prepareQuoteCheckout(params);
  return resumeOrderCheckout(stripe, { id: params.userId, role: params.userRole ?? "user" }, attempt.orderId);
}

// ─── Confirm payment on return (fallback when webhook isn't configured) ───────
// Called when the buyer lands on the success URL. Retrieves the Stripe Checkout
// session and, if paid, marks the order paid and activates access. Idempotent.
export async function confirmCheckoutPayment(orderId: number, userId: number): Promise<{ status: string }> {
  const db = await getDb();
  if (!db) return { status: "error" };

  const order = (await db.select().from(orders).where(eq(orders.id, orderId)).limit(1))[0];
  if (!order || order.userId !== userId) return { status: "not_found" };
  if (order.status === "paid" && order.fulfilledAt) return { status: "paid" };

  const stripe = getStripe();
  if (!stripe || !order.stripeSessionId) return { status: order.status === "paid" ? "requires_review" : order.status };

  try {
    const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
    return await fulfillPaidCheckout(session);
  } catch (err) {
    console.error("[Stripe] confirm failed:", err);
    return { status: "pending" };
  }
}

// ─── Handle Stripe webhook ────────────────────────────────────────────────────
export async function handleStripeWebhook(rawBody: Buffer, signature: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe non configuré.");

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("Signature webhook non configurée.");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[Stripe] Webhook signature verification failed");
    throw new Error("Webhook signature invalide");
  }

  console.log(`[Stripe] Webhook received: ${event.type} (${event.id})`);

  const db = await getDb();
  if (!db) throw new Error("Base de données indisponible.");

  // Idempotency — Stripe may redeliver the same event id.
  if (await isWebhookProcessed(event.id)) {
    console.log(`[Stripe] Event ${event.id} already processed — skipping.`);
    return;
  }

  // Subscription events are handled in subscription.ts. One-off payment events
  // (mode: "payment") return false here and fall through to the order switch below.
  if (await handleSubscriptionWebhookEvent(event)) {
    await markWebhookProcessed(event.id);
    return;
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      await fulfillPaidCheckout(event.data.object as Stripe.Checkout.Session);
      break;
    }

    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const orderId = parseInt(intent.metadata?.order_id ?? "0");
      if (orderId) {
        await db.update(orders).set({ status: "failed" }).where(and(eq(orders.id, orderId), eq(orders.status, "pending")));
      }
      break;
    }

    case "charge.refunded": {
      await recordChargeRefund(event.id, event.created, event.data.object as Stripe.Charge);
      break;
    }

    default:
      console.log(`[Stripe] Unhandled event type: ${event.type}`);
  }

  await markWebhookProcessed(event.id);
}
