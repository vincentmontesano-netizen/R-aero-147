import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import SlideDeck, { type DeckSlide } from "@/components/SlideDeck";
import {
  CheckCircle, ChevronLeft, ChevronRight, BookOpen, Clock,
  Award, PlayCircle, Lock, AlertCircle, Trophy, RotateCcw
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";

// ─── Quiz Component ───────────────────────────────────────────────────────────
function QuizView({
  questions: initialQuestions,
  enrollmentId,
  trainingId,
  attemptNumber,
  passingScore,
  maxAttempts,
  onComplete,
}: {
  questions: any[];
  enrollmentId: number;
  trainingId: number;
  attemptNumber: number;
  passingScore: number;
  maxAttempts: number;
  onComplete: (result: any) => void;
}) {
  const { t } = useI18n();
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [attempt, setAttempt] = useState(attemptNumber);
  const [questions, setQuestions] = useState<any[]>(initialQuestions);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [tabSwitches, setTabSwitches] = useState(0);
  const submittedRef = useRef(false);

  const startExam = trpc.learning.startExam.useMutation();
  const logEvent = trpc.learning.logProctoringEvent.useMutation();
  const submitQuiz = trpc.learning.submitQuiz.useMutation({
    onSuccess: (data) => { submittedRef.current = true; setResult(data); setSubmitted(true); onComplete(data); },
    onError: () => toast.error(t("learningPlayer.quizSubmitError")),
  });

  const doSubmit = () => {
    if (submittedRef.current) return;
    submitQuiz.mutate({ enrollmentId, trainingId, answers, attemptNumber: attempt, sessionId: sessionId ?? undefined });
  };

  // Start (and restart on retry) the proctored exam session: random subset + server timer.
  useEffect(() => {
    let cancelled = false;
    submittedRef.current = false;
    (async () => {
      try {
        const r = await startExam.mutateAsync({ enrollmentId, trainingId, attemptNumber: attempt });
        if (cancelled || !r) return;
        if (r.sessionId) setSessionId(r.sessionId);
        setQuestions(r.questions?.length ? r.questions : initialQuestions);
        setExpiresAt(r.expiresAt ? new Date(r.expiresAt).getTime() : null);
      } catch { if (!cancelled) { setQuestions(initialQuestions); setExpiresAt(null); } }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // Countdown + auto-submit at expiry.
  useEffect(() => {
    if (!expiresAt || submitted) return;
    const tick = () => {
      const left = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) doSubmit();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt, submitted, answers, sessionId]);

  // Proctoring (minimal): log tab switches / focus loss to the exam session.
  useEffect(() => {
    if (!sessionId || submitted) return;
    const onVis = () => { if (document.visibilityState === "hidden") { setTabSwitches((n) => n + 1); logEvent.mutate({ sessionId, type: "tab_switch", detail: t("learningPlayer.proctoringTabLeft") }); } };
    const onBlur = () => logEvent.mutate({ sessionId, type: "blur", detail: t("learningPlayer.proctoringFocusLost") });
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("blur", onBlur); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, submitted]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const toggleAnswer = (questionId: number, optionIndex: number, type: string) => {
    if (submitted) return;
    setAnswers((prev) => {
      const current: number[] = Array.isArray(prev[String(questionId)]) ? prev[String(questionId)] : [];
      if (type === "qcu" || type === "true_false") {
        return { ...prev, [String(questionId)]: [optionIndex] };
      }
      // QCM: toggle
      const next = current.includes(optionIndex)
        ? current.filter((i) => i !== optionIndex)
        : [...current, optionIndex];
      return { ...prev, [String(questionId)]: next };
    });
  };

  const allAnswered = questions.every((q) => {
    const a = answers[String(q.id)];
    if (q.type === "free_text") return typeof a === "string" && a.trim().length > 0;
    if (q.type === "matching") return Array.isArray(a) && a.length === ((q.options as string[]) ?? []).length && a.every((p: any) => Array.isArray(p) && p[1] != null);
    return Array.isArray(a) && a.length > 0;
  });

  if (submitted && result) {
    return (
      <div className="text-center py-10">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${result.isPassed ? "bg-green-100" : "bg-red-100"}`}>
          {result.isPassed
            ? <Trophy className="w-10 h-10 text-green-600" />
            : <AlertCircle className="w-10 h-10 text-red-500" />}
        </div>
        <h2 className="font-serif text-2xl font-bold mb-2" style={{ color: "oklch(19% 0.08 252)" }}>
          {result.isPassed ? t("learningPlayer.congratulations") : t("learningPlayer.insufficientScore")}
        </h2>
        <p className="text-lg font-semibold mb-1" style={{ color: result.isPassed ? "oklch(55% 0.18 145)" : "oklch(55% 0.22 27)" }}>
          {t("learningPlayer.scoreSummary", { percentage: result.percentage, score: result.score, maxScore: result.maxScore })}
        </p>
        <p className="text-sm mb-6" style={{ color: "oklch(45% 0.02 240)" }}>
          {t("learningPlayer.minimumScoreRequired", { score: result.passingScore })}
        </p>
        {result.isPassed ? (
          <p className="text-sm font-medium" style={{ color: "oklch(55% 0.18 145)" }}>
            {t("learningPlayer.trainingValidatedCertAvailable")}
          </p>
        ) : attempt < maxAttempts ? (
          <Button onClick={() => { setSubmitted(false); setResult(null); setAnswers({}); setSessionId(null); setExpiresAt(null); setSecondsLeft(null); setAttempt((a) => a + 1); }} variant="outline">
            <RotateCcw className="w-4 h-4 mr-2" /> {t("learningPlayer.retryAttempt", { current: attempt + 1, max: maxAttempts })}
          </Button>
        ) : (
          <p className="text-sm" style={{ color: "oklch(55% 0.22 27)" }}>
            {t("learningPlayer.maxAttemptsReached", { max: maxAttempts })}
          </p>
        )}

        {/* Feedback per question */}
        <div className="mt-8 text-left space-y-4 max-w-2xl mx-auto">
          {result.feedback?.map((fb: any, i: number) => {
            const q = questions.find((q) => q.id === fb.questionId);
            if (!q) return null;
            return (
              <div key={fb.questionId} className="rounded-lg p-4" style={{ background: fb.isCorrect ? "oklch(55% 0.18 145 / 0.08)" : "oklch(55% 0.22 27 / 0.08)", border: `1px solid ${fb.isCorrect ? "oklch(55% 0.18 145 / 0.3)" : "oklch(55% 0.22 27 / 0.3)"}` }}>
                <div className="flex items-start gap-2 mb-1">
                  {fb.isCorrect ? <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />}
                  <span className="text-sm font-medium" style={{ color: "oklch(19% 0.08 252)" }}>{q.question}</span>
                </div>
                {fb.explanation && <p className="text-xs ml-6" style={{ color: "oklch(45% 0.02 240)" }}>{fb.explanation}</p>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-semibold text-lg" style={{ color: "oklch(19% 0.08 252)" }}>
          {t("learningPlayer.assessmentHeader", { count: questions.length })}
        </h2>
        <div className="flex items-center gap-3">
          {secondsLeft !== null && (
            <span className="inline-flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-full" style={{ background: secondsLeft <= 60 ? "oklch(55% 0.22 27 / 0.12)" : "oklch(68% 0.1 78 / 0.12)", color: secondsLeft <= 60 ? "oklch(50% 0.22 27)" : "oklch(45% 0.09 78)" }}>
              <Clock className="w-3.5 h-3.5" /> {fmt(secondsLeft)}
            </span>
          )}
          <span className="text-sm" style={{ color: "oklch(45% 0.02 240)" }}>
            {t("learningPlayer.scoreRequiredAttempt", { score: passingScore, attempt, max: maxAttempts })}
          </span>
        </div>
      </div>
      {tabSwitches > 0 && (
        <div className="text-xs rounded-lg px-3 py-2 mb-2" style={{ background: "oklch(55% 0.22 27 / 0.08)", color: "oklch(50% 0.22 27)" }}>
          {t("learningPlayer.proctoringWarning", { count: tabSwitches })}
        </div>
      )}

      {questions.map((q, qi) => {
        const opts = (q.options as string[]) ?? [];
        const qid = String(q.id);
        return (
          <div key={q.id} className="rounded-xl p-5" style={{ background: "oklch(100% 0 0)", border: "1px solid oklch(88% 0.015 88)" }}>
            <div className="flex items-start gap-2 mb-4">
              <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "oklch(19% 0.08 252)", color: "oklch(97% 0.01 88)" }}>
                Q{qi + 1}
              </span>
              <p className="font-medium text-sm" style={{ color: "oklch(19% 0.08 252)" }}>{q.question}</p>
            </div>
            {q.type === "free_text" ? (
              <textarea
                value={typeof answers[qid] === "string" ? answers[qid] : ""}
                onChange={(e) => { if (!submitted) setAnswers((p) => ({ ...p, [qid]: e.target.value })); }}
                placeholder={t("learningPlayer.freeTextPlaceholder")}
                className="w-full rounded-lg border px-4 py-3 text-sm h-24 resize-y" style={{ borderColor: "oklch(88% 0.015 88)" }}
              />
            ) : q.type === "matching" ? (
              <div className="space-y-2">
                {opts.map((left, li) => {
                  const pairs: number[][] = Array.isArray(answers[qid]) ? answers[qid] : [];
                  const cur = pairs.find((p) => p[0] === li)?.[1];
                  return (
                    <div key={li} className="flex items-center gap-2">
                      <span className="text-sm flex-1 min-w-0" style={{ color: "oklch(19% 0.08 252)" }}>{left}</span>
                      <span style={{ color: "oklch(45% 0.02 240)" }}>→</span>
                      <select value={cur ?? ""} disabled={submitted}
                        onChange={(e) => setAnswers((p) => {
                          const others = (Array.isArray(p[qid]) ? p[qid] : []).filter((x: number[]) => x[0] !== li);
                          return { ...p, [qid]: e.target.value === "" ? others : [...others, [li, Number(e.target.value)]] };
                        })}
                        className="h-9 rounded-md border px-2 text-sm flex-1 min-w-0" style={{ borderColor: "oklch(88% 0.015 88)" }}>
                        <option value="">{t("learningPlayer.matchingChoose")}</option>
                        {((q.optionsRight as string[]) ?? []).map((r, ri) => <option key={ri} value={ri}>{r}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {opts.map((opt, oi) => {
                  const isSelected = Array.isArray(answers[qid]) && answers[qid].includes(oi);
                  return (
                    <button key={oi} onClick={() => toggleAnswer(q.id, oi, q.type)}
                      className="w-full text-left rounded-lg px-4 py-3 text-sm transition-all"
                      style={{ background: isSelected ? "oklch(19% 0.08 252 / 0.08)" : "oklch(97% 0.01 88)", border: `1px solid ${isSelected ? "oklch(19% 0.08 252)" : "oklch(88% 0.015 88)"}`, color: "oklch(19% 0.08 252)" }}>
                      <span className="font-semibold mr-2">{String.fromCharCode(65 + oi)}.</span>
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div className="flex justify-end pt-4">
        <Button
          size="lg"
          onClick={doSubmit}
          disabled={!allAnswered || submitQuiz.isPending}
          style={{ background: "oklch(68% 0.1 78)", color: "oklch(19% 0.08 252)" }}
        >
          {submitQuiz.isPending ? t("learningPlayer.grading") : t("learningPlayer.submitAnswers")}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Player ──────────────────────────────────────────────────────────────
export default function LearningPlayer() {
  const { t } = useI18n();
  const { slug } = useParams<{ slug: string }>();
  const { user, isAuthenticated } = useAuth();
  const [activeModuleIdx, setActiveModuleIdx] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAttemptNumber, setQuizAttemptNumber] = useState(1);
  const [quizPassed, setQuizPassed] = useState(false);
  const startTimeRef = useRef(Date.now());
  const utils = trpc.useUtils();

  const { data: training } = trpc.public.trainingBySlug.useQuery({ slug: slug ?? "" });
  const { data: enrollments = [] } = trpc.dashboard.enrollments.useQuery();
  const enrollment = enrollments.find((e: any) => e.training?.slug === slug);

  const { data: slideData = [] } = trpc.learning.slides.useQuery(
    { trainingId: training?.id ?? 0 },
    { enabled: !!training?.id }
  );
  const [slideFinished, setSlideFinished] = useState(false);

  const { data: modules = [] } = trpc.learning.modules.useQuery(
    { trainingId: training?.id ?? 0 },
    { enabled: !!training?.id }
  );
  const { data: modProgress = [] } = trpc.learning.moduleProgress.useQuery(
    { enrollmentId: enrollment?.id ?? 0 },
    { enabled: !!enrollment?.id }
  );
  const { data: questions = [] } = trpc.learning.quizQuestions.useQuery(
    { trainingId: training?.id ?? 0 },
    { enabled: !!training?.id }
  );
  const { data: attempts = [] } = trpc.learning.quizAttempts.useQuery(
    { enrollmentId: enrollment?.id ?? 0 },
    { enabled: !!enrollment?.id }
  );
  const { data: objectiveProgress = [] } = trpc.learning.objectiveProgress.useQuery(
    { enrollmentId: enrollment?.id ?? 0 },
    { enabled: !!enrollment?.id }
  );

  const completeModule = trpc.learning.completeModule.useMutation({
    onSuccess: () => utils.learning.moduleProgress.invalidate(),
  });
  const issueCert = trpc.learning.issueCertificate.useMutation({
    onSuccess: (data) => {
      if (data) toast.success(t("learningPlayer.certificateGenerated", { number: data.certificateNumber }));
      utils.dashboard.certificates.invalidate();
    },
    onError: () => toast.error(t("learningPlayer.certificateError")),
  });
  const updateProgress = trpc.dashboard.updateProgress.useMutation({
    onSuccess: () => { utils.dashboard.enrollments.invalidate(); },
  });

  // Slide-based course handlers
  const handleSlideEnter = (idx: number) => {
    if (!enrollment?.id || slideData.length === 0) return;
    const pct = Math.min(99, Math.round(((idx + 1) / slideData.length) * 100));
    if ((enrollment.progressPercent ?? 0) < pct) {
      updateProgress.mutate({ enrollmentId: enrollment.id, progressPercent: pct, status: "in_progress" });
    }
  };
  const handleSlideFinish = () => {
    if (!enrollment?.id) return;
    updateProgress.mutate({ enrollmentId: enrollment.id, progressPercent: 100, status: "completed" });
    issueCert.mutate({ enrollmentId: enrollment.id, origin: window.location.origin });
    setSlideFinished(true);
  };

  const activeModule = modules[activeModuleIdx];
  const isModuleCompleted = (moduleId: number) => modProgress.some((p: any) => p.moduleId === moduleId && p.isCompleted);
  const completedCount = modules.filter((m: any) => isModuleCompleted(m.id)).length;
  const progressPercent = modules.length > 0 ? Math.round((completedCount / modules.length) * 100) : 0;

  const lastAttempt = attempts[0] as any;
  const attemptCount = attempts.length;
  const maxAttempts = training?.maxAttempts ?? 3;
  const canRetakeQuiz = attemptCount < maxAttempts && !quizPassed && !(lastAttempt?.isPassed);

  // Mark module as complete and track time
  const handleCompleteModule = () => {
    if (!enrollment?.id || !activeModule) return;
    const timeSpent = Math.round((Date.now() - startTimeRef.current) / 60000);
    completeModule.mutate({ enrollmentId: enrollment.id, moduleId: activeModule.id, timeSpentMinutes: timeSpent });
    startTimeRef.current = Date.now();
    toast.success(t("learningPlayer.moduleCompletedToast"));
    if (activeModuleIdx < modules.length - 1) {
      setActiveModuleIdx(activeModuleIdx + 1);
    } else if (questions.length > 0) {
      setShowQuiz(true);
    }
  };

  const handleQuizComplete = (result: any) => {
    if (result.isPassed) {
      setQuizPassed(true);
      // Issue certificate
      if (enrollment?.id) {
        issueCert.mutate({ enrollmentId: enrollment.id, origin: window.location.origin });
      }
    } else {
      setQuizAttemptNumber((n) => n + 1);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(97% 0.01 88)" }}>
        <div className="text-center">
          <Lock className="w-12 h-12 mx-auto mb-4" style={{ color: "oklch(68% 0.1 78)" }} />
          <h2 className="font-serif text-2xl font-bold mb-2" style={{ color: "oklch(19% 0.08 252)" }}>{t("learningPlayer.loginRequired")}</h2>
          <Link href="/catalogue"><Button style={{ background: "oklch(19% 0.08 252)", color: "oklch(97% 0.01 88)" }}>{t("learningPlayer.backToCatalogue")}</Button></Link>
        </div>
      </div>
    );
  }

  if (!enrollment) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(97% 0.01 88)" }}>
        <div className="text-center max-w-sm">
          <Lock className="w-12 h-12 mx-auto mb-4" style={{ color: "oklch(68% 0.1 78)" }} />
          <h2 className="font-serif text-2xl font-bold mb-2" style={{ color: "oklch(19% 0.08 252)" }}>{t("learningPlayer.accessDenied")}</h2>
          <p className="text-sm mb-4" style={{ color: "oklch(45% 0.02 240)" }}>{t("learningPlayer.notEnrolled")}</p>
          <Link href={`/formation/${slug}`}><Button style={{ background: "oklch(19% 0.08 252)", color: "oklch(97% 0.01 88)" }}>{t("learningPlayer.viewTraining")}</Button></Link>
        </div>
      </div>
    );
  }

  // ── Slide-based course (built with the AI maker) ──
  if (slideData.length > 0) {
    const deck: DeckSlide[] = (slideData as any[]).map((s) => ({
      id: s.id, title: s.title, body: s.body, imageUrl: s.imageUrl, videoUrl: s.videoUrl, audioUrl: s.audioUrl,
      quizQuestion: s.quizQuestion, quizOptions: s.quizOptions, quizCorrect: s.quizCorrect, quizExplanation: s.quizExplanation,
    }));
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "oklch(97% 0.01 88)" }}>
        <div className="flex items-center h-12 px-4 shrink-0" style={{ background: "oklch(19% 0.08 252)" }}>
          <Link href="/dashboard">
            <button className="flex items-center gap-1 text-sm text-white/60 hover:text-white transition-colors">
              <ChevronLeft className="w-4 h-4" /> {t("learningPlayer.mySpace")}
            </button>
          </Link>
        </div>
        <div className="flex-1 min-h-0">
          {slideFinished || enrollment.status === "completed" ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-sm px-6">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "oklch(55% 0.18 145 / 0.12)" }}>
                  <Trophy className="w-10 h-10" style={{ color: "oklch(55% 0.18 145)" }} />
                </div>
                <h2 className="font-serif text-2xl font-bold mb-2" style={{ color: "oklch(19% 0.08 252)" }}>{t("learningPlayer.trainingValidated")}</h2>
                <p className="text-sm mb-6" style={{ color: "oklch(45% 0.02 240)" }}>{t("learningPlayer.certAvailableInSpace")}</p>
                <Link href="/dashboard"><Button style={{ background: "oklch(19% 0.08 252)", color: "oklch(97% 0.01 88)" }}><Award className="w-4 h-4 mr-2" /> {t("learningPlayer.viewMyCertificate")}</Button></Link>
              </div>
            </div>
          ) : (
            <SlideDeck slides={deck} title={training?.title} onSlideEnter={handleSlideEnter} onFinish={handleSlideFinish} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "oklch(97% 0.01 88)" }}>
      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b" style={{ background: "oklch(19% 0.08 252)", borderColor: "oklch(68% 0.1 78 / 0.2)" }}>
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <button className="flex items-center gap-1 text-sm text-white/60 hover:text-white transition-colors">
                <ChevronLeft className="w-4 h-4" /> {t("learningPlayer.mySpace")}
              </button>
            </Link>
            <span className="text-white/30">|</span>
            <span className="text-sm font-medium text-white truncate max-w-xs">{training?.title}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/60">{t("learningPlayer.percentCompleted", { percent: progressPercent })}</span>
            <div className="w-32 h-1.5 rounded-full" style={{ background: "oklch(97% 0.01 88 / 0.15)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${progressPercent}%`, background: "oklch(68% 0.1 78)" }} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — module list */}
        <aside className="w-72 flex-shrink-0 border-r overflow-y-auto hidden lg:block" style={{ background: "oklch(100% 0 0)", borderColor: "oklch(88% 0.015 88)" }}>
          <div className="p-4 border-b" style={{ borderColor: "oklch(88% 0.015 88)" }}>
            <div className="text-xs font-semibold tracking-wide mb-2" style={{ color: "oklch(45% 0.02 240)" }}>{t("learningPlayer.modulesLabel")}</div>
            <Progress value={progressPercent} className="h-1.5" />
            <div className="text-xs mt-1" style={{ color: "oklch(62% 0.02 240)" }}>{t("learningPlayer.modulesCompletedCount", { completed: completedCount, total: modules.length })}</div>
          </div>
          <nav className="p-2">
            {modules.map((mod: any, idx: number) => {
              const completed = isModuleCompleted(mod.id);
              const isActive = idx === activeModuleIdx && !showQuiz;
              return (
                <button
                  key={mod.id}
                  onClick={() => { setActiveModuleIdx(idx); setShowQuiz(false); }}
                  className="w-full text-left rounded-lg px-3 py-3 mb-1 flex items-start gap-2 transition-all"
                  style={{
                    background: isActive ? "oklch(19% 0.08 252 / 0.08)" : "transparent",
                    border: isActive ? "1px solid oklch(19% 0.08 252 / 0.15)" : "1px solid transparent",
                  }}
                >
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: completed ? "oklch(55% 0.18 145)" : "oklch(88% 0.015 88)" }}>
                    {completed ? <CheckCircle className="w-3 h-3 text-white" /> : <span className="text-xs font-bold" style={{ color: "oklch(45% 0.02 240)" }}>{idx + 1}</span>}
                  </div>
                  <div>
                    <div className="text-sm font-medium leading-snug" style={{ color: "oklch(19% 0.08 252)" }}>{mod.title}</div>
                    {mod.durationMinutes && <div className="text-xs mt-0.5" style={{ color: "oklch(62% 0.02 240)" }}>{mod.durationMinutes} min</div>}
                  </div>
                </button>
              );
            })}
            {questions.length > 0 && (
              <button
                onClick={() => setShowQuiz(true)}
                className="w-full text-left rounded-lg px-3 py-3 mb-1 flex items-start gap-2 transition-all"
                style={{
                  background: showQuiz ? "oklch(68% 0.1 78 / 0.1)" : "transparent",
                  border: showQuiz ? "1px solid oklch(68% 0.1 78 / 0.3)" : "1px solid transparent",
                }}
              >
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: lastAttempt?.isPassed ? "oklch(55% 0.18 145)" : "oklch(68% 0.1 78 / 0.2)" }}>
                  <Award className="w-3 h-3" style={{ color: lastAttempt?.isPassed ? "white" : "oklch(68% 0.1 78)" }} />
                </div>
                <div>
                  <div className="text-sm font-medium" style={{ color: "oklch(19% 0.08 252)" }}>{t("learningPlayer.finalExam")}</div>
                  <div className="text-xs mt-0.5" style={{ color: "oklch(62% 0.02 240)" }}>{t("learningPlayer.questionsCount", { count: questions.length })}</div>
                </div>
              </button>
            )}
          </nav>
          {objectiveProgress.length > 0 && (
            <div className="p-4 border-t" style={{ borderColor: "oklch(88% 0.015 88)" }}>
              <div className="text-xs font-semibold tracking-wide mb-2" style={{ color: "oklch(45% 0.02 240)" }}>{t("learningPlayer.part66Objectives")}</div>
              <div className="space-y-1.5">
                {objectiveProgress.map((o: any) => (
                  <div key={o.id} className="flex items-start gap-2">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: o.isCompleted ? "oklch(55% 0.18 145)" : "oklch(88% 0.015 88)" }}>
                      {o.isCompleted && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <div className="text-xs leading-snug" style={{ color: o.isCompleted ? "oklch(19% 0.08 252)" : "oklch(55% 0.02 240)" }}>
                      {o.code ? <span style={{ color: "oklch(68% 0.1 78)" }}>{o.code} </span> : null}{o.title}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-10">
          {showQuiz ? (
            <div className="max-w-3xl mx-auto">
              {lastAttempt?.isPassed ? (
                <div className="text-center py-10">
                  <Trophy className="w-16 h-16 mx-auto mb-4" style={{ color: "oklch(68% 0.1 78)" }} />
                  <h2 className="font-serif text-2xl font-bold mb-2" style={{ color: "oklch(19% 0.08 252)" }}>{t("learningPlayer.trainingValidated")}</h2>
                  <p className="text-sm mb-6" style={{ color: "oklch(45% 0.02 240)" }}>{t("learningPlayer.examPassedScore", { score: lastAttempt.score, maxScore: lastAttempt.maxScore })}</p>
                  <Link href="/dashboard">
                    <Button style={{ background: "oklch(19% 0.08 252)", color: "oklch(97% 0.01 88)" }}>
                      <Award className="w-4 h-4 mr-2" /> {t("learningPlayer.viewMyCertificate")}
                    </Button>
                  </Link>
                </div>
              ) : (
                <QuizView
                  questions={questions as any}
                  enrollmentId={enrollment.id}
                  trainingId={training?.id ?? 0}
                  attemptNumber={quizAttemptNumber}
                  passingScore={training?.passingScore ?? 75}
                  maxAttempts={maxAttempts}
                  onComplete={handleQuizComplete}
                />
              )}
            </div>
          ) : activeModule ? (
            <div className="max-w-3xl mx-auto">
              {/* Module header */}
              <div className="mb-6">
                <div className="text-xs font-semibold tracking-wide mb-1" style={{ color: "oklch(68% 0.1 78)" }}>
                  {t("learningPlayer.moduleCounter", { current: activeModuleIdx + 1, total: modules.length })}
                </div>
                <h1 className="font-serif text-2xl font-bold mb-2" style={{ color: "oklch(19% 0.08 252)" }}>{activeModule.title}</h1>
                {activeModule.durationMinutes && (
                  <div className="flex items-center gap-1 text-sm" style={{ color: "oklch(45% 0.02 240)" }}>
                    <Clock className="w-4 h-4" /> {t("learningPlayer.durationMinutes", { minutes: activeModule.durationMinutes })}
                  </div>
                )}
              </div>

              {/* Module content */}
              <div className="rounded-xl p-6 mb-6" style={{ background: "oklch(100% 0 0)", border: "1px solid oklch(88% 0.015 88)" }}>
                {activeModule.description && (
                  <p className="text-sm leading-relaxed mb-4" style={{ color: "oklch(45% 0.02 240)" }}>{activeModule.description}</p>
                )}
                {activeModule.content ? (
                  <div className="prose prose-sm max-w-none" style={{ color: "oklch(19% 0.08 252)" }}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{activeModule.content}</p>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <BookOpen className="w-12 h-12 mx-auto mb-3" style={{ color: "oklch(68% 0.1 78)" }} />
                    <p className="text-sm" style={{ color: "oklch(45% 0.02 240)" }}>
                      {t("learningPlayer.moduleContentPending")}
                    </p>
                  </div>
                )}
                {activeModule.videoUrl && (
                  <div className="mt-4 rounded-lg overflow-hidden aspect-video bg-black">
                    <video src={activeModule.videoUrl} controls className="w-full h-full" />
                  </div>
                )}
                {activeModule.pdfUrl && (
                  <a href={activeModule.pdfUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-medium" style={{ color: "oklch(42% 0.1 218)" }}>
                    <BookOpen className="w-4 h-4" /> {t("learningPlayer.downloadPdf")}
                  </a>
                )}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => setActiveModuleIdx(Math.max(0, activeModuleIdx - 1))}
                  disabled={activeModuleIdx === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> {t("learningPlayer.previous")}
                </Button>

                {isModuleCompleted(activeModule.id) ? (
                  <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "oklch(55% 0.18 145)" }}>
                    <CheckCircle className="w-4 h-4" /> {t("learningPlayer.moduleCompleted")}
                  </div>
                ) : (
                  <Button
                    onClick={handleCompleteModule}
                    disabled={completeModule.isPending}
                    style={{ background: "oklch(68% 0.1 78)", color: "oklch(19% 0.08 252)" }}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {activeModuleIdx < modules.length - 1 ? t("learningPlayer.validateAndContinue") : questions.length > 0 ? t("learningPlayer.validateAndTakeExam") : t("learningPlayer.finishTraining")}
                  </Button>
                )}

                {activeModuleIdx < modules.length - 1 && (
                  <Button
                    variant="outline"
                    onClick={() => setActiveModuleIdx(activeModuleIdx + 1)}
                  >
                    {t("learningPlayer.next")} <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-20">
              <PlayCircle className="w-16 h-16 mx-auto mb-4" style={{ color: "oklch(68% 0.1 78)" }} />
              <h2 className="font-serif text-2xl font-bold mb-2" style={{ color: "oklch(19% 0.08 252)" }}>{t("learningPlayer.noModuleAvailable")}</h2>
              <p className="text-sm" style={{ color: "oklch(45% 0.02 240)" }}>{t("learningPlayer.modulesComingSoon")}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
