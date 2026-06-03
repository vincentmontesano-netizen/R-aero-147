import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, GripVertical, HelpCircle, FileText, Check, Target } from "lucide-react";
import { toast } from "sonner";

const DEEP_BLUE = "oklch(19% 0.08 252)";
const GOLD = "oklch(68% 0.1 78)";
const MUTED = "oklch(45% 0.02 240)";
const BORDER = "oklch(88% 0.015 88)";

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
  id: number; trainingId: number; title: string; description: string | null; content: string | null;
  videoUrl: string | null; pdfUrl: string | null; durationMinutes: number | null; sortOrder: number | null; isRequired: boolean | null;
};
type Question = {
  id: number; trainingId: number; moduleId: number | null; objectiveId: number | null; question: string; type: string;
  options: string[] | null; correctAnswer: number[] | null; explanation: string | null; points: number | null; sortOrder: number | null;
};
type Objective = {
  id: number; trainingId: number; moduleId: number | null; code: string | null; title: string;
  description: string | null; knowledgeLevel: string | null; isRequired: boolean | null; sortOrder: number | null;
};

// ─── Module editor dialog ─────────────────────────────────────────────────────
function ModuleDialog({ trainingId, module, nextOrder, onClose, onSaved }: {
  trainingId: number; module: Module | null; nextOrder: number; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    title: module?.title ?? "",
    description: module?.description ?? "",
    content: module?.content ?? "",
    videoUrl: module?.videoUrl ?? "",
    pdfUrl: module?.pdfUrl ?? "",
    durationMinutes: module?.durationMinutes ?? 30,
    sortOrder: module?.sortOrder ?? nextOrder,
    isRequired: module?.isRequired ?? true,
  });
  const create = trpc.admin.modules.create.useMutation({ onSuccess: () => { toast.success(t("adminContentManager.toastModuleCreated")); onSaved(); }, onError: (e) => toast.error(e.message) });
  const update = trpc.admin.modules.update.useMutation({ onSuccess: () => { toast.success(t("adminContentManager.toastModuleUpdated")); onSaved(); }, onError: (e) => toast.error(e.message) });

  const save = () => {
    if (!form.title.trim()) return toast.error(t("adminContentManager.toastTitleRequired"));
    if (module) update.mutate({ id: module.id, ...form });
    else create.mutate({ trainingId, ...form });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{module ? t("adminContentManager.moduleDialogEditTitle") : t("adminContentManager.moduleDialogNewTitle")}</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <label className={labelCls} style={{ color: MUTED }}>{t("adminContentManager.moduleTitleLabel")}</label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder={t("adminContentManager.moduleTitlePlaceholder")} />
          </div>
          <div>
            <label className={labelCls} style={{ color: MUTED }}>{t("adminContentManager.moduleShortDescriptionLabel")}</label>
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls} style={{ color: MUTED }}>{t("adminContentManager.moduleContentLabel")}</label>
            <textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} className="w-full rounded-md border px-3 py-2 text-sm h-36 resize-y" style={{ borderColor: BORDER }} placeholder={t("adminContentManager.moduleContentPlaceholder")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={{ color: MUTED }}>{t("adminContentManager.moduleVideoLabel")}</label>
              <Input value={form.videoUrl} onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))} placeholder="https://…" />
            </div>
            <div>
              <label className={labelCls} style={{ color: MUTED }}>{t("adminContentManager.modulePdfLabel")}</label>
              <Input value={form.pdfUrl} onChange={(e) => setForm((f) => ({ ...f, pdfUrl: e.target.value }))} placeholder="https://…" />
            </div>
            <div>
              <label className={labelCls} style={{ color: MUTED }}>{t("adminContentManager.moduleDurationLabel")}</label>
              <Input type="number" value={form.durationMinutes} onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))} />
            </div>
            <div>
              <label className={labelCls} style={{ color: MUTED }}>{t("adminContentManager.orderLabel")}</label>
              <Input type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm" style={{ color: MUTED }}>
            <input type="checkbox" checked={form.isRequired} onChange={(e) => setForm((f) => ({ ...f, isRequired: e.target.checked }))} />
            {t("adminContentManager.moduleRequiredLabel")}
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>{t("adminContentManager.cancelButton")}</Button>
          <Button onClick={save} disabled={create.isPending || update.isPending} style={{ background: DEEP_BLUE, color: "white" }}>{t("adminContentManager.saveButton")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Question editor dialog ───────────────────────────────────────────────────
function QuestionDialog({ trainingId, modules, objectives, question, nextOrder, onClose, onSaved }: {
  trainingId: number; modules: Module[]; objectives: Objective[]; question: Question | null; nextOrder: number; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useI18n();
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
  const [regex, setRegex] = useState<string>((question as any)?.answerKey?.regex ?? "");
  const [pairs, setPairs] = useState<number[][]>((question as any)?.answerKey?.pairs ?? []); // matching: [leftIdx, rightIdx]

  useEffect(() => {
    if (type === "true_false") { setOptions(["Vrai", "Faux"]); setCorrect((c) => c.filter((i) => i < 2)); }
  }, [type]);

  const create = trpc.admin.questions.create.useMutation({ onSuccess: () => { toast.success(t("adminContentManager.toastQuestionCreated")); onSaved(); }, onError: (e) => toast.error(e.message) });
  const update = trpc.admin.questions.update.useMutation({ onSuccess: () => { toast.success(t("adminContentManager.toastQuestionUpdated")); onSaved(); }, onError: (e) => toast.error(e.message) });

  const toggleCorrect = (idx: number) => {
    if (type === "qcm") setCorrect((c) => (c.includes(idx) ? c.filter((i) => i !== idx) : [...c, idx]));
    else setCorrect([idx]);
  };

  const save = () => {
    if (!text.trim()) return toast.error(t("adminContentManager.toastQuestionTextRequired"));
    const base = {
      question: text, type: type as any, explanation, points,
      moduleId: moduleId === "" ? null : Number(moduleId), objectiveId: objectiveId === "" ? null : Number(objectiveId),
      sortOrder: question?.sortOrder ?? nextOrder,
    };
    let payload: any;
    if (type === "free_text") {
      const kw = keywords.split(",").map((s) => s.trim()).filter(Boolean);
      if (kw.length === 0 && !regex.trim()) return toast.error(t("adminContentManager.toastKeywordsOrRegexRequired"));
      payload = { ...base, options: [], correctAnswer: [], answerKey: { keywords: kw, regex: regex.trim() || undefined } };
    } else if (type === "matching") {
      const left = options.map((o) => o.trim()).filter(Boolean);
      const right = optionsRight.map((o) => o.trim()).filter(Boolean);
      if (left.length < 2 || right.length < 2) return toast.error(t("adminContentManager.toastTwoItemsEachSide"));
      const cleanPairs = pairs.filter((p) => p[0] < left.length && p[1] < right.length);
      if (cleanPairs.length < left.length) return toast.error(t("adminContentManager.toastMatchEachLeftItem"));
      payload = { ...base, options: left, optionsRight: right, correctAnswer: [], answerKey: { pairs: cleanPairs } };
    } else {
      const cleanOptions = type === "true_false" ? ["Vrai", "Faux"] : options.map((o) => o.trim()).filter(Boolean);
      if (cleanOptions.length < 2) return toast.error(t("adminContentManager.toastTwoAnswersRequired"));
      const validCorrect = correct.filter((i) => i < cleanOptions.length);
      if (validCorrect.length === 0) return toast.error(t("adminContentManager.toastCorrectAnswerRequired"));
      payload = { ...base, options: cleanOptions, correctAnswer: validCorrect.sort() };
    }
    if (question) update.mutate({ id: question.id, ...payload });
    else create.mutate({ trainingId, ...payload });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{question ? t("adminContentManager.questionDialogEditTitle") : t("adminContentManager.questionDialogNewTitle")}</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={{ color: MUTED }}>{t("adminContentManager.questionTypeLabel")}</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className={selectCls} style={{ borderColor: BORDER }}>
                {Object.entries(QUESTION_TYPE_KEYS).map(([v, k]) => <option key={v} value={v}>{t(k)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} style={{ color: MUTED }}>{t("adminContentManager.questionModuleLabel")}</label>
              <select value={moduleId} onChange={(e) => setModuleId(e.target.value === "" ? "" : Number(e.target.value))} className={selectCls} style={{ borderColor: BORDER }}>
                <option value="">{t("adminContentManager.questionModuleFinalExam")}</option>
                {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls} style={{ color: MUTED }}>{t("adminContentManager.questionObjectiveLabel")}</label>
            <select value={objectiveId} onChange={(e) => setObjectiveId(e.target.value === "" ? "" : Number(e.target.value))} className={selectCls} style={{ borderColor: BORDER }}>
              <option value="">{t("adminContentManager.questionObjectiveNone")}</option>
              {objectives.map((o) => <option key={o.id} value={o.id}>{o.code ? `${o.code} · ` : ""}{o.title}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls} style={{ color: MUTED }}>{t("adminContentManager.questionTextLabel")}</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm h-20 resize-y" style={{ borderColor: BORDER }} />
          </div>
          {(type === "qcm" || type === "qcu" || type === "true_false") && (
            <div>
              <label className={labelCls} style={{ color: MUTED }}>
                {type === "qcm" ? t("adminContentManager.answersLabelMulti") : t("adminContentManager.answersLabelSingle")}
              </label>
              <div className="space-y-2">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <button type="button" onClick={() => toggleCorrect(idx)} title={t("adminContentManager.markCorrectAnswerTitle")} className="w-6 h-6 rounded-full border flex items-center justify-center shrink-0" style={{ borderColor: correct.includes(idx) ? "oklch(55% 0.18 145)" : BORDER, background: correct.includes(idx) ? "oklch(55% 0.18 145)" : "transparent" }}>
                      {correct.includes(idx) && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                    <Input value={opt} disabled={type === "true_false"} onChange={(e) => setOptions((o) => o.map((x, i) => (i === idx ? e.target.value : x)))} placeholder={t("adminContentManager.answerPlaceholder", { n: idx + 1 })} />
                    {type !== "true_false" && options.length > 2 && (
                      <button type="button" onClick={() => { setOptions((o) => o.filter((_, i) => i !== idx)); setCorrect((c) => c.filter((i) => i !== idx).map((i) => (i > idx ? i - 1 : i))); }} className="text-red-500 shrink-0"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                ))}
              </div>
              {type !== "true_false" && (
                <button type="button" onClick={() => setOptions((o) => [...o, ""])} className="text-xs mt-2 flex items-center gap-1" style={{ color: GOLD }}><Plus className="w-3 h-3" /> {t("adminContentManager.addAnswerButton")}</button>
              )}
            </div>
          )}

          {type === "free_text" && (
            <div className="space-y-2">
              <label className={labelCls} style={{ color: MUTED }}>{t("adminContentManager.keywordsLabel")}</label>
              <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={t("adminContentManager.keywordsPlaceholder")} />
              <label className={labelCls} style={{ color: MUTED }}>{t("adminContentManager.regexLabel")}</label>
              <Input value={regex} onChange={(e) => setRegex(e.target.value)} placeholder="ex. \b(HF|facteurs?\s+humains?)\b" className="font-mono" />
              <p className="text-[11px]" style={{ color: MUTED }}>{t("adminContentManager.freeTextHint")}</p>
            </div>
          )}

          {type === "matching" && (
            <div className="space-y-3">
              <div>
                <label className={labelCls} style={{ color: MUTED }}>{t("adminContentManager.matchingLeftColumnLabel")}</label>
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-1">
                    <Input value={opt} onChange={(e) => setOptions((o) => o.map((x, i) => (i === idx ? e.target.value : x)))} placeholder={t("adminContentManager.itemPlaceholder", { n: idx + 1 })} />
                    <button type="button" onClick={() => { setOptions((o) => o.filter((_, i) => i !== idx)); setPairs((p) => p.filter((x) => x[0] !== idx)); }} className="text-red-500 shrink-0"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setOptions((o) => [...o, ""])} className="text-xs flex items-center gap-1" style={{ color: GOLD }}><Plus className="w-3 h-3" /> {t("adminContentManager.addLeftItemButton")}</button>
              </div>
              <div>
                <label className={labelCls} style={{ color: MUTED }}>{t("adminContentManager.matchingRightColumnLabel")}</label>
                {optionsRight.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-1">
                    <Input value={opt} onChange={(e) => setOptionsRight((o) => o.map((x, i) => (i === idx ? e.target.value : x)))} placeholder={t("adminContentManager.answerPlaceholder", { n: idx + 1 })} />
                    <button type="button" onClick={() => setOptionsRight((o) => o.filter((_, i) => i !== idx))} className="text-red-500 shrink-0"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setOptionsRight((o) => [...o, ""])} className="text-xs flex items-center gap-1" style={{ color: GOLD }}><Plus className="w-3 h-3" /> {t("adminContentManager.addRightItemButton")}</button>
              </div>
              <div>
                <label className={labelCls} style={{ color: MUTED }}>{t("adminContentManager.matchingCorrectPairsLabel")}</label>
                {options.map((left, li) => {
                  const cur = pairs.find((p) => p[0] === li)?.[1];
                  return (
                    <div key={li} className="flex items-center gap-2 mb-1">
                      <span className="text-sm flex-1 min-w-0 truncate" style={{ color: DEEP_BLUE }}>{left || t("adminContentManager.itemPlaceholder", { n: li + 1 })}</span>
                      <span style={{ color: MUTED }}>→</span>
                      <select value={cur ?? ""} onChange={(e) => setPairs((p) => { const others = p.filter((x) => x[0] !== li); return e.target.value === "" ? others : [...others, [li, Number(e.target.value)]]; })} className={selectCls} style={{ borderColor: BORDER }}>
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
              <label className={labelCls} style={{ color: MUTED }}>{t("adminContentManager.pointsLabel")}</label>
              <Input type="number" min={1} value={points} onChange={(e) => setPoints(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <label className={labelCls} style={{ color: MUTED }}>{t("adminContentManager.explanationLabel")}</label>
            <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm h-16 resize-y" style={{ borderColor: BORDER }} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>{t("adminContentManager.cancelButton")}</Button>
          <Button onClick={save} disabled={create.isPending || update.isPending} style={{ background: DEEP_BLUE, color: "white" }}>{t("adminContentManager.saveButton")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Objective editor dialog (Part-66 sub-module) ────────────────────────────
function ObjectiveDialog({ trainingId, modules, objective, nextOrder, onClose, onSaved }: {
  trainingId: number; modules: Module[]; objective: Objective | null; nextOrder: number; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    code: objective?.code ?? "",
    title: objective?.title ?? "",
    description: objective?.description ?? "",
    knowledgeLevel: (objective?.knowledgeLevel ?? "1") as "1" | "2" | "3",
    isRequired: objective?.isRequired ?? true,
    sortOrder: objective?.sortOrder ?? nextOrder,
    moduleId: (objective?.moduleId ?? "") as number | "",
  });
  const create = trpc.admin.objectives.create.useMutation({ onSuccess: () => { toast.success(t("adminContentManager.toastObjectiveCreated")); onSaved(); }, onError: (e) => toast.error(e.message) });
  const update = trpc.admin.objectives.update.useMutation({ onSuccess: () => { toast.success(t("adminContentManager.toastObjectiveUpdated")); onSaved(); }, onError: (e) => toast.error(e.message) });

  const save = () => {
    if (!form.title.trim()) return toast.error(t("adminContentManager.toastTitleRequired"));
    const payload = { ...form, moduleId: form.moduleId === "" ? null : Number(form.moduleId) };
    if (objective) update.mutate({ id: objective.id, ...payload });
    else create.mutate({ trainingId, ...payload });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{objective ? t("adminContentManager.objectiveDialogEditTitle") : t("adminContentManager.objectiveDialogNewTitle")}</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls} style={{ color: MUTED }}>{t("adminContentManager.objectiveCodeLabel")}</label>
              <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="9.1" />
            </div>
            <div className="col-span-2">
              <label className={labelCls} style={{ color: MUTED }}>{t("adminContentManager.knowledgeLevelLabel")}</label>
              <select value={form.knowledgeLevel} onChange={(e) => setForm((f) => ({ ...f, knowledgeLevel: e.target.value as "1" | "2" | "3" }))} className={selectCls} style={{ borderColor: BORDER }}>
                <option value="1">{t("adminContentManager.knowledgeLevel1")}</option>
                <option value="2">{t("adminContentManager.knowledgeLevel2")}</option>
                <option value="3">{t("adminContentManager.knowledgeLevel3")}</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls} style={{ color: MUTED }}>{t("adminContentManager.objectiveTitleLabel")}</label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder={t("adminContentManager.objectiveTitlePlaceholder")} />
          </div>
          <div>
            <label className={labelCls} style={{ color: MUTED }}>{t("adminContentManager.descriptionLabel")}</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full rounded-md border px-3 py-2 text-sm h-20 resize-y" style={{ borderColor: BORDER }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={{ color: MUTED }}>{t("adminContentManager.objectiveSubmoduleLabel")}</label>
              <select value={form.moduleId} onChange={(e) => setForm((f) => ({ ...f, moduleId: e.target.value === "" ? "" : Number(e.target.value) }))} className={selectCls} style={{ borderColor: BORDER }}>
                <option value="">{t("adminContentManager.objectiveSubmoduleNone")}</option>
                {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} style={{ color: MUTED }}>{t("adminContentManager.orderLabel")}</label>
              <Input type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm" style={{ color: MUTED }}>
            <input type="checkbox" checked={form.isRequired} onChange={(e) => setForm((f) => ({ ...f, isRequired: e.target.checked }))} />
            {t("adminContentManager.objectiveRequiredLabel")}
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>{t("adminContentManager.cancelButton")}</Button>
          <Button onClick={save} disabled={create.isPending || update.isPending} style={{ background: DEEP_BLUE, color: "white" }}>{t("adminContentManager.saveButton")}</Button>
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
  const modulesQuery = trpc.admin.modules.list.useQuery({ trainingId: trainingId! }, { enabled: trainingId != null });
  const questionsQuery = trpc.admin.questions.list.useQuery({ trainingId: trainingId! }, { enabled: trainingId != null });
  const objectivesQuery = trpc.admin.objectives.list.useQuery({ trainingId: trainingId! }, { enabled: trainingId != null });
  const modules = (modulesQuery.data ?? []) as Module[];
  const questions = (questionsQuery.data ?? []) as Question[];
  const objectives = (objectivesQuery.data ?? []) as Objective[];

  const deleteModule = trpc.admin.modules.delete.useMutation({
    onSuccess: () => { toast.success(t("adminContentManager.toastModuleDeleted")); refetchAll(); },
  });
  const deleteQuestion = trpc.admin.questions.delete.useMutation({
    onSuccess: () => { toast.success(t("adminContentManager.toastQuestionDeleted")); refetchAll(); },
  });
  const deleteObjective = trpc.admin.objectives.delete.useMutation({
    onSuccess: () => { toast.success(t("adminContentManager.toastObjectiveDeleted")); refetchAll(); },
  });

  const refetchAll = () => {
    if (trainingId == null) return;
    utils.admin.modules.list.invalidate({ trainingId });
    utils.admin.questions.list.invalidate({ trainingId });
    utils.admin.objectives.list.invalidate({ trainingId });
  };

  const moduleName = (id: number | null) => (id == null ? t("adminContentManager.finalExam") : modules.find((m) => m.id === id)?.title ?? "—");

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <h2 className="font-semibold" style={{ color: DEEP_BLUE }}>{t("adminContentManager.heading")}</h2>
        <select
          value={trainingId ?? ""}
          onChange={(e) => setTrainingId(Number(e.target.value))}
          className="h-9 rounded-md border px-3 text-sm min-w-72"
          style={{ borderColor: BORDER }}
        >
          {trainings.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
      </div>

      {trainingId == null ? (
        <p className="text-sm" style={{ color: MUTED }}>{t("adminContentManager.selectTraining")}</p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Objectives (Part-66 backbone) — full width */}
          <div className="rounded-xl p-5 lg:col-span-2" style={{ background: "white", border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4" style={{ color: GOLD }} />
                <h3 className="font-semibold text-sm" style={{ color: DEEP_BLUE }}>{t("adminContentManager.objectivesSectionTitle", { count: objectives.length })}</h3>
              </div>
              <Button size="sm" variant="outline" onClick={() => setObjectiveDialog({ objective: null })}>
                <Plus className="w-4 h-4 mr-1" /> {t("adminContentManager.objectiveButton")}
              </Button>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {objectives.length === 0 && <p className="text-xs" style={{ color: MUTED }}>{t("adminContentManager.objectivesEmpty")}</p>}
              {objectives.map((o) => (
                <div key={o.id} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: "oklch(97% 0.01 88)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: DEEP_BLUE }}>
                      {o.code ? <span style={{ color: GOLD }}>{o.code} · </span> : null}{o.title}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: MUTED }}>
                      {t("adminContentManager.objectiveLevelPrefix", { level: o.knowledgeLevel ?? "1" })} · {moduleName(o.moduleId)}{o.isRequired ? ` · ${t("adminContentManager.requiredSuffix")}` : ""}
                    </div>
                  </div>
                  <button onClick={() => setObjectiveDialog({ objective: o })} className="p-1.5 rounded hover:bg-black/5" style={{ color: MUTED }}><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => { if (confirm(t("adminContentManager.confirmDeleteObjective", { title: o.title }))) deleteObjective.mutate({ id: o.id }); }} className="p-1.5 rounded hover:bg-black/5 text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Modules */}
          <div className="rounded-xl p-5" style={{ background: "white", border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" style={{ color: GOLD }} />
                <h3 className="font-semibold text-sm" style={{ color: DEEP_BLUE }}>{t("adminContentManager.modulesSectionTitle", { count: modules.length })}</h3>
              </div>
              <Button size="sm" variant="outline" onClick={() => setModuleDialog({ module: null })}>
                <Plus className="w-4 h-4 mr-1" /> {t("adminContentManager.moduleButton")}
              </Button>
            </div>
            <div className="space-y-2">
              {modules.length === 0 && <p className="text-xs" style={{ color: MUTED }}>{t("adminContentManager.modulesEmpty")}</p>}
              {modules.map((m) => (
                <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "oklch(97% 0.01 88)" }}>
                  <GripVertical className="w-4 h-4 shrink-0" style={{ color: "oklch(75% 0.02 240)" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: DEEP_BLUE }}>{m.sortOrder}. {m.title}</div>
                    <div className="text-xs" style={{ color: MUTED }}>{t("adminContentManager.moduleDurationMinutes", { minutes: m.durationMinutes ?? 0 })}{m.isRequired ? ` · ${t("adminContentManager.requiredModuleSuffix")}` : ""}</div>
                  </div>
                  <button onClick={() => setModuleDialog({ module: m })} className="p-1.5 rounded hover:bg-black/5" style={{ color: MUTED }}><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => { if (confirm(t("adminContentManager.confirmDeleteModule", { title: m.title }))) deleteModule.mutate({ id: m.id }); }} className="p-1.5 rounded hover:bg-black/5 text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Questions */}
          <div className="rounded-xl p-5" style={{ background: "white", border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4" style={{ color: GOLD }} />
                <h3 className="font-semibold text-sm" style={{ color: DEEP_BLUE }}>{t("adminContentManager.questionsSectionTitle", { count: questions.length })}</h3>
              </div>
              <Button size="sm" variant="outline" onClick={() => setQuestionDialog({ question: null })}>
                <Plus className="w-4 h-4 mr-1" /> {t("adminContentManager.questionButton")}
              </Button>
            </div>
            <div className="space-y-2">
              {questions.length === 0 && <p className="text-xs" style={{ color: MUTED }}>{t("adminContentManager.questionsEmpty")}</p>}
              {questions.map((q) => (
                <div key={q.id} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: "oklch(97% 0.01 88)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: DEEP_BLUE }}>{q.question}</div>
                    <div className="text-xs mt-0.5" style={{ color: MUTED }}>
                      {t(QUESTION_TYPE_KEYS[q.type])} · {t("adminContentManager.pointsAbbrev", { points: q.points ?? 1 })} · {moduleName(q.moduleId)}
                    </div>
                  </div>
                  <button onClick={() => setQuestionDialog({ question: q })} className="p-1.5 rounded hover:bg-black/5" style={{ color: MUTED }}><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => { if (confirm(t("adminContentManager.confirmDeleteQuestion"))) deleteQuestion.mutate({ id: q.id }); }} className="p-1.5 rounded hover:bg-black/5 text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {moduleDialog && trainingId != null && (
        <ModuleDialog
          trainingId={trainingId}
          module={moduleDialog.module}
          nextOrder={modules.length + 1}
          onClose={() => setModuleDialog(null)}
          onSaved={() => { setModuleDialog(null); refetchAll(); }}
        />
      )}
      {questionDialog && trainingId != null && (
        <QuestionDialog
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
