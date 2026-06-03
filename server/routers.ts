import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { sdk } from "./_core/sdk";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { registerUser, loginUser, sanitizeUser, adminCreateUser, createPasswordReset, resetPasswordWithToken, startTwoFactor, verifyTwoFactorCode, setTwoFactor } from "./auth";
import {
  getPublicTrainings, getFeaturedTrainings, getTrainingBySlug, getTrainingCategories,
  getCartItems, addToCart, removeFromCart, getCartCount, clearCart,
  getUserEnrollments, getEnrollmentById, updateEnrollmentProgress,
  getUserCertificates, getCertificateByCode,
  getCompanyEmployees, createEmployee, updateEmployee,
  getCompanyRecurrencies,
  getQuoteRequests, createQuoteRequest,
  getQuoteById, getMyQuotes, findUserByEmail, getQuoteMessages, createQuoteMessage, markQuoteMessagesRead,
  createSupportTicket, getMyTickets, getAdminTickets, getTicketById, getTicketThread, postTicketMessage, setTicketStatus,
  broadcastNotification, createNotification,
  getAdminUsers, getAdminTrainings, createTraining, updateTraining, deleteTraining,
  getAdminOrders, getAdminQuoteRequests, updateQuoteRequestStatus,
  getWebinars, registerForWebinar,
  getUserCompany, getCompanyById, createOrUpdateCompany,
  getAdminStats,
  getTrainingModules, getModuleProgress, updateModuleProgress,
  getQuizQuestions, submitQuizAttempt, getQuizAttempts,
  updateUserProfile, getUserById, setUserConsents,
  importEmployeesCSV, getAdminUserDetail, getAdminComplianceReport,
  adminCreateModule, adminUpdateModule, adminDeleteModule,
  getObjectives, adminCreateObjective, adminUpdateObjective, adminDeleteObjective, reorderObjectives, getObjectiveCompletion,
  getUserNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead, generateExpiryAlerts,
  getCompanySubscriptionView,
  startExamSession, logProctoringEvent, getExamIntegrity,
  getTechnicianFile, createExternalTraining, deleteExternalTraining,
  surfaceCredentialForPerson, unsurfaceCredentialForPerson, getPersonCredentials, lockSurfacedCredentialsForOrg,
  createSignoff, getSignoffsForSubject, setAffiliationRole, erasePerson,
  getCompanyConsolidated, getRoleRequirements, createRoleRequirement, deleteRoleRequirement, runTNA,
  getCourseTemplates, createCourseFromTemplate, getRegulatoryChanges, createRegulatoryChange, setReviewStatus, getContentRevisions,
  adminCreateQuestion, adminUpdateQuestion, adminDeleteQuestion,
  adminSetUserStatus, adminSetUserRole, adminUpdateUser, countActiveAdmins,
  getAdminOrganizations, adminCreateOrganization, adminUpdateOrganization, adminSetOrganizationStatus, adminDeleteOrganization,
  getOrganizationManagers, addOrganizationManager, removeOrganizationManager,
  getOrganizationAffiliates, addOrganizationAffiliate, getAffiliationById,
  getPassportDocuments, createPassportDocument, deletePassportDocument, setPassportSharing,
  getActiveOffers, getAllOffers, createOffer, updateOffer, deleteOffer,
  getActiveFaq, getAllFaq, createFaqItem, updateFaqItem, deleteFaqItem,
  setSetting,
  getSlides, createSlide, updateSlide, deleteSlide, reorderSlides, createCourseWithSlides,
  getUpcomingSessions, getAllSessions, createSession, updateSession, deleteSession, registerForSession,
  getPublishedArticles, getArticleBySlug, getAllArticles, createArticle, updateArticle, deleteArticle,
} from "./db";
import { generateCataloguePDF } from "./catalogue";
import {
  aiProviderStatus, aiGenerateOutline, aiWriteSlideText, aiGenerateQuiz,
  generateImage, generateSpeech, AIError, type AIProvider,
} from "./ai";
import { createCheckoutSession, confirmCheckoutPayment, createQuoteCheckout } from "./stripe";
import { sendEmail, isEmailConfigured, adminNotifyEmail, simpleEmail, passwordResetEmail, twoFactorCodeEmail } from "./email";
import { fetchInbox, fetchMessage, isInboxConfigured } from "./inbox";
import { rateLimit, rateLimitReset } from "./ratelimit";
import { createSubscriptionCheckoutSession, createBillingPortalSession, confirmSubscription } from "./subscription";
import {
  getLiveAccess, joinLiveRoom, getParticipants, postLiveMessage, getLiveMessages, setMessageAnswered,
  createLivePoll, closeLivePoll, voteLivePoll, getLivePolls, getEngagementScores, setReplayUrl,
} from "./live";
import { issueCertificate } from "./certificate";
import { generateInvoicePDF } from "./invoice";
import { runChat } from "./chatbot";
import {
  assertActiveAffiliation, logAccess, ipFromReq, getOrgScopedView, orgScopedViewForSubject,
  getSelfView, getActiveAffiliations, exportPersonData,
} from "./access";

// Admin guard
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Accès administrateur requis." });
  return next({ ctx });
});

// Staff guard — admins and instructors can author courses.
const staffProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "instructor" && ctx.user.role !== "company_manager")
    throw new TRPCError({ code: "FORBIDDEN", message: "Accès réservé aux formateurs, managers et administrateurs." });
  return next({ ctx });
});

// Live classroom moderator (animateur) = instructor or admin.
const moderatorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "instructor")
    throw new TRPCError({ code: "FORBIDDEN", message: "Réservé à l'animateur." });
  return next({ ctx });
});

// Org manager guard — admin (operator, god-mode, always logged) OR anyone holding an
// ACTIVE MANAGER affiliation. This is a coarse gate; the PER-ORG authorisation (which
// organisation, INV-2) is asserted inside handlers via assertActiveAffiliation. The
// legacy global "company_manager" role is tolerated as a fallback during the transition.
const orgManagerProcedure = protectedProcedure.use(({ ctx, next }) => {
  const isManager = (ctx.affiliations ?? []).some((a) => a.role === "MANAGER" && a.status === "ACTIVE");
  if (ctx.user.role !== "admin" && ctx.user.role !== "company_manager" && !isManager)
    throw new TRPCError({ code: "FORBIDDEN", message: "Accès réservé aux managers d'organisation." });
  return next({ ctx });
});

// Resolve the org a MANAGER administers: their first ACTIVE MANAGER affiliation, or — during
// the legacy transition — the company_manager's own companyId. Throws if none.
function managerOrgId(ctx: any): number {
  const aff = (ctx.affiliations ?? []).find((a: any) => a.role === "MANAGER" && a.status === "ACTIVE");
  const orgId = aff?.orgId ?? ctx.user?.companyId ?? null;
  if (!orgId) throw new TRPCError({ code: "FORBIDDEN", message: "Aucune organisation rattachée à votre compte." });
  return orgId;
}

// ─── Email helpers (fire-and-forget; never block or fail a request) ───────────
function emailBody(text: string, link?: string | null): string {
  const safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>");
  const cta = link ? `<p style="margin-top:16px"><a href="${link}" style="color:#0f1b2d;font-weight:600">Ouvrir dans R-AERO →</a></p>` : "";
  return `<p>${safe}</p>${cta}`;
}
async function notifyAdminEmail(subject: string, bodyHtml: string): Promise<void> {
  try {
    if (!isEmailConfigured()) return;
    const to = adminNotifyEmail();
    if (to) await sendEmail({ to, subject, html: simpleEmail(subject, bodyHtml).html });
  } catch { /* alerts must never break the request */ }
}
async function emailUserById(userId: number | null | undefined, subject: string, bodyHtml: string): Promise<void> {
  try {
    if (!userId || !isEmailConfigured()) return;
    const u = await getUserById(userId);
    if (u?.email) await sendEmail({ to: u.email, subject, html: simpleEmail(subject, bodyHtml).html });
  } catch { /* never break the request */ }
}

function aiErr<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((e: any) => {
    if (e instanceof AIError) throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e?.message ?? "Erreur IA" });
  });
}

