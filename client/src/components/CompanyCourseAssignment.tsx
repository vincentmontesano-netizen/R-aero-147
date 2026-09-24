import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
export default function CompanyCourseAssignment({ trainingId, published }: { trainingId: number; published: boolean }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<number[]>([]);
  const [result, setResult] = useState<{ created: number; existing: number } | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const sending = useRef(false);
  const candidates = trpc.maker.distributionCandidates.useQuery({ trainingId });
  const available = new Set(candidates.data?.map(person => person.id));
  const unavailableCount = selected.filter(id => !available.has(id)).length;
  const listUnavailable = candidates.isLoading || candidates.isError || !candidates.data;
  const assign = trpc.maker.assign.useMutation({
    onSuccess: response => { setResult(response); toast.success(t("assignment.result", response)); setSelected([]); },
    onError: error => { setUnconfirmed(true); toast.error(error.message); void candidates.refetch(); },
    onSettled: () => { sending.current = false; },
  });
  const send = () => {
    if (sending.current || !published || listUnavailable || candidates.isFetching || unavailableCount || !selected.length || selected.length > 100) return;
    sending.current = true; setResult(null); setUnconfirmed(false);
    assign.mutate({ trainingId, userIds: [...selected] });
  };
  return <section className="rounded-xl bg-card border p-4 mb-4">
    <h3 className="font-semibold mb-2">{t("assignment.title")}</h3>
    <p className="text-sm text-muted-foreground mb-3">{t("assignment.hint")}</p>
    <Button size="sm" variant="outline" className="mb-3" disabled={assign.isPending || candidates.isFetching} onClick={() => { void candidates.refetch(); }}>{t("assignment.refresh")}</Button>
    {candidates.isLoading && <p role="status">{t("common.loading")}</p>}
    {candidates.isError && <p role="alert" className="text-sm text-destructive">{t("assignment.readError")}</p>}
    {!listUnavailable && <fieldset disabled={assign.isPending || candidates.isFetching} className="max-h-48 overflow-auto grid gap-2">
      {candidates.data?.map(person => <label key={person.id} className="flex gap-2 items-center text-sm"><input type="checkbox" disabled={selected.length >= 100 && !selected.includes(person.id)} checked={selected.includes(person.id)} onChange={e => {
        if (sending.current) return;
        const checked = e.target.checked;
        setResult(null);
        setSelected(current => checked ? current.length < 100 && !current.includes(person.id) ? [...current, person.id] : current : current.filter(id => id !== person.id));
      }} />{person.name || person.email || `#${person.id}`}</label>)}
      {candidates.data?.length === 0 && <p className="text-sm">{t("assignment.empty")}</p>}
    </fieldset>}
    <p className="text-sm mt-3">{t("assignment.selected", { count: selected.length })}</p>
    {!listUnavailable && unavailableCount > 0 && <div className="space-y-2 mt-3">
      <p role="alert" className="text-sm text-warning">{t("assignment.unavailable", { count: unavailableCount })}</p>
      <Button variant="outline" size="sm" disabled={assign.isPending || candidates.isFetching} onClick={() => { if (!sending.current) setSelected(current => current.filter(id => available.has(id))); }}>{t("assignment.removeUnavailable")}</Button>
    </div>}
    {!published && <p className="text-sm mt-3">{t("assignment.publishFirst")}</p>}
    {unconfirmed && <p role="alert" className="text-sm text-warning mt-3">{t("assignment.unconfirmed")}</p>}
    {result && <p role="status" className="text-sm mt-3">{t("assignment.result", result)}</p>}
    <Button className="mt-3" disabled={!published || listUnavailable || candidates.isFetching || unavailableCount > 0 || selected.length === 0 || selected.length > 100 || assign.isPending} onClick={send}>{assign.isPending ? t("assignment.sending") : t("assignment.action")}</Button>
  </section>;
}
