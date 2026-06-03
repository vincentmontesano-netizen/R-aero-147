import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";

const BLUE = "oklch(19% 0.08 252)";
const MUTED = "oklch(45% 0.02 240)";

/** Manage an organization's managers (MANAGER affiliations): list + add by email + remove. */
export default function OrgManagersDialog({ org, onClose }: { org: any | null; onClose: () => void }) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: managers = [] } = trpc.admin.organizations.managers.useQuery({ orgId: org?.id ?? 0 }, { enabled: org != null });
  const [email, setEmail] = useState("");
  const invalidate = () => { if (org) { utils.admin.organizations.managers.invalidate({ orgId: org.id }); utils.admin.organizations.list.invalidate(); } };
  const add = trpc.admin.organizations.addManager.useMutation({ onSuccess: () => { toast.success(t("orgManagersDialog.managerAdded")); setEmail(""); invalidate(); }, onError: (e) => toast.error(e.message) });
  const remove = trpc.admin.organizations.removeManager.useMutation({ onSuccess: () => { toast.success(t("orgManagersDialog.managerRemoved")); invalidate(); }, onError: (e) => toast.error(e.message) });
  const active = (managers as any[]).filter((m) => m.status === "ACTIVE");

  return (
    <Dialog open={org != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t("orgManagersDialog.title", { name: org?.name })}</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-1">
          <p className="text-xs" style={{ color: MUTED }}>{t("orgManagersDialog.description")}</p>
          <div className="flex gap-2">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("orgManagersDialog.emailPlaceholder")}
              onKeyDown={(e) => { if (e.key === "Enter" && email.trim() && org) add.mutate({ orgId: org.id, email }); }} />
            <Button disabled={!email.trim() || add.isPending} onClick={() => org && add.mutate({ orgId: org.id, email })} style={{ background: BLUE, color: "white" }}>
              <UserPlus className="w-4 h-4 mr-1" /> {t("orgManagersDialog.add")}
            </Button>
          </div>
          <div className="space-y-1.5">
            {active.length === 0 && <p className="text-xs" style={{ color: MUTED }}>{t("orgManagersDialog.noActiveManagers")}</p>}
            {active.map((m) => (
              <div key={m.affiliationId} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "oklch(97% 0.01 88)" }}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: BLUE }}>{m.name ?? "—"}</div>
                  <div className="text-xs truncate" style={{ color: MUTED }}>{m.email}</div>
                </div>
                <button onClick={() => remove.mutate({ affiliationId: m.affiliationId })} className="text-red-500 shrink-0" title={t("orgManagersDialog.remove")}><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
