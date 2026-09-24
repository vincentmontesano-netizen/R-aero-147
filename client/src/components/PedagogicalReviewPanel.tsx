import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
export default function PedagogicalReviewPanel({ trainingId }: { trainingId: number }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const reviews = trpc.maker.reviews.list.useQuery({ trainingId });
  const [selected, setSelected] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const snapshot = trpc.maker.reviews.snapshot.useQuery({ reviewId: selected! }, { enabled: selected != null });
  const request = trpc.maker.reviews.request.useMutation({ onSuccess: () => { reviews.refetch(); toast.success(t("review.requested")); }, onError: e => toast.error(e.message) });
  const withdraw = trpc.maker.reviews.withdraw.useMutation({ onSuccess: () => { reviews.refetch(); utils.maker.courses.invalidate(); setSelected(null); setNote(""); }, onError: e => toast.error(e.message) });
  const decide = trpc.maker.reviews.decide.useMutation({ onSuccess: () => { reviews.refetch(); utils.maker.reviews.pending.invalidate(); setSelected(null); setNote(""); }, onError: e => toast.error(e.message) });
  const record = reviews.data?.find(r => r.id === selected);
  const curriculum = snapshot.data?.snapshot;
  const independent = snapshot.data && user?.id !== snapshot.data.requestedBy && user?.id !== curriculum?.training.ownerUserId;
  return <section className="border rounded-xl bg-card p-4 mb-4">
    <h3 className="font-semibold">{t("review.title")}</h3><p className="text-sm my-2">{t("review.help")}</p>
    <Button size="sm" variant="outline" disabled={request.isPending} onClick={() => request.mutate({ trainingId })}>{t("review.request")}</Button>
    {reviews.isError && <p role="alert">{reviews.error.message}</p>}
    {reviews.data?.map(r => <div key={r.id} className="flex gap-3 items-center mt-2 text-sm"><span>{new Date(r.createdAt).toLocaleString(lang)} · {t(`review.${r.withdrawnAt ? "withdrawn" : r.decision ?? "pending"}`)}</span><Button size="sm" variant="ghost" onClick={() => { setSelected(r.id); setNote(""); }}>{t("review.inspect")}</Button></div>)}
    <Dialog open={selected != null} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{t("review.title")} · {curriculum?.training.title}</DialogTitle></DialogHeader>
      {snapshot.isError && <p role="alert">{snapshot.error.message}</p>}
      {curriculum && <div className="space-y-4 text-sm">
        <p>{curriculum.training.description}</p>
        <p>{t("review.policy", { score: curriculum.training.passingScore ?? 75, attempts: curriculum.training.maxAttempts ?? 3, minutes: curriculum.training.examTimeLimitMin ?? "—" })}</p>
        {curriculum.objectives.map(o => <p key={o.id}>{o.code} · {o.title} · {o.knowledgeLevel}<br />{o.description}</p>)}
        {curriculum.modules.map(m => <section key={m.id} className="border p-3 rounded"><h4 className="font-semibold">{m.title}</h4><p className="whitespace-pre-wrap">{m.content}</p><p>{t("review.policy", { score: m.quizPassingScore ?? 75, attempts: m.quizMaxAttempts ?? 3, minutes: m.quizTimeLimitMin ?? "—" })}</p>{[m.pdfUrl, m.videoUrl].filter(Boolean).map(url => (url!.startsWith("https://") || url!.startsWith("/storage/")) && <a key={url} className="block underline" href={url!} target="_blank" rel="noreferrer">{t("review.support")}</a>)}</section>)}
        {curriculum.slides.map(s => <section key={s.id} className="border p-3 rounded"><h4 className="font-semibold">{s.title}</h4><p className="whitespace-pre-wrap">{s.body}</p>{s.quizQuestion && <div><p>{s.quizQuestion}</p>{s.quizOptions?.map((o, i) => <p key={i}>{o}{s.quizCorrect?.includes(i) ? " ✓" : ""}</p>)}<p>{s.quizExplanation}</p></div>}{[s.imageUrl, s.audioUrl, s.videoUrl].filter(Boolean).map(url => (url!.startsWith("https://") || url!.startsWith("/storage/")) && <a key={url} className="block underline" href={url!} target="_blank" rel="noreferrer">{t("review.support")}</a>)}</section>)}
        {curriculum.questions.map(q => <section key={q.id} className="border p-3 rounded"><h4 className="font-semibold">{q.moduleId == null ? t("review.final") : curriculum.modules.find(m => m.id === q.moduleId)?.title} · {q.question}</h4><ol>{q.options?.map((o, i) => <li key={i}>{i + 1}. {o}{q.correctAnswer?.includes(i) ? " ✓" : ""}</li>)}</ol>{q.optionsRight?.map((o, i) => <p key={i}>{i + 1}. {o}</p>)}{q.answerKey && <pre className="whitespace-pre-wrap">{JSON.stringify(q.answerKey, null, 2)}</pre>}<p>{q.explanation}</p></section>)}
        {record?.note && <p className="border p-3">{record.note}</p>}
        {record?.withdrawalReason && <p className="border p-3">{t("review.withdrawn")} · {record.withdrawalReason}</p>}
        {record?.decision === "approved" && !record.withdrawnAt && <div className="border p-3 space-y-2"><p>{t("review.withdrawHelp")}</p><Textarea value={note} onChange={e => setNote(e.target.value)} maxLength={4000} placeholder={t("review.withdrawReason")} /><Button variant="destructive" disabled={note.trim().length < 10 || withdraw.isPending} onClick={() => { if (window.confirm(t("review.withdrawConfirm"))) withdraw.mutate({ reviewId: selected!, reason: note }); }}>{t("review.withdraw")}</Button></div>}
        {!record?.decision && independent && <div className="space-y-2"><Textarea value={note} onChange={e => setNote(e.target.value)} placeholder={t("review.note")} maxLength={4000} /><div className="flex gap-2">{(["approved", "rejected"] as const).map(decision => <Button key={decision} variant={decision === "approved" ? "default" : "outline"} disabled={!note.trim() || decide.isPending} onClick={() => decide.mutate({ reviewId: selected!, decision, note })}>{t(`review.${decision}`)}</Button>)}</div></div>}
      </div>}
    </DialogContent></Dialog>
  </section>;
}
