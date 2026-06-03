import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, Building2, Users, FileText, Mail } from "lucide-react";
import { toast } from "sonner";

export default function QuoteRequest() {
  const { t } = useI18n();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    companyName: "", siret: "", contactName: "", contactEmail: "",
    contactPhone: "", employeeCount: "", trainingTypes: "", message: "",
  });

  const createQuote = trpc.quotes.create.useMutation({
    onSuccess: () => { setSubmitted(true); toast.success(t("quoteRequest.toastSuccess")); },
    onError: () => toast.error(t("quoteRequest.toastError")),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createQuote.mutate({
      ...form,
      employeeCount: form.employeeCount ? parseInt(form.employeeCount) : undefined,
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(97% 0.01 88)" }}>
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: "oklch(55% 0.18 145 / 0.1)" }}>
            <CheckCircle className="w-10 h-10" style={{ color: "oklch(55% 0.18 145)" }} />
          </div>
          <h2 className="font-serif text-3xl font-bold mb-3" style={{ color: "oklch(19% 0.08 252)" }}>{t("quoteRequest.successTitle")}</h2>
          <p className="text-base mb-6" style={{ color: "oklch(45% 0.02 240)" }}>
            {t("quoteRequest.successMessage")}
          </p>
          <Button onClick={() => setSubmitted(false)} variant="outline">{t("quoteRequest.newRequest")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "oklch(97% 0.01 88)" }}>
      {/* Header */}
      <div style={{ background: "oklch(19% 0.08 252)", paddingTop: "5rem" }}>
        <div className="container py-12">
          <BackButton dark />
          <div className="text-xs font-semibold tracking-widest mb-3" style={{ color: "oklch(68% 0.1 78)" }}>{t("quoteRequest.eyebrow")}</div>
          <h1 className="font-serif text-4xl font-bold text-white mb-3">{t("quoteRequest.pageTitle")}</h1>
          <p className="text-white/60 max-w-xl">
            {t("quoteRequest.pageSubtitle")}
          </p>
        </div>
      </div>

      <div className="container py-10">
        <div className="grid lg:grid-cols-3 gap-10">
          {/* Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="rounded-xl p-8 space-y-6" style={{ background: "oklch(100% 0 0)", border: "1px solid oklch(88% 0.015 88)" }}>
              <div>
                <h2 className="font-semibold text-lg mb-4" style={{ color: "oklch(19% 0.08 252)" }}>{t("quoteRequest.companySectionTitle")}</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-xs font-semibold mb-1.5 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("quoteRequest.companyNameLabel")}</label>
                    <Input required value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} placeholder={t("quoteRequest.companyNamePlaceholder")} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("quoteRequest.siretLabel")}</label>
                    <Input value={form.siret} onChange={(e) => setForm((f) => ({ ...f, siret: e.target.value }))} placeholder="XXX XXX XXX XXXXX" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("quoteRequest.employeeCountLabel")}</label>
                    <Input type="number" value={form.employeeCount} onChange={(e) => setForm((f) => ({ ...f, employeeCount: e.target.value }))} placeholder="25" min="1" />
                  </div>
                </div>
              </div>

              <div>
                <h2 className="font-semibold text-lg mb-4" style={{ color: "oklch(19% 0.08 252)" }}>{t("quoteRequest.contactSectionTitle")}</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-xs font-semibold mb-1.5 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("quoteRequest.contactNameLabel")}</label>
                    <Input required value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} placeholder="Marie Dupont" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("quoteRequest.emailLabel")}</label>
                    <Input required type="email" value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} placeholder="m.dupont@mro.com" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("quoteRequest.phoneLabel")}</label>
                    <Input type="tel" value={form.contactPhone} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} placeholder={t("quoteRequest.phonePlaceholder")} />
                  </div>
                </div>
              </div>

              <div>
                <h2 className="font-semibold text-lg mb-4" style={{ color: "oklch(19% 0.08 252)" }}>{t("quoteRequest.trainingSectionTitle")}</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("quoteRequest.trainingTypesLabel")}</label>
                    <Input value={form.trainingTypes} onChange={(e) => setForm((f) => ({ ...f, trainingTypes: e.target.value }))} placeholder={t("quoteRequest.trainingTypesPlaceholder")} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1.5 block" style={{ color: "oklch(45% 0.02 240)" }}>{t("quoteRequest.messageLabel")}</label>
                    <textarea
                      value={form.message}
                      onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                      className="w-full rounded-md border px-3 py-2 text-sm h-28 resize-none"
                      style={{ borderColor: "oklch(88% 0.015 88)" }}
                      placeholder={t("quoteRequest.messagePlaceholder")}
                    />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full btn-press font-semibold"
                disabled={createQuote.isPending}
                style={{ background: "oklch(68% 0.1 78)", color: "oklch(19% 0.08 252)" }}
              >
                {createQuote.isPending ? t("quoteRequest.submitting") : t("quoteRequest.submit")}
              </Button>
            </form>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="rounded-xl p-6" style={{ background: "oklch(19% 0.08 252)" }}>
              <h3 className="font-semibold text-white mb-4">{t("quoteRequest.whyTitle")}</h3>
              <ul className="space-y-3">
                {[
                  t("quoteRequest.why1"),
                  t("quoteRequest.why2"),
                  t("quoteRequest.why3"),
                  t("quoteRequest.why4"),
                  t("quoteRequest.why5"),
                  t("quoteRequest.why6"),
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-white/70">
                    <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "oklch(68% 0.1 78)" }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl p-6" style={{ background: "oklch(100% 0 0)", border: "1px solid oklch(88% 0.015 88)" }}>
              <h3 className="font-semibold mb-4" style={{ color: "oklch(19% 0.08 252)" }}>{t("quoteRequest.directContactTitle")}</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm" style={{ color: "oklch(45% 0.02 240)" }}>
                  <Mail className="w-4 h-4" style={{ color: "oklch(68% 0.1 78)" }} />
                  contact@r-aero-academy.com
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
