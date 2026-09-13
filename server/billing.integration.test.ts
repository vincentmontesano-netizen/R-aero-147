import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "./db";
import { affiliations, companies, users } from "../drizzle/schema";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
const provider = vi.hoisted(() => ({ checkout: vi.fn(), portal: vi.fn(), refresh: vi.fn() }));
vi.mock("./subscription", () => ({ createSubscriptionCheckoutSession: provider.checkout, createBillingPortalSession: provider.portal, confirmSubscription: provider.refresh }));
const url = process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)("organization billing · PostgreSQL", () => {
  beforeAll(() => { process.env.DATABASE_URL = url!; });
  beforeEach(() => {
    provider.checkout.mockReset().mockResolvedValue({ url: "https://checkout.stripe.test/session" });
    provider.portal.mockReset().mockResolvedValue({ url: "https://billing.stripe.test/session" });
    provider.refresh.mockReset().mockResolvedValue({ status: "active" });
  });
  async function fixture() {
    const db = (await getDb())!;
    const [a, b, foreign] = await db.insert(companies).values([{ name: "Billing A" }, { name: "Billing B", stripeCustomerId: "cus_private", stripeSubscriptionId: "sub_private" }, { name: "Foreign billing" }]).returning();
    const [manager, member, legacy] = await db.insert(users).values([{ openId: randomUUID(), companyId: a.id, email: `${randomUUID()}@example.test` }, { openId: randomUUID(), companyId: b.id }, { openId: randomUUID(), companyId: b.id, role: "company_manager" }]).returning();
    await db.insert(affiliations).values([{ personId: manager.id, orgId: a.id, role: "MANAGER" }, { personId: manager.id, orgId: b.id, role: "MANAGER" }, { personId: member.id, orgId: b.id, role: "MEMBER" }]);
    const caller = (user: typeof manager) => appRouter.createCaller({ user, affiliations: [], req: { headers: {} }, res: {} } as unknown as TrpcContext);
    return { db, a, b, foreign, manager, member, legacy, caller };
  }
  it("selects billing organizations through current manager affiliations and passes the selected ID to Stripe operations", async () => {
    const { a, b, foreign, manager, caller } = await fixture();
    const api = caller(manager).billing;
    expect((await api.organizations()).map(o => o.id)).toEqual(expect.arrayContaining([a.id, b.id]));
    expect((await api.organizations()).map(o => o.id)).not.toContain(foreign.id);
    const view = await api.subscription({ companyId: b.id });
    expect(view).toMatchObject({ companyId: b.id, hasStripeCustomer: true, hasStripeSubscription: true });
    expect(view).not.toHaveProperty("stripeCustomerId");
    expect(view).not.toHaveProperty("stripeSubscriptionId");
    await api.checkout({ companyId: b.id, plan: "standard", origin: "https://academy.example.test" });
    expect(provider.checkout).toHaveBeenCalledWith({ companyId: b.id, plan: "standard", origin: "https://academy.example.test", billingPage: true, userId: manager.id, userEmail: manager.email });
    await api.portal({ companyId: b.id, origin: "https://academy.example.test" });
    expect(provider.portal).toHaveBeenCalledWith(b.id, "https://academy.example.test", true);
    await api.refresh({ companyId: b.id });
    expect(provider.refresh).toHaveBeenCalledWith(b.id);
  });
  it("rejects members, legacy role-only access, foreign companies and revoked affiliations before provider calls", async () => {
    const { db, b, foreign, manager, member, legacy, caller } = await fixture();
    for (const [actor, companyId] of [[member, b.id], [legacy, b.id], [manager, foreign.id]] as const) {
      const api = caller(actor).billing;
      await expect(api.subscription({ companyId })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(api.checkout({ companyId, plan: "standard", origin: "https://academy.example.test" })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(api.portal({ companyId, origin: "https://academy.example.test" })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(api.refresh({ companyId })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(api.expire({ companyId, attemptId: randomUUID() })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(caller(member).company.subscription()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await db.update(affiliations).set({ status: "INACTIVE" }).where(and(eq(affiliations.personId, manager.id), eq(affiliations.orgId, b.id)));
    expect((await caller(manager).billing.organizations()).map(o => o.id)).not.toContain(b.id);
    await expect(caller(manager).billing.refresh({ companyId: b.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(provider.checkout).not.toHaveBeenCalled();
    expect(provider.portal).not.toHaveBeenCalled();
    expect(provider.refresh).not.toHaveBeenCalled();
  });
});
