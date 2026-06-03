import { useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/i18n";
import BackButton from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PDFPreviewModal, usePDFPreview } from "@/components/PDFPreviewModal";
import { CheckCircle, XCircle, Award, Search, Shield, Download, Eye } from "lucide-react";

export default function CertificateVerification() {
  const { t } = useI18n();
  const { code } = useParams<{ code?: string }>();
  const [inputCode, setInputCode] = useState(code ?? "");
  const [searchCode, setSearchCode] = useState(code ?? "");
  const { state: pdfState, openPreview, closePreview } = usePDFPreview();

  const { data: cert, isLoading } = trpc.public.verifyCertificate.useQuery(
    { code: searchCode },
    { enabled: !!searchCode, retry: false }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchCode(inputCode.trim().toUpperCase());
  };

  return (
    <div className="min-h-screen" style={{ background: "oklch(97% 0.01 88)" }}>
      {/* PDF Preview Modal */}
      <PDFPreviewModal
        open={pdfState.open}
        onClose={closePreview}
        pdfUrl={pdfState.pdfUrl}
        title={pdfState.title}
        subtitle={pdfState.subtitle}
        downloadFilename={pdfState.downloadFilename}
      />

      {/* Header */}
      <div style={{ background: "oklch(19% 0.08 252)", paddingTop: "5rem" }}>
        <div className="container py-12 text-center">
          <div className="text-left"><BackButton dark /></div>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "oklch(68% 0.1 78 / 0.15)", border: "2px solid oklch(68% 0.1 78 / 0.4)" }}>
            <Shield className="w-8 h-8" style={{ color: "oklch(68% 0.1 78)" }} />
          </div>
          <h1 className="font-serif text-3xl font-bold text-white mb-2">{t("certificateVerification.title")}</h1>
          <p className="text-white/60 max-w-md mx-auto text-sm">
            {t("certificateVerification.subtitle")}
          </p>
        </div>
      </div>

      <div className="container py-10 max-w-2xl">
        {/* Search form */}
        <form onSubmit={handleSearch} className="rounded-xl p-6 mb-8" style={{ background: "oklch(100% 0 0)", border: "1px solid oklch(88% 0.015 88)" }}>
          <label className="text-sm font-semibold mb-2 block" style={{ color: "oklch(19% 0.08 252)" }}>
            {t("certificateVerification.codeLabel")}
          </label>
          <div className="flex gap-3">
            <Input
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder={t("certificateVerification.codePlaceholder")}
              className="font-mono text-base tracking-widest"
            />
            <Button type="submit" style={{ background: "oklch(19% 0.08 252)", color: "oklch(97% 0.01 88)" }}>
              <Search className="w-4 h-4 mr-2" /> {t("certificateVerification.verifyButton")}
            </Button>
          </div>
          <p className="text-xs mt-2" style={{ color: "oklch(62% 0.02 240)" }}>
            {t("certificateVerification.codeHint")}
          </p>
        </form>

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-10">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto" style={{ borderColor: "oklch(68% 0.1 78)", borderTopColor: "transparent" }} />
          </div>
        )}

        {/* Not found */}
        {searchCode && !isLoading && !cert && (
          <div className="rounded-xl p-8 text-center" style={{ background: "oklch(55% 0.22 27 / 0.05)", border: "2px solid oklch(55% 0.22 27 / 0.3)" }}>
            <XCircle className="w-12 h-12 mx-auto mb-3" style={{ color: "oklch(55% 0.22 27)" }} />
            <h2 className="font-serif text-xl font-bold mb-2" style={{ color: "oklch(19% 0.08 252)" }}>{t("certificateVerification.notFoundTitle")}</h2>
            <p className="text-sm" style={{ color: "oklch(45% 0.02 240)" }}>
              {t("certificateVerification.notFoundPrefix")}<strong className="font-mono">{searchCode}</strong>{t("certificateVerification.notFoundSuffix")}
            </p>
          </div>
        )}

        {/* Found */}
        {cert && (
          <div className="rounded-xl overflow-hidden" style={{ border: "2px solid oklch(55% 0.18 145 / 0.4)" }}>
            {/* Valid banner */}
            <div className="px-6 py-4 flex items-center gap-3" style={{ background: "oklch(55% 0.18 145)" }}>
              <CheckCircle className="w-6 h-6 text-white" />
              <span className="font-bold text-white text-lg">{t("certificateVerification.validBanner")}</span>
            </div>

            <div className="p-6" style={{ background: "oklch(100% 0 0)" }}>
              {/* Training title */}
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "oklch(68% 0.1 78 / 0.1)" }}>
                  <Award className="w-6 h-6" style={{ color: "oklch(68% 0.1 78)" }} />
                </div>
                <div>
                  <div className="text-xs font-semibold tracking-wide mb-1" style={{ color: "oklch(68% 0.1 78)" }}>{t("certificateVerification.certifiedTrainingLabel")}</div>
                  <h2 className="font-serif text-xl font-bold" style={{ color: "oklch(19% 0.08 252)" }}>
                    {(cert as any).training?.title ?? t("certificateVerification.defaultTrainingName")}
                  </h2>
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {[
                  { label: t("certificateVerification.fieldHolder"), value: (cert as any).user?.name ?? "—" },
                  { label: t("certificateVerification.fieldCertificateNumber"), value: cert.certificateNumber },
                  { label: t("certificateVerification.fieldIssueDate"), value: new Date(cert.issuedAt).toLocaleDateString("fr-FR") },
                  { label: t("certificateVerification.fieldValidUntil"), value: cert.expiresAt ? new Date(cert.expiresAt).toLocaleDateString("fr-FR") : t("certificateVerification.valueUndetermined") },
                  { label: t("certificateVerification.fieldPart147Reference"), value: (cert as any).training?.part147Reference ?? "—" },
                  { label: t("certificateVerification.fieldStatus"), value: cert.isValid ? t("certificateVerification.statusValid") : t("certificateVerification.statusRevoked") },
                ].map((field) => (
                  <div key={field.label} className="p-3 rounded-lg" style={{ background: "oklch(97% 0.01 88)" }}>
                    <div className="text-xs font-semibold mb-1" style={{ color: "oklch(62% 0.02 240)" }}>{field.label}</div>
                    <div className="text-sm font-medium" style={{ color: "oklch(19% 0.08 252)" }}>{field.value}</div>
                  </div>
                ))}
              </div>

              {/* Organisme */}
              <div className="flex items-center gap-2 p-3 rounded-lg mb-4" style={{ background: "oklch(19% 0.08 252 / 0.05)", border: "1px solid oklch(19% 0.08 252 / 0.1)" }}>
                <Shield className="w-4 h-4" style={{ color: "oklch(68% 0.1 78)" }} />
                <span className="text-xs font-medium" style={{ color: "oklch(19% 0.08 252)" }}>
                  {t("certificateVerification.issuedBy")}
                </span>
              </div>

              {/* Actions */}
              {cert.pdfUrl && (
                <div className="flex gap-3">
                  {/* Preview */}
                  <Button
                    onClick={() =>
                      openPreview({
                        pdfUrl: cert.pdfUrl,
                        title: t("certificateVerification.previewTitle", { training: (cert as any).training?.title ?? t("certificateVerification.previewDefaultTraining") }),
                        subtitle: t("certificateVerification.previewSubtitle", { number: cert.certificateNumber, holder: (cert as any).user?.name ?? "" }),
                        downloadFilename: `certificat-${cert.certificateNumber}.pdf`,
                      })
                    }
                    style={{ background: "oklch(19% 0.08 252)", color: "oklch(97% 0.01 88)" }}
                  >
                    <Eye className="w-4 h-4 mr-2" /> {t("certificateVerification.previewButton")}
                  </Button>
                  {/* Direct download */}
                  <a href={cert.pdfUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline">
                      <Download className="w-4 h-4 mr-2" /> {t("certificateVerification.downloadButton")}
                    </Button>
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
