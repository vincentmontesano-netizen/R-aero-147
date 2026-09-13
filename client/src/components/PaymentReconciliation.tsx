import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function PaymentReconciliation({ orderId, sessionId }: { orderId: number; sessionId?: string | null }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [candidate, setCandidate] = useState("");
  const utils = trpc.useUtils();
  const history = trpc.admin.payments.history.useQuery({ orderId }, { enabled: open });
  const reconcile = trpc.admin.payments.reconcile.useMutation({
    onSuccess: result => {
      toast.success(t("reconcile.updated", { status: t(`reconcile.status.${result.status}`) }));
      utils.admin.orders.invalidate();
      history.refetch();
    },
    onError: error => { toast.error(error.message); history.refetch(); },
  });
  return <details onToggle={e => setOpen(e.currentTarget.open)} className="mt-2 min-w-52 font-sans">
    <summary className="cursor-pointer text-xs underline">{t("reconcile.title")}</summary>
    {open && <div className="space-y-2 py-2 max-w-sm text-xs">
      <p>{t("reconcile.help")}</p>
      {sessionId ? <p className="font-mono break-all">{sessionId}</p> : <label className="block">{t("reconcile.session")}<Input className="mt-1" placeholder="cs_…" value={candidate} onChange={e => setCandidate(e.target.value.trim())} /></label>}
      <Button size="sm" variant="outline" disabled={reconcile.isPending || (!sessionId && !candidate)} onClick={() => reconcile.mutate({ orderId, sessionId: sessionId ? undefined : candidate })}>{reconcile.isPending ? t("reconcile.loading") : t("reconcile.action")}</Button>
      <p className="font-medium">{t("reconcile.history")}</p>
      {history.isError && <p role="alert">{history.error.message}</p>}
      {history.data?.length === 0 && <p>{t("reconcile.empty")}</p>}
      {history.data?.map(row => <p key={row.id}>{new Date(row.createdAt).toLocaleString(lang)} · {t("reconcile.actor", { id: row.actorId })} · {t(`reconcile.session.${row.sessionStatus}`)} / {t(`reconcile.status.${row.paymentStatus}`)}</p>)}
    </div>}
  </details>;
}
