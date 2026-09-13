import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getDb,erasePerson,surfaceCredentialForPerson } from "./db";
import { exportPersonData } from "./access";
import { companies,affiliations,certificates,certificateArchives,certificateRevocations,invoiceArchives,orders,signoffs,users, passportDocuments, verificationCases, supportTickets, messages, trainings, enrollments, examSessions } from "../drizzle/schema";
const url = process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)("personal export · PostgreSQL", () => {
  beforeAll(() => { process.env.DATABASE_URL = url!; });
  it("exports own vault, identity, support and exam answers without authentication secrets, keys or foreign records", async () => {
    const db = (await getDb())!;
    const [owner, other] = await db.insert(users).values([{ openId: randomUUID(), passwordHash: "SECRET_HASH", resetToken: "SECRET_RESET", twoFactorCode: "SECRET_OTP" }, { openId: randomUUID() }]).returning();
    await db.insert(passportDocuments).values([{ personId: owner.id, kind: "ID", title: "Archived own document", archivedAt: new Date(), fileUrl: "/storage/passport/own.pdf" }, { personId: other.id, kind: "ID", title: "FOREIGN_DOCUMENT", fileUrl: "/storage/passport/foreign.pdf" }]);
    await db.insert(verificationCases).values([{ personId: owner.id, subjectKey: randomUUID(), kind: "KYC", legalName: "Own identity", country: "FR", address: "Own address" }, { personId: owner.id, subjectKey: randomUUID(), kind: "KYB", legalName: "COMPANY_CASE", country: "FR", address: "Corporate address" }]);
    const [ticket, foreignTicket] = await db.insert(supportTickets).values([{ userId: owner.id, subject: "Own support" }, { userId: other.id, subject: "FOREIGN_SUPPORT" }]).returning();
    await db.insert(messages).values([{ ticketId: ticket.id, fromUserId: other.id, content: "Reply to you" }, { ticketId: foreignTicket.id, fromUserId: other.id, content: "FOREIGN_REPLY" }]);
    const [course] = await db.insert(trainings).values({ title: "Export fixture", slug: randomUUID() }).returning();
    const [enrollment] = await db.insert(enrollments).values({ userId: owner.id, trainingId: course.id }).returning();
    await db.insert(examSessions).values({ userId: owner.id, trainingId: course.id, enrollmentId: enrollment.id, savedAnswers: { "1": [0] }, questionSnapshot: [{ question: "SECRET_ANSWER_KEY", correctAnswer: [1] } as any] });
    const data = await exportPersonData(owner.id);
    expect(data).toMatchObject({ formatVersion: 3, filesIncluded: false });
    expect(data!.passport.documents).toHaveLength(1);
    expect(data!.passport.documents[0].archivedAt).toBeInstanceOf(Date);
    expect(data!.identityVerification.cases).toHaveLength(1);
    expect(data!.learning.exams[0].savedAnswers).toEqual({ "1": [0] });
    expect(data!.support.messages[0]).toMatchObject({ content: "Reply to you", writtenByYou: false });
    const serialized = JSON.stringify(data);
    for (const forbidden of ["SECRET_HASH", "SECRET_RESET", "SECRET_OTP", "SECRET_ANSWER_KEY", "FOREIGN_DOCUMENT", "FOREIGN_SUPPORT", "FOREIGN_REPLY", "COMPANY_CASE", "questionSnapshot"]) expect(serialized).not.toContain(forbidden);
  });
  it('exports retained signatures, sharing, certificate and invoice archives only for their subject',async()=>{
    const db=(await getDb())!;
    const [owner,other,admin]=await db.insert(users).values([{openId:randomUUID()},{openId:randomUUID()},{openId:randomUUID(),role:'admin'}]).returning();
    const [org]=await db.insert(companies).values({name:'Export history'}).returning();
    const [course]=await db.insert(trainings).values({title:'Export evidence',slug:randomUUID()}).returning();
    for(const [person,marker] of [[owner,'OWN_HISTORY'],[other,'FOREIGN_HISTORY']] as const){
      await db.insert(affiliations).values({personId:person.id,orgId:org.id});
      await surfaceCredentialForPerson(person.id,{orgId:org.id,label:marker});
      const [enrollment]=await db.insert(enrollments).values({userId:person.id,trainingId:course.id}).returning();
      const [cert]=await db.insert(certificates).values({userId:person.id,trainingId:course.id,enrollmentId:enrollment.id,certificateNumber:randomUUID(),verificationCode:randomUUID().replaceAll('-',''),isValid:false}).returning();
      await db.insert(certificateArchives).values({certificateId:cert.id,storageKey:`certificates/${randomUUID()}.pdf`,sha256:'0'.repeat(64),byteSize:1,snapshot:{learnerName:marker,training:{title:marker,part147Reference:null,durationHours:null},completedAt:new Date().toISOString(),trainingVersionId:null,passedAttemptId:1,verificationUrl:'https://example.test/verification/test',objectives:[]}});
      await db.insert(certificateRevocations).values({certificateId:cert.id,actorId:admin.id,reason:marker+' revocation reason'});
      const [order]=await db.insert(orders).values({userId:person.id,totalHt:'10',totalTtc:'10',status:'paid'}).returning();
      await db.insert(invoiceArchives).values({orderId:order.id,userId:person.id,number:randomUUID().replaceAll('-',''),snapshot:{buyer:{name:marker}},storageKey:`invoices/${randomUUID()}.pdf`,sha256:'1'.repeat(64),byteSize:1});
      await db.insert(signoffs).values({subjectPersonId:person.id,managerPersonId:admin.id,orgId:org.id,note:marker,requestId:randomUUID(),requestFingerprint:'INTERNAL_REQUEST_FINGERPRINT'});
    }
    await erasePerson(owner.id,admin.id);
    const data=(await exportPersonData(owner.id))!;
    expect(data.formatVersion).toBe(3);
    expect(data.accountClosure).toMatchObject({personId:owner.id,actorId:admin.id,retainedCredentials:1});
    expect(data.evidenceHistory.decisions).toHaveLength(1);expect(data.evidenceHistory.decisions[0].note).toBe('OWN_HISTORY');
    expect(data.evidenceHistory.sharing).toHaveLength(1);expect(data.evidenceHistory.sharing[0].proofLabel).toBe('OWN_HISTORY');
    expect(data.evidenceHistory.certificateArchives).toHaveLength(1);expect(data.evidenceHistory.certificateArchives[0].snapshot.learnerName).toBe('OWN_HISTORY');
    expect(data.evidenceHistory.revocations).toHaveLength(1);expect(data.evidenceHistory.revocations[0].reason).toBe('OWN_HISTORY revocation reason');
    expect(data.billingDocuments.invoiceArchives).toHaveLength(1);expect(data.billingDocuments.invoiceArchives[0].snapshot).toEqual({buyer:{name:'OWN_HISTORY'}});
    const serialized=JSON.stringify(data);
    for(const forbidden of ['FOREIGN_HISTORY','INTERNAL_REQUEST_FINGERPRINT','storageKey'])expect(serialized).not.toContain(forbidden);
  });

});
