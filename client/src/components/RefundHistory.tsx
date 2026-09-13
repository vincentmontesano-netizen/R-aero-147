import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
export default function RefundHistory({ orderId }: { orderId: number }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const history = trpc.checkout.refunds.useQuery({ orderId }, { enabled: open });
  return <details className="text-xs mt-2" onToggle={e => setOpen(e.currentTarget.open)}><summary className="cursor-pointer">{t("refund.history")}</summary>
    {history.error ? <p role="alert">{history.error.message}</p> : history.isLoading ? <p>{t("common.loading")}</p> : <ul className="mt-2 space-y-1">{history.data?.map((r, index) => <li key={index}>{new Date(r.eventCreated * 1000).toLocaleString(lang)} · {t("refund.cumulative", { amount: (r.refundedCents / 100).toFixed(2) })}</li>)}</ul>}
  </details>;
}
