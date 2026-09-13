import { describe, expect, it, vi } from "vitest";

// Mock the DB module so getDb() yields a fake whose queries resolve to [] — lets us
// exercise assertActiveAffiliation's FORBIDDEN path without a database. The pure
// projection (projectOrgScopedView) needs no DB and is unaffected; computeRecurrencyStatus
// and ruleMatchesEmployee stay real via importOriginal.
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
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
      { id:1,trainingId: 1, isValid: true, certificateNumber: "RAERO-REQUIRED", expiresAt: null, issuedAt: new Date() },
      { id:2,trainingId: 99, isValid: true, certificateNumber: "RAERO-ELECTIVE", expiresAt: null, issuedAt: new Date() }, // not required → excluded
      { id:3,trainingId: 1, isValid: false, certificateNumber: "RAERO-REVOKED", expiresAt: null, issuedAt: new Date() }, // invalid → excluded
    ],
    credentials: [
      { certificateId:null,state:'LIVING',expiresAt:null,trainingId: 1, origin: "ORG_ASSIGNED", surfacedByPersonAt: null, part66Coverage: [10, 11] }, // visible
      { certificateId:null,state:'LIVING',expiresAt:null,trainingId: 1, origin: "INDEPENDENT", surfacedByPersonAt: null, part66Coverage: [50] }, // unsurfaced independent → hidden
      { certificateId:null,state:'LIVING',expiresAt:null,trainingId: 1, origin: "INDEPENDENT", surfacedByPersonAt: new Date(), part66Coverage: [12] }, // surfaced → visible
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

it('excludes expired, unknown, mismatched and frozen evidence from current coverage',()=>{
 const certificates=[
  {id:1,trainingId:1,isValid:true,certificateNumber:'valid',expiresAt:null,issuedAt:new Date()},
  {id:2,trainingId:1,isValid:true,certificateNumber:'expired',expiresAt:new Date(0),issuedAt:new Date()},
  {id:3,trainingId:1,isValid:null,certificateNumber:'unknown',expiresAt:null,issuedAt:new Date()},
  {id:4,trainingId:2,isValid:true,certificateNumber:'other-course',expiresAt:null,issuedAt:new Date()},
 ];
 const base={trainingId:1,origin:'ORG_ASSIGNED',surfacedByPersonAt:null,state:'LIVING',expiresAt:null,certificateId:null};
 const view=projectOrgScopedView({subjectPersonId:7,orgId:3,matchedRules:[{trainingId:1,periodMonths:12,trainingTitle:'Required'}],recurrencies:[],certificates,credentials:[
  {...base,certificateId:1,part66Coverage:[10]},
  {...base,certificateId:2,part66Coverage:[20]},
  {...base,certificateId:3,part66Coverage:[30]},
  {...base,certificateId:4,part66Coverage:[40]},
  {...base,certificateId:999,part66Coverage:[50]},
  {...base,state:'FROZEN',part66Coverage:[60]},
  {...base,expiresAt:new Date(0),part66Coverage:[70]},
  {...base,trainingId:null,part66Coverage:[80]},
 ]});
 expect(view.part66Coverage).toEqual([10]);expect(view.requiredModules[0].certificateNumber).toBe('valid');
 const expiredOnly=projectOrgScopedView({subjectPersonId:7,orgId:3,matchedRules:[{trainingId:1,periodMonths:12,trainingTitle:'Required'}],recurrencies:[],certificates:[certificates[1]],credentials:[]});
 expect(expiredOnly.requiredModules[0].hasValidCertificate).toBe(false);
});

describe("access · affiliation guard (INV-2)", () => {
  it("assertActiveAffiliation throws FORBIDDEN without an active affiliation", async () => {
    await expect(assertActiveAffiliation(1, 2)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
