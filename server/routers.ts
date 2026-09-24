import { establishSession } from "./_core/sessionTransport";
import {notifySupport,listSupportNotifications,supportNotificationListInput,sendPendingSupportNotification,supportNotificationSendInput} from "./supportNotifications";
import {supportMessageInput} from "../shared/supportMessageInput";
import {supportListInput} from "../shared/supportListInput";
import {learningProgressInput} from "../shared/learningProgressInput";
import {catalogueInput} from "../shared/catalogueInput";
import {quoteListInput} from "../shared/quoteListInput";
import {quoteMessageInput,quoteThreadInput} from "../shared/quoteMessageInput";
import {quoteStatusInput} from "../shared/quoteStatusInput";
import {quoteRequestInput} from "../shared/quoteRequestInput";
import {roleRequirementCourses} from "./roleRequirementCourses";
import {roleRequirementHistory} from "./roleRequirementHistory";
import {roleRequirementInput} from "../shared/roleRequirementInput";
import { objectiveCreationInput, createAuthorObjective } from './objectiveCreation';
import {reorderModules} from "./db";
import {createAuthorSlide,slideCreationInput} from "./slideCreation";
import { createAuthorModule, moduleCreationInput } from "./moduleCreation";
import { broadcastRetryInput, previewBroadcastRetry, retryBroadcastRecipient } from "./adminBroadcastRetry";
import { broadcastInput, sendAdminBroadcast, recoverBroadcastOutcome, broadcastHistoryInput, broadcastHistory, broadcastRecipientInput, broadcastRecipientHistory } from "./adminBroadcast";
import { createAuthorQuestion, questionCreationInput } from "./questionCreation";
import {getTicketStatusHistory} from "./db";
import {supportRequestInput} from "../shared/supportRequest";
import {adminCertificate,revokeCertificate,certificateRevocationInput} from "./certificateRevocation";
import {invoiceLanguageSchema} from '../shared/invoiceLanguage';
import { invoiceBuyerSchema } from "../shared/invoiceIdentity";
import { startVideoInput, startAiVideo, listAiVideos, refreshAiVideo } from "./aiVideoJobs";
import { saveAiOutline, pendingAiOutlines, pendingOutlineInput, createFromAiOutline } from "./aiOutlines";
import { courseDraftInput } from "./courseDraftInput";
import { runAiRequest, aiRequestUsage } from "./aiRequests";
import { instructorAgenda, instructorAgendaInput } from "./instructorAgenda";
import { liveInstructorHistory, instructorHistoryInput, searchLiveInstructors, listLiveInstructors, setLiveInstructor, instructorRoomInput, instructorAssignmentInput, instructorSearchInput } from "./liveInstructors";
import { webinarHistory, webinarHistoryInput, updateWebinarMetadata, webinarMetadataInput, listAdminWebinars, createAdminWebinar, rescheduleWebinar, setWebinarStatus, webinarCreateInput, webinarScheduleInput, webinarStatusInput } from "./adminWebinars";
import { scheduleInput, rescheduleSession, scheduleHistoryInput, sessionScheduleHistory } from "./sessionSchedule";
import { copyCourse, copyCourseInput } from "./courseCopy";
import { archiveExternalTraining, archiveExternalTrainingInput } from "./externalTrainingArchive";
import { organizationHistoryInput, organizationStatusHistory } from "./organizationHistory";
import { passwordResetOrigin } from "./authOrigin";
import { issueLiveVideoTicket } from "./liveVideo";
import { uploadCourseMedia } from "./courseMedia";
import { billingRouter } from "./billing";
import { withdrawPedagogicalApproval, requestPedagogicalReview, pendingPedagogicalReviews, listPedagogicalReviews, reviewSnapshot, decidePedagogicalReview } from "./pedagogicalReview";
import { getExamFinalizationFailures } from "./db";
import { authorWorkspaces } from "./makerAccess";
import { cancelSessionReservation } from "./admissions";
import { getUserSessions } from "./db";
import { getPassportHistory, getPassportHistoryPage } from "./passport";
import { reconcilePayment, reconciliationHistory } from "./paymentReconciliation";
import { resumeOrderCheckout } from "./checkoutAttempts";
import { orderRefundHistory } from "./refunds";
import { listLicenses, licenseCandidates, assignLicense } from "./licenses";
import { requireManagedCompany, requireManagedEmployee, distributionCandidates, assignCompanyTraining } from "./companyTraining";
import { publishedVersions } from "./curriculum";
import { contentHistory } from "./contentArchive";
import { courseReadiness } from "./courseReadiness";
import { requireAuthorContent, courseOwnership, listAuthorCourses, requireAuthorCourse, requireAuthorSlides, validateSlideLinks } from "./makerAccess";
import { approvalRouter } from "./approval";
import { verificationRouter } from "./verification";
import { learnerCurriculum, requireEnrollment, requireTrainingAccess, learnerQuestion } from "./learningAccess";
import { COOKIE_NAME } from "@shared/const";
import { complianceReportInput } from "@shared/complianceReportInput";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { registrationInput, revokeAllSessions, registerUser, loginUser, InvalidPasswordResetTokenError, sanitizeUser, adminCreateUser, createPasswordReset, resetPasswordWithToken, startTwoFactor, verifyTwoFactorCode, beginTwoFactorChange, confirmTwoFactorChange } from "./auth";
import {
  getPublicTrainings, getFeaturedTrainings, getTrainingBySlug, getTrainingCategories,
  getCartItems, addToCart, removeFromCart, getCartCount, clearCart,
  getUserEnrollments, getEnrollmentById, updateEnrollmentProgress,
  getUserCertificates, getCertificateByCode,
  getCompanyEmployees, createEmployee, updateEmployee,
  getCompanyRecurrencies,
  getQuoteRequests, createQuoteRequest,
  getQuoteById, getMyQuotes, findUserByEmail, getQuoteMessages, createQuoteMessage,
  createSupportTicket, getMyTickets, getAdminTickets, getTicketById, getSupportTicketDetail, getTicketThread, postTicketMessage, setTicketStatus,
  createNotification,
  getAdminUsers, getAdminTrainings, createTraining, updateTraining, deleteTraining,
  getUserOrders, getAdminOrders, getAdminQuoteRequests, getQuoteStatusHistory, updateQuoteRequestStatus,
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
  saveExamAnswers, startExamSession, logProctoringEvent, getExamIntegrity,
  getTechnicianFile, createExternalTraining,
  surfaceCredentialForPerson, shareCertificateForPerson, getCredentialSharingHistory, unsurfaceCredentialForPerson, getPersonCredentials,
  createSignoff, getSignoffsForSubject, setAffiliationRole, erasePerson,
  getCompanyConsolidated, getRoleRequirements, createRoleRequirement, deleteRoleRequirement, runTNA,
  getCourseTemplates, createCourseFromTemplate, getRegulatoryChanges, createRegulatoryChange, setReviewStatus, getContentRevisions,
  adminCreateQuestion, adminUpdateQuestion, adminDeleteQuestion,
  adminSetUserStatus, adminSetUserRole, adminUpdateUser, countActiveAdmins,
  getAdminOrganizations, adminCreateOrganization, adminUpdateOrganization, adminSetOrganizationStatus,
  getOrganizationManagers, addOrganizationManager, removeOrganizationManager,
  getOrganizationAffiliates, addOrganizationAffiliate, getAffiliationById,
  getPassportDocuments, createPassportDocument, deletePassportDocument, setPassportSharing,
  getActiveOffers, getAllOffers, createOffer, updateOffer, deleteOffer,
  getActiveFaq, getAllFaq, createFaqItem, updateFaqItem, deleteFaqItem,
  setSetting,
  getSlides, updateSlide, deleteSlide, reorderSlides, createCourseWithSlides,
  getUpcomingSessions, getAllSessions, createSession, deleteSession, registerForSession,
  getPublishedArticles, getArticleBySlug, getAllArticles, createArticle, updateArticle, deleteArticle,
} from "./db";
import { generateCataloguePDF } from "./catalogue";
import {
  aiProviderStatus, aiGenerateOutline, aiWriteSlideText, aiGenerateQuiz,
  generateImage, generateSpeech, AIError, type AIProvider,
} from "./ai";
import { createCheckoutSession, confirmCheckoutPayment, createQuoteCheckout, getStripe } from "./stripe";
import { sendEmail, isEmailConfigured, adminNotifyEmail, simpleEmail, passwordResetEmail, twoFactorCodeEmail } from "./email";
import { fetchInbox, fetchMessage, isInboxConfigured } from "./inbox";
import { rateLimit, rateLimitReset } from "./ratelimit";
import { createSubscriptionCheckoutSession, createBillingPortalSession, confirmSubscription } from "./subscription";
import {
  getLiveAccess, getPresenceHistory, joinLiveRoom, getParticipants, postLiveMessage, getLiveMessages, setMessageAnswered,
  createLivePoll, closeLivePoll, voteLivePoll, getLivePolls, getEngagementScores, setReplayUrl, getReplayHistory, replayHistoryInput,
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
  if (ctx.user.role !== "admin" && ctx.user.role !== "instructor" && ctx.user.role !== "company_manager" && !(ctx.affiliations ?? []).some(a => a.role === "MANAGER" && a.status === "ACTIVE"))
    throw new TRPCError({ code: "FORBIDDEN", message: "Accès réservé aux formateurs, managers et administrateurs." });
  return next({ ctx });
});

