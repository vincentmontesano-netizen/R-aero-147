import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const BLUE = "var(--foreground)";
const MUTED = "var(--muted-foreground)";
const BORDER = "var(--border)";

/** Admin module: manage landing-page FAQ (bilingual). */
export default function AdminFaq() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const [lang, setLang] = useState("fr");
  const [q, setQ] = useState(""); const [a, setA] = useState("");
  const { data: items = [] } = trpc.admin.faq.list.useQuery({ language: lang });
  const inv = () => { utils.admin.faq.list.invalidate(); utils.public.faq.invalidate(); };

  const create = trpc.admin.faq.create.useMutation({ onSuccess: () => { toast.success(t("adminFaq.created")); setQ(""); setA(""); inv(); }, onError: (e) => toast.error(e.message) });
  const update = trpc.admin.faq.update.useMutation({ onSuccess: () => { toast.success(t("adminFaq.saved")); inv(); }, onError: (e) => toast.error(e.message) });
  const del = trpc.admin.faq.delete.useMutation({ onSuccess: () => { toast.success(t("adminFaq.deleted")); inv(); }, onError: (e) => toast.error(e.message) });

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h2 className="font-semibold" style={{ color: "var(--foreground)" }}>{t("adminFaq.title")}</h2>
        <div className="flex gap-1 rounded-lg p-0.5" style={{ background: "var(--muted)" }}>
          {["fr", "en"].map((l) => (
            <button key={l} onClick={() => setLang(l)} className="text-sm px-3 py-1 rounded-md font-medium" style={lang === l ? { background: "var(--card)", color: "var(--foreground)" } : { color: "var(--muted-foreground)" }}>{l.toUpperCase()}</button>
          ))}
        </div>
      </div>

      <div className="rounded-xl p-4 mb-5 max-w-2xl" style={{ background: "var(--card)", border: `1px solid ${"var(--border)"}` }}>
        <div className="text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>{t("adminFaq.newItem")}</div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("adminFaq.question")} className="mb-2" />
        <Textarea value={a} onChange={(e) => setA(e.target.value)} placeholder={t("adminFaq.answer")} rows={3} />
        <Button size="sm" className="mt-3" disabled={!q.trim() || !a.trim() || create.isPending} onClick={() => create.mutate({ language: lang, question: q.trim(), answer: a.trim() })} style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}><Plus className="w-4 h-4 mr-1" /> {t("adminFaq.add")}</Button>
      </div>

      <div className="space-y-2 max-w-2xl">
        {(items as any[]).length === 0 && <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t("adminFaq.empty")}</p>}
        {(items as any[]).map((it) => (
          <div key={it.id} className="rounded-xl p-4" style={{ background: "var(--card)", border: `1px solid ${"var(--border)"}` }}>
            <Input defaultValue={it.question} onBlur={(e) => e.target.value !== it.question && update.mutate({ id: it.id, question: e.target.value })} className="mb-2 font-medium" />
            <Textarea defaultValue={it.answer} onBlur={(e) => e.target.value !== it.answer && update.mutate({ id: it.id, answer: e.target.value })} rows={3} />
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t("adminFaq.order")}</span>
                <Input type="number" defaultValue={it.sortOrder ?? 0} onBlur={(e) => update.mutate({ id: it.id, sortOrder: Number(e.target.value) })} className="h-7 w-20" />
                <button onClick={() => update.mutate({ id: it.id, isActive: !it.isActive })} className="text-sm" style={{ color: it.isActive ? "var(--success)" : "var(--muted-foreground)" }}>{it.isActive ? t("adminFaq.active") : t("adminFaq.inactive")}</button>
              </div>
              <button onClick={() => { if (confirm(t("adminFaq.confirmDelete"))) del.mutate({ id: it.id }); }} className="text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
