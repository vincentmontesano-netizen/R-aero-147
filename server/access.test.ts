import { describe, expect, it, vi } from "vitest";

// Mock the DB module so getDb() yields a fake whose queries resolve to [] — lets us
// exercise assertActiveAffiliation's FORBIDDEN path without a database. The pure
// projection (projectOrgScopedView) needs no DB and is unaffected; computeRecurrencyStatus
// and ruleMatchesEmployee stay real via importOriginal.
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  const chain: any = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve([]),
    then: (resolve: any, reject: any) => Promise.resolve([]).then(resolve, reject),
  };
  return {
    ...actual,
    getDb: async () => ({ select: () => chain, insert: () => ({ values: async () => undefined }) }),
  };
});

import { projectOrgScopedView, assertActiveAffiliation } from "./access";

function deepKeys(obj: any, acc: Set<string> = new Set()): Set<string> {
  if (obj && typeof obj === "object" && !(obj instanceof Date)) {
    for (const k of Object.keys(obj)) {
      acc.add(k);
      deepKeys(obj[k], acc);
    }
  }
  return acc;
}

const inOneYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

function buildView() {
  return projectOrgScopedView({
    subjectPersonId: 7,
    orgId: 3,
    matchedRules: [{ trainingId: 1, periodMonths: 24, trainingTitle: "Human Factors" }],
    recurrencies: [{ trainingId: 1, nextDueAt: inOneYear, lastCompletedAt: new Date() }],
    certificates: [
      { trainingId: 1, isValid: true, certificateNumber: "RAERO-REQUIRED", expiresAt: null, issuedAt: new Date() },
      { trainingId: 99, isValid: true, certificateNumber: "RAERO-ELECTIVE", expiresAt: null, issuedAt: new Date() }, // not required → excluded
      { trainingId: 1, isValid: false, certificateNumber: "RAERO-REVOKED", expiresAt: null, issuedAt: new Date() }, // invalid → excluded
    ],
    credentials: [
      { trainingId: 1, origin: "ORG_ASSIGNED", surfacedByPersonAt: null, part66Coverage: [10, 11] }, // visible
      { trainingId: 1, origin: "INDEPENDENT", surfacedByPersonAt: null, part66Coverage: [50] }, // unsurfaced independent → hidden
      { trainingId: 1, origin: "INDEPENDENT", surfacedByPersonAt: new Date(), part66Coverage: [12] }, // surfaced → visible
    ],
  });
}

describe("access · org-scoped view (INV-3 minimisation)", () => {
  it("never carries identity / personal fields", () => {
    const keys = deepKeys(buildView());
    for (const forbidden of ["email", "proEmail", "passwordHash", "licenseNumber", "jobTitle", "answers", "quizAttempts", "enrollments"]) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });

  it("restricts certificates to required trainings and drops revoked ones", () => {
    const view = buildView();
    expect(view.requiredModules).toHaveLength(1);
    const m = view.requiredModules[0]!;
    expect(m.trainingId).toBe(1);
    expect(m.hasValidCertificate).toBe(true);
    expect(m.certificateNumber).toBe("RAERO-REQUIRED"); // not the revoked, not the elective
    expect(m.recurrencyStatus).toBe("ok"); // due in ~1 year
  });

  it("excludes unsurfaced INDEPENDENT credentials from Part-66 coverage (INV-3/INV-5)", () => {
    const cov = buildView().part66Coverage.sort((a, b) => a - b);
    expect(cov).toContain(10);
    expect(cov).toContain(11);
    expect(cov).toContain(12); // surfaced independent → visible
    expect(cov).not.toContain(50); // unsurfaced independent → hidden
  });
});

describe("access · affiliation guard (INV-2)", () => {
  it("assertActiveAffiliation throws FORBIDDEN without an active affiliation", async () => {
    await expect(assertActiveAffiliation(1, 2)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
