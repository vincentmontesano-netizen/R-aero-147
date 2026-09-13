import { pendingSubscriptionCheckout, resumeSubscriptionCheckout } from "./subscriptionCheckout";
import { getStripe } from "./stripe";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { affiliations, companies } from "../drizzle/schema";
import { getDb, getSubscriptionViewForCompany } from "./db";
import { requireManagedCompany } from "./companyTraining";
import { confirmSubscription, createBillingPortalSession, createSubscriptionCheckoutSession } from "./subscription";
const companyInput = z.object({ companyId: z.number().int().positive() });
export const billingRouter = router({
  organizations: protectedProcedure.query(async ({ ctx }) => {
    const db = (await getDb())!;
    const fields = { id: companies.id, name: companies.name };
    if (ctx.user.role === "admin") return db.select(fields).from(companies).where(eq(companies.status, "ACTIVE")).orderBy(companies.name);
    return db.selectDistinct(fields).from(companies).innerJoin(affiliations, eq(affiliations.orgId, companies.id))
      .where(and(eq(companies.status, "ACTIVE"), eq(affiliations.personId, ctx.user.id), eq(affiliations.role, "MANAGER"), eq(affiliations.status, "ACTIVE"))).orderBy(companies.name);
  }),
  subscription: protectedProcedure.input(companyInput).query(async ({ ctx, input }) => {
    await requireManagedCompany(ctx.user, input.companyId);
    const view = await getSubscriptionViewForCompany(input.companyId);
    const pending = await pendingSubscriptionCheckout(input.companyId);
    return view ? { ...view, pendingCheckout: pending ? { id: pending.id, plan: pending.plan, quantity: pending.quantity, canExpire: !!pending.sessionId && pending.status === "pending", createdAt: pending.createdAt } : null } : null;
  }),
  checkout: protectedProcedure.input(companyInput.extend({ plan: z.enum(["standard", "all_inclusive"]), origin: z.string().url() })).mutation(async ({ ctx, input }) => {
    await requireManagedCompany(ctx.user, input.companyId);
    return createSubscriptionCheckoutSession({ ...input, billingPage: true, userId: ctx.user.id, userEmail: ctx.user.email ?? undefined });
  }),
  resume: protectedProcedure.input(companyInput.extend({ attemptId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    await requireManagedCompany(ctx.user, input.companyId);
    const stripe = getStripe();
    if (!stripe) throw new Error("Stripe indisponible.");
    return resumeSubscriptionCheckout(stripe, input.companyId, input.attemptId);
  }),
  expire: protectedProcedure.input(companyInput.extend({ attemptId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    await requireManagedCompany(ctx.user, input.companyId);
    const stripe = getStripe();
    if (!stripe) throw new Error("Stripe indisponible.");
    return resumeSubscriptionCheckout(stripe, input.companyId, input.attemptId, false, ctx.user.id);
  }),
  portal: protectedProcedure.input(companyInput.extend({ origin: z.string().url() })).mutation(async ({ ctx, input }) => {
    await requireManagedCompany(ctx.user, input.companyId);
    return createBillingPortalSession(input.companyId, input.origin, true);
  }),
  refresh: protectedProcedure.input(companyInput).mutation(async ({ ctx, input }) => {
    await requireManagedCompany(ctx.user, input.companyId);
    return confirmSubscription(input.companyId);
  }),
});