export const appRouter = router({
  system: systemRouter,

  // ─── Landing-page assistant (LLM + tool calling) ─────────────────────────────
  chat: router({
    send: publicProcedure
      .input(z.object({ messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1) })).min(1).max(40) }))
      .mutation(async ({ input }) => {
        try { return await runChat(input.messages); }
        catch (e: any) { throw new TRPCError({ code: "BAD_REQUEST", message: e?.message ?? "Assistant indisponible." }); }
      }),
  }),

  // ─── Auth ──────────────────────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query((opts) => (opts.ctx.user ? sanitizeUser(opts.ctx.user) : null)),

    register: publicProcedure
      .input(z.object({
        email: z.string().email("Email invalide."),
        password: z.string().min(8, "Le mot de passe doit comporter au moins 8 caractères."),
        name: z.string().min(2, "Veuillez indiquer votre nom."),
        jobTitle: z.string().optional(),
        licenseNumber: z.string().optional(),
        licenseCategories: z.string().optional(),
        preferredLanguage: z.string().optional(),
        marketingOptIn: z.boolean().optional(),
        // Optionally create an organisation and become its manager.
        organization: z.object({
          name: z.string().min(1),
          type: z.enum(["MRO", "AIRLINE", "CAMO", "OTHER"]).optional(),
          agreementNumber: z.string().optional(),
        }).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        let user;
        try {
          const { organization, ...rest } = input;
          let companyId: number | undefined;
          if (organization?.name) {
            const org = await adminCreateOrganization({ name: organization.name, type: organization.type ?? null, agreementNumber: organization.agreementNumber ?? null, contactEmail: rest.email });
            companyId = org?.id;
          }
          user = await registerUser({ ...rest, companyId, asManager: !!companyId });
          if (companyId && user.email) await addOrganizationAffiliate(companyId, user.email, "MANAGER");
        } catch (err: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
        }
        await notifyAdminEmail(`Nouvelle inscription : ${user.name ?? user.email}`,
          emailBody(`${user.name ?? ""} (${user.email})${input.organization ? "\nOrganisation : " + input.organization.name : ""}`, "/admin"));
        const token = await sdk.createSessionToken(user.openId, { name: user.name ?? "", expiresInMs: ONE_YEAR_MS });
        ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
        return sanitizeUser(user);
      }),

    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string() }))
      .mutation(async ({ ctx, input }) => {
        // Anti brute-force: max 5 attempts / 15 min per IP+email.
        const rlKey = `login:${ipFromReq(ctx.req) ?? "?"}:${input.email.trim().toLowerCase()}`;
        const rl = rateLimit(rlKey, 5, 15 * 60 * 1000);
        if (!rl.ok) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Trop de tentatives. Réessayez dans ${Math.ceil(rl.retryAfterSec / 60)} min.` });
        let user;
        try {
          user = await loginUser(input.email, input.password);
        } catch (err: any) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: err.message });
        }
        rateLimitReset(rlKey);
        // Email 2FA (opt-in): if enabled AND email delivery is possible, send a code and
        // require a second step. If SMTP is down, fall back to direct login (no lockout).
        if ((user as any).twoFactorEnabled && isEmailConfigured()) {
          const code = await startTwoFactor(user.id);
          const { subject, html } = twoFactorCodeEmail({ name: user.name ?? "", code });
          await sendEmail({ to: user.email ?? "", subject, html }).catch(() => {});
          return { twoFactorRequired: true as const, email: user.email };
        }
        const token = await sdk.createSessionToken(user.openId, { name: user.name ?? "", expiresInMs: ONE_YEAR_MS });
        ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
        return sanitizeUser(user);
      }),

    // Second step of email 2FA: exchange the emailed code for a session.
    verifyTwoFactor: publicProcedure
      .input(z.object({ email: z.string().email(), code: z.string().min(4) }))
      .mutation(async ({ ctx, input }) => {
        const rlKey = `2fa:${ipFromReq(ctx.req) ?? "?"}:${input.email.trim().toLowerCase()}`;
        const rl = rateLimit(rlKey, 8, 15 * 60 * 1000);
        if (!rl.ok) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Trop de tentatives. Réessayez dans ${Math.ceil(rl.retryAfterSec / 60)} min.` });
        let user;
        try { user = await verifyTwoFactorCode(input.email, input.code); }
        catch (err: any) { throw new TRPCError({ code: "UNAUTHORIZED", message: err.message }); }
        rateLimitReset(rlKey);
        const token = await sdk.createSessionToken(user.openId, { name: user.name ?? "", expiresInMs: ONE_YEAR_MS });
        ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
        return sanitizeUser(user);
      }),

    // Enable/disable email 2FA for the connected user.
    setTwoFactor: protectedProcedure
      .input(z.object({ enabled: z.boolean() }))
      .mutation(({ ctx, input }) => setTwoFactor(ctx.user.id, input.enabled)),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    // ── Password reset (email link sent from the configured SMTP sender) ──
    requestPasswordReset: publicProcedure
      .input(z.object({ email: z.string().email(), origin: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        // Throttle by IP to prevent reset-email bombing (response stays neutral).
        if (!rateLimit(`reset:${ipFromReq(ctx.req) ?? "?"}`, 5, 15 * 60 * 1000).ok) return { ok: true };
        const reset = await createPasswordReset(input.email);
        // Never reveal whether the email exists; only send when it does + SMTP is set.
        if (reset && isEmailConfigured()) {
          const base = (input.origin || "").replace(/\/$/, "");
          const link = `${base}/reset-password?token=${reset.token}`;
          const { subject, html } = passwordResetEmail({ name: reset.name ?? "", link });
          await sendEmail({ to: input.email.trim().toLowerCase(), subject, html }).catch(() => {});
        }
        return { ok: true };
      }),
    resetPassword: publicProcedure
      .input(z.object({ token: z.string().min(10), password: z.string().min(8, "Le mot de passe doit comporter au moins 8 caractères.") }))
      .mutation(async ({ input }) => {
        try { return await resetPasswordWithToken(input.token, input.password); }
        catch (err: any) { throw new TRPCError({ code: "BAD_REQUEST", message: err.message }); }
      }),
    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        bio: z.string().optional(),
        licenseNumber: z.string().optional(),
        licenseCategories: z.string().optional(),
        typeRatings: z.string().optional(),
        jobTitle: z.string().optional(),
        preferredLanguage: z.string().optional(),
        timezone: z.string().optional(),
        marketingOptIn: z.boolean().optional(),
      }))
      .mutation(({ ctx, input }) => updateUserProfile(ctx.user.id, input)),
  }),

  // ─── Public ────────────────────────────────────────────────────────────────
  public: router({
    trainings: publicProcedure
      .input(z.object({
        type: z.string().optional(),
        domain: z.string().optional(),
        language: z.string().optional(),
        categoryId: z.number().optional(),
        search: z.string().optional(),
      }).optional())
      .query(({ input }) => getPublicTrainings(input ?? {})),

    featuredTrainings: publicProcedure.query(() => getFeaturedTrainings()),

    trainingBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(({ input }) => getTrainingBySlug(input.slug)),

    categories: publicProcedure.query(() => getTrainingCategories()),

    webinars: publicProcedure.query(async () => getWebinars()),

    // Landing-page content (admin-editable). Empty = the client falls back to its defaults.
    offers: publicProcedure
      .input(z.object({ language: z.string().optional() }).optional())
      .query(({ input }) => getActiveOffers(input?.language ?? "fr")),
    faq: publicProcedure
      .input(z.object({ language: z.string().optional() }).optional())
      .query(({ input }) => getActiveFaq(input?.language ?? "fr")),

    verifyCertificate: publicProcedure
      .input(z.object({ code: z.string() }))
      .query(async ({ ctx, input }) => {
        const cert = await getCertificateByCode(input.code);
        // INV-8: log even public certificate verification (a read of the holder's name).
        await logAccess({
          actorId: ctx.user?.id ?? null, actorRole: ctx.user ? ctx.user.role : "PUBLIC",
          subjectPersonId: cert?.userId ?? null, action: "VERIFY_CERTIFICATE",
          dataAccessed: { fields: ["name", "trainingTitle"], code: input.code, found: !!cert },
          ip: ipFromReq(ctx.req),
        });
        return cert;
      }),

    sessions: publicProcedure.query(() => getUpcomingSessions()),
    articles: publicProcedure.query(() => getPublishedArticles()),
    articleBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(({ input }) => getArticleBySlug(input.slug)),
    cataloguePdf: publicProcedure.mutation(async () => {
      const url = await generateCataloguePDF();
      return { url };
    }),
  }),

  // ─── Sessions registration ───────────────────────────────────────────────
  sessions: router({
    register: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(({ ctx, input }) => registerForSession(ctx.user.id, input.sessionId)),
  }),

  // ─── Cart ──────────────────────────────────────────────────────────────────
  cart: router({
    list: protectedProcedure.query(({ ctx }) => getCartItems(ctx.user.id)),
    count: protectedProcedure.query(async ({ ctx }) => { const n = await getCartCount(ctx.user.id); return n; }),
    add: protectedProcedure
      .input(z.object({ trainingId: z.number(), quantity: z.number().default(1) }))
      .mutation(({ ctx, input }) => addToCart(ctx.user.id, input.trainingId, input.quantity)),
    remove: protectedProcedure
      .input(z.object({ itemId: z.number() }))
      .mutation(({ ctx, input }) => removeFromCart(ctx.user.id, input.itemId)),
    clear: protectedProcedure.mutation(({ ctx }) => clearCart(ctx.user.id)),
  }),

  // ─── Checkout (Stripe) ─────────────────────────────────────────────────────
  checkout: router({
    createSession: protectedProcedure
      .input(z.object({ origin: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const items = await getCartItems(ctx.user.id);
        if (!items.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Panier vide." });
        try {
          const result = await createCheckoutSession({
            userId: ctx.user.id,
            userEmail: ctx.user.email ?? "",
            userName: ctx.user.name ?? "",
            cartItems: items as any,
            origin: input.origin,
          });
          return result;
        } catch (err: any) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
        }
      }),

    confirm: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(({ ctx, input }) => confirmCheckoutPayment(input.orderId, ctx.user.id)),

    generateInvoice: protectedProcedure
      .input(z.object({ orderId: z.number(), origin: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const url = await generateInvoicePDF(input.orderId, input.origin);
        return { url };
      }),
  }),

  // ─── Dashboard (individual user) ──────────────────────────────────────────
  dashboard: router({
    enrollments: protectedProcedure.query(({ ctx }) => getUserEnrollments(ctx.user.id)),
    enrollment: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ ctx, input }) => getEnrollmentById(input.id, ctx.user.id)),
    updateProgress: protectedProcedure
      .input(z.object({ enrollmentId: z.number(), progressPercent: z.number(), status: z.string().optional() }))
      .mutation(({ input }) => updateEnrollmentProgress(input.enrollmentId, input.progressPercent, input.status)),
    certificates: protectedProcedure.query(({ ctx }) => getUserCertificates(ctx.user.id)),
    orders: protectedProcedure.query(({ ctx }) => getAdminOrders().then(orders => orders.filter((o: any) => o.userId === ctx.user.id))),
  }),

  // ─── Learning (player + quiz) ──────────────────────────────────────────────
  learning: router({
    modules: protectedProcedure
      .input(z.object({ trainingId: z.number() }))
      .query(({ input }) => getTrainingModules(input.trainingId)),

    slides: protectedProcedure
      .input(z.object({ trainingId: z.number() }))
      .query(({ input }) => getSlides(input.trainingId)),

    objectives: protectedProcedure
      .input(z.object({ trainingId: z.number() }))
      .query(({ input }) => getObjectives(input.trainingId)),

    objectiveProgress: protectedProcedure
      .input(z.object({ enrollmentId: z.number() }))
      .query(({ input }) => getObjectiveCompletion(input.enrollmentId)),

    moduleProgress: protectedProcedure
      .input(z.object({ enrollmentId: z.number() }))
      .query(({ input }) => getModuleProgress(input.enrollmentId)),

    completeModule: protectedProcedure
      .input(z.object({ enrollmentId: z.number(), moduleId: z.number(), timeSpentMinutes: z.number().optional() }))
      .mutation(({ input }) => updateModuleProgress(input.enrollmentId, input.moduleId, input.timeSpentMinutes)),

    quizQuestions: protectedProcedure
      .input(z.object({ trainingId: z.number(), moduleId: z.number().optional() }))
      .query(({ input }) => getQuizQuestions(input.trainingId, input.moduleId)),

    submitQuiz: protectedProcedure
      .input(z.object({
        enrollmentId: z.number(),
        trainingId: z.number(),
        answers: z.record(z.string(), z.any()),
        attemptNumber: z.number().optional(),
        sessionId: z.number().optional(),
      }))
      .mutation(({ ctx, input }) => submitQuizAttempt({
        userId: ctx.user.id,
        enrollmentId: input.enrollmentId,
        trainingId: input.trainingId,
        answers: input.answers,
        attemptNumber: input.attemptNumber ?? 1,
        sessionId: input.sessionId,
      })),

    startExam: protectedProcedure
      .input(z.object({ enrollmentId: z.number(), trainingId: z.number(), attemptNumber: z.number().optional() }))
      .mutation(({ ctx, input }) => startExamSession({ enrollmentId: input.enrollmentId, userId: ctx.user.id, trainingId: input.trainingId, attemptNumber: input.attemptNumber ?? 1 })),

    logProctoringEvent: protectedProcedure
      .input(z.object({ sessionId: z.number(), type: z.string(), detail: z.string().optional() }))
      .mutation(({ ctx, input }) => logProctoringEvent({ sessionId: input.sessionId, userId: ctx.user.id, type: input.type, detail: input.detail })),

    quizAttempts: protectedProcedure
      .input(z.object({ enrollmentId: z.number() }))
      .query(({ input }) => getQuizAttempts(input.enrollmentId)),

    issueCertificate: protectedProcedure
      .input(z.object({ enrollmentId: z.number(), origin: z.string() }))
      .mutation(({ input }) => issueCertificate(input.enrollmentId, input.origin)),
  }),

  // ─── Company (B2B) ─────────────────────────────────────────────────────────
  company: router({
    get: protectedProcedure.query(({ ctx }) => getUserCompany(ctx.user.id)),
    upsert: protectedProcedure
      .input(z.object({
        name: z.string(),
        siret: z.string().optional(),
        vatNumber: z.string().optional(),
        address: z.string().optional(),
        country: z.string().optional(),
        contactName: z.string().optional(),
        contactEmail: z.string().optional(),
        contactPhone: z.string().optional(),
      }))
      .mutation(({ ctx, input }) => createOrUpdateCompany(ctx.user.id, input)),

    // ── Membres / affiliations (manager-scoped) ──
    // A MANAGER manages the affiliations of THEIR OWN org. The org is resolved from the
    // manager's own ACTIVE MANAGER affiliation; any affiliation acted upon must belong to it.
    affiliates: orgManagerProcedure.query(({ ctx }) => {
      const orgId = managerOrgId(ctx);
      return getOrganizationAffiliates(orgId);
    }),
    addAffiliate: orgManagerProcedure
      .input(z.object({ email: z.string().email(), role: z.enum(["MANAGER", "MEMBER"]).default("MEMBER") }))
      .mutation(async ({ ctx, input }) => {
        const orgId = managerOrgId(ctx);
        const r = await addOrganizationAffiliate(orgId, input.email, input.role);
        if (!r.ok) throw new TRPCError({ code: "BAD_REQUEST", message: r.reason === "no_user" ? "Aucun compte avec cet email. La personne doit d'abord créer un compte." : "Échec de l'ajout." });
        return r;
      }),
    setAffiliateRole: orgManagerProcedure
      .input(z.object({ affiliationId: z.number(), role: z.enum(["MANAGER", "MEMBER"]) }))
      .mutation(async ({ ctx, input }) => {
        const orgId = managerOrgId(ctx);
        const aff = await getAffiliationById(input.affiliationId);
        if (!aff || aff.orgId !== orgId) throw new TRPCError({ code: "FORBIDDEN" });
        return setAffiliationRole(input.affiliationId, input.role);
      }),
    removeAffiliate: orgManagerProcedure
      .input(z.object({ affiliationId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const orgId = managerOrgId(ctx);
        const aff = await getAffiliationById(input.affiliationId);
        if (!aff || aff.orgId !== orgId) throw new TRPCError({ code: "FORBIDDEN" });
        if (aff.personId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Vous ne pouvez pas retirer votre propre affiliation." });
        return removeOrganizationManager(input.affiliationId);
      }),

    employees: protectedProcedure.query(({ ctx }) => getCompanyEmployees(ctx.user.id)),
    createEmployee: protectedProcedure
      .input(z.object({
        firstName: z.string(),
        lastName: z.string(),
        email: z.string().email(),
        jobTitle: z.string().optional(),
        licenseNumber: z.string().optional(),
        licenseCategories: z.string().optional(),
        typeRatings: z.string().optional(),
        department: z.string().optional(),
        base: z.string().optional(),
      }))
      .mutation(({ ctx, input }) => createEmployee(ctx.user.id, input)),
    updateEmployee: protectedProcedure
      .input(z.object({ id: z.number() }).and(z.record(z.string(), z.unknown())))
      .mutation(({ input }) => { const { id, ...data } = input; return updateEmployee(id as number, data); }),

    importCSV: protectedProcedure
      .input(z.object({ csvData: z.string() }))
      .mutation(({ ctx, input }) => importEmployeesCSV(ctx.user.id, input.csvData)),

    recurrencies: protectedProcedure.query(async ({ ctx }) => {
      const rows = await getCompanyRecurrencies(ctx.user.id);
      // INV-8: a manager reading the recurrency deadlines of the org's roster.
      await logAccess({
        actorId: ctx.user.id, actorRole: "AFFILIATION:MANAGER", action: "READ_COMPANY_RECURRENCIES",
        targetOrgId: ctx.user.companyId ?? null,
        dataAccessed: { scope: "ORG", count: rows.length, employeeIds: rows.map((r: any) => r.employeeId) },
        ip: ipFromReq(ctx.req),
      });
      return rows;
    }),

    // ── Subscription (conformité-as-a-subscription) ──
    subscription: protectedProcedure.query(({ ctx }) => getCompanySubscriptionView(ctx.user.id)),
    createSubscription: protectedProcedure
      .input(z.object({ plan: z.enum(["standard", "all_inclusive"]), origin: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.companyId) throw new TRPCError({ code: "FORBIDDEN", message: "Compte entreprise requis." });
        try {
          return await createSubscriptionCheckoutSession({ companyId: ctx.user.companyId, plan: input.plan, origin: input.origin, userEmail: ctx.user.email ?? undefined });
        } catch (err: any) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
        }
      }),
    createPortalSession: protectedProcedure
      .input(z.object({ origin: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user.companyId) throw new TRPCError({ code: "FORBIDDEN", message: "Compte entreprise requis." });
        try {
          return await createBillingPortalSession(ctx.user.companyId, input.origin);
        } catch (err: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
        }
      }),
    confirmSubscription: protectedProcedure.mutation(({ ctx }) => {
      if (!ctx.user.companyId) throw new TRPCError({ code: "FORBIDDEN", message: "Compte entreprise requis." });
      return confirmSubscription(ctx.user.companyId);
    }),

    // ── Technician file (V2.2) ──
    technicianFile: protectedProcedure
      .input(z.object({ employeeId: z.number() }))
      .query(async ({ ctx, input }) => {
        const file = await getTechnicianFile(input.employeeId);
        if (!file) throw new TRPCError({ code: "NOT_FOUND", message: "Technicien introuvable." });
        const orgId = file.employee.companyId;
        const subjectUserId = file.employee.userId;
        // INV-2 authorisation: admin (operator), or an ACTIVE MANAGER affiliation in this
        // org (legacy company_manager via companyId tolerated as fallback during transition).
        const isAdmin = ctx.user.role === "admin";
        const managerAff = (ctx.affiliations ?? []).some((a) => a.orgId === orgId && a.role === "MANAGER" && a.status === "ACTIVE");
        if (!isAdmin && !managerAff && orgId !== ctx.user.companyId)
          throw new TRPCError({ code: "FORBIDDEN" });
        await logAccess({
          actorId: ctx.user.id, actorRole: isAdmin ? "admin" : "AFFILIATION:MANAGER",
          subjectPersonId: subjectUserId ?? null, action: "READ_TECHNICIAN_FILE",
          targetOrgId: orgId, dataAccessed: { scope: "ORG", employeeId: input.employeeId },
          ip: ipFromReq(ctx.req),
        });
        // INV-3: a Person's dossier is reduced to the bounded org-scoped view (required
        // modules + Part-66 coverage + deadlines). Roster-only records (no login account)
        // keep the org's own recurrency tracking. Raw enrollments/certs/personal email are
        // never forwarded — the personal login email is never even loaded here.
        const e = file.employee;
        const employee = {
          id: e.id, firstName: e.firstName, lastName: e.lastName, jobTitle: e.jobTitle,
          licenseNumber: e.licenseNumber, licenseCategories: e.licenseCategories, typeRatings: e.typeRatings,
          department: e.department, base: e.base, companyId: e.companyId, userId: e.userId, email: e.email,
        };
        const scoped = subjectUserId ? await orgScopedViewForSubject(orgId, subjectUserId) : null;
        // INV-5: relying on the file locks the subject's surfaced credentials for this org
        // (the person can no longer withdraw a proof while employed).
        if (subjectUserId) await lockSurfacedCredentialsForOrg(subjectUserId, orgId);
        // ID module (passport documents) is shared with the org ONLY if the person opted in.
        let passportDocuments: any[] = [];
        if (subjectUserId) {
          const subject = await getUserById(subjectUserId);
          if (subject?.passportShared) passportDocuments = await getPassportDocuments(subjectUserId);
        }
        return { employee, scoped, recurrencies: file.recurrencies, externalTrainings: file.externalTrainings, passportDocuments };
      }),
    addExternalTraining: protectedProcedure
      .input(z.object({
        employeeId: z.number(), title: z.string().min(1), provider: z.string().optional(),
        category: z.string().optional(), completedAt: z.string().optional(), expiresAt: z.string().optional(),
        certNumber: z.string().optional(), docUrl: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // INV-5: external/prior qualifications are surfaced by the PERSON (« Mon dossier »),
        // never added by the manager. Kept admin-only for support/back-office.
        if (ctx.user.role !== "admin")
          throw new TRPCError({ code: "FORBIDDEN", message: "Les acquis externes sont déclarés par la personne elle-même (« Mon dossier »)." });
        const file = await getTechnicianFile(input.employeeId);
        if (!file) throw new TRPCError({ code: "NOT_FOUND" });
        return createExternalTraining({
          employeeId: input.employeeId, userId: file.employee.userId ?? null, companyId: file.employee.companyId,
          title: input.title, provider: input.provider, category: input.category,
          completedAt: input.completedAt ? new Date(input.completedAt) : null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          certNumber: input.certNumber, docUrl: input.docUrl,
        });
      }),
    deleteExternalTraining: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) => deleteExternalTraining(input.id, { companyId: ctx.user.companyId, isAdmin: ctx.user.role === "admin" })),

    // ── Sign-off (INV-4): the HUMAN determination of compliance by a manager ──
    signoff: orgManagerProcedure
      .input(z.object({ employeeId: z.number(), trainingId: z.number().optional(), credentialId: z.number().optional(), scope: z.string().optional(), decision: z.enum(["VALIDATED", "REJECTED"]).optional(), note: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const file = await getTechnicianFile(input.employeeId);
        if (!file?.employee.userId) throw new TRPCError({ code: "BAD_REQUEST", message: "Le sign-off requiert un technicien rattaché à un compte personne." });
        const orgId = file.employee.companyId;
        const subjectPersonId = file.employee.userId;
        const isAdmin = ctx.user.role === "admin";
        const mgrAff = (ctx.affiliations ?? []).some((a) => a.orgId === orgId && a.role === "MANAGER" && a.status === "ACTIVE");
        if (!isAdmin && !mgrAff && orgId !== ctx.user.companyId) throw new TRPCError({ code: "FORBIDDEN" });
        const subjectAff = (await getActiveAffiliations(subjectPersonId)).find((a) => a.orgId === orgId);
        const so = await createSignoff({
          managerPersonId: ctx.user.id, subjectPersonId, orgId, affiliationId: subjectAff?.id ?? null,
          credentialId: input.credentialId, trainingId: input.trainingId, scope: input.scope, decision: input.decision, note: input.note,
        });
        // INV-5: the determination relies on the proof → lock the subject's surfaced credentials.
        await lockSurfacedCredentialsForOrg(subjectPersonId, orgId);
        await logAccess({ actorId: ctx.user.id, actorRole: isAdmin ? "admin" : "AFFILIATION:MANAGER", subjectPersonId, action: "SIGNOFF", targetOrgId: orgId, dataAccessed: { trainingId: input.trainingId ?? null, decision: input.decision ?? "VALIDATED" }, ip: ipFromReq(ctx.req) });
        return so;
      }),
    signoffs: orgManagerProcedure
      .input(z.object({ employeeId: z.number() }))
      .query(async ({ input }) => {
        const file = await getTechnicianFile(input.employeeId);
        if (!file?.employee.userId) return [];
        return getSignoffsForSubject(file.employee.userId, file.employee.companyId);
      }),

    // ── Consolidated view + TNA (V2.3) ──
    consolidated: protectedProcedure.query(({ ctx }) => getCompanyConsolidated(ctx.user.id)),
    roleRequirements: protectedProcedure.query(({ ctx }) => getRoleRequirements(ctx.user.companyId ?? null)),
    createRoleRequirement: protectedProcedure
      .input(z.object({ label: z.string().optional(), jobTitleContains: z.string().optional(), licenseCategoryContains: z.string().optional(), trainingId: z.number(), periodMonths: z.number() }))
      .mutation(({ ctx, input }) => {
        if (!ctx.user.companyId && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Compte entreprise requis." });
        return createRoleRequirement({ ...input, companyId: ctx.user.role === "admin" ? null : ctx.user.companyId });
      }),
    deleteRoleRequirement: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) => deleteRoleRequirement(input.id, { companyId: ctx.user.companyId, isAdmin: ctx.user.role === "admin" })),
    runTNA: protectedProcedure.mutation(({ ctx }) => {
      if (!ctx.user.companyId) throw new TRPCError({ code: "FORBIDDEN", message: "Compte entreprise requis." });
      return runTNA(ctx.user.companyId);
    }),
  }),

  // ─── Me (person-centric self-service: INV-5 surfacing, INV-9 self view) ──────
  me: router({
    // INV-9: the person sees exactly what each org sees of them + their private layer.
    selfView: protectedProcedure.query(async ({ ctx }) => {
      await logAccess({ actorId: ctx.user.id, actorRole: "self", subjectPersonId: ctx.user.id, action: "READ_SELF_VIEW", dataAccessed: { scope: "SELF" }, ip: ipFromReq(ctx.req) });
      return getSelfView(ctx.user.id);
    }),
    credentials: protectedProcedure.query(({ ctx }) => getPersonCredentials(ctx.user.id)),
    // RGPD: explicit consents (marketing + data processing), timestamped.
    setConsents: protectedProcedure
      .input(z.object({ marketingOptIn: z.boolean().optional(), dataProcessingConsent: z.boolean().optional() }))
      .mutation(({ ctx, input }) => setUserConsents(ctx.user.id, input)),
    // RGPD: portable export of all the person's data (logged as a personal-data read).
    dataExport: protectedProcedure.query(async ({ ctx }) => {
      await logAccess({ actorId: ctx.user.id, actorRole: "self", subjectPersonId: ctx.user.id, action: "EXPORT_PERSONAL_DATA", dataAccessed: { scope: "SELF" }, ip: ipFromReq(ctx.req) });
      return exportPersonData(ctx.user.id);
    }),
    // ── Passport: person-owned "ID" dossier (uploaded documents) ──
    // Self-scoped: every operation uses ctx.user.id. R-AERO trainings/certificates are
    // aggregated client-side from dashboard.* — only uploaded documents live here.
    passport: router({
      documents: protectedProcedure.query(({ ctx }) => getPassportDocuments(ctx.user.id)),
      addDocument: protectedProcedure
        .input(z.object({
          kind: z.enum(["ID", "PASSPORT", "DIPLOMA", "CERTIFICATE", "LICENSE", "RATING", "LOGBOOK", "EXPERIENCE", "OTHER"]),
          title: z.string().min(1),
          issuer: z.string().optional(),
          reference: z.string().optional(),
          country: z.string().optional(),
          issuedAt: z.string().optional(),
          expiresAt: z.string().optional(),
          fileName: z.string().min(1),
          contentType: z.string().min(1),
          dataBase64: z.string().min(1),
        }))
        .mutation(({ ctx, input }) => createPassportDocument({
          personId: ctx.user.id, kind: input.kind, title: input.title,
          issuer: input.issuer, reference: input.reference, country: input.country,
          issuedAt: input.issuedAt ? new Date(input.issuedAt) : null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          fileName: input.fileName, contentType: input.contentType, dataBase64: input.dataBase64,
        })),
      deleteDocument: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
          const r = await deletePassportDocument(input.id, ctx.user.id);
          if (!r.ok) throw new TRPCError({ code: "FORBIDDEN", message: "Document introuvable ou non autorisé." });
          return r;
        }),
      // Person consent: expose the whole ID module (documents) to affiliated orgs.
      setSharing: protectedProcedure
        .input(z.object({ enabled: z.boolean() }))
        .mutation(({ ctx, input }) => setPassportSharing(ctx.user.id, input.enabled)),
    }),
    // Active organisations the connected person is affiliated to (org name + role),
    // for showing "belongs to <Org>" next to their name. Empty array if independent.
    organizations: protectedProcedure.query(async ({ ctx }) => {
      const out: Array<{ orgId: number; name: string; role: string }> = [];
      for (const a of (ctx.affiliations ?? []).filter((x) => x.status === "ACTIVE")) {
        const org = await getCompanyById(a.orgId);
        if (org) out.push({ orgId: a.orgId, name: org.name, role: a.role });
      }
      return out;
    }),
    // INV-5: the person — not the manager — surfaces a prior/external qualification.
    surfaceCredential: protectedProcedure
      .input(z.object({
        label: z.string().min(1), provider: z.string().optional(), trainingId: z.number().optional(),
        objectiveIds: z.array(z.number()).optional(), completedAt: z.string().optional(), expiresAt: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const cred = await surfaceCredentialForPerson(ctx.user.id, {
          label: input.label, provider: input.provider ?? null, trainingId: input.trainingId ?? null,
          objectiveIds: input.objectiveIds, completedAt: input.completedAt ? new Date(input.completedAt) : null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        });
        await logAccess({ actorId: ctx.user.id, actorRole: "self", subjectPersonId: ctx.user.id, action: "SURFACE_CREDENTIAL", dataAccessed: { label: input.label }, ip: ipFromReq(ctx.req) });
        return cred;
      }),
    // INV-5: withdrawal allowed only while not locked (not yet relied upon during employment).
    unsurfaceCredential: protectedProcedure
      .input(z.object({ credentialId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const res = await unsurfaceCredentialForPerson(ctx.user.id, input.credentialId);
        if (!res.ok && res.reason === "locked")
          throw new TRPCError({ code: "FORBIDDEN", message: "Cet acquis a fondé une preuve de conformité pendant votre emploi : il ne peut être retiré tant que l'affiliation est active." });
        if (!res.ok) throw new TRPCError({ code: "BAD_REQUEST", message: "Retrait impossible." });
        return res;
      }),
    // INV-7: the person erases their own account. Independent/LIVING layer is deleted;
    // proof relied upon during employment is frozen & retained by the org; the account is
    // pseudonymised. The session cookie is cleared.
    eraseAccount: protectedProcedure.mutation(async ({ ctx }) => {
      const res = await erasePerson(ctx.user.id);
      await logAccess({ actorId: ctx.user.id, actorRole: "self", subjectPersonId: ctx.user.id, action: "ERASE_PERSON", dataAccessed: { ...res }, ip: ipFromReq(ctx.req) });
      ctx.res.clearCookie(COOKIE_NAME);
      return res;
    }),
  }),

  // ─── Support tickets ─────────────────────────────────────────────────────────
  support: router({
    myList: protectedProcedure.query(({ ctx }) => getMyTickets(ctx.user.id)),
    create: protectedProcedure
      .input(z.object({ subject: z.string().min(1), message: z.string().optional(), priority: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const tkt = await createSupportTicket(ctx.user.id, input);
        await notifyAdminEmail(`Nouveau ticket support : ${input.subject}`,
          emailBody(`${ctx.user.name ?? ctx.user.email} a ouvert un ticket :\n\n${input.subject}\n${input.message ?? ""}`, "/admin"));
        return tkt;
      }),
    thread: protectedProcedure
      .input(z.object({ ticketId: z.number() }))
      .query(async ({ ctx, input }) => {
        const tkt = await getTicketById(input.ticketId);
        if (!tkt) throw new TRPCError({ code: "NOT_FOUND" });
        const staff = ["admin", "instructor", "company_manager"].includes(ctx.user.role);
        if (!staff && tkt.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        return getTicketThread(input.ticketId);
      }),
    reply: protectedProcedure
      .input(z.object({ ticketId: z.number(), content: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const tkt = await getTicketById(input.ticketId);
        if (!tkt) throw new TRPCError({ code: "NOT_FOUND" });
        const staff = ["admin", "instructor", "company_manager"].includes(ctx.user.role);
        if (!staff && tkt.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        const msg = await postTicketMessage(input.ticketId, ctx.user.id, input.content);
        if (staff && tkt.userId !== ctx.user.id) {
          // Notify the ticket owner (in-app + email) when staff replies.
          await createNotification({ userId: tkt.userId, type: "support", title: "Réponse à votre demande de support", body: input.content.slice(0, 120), link: "/support" });
          await emailUserById(tkt.userId, "Réponse à votre demande de support — R-AERO", emailBody(input.content, "/support"));
        } else if (!staff) {
          // Client replied → alert the back office.
          await notifyAdminEmail(`Réponse client sur le ticket #${tkt.id}`, emailBody(input.content, "/admin"));
        }
        return msg;
      }),
    adminList: staffProcedure.query(() => getAdminTickets()),
    setStatus: staffProcedure
      .input(z.object({ ticketId: z.number(), status: z.enum(["OPEN", "PENDING", "CLOSED"]) }))
      .mutation(({ input }) => setTicketStatus(input.ticketId, input.status)),
  }),

  // ─── Quotes ────────────────────────────────────────────────────────────────
  quotes: router({
    create: publicProcedure
      .input(z.object({
        companyName: z.string(),
        siret: z.string().optional(),
        contactName: z.string(),
        contactEmail: z.string().email(),
        contactPhone: z.string().optional(),
        employeeCount: z.number().optional(),
        trainingTypes: z.string().optional(),
        message: z.string().optional(),
      }))
      // Link the quote to the account when the requester is logged in (enables messaging
      // + conversion without a manual email match).
      .mutation(async ({ ctx, input }) => {
        const q = await createQuoteRequest({ ...input, userId: ctx.user?.id ?? null });
        await notifyAdminEmail(`Nouvelle demande de devis : ${input.companyName}`,
          emailBody(`${input.contactName} — ${input.contactEmail}\nSociété : ${input.companyName}\n${input.trainingTypes ? "Types : " + input.trainingTypes + "\n" : ""}${input.message ?? ""}`, "/admin"));
        return q;
      }),

    // Client view of their own quotes (by userId or matching email).
    myList: protectedProcedure.query(({ ctx }) => getMyQuotes(ctx.user.id, ctx.user.email ?? null)),

    // Quote message thread — accessible to the quote owner or an admin.
    messages: router({
      list: protectedProcedure
        .input(z.object({ quoteId: z.number() }))
        .query(async ({ ctx, input }) => {
          const q = await getQuoteById(input.quoteId);
          if (!q) throw new TRPCError({ code: "NOT_FOUND" });
          const owns = ctx.user.role === "admin" || q.userId === ctx.user.id || (!!q.contactEmail && q.contactEmail.toLowerCase() === ctx.user.email?.toLowerCase());
          if (!owns) throw new TRPCError({ code: "FORBIDDEN" });
          await markQuoteMessagesRead(input.quoteId, ctx.user.id);
          return getQuoteMessages(input.quoteId);
        }),
      send: protectedProcedure
        .input(z.object({ quoteId: z.number(), content: z.string().min(1) }))
        .mutation(async ({ ctx, input }) => {
          const q = await getQuoteById(input.quoteId);
          if (!q) throw new TRPCError({ code: "NOT_FOUND" });
          const owns = ctx.user.role === "admin" || q.userId === ctx.user.id || (!!q.contactEmail && q.contactEmail.toLowerCase() === ctx.user.email?.toLowerCase());
          if (!owns) throw new TRPCError({ code: "FORBIDDEN" });
          const msg = await createQuoteMessage({ quoteRequestId: input.quoteId, fromUserId: ctx.user.id, content: input.content });
          if (ctx.user.role === "admin") {
            // Admin reply → email the client (by account, else by the quote contact email).
            if (q.userId) await emailUserById(q.userId, "Réponse à votre devis — R-AERO", emailBody(input.content, "/mes-devis"));
            else if (q.contactEmail && isEmailConfigured()) await sendEmail({ to: q.contactEmail, subject: "Réponse à votre devis — R-AERO", html: simpleEmail("Réponse à votre devis", emailBody(input.content, "/mes-devis")).html });
          } else {
            await notifyAdminEmail(`Réponse client sur le devis #${q.id}`, emailBody(input.content, "/admin"));
          }
          return msg;
        }),
    }),
  }),

  // ─── Webinars ──────────────────────────────────────────────────────────────
  webinars: router({
    list: publicProcedure.query(async () => getWebinars()),
    register: protectedProcedure
      .input(z.object({ webinarId: z.number() }))
      .mutation(({ ctx, input }) => registerForWebinar(ctx.user.id, input.webinarId)),
  }),

  // ─── Live classroom (TIER 2) ─────────────────────────────────────────────
  live: router({
    access: protectedProcedure
      .input(z.object({ roomType: z.enum(["webinar", "session"]), roomId: z.number() }))
      .query(({ ctx, input }) => getLiveAccess(input.roomType, input.roomId, ctx.user as any)),
    join: protectedProcedure
      .input(z.object({ roomType: z.enum(["webinar", "session"]), roomId: z.number() }))
      .mutation(({ ctx, input }) => joinLiveRoom(input.roomType, input.roomId, ctx.user.id)),
    participants: protectedProcedure
      .input(z.object({ roomType: z.enum(["webinar", "session"]), roomId: z.number() }))
      .query(({ input }) => getParticipants(input.roomType, input.roomId)),
    messages: protectedProcedure
      .input(z.object({ roomType: z.enum(["webinar", "session"]), roomId: z.number() }))
      .query(({ input }) => getLiveMessages(input.roomType, input.roomId)),
    postMessage: protectedProcedure
      .input(z.object({ roomType: z.enum(["webinar", "session"]), roomId: z.number(), kind: z.enum(["chat", "qa"]), content: z.string().min(1) }))
      .mutation(({ ctx, input }) => postLiveMessage({ roomType: input.roomType, roomId: input.roomId, userId: ctx.user.id, kind: input.kind, content: input.content })),
    markAnswered: moderatorProcedure
      .input(z.object({ messageId: z.number() }))
      .mutation(({ ctx, input }) => setMessageAnswered(input.messageId, ctx.user.id)),
    polls: protectedProcedure
      .input(z.object({ roomType: z.enum(["webinar", "session"]), roomId: z.number() }))
      .query(({ input }) => getLivePolls(input.roomType, input.roomId)),
    createPoll: moderatorProcedure
      .input(z.object({ roomType: z.enum(["webinar", "session"]), roomId: z.number(), kind: z.enum(["poll", "quiz"]), question: z.string().min(1), options: z.array(z.string()), correct: z.array(z.number()).optional() }))
      .mutation(({ input }) => createLivePoll(input)),
    closePoll: moderatorProcedure
      .input(z.object({ pollId: z.number() }))
      .mutation(({ input }) => closeLivePoll(input.pollId)),
    votePoll: protectedProcedure
      .input(z.object({ pollId: z.number(), choices: z.array(z.number()) }))
      .mutation(({ ctx, input }) => voteLivePoll({ pollId: input.pollId, userId: ctx.user.id, choices: input.choices })),
    engagement: moderatorProcedure
      .input(z.object({ roomType: z.enum(["webinar", "session"]), roomId: z.number() }))
      .query(({ input }) => getEngagementScores(input.roomType, input.roomId)),
    setReplay: moderatorProcedure
      .input(z.object({ roomType: z.enum(["webinar", "session"]), roomId: z.number(), url: z.string() }))
      .mutation(({ input }) => setReplayUrl(input.roomType, input.roomId, input.url)),
  }),

  // ─── Notifications ──────────────────────────────────────────────────────────
  notifications: router({
    list: protectedProcedure.query(({ ctx }) => getUserNotifications(ctx.user.id)),
    unreadCount: protectedProcedure.query(({ ctx }) => getUnreadNotificationCount(ctx.user.id)),
    markRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) => markNotificationRead(input.id, ctx.user.id)),
    markAllRead: protectedProcedure.mutation(({ ctx }) => markAllNotificationsRead(ctx.user.id)),
  }),

  // ─── Admin ─────────────────────────────────────────────────────────────────
  admin: router({
    stats: adminProcedure.query(() => getAdminStats()),
    users: adminProcedure.query(() => getAdminUsers()),
    // Per-org role management (matrix E): a person can be MANAGER of one org, MEMBER of another.
    setAffiliationRole: adminProcedure
      .input(z.object({ affiliationId: z.number(), role: z.enum(["MANAGER", "MEMBER"]) }))
      .mutation(({ input }) => setAffiliationRole(input.affiliationId, input.role)),
    // INV-7: operator-initiated erasure (e.g. on a person's written request).
    erasePerson: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Vous ne pouvez pas effacer votre propre compte ici." });
        const target = await getUserById(input.userId);
        if (target?.role === "admin" && target?.status === "active" && (await countActiveAdmins()) <= 1)
          throw new TRPCError({ code: "BAD_REQUEST", message: "Impossible d'effacer le dernier administrateur actif." });
        const res = await erasePerson(input.userId);
        await logAccess({ actorId: ctx.user.id, actorRole: "admin", subjectPersonId: input.userId, action: "ERASE_PERSON", dataAccessed: { ...res }, ip: ipFromReq(ctx.req) });
        return res;
      }),
    // Broadcast a notification to all users (or a company), fanned out per-user.
    broadcast: adminProcedure
      .input(z.object({
        audience: z.string(), title: z.string().min(1), body: z.string().optional(), link: z.string().optional(),
        email: z.boolean().optional(),   // also deliver by email
        userId: z.number().optional(),   // target a single user instead of an audience
      }))
      .mutation(async ({ input }) => {
        const bodyHtml = emailBody(input.body ?? input.title, input.link);
        // Single recipient.
        if (input.userId) {
          await createNotification({ userId: input.userId, type: "broadcast", title: input.title, body: input.body ?? "", link: input.link });
          if (input.email) await emailUserById(input.userId, input.title, bodyHtml);
          return { ok: true, recipients: 1 };
        }
        // Audience fan-out (in-app), optionally by email too.
        const r: any = await broadcastNotification(input);
        if (input.email && isEmailConfigured()) {
          let recipients: { email?: string | null }[] = [];
          if (input.audience === "all") recipients = await getAdminUsers();
          else if (input.audience.startsWith("company:")) recipients = await getOrganizationAffiliates(Number(input.audience.split(":")[1]));
          for (const u of recipients) if (u.email) await sendEmail({ to: u.email, subject: input.title, html: simpleEmail(input.title, bodyHtml).html });
        }
        return r;
      }),

    // ── Settings (AI API keys, etc.) ──
    settings: router({
      get: adminProcedure.query(() => {
        const mistral = (process.env.MISTRAL_API_KEY ?? "").trim();
        const pass = (process.env.SMTP_PASS ?? "").trim();
        return {
          ai: aiProviderStatus(),
          mistral: { configured: !!mistral, masked: mistral ? `••••••••${mistral.slice(-4)}` : null },
          smtp: {
            configured: isEmailConfigured(),
            host: process.env.SMTP_HOST ?? "",
            port: process.env.SMTP_PORT ?? "587",
            user: process.env.SMTP_USER ?? "",
            from: process.env.SMTP_FROM ?? "",
            notifyEmail: process.env.ADMIN_NOTIFY_EMAIL ?? "",
            passwordSet: !!pass,
          },
          stripe: {
            configured: !!(process.env.STRIPE_SECRET_KEY ?? "").trim(),
            publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
            secretSet: !!(process.env.STRIPE_SECRET_KEY ?? "").trim(),
            webhookSet: !!(process.env.STRIPE_WEBHOOK_SECRET ?? "").trim(),
          },
          imap: {
            configured: isInboxConfigured(),
            host: process.env.IMAP_HOST ?? "imap.hostinger.com",
            port: process.env.IMAP_PORT ?? "993",
          },
        };
      }),
      // Stripe keys. Secret/webhook are only overwritten when a non-empty value is given.
      setStripe: adminProcedure
        .input(z.object({ publishableKey: z.string().optional(), secretKey: z.string().optional(), webhookSecret: z.string().optional() }))
        .mutation(async ({ input }) => {
          if (input.publishableKey !== undefined) await setSetting("STRIPE_PUBLISHABLE_KEY", input.publishableKey.trim() || null);
          if (input.secretKey) await setSetting("STRIPE_SECRET_KEY", input.secretKey.trim());
          if (input.webhookSecret) await setSetting("STRIPE_WEBHOOK_SECRET", input.webhookSecret.trim());
          return { ok: true };
        }),
      setMistralKey: adminProcedure
        .input(z.object({ key: z.string() }))
        .mutation(async ({ input }) => { await setSetting("MISTRAL_API_KEY", input.key.trim() || null); return { ok: true }; }),
      // SMTP / email configuration. Password is only overwritten when a non-empty value
      // is provided, so saving other fields doesn't wipe a stored password.
      setSmtp: adminProcedure
        .input(z.object({
          host: z.string().optional(), port: z.string().optional(), user: z.string().optional(),
          password: z.string().optional(), from: z.string().optional(), notifyEmail: z.string().optional(),
          imapHost: z.string().optional(), imapPort: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
          if (input.host !== undefined) await setSetting("SMTP_HOST", input.host.trim() || null);
          if (input.port !== undefined) await setSetting("SMTP_PORT", input.port.trim() || null);
          if (input.user !== undefined) await setSetting("SMTP_USER", input.user.trim() || null);
          if (input.from !== undefined) await setSetting("SMTP_FROM", input.from.trim() || null);
          if (input.notifyEmail !== undefined) await setSetting("ADMIN_NOTIFY_EMAIL", input.notifyEmail.trim() || null);
          if (input.imapHost !== undefined) await setSetting("IMAP_HOST", input.imapHost.trim() || null);
          if (input.imapPort !== undefined) await setSetting("IMAP_PORT", input.imapPort.trim() || null);
          if (input.password) await setSetting("SMTP_PASS", input.password); // only when provided
          return { ok: true };
        }),
      // Send a test email to verify the configuration.
      sendTestEmail: adminProcedure
        .input(z.object({ to: z.string().email() }))
        .mutation(async ({ input }) => {
          if (!isEmailConfigured()) throw new TRPCError({ code: "BAD_REQUEST", message: "SMTP non configuré (renseignez serveur, identifiant et mot de passe)." });
          const { html } = simpleEmail("Test email", "<p>Votre configuration SMTP R-AERO fonctionne ✅</p>");
          const r = await sendEmail({ to: input.to, subject: "R-AERO — Test SMTP", html });
          if (!r.sent) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Échec de l'envoi : ${r.error ?? "voir logs serveur"}` });
          return { ok: true };
        }),
    }),

    // ── Inbox (read-only IMAP reception) ──
    inbox: router({
      list: adminProcedure
        .input(z.object({ limit: z.number().min(1).max(50).optional() }))
        .query(async ({ input }) => {
          try { return await fetchInbox(input.limit ?? 25); }
          catch (e: any) { throw new TRPCError({ code: "BAD_REQUEST", message: e?.message ?? "Lecture IMAP impossible." }); }
        }),
      message: adminProcedure
        .input(z.object({ uid: z.number() }))
        .query(async ({ input }) => {
          try { return await fetchMessage(input.uid); }
          catch (e: any) { throw new TRPCError({ code: "BAD_REQUEST", message: e?.message ?? "Lecture du message impossible." }); }
        }),
    }),

    // ── Offers (landing-page pricing) ──
    offers: router({
      list: adminProcedure.input(z.object({ language: z.string().optional() }).optional()).query(({ input }) => getAllOffers(input?.language)),
      create: adminProcedure
        .input(z.object({
          language: z.string(), name: z.string().min(1), price: z.string().optional(), description: z.string().optional(),
          features: z.array(z.string()).optional(), ctaLabel: z.string().optional(), ctaHref: z.string().optional(),
          highlight: z.boolean().optional(), sortOrder: z.number().optional(), isActive: z.boolean().optional(),
        }))
        .mutation(({ input }) => createOffer(input)),
      update: adminProcedure.input(z.object({ id: z.number() }).and(z.record(z.string(), z.unknown())))
        .mutation(({ input }) => { const { id, ...data } = input as any; return updateOffer(id, data); }),
      delete: adminProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => deleteOffer(input.id)),
    }),

    // ── FAQ (landing-page) ──
    faq: router({
      list: adminProcedure.input(z.object({ language: z.string().optional() }).optional()).query(({ input }) => getAllFaq(input?.language)),
      create: adminProcedure
        .input(z.object({ language: z.string(), question: z.string().min(1), answer: z.string().min(1), sortOrder: z.number().optional(), isActive: z.boolean().optional() }))
        .mutation(({ input }) => createFaqItem(input)),
      update: adminProcedure.input(z.object({ id: z.number() }).and(z.record(z.string(), z.unknown())))
        .mutation(({ input }) => { const { id, ...data } = input as any; return updateFaqItem(id, data); }),
      delete: adminProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => deleteFaqItem(input.id)),
    }),
    userDetail: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ ctx, input }) => {
        // INV-8: the operator (admin) may read full personal data, but it is always logged.
        await logAccess({
          actorId: ctx.user.id, actorRole: "admin", subjectPersonId: input.userId,
          action: "READ_ADMIN_USER_DETAIL", dataAccessed: { scope: "GOD", fields: ["profile", "orders", "enrollments", "certificates"] },
          ip: ipFromReq(ctx.req),
        });
        return getAdminUserDetail(input.userId);
      }),

    trainings: router({
      list: adminProcedure.query(() => getAdminTrainings()),
      create: adminProcedure
        .input(z.object({
          title: z.string(),
          slug: z.string(),
          description: z.string().optional(),
          objectives: z.string().optional(),
          prerequisites: z.string().optional(),
          targetAudience: z.string().optional(),
          categoryId: z.number().optional(),
          type: z.enum(["elearning", "webinar", "qt", "seminar", "event"]),
          domain: z.enum(["b1", "b2", "b1b2", "part66", "general", "management"]).optional(),
          language: z.string().optional(),
          durationHours: z.string().optional(),
          level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
          priceHt: z.string().optional(),
          priceTtc: z.string().optional(),
          priceEnterprise: z.string().optional(),
          part147Reference: z.string().optional(),
          isPublished: z.boolean().optional(),
          isFeatured: z.boolean().optional(),
          recurrencyMonths: z.number().optional(),
          passingScore: z.number().optional(),
          maxAttempts: z.number().optional(),
        }))
        .mutation(({ input }) => createTraining(input)),
      update: adminProcedure
        .input(z.object({ id: z.number() }).and(z.record(z.string(), z.unknown())))
        .mutation(({ input }) => { const { id, ...data } = input; return updateTraining(id as number, data); }),
      delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          const r = await deleteTraining(input.id);
          if (r && !r.success && r.reason === "in_use")
            throw new TRPCError({ code: "CONFLICT", message: "Formation utilisée (inscriptions ou commandes existantes) — dépubliez-la plutôt que de la supprimer." });
          return r;
        }),
    }),

    orders: adminProcedure.query(() => getAdminOrders()),

    // ── E-learning content: modules ──
    modules: router({
      list: adminProcedure
        .input(z.object({ trainingId: z.number() }))
        .query(({ input }) => getTrainingModules(input.trainingId)),
      create: adminProcedure
        .input(z.object({
          trainingId: z.number(),
          title: z.string().min(1),
          description: z.string().optional(),
          content: z.string().optional(),
          videoUrl: z.string().optional(),
          pdfUrl: z.string().optional(),
          durationMinutes: z.number().optional(),
          sortOrder: z.number().optional(),
          isRequired: z.boolean().optional(),
          objectiveId: z.number().nullable().optional(),
        }))
        .mutation(({ input }) => adminCreateModule(input)),
      update: adminProcedure
        .input(z.object({ id: z.number() }).and(z.record(z.string(), z.unknown())))
        .mutation(({ input }) => { const { id, ...data } = input; return adminUpdateModule(id as number, data); }),
      delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input }) => adminDeleteModule(input.id)),
    }),

    // ── E-learning content: Part-66 objectives (sub-modules) ──
    objectives: router({
      list: adminProcedure
        .input(z.object({ trainingId: z.number() }))
        .query(({ input }) => getObjectives(input.trainingId)),
      create: adminProcedure
        .input(z.object({
          trainingId: z.number(),
          moduleId: z.number().nullable().optional(),
          code: z.string().optional(),
          title: z.string().min(1),
          description: z.string().optional(),
          knowledgeLevel: z.enum(["1", "2", "3"]).optional(),
          isRequired: z.boolean().optional(),
          sortOrder: z.number().optional(),
        }))
        .mutation(({ input }) => adminCreateObjective(input)),
      update: adminProcedure
        .input(z.object({ id: z.number() }).and(z.record(z.string(), z.unknown())))
        .mutation(({ input }) => { const { id, ...data } = input; return adminUpdateObjective(id as number, data); }),
      delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input }) => adminDeleteObjective(input.id)),
      reorder: adminProcedure
        .input(z.object({ orderedIds: z.array(z.number()) }))
        .mutation(({ input }) => reorderObjectives(input.orderedIds)),
    }),

    // ── E-learning content: quiz question bank ──
    questions: router({
      list: adminProcedure
        .input(z.object({ trainingId: z.number() }))
        .query(({ input }) => getQuizQuestions(input.trainingId)),
      create: adminProcedure
        .input(z.object({
          trainingId: z.number(),
          moduleId: z.number().nullable().optional(),
          objectiveId: z.number().nullable().optional(),
          question: z.string().min(1),
          type: z.enum(["qcm", "qcu", "true_false", "free_text", "matching"]),
          options: z.array(z.string()).optional(),
          correctAnswer: z.array(z.number()).optional(),
          optionsRight: z.array(z.string()).optional(),
          answerKey: z.object({ keywords: z.array(z.string()).optional(), regex: z.string().optional(), pairs: z.array(z.array(z.number())).optional() }).optional(),
          explanation: z.string().optional(),
          points: z.number().optional(),
          sortOrder: z.number().optional(),
        }))
        .mutation(({ input }) => adminCreateQuestion(input)),
      update: adminProcedure
        .input(z.object({ id: z.number() }).and(z.record(z.string(), z.unknown())))
        .mutation(({ input }) => { const { id, ...data } = input; return adminUpdateQuestion(id as number, data); }),
      delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input }) => adminDeleteQuestion(input.id)),
    }),

    setUserStatus: adminProcedure
      .input(z.object({ id: z.number(), status: z.enum(["active", "suspended"]) }))
      .mutation(async ({ ctx, input }) => {
        if (input.status === "suspended") {
          if (input.id === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Vous ne pouvez pas suspendre votre propre compte." });
          const target = await getUserById(input.id);
          if (target?.role === "admin" && target?.status === "active" && (await countActiveAdmins()) <= 1)
            throw new TRPCError({ code: "BAD_REQUEST", message: "Impossible de suspendre le dernier administrateur actif." });
        }
        return adminSetUserStatus(input.id, input.status);
      }),
    setUserRole: adminProcedure
      .input(z.object({ id: z.number(), role: z.enum(["user", "admin", "instructor", "company_manager"]) }))
      .mutation(async ({ input }) => {
        if (input.role !== "admin") {
          const target = await getUserById(input.id);
          if (target?.role === "admin" && target?.status === "active" && (await countActiveAdmins()) <= 1)
            throw new TRPCError({ code: "BAD_REQUEST", message: "Impossible de retirer le rôle du dernier administrateur actif." });
        }
        return adminSetUserRole(input.id, input.role);
      }),
    createUser: adminProcedure
      .input(z.object({
        email: z.string().email(), password: z.string().min(6), name: z.string().min(1),
        role: z.enum(["user", "admin", "instructor", "company_manager"]),
        jobTitle: z.string().optional(), licenseNumber: z.string().optional(), licenseCategories: z.string().optional(),
        // Optionally create an organisation and make the new user its MANAGER.
        organization: z.object({
          name: z.string().min(1),
          type: z.enum(["MRO", "AIRLINE", "CAMO", "OTHER"]).optional(),
          agreementNumber: z.string().optional(),
        }).optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const { organization, ...userInput } = input;
          let companyId: number | undefined;
          if (organization?.name) {
            const org = await adminCreateOrganization({ name: organization.name, type: organization.type ?? null, agreementNumber: organization.agreementNumber ?? null, contactEmail: userInput.email });
            companyId = org?.id;
          }
          const u = await adminCreateUser({ ...userInput, companyId });
          if (companyId && u.email) await addOrganizationAffiliate(companyId, u.email, "MANAGER");
          return sanitizeUser(u);
        }
        catch (e: any) { throw new TRPCError({ code: "BAD_REQUEST", message: e?.message ?? "Création impossible." }); }
      }),
    updateUser: adminProcedure
      .input(z.object({
        id: z.number(), name: z.string().optional(),
        role: z.enum(["user", "admin", "instructor", "company_manager"]).optional(),
        jobTitle: z.string().optional(), licenseNumber: z.string().optional(), licenseCategories: z.string().optional(),
      }))
      .mutation(({ input }) => { const { id, ...data } = input; return adminUpdateUser(id, data); }),

    // ── Organizations module (companies + their MANAGER affiliations) ──
    organizations: router({
      list: adminProcedure.query(() => getAdminOrganizations()),
      create: adminProcedure
        .input(z.object({ name: z.string().min(1), type: z.string().optional(), agreementNumber: z.string().optional(), country: z.string().optional(), siret: z.string().optional(), contactEmail: z.string().optional() }))
        .mutation(({ input }) => adminCreateOrganization(input)),
      update: adminProcedure
        .input(z.object({ id: z.number() }).and(z.record(z.string(), z.unknown())))
        .mutation(({ input }) => { const { id, ...data } = input; return adminUpdateOrganization(id as number, data); }),
      setStatus: adminProcedure
        .input(z.object({ id: z.number(), status: z.enum(["ACTIVE", "SUSPENDED"]) }))
        .mutation(({ input }) => adminSetOrganizationStatus(input.id, input.status)),
      delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input }) => {
          const r = await adminDeleteOrganization(input.id);
          if (!r.ok && r.reason === "has_employees") throw new TRPCError({ code: "CONFLICT", message: `Cette organisation a ${r.count} employé(s) — suspendez-la ou retirez les employés avant suppression.` });
          return r;
        }),
      managers: adminProcedure.input(z.object({ orgId: z.number() })).query(({ input }) => getOrganizationManagers(input.orgId)),
      addManager: adminProcedure
        .input(z.object({ orgId: z.number(), email: z.string().email() }))
        .mutation(async ({ input }) => {
          const r = await addOrganizationManager(input.orgId, input.email);
          if (!r.ok && r.reason === "no_user") throw new TRPCError({ code: "BAD_REQUEST", message: "Aucun compte avec cet email. Créez d'abord l'utilisateur (module Utilisateurs)." });
          return r;
        }),
      removeManager: adminProcedure.input(z.object({ affiliationId: z.number() })).mutation(({ input }) => removeOrganizationManager(input.affiliationId)),
    }),

    // ── Sessions ──
    sessions: router({
      list: adminProcedure.query(() => getAllSessions()),
      create: adminProcedure
        .input(z.object({
          title: z.string().min(1),
          trainingId: z.number().nullable().optional(),
          description: z.string().optional(),
          format: z.enum(["in_person", "virtual", "webinar"]),
          location: z.string().optional(),
          instructorName: z.string().optional(),
          startDate: z.string(),
          endDate: z.string().optional(),
          durationDays: z.string().optional(),
          seats: z.number().optional(),
          priceHt: z.string().optional(),
          language: z.string().optional(),
          cpfEligible: z.boolean().optional(),
        }))
        .mutation(({ input }) => createSession({
          ...input,
          startDate: new Date(input.startDate),
          endDate: input.endDate ? new Date(input.endDate) : undefined,
        })),
      update: adminProcedure
        .input(z.object({ id: z.number() }).and(z.record(z.string(), z.unknown())))
        .mutation(({ input }) => { const { id, ...data } = input; return updateSession(id as number, data); }),
      delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input }) => deleteSession(input.id)),
    }),

    // ── Articles (news) ──
    articles: router({
      list: adminProcedure.query(() => getAllArticles()),
      create: adminProcedure
        .input(z.object({
          title: z.string().min(1),
          slug: z.string().min(1),
          excerpt: z.string().optional(),
          content: z.string().optional(),
          coverImageUrl: z.string().optional(),
          category: z.string().optional(),
          author: z.string().optional(),
          isPublished: z.boolean().optional(),
          publishedAt: z.string().optional(),
        }))
        .mutation(({ input }) => createArticle({
          ...input,
          publishedAt: input.isPublished ? new Date(input.publishedAt ?? Date.now()) : null,
        })),
      update: adminProcedure
        .input(z.object({ id: z.number() }).and(z.record(z.string(), z.unknown())))
        .mutation(({ input }) => { const { id, ...data } = input; return updateArticle(id as number, data); }),
      delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ input }) => deleteArticle(input.id)),
    }),

    quotes: router({
      list: adminProcedure.query(() => getAdminQuoteRequests()),
      updateStatus: adminProcedure
        .input(z.object({ id: z.number(), status: z.enum(["received", "in_progress", "quote_sent", "accepted", "refused"]) }))
        .mutation(({ input }) => updateQuoteRequestStatus(input.id, input.status)),
      // Convert an accepted quote into an order + Stripe checkout (always via Stripe).
      // The admin maps the free-text request to catalogue trainings + negotiated prices.
      convert: adminProcedure
        .input(z.object({
          quoteId: z.number(), origin: z.string(),
          items: z.array(z.object({
            trainingId: z.number(), title: z.string(), quantity: z.number().min(1),
            unitPriceHt: z.number().min(0), unitPriceTtc: z.number().min(0),
          })).min(1),
        }))
        .mutation(async ({ ctx, input }) => {
          const q = await getQuoteById(input.quoteId);
          if (!q) throw new TRPCError({ code: "NOT_FOUND" });
          let userId = q.userId ?? null;
          if (!userId && q.contactEmail) userId = (await findUserByEmail(q.contactEmail))?.id ?? null;
          if (!userId) throw new TRPCError({ code: "BAD_REQUEST", message: `Aucun compte trouvé pour ${q.contactEmail}. Le client doit s'inscrire (utilisez la messagerie pour l'inviter) avant la conversion.` });
          const buyer = await getUserById(userId);
          const res = await createQuoteCheckout({
            quoteId: input.quoteId, userId, userEmail: buyer?.email ?? q.contactEmail, userName: buyer?.name ?? q.contactName,
            items: input.items, origin: input.origin,
          });
          // Post the payment link into the thread (from the admin) so the client can pay from « Mes devis ».
          if (res?.url) await createQuoteMessage({ quoteRequestId: input.quoteId, fromUserId: ctx.user.id, toUserId: userId, content: `Devis accepté et commande créée. Lien de paiement : ${res.url}` });
          return res;
        }),
    }),

    complianceReport: adminProcedure.query(async ({ ctx }) => {
      // INV-8: mass read of personal data (names/emails across all users) — logged.
      await logAccess({
        actorId: ctx.user.id, actorRole: "admin", action: "READ_COMPLIANCE_REPORT",
        dataAccessed: { scope: "GOD", fields: ["userName", "userEmail", "certificateNumber"] },
        ip: ipFromReq(ctx.req),
      });
      return getAdminComplianceReport();
    }),

    runExpiryAlerts: adminProcedure.mutation(() => generateExpiryAlerts()),

    examIntegrity: adminProcedure
      .input(z.object({ enrollmentId: z.number() }))
      .query(({ input }) => getExamIntegrity(input.enrollmentId)),

    // ── Content lifecycle / regulatory change tracking (V2.6) ──
    regulatoryChanges: adminProcedure.query(() => getRegulatoryChanges()),
    createRegulatoryChange: adminProcedure
      .input(z.object({ reference: z.string().min(1), summary: z.string().optional(), domain: z.string().optional(), effectiveAt: z.string().optional() }))
      .mutation(({ input }) => createRegulatoryChange({ reference: input.reference, summary: input.summary, domain: input.domain, effectiveAt: input.effectiveAt ? new Date(input.effectiveAt) : null })),
    setReviewStatus: adminProcedure
      .input(z.object({ trainingId: z.number(), status: z.enum(["draft", "needs_review", "approved"]), changelog: z.string().optional() }))
      .mutation(({ ctx, input }) => setReviewStatus(input.trainingId, input.status, ctx.user.id, input.changelog)),
    contentRevisions: adminProcedure
      .input(z.object({ trainingId: z.number() }))
      .query(({ input }) => getContentRevisions(input.trainingId)),
  }),

  // ─── E-learning Maker (admin + instructor) ─────────────────────────────────
  maker: router({
    courses: staffProcedure.query(() => getAdminTrainings()),
    slides: staffProcedure
      .input(z.object({ trainingId: z.number() }))
      .query(({ input }) => getSlides(input.trainingId)),
    objectives: staffProcedure
      .input(z.object({ trainingId: z.number() }))
      .query(({ input }) => getObjectives(input.trainingId)),
    templates: staffProcedure.query(() => getCourseTemplates()),
    createFromTemplate: staffProcedure
      .input(z.object({ templateId: z.number() }))
      .mutation(({ ctx, input }) => createCourseFromTemplate(input.templateId, ctx.user.id)),
    createSlide: staffProcedure
      .input(z.object({
        trainingId: z.number(),
        moduleId: z.number().nullable().optional(),
        objectiveId: z.number().nullable().optional(),
        sortOrder: z.number().optional(),
        title: z.string().optional(),
        body: z.string().optional(),
        imageUrl: z.string().optional(),
        imagePrompt: z.string().optional(),
        videoUrl: z.string().optional(),
        audioUrl: z.string().optional(),
        videoCues: z.array(z.object({
          atSeconds: z.number(),
          kind: z.enum(["quiz", "branch", "hotspot", "dragdrop"]).optional(),
          question: z.string().optional(),
          options: z.array(z.string()).optional(),
          correct: z.array(z.number()).optional(),
          explanation: z.string().optional(),
          onCorrectSeek: z.number().nullable().optional(),
          branches: z.array(z.object({ label: z.string(), seekTo: z.number() })).optional(),
          hotspots: z.array(z.object({ xPct: z.number(), yPct: z.number(), label: z.string().optional(), correct: z.boolean().optional(), seekTo: z.number().optional() })).optional(),
          dragItems: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
          dropZones: z.array(z.object({ id: z.string(), label: z.string().optional(), xPct: z.number(), yPct: z.number(), wPct: z.number(), hPct: z.number(), correctItemId: z.string() })).optional(),
        })).nullable().optional(),
        quizQuestion: z.string().nullable().optional(),
        quizOptions: z.array(z.string()).nullable().optional(),
        quizCorrect: z.array(z.number()).nullable().optional(),
        quizExplanation: z.string().nullable().optional(),
      }))
      .mutation(({ input }) => createSlide(input)),
    updateSlide: staffProcedure
      .input(z.object({ id: z.number() }).and(z.record(z.string(), z.unknown())))
      .mutation(({ input }) => { const { id, ...data } = input; return updateSlide(id as number, data); }),
    deleteSlide: staffProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteSlide(input.id)),
    reorderSlides: staffProcedure
      .input(z.object({ orderedIds: z.array(z.number()) }))
      .mutation(({ input }) => reorderSlides(input.orderedIds)),
    publish: staffProcedure
      .input(z.object({ id: z.number(), isPublished: z.boolean() }))
      .mutation(({ input }) => updateTraining(input.id, { isPublished: input.isPublished })),
    createCourse: staffProcedure
      .input(z.object({
        title: z.string().min(1),
        slug: z.string().min(1),
        description: z.string().optional(),
        language: z.string().optional(),
        durationHours: z.string().optional(),
        slides: z.array(z.object({
          title: z.string().optional(),
          body: z.string().optional(),
          imageUrl: z.string().optional(),
          imagePrompt: z.string().optional(),
          videoUrl: z.string().optional(),
          audioUrl: z.string().optional(),
          quizQuestion: z.string().optional(),
          quizOptions: z.array(z.string()).optional(),
          quizCorrect: z.array(z.number()).optional(),
          quizExplanation: z.string().optional(),
        })).default([]),
      }))
      .mutation(({ input }) => createCourseWithSlides(input)),
  }),

  // ─── AI assistance (admin + instructor) ────────────────────────────────────
  ai: router({
    providers: staffProcedure.query(() => aiProviderStatus()),
    generateOutline: staffProcedure
      .input(z.object({
        provider: z.enum(["openai", "anthropic", "google", "mistral"]),
        topic: z.string().min(2),
        audience: z.string().optional(),
        slideCount: z.number().optional(),
        language: z.string().optional(),
        level: z.string().optional(),
        tone: z.string().optional(),
        domain: z.string().optional(),
        objectives: z.string().optional(),
        quizCoverage: z.enum(["none", "some", "all"]).optional(),
        references: z.boolean().optional(),
      }))
      .mutation(({ input }) => aiErr(() => aiGenerateOutline(input))),
    generateSlideText: staffProcedure
      .input(z.object({
        provider: z.enum(["openai", "anthropic", "google", "mistral"]),
        instruction: z.string().min(2),
        language: z.string().optional(),
      }))
      .mutation(({ input }) => aiErr(() => aiWriteSlideText(input))),
    generateQuiz: staffProcedure
      .input(z.object({
        provider: z.enum(["openai", "anthropic", "google", "mistral"]),
        content: z.string().min(2),
        language: z.string().optional(),
      }))
      .mutation(({ input }) => aiErr(() => aiGenerateQuiz(input))),
    generateImage: staffProcedure
      .input(z.object({
        prompt: z.string().min(2),
        provider: z.enum(["openai", "anthropic", "google", "mistral"]).optional(),
      }))
      .mutation(({ input }) => aiErr(() => generateImage({ prompt: input.prompt, provider: input.provider as AIProvider | undefined }))),
    generateAudio: staffProcedure
      .input(z.object({
        text: z.string().min(1),
        provider: z.enum(["openai", "anthropic", "google", "mistral"]).optional(),
        language: z.string().optional(),
      }))
      .mutation(({ input }) => aiErr(() => generateSpeech({ text: input.text, provider: input.provider as AIProvider | undefined, language: input.language }))),
  }),
});

export type AppRouter = typeof appRouter;
