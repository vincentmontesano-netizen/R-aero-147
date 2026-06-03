import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB ──────────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
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
  getAdminQuoteRequests: vi.fn().mockResolvedValue([]),
  updateQuoteRequestStatus: vi.fn().mockResolvedValue({ success: true }),
  getAdminUserDetail: vi.fn().mockResolvedValue({ user: { id: 1, name: "Test" }, orders: [], enrollments: [], certificates: [] }),
  getAdminComplianceReport: vi.fn().mockResolvedValue([]),
  getTrainingModules: vi.fn().mockResolvedValue([]),
  getModuleProgress: vi.fn().mockResolvedValue([]),
  updateModuleProgress: vi.fn().mockResolvedValue({ progress: 50, status: "in_progress" }),
  getQuizQuestions: vi.fn().mockResolvedValue([]),
  submitQuizAttempt: vi.fn().mockResolvedValue({ score: 8, maxScore: 10, percentage: 80, isPassed: true, passingScore: 75, feedback: [] }),
  getQuizAttempts: vi.fn().mockResolvedValue([]),
  updateUserProfile: vi.fn().mockResolvedValue({ id: 1, name: "Updated User" }),
  getUserById: vi.fn().mockResolvedValue({ id: 1, name: "Test User" }),
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

  it("admin.complianceReport returns empty array", async () => {
    const caller = appRouter.createCaller(createUserContext("admin"));
    const result = await caller.admin.complianceReport();
    expect(Array.isArray(result)).toBe(true);
  });

  it("admin.userDetail returns user detail", async () => {
    const caller = appRouter.createCaller(createUserContext("admin"));
    const result = await caller.admin.userDetail({ userId: 1 });
    expect(result?.user?.id).toBe(1);
  });
});
