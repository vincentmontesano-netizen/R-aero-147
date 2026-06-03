import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { nanoid } from "nanoid";
import { getDb, createCredentialForIssuedCertificate } from "./db";
import { certificates, certificateObjectives, learningObjectives, enrollments, trainings, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
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
async function buildCertificatePDF(params: {
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
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#C9A55A")
      .text("ORGANISME DE FORMATION AGRÉÉ EASA PART-147", 0, 120, { align: "center" });

    doc.font("Helvetica-Bold").fontSize(20).fillColor("#002554")
      .text("R-AERO TRAINING ACADEMY", 0, 138, { align: "center" });

    // ── Gold divider ──
    doc.moveTo(200, 168).lineTo(W - 200, 168).lineWidth(1.5).strokeColor("#C9A55A").stroke();

    // ── "Certificat de Formation" ──
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#5A6470")
      .text("CERTIFICAT DE FORMATION", 0, 180, { align: "center" });

    // ── Learner name ──
    doc.font("Helvetica-Bold").fontSize(28).fillColor("#002554")
      .text(params.learnerName, 0, 202, { align: "center" });

    // ── "a complété avec succès" ──
    doc.font("Helvetica").fontSize(11).fillColor("#5A6470")
      .text("a complété avec succès la formation", 0, 242, { align: "center" });

    // ── Training title ──
    doc.font("Helvetica-Bold").fontSize(16).fillColor("#002554")
      .text(params.trainingTitle, 60, 262, { align: "center", width: W - 120 });

    // ── Part-147 reference ──
    if (params.part147Reference) {
      doc.font("Helvetica").fontSize(9).fillColor("#C9A55A")
        .text(`Référence réglementaire : ${params.part147Reference}`, 0, 295, { align: "center" });
    }

    // ── Gold divider ──
    doc.moveTo(200, 315).lineTo(W - 200, 315).lineWidth(1).strokeColor("#C9A55A").stroke();

    // ── Details row ──
    const detailY = 328;
    const col1 = 120, col2 = 340, col3 = 560;

    doc.font("Helvetica-Bold").fontSize(8).fillColor("#5A6470").text("DURÉE", col1, detailY, { align: "center", width: 120 });
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#002554").text(`${params.durationHours}h`, col1, detailY + 12, { align: "center", width: 120 });

    doc.font("Helvetica-Bold").fontSize(8).fillColor("#5A6470").text("DATE DE COMPLÉTION", col2, detailY, { align: "center", width: 160 });
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#002554").text(params.completedAt.toLocaleDateString("fr-FR"), col2, detailY + 12, { align: "center", width: 160 });

    doc.font("Helvetica-Bold").fontSize(8).fillColor("#5A6470").text("VALABLE JUSQU'AU", col3, detailY, { align: "center", width: 140 });
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#002554").text(
      params.expiresAt ? params.expiresAt.toLocaleDateString("fr-FR") : "Indéterminé",
      col3, detailY + 12, { align: "center", width: 140 }
    );

    // ── Signature line ──
    doc.moveTo(W / 2 - 80, H - 90).lineTo(W / 2 + 80, H - 90).lineWidth(1).strokeColor("#002554").stroke();
    doc.font("Helvetica").fontSize(8).fillColor("#5A6470").text("Directeur de la formation — R-AERO Training Academy", W / 2 - 100, H - 82, { align: "center", width: 200 });

    // ── Certificate number ──
    doc.font("Helvetica").fontSize(7).fillColor("#5A6470")
      .text(`N° ${params.certificateNumber}`, 40, H - 60, { align: "left" });

    // ── Verification URL ──
    doc.font("Helvetica").fontSize(7).fillColor("#5A6470")
      .text(`Vérification : ${params.verificationUrl}`, 40, H - 50, { align: "left" });

    // ── QR code ──
    const qrBuffer = Buffer.from(params.qrDataUrl.split(",")[1], "base64");
    doc.image(qrBuffer, W - 115, H - 110, { width: 72, height: 72 });

    doc.end();
  });
}

// ─── Issue certificate ────────────────────────────────────────────────────────
export async function issueCertificate(enrollmentId: number, appOrigin: string): Promise<{
  certificateNumber: string;
  verificationCode: string;
  pdfUrl: string;
} | null> {
  const db = await getDb();
  if (!db) return null;

  const enrollment = await db.select().from(enrollments).where(eq(enrollments.id, enrollmentId)).limit(1);
  if (!enrollment[0] || enrollment[0].status !== "completed") return null;

  const existing = await db.select().from(certificates).where(eq(certificates.enrollmentId, enrollmentId)).limit(1);
  if (existing[0]) return { certificateNumber: existing[0].certificateNumber, verificationCode: existing[0].verificationCode, pdfUrl: existing[0].pdfUrl ?? "" };

  const user = await db.select().from(users).where(eq(users.id, enrollment[0].userId)).limit(1);
  const training = await db.select().from(trainings).where(eq(trainings.id, enrollment[0].trainingId)).limit(1);
  if (!user[0] || !training[0]) return null;

  const certNumber = generateCertNumber();
  const verifCode = generateVerifCode();
  const verificationUrl = `${appOrigin}/verification/${verifCode}`;

  const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 200, margin: 1, color: { dark: "#002554", light: "#F7F5EF" } });

  let expiresAt: Date | null = null;
  if (training[0].recurrencyMonths) {
    expiresAt = new Date(enrollment[0].completedAt ?? new Date());
    expiresAt.setMonth(expiresAt.getMonth() + training[0].recurrencyMonths);
  }

  // Use the drawn vector emblem (self-contained, no external asset fetch).
  const logoBuffer: Buffer | null = null;

  const pdfBuffer = await buildCertificatePDF({
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
  const { url: pdfUrl } = await storagePut(fileKey, pdfBuffer, "application/pdf");

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
    const objs = await db.select().from(learningObjectives).where(eq(learningObjectives.trainingId, enrollment[0].trainingId));
    if (objs.length > 0) {
      await db.insert(certificateObjectives).values(objs.map((o) => ({ certificateId: certId, objectiveId: o.id })));
    }
    // Back the certificate with a LIVING credential (INV-6: dual-state, person-owned).
    await createCredentialForIssuedCertificate(certId);
  }

  return { certificateNumber: certNumber, verificationCode: verifCode, pdfUrl };
}
