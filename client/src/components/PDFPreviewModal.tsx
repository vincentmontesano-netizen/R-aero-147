import { useState, useEffect, useRef } from "react";
import { useI18n } from "@/i18n";
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
  const { lang } = useI18n();
  const labels = lang === 'fr' ? { open: 'Ouvrir', download: 'Télécharger', close: 'Fermer', zoomIn: 'Agrandir', zoomOut: 'Réduire', reset: 'Réinitialiser le zoom', generating: 'Génération en cours…', wait: 'Le document est en cours de création.', error: 'Erreur de génération', failed: 'Impossible de générer le document. Réessayez.', retry: 'Réessayer', unavailable: 'Document non disponible', missing: "Ce document n’a pas encore été généré.", zoom: 'Ajustez l’affichage avec les contrôles de zoom.' }
    : lang === 'ar' ? { open: 'فتح', download: 'تنزيل', close: 'إغلاق', zoomIn: 'تكبير', zoomOut: 'تصغير', reset: 'إعادة ضبط التكبير', generating: 'جارٍ الإنشاء…', wait: 'جارٍ إنشاء المستند.', error: 'تعذر إنشاء المستند', failed: 'تعذر إنشاء المستند. حاول مرة أخرى.', retry: 'إعادة المحاولة', unavailable: 'المستند غير متاح', missing: 'لم يتم إنشاء هذا المستند بعد.', zoom: 'اضبط العرض باستخدام أدوات التكبير.' }
    : { open: 'Open', download: 'Download', close: 'Close', zoomIn: 'Zoom in', zoomOut: 'Zoom out', reset: 'Reset zoom', generating: 'Generating…', wait: 'Your document is being created.', error: 'Generation failed', failed: 'Unable to generate the document. Please try again.', retry: 'Retry', unavailable: 'Document unavailable', missing: 'This document has not been generated yet.', zoom: 'Adjust the view using the zoom controls.' };
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(pdfUrl ?? null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [iframeKey, setIframeKey] = useState(0);
  const returnFocusRef = useRef<HTMLElement | null>(null);

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
          setError(labels.failed);
        }
      })
      .catch(() => setError(labels.failed))
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
    if (!viewerUrl) return;
    window.open(viewerUrl, "_blank", "noopener");
  };

  const handleZoomIn = () => setZoom((z) => Math.min(z + 20, 200));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 20, 50));
  const handleResetZoom = () => setZoom(100);

  // Only generated private PDFs opt into inline display; direct links still download.
  const viewerUrl = resolvedUrl ? (() => {
    const url = new URL(resolvedUrl, window.location.origin);
    if (url.origin === window.location.origin && /^\/storage\/(certificates|invoices)\/.*\.pdf$/i.test(url.pathname)) url.searchParams.set("preview", "1");
    url.hash = "toolbar=1&navpanes=0&scrollbar=1&view=FitH";
    return url.href;
  })() : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        className="sm:max-w-5xl w-[calc(100%-2rem)] p-0 overflow-hidden"
        showCloseButton={false}
        onOpenAutoFocus={() => {
          returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          if (returnFocusRef.current?.isConnected) {
            event.preventDefault();
            returnFocusRef.current.focus({ preventScroll: true });
          }
        }}
        style={{
          height: "90vh",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--background)",
        }}
      >
        {/* Header */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 flex-shrink-0"
          style={{ background: "var(--surface-strong)", borderBottom: "1px solid color-mix(in srgb, var(--link) 20%, transparent)" }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center"
              style={{ background: "color-mix(in srgb, var(--link) 15%, transparent)" }}
            >
              <FileText className="w-4 h-4" style={{ color: "var(--link)" }} />
            </div>
            <div>
              <DialogTitle className="font-semibold text-sm text-foreground break-words">{title}</DialogTitle>
              {subtitle && <div className="text-xs" style={{ color: "var(--link)" }}>{subtitle}</div>}
            </div>
          </div>

          <div className="flex flex-wrap w-full sm:w-auto items-center gap-2">
            {/* Zoom controls */}
            {resolvedUrl && (
              <div className="flex items-center gap-1 mr-2">
                <button
                  aria-label={labels.zoomOut}
                  onClick={handleZoomOut}
                  disabled={zoom <= 50}
                  className="w-10 h-10 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors disabled:opacity-30"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  aria-label={labels.reset}
                  onClick={handleResetZoom}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors px-1 min-w-10 text-center"
                >
                  {zoom}%
                </button>
                <button
                  aria-label={labels.zoomIn}
                  onClick={handleZoomIn}
                  disabled={zoom >= 200}
                  className="w-10 h-10 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors disabled:opacity-30"
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
                  className="text-muted-foreground hover:text-foreground hover:bg-foreground/10 h-8 px-3"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  <span className="text-xs">{labels.open}</span>
                </Button>
                <Button
                  size="sm"
                  onClick={handleDownload}
                  className="h-8 px-3 font-semibold btn-press"
                  style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  <span className="text-xs">{labels.download}</span>
                </Button>
              </>
            )}

            <button
              aria-label={labels.close}
                  onClick={handleClose}
              className="w-10 h-10 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 relative overflow-hidden" style={{ background: "var(--muted)" }}>
          {/* Loading state */}
          {isGenerating && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "var(--surface-strong)" }}
              >
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--link)" }} />
              </div>
              <div className="text-center">
                <div className="font-semibold text-foreground mb-1">{labels.generating}</div>
                <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                  {labels.wait}
                </div>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && !isGenerating && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "color-mix(in srgb, var(--destructive) 15%, transparent)" }}
              >
                <AlertCircle className="w-8 h-8" style={{ color: "var(--destructive)" }} />
              </div>
              <div className="text-center">
                <div className="font-semibold text-foreground mb-1">{labels.error}</div>
                <div className="text-sm mb-4" style={{ color: "var(--muted-foreground)" }}>{error}</div>
                {onGenerate && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setError(null);
                      setIsGenerating(true);
                      onGenerate()
                        .then((url) => { if (url) setResolvedUrl(url); else setError(labels.failed); })
                        .catch(() => setError(labels.failed))
                        .finally(() => setIsGenerating(false));
                    }}
                    style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> {labels.retry}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* PDF iframe viewer */}
          {viewerUrl && !isGenerating && !error && (
            <div
              className="w-full h-full flex items-start justify-center overflow-auto py-4"
              style={{ background: "var(--muted)" }}
            >
              <div
                style={{
                  width: `${zoom}%`,
                  flexShrink: 0,
                  minWidth: 0,
                  height: "100%",
                  transition: "width 200ms cubic-bezier(0.23, 1, 0.32, 1)",
                  boxShadow: "0 8px 40px color-mix(in srgb, #000 50%, transparent)",
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
                style={{ background: "var(--surface-strong)" }}
              >
                <FileText className="w-8 h-8" style={{ color: "var(--link)" }} />
              </div>
              <div className="text-center">
                <div className="font-semibold text-foreground mb-1">{labels.unavailable}</div>
                <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                  {labels.missing}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        {resolvedUrl && !isGenerating && !error && (
          <div
            className="px-4 py-2 flex flex-wrap gap-2 items-center justify-between flex-shrink-0"
            style={{ background: "color-mix(in srgb, var(--surface-strong) 95%, transparent)", borderTop: "1px solid color-mix(in srgb, var(--link) 15%, transparent)" }}
          >
            <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              R-AERO Training Academy
            </div>
            <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {labels.zoom}
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
