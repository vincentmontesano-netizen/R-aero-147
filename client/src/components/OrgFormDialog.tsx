import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useI18n } from "@/i18n";

const BLUE = "oklch(19% 0.08 252)";
const MUTED = "oklch(45% 0.02 240)";
const BORDER = "oklch(88% 0.015 88)";
const lbl = "text-xs font-semibold mb-1 block";

/** Create or edit an organization (admin). Mount only when open. */
export default function OrgFormDialog({ mode, org, onClose, onSaved }: {
  mode: "new" | "edit"; org?: any; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    name: org?.name ?? "", type: org?.type ?? "", agreementNumber: org?.agreementNumber ?? "", country: org?.country ?? "FR",
    siret: org?.siret ?? "", contactEmail: org?.contactEmail ?? "",
  });
  const create = trpc.admin.organizations.create.useMutation({ onSuccess: () => { toast.success(t("orgFormDialog.createdToast")); onSaved(); }, onError: (e) => toast.error(e.message) });
  const update = trpc.admin.organizations.update.useMutation({ onSuccess: () => { toast.success(t("orgFormDialog.updatedToast")); onSaved(); }, onError: (e) => toast.error(e.message) });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    if (!form.name.trim()) return toast.error(t("orgFormDialog.nameRequired"));
    const payload = { name: form.name, type: form.type || undefined, agreementNumber: form.agreementNumber || undefined, country: form.country || undefined, siret: form.siret || undefined, contactEmail: form.contactEmail || undefined };
    if (mode === "new") create.mutate(payload);
    else update.mutate({ id: org.id, ...payload } as any);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{mode === "new" ? t("orgFormDialog.titleNew") : t("orgFormDialog.titleEdit")}</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-1">
          <div><label className={lbl} style={{ color: MUTED }}>{t("orgFormDialog.nameLabel")}</label><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Aero MRO SA" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl} style={{ color: MUTED }}>{t("orgFormDialog.typeLabel")}</label>
              <select value={form.type} onChange={(e) => set("type", e.target.value)} className="w-full h-9 rounded-md border px-2 text-sm" style={{ borderColor: BORDER }}>
                <option value="">—</option>
                <option value="MRO">MRO</option>
                <option value="AIRLINE">{t("orgFormDialog.typeAirline")}</option>
                <option value="CAMO">CAMO</option>
                <option value="OTHER">{t("userFormDialog.orgTypeOther")}</option>
              </select>
            </div>
            <div><label className={lbl} style={{ color: MUTED }}>{t("orgFormDialog.countryLabel")}</label><Input value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="FR" /></div>
          </div>
          <div><label className={lbl} style={{ color: MUTED }}>{t("userFormDialog.orgAgreementLabel")}</label><Input value={form.agreementNumber} onChange={(e) => set("agreementNumber", e.target.value)} placeholder="FR.145.XXXX" className="font-mono" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl} style={{ color: MUTED }}>{t("orgFormDialog.siretLabel")}</label><Input value={form.siret} onChange={(e) => set("siret", e.target.value)} /></div>
            <div><label className={lbl} style={{ color: MUTED }}>{t("orgFormDialog.contactEmailLabel")}</label><Input value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>{t("orgFormDialog.cancel")}</Button>
          <Button onClick={save} disabled={create.isPending || update.isPending} style={{ background: BLUE, color: "white" }}>{t("orgFormDialog.save")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
