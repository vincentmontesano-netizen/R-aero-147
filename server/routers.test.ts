import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import * as email from "./email";
vi.mock("./email", async importOriginal => ({
  ...await importOriginal<typeof import("./email")>(),
  isEmailConfigured: vi.fn().mockReturnValue(false),
  adminNotifyEmail: vi.fn().mockReturnValue("admin@example.com"),
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB ──────────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getPublicTrainings: vi.fn().mockResolvedValue([
    { id: 1, title: "Facteurs Humains", slug: "human-factors-initial", type: "elearning", isPublished: true, priceTtc: "178.80", durationHours: "4.00" },
    { id: 2, title: "FTS", slug: "fuel-tank-safety-fts", type: "elearning", isPublished: true, priceTtc: "154.80", durationHours: "3.00" },
  ]),
  getFeaturedTrainings: vi.fn().mockResolvedValue([
    { id: 1, title: "Facteurs Humains", slug: "human-factors-initial", type: "elearning", isPublished: true, isFeatured: true },
  ]),
  getTrainingBySlug: vi.fn().mockResolvedValue({ id: 1, title: "Facteurs Humains", slug: "human-factors-initial", type: "elearning", passingScore: 75, maxAttempts: 3 }),
  getTrainingCategories: vi.fn().mockResolvedValue([{ id: 1, name: "Facteurs Humains", slug: "human-factors" }]),
  getCartItems: vi.fn().mockResolvedValue([]),
  getCartCount: vi.fn().mockResolvedValue(0),
  addToCart: vi.fn().mockResolvedValue(undefined),
  removeFromCart: vi.fn().mockResolvedValue(undefined),
  clearCart: vi.fn().mockResolvedValue(undefined),
  getUserEnrollments: vi.fn().mockResolvedValue([]),
  getEnrollmentById: vi.fn().mockResolvedValue(null),
  updateEnrollmentProgress: vi.fn().mockResolvedValue(undefined),
  getUserCertificates: vi.fn().mockResolvedValue([]),
  getCertificateByCode: vi.fn().mockResolvedValue(null),
  getUserCompany: vi.fn().mockResolvedValue(null),
  createOrUpdateCompany: vi.fn().mockResolvedValue(null),
  getCompanyEmployees: vi.fn().mockResolvedValue([]),
  createEmployee: vi.fn().mockResolvedValue({ success: true }),
  updateEmployee: vi.fn().mockResolvedValue(undefined),
  getCompanyRecurrencies: vi.fn().mockResolvedValue([]),
  importEmployeesCSV: vi.fn().mockResolvedValue({ imported: 2, errors: [] }),
  createQuoteMessage: vi.fn(),
  createQuoteRequest: vi.fn().mockResolvedValue({ success: true }),
  getQuoteRequests: vi.fn().mockResolvedValue([]),
  getWebinars: vi.fn().mockResolvedValue([]),
  registerForWebinar: vi.fn().mockResolvedValue({ success: true }),
  getAdminStats: vi.fn().mockResolvedValue({ users: 5, trainings: 8, orders: 12, quotes: 3, enrollments: 20 }),
  getAdminUsers: vi.fn().mockResolvedValue([]),
  getAdminTrainings: vi.fn().mockResolvedValue([]),
  createTraining: vi.fn().mockResolvedValue({ success: true }),
  updateTraining: vi.fn().mockResolvedValue({ success: true }),
  getAdminOrders: vi.fn().mockResolvedValue([]),
  getQuoteStatusHistory: vi.fn().mockResolvedValue({entries:[],nextBeforeId:null}),
  getAdminQuoteRequests: vi.fn().mockResolvedValue([]),
  updateQuoteRequestStatus: vi.fn().mockResolvedValue({ success: true }),
  getAdminUserDetail: vi.fn().mockResolvedValue({ user: { id: 1, name: "Test" }, orders: [], enrollments: [], certificates: [] }),
  getAdminComplianceReport: vi.fn().mockResolvedValue({entries:[],nextCursor:null}),
  getTrainingModules: vi.fn().mockResolvedValue([]),
  getModuleProgress: vi.fn().mockResolvedValue([]),
  updateModuleProgress: vi.fn().mockResolvedValue({ progress: 50, status: "in_progress" }),
  getQuizQuestions: vi.fn().mockResolvedValue([]),
  submitQuizAttempt: vi.fn().mockResolvedValue({ score: 8, maxScore: 10, percentage: 80, isPassed: true, passingScore: 75, feedback: [] }),
  getQuizAttempts: vi.fn().mockResolvedValue([]),
  updateUserProfile: vi.fn().mockResolvedValue({ id: 1, name: "Updated User" }),
  getUserById: vi.fn().mockResolvedValue({ id: 1, name: "Test User",status:"active" }),
}));

vi.mock("./stripe", () => ({
  createCheckoutSession: vi.fn().mockRejectedValue(new Error("Stripe non configuré.")),
}));

vi.mock("./certificate", () => ({
  issueCertificate: vi.fn().mockResolvedValue({ certificateNumber: "RAERO-2026-ABCD1234", verificationCode: "VERIF123456", pdfUrl: "/storage/cert.pdf" }),
}));