// Live classroom moderator (animateur) = instructor or admin.
const moderatorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "instructor")
    throw new TRPCError({ code: "FORBIDDEN", message: "Réservé à l'animateur." });
  return next({ ctx });
});

// Organization access derives from current active memberships, not the global role.
const orgManagerProcedure = protectedProcedure.use(async ({ctx,next}) => {
  const effective = await getActiveAffiliations(ctx.user.id);
  if (ctx.user.role !== "admin" && !effective.some(a=>a.role === "MANAGER"))
    throw new TRPCError({code:"FORBIDDEN",message:"Une affiliation active de responsable est requise."});
  return next({ctx:{...ctx,affiliations:effective}});
});
function managerOrgId(ctx: any): number {
  const aff = (ctx.affiliations ?? []).find((a:any)=>a.role === "MANAGER" && a.status === "ACTIVE");
  const orgId = aff?.orgId ?? (ctx.user.role === "admin" ? ctx.user.companyId : null);
  if (!orgId) throw new TRPCError({code:"FORBIDDEN",message:"Aucune organisation active rattachée à votre compte."});
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
  billing: billingRouter,
  verification: verificationRouter,
  approval: approvalRouter,
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
      .input(registrationInput)
      .mutation(async ({ ctx, input }) => {
        let user;
        try {
          user = await registerUser(input);
        } catch (err: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err instanceof Error && err.message === "Un compte existe déjà avec cet email." ? err.message : "Inscription impossible. Vérifiez vos informations et réessayez." });
        }
        await notifyAdminEmail(`Nouvelle inscription : ${user.name ?? user.email}`,
          emailBody(`${user.name ?? ""} (${user.email})${input.organization ? "\nOrganisation : " + input.organization.name : ""}`, "/admin"));
        const session = await establishSession(ctx.req, ctx.res, user);
        return { ...sanitizeUser(user), ...session };
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
        // An enabled second factor is required even when delivery is unavailable.
        if (user.twoFactorEnabled) {
          if (!isEmailConfigured()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "La connexion à deux facteurs nécessite un service de messagerie disponible." });
          const code = await startTwoFactor(user.id, user.sessionVersion);
          const { subject, html } = twoFactorCodeEmail({ name: user.name ?? "", code });
          await sendEmail({ to: user.email ?? "", subject, html }).catch(() => {});
          return { twoFactorRequired: true as const, email: user.email };
        }
        const session = await establishSession(ctx.req, ctx.res, user);
        return { ...sanitizeUser(user), ...session };
      }),

    // Second step of email 2FA: exchange the emailed code for a session.
    verifyTwoFactor: publicProcedure
      .input(z.object({ email: z.string().email(), code: z.string().regex(/^\d{6}$/) }))
      .mutation(async ({ ctx, input }) => {
        const rlKey = `2fa:${ipFromReq(ctx.req) ?? "?"}:${input.email.trim().toLowerCase()}`;
        const rl = rateLimit(rlKey, 8, 15 * 60 * 1000);
        if (!rl.ok) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Trop de tentatives. Réessayez dans ${Math.ceil(rl.retryAfterSec / 60)} min.` });
        let user;
        try { user = await verifyTwoFactorCode(input.email, input.code); }
        catch (err: any) { throw new TRPCError({ code: "UNAUTHORIZED", message: err.message }); }
        rateLimitReset(rlKey);
        const session = await establishSession(ctx.req, ctx.res, user);
        return { ...sanitizeUser(user), ...session };
      }),

    beginTwoFactorChange: protectedProcedure
      .input(z.object({ enabled: z.boolean(), password: z.string().min(1).max(1024) }))
      .mutation(async ({ctx,input}) => {
        if (!rateLimit(`2fa-setting:${ctx.user.id}`,5,15*60*1000).ok) throw new TRPCError({code:"TOO_MANY_REQUESTS",message:"Trop de tentatives. Réessayez plus tard."});
        if (!isEmailConfigured()) throw new TRPCError({code:"PRECONDITION_FAILED",message:"Le service de messagerie est indisponible."});
        let challenge;
        try { challenge = await beginTwoFactorChange(ctx.user.id,ctx.user.sessionVersion,input.password,input.enabled); }
        catch (error) { throw new TRPCError({code:"BAD_REQUEST",message:error instanceof Error ? error.message : "Vérification impossible."}); }
        const content = twoFactorCodeEmail({name:challenge.name ?? "",code:challenge.code,action:input.enabled ? "enable" : "disable"});
        const result = await sendEmail({to:challenge.email!,...content});
        if (!result.sent) throw new TRPCError({code:"PRECONDITION_FAILED",message:"Le code n’a pas pu être envoyé. Réessayez plus tard."});
        return {ok:true};
      }),
    confirmTwoFactorChange: protectedProcedure
      .input(z.object({ enabled: z.boolean(), code: z.string().regex(/^\d{6}$/) }))
      .mutation(async ({ctx,input}) => {
        let user;
        try { user = await confirmTwoFactorChange(ctx.user.id,ctx.user.sessionVersion,input.enabled,input.code); }
        catch { throw new TRPCError({code:"BAD_REQUEST",message:"Code invalide ou expiré."}); }
        const session = await establishSession(ctx.req, ctx.res, user);
        return {ok:true, ...session};
      }),

    revokeAllSessions: protectedProcedure
      .input(z.object({ password: z.string().min(1).max(1024) }))
      .mutation(async ({ ctx, input }) => {
        if (!rateLimit(`revoke-sessions:${ctx.user.id}`, 5, 15 * 60 * 1000).ok) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Trop de tentatives. Réessayez plus tard." });
        try { await revokeAllSessions(ctx.user.id, ctx.user.sessionVersion, input.password); }
        catch { throw new TRPCError({ code: "UNAUTHORIZED", message: "Mot de passe incorrect ou session expirée." }); }
        ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
        return { ok: true };
      }),

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
        if (!isEmailConfigured()) return { ok: true };
        let base: string;
        try { base = passwordResetOrigin(); }
        catch { console.warn("[auth] Password recovery origin is not configured correctly"); return { ok: true }; }
        const reset = await createPasswordReset(input.email);
        // Never reveal whether the email exists; only send when it does + SMTP is set.
        if (reset) {
          const link = `${base}/reset-password?token=${reset.token}`;
          const { subject, html } = passwordResetEmail({ name: reset.name ?? "", link });
          await sendEmail({ to: input.email.trim().toLowerCase(), subject, html }).catch(() => {});
        }
        return { ok: true };
      }),
    resetPassword: publicProcedure
      .input(z.object({ token: z.string().min(10).max(128), password: z.string().min(8, "Le mot de passe doit comporter au moins 8 caractères.").max(1024) }))
      .mutation(async ({ input }) => {
        try { return await resetPasswordWithToken(input.token, input.password); }
        catch (err) {
          if (err instanceof InvalidPasswordResetTokenError) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Lien de réinitialisation invalide ou expiré." });
          }
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Le changement de mot de passe n’a pas pu être confirmé. Réessayez de vous connecter ou demandez un nouveau lien." });
        }
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
      .mutation(async ({ ctx, input }) => {
        const u = await updateUserProfile(ctx.user.id, input);
        return u ? sanitizeUser(u) : null;
      }),
  }),

  // ─── Public ────────────────────────────────────────────────────────────────
  public: router({
    trainings: publicProcedure
      .input(catalogueInput.optional())
      .query(({ input }) => getPublicTrainings(input ?? {})),

    featuredTrainings: publicProcedure.query(() => getFeaturedTrainings()),
    /** Online card payment needs a Stripe key; without it the checkout offers a quote instead. */
    paymentsAvailable: publicProcedure.query(() => !!(process.env.STRIPE_SECRET_KEY ?? "").trim()),

    trainingBySlug: publicProcedure
      .input(z.object({ slug: z.string().min(1).max(255) }).strict())
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
      .input(z.object({ code: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9_-]+$/) }))
      .query(async ({ ctx, input }) => {
        const cert = await getCertificateByCode(input.code);
        // INV-8: log even public certificate verification (a read of the holder's name).
        await logAccess({
          actorId: ctx.user?.id ?? null, actorRole: ctx.user ? ctx.user.role : "PUBLIC",
          subjectPersonId: cert?.userId ?? null, action: "VERIFY_CERTIFICATE",
          dataAccessed: { fields: ["name", "trainingTitle"], code: input.code, found: !!cert },
          ip: ipFromReq(ctx.req),
        });
        if(!cert)return null;
        const {userId: _auditSubject,...verification}=cert;
        return verification;
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
    mine: protectedProcedure.query(({ ctx }) => getUserSessions(ctx.user.id)),
    cancel: protectedProcedure.input(z.object({ sessionId: z.number().int().positive() })).mutation(({ ctx, input }) => cancelSessionReservation(ctx.user.id, input.sessionId)),
    register: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(({ ctx, input }) => registerForSession(ctx.user.id, input.sessionId)),
  }),

  // ─── Cart ──────────────────────────────────────────────────────────────────
  cart: router({
    list: protectedProcedure.query(({ ctx }) => getCartItems(ctx.user.id)),
    count: protectedProcedure.query(async ({ ctx }) => { const n = await getCartCount(ctx.user.id); return n; }),
    add: protectedProcedure
      .input(z.object({ trainingId: z.number(), quantity: z.number().int().min(1).max(100).default(1) }))
      .mutation(({ ctx, input }) => addToCart(ctx.user.id, input.trainingId, input.quantity)),
    remove: protectedProcedure
      .input(z.object({ itemId: z.number() }))
      .mutation(({ ctx, input }) => removeFromCart(ctx.user.id, input.itemId)),
    clear: protectedProcedure.mutation(({ ctx }) => clearCart(ctx.user.id)),
  }),

  // ─── Checkout (Stripe) ─────────────────────────────────────────────────────
  licenses: router({
    list: protectedProcedure.query(({ ctx }) => listLicenses(ctx.user)),
    candidates: protectedProcedure.input(z.object({ licenseId: z.number().int().positive() })).query(({ ctx, input }) => licenseCandidates(ctx.user, input.licenseId)),
    assign: protectedProcedure.input(z.object({ licenseId: z.number().int().positive(), userId: z.number().int().positive() })).mutation(({ ctx, input }) => assignLicense(ctx.user, input.licenseId, input.userId)),
  }),
  checkout: router({
    resume: protectedProcedure.input(z.object({ orderId: z.number().int().positive() })).mutation(({ ctx, input }) => {
      const stripe = getStripe();
      if (!stripe) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Paiement indisponible." });
      return resumeOrderCheckout(stripe, ctx.user, input.orderId);
    }),
    refunds: protectedProcedure.input(z.object({ orderId: z.number().int().positive() })).query(({ ctx, input }) => orderRefundHistory(ctx.user, input.orderId)),
    createSession: protectedProcedure
      .input(z.object({ origin: z.string(), companyId: z.number().int().positive().optional() }))
      .mutation(async ({ ctx, input }) => {
        if (input.companyId) await requireManagedCompany(ctx.user, input.companyId);
        const items = await getCartItems(ctx.user.id);
        if (!items.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Panier vide." });
        try {
          const result = await createCheckoutSession({
            userId: ctx.user.id, userRole: ctx.user.role, companyId: input.companyId,
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
      .input(z.object({ orderId: z.number().int().positive(), origin: z.string().optional(), buyer:invoiceBuyerSchema.optional(), language:invoiceLanguageSchema.default('fr') }))
      .mutation(async ({ ctx, input }) => {
        const url = await generateInvoicePDF(input.orderId, "", ctx.user.id, input.buyer, input.language);
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
      .input(learningProgressInput)
      .mutation(async ({ ctx, input }) => {
        await requireEnrollment(ctx.user.id, input.enrollmentId);
        return updateEnrollmentProgress(input.enrollmentId, input.progressPercent, input.status);
      }),
    certificates: protectedProcedure.query(({ ctx }) => getUserCertificates(ctx.user.id)),
    orders: protectedProcedure.query(({ ctx }) => getUserOrders(ctx.user.id)),
  }),

  // ─── Learning (player + quiz) ──────────────────────────────────────────────
  learning: router({
    modules: protectedProcedure
      .input(z.object({ trainingId: z.number(), enrollmentId: z.number().int().positive().optional() }))
      .query(async ({ ctx, input }) => {
        const curriculum = await learnerCurriculum(ctx.user.id, input.trainingId, input.enrollmentId);
        return curriculum?.modules ?? getTrainingModules(input.trainingId);
      }),

    slides: protectedProcedure
      .input(z.object({ trainingId: z.number(), enrollmentId: z.number().int().positive().optional() }))
      .query(async ({ ctx, input }) => {
        const curriculum = await learnerCurriculum(ctx.user.id, input.trainingId, input.enrollmentId);
        return curriculum?.slides ?? getSlides(input.trainingId);
      }),

    objectives: protectedProcedure
      .input(z.object({ trainingId: z.number(), enrollmentId: z.number().int().positive().optional() }))
      .query(async ({ ctx, input }) => {
        const curriculum = await learnerCurriculum(ctx.user.id, input.trainingId, input.enrollmentId);
        return curriculum?.objectives ?? getObjectives(input.trainingId);
      }),

    objectiveProgress: protectedProcedure
      .input(z.object({ enrollmentId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireEnrollment(ctx.user.id, input.enrollmentId);
        return getObjectiveCompletion(input.enrollmentId);
      }),

    moduleProgress: protectedProcedure
      .input(z.object({ enrollmentId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireEnrollment(ctx.user.id, input.enrollmentId);
        return getModuleProgress(input.enrollmentId);
      }),

    completeModule: protectedProcedure
      .input(z.object({ enrollmentId: z.number(), moduleId: z.number(), timeSpentMinutes: z.number().int().min(0).max(1440).optional() }))
      .mutation(async ({ ctx, input }) => {
        const enrollment = await requireEnrollment(ctx.user.id, input.enrollmentId);
        if (!enrollment.modules.some(m => m.id === input.moduleId))
          throw new TRPCError({ code: "BAD_REQUEST", message: "Ce chapitre ne fait pas partie de votre formation." });
        return updateModuleProgress(input.enrollmentId, input.moduleId, input.timeSpentMinutes);
      }),

    quizQuestions: protectedProcedure
      .input(z.object({ trainingId: z.number(), enrollmentId: z.number().int().positive().optional(), moduleId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const curriculum = await learnerCurriculum(ctx.user.id, input.trainingId, input.enrollmentId);
        return (curriculum?.questions ?? await getQuizQuestions(input.trainingId, input.moduleId)).filter(q => input.moduleId != null ? q.moduleId === input.moduleId : q.moduleId == null).map(learnerQuestion);
      }),

    submitQuiz: protectedProcedure
      .input(z.object({
        enrollmentId: z.number(),
        trainingId: z.number(),
        answers: z.record(z.string(), z.any()),
        attemptNumber: z.number().optional(),
        sessionId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireEnrollment(ctx.user.id, input.enrollmentId, input.trainingId);
        return submitQuizAttempt({
        userId: ctx.user.id,
        enrollmentId: input.enrollmentId,
        trainingId: input.trainingId,
        answers: input.answers,
        attemptNumber: input.attemptNumber ?? 1,
        sessionId: input.sessionId,
      });
      }),

    startExam: protectedProcedure
      .input(z.object({ enrollmentId: z.number(), trainingId: z.number(), moduleId: z.number().int().positive().optional(), attemptNumber: z.number().optional(), resumeSessionId: z.number().int().positive().optional() }))
      .mutation(async ({ ctx, input }) => {
        await requireEnrollment(ctx.user.id, input.enrollmentId, input.trainingId);
        const session = await startExamSession({ enrollmentId: input.enrollmentId, userId: ctx.user.id, trainingId: input.trainingId, moduleId: input.moduleId, attemptNumber: input.attemptNumber ?? 1, resumeSessionId: input.resumeSessionId });
        return session ? { ...session, serverNow: Date.now(), questions: session.questions.map(learnerQuestion) } : null;
      }),

    saveExamAnswers: protectedProcedure
      .input(z.object({ sessionId: z.number().int().positive(), revision: z.number().int().min(0), answers: z.record(z.string(), z.union([z.string().max(10000), z.array(z.number().int()).max(100), z.array(z.array(z.number().int()).length(2)).max(100)])) }))
      .mutation(({ ctx, input }) => saveExamAnswers({ ...input, userId: ctx.user.id })),

    logProctoringEvent: protectedProcedure
      .input(z.object({ sessionId: z.number(), type: z.string(), detail: z.string().optional() }))
      .mutation(({ ctx, input }) => logProctoringEvent({ sessionId: input.sessionId, userId: ctx.user.id, type: input.type, detail: input.detail })),

    quizAttempts: protectedProcedure
      .input(z.object({ enrollmentId: z.number(), moduleId: z.number().int().positive().optional() }))
      .query(async ({ ctx, input }) => {
        await requireEnrollment(ctx.user.id, input.enrollmentId);
        return (await getQuizAttempts(input.enrollmentId)).filter(a => input.moduleId == null ? a.moduleId == null : a.moduleId === input.moduleId);
      }),

    issueCertificate: protectedProcedure
      .input(z.object({ enrollmentId: z.number().int().positive(), origin: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        await requireEnrollment(ctx.user.id, input.enrollmentId);
        return issueCertificate(input.enrollmentId);
      }),
  }),

  // ─── Company (B2B) ─────────────────────────────────────────────────────────
  company: router({
    get: protectedProcedure.query(async ({ ctx }) => { if(ctx.user.companyId && ctx.user.role !== "admin") await assertActiveAffiliation(ctx.user.id,ctx.user.companyId); return getUserCompany(ctx.user.id); }),
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
      .mutation(async ({ ctx, input }) => { if(ctx.user.companyId) await requireManagedCompany(ctx.user); return createOrUpdateCompany(ctx.user.id, input); }),

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

    employees: orgManagerProcedure.query(async ({ ctx }) => { await requireManagedCompany(ctx.user); return getCompanyEmployees(ctx.user.id); }),
    createEmployee: orgManagerProcedure
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
      .mutation(async ({ ctx, input }) => { await requireManagedCompany(ctx.user); return createEmployee(ctx.user.id, input); }),
    updateEmployee: orgManagerProcedure
      .input(z.object({ id: z.number().int().positive(), firstName: z.string().min(1).max(128).optional(), lastName: z.string().min(1).max(128).optional(), email: z.string().email().optional(), jobTitle: z.string().max(128).optional(), licenseNumber: z.string().max(64).optional(), licenseCategories: z.string().max(128).optional(), typeRatings: z.string().max(255).optional(), department: z.string().max(128).optional(), base: z.string().max(128).optional(), isActive: z.boolean().optional() }).strict())
      .mutation(async ({ ctx, input }) => { const { id, ...data } = input; const employee = await requireManagedEmployee(ctx.user, id); return updateEmployee(id, data, employee.companyId); }),

    importCSV: orgManagerProcedure
      .input(z.object({ csvData: z.string() }))
      .mutation(async ({ ctx, input }) => { const companyId = await requireManagedCompany(ctx.user); return importEmployeesCSV(ctx.user.id, input.csvData, companyId); }),

    recurrencies: orgManagerProcedure.query(async ({ ctx }) => {
      await requireManagedCompany(ctx.user);
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
    subscription: protectedProcedure.query(async ({ ctx }) => { await requireManagedCompany(ctx.user); return getCompanySubscriptionView(ctx.user.id); }),
    createSubscription: orgManagerProcedure
      .input(z.object({ plan: z.enum(["standard", "all_inclusive"]), origin: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await requireManagedCompany(ctx.user);
        if (!ctx.user.companyId) throw new TRPCError({ code: "FORBIDDEN" });
        try {
          return await createSubscriptionCheckoutSession({ companyId: ctx.user.companyId, plan: input.plan, origin: input.origin, userId: ctx.user.id, userEmail: ctx.user.email ?? undefined });
        } catch (err: any) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
        }
      }),
    createPortalSession: orgManagerProcedure
      .input(z.object({ origin: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await requireManagedCompany(ctx.user);
        if (!ctx.user.companyId) throw new TRPCError({ code: "FORBIDDEN" });
        try {
          return await createBillingPortalSession(ctx.user.companyId, input.origin);
        } catch (err: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
        }
      }),
    confirmSubscription: orgManagerProcedure.mutation(async ({ ctx }) => {
      await requireManagedCompany(ctx.user);
      if (!ctx.user.companyId) throw new TRPCError({ code: "FORBIDDEN", message: "Compte entreprise requis." });
      return confirmSubscription(ctx.user.companyId);
    }),

    // ── Technician file (V2.2) ──
    technicianFile: protectedProcedure
      .input(z.object({ employeeId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireManagedEmployee(ctx.user,input.employeeId);
        const file = await getTechnicianFile(input.employeeId);
        if (!file) throw new TRPCError({ code: "NOT_FOUND", message: "Technicien introuvable." });
        const orgId = file.employee.companyId;
        const subjectUserId = file.employee.userId;
        const isAdmin = ctx.user.role === "admin";
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
        // Viewing a dossier does not establish reliance on every shared proof.
        // createSignoff retains only the explicitly validated credential.
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
    archiveExternalTraining: orgManagerProcedure
      .input(archiveExternalTrainingInput)
      .mutation(({ctx,input}) => archiveExternalTraining(ctx.user.id,input)),
    deleteExternalTraining: orgManagerProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(() => { throw new TRPCError({code:"PRECONDITION_FAILED",message:"Archivez la formation avec un motif pour conserver son justificatif."}); }),

    // ── Sign-off (INV-4): the HUMAN determination of compliance by a manager ──
    signoff: orgManagerProcedure
      .input(z.object({ requestId:z.string().uuid(), employeeId: z.number().int().positive(), trainingId: z.number().int().positive().optional(), credentialId: z.number().int().positive().optional(), scope: z.enum(["COMPETENCE","RECURRENCY"]).optional(), decision: z.enum(["VALIDATED", "REJECTED"]).optional(), note: z.string().trim().max(2000).optional() }))
      .mutation(async ({ ctx, input }) => {
        await requireManagedEmployee(ctx.user,input.employeeId);
        const file = await getTechnicianFile(input.employeeId);
        if (!file?.employee.userId) throw new TRPCError({ code: "BAD_REQUEST", message: "Le sign-off requiert un technicien rattaché à un compte personne." });
        const orgId = file.employee.companyId;
        const subjectPersonId = file.employee.userId;
        const isAdmin = ctx.user.role === "admin";
        const subjectAff = await assertActiveAffiliation(subjectPersonId,orgId);
        const so = await createSignoff({
          requestId:input.requestId,employeeId:input.employeeId,managerPersonId: ctx.user.id, subjectPersonId, orgId, affiliationId: subjectAff?.id ?? null,
          credentialId: input.credentialId, trainingId: input.trainingId, scope: input.scope, decision: input.decision, note: input.note,
        });
        // Retention of an explicitly used proof is committed with the decision.
        await logAccess({ actorId: ctx.user.id, actorRole: isAdmin ? "admin" : "AFFILIATION:MANAGER", subjectPersonId, action: "SIGNOFF", targetOrgId: orgId, dataAccessed: { trainingId: input.trainingId ?? null, decision: input.decision ?? "VALIDATED" }, ip: ipFromReq(ctx.req) });
        return so;
      }),
    signoffs: orgManagerProcedure
      .input(z.object({ employeeId: z.number() }))
      .query(async ({ ctx, input }) => {
        await requireManagedEmployee(ctx.user,input.employeeId);
        const file = await getTechnicianFile(input.employeeId);
        if (!file?.employee.userId) return [];
        return getSignoffsForSubject(file.employee.userId, file.employee.companyId);
      }),

    // ── Consolidated view + TNA (V2.3) ──
    consolidated: orgManagerProcedure.query(async ({ ctx }) => { await requireManagedCompany(ctx.user); return getCompanyConsolidated(ctx.user.id); }),
    roleRequirements: orgManagerProcedure.query(async ({ ctx }) => { if(ctx.user.companyId != null || ctx.user.role !== "admin") await requireManagedCompany(ctx.user); return getRoleRequirements(ctx.user.companyId ?? null); }),
    roleRequirementCourses: orgManagerProcedure.query(({ctx})=>roleRequirementCourses(ctx.user.id)),
    roleRequirementHistory: orgManagerProcedure
      .input(z.object({beforeId:z.number().int().positive().max(2147483647).optional()}))
      .query(({ctx,input})=>roleRequirementHistory(ctx.user.id,input.beforeId)),
    createRoleRequirement: orgManagerProcedure
      .input(roleRequirementInput)
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.companyId || ctx.user.role !== "admin") await requireManagedCompany(ctx.user);
        return createRoleRequirement({ ...input, companyId: ctx.user.companyId ?? null }, ctx.user.id);
      }),
    deleteRoleRequirement: orgManagerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => { if(ctx.user.role !== "admin") await requireManagedCompany(ctx.user); return deleteRoleRequirement(input.id, ctx.user.id); }),
    runTNA: orgManagerProcedure.mutation(async ({ ctx }) => {
      await requireManagedCompany(ctx.user);
      if (!ctx.user.companyId) throw new TRPCError({ code: "FORBIDDEN", message: "Compte entreprise requis." });
      return runTNA(ctx.user.companyId, ctx.user.id);
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
      archives: protectedProcedure.query(({ ctx }) => getPassportDocuments(ctx.user.id, true)),
      history: protectedProcedure.query(({ ctx }) => getPassportHistory(ctx.user.id)),
      historyPage: protectedProcedure.input(z.object({ beforeId: z.number().int().positive().optional() }).optional())
        .query(({ ctx, input }) => getPassportHistoryPage(ctx.user.id, input?.beforeId)),
      addDocument: protectedProcedure
        .input(z.object({
          requestId: z.string().uuid().optional(),
          kind: z.enum(["ID", "PASSPORT", "DIPLOMA", "CERTIFICATE", "LICENSE", "RATING", "LOGBOOK", "EXPERIENCE", "OTHER"]),
          title: z.string().trim().min(1).max(255),
          issuer: z.string().max(255).optional(),
          reference: z.string().max(128).optional(),
          country: z.string().max(64).optional(),
          issuedAt: z.string().date().optional(),
          expiresAt: z.string().date().optional(),
          fileName: z.string().min(1).max(255),
          contentType: z.enum(["application/pdf", "image/png", "image/jpeg"]),
          dataBase64: z.string().min(1).max(13981016),
        }))
        .mutation(({ ctx, input }) => createPassportDocument({
          requestId: input.requestId, personId: ctx.user.id, kind: input.kind, title: input.title,
          issuer: input.issuer, reference: input.reference, country: input.country,
          issuedAt: input.issuedAt ? new Date(input.issuedAt) : null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          fileName: input.fileName, contentType: input.contentType, dataBase64: input.dataBase64,
        })),
      deleteDocument: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
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
        if (org?.status === "ACTIVE") out.push({ orgId: a.orgId, name: org.name, role: a.role });
      }
      return out;
    }),
    // INV-5: the person — not the manager — surfaces a prior/external qualification.
    surfaceCredential: protectedProcedure
      .input(z.object({
        orgId:z.number().int().positive(), label: z.string().min(1), provider: z.string().optional(), trainingId: z.number().optional(),
        objectiveIds: z.array(z.number()).optional(), completedAt: z.string().optional(), expiresAt: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const cred = await surfaceCredentialForPerson(ctx.user.id, {
          orgId:input.orgId,label: input.label, provider: input.provider ?? null, trainingId: input.trainingId ?? null,
          objectiveIds: input.objectiveIds, completedAt: input.completedAt ? new Date(input.completedAt) : null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        });
        await logAccess({ actorId: ctx.user.id, actorRole: "self", subjectPersonId: ctx.user.id, action: "SURFACE_CREDENTIAL", targetOrgId:input.orgId,dataAccessed: { label: input.label }, ip: ipFromReq(ctx.req) });
        return cred;
      }),
    credentialSharingHistory: protectedProcedure
      .input(z.object({cursor:z.number().int().positive().optional()}))
      .query(({ctx,input})=>getCredentialSharingHistory(ctx.user.id,input.cursor)),
    shareCertificate: protectedProcedure
      .input(z.object({orgId:z.number().int().positive(),certificateId:z.number().int().positive()}))
      .mutation(async({ctx,input})=>{
        const proof=await shareCertificateForPerson(ctx.user.id,input.orgId,input.certificateId);
        await logAccess({actorId:ctx.user.id,actorRole:'self',subjectPersonId:ctx.user.id,action:'SHARE_CERTIFICATE',targetOrgId:input.orgId,dataAccessed:{certificateId:input.certificateId,credentialId:proof.id},ip:ipFromReq(ctx.req)});
        return proof;
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
    // Profile closure preserves regulatory and financial records; it is not full erasure.
    eraseAccount: protectedProcedure.input(z.object({password:z.string().min(1).max(1024)})).mutation(async ({ ctx,input }) => {
      if(!rateLimit(`close-account:${ctx.user.id}`,5,15*60*1000).ok)throw new TRPCError({code:'TOO_MANY_REQUESTS'});
      const result=await erasePerson(ctx.user.id,ctx.user.id,input.password);
      ctx.res.clearCookie(COOKIE_NAME);
      return result;
    }),
  }),

  // ─── Support tickets ─────────────────────────────────────────────────────────
  support: router({
    notificationQueue: adminProcedure.input(supportNotificationListInput.optional()).query(({ctx,input})=>listSupportNotifications(ctx.user.id,input)),
    sendNotification: adminProcedure.input(supportNotificationSendInput).mutation(({ctx,input})=>sendPendingSupportNotification(ctx.user.id,input)),
    myList: protectedProcedure.input(supportListInput.optional()).query(({ ctx, input }) => getMyTickets(ctx.user.id, input)),
    create: protectedProcedure
      .input(supportRequestInput)
      .mutation(async ({ ctx, input }) => {
        const {replayed,...tkt} = await createSupportTicket(ctx.user.id, input);
        await notifySupport(`ticket:${tkt.id}`);
        return tkt;
      }),
    detail: protectedProcedure.input(z.object({ticketId:z.number().int().positive().max(2147483647)}).strict())
      .query(({ctx,input})=>getSupportTicketDetail(input.ticketId,ctx.user.id)),
    thread: protectedProcedure
      .input(z.object({ ticketId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const tkt = await getTicketById(input.ticketId);
        if (!tkt) throw new TRPCError({ code: "NOT_FOUND" });
        const staff = ctx.user.role === "admin";
        if (!staff && tkt.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        return getTicketThread(input.ticketId,ctx.user.id);
      }),
    reply: protectedProcedure
      .input(supportMessageInput)
      .mutation(async ({ ctx, input }) => {
        const tkt = await getTicketById(input.ticketId);
        if (!tkt) throw new TRPCError({ code: "NOT_FOUND" });
        const staff = ctx.user.role === "admin";
        if (!staff && tkt.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        const result = await postTicketMessage(input.ticketId, ctx.user.id, input.content, input.requestId);
        const msg = result.message;
        await notifySupport(`message:${msg.id}`);
        return msg;
      }),
    adminList: adminProcedure.input(supportListInput.optional()).query(({input}) => getAdminTickets(input)),
    setStatus: adminProcedure
      .input(z.object({ ticketId: z.number().int().positive(), status: z.enum(["OPEN", "PENDING", "CLOSED"]),reason:z.string().trim().max(2000).optional() }))
      .mutation(({ ctx,input }) => setTicketStatus(input.ticketId, input.status,ctx.user.id,input.reason)),
    statusHistory:protectedProcedure.input(z.object({ticketId:z.number().int().positive(),cursor:z.number().int().positive().optional()}))
      .query(({ctx,input})=>getTicketStatusHistory(ctx.user.id,input.ticketId,input.cursor)),
  }),

  // ─── Quotes ────────────────────────────────────────────────────────────────
  quotes: router({
    create: publicProcedure
      .input(quoteRequestInput)
      // Link the quote to the account when the requester is logged in (enables messaging
      // + conversion without a manual email match).
      .mutation(async ({ ctx, input }) => {
        const q = await createQuoteRequest({ ...input, userId: ctx.user?.id ?? null });
        if (!q.replayed) await notifyAdminEmail(`Nouvelle demande de devis : ${input.companyName}`,
          emailBody(`${input.contactName} — ${input.contactEmail}\nSociété : ${input.companyName}\n${input.trainingTypes ? "Types : " + input.trainingTypes + "\n" : ""}${input.message ?? ""}`, "/admin"));
        return q;
      }),

    // Client view of their own quotes (by userId or matching email).
    myList: protectedProcedure.input(quoteListInput.optional()).query(({ ctx,input }) => getMyQuotes(ctx.user.id,input ?? {})),

    // Quote message thread — accessible to the quote owner or an admin.
    messages: router({
      list: protectedProcedure
        .input(quoteThreadInput)
        .query(({ctx,input})=>getQuoteMessages(input.quoteId,ctx.user.id)),
      send: protectedProcedure
        .input(quoteMessageInput)
        .mutation(async ({ ctx, input }) => {
          const {message:msg,quote:q,actorRole,replayed}=await createQuoteMessage(input,ctx.user.id);
          if(replayed)return msg;
          if (actorRole === "admin") {
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
    myClasses: protectedProcedure.input(instructorAgendaInput).query(({ctx,input}) => instructorAgenda(ctx.user.id,input)),
    videoTicket: protectedProcedure.input(z.object({ roomType: z.enum(["session", "webinar"]), roomId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => issueLiveVideoTicket(input.roomType, input.roomId, ctx.user.id)),
    presenceHistory: moderatorProcedure.input(z.object({ roomType: z.enum(["webinar", "session"]), roomId: z.number().int().positive(), beforeId: z.number().int().positive().optional() })).query(({ ctx, input }) => getPresenceHistory(input.roomType, input.roomId, ctx.user.id, input.beforeId)),
    access: protectedProcedure
      .input(z.object({ roomType: z.enum(["webinar", "session"]), roomId: z.number().int().positive() }))
      .query(({ ctx, input }) => getLiveAccess(input.roomType, input.roomId, { id: ctx.user.id })),
    join: protectedProcedure
      .input(z.object({ roomType: z.enum(["webinar", "session"]), roomId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => joinLiveRoom(input.roomType, input.roomId, ctx.user.id)),
    participants: protectedProcedure
      .input(z.object({ roomType: z.enum(["webinar", "session"]), roomId: z.number().int().positive() }))
      .query(({ ctx, input }) => getParticipants(input.roomType, input.roomId, ctx.user.id)),
    messages: protectedProcedure
      .input(z.object({ roomType: z.enum(["webinar", "session"]), roomId: z.number().int().positive() }))
      .query(({ ctx, input }) => getLiveMessages(input.roomType, input.roomId, ctx.user.id)),
    postMessage: protectedProcedure
      .input(z.object({ roomType: z.enum(["webinar", "session"]), roomId: z.number().int().positive(), kind: z.enum(["chat", "qa"]), content: z.string().trim().min(1).max(4000), requestId: z.string().uuid().optional() }))
      .mutation(({ ctx, input }) => postLiveMessage({ roomType: input.roomType, roomId: input.roomId, userId: ctx.user.id, kind: input.kind, content: input.content, requestId: input.requestId })),
    markAnswered: moderatorProcedure
      .input(z.object({ messageId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => setMessageAnswered(input.messageId, ctx.user.id)),
    polls: protectedProcedure
      .input(z.object({ roomType: z.enum(["webinar", "session"]), roomId: z.number().int().positive() }))
      .query(({ ctx, input }) => getLivePolls(input.roomType, input.roomId, ctx.user.id)),
    createPoll: moderatorProcedure
      .input(z.object({ roomType: z.enum(["webinar", "session"]), roomId: z.number().int().positive(), kind: z.enum(["poll", "quiz"]), question: z.string().trim().min(1).max(1000), options: z.array(z.string().trim().min(1).max(500)).min(2).max(10), correct: z.array(z.number().int().min(0).max(9)).max(10).optional() }))
      .mutation(({ ctx, input }) => createLivePoll(input, ctx.user.id)),
    closePoll: moderatorProcedure
      .input(z.object({ pollId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => closeLivePoll(input.pollId, ctx.user.id)),
    votePoll: protectedProcedure
      .input(z.object({ pollId: z.number().int().positive(), choices: z.array(z.number().int().min(0).max(9)).max(10) }))
      .mutation(({ ctx, input }) => voteLivePoll({ pollId: input.pollId, userId: ctx.user.id, choices: input.choices })),
    engagement: moderatorProcedure
      .input(z.object({ roomType: z.enum(["webinar", "session"]), roomId: z.number().int().positive() }))
      .query(({ ctx, input }) => getEngagementScores(input.roomType, input.roomId, ctx.user.id)),
    replayHistory: moderatorProcedure.input(replayHistoryInput).query(({ctx,input})=>getReplayHistory(ctx.user.id,input)),
    setReplay: moderatorProcedure
      .input(z.object({ roomType: z.enum(["webinar", "session"]), roomId: z.number().int().positive(), url: z.string().url().max(512).refine(v => v.startsWith("https://")), expectedRevision:z.number().int().min(0).max(2147483647) }))
      .mutation(({ ctx, input }) => setReplayUrl(input.roomType, input.roomId, input.url, ctx.user.id, input.expectedRevision)),
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
    certificate:adminProcedure.input(z.object({number:z.string().trim().min(1).max(64)})).query(({ctx,input})=>adminCertificate(ctx.user.id,input.number)),
    revokeCertificate:adminProcedure.input(certificateRevocationInput).mutation(({ctx,input})=>revokeCertificate(ctx.user.id,input)),
    stats: adminProcedure.query(() => getAdminStats()),
    users: adminProcedure.query(() => getAdminUsers()),
    // Per-org role management (matrix E): a person can be MANAGER of one org, MEMBER of another.
    setAffiliationRole: adminProcedure
      .input(z.object({ affiliationId: z.number(), role: z.enum(["MANAGER", "MEMBER"]) }))
      .mutation(({ input }) => setAffiliationRole(input.affiliationId, input.role)),
    // Operator-initiated profile closure with evidence retention.
    erasePerson: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Utilisez le parcours personnel pour fermer votre propre compte." });
        const target = await getUserById(input.userId);
        if (target?.role === "admin" && target?.status === "active" && (await countActiveAdmins()) <= 1)
          throw new TRPCError({ code: "BAD_REQUEST", message: "Impossible de fermer le compte du dernier administrateur actif." });
        const res = await erasePerson(input.userId,ctx.user.id);
        await logAccess({ actorId: ctx.user.id, actorRole: "admin", subjectPersonId: input.userId, action: "CLOSE_ACCOUNT", dataAccessed: { ...res }, ip: ipFromReq(ctx.req) });
        return res;
      }),
    // Broadcast a notification to all users (or a company), fanned out per-user.
    previewBroadcastRetry: adminProcedure.input(z.object({recipientId:z.number().int().positive()})).query(({ctx,input})=>previewBroadcastRetry(ctx.user.id,input.recipientId)),
    retryBroadcastRecipient: adminProcedure.input(broadcastRetryInput).mutation(({ctx,input})=>retryBroadcastRecipient(ctx.user.id,input)),
    broadcastRecipients: adminProcedure.input(broadcastRecipientInput).query(({ctx,input}) => broadcastRecipientHistory(ctx.user.id,input)),
    recoverBroadcastOutcome: adminProcedure.input(z.object({runId:z.number().int().positive()})).mutation(({ctx,input})=>recoverBroadcastOutcome(ctx.user.id,input.runId)),
    broadcastHistory: adminProcedure.input(broadcastHistoryInput).query(({ctx, input}) => broadcastHistory(ctx.user.id, input)),
    broadcast: adminProcedure.input(broadcastInput).mutation(({ ctx, input }) => sendAdminBroadcast(ctx.user.id, input)),

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
        .mutation(({ ctx, input }) => { const { id, ...data } = input; return updateTraining(id as number, data, ctx.user.id); }),
      delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
          const r = await deleteTraining(input.id, ctx.user.id);
          return r;
        }),
    }),

    orders: adminProcedure.query(() => getAdminOrders()),
    payments: router({
      history: adminProcedure.input(z.object({ orderId: z.number().int().positive() })).query(({ ctx, input }) => reconciliationHistory(ctx.user, input.orderId)),
      reconcile: adminProcedure.input(z.object({ orderId: z.number().int().positive(), sessionId: z.string().regex(/^cs_[A-Za-z0-9_]{1,250}$/).optional() })).mutation(({ ctx, input }) => {
        const stripe = getStripe();
        if (!stripe) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Stripe non configuré." });
        return reconcilePayment(stripe, ctx.user, input.orderId, input.sessionId);
      }),
    }),

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
          quizPassingScore: z.number().int().min(1).max(100).optional(),
          quizMaxAttempts: z.number().int().min(1).max(20).optional(),
          quizTimeLimitMin: z.number().int().min(1).max(240).nullable().optional(),
          objectiveId: z.number().nullable().optional(),
        }))
        .mutation(({ input }) => adminCreateModule(input)),
      update: adminProcedure
        .input(z.object({ id: z.number(), quizPassingScore: z.number().int().min(1).max(100).optional(), quizMaxAttempts: z.number().int().min(1).max(20).optional(), quizTimeLimitMin: z.number().int().min(1).max(240).nullable().optional() }).and(z.record(z.string(), z.unknown())))
        .mutation(({ input }) => { const { id, ...data } = input; return adminUpdateModule(id as number, data); }),
      delete: adminProcedure
        .input(z.object({ id: z.number() }))
        .mutation(({ ctx, input }) => adminDeleteModule(input.id, ctx.user.id)),
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
        .mutation(({ ctx, input }) => adminDeleteObjective(input.id, ctx.user.id)),
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
        .mutation(({ ctx, input }) => adminDeleteQuestion(input.id, ctx.user.id)),
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
      .mutation(async ({ input }) => { const { id, ...data } = input; const u = await adminUpdateUser(id, data); return u ? sanitizeUser(u) : null; }),

    // ── Organizations module (companies + their MANAGER affiliations) ──
    organizations: router({
      list: adminProcedure.query(() => getAdminOrganizations()),
      create: adminProcedure
        .input(z.object({ name: z.string().min(1), type: z.string().optional(), agreementNumber: z.string().optional(), country: z.string().optional(), siret: z.string().optional(), contactEmail: z.string().optional() }))
        .mutation(({ input }) => adminCreateOrganization(input)),
      update: adminProcedure
        .input(z.object({ id: z.number() }).and(z.record(z.string(), z.unknown())))
        .mutation(({ input }) => { const { id, ...data } = input; return adminUpdateOrganization(id as number, data); }),
      statusHistory: adminProcedure.input(organizationHistoryInput).query(({ctx,input}) => organizationStatusHistory(ctx.user.id,input)),
      setStatus: adminProcedure
        .input(z.object({ id: z.number(), status: z.enum(["ACTIVE", "SUSPENDED"]) }))
        .mutation(({ ctx, input }) => adminSetOrganizationStatus(input.id, input.status, ctx.user.id)),
      // Retain the old route as an explicit refusal for clients not yet refreshed.
      delete: adminProcedure.input(z.object({id:z.number().int().positive()})).mutation(() => {
        throw new TRPCError({code:"PRECONDITION_FAILED",message:"La suppression définitive des compagnies est désactivée. Utilisez la suspension pour conserver leurs données."});
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

    webinars: router({
      list: adminProcedure.query(({ctx}) => listAdminWebinars(ctx.user.id)),
      history: adminProcedure.input(webinarHistoryInput).query(({ctx,input}) => webinarHistory(ctx.user.id,input)),
      update: adminProcedure.input(webinarMetadataInput).mutation(({ctx,input}) => updateWebinarMetadata(ctx.user.id,input)),
      create: adminProcedure.input(webinarCreateInput).mutation(({ctx,input}) => createAdminWebinar(ctx.user.id,input)),
      schedule: adminProcedure.input(webinarScheduleInput).mutation(({ctx,input}) => rescheduleWebinar(ctx.user.id,input)),
      setStatus: adminProcedure.input(webinarStatusInput).mutation(({ctx,input}) => setWebinarStatus(ctx.user.id,input)),
    }),
    liveInstructors: router({
      history: adminProcedure.input(instructorHistoryInput).query(({ctx,input}) => liveInstructorHistory(ctx.user.id,input)),
      search: adminProcedure.input(instructorSearchInput).query(({ctx,input}) => searchLiveInstructors(ctx.user.id,input)),
      list: adminProcedure.input(instructorRoomInput).query(({ctx,input}) => listLiveInstructors(ctx.user.id,input)),
      set: adminProcedure.input(instructorAssignmentInput).mutation(({ctx,input}) => setLiveInstructor(ctx.user.id,input)),
    }),
    // ── Sessions ──
    sessions: router({
      scheduleHistory: adminProcedure.input(scheduleHistoryInput).query(({ctx,input}) => sessionScheduleHistory(ctx.user.id,input)),
      list: adminProcedure.query(() => getAllSessions()),
      create: adminProcedure
        .input(z.object({
          title: z.string().min(1),
          trainingId: z.number().nullable().optional(),
          description: z.string().optional(),
          format: z.enum(["in_person", "virtual", "webinar"]),
          location: z.string().optional(),
          instructorName: z.string().optional(),
          startDate: z.string().datetime({offset:true}),
          endDate: z.string().datetime({offset:true}).optional(),
          durationDays: z.string().optional(),
          seats: z.number().optional(),
          priceHt: z.string().optional(),
          language: z.string().optional(),
          cpfEligible: z.boolean().optional(),
        }).refine(v => (!v.endDate ? v.format === "in_person" : Date.parse(v.endDate)>Date.parse(v.startDate)), {message:"Renseignez une fin après le début pour les classes à distance.",path:["endDate"]}))
        .mutation(({ input }) => createSession({
          ...input,
          startDate: new Date(input.startDate),
          endDate: input.endDate ? new Date(input.endDate) : undefined,
        })),
      update: adminProcedure.input(scheduleInput).mutation(({ctx,input}) => rescheduleSession(ctx.user.id,input)),
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
        .input(quoteStatusInput)
        .mutation(({ ctx, input }) => updateQuoteRequestStatus(input, ctx.user.id)),
      statusHistory: adminProcedure
        .input(z.object({quoteId:z.number().int().positive().max(2147483647),beforeId:z.number().int().positive().max(2147483647).optional()}).strict())
        .query(({input})=>getQuoteStatusHistory(input.quoteId,input.beforeId)),
      // Convert an accepted quote into an order + Stripe checkout (always via Stripe).
      // The admin maps the free-text request to catalogue trainings + negotiated prices.
      convert: adminProcedure
        .input(z.object({
          quoteId: z.number().int().positive(), origin: z.string(), companyId: z.number().int().positive().optional(),
          items: z.array(z.object({
            trainingId: z.number().int().positive(), title: z.string().trim().min(1).max(255), quantity: z.number().int().min(1).max(100),
            unitPriceHt: z.number().min(0).max(999999.99), unitPriceTtc: z.number().min(0).max(999999.99),
          })).min(1).max(100),
        }))
        .mutation(async ({ ctx, input }) => {
          const q = await getQuoteById(input.quoteId);
          if (!q) throw new TRPCError({ code: "NOT_FOUND" });
          let userId = q.userId ?? null;
          if (!userId && q.contactEmail) userId = (await findUserByEmail(q.contactEmail))?.id ?? null;
          if (!userId) throw new TRPCError({ code: "BAD_REQUEST", message: `Aucun compte trouvé pour ${q.contactEmail}. Le client doit s'inscrire (utilisez la messagerie pour l'inviter) avant la conversion.` });
          const buyer = await getUserById(userId);
          if (!buyer) throw new TRPCError({ code: "NOT_FOUND", message: "Compte acheteur introuvable." });
          if (input.companyId) await requireManagedCompany(buyer, input.companyId);
          const res = await createQuoteCheckout({
            quoteId: input.quoteId, actor: ctx.user, userRole: buyer.role, userId, userEmail: buyer?.email ?? q.contactEmail, userName: buyer?.name ?? q.contactName,
            items: input.items, origin: input.origin, companyId: input.companyId,
          });
          return res;
        }),
    }),

    complianceReport: adminProcedure.input(complianceReportInput).query(async ({ ctx,input }) => {
      // Each page rechecks current rights and commits its access audit before returning data.
      return getAdminComplianceReport(ctx.user.id,input?.cursor,input?.pageSize,ipFromReq(ctx.req));
    }),

    runExpiryAlerts: adminProcedure.mutation(() => generateExpiryAlerts()),

    examFinalizationFailures: adminProcedure.query(() => getExamFinalizationFailures()),
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
    uploadMedia: protectedProcedure.input(z.object({ trainingId: z.number().int().positive(), contentType: z.enum(["image/png", "image/jpeg", "audio/mpeg", "video/mp4", "application/pdf"]), base64: z.string().min(1).max(34952536) }))
      .mutation(({ ctx, input }) => uploadCourseMedia(ctx.user, input.trainingId, input.base64, input.contentType)),
    reviews: router({
      withdraw: staffProcedure.input(z.object({ reviewId: z.number().int().positive(), reason: z.string().trim().min(10).max(4000) })).mutation(({ ctx, input }) => withdrawPedagogicalApproval(ctx.user, input.reviewId, input.reason)),
      pending: staffProcedure.query(({ ctx }) => pendingPedagogicalReviews(ctx.user)),
      list: staffProcedure.input(z.object({ trainingId: z.number().int().positive() })).query(({ ctx, input }) => listPedagogicalReviews(ctx.user, input.trainingId)),
      request: staffProcedure.input(z.object({ trainingId: z.number().int().positive() })).mutation(({ ctx, input }) => requestPedagogicalReview(ctx.user, input.trainingId)),
      snapshot: staffProcedure.input(z.object({ reviewId: z.number().int().positive() })).query(({ ctx, input }) => reviewSnapshot(ctx.user, input.reviewId)),
      decide: staffProcedure.input(z.object({ reviewId: z.number().int().positive(), decision: z.enum(["approved", "rejected"]), note: z.string().trim().min(1).max(4000) })).mutation(({ ctx, input }) => decidePedagogicalReview(ctx.user, input.reviewId, input.decision, input.note)),
    }),
    workspaces: protectedProcedure.query(({ ctx }) => authorWorkspaces(ctx.user)),
    distributionCandidates: staffProcedure.input(z.object({ trainingId: z.number().int().positive() })).query(({ ctx, input }) => distributionCandidates(ctx.user, input.trainingId)),
    assign: staffProcedure.input(z.object({ trainingId: z.number().int().positive(), userIds: z.array(z.number().int().positive()).min(1).max(100) })).mutation(({ ctx, input }) => assignCompanyTraining(ctx.user, input.trainingId, input.userIds)),
    versions: staffProcedure.input(z.object({ trainingId: z.number().int().positive() })).query(async ({ ctx, input }) => { await requireAuthorCourse(ctx.user, input.trainingId, true); return publishedVersions(input.trainingId); }),
    history: staffProcedure.input(z.object({ trainingId: z.number().int().positive() })).query(async ({ ctx, input }) => { await requireAuthorCourse(ctx.user, input.trainingId, true); return contentHistory(input.trainingId); }),
    archive: staffProcedure.input(z.object({ trainingId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await requireAuthorCourse(ctx.user, input.trainingId); return deleteTraining(input.trainingId, ctx.user.id); }),
    content: router({
    // ── E-learning content: modules ──
    modules: router({
      list: staffProcedure
        .input(z.object({ trainingId: z.number() }))
        .query(async ({ ctx, input }) => { await requireAuthorCourse(ctx.user, input.trainingId); return getTrainingModules(input.trainingId); }),
      create: staffProcedure.input(moduleCreationInput).mutation(({ctx,input})=>createAuthorModule(ctx.user.id,input)),
      update: staffProcedure
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
          quizPassingScore: z.number().int().min(1).max(100).optional(),
          quizMaxAttempts: z.number().int().min(1).max(20).optional(),
          quizTimeLimitMin: z.number().int().min(1).max(240).nullable().optional(),
          objectiveId: z.number().nullable().optional(),
        }).omit({ trainingId: true }).partial().extend({ id: z.number().int().positive(), expectedRevision: z.number().int().min(0).max(2147483647).optional() }).strict())
        .mutation(async ({ ctx, input }) => { const { id, expectedRevision, ...data } = input; await requireAuthorContent(ctx.user, "module", id as number, data); return adminUpdateModule(id as number, data, expectedRevision); }),
      reorder: staffProcedure.input(z.object({orderedIds:z.array(z.number().int().positive()).min(1),expectedRevisions:z.array(z.number().int().min(0).max(2147483647))}).refine(input=>new Set(input.orderedIds).size===input.orderedIds.length&&input.orderedIds.length===input.expectedRevisions.length)).mutation(async({ctx,input})=>{for(const id of input.orderedIds)await requireAuthorContent(ctx.user,'module',id);return reorderModules(input.orderedIds,input.expectedRevisions);}),
      delete: staffProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => { await requireAuthorContent(ctx.user, "module", input.id); return adminDeleteModule(input.id, ctx.user.id); }),
    }),

    // ── E-learning content: Part-66 objectives (sub-modules) ──
    objectives: router({
      list: staffProcedure
        .input(z.object({ trainingId: z.number() }))
        .query(async ({ ctx, input }) => { await requireAuthorCourse(ctx.user, input.trainingId); return getObjectives(input.trainingId); }),
      create: staffProcedure.input(objectiveCreationInput).mutation(({ctx,input})=>createAuthorObjective(ctx.user.id,input)),
      update: staffProcedure
        .input(z.object({
          trainingId: z.number(),
          moduleId: z.number().nullable().optional(),
          code: z.string().optional(),
          title: z.string().min(1),
          description: z.string().optional(),
          knowledgeLevel: z.enum(["1", "2", "3"]).optional(),
          isRequired: z.boolean().optional(),
          sortOrder: z.number().optional(),
        }).omit({ trainingId: true }).partial().extend({ id: z.number().int().positive(), expectedRevision: z.number().int().min(0).max(2147483647).optional() }).strict())
        .mutation(async ({ ctx, input }) => { const { id, expectedRevision, ...data } = input; await requireAuthorContent(ctx.user, "objective", id as number, data); return adminUpdateObjective(id as number, data, expectedRevision); }),
      delete: staffProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => { await requireAuthorContent(ctx.user, "objective", input.id); return adminDeleteObjective(input.id, ctx.user.id); }),
      reorder: staffProcedure
        .input(z.object({ orderedIds: z.array(z.number().int().positive()).min(1), expectedSortOrders: z.array(z.number().int().nullable()).optional() }))
        .mutation(async ({ ctx, input }) => { for (const id of input.orderedIds) await requireAuthorContent(ctx.user, "objective", id); return reorderObjectives(input.orderedIds, input.expectedSortOrders); }),
    }),

    // ── E-learning content: quiz question bank ──
    questions: router({
      list: staffProcedure
        .input(z.object({ trainingId: z.number() }))
        .query(async ({ ctx, input }) => { await requireAuthorCourse(ctx.user, input.trainingId); return getQuizQuestions(input.trainingId); }),
      create: staffProcedure.input(questionCreationInput).mutation(({ ctx, input }) => createAuthorQuestion(ctx.user.id, input)),
      update: staffProcedure
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
        }).omit({ trainingId: true }).partial().extend({ id: z.number().int().positive(), expectedRevision: z.number().int().min(0).max(2147483647).optional() }).strict())
        .mutation(async ({ ctx, input }) => { const { id, expectedRevision, ...data } = input; await requireAuthorContent(ctx.user, "question", id as number, data); return adminUpdateQuestion(id as number, data, expectedRevision); }),
      delete: staffProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => { await requireAuthorContent(ctx.user, "question", input.id); return adminDeleteQuestion(input.id, ctx.user.id); }),
    }),

    }),
    readiness: staffProcedure.input(z.object({ trainingId: z.number().int().positive() })).query(async ({ ctx, input }) => { await requireAuthorCourse(ctx.user, input.trainingId); return courseReadiness(input.trainingId); }),
    courses: staffProcedure.query(({ ctx }) => listAuthorCourses(ctx.user)),
    slides: staffProcedure
      .input(z.object({ trainingId: z.number() }))
      .query(async ({ ctx, input }) => { await requireAuthorCourse(ctx.user, input.trainingId); return getSlides(input.trainingId); }),
    objectives: staffProcedure
      .input(z.object({ trainingId: z.number() }))
      .query(async ({ ctx, input }) => { await requireAuthorCourse(ctx.user, input.trainingId); return getObjectives(input.trainingId); }),
    templates: staffProcedure.query(() => getCourseTemplates()),
    copyCourse: staffProcedure.input(copyCourseInput).mutation(({ctx,input}) => copyCourse(ctx.user.id,input)),
    createFromTemplate: staffProcedure
      .input(z.object({ templateId: z.number(), orgId: z.number().int().positive().optional() }))
      .mutation(async ({ ctx, input }) => { const owner = await courseOwnership(ctx.user, input.orgId); return createCourseFromTemplate(input.templateId, owner.ownerUserId, owner.ownerOrgId); }),
    createSlide: staffProcedure.input(slideCreationInput).mutation(({ctx,input})=>createAuthorSlide(ctx.user.id,input)),
    updateSlide: staffProcedure
      .input(z.object({ id: z.number(), expectedRevision: z.number().int().min(0).max(2147483647).optional() }).and(z.record(z.string(), z.unknown())))
      .mutation(async ({ ctx, input }) => { const { id, expectedRevision, ...data } = input; const [slide] = await requireAuthorSlides(ctx.user, [id as number]); if (data.trainingId !== undefined && data.trainingId !== slide.trainingId) throw new TRPCError({ code: "BAD_REQUEST" }); delete data.trainingId; for (const key of Object.keys(data)) if (!["moduleId", "objectiveId", "sortOrder", "title", "body", "imageUrl", "imagePrompt", "videoUrl", "audioUrl", "videoCues", "quizQuestion", "quizOptions", "quizCorrect", "quizExplanation"].includes(key)) throw new TRPCError({ code: "BAD_REQUEST", message: "Champ de diapositive non modifiable." }); await validateSlideLinks(slide.trainingId, data); return updateSlide(id as number, data, expectedRevision); }),
    deleteSlide: staffProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => { await requireAuthorSlides(ctx.user, [input.id]); return deleteSlide(input.id, ctx.user.id); }),
    reorderSlides: staffProcedure
      .input(z.object({ orderedIds: z.array(z.number().int().positive()).min(1).refine(ids=>new Set(ids).size===ids.length), expectedRevisions:z.array(z.number().int().min(0).max(2147483647)).optional() }).refine(input=>input.expectedRevisions===undefined||input.expectedRevisions.length===input.orderedIds.length))
      .mutation(async ({ ctx, input }) => { const rows = await requireAuthorSlides(ctx.user, input.orderedIds); if (new Set(rows.map(r => r.trainingId)).size > 1) throw new TRPCError({ code: "BAD_REQUEST" }); return reorderSlides(input.orderedIds,input.expectedRevisions); }),
    publish: staffProcedure
      .input(z.object({ id: z.number(), isPublished: z.boolean() }))
      .mutation(async ({ ctx, input }) => { await requireAuthorCourse(ctx.user, input.id); return updateTraining(input.id, { isPublished: input.isPublished }, ctx.user.id); }),
    pendingAiOutlines: staffProcedure.input(pendingOutlineInput).query(({ctx,input}) => pendingAiOutlines(ctx.user.id,input)),
    createFromAiOutline: staffProcedure.input(z.object({id:z.number().int().positive()})).mutation(({ctx,input}) => createFromAiOutline(ctx.user.id,input.id)),
    createCourse: staffProcedure
      .input(courseDraftInput.omit({categoryId:true}))
      .mutation(async ({ ctx, input }) => { const owner = await courseOwnership(ctx.user, input.orgId); return createCourseWithSlides({ ...input, ...owner }); }),
  }),

  // ─── AI assistance (admin + instructor) ────────────────────────────────────
  ai: router({
    usage: protectedProcedure.query(({ctx}) => aiRequestUsage(ctx.user.id)),
    providers: staffProcedure.query(() => aiProviderStatus()),
    generateOutline: staffProcedure
      .input(z.object({
        orgId: z.number().int().positive().optional(),
        provider: z.enum(["openai", "anthropic", "google", "mistral"]),
        topic: z.string().trim().min(2).max(2000),
        audience: z.string().max(2000).optional(),
        slideCount: z.number().int().min(2).max(14).optional(),
        language: z.enum(["fr","en","ar"]).optional(),
        level: z.string().max(100).optional(),
        tone: z.string().max(100).optional(),
        domain: z.string().max(1000).optional(),
        objectives: z.string().max(10000).optional(),
        quizCoverage: z.enum(["none", "some", "all"]).optional(),
        references: z.boolean().optional(),
      }))
      .mutation(async ({ctx,input}) => {const owner=await courseOwnership(ctx.user,input.orgId);return runAiRequest(ctx.user.id,"outline",async requestId => {const output=await aiErr(()=>aiGenerateOutline(input));return saveAiOutline(ctx.user.id,owner.ownerOrgId??null,requestId,input.language??"en",output);});}),
    generateSlideText: staffProcedure
      .input(z.object({
        provider: z.enum(["openai", "anthropic", "google", "mistral"]),
        instruction: z.string().trim().min(2).max(20000),
        language: z.enum(["fr","en","ar"]).optional(),
      }))
      .mutation(({ ctx, input }) => runAiRequest(ctx.user.id,"slide_text",() => aiErr(() => aiWriteSlideText(input)))),
    generateQuiz: staffProcedure
      .input(z.object({
        provider: z.enum(["openai", "anthropic", "google", "mistral"]),
        content: z.string().trim().min(2).max(20000),
        language: z.enum(["fr","en","ar"]).optional(),
      }))
      .mutation(({ ctx, input }) => runAiRequest(ctx.user.id,"quiz",() => aiErr(() => aiGenerateQuiz(input)))),
    generateImage: protectedProcedure
      .input(z.object({
        trainingId: z.number().int().positive(),
        prompt: z.string().min(2).max(10000),
        provider: z.enum(["openai", "anthropic", "google", "mistral"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => { await requireAuthorCourse(ctx.user, input.trainingId); return runAiRequest(ctx.user.id,"image",() => aiErr(() => generateImage({ ...input, actor: ctx.user }))); }),
    startVideo: staffProcedure.input(startVideoInput).mutation(({ctx,input}) => startAiVideo(ctx.user.id,input)),
    videos: staffProcedure.input(z.object({trainingId:z.number().int().positive()})).query(({ctx,input}) => listAiVideos(ctx.user.id,input.trainingId)),
    refreshVideo: staffProcedure.input(z.object({id:z.string().uuid()})).mutation(({ctx,input}) => refreshAiVideo(ctx.user.id,input.id)),
    generateAudio: protectedProcedure
      .input(z.object({
        trainingId: z.number().int().positive(),
        text: z.string().trim().min(1).max(20000),
        provider: z.enum(["openai", "anthropic", "google", "mistral"]).optional(),
        language: z.enum(["fr","en","ar"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => { await requireAuthorCourse(ctx.user, input.trainingId); return runAiRequest(ctx.user.id,"speech",() => aiErr(() => generateSpeech({ ...input, actor: ctx.user }))); }),
  }),
});

export type AppRouter = typeof appRouter;
