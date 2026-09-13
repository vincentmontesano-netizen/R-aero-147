import {addCalendarMonths} from "../shared/calendarMonths";
import { certificateLanguage, certificateLabels, certificateDate, type CertificateLanguage } from "../shared/certificateLanguage";
import { invoiceFontPath, invoiceText } from "./invoiceText";
import {createHash} from "node:crypto";
import {canonicalAppOrigin} from "./authOrigin";
import {TRPCError} from "@trpc/server";
import { readCurriculum } from "./curriculum";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { nanoid } from "nanoid";
import { getDb, createCredentialForIssuedCertificate } from "./db";
import { certificates, certificateArchives, certificateObjectives, learningObjectives, enrollments, trainings, users, quizAttempts } from "../drizzle/schema";
import { eq, and, isNull } from "drizzle-orm";
import { storagePut } from "./storage";
import https from "https";
import http from "http";

// ─── Fetch logo as buffer ─────────────────────────────────────────────────────
async function fetchLogoBuffer(url: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const protocol = url.startsWith("https") ? https : http;
    protocol.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", () => resolve(null));
    }).on("error", () => resolve(null));
  });
}

// ─── Generate certificate number ─────────────────────────────────────────────
function generateCertNumber(): string {
  return `RAERO-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;
}

function generateVerifCode(): string {
  return nanoid(12).toUpperCase();
}

// ─── Build PDF buffer ─────────────────────────────────────────────────────────
export async function buildCertificatePDF(params: {
  language?: CertificateLanguage;
  learnerName: string;
  trainingTitle: string;
  part147Reference: string;
  durationHours: string;
  completedAt: Date;
  expiresAt: Date | null;
  certificateNumber: string;
  verificationCode: string;
  verificationUrl: string;
  qrDataUrl: string;
  logoBuffer: Buffer | null;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0 });
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont('Invoice', invoiceFontPath);
    const language = certificateLanguage(params.language), labels = certificateLabels[language];
    const ltr = (text: string) => language === 'ar' ? `\u2066${text}\u2069` : text;
    const fittedText = (text: string, x: number, y: number, width: number, height: number, maximum: number, minimum: number, color: string, align: 'left' | 'center' | 'right' = 'center') => {
      for (let size = maximum; size >= minimum; size -= 0.5) {
        const block = invoiceText(doc, text, width, size);
        if (block.height <= height) { doc.fillColor(color); block.draw(x, y, align); return; }
      }
      throw new TRPCError({code:'PRECONDITION_FAILED', message:'Un nom ou libellé est trop long pour le certificat. Vérifiez les informations avant émission.'});
    };

    const W = 841.89;
    const H = 595.28;

    // ── Background ivory ──
    doc.rect(0, 0, W, H).fill("#F7F5EF");

    // ── Deep blue border ──
    doc.rect(20, 20, W - 40, H - 40).lineWidth(3).strokeColor("#002554").stroke();
    doc.rect(26, 26, W - 52, H - 52).lineWidth(1).strokeColor("#C9A55A").stroke();

    // ── Gold top bar ──
    doc.rect(20, 20, W - 40, 8).fill("#C9A55A");

    // ── Gold bottom bar ──
    doc.rect(20, H - 28, W - 40, 8).fill("#C9A55A");

    // ── Logo (real emblem if available, fallback to text) ──
    if (params.logoBuffer) {
      try {
        doc.image(params.logoBuffer, W / 2 - 35, 42, { width: 70, height: 70 });
      } catch {
        // Fallback: circle with R
        doc.circle(W / 2, 77, 30).fill("#002554");
        doc.font("Helvetica-Bold").fontSize(26).fillColor("#C9A55A").text("R", W / 2 - 8, 63);
      }
    } else {
      doc.circle(W / 2, 77, 30).fill("#002554");
      doc.font("Helvetica-Bold").fontSize(26).fillColor("#C9A55A").text("R", W / 2 - 8, 63);
    }

    // ── Academy name ──
    fittedText(labels.tracking, 60, 116, W - 120, 20, 11, 9, '#7A622B');

    doc.font("Helvetica-Bold").fontSize(20).fillColor("#002554")
      .text("R-AERO TRAINING ACADEMY", 0, 138, { align: "center" });

    // ── Gold divider ──
    doc.moveTo(200, 168).lineTo(W - 200, 168).lineWidth(1.5).strokeColor("#C9A55A").stroke();

    // ── "Certificat de Formation" ──
    fittedText(labels.title, 60, 178, W - 120, 24, 13, 10, '#5A6470');

    // ── Learner name ──
    fittedText(params.learnerName, 60, 204, W - 120, 48, 26, 10, '#002554');

    // ── "a complété avec succès" ──
    fittedText(labels.completed, 60, 258, W - 120, 22, 11, 9, '#5A6470');

    // ── Training title ──
    fittedText(params.trainingTitle, 60, 282, W - 120, 70, 18, 10, '#002554');

    // ── Part-147 reference ──
    if (params.part147Reference) {
      fittedText(`${labels.reference} : ${ltr(params.part147Reference)}`, 60, 362, W - 120, 24, 9, 7, '#7A622B');
    }

    // ── Gold divider ──
    doc.moveTo(200, 390).lineTo(W - 200, 390).lineWidth(1).strokeColor("#C9A55A").stroke();

    // ── Details row ──
    const detailY = 405;
    const col1 = 120, col2 = 340, col3 = 560;

    fittedText(labels.duration, col1, detailY, 120, 16, 8, 7, '#5A6470');
    fittedText(`${ltr(params.durationHours)} ${labels.hours}`, col1, detailY + 17, 120, 25, 13, 10, '#002554');
    fittedText(labels.completedOn, col2, detailY, 160, 16, 8, 7, '#5A6470');
    fittedText(certificateDate(params.completedAt, language), col2, detailY + 17, 160, 25, 13, 10, '#002554');
    fittedText(labels.validUntil, col3, detailY, 140, 16, 8, 7, '#5A6470');
    fittedText(params.expiresAt ? certificateDate(params.expiresAt, language) : labels.indefinite, col3, detailY + 17, 140, 25, 13, 10, '#002554');

    doc.moveTo(W / 2 - 100, H - 90).lineTo(W / 2 + 100, H - 90).lineWidth(1).strokeColor('#002554').stroke();
    fittedText(labels.recorded, W / 2 - 150, H - 84, 300, 25, 8, 7, '#5A6470');
    fittedText(`${labels.number}${language === 'ar' ? ' :' : ''} ${ltr(params.certificateNumber)}`, 40, H - 61, W - 190, 13, 7, 6, '#5A6470', 'left');
    fittedText(`${labels.verification} : ${ltr(params.verificationUrl)}`, 40, H - 48, W - 190, 13, 7, 6, '#5A6470', 'left');

    // ── QR code ──
    const qrBuffer = Buffer.from(params.qrDataUrl.split(",")[1], "base64");
    doc.image(qrBuffer, W - 115, H - 110, { width: 72, height: 72 });

    doc.end();
  });
}

// ─── Issue certificate ────────────────────────────────────────────────────────
export async function issueCertificate(enrollmentId: number, _appOrigin?: string): Promise<{
  certificateNumber: string;
  verificationCode: string;
  pdfUrl: string;
} | null> {
  const db = await getDb();
  if (!db) return null;

  return db.transaction(async tx=>{
  const db=tx;
  const enrollment = await db.select().from(enrollments).where(eq(enrollments.id, enrollmentId)).limit(1).for("update");
  if (!enrollment[0] || enrollment[0].status !== "completed") return null;

  // A client-reported completion percentage can never authorize certification.
  const passed = await db.select({ id: quizAttempts.id }).from(quizAttempts).where(and(
    eq(quizAttempts.enrollmentId, enrollmentId),
    eq(quizAttempts.userId, enrollment[0].userId),
    eq(quizAttempts.trainingId, enrollment[0].trainingId),
    eq(quizAttempts.isPassed, true),
    isNull(quizAttempts.moduleId),
  )).limit(1);
  if (!passed[0]) return null;

  const existing = await db.select().from(certificates).where(eq(certificates.enrollmentId, enrollmentId)).limit(1);
  if(existing[0]&&(existing[0].userId!==enrollment[0].userId||existing[0].trainingId!==enrollment[0].trainingId))throw new TRPCError({code:'PRECONDITION_FAILED',message:'Le certificat existant ne correspond pas à cette inscription ; un rapprochement administratif est requis.'});
  if (existing[0]) return { certificateNumber: existing[0].certificateNumber, verificationCode: existing[0].verificationCode, pdfUrl: existing[0].pdfUrl ?? "" };

  const user = await db.select().from(users).where(eq(users.id, enrollment[0].userId)).limit(1);
  const curriculum = await readCurriculum(enrollment[0].trainingVersionId,db);
  const training = curriculum ? [curriculum.training] : await db.select().from(trainings).where(eq(trainings.id, enrollment[0].trainingId)).limit(1);
  if (!user[0] || !training[0]) return null;

  if(!enrollment[0].completedAt)throw new TRPCError({code:"PRECONDITION_FAILED",message:"La date de réussite doit être rapprochée avant émission."});
  const certNumber = generateCertNumber();
  const verifCode = generateVerifCode();
  let origin:string;
  try{origin=canonicalAppOrigin();}catch{throw new TRPCError({code:'PRECONDITION_FAILED',message:'L’adresse officielle du site doit être configurée avant émission du certificat.'});}
  const verificationUrl = `${origin}/verification/${verifCode}`;

  const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 200, margin: 1, color: { dark: "#002554", light: "#F7F5EF" } });

  let expiresAt: Date | null = null;
  if (training[0].recurrencyMonths) {
    expiresAt = addCalendarMonths(enrollment[0].completedAt, training[0].recurrencyMonths);
  }

  // Use the drawn vector emblem (self-contained, no external asset fetch).
  const logoBuffer: Buffer | null = null;

  const documentLanguage = certificateLanguage(training[0].language);
  const pdfBuffer = await buildCertificatePDF({
    language: documentLanguage,
    learnerName: user[0].name ?? "Apprenant",
    trainingTitle: training[0].title,
    part147Reference: training[0].part147Reference ?? "",
    durationHours: training[0].durationHours?.toString() ?? "0",
    completedAt: enrollment[0].completedAt ?? new Date(),
    expiresAt,
    certificateNumber: certNumber,
    verificationCode: verifCode,
    verificationUrl,
    qrDataUrl,
    logoBuffer,
  });

  const fileKey = `certificates/${certNumber}.pdf`;
  const { url: pdfUrl, key: storageKey } = await storagePut(fileKey, pdfBuffer, "application/pdf");

  const inserted = await db.insert(certificates).values({
    enrollmentId,
    userId: enrollment[0].userId,
    trainingId: enrollment[0].trainingId,
    certificateNumber: certNumber,
    verificationCode: verifCode,
    pdfUrl,
    issuedAt: new Date(),
    expiresAt,
    isValid: true,
  }).returning({ id: certificates.id });

  // Record which Part-66 objectives this certificate covers (training-level proof).
  const certId = inserted[0]?.id;
  if (certId) {
    const objs = curriculum?.objectives ?? await db.select().from(learningObjectives).where(eq(learningObjectives.trainingId, enrollment[0].trainingId));
    if (objs.length > 0) {
      await db.insert(certificateObjectives).values(objs.map((o) => ({ certificateId: certId, objectiveId: o.id })));
    }
    await db.insert(certificateArchives).values({certificateId:certId,storageKey,sha256:createHash('sha256').update(pdfBuffer).digest('hex'),byteSize:pdfBuffer.length,
      snapshot:{language:documentLanguage,learnerName:user[0].name??'Apprenant',training:{title:training[0].title,part147Reference:training[0].part147Reference??null,durationHours:training[0].durationHours?.toString()??null},completedAt:enrollment[0].completedAt!.toISOString(),trainingVersionId:enrollment[0].trainingVersionId??null,passedAttemptId:passed[0].id,verificationUrl,objectives:objs.map(o=>({id:o.id,title:o.title,code:o.code??null}))}});
    // Back the certificate with a LIVING credential (INV-6: dual-state, person-owned).
    await createCredentialForIssuedCertificate(certId,db);
  }

  return { certificateNumber: certNumber, verificationCode: verifCode, pdfUrl };
  });
}