vi.mock("./invoice", () => ({
  generateInvoicePDF: vi.fn().mockResolvedValue("/storage/invoice.pdf"),
}));

// ─── Context helpers ──────────────────────────────────────────────────────────
function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createUserContext(role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "email",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("auth", () => {
  it("auth.me returns null for unauthenticated user", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    expect(await caller.auth.me()).toBeNull();
  });

  it("auth.me returns user for authenticated user", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.auth.me();
    expect(result?.email).toBe("test@example.com");
  });

  it("auth.logout clears the session cookie", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect((ctx.res.clearCookie as any).mock.calls.length).toBe(1);
  });

  it("auth.updateProfile updates user profile", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.auth.updateProfile({ name: "Updated User", licenseNumber: "FR.66.12345678" });
    expect(result).toBeDefined();
  });
});

describe("public", () => {
  it("public.trainings returns published trainings", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.public.trainings({});
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("public.featuredTrainings returns featured trainings", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    expect(Array.isArray(await caller.public.featuredTrainings())).toBe(true);
  });

  it("public.categories returns training categories", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.public.categories();
    expect(result.length).toBeGreaterThan(0);
  });

  it("public.trainingBySlug returns training by slug", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.public.trainingBySlug({ slug: "human-factors-initial" });
    expect(result?.slug).toBe("human-factors-initial");
  });

  it("public.verifyCertificate returns null for unknown code", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.public.verifyCertificate({ code: "UNKNOWN" });
    expect(result).toBeNull();
  });
});

describe("cart", () => {
  it("cart.count returns 0 for empty cart", async () => {
    const caller = appRouter.createCaller(createUserContext());
    expect(await caller.cart.count()).toBe(0);
  });

  it("cart.list returns empty array for empty cart", async () => {
    const caller = appRouter.createCaller(createUserContext());
    expect(Array.isArray(await caller.cart.list())).toBe(true);
  });
});

describe("checkout", () => {
  it("checkout.createSession throws when Stripe is not configured", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.checkout.createSession({ origin: "https://example.com" })).rejects.toThrow();
  });
});

