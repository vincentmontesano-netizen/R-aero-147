import { beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getDb, updateTraining } from "./db";
import { prepareCartCheckout } from "./checkoutAttempts";
import { reconcilePayment, reconciliationHistory } from "./paymentReconciliation";
import { users, trainings, orders, enrollments, trainingLicenses, paymentReconciliations } from "../drizzle/schema";
const url = process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)("admin payment reconciliation · PostgreSQL", () => {
  beforeAll(() => { process.env.DATABASE_URL = url!; });
  async function fixture() {
    const db = (await getDb())!;
    const [user] = await db.insert(users).values({ openId: randomUUID() }).returning();
    const [admin] = await db.insert(users).values({ openId: randomUUID(), role: "admin" }).returning();
    const [course] = await db.insert(trainings).values({ slug: randomUUID(), title: "Reconciliation fixture", type: "webinar", priceHt: "100.00", priceTtc: "120.00" }).returning();
    await updateTraining(course.id, { isPublished: true });
    const [training] = await db.select().from(trainings).where(eq(trainings.id, course.id));
    const attempt = await prepareCartCheckout({ userId: user.id, userEmail: "fixture@example.test", userName: "Fixture", origin: "http://localhost:3174", cartItems: [{ id: 1, trainingId: training.id, quantity: 1, training }] });
    const pi = `pi_${randomUUID().replaceAll("-", "")}`;
    const charge = { id: `ch_${randomUUID()}`, amount: 12000, amount_refunded: 0, refunded: false, currency: "eur", paid: true, payment_intent: pi } as Stripe.Charge;
    const session = { id: `cs_test_${randomUUID().replaceAll("-", "")}`, mode: "payment", status: "complete", payment_status: "paid", amount_total: 12000, currency: "eur", metadata: { order_id: String(attempt.orderId), user_id: String(user.id) }, client_reference_id: String(user.id), payment_intent: { id: pi, status: "succeeded", latest_charge: charge } } as Stripe.Checkout.Session;
    const retrieve = vi.fn().mockResolvedValue(session);
    const stripe = { checkout: { sessions: { retrieve } } } as unknown as Stripe;
    return { db, user, admin, attempt, session, stripe, retrieve, charge };
  }
  it("recovers an unlinked paid session, grants once under concurrency and retains immutable observations", async () => {
    const { db, admin, attempt, stripe, session, retrieve } = await fixture();
    const results = await Promise.all([reconcilePayment(stripe, admin, attempt.orderId, session.id), reconcilePayment(stripe, admin, attempt.orderId, session.id)]);
    expect(results).toEqual([{ status: "paid" }, { status: "paid" }]);
    expect(retrieve).toHaveBeenCalledWith(session.id, { expand: ["payment_intent.latest_charge"] });
    expect(await db.select().from(enrollments).where(eq(enrollments.orderId, attempt.orderId))).toHaveLength(1);
    expect((await db.select().from(orders).where(eq(orders.id, attempt.orderId)))[0].stripeSessionId).toBe(session.id);
    const history = await reconciliationHistory(admin, attempt.orderId);
    expect(history).toHaveLength(2);
    expect(history[0].actorId).toBe(admin.id);
    await expect(db.delete(paymentReconciliations).where(eq(paymentReconciliations.orderId, attempt.orderId))).rejects.toThrow();
    await expect(db.update(paymentReconciliations).set({ actorId: 999 }).where(eq(paymentReconciliations.orderId, attempt.orderId))).rejects.toThrow();
  });
  it("rejects non-admins and mismatched session data before binding or granting", async () => {
    const { db, admin, user, attempt, stripe, session, retrieve } = await fixture();
    await expect(reconcilePayment(stripe, user, attempt.orderId, session.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(reconciliationHistory(user, attempt.orderId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(retrieve).not.toHaveBeenCalled();
    for (const patch of [{ amount_total: 1 }, { currency: "usd" }, { mode: "subscription" }, { client_reference_id: "999" }, { metadata: { ...session.metadata, user_id: "999" } }, { metadata: { ...session.metadata, order_id: "999" } }, { payment_intent: "pi_unexpanded" }]) {
      retrieve.mockResolvedValue({ ...session, ...patch });
      await expect(reconcilePayment(stripe, admin, attempt.orderId, session.id)).rejects.toThrow();
    }
    expect((await db.select().from(orders).where(eq(orders.id, attempt.orderId)))[0].stripeSessionId).toBeNull();
    expect(await db.select().from(enrollments).where(eq(enrollments.orderId, attempt.orderId))).toHaveLength(0);
    expect(await reconciliationHistory(admin, attempt.orderId)).toHaveLength(0);
  });
  it("observes an expired session without payment and refuses to replace its binding", async () => {
    const { db, admin, attempt, stripe, session, retrieve } = await fixture();
    retrieve.mockResolvedValue({ ...session, status: "expired", payment_status: "unpaid", payment_intent: null });
    expect(await reconcilePayment(stripe, admin, attempt.orderId, session.id)).toEqual({ status: "cancelled" });
    await expect(reconcilePayment(stripe, admin, attempt.orderId, "cs_test_different")).rejects.toThrow("autre session");
    expect(await db.select().from(trainingLicenses).where(eq(trainingLicenses.orderId, attempt.orderId))).toHaveLength(0);
  });
  it("does not grant a refunded charge even when the refund webhook was lost", async () => {
    const { db, admin, attempt, stripe, session, retrieve, charge } = await fixture();
    retrieve.mockResolvedValue({ ...session, payment_intent: { ...(session.payment_intent as Stripe.PaymentIntent), latest_charge: { ...charge, amount_refunded: 12000, refunded: true } } });
    expect(await reconcilePayment(stripe, admin, attempt.orderId, session.id)).toEqual({ status: "refunded" });
    const order = (await db.select().from(orders).where(eq(orders.id, attempt.orderId)))[0];
    expect(order.refundedAmountCents).toBe(12000);
    expect(await db.select().from(trainingLicenses).where(eq(trainingLicenses.orderId, attempt.orderId))).toHaveLength(0);
  });
  it("keeps partial refunds accessible, revokes a later full refund, and refuses disputed activation", async () => {
    const { db, admin, attempt, stripe, session, retrieve, charge } = await fixture();
    retrieve.mockResolvedValue({ ...session, payment_intent: { ...(session.payment_intent as Stripe.PaymentIntent), latest_charge: { ...charge, disputed: true } } });
    await expect(reconcilePayment(stripe, admin, attempt.orderId, session.id)).rejects.toThrow("contesté");
    retrieve.mockResolvedValue({ ...session, payment_intent: { ...(session.payment_intent as Stripe.PaymentIntent), latest_charge: { ...charge, amount_refunded: 3000 } } });
    expect(await reconcilePayment(stripe, admin, attempt.orderId, session.id)).toEqual({ status: "paid" });
    expect((await db.select().from(trainingLicenses).where(eq(trainingLicenses.orderId, attempt.orderId)))[0].revokedAt).toBeNull();
    retrieve.mockResolvedValue({ ...session, payment_intent: { ...(session.payment_intent as Stripe.PaymentIntent), latest_charge: { ...charge, amount_refunded: 12000, refunded: true } } });
    expect(await reconcilePayment(stripe, admin, attempt.orderId)).toEqual({ status: "refunded" });
    expect((await db.select().from(trainingLicenses).where(eq(trainingLicenses.orderId, attempt.orderId)))[0].revokedAt).toBeInstanceOf(Date);
  });

});
