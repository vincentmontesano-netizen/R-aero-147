import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useI18n } from "@/i18n";

const BLUE = "var(--foreground)";
const MUTED = "var(--muted-foreground)";
const BORDER = "var(--border)";
const lbl = "text-xs font-semibold mb-1 block";

/** Create or edit a user (admin). Mount only when open (state initialises from props). */
export default function UserFormDialog({ mode, user, defaultRole, onClose, onSaved }: {
  mode: "new" | "edit"; user?: any; defaultRole?: string; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useI18n();
  const ROLES: [string, string][] = [["user", t("userFormDialog.roleUser")], ["company_manager", t("userFormDialog.roleManager")], ["instructor", t("userFormDialog.roleInstructor")], ["admin", t("userFormDialog.roleAdmin")]];
  const [form, setForm] = useState({
    email: user?.email ?? "", password: "", name: user?.name ?? "",
    role: user?.role ?? defaultRole ?? "user", jobTitle: user?.jobTitle ?? "", licenseNumber: user?.licenseNumber ?? "",
    createOrg: false, orgName: "", orgType: "MRO", orgAgreement: "",
  });
  const create = trpc.admin.createUser.useMutation({ onSuccess: () => { toast.success(t("userFormDialog.toastCreated")); onSaved(); }, onError: (e) => toast.error(e.message) });
  const update = trpc.admin.updateUser.useMutation({ onSuccess: () => { toast.success(t("userFormDialog.toastUpdated")); onSaved(); }, onError: (e) => toast.error(e.message) });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    if (mode === "new") {
      if (!form.email.trim() || form.password.length < 6 || !form.name.trim()) return toast.error(t("userFormDialog.toastValidation"));
      if (form.createOrg && !form.orgName.trim()) return toast.error(t("userFormDialog.toastOrgNameRequired"));
      create.mutate({
        email: form.email, password: form.password, name: form.name, role: form.role as any,
        jobTitle: form.jobTitle || undefined, licenseNumber: form.licenseNumber || undefined,
        organization: form.createOrg ? { name: form.orgName.trim(), type: form.orgType as any, agreementNumber: form.orgAgreement || undefined } : undefined,
      });
    } else {
      update.mutate({ id: user.id, name: form.name, role: form.role as any, jobTitle: form.jobTitle || undefined, licenseNumber: form.licenseNumber || undefined });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{mode === "new" ? t("userFormDialog.titleNew") : t("userFormDialog.titleEdit")}</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-1">
          <div><label className={lbl} style={{ color: "var(--muted-foreground)" }}>{t("userFormDialog.labelName")}</label><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={t("userFormDialog.placeholderName")} /></div>
          {mode === "new" && (
            <>
              <div><label className={lbl} style={{ color: "var(--muted-foreground)" }}>{t("userFormDialog.labelEmail")}</label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="jean@example.com" /></div>
              <div><label className={lbl} style={{ color: "var(--muted-foreground)" }}>{t("userFormDialog.labelPassword")}</label><Input type="text" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder={t("userFormDialog.placeholderPassword")} /></div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className={form.role === "admin" ? "col-span-2" : ""}>
              <label className={lbl} style={{ color: "var(--muted-foreground)" }}>{t("userFormDialog.labelRole")}</label>
              <select value={form.role} onChange={(e) => set("role", e.target.value)} className="w-full h-9 rounded-md border px-2 text-sm" style={{ borderColor: "var(--border)" }}>
                {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            {form.role !== "admin" && (
              <div><label className={lbl} style={{ color: "var(--muted-foreground)" }}>{t("userFormDialog.labelJobTitle")}</label><Input value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} placeholder={t("userFormDialog.placeholderJobTitle")} /></div>
            )}
          </div>
          {/* Part-66 / job fields are irrelevant for an admin account. */}
          {form.role !== "admin" && (
            <div><label className={lbl} style={{ color: "var(--muted-foreground)" }}>{t("userFormDialog.labelLicense")}</label><Input value={form.licenseNumber} onChange={(e) => set("licenseNumber", e.target.value)} placeholder="FR.66.XXXXXXXX" className="font-mono" /></div>
          )}

          {/* Optionally create an organisation and make this user its manager. */}
          {mode === "new" && (
            <div className="rounded-lg p-3" style={{ border: `1px solid ${"var(--border)"}`, background: "var(--background)" }}>
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{t("userFormDialog.createOrgToggle")}</span>
                <input type="checkbox" checked={form.createOrg} onChange={(e) => setForm((f) => ({ ...f, createOrg: e.target.checked }))} className="w-4 h-4" />
              </label>
              {form.createOrg && (
                <div className="space-y-2 mt-3">
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t("userFormDialog.createOrgHint")}</p>
                  <div><label className={lbl} style={{ color: "var(--muted-foreground)" }}>{t("userFormDialog.orgNameLabel")}</label><Input value={form.orgName} onChange={(e) => set("orgName", e.target.value)} placeholder="Aero MRO SA" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl} style={{ color: "var(--muted-foreground)" }}>{t("userFormDialog.orgTypeLabel")}</label>
                      <select value={form.orgType} onChange={(e) => set("orgType", e.target.value)} className="w-full h-9 rounded-md border px-2 text-sm" style={{ borderColor: "var(--border)" }}>
                        <option value="MRO">MRO</option>
                        <option value="AIRLINE">{t("userFormDialog.orgTypeAirline")}</option>
                        <option value="CAMO">CAMO</option>
                        <option value="OTHER">{t("userFormDialog.orgTypeOther")}</option>
                      </select>
                    </div>
                    <div><label className={lbl} style={{ color: "var(--muted-foreground)" }}>{t("userFormDialog.orgAgreementLabel")}</label><Input value={form.orgAgreement} onChange={(e) => set("orgAgreement", e.target.value)} placeholder="FR.145.XXXX" className="font-mono" /></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>{t("userFormDialog.cancel")}</Button>
          <Button onClick={save} disabled={create.isPending || update.isPending} style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>{t("userFormDialog.save")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
