import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import QuoteThread from "./QuoteThread";

const BLUE = "oklch(19% 0.08 252)";
const GOLD = "oklch(68% 0.1 78)";
const MUTED = "oklch(45% 0.02 240)";
const BORDER = "oklch(88% 0.015 88)";

type Line = { trainingId: number; title: string; quantity: number; unitPriceHt: number; unitPriceTtc: number };

/** Admin panel for a quote: message thread + conversion to a Stripe order. */
export default function QuoteManageDialog({ quote, meId, onClose }: { quote: any | null; meId: number; onClose: () => void }) {
  const { t } = useI18n();
  const { data: trainings = [] } = trpc.admin.trainings.list.useQuery(undefined, { enabled: quote != null });
  const [items, setItems] = useState<Line[]>([]);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const convert = trpc.admin.quotes.convert.useMutation({
    onSuccess: (r: any) => { toast.success(t("quoteManageDialog.orderCreated")); setPayUrl(r?.url ?? null); },
    onError: (e) => toast.error(e.message),
  });

  const lineFrom = (t: any): Line => ({ trainingId: t.id, title: t.title, quantity: 1, unitPriceHt: Number(t.priceHt ?? 0), unitPriceTtc: Number(t.priceTtc ?? 0) });
  const addItem = () => { if (trainings[0]) setItems((x) => [...x, lineFrom(trainings[0])]); };
  const upd = (idx: number, patch: Partial<Line>) => setItems((x) => x.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const totalTtc = items.reduce((s, i) => s + i.unitPriceTtc * (i.quantity || 0), 0);

  return (
    <Dialog open={quote != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t("quoteManageDialog.title", { company: quote?.companyName })}</DialogTitle></DialogHeader>
        {quote && (
          <div className="space-y-5 mt-1">
            <div className="text-xs" style={{ color: MUTED }}>
              {quote.contactName} — {quote.contactEmail}{quote.employeeCount ? ` · ${t("quoteManageDialog.employeeCount", { count: quote.employeeCount })}` : ""}
              {quote.trainingTypes && <> · <span style={{ color: BLUE }}>{t("quoteManageDialog.requested", { types: quote.trainingTypes })}</span></>}
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-2" style={{ color: BLUE }}>{t("quoteManageDialog.messaging")}</h3>
              <QuoteThread quoteId={quote.id} meId={meId} />
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-2" style={{ color: BLUE }}>{t("quoteManageDialog.convertToOrder")}</h3>
              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select value={it.trainingId} onChange={(e) => { const t = trainings.find((x: any) => x.id === Number(e.target.value)); if (t) upd(idx, lineFrom(t)); }}
                      className="h-8 rounded-md border px-2 text-xs flex-1 min-w-0" style={{ borderColor: BORDER }}>
                      {trainings.map((t: any) => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </select>
                    <Input type="number" min={1} value={it.quantity} onChange={(e) => upd(idx, { quantity: Number(e.target.value) })} className="h-8 w-16" title={t("quoteManageDialog.quantity")} />
                    <Input type="number" min={0} step="0.01" value={it.unitPriceTtc} onChange={(e) => upd(idx, { unitPriceTtc: Number(e.target.value), unitPriceHt: +(Number(e.target.value) / 1.2).toFixed(2) })} className="h-8 w-24" title={t("quoteManageDialog.unitPriceTtc")} />
                    <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-500 shrink-0"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <button onClick={addItem} className="text-xs flex items-center gap-1" style={{ color: GOLD }}><Plus className="w-3 h-3" /> {t("quoteManageDialog.addTraining")}</button>
              </div>
              {items.length > 0 && (
                <div className="flex items-center justify-between mt-3">
                  <span className="text-sm font-medium" style={{ color: BLUE }}>{t("quoteManageDialog.totalTtc", { amount: totalTtc.toFixed(2) })}</span>
                  <Button size="sm" disabled={convert.isPending} style={{ background: BLUE, color: "white" }}
                    onClick={() => convert.mutate({ quoteId: quote.id, origin: window.location.origin, items })}>
                    <CreditCard className="w-4 h-4 mr-1" /> {t("quoteManageDialog.createOrderAndPaymentLink")}
                  </Button>
                </div>
              )}
              {payUrl && (
                <div className="text-xs mt-3 p-2 rounded" style={{ background: "oklch(97% 0.01 88)", color: MUTED }}>
                  {t("quoteManageDialog.paymentLinkLabel")}{" "}
                  <a href={payUrl} className="underline" style={{ color: BLUE }}>{payUrl}</a>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
