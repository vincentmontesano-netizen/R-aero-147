import { useState } from "react";
import { Link } from "wouter";
import { useI18n } from "@/i18n";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ShoppingCart, CreditCard, Lock, CheckCircle, ArrowRight, FileText } from "lucide-react";
import { toast } from "sonner";
import PublicNav from "@/components/PublicNav";
import { catalogueKey, formatEuro, formatHours } from "@/lib/utils";

export default function Checkout() {
  const { t, lang } = useI18n();
  const { user, isAuthenticated } = useAuth();
  const [companyId, setCompanyId] = useState("");
  const organizations = trpc.me.organizations.useQuery(undefined, { enabled: isAuthenticated });
  const [isRedirecting, setIsRedirecting] = useState(false);
  const { data: cartItems = [], isLoading } = trpc.cart.list.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const paymentsAvailable = trpc.public.paymentsAvailable.useQuery();

  const createSession = trpc.checkout.createSession.useMutation({
    onSuccess: (data) => {
      if (data?.url) {
        toast.success(t("checkout.toastRedirecting"));
        window.location.href = data.url;
      } else {
        setIsRedirecting(false);
      }
    },
    onError: (err) => {
      toast.error(err.message || t("checkout.toastSessionError"));
      setIsRedirecting(false);
    },
  });

  const totalHt = cartItems.reduce((sum, item) => sum + Number((item.training as any)?.priceHt ?? 0) * (item.quantity ?? 1), 0);
  const totalTtc = cartItems.reduce((sum, item) => sum + Number((item.training as any)?.priceTtc ?? 0) * (item.quantity ?? 1), 0);
  const vatAmount = totalTtc - totalHt;

  const handleCheckout = () => {
    if (!isAuthenticated) { toast.error(t("checkout.toastLoginRequired")); return; }
    setIsRedirecting(true);
    createSession.mutate({ origin: window.location.origin, companyId: companyId ? Number(companyId) : undefined });
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(97% 0.01 88)" }}><div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "oklch(68% 0.1 78)", borderTopColor: "transparent" }} /></div>;

  return (
    <div className="min-h-screen" style={{ background: "oklch(97% 0.01 88)" }}>
      <PublicNav />
      <div style={{ background: "oklch(19% 0.08 252)", paddingTop: "5rem" }}>
        <div className="container py-10">
          <h1 className="font-serif text-3xl font-bold text-white mb-1">{t("checkout.pageTitle")}</h1>
          <p className="text-white/60 text-sm">{t("checkout.pageSubtitle")}</p>
        </div>
      </div>

      <div className="container py-8">
        {cartItems.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingCart className="w-12 h-12 mx-auto mb-4" style={{ color: "oklch(68% 0.1 78)" }} />
            <h2 className="font-serif text-xl font-bold mb-2" style={{ color: "oklch(19% 0.08 252)" }}>{t("checkout.emptyCart")}</h2>
            <Link href="/catalogue"><Button style={{ background: "oklch(19% 0.08 252)", color: "oklch(97% 0.01 88)" }}>{t("checkout.viewCatalogue")}</Button></Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Order items */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="font-semibold" style={{ color: "oklch(19% 0.08 252)" }}>{t("checkout.orderedTrainings")}</h2>
              {cartItems.map((item) => (
                <div key={item.id} className="rounded-xl p-5 flex items-start gap-4" style={{ background: "oklch(100% 0 0)", border: "1px solid oklch(88% 0.015 88)" }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "oklch(68% 0.1 78 / 0.1)" }}>
                    <FileText className="w-5 h-5" style={{ color: "oklch(68% 0.1 78)" }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm mb-1" style={{ color: "oklch(19% 0.08 252)" }}>{(item.training as any)?.title ?? t("checkout.trainingFallback")}</h3>
                    <div className="text-xs" style={{ color: "oklch(62% 0.02 240)" }}>
                      {t(catalogueKey("catalogue.type", (item.training as any)?.type))} · {formatHours((item.training as any)?.durationHours, lang)} · {t("checkout.quantityLabel")} {item.quantity ?? 1}
                    </div>
                    {(item.training as any)?.part147Reference && (
                      <div className="text-xs mt-1" style={{ color: "oklch(42% 0.1 218)" }}>{(item.training as any).part147Reference}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-bold" style={{ color: "oklch(19% 0.08 252)" }}>{formatEuro((item.training as any)?.priceTtc, lang)}</div>
                    <div className="text-xs" style={{ color: "oklch(62% 0.02 240)" }}>{t("checkout.inclVat")}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary + payment */}
            <div className="space-y-4">
              <div className="rounded-xl p-6" style={{ background: "oklch(100% 0 0)", border: "1px solid oklch(88% 0.015 88)" }}>
                <label className="block text-sm mb-4">{t("licenses.buyer")}<select className="border rounded p-2 w-full mt-2" value={companyId} onChange={e => setCompanyId(e.target.value)}><option value="">{t("licenses.personal")}</option>{organizations.data?.filter(o => o.role === "MANAGER").map(o => <option key={o.orgId} value={o.orgId}>{o.name}</option>)}</select></label>
                <h2 className="font-semibold mb-4" style={{ color: "oklch(19% 0.08 252)" }}>{t("checkout.summaryTitle")}</h2>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm" style={{ color: "oklch(45% 0.02 240)" }}>
                    <span>{t("checkout.subtotalExclVat")}</span>
                    <span>{formatEuro(totalHt, lang)}</span>
                  </div>
                  <div className="flex justify-between text-sm" style={{ color: "oklch(45% 0.02 240)" }}>
                    <span>{t("checkout.vatRate")}</span>
                    <span>{formatEuro(vatAmount, lang)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold text-base" style={{ borderColor: "oklch(88% 0.015 88)", color: "oklch(19% 0.08 252)" }}>
                    <span>{t("checkout.totalInclVat")}</span>
                    <span>{formatEuro(totalTtc, lang)}</span>
                  </div>
                </div>

                {paymentsAvailable.data === false ? (
                  <div role="status" className="rounded-lg p-4 mb-3 text-sm" style={{ background: "oklch(68% 0.1 78 / 0.12)", color: "oklch(19% 0.08 252)" }}>
                    <p className="font-semibold mb-1">{t("checkout.paymentsUnavailableTitle")}</p>
                    <p className="mb-3" style={{ color: "oklch(45% 0.02 240)" }}>{t("checkout.paymentsUnavailableText")}</p>
                    <Link href="/devis"><Button className="w-full font-semibold" style={{ background: "oklch(19% 0.08 252)", color: "white" }}><FileText className="w-4 h-4 mr-2" />{t("checkout.requestQuote")}</Button></Link>
                  </div>
                ) : (
                  <Button
                    size="lg"
                    className="w-full btn-press font-semibold mb-3"
                    onClick={handleCheckout}
                    disabled={isRedirecting || createSession.isPending}
                    style={{ background: "oklch(68% 0.1 78)", color: "oklch(19% 0.08 252)" }}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    {isRedirecting ? t("checkout.redirecting") : t("checkout.payAmount", { amount: new Intl.NumberFormat(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalTtc) })}
                  </Button>
                )}

                {paymentsAvailable.data !== false && <div className="flex items-center justify-center gap-2 text-xs" style={{ color: "oklch(62% 0.02 240)" }}>
                  <Lock className="w-3 h-3" />
                  {t("checkout.securePayment")}
                </div>}
              </div>

              {/* What's included */}
              <div className="rounded-xl p-5" style={{ background: "oklch(19% 0.08 252)" }}>
                <h3 className="font-semibold text-white text-sm mb-3">{t("checkout.includedTitle")}</h3>
                <ul className="space-y-2">
                  {[
                    t("checkout.includedImmediateAccess"),
                    t("checkout.includedSavedProgress"),
                    t("checkout.includedQuizFinalEval"),
                    t("checkout.includedDownloadableCertificate"),
                    t("checkout.includedAutoInvoice"),
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-xs text-white/70">
                      <CheckCircle className="w-3 h-3 flex-shrink-0" style={{ color: "oklch(68% 0.1 78)" }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <Link href="/cart">
                <Button variant="outline" size="sm" className="w-full">
                  ← {t("checkout.editCart")}
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
