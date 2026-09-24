import {selectLearningEnrollment} from "../../../shared/learningEnrollment";
import LearningVideo from "@/components/LearningVideo";
import ExamAttemptHistory from "@/components/ExamAttemptHistory";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearch, Link } from "wouter";
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
import { createExamCountdown } from "@/lib/examCountdown";

// ─── Quiz Component ───────────────────────────────────────────────────────────
function QuizView({
  questions: initialQuestions,
  enrollmentId,
  trainingId,
  moduleId,
  attemptNumber,
  passingScore,
  maxAttempts,
  onComplete,
  onActiveChange,
}: {
  questions: any[];
  enrollmentId: number;
  trainingId: number;
  moduleId?: number;
  attemptNumber: number;
  passingScore: number;
  maxAttempts: number;
  onComplete: (result: any) => void;
  onActiveChange: (active: boolean) => void;
}) {
  const { t } = useI18n();
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [attempt, setAttempt] = useState(attemptNumber);
  const [serverAttempt, setServerAttempt] = useState(attemptNumber);
  const [sessionPassingScore, setSessionPassingScore] = useState(passingScore);
  const [startRetry, setStartRetry] = useState(0);
  const [questions, setQuestions] = useState<any[]>(initialQuestions);
  const [startError, setStartError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const countdown = useRef<(() => number) | null>(null);
  const [tabSwitches, setTabSwitches] = useState(0);
  const submittedRef = useRef(false);
  const submissionAnswers = useRef<Record<string, any> | null>(null);
  const expirySubmitted = useRef(false);
  const [submissionStarted, setSubmissionStarted] = useState(false);
  const [submissionError, setSubmissionError] = useState(false);
  const revisionRef = useRef(0);
  const savedFingerprint = useRef("{}");
  const currentSession = useRef<number | null>(null);
  const saveBusy = useRef(false);
  const [saveTick, setSaveTick] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const saveAnswers = trpc.learning.saveExamAnswers.useMutation();

  const startExam = trpc.learning.startExam.useMutation();
  const logEvent = trpc.learning.logProctoringEvent.useMutation();
  const submitQuiz = trpc.learning.submitQuiz.useMutation({
    onSuccess: (data) => {
      if (!data) { submittedRef.current = false; setSubmissionError(true); return; }
      submittedRef.current = true; setResult(data); setSubmitted(true); onComplete(data);
    },
    onError: () => { submittedRef.current = false; setSubmissionError(true); toast.error(t("learningPlayer.quizSubmitError")); },
  });

  const doSubmit = () => {
    if (submittedRef.current || !sessionId || submitQuiz.isPending) return;
    submittedRef.current = true;
    submissionAnswers.current ??= answers;
    setSubmissionStarted(true);
    setSubmissionError(false);
    submitQuiz.mutate({ enrollmentId, trainingId, answers: submissionAnswers.current, attemptNumber: serverAttempt, sessionId });
  };

  // Start (and restart on retry) the proctored exam session: random subset + server timer.
  useEffect(() => {
    let cancelled = false;
    submittedRef.current = false;
    submissionAnswers.current = null;
    expirySubmitted.current = false;
    setSubmissionStarted(false);
    setSubmissionError(false);
    setSessionId(null);
    countdown.current = null;
    setExpiresAt(null);
    setSecondsLeft(null);
    setStartError(null);
    (async () => {
      try {
        const r = await startExam.mutateAsync({ enrollmentId, trainingId, moduleId, attemptNumber: attempt });
        if (cancelled) return;
        if (!r) { setStartError(t("learningPlayer.examStartUnavailable")); return; }
        setServerAttempt(r.attemptNumber);
        setSessionPassingScore(r.passingScore);
        currentSession.current = r.sessionId;
        revisionRef.current = r.answerRevision;
        savedFingerprint.current = JSON.stringify(r.savedAnswers);
        setAnswers(r.savedAnswers);
        setSaveStatus("saved");
        if (r.sessionId) setSessionId(r.sessionId);
        setQuestions(r.questions?.length ? r.questions : initialQuestions);
        const deadline = r.expiresAt ? new Date(r.expiresAt).getTime() : null;
        countdown.current = deadline == null ? null : createExamCountdown(deadline, r.serverNow);
        setExpiresAt(deadline);
        if (r.completed) {
          submittedRef.current = true; submissionAnswers.current = {}; setSubmissionStarted(true);
          submitQuiz.mutate({ enrollmentId, trainingId, sessionId: r.sessionId, answers: {} });
        }
      } catch (error) { if (!cancelled) setStartError(error instanceof Error ? error.message : t("learningPlayer.quizSubmitError")); }
    })();
    return () => { cancelled = true; currentSession.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, startRetry]);

  // Serialize saves; a compare-and-set revision detects edits from another browser tab.
  useEffect(() => {
    if (!sessionId || submitted || submissionStarted || submittedRef.current || saveBusy.current) return;
    const fingerprint = JSON.stringify(answers);
    if (fingerprint === savedFingerprint.current) return;
    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      if (submittedRef.current || submissionAnswers.current) return;
      saveBusy.current = true;
      try {
        const saved = await saveAnswers.mutateAsync({ sessionId, revision: revisionRef.current, answers });
        if (currentSession.current === sessionId) {
          revisionRef.current = saved.revision;
          savedFingerprint.current = fingerprint;
          setSaveStatus("saved");
          setSaveTick(n => n + 1);
        }
      } catch { if (currentSession.current === sessionId) setSaveStatus("error"); }
      finally { saveBusy.current = false; }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, sessionId, submitted, submissionStarted, saveTick]);

  // Countdown + auto-submit at expiry.
  useEffect(() => {
    if (!expiresAt || submitted || !countdown.current) return;
    const tick = () => {
      if (!countdown.current) return;
      const left = countdown.current();
      setSecondsLeft(left);
      if (left <= 0 && !expirySubmitted.current) { expirySubmitted.current = true; doSubmit(); }
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

  // Navigation never pauses the server timer, even when the latest answers were saved.
  useEffect(() => {
    const active = !submitted && !startError;
    onActiveChange(active);
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    if (active) window.addEventListener('beforeunload', beforeUnload);
    return () => { onActiveChange(false); window.removeEventListener('beforeunload', beforeUnload); };
  }, [submitted, startError, onActiveChange]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const answerLocked = submitted || submissionStarted || (secondsLeft !== null && secondsLeft <= 0);

  const toggleAnswer = (questionId: number, optionIndex: number, type: string) => {
    if (answerLocked) return;
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

  if (startError) return <div className="p-6 rounded-xl border border-destructive/30 space-y-4">
    <p role="alert" className="text-destructive">{startError}</p>
    <p className="text-sm">{t('learningPlayer.examStartRetryInfo')}</p>
    <Button disabled={startExam.isPending} onClick={() => { setStartError(null); setStartRetry(value => value + 1); }}>{t('learningPlayer.save.retry')}</Button>
  </div>;
  if (!sessionId) return <p role="status" className="p-6">{t("common.loading")}</p>;

  if (submitted && result) {
    return (
      <div className="text-center py-10">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${result.isPassed ? "bg-success/10" : "bg-destructive/10"}`}>
          {result.isPassed
            ? <Trophy className="w-10 h-10 text-success" />
            : <AlertCircle className="w-10 h-10 text-destructive" />}
        </div>
        <h2 className="font-sans text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
          {result.isPassed ? t("learningPlayer.congratulations") : result.expired ? t("learningPlayer.examExpired") : t("learningPlayer.insufficientScore")}
        </h2>
        <p className="text-lg font-semibold mb-1" style={{ color: result.isPassed ? "var(--success)" : "var(--destructive)" }}>
          {t("learningPlayer.scoreSummary", { percentage: result.percentage, score: result.score, maxScore: result.maxScore })}
        </p>
        <p className="text-sm mb-6" style={{ color: "var(--muted-foreground)" }}>
          {t("learningPlayer.minimumScoreRequired", { score: result.passingScore })}
        </p>
        {result.isPassed ? (
          <p className="text-sm font-medium" style={{ color: "var(--success)" }}>
            {moduleId ? t("learningPlayer.chapterPassed") : t("learningPlayer.trainingValidated")}
          </p>
        ) : serverAttempt < maxAttempts ? (
          <Button onClick={() => { setSubmitted(false); setResult(null); setAnswers({}); setSessionId(null); setExpiresAt(null); setSecondsLeft(null); setAttempt((a) => a + 1); }} variant="outline">
            <RotateCcw className="w-4 h-4 mr-2" /> {t("learningPlayer.retryAttempt", { current: serverAttempt + 1, max: maxAttempts })}
          </Button>
        ) : (
          <p className="text-sm" style={{ color: "var(--destructive)" }}>
            {t("learningPlayer.maxAttemptsReached", { max: maxAttempts })}
          </p>
        )}

        {result.feedbackAvailable === false && <p role="status" className="mt-6 text-sm">{t("learningPlayer.historicalFeedbackUnavailable")}</p>}
        {/* Feedback per question */}
        <div className="mt-8 text-left space-y-4 max-w-2xl mx-auto">
          {result.feedback?.map((fb: any, i: number) => {
            const q = questions.find((q) => q.id === fb.questionId);
            if (!q) return null;
            return (
              <div key={fb.questionId} className="rounded-lg p-4" style={{ background: fb.isCorrect ? "color-mix(in srgb, var(--success) 8%, transparent)" : "color-mix(in srgb, var(--destructive) 8%, transparent)", border: `1px solid ${fb.isCorrect ? "color-mix(in srgb, var(--success) 30%, transparent)" : "color-mix(in srgb, var(--destructive) 30%, transparent)"}` }}>
                <div className="flex items-start gap-2 mb-1">
                  {fb.isCorrect ? <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />}
                  <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{q.question}</span>
                </div>
                {fb.explanation && <p className="text-xs ml-6" style={{ color: "var(--muted-foreground)" }}>{fb.explanation}</p>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!submissionStarted && <div role="status" className={`text-sm flex items-center gap-3 ${saveStatus === "error" ? "text-destructive" : "text-muted-foreground"}`}>
        {t(`learningPlayer.save.${saveStatus}`)}
        {saveStatus === "error" && !submissionStarted && <button className="underline" onClick={() => setSaveTick(n => n + 1)}>{t("learningPlayer.save.retry")}</button>}
      </div>}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-semibold text-lg" style={{ color: "var(--foreground)" }}>
          {t("learningPlayer.assessmentHeader", { count: questions.length })}
        </h2>
        <div className="flex items-center gap-3">
          {secondsLeft !== null && (
            <span className="inline-flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-full" style={{ background: secondsLeft <= 60 ? "color-mix(in srgb, var(--destructive) 12%, transparent)" : "color-mix(in srgb, var(--link) 12%, transparent)", color: secondsLeft <= 60 ? "var(--destructive)" : "var(--link)" }}>
              <Clock className="w-3.5 h-3.5" /> {fmt(secondsLeft)}
            </span>
          )}
          <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            {t("learningPlayer.scoreRequiredAttempt", { score: sessionPassingScore, attempt: serverAttempt, max: maxAttempts })}
          </span>
        </div>
      </div>
      {tabSwitches > 0 && (
        <div className="text-xs rounded-lg px-3 py-2 mb-2" style={{ background: "color-mix(in srgb, var(--destructive) 8%, transparent)", color: "var(--destructive)" }}>
          {t("learningPlayer.proctoringWarning", { count: tabSwitches })}
        </div>
      )}

      {questions.map((q, qi) => {
        const opts = (q.options as string[]) ?? [];
        const qid = String(q.id);
        return (
          <div key={q.id} className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-start gap-2 mb-4">
              <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "var(--surface-strong)", color: "var(--foreground)" }}>
                Q{qi + 1}
              </span>
              <p className="font-medium text-sm" style={{ color: "var(--foreground)" }}>{q.question}</p>
            </div>
            {q.type === "free_text" ? (
              <textarea
                value={typeof answers[qid] === "string" ? answers[qid] : ""}
                disabled={answerLocked}
                onChange={(e) => { if (!answerLocked) setAnswers((p) => ({ ...p, [qid]: e.target.value })); }}
                placeholder={t("learningPlayer.freeTextPlaceholder")}
                className="w-full rounded-lg border px-4 py-3 text-sm h-24 resize-y" style={{ borderColor: "var(--border)" }}
              />
            ) : q.type === "matching" ? (
              <div className="space-y-2">
                {opts.map((left, li) => {
                  const pairs: number[][] = Array.isArray(answers[qid]) ? answers[qid] : [];
                  const cur = pairs.find((p) => p[0] === li)?.[1];
                  return (
                    <div key={li} className="flex items-center gap-2">
                      <span className="text-sm flex-1 min-w-0" style={{ color: "var(--foreground)" }}>{left}</span>
                      <span style={{ color: "var(--muted-foreground)" }}>→</span>
                      <select value={cur ?? ""} disabled={answerLocked}
                        onChange={(e) => setAnswers((p) => {
                          const others = (Array.isArray(p[qid]) ? p[qid] : []).filter((x: number[]) => x[0] !== li);
                          return { ...p, [qid]: e.target.value === "" ? others : [...others, [li, Number(e.target.value)]] };
                        })}
                        className="h-9 rounded-md border px-2 text-sm flex-1 min-w-0" style={{ borderColor: "var(--border)" }}>
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
                    <button key={oi} type="button" disabled={answerLocked} aria-pressed={isSelected} onClick={() => toggleAnswer(q.id, oi, q.type)}
                      className="w-full text-left rounded-lg px-4 py-3 text-sm transition-all"
                      style={{ background: isSelected ? "color-mix(in srgb, var(--link) 8%, transparent)" : "var(--background)", border: `1px solid ${isSelected ? "var(--border)" : "var(--border)"}`, color: "var(--foreground)" }}>
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

      {submissionError && <p role="alert" className="text-sm text-destructive">{t('learningPlayer.submissionUnconfirmed')}</p>}
      <div className="flex justify-end pt-4">
        <Button
          size="lg"
          onClick={doSubmit}
          disabled={(!submissionStarted && !allAnswered) || submitQuiz.isPending}
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {submitQuiz.isPending ? t("learningPlayer.grading") : submissionStarted ? t("learningPlayer.save.retry") : t("learningPlayer.submitAnswers")}
        </Button>
      </div>
    </div>
  );
}

function LearningLoadState({ failed = false, busy = false, retry }: { failed?: boolean; busy?: boolean; retry?: () => void }) {
  const { t } = useI18n();
  return <div className="p-8 flex flex-col items-center justify-center gap-4">
    <p role={failed ? 'alert' : 'status'}>{t(failed ? 'learningPlayer.loadError' : 'common.loading')}</p>
    {failed && retry && <Button onClick={retry} disabled={busy}>{t(busy ? 'common.loading' : 'learningPlayer.save.retry')}</Button>}
  </div>;
}

function ExamEntry({ attempts, timeLimitMin, historyError, historyLoading, retryHistory, ...quiz }: Parameters<typeof QuizView>[0] & {
  attempts: Parameters<typeof ExamAttemptHistory>[0]['attempts']; timeLimitMin: number | null;
  historyError: boolean; historyLoading: boolean; retryHistory: () => void;
}) {
  const { t } = useI18n();
  const [started, setStarted] = useState(false);
  if (started) return <QuizView {...quiz} />;
  const remaining = Math.max(0, quiz.maxAttempts - attempts.length);
  return <section className="space-y-4">
    <h2 className="text-xl font-semibold">{t('examEntry.title')}</h2>
    <p>{t('learningPlayer.minimumScoreRequired', {score: quiz.passingScore})}</p>
    <p>{timeLimitMin ? t('examEntry.duration', {minutes: timeLimitMin}) : t('examEntry.untimed')}</p>
    <p>{t('examEntry.remaining', {remaining, max: quiz.maxAttempts})}</p>
    <p className="text-sm text-muted-foreground">{t('examEntry.timerInfo')}</p>
    {historyError ? <div role="alert" className="space-y-2">
      <p>{t('examEntry.readError')}</p>
      <Button variant="outline" disabled={historyLoading} onClick={retryHistory}>{t('learningPlayer.save.retry')}</Button>
    </div> : <>
      {historyLoading && <p role="status">{t('common.loading')}</p>}
      {remaining > 0 ? <Button disabled={historyLoading} onClick={() => setStarted(true)}>{t('examEntry.start')}</Button> : <p>{t('learningPlayer.maxAttemptsReached', {max: quiz.maxAttempts})}</p>}
      <ExamAttemptHistory attempts={attempts} title={quiz.moduleId == null ? t('examHistory.finalTitle') : undefined} />
    </>}
  </section>;
}

// ─── Main Player ──────────────────────────────────────────────────────────────
function ChapterAssessment({ enrollmentId, trainingId, moduleId, passingScore, maxAttempts, timeLimitMin, onPassed, onActiveChange }: {
  enrollmentId: number; trainingId: number; moduleId: number; passingScore: number; maxAttempts: number; timeLimitMin: number | null; onPassed: () => void; onActiveChange: (active: boolean) => void;
}) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const questions = trpc.learning.quizQuestions.useQuery({ trainingId, moduleId, enrollmentId });
  const attempts = trpc.learning.quizAttempts.useQuery({ enrollmentId, moduleId });
  if (questions.data === undefined || attempts.data === undefined) return <LearningLoadState failed={questions.isError || attempts.isError} busy={questions.isFetching || attempts.isFetching} retry={() => { void questions.refetch(); void attempts.refetch(); }} />;
  const refreshFailed = questions.isError || attempts.isError;
  const refreshBusy = questions.isFetching || attempts.isFetching;
  const retry = () => { void questions.refetch(); void attempts.refetch(); };
  const refreshNotice = refreshFailed ? <div role="alert" className="bg-warning/10 p-3 mb-3 text-sm"><p>{t('learningPlayer.refreshFailed')}</p><Button variant="outline" disabled={refreshBusy} onClick={retry}>{t('learningPlayer.save.retry')}</Button></div> : null;
  if (attempts.data?.some(a => a.isPassed)) return <>{refreshNotice}<p className="text-success font-medium">{t("learningPlayer.chapterPassed")}</p><ExamAttemptHistory attempts={attempts.data} /></>;
  if (!questions.data?.length) return <>{refreshNotice}<p role="status" className="text-warning">{t("learningPlayer.chapterUnavailable")}</p></>;
  return <>{refreshNotice}<ExamEntry attempts={attempts.data} timeLimitMin={timeLimitMin} historyError={refreshFailed} historyLoading={refreshBusy} retryHistory={retry} questions={questions.data} enrollmentId={enrollmentId} trainingId={trainingId} moduleId={moduleId}
    attemptNumber={(attempts.data?.length ?? 0) + 1} passingScore={passingScore} maxAttempts={maxAttempts} onActiveChange={onActiveChange}
    onComplete={result => { void attempts.refetch(); void utils.learning.objectiveProgress.invalidate({ enrollmentId }); if (result.isPassed) onPassed(); }} /></>;
}

export default function LearningPlayer() {
  const { slug } = useParams<{ slug: string }>();
  const search = useSearch();
  const { user } = useAuth();
  // A different course or account must not inherit a local result, answers or certificate request.
  return <LearningPlayerCourse key={`${user?.id ?? 'anonymous'}:${slug}:${search}`} slug={slug} search={search} />;
}

function LearningPlayerCourse({ slug, search }: { slug: string; search: string }) {
  const { t } = useI18n();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [activeModuleIdx, setActiveModuleIdx] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAttemptNumber, setQuizAttemptNumber] = useState(1);
  const [quizPassed, setQuizPassed] = useState(false);
  const examActive = useRef(false);
  const onExamActiveChange = useCallback((active: boolean) => { examActive.current = active; }, []);
  const confirmLeaveExam = () => !examActive.current || window.confirm(t('learningPlayer.leaveExamWarning'));
  const navigateWithinCourse = (action: () => void) => { if (confirmLeaveExam()) action(); };
  const utils = trpc.useUtils();

  const enrollmentsQuery = trpc.dashboard.enrollments.useQuery(undefined, { enabled: isAuthenticated });
  const enrollments = enrollmentsQuery.data ?? [];
  const enrollment = selectLearningEnrollment(enrollments, slug, search);
  const training = enrollment?.training;

  const slideDataQuery = trpc.learning.slides.useQuery(
    { trainingId: training?.id ?? 0, enrollmentId: enrollment?.id },
    { enabled: !!training?.id }
  );
  const [slideFinished, setSlideFinished] = useState(false);

  const modulesQuery = trpc.learning.modules.useQuery(
    { trainingId: training?.id ?? 0, enrollmentId: enrollment?.id },
    { enabled: !!training?.id }
  );
  const modProgressQuery = trpc.learning.moduleProgress.useQuery(
    { enrollmentId: enrollment?.id ?? 0 },
    { enabled: !!enrollment?.id }
  );
  const questionsQuery = trpc.learning.quizQuestions.useQuery(
    { trainingId: training?.id ?? 0, enrollmentId: enrollment?.id },
    { enabled: !!training?.id }
  );
  const attemptsQuery = trpc.learning.quizAttempts.useQuery(
    { enrollmentId: enrollment?.id ?? 0 },
    { enabled: !!enrollment?.id }
  );
  const objectiveProgressQuery = trpc.learning.objectiveProgress.useQuery(
    { enrollmentId: enrollment?.id ?? 0 },
    { enabled: !!enrollment?.id }
  );

  const slideData = slideDataQuery.data ?? [];
  const modules = modulesQuery.data ?? [];
  const modProgress = modProgressQuery.data ?? [];
  const questions = questionsQuery.data ?? [];
  const attempts = attemptsQuery.data ?? [];
  const objectiveProgress = objectiveProgressQuery.data ?? [];

  const issueCert = trpc.learning.issueCertificate.useMutation({
    onSuccess: (data) => {
      if (data) toast.success(t("learningPlayer.certificateGenerated", { number: data.certificateNumber }));
      else toast.error(t("learningPlayer.certificateError"));
      utils.dashboard.certificates.invalidate();
    },
    onError: () => toast.error(t("learningPlayer.certificateError")),
  });
  const progressTarget=useRef(0);
  const updateProgress = trpc.dashboard.updateProgress.useMutation({
    onSuccess: () => { utils.dashboard.enrollments.invalidate(); },
  });

  // Slide-based course handlers
  const handleSlideEnter = (idx: number) => {
    if (!enrollment?.id || slideData.length === 0) return;
    const pct = Math.min(99, Math.round(((idx + 1) / slideData.length) * 100));
    if ((enrollment.progressPercent ?? 0) < pct) {
      progressTarget.current=Math.max(progressTarget.current,pct);
      updateProgress.mutate({ enrollmentId: enrollment.id, progressPercent: progressTarget.current, status: "in_progress" });
    }
  };
  const handleSlideFinish = () => {
    if (!enrollment?.id) return;
    progressTarget.current=100;
    updateProgress.mutate({ enrollmentId: enrollment.id, progressPercent: 100, status: "in_progress" });
    setSlideFinished(true);
  };

  const activeModule = modules[activeModuleIdx];
  const isModuleCompleted = (moduleId: number) => modProgress.some((p: any) => p.moduleId === moduleId && p.isCompleted);
  const completedCount = modules.filter((m: any) => isModuleCompleted(m.id)).length;
  const finalExamLocked = modules.some(m => m.isRequired !== false && !isModuleCompleted(m.id));
  const progressPercent = modules.length > 0 ? Math.round((completedCount / modules.length) * 100) : 0;

  const lastAttempt = attempts[0] as any;
  const attemptCount = attempts.length;
  const maxAttempts = training?.maxAttempts ?? 3;
  const canRetakeQuiz = attemptCount < maxAttempts && !quizPassed && !(lastAttempt?.isPassed);

  const handleQuizComplete = (result: any) => {
    void attemptsQuery.refetch();
    void utils.learning.objectiveProgress.invalidate({ enrollmentId: enrollment?.id ?? 0 });
    void utils.dashboard.enrollments.invalidate();
    void utils.dashboard.enrollment.invalidate();
    if (result.isPassed) {
      setQuizPassed(true);
      // Issue certificate
      if (enrollment?.id) {
        issueCert.mutate({ enrollmentId: enrollment.id });
      }
    } else {
      setQuizAttemptNumber((n) => n + 1);
    }
  };

  if (authLoading) return <LearningLoadState />;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="text-center">
          <Lock className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--link)" }} />
          <h2 className="font-sans text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>{t("learningPlayer.loginRequired")}</h2>
          <Link href="/catalogue"><Button style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>{t("learningPlayer.backToCatalogue")}</Button></Link>
        </div>
      </div>
    );
  }

  if (enrollmentsQuery.data === undefined) return <LearningLoadState failed={enrollmentsQuery.isError} retry={() => { void enrollmentsQuery.refetch(); }} busy={enrollmentsQuery.isFetching} />;

  if (!enrollment) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="text-center max-w-sm">
          <Lock className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--link)" }} />
          <h2 className="font-sans text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>{t("learningPlayer.accessDenied")}</h2>
          <p className="text-sm mb-4" style={{ color: "var(--muted-foreground)" }}>{t("learningPlayer.selectEnrollment")}</p>
          <Link href="/dashboard"><Button style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>{t("learningPlayer.myEnrollments")}</Button></Link>
        </div>
      </div>
    );
  }

  const courseQueries = [enrollmentsQuery, slideDataQuery, modulesQuery, modProgressQuery, questionsQuery, attemptsQuery, objectiveProgressQuery];
  const missingQueries = courseQueries.filter(query => query.data === undefined);
  if (missingQueries.length) return <LearningLoadState failed={missingQueries.some(query => query.isError)} busy={missingQueries.some(query => query.isFetching)} retry={() => { for (const query of missingQueries) void query.refetch(); }} />;

  const failedRefreshes = courseQueries.filter(query => query.isError);
  const refreshNotice = failedRefreshes.length > 0 ? <div role="alert" className="border-b bg-warning/10 p-4 flex flex-wrap items-center gap-3 text-sm">
    <p>{t('learningPlayer.refreshFailed')}</p>
    <Button variant="outline" disabled={failedRefreshes.some(query => query.isFetching)} onClick={() => { for (const query of failedRefreshes) void query.refetch(); }}>{t('learningPlayer.save.retry')}</Button>
  </div> : null;

  const progressNotice=updateProgress.isError?<div role="alert" className="bg-warning/10 border-b p-4 text-sm flex flex-wrap items-center gap-3">
    <p>{t("learningPlayer.progressUnconfirmed")}</p>
    <Button variant="outline" disabled={updateProgress.isPending} onClick={()=>updateProgress.mutate({enrollmentId:enrollment.id,progressPercent:progressTarget.current,status:"in_progress"})}>{t("learningPlayer.save.retry")}</Button>
  </div>:null;

  const certificateActions = <div className="space-y-4 my-6 text-center">
    <p role={issueCert.isError || (issueCert.isSuccess && !issueCert.data) ? 'alert' : 'status'}>
      {issueCert.isPending ? t('learningPlayer.certificatePreparing')
        : issueCert.data ? t('learningPlayer.certificateRecorded', { number: issueCert.data.certificateNumber })
        : issueCert.error?.data?.code === 'PRECONDITION_FAILED' ? issueCert.error.message
        : issueCert.isError || issueCert.isSuccess ? t('learningPlayer.certificateRetryInfo')
        : t('learningPlayer.certificateRequestInfo')}
    </p>
    {!issueCert.data && <Button disabled={issueCert.isPending} onClick={() => issueCert.mutate({ enrollmentId: enrollment.id })}>
      {t(issueCert.isPending ? 'common.loading' : issueCert.isError || issueCert.isSuccess ? 'learningPlayer.save.retry' : 'learningPlayer.certificateRequest')}
    </Button>}
    <div><Link href="/dashboard" onClick={event => { if (!confirmLeaveExam()) event.preventDefault(); }}><Button variant="outline">{t('learningPlayer.mySpace')}</Button></Link></div>
  </div>;

  // ── Slide-based course (built with the AI maker) ──
  if (slideData.length > 0 && modules.length === 0) {
    const deck: DeckSlide[] = (slideData as any[]).map((s) => ({
      id: s.id, title: s.title, body: s.body, imageUrl: s.imageUrl, videoUrl: s.videoUrl, audioUrl: s.audioUrl, videoCues: s.videoCues,
      quizQuestion: s.quizQuestion, quizOptions: s.quizOptions, quizCorrect: s.quizCorrect, quizExplanation: s.quizExplanation,
    }));
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
        <div className="flex items-center h-12 px-4 shrink-0" style={{ background: "var(--surface-strong)" }}>
          <Link href="/dashboard" onClick={event => { if (!confirmLeaveExam()) event.preventDefault(); }}>
            <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-white transition-colors">
              <ChevronLeft className="w-4 h-4" /> {t("learningPlayer.mySpace")}
            </button>
          </Link>
        </div>
        {refreshNotice}{progressNotice}
        <div className="flex-1 min-h-0">
          {(!slideFinished || quizPassed || lastAttempt?.isPassed) && <div className="max-w-3xl mx-auto px-6"><ExamAttemptHistory attempts={attempts} title={t("examHistory.finalTitle")} /></div>}
          {quizPassed || lastAttempt?.isPassed ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-sm px-6">
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "color-mix(in srgb, var(--success) 12%, transparent)" }}>
                  <Trophy className="w-10 h-10" style={{ color: "var(--success)" }} />
                </div>
                <h2 className="font-sans text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>{t("learningPlayer.trainingValidated")}</h2>
                {certificateActions}
              </div>
            </div>
          ) : slideFinished && questions.length > 0 ? (
            <div className="max-w-3xl mx-auto p-6">
              <ExamEntry attempts={attempts} timeLimitMin={training?.examTimeLimitMin ?? null} historyError={attemptsQuery.isError || questionsQuery.isError} historyLoading={attemptsQuery.isFetching || questionsQuery.isFetching} retryHistory={() => { void attemptsQuery.refetch(); void questionsQuery.refetch(); }} questions={questions} enrollmentId={enrollment.id} trainingId={enrollment.trainingId}
                attemptNumber={quizAttemptNumber} passingScore={training?.passingScore ?? 75}
                maxAttempts={maxAttempts} onComplete={handleQuizComplete} onActiveChange={onExamActiveChange} />
            </div>
          ) : slideFinished ? (
            <div className="max-w-xl mx-auto p-8 text-center space-y-4">
              <BookOpen className="w-12 h-12 mx-auto" />
              <p>{t("learningPlayer.assessmentUnavailable")}</p>
              <Link href="/dashboard" onClick={event => { if (!confirmLeaveExam()) event.preventDefault(); }}><Button>{t("learningPlayer.mySpace")}</Button></Link>
            </div>
          ) : (
            <SlideDeck contentLanguage={training?.language} slides={deck} title={training?.title} onSlideEnter={handleSlideEnter} onFinish={handleSlideFinish} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b" style={{ background: "var(--surface-strong)", borderColor: "color-mix(in srgb, var(--link) 20%, transparent)" }}>
        <div className="container flex flex-wrap gap-2 items-center justify-between min-h-14 py-2">
          <div className="flex items-center gap-3 min-w-0 max-w-full">
            <Link href="/dashboard" onClick={event => { if (!confirmLeaveExam()) event.preventDefault(); }}>
              <button className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground hover:text-white transition-colors">
                <ChevronLeft className="w-4 h-4" /> {t("learningPlayer.mySpace")}
              </button>
            </Link>
            <span className="text-muted-foreground">|</span>
            <span className="text-sm font-medium text-white truncate max-w-xs">{training?.title}</span>
            <span className="text-xs text-muted-foreground">{enrollment?.trainingVersionId ? t("curriculum.version", { version: training?.version ?? 1 }) : t("curriculum.legacy")}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{t("learningPlayer.percentCompleted", { percent: progressPercent })}</span>
            <div className="w-32 h-1.5 rounded-full" style={{ background: "color-mix(in srgb, var(--foreground) 15%, transparent)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${progressPercent}%`, background: "var(--primary)" }} />
            </div>
          </div>
        </div>
      </div>

      {refreshNotice}{progressNotice}
      <nav aria-label={t('learningPlayer.modulesLabel')} className="lg:hidden border-b bg-card p-4 space-y-3">
        <label htmlFor="learning-chapter" className="block text-sm font-medium">{t('learningPlayer.modulesLabel')}</label>
        <select id="learning-chapter" className="w-full min-w-0 rounded-md border p-3 bg-card text-sm" value={showQuiz ? 'exam' : String(activeModuleIdx)}
          onChange={event => {
            const value = event.target.value;
            navigateWithinCourse(() => {
              if (value === 'exam') { if (!finalExamLocked) setShowQuiz(true); }
              else { setActiveModuleIdx(Number(value)); setShowQuiz(false); }
            });
          }}>
          {modules.length === 0 && <option value="0">{t('learningPlayer.noModuleAvailable')}</option>}
          {modules.map((module, index) => <option key={module.id} value={String(index)}>
            {index + 1}. {module.title}{isModuleCompleted(module.id) ? ` — ${t('learningPlayer.moduleCompleted')}` : ''}
          </option>)}
          {questions.length > 0 && <option value="exam" disabled={finalExamLocked}>{t('learningPlayer.finalExam')}</option>}
        </select>
        {questions.length > 0 && <div className="space-y-2">
          <Button className="w-full" disabled={finalExamLocked || showQuiz} onClick={() => navigateWithinCourse(() => setShowQuiz(true))}>{t('learningPlayer.finalExam')}</Button>
          {finalExamLocked && <p className="text-sm text-muted-foreground">{t('learningPlayer.chapterRequired')}</p>}
        </div>}
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — module list */}
        <aside className="w-72 flex-shrink-0 border-r overflow-y-auto hidden lg:block" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="text-xs font-semibold tracking-wide mb-2" style={{ color: "var(--muted-foreground)" }}>{t("learningPlayer.modulesLabel")}</div>
            <Progress value={progressPercent} className="h-1.5" />
            <div className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>{t("learningPlayer.modulesCompletedCount", { completed: completedCount, total: modules.length })}</div>
          </div>
          <nav className="p-2">
            {modules.map((mod: any, idx: number) => {
              const completed = isModuleCompleted(mod.id);
              const isActive = idx === activeModuleIdx && !showQuiz;
              return (
                <button
                  key={mod.id}
                  onClick={() => navigateWithinCourse(() => { setActiveModuleIdx(idx); setShowQuiz(false); })}
                  className="w-full text-left rounded-lg px-3 py-3 mb-1 flex items-start gap-2 transition-all"
                  style={{
                    background: isActive ? "color-mix(in srgb, var(--link) 8%, transparent)" : "transparent",
                    border: isActive ? "1px solid color-mix(in srgb, var(--link) 15%, transparent)" : "1px solid transparent",
                  }}
                >
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: completed ? "color-mix(in srgb, var(--success) 18%, transparent)" : "var(--border)" }}>
                    {completed ? <CheckCircle className="w-3 h-3 text-white" /> : <span className="text-xs font-bold" style={{ color: "var(--muted-foreground)" }}>{idx + 1}</span>}
                  </div>
                  <div>
                    <div className="text-sm font-medium leading-snug" style={{ color: "var(--foreground)" }}>{mod.title}</div>
                    {mod.durationMinutes && <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{mod.durationMinutes} min</div>}
                  </div>
                </button>
              );
            })}
            {questions.length > 0 && (
              <button
                onClick={() => navigateWithinCourse(() => setShowQuiz(true))}
                disabled={finalExamLocked}
                title={t("learningPlayer.chapterRequired")}
                className="disabled:opacity-50 w-full text-left rounded-lg px-3 py-3 mb-1 flex items-start gap-2 transition-all"
                style={{
                  background: showQuiz ? "color-mix(in srgb, var(--link) 10%, transparent)" : "transparent",
                  border: showQuiz ? "1px solid color-mix(in srgb, var(--link) 30%, transparent)" : "1px solid transparent",
                }}
              >
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: lastAttempt?.isPassed ? "color-mix(in srgb, var(--success) 18%, transparent)" : "color-mix(in srgb, var(--link) 20%, transparent)" }}>
                  <Award className="w-3 h-3" style={{ color: lastAttempt?.isPassed ? "var(--foreground)" : "var(--link)" }} />
                </div>
                <div>
                  <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{t("learningPlayer.finalExam")}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{t("learningPlayer.questionsCount", { count: questions.length })}</div>
                </div>
              </button>
            )}
          </nav>
          {objectiveProgress.length > 0 && (
            <div className="p-4 border-t" style={{ borderColor: "var(--border)" }}>
              <div className="text-xs font-semibold tracking-wide mb-2" style={{ color: "var(--muted-foreground)" }}>{t("learningPlayer.part66Objectives")}</div>
              <div className="space-y-1.5">
                {objectiveProgress.map((o: any) => (
                  <div key={o.id} className="flex items-start gap-2">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: o.isCompleted ? "color-mix(in srgb, var(--success) 18%, transparent)" : "var(--border)" }}>
                      {o.isCompleted && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <div className="text-xs leading-snug" style={{ color: o.isCompleted ? "var(--foreground)" : "var(--muted-foreground)" }}>
                      {o.code ? <span style={{ color: "var(--link)" }}>{o.code} </span> : null}{o.title}
                      {o.unavailableQuestionCount > 0 && <p className="mt-1 text-muted-foreground">{t("learningPlayer.objectiveEvidenceUnavailable")}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-y-auto p-6 lg:p-10">
          {!showQuiz && <div className="max-w-3xl mx-auto"><ExamAttemptHistory attempts={attempts} title={t("examHistory.finalTitle")} /></div>}
          {showQuiz ? (
            <div className="max-w-3xl mx-auto">
              {lastAttempt?.isPassed ? (
                <div className="text-center py-10">
                  <Trophy className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--link)" }} />
                  <h2 className="font-sans text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>{t("learningPlayer.trainingValidated")}</h2>
                  <p className="text-sm mb-6" style={{ color: "var(--muted-foreground)" }}>{t("learningPlayer.examPassedScore", { score: lastAttempt.score, maxScore: lastAttempt.maxScore })}</p>
                  {certificateActions}
                </div>
              ) : (
                <ExamEntry
                  attempts={attempts} timeLimitMin={training?.examTimeLimitMin ?? null} historyError={attemptsQuery.isError || questionsQuery.isError} historyLoading={attemptsQuery.isFetching || questionsQuery.isFetching} retryHistory={() => { void attemptsQuery.refetch(); void questionsQuery.refetch(); }}
                  questions={questions as any}
                  enrollmentId={enrollment.id}
                  trainingId={training?.id ?? 0}
                  attemptNumber={quizAttemptNumber}
                  passingScore={training?.passingScore ?? 75}
                  maxAttempts={maxAttempts}
                  onComplete={handleQuizComplete}
                  onActiveChange={onExamActiveChange}
                />
              )}
              {lastAttempt?.isPassed && <ExamAttemptHistory attempts={attempts} title={t("examHistory.finalTitle")} />}
              {quizPassed && !lastAttempt?.isPassed && certificateActions}
            </div>
          ) : activeModule ? (
            <div className="max-w-3xl mx-auto">
              {/* Module header */}
              <div className="mb-6">
                <div className="text-xs font-semibold tracking-wide mb-1" style={{ color: "var(--link)" }}>
                  {t("learningPlayer.moduleCounter", { current: activeModuleIdx + 1, total: modules.length })}
                </div>
                <h1 className="font-sans text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>{activeModule.title}</h1>
                {activeModule.durationMinutes && (
                  <div className="flex items-center gap-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
                    <Clock className="w-4 h-4" /> {t("learningPlayer.durationMinutes", { minutes: activeModule.durationMinutes })}
                  </div>
                )}
              </div>

              {slideData.some(s => s.moduleId === activeModule.id || (s.moduleId == null && activeModuleIdx === 0)) && <div className="mb-6 border rounded-xl overflow-hidden">
                <SlideDeck contentLanguage={training?.language} key={activeModule.id} title={activeModule.title} slides={slideData.filter(s => s.moduleId === activeModule.id || (s.moduleId == null && activeModuleIdx === 0)).map(s => ({ id: s.id, title: s.title, body: s.body, imageUrl: s.imageUrl, videoUrl: s.videoUrl, audioUrl: s.audioUrl, videoCues: s.videoCues, quizQuestion: s.quizQuestion, quizOptions: s.quizOptions, quizCorrect: s.quizCorrect, quizExplanation: s.quizExplanation }))} />
              </div>}
              {/* Module content */}
              <div className="rounded-xl p-6 mb-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                {activeModule.description && (
                  <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--muted-foreground)" }}>{activeModule.description}</p>
                )}
                {activeModule.content ? (
                  <div className="prose prose-sm max-w-none" style={{ color: "var(--foreground)" }}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{activeModule.content}</p>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <BookOpen className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--link)" }} />
                    <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                      {t("learningPlayer.moduleContentPending")}
                    </p>
                  </div>
                )}
                {activeModule.videoUrl && (
                  <div className="mt-4 rounded-lg overflow-hidden">
                    <LearningVideo key={activeModule.videoUrl} src={activeModule.videoUrl} controls className="w-full aspect-video bg-black" />
                  </div>
                )}
                {activeModule.pdfUrl && (
                  <a href={activeModule.pdfUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-medium" style={{ color: "var(--info)" }}>
                    <BookOpen className="w-4 h-4" /> {t("learningPlayer.downloadPdf")}
                  </a>
                )}
              </div>

              <section className="rounded-xl border bg-card p-6 mb-6">
                <h2 className="font-sans text-lg font-semibold mb-4">{t("learningPlayer.chapterQuiz")}</h2>
                <ChapterAssessment key={activeModule.id} enrollmentId={enrollment.id} trainingId={enrollment.trainingId} moduleId={activeModule.id}
                  passingScore={activeModule.quizPassingScore} maxAttempts={activeModule.quizMaxAttempts} timeLimitMin={activeModule.quizTimeLimitMin} onActiveChange={onExamActiveChange}
                  onPassed={() => { void utils.learning.moduleProgress.invalidate({ enrollmentId: enrollment.id }); void utils.dashboard.enrollment.invalidate(); void utils.dashboard.enrollments.invalidate(); }} />
              </section>
              {/* Navigation */}
              <div className="flex flex-wrap gap-4 items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => navigateWithinCourse(() => setActiveModuleIdx(Math.max(0, activeModuleIdx - 1)))}
                  disabled={activeModuleIdx === 0}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> {t("learningPlayer.previous")}
                </Button>

                {isModuleCompleted(activeModule.id) ? (
                  <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--success)" }}>
                    <CheckCircle className="w-4 h-4" /> {t("learningPlayer.moduleCompleted")}
                  </div>
                ) : <span className="text-sm text-muted-foreground">{t("learningPlayer.chapterRequired")}</span>}

                {activeModuleIdx < modules.length - 1 && (
                  <Button
                    variant="outline"
                    onClick={() => navigateWithinCourse(() => setActiveModuleIdx(activeModuleIdx + 1))}
                  >
                    {t("learningPlayer.next")} <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
                {activeModuleIdx === modules.length - 1 && questions.length > 0 && <Button disabled={finalExamLocked} onClick={() => navigateWithinCourse(() => setShowQuiz(true))}>
                  {t('learningPlayer.finalExam')} <Award aria-hidden="true" className="w-4 h-4 ms-1" />
                </Button>}
              </div>
            </div>
          ) : (
            <div className="text-center py-20">
              <PlayCircle className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--link)" }} />
              <h2 className="font-sans text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>{t("learningPlayer.noModuleAvailable")}</h2>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("learningPlayer.modulesComingSoon")}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