describe("learning", () => {
  beforeEach(() => {
    vi.mocked(db.getEnrollmentById).mockResolvedValue({ id: 1, userId: 1, trainingId: 1, status: "in_progress", expiresAt: null, modules: [{ id: 10 }] } as any);
    vi.mocked(db.getUserEnrollments).mockResolvedValue([{ id: 1, userId: 1, trainingId: 1, status: "in_progress", expiresAt: null }] as any);
  });

  it("rejects another learner's enrollment before reading or mutating it", async () => {
    vi.mocked(db.getEnrollmentById).mockResolvedValue(null);
    const caller = appRouter.createCaller(createUserContext());
    for (const request of [
      () => caller.learning.moduleProgress({ enrollmentId: 99 }),
      () => caller.learning.objectiveProgress({ enrollmentId: 99 }),
      () => caller.learning.quizAttempts({ enrollmentId: 99 }),
      () => caller.learning.completeModule({ enrollmentId: 99, moduleId: 10 }),
      () => caller.learning.submitQuiz({ enrollmentId: 99, trainingId: 1, answers: {} }),
      () => caller.learning.startExam({ enrollmentId: 99, trainingId: 1 }),
      () => caller.learning.issueCertificate({ enrollmentId: 99, origin: "https://example.com" }),
      () => caller.dashboard.updateProgress({ enrollmentId: 99, progressPercent: 100 }),
    ]) await expect(request()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects unsubscribed access to paid content", async () => {
    vi.mocked(db.getUserEnrollments).mockResolvedValue([]);
    const caller = appRouter.createCaller(createUserContext());
    for (const request of [
      () => caller.learning.modules({ trainingId: 9 }),
      () => caller.learning.slides({ trainingId: 9 }),
      () => caller.learning.objectives({ trainingId: 9 }),
      () => caller.learning.quizQuestions({ trainingId: 9 }),
    ]) await expect(request()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects expired access and mismatched training or chapter", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.learning.submitQuiz({ enrollmentId: 1, trainingId: 9, answers: {} })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.learning.completeModule({ enrollmentId: 1, moduleId: 99 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    vi.mocked(db.getEnrollmentById).mockResolvedValue({ trainingId: 1, status: "expired", expiresAt: null } as any);
    await expect(caller.learning.moduleProgress({ enrollmentId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("never sends answer keys or explanations in learner questions", async () => {
    vi.mocked(db.getQuizQuestions).mockResolvedValueOnce([{ id: 1, question: "Match", options: ["A"], optionsRight: ["B"], correctAnswer: [0], answerKey: { pairs: [[0, 0]] }, explanation: "secret" }] as any);
    const result = await appRouter.createCaller(createUserContext()).learning.quizQuestions({ trainingId: 1 });
    expect(result[0].optionsRight).toEqual(["B"]);
    expect(result[0]).not.toHaveProperty("correctAnswer");
    expect(result[0]).not.toHaveProperty("answerKey");
    expect(result[0]).not.toHaveProperty("explanation");
  });

  it("rejects client-requested certification status", async () => {
    await expect(appRouter.createCaller(createUserContext()).dashboard.updateProgress({ enrollmentId: 1, progressPercent: 100, status: "completed" as any })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("learning.modules returns empty array when no modules", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.learning.modules({ trainingId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("learning.submitQuiz returns result with score", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.learning.submitQuiz({
      enrollmentId: 1, trainingId: 1,
      answers: { "1": [0], "2": [1] }, attemptNumber: 1,
    });
    expect(result?.isPassed).toBe(true);
    expect(result?.percentage).toBe(80);
  });

  it("learning.issueCertificate returns certificate data", async () => {
    const caller = appRouter.createCaller(createUserContext());
    const result = await caller.learning.issueCertificate({ enrollmentId: 1, origin: "https://example.com" });
    expect(result?.certificateNumber).toContain("RAERO");
  });
});

describe("quotes", () => {
  it("recovers a saved message without repeating its notification",async()=>{
    const caller=appRouter.createCaller(createUserContext());
    const input={quoteId:1,content:"Reply",requestId:"36263b9a-d259-4816-a5a5-45b53cd38254"};
    const result={message:{id:254,content:"Reply"},quote:{id:1},actorRole:"user",replayed:false};
    vi.mocked(email.sendEmail).mockClear();
    vi.mocked(email.isEmailConfigured).mockReturnValue(true);
    try{
      vi.mocked(db.createQuoteMessage).mockResolvedValueOnce(result as any);
      await caller.quotes.messages.send(input);
      expect(email.sendEmail).toHaveBeenCalledTimes(1);
      vi.mocked(db.createQuoteMessage).mockResolvedValueOnce({...result,replayed:true} as any);
      expect(await caller.quotes.messages.send(input)).toEqual(result.message);
      expect(email.sendEmail).toHaveBeenCalledTimes(1);
    }finally{vi.mocked(email.isEmailConfigured).mockReturnValue(false);}
  });

  it("restricts status history to admins and requires the observed revision for updates",async()=>{
    const publicCaller=appRouter.createCaller(createPublicContext());
    const userCaller=appRouter.createCaller(createUserContext());
    await expect(publicCaller.admin.quotes.statusHistory({quoteId:1})).rejects.toMatchObject({code:"UNAUTHORIZED"});
    await expect(userCaller.admin.quotes.statusHistory({quoteId:1})).rejects.toMatchObject({code:"FORBIDDEN"});
    const admin=appRouter.createCaller(createUserContext("admin"));
    await expect(admin.admin.quotes.updateStatus({id:1,status:"accepted"} as any)).rejects.toMatchObject({code:"BAD_REQUEST"});
    await admin.admin.quotes.updateStatus({id:1,status:"accepted",expectedRevision:2});
    expect(db.updateQuoteRequestStatus).toHaveBeenCalledWith({id:1,status:"accepted",expectedRevision:2},expect.any(Number));
  });

  it("does not notify again when recovering an already persisted quote", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const data = {companyName:"Retry MRO",contactName:"Contact",contactEmail:"contact@example.com",requestId:"03ff77d6-e9b6-46de-97fa-243c8cb74249"};
    vi.mocked(email.sendEmail).mockClear();
    vi.mocked(email.isEmailConfigured).mockReturnValue(true);
    try {
      vi.mocked(db.createQuoteRequest).mockResolvedValueOnce({success:true,quoteId:249,replayed:false});
      await caller.quotes.create(data);
      expect(email.sendEmail).toHaveBeenCalledTimes(1);
      vi.mocked(db.createQuoteRequest).mockResolvedValueOnce({success:true,quoteId:249,replayed:true});
      expect(await caller.quotes.create(data)).toMatchObject({quoteId:249,replayed:true});
      expect(email.sendEmail).toHaveBeenCalledTimes(1);
    } finally { vi.mocked(email.isEmailConfigured).mockReturnValue(false); }
  });

  it("quotes.create accepts a valid quote request", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.quotes.create({
      companyName: "Test MRO", contactName: "Jean Dupont",
      contactEmail: "jean@testmro.com", trainingTypes: "HF initial, FTS", employeeCount: 10,
    });
    expect(result).toEqual({ success: true });
  });
});

describe("admin", () => {
  it("admin.stats returns stats for admin user", async () => {
    const caller = appRouter.createCaller(createUserContext("admin"));
    const result = await caller.admin.stats();
    expect(result.users).toBe(5);
    expect(result.trainings).toBe(8);
  });

  it("admin.stats throws FORBIDDEN for non-admin user", async () => {
    const caller = appRouter.createCaller(createUserContext("user"));
    await expect(caller.admin.stats()).rejects.toThrow();
  });

  it("admin.complianceReport returns an empty terminal page", async () => {
    const caller = appRouter.createCaller(createUserContext("admin"));
    const result = await caller.admin.complianceReport();
    expect(result).toEqual({entries:[],nextCursor:null});
  });

  it("admin.userDetail returns user detail", async () => {
    const caller = appRouter.createCaller(createUserContext("admin"));
    const result = await caller.admin.userDetail({ userId: 1 });
    expect(result?.user?.id).toBe(1);
  });
});
