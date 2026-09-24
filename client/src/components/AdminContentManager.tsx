import DraftConflictResolution from "@/components/DraftConflictResolution";
import { isUsableKeyword } from "../../../shared/freeTextAnswer";
import { requestId as createRequestId } from "@/lib/requestId";
import { prepareChoiceAnswers, prepareMatchingAnswers, removeMatchingOption } from "../../../shared/questionEditor";
import { useDraftExitGuard } from "@/hooks/useDraftExitGuard";
import PrivateMediaUpload from "@/components/PrivateMediaUpload";
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, GripVertical, ChevronUp, ChevronDown, HelpCircle, FileText, Check, Target } from "lucide-react";
import { toast } from "sonner";

const DEEP_BLUE = "var(--foreground)";
const GOLD = "var(--link)";
const MUTED = "var(--muted-foreground)";
const BORDER = "var(--border)";

const QUESTION_TYPE_KEYS: Record<string, string> = {
  qcu: "adminContentManager.questionTypeQcu",
  qcm: "adminContentManager.questionTypeQcm",
  true_false: "adminContentManager.questionTypeTrueFalse",
  free_text: "adminContentManager.questionTypeFreeText",
  matching: "adminContentManager.questionTypeMatching",
};

const labelCls = "text-xs font-medium mb-1 block";
const selectCls = "w-full h-9 rounded-md border px-3 text-sm";

type Module = {
  revision: number;
  quizPassingScore?: number; quizMaxAttempts?: number; quizTimeLimitMin?: number | null;
  id: number; trainingId: number; title: string; description: string | null; content: string | null;
  videoUrl: string | null; pdfUrl: string | null; durationMinutes: number | null; sortOrder: number | null; isRequired: boolean | null;
};
type Question = {
  revision: number;
  id: number; trainingId: number; moduleId: number | null; objectiveId: number | null; question: string; type: string;
  options: string[] | null; correctAnswer: number[] | null; explanation: string | null; points: number | null; sortOrder: number | null;
};
type Objective = {
  revision: number;
  id: number; trainingId: number; moduleId: number | null; code: string | null; title: string;
  description: string | null; knowledgeLevel: string | null; isRequired: boolean | null; sortOrder: number | null;
};

function moduleDraft(module:Module|null,nextOrder:number){return {
    title: module?.title ?? "",
    description: module?.description ?? "",
    content: module?.content ?? "",
    videoUrl: module?.videoUrl ?? "",
    pdfUrl: module?.pdfUrl ?? "",
    durationMinutes: module?.durationMinutes ?? 30,
    sortOrder: module?.sortOrder ?? nextOrder,
    isRequired: module?.isRequired ?? true,
    quizPassingScore: module?.quizPassingScore ?? 75,
    quizMaxAttempts: module?.quizMaxAttempts ?? 3,
    quizTimeLimitMin: module?.quizTimeLimitMin ?? null,
  };}

