import { isUsableKeyword } from "../shared/freeTextAnswer";
import { embeddedQuizSchema } from "../shared/embeddedQuiz";
import { videoCuesSchema } from "../shared/videoCues";
import type { Training, TrainingModule, QuizQuestion, Slide } from "../drizzle/schema";
import { and, eq, isNull } from "drizzle-orm";
import { trainings, trainingModules, quizQuestions, slides } from "../drizzle/schema";
import { getDb } from "./db";

export type ReadinessIssue = { code: "chapters" | "content" | "chapterQuiz" | "finalQuiz" | "question" | "policy" | "orphan" | "slideQuiz" | "videoActivities"; label: string; moduleId?: number; questionId?: number; slideId?: number };
/** Publication checks are technical preparation checks, not regulatory approval. */
export function assessCourse(course: Training, modules: TrainingModule[], questions: QuizQuestion[], deck: Slide[]) {
  const issues: ReadinessIssue[] = [];
  if (course.type !== "elearning") return { ready: true, issues };
  if (!modules.length) issues.push({ code: "chapters", label: course.title });
  const validPolicy = (score: number | null, attempts: number | null, time: number | null) => Number.isInteger(score) && score! >= 1 && score! <= 100 && Number.isInteger(attempts) && attempts! >= 1 && attempts! <= 20 && (time == null || Number.isInteger(time) && time >= 1 && time <= 240);
  if (!validPolicy(course.passingScore, course.maxAttempts, course.examTimeLimitMin)) issues.push({ code: "policy", label: course.title });
  for (const m of modules) {
    if (!m.content?.trim() && !m.videoUrl?.trim() && !m.pdfUrl?.trim() && !deck.some(s => s.moduleId === m.id && !!(s.body?.trim() || s.imageUrl?.trim() || s.videoUrl?.trim() || s.audioUrl?.trim()))) issues.push({ code: "content", label: m.title, moduleId: m.id });
    if (!questions.some(q => q.moduleId === m.id)) issues.push({ code: "chapterQuiz", label: m.title, moduleId: m.id });
    if (!validPolicy(m.quizPassingScore, m.quizMaxAttempts, m.quizTimeLimitMin)) issues.push({ code: "policy", label: m.title, moduleId: m.id });
  }
  const finalQuestions = questions.filter(q => q.moduleId == null);
  if (!finalQuestions.length) issues.push({ code: "finalQuiz", label: course.title });
  if (course.examQuestionCount != null && (!Number.isInteger(course.examQuestionCount) || course.examQuestionCount < 1 || course.examQuestionCount > finalQuestions.length)) issues.push({ code: "policy", label: course.title });
  for (const q of questions) {
    if (q.moduleId != null && !modules.some(m => m.id === q.moduleId)) issues.push({ code: "orphan", label: q.question, questionId: q.id });
    let valid = !!q.question.trim() && Number.isInteger(q.points) && q.points! > 0;
    if (["qcu", "qcm", "true_false"].includes(q.type)) {
      const options = q.options ?? [], correct = q.correctAnswer ?? [];
      valid &&= options.length >= 2 && options.every(o => !!o.trim()) && correct.length > 0 && new Set(correct).size === correct.length && correct.every(i => Number.isInteger(i) && i >= 0 && i < options.length);
      if (q.type !== "qcm") valid &&= correct.length === 1;
      if (q.type === "true_false") valid &&= options.length === 2;
    } else if (q.type === "matching") {
      const pairs = q.answerKey?.pairs ?? [], left = q.options ?? [], right = q.optionsRight ?? [];
      valid &&= left.length > 0 && right.length > 0 && left.every(v => !!v.trim()) && right.every(v => !!v.trim()) && pairs.length === left.length && new Set(pairs.map(p => p[0])).size === left.length && pairs.every(p => p.length === 2 && Number.isInteger(p[0]) && p[0] >= 0 && p[0] < left.length && Number.isInteger(p[1]) && p[1] >= 0 && p[1] < right.length);
    } else if (q.type === "free_text") {
      // Arbitrary author regular expressions are not suitable for automatic exam grading.
      valid &&= !!q.answerKey?.keywords?.length && q.answerKey.keywords.every(isUsableKeyword) && !q.answerKey.regex;
    } else valid = false;
    if (!valid) issues.push({ code: "question", label: q.question, questionId: q.id });
  }
  for (const s of deck) {
    const location={label:s.title || `Slide ${s.id}`,slideId:s.id};
    if (s.moduleId == null || !modules.some(m => m.id === s.moduleId)) issues.push({ code: "orphan", ...location });
    if (!embeddedQuizSchema.safeParse(s).success) issues.push({code:"slideQuiz",...location});
    if (s.videoCues != null && (!videoCuesSchema.safeParse(s.videoCues).success || (s.videoCues.length > 0 && !s.videoUrl?.trim()))) issues.push({code:"videoActivities",...location});
  }
  return { ready: issues.length === 0, issues };
}
export async function courseReadiness(trainingId: number): Promise<{ready:boolean;issues:ReadinessIssue[]}> {
  const db = (await getDb())!;
  const [course] = await db.select().from(trainings).where(eq(trainings.id, trainingId));
  if (!course) return { ready: false, issues: [{ code: "chapters" as const, label: "Formation introuvable" }] };
  const [modules, questions, deck] = await Promise.all([
    db.select().from(trainingModules).where(and(eq(trainingModules.trainingId, trainingId), isNull(trainingModules.archivedAt))),
    db.select().from(quizQuestions).where(and(eq(quizQuestions.trainingId, trainingId), isNull(quizQuestions.archivedAt))),
    db.select().from(slides).where(and(eq(slides.trainingId, trainingId), isNull(slides.archivedAt))),
  ]);
  return assessCourse(course, modules, questions, deck);
}
