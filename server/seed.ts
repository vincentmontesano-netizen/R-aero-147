/**
 * Seed script — populates the database with demo data for the Part-147 MVP.
 * Idempotent: re-running it will not duplicate the catalogue (it checks first)
 * but always ensures the demo accounts exist.
 *
 * Run with: pnpm db:seed
 */
import "dotenv/config";
import { eq, and } from "drizzle-orm";
import { getDb, backfillAffiliations, backfillCredentials } from "./db";
import { issueCertificate } from "./certificate";
import { hashPassword } from "./auth";
import {
  users, companies, employees, trainingCategories, trainings,
  trainingModules, quizQuestions, webinars, webinarRegistrations, recurrencies, slides, enrollments,
  sessions, articles, learningObjectives, roleRequirements, courseTemplates,
} from "../drizzle/schema";
import { nanoid } from "nanoid";

async function ensureUser(opts: {
  email: string; password: string; name: string; role: "user" | "admin" | "company_manager" | "instructor";
  jobTitle?: string; licenseNumber?: string; licenseCategories?: string; companyId?: number;
}) {
  const db = (await getDb())!;
  const existing = await db.select().from(users).where(eq(users.email, opts.email)).limit(1);
  if (existing[0]) return existing[0];
  const passwordHash = await hashPassword(opts.password);
  const inserted = await db.insert(users).values({
    openId: `local-${nanoid(21)}`,
    email: opts.email,
    name: opts.name,
    passwordHash,
    loginMethod: "email",
    role: opts.role,
    status: "active",
    jobTitle: opts.jobTitle,
    licenseNumber: opts.licenseNumber,
    licenseCategories: opts.licenseCategories,
    companyId: opts.companyId,
    preferredLanguage: "fr",
    lastSignedIn: new Date(),
  }).returning();
  return inserted[0];
}

// Idempotent — runs on BOTH the fresh and already-seeded paths. Links the demo
// technician "Marc" to a PERSONAL login (INV-1: login ≠ pro email), then rebuilds the
// affiliation edges from the legacy single-link model. Safe to re-run.
async function ensureMemberAndAffiliations() {
  const db = (await getDb())!;
  if (!db) return;
  let marcEmp = (await db.select().from(employees).where(eq(employees.email, "marc.lefebvre@demo.example")).limit(1))[0];
  if (marcEmp && marcEmp.userId == null) {
    const memberUser = await ensureUser({
      email: "marc.perso@example.com", password: process.env.NODE_ENV === "production" ? nanoid(24) : "Member1234!", name: "Marc Lefebvre",
      role: "user", jobTitle: "Technicien B1", licenseNumber: "FR.66.222111", licenseCategories: "B1.1",
    });
    if (memberUser) {
      await db.update(employees).set({ userId: memberUser.id }).where(eq(employees.id, marcEmp.id));
      marcEmp = { ...marcEmp, userId: memberUser.id };
    }
  }

  // Give the member a completed HF recurrent + issued certificate so the org has a real
  // ORG_ASSIGNED credential to view & sign (demoes INV-3/4/6). Idempotent + guarded.
  const hf = (await db.select().from(trainings).where(eq(trainings.slug, "human-factors-formation-continue")).limit(1))[0];
  if (hf && marcEmp?.userId) {
    const done = (await db.select().from(enrollments)
      .where(and(eq(enrollments.userId, marcEmp.userId), eq(enrollments.trainingId, hf.id))).limit(1))[0];
    if (!done) {
      try {
        const e = (await db.insert(enrollments).values({
          userId: marcEmp.userId, trainingId: hf.id, employeeId: marcEmp.id,
          status: "completed", progressPercent: 100, completedAt: new Date(),
        }).returning())[0];
        await issueCertificate(e.id, process.env.APP_ORIGIN ?? "http://localhost:3000");
      } catch (err) {
        console.warn("[seed] certificat membre ignoré:", (err as Error)?.message);
      }
    }
  }

  const aff = await backfillAffiliations();
  console.log(`[seed] Affiliations: +${aff.created} créées, ${aff.linked} liées.`);
  const cred = await backfillCredentials();
  if (cred.created) console.log(`[seed] Credentials: +${cred.created} LIVING (backfill).`);
}