// ─── Module editor dialog ─────────────────────────────────────────────────────
function ModuleDialog({ trainingId, module, nextOrder, onClose, onSaved }: {
  trainingId: number; module: Module | null; nextOrder: number; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useI18n();
  const utils=trpc.useUtils();
  const [form,setForm]=useState(()=>moduleDraft(module,nextOrder));
  const baseline=useRef(moduleDraft(module,nextOrder));
  const expectedRevision=useRef(module?.revision);
  const [comparison,setComparison]=useState<{latest:ReturnType<typeof moduleDraft>;revision:number}|null>(null);
  const [comparing,setComparing]=useState(false);
  const pendingCreation = useRef<{signature:string;requestId:string}|null>(null);
  const initialDraft = useRef(JSON.stringify(form));
  const mediaLock = useRef(false);
  const saving = useRef(false);
  const mounted = useRef(true);
  const [mediaBusy, setMediaBusy] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const startImport = () => {
    if (saving.current || mediaLock.current || comparison) return false;
    mediaLock.current = true; setMediaBusy(true); return true;
  };
  const finishImport = () => { mediaLock.current = false; if (mounted.current) setMediaBusy(false); };
  const create = trpc.maker.content.modules.create.useMutation({ onSuccess: result => { if (mounted.current) { if (result.archived) toast.info(t("adminContentManager.moduleRecoveredArchived")); else toast.success(t(result.replayed ? "adminContentManager.moduleRecovered" : "adminContentManager.toastModuleCreated")); onSaved(); } }, onError: (e) => { if (mounted.current) toast.error(e.message); }, onSettled: () => { saving.current = false; } });
  const update = trpc.maker.content.modules.update.useMutation({ onSuccess: () => { if (mounted.current) { toast.success(t("adminContentManager.toastModuleUpdated")); onSaved(); } }, onError: (e) => { if (mounted.current) toast.error(e.message); if(e.data?.code==='CONFLICT') void utils.maker.content.modules.list.invalidate({trainingId}); }, onSettled: () => { saving.current = false; } });

  const compareLatest=async()=>{
    if(!module||saving.current||mediaLock.current||comparison)return;
    saving.current=true;setComparing(true);
    try {
      const rows=await utils.maker.content.modules.list.fetch({trainingId});
      const latest=rows.find(row=>row.id===module.id);
      if(!latest)throw new Error(t('adminContentManager.moduleUnavailable'));
      if(mounted.current)setComparison({latest:moduleDraft(latest as Module,nextOrder),revision:latest.revision});
    }catch(e){if(mounted.current)toast.error(e instanceof Error?e.message:t('courseMaker.readError'));}
    finally{saving.current=false;if(mounted.current)setComparing(false);}
  };
  const save = () => {
    if (mediaLock.current || saving.current || comparison) return;
    if (!form.title.trim()) return toast.error(t("adminContentManager.toastTitleRequired"));
    saving.current = true;
    if (module) update.mutate({ id: module.id, expectedRevision: expectedRevision.current, ...form });
    else {
      const input={trainingId,...form}, signature=JSON.stringify(input);
      if(pendingCreation.current?.signature!==signature) pendingCreation.current={signature,requestId:createRequestId()};
      create.mutate({...input,requestId:pendingCreation.current.requestId});
    }
  };

  const pending = mediaBusy || create.isPending || update.isPending || comparing || comparison!==null;
  const confirmExit = useDraftExitGuard(JSON.stringify(form) !== initialDraft.current || pending, t(pending ? "courseMaker.leavePending" : "courseMaker.leaveDraft"));
  const closeEditor = () => { if (!saving.current && confirmExit()) onClose(); };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) closeEditor(); }}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{module ? t("adminContentManager.moduleDialogEditTitle") : t("adminContentManager.moduleDialogNewTitle")}</DialogTitle></DialogHeader>
        <fieldset disabled={pending} className="space-y-3 mt-2">
          <div>
            <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.moduleTitleLabel")}</label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder={t("adminContentManager.moduleTitlePlaceholder")} />
          </div>
          <div>
            <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.moduleShortDescriptionLabel")}</label>
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.moduleContentLabel")}</label>
            <textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} className="w-full rounded-md border px-3 py-2 text-sm h-36 resize-y" style={{ borderColor: "var(--border)" }} placeholder={t("adminContentManager.moduleContentPlaceholder")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.moduleVideoLabel")}</label>
              <PrivateMediaUpload disabled={pending} onStart={startImport} onFinish={finishImport} trainingId={trainingId} kind="video" onUploaded={url => setForm(f => ({ ...f, videoUrl: url }))} />
              <Input value={form.videoUrl} onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))} placeholder="https://…" />
            </div>
            <div>
              <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.modulePdfLabel")}</label>
              <PrivateMediaUpload disabled={pending} onStart={startImport} onFinish={finishImport} trainingId={trainingId} kind="pdf" onUploaded={url => setForm(f => ({ ...f, pdfUrl: url }))} />
              <Input value={form.pdfUrl} onChange={(e) => setForm((f) => ({ ...f, pdfUrl: e.target.value }))} placeholder="https://…" />
            </div>
            <div>
              <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.moduleDurationLabel")}</label>
              <Input type="number" value={form.durationMinutes} onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))} />
            </div>
            <div>
              <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.orderLabel")}</label>
              <Input type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="grid gap-2 text-sm">{t("learningPlayer.chapterThreshold")}<Input type="number" min={1} max={100} value={form.quizPassingScore} onChange={e => setForm(f => ({ ...f, quizPassingScore: Number(e.target.value) }))} /></label>
            <label className="grid gap-2 text-sm">{t("learningPlayer.chapterAttempts")}<Input type="number" min={1} max={20} value={form.quizMaxAttempts} onChange={e => setForm(f => ({ ...f, quizMaxAttempts: Number(e.target.value) }))} /></label>
            <label className="grid gap-2 text-sm">{t("learningPlayer.chapterTime")}<Input type="number" min={1} max={240} value={form.quizTimeLimitMin ?? ""} onChange={e => setForm(f => ({ ...f, quizTimeLimitMin: e.target.value ? Number(e.target.value) : null }))} /></label>
          </div>
          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
            <input type="checkbox" checked={form.isRequired} onChange={(e) => setForm((f) => ({ ...f, isRequired: e.target.checked }))} />
            {t("adminContentManager.moduleRequiredLabel")}
          </label>
        </fieldset>
        {mediaBusy && <p role="status" className="text-sm mt-3">{t("courseMaker.importBeforeSave")}</p>}
        {update.error?.data?.code==='CONFLICT' && <div className="mt-3 space-y-3"><p role="alert" className="text-sm text-warning">{t("adminContentManager.moduleEditConflict")}</p><Button variant="outline" disabled={pending} onClick={()=>{void compareLatest();}}>{t('courseMaker.compareVersions')}</Button></div>}
        {comparison && <DraftConflictResolution kind="module" base={baseline.current} draft={form} latest={comparison.latest} onCancel={()=>setComparison(null)} onApply={merged=>{setForm(merged);baseline.current=comparison.latest;expectedRevision.current=comparison.revision;initialDraft.current=JSON.stringify(comparison.latest);setComparison(null);update.reset();}}/>}
        {create.isError && <p role="alert" className="mt-3 text-sm text-warning">{t("adminContentManager.moduleCreateUnconfirmed")}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" disabled={create.isPending || update.isPending} onClick={closeEditor}>{t("adminContentManager.cancelButton")}</Button>
          <Button onClick={save} disabled={pending} style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>{t("adminContentManager.saveButton")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function questionDraft(question:any,nextOrder:number) {
  return {
    type:(question?.type??'qcu') as string,text:(question?.question??'') as string,
    options:(question?.options??['','']) as string[],correct:(question?.correctAnswer??[]) as number[],
    explanation:(question?.explanation??'') as string,points:(question?.points??1) as number,
    moduleId:(question?.moduleId??'') as number|'',objectiveId:(question?.objectiveId??'') as number|'',
    optionsRight:(question?.optionsRight??['','']) as string[],keywords:((question?.answerKey?.keywords??[]) as string[]).join(', '),
    legacyRegex:question?.answerKey?.regex as string|undefined,replaceLegacyRegex:false,pairs:(question?.answerKey?.pairs??[]) as number[][],
    sortOrder:(question?.sortOrder??nextOrder) as number,
  };
}

// ─── Question editor dialog ───────────────────────────────────────────────────
function QuestionDialog({ trainingId, modules, objectives, question, nextOrder, onClose, onSaved }: {
  trainingId: number; modules: Module[]; objectives: Objective[]; question: Question | null; nextOrder: number; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const [type, setType] = useState<string>(question?.type ?? "qcu");
  const [text, setText] = useState(question?.question ?? "");
  const [options, setOptions] = useState<string[]>(question?.options ?? ["", ""]);
  const [correct, setCorrect] = useState<number[]>(question?.correctAnswer ?? []);
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [points, setPoints] = useState(question?.points ?? 1);
  const [moduleId, setModuleId] = useState<number | "">(question?.moduleId ?? "");
  const [objectiveId, setObjectiveId] = useState<number | "">(question?.objectiveId ?? "");
  const [optionsRight, setOptionsRight] = useState<string[]>((question as any)?.optionsRight ?? ["", ""]); // matching right column
  const [keywords, setKeywords] = useState<string>(((question as any)?.answerKey?.keywords ?? []).join(", ")); // free_text
  const [legacyRegex,setLegacyRegex] = useState((question as any)?.answerKey?.regex as string | undefined);
  const [replaceLegacyRegex, setReplaceLegacyRegex] = useState(false);
  const [pairs, setPairs] = useState<number[][]>((question as any)?.answerKey?.pairs ?? []); // matching: [leftIdx, rightIdx]

  const [sortOrder,setSortOrder]=useState(question?.sortOrder??nextOrder);
  const currentDraft={type,text,options,correct,explanation,points,moduleId,objectiveId,optionsRight,keywords,legacyRegex,replaceLegacyRegex,pairs,sortOrder};
  const draft=JSON.stringify(currentDraft);
  const baseline=useRef(questionDraft(question,nextOrder));
  const expectedRevision=useRef(question?.revision);
  const [comparison,setComparison]=useState<{latest:ReturnType<typeof questionDraft>;revision:number}|null>(null);
  const [comparing,setComparing]=useState(false);
  const initialDraft = useRef(draft);
  const saving = useRef(false);
  const pendingCreation = useRef<{ signature: string; requestId: string } | null>(null);
  const mounted = useRef(true);
  const [saveFailed, setSaveFailed] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const changeType = (next: string) => {
    if (next === 'true_false' && type !== next) { setOptions([t('adminContentManager.trueLabel'), t('adminContentManager.falseLabel')]); setCorrect([]); }
    setType(next);
  };

  const create = trpc.maker.content.questions.create.useMutation({ onSuccess: result => { if (mounted.current) { toast.success(t(result.archived ? "adminContentManager.questionRecoveredArchived" : result.replayed ? "adminContentManager.questionRecovered" : "adminContentManager.toastQuestionCreated")); onSaved(); } }, onError: (e) => { if (mounted.current) { setSaveFailed(true); toast.error(e.message); void utils.maker.content.questions.list.invalidate({ trainingId }); } }, onSettled: () => { saving.current = false; } });
  const update = trpc.maker.content.questions.update.useMutation({ onSuccess: () => { if (mounted.current) { toast.success(t("adminContentManager.toastQuestionUpdated")); onSaved(); } }, onError: (e) => { if (mounted.current) { setSaveFailed(true); toast.error(e.message); void utils.maker.content.questions.list.invalidate({ trainingId }); } }, onSettled: () => { saving.current = false; } });

  const toggleCorrect = (idx: number) => {
    if (type === "qcm") setCorrect((c) => (c.includes(idx) ? c.filter((i) => i !== idx) : [...c, idx]));
    else setCorrect([idx]);
  };

  const compareLatest=async()=>{
    if(!question||saving.current||comparison)return;
    saving.current=true;setComparing(true);
    try{
      const rows=await utils.maker.content.questions.list.fetch({trainingId});
      const latest=rows.find(row=>row.id===question.id);
      if(!latest)throw new Error(t('adminContentManager.questionUnavailable'));
      if(mounted.current)setComparison({latest:questionDraft(latest,nextOrder),revision:latest.revision});
    }catch(e){if(mounted.current)toast.error(e instanceof Error?e.message:t('courseMaker.readError'));}
    finally{saving.current=false;if(mounted.current)setComparing(false);}
  };
  const applyComparison=(merged:ReturnType<typeof questionDraft>)=>{
    if(!comparison)return;
    setType(merged.type);setText(merged.text);setOptions(merged.options);setCorrect(merged.correct);
    setExplanation(merged.explanation);setPoints(merged.points);setModuleId(merged.moduleId);setObjectiveId(merged.objectiveId);
    setOptionsRight(merged.optionsRight);setKeywords(merged.keywords);setLegacyRegex(merged.legacyRegex);setReplaceLegacyRegex(merged.replaceLegacyRegex);setPairs(merged.pairs);setSortOrder(merged.sortOrder);
    baseline.current=comparison.latest;expectedRevision.current=comparison.revision;initialDraft.current=JSON.stringify(comparison.latest);
    setComparison(null);setSaveFailed(false);update.reset();
  };
  const save = () => {
    if (saving.current || comparison) return;
    if (!text.trim()) return toast.error(t("adminContentManager.toastQuestionTextRequired"));
    const base = {
      question: text, type: type as any, explanation, points,
      moduleId: moduleId === "" ? null : Number(moduleId), objectiveId: objectiveId === "" ? null : Number(objectiveId),
      sortOrder,
    };
    let payload: any;
    if (type === "free_text") {
      const kw = keywords.split(",").map((s) => s.trim()).filter(Boolean);
      if (kw.length === 0 || !kw.every(isUsableKeyword)) return toast.error(t("adminContentManager.keywordsRequired"));
      if (legacyRegex && !replaceLegacyRegex) return toast.error(t("adminContentManager.confirmKeywordReplacement"));
      payload = { ...base, options: [], correctAnswer: [], answerKey: { keywords: kw } };
    } else if (type === "matching") {
      const checked = prepareMatchingAnswers(options, optionsRight, pairs);
      if (!checked.ok) return toast.error(t(checked.reason === 'options' ? 'adminContentManager.completeEveryOption' : 'adminContentManager.toastMatchEachLeftItem'));
      payload = { ...base, options: checked.options, optionsRight: checked.optionsRight, correctAnswer: [], answerKey: { pairs: checked.pairs } };
    } else {
      const checked = prepareChoiceAnswers(type, options, correct);
      if (!checked.ok) return toast.error(t(checked.reason === 'options' ? 'adminContentManager.completeEveryOption' : 'adminContentManager.checkCorrectAnswers'));
      payload = { ...base, options: checked.options, correctAnswer: checked.correctAnswer };
    }
    saving.current = true; setSaveFailed(false);
    if (question) update.mutate({ id: question.id, expectedRevision: expectedRevision.current, ...payload });
    else {
      const input = { trainingId, ...payload };
      const signature = JSON.stringify(input);
      if (pendingCreation.current?.signature !== signature) pendingCreation.current = { signature, requestId: createRequestId() };
      create.mutate({ ...input, requestId: pendingCreation.current.requestId });
    }
  };

  const busy = create.isPending || update.isPending || comparing || comparison!==null;
  const confirmExit = useDraftExitGuard(draft !== initialDraft.current || busy, t(busy ? 'courseMaker.leavePending' : 'courseMaker.leaveDraft'));
  const closeEditor = () => { if (!saving.current && confirmExit()) onClose(); };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) closeEditor(); }}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{question ? t("adminContentManager.questionDialogEditTitle") : t("adminContentManager.questionDialogNewTitle")}</DialogTitle></DialogHeader>
        <fieldset disabled={busy} className="space-y-3 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.questionTypeLabel")}</label>
              <select value={type} onChange={(e) => changeType(e.target.value)} className={selectCls} style={{ borderColor: "var(--border)" }}>
                {Object.entries(QUESTION_TYPE_KEYS).map(([v, k]) => <option key={v} value={v}>{t(k)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.questionModuleLabel")}</label>
              <select value={moduleId} onChange={(e) => setModuleId(e.target.value === "" ? "" : Number(e.target.value))} className={selectCls} style={{ borderColor: "var(--border)" }}>
                <option value="">{t("adminContentManager.questionModuleFinalExam")}</option>
                {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.questionObjectiveLabel")}</label>
            <select value={objectiveId} onChange={(e) => setObjectiveId(e.target.value === "" ? "" : Number(e.target.value))} className={selectCls} style={{ borderColor: "var(--border)" }}>
              <option value="">{t("adminContentManager.questionObjectiveNone")}</option>
              {objectives.map((o) => <option key={o.id} value={o.id}>{o.code ? `${o.code} · ` : ""}{o.title}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.questionTextLabel")}</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm h-20 resize-y" style={{ borderColor: "var(--border)" }} />
          </div>
          {(type === "qcm" || type === "qcu" || type === "true_false") && (
            <div>
              <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>
                {type === "qcm" ? t("adminContentManager.answersLabelMulti") : t("adminContentManager.answersLabelSingle")}
              </label>
              <div className="space-y-2">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <button type="button" onClick={() => toggleCorrect(idx)} title={t("adminContentManager.markCorrectAnswerTitle")} className="w-6 h-6 rounded-full border flex items-center justify-center shrink-0" style={{ borderColor: correct.includes(idx) ? "var(--success)" : "var(--border)", background: correct.includes(idx) ? "color-mix(in srgb, var(--success) 18%, transparent)" : "transparent" }}>
                      {correct.includes(idx) && <Check className="w-3.5 h-3.5 text-background" />}
                    </button>
                    <Input value={opt} onChange={(e) => setOptions((o) => o.map((x, i) => (i === idx ? e.target.value : x)))} placeholder={t("adminContentManager.answerPlaceholder", { n: idx + 1 })} />
                    {type !== "true_false" && options.length > 2 && (
                      <button type="button" onClick={() => { setOptions((o) => o.filter((_, i) => i !== idx)); setCorrect((c) => c.filter((i) => i !== idx).map((i) => (i > idx ? i - 1 : i))); }} className="text-destructive shrink-0"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                ))}
              </div>
              {type !== "true_false" && (
                <button type="button" onClick={() => setOptions((o) => [...o, ""])} className="text-sm mt-2 flex items-center gap-1" style={{ color: "var(--link)" }}><Plus className="w-3 h-3" /> {t("adminContentManager.addAnswerButton")}</button>
              )}
            </div>
          )}

          {type === "free_text" && (
            <div className="space-y-2">
              <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.keywordsLabel")}</label>
              <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={t("adminContentManager.keywordsPlaceholder")} />
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.keywordGradingHint")}</p>
              {legacyRegex && <div className="rounded border border-warning/30 bg-warning/10 p-3 space-y-2">
                <p className="text-sm">{t("adminContentManager.legacyRegexHint")}</p>
                <code className="block break-all text-xs">{legacyRegex}</code>
                <label className="flex gap-2 items-start text-sm"><input type="checkbox" checked={replaceLegacyRegex} onChange={e => setReplaceLegacyRegex(e.target.checked)} />{t("adminContentManager.replaceLegacyRegex")}</label>
              </div>}
            </div>
          )}

          {type === "matching" && (
            <div className="space-y-3">
              <div>
                <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.matchingLeftColumnLabel")}</label>
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-1">
                    <Input value={opt} onChange={(e) => setOptions((o) => o.map((x, i) => (i === idx ? e.target.value : x)))} placeholder={t("adminContentManager.itemPlaceholder", { n: idx + 1 })} />
                    <button type="button" onClick={() => { setOptions((o) => o.filter((_, i) => i !== idx)); setPairs((p) => removeMatchingOption(p, idx, 0)); }} className="text-destructive shrink-0"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setOptions((o) => [...o, ""])} className="text-sm flex items-center gap-1" style={{ color: "var(--link)" }}><Plus className="w-3 h-3" /> {t("adminContentManager.addLeftItemButton")}</button>
              </div>
              <div>
                <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.matchingRightColumnLabel")}</label>
                {optionsRight.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-1">
                    <Input value={opt} onChange={(e) => setOptionsRight((o) => o.map((x, i) => (i === idx ? e.target.value : x)))} placeholder={t("adminContentManager.answerPlaceholder", { n: idx + 1 })} />
                    <button type="button" onClick={() => { setOptionsRight((o) => o.filter((_, i) => i !== idx)); setPairs(p => removeMatchingOption(p, idx, 1)); }} className="text-destructive shrink-0"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setOptionsRight((o) => [...o, ""])} className="text-sm flex items-center gap-1" style={{ color: "var(--link)" }}><Plus className="w-3 h-3" /> {t("adminContentManager.addRightItemButton")}</button>
              </div>
              <div>
                <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.matchingCorrectPairsLabel")}</label>
                {options.map((left, li) => {
                  const cur = pairs.find((p) => p[0] === li)?.[1];
                  return (
                    <div key={li} className="flex items-center gap-2 mb-1">
                      <span className="text-sm flex-1 min-w-0 truncate" style={{ color: "var(--foreground)" }}>{left || t("adminContentManager.itemPlaceholder", { n: li + 1 })}</span>
                      <span style={{ color: "var(--muted-foreground)" }}>→</span>
                      <select value={cur ?? ""} onChange={(e) => setPairs((p) => { const others = p.filter((x) => x[0] !== li); return e.target.value === "" ? others : [...others, [li, Number(e.target.value)]]; })} className={selectCls} style={{ borderColor: "var(--border)" }}>
                        <option value="">—</option>
                        {optionsRight.map((r, ri) => <option key={ri} value={ri}>{r || t("adminContentManager.answerPlaceholder", { n: ri + 1 })}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.pointsLabel")}</label>
              <Input type="number" min={1} value={points} onChange={(e) => setPoints(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.explanationLabel")}</label>
            <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm h-16 resize-y" style={{ borderColor: "var(--border)" }} />
          </div>
        </fieldset>
        {(create.isPending || update.isPending) && <p role="status" className="text-sm mt-3">{t('adminContentManager.questionSaving')}</p>}
        {saveFailed && <p role="alert" className="text-sm text-warning mt-3">{t(question ? 'adminContentManager.questionUpdateFailed' : 'adminContentManager.questionSaveFailed')}</p>}
        {update.error?.data?.code==='CONFLICT' && <div className="mt-3 space-y-3"><p role="alert" className="text-sm text-warning">{t("adminContentManager.questionEditConflict")}</p><Button variant="outline" disabled={busy} onClick={()=>{void compareLatest();}}>{t('courseMaker.compareVersions')}</Button></div>}
        {comparison && <DraftConflictResolution kind="question" base={baseline.current} draft={currentDraft} latest={comparison.latest} onCancel={()=>setComparison(null)} onApply={applyComparison}/>}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" disabled={busy} onClick={closeEditor}>{t("adminContentManager.cancelButton")}</Button>
          <Button onClick={save} disabled={busy} style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>{t("adminContentManager.saveButton")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Objective editor dialog (Part-66 sub-module) ────────────────────────────
function objectiveDraft(objective:Objective|null,nextOrder:number){return {
    code: objective?.code ?? "",
    title: objective?.title ?? "",
    description: objective?.description ?? "",
    knowledgeLevel: (objective?.knowledgeLevel ?? "1") as "1" | "2" | "3",
    isRequired: objective?.isRequired ?? true,
    sortOrder: objective?.sortOrder ?? nextOrder,
    moduleId: (objective?.moduleId ?? "") as number | "",
  };}
function ObjectiveDialog({ trainingId, modules, objective, nextOrder, onClose, onSaved }: {
  trainingId: number; modules: Module[]; objective: Objective | null; nextOrder: number; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const expectedRevision = useRef(objective?.revision);
  const [form,setForm]=useState(()=>objectiveDraft(objective,nextOrder));
  const initialDraft=useRef(JSON.stringify(form));
  const saving=useRef(false);
  const pendingCreation=useRef<{signature:string;requestId:string}|null>(null);
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const baseline=useRef(objectiveDraft(objective,nextOrder));
  const [comparison,setComparison]=useState<{latest:ReturnType<typeof objectiveDraft>;revision:number}|null>(null);
  const [comparing,setComparing]=useState(false);

  const create = trpc.maker.content.objectives.create.useMutation({ onSuccess: result => { if(mounted.current){if(result.archived)toast.info(t("adminContentManager.objectiveRecoveredArchived"));else toast.success(t(result.replayed?"adminContentManager.objectiveRecovered":"adminContentManager.toastObjectiveCreated")); onSaved();} }, onError: (e) => {if(mounted.current)toast.error(e.message);}, onSettled:()=>{saving.current=false;} });
  const update = trpc.maker.content.objectives.update.useMutation({ onSuccess: () => { if(mounted.current){toast.success(t("adminContentManager.toastObjectiveUpdated")); onSaved();} }, onError: (e) => { if(mounted.current)toast.error(e.message); void utils.maker.content.objectives.list.invalidate({trainingId}); }, onSettled:()=>{saving.current=false;} });

  const compareLatest=async()=>{
    if(!objective||saving.current||comparison)return;
    saving.current=true;
    setComparing(true);
    try {
      const rows=await utils.maker.content.objectives.list.fetch({trainingId});
      const latest=rows.find(row=>row.id===objective.id);
      if(!latest)throw new Error(t('adminContentManager.objectiveUnavailable'));
      if(mounted.current)setComparison({latest:objectiveDraft(latest,nextOrder),revision:latest.revision});
    }catch(e){if(mounted.current)toast.error(e instanceof Error?e.message:t('courseMaker.readError'));}
    finally{saving.current=false;if(mounted.current)setComparing(false);}
  };
  const save = () => {
    if(saving.current||comparison)return;
    if (!form.title.trim()) return toast.error(t("adminContentManager.toastTitleRequired"));
    saving.current=true;
    const payload = { ...form, moduleId: form.moduleId === "" ? null : Number(form.moduleId) };
    if (objective) update.mutate({ id: objective.id, expectedRevision: expectedRevision.current, ...payload });
    else {
      const input={trainingId,...payload},signature=JSON.stringify(input);
      if(pendingCreation.current?.signature!==signature)pendingCreation.current={signature,requestId:createRequestId()};
      create.mutate({...input,requestId:pendingCreation.current.requestId});
    }
  };

  const pending=create.isPending||update.isPending||comparing||comparison!==null;
  const confirmExit=useDraftExitGuard(JSON.stringify(form)!==initialDraft.current||pending,t(pending?'courseMaker.leavePending':'courseMaker.leaveDraft'));
  const closeEditor=()=>{if(!saving.current&&confirmExit())onClose();};
  return (
    <Dialog open onOpenChange={(o) => {if(!o)closeEditor();}}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{objective ? t("adminContentManager.objectiveDialogEditTitle") : t("adminContentManager.objectiveDialogNewTitle")}</DialogTitle></DialogHeader>
        {update.error && <p role="alert" className="text-sm text-destructive">{update.error.data?.code === 'CONFLICT' ? t('adminContentManager.objectiveEditConflict') : update.error.message}</p>}
        {update.error?.data?.code==='CONFLICT'&&!comparison&&<Button variant="outline" disabled={comparing} onClick={compareLatest}>{t('courseMaker.compareVersions')}</Button>}
        {comparison&&<DraftConflictResolution kind="objective" base={baseline.current} draft={form} latest={comparison.latest} onCancel={()=>setComparison(null)} onApply={merged=>{setForm(merged);baseline.current=comparison.latest;expectedRevision.current=comparison.revision;initialDraft.current=JSON.stringify(comparison.latest);setComparison(null);update.reset();}}/>}
        <fieldset disabled={comparing||!!comparison||create.isPending||update.isPending} className="space-y-3 mt-2">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.objectiveCodeLabel")}</label>
              <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="9.1" />
            </div>
            <div className="col-span-2">
              <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.knowledgeLevelLabel")}</label>
              <select value={form.knowledgeLevel} onChange={(e) => setForm((f) => ({ ...f, knowledgeLevel: e.target.value as "1" | "2" | "3" }))} className={selectCls} style={{ borderColor: "var(--border)" }}>
                <option value="1">{t("adminContentManager.knowledgeLevel1")}</option>
                <option value="2">{t("adminContentManager.knowledgeLevel2")}</option>
                <option value="3">{t("adminContentManager.knowledgeLevel3")}</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.objectiveTitleLabel")}</label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder={t("adminContentManager.objectiveTitlePlaceholder")} />
          </div>
          <div>
            <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.descriptionLabel")}</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full rounded-md border px-3 py-2 text-sm h-20 resize-y" style={{ borderColor: "var(--border)" }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.objectiveSubmoduleLabel")}</label>
              <select value={form.moduleId} onChange={(e) => setForm((f) => ({ ...f, moduleId: e.target.value === "" ? "" : Number(e.target.value) }))} className={selectCls} style={{ borderColor: "var(--border)" }}>
                <option value="">{t("adminContentManager.objectiveSubmoduleNone")}</option>
                {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.orderLabel")}</label>
              <Input type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
            <input type="checkbox" checked={form.isRequired} onChange={(e) => setForm((f) => ({ ...f, isRequired: e.target.checked }))} />
            {t("adminContentManager.objectiveRequiredLabel")}
          </label>
        </fieldset>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" disabled={create.isPending||update.isPending||comparing} onClick={closeEditor}>{t("adminContentManager.cancelButton")}</Button>
          <Button onClick={save} disabled={create.isPending || update.isPending || comparing || !!comparison} style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>{t("adminContentManager.saveButton")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main content manager ─────────────────────────────────────────────────────
export default function AdminContentManager({ trainings }: { trainings: { id: number; title: string }[] }) {
  const { t } = useI18n();
  const [trainingId, setTrainingId] = useState<number | null>(null);
  const [moduleDialog, setModuleDialog] = useState<{ module: Module | null } | null>(null);
  const [questionDialog, setQuestionDialog] = useState<{ question: Question | null } | null>(null);
  const [objectiveDialog, setObjectiveDialog] = useState<{ objective: Objective | null } | null>(null);

  useEffect(() => {
    if (trainingId === null && trainings.length > 0) setTrainingId(trainings[0].id);
  }, [trainings, trainingId]);

  const utils = trpc.useUtils();
  const modulesQuery = trpc.maker.content.modules.list.useQuery({ trainingId: trainingId! }, { enabled: trainingId != null });
  const questionsQuery = trpc.maker.content.questions.list.useQuery({ trainingId: trainingId! }, { enabled: trainingId != null });
  const objectivesQuery = trpc.maker.content.objectives.list.useQuery({ trainingId: trainingId! }, { enabled: trainingId != null });
  const modules = (modulesQuery.data ?? []) as Module[];
  const questions = (questionsQuery.data ?? []) as Question[];
  const objectives = (objectivesQuery.data ?? []) as Objective[];


  const reorderingModules=useRef(false);
  const reorderModules=trpc.maker.content.modules.reorder.useMutation({onError:e=>toast.error(e.message),onSettled:()=>{reorderingModules.current=false;void utils.maker.content.modules.list.invalidate();void utils.maker.readiness.invalidate();}});
  const moveModule=(index:number,direction:-1|1)=>{
    if(reorderingModules.current||modulesQuery.isFetching||modulesQuery.isError)return;
    const target=index+direction;if(target<0||target>=modules.length)return;
    const ordered=[...modules];[ordered[index],ordered[target]]=[ordered[target],ordered[index]];
    reorderingModules.current=true;reorderModules.mutate({orderedIds:ordered.map(row=>row.id),expectedRevisions:ordered.map(row=>row.revision)});
  };
  const reorderingObjectives=useRef(false);
  const reorderObjectives=trpc.maker.content.objectives.reorder.useMutation({onError:e=>toast.error(e.message),onSettled:()=>{reorderingObjectives.current=false;void utils.maker.content.objectives.list.invalidate();void utils.maker.readiness.invalidate();}});
  const moveObjective=(index:number,direction:-1|1)=>{
    if(reorderingObjectives.current||objectivesQuery.isFetching||objectivesQuery.isError)return;
    const target=index+direction;if(target<0||target>=objectives.length)return;
    const ordered=[...objectives];[ordered[index],ordered[target]]=[ordered[target],ordered[index]];
    reorderingObjectives.current=true;reorderObjectives.mutate({orderedIds:ordered.map(row=>row.id),expectedSortOrders:ordered.map(row=>row.sortOrder)});
  };
  const archiveModule = trpc.maker.content.modules.delete.useMutation({ onSuccess: () => { toast.success(t("contentArchive.done")); refetchAll(); }, onError: e => toast.error(e.message) });
  const archiveQuestion = trpc.maker.content.questions.delete.useMutation({ onSuccess: () => { toast.success(t("contentArchive.done")); refetchAll(); }, onError: e => toast.error(e.message) });
  const archiveObjective = trpc.maker.content.objectives.delete.useMutation({ onSuccess: () => { toast.success(t("contentArchive.done")); refetchAll(); }, onError: e => toast.error(e.message) });
  const refetchAll = () => {
    if (trainingId == null) return;
    utils.maker.readiness.invalidate({ trainingId });
    utils.maker.content.modules.list.invalidate({ trainingId });
    utils.maker.content.questions.list.invalidate({ trainingId });
    utils.maker.content.objectives.list.invalidate({ trainingId });
  };

  const moduleName = (id: number | null) => (id == null ? t("adminContentManager.finalExam") : modules.find((m) => m.id === id)?.title ?? "—");

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <h2 className="font-semibold" style={{ color: "var(--foreground)" }}>{t("adminContentManager.heading")}</h2>
        <select
          value={trainingId ?? ""}
          onChange={(e) => setTrainingId(Number(e.target.value))}
          className="h-9 rounded-md border px-3 text-sm min-w-72"
          style={{ borderColor: "var(--border)" }}
        >
          {trainings.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
      </div>

      {trainingId == null ? (
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.selectTraining")}</p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Objectives (Part-66 backbone) — full width */}
          <div className="rounded-xl p-5 lg:col-span-2" style={{ background: "var(--card)", border: `1px solid ${"var(--border)"}` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4" style={{ color: "var(--link)" }} />
                <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{t("adminContentManager.objectivesSectionTitle", { count: objectives.length })}</h3>
              </div>
              <Button size="sm" variant="outline" onClick={() => setObjectiveDialog({ objective: null })}>
                <Plus className="w-4 h-4 mr-1" /> {t("adminContentManager.objectiveButton")}
              </Button>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {objectives.length === 0 && <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.objectivesEmpty")}</p>}
              {objectives.map((o,index) => (
                <div key={o.id} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: "var(--background)" }}>
                  <div className="flex flex-col gap-1">
                    <button type="button" aria-label={t('adminContentManager.moveObjectiveUp',{title:o.title})} disabled={index===0||reorderObjectives.isPending||objectivesQuery.isFetching} onClick={()=>moveObjective(index,-1)} className="text-muted-foreground disabled:opacity-30"><ChevronUp className="w-4 h-4"/></button>
                    <button type="button" aria-label={t('adminContentManager.moveObjectiveDown',{title:o.title})} disabled={index===objectives.length-1||reorderObjectives.isPending||objectivesQuery.isFetching} onClick={()=>moveObjective(index,1)} className="text-muted-foreground disabled:opacity-30"><ChevronDown className="w-4 h-4"/></button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                      {o.code ? <span style={{ color: "var(--link)" }}>{o.code} · </span> : null}{o.title}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                      {t("adminContentManager.objectiveLevelPrefix", { level: o.knowledgeLevel ?? "1" })} · {moduleName(o.moduleId)}{o.isRequired ? ` · ${t("adminContentManager.requiredSuffix")}` : ""}
                    </div>
                  </div>
                  <button onClick={() => setObjectiveDialog({ objective: o })} className="p-1.5 rounded hover:bg-foreground/5" style={{ color: "var(--muted-foreground)" }}><Pencil className="w-4 h-4" /></button>
                  <button title={t("contentArchive.action")} onClick={() => { if (confirm(t("contentArchive.confirm"))) archiveObjective.mutate({ id: o.id }); }} className="p-1.5 rounded hover:bg-foreground/5"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Modules */}
          <div className="rounded-xl p-5" style={{ background: "var(--card)", border: `1px solid ${"var(--border)"}` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" style={{ color: "var(--link)" }} />
                <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{t("adminContentManager.modulesSectionTitle", { count: modules.length })}</h3>
              </div>
              <Button size="sm" variant="outline" onClick={() => setModuleDialog({ module: null })}>
                <Plus className="w-4 h-4 mr-1" /> {t("adminContentManager.moduleButton")}
              </Button>
            </div>
            <div className="space-y-2">
              {modules.length === 0 && <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.modulesEmpty")}</p>}
              {modules.map((m,index) => (
                <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "var(--background)" }}>
                  <div className="flex flex-col shrink-0">
                    <button type="button" aria-label={t('adminContentManager.moveModuleUp',{title:m.title})} disabled={index===0||reorderModules.isPending||modulesQuery.isFetching} onClick={()=>moveModule(index,-1)} className="text-muted-foreground disabled:opacity-30"><ChevronUp className="w-4 h-4"/></button>
                    <button type="button" aria-label={t('adminContentManager.moveModuleDown',{title:m.title})} disabled={index===modules.length-1||reorderModules.isPending||modulesQuery.isFetching} onClick={()=>moveModule(index,1)} className="text-muted-foreground disabled:opacity-30"><ChevronDown className="w-4 h-4"/></button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{m.sortOrder}. {m.title}</div>
                    <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.moduleDurationMinutes", { minutes: m.durationMinutes ?? 0 })}{m.isRequired ? ` · ${t("adminContentManager.requiredModuleSuffix")}` : ""}</div>
                  </div>
                  <button onClick={() => setModuleDialog({ module: m })} className="p-1.5 rounded hover:bg-foreground/5" style={{ color: "var(--muted-foreground)" }}><Pencil className="w-4 h-4" /></button>
                  <button title={t("contentArchive.action")} onClick={() => { if (confirm(t("contentArchive.confirm"))) archiveModule.mutate({ id: m.id }); }} className="p-1.5 rounded hover:bg-foreground/5"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Questions */}
          <div className="rounded-xl p-5" style={{ background: "var(--card)", border: `1px solid ${"var(--border)"}` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4" style={{ color: "var(--link)" }} />
                <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{t("adminContentManager.questionsSectionTitle", { count: questions.length })}</h3>
              </div>
              <Button size="sm" variant="outline" onClick={() => setQuestionDialog({ question: null })}>
                <Plus className="w-4 h-4 mr-1" /> {t("adminContentManager.questionButton")}
              </Button>
            </div>
            <div className="space-y-2">
              {questions.length === 0 && <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t("adminContentManager.questionsEmpty")}</p>}
              {questions.map((q) => (
                <div key={q.id} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: "var(--background)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{q.question}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                      {t(QUESTION_TYPE_KEYS[q.type])} · {t("adminContentManager.pointsAbbrev", { points: q.points ?? 1 })} · {moduleName(q.moduleId)}
                    </div>
                  </div>
                  <button onClick={() => setQuestionDialog({ question: q })} className="p-1.5 rounded hover:bg-foreground/5" style={{ color: "var(--muted-foreground)" }}><Pencil className="w-4 h-4" /></button>
                  <button title={t("contentArchive.action")} onClick={() => { if (confirm(t("contentArchive.confirm"))) archiveQuestion.mutate({ id: q.id }); }} className="p-1.5 rounded hover:bg-foreground/5"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {moduleDialog && trainingId != null && (
        <ModuleDialog
          key={`${trainingId}:${moduleDialog.module?.id ?? "new"}`}
          trainingId={trainingId}
          module={moduleDialog.module}
          nextOrder={modules.length + 1}
          onClose={() => setModuleDialog(null)}
          onSaved={() => { setModuleDialog(null); refetchAll(); }}
        />
      )}
      {questionDialog && trainingId != null && (
        <QuestionDialog
          key={`${trainingId}:${questionDialog.question?.id ?? "new"}`}
          trainingId={trainingId}
          modules={modules}
          objectives={objectives}
          question={questionDialog.question}
          nextOrder={questions.length + 1}
          onClose={() => setQuestionDialog(null)}
          onSaved={() => { setQuestionDialog(null); refetchAll(); }}
        />
      )}
      {objectiveDialog && trainingId != null && (
        <ObjectiveDialog
          trainingId={trainingId}
          modules={modules}
          objective={objectiveDialog.objective}
          nextOrder={objectives.length + 1}
          onClose={() => setObjectiveDialog(null)}
          onSaved={() => { setObjectiveDialog(null); refetchAll(); }}
        />
      )}
    </div>
  );
}
