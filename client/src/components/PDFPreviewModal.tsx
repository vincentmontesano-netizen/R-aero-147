import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Download, ExternalLink, X, ZoomIn, ZoomOut,
  RotateCcw, Loader2, FileText, AlertCircle
} from "lucide-react";

interface PDFPreviewModalProps {
  open: boolean;
  onClose: () => void;
  /** URL directe du PDF (ex. /storage/...) */
  pdfUrl: string | null | undefined;
  title: string;
  subtitle?: string;
  /** Si fourni, déclenche la génération du PDF avant d'afficher la prévisualisation */
  onGenerate?: () => Promise<string | null | undefined>;
  downloadFilename?: string;
}

export function PDFPreviewModal({
  open,
  onClose,
  pdfUrl,
  title,
  subtitle,
  onGenerate,
  downloadFilename,
}: PDFPreviewModalProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(pdfUrl ?? null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [iframeKey, setIframeKey] = useState(0);

  // Sync resolved URL when prop changes
  useEffect(() => {
    if (pdfUrl) setResolvedUrl(pdfUrl);
  }, [pdfUrl]);

  // Auto-generate if no URL and generator is provided
  useEffect(() => {
    if (!open) return;
    if (resolvedUrl) return;
    if (!onGenerate) return;

    setIsGenerating(true);
    setError(null);
    onGenerate()
      .then((url) => {
        if (url) {
          setResolvedUrl(url);
        } else {
          setError("Impossible de générer le document. Veuillez réessayer.");
        }
      })
      .catch(() => setError("Erreur lors de la génération du document."))
      .finally(() => setIsGenerating(false));
  }, [open, resolvedUrl, onGenerate]);

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleDownload = () => {
    if (!resolvedUrl) return;
    const a = document.createElement("a");
    a.href = resolvedUrl;
    a.download = downloadFilename ?? `${title.replace(/[^a-z0-9]/gi, "_")}.pdf`;
    a.target = "_blank";
    a.click();
  };

  const handleOpenInTab = () => {
    if (!resolvedUrl) return;
    window.open(resolvedUrl, "_blank");
  };

  const handleZoomIn = () => setZoom((z) => Math.min(z + 20, 200));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 20, 50));
  const handleResetZoom = () => setZoom(100);

  // Build viewer URL — use Google Docs viewer as fallback for non-inline PDFs
  const viewerUrl = resolvedUrl
    ? `${resolvedUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`
    : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        className="max-w-5xl w-full p-0 overflow-hidden"
        style={{
          height: "90vh",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          background: "oklch(97% 0.01 88)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ background: "oklch(19% 0.08 252)", borderBottom: "1px solid oklch(68% 0.1 78 / 0.2)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "oklch(68% 0.1 78 / 0.15)" }}
            >
              <FileText className="w-4 h-4" style={{ color: "oklch(68% 0.1 78)" }} />
            </div>
            <div>
              <div className="font-semibold text-sm text-white">{title}</div>
              {subtitle && <div className="text-xs" style={{ color: "oklch(68% 0.1 78)" }}>{subtitle}</div>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom controls */}
            {resolvedUrl && (
              <div className="flex items-center gap-1 mr-2">
                <button
                  onClick={handleZoomOut}
                  disabled={zoom <= 50}
                  className="w-7 h-7 rounded flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleResetZoom}
                  className="text-xs text-white/60 hover:text-white transition-colors px-1 min-w-10 text-center"
                >
                  {zoom}%
                </button>
                <button
                  onClick={handleZoomIn}
                  disabled={zoom >= 200}
                  className="w-7 h-7 rounded flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Action buttons */}
            {resolvedUrl && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleOpenInTab}
                  className="text-white/70 hover:text-white hover:bg-white/10 h-8 px-3"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  <span className="text-xs">Ouvrir</span>
                </Button>
                <Button
                  size="sm"
                  onClick={handleDownload}
                  className="h-8 px-3 font-semibold btn-press"
                  style={{ background: "oklch(68% 0.1 78)", color: "oklch(19% 0.08 252)" }}
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  <span className="text-xs">Télécharger</span>
                </Button>
              </>
            )}

            <button
              onClick={handleClose}
              className="w-8 h-8 rounded flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 relative overflow-hidden" style={{ background: "oklch(30% 0.02 240)" }}>
          {/* Loading state */}
          {isGenerating && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "oklch(19% 0.08 252)" }}
              >
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: "oklch(68% 0.1 78)" }} />
              </div>
              <div className="text-center">
                <div className="font-semibold text-white mb-1">Génération en cours…</div>
                <div className="text-sm" style={{ color: "oklch(70% 0.01 240)" }}>
                  Le document est en cours de création, veuillez patienter.
                </div>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && !isGenerating && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "oklch(55% 0.22 27 / 0.15)" }}
              >
                <AlertCircle className="w-8 h-8" style={{ color: "oklch(55% 0.22 27)" }} />
              </div>
              <div className="text-center">
                <div className="font-semibold text-white mb-1">Erreur de génération</div>
                <div className="text-sm mb-4" style={{ color: "oklch(70% 0.01 240)" }}>{error}</div>
                {onGenerate && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setError(null);
                      setIsGenerating(true);
                      onGenerate()
                        .then((url) => { if (url) setResolvedUrl(url); else setError("Échec de la génération."); })
                        .catch(() => setError("Erreur lors de la génération."))
                        .finally(() => setIsGenerating(false));
                    }}
                    style={{ background: "oklch(68% 0.1 78)", color: "oklch(19% 0.08 252)" }}
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Réessayer
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* PDF iframe viewer */}
          {viewerUrl && !isGenerating && !error && (
            <div
              className="w-full h-full flex items-start justify-center overflow-auto py-4"
              style={{ background: "oklch(25% 0.02 240)" }}
            >
              <div
                style={{
                  width: `${zoom}%`,
                  minWidth: "600px",
                  maxWidth: "1200px",
                  height: "calc(90vh - 120px)",
                  transition: "width 200ms cubic-bezier(0.23, 1, 0.32, 1)",
                  boxShadow: "0 8px 40px oklch(0% 0 0 / 0.5)",
                  borderRadius: "4px",
                  overflow: "hidden",
                }}
              >
                <iframe
                  key={`${iframeKey}-${resolvedUrl}`}
                  src={viewerUrl}
                  className="w-full h-full border-0"
                  title={title}
                  style={{ display: "block" }}
                  onError={() => {
                    // Fallback: try without hash params
                    setIframeKey((k) => k + 1);
                  }}
                />
              </div>
            </div>
          )}

          {/* No URL and no generator */}
          {!viewerUrl && !isGenerating && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "oklch(19% 0.08 252)" }}
              >
                <FileText className="w-8 h-8" style={{ color: "oklch(68% 0.1 78)" }} />
              </div>
              <div className="text-center">
                <div className="font-semibold text-white mb-1">Document non disponible</div>
                <div className="text-sm" style={{ color: "oklch(70% 0.01 240)" }}>
                  Ce document n'a pas encore été généré.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        {resolvedUrl && !isGenerating && !error && (
          <div
            className="px-5 py-2 flex items-center justify-between flex-shrink-0"
            style={{ background: "oklch(19% 0.08 252 / 0.95)", borderTop: "1px solid oklch(68% 0.1 78 / 0.15)" }}
          >
            <div className="text-xs" style={{ color: "oklch(62% 0.02 240)" }}>
              Document R-AERO Training Academy — Organisme agréé EASA Part-147
            </div>
            <div className="text-xs" style={{ color: "oklch(62% 0.02 240)" }}>
              Utilisez les contrôles de zoom pour ajuster l'affichage
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Convenience hook ─────────────────────────────────────────────────────────
export function usePDFPreview() {
  const [state, setState] = useState<{
    open: boolean;
    pdfUrl: string | null;
    title: string;
    subtitle?: string;
    downloadFilename?: string;
    onGenerate?: () => Promise<string | null | undefined>;
  }>({ open: false, pdfUrl: null, title: "" });

  const openPreview = (params: {
    pdfUrl?: string | null;
    title: string;
    subtitle?: string;
    downloadFilename?: string;
    onGenerate?: () => Promise<string | null | undefined>;
  }) => {
    setState({ open: true, pdfUrl: params.pdfUrl ?? null, ...params });
  };

  const closePreview = () => setState((s) => ({ ...s, open: false }));

  return { state, openPreview, closePreview };
}