// Idempotent Part-66 objectives — runs whether the catalogue is fresh or already persisted.
async function ensureObjectives() {
  const db = (await getDb())!;
  // Human Factors — recurrent course: objectives mapped onto existing modules + questions.
  const hf = (await db.select().from(trainings).where(eq(trainings.slug, "human-factors-formation-continue")).limit(1))[0];
  if (hf) {
    const has = await db.select().from(learningObjectives).where(eq(learningObjectives.trainingId, hf.id)).limit(1);
    if (!has[0]) {
      console.log("[seed] Objectifs Part-66 (Human Factors)…");
      const mods = await db.select().from(trainingModules).where(eq(trainingModules.trainingId, hf.id));
      const modByOrder = (n: number) => mods.find((m) => m.sortOrder === n)?.id ?? null;
      const objs = [
        { code: "9.1", title: "Généralités sur les facteurs humains", knowledgeLevel: "1", moduleId: modByOrder(1), sortOrder: 1 },
        { code: "9.2", title: "Performance et limites humaines (modèle SHELL)", knowledgeLevel: "2", moduleId: modByOrder(1), sortOrder: 2 },
        { code: "9.3", title: "Facteurs d'erreur — les Dirty Dozen", knowledgeLevel: "2", moduleId: modByOrder(2), sortOrder: 3 },
        { code: "9.4", title: "Communication et travail d'équipe", knowledgeLevel: "2", moduleId: modByOrder(3), sortOrder: 4 },
        { code: "9.5", title: "Fatigue, stress et vigilance", knowledgeLevel: "2", moduleId: modByOrder(4), sortOrder: 5 },
      ];
      const objIds: Record<string, number> = {};
      for (const o of objs) {
        const r = await db.insert(learningObjectives).values({ ...o, trainingId: hf.id } as any).returning({ id: learningObjectives.id });
        objIds[o.code] = r[0].id;
      }
      // Attach the existing HF quiz questions to the relevant objective.
      const qs = await db.select().from(quizQuestions).where(eq(quizQuestions.trainingId, hf.id));
      for (const q of qs) {
        let objId: number | undefined;
        if (/dirty dozen/i.test(q.question)) objId = objIds["9.3"];
        else if (/handover|transfert/i.test(q.question)) objId = objIds["9.4"];
        else if (/shell/i.test(q.question)) objId = objIds["9.2"];
        if (objId) await db.update(quizQuestions).set({ objectiveId: objId }).where(eq(quizQuestions.id, q.id));
      }
    }
  }
  // Part-66 Module 9 — exam-prep syllabus (objectives at training level).
  const p66 = (await db.select().from(trainings).where(eq(trainings.slug, "part66-module-9-facteurs-humains")).limit(1))[0];
  if (p66) {
    const has = await db.select().from(learningObjectives).where(eq(learningObjectives.trainingId, p66.id)).limit(1);
    if (!has[0]) {
      console.log("[seed] Objectifs Part-66 (Module 9)…");
      const objs = [
        { code: "9.1", title: "Généralités", knowledgeLevel: "1", sortOrder: 1 },
        { code: "9.2", title: "Performance et limites humaines", knowledgeLevel: "2", sortOrder: 2 },
        { code: "9.3", title: "Psychologie sociale", knowledgeLevel: "2", sortOrder: 3 },
        { code: "9.4", title: "Facteurs affectant la performance", knowledgeLevel: "2", sortOrder: 4 },
        { code: "9.5", title: "Environnement physique", knowledgeLevel: "2", sortOrder: 5 },
        { code: "9.6", title: "Tâches", knowledgeLevel: "2", sortOrder: 6 },
        { code: "9.7", title: "Communication", knowledgeLevel: "2", sortOrder: 7 },
        { code: "9.8", title: "Erreur humaine", knowledgeLevel: "2", sortOrder: 8 },
        { code: "9.9", title: "Dangers sur le lieu de travail", knowledgeLevel: "2", sortOrder: 9 },
      ];
      for (const o of objs) await db.insert(learningObjectives).values({ ...o, trainingId: p66.id } as any);
    }
  }
}

// Idempotent demo scenario for the expiry-alert system: enroll the demo learner in
// Human Factors with a recyclage that expires soon, so notifications have something to surface.
async function ensureDemoExpiry() {
  const db = (await getDb())!;
  const hf = (await db.select().from(trainings).where(eq(trainings.slug, "human-factors-formation-continue")).limit(1))[0];
  const learner = (await db.select().from(users).where(eq(users.email, "jean.dupont@example.com")).limit(1))[0];
  if (!hf || !learner) return;
  const existing = await db.select().from(enrollments)
    .where(and(eq(enrollments.userId, learner.id), eq(enrollments.trainingId, hf.id))).limit(1);
  if (existing[0]) return;
  const completedAt = new Date(); completedAt.setMonth(completedAt.getMonth() - 23);
  const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 35); // due_soon (< 90 days)
  await db.insert(enrollments).values({
    userId: learner.id, trainingId: hf.id, status: "completed", progressPercent: 100,
    startedAt: completedAt, completedAt, expiresAt,
  });
}

