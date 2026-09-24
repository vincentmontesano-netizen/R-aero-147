/** Native E2E fixture; refuses every database except the dedicated local mobile DB. */
import { mkdir, writeFile, readFile, copyFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { eq } from "drizzle-orm";
import PDFDocument from "pdfkit";
import { registerUser } from "../server/auth";
import { getDb, updateTraining } from "../server/db";
import { requestPedagogicalReview, decidePedagogicalReview } from "../server/pedagogicalReview";
import { saveCourseMedia } from "../server/courseMedia";
import { users, trainings, trainingModules, learningObjectives, slides, quizQuestions, enrollments } from "../drizzle/schema";

const database = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(database.hostname) || database.pathname !== "/raero_mobile_test") throw new Error("Dedicated local mobile database required");
const output = path.resolve("tmp/mobile");
const storage = path.resolve(output, "storage/courses/mobile-fixture");
await mkdir(storage, { recursive: true });
const manifestPath = path.join(output, "fixture.json");
const db = (await getDb())!;
try {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const [existing] = await db.select().from(trainings).where(eq(trainings.id, manifest.trainingId));
  if (existing?.slug === manifest.slug) { console.log("Existing fixture: " + manifestPath); process.exit(0); }
} catch { /* First fixture run. */ }

await copyFile("client/public/images/raero-logo.png", path.join(storage, "logo.png"));
const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
execFileSync(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100", "-t", "24", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", path.join(storage, "lesson.mp4")]);
execFileSync(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100", "-t", "6", path.join(storage, "audio.mp3")]);
const pdf = new PDFDocument();
const chunks: Buffer[] = [];
const pdfReady = new Promise<Buffer>((resolve, reject) => { pdf.on("data", chunk => chunks.push(chunk)); pdf.on("end", () => resolve(Buffer.concat(chunks))); pdf.on("error", reject); });
pdf.fontSize(22).text("R-AERO - Recette mobile").fontSize(12).moveDown().text("Document de test technique. Ne constitue pas une formation ou un certificat."); pdf.end();
await writeFile(path.join(storage, "lesson.pdf"), await pdfReady);
const assets: Record<string, string> = {};
const asset = (name: string) => assets[name];
const suffix = Date.now();
const password = "Raero-Mobile-Test-2026!";
const accounts: Record<string, { userId: number; email: string; password: string; enrollmentId?: number }> = {};
for (const name of ["ios", "android", "other", "author", "reviewer"]) {
  const email = `mobile-${name}-${suffix}@example.invalid`;
  const user = await registerUser({ email, password, name: `Recette ${name}`, preferredLanguage: "fr" });
  if (["author", "reviewer"].includes(name)) await db.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
  accounts[name] = { userId: user.id, email, password };
}
const [training] = await db.insert(trainings).values({ title: "Recette mobile · Parcours complet", slug: `mobile-fixture-${suffix}`, description: "Formation technique isolée pour la recette des applications.", ownerUserId: accounts.author.userId, durationHours: "0.50", passingScore: 80, maxAttempts: 3, examTimeLimitMin: 10, randomizeQuestions: false, thumbnailUrl: asset("logo.png") }).returning();
for (const [name, contentType] of [["logo.png", "image/png"], ["audio.mp3", "audio/mpeg"], ["lesson.mp4", "video/mp4"], ["lesson.pdf", "application/pdf"]]) {
  const media = await saveCourseMedia({ id: accounts.author.userId, role: "admin" }, training.id, await readFile(path.join(storage, name)), contentType, "uploaded");
  assets[name] = media.url;
}
await db.update(trainings).set({ thumbnailUrl: asset("logo.png") }).where(eq(trainings.id, training.id));
const [chapter] = await db.insert(trainingModules).values({ trainingId: training.id, title: "Comprendre et pratiquer", content: "Repérez les informations, utilisez les médias puis validez votre compréhension.", pdfUrl: asset("lesson.pdf"), isRequired: true, quizPassingScore: 100, quizMaxAttempts: 3, quizTimeLimitMin: 5, sortOrder: 0 }).returning();
const [objective] = await db.insert(learningObjectives).values({ trainingId: training.id, moduleId: chapter.id, title: "Suivre un parcours sur mobile", code: "MOB-01", isRequired: true }).returning();
await db.update(trainingModules).set({ objectiveId: objective.id }).where(eq(trainingModules.id, chapter.id));
const deck = await db.insert(slides).values([
  { trainingId: training.id, moduleId: chapter.id, objectiveId: objective.id, sortOrder: 0, title: "Bienvenue à bord", body: "Cette diapositive vérifie le texte, le logo et la lecture audio. Les médias sont réservés aux apprenants inscrits.", imageUrl: asset("logo.png"), audioUrl: asset("audio.mp3") },
  { trainingId: training.id, moduleId: chapter.id, objectiveId: objective.id, sortOrder: 1, title: "Vidéo interactive", body: "Quatre activités interrompent la vidéo : question, choix de parcours, repérage et association.", videoUrl: asset("lesson.mp4"), videoCues: [
    { atSeconds: 2, kind: "quiz", question: "Quelle action prépare une intervention ?", options: ["Vérifier la documentation", "Improviser"], correct: [0], explanation: "Consultez la documentation." },
    { atSeconds: 5, kind: "branch", question: "Choisir la suite", branches: [{ label: "Poursuivre la démonstration", seekTo: 8 }] },
    { atSeconds: 10, kind: "hotspot", question: "Repérer la zone de contrôle", hotspots: [{ xPct: 50, yPct: 50, label: "Zone de contrôle", correct: true }] },
    { atSeconds: 15, kind: "dragdrop", question: "Associer la procédure", dragItems: [{ id: "check", label: "Vérification" }], dropZones: [{ id: "before", label: "Avant intervention", xPct: 20, yPct: 20, wPct: 60, hPct: 60, correctItemId: "check" }] },
  ] },
  { trainingId: training.id, moduleId: chapter.id, objectiveId: objective.id, sortOrder: 2, title: "Vérifiez votre compréhension", body: "Une activité pédagogique avant le contrôle de chapitre.", quizQuestion: "La documentation doit être à jour.", quizOptions: ["Vrai", "Faux"], quizCorrect: [0], quizExplanation: "Vérifiez toujours la version documentaire applicable." },
]).returning();
const questions = await db.insert(quizQuestions).values([
  { trainingId: training.id, moduleId: chapter.id, objectiveId: objective.id, question: "Avant une intervention, que faut-il vérifier ?", type: "qcu", options: ["La documentation", "La météo uniquement"], correctAnswer: [0], explanation: "La documentation applicable doit être vérifiée.", sortOrder: 0 },
  { trainingId: training.id, objectiveId: objective.id, question: "Quel document utiliser ?", type: "qcu", options: ["La version à jour", "Une copie obsolète"], correctAnswer: [0], sortOrder: 0 },
  { trainingId: training.id, objectiveId: objective.id, question: "Sélectionnez les deux bonnes pratiques.", type: "qcm", options: ["Vérifier", "Tracer", "Improviser"], correctAnswer: [0, 1], sortOrder: 1 },
  { trainingId: training.id, objectiveId: objective.id, question: "La traçabilité est nécessaire.", type: "true_false", options: ["Vrai", "Faux"], correctAnswer: [0], sortOrder: 2 },
  { trainingId: training.id, objectiveId: objective.id, question: "Quel mot désigne le suivi des actions ?", type: "free_text", answerKey: { keywords: ["traçabilité"] }, sortOrder: 3 },
  { trainingId: training.id, objectiveId: objective.id, question: "Associez chaque action à son moment.", type: "matching", options: ["Préparer", "Tracer"], optionsRight: ["Avant", "Après"], answerKey: { pairs: [[0, 0], [1, 1]] }, sortOrder: 4 },
]).returning();
const author = { id: accounts.author.userId, role: "admin" };
const review = await requestPedagogicalReview(author, training.id);
await decidePedagogicalReview({ id: accounts.reviewer.userId, role: "admin" }, review.id, "approved", "Recette technique isolée, contenu fictif identifié.");
await updateTraining(training.id, { isPublished: true }, author.id);
const [published] = await db.select().from(trainings).where(eq(trainings.id, training.id));
for (const platform of ["ios", "android"]) {
  const [enrollment] = await db.insert(enrollments).values({ userId: accounts[platform].userId, trainingId: training.id, trainingVersionId: published.publishedVersionId }).returning();
  accounts[platform].enrollmentId = enrollment.id;
}
await writeFile(manifestPath, JSON.stringify({ trainingId: training.id, slug: training.slug, versionId: published.publishedVersionId, moduleId: chapter.id, slideIds: deck.map(s => s.id), questionIds: questions.map(q => q.id), accounts }, null, 2), { mode: 0o600 });
console.log("Created isolated, reviewed and published fixture: " + manifestPath);
process.exit(0);
