import Stripe from "stripe";
import { getDb, isWebhookProcessed, markWebhookProcessed } from "./db";
import { handleSubscriptionWebhookEvent } from "./subscription";
import { orders, orderItems, enrollments, cartItems, trainings, users, quoteRequests } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { sendEmail, orderConfirmationEmail } from "./email";

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
  cartItems: Array<{ id: number; trainingId: number; quantity: number; training: any }>;
  origin: string;
}): Promise<{ url: string; orderId: number } | null> {
  const stripe = getStripe();

  const db = await getDb();
  if (!db) throw new Error("Base de données non disponible.");

  // Calculate totals
  const totalHt = params.cartItems.reduce(
    (sum, item) => sum + Number(item.training?.priceHt ?? 0) * (item.quantity ?? 1), 0
  );
  const totalTtc = params.cartItems.reduce(
    (sum, item) => sum + Number(item.training?.priceTtc ?? 0) * (item.quantity ?? 1), 0
  );
  const vatAmount = totalTtc - totalHt;

  // Generate invoice number
  const invoiceNumber = `RAERO-${new Date().getFullYear()}-${nanoid(6).toUpperCase()}`;

  // Create order in DB
  const orderResult = await db.insert(orders).values({
    userId: params.userId,
    status: "pending",
    totalHt: totalHt.toFixed(2),
    totalTtc: totalTtc.toFixed(2),
    vatAmount: vatAmount.toFixed(2),
    vatRate: "20.00",
    invoiceNumber,
  }).returning({ id: orders.id });
  const orderId = orderResult[0].id;

  // Create order items
  for (const item of params.cartItems) {
    await db.insert(orderItems).values({
      orderId,
      trainingId: item.trainingId,
      quantity: item.quantity ?? 1,
      unitPriceHt: Number(item.training?.priceHt ?? 0).toFixed(2),
      unitPriceTtc: Number(item.training?.priceTtc ?? 0).toFixed(2),
    });
  }

  // ── Demo mode: no Stripe key configured ──────────────────────────────────
  // Mark the order as paid and activate access immediately so the e-learning
  // flow is fully testable without real payment credentials.
  if (!stripe) {
    await db.update(orders).set({ status: "paid", notes: "Paiement simulé (mode démo)" }).where(eq(orders.id, orderId));
    await activateEnrollmentsForOrder(orderId, params.userId);
    return { url: `${params.origin}/dashboard?payment=success&order=${orderId}&demo=1`, orderId };
  }

  // Build Stripe line items
  const lineItems = params.cartItems.map((item) => ({
    price_data: {
      currency: "eur",
      product_data: {
        name: item.training?.title ?? "Formation R-AERO",
        description: item.training?.part147Reference ?? undefined,
      },
      unit_amount: Math.round(Number(item.training?.priceTtc ?? 0) * 100),
    },
    quantity: item.quantity ?? 1,
  }));

  // Create Stripe session
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: lineItems,
    customer_email: params.userEmail,
    client_reference_id: params.userId.toString(),
    metadata: {
      user_id: params.userId.toString(),
      order_id: orderId.toString(),
      customer_email: params.userEmail,
      customer_name: params.userName ?? "",
    },
    success_url: `${params.origin}/dashboard?payment=success&order=${orderId}`,
    cancel_url: `${params.origin}/cart?payment=cancelled`,
    allow_promotion_codes: true,
  });

  // Save session ID to order
  await db.update(orders).set({ stripeSessionId: session.id }).where(eq(orders.id, orderId));

  return { url: session.url!, orderId };
}

// ─── Convert an accepted quote into an order + Stripe checkout ────────────────
// Mirrors createCheckoutSession but with explicit (negotiated) line items, links the
// order to the quote, and marks the quote accepted. Always goes through Stripe (demo
// mode simulates payment + activates enrollments, like the cart flow).
export async function createQuoteCheckout(params: {
  quoteId: number;
  userId: number;
  userEmail: string;
  userName: string;
  items: Array<{ trainingId: number; title: string; quantity: number; unitPriceHt: number; unitPriceTtc: number }>;
  origin: string;
}): Promise<{ url: string; orderId: number } | null> {
  const stripe = getStripe();
  const db = await getDb();
  if (!db) throw new Error("Base de données non disponible.");

  const totalHt = params.items.reduce((s, i) => s + i.unitPriceHt * (i.quantity ?? 1), 0);
  const totalTtc = params.items.reduce((s, i) => s + i.unitPriceTtc * (i.quantity ?? 1), 0);
  const vatAmount = totalTtc - totalHt;
  const invoiceNumber = `RAERO-${new Date().getFullYear()}-${nanoid(6).toUpperCase()}`;

  const orderResult = await db.insert(orders).values({
    userId: params.userId, quoteRequestId: params.quoteId, status: "pending",
    totalHt: totalHt.toFixed(2), totalTtc: totalTtc.toFixed(2), vatAmount: vatAmount.toFixed(2),
    vatRate: "20.00", invoiceNumber, notes: `Issu du devis #${params.quoteId}`,
  }).returning({ id: orders.id });
  const orderId = orderResult[0].id;

  for (const item of params.items) {
    await db.insert(orderItems).values({
      orderId, trainingId: item.trainingId, quantity: item.quantity ?? 1,
      unitPriceHt: item.unitPriceHt.toFixed(2), unitPriceTtc: item.unitPriceTtc.toFixed(2),
    });
  }

  await db.update(quoteRequests).set({ status: "accepted" }).where(eq(quoteRequests.id, params.quoteId));

  if (!stripe) {
    await db.update(orders).set({ status: "paid", notes: `Paiement simulé (mode démo) — devis #${params.quoteId}` }).where(eq(orders.id, orderId));
    await activateEnrollmentsForOrder(orderId, params.userId);
    return { url: `${params.origin}/dashboard?payment=success&order=${orderId}&demo=1`, orderId };
  }

  const lineItems = params.items.map((i) => ({
    price_data: { currency: "eur", product_data: { name: i.title }, unit_amount: Math.round(i.unitPriceTtc * 100) },
    quantity: i.quantity ?? 1,
  }));
  const session = await stripe.checkout.sessions.create({
    mode: "payment", payment_method_types: ["card"], line_items: lineItems,
    customer_email: params.userEmail, client_reference_id: params.userId.toString(),
    metadata: { user_id: params.userId.toString(), order_id: orderId.toString(), quote_id: params.quoteId.toString() },
    success_url: `${params.origin}/dashboard?payment=success&order=${orderId}`,
    cancel_url: `${params.origin}/mes-devis?payment=cancelled`,
  });
  await db.update(orders).set({ stripeSessionId: session.id }).where(eq(orders.id, orderId));
  return { url: session.url!, orderId };
}

