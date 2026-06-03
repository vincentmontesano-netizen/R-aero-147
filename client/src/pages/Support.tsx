import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BackButton from "@/components/BackButton";
import TicketThread from "@/components/TicketThread";
import { Plus, LogIn, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";

const BLUE = "oklch(19% 0.08 252)";
const MUTED = "oklch(45% 0.02 240)";
const BORDER = "oklch(88% 0.015 88)";

/** Learner support: create tickets + follow the conversation with R-AERO. */
export default function Support() {
  const { t } = useI18n();
  const STATUS: Record<string, [string, string]> = {
    OPEN: ["oklch(55% 0.18 145)", t("support.statusOpen")],
    PENDING: ["oklch(60% 0.12 78)", t("support.statusPending")],
    CLOSED: ["oklch(60% 0.02 240)", t("support.statusClosed")],
  };
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const { data: tickets = [], isLoading } = trpc.support.myList.useQuery(undefined, { enabled: !!user });
  const [open, setOpen] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ subject: "", message: "" });
  const create = trpc.support.create.useMutation({
    onSuccess: () => { toast.success(t("support.toastCreated")); setShowNew(false); setForm({ subject: "", message: "" }); utils.support.myList.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  if (!isAuthenticated) {
    return (
      <div className="container py-20 text-center">
        <p className="mb-4" style={{ color: MUTED }}>{t("support.loginPrompt")}</p>
        <a href={getLoginUrl()}><Button style={{ background: "oklch(68% 0.1 78)", color: BLUE }}><LogIn className="w-4 h-4 mr-1" /> {t("support.login")}</Button></a>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-3xl">
      <BackButton />
      <div className="flex items-center justify-between mb-1 mt-2">
        <h1 className="text-2xl font-bold" style={{ color: BLUE }}>{t("support.title")}</h1>
        <Button size="sm" onClick={() => setShowNew((s) => !s)} style={{ background: BLUE, color: "white" }}><Plus className="w-4 h-4 mr-1" /> {t("support.newRequest")}</Button>
      </div>
      <p className="text-sm mb-6" style={{ color: MUTED }}>{t("support.subtitle")}</p>

      {showNew && (
        <div className="rounded-xl p-4 mb-5 space-y-2" style={{ background: "white", border: `1px solid ${BORDER}` }}>
          <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder={t("support.subjectPlaceholder")} />
          <textarea value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder={t("support.messagePlaceholder")} className="w-full rounded-md border px-3 py-2 text-sm h-24 resize-y" style={{ borderColor: BORDER }} />
          <Button size="sm" disabled={!form.subject.trim() || create.isPending} onClick={() => create.mutate({ subject: form.subject, message: form.message || undefined })} style={{ background: BLUE, color: "white" }}>{t("support.send")}</Button>
        </div>
      )}

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-xl" style={{ background: "oklch(88% 0.015 88)" }} />
      ) : tickets.length === 0 ? (
        <p className="text-sm" style={{ color: MUTED }}>{t("support.empty")}</p>
      ) : (
        <div className="space-y-3">
          {tickets.map((t: any) => {
            const [col, lbl] = STATUS[t.status] ?? STATUS.OPEN;
            return (
              <div key={t.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}`, background: "white" }}>
                <button onClick={() => setOpen(open === t.id ? null : t.id)} className="w-full flex items-center justify-between p-4 text-left">
                  <div>
                    <div className="font-semibold" style={{ color: BLUE }}>{t.subject}</div>
                    <div className="text-xs" style={{ color: MUTED }}><span style={{ color: col }}>{lbl}</span> · {new Date(t.updatedAt).toLocaleDateString("fr-FR")}</div>
                  </div>
                  {open === t.id ? <ChevronUp className="w-4 h-4" style={{ color: MUTED }} /> : <ChevronDown className="w-4 h-4" style={{ color: MUTED }} />}
                </button>
                {open === t.id && <div className="px-4 pb-4"><TicketThread ticketId={t.id} meId={user?.id} /></div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
