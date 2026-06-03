import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Star } from "lucide-react";
import { toast } from "sonner";

const BLUE = "oklch(19% 0.08 252)";
const MUTED = "oklch(45% 0.02 240)";
const BORDER = "oklch(88% 0.015 88)";

type Draft = { language: string; name: string; price: string; description: string; features: string; ctaLabel: string; ctaHref: string; highlight: boolean; sortOrder: number };
const blank = (lang: string): Draft => ({ language: lang, name: "", price: "", description: "", features: "", ctaLabel: "", ctaHref: "/devis", highlight: false, sortOrder: 0 });

/** Admin module: manage landing-page pricing offers (bilingual). */
export default function AdminOffers() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const [lang, setLang] = useState("fr");
  const [draft, setDraft] = useState<Draft>(blank("fr"));
  const { data: offers = [] } = trpc.admin.offers.list.useQuery({ language: lang });
  const inv = () => { utils.admin.offers.list.invalidate(); utils.public.offers.invalidate(); };
  const toArr = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

  const create = trpc.admin.offers.create.useMutation({ onSuccess: () => { toast.success(t("adminOffers.created")); setDraft(blank(lang)); inv(); }, onError: (e) => toast.error(e.message) });
  const update = trpc.admin.offers.update.useMutation({ onSuccess: () => { toast.success(t("adminOffers.saved")); inv(); }, onError: (e) => toast.error(e.message) });
  const del = trpc.admin.offers.delete.useMutation({ onSuccess: () => { toast.success(t("adminOffers.deleted")); inv(); }, onError: (e) => toast.error(e.message) });

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h2 className="font-semibold" style={{ color: BLUE }}>{t("adminOffers.title")}</h2>
        <div className="flex gap-1 rounded-lg p-0.5" style={{ background: "oklch(93% 0.015 88)" }}>
          {["fr", "en"].map((l) => (
            <button key={l} onClick={() => { setLang(l); setDraft(blank(l)); }} className="text-xs px-3 py-1 rounded-md font-medium" style={lang === l ? { background: "white", color: BLUE } : { color: MUTED }}>{l.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {/* New offer */}
      <div className="rounded-xl p-4 mb-5 max-w-2xl" style={{ background: "white", border: `1px solid ${BORDER}` }}>
        <div className="text-sm font-semibold mb-2" style={{ color: BLUE }}>{t("adminOffers.newOffer")}</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={t("adminOffers.name")} />
          <Input value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder={t("adminOffers.price")} />
          <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder={t("adminOffers.description")} className="sm:col-span-2" />
          <div className="sm:col-span-2">
            <label className="text-[11px]" style={{ color: MUTED }}>{t("adminOffers.features")}</label>
            <Textarea value={draft.features} onChange={(e) => setDraft({ ...draft, features: e.target.value })} placeholder={t("adminOffers.featuresHint")} rows={4} />
          </div>
          <Input value={draft.ctaLabel} onChange={(e) => setDraft({ ...draft, ctaLabel: e.target.value })} placeholder={t("adminOffers.ctaLabel")} />
          <Input value={draft.ctaHref} onChange={(e) => setDraft({ ...draft, ctaHref: e.target.value })} placeholder={t("adminOffers.ctaHref")} />
          <Input type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })} placeholder={t("adminOffers.sortOrder")} />
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: MUTED }}>
            <input type="checkbox" checked={draft.highlight} onChange={(e) => setDraft({ ...draft, highlight: e.target.checked })} /> {t("adminOffers.highlight")}
          </label>
        </div>
        <Button size="sm" className="mt-3" disabled={!draft.name.trim() || create.isPending} onClick={() => create.mutate({ ...draft, features: toArr(draft.features) })} style={{ background: BLUE, color: "white" }}><Plus className="w-4 h-4 mr-1" /> {t("adminOffers.add")}</Button>
      </div>

      {/* Existing */}
      <div className="space-y-2 max-w-2xl">
        {(offers as any[]).length === 0 && <p className="text-sm" style={{ color: MUTED }}>{t("adminOffers.empty")}</p>}
        {(offers as any[]).map((o) => (
          <div key={o.id} className="rounded-xl p-4" style={{ background: "white", border: `1px solid ${BORDER}` }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input defaultValue={o.name} onBlur={(e) => e.target.value !== o.name && update.mutate({ id: o.id, name: e.target.value })} />
              <Input defaultValue={o.price ?? ""} onBlur={(e) => update.mutate({ id: o.id, price: e.target.value })} placeholder={t("adminOffers.price")} />
              <Input defaultValue={o.description ?? ""} onBlur={(e) => update.mutate({ id: o.id, description: e.target.value })} placeholder={t("adminOffers.description")} className="sm:col-span-2" />
              <div className="sm:col-span-2">
                <label className="text-[11px]" style={{ color: MUTED }}>{t("adminOffers.features")}</label>
                <Textarea defaultValue={(o.features ?? []).join("\n")} onBlur={(e) => update.mutate({ id: o.id, features: toArr(e.target.value) })} rows={4} />
              </div>
              <Input defaultValue={o.ctaLabel ?? ""} onBlur={(e) => update.mutate({ id: o.id, ctaLabel: e.target.value })} placeholder={t("adminOffers.ctaLabel")} />
              <Input defaultValue={o.ctaHref ?? ""} onBlur={(e) => update.mutate({ id: o.id, ctaHref: e.target.value })} placeholder={t("adminOffers.ctaHref")} />
              <Input type="number" defaultValue={o.sortOrder ?? 0} onBlur={(e) => update.mutate({ id: o.id, sortOrder: Number(e.target.value) })} />
            </div>
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <button onClick={() => update.mutate({ id: o.id, highlight: !o.highlight })} className="flex items-center gap-1 text-xs" style={{ color: o.highlight ? "oklch(68% 0.1 78)" : MUTED }}><Star className="w-3.5 h-3.5" fill={o.highlight ? "currentColor" : "none"} /> {t("adminOffers.highlight")}</button>
                <button onClick={() => update.mutate({ id: o.id, isActive: !o.isActive })} className="text-xs" style={{ color: o.isActive ? "oklch(55% 0.18 145)" : MUTED }}>{o.isActive ? t("adminOffers.active") : t("adminOffers.inactive")}</button>
              </div>
              <button onClick={() => { if (confirm(t("adminOffers.confirmDelete"))) del.mutate({ id: o.id }); }} className="text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
