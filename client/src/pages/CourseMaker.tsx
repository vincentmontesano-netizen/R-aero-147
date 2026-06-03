import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SlideDeck, { type DeckSlide } from "@/components/SlideDeck";
import {
  Sparkles, Plus, Wand2, Image as ImageIcon, Mic, Pencil, Trash2, ChevronUp, ChevronDown,
  Eye, ArrowLeft, Loader2, BookOpen, XCircle, Languages, Check, GraduationCap, FileQuestion,
} from "lucide-react";
import { toast } from "sonner";

const DEEP_BLUE = "oklch(19% 0.08 252)";
const GOLD = "oklch(68% 0.1 78)";
const IVORY = "oklch(97% 0.01 88)";
const MUTED = "oklch(45% 0.02 240)";
const BORDER = "oklch(88% 0.015 88)";

type Provider = "openai" | "anthropic" | "google" | "mistral";
const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export default function CourseMaker() {
  const { user, loading } = useAuth();
  const { t, lang } = useI18n();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/maker/:trainingId");
  const utils = trpc.useUtils();

  const routeId = params?.trainingId ? Number(params.trainingId) : null;
  const [trainingId, setTrainingId] = useState<number | null>(routeId);
  useEffect(() => { if (routeId) setTrainingId(routeId); }, [routeId]);

  const { data: providers } = trpc.ai.providers.useQuery(undefined, { enabled: !!user && (user.role === "admin" || user.role === "instructor" || user.role === "company_manager") });
  const textProviders = useMemo(() => {
    if (!providers) return [] as Provider[];
    return (Object.keys(providers) as Provider[]).filter((p) => (providers as any)[p].text);
  }, [providers]);
  const [provider, setProvider] = useState<Provider>("openai");
  useEffect(() => { if (textProviders.length && !textProviders.includes(provider)) setProvider(textProviders[0]); }, [textProviders]);
  const aiReady = textProviders.length > 0;

  const coursesQuery = trpc.maker.courses.useQuery(undefined, { enabled: !!user && (user.role === "admin" || user.role === "instructor" || user.role === "company_manager") });
  const courses = coursesQuery.data ?? [];
  const slidesQuery = trpc.maker.slides.useQuery({ trainingId: trainingId! }, { enabled: trainingId != null });
  const slides = (slidesQuery.data ?? []) as any[];
  const course = courses.find((c: any) => c.id === trainingId);

  const [newOpen, setNewOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [editSlide, setEditSlide] = useState<any | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const refetchSlides = () => { if (trainingId != null) utils.maker.slides.invalidate({ trainingId }); };

  const createSlide = trpc.maker.createSlide.useMutation({ onSuccess: () => { toast.success(t("courseMaker.slideAdded")); refetchSlides(); } });
  const deleteSlide = trpc.maker.deleteSlide.useMutation({ onSuccess: () => { toast.success(t("common.delete")); refetchSlides(); } });
  const reorder = trpc.maker.reorderSlides.useMutation({ onSuccess: refetchSlides });
  const publish = trpc.maker.publish.useMutation({ onSuccess: () => { toast.success(t("courseMaker.publishSaved")); utils.maker.courses.invalidate(); } });

  const move = (i: number, dir: -1 | 1) => {
    const arr = [...slides];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    reorder.mutate({ orderedIds: arr.map((s) => s.id) });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: IVORY }}><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!user || (user.role !== "admin" && user.role !== "instructor" && user.role !== "company_manager")) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: IVORY }}>
        <div className="text-center">
          <XCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "oklch(55% 0.22 27)" }} />
          <h2 className="font-serif text-2xl font-bold mb-2" style={{ color: DEEP_BLUE }}>403</h2>
          <p className="text-sm" style={{ color: MUTED }}>{t("courseMaker.forbidden")}</p>
          <Link href="/login"><Button className="mt-4" style={{ background: DEEP_BLUE, color: IVORY }}>{t("nav.login")}</Button></Link>
        </div>
      </div>
    );
  }

  const deckSlides: DeckSlide[] = slides.map((s) => ({
    id: s.id, title: s.title, body: s.body, imageUrl: s.imageUrl, videoUrl: s.videoUrl, audioUrl: s.audioUrl,
    quizQuestion: s.quizQuestion, quizOptions: s.quizOptions, quizCorrect: s.quizCorrect, quizExplanation: s.quizExplanation,
  }));

  return (
    <div className="min-h-screen" style={{ background: IVORY }}>
      {/* Header */}
      <div style={{ background: DEEP_BLUE }}>
        <div className="container py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6" style={{ color: GOLD }} />
            <div>
              <h1 className="font-serif text-xl font-bold text-white">{t("maker.title")}</h1>
              <p className="text-white/60 text-xs">{t("maker.subtitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Link href="/admin"><Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10"><ArrowLeft className="w-4 h-4 mr-1" /> Admin</Button></Link>
          </div>
        </div>
      </div>

      <div className="container py-6 grid lg:grid-cols-[300px_1fr] gap-6">
        {/* Left: course list */}
        <div>
          <div className="flex gap-2 mb-2">
            <Button size="sm" className="flex-1" variant="outline" onClick={() => setNewOpen(true)}><Plus className="w-4 h-4 mr-1" /> {t("maker.newCourse")}</Button>
            <Button size="sm" className="flex-1" disabled={!aiReady} onClick={() => setAiOpen(true)} style={{ background: GOLD, color: DEEP_BLUE }}><Wand2 className="w-4 h-4 mr-1" /> {t("maker.aiOutline")}</Button>
          </div>
          {!aiReady &&<p className="text-xs mb-3 p-2 rounded" style={{ background: "oklch(68% 0.1 78 / 0.12)", color: "oklch(45% 0.06 78)" }}>{t("maker.providerMissing")}</p>}
          <div className="text-xs font-semibold tracking-wide mb-2" style={{ color: MUTED }}>{t("maker.courses").toUpperCase()}</div>
          <div className="space-y-1.5">
            {courses.map((c: any) => (
              <button key={c.id} onClick={() => setTrainingId(c.id)} className="w-full text-left p-2.5 rounded-lg flex items-center gap-2 transition-colors"
                style={{ background: c.id === trainingId ? "white" : "transparent", border: `1px solid ${c.id === trainingId ? GOLD : "transparent"}` }}>
                <BookOpen className="w-4 h-4 shrink-0" style={{ color: c.id === trainingId ? GOLD : MUTED }} />
                <span className="flex-1 text-sm truncate" style={{ color: DEEP_BLUE }}>{c.title}</span>
                {c.reviewStatus === "needs_review" && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "oklch(55% 0.22 27 / 0.12)", color: "oklch(50% 0.22 27)" }}>{t("courseMaker.needsReview")}</span>}
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: c.isPublished ? "oklch(55% 0.18 145 / 0.12)" : "oklch(62% 0.02 240 / 0.12)", color: c.isPublished ? "oklch(45% 0.15 145)" : MUTED }}>
                  {c.isPublished ? t("maker.published") : t("maker.draft")}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Right: editor */}
        <div>
          {!course ? (
            <div className="rounded-xl p-12 text-center" style={{ background: "white", border: `1px solid ${BORDER}` }}>
              <GraduationCap className="w-10 h-10 mx-auto mb-3" style={{ color: GOLD }} />
              <p className="text-sm" style={{ color: MUTED }}>{t("maker.selectCourse")}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div>
                  <h2 className="font-serif text-xl font-bold" style={{ color: DEEP_BLUE }}>{course.title}</h2>
                  <span className="text-xs" style={{ color: MUTED }}>{slides.length} {t("maker.slides").toLowerCase()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={!slides.length} onClick={() => setPreviewOpen(true)}><Eye className="w-4 h-4 mr-1" /> {t("maker.preview")}</Button>
                  <Button size="sm" variant="outline" onClick={() => publish.mutate({ id: course.id, isPublished: !course.isPublished })}>
                    {course.isPublished ? t("maker.unpublish") : t("maker.publish")}
                  </Button>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {slides.length === 0 && <p className="text-sm p-6 text-center rounded-xl" style={{ background: "white", border: `1px solid ${BORDER}`, color: MUTED }}>{t("maker.noSlides")}</p>}
                {slides.map((s: any, i: number) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "white", border: `1px solid ${BORDER}` }}>
                    <div className="flex flex-col">
                      <button onClick={() => move(i, -1)} disabled={i === 0} className="text-muted-foreground disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                      <button onClick={() => move(i, 1)} disabled={i === slides.length - 1} className="text-muted-foreground disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                    </div>
                    <div className="w-12 h-12 rounded-lg shrink-0 overflow-hidden flex items-center justify-center" style={{ background: "oklch(93% 0.015 88)" }}>
                      {s.imageUrl ? <img src={s.imageUrl} className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5" style={{ color: "oklch(75% 0.02 240)" }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: DEEP_BLUE }}>{i + 1}. {s.title || "—"}</div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px]" style={{ color: MUTED }}>
                        {s.videoUrl && <span>🎬 video</span>}
                        {s.audioUrl && <span><Mic className="w-3 h-3 inline" /> audio</span>}
                        {s.quizQuestion && <span><FileQuestion className="w-3 h-3 inline" /> quiz</span>}
                      </div>
                    </div>
                    <button onClick={() => setEditSlide(s)} className="p-1.5 rounded hover:bg-black/5" style={{ color: MUTED }}><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => { if (confirm(t("courseMaker.confirmDeleteSlide"))) deleteSlide.mutate({ id: s.id }); }} className="p-1.5 rounded hover:bg-black/5 text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>

              <Button variant="outline" className="w-full" onClick={() => createSlide.mutate({ trainingId: course.id, sortOrder: slides.length + 1, title: "", body: "" })}>
                <Plus className="w-4 h-4 mr-1" /> {t("maker.addSlide")}
              </Button>
            </>
          )}
        </div>
      </div>

      {newOpen && <NewCourseDialog onClose={() => setNewOpen(false)} onCreated={(id) => { setNewOpen(false); setTrainingId(id); utils.maker.courses.invalidate(); }} />}
      {aiOpen && <AIGenerateDialog provider={provider} setProvider={setProvider} textProviders={textProviders} onClose={() => setAiOpen(false)} onCreated={(id) => { setAiOpen(false); setTrainingId(id); utils.maker.courses.invalidate(); }} />}
      {editSlide && <SlideEditorDialog slide={editSlide} provider={provider} providers={providers} lang={lang} onClose={() => setEditSlide(null)} onSaved={() => { setEditSlide(null); refetchSlides(); }} />}
      {previewOpen && (
        <Dialog open onOpenChange={(o) => !o && setPreviewOpen(false)}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden h-[85vh]">
            <SlideDeck slides={deckSlides} title={course?.title} finishLabel={t("maker.preview")} onFinish={() => setPreviewOpen(false)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ── Language toggle (reused) ──
function LanguageToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid oklch(68% 0.1 78 / 0.4)" }}>
      {(["en", "fr"] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)} className="px-2.5 py-1 text-xs font-semibold"
          style={{ background: lang === l ? GOLD : "transparent", color: lang === l ? DEEP_BLUE : "white" }}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// ── New (empty) course ──
function NewCourseDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const { t, lang } = useI18n();
  const [title, setTitle] = useState("");
  const create = trpc.maker.createCourse.useMutation({
    onSuccess: (r) => { toast.success(t("maker.courseCreated")); if (r?.trainingId) onCreated(r.trainingId); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t("maker.newCourse")}</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("maker.slideTitle")} />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={!title.trim() || create.isPending} onClick={() => create.mutate({ title, slug: slugify(title) + "-" + Date.now().toString(36), language: lang, slides: [] })} style={{ background: DEEP_BLUE, color: IVORY }}>
            {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("maker.create")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── AI outline → course ──
function AIGenerateDialog({ provider, setProvider, textProviders, onClose, onCreated }: {
  provider: Provider; setProvider: (p: Provider) => void; textProviders: Provider[]; onClose: () => void; onCreated: (id: number) => void;
}) {
  const { t, lang } = useI18n();
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [slideCount, setSlideCount] = useState(6);
  const [level, setLevel] = useState("intermediate");
  const [tone, setTone] = useState("technical");
  const [domain, setDomain] = useState("");
  const [objectives, setObjectives] = useState("");
  const [quizCoverage, setQuizCoverage] = useState<"none" | "some" | "all">("some");
  const [references, setReferences] = useState(true);
  const outline = trpc.ai.generateOutline.useMutation();
  const create = trpc.maker.createCourse.useMutation();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!topic.trim()) return toast.error(t("maker.topic"));
    setBusy(true);
    try {
      const res = await outline.mutateAsync({ provider, topic, audience, slideCount, language: lang, level, tone, domain: domain || undefined, objectives: objectives || undefined, quizCoverage, references });
      const created = await create.mutateAsync({
        title: res.title || topic,
        slug: slugify(res.title || topic) + "-" + Date.now().toString(36),
        description: res.description,
        language: lang,
        slides: (res.slides || []).map((s) => ({
          title: s.title, body: s.body, imagePrompt: s.imagePrompt,
          quizQuestion: s.quiz?.question, quizOptions: s.quiz?.options, quizCorrect: s.quiz?.correct, quizExplanation: s.quiz?.explanation,
        })),
      });
      toast.success(t("maker.courseCreated"));
      if (created?.trainingId) onCreated(created.trainingId);
    } catch (e: any) {
      toast.error(e.message || "AI error");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Wand2 className="w-4 h-4" style={{ color: GOLD }} /> {t("maker.aiOutline")}</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: MUTED }}>{t("maker.topic")} *</label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t("courseMaker.topicPlaceholder")} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: MUTED }}>{t("maker.audience")}</label>
            <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder={t("courseMaker.audiencePlaceholder")} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: MUTED }}>{t("courseMaker.domainLabel")}</label>
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder={t("courseMaker.domainPlaceholder")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: MUTED }}>{t("courseMaker.levelLabel")}</label>
              <select value={level} onChange={(e) => setLevel(e.target.value)} className="w-full h-9 rounded-md border px-3 text-sm" style={{ borderColor: BORDER }}>
                <option value="beginner">{t("courseMaker.levelBeginner")}</option>
                <option value="intermediate">{t("courseMaker.levelIntermediate")}</option>
                <option value="advanced">{t("courseMaker.levelAdvanced")}</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: MUTED }}>{t("courseMaker.toneLabel")}</label>
              <select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full h-9 rounded-md border px-3 text-sm" style={{ borderColor: BORDER }}>
                <option value="formal">{t("courseMaker.toneFormal")}</option>
                <option value="conversational">{t("courseMaker.toneConversational")}</option>
                <option value="technical">{t("courseMaker.toneTechnical")}</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: MUTED }}>{t("courseMaker.objectivesLabel")}</label>
            <textarea value={objectives} onChange={(e) => setObjectives(e.target.value)} placeholder={t("courseMaker.objectivesPlaceholder")} rows={3} className="w-full rounded-md border px-3 py-2 text-sm" style={{ borderColor: BORDER }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: MUTED }}>{t("maker.slideCount")}</label>
              <Input type="number" min={2} max={14} value={slideCount} onChange={(e) => setSlideCount(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: MUTED }}>{t("courseMaker.quizCoverageLabel")}</label>
              <select value={quizCoverage} onChange={(e) => setQuizCoverage(e.target.value as any)} className="w-full h-9 rounded-md border px-3 text-sm" style={{ borderColor: BORDER }}>
                <option value="none">{t("courseMaker.quizNone")}</option>
                <option value="some">{t("courseMaker.quizSome")}</option>
                <option value="all">{t("courseMaker.quizAll")}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 items-center">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: MUTED }}>{t("maker.provider")}</label>
              <select value={provider} onChange={(e) => setProvider(e.target.value as Provider)} className="w-full h-9 rounded-md border px-3 text-sm" style={{ borderColor: BORDER }}>
                {textProviders.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer mt-5" style={{ color: MUTED }}>
              <input type="checkbox" checked={references} onChange={(e) => setReferences(e.target.checked)} />
              <span>{t("courseMaker.referencesLabel")}</span>
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={busy} onClick={run} style={{ background: GOLD, color: DEEP_BLUE }}>
            {busy ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> {t("maker.generating")}</> : <><Sparkles className="w-4 h-4 mr-1" /> {t("common.generate")}</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Slide editor with AI assist ──
function SlideEditorDialog({ slide, provider, providers, lang, onClose, onSaved }: {
  slide: any; provider: Provider; providers: any; lang: string; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    title: slide.title ?? "", body: slide.body ?? "", imageUrl: slide.imageUrl ?? "", imagePrompt: slide.imagePrompt ?? "",
    videoUrl: slide.videoUrl ?? "", audioUrl: slide.audioUrl ?? "",
    objectiveId: (slide.objectiveId ?? "") as number | "",
    videoCues: (slide.videoCues ?? []) as any[],
    quizQuestion: slide.quizQuestion ?? "", quizOptions: (slide.quizOptions ?? ["", ""]) as string[],
    quizCorrect: (slide.quizCorrect ?? []) as number[], quizExplanation: slide.quizExplanation ?? "",
  });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const updateCue = (ci: number, patch: Record<string, any>) =>
    setForm((f) => ({ ...f, videoCues: f.videoCues.map((c, j) => (j === ci ? { ...c, ...patch } : c)) }));

  const update = trpc.maker.updateSlide.useMutation({ onSuccess: () => { toast.success(t("common.save")); onSaved(); }, onError: (e) => toast.error(e.message) });
  const objectivesQuery = trpc.maker.objectives.useQuery({ trainingId: slide.trainingId }, { enabled: !!slide.trainingId });
  const objectives = (objectivesQuery.data ?? []) as any[];
  const genText = trpc.ai.generateSlideText.useMutation();
  const genImage = trpc.ai.generateImage.useMutation();
  const genAudio = trpc.ai.generateAudio.useMutation();
  const genQuiz = trpc.ai.generateQuiz.useMutation();
  const canImage = providers && (providers.openai?.image || providers.google?.image || providers.mistral?.image);
  const canTTS = providers && (providers.openai?.tts || providers.google?.tts || providers.mistral?.tts);

  const writeText = async () => {
    try { const txt = await genText.mutateAsync({ provider, instruction: `Write the slide body about: ${form.title || "this topic"}`, language: lang }); set("body", txt); toast.success("✨"); }
    catch (e: any) { toast.error(e.message); }
  };
  const makeImage = async () => {
    try { const r = await genImage.mutateAsync({ prompt: form.imagePrompt || form.title || "aviation maintenance training", provider }); set("imageUrl", r.url); toast.success("✨"); }
    catch (e: any) { toast.error(e.message); }
  };
  const makeAudio = async () => {
    if (!form.body.trim()) return toast.error(t("maker.slideText"));
    try { const r = await genAudio.mutateAsync({ text: form.body, provider, language: lang }); set("audioUrl", r.url); toast.success("✨"); }
    catch (e: any) { toast.error(e.message); }
  };
  const makeQuiz = async () => {
    try {
      const q = await genQuiz.mutateAsync({ provider, content: form.body || form.title, language: lang });
      if (q) setForm((f) => ({ ...f, quizQuestion: q.question, quizOptions: q.options, quizCorrect: q.correct, quizExplanation: q.explanation }));
      toast.success("✨");
    } catch (e: any) { toast.error(e.message); }
  };

  const toggleCorrect = (i: number) => set("quizCorrect", form.quizCorrect.includes(i) ? form.quizCorrect.filter((x) => x !== i) : [...form.quizCorrect, i]);

  const save = () => update.mutate({
    id: slide.id, title: form.title, body: form.body, imageUrl: form.imageUrl, imagePrompt: form.imagePrompt,
    videoUrl: form.videoUrl, audioUrl: form.audioUrl,
    objectiveId: form.objectiveId === "" ? null : Number(form.objectiveId),
    videoCues: form.videoUrl ? form.videoCues.filter((c: any) => {
      const k = c.kind ?? "quiz";
      if (k === "branch") return (c.branches?.length ?? 0) > 0;
      if (k === "hotspot") return (c.hotspots?.length ?? 0) > 0;
      if (k === "dragdrop") return (c.dropZones?.length ?? 0) > 0 && (c.dragItems?.length ?? 0) > 0;
      return c.question && (c.options ?? []).filter(Boolean).length >= 2;
    }) : null,
    quizQuestion: form.quizQuestion || null, quizOptions: form.quizQuestion ? form.quizOptions.filter(Boolean) : null,
    quizCorrect: form.quizQuestion ? form.quizCorrect : null, quizExplanation: form.quizExplanation || null,
  });

  const busy = genText.isPending || genImage.isPending || genAudio.isPending || genQuiz.isPending;
  const lblCls = "text-xs font-medium mb-1 flex items-center justify-between";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t("maker.slideTitle")}</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <label className={lblCls} style={{ color: MUTED }}>{t("maker.slideTitle")}</label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          {objectives.length > 0 && (
            <div>
              <label className={lblCls} style={{ color: MUTED }}>{t("courseMaker.part66Objective")}</label>
              <select value={form.objectiveId} onChange={(e) => set("objectiveId", e.target.value === "" ? "" : Number(e.target.value))} className="w-full h-9 rounded-md border px-3 text-sm" style={{ borderColor: BORDER }}>
                <option value="">{t("courseMaker.none")}</option>
                {objectives.map((o) => <option key={o.id} value={o.id}>{o.code ? `${o.code} · ` : ""}{o.title}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className={lblCls} style={{ color: MUTED }}>
              <span>{t("maker.slideText")}</span>
              <button onClick={writeText} disabled={busy} className="flex items-center gap-1 text-xs" style={{ color: GOLD }}>
                {genText.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} {t("maker.genText")}
              </button>
            </label>
            <textarea value={form.body} onChange={(e) => set("body", e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm h-28 resize-y" style={{ borderColor: BORDER }} />
          </div>

          {/* Image */}
          <div className="rounded-lg p-3" style={{ background: "oklch(97% 0.01 88)", border: `1px solid ${BORDER}` }}>
            <label className={lblCls} style={{ color: MUTED }}>
              <span><ImageIcon className="w-3.5 h-3.5 inline mr-1" />{t("maker.image")}</span>
              <button onClick={makeImage} disabled={busy || !canImage} title={!canImage ? t("maker.providerMissing") : ""} className="flex items-center gap-1 text-xs disabled:opacity-40" style={{ color: GOLD }}>
                {genImage.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />} {t("maker.genImage")}
              </button>
            </label>
            {form.imageUrl && <img src={form.imageUrl} className="w-full max-h-48 object-cover rounded-md mb-2" />}
            <Input value={form.imagePrompt} onChange={(e) => set("imagePrompt", e.target.value)} placeholder={t("maker.imagePrompt")} className="mb-1" />
            <Input value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder={t("courseMaker.imageUrlPlaceholder")} />
          </div>

          {/* Video + audio */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={lblCls} style={{ color: MUTED }}>{t("maker.video")}</label>
              <Input value={form.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} placeholder="https://… .mp4" />
            </div>
            <div>
              <label className={lblCls} style={{ color: MUTED }}>
                <span><Mic className="w-3.5 h-3.5 inline mr-1" />{t("maker.audio")}</span>
                <button onClick={makeAudio} disabled={busy || !canTTS || !!form.videoUrl} title={!canTTS ? t("maker.providerMissing") : ""} className="flex items-center gap-1 text-xs disabled:opacity-40" style={{ color: GOLD }}>
                  {genAudio.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />} {t("maker.genAudio")}
                </button>
              </label>
              {form.audioUrl && <audio src={form.audioUrl} controls className="w-full h-8" />}
            </div>
          </div>
          {!form.videoUrl && <p className="text-[11px] -mt-2" style={{ color: MUTED }}>{t("maker.noVideoAudio")}</p>}

          {/* Interactive video: timeline quiz cues */}
          {form.videoUrl && (
            <div className="rounded-lg p-3" style={{ background: "oklch(97% 0.01 88)", border: `1px solid ${BORDER}` }}>
              <label className={lblCls} style={{ color: MUTED }}>
                <span><FileQuestion className="w-3.5 h-3.5 inline mr-1" />{t("courseMaker.videoQuiz")}</span>
                <button onClick={() => set("videoCues", [...form.videoCues, { atSeconds: 10, question: "", options: ["", ""], correct: [0] }])} className="flex items-center gap-1 text-xs" style={{ color: GOLD }}>
                  <Plus className="w-3 h-3" /> {t("courseMaker.addCuePoint")}
                </button>
              </label>
              {form.videoCues.length === 0 && <p className="text-[11px]" style={{ color: MUTED }}>{t("courseMaker.videoCueHint")}</p>}
              <div className="space-y-3">
                {form.videoCues.map((cue, ci) => (
                  <div key={ci} className="rounded-md border p-2" style={{ borderColor: BORDER, background: "white" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px]" style={{ color: MUTED }}>{t("courseMaker.atTime")}</span>
                      <Input type="number" value={cue.atSeconds} onChange={(e) => updateCue(ci, { atSeconds: Number(e.target.value) })} className="w-16 h-7" />
                      <span className="text-[11px]" style={{ color: MUTED }}>{t("courseMaker.secondsAbbr")}</span>
                      <select value={cue.kind ?? "quiz"} onChange={(e) => updateCue(ci, { kind: e.target.value })} className="h-7 rounded border px-1 text-xs" style={{ borderColor: BORDER }}>
                        <option value="quiz">{t("courseMaker.cueQuiz")}</option>
                        <option value="branch">{t("courseMaker.cueBranch")}</option>
                        <option value="hotspot">{t("courseMaker.cueHotspot")}</option>
                        <option value="dragdrop">{t("courseMaker.cueDragDrop")}</option>
                      </select>
                      <button onClick={() => set("videoCues", form.videoCues.filter((_, j) => j !== ci))} className="ml-auto text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <Input value={cue.question ?? ""} onChange={(e) => updateCue(ci, { question: e.target.value })} placeholder={t("courseMaker.cueQuestionPlaceholder")} className="mb-1 h-8" />

                    {(cue.kind ?? "quiz") === "quiz" && (<>
                      {(cue.options ?? []).map((opt: string, oi: number) => (
                        <div key={oi} className="flex items-center gap-2 mb-1">
                          <button onClick={() => updateCue(ci, { correct: [oi] })} title={t("courseMaker.correctAnswer")} className="w-4 h-4 rounded-full border shrink-0" style={{ borderColor: (cue.correct ?? []).includes(oi) ? "oklch(55% 0.18 145)" : BORDER, background: (cue.correct ?? []).includes(oi) ? "oklch(55% 0.18 145)" : "transparent" }} />
                          <Input value={opt} onChange={(e) => updateCue(ci, { options: (cue.options ?? []).map((x: string, j: number) => (j === oi ? e.target.value : x)) })} placeholder={`${t("courseMaker.option")} ${oi + 1}`} className="h-7" />
                        </div>
                      ))}
                      <div className="flex items-center gap-3">
                        <button onClick={() => updateCue(ci, { options: [...(cue.options ?? []), ""] })} className="text-[11px]" style={{ color: GOLD }}>{t("courseMaker.addOptionShort")}</button>
                        <label className="text-[11px] flex items-center gap-1" style={{ color: MUTED }}>{t("courseMaker.seekIfCorrect")}<Input type="number" value={cue.onCorrectSeek ?? ""} onChange={(e) => updateCue(ci, { onCorrectSeek: e.target.value === "" ? null : Number(e.target.value) })} className="h-6 w-16" /></label>
                      </div>
                    </>)}

                    {cue.kind === "branch" && (<>
                      {(cue.branches ?? []).map((b: any, bi: number) => (
                        <div key={bi} className="flex items-center gap-2 mb-1">
                          <Input value={b.label} onChange={(e) => updateCue(ci, { branches: (cue.branches ?? []).map((x: any, j: number) => (j === bi ? { ...x, label: e.target.value } : x)) })} placeholder={`${t("courseMaker.choice")} ${bi + 1}`} className="h-7" />
                          <Input type="number" value={b.seekTo} onChange={(e) => updateCue(ci, { branches: (cue.branches ?? []).map((x: any, j: number) => (j === bi ? { ...x, seekTo: Number(e.target.value) } : x)) })} placeholder={t("courseMaker.seekToPlaceholder")} className="h-7 w-16" />
                          <button onClick={() => updateCue(ci, { branches: (cue.branches ?? []).filter((_: any, j: number) => j !== bi) })} className="text-red-500 text-[11px]">✕</button>
                        </div>
                      ))}
                      <button onClick={() => updateCue(ci, { branches: [...(cue.branches ?? []), { label: "", seekTo: 0 }] })} className="text-[11px]" style={{ color: GOLD }}>{t("courseMaker.addBranch")}</button>
                    </>)}

                    {cue.kind === "hotspot" && (<>
                      {(cue.hotspots ?? []).map((h: any, hi: number) => (
                        <div key={hi} className="flex items-center gap-1 mb-1 flex-wrap">
                          <Input value={h.label ?? ""} onChange={(e) => updateCue(ci, { hotspots: (cue.hotspots ?? []).map((x: any, j: number) => (j === hi ? { ...x, label: e.target.value } : x)) })} placeholder={t("courseMaker.label")} className="h-7 w-28" />
                          <Input type="number" value={h.xPct ?? 50} onChange={(e) => updateCue(ci, { hotspots: (cue.hotspots ?? []).map((x: any, j: number) => (j === hi ? { ...x, xPct: Number(e.target.value) } : x)) })} placeholder="x%" className="h-7 w-14" />
                          <Input type="number" value={h.yPct ?? 50} onChange={(e) => updateCue(ci, { hotspots: (cue.hotspots ?? []).map((x: any, j: number) => (j === hi ? { ...x, yPct: Number(e.target.value) } : x)) })} placeholder="y%" className="h-7 w-14" />
                          <label className="text-[11px] flex items-center gap-1" style={{ color: MUTED }}><input type="checkbox" checked={h.correct ?? false} onChange={(e) => updateCue(ci, { hotspots: (cue.hotspots ?? []).map((x: any, j: number) => (j === hi ? { ...x, correct: e.target.checked } : x)) })} />{t("courseMaker.correctShort")}</label>
                          <button onClick={() => updateCue(ci, { hotspots: (cue.hotspots ?? []).filter((_: any, j: number) => j !== hi) })} className="text-red-500 text-[11px]">✕</button>
                        </div>
                      ))}
                      <button onClick={() => updateCue(ci, { hotspots: [...(cue.hotspots ?? []), { xPct: 50, yPct: 50, label: "", correct: true }] })} className="text-[11px]" style={{ color: GOLD }}>{t("courseMaker.addHotspot")}</button>
                    </>)}

                    {cue.kind === "dragdrop" && (<>
                      <div className="text-[11px] mb-1" style={{ color: MUTED }}>{t("courseMaker.dragItemsLabel")}</div>
                      {(cue.dragItems ?? []).map((it: any, ii: number) => (
                        <div key={ii} className="flex items-center gap-1 mb-1">
                          <Input value={it.id} onChange={(e) => updateCue(ci, { dragItems: (cue.dragItems ?? []).map((x: any, j: number) => (j === ii ? { ...x, id: e.target.value } : x)) })} placeholder="id" className="h-7 w-20" />
                          <Input value={it.label} onChange={(e) => updateCue(ci, { dragItems: (cue.dragItems ?? []).map((x: any, j: number) => (j === ii ? { ...x, label: e.target.value } : x)) })} placeholder={t("courseMaker.label")} className="h-7" />
                          <button onClick={() => updateCue(ci, { dragItems: (cue.dragItems ?? []).filter((_: any, j: number) => j !== ii) })} className="text-red-500 text-[11px]">✕</button>
                        </div>
                      ))}
                      <button onClick={() => updateCue(ci, { dragItems: [...(cue.dragItems ?? []), { id: `i${(cue.dragItems?.length ?? 0) + 1}`, label: "" }] })} className="text-[11px]" style={{ color: GOLD }}>{t("courseMaker.addItem")}</button>
                      <div className="text-[11px] mt-2 mb-1" style={{ color: MUTED }}>{t("courseMaker.dropZonesLabel")}</div>
                      {(cue.dropZones ?? []).map((z: any, zi: number) => (
                        <div key={zi} className="flex items-center gap-1 mb-1 flex-wrap">
                          <Input value={z.label ?? ""} onChange={(e) => updateCue(ci, { dropZones: (cue.dropZones ?? []).map((x: any, j: number) => (j === zi ? { ...x, label: e.target.value } : x)) })} placeholder={t("courseMaker.label")} className="h-7 w-20" />
                          {(["xPct", "yPct", "wPct", "hPct"] as const).map((k) => (
                            <Input key={k} type="number" value={z[k] ?? (k === "wPct" || k === "hPct" ? 20 : 40)} onChange={(e) => updateCue(ci, { dropZones: (cue.dropZones ?? []).map((x: any, j: number) => (j === zi ? { ...x, [k]: Number(e.target.value) } : x)) })} placeholder={k.replace("Pct", "")} className="h-7 w-14" />
                          ))}
                          <Input value={z.correctItemId ?? ""} onChange={(e) => updateCue(ci, { dropZones: (cue.dropZones ?? []).map((x: any, j: number) => (j === zi ? { ...x, correctItemId: e.target.value } : x)) })} placeholder={t("courseMaker.correctIdPlaceholder")} className="h-7 w-20" />
                          <button onClick={() => updateCue(ci, { dropZones: (cue.dropZones ?? []).filter((_: any, j: number) => j !== zi) })} className="text-red-500 text-[11px]">✕</button>
                        </div>
                      ))}
                      <button onClick={() => updateCue(ci, { dropZones: [...(cue.dropZones ?? []), { id: `z${(cue.dropZones?.length ?? 0) + 1}`, label: "", xPct: 40, yPct: 40, wPct: 20, hPct: 20, correctItemId: "" }] })} className="text-[11px]" style={{ color: GOLD }}>{t("courseMaker.addZone")}</button>
                    </>)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mini quiz */}
          <div className="rounded-lg p-3" style={{ background: "oklch(97% 0.01 88)", border: `1px solid ${BORDER}` }}>
            <label className={lblCls} style={{ color: MUTED }}>
              <span><FileQuestion className="w-3.5 h-3.5 inline mr-1" />{t("maker.miniQuiz")}</span>
              <button onClick={makeQuiz} disabled={busy} className="flex items-center gap-1 text-xs" style={{ color: GOLD }}>
                {genQuiz.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} {t("maker.genQuiz")}
              </button>
            </label>
            <Input value={form.quizQuestion} onChange={(e) => set("quizQuestion", e.target.value)} placeholder={t("maker.question")} className="mb-2" />
            {form.quizQuestion && (
              <>
                <div className="space-y-1.5">
                  {form.quizOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <button onClick={() => toggleCorrect(i)} className="w-5 h-5 rounded-full border flex items-center justify-center shrink-0"
                        style={{ borderColor: form.quizCorrect.includes(i) ? "oklch(55% 0.18 145)" : BORDER, background: form.quizCorrect.includes(i) ? "oklch(55% 0.18 145)" : "transparent" }}>
                        {form.quizCorrect.includes(i) && <Check className="w-3 h-3 text-white" />}
                      </button>
                      <Input value={opt} onChange={(e) => set("quizOptions", form.quizOptions.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`${t("maker.option")} ${i + 1}`} />
                      {form.quizOptions.length > 2 && <button onClick={() => { set("quizOptions", form.quizOptions.filter((_, j) => j !== i)); set("quizCorrect", form.quizCorrect.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x))); }} className="text-red-500"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  ))}
                </div>
                <button onClick={() => set("quizOptions", [...form.quizOptions, ""])} className="text-xs mt-2 flex items-center gap-1" style={{ color: GOLD }}><Plus className="w-3 h-3" /> {t("maker.addOption")}</button>
                <Input value={form.quizExplanation} onChange={(e) => set("quizExplanation", e.target.value)} placeholder={t("maker.explanation")} className="mt-2" />
              </>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={save} disabled={update.isPending} style={{ background: DEEP_BLUE, color: IVORY }}>{t("common.save")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
