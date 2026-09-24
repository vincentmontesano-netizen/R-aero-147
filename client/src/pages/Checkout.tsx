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

  if (isLoading) return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}><div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--link)", borderTopColor: "transparent" }} /></div>;

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <PublicNav />
      <div style={{ background: "var(--surface-strong)", paddingTop: "5rem" }}>
        <div className="container py-10">
          <h1 className="font-sans text-3xl font-bold text-foreground mb-1">{t("checkout.pageTitle")}</h1>
          <p className="text-muted-foreground text-sm">{t("checkout.pageSubtitle")}</p>
        </div>
      </div>

      <div className="container py-8">
        {cartItems.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingCart className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--link)" }} />
            <h2 className="font-sans text-xl font-bold mb-2" style={{ color: "var(--foreground)" }}>{t("checkout.emptyCart")}</h2>
            <Link href="/catalogue"><Button style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>{t("checkout.viewCatalogue")}</Button></Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Order items */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="font-semibold" style={{ color: "var(--foreground)" }}>{t("checkout.orderedTrainings")}</h2>
              {cartItems.map((item) => (
                <div key={item.id} className="rounded-xl p-5 flex items-start gap-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "color-mix(in srgb, var(--link) 10%, transparent)" }}>
                    <FileText className="w-5 h-5" style={{ color: "var(--link)" }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm mb-1" style={{ color: "var(--foreground)" }}>{(item.training as any)?.title ?? t("checkout.trainingFallback")}</h3>
                    <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {t(catalogueKey("catalogue.type", (item.training as any)?.type))} · {formatHours((item.training as any)?.durationHours, lang)} · {t("checkout.quantityLabel")} {item.quantity ?? 1}
                    </div>
                    {(item.training as any)?.part147Reference && (
                      <div className="text-xs mt-1" style={{ color: "var(--info)" }}>{(item.training as any).part147Reference}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-bold" style={{ color: "var(--foreground)" }}>{formatEuro((item.training as any)?.priceTtc, lang)}</div>
                    <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t("checkout.inclVat")}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary + payment */}
            <div className="space-y-4">
              <div className="rounded-xl p-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <label className="block text-sm mb-4">{t("licenses.buyer")}<select className="border rounded p-2 w-full mt-2" value={companyId} onChange={e => setCompanyId(e.target.value)}><option value="">{t("licenses.personal")}</option>{organizations.data?.filter(o => o.role === "MANAGER").map(o => <option key={o.orgId} value={o.orgId}>{o.name}</option>)}</select></label>
                <h2 className="font-semibold mb-4" style={{ color: "var(--foreground)" }}>{t("checkout.summaryTitle")}</h2>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm" style={{ color: "var(--muted-foreground)" }}>
                    <span>{t("checkout.subtotalExclVat")}</span>
                    <span>{formatEuro(totalHt, lang)}</span>
                  </div>
                  <div className="flex justify-between text-sm" style={{ color: "var(--muted-foreground)" }}>
                    <span>{t("checkout.vatRate")}</span>
                    <span>{formatEuro(vatAmount, lang)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold text-base" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
                    <span>{t("checkout.totalInclVat")}</span>
                    <span>{formatEuro(totalTtc, lang)}</span>
                  </div>
                </div>

                {paymentsAvailable.data === false ? (
                  <div role="status" className="rounded-lg p-4 mb-3 text-sm" style={{ background: "color-mix(in srgb, var(--link) 12%, transparent)", color: "var(--foreground)" }}>
                    <p className="font-semibold mb-1">{t("checkout.paymentsUnavailableTitle")}</p>
                    <p className="mb-3" style={{ color: "var(--muted-foreground)" }}>{t("checkout.paymentsUnavailableText")}</p>
                    <Link href="/devis"><Button className="w-full font-semibold" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}><FileText className="w-4 h-4 mr-2" />{t("checkout.requestQuote")}</Button></Link>
                  </div>
                ) : (
                  <Button
                    size="lg"
                    className="w-full btn-press font-semibold mb-3"
                    onClick={handleCheckout}
                    disabled={isRedirecting || createSession.isPending}
                    style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    {isRedirecting ? t("checkout.redirecting") : t("checkout.payAmount", { amount: new Intl.NumberFormat(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalTtc) })}
                  </Button>
                )}

                {paymentsAvailable.data !== false && <div className="flex items-center justify-center gap-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                  <Lock className="w-3 h-3" />
                  {t("checkout.securePayment")}
                </div>}
              </div>

              {/* What's included */}
              <div className="rounded-xl p-5" style={{ background: "var(--surface-strong)" }}>
                <h3 className="font-semibold text-foreground text-sm mb-3">{t("checkout.includedTitle")}</h3>
                <ul className="space-y-2">
                  {[
                    t("checkout.includedImmediateAccess"),
                    t("checkout.includedSavedProgress"),
                    t("checkout.includedQuizFinalEval"),
                    t("checkout.includedDownloadableCertificate"),
                    t("checkout.includedAutoInvoice"),
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle className="w-3 h-3 flex-shrink-0" style={{ color: "var(--link)" }} />
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