// Idempotent: link FR regulatory modules to a translation group + variant, create EN
// counterparts, and add a demo interactive-video slide (timeline quiz).
async function ensurePhase4() {
  const db = (await getDb())!;
  // Demo: make Human Factors a timed, randomized exam (3 random questions from the bank, 10 min).
  const hfExam = (await db.select().from(trainings).where(eq(trainings.slug, "human-factors-formation-continue")).limit(1))[0];
  if (hfExam && hfExam.examTimeLimitMin == null) {
    await db.update(trainings).set({ randomizeQuestions: true, examQuestionCount: 3, examTimeLimitMin: 10 }).where(eq(trainings.id, hfExam.id));
  }
  // TNA demo rules (global): job profile → mandatory recyclage.
  const existingRules = await db.select().from(roleRequirements).limit(1);
  if (!existingRules[0]) {
    const bySlug = async (s: string) => (await db.select().from(trainings).where(eq(trainings.slug, s)).limit(1))[0];
    const hf2 = await bySlug("human-factors-formation-continue");
    const ewis = await bySlug("ewis-electrical-wiring");
    const fts = await bySlug("fuel-tank-safety-cdccl");
    const rules = [
      hf2 && { label: "Tout le personnel → Human Factors (24 mois)", trainingId: hf2.id, periodMonths: 24 },
      ewis && { label: "Techniciens → EWIS (24 mois)", jobTitleContains: "Techni", trainingId: ewis.id, periodMonths: 24 },
      fts && { label: "Licence B1 → Fuel Tank Safety (24 mois)", licenseCategoryContains: "B1", trainingId: fts.id, periodMonths: 24 },
    ].filter(Boolean) as any[];
    for (const r of rules) await db.insert(roleRequirements).values({ companyId: null, ...r });
  }
  // Part-66 course templates (pre-mapped modules + objectives) for client authoring.
  const existingTpl = await db.select().from(courseTemplates).limit(1);
  if (!existingTpl[0]) {
    await db.insert(courseTemplates).values([
      {
        code: "P66-M9", title: "Part-66 Module 9 — Facteurs humains", language: "fr", domain: "part66",
        description: "Template pré-mappé du Module 9 (Human Factors) : chapitres + objectifs Part-66.",
        structure: { modules: [
          { title: "Généralités & performance humaine", objectives: [{ code: "9.1", title: "Généralités", knowledgeLevel: "1" }, { code: "9.2", title: "Performance et limites humaines", knowledgeLevel: "2" }] },
          { title: "Facteurs sociaux & communication", objectives: [{ code: "9.3", title: "Psychologie sociale", knowledgeLevel: "2" }, { code: "9.7", title: "Communication", knowledgeLevel: "2" }] },
          { title: "Erreur humaine & dangers", objectives: [{ code: "9.8", title: "Erreur humaine", knowledgeLevel: "2" }, { code: "9.9", title: "Dangers sur le lieu de travail", knowledgeLevel: "2" }] },
        ] },
      },
      {
        code: "P66-M10", title: "Part-66 Module 10 — Législation aéronautique", language: "fr", domain: "part66",
        description: "Template pré-mappé du Module 10 (Aviation Legislation).",
        structure: { modules: [
          { title: "Cadre réglementaire EASA", objectives: [{ code: "10.1", title: "Cadre réglementaire", knowledgeLevel: "1" }] },
          { title: "Part-145 & Part-M", objectives: [{ code: "10.2", title: "Organisme de maintenance (Part-145)", knowledgeLevel: "2" }, { code: "10.3", title: "Maintien de navigabilité (Part-M)", knowledgeLevel: "2" }] },
        ] },
      },
    ] as any);
  }
  const map = [
    { slug: "human-factors-formation-continue", group: "grp-hf", variant: "recurrent", enTitle: "Human Factors — Recurrent", enDesc: "Recurrent human-factors training compliant with EASA Part-145/147 (Dirty Dozen, communication, fatigue, maintenance errors)." },
    { slug: "ewis-electrical-wiring", group: "grp-ewis", variant: "recurrent", enTitle: "EWIS — Electrical Wiring Interconnection Systems", enDesc: "EWIS training per AMC 20-22: wiring degradation, inspection, contamination prevention." },
    { slug: "fuel-tank-safety-cdccl", group: "grp-fts", variant: "recurrent", enTitle: "Fuel Tank Safety (FTS) — CDCCL", enDesc: "FTS / CDCCL training per EASA requirements: ignition-source prevention in fuel tanks." },
    { slug: "sms-safety-management-system", group: "grp-sms", variant: "initial", enTitle: "SMS — Safety Management System", enDesc: "Introduction to the Safety Management System: policy, risk management, assurance, promotion." },
  ];
  for (const m of map) {
    const fr = (await db.select().from(trainings).where(eq(trainings.slug, m.slug)).limit(1))[0];
    if (!fr) continue;
    if (!fr.translationGroupId) {
      await db.update(trainings).set({ translationGroupId: m.group, variant: m.variant as any }).where(eq(trainings.id, fr.id));
    }
    const enSlug = `${m.slug}-en`;
    const enExists = (await db.select().from(trainings).where(eq(trainings.slug, enSlug)).limit(1))[0];
    if (!enExists) {
      await db.insert(trainings).values({
        title: m.enTitle, slug: enSlug, description: m.enDesc,
        objectives: fr.objectives, prerequisites: fr.prerequisites, targetAudience: fr.targetAudience,
        categoryId: fr.categoryId, type: fr.type, domain: fr.domain, language: "en",
        durationHours: fr.durationHours, level: fr.level,
        priceHt: fr.priceHt, priceTtc: fr.priceTtc, priceEnterprise: fr.priceEnterprise,
        part147Reference: fr.part147Reference, isPublished: true, isFeatured: false,
        recurrencyMonths: fr.recurrencyMonths, passingScore: fr.passingScore, maxAttempts: fr.maxAttempts,
        translationGroupId: m.group, variant: m.variant as any,
      } as any);
    }
  }
  // Demo interactive-video slide (timeline quiz) on the slide course.
  const demo = (await db.select().from(trainings).where(eq(trainings.slug, "aviation-safety-essentials-demo")).limit(1))[0];
  if (demo) {
    const existing = await db.select().from(slides).where(eq(slides.trainingId, demo.id));
    const videoSlide = existing.find((s) => s.videoUrl);
    // Rich interactive cues: quiz (+jump), adaptive branch, clickable hotspot.
    const richCues = [
      { atSeconds: 2, kind: "quiz", question: "Interactive checkpoint — ready to continue?", options: ["Yes", "No"], correct: [0], explanation: "The video pauses at cue points to check understanding." },
      { atSeconds: 5, kind: "branch", question: "Which topic do you want to explore?", branches: [{ label: "Communication", seekTo: 6 }, { label: "Fatigue management", seekTo: 8 }] },
      { atSeconds: 7, kind: "hotspot", question: "Click the at-risk area", hotspots: [{ xPct: 32, yPct: 55, label: "Wiring bundle", correct: true, seekTo: 9 }, { xPct: 72, yPct: 38, label: "Panel", correct: false }] },
    ];
    if (!videoSlide) {
      await db.insert(slides).values({
        trainingId: demo.id, sortOrder: 5, title: "Interactive video",
        body: "Watch the clip — it pauses for a quiz, an adaptive branch and a hotspot.",
        videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
        videoCues: richCues as any,
      } as any);
    } else if (!(videoSlide.videoCues ?? []).some((c: any) => c.kind === "branch")) {
      await db.update(slides).set({ videoCues: richCues as any }).where(eq(slides.id, videoSlide.id));
    }
  }
  // Live demo webinar (TIER 2) + register the demo learner so /live is testable.
  const existingLive = await db.select().from(webinars).where(eq(webinars.status, "live")).limit(1);
  if (!existingLive[0]) {
    const w = await db.insert(webinars).values({
      title: "Classe live — Facteurs humains (démo)", description: "Session live de démonstration (classe virtuelle + engagement).",
      instructorName: "Cdt. Philippe Laurent", scheduledAt: new Date(), durationMinutes: 60, maxParticipants: 100, status: "live",
    } as any).returning({ id: webinars.id });
    const learner = (await db.select().from(users).where(eq(users.email, "jean.dupont@example.com")).limit(1))[0];
    if (learner && w[0]) await db.insert(webinarRegistrations).values({ webinarId: w[0].id, userId: learner.id });
  }
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL non configuré.");

  // In production, the demo accounts must NOT keep their published passwords. They are
  // still created (for demo data integrity) but with a random, unknown password — login
  // with the known credentials is therefore impossible. The admin password comes from
  // ADMIN_PASSWORD in production.
  const isProd = process.env.NODE_ENV === "production";
  const demoPass = (known: string) => (isProd ? nanoid(24) : known);
  const adminPass = process.env.ADMIN_PASSWORD || (isProd ? nanoid(24) : "raero@2026!");

  console.log("[seed] Comptes de démonstration…");
  const admin = await ensureUser({
    email: "contact@r-aero-academy.com", password: adminPass, name: "Administrateur R-AERO",
    role: "admin", jobTitle: "Responsable formation Part-147",
  });
  if (isProd) console.log(process.env.ADMIN_PASSWORD ? "[seed] admin password from ADMIN_PASSWORD." : "[seed] ⚠ admin password randomised — set ADMIN_PASSWORD then use 'forgot password', or reset via DB.");

  const learner = await ensureUser({
    email: "jean.dupont@example.com", password: demoPass("Learner1234!"), name: "Jean Dupont",
    role: "user", jobTitle: "Technicien B1", licenseNumber: "FR.66.123456", licenseCategories: "B1.1, B1.3",
  });

  // ── Company (B2B) ──
  let company = (await db.select().from(companies).where(eq(companies.name, "Société de démonstration")).limit(1))[0];
  if (!company) {
    company = (await db.insert(companies).values({
      name: "Société de démonstration", siret: "81234567800023", vatNumber: "FR12812345678",
      address: "12 rue de l'Aviation, 31700 Blagnac", country: "FR",
      contactName: "Sophie Martin", contactEmail: "training@demo.example", contactPhone: "+33 5 61 00 00 00",
      subscriptionType: "all_inclusive",
    }).returning())[0];
  }

  const manager = await ensureUser({
    email: "manager@demo.example", password: demoPass("Manager1234!"), name: "Sophie Martin",
    role: "company_manager", jobTitle: "Training Manager", companyId: company.id,
  });
  if (!manager.companyId) await db.update(users).set({ companyId: company.id }).where(eq(users.id, manager.id));

  // ── Slide-based demo course (idempotent — always ensured, even on a persisted DB) ──
  const demoSlug = "aviation-safety-essentials-demo";
  const existingDemo = await db.select().from(trainings).where(eq(trainings.slug, demoSlug)).limit(1);
  if (!existingDemo[0]) {
    console.log("[seed] Formation slide (démo AI maker)…");
    const slideCourse = (await db.insert(trainings).values({
      title: "Aviation Safety Essentials — AI Maker Demo",
      slug: demoSlug,
      description: "A short slide-based course produced with the AI e-learning maker: image/text slides, narration and mini-quizzes. Default language: English.",
      objectives: "Show the slide-based player: media + text + per-slide mini-quiz + next.",
      targetAudience: "All maintenance staff", type: "elearning", domain: "general",
      language: "en", durationHours: "1.00", level: "beginner",
      priceHt: "0.00", priceTtc: "0.00", priceEnterprise: "0.00",
      part147Reference: "DEMO-AI", isPublished: true, isFeatured: false, passingScore: 75, maxAttempts: 3,
    }).returning())[0];

    const demoSlides = [
      { title: "Welcome", sortOrder: 1, body: "Welcome to this short demo course built with the R-AERO AI e-learning maker.\n\nEach slide can combine an image or a video, narration, text and a mini-quiz. Use Next to move forward.", imageUrl: "/brand/logo-full.svg" },
      { title: "The Dirty Dozen", sortOrder: 2, body: "The 'Dirty Dozen' are the twelve most common human factors that lead to maintenance errors — including complacency, fatigue, lack of communication and pressure.", quizQuestion: "How many factors make up the 'Dirty Dozen'?", quizOptions: ["10", "12", "14", "8"], quizCorrect: [1], quizExplanation: "The Dirty Dozen is a list of 12 human-factor error precursors." },
      { title: "Communication & handover", sortOrder: 3, body: "Clear shift handovers prevent maintenance errors. Always document tasks in progress and pending items when transferring work to the next team.", quizQuestion: "A shift handover should always be documented.", quizOptions: ["True", "False"], quizCorrect: [0], quizExplanation: "Documenting the handover prevents communication errors." },
      { title: "Wrap-up", sortOrder: 4, body: "You have completed the demo. In a real course, slides can include AI-generated images and voice-over narration. Finish to receive your certificate." },
    ];
    for (const s of demoSlides) await db.insert(slides).values({ ...s, trainingId: slideCourse.id } as any);

    // Enroll the demo learner so the slide player is immediately testable.
    await db.insert(enrollments).values({ userId: learner.id, trainingId: slideCourse.id, status: "not_started", progressPercent: 0 });
  }

  // ── Sessions à venir (idempotent) ──
  const existingSessions = await db.select().from(sessions).limit(1);
  if (!existingSessions[0]) {
    console.log("[seed] Sessions inter-entreprises…");
    const d = (days: number) => { const x = new Date(); x.setDate(x.getDate() + days); x.setHours(9, 0, 0, 0); return x; };
    await db.insert(sessions).values([
      { title: "Human Factors — Formation initiale (présentiel)", description: "Formation initiale facteurs humains, 2 jours en centre.", format: "in_person", location: "Toulouse (Blagnac)", instructorName: "Cdt. Philippe Laurent", startDate: d(18), endDate: d(19), durationDays: "2.0", seats: 12, seatsTaken: 7, priceHt: "690.00", language: "fr", cpfEligible: true, status: "scheduled" },
      { title: "Type Rating A320 — Théorie (classe virtuelle)", description: "Module théorique QT A320 en classe virtuelle live.", format: "virtual", location: "Classe virtuelle", instructorName: "S. Moreau", startDate: d(32), endDate: d(40), durationDays: "5.0", seats: 16, seatsTaken: 4, priceHt: "1800.00", language: "fr", cpfEligible: false, status: "scheduled" },
      { title: "EWIS — Recyclage (présentiel)", description: "Recyclage EWIS conforme AMC 20-22.", format: "in_person", location: "Bordeaux", instructorName: "M. Garnier", startDate: d(45), endDate: d(45), durationDays: "1.0", seats: 10, seatsTaken: 9, priceHt: "320.00", language: "fr", cpfEligible: true, status: "scheduled" },
      { title: "Safety Day 2026 (webinar)", description: "Webinaire sécurité — retour d'expérience maintenance.", format: "webinar", location: "En ligne", instructorName: "Cdt. Philippe Laurent", startDate: d(21), durationDays: "0.5", seats: 200, seatsTaken: 64, priceHt: "0.00", language: "fr", cpfEligible: false, status: "scheduled" },
    ]);
  }

  // ── Actualités (idempotent) ──
  const existingArticles = await db.select().from(articles).limit(1);
  if (!existingArticles[0]) {
    console.log("[seed] Actualités…");
    const ago = (days: number) => { const x = new Date(); x.setDate(x.getDate() - days); return x; };
    await db.insert(articles).values([
      {
        title: "R-AERO lance sa plateforme e-learning assistée par IA", slug: "lancement-plateforme-elearning-ia",
        excerpt: "Créez et suivez vos formations Part-147 en ligne : slides interactives, quiz, certificats vérifiables et un créateur de cours propulsé par l'IA.",
        content: "Nous sommes fiers d'annoncer le lancement de notre nouvelle plateforme e-learning. Contrairement aux catalogues PDF classiques, R-AERO Training Academy propose un véritable parcours en ligne : achat et accès instantané, lecteur de slides (image, vidéo, narration, mini-quiz), examens notés et certificats numériques vérifiables par QR code.\n\nNouveauté majeure : un créateur d'e-learning assisté par IA permet à nos formateurs de produire des modules complets en quelques minutes — plans de cours, textes, images et narration vocale générés automatiquement, puis validés par nos experts Part-147.",
        category: "Plateforme", author: "L'équipe R-AERO", isPublished: true, publishedAt: ago(2),
      },
      {
        title: "Facteurs humains : retour sur le Safety Day", slug: "retour-safety-day-facteurs-humains",
        excerpt: "Analyse des Dirty Dozen et bonnes pratiques de prévention des erreurs de maintenance partagées lors de notre dernière session.",
        content: "Le Safety Day a réuni techniciens et Training Managers autour des facteurs humains. Au programme : les 12 facteurs d'erreur (Dirty Dozen), la gestion de la fatigue et l'importance des transferts de tâches documentés. Les participants ont salué le format interactif et les études de cas concrètes.",
        category: "Sécurité", author: "Cdt. Philippe Laurent", isPublished: true, publishedAt: ago(9),
      },
      {
        title: "Récurrences Part-147 : anticipez vos échéances", slug: "recurrences-part147-anticipez",
        excerpt: "Notre tableau de bord entreprise suit automatiquement les récurrences (HF, FTS, EWIS…) avec indicateurs de couleur OK / bientôt dû / en retard.",
        content: "La gestion des récurrences réglementaires est un enjeu clé pour les organismes Part-145. Notre espace entreprise centralise les obligations de chaque employé, calcule les prochaines échéances et alerte en amont. Les Training Managers exportent un rapport de conformité en un clic pour leurs audits.",
        category: "Entreprises", author: "L'équipe R-AERO", isPublished: true, publishedAt: ago(20),
      },
    ]);
  }

  // Part-66 objectives — idempotent, runs even when the catalogue already exists.
  await ensureObjectives();
  await ensureDemoExpiry();
  await ensurePhase4();

  // ── Stop here if the rest of the catalogue is already seeded ──
  const existingTrainings = await db.select().from(trainings).where(eq(trainings.slug, "human-factors-formation-continue")).limit(1);
  if (existingTrainings.length > 0) {
    console.log("[seed] Catalogue déjà présent — comptes vérifiés, seed terminé.");
    await ensureMemberAndAffiliations();
    return;
  }

  console.log("[seed] Catégories…");
  const catData = [
    { name: "Human Factors", slug: "human-factors", description: "Facteurs humains en maintenance aéronautique", icon: "Brain", sortOrder: 1 },
    { name: "EWIS", slug: "ewis", description: "Electrical Wiring Interconnection Systems", icon: "Zap", sortOrder: 2 },
    { name: "Fuel Tank Safety", slug: "fts", description: "Sécurité des réservoirs de carburant (CDCCL)", icon: "Shield", sortOrder: 3 },
    { name: "SMS", slug: "sms", description: "Safety Management System", icon: "BarChart3", sortOrder: 4 },
    { name: "Type Rating (QT)", slug: "qt", description: "Qualifications de type avion", icon: "Plane", sortOrder: 5 },
    { name: "Part-66", slug: "part66", description: "Modules réglementaires Part-66", icon: "BookOpen", sortOrder: 6 },
  ];
  const cats: Record<string, number> = {};
  for (const c of catData) {
    const inserted = await db.insert(trainingCategories).values(c).returning({ id: trainingCategories.id });
    cats[c.slug] = inserted[0].id;
  }

  console.log("[seed] Formations + modules + quiz…");

  // ── Flagship: Human Factors (recurrent, full content) ──
  const hf = (await db.insert(trainings).values({
    title: "Human Factors — Formation continue",
    slug: "human-factors-formation-continue",
    description: "Formation de maintien des compétences en facteurs humains, conforme aux exigences EASA Part-145 / Part-147. Aborde les 12 facteurs (Dirty Dozen), la communication, la gestion de la fatigue et les erreurs de maintenance.",
    objectives: "Comprendre l'impact des facteurs humains sur la sécurité ; identifier les situations à risque ; appliquer les bonnes pratiques de prévention des erreurs.",
    prerequisites: "Aucun. Recommandé pour tout personnel de maintenance.",
    targetAudience: "Techniciens B1/B2, personnel de certification, support",
    categoryId: cats["human-factors"], type: "elearning", domain: "general", language: "fr",
    durationHours: "8.00", level: "intermediate",
    priceHt: "250.00", priceTtc: "300.00", priceEnterprise: "200.00",
    part147Reference: "HF-CONT-2026", isPublished: true, isFeatured: true,
    recurrencyMonths: 24, passingScore: 75, maxAttempts: 3,
  }).returning())[0];

  const hfModules = [
    { title: "Introduction aux facteurs humains", content: "Les facteurs humains regroupent l'ensemble des éléments qui influencent la performance humaine en maintenance. Ce module présente le modèle SHELL et l'importance de la culture de sécurité.\n\nLa maintenance aéronautique repose sur la fiabilité humaine autant que sur la fiabilité technique.", durationMinutes: 60, sortOrder: 1 },
    { title: "Les 12 facteurs (Dirty Dozen)", content: "Les 'Dirty Dozen' sont les douze causes les plus fréquentes d'erreurs de maintenance : manque de communication, complaisance, manque de connaissances, distraction, manque de travail d'équipe, fatigue, manque de ressources, pression, manque d'affirmation, stress, manque de conscience, normes.\n\nPour chaque facteur, des barrières de sécurité concrètes sont présentées.", durationMinutes: 90, sortOrder: 2 },
    { title: "Communication & travail d'équipe", content: "Une communication efficace lors des transferts de tâches (shift handover) est essentielle. Ce module couvre les bonnes pratiques documentaires et la prévention des erreurs liées aux interruptions.", durationMinutes: 60, sortOrder: 3 },
    { title: "Gestion de la fatigue et du stress", content: "La fatigue altère la vigilance et le jugement. Ce module présente les stratégies de gestion de la fatigue et l'identification des signes de stress en environnement opérationnel.", durationMinutes: 60, sortOrder: 4 },
  ];
  const hfModuleIds: number[] = [];
  for (const m of hfModules) {
    const inserted = await db.insert(trainingModules).values({ ...m, trainingId: hf.id }).returning({ id: trainingModules.id });
    hfModuleIds.push(inserted[0].id);
  }

  await db.insert(quizQuestions).values([
    { trainingId: hf.id, moduleId: hfModuleIds[1], question: "Combien de facteurs composent les « Dirty Dozen » ?", type: "qcu", options: ["10", "12", "14", "8"], correctAnswer: [1], explanation: "Les Dirty Dozen regroupent 12 facteurs d'erreur les plus courants.", points: 1, sortOrder: 1 },
    { trainingId: hf.id, moduleId: hfModuleIds[1], question: "Parmi ces éléments, lesquels font partie des Dirty Dozen ?", type: "qcm", options: ["La fatigue", "La complaisance", "La météo", "La pression"], correctAnswer: [0, 1, 3], explanation: "La météo n'est pas un facteur humain des Dirty Dozen.", points: 2, sortOrder: 2 },
    { trainingId: hf.id, moduleId: hfModuleIds[2], question: "Le transfert de tâches (shift handover) doit toujours être documenté.", type: "true_false", options: ["Vrai", "Faux"], correctAnswer: [0], explanation: "La documentation du handover prévient les erreurs de communication.", points: 1, sortOrder: 3 },
    { trainingId: hf.id, moduleId: null, question: "Quel modèle décrit les interactions humain / matériel / environnement ?", type: "qcu", options: ["Modèle SHELL", "Modèle PDCA", "Modèle SWOT", "Modèle OODA"], correctAnswer: [0], explanation: "Le modèle SHELL (Software, Hardware, Environment, Liveware) est central en facteurs humains.", points: 1, sortOrder: 4 },
  ]);

  // ── EWIS (recurrent, with content) ──
  const ewis = (await db.insert(trainings).values({
    title: "EWIS — Electrical Wiring Interconnection Systems",
    slug: "ewis-electrical-wiring",
    description: "Formation EWIS conforme à l'AMC 20-22. Sensibilisation aux risques liés au câblage électrique, inspection, maintenance et prévention de la contamination.",
    objectives: "Identifier les dégradations du câblage ; appliquer les pratiques de maintenance EWIS ; comprendre la zonal analysis.",
    prerequisites: "Connaissances de base en systèmes électriques avion.",
    targetAudience: "Techniciens B1/B2", categoryId: cats["ewis"], type: "elearning", domain: "b1b2", language: "fr",
    durationHours: "6.00", level: "intermediate",
    priceHt: "220.00", priceTtc: "264.00", priceEnterprise: "180.00",
    part147Reference: "EWIS-AMC2022", isPublished: true, isFeatured: true,
    recurrencyMonths: 24, passingScore: 75, maxAttempts: 3,
  }).returning())[0];
  const ewisMods: number[] = [];
  for (const m of [
    { title: "Principes EWIS et réglementation", content: "L'EWIS couvre l'ensemble des câblages et connexions électriques de l'aéronef. La réglementation (AMC 20-22) impose une approche de maintenance dédiée.", durationMinutes: 60, sortOrder: 1 },
    { title: "Inspection et dégradations", content: "Les principales dégradations : chafing, contamination, corrosion, surchauffe. Techniques d'inspection visuelle générale (GVI) et détaillée.", durationMinutes: 90, sortOrder: 2 },
    { title: "Prévention de la contamination", content: "La contamination par fluides, poussières et débris est une cause majeure de défaillance. Bonnes pratiques de protection des faisceaux.", durationMinutes: 60, sortOrder: 3 },
  ]) {
    const r = await db.insert(trainingModules).values({ ...m, trainingId: ewis.id }).returning({ id: trainingModules.id });
    ewisMods.push(r[0].id);
  }
  await db.insert(quizQuestions).values([
    { trainingId: ewis.id, moduleId: ewisMods[1], question: "Le « chafing » désigne :", type: "qcu", options: ["Une usure par frottement", "Une surchauffe", "Une corrosion", "Une coupure nette"], correctAnswer: [0], explanation: "Le chafing est une usure de l'isolant par frottement.", points: 1, sortOrder: 1 },
    { trainingId: ewis.id, moduleId: null, question: "Quelle réglementation encadre l'EWIS ?", type: "qcu", options: ["AMC 20-22", "Part-21", "CS-25 uniquement", "ED-12"], correctAnswer: [0], explanation: "L'AMC 20-22 traite de la formation EWIS.", points: 1, sortOrder: 2 },
    { trainingId: ewis.id, moduleId: null, question: "La contamination des faisceaux peut provenir de fluides et de débris.", type: "true_false", options: ["Vrai", "Faux"], correctAnswer: [0], explanation: "Fluides, poussières et débris sont des sources de contamination.", points: 1, sortOrder: 3 },
  ]);

  // ── Other catalogue entries (lighter) ──
  await db.insert(trainings).values([
    {
      title: "Fuel Tank Safety (FTS) — CDCCL", slug: "fuel-tank-safety-cdccl",
      description: "Formation FTS / CDCCL (Critical Design Configuration Control Limitations) conforme aux exigences EASA. Prévention des sources d'inflammation dans les réservoirs.",
      objectives: "Comprendre les CDCCL ; appliquer les précautions FTS lors des interventions.",
      prerequisites: "Personnel intervenant sur les systèmes carburant.", targetAudience: "Techniciens B1",
      categoryId: cats["fts"], type: "elearning", domain: "b1", language: "fr",
      durationHours: "4.00", level: "intermediate", priceHt: "190.00", priceTtc: "228.00", priceEnterprise: "150.00",
      part147Reference: "FTS-CDCCL", isPublished: true, isFeatured: false, recurrencyMonths: 24, passingScore: 75, maxAttempts: 3,
    },
    {
      title: "SMS — Safety Management System", slug: "sms-safety-management-system",
      description: "Introduction au Safety Management System : politique de sécurité, gestion du risque, assurance et promotion de la sécurité.",
      objectives: "Comprendre les 4 piliers du SMS ; participer au reporting de sécurité.",
      prerequisites: "Aucun.", targetAudience: "Tout personnel", categoryId: cats["sms"], type: "elearning", domain: "management", language: "fr",
      durationHours: "5.00", level: "beginner", priceHt: "180.00", priceTtc: "216.00", priceEnterprise: "140.00",
      part147Reference: "SMS-INTRO", isPublished: true, isFeatured: false, passingScore: 70, maxAttempts: 3,
    },
    {
      title: "Type Rating A320 — Théorie (T1)", slug: "type-rating-a320-theorie",
      description: "Module théorique de qualification de type Airbus A320 (niveau T1). Systèmes avion, limitations, procédures.",
      objectives: "Acquérir les connaissances théoriques nécessaires à la QT A320.",
      prerequisites: "Licence Part-66 B1.1 ou B2.", targetAudience: "Techniciens certifiants", categoryId: cats["qt"], type: "qt", domain: "b1b2", language: "fr",
      durationHours: "40.00", level: "advanced", priceHt: "1800.00", priceTtc: "2160.00", priceEnterprise: "1500.00",
      part147Reference: "QT-A320-T1", isPublished: true, isFeatured: true, passingScore: 80, maxAttempts: 2,
    },
    {
      title: "Part-66 — Module 9 : Facteurs humains", slug: "part66-module-9-facteurs-humains",
      description: "Module 9 du programme Part-66 (Human Factors), préparation à l'examen théorique de base.",
      objectives: "Couvrir le syllabus Module 9 Part-66.",
      prerequisites: "Aucun.", targetAudience: "Candidats Part-66", categoryId: cats["part66"], type: "elearning", domain: "part66", language: "fr",
      durationHours: "16.00", level: "beginner", priceHt: "320.00", priceTtc: "384.00", priceEnterprise: "260.00",
      part147Reference: "P66-M9", isPublished: true, isFeatured: false, passingScore: 75, maxAttempts: 3,
    },
  ]);

  console.log("[seed] Webinar…");
  const future = new Date(); future.setDate(future.getDate() + 21);
  await db.insert(webinars).values({
    trainingId: hf.id, title: "Safety Day 2026 — Retour d'expérience maintenance",
    description: "Webinaire live : analyse d'événements de sécurité récents et bonnes pratiques. Sessions de questions/réponses avec un expert Part-147.",
    instructorName: "Cdt. Philippe Laurent", scheduledAt: future, durationMinutes: 90, maxParticipants: 200,
    meetingUrl: "https://meet.example.com/r-aero-safety-day", status: "scheduled",
  });

  console.log("[seed] Employés + récurrences (B2B)…");
  const empData = [
    { firstName: "Marc", lastName: "Lefebvre", email: "marc.lefebvre@demo.example", jobTitle: "Technicien B1", licenseNumber: "FR.66.222111", licenseCategories: "B1.1", typeRatings: "A320, B737", department: "Line Maintenance", base: "Toulouse" },
    { firstName: "Amélie", lastName: "Rousseau", email: "amelie.rousseau@demo.example", jobTitle: "Technicienne B2", licenseNumber: "FR.66.333222", licenseCategories: "B2", typeRatings: "A350", department: "Avionics", base: "Toulouse" },
    { firstName: "Karim", lastName: "Benali", email: "karim.benali@demo.example", jobTitle: "Support", department: "Base Maintenance", base: "Blagnac" },
  ];
  for (const e of empData) {
    const inserted = await db.insert(employees).values({ ...e, companyId: company.id }).returning({ id: employees.id });
    const empId = inserted[0].id;
    // A recurrency on HF for each employee, with varied statuses
    const next = new Date();
    const variant = empData.indexOf(e);
    next.setMonth(next.getMonth() + (variant === 0 ? 1 : variant === 1 ? 8 : -1));
    await db.insert(recurrencies).values({
      employeeId: empId, trainingId: hf.id, companyId: company.id, periodMonths: 24,
      nextDueAt: next, status: variant === 0 ? "due_soon" : variant === 1 ? "ok" : "overdue",
      lastCompletedAt: new Date(new Date().setMonth(new Date().getMonth() - (variant === 2 ? 25 : 16))),
    });
  }

  // Ensure objectives on a fresh DB (the catalogue was just created above).
  await ensureObjectives();
  await ensureDemoExpiry();
  await ensurePhase4();

  await ensureMemberAndAffiliations();

  console.log("[seed] ✅ Terminé.");
  if (isProd) {
    console.log("   (production) Comptes démo créés avec des mots de passe ALÉATOIRES — identifiants connus inutilisables.");
    console.log("   Admin : contact@r-aero-academy.com" + (process.env.ADMIN_PASSWORD ? " / (ADMIN_PASSWORD)" : " / (mot de passe aléatoire — utilisez « mot de passe oublié »)"));
  } else {
    console.log("   Admin    : contact@r-aero-academy.com / raero@2026!");
    console.log("   Apprenant: jean.dupont@example.com / Learner1234!");
    console.log("   Manager  : manager@demo.example / Manager1234!");
    console.log("   Membre   : marc.perso@example.com / Member1234! (affilié, technicien B1)");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error("[seed] ERREUR:", err); process.exit(1); });
