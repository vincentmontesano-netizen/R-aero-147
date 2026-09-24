import { useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, Award, Search, Shield } from "lucide-react";
import PublicNav from "@/components/PublicNav";

export default function CertificateVerification() {
  const { t,lang } = useI18n();
  const { code } = useParams<{ code?: string }>();
  const [inputCode, setInputCode] = useState(code ?? "");
  const [searchCode, setSearchCode] = useState(code ?? "");

  const { data: cert, isLoading } = trpc.public.verifyCertificate.useQuery(
    { code: searchCode },
    { enabled: !!searchCode, retry: false }
  );

  const statusText=cert?.status==='valid'?t('certificateVerification.statusValid'):cert?.status==='expired'?(lang==='fr'?'Expiré':lang==='ar'?'منتهي الصلاحية':'Expired'):t('certificateVerification.statusRevoked');
  const statusColor=cert?.status==='valid'?"var(--success)":"var(--destructive)";
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchCode(inputCode.trim().toUpperCase());
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <PublicNav />
      {/* Header */}
      <div style={{ background: "var(--surface-strong)", paddingTop: "5rem" }}>
        <div className="container py-12 text-center">
          <div className="text-left"><BackButton dark /></div>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "color-mix(in srgb, var(--link) 15%, transparent)", border: "2px solid color-mix(in srgb, var(--link) 40%, transparent)" }}>
            <Shield className="w-8 h-8" style={{ color: "var(--link)" }} />
          </div>
          <h1 className="font-sans text-3xl font-bold text-white mb-2">{t("certificateVerification.title")}</h1>
          <p className="text-muted-foreground max-w-md mx-auto text-sm">
            {t("certificateVerification.subtitle")}
          </p>
        </div>
      </div>

      <div className="container py-10 max-w-2xl">
        {/* Search form */}
        <form onSubmit={handleSearch} className="rounded-xl p-6 mb-8" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <label className="text-sm font-semibold mb-2 block" style={{ color: "var(--foreground)" }}>
            {t("certificateVerification.codeLabel")}
          </label>
          <div className="flex gap-3">
            <Input
              maxLength={32}
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder={t("certificateVerification.codePlaceholder")}
              className="font-mono text-base tracking-widest"
            />
            <Button type="submit" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
              <Search className="w-4 h-4 mr-2" /> {t("certificateVerification.verifyButton")}
            </Button>
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--muted-foreground)" }}>
            {t("certificateVerification.codeHint")}
          </p>
        </form>

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-10">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto" style={{ borderColor: "var(--link)", borderTopColor: "transparent" }} />
          </div>
        )}

        {/* Not found */}
        {searchCode && !isLoading && !cert && (
          <div className="rounded-xl p-8 text-center" style={{ background: "color-mix(in srgb, var(--destructive) 5%, transparent)", border: "2px solid color-mix(in srgb, var(--destructive) 30%, transparent)" }}>
            <XCircle className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--destructive)" }} />
            <h2 className="font-sans text-xl font-bold mb-2" style={{ color: "var(--foreground)" }}>{t("certificateVerification.notFoundTitle")}</h2>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              {t("certificateVerification.notFoundPrefix")}<strong className="font-mono">{searchCode}</strong>{t("certificateVerification.notFoundSuffix")}
            </p>
          </div>
        )}

        {/* Found */}
        {cert && (
          <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${statusColor}` }}>
            {/* Verification status */}
            <div className="px-6 py-4 flex items-center gap-3" style={{ background: statusColor }}>
              {cert.status==='valid'?<CheckCircle className="w-6 h-6 text-primary-foreground" />:<XCircle className="w-6 h-6 text-primary-foreground" />}
              <span className="font-bold text-primary-foreground text-lg">{cert.status==='valid'?t('certificateVerification.validBanner'):statusText}</span>
            </div>

            <div className="p-6" style={{ background: "var(--card)" }}>
              {/* Training title */}
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "color-mix(in srgb, var(--link) 10%, transparent)" }}>
                  <Award className="w-6 h-6" style={{ color: "var(--link)" }} />
                </div>
                <div>
                  <div className="text-xs font-semibold tracking-wide mb-1" style={{ color: "var(--link)" }}>{t("certificateVerification.certifiedTrainingLabel")}</div>
                  <h2 className="font-sans text-xl font-bold" style={{ color: "var(--foreground)" }}>
                    {cert.training?.title ?? t("certificateVerification.defaultTrainingName")}
                  </h2>
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {[
                  { label: t("certificateVerification.fieldHolder"), value: cert.user?.name ?? "—" },
                  { label: t("certificateVerification.fieldCertificateNumber"), value: cert.certificateNumber },
                  { label: t("certificateVerification.fieldIssueDate"), value: new Date(cert.issuedAt).toLocaleDateString(lang==='ar'?'ar':lang==='en'?'en-GB':'fr-FR',{timeZone:'UTC'}) },
                  { label: t("certificateVerification.fieldValidUntil"), value: cert.expiresAt ? new Date(cert.expiresAt).toLocaleDateString(lang==='ar'?'ar':lang==='en'?'en-GB':'fr-FR',{timeZone:'UTC'}) : t("certificateVerification.valueUndetermined") },
                  { label: t("certificateVerification.fieldPart147Reference"), value: cert.training?.part147Reference ?? "—" },
                  { label: t("certificateVerification.fieldStatus"), value: statusText },
                ].map((field) => (
                  <div key={field.label} className="p-3 rounded-lg" style={{ background: "var(--background)" }}>
                    <div className="text-xs font-semibold mb-1" style={{ color: "var(--muted-foreground)" }}>{field.label}</div>
                    <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{field.value}</div>
                  </div>
                ))}
              </div>

              {/* Organisme */}
              <div className="flex items-center gap-2 p-3 rounded-lg mb-4" style={{ background: "color-mix(in srgb, var(--link) 5%, transparent)", border: "1px solid color-mix(in srgb, var(--link) 10%, transparent)" }}>
                <Shield className="w-4 h-4" style={{ color: "var(--link)" }} />
                <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                  {lang==='fr'?'Registre des certificats R-AERO':lang==='ar'?'سجل شهادات R-AERO':'R-AERO certificate register'}
                </span>
              </div>

              {/* Private document access */}
              <p className="text-xs text-muted-foreground">{lang==='fr'?'Le titulaire retrouve le document dans son espace personnel.':lang==='ar'?'يمكن لصاحب الشهادة العثور على المستند في مساحته الشخصية.':'The holder can access the document in their personal account.'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
