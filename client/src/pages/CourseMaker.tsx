import DraftConflictResolution from "@/components/DraftConflictResolution";
import {requestId as createRequestId} from "@/lib/requestId";
import { useDraftExitGuard } from "@/hooks/useDraftExitGuard";
import ContentLanguageSelect, {type ContentLanguage} from "@/components/ContentLanguageSelect";
import AiVideoGenerator from "@/components/AiVideoGenerator";
import { embeddedQuizSchema } from "../../../shared/embeddedQuiz";
import { videoCuesSchema } from "../../../shared/videoCues";
import PendingAiOutlines from "@/components/PendingAiOutlines";
import AiUsage from "@/components/AiUsage";
import CopyCourseDialog from "@/components/CopyCourseDialog";
import PrivateMediaUpload from "@/components/PrivateMediaUpload";
import PedagogicalReviewPanel from "@/components/PedagogicalReviewPanel";
import CompanyCourseAssignment from "@/components/CompanyCourseAssignment";
import AdminContentManager from "@/components/AdminContentManager";
import { useEffect, useMemo, useRef, useState } from "react";
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

  const workspaces = trpc.maker.workspaces.useQuery(undefined, { enabled: !!user });
  const canAuthor = !!workspaces.data?.length;
  const [copyOpen,setCopyOpen] = useState(false);
  const [workspaceId, setWorkspaceId] = useState("");
  useEffect(() => { if (!workspaceId && workspaces.data?.length) setWorkspaceId(workspaces.data[0].orgId == null ? "operator" : String(workspaces.data[0].orgId)); }, [workspaces.data, workspaceId]);
  const selectedWorkspace = workspaces.data?.find(w => (w.orgId == null ? "operator" : String(w.orgId)) === workspaceId);
  const workspaceName = selectedWorkspace?.name ?? t("maker.operatorWorkspace");

  const { data: providers } = trpc.ai.providers.useQuery(undefined, { enabled: canAuthor });
  const textProviders = useMemo(() => {
    if (!providers) return [] as Provider[];
    return (Object.keys(providers) as Provider[]).filter((p) => (providers as any)[p].text);
  }, [providers]);
  const [provider, setProvider] = useState<Provider>("openai");
  useEffect(() => { if (textProviders.length && !textProviders.includes(provider)) setProvider(textProviders[0]); }, [textProviders]);
  const aiReady = textProviders.length > 0;

  const coursesQuery = trpc.maker.courses.useQuery(undefined, { enabled: canAuthor });
  const courses = coursesQuery.data ?? [];
  const pendingReviews = trpc.maker.reviews.pending.useQuery(undefined, { enabled: canAuthor, refetchInterval: 60000 });
  const slidesQuery = trpc.maker.slides.useQuery({ trainingId: trainingId! }, { enabled: canAuthor && trainingId != null });
  const versions = trpc.maker.versions.useQuery({ trainingId: trainingId! }, { enabled: canAuthor && trainingId != null });
  const readiness = trpc.maker.readiness.useQuery({ trainingId: trainingId! }, { enabled: canAuthor && trainingId != null, refetchOnWindowFocus: true });
  const slides = (slidesQuery.data ?? []) as any[];
  const course = courses.find((c: any) => c.id === trainingId);
  const slidesUnavailable = slidesQuery.isLoading || slidesQuery.isError || !slidesQuery.data;
  const publicationUnavailable = coursesQuery.isError || readiness.isFetching || readiness.isError || !readiness.data?.ready;

  const [newOpen, setNewOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [editSlide, setEditSlide] = useState<any | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const refetchSlides = () => { if (trainingId != null) { utils.maker.slides.invalidate({ trainingId }); utils.maker.readiness.invalidate({ trainingId }); } };

  const pendingSlideCreations=useRef(new Map<string,{trainingId:number;sortOrder:number;title:string;body:string;requestId:string}>());
  const creatingSlide=useRef(false);
  const createSlide = trpc.maker.createSlide.useMutation({
    onSuccess:(result,input)=>{
      pendingSlideCreations.current.forEach((pending,key)=>{if(pending.requestId===input.requestId) pendingSlideCreations.current.delete(key);});
      toast.success(t(result.archived?'courseMaker.slideRecoveredArchived':result.replayed?'courseMaker.slideRecovered':'courseMaker.slideAdded'));
      void utils.maker.slides.invalidate({trainingId:input.trainingId});
      void utils.maker.readiness.invalidate({trainingId:input.trainingId});
    },onError:e=>toast.error(e.message),onSettled:()=>{creatingSlide.current=false;},
  });
  const addSlide=()=>{
    if(!course||!user||slidesUnavailable||creatingSlide.current)return;
    const key=`${user.id}:${course.id}`;
    let input=pendingSlideCreations.current.get(key);
    if(!input){input={trainingId:course.id,sortOrder:slides.length+1,title:'',body:'',requestId:createRequestId()};pendingSlideCreations.current.set(key,input);}
    creatingSlide.current=true;createSlide.mutate(input);
  };
  const deleteSlide = trpc.maker.deleteSlide.useMutation({ onSuccess: () => { toast.success(t("contentArchive.done")); refetchSlides(); }, onError: e => toast.error(e.message) });
  const reordering=useRef(false);
  const reorder = trpc.maker.reorderSlides.useMutation({ onError:e=>toast.error(e.message),onSettled:()=>{reordering.current=false;void utils.maker.slides.invalidate();void utils.maker.readiness.invalidate();} });
  const archive = trpc.maker.archive.useMutation({ onSuccess: () => { toast.success(t("contentArchive.done")); setTrainingId(null); utils.maker.courses.invalidate(); }, onError: e => toast.error(e.message) });
  const publish = trpc.maker.publish.useMutation({ onSuccess: () => { toast.success(t("courseMaker.publishSaved")); utils.maker.courses.invalidate(); utils.maker.versions.invalidate(); }, onError: e => toast.error(e.message) });

  const move = (i: number, dir: -1 | 1) => {
    if (slidesUnavailable || reordering.current || slidesQuery.isFetching) return;
    const arr = [...slides];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    reordering.current=true;
    reorder.mutate({ orderedIds: arr.map(s=>s.id), expectedRevisions:arr.map(s=>s.revision) });
  };

  if (loading || (!!user && workspaces.isLoading)) return <div className="min-h-screen flex items-center justify-center" style={{ background: IVORY }}><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (workspaces.isError) return <div className="container py-12"><MakerReadError message={t("courseMaker.readError")} busy={workspaces.isFetching} retry={() => { void workspaces.refetch(); }} /></div>;
  if (!user || !canAuthor) {
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
    id: s.id, title: s.title, body: s.body, imageUrl: s.imageUrl, videoUrl: s.videoUrl, audioUrl: s.audioUrl, videoCues: s.videoCues,
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
            <Link href={user.role === "admin" ? "/admin" : "/dashboard"}><Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10"><ArrowLeft className="w-4 h-4 mr-1" /> {user.role === "admin" ? t("userMenu.administration") : t("userMenu.mySpace")}</Button></Link>
          </div>
        </div>
      </div>

      <div className="container py-6 grid lg:grid-cols-[300px_1fr] gap-6">
        {/* Left: course list */}
        <div>
          {pendingReviews.isError && <MakerReadError message={t("courseMaker.readError")} busy={pendingReviews.isFetching} retry={() => { void pendingReviews.refetch(); }} />}
          {!pendingReviews.isError && !!pendingReviews.data?.length && <div className="border rounded p-3 mb-3 bg-white"><p className="text-sm font-semibold">{t("review.inbox")}</p>{pendingReviews.data.map(r => <button className="block text-xs underline mt-1 text-left" key={r.id} onClick={() => setTrainingId(r.trainingId)}>{r.title}</button>)}</div>}
          <label className="block text-xs mb-3">{t("maker.creationWorkspace")}
            <select value={workspaceId} onChange={e => setWorkspaceId(e.target.value)} className="w-full p-2 border rounded mt-1 bg-white">
              {workspaces.data?.map(w => <option key={w.orgId ?? "operator"} value={w.orgId == null ? "operator" : String(w.orgId)}>{w.name ?? t("maker.operatorWorkspace")}</option>)}
            </select>
          </label>
          <div className="flex gap-2 mb-2">
            <Button size="sm" className="flex-1" variant="outline" disabled={!selectedWorkspace} onClick={() => setNewOpen(true)}><Plus className="w-4 h-4 mr-1" /> {t("maker.newCourse")}</Button>
            <Button size="sm" className="flex-1" disabled={!aiReady || !selectedWorkspace} onClick={() => setAiOpen(true)} style={{ background: GOLD, color: DEEP_BLUE }}><Wand2 className="w-4 h-4 mr-1" /> {t("maker.aiOutline")}</Button>
          </div>
          <Button className="w-full mb-2" size="sm" variant="outline" disabled={!course || !selectedWorkspace || coursesQuery.isError} onClick={() => setCopyOpen(true)}>{lang === "fr" ? "Dupliquer la formation sélectionnée" : lang === "ar" ? "نسخ الدورة المحددة" : "Duplicate selected course"}</Button>
          {!aiReady &&<p className="text-xs mb-3 p-2 rounded" style={{ background: "oklch(68% 0.1 78 / 0.12)", color: "oklch(45% 0.06 78)" }}>{t("maker.providerMissing")}</p>}
          {canAuthor && <><AiUsage /><PendingAiOutlines onCreated={id=>{setTrainingId(id);utils.maker.courses.invalidate();}}/></>}
          <div className="text-xs font-semibold tracking-wide mb-2" style={{ color: MUTED }}>{t("maker.courses").toUpperCase()}</div>
          <div className="space-y-1.5">
            {coursesQuery.isLoading && <p role="status">{t("common.loading")}</p>}
            {coursesQuery.isError && <MakerReadError message={t("courseMaker.readError")} busy={coursesQuery.isFetching} retry={() => { void coursesQuery.refetch(); }} />}
            {!coursesQuery.isLoading && !coursesQuery.isError && courses.length === 0 && <p className="text-sm text-muted-foreground">{t("courseMaker.noCourses")}</p>}
            {!coursesQuery.isError && courses.map((c: any) => (
              <button key={c.id} onClick={() => setTrainingId(c.id)} className="w-full text-left p-2.5 rounded-lg flex items-center gap-2 transition-colors"
                style={{ background: c.id === trainingId ? "white" : "transparent", border: `1px solid ${c.id === trainingId ? GOLD : "transparent"}` }}>
                <BookOpen className="w-4 h-4 shrink-0" style={{ color: c.id === trainingId ? GOLD : MUTED }} />
                <span className="flex-1 text-sm truncate" style={{ color: DEEP_BLUE }}>{c.title}<span className="block text-[10px] text-muted-foreground">{c.ownerOrgId == null ? t("maker.operatorWorkspace") : workspaces.data?.find(w => w.orgId === c.ownerOrgId)?.name ?? t("maker.companyWorkspace")}</span></span>
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
          {coursesQuery.isLoading ? <p role="status">{t("common.loading")}</p> : !course && coursesQuery.isError ? <MakerReadError message={t("courseMaker.readError")} busy={coursesQuery.isFetching} retry={() => { void coursesQuery.refetch(); }} /> : !course ? (
            <div className="rounded-xl p-12 text-center" style={{ background: "white", border: `1px solid ${BORDER}` }}>
              <GraduationCap className="w-10 h-10 mx-auto mb-3" style={{ color: GOLD }} />
              <p className="text-sm" style={{ color: MUTED }}>{t("maker.selectCourse")}</p>
            </div>
          ) : (
            <>
              {coursesQuery.isError && <MakerReadError message={t("courseMaker.readError")} busy={coursesQuery.isFetching} retry={() => { void coursesQuery.refetch(); }} />}
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div>
                  <h2 className="font-serif text-xl font-bold" style={{ color: DEEP_BLUE }}>{course.title}</h2>
                  <p className="text-xs my-1">{t("curriculum.authorHint")}</p>
                  {versions.isLoading && <p role="status" className="text-xs">{t("common.loading")}</p>}
                  {versions.isError && <MakerReadError message={t("courseMaker.readError")} busy={versions.isFetching} retry={() => { void versions.refetch(); }} />}
                  <p className="text-xs my-1">{!versions.isError && versions.data?.map(v => t("curriculum.version", { version: v.version })).join(" · ")}</p>
                  {!slidesUnavailable && <span className="text-xs" style={{ color: MUTED }}>{slides.length} {t("maker.slides").toLowerCase()}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={archive.isPending || publish.isPending || coursesQuery.isError} onClick={() => { if (confirm(t("contentArchive.confirm"))) archive.mutate({ trainingId: course.id }); }}>{t("contentArchive.action")}</Button>
                  <Button size="sm" variant="outline" disabled={slidesUnavailable || !slides.length} onClick={() => setPreviewOpen(true)}><Eye className="w-4 h-4 mr-1" /> {t("maker.preview")}</Button>
                  {course.isPublished && <Button size="sm" disabled={publish.isPending || archive.isPending || publicationUnavailable} onClick={() => publish.mutate({ id: course.id, isPublished: true })}>{t("curriculum.publishNext")}</Button>}
                  <Button size="sm" variant="outline" disabled={publish.isPending || archive.isPending || coursesQuery.isError || (!course.isPublished && publicationUnavailable)} onClick={() => publish.mutate({ id: course.id, isPublished: !course.isPublished })}>
                    {course.isPublished ? t("maker.unpublish") : t("maker.publish")}
                  </Button>
                </div>
              </div>

              {course.ownerOrgId && <CompanyCourseAssignment key={course.id} trainingId={course.id} published={!!course.isPublished && !!course.publishedVersionId} />}
              <div className="rounded-xl bg-white p-4 mb-4 border"><div className="flex justify-between gap-2"><strong>{t("readiness.title")}</strong><Button size="sm" variant="outline" disabled={readiness.isFetching} onClick={() => readiness.refetch()}>{t("readiness.check")}</Button></div>{readiness.isError ? <MakerReadError message={t("courseMaker.readError")} busy={readiness.isFetching} retry={() => { void readiness.refetch(); }} /> : readiness.isFetching ? <p role="status" className="text-sm mt-2">{t("common.loading")}</p> : readiness.data?.ready ? <p className="text-sm mt-2">{t("readiness.ready")}</p> : <ul className="list-disc ps-5 mt-2 text-sm space-y-1">{readiness.data?.issues.map((issue, i) => <li key={i}>{t(`readiness.${issue.code}`)} — {issue.label}{!slidesUnavailable && issue.slideId != null && slides.some(s => s.id === issue.slideId) && <button className="ms-2 underline" onClick={() => setEditSlide(slides.find(s => s.id === issue.slideId))}>{lang === "fr" ? "Corriger" : lang === "ar" ? "تصحيح" : "Fix"}</button>}</li>)}</ul>}</div>
              <PedagogicalReviewPanel key={`review-${course.id}`} trainingId={course.id} />
              <div className="rounded-xl bg-white p-4 mb-6 border"><AdminContentManager key={course.id} trainings={[course]} /></div>
              <div className="space-y-2 mb-4">
                {slidesQuery.isLoading && <p role="status">{t("common.loading")}</p>}
                {slidesQuery.isError && <MakerReadError message={t("courseMaker.readError")} busy={slidesQuery.isFetching} retry={() => { void slidesQuery.refetch(); }} />}
                {!slidesUnavailable && slides.length === 0 && <p className="text-sm p-6 text-center rounded-xl" style={{ background: "white", border: `1px solid ${BORDER}`, color: MUTED }}>{t("maker.noSlides")}</p>}
                {!slidesUnavailable && slides.map((s: any, i: number) => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "white", border: `1px solid ${BORDER}` }}>
                    <div className="flex flex-col">
                      <button aria-label={t("courseMaker.moveSlideUp", { title: s.title || String(i + 1) })} onClick={() => move(i, -1)} disabled={i === 0 || reorder.isPending || slidesQuery.isFetching} className="text-muted-foreground disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                      <button aria-label={t("courseMaker.moveSlideDown", { title: s.title || String(i + 1) })} onClick={() => move(i, 1)} disabled={i === slides.length - 1 || reorder.isPending || slidesQuery.isFetching} className="text-muted-foreground disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                    </div>
                    <div className="w-12 h-12 rounded-lg shrink-0 overflow-hidden flex items-center justify-center" style={{ background: "oklch(93% 0.015 88)" }}>
                      {s.imageUrl ? <img src={s.imageUrl} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5" style={{ color: "oklch(75% 0.02 240)" }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: DEEP_BLUE }}>{i + 1}. {s.title || "—"}</div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px]" style={{ color: MUTED }}>
                        {s.videoUrl && <span>🎬 video</span>}
                        {s.audioUrl && <span><Mic className="w-3 h-3 inline" /> audio</span>}
                        {s.quizQuestion && <span><FileQuestion className="w-3 h-3 inline" /> quiz</span>}
                      </div>
                    </div>
                    <button aria-label={t("courseMaker.editSlide", { title: s.title || String(i + 1) })} onClick={() => setEditSlide(s)} className="p-1.5 rounded hover:bg-black/5" style={{ color: MUTED }}><Pencil className="w-4 h-4" /></button>
                    <button aria-label={t("courseMaker.archiveSlide", { title: s.title || String(i + 1) })} onClick={() => { if (confirm(t("contentArchive.confirm"))) deleteSlide.mutate({ id: s.id }); }} className="p-1.5 rounded hover:bg-black/5 text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>

              {createSlide.isError && createSlide.variables?.trainingId===course.id && <p role="alert" className="text-sm text-amber-800">{t("courseMaker.slideCreateUnconfirmed")}</p>}
              <Button variant="outline" className="w-full" disabled={slidesUnavailable || createSlide.isPending} onClick={addSlide}>
                <Plus className="w-4 h-4 mr-1" /> {t("maker.addSlide")}
              </Button>
            </>
          )}
        </div>
      </div>

      {copyOpen && course && selectedWorkspace && <CopyCourseDialog course={course} orgId={selectedWorkspace.orgId} workspaceName={workspaceName} onClose={() => setCopyOpen(false)} onCreated={id => {setCopyOpen(false);setTrainingId(id);utils.maker.courses.invalidate();}} />}
      {newOpen && selectedWorkspace && <NewCourseDialog orgId={selectedWorkspace.orgId ?? undefined} workspaceName={workspaceName} onClose={() => setNewOpen(false)} onCreated={(id) => { setNewOpen(false); setTrainingId(id); utils.maker.courses.invalidate(); }} />}
      {aiOpen && selectedWorkspace && <AIGenerateDialog orgId={selectedWorkspace.orgId ?? undefined} workspaceName={workspaceName} provider={provider} setProvider={setProvider} textProviders={textProviders} onClose={() => setAiOpen(false)} onCreated={(id) => { setAiOpen(false); setTrainingId(id); utils.maker.courses.invalidate(); }} />}
      {editSlide && <SlideEditorDialog key={editSlide.id} slide={editSlide} provider={provider} providers={providers} lang={lang} courseLanguage={course?.language} onClose={() => setEditSlide(null)} onSaved={() => { setEditSlide(null); refetchSlides(); }} />}
      {previewOpen && (
        <Dialog open onOpenChange={(o) => !o && setPreviewOpen(false)}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden h-[85vh]">
            <SlideDeck contentLanguage={course?.language} slides={deckSlides} title={course?.title} finishLabel={t("maker.preview")} onFinish={() => setPreviewOpen(false)} />
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
      {(["en", "fr", "ar"] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)} className="px-2.5 py-1 text-xs font-semibold"
          style={{ background: lang === l ? GOLD : "transparent", color: lang === l ? DEEP_BLUE : "white" }}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// ── New (empty) course ──
function NewCourseDialog({ orgId, workspaceName, onClose, onCreated }: { orgId?: number; workspaceName: string; onClose: () => void; onCreated: (id: number) => void }) {
  const { t, lang } = useI18n();
  const [contentLanguage,setContentLanguage]=useState<ContentLanguage>(lang);
  const [title, setTitle] = useState("");
  const create = trpc.maker.createCourse.useMutation({
    onSuccess: (r) => { toast.success(t("maker.courseCreated")); if (r?.trainingId) onCreated(r.trainingId); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{t("maker.newCourse")}</DialogTitle></DialogHeader><p className="text-sm">{workspaceName}</p>
        <div className="space-y-3 mt-2">
          <ContentLanguageSelect value={contentLanguage} onChange={setContentLanguage} disabled={create.isPending}/>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("maker.slideTitle")} />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={!title.trim() || create.isPending} onClick={() => create.mutate({ orgId, title, slug: slugify(title) + "-" + Date.now().toString(36), language: contentLanguage, slides: [] })} style={{ background: DEEP_BLUE, color: IVORY }}>
            {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t("maker.create")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── AI outline → course ──
function AIGenerateDialog({ orgId, workspaceName, provider, setProvider, textProviders, onClose, onCreated }: {
  orgId?: number; workspaceName: string; provider: Provider; setProvider: (p: Provider) => void; textProviders: Provider[]; onClose: () => void; onCreated: (id: number) => void;
}) {
  const { t, lang } = useI18n();
  const utils = trpc.useUtils();
  const [contentLanguage,setContentLanguage]=useState<ContentLanguage>(lang);
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
  const create = trpc.maker.createFromAiOutline.useMutation();
  const [busy, setBusy] = useState(false);
  const [savedOutlineId, setSavedOutlineId] = useState<number | null>(null);
  const recoverLabel = lang === "fr" ? "Créer le cours avec le plan enregistré" : lang === "ar" ? "إنشاء الدورة من الخطة المحفوظة" : "Create course from saved outline";

  const run = async () => {
    if (!topic.trim()) return toast.error(t("maker.topic"));
    setBusy(true);
    try {
      let id = savedOutlineId;
      if (id == null) {
        const res = await outline.mutateAsync({ orgId, provider, topic, audience, slideCount, language: contentLanguage, level, tone, domain: domain || undefined, objectives: objectives || undefined, quizCoverage, references });
        id = res.outlineId;
        setSavedOutlineId(id);
      }
      const created = await create.mutateAsync({id});
      toast.success(t("maker.courseCreated"));
      if (created?.trainingId) onCreated(created.trainingId);
    } catch (e: any) {
      toast.error(e.message || "AI error");
    } finally { setBusy(false); utils.maker.pendingAiOutlines.invalidate(); utils.maker.courses.invalidate(); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Wand2 className="w-4 h-4" style={{ color: GOLD }} /> {t("maker.aiOutline")}</DialogTitle></DialogHeader><p className="text-sm">{workspaceName}</p>
        <fieldset disabled={busy || savedOutlineId != null} className="space-y-3 mt-2 disabled:opacity-60">
          <ContentLanguageSelect value={contentLanguage} onChange={setContentLanguage}/>
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
        </fieldset>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={busy} onClick={run} style={{ background: GOLD, color: DEEP_BLUE }}>
            {busy ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> {t("maker.generating")}</> : <><Sparkles className="w-4 h-4 mr-1" /> {savedOutlineId != null ? recoverLabel : t("common.generate")}</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function draftFromSlide(slide:any) { return {
    title: slide.title ?? "", body: slide.body ?? "", imageUrl: slide.imageUrl ?? "", imagePrompt: slide.imagePrompt ?? "",
    videoUrl: slide.videoUrl ?? "", audioUrl: slide.audioUrl ?? "",
    moduleId: (slide.moduleId ?? "") as number | "",
    objectiveId: (slide.objectiveId ?? "") as number | "",
    videoCues: (slide.videoCues ?? []) as any[],
    quizQuestion: slide.quizQuestion ?? "", quizOptions: (slide.quizOptions ?? ["", ""]) as string[],
    quizCorrect: (slide.quizCorrect ?? []) as number[], quizExplanation: slide.quizExplanation ?? "",
  }; }

// ── Slide editor with AI assist ──
function SlideEditorDialog({ slide, provider, providers, lang, courseLanguage, onClose, onSaved }: {
  slide: any; provider: Provider; providers: any; lang: "fr" | "en" | "ar"; courseLanguage?: string | null; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useI18n();
  const utils=trpc.useUtils();
  const expectedRevision=useRef(slide.revision);
  const [contentLanguage,setContentLanguage]=useState<ContentLanguage>(courseLanguage === "fr" || courseLanguage === "en" || courseLanguage === "ar" ? courseLanguage : lang);
  const [form, setForm] = useState(()=>draftFromSlide(slide));
  const baseline=useRef(draftFromSlide(slide));
  const [comparison,setComparison]=useState<{latest:ReturnType<typeof draftFromSlide>;revision:number}|null>(null);
  const [comparing,setComparing]=useState(false);
  const initialDraft = useRef(JSON.stringify(form));
  const [suggestion, setSuggestion] = useState<Partial<typeof form> | null>(null);
  const operation = useRef(false);
  const mediaLock = useRef(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const startImport = () => {
    if (operation.current || mediaLock.current || suggestion) return false;
    mediaLock.current = true; setMediaBusy(true); return true;
  };
  const finishImport = () => { mediaLock.current = false; if (mounted.current) setMediaBusy(false); };
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const updateCue = (ci: number, patch: Record<string, any>) =>
    setForm((f) => ({ ...f, videoCues: f.videoCues.map((c, j) => (j === ci ? { ...c, ...patch } : c)) }));

  const update = trpc.maker.updateSlide.useMutation({ onSuccess: () => { if (mounted.current) { toast.success(t("common.save")); onSaved(); } }, onError: (e) => { if (mounted.current) toast.error(e.message); if(e.data?.code==='CONFLICT') void utils.maker.slides.invalidate({trainingId:slide.trainingId}); }, onSettled: () => { operation.current = false; } });
  const modulesQuery = trpc.maker.content.modules.list.useQuery({ trainingId: slide.trainingId });
  const objectivesQuery = trpc.maker.objectives.useQuery({ trainingId: slide.trainingId }, { enabled: !!slide.trainingId });
  const objectives = (objectivesQuery.data ?? []) as any[];
  const genText = trpc.ai.generateSlideText.useMutation();
  const genImage = trpc.ai.generateImage.useMutation();
  const genAudio = trpc.ai.generateAudio.useMutation();
  const genQuiz = trpc.ai.generateQuiz.useMutation();
  const canImage = providers && (providers.openai?.image || providers.google?.image || providers.mistral?.image);
  const canTTS = providers && (providers.openai?.tts || providers.google?.tts || providers.mistral?.tts);

  const generate = async (action: () => Promise<Partial<typeof form>>) => {
    if (operation.current || mediaLock.current || suggestion) return;
    operation.current = true;
    try {
      const proposed = await action();
      if (mounted.current) setSuggestion(proposed);
    } catch (e) { if (mounted.current) toast.error(e instanceof Error ? e.message : t("courseMaker.generationFailed")); }
    finally { operation.current = false; }
  };
  const writeText = () => generate(async () => ({ body: await genText.mutateAsync({ provider, instruction: `Write the slide body about: ${form.title || "this topic"}`, language: contentLanguage }) }));
  const makeImage = () => generate(async () => {
    const result = await genImage.mutateAsync({ trainingId: slide.trainingId, prompt: form.imagePrompt || form.title || "aviation maintenance training", provider });
    return { imageUrl: result.url };
  });
  const makeAudio = () => {
    if (!form.body.trim()) return toast.error(t("maker.slideText"));
    return generate(async () => {
      const result = await genAudio.mutateAsync({ trainingId: slide.trainingId, text: form.body, provider, language: contentLanguage });
      return { audioUrl: result.url };
    });
  };
  const makeQuiz = () => generate(async () => {
    const q = await genQuiz.mutateAsync({ provider, content: form.body || form.title, language: contentLanguage });
    if (!q) throw new Error(t("courseMaker.generationFailed"));
    return { quizQuestion: q.question, quizOptions: q.options, quizCorrect: q.correct, quizExplanation: q.explanation };
  });

  const toggleCorrect = (i: number) => set("quizCorrect", form.quizCorrect.includes(i) ? form.quizCorrect.filter((x) => x !== i) : [...form.quizCorrect, i]);

  const compareLatest=async()=>{
    if(operation.current||mediaLock.current||suggestion||comparison)return;
    operation.current=true;setComparing(true);
    try {
      const rows=await utils.maker.slides.fetch({trainingId:slide.trainingId});
      const latest=rows.find(row=>row.id===slide.id);
      if(!latest)throw new Error(t('courseMaker.slideUnavailable'));
      if(mounted.current)setComparison({latest:draftFromSlide(latest),revision:latest.revision});
    }catch(e){if(mounted.current)toast.error(e instanceof Error?e.message:t('courseMaker.readError'));}
    finally{operation.current=false;if(mounted.current)setComparing(false);}
  };
  const save = () => {
    if (operation.current || mediaLock.current || suggestion || comparison) return;
    const quiz = embeddedQuizSchema.safeParse(form.quizQuestion.trim() ? {quizQuestion:form.quizQuestion,quizOptions:form.quizOptions,quizCorrect:form.quizCorrect,quizExplanation:form.quizExplanation} : {quizQuestion:null,quizOptions:null,quizCorrect:null,quizExplanation:null});
    if(!quiz.success){toast.error(lang === "fr" ? "QCM incomplet. Renseignez chaque option et sélectionnez les bonnes réponses." : lang === "ar" ? "اختبار غير مكتمل. أكمل جميع الخيارات وحدد الإجابات الصحيحة." : "Incomplete quiz. Fill in every option and select the correct answers.");return;}
    const checked = videoCuesSchema.safeParse(form.videoUrl ? form.videoCues : []);
    if (!checked.success) { toast.error(lang === "fr" ? "Interaction vidéo invalide. Vérifiez les temps, choix, réponses et zones avant d’enregistrer." : lang === "ar" ? "تفاعل فيديو غير صالح. تحقق من الأوقات والخيارات والإجابات والمناطق قبل الحفظ." : "Invalid video interaction. Check times, choices, answers and zones before saving."); return; }
    operation.current = true;
    update.mutate({
    id: slide.id, expectedRevision: expectedRevision.current, title: form.title, body: form.body, imageUrl: form.imageUrl, imagePrompt: form.imagePrompt,
    videoUrl: form.videoUrl, audioUrl: form.audioUrl,
    moduleId: form.moduleId === "" ? null : Number(form.moduleId),
    objectiveId: form.objectiveId === "" ? null : Number(form.objectiveId),
    videoCues: form.videoUrl ? checked.data : null,
    ...quiz.data,
  });
  };

  const busy = genText.isPending || genImage.isPending || genAudio.isPending || genQuiz.isPending || update.isPending || mediaBusy || comparing || comparison!==null;
  const confirmExit = useDraftExitGuard(JSON.stringify(form) !== initialDraft.current || !!suggestion || busy, t(busy ? "courseMaker.leavePending" : "courseMaker.leaveDraft"));
  const closeEditor = () => { if (!update.isPending && confirmExit()) onClose(); };
  const lblCls = "text-xs font-medium mb-1 flex items-center justify-between";

  return (
    <Dialog open onOpenChange={(o) => { if (!o) closeEditor(); }}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t("maker.slideTitle")}</DialogTitle></DialogHeader>
        <fieldset disabled={update.isPending || mediaBusy} className="space-y-4 mt-2">
          <ContentLanguageSelect generation value={contentLanguage} onChange={setContentLanguage} disabled={busy || !!suggestion}/>
          <div>
            <label className={lblCls} style={{ color: MUTED }}>{t("maker.slideTitle")}</label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="block text-sm">{t("readiness.chapter")}<select disabled={modulesQuery.isLoading || modulesQuery.isError || update.isPending} value={form.moduleId} onChange={e => set("moduleId", e.target.value === "" ? "" : Number(e.target.value))} className="w-full h-9 rounded-md border px-3 text-sm">
              <option value="">{t("courseMaker.unassignedChapter")}</option>
              {form.moduleId !== "" && (modulesQuery.isError || !modulesQuery.data?.some(m => m.id === form.moduleId)) && <option value={form.moduleId}>#{form.moduleId} · {t("courseMaker.unavailableSelection")}</option>}
              {!modulesQuery.isError && modulesQuery.data?.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select></label>
            {modulesQuery.isLoading && <p role="status" className="text-xs">{t("common.loading")}</p>}
            {modulesQuery.isError && <MakerReadError busy={modulesQuery.isFetching} retry={() => { void modulesQuery.refetch(); }} />}
            {!modulesQuery.isLoading && !modulesQuery.isError && modulesQuery.data?.length === 0 && <p className="text-xs text-muted-foreground">{t("courseMaker.chapterEmpty")}</p>}
          </div>
          {objectivesQuery.isLoading && <p role="status" className="text-xs">{t("courseMaker.part66Objective")} · {t("common.loading")}</p>}
          {objectivesQuery.isError && <MakerReadError busy={objectivesQuery.isFetching} retry={() => { void objectivesQuery.refetch(); }} />}
          {(objectives.length > 0 || form.objectiveId !== "") && (
            <label className="block text-sm">{t("courseMaker.part66Objective")}
              <select disabled={objectivesQuery.isLoading || objectivesQuery.isError || update.isPending} value={form.objectiveId} onChange={(e) => set("objectiveId", e.target.value === "" ? "" : Number(e.target.value))} className="w-full h-9 rounded-md border px-3 text-sm" style={{ borderColor: BORDER }}>
                <option value="">{t("courseMaker.none")}</option>
                {form.objectiveId !== "" && (objectivesQuery.isError || !objectives.some(o => o.id === form.objectiveId)) && <option value={form.objectiveId}>#{form.objectiveId} · {t("courseMaker.unavailableSelection")}</option>}
                {!objectivesQuery.isError && objectives.map((o) => <option key={o.id} value={o.id}>{o.code ? `${o.code} · ` : ""}{o.title}</option>)}
              </select>
            </label>
          )}
          <div>
            <label className={lblCls} style={{ color: MUTED }}>
              <span>{t("maker.slideText")}</span>
              <button onClick={writeText} disabled={busy || !!suggestion} className="flex items-center gap-1 text-xs" style={{ color: GOLD }}>
                {genText.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} {t("maker.genText")}
              </button>
            </label>
            <textarea value={form.body} onChange={(e) => set("body", e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm h-28 resize-y" style={{ borderColor: BORDER }} />
          </div>

          {/* Image */}
          <div className="rounded-lg p-3" style={{ background: "oklch(97% 0.01 88)", border: `1px solid ${BORDER}` }}>
            <label className={lblCls} style={{ color: MUTED }}>
              <span><ImageIcon className="w-3.5 h-3.5 inline mr-1" />{t("maker.image")}</span>
              <button onClick={makeImage} disabled={busy || !!suggestion || !canImage} title={!canImage ? t("maker.providerMissing") : ""} className="flex items-center gap-1 text-xs disabled:opacity-40" style={{ color: GOLD }}>
                {genImage.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />} {t("maker.genImage")}
              </button>
            </label>
            {form.imageUrl && <img src={form.imageUrl} className="w-full max-h-48 object-cover rounded-md mb-2" />}
            <Input value={form.imagePrompt} onChange={(e) => set("imagePrompt", e.target.value)} placeholder={t("maker.imagePrompt")} className="mb-1" />
            <PrivateMediaUpload disabled={busy || !!suggestion} onStart={startImport} onFinish={finishImport} trainingId={slide.trainingId} kind="image" onUploaded={url => set("imageUrl", url)} />
            <Input value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder={t("courseMaker.imageUrlPlaceholder")} />
          </div>

          {/* Video + audio */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={lblCls} style={{ color: MUTED }}>{t("maker.video")}</label>
              <AiVideoGenerator trainingId={slide.trainingId} onUse={url => set("videoUrl",url)} />
              <PrivateMediaUpload disabled={busy || !!suggestion} onStart={startImport} onFinish={finishImport} trainingId={slide.trainingId} kind="video" onUploaded={url => set("videoUrl", url)} />
              <Input value={form.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} placeholder="https://… .mp4" />
            </div>
            <div>
              <label className={lblCls} style={{ color: MUTED }}>
                <span><Mic className="w-3.5 h-3.5 inline mr-1" />{t("maker.audio")}</span>
                <button onClick={makeAudio} disabled={busy || !!suggestion || !canTTS || !!form.videoUrl} title={!canTTS ? t("maker.providerMissing") : ""} className="flex items-center gap-1 text-xs disabled:opacity-40" style={{ color: GOLD }}>
                  {genAudio.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />} {t("maker.genAudio")}
                </button>
              </label>
              <PrivateMediaUpload disabled={busy || !!suggestion} onStart={startImport} onFinish={finishImport} trainingId={slide.trainingId} kind="audio" onUploaded={url => set("audioUrl", url)} />
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
                      <button aria-label={t("courseMaker.removeVideoCue", { number: ci + 1 })} onClick={() => set("videoCues", form.videoCues.filter((_, j) => j !== ci))} className="ml-auto text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <Input value={cue.question ?? ""} onChange={(e) => updateCue(ci, { question: e.target.value })} placeholder={t("courseMaker.cueQuestionPlaceholder")} className="mb-1 h-8" />

                    {(cue.kind ?? "quiz") === "quiz" && (<>
                      {(cue.options ?? []).map((opt: string, oi: number) => (
                        <div key={oi} className="flex items-center gap-2 mb-1">
                          <button aria-label={t("courseMaker.markCorrect", { number: oi + 1 })} aria-pressed={(cue.correct ?? []).includes(oi)} onClick={() => updateCue(ci, { correct: [oi] })} title={t("courseMaker.correctAnswer")} className="w-4 h-4 rounded-full border shrink-0" style={{ borderColor: (cue.correct ?? []).includes(oi) ? "oklch(55% 0.18 145)" : BORDER, background: (cue.correct ?? []).includes(oi) ? "oklch(55% 0.18 145)" : "transparent" }} />
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
              <button onClick={makeQuiz} disabled={busy || !!suggestion} className="flex items-center gap-1 text-xs" style={{ color: GOLD }}>
                {genQuiz.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} {t("maker.genQuiz")}
              </button>
            </label>
            <Input value={form.quizQuestion} onChange={(e) => set("quizQuestion", e.target.value)} placeholder={t("maker.question")} className="mb-2" />
            {form.quizQuestion && (
              <>
                <div className="space-y-1.5">
                  {form.quizOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <button aria-label={t("courseMaker.markCorrect", { number: i + 1 })} aria-pressed={form.quizCorrect.includes(i)} onClick={() => toggleCorrect(i)} className="w-5 h-5 rounded-full border flex items-center justify-center shrink-0"
                        style={{ borderColor: form.quizCorrect.includes(i) ? "oklch(55% 0.18 145)" : BORDER, background: form.quizCorrect.includes(i) ? "oklch(55% 0.18 145)" : "transparent" }}>
                        {form.quizCorrect.includes(i) && <Check className="w-3 h-3 text-white" />}
                      </button>
                      <Input value={opt} onChange={(e) => set("quizOptions", form.quizOptions.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`${t("maker.option")} ${i + 1}`} />
                      {form.quizOptions.length > 2 && <button aria-label={t("courseMaker.removeOption", { number: i + 1 })} onClick={() => { set("quizOptions", form.quizOptions.filter((_, j) => j !== i)); set("quizCorrect", form.quizCorrect.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x))); }} className="text-red-500"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  ))}
                </div>
                <button onClick={() => set("quizOptions", [...form.quizOptions, ""])} className="text-xs mt-2 flex items-center gap-1" style={{ color: GOLD }}><Plus className="w-3 h-3" /> {t("maker.addOption")}</button>
                <Input value={form.quizExplanation} onChange={(e) => set("quizExplanation", e.target.value)} placeholder={t("maker.explanation")} className="mt-2" />
              </>
            )}
          </div>
        </fieldset>
        {update.isError && update.error.data?.code==='CONFLICT' && <div className="mt-3 space-y-3"><p role="alert" className="text-sm text-amber-800">{t("courseMaker.slideEditConflict")}</p><Button variant="outline" disabled={busy||!!suggestion} onClick={()=>{void compareLatest();}}>{t('courseMaker.compareVersions')}</Button></div>}
        {comparison && <DraftConflictResolution base={baseline.current} draft={form} latest={comparison.latest} onCancel={()=>setComparison(null)} onApply={merged=>{setForm(merged);baseline.current=comparison.latest;initialDraft.current=JSON.stringify(comparison.latest);expectedRevision.current=comparison.revision;setComparison(null);update.reset();}}/>}
        {mediaBusy && <p role="status" className="text-sm mt-3">{t("courseMaker.importBeforeSave")}</p>}
        {busy && !update.isPending && !mediaBusy && <p role="status" className="text-sm mt-3">{t("courseMaker.generatingProposal")}</p>}
        {suggestion && <section className="border border-amber-300 rounded-lg p-4 space-y-3 mt-4">
          <h3 className="font-semibold">{t("courseMaker.proposalTitle")}</h3>
          <p className="text-sm">{t("courseMaker.proposalHelp")}</p>
          {suggestion.body !== undefined && <p className="whitespace-pre-wrap text-sm">{suggestion.body}</p>}
          {suggestion.imageUrl && <img src={suggestion.imageUrl} alt={t("courseMaker.proposalTitle")} className="max-h-64 object-contain" />}
          {suggestion.audioUrl && <audio src={suggestion.audioUrl} controls preload="none" className="w-full" />}
          {suggestion.quizQuestion !== undefined && <div className="text-sm space-y-2"><p>{suggestion.quizQuestion}</p><ol className="list-decimal ps-5">{suggestion.quizOptions?.map((option, i) => <li key={i}>{option}{suggestion.quizCorrect?.includes(i) && <span> · {t("courseMaker.correctAnswer")}</span>}</li>)}</ol><p>{suggestion.quizExplanation}</p></div>}
          <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => setSuggestion(null)}>{t("courseMaker.discardProposal")}</Button><Button disabled={busy} onClick={() => { setForm(current => ({ ...current, ...suggestion })); setSuggestion(null); }}>{t("courseMaker.applyProposal")}</Button></div>
        </section>}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" disabled={update.isPending} onClick={closeEditor}>{t("common.cancel")}</Button>
          <Button onClick={save} disabled={busy || !!suggestion} style={{ background: DEEP_BLUE, color: IVORY }}>{t("common.save")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MakerReadError({ busy, retry, message }: { busy: boolean; retry: () => void; message?: string }) {
  const { t } = useI18n();
  return <div className="space-y-2 rounded border border-amber-200 bg-amber-50 p-3">
    <p role="alert" className="text-sm">{message ?? t("courseMaker.curriculumReadError")}</p>
    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={retry}>{t("learningPlayer.save.retry")}</Button>
  </div>;
}
