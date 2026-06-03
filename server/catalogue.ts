import PDFDocument from "pdfkit";
import { getAllPublishedTrainings, getTrainingCategories } from "./db";
import { storagePut } from "./storage";

const TYPE_LABEL: Record<string, string> = {
  elearning: "E-learning", webinar: "Webinar", qt: "Type Rating", seminar: "Séminaire", event: "Événement",
};

/** Generate a branded catalogue PDF of all published trainings. */
export async function generateCataloguePDF(): Promise<string | null> {
  const [trainings, categories] = await Promise.all([getAllPublishedTrainings(), getTrainingCategories()]);
  const catName = new Map<number, string>(categories.map((c: any) => [c.id, c.name]));

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = 595.28;

    // Cover header
    doc.rect(0, 0, W, 130).fill("#002554");
    doc.circle(70, 65, 26).fill("#C9A55A");
    doc.font("Helvetica-Bold").fontSize(22).fillColor("#002554").text("R", 60, 50);
    doc.font("Helvetica-Bold").fontSize(20).fillColor("#C9A55A").text("R-AERO TRAINING ACADEMY", 110, 45);
    doc.font("Helvetica").fontSize(10).fillColor("#FFFFFF").text("Organisme de formation agréé EASA Part-147", 110, 72);
    doc.font("Helvetica").fontSize(9).fillColor("#C9A55A").text(`Catalogue des formations — ${new Date().getFullYear()}`, 110, 90);

    let y = 160;
    const byCat = new Map<string, any[]>();
    for (const t of trainings) {
      const key = t.categoryId ? (catName.get(t.categoryId) ?? "Autres") : "Autres";
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key)!.push(t);
    }

    for (const [cat, items] of Array.from(byCat.entries())) {
      if (y > 740) { doc.addPage(); y = 60; }
      doc.font("Helvetica-Bold").fontSize(13).fillColor("#002554").text(cat, 50, y);
      doc.moveTo(50, y + 18).lineTo(W - 50, y + 18).lineWidth(1.5).strokeColor("#C9A55A").stroke();
      y += 28;

      for (const t of items) {
        if (y > 760) { doc.addPage(); y = 60; }
        doc.font("Helvetica-Bold").fontSize(11).fillColor("#1a1a1a").text(t.title, 50, y, { width: W - 200 });
        const meta = [TYPE_LABEL[t.type] ?? t.type, t.durationHours ? `${t.durationHours}h` : null, (t.language ?? "fr").toUpperCase(), t.part147Reference]
          .filter(Boolean).join(" · ");
        const price = t.priceTtc ? `${Number(t.priceTtc).toFixed(0)} € TTC` : "Sur devis";
        doc.font("Helvetica-Bold").fontSize(10).fillColor("#002554").text(price, W - 150, y, { width: 100, align: "right" });
        y += 15;
        doc.font("Helvetica").fontSize(8).fillColor("#5A6470").text(meta, 50, y);
        y += 12;
        if (t.description) {
          doc.font("Helvetica").fontSize(8.5).fillColor("#444").text(String(t.description).slice(0, 220), 50, y, { width: W - 100 });
          y += doc.heightOfString(String(t.description).slice(0, 220), { width: W - 100 }) + 8;
        }
        doc.moveTo(50, y).lineTo(W - 50, y).lineWidth(0.5).strokeColor("#E5E0D5").stroke();
        y += 10;
      }
      y += 8;
    }

    // Footer note
    if (y > 730) { doc.addPage(); y = 60; }
    doc.font("Helvetica-Oblique").fontSize(8).fillColor("#5A6470")
      .text("Formations éligibles à un financement (CPF / OPCO selon dispositifs). Contactez-nous pour un devis entreprise.", 50, y + 10, { width: W - 100 });

    doc.end();
  });

  const { url } = await storagePut(`catalogue/catalogue-r-aero-${new Date().getFullYear()}.pdf`, buffer, "application/pdf");
  return url;
}
