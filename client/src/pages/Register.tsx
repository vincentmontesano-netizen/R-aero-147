import { announceSessionChange } from '@/lib/sessionChange';
import { useQueryClient } from '@tanstack/react-query';
import { clearSessionCache } from '@/lib/sessionCache';
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LOGO_EMBLEM, BRAND_NAME } from "@/lib/brand";
import { UserPlus, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";

const DEEP_BLUE = "oklch(19% 0.08 252)";
const GOLD = "oklch(68% 0.1 78)";
const IVORY = "oklch(97% 0.01 88)";

export default function Register() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  // Job title / Part-66 licence are filled later in the ID module, not at sign-up.
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    marketingOptIn: false,
    createOrg: false,
    orgName: "",
    orgType: "MRO",
    orgAgreement: "",
  });

  const register = trpc.auth.register.useMutation({
    onSuccess: async (user) => {
      await clearSessionCache(queryClient);
      utils.auth.me.setData(undefined, user as any);
      announceSessionChange();
      toast.success(t("register.toastSuccess"));
      setLocation("/dashboard");
    },
    onError: (err) => toast.error(err.message || t("register.toastError")),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.createOrg && !form.orgName.trim()) return toast.error(t("register.orgNameRequired"));
    register.mutate({
      name: form.name, email: form.email, password: form.password, marketingOptIn: form.marketingOptIn,
      organization: form.createOrg ? { name: form.orgName.trim(), type: form.orgType as any, agreementNumber: form.orgAgreement || undefined } : undefined,
    });
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-10" style={{ background: DEEP_BLUE }}>
      <div className="w-full max-w-md">
        <Link href="/">
          <button className="flex items-center gap-2 text-white/60 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> {t("register.backHome")}
          </button>
        </Link>

        <div className="rounded-2xl p-8" style={{ background: IVORY }}>
          <div className="flex flex-col items-center mb-6">
            <img src={LOGO_EMBLEM} alt={BRAND_NAME} className="h-16 w-auto object-contain mb-3" />
            <h1 className="font-serif text-2xl font-bold" style={{ color: DEEP_BLUE }}>{t("register.title")}</h1>
            <p className="text-sm mt-1 text-center" style={{ color: "oklch(45% 0.02 240)" }}>
              {t("register.subtitle")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reg-field-1" className="text-xs font-semibold mb-1.5 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("register.labelName")}</label>
              <Input id="reg-field-1" required value={form.name} onChange={set("name")} placeholder={t("register.placeholderName")} />
            </div>
            <div>
              <label htmlFor="reg-field-2" className="text-xs font-semibold mb-1.5 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("register.labelEmail")}</label>
              <Input id="reg-field-2" type="email" required value={form.email} onChange={set("email")} placeholder={t("register.placeholderEmail")} autoComplete="email" />
            </div>
            <div>
              <label htmlFor="reg-field-3" className="text-xs font-semibold mb-1.5 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("register.labelPassword")} <span className="font-normal">{t("register.labelPasswordHint")}</span></label>
              <Input id="reg-field-3" type="password" required minLength={8} value={form.password} onChange={set("password")} placeholder="••••••••" autoComplete="new-password" />
            </div>
            {/* Optionally create an organisation and become its manager. */}
            <div className="rounded-lg p-3" style={{ border: "1px solid oklch(88% 0.015 88)", background: "oklch(97% 0.01 88)" }}>
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="text-sm font-medium" style={{ color: DEEP_BLUE }}>{t("register.createOrgToggle")}</span>
                <input type="checkbox" checked={form.createOrg} onChange={(e) => setForm((f) => ({ ...f, createOrg: e.target.checked }))} className="w-4 h-4" />
              </label>
              {form.createOrg && (
                <div className="space-y-2 mt-3">
                  <p className="text-[11px]" style={{ color: "oklch(45% 0.02 240)" }}>{t("register.createOrgHint")}</p>
                  <div>
                    <label htmlFor="reg-field-4" className="text-xs font-semibold mb-1 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("register.orgNameLabel")}</label>
                    <Input id="reg-field-4" value={form.orgName} onChange={set("orgName")} placeholder="Aero MRO SA" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="reg-field-5" className="text-xs font-semibold mb-1 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("register.orgTypeLabel")}</label>
                      <select id="reg-field-5" value={form.orgType} onChange={(e) => setForm((f) => ({ ...f, orgType: e.target.value }))} className="w-full h-9 rounded-md border px-2 text-sm" style={{ borderColor: "oklch(88% 0.015 88)" }}>
                        <option value="MRO">MRO</option>
                        <option value="AIRLINE">{t("register.orgTypeAirline")}</option>
                        <option value="CAMO">CAMO</option>
                        <option value="OTHER">{t("register.orgTypeOther")}</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="reg-field-6" className="text-xs font-semibold mb-1 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("register.orgAgreementLabel")}</label>
                      <Input id="reg-field-6" value={form.orgAgreement} onChange={set("orgAgreement")} placeholder="FR.145.XXXX" className="font-mono" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <label className="flex items-start gap-2 text-xs cursor-pointer" style={{ color: "oklch(45% 0.02 240)" }}>
              <input
                type="checkbox"
                checked={form.marketingOptIn}
                onChange={(e) => setForm((f) => ({ ...f, marketingOptIn: e.target.checked }))}
                className="mt-0.5"
              />
              <span>{t("register.marketingOptIn")}</span>
            </label>
            <Button type="submit" disabled={register.isPending} className="w-full" style={{ background: DEEP_BLUE, color: IVORY }}>
              {register.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
              {t("register.submit")}
            </Button>
          </form>

          <p className="text-sm text-center mt-6" style={{ color: "oklch(45% 0.02 240)" }}>
            {t("register.alreadyRegistered")}{" "}
            <Link href="/login">
              <span className="font-semibold cursor-pointer hover:underline" style={{ color: GOLD }}>{t("register.login")}</span>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
