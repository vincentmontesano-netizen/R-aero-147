import PDFDocument from "pdfkit";
import { getDb } from "./db";
import { orders, orderItems, trainings, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { storagePut } from "./storage";
import https from "https";
import http from "http";

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

export async function generateInvoicePDF(orderId: number, appOrigin: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  const order = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order[0]) return null;

  const user = await db.select().from(users).where(eq(users.id, order[0].userId)).limit(1);
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));

  const itemsWithTrainings = await Promise.all(
    items.map(async (item) => {
      const training = await db.select().from(trainings).where(eq(trainings.id, item.trainingId)).limit(1);
      return { ...item, training: training[0] ?? null };
    })
  );

  // Use the drawn vector emblem (self-contained, no external asset fetch).
  const logoBuffer: Buffer | null = null;

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = 595.28;

    // ── Header ──
    doc.rect(0, 0, W, 90).fill("#002554");

    // Logo
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, 45, 15, { width: 60, height: 60 });
      } catch {
        doc.circle(55, 45, 22).fill("#C9A55A");
        doc.font("Helvetica-Bold").fontSize(20).fillColor("#002554").text("R", 46, 33);
      }
    } else {
      doc.circle(55, 45, 22).fill("#C9A55A");
      doc.font("Helvetica-Bold").fontSize(20).fillColor("#002554").text("R", 46, 33);
    }

    doc.font("Helvetica-Bold").fontSize(16).fillColor("#C9A55A").text("R-AERO", 118, 18);
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#FFFFFF").text("TRAINING ACADEMY", 118, 38);
    doc.font("Helvetica").fontSize(8).fillColor("#C9A55A").text("Organisme de formation agréé EASA Part-147", 118, 54);
    doc.font("Helvetica").fontSize(7).fillColor("#FFFFFF").text("contact@r-aero-academy.com  |  +33 (0)1 XX XX XX XX", 118, 68);

    // ── Invoice title ──
    doc.font("Helvetica-Bold").fontSize(22).fillColor("#002554").text("FACTURE", 50, 110);
    doc.font("Helvetica").fontSize(10).fillColor("#5A6470")
      .text(`N° ${order[0].invoiceNumber ?? `RAERO-${orderId}`}`, 50, 138)
      .text(`Date : ${new Date(order[0].createdAt).toLocaleDateString("fr-FR")}`, 50, 152);

    // ── Client info ──
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#002554").text("FACTURÉ À", 350, 110);
    doc.font("Helvetica").fontSize(10).fillColor("#333333")
      .text(user[0]?.name ?? "Client", 350, 126)
      .text(user[0]?.email ?? "", 350, 140);

    // ── Gold divider ──
    doc.moveTo(50, 178).lineTo(W - 50, 178).lineWidth(2).strokeColor("#C9A55A").stroke();

    // ── Table header ──
    const tableY = 192;
    doc.rect(50, tableY, W - 100, 24).fill("#002554");
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#FFFFFF")
      .text("Formation", 60, tableY + 7)
      .text("Qté", 370, tableY + 7)
      .text("Prix HT", 410, tableY + 7)
      .text("Prix TTC", 470, tableY + 7);

    // ── Table rows ──
    let rowY = tableY + 30;
    for (const item of itemsWithTrainings) {
      if (rowY > 640) break;
      const bg = itemsWithTrainings.indexOf(item) % 2 === 0 ? "#F7F5EF" : "#FFFFFF";
      doc.rect(50, rowY - 4, W - 100, 22).fill(bg);
      doc.font("Helvetica").fontSize(9).fillColor("#333333")
        .text(item.training?.title ?? "Formation", 60, rowY, { width: 290 })
        .text(String(item.quantity ?? 1), 375, rowY)
        .text(`${Number(item.unitPriceHt).toFixed(2)} €`, 405, rowY)
        .text(`${Number(item.unitPriceTtc).toFixed(2)} €`, 465, rowY);
      rowY += 26;
    }

    // ── Totals ──
    const totY = rowY + 20;
    doc.moveTo(350, totY).lineTo(W - 50, totY).lineWidth(1).strokeColor("#C9A55A").stroke();
    doc.font("Helvetica").fontSize(10).fillColor("#5A6470")
      .text("Total HT :", 350, totY + 10)
      .text(`${Number(order[0].totalHt).toFixed(2)} €`, 460, totY + 10)
      .text(`TVA (${Number(order[0].vatRate ?? 20).toFixed(0)}%) :`, 350, totY + 26)
      .text(`${Number(order[0].vatAmount ?? 0).toFixed(2)} €`, 460, totY + 26);
    doc.rect(350, totY + 44, W - 400, 26).fill("#002554");
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#FFFFFF")
      .text("TOTAL TTC :", 360, totY + 50)
      .text(`${Number(order[0].totalTtc).toFixed(2)} €`, 455, totY + 50);

    // ── Footer ──
    doc.moveTo(50, 760).lineTo(W - 50, 760).lineWidth(1).strokeColor("#C9A55A").stroke();
    doc.font("Helvetica").fontSize(7).fillColor("#5A6470")
      .text("R-AERO Training Academy — Organisme de formation agréé EASA Part-147 — SIRET : XXX XXX XXX XXXXX — TVA : FR XX XXX XXX XXX", 50, 768, { align: "center", width: W - 100 })
      .text(`Facture générée le ${new Date().toLocaleDateString("fr-FR")} — ${appOrigin}`, 50, 778, { align: "center", width: W - 100 });

    doc.end();
  });

  const fileKey = `invoices/facture-${order[0].invoiceNumber ?? orderId}.pdf`;
  const { url } = await storagePut(fileKey, buffer, "application/pdf");

  const { eq: eqDrizzle } = await import("drizzle-orm");
  await db.update(orders).set({ invoiceUrl: url }).where(eqDrizzle(orders.id, orderId));

  return url;
}