// ─── Activate enrollments after successful payment ────────────────────────────
export async function activateEnrollmentsForOrder(orderId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Get order items
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

  let createdAny = false;
  for (const item of items) {
    // Check if enrollment already exists
    const existing = await db.select().from(enrollments)
      .where(and(eq(enrollments.userId, userId), eq(enrollments.trainingId, item.trainingId)))
      .limit(1);

    if (existing.length === 0) {
      // Get training for recurrency calculation
      const training = await db.select().from(trainings).where(eq(trainings.id, item.trainingId)).limit(1);
      const t = training[0];

      // Calculate expiry date if training has recurrency
      let expiresAt: Date | undefined;
      if (t?.recurrencyMonths) {
        expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + t.recurrencyMonths);
      }

      await db.insert(enrollments).values({
        userId,
        trainingId: item.trainingId,
        orderId,
        status: "not_started",
        progressPercent: 0,
        expiresAt,
      });
      createdAny = true;
    }
  }

  // Clear cart
  await db.delete(cartItems).where(eq(cartItems.userId, userId));

  // Order confirmation email — sent once, only when access was actually granted
  // (no-op if SMTP isn't configured).
  if (createdAny) {
    const order = (await db.select().from(orders).where(eq(orders.id, orderId)).limit(1))[0];
    const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
    if (order && user?.email) {
      const lines = [];
      for (const item of items) {
        const t = (await db.select().from(trainings).where(eq(trainings.id, item.trainingId)).limit(1))[0];
        lines.push({ title: t?.title ?? `Formation #${item.trainingId}`, quantity: item.quantity ?? 1 });
      }
      const mail = orderConfirmationEmail({ name: user.name ?? "", orderId, totalTtc: order.totalTtc, items: lines });
      await sendEmail({ to: user.email, ...mail });
    }
  }
}

// ─── Confirm payment on return (fallback when webhook isn't configured) ───────
// Called when the buyer lands on the success URL. Retrieves the Stripe Checkout
// session and, if paid, marks the order paid and activates access. Idempotent.
export async function confirmCheckoutPayment(orderId: number, userId: number): Promise<{ status: string }> {
  const db = await getDb();
  if (!db) return { status: "error" };

  const order = (await db.select().from(orders).where(eq(orders.id, orderId)).limit(1))[0];
  if (!order || order.userId !== userId) return { status: "not_found" };
  if (order.status === "paid") return { status: "paid" };

  const stripe = getStripe();
  if (!stripe || !order.stripeSessionId) return { status: order.status };

  try {
    const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
    if (session.payment_status === "paid" || session.status === "complete") {
      await db.update(orders).set({
        status: "paid",
        stripePaymentIntentId: (session.payment_intent as string) ?? null,
      }).where(eq(orders.id, orderId));
      await activateEnrollmentsForOrder(orderId, userId);
      return { status: "paid" };
    }
    return { status: "pending" };
  } catch (err) {
    console.error("[Stripe] confirm failed:", err);
    return { status: "pending" };
  }
}

// ─── Handle Stripe webhook ────────────────────────────────────────────────────
export async function handleStripeWebhook(rawBody: Buffer, signature: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) return;

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn("[Stripe] STRIPE_WEBHOOK_SECRET not set, skipping signature verification");
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[Stripe] Webhook signature verification failed:", err);
    throw new Error("Webhook signature invalide");
  }

  console.log(`[Stripe] Webhook received: ${event.type} (${event.id})`);

  const db = await getDb();
  if (!db) return;

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
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = parseInt(session.metadata?.order_id ?? "0");
      const userId = parseInt(session.metadata?.user_id ?? "0");

      if (orderId && userId) {
        // Update order status
        await db.update(orders).set({
          status: "paid",
          stripePaymentIntentId: session.payment_intent as string,
        }).where(eq(orders.id, orderId));

        // Activate enrollments
        await activateEnrollmentsForOrder(orderId, userId);
        console.log(`[Stripe] Order ${orderId} paid — enrollments activated for user ${userId}`);
      }
      break;
    }

    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const orderId = parseInt(intent.metadata?.order_id ?? "0");
      if (orderId) {
        await db.update(orders).set({ status: "failed" }).where(eq(orders.id, orderId));
      }
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = charge.payment_intent as string;
      if (paymentIntentId) {
        await db.update(orders).set({ status: "refunded" })
          .where(eq(orders.stripePaymentIntentId, paymentIntentId));
      }
      break;
    }

    default:
      console.log(`[Stripe] Unhandled event type: ${event.type}`);
  }

  await markWebhookProcessed(event.id);
}
