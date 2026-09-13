import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { companies } from "../drizzle/schema";
import { getDb } from "./db";
import { handleSubscriptionWebhookEvent, reconcileSubscription, subscriptionTerms, confirmSubscription, createSubscriptionCheckoutSession, createBillingPortalSession } from "./subscription";
const mock = vi.hoisted(() => ({ retrieve: vi.fn(), checkout: vi.fn(), portal: vi.fn() }));
vi.mock("./stripe", () => ({ getStripe: () => ({ subscriptions: { retrieve: mock.retrieve }, checkout: { sessions: { create: mock.checkout } }, billingPortal: { sessions: { create: mock.portal } } }) }));
const url = process.env.RAERO_TEST_DATABASE_URL;
const stripe = { subscriptions: { retrieve: mock.retrieve } } as unknown as Stripe;
function event(type: string, object: unknown) { return { type, data: { object } } as Stripe.Event; }
describe.skipIf(!url)("subscription reconciliation · PostgreSQL", () => {
  beforeAll(() => {
    process.env.DATABASE_URL = url!;
    vi.stubEnv("STRIPE_PRICE_STANDARD_SEAT", "price_standard_fixture");
    vi.stubEnv("STRIPE_PRICE_ALL_INCLUSIVE", "price_all_fixture");
  });
  beforeEach(() => { mock.retrieve.mockReset(); mock.checkout.mockReset(); mock.portal.mockReset(); });
  afterAll(() => vi.unstubAllEnvs());
  async function fixture() {
    const db = (await getDb())!;
    const [company] = await db.insert(companies).values({ name: "Subscription test", stripeCustomerId: `cus_${randomUUID()}`, stripeSubscriptionId: `sub_${randomUUID()}` }).returning();
    const sub = {
      id: company.stripeSubscriptionId!, customer: company.stripeCustomerId!, status: "active",
      metadata: { company_id: String(company.id), plan: "all_inclusive" },
      items: { has_more: false, data: [{ quantity: 2, current_period_end: Math.floor(Date.now() / 1000) + 3600, price: { id: "price_standard_fixture", currency: "eur", recurring: { interval: "month" } } }] },
      latest_invoice: { id: "in_fixture", status: "paid", currency: "eur", customer: company.stripeCustomerId!, parent: { subscription_details: { subscription: company.stripeSubscriptionId! } } },
    } as unknown as Stripe.Subscription;
    const read = async () => (await db.select().from(companies).where(eq(companies.id, company.id)))[0];
    mock.retrieve.mockResolvedValue(sub);
    return { db, company, sub, read };
  }
  it("derives plan and item expiry from configured prices, ignoring the metadata plan", async () => {
    const { company, sub, read } = await fixture();
    expect(await reconcileSubscription(stripe, company.id, sub.id)).toBe("active");
    expect(await read()).toMatchObject({ subscriptionType: "standard", subscriptionStatus: "active", subscriptionQuantity: 2, subscriptionExpiresAt: new Date(sub.items.data[0].current_period_end * 1000) });
    for (const price of ["price_unknown", ""]) {
      sub.items.data[0].price.id = price;
      expect(await reconcileSubscription(stripe, company.id, sub.id)).toBe("requires_review");
      expect((await read()).subscriptionType).toBe("none");
    }
  });
  it("does not grant access for unpaid, foreign, expired or trial subscriptions", async () => {
    const { company, sub, read } = await fixture();
    const patches = [
      { status: "trialing" },
      { latest_invoice: { ...sub.latest_invoice as Stripe.Invoice, status: "open" } },
      { latest_invoice: { ...sub.latest_invoice as Stripe.Invoice, parent: null } },
      { latest_invoice: { ...sub.latest_invoice as Stripe.Invoice, customer: "cus_foreign" } },
      { items: { ...sub.items, data: [{ ...sub.items.data[0], current_period_end: 1 }] } },
    ];
    for (const patch of patches) {
      mock.retrieve.mockResolvedValue({ ...sub, ...patch });
      await reconcileSubscription(stripe, company.id, sub.id);
      expect((await read()).subscriptionType).toBe("none");
    }
    mock.retrieve.mockResolvedValue({ ...sub, metadata: { company_id: "99999999" } });
    await expect(reconcileSubscription(stripe, company.id, sub.id)).rejects.toThrow("incohérentes");
    mock.retrieve.mockResolvedValue(sub);
    await expect(reconcileSubscription(stripe, company.id, sub.id, "cus_foreign")).rejects.toThrow("incohérentes");
  });
  it("reconciles delayed updates and failures against current state, including cancellation", async () => {
    const { company, sub, read } = await fixture();
    mock.retrieve.mockResolvedValue({ ...sub, status: "canceled" });
    await handleSubscriptionWebhookEvent(event("customer.subscription.updated", sub));
    expect(await read()).toMatchObject({ subscriptionType: "none", subscriptionStatus: "canceled" });
    mock.retrieve.mockResolvedValue(sub);
    await handleSubscriptionWebhookEvent(event("invoice.payment_failed", sub.latest_invoice));
    expect(await read()).toMatchObject({ subscriptionType: "standard", subscriptionStatus: "active" });
    mock.retrieve.mockResolvedValue({ ...sub, status: "past_due" });
    await handleSubscriptionWebhookEvent(event("invoice.paid", sub.latest_invoice));
    expect(await read()).toMatchObject({ subscriptionType: "none", subscriptionStatus: "past_due" });
    mock.retrieve.mockRejectedValue(new Error("provider unavailable"));
    expect(await confirmSubscription(company.id)).toEqual({ status: "requires_review" });
    expect((await read()).subscriptionStatus).toBe("past_due");
  });
  it("ignores standalone invoices and never overwrites the current subscription with an old checkout/deletion", async () => {
    const { sub, read } = await fixture();
    await reconcileSubscription(stripe, Number(sub.metadata.company_id), sub.id);
    mock.retrieve.mockClear();
    await handleSubscriptionWebhookEvent(event("invoice.paid", { ...(sub.latest_invoice as Stripe.Invoice), parent: null }));
    await handleSubscriptionWebhookEvent(event("customer.subscription.deleted", { ...sub, id: "sub_old", status: "canceled" }));
    await handleSubscriptionWebhookEvent(event("checkout.session.completed", { mode: "subscription", client_reference_id: sub.metadata.company_id, subscription: "sub_old", customer: sub.customer }));
    expect(mock.retrieve).not.toHaveBeenCalled();
    expect(await read()).toMatchObject({ stripeSubscriptionId: sub.id, subscriptionType: "standard" });
  });
  it("serializes concurrent retrievals so a slower request cannot overwrite a later cancellation", async () => {
    const { company, sub, read } = await fixture();
    let release!: () => void;
    let entered!: () => void;
    const firstEntered = new Promise<void>(resolve => { entered = resolve; });
    mock.retrieve.mockImplementationOnce(async () => { entered(); await new Promise<void>(resolve => { release = resolve; }); return sub; });
    mock.retrieve.mockResolvedValue({ ...sub, status: "canceled" });
    const first = reconcileSubscription(stripe, company.id, sub.id);
    await firstEntered;
    const second = reconcileSubscription(stripe, company.id, sub.id);
    release();
    await Promise.all([first, second]);
    expect(await read()).toMatchObject({ subscriptionType: "none", subscriptionStatus: "canceled" });
  });
  it("rejects ambiguous/multiple prices, invalid quantities and non-EUR or non-recurring items", async () => {
    const { sub } = await fixture();
    const item = sub.items.data[0];
    for (const patched of [
      { ...item, quantity: 0 }, { ...item, quantity: 1.5 },
      { ...item, price: { ...item.price, recurring: null } },
      { ...item, price: { ...item.price, currency: "usd" } },
      { ...item, price: { ...item.price, id: "price_all_fixture" } },
    ]) expect(subscriptionTerms({ ...sub, items: { ...sub.items, data: [patched] } } as Stripe.Subscription)).toBeNull();
    expect(subscriptionTerms({ ...sub, items: { ...sub.items, has_more: true } })).toBeNull();
    expect(subscriptionTerms({ ...sub, items: { ...sub.items, data: [item, item] } })).toBeNull();
  });
  it("returns billing sessions to the selected company and refuses a second checkout for an already bound subscription", async () => {
    const { db, company } = await fixture();
    const params = { companyId: company.id, origin: "http://localhost:3174", plan: "standard" as const, billingPage: true };
    await expect(createSubscriptionCheckoutSession(params)).rejects.toThrow("déjà rattaché");
    expect(mock.checkout).not.toHaveBeenCalled();
    await db.update(companies).set({ stripeSubscriptionId: null }).where(eq(companies.id, company.id));
    mock.checkout.mockImplementation(async payload => ({ id: `cs_${randomUUID()}`, mode: "subscription", status: "open", customer: payload.customer, client_reference_id: payload.client_reference_id, metadata: payload.metadata, url: "https://checkout.stripe.test/session" }));
    await createSubscriptionCheckoutSession(params);
    expect(mock.checkout).toHaveBeenCalledWith(expect.objectContaining({ client_reference_id: String(company.id), customer: company.stripeCustomerId, success_url: `http://localhost:3174/abonnements?companyId=${company.id}&subscription=success`, cancel_url: `http://localhost:3174/abonnements?companyId=${company.id}&subscription=cancelled` }), expect.objectContaining({ idempotencyKey: expect.stringContaining("raero-subscription-") }));
    mock.portal.mockResolvedValue({ url: "https://billing.stripe.test/session" });
    await createBillingPortalSession(company.id, params.origin, true);
    expect(mock.portal).toHaveBeenCalledWith({ customer: company.stripeCustomerId, return_url: `http://localhost:3174/abonnements?companyId=${company.id}` });
  });

});
