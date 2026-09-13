import { beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { companies, employees, subscriptionCheckouts, subscriptionCheckoutClosures, users } from "../drizzle/schema";
import { prepareSubscriptionCheckout, resumeSubscriptionCheckout, pendingSubscriptionCheckout } from "./subscriptionCheckout";
const url = process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)("durable subscription checkout · PostgreSQL", () => {
  beforeAll(() => { process.env.DATABASE_URL = url!; });
  async function fixture() {
    const db = (await getDb())!;
    const [company] = await db.insert(companies).values({ name: "Durable subscription", stripeCustomerId: `cus_${randomUUID()}` }).returning();
    const input = { companyId: company.id, plan: "standard" as const, origin: "http://localhost:3174", billingPage: true };
    const [actor] = await db.insert(users).values({ openId: randomUUID() }).returning();
    const create = vi.fn(), retrieve = vi.fn(), sub = vi.fn(), expire = vi.fn();
    const stripe = { checkout: { sessions: { create, retrieve, expire } }, subscriptions: { retrieve: sub } } as unknown as Stripe;
    const openSession = (payload: Stripe.Checkout.SessionCreateParams) => ({ id: `cs_${randomUUID()}`, status: "open", mode: "subscription", customer: payload.customer, client_reference_id: payload.client_reference_id, metadata: payload.metadata, url: "https://checkout.stripe.test/session" });
    return { db, company, input, create, retrieve, sub, stripe, openSession, expire, actor };
  }
  it("persists once under concurrency and retries a lost response with the identical payload/key despite roster changes", async () => {
    const { db, company, input, create, retrieve, stripe, openSession } = await fixture();
    const [a, b] = await Promise.all([prepareSubscriptionCheckout(input, "price_fixture"), prepareSubscriptionCheckout(input, "price_fixture")]);
    expect(a.id).toBe(b.id);
    const session = openSession(a.payload);
    create.mockRejectedValueOnce(new Error("response lost"));
    await expect(resumeSubscriptionCheckout(stripe, company.id, a.id)).rejects.toThrow("response lost");
    expect((await pendingSubscriptionCheckout(company.id))?.sessionId).toBeNull();
    await db.insert(employees).values([1, 2].map(n => ({ companyId: company.id, firstName: "Added", lastName: String(n), email: `${randomUUID()}@example.test` })));
    const retry = await prepareSubscriptionCheckout(input, "price_changed");
    expect(retry).toEqual(a);
    create.mockResolvedValue(session);
    retrieve.mockResolvedValue(session);
    await Promise.all([resumeSubscriptionCheckout(stripe, company.id, a.id), resumeSubscriptionCheckout(stripe, company.id, a.id)]);
    expect(create).toHaveBeenCalledTimes(2); // failed request + exact retry, then retrieval
    expect(create.mock.calls[0]).toEqual(create.mock.calls[1]);
    expect(create.mock.calls[1]).toEqual([a.payload, { idempotencyKey: a.requestKey }]);
    expect(retrieve).toHaveBeenCalledWith(session.id);
    await expect(db.update(subscriptionCheckouts).set({ quantity: 99 }).where(eq(subscriptionCheckouts.id, a.id))).rejects.toThrow();
    await expect(db.delete(subscriptionCheckouts).where(eq(subscriptionCheckouts.id, a.id))).rejects.toThrow();
    await expect(prepareSubscriptionCheckout({ ...input, plan: "all_inclusive" }, "price_all")).rejects.toThrow("déjà en cours");
  });
  it("allows a new attempt only after verified expiry and refuses foreign/mismatched sessions", async () => {
    const { db, company, input, create, stripe, openSession } = await fixture();
    const a = await prepareSubscriptionCheckout(input, "price_fixture");
    create.mockResolvedValue({ ...openSession(a.payload), client_reference_id: "999999" });
    await expect(resumeSubscriptionCheckout(stripe, company.id, a.id)).rejects.toThrow("incohérentes");
    expect((await pendingSubscriptionCheckout(company.id))?.sessionId).toBeNull();
    await expect(resumeSubscriptionCheckout(stripe, company.id + 99999, a.id)).rejects.toThrow("introuvable");
    create.mockResolvedValue({ ...openSession(a.payload), status: "expired", url: null });
    await expect(resumeSubscriptionCheckout(stripe, company.id, a.id)).rejects.toThrow("expiré");
    expect(await pendingSubscriptionCheckout(company.id)).toBeNull();
    const next = await prepareSubscriptionCheckout({ ...input, plan: "all_inclusive" }, "price_all");
    expect(next.id).not.toBe(a.id);
    expect(await db.select().from(subscriptionCheckouts).where(eq(subscriptionCheckouts.companyId, company.id))).toHaveLength(2);
    await expect(db.update(subscriptionCheckouts).set({ status: "pending" }).where(eq(subscriptionCheckouts.id, a.id))).rejects.toThrow();
  });
  it("reconciles a completed session without a webhook and retains it for retry if the provider read fails", async () => {
    const { company, input, create, retrieve, sub, stripe, openSession } = await fixture();
    const a = await prepareSubscriptionCheckout(input, "price_fixture");
    const session = { ...openSession(a.payload), status: "complete", subscription: `sub_${randomUUID()}`, url: null };
    create.mockResolvedValue(session); retrieve.mockResolvedValue(session);
    sub.mockRejectedValueOnce(new Error("temporary read failure"));
    await expect(resumeSubscriptionCheckout(stripe, company.id, a.id)).rejects.toThrow("temporary read failure");
    expect((await pendingSubscriptionCheckout(company.id))?.status).toBe("complete");
    expect((await prepareSubscriptionCheckout(input, "price_fixture")).id).toBe(a.id);
    sub.mockResolvedValue({ id: session.subscription, customer: company.stripeCustomerId, metadata: { company_id: String(company.id) }, status: "incomplete", items: { has_more: false, data: [] }, latest_invoice: null });
    expect(await resumeSubscriptionCheckout(stripe, company.id, a.id, false)).toEqual({ status: "incomplete", url: a.payload.success_url });
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("never recreates an unlinked attempt after its safe retry window", async () => {
    const { db, company, input, create, stripe } = await fixture();
    const id = randomUUID();
    await db.insert(subscriptionCheckouts).values({ id, companyId: company.id, plan: input.plan, quantity: 1, requestKey: `expired-${id}`, payload: { mode: "subscription" }, retryUntil: new Date(1) });
    await expect(resumeSubscriptionCheckout(stripe, company.id, id)).rejects.toThrow("rapprocher");
    expect(create).not.toHaveBeenCalled();
    expect((await prepareSubscriptionCheckout(input, "price_fixture")).id).toBe(id);
  });
  it("closes a known open session once under concurrency and preserves who requested closure", async () => {
    const { db, company, input, create, retrieve, stripe, openSession, expire, actor } = await fixture();
    const a = await prepareSubscriptionCheckout(input, "price_fixture");
    const session = openSession(a.payload);
    create.mockResolvedValue(session); retrieve.mockResolvedValue(session);
    await resumeSubscriptionCheckout(stripe, company.id, a.id);
    expire.mockResolvedValue({ ...session, status: "expired", url: null });
    const results = await Promise.all([1, 2].map(() => resumeSubscriptionCheckout(stripe, company.id, a.id, false, actor.id)));
    expect(results.map(r => r.status)).toEqual(["expired", "expired"]);
    expect(expire).toHaveBeenCalledTimes(1);
    const [closure] = await db.select().from(subscriptionCheckoutClosures).where(eq(subscriptionCheckoutClosures.attemptId, a.id));
    expect(closure).toMatchObject({ requestedBy: actor.id, observedStatus: "expired" });
    await expect(db.delete(subscriptionCheckoutClosures).where(eq(subscriptionCheckoutClosures.attemptId, a.id))).rejects.toThrow();
    expect((await prepareSubscriptionCheckout({ ...input, plan: "all_inclusive" }, "price_all")).id).not.toBe(a.id);
  });
  it("does not claim closure when Stripe still reports open or a payment wins the race", async () => {
    const { db, company, input, create, retrieve, stripe, openSession, expire, actor, sub } = await fixture();
    const a = await prepareSubscriptionCheckout(input, "price_fixture");
    await expect(resumeSubscriptionCheckout(stripe, company.id, a.id, false, actor.id)).rejects.toThrow("rapprocher");
    expect(create).not.toHaveBeenCalled();
    const session = openSession(a.payload);
    create.mockResolvedValue(session); retrieve.mockResolvedValue(session);
    await resumeSubscriptionCheckout(stripe, company.id, a.id);
    expire.mockRejectedValue(new Error("provider timeout"));
    await expect(resumeSubscriptionCheckout(stripe, company.id, a.id, false, actor.id)).rejects.toThrow("non confirmée");
    expect((await pendingSubscriptionCheckout(company.id))?.status).toBe("pending");
    expect(await db.select().from(subscriptionCheckoutClosures).where(eq(subscriptionCheckoutClosures.attemptId, a.id))).toHaveLength(0);
    const complete = { ...session, status: "complete", subscription: `sub_${randomUUID()}`, url: null };
    retrieve.mockResolvedValueOnce(session).mockResolvedValueOnce(complete);
    sub.mockResolvedValue({ id: complete.subscription, customer: company.stripeCustomerId, metadata: { company_id: String(company.id) }, status: "incomplete", items: { has_more: false, data: [] }, latest_invoice: null });
    expect((await resumeSubscriptionCheckout(stripe, company.id, a.id, false, actor.id)).status).toBe("incomplete");
    expect((await pendingSubscriptionCheckout(company.id))?.status).toBe("complete");
    expect((await db.select().from(subscriptionCheckoutClosures).where(eq(subscriptionCheckoutClosures.attemptId, a.id)))[0]).toMatchObject({ observedStatus: "complete", requestedBy: actor.id });
  });

});
