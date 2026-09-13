import { beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { getDb, updateTraining } from "./db";
import { prepareCartCheckout, prepareQuoteCheckout, resumeOrderCheckout } from "./checkoutAttempts";
import { users, trainings, orders, orderItems, checkoutAttempts, quoteRequests, quoteStatusEvents, messages } from "../drizzle/schema";
const url = process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)("checkout preparation and recovery · PostgreSQL", () => {
  beforeAll(() => { process.env.DATABASE_URL = url!; });
  async function fixture() {
    const db = (await getDb())!;
    const [user] = await db.insert(users).values({ openId: randomUUID() }).returning();
    const [course] = await db.insert(trainings).values({ slug: randomUUID(), title: "Checkout fixture", type: "webinar", priceHt: "100.00", priceTtc: "120.00" }).returning();
    await updateTraining(course.id, { isPublished: true });
    const [training] = await db.select().from(trainings).where(eq(trainings.id, course.id));
    const params = { userId: user.id, userEmail: "fixture@example.test", userName: "Fixture", origin: "http://localhost:3174", cartItems: [{ id: 1, trainingId: training.id, quantity: 1, training }] };
    return { db, user, training, params };
  }
  function gateway(attempt: Awaited<ReturnType<typeof prepareCartCheckout>>) {
    const session = { id: `cs_test_${randomUUID()}`, status: "open", url: "https://checkout.stripe.com/test-only", client_reference_id: String(attempt.payload.client_reference_id), metadata: attempt.payload.metadata, success_url: attempt.payload.success_url } as Stripe.Checkout.Session;
    const create = vi.fn().mockResolvedValue(session);
    const retrieve = vi.fn().mockResolvedValue(session);
    return { stripe: { checkout: { sessions: { create, retrieve } } } as unknown as Stripe, create, retrieve, session };
  }
  it("creates one complete order for concurrent retries and freezes the request", async () => {
    const { db, params } = await fixture();
    const [a, b] = await Promise.all([prepareCartCheckout(params), prepareCartCheckout(params)]);
    expect(a.orderId).toBe(b.orderId);
    expect(await db.select().from(orders).where(eq(orders.userId, params.userId))).toHaveLength(1);
    expect(await db.select().from(orderItems).where(eq(orderItems.orderId, a.orderId))).toHaveLength(1);
    expect(a.payload).toEqual(b.payload);
    await expect(db.update(checkoutAttempts).set({ fingerprint: "mutated" }).where(eq(checkoutAttempts.orderId, a.orderId))).rejects.toThrow();
  });
  it("rolls back the whole cart when a later course is invalid and rejects stale prices", async () => {
    const { db, params, training } = await fixture();
    await expect(prepareCartCheckout({ ...params, cartItems: [...params.cartItems, { ...params.cartItems[0], trainingId: 2147483647 }] })).rejects.toThrow();
    expect(await db.select().from(orders).where(eq(orders.userId, params.userId))).toHaveLength(0);
    await updateTraining(training.id, { priceTtc: "150.00" });
    await expect(prepareCartCheckout(params)).rejects.toThrow("catalogue");
    expect(await db.select().from(orders).where(eq(orders.userId, params.userId))).toHaveLength(0);
  });
  it("reuses the exact Stripe key/body after a lost response and retrieves the saved session", async () => {
    const { params, user } = await fixture();
    const attempt = await prepareCartCheckout(params);
    const { stripe, create, retrieve, session } = gateway(attempt);
    create.mockRejectedValueOnce(new Error("Lost response"));
    const actor = { id: user.id, role: "user" };
    await expect(resumeOrderCheckout(stripe, actor, attempt.orderId)).rejects.toThrow("Lost response");
    const retry = await prepareCartCheckout(params);
    expect(retry.orderId).toBe(attempt.orderId);
    expect(await resumeOrderCheckout(stripe, actor, retry.orderId)).toEqual({ orderId: attempt.orderId, url: session.url });
    expect(create.mock.calls[0]).toEqual(create.mock.calls[1]);
    expect(create.mock.calls[0][1]).toEqual({ idempotencyKey: attempt.requestKey });
    await resumeOrderCheckout(stripe, actor, attempt.orderId);
    expect(create).toHaveBeenCalledTimes(2);
    expect(retrieve).toHaveBeenCalledWith(session.id);
    await expect(resumeOrderCheckout(stripe, { id: user.id + 999999, role: "admin" }, attempt.orderId)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("requires reconciliation for an old unlinked request and cancels only a verified expired session", async () => {
    const { db, params, user } = await fixture();
    const attempt = await prepareCartCheckout(params);
    const { stripe, create, retrieve, session } = gateway(attempt);
    const actor = { id: user.id, role: "user" };
    vi.spyOn(Date, "now").mockReturnValue(attempt.retryUntil.getTime() + 1);
    try { await expect(resumeOrderCheckout(stripe, actor, attempt.orderId)).rejects.toThrow("rapprochée"); }
    finally { vi.restoreAllMocks(); }
    expect(create).not.toHaveBeenCalled();
    await db.update(orders).set({ stripeSessionId: session.id }).where(eq(orders.id, attempt.orderId));
    retrieve.mockResolvedValue({ ...session, status: "expired", url: null });
    await expect(resumeOrderCheckout(stripe, actor, attempt.orderId)).rejects.toThrow("expirée");
    expect((await db.select().from(orders).where(eq(orders.id, attempt.orderId)))[0].status).toBe("cancelled");
    const next = await prepareCartCheckout(params);
    expect(next.orderId).not.toBe(attempt.orderId);
  });
  async function quoteFixture() {
    const f = await fixture();
    const [admin] = await f.db.insert(users).values({ openId: randomUUID(), role: "admin" }).returning();
    const [quote] = await f.db.insert(quoteRequests).values({ userId: f.user.id, companyName: "Quote fixture", contactName: "Fixture", contactEmail: "fixture@example.test" }).returning();
    const params = { ...f.params, quoteId: quote.id, actor: { id: admin.id, role: "admin" }, items: [{ trainingId: f.training.id, title: "Negotiated training", quantity: 1, unitPriceHt: 80.25, unitPriceTtc: 96.30 }] };
    return { ...f, quote, params };
  }
  it("converts a quote once under concurrency with negotiated cents and one thread message", async () => {
    const { db, params, quote } = await quoteFixture();
    const [a, b] = await Promise.all([prepareQuoteCheckout(params), prepareQuoteCheckout(params)]);
    expect(a.orderId).toBe(b.orderId);
    const order = (await db.select().from(orders).where(eq(orders.id, a.orderId)))[0];
    expect(order.totalTtc).toBe("96.30");
    expect(order.totalHt).toBe("80.25");
    expect(await db.select().from(orderItems).where(eq(orderItems.orderId, a.orderId))).toHaveLength(1);
    expect(await db.select().from(messages).where(eq(messages.quoteRequestId, quote.id))).toHaveLength(1);
    expect((await db.select().from(quoteRequests).where(eq(quoteRequests.id, quote.id)))[0].status).toBe("accepted");
    const history=await db.select().from(quoteStatusEvents).where(eq(quoteStatusEvents.quoteId,quote.id));
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({actorId:params.actor.id,previousStatus:"received",status:"accepted",revision:1});
    await expect(prepareQuoteCheckout({ ...params, items: [{ ...params.items[0], unitPriceTtc: 99 }] })).rejects.toThrow("existe déjà");
    expect(await db.select().from(orders).where(eq(orders.quoteRequestId, quote.id))).toHaveLength(1);
  });
  it("rolls back invalid quotes and rejects unauthorized actors, wrong buyers and rounded prices", async () => {
    const { db, params, quote } = await quoteFixture();
    await expect(prepareQuoteCheckout({ ...params, actor: { ...params.actor, role: "user" } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(prepareQuoteCheckout({ ...params, userId: params.actor.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(prepareQuoteCheckout({ ...params, items: [...params.items, { ...params.items[0], trainingId: 2147483647 }] })).rejects.toThrow();
    await expect(prepareQuoteCheckout({ ...params, items: [{ ...params.items[0], unitPriceTtc: 96.301 }] })).rejects.toThrow("Montant");
    expect(await db.select().from(orders).where(eq(orders.quoteRequestId, quote.id))).toHaveLength(0);
    expect(await db.select().from(messages).where(eq(messages.quoteRequestId, quote.id))).toHaveLength(0);
    expect(await db.select().from(quoteStatusEvents).where(eq(quoteStatusEvents.quoteId,quote.id))).toHaveLength(0);
    await db.update(users).set({status:"suspended"}).where(eq(users.id,params.actor.id));
    await expect(prepareQuoteCheckout(params)).rejects.toMatchObject({code:"FORBIDDEN"});
    expect((await db.select().from(quoteRequests).where(eq(quoteRequests.id, quote.id)))[0].status).toBe("received");
  });
  it("keeps the quoted version on retry and prevents a second order for a settled quote", async () => {
    const { db, params, quote, training } = await quoteFixture();
    const attempt = await prepareQuoteCheckout(params);
    await updateTraining(training.id, { isPublished: true, title: "Later publication" });
    expect((await prepareQuoteCheckout(params)).orderId).toBe(attempt.orderId);
    await db.update(orders).set({ status: "paid" }).where(eq(orders.id, attempt.orderId));
    await expect(prepareQuoteCheckout(params)).rejects.toThrow("déjà été réglé");
    expect(await db.select().from(orders).where(eq(orders.quoteRequestId, quote.id))).toHaveLength(1);
  });

});
