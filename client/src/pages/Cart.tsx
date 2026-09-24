import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import BackButton from "@/components/BackButton";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Trash2, ArrowRight, LogIn, Package } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import PublicNav from "@/components/PublicNav";
import { catalogueKey, formatEuro, formatHours } from "@/lib/utils";

export default function Cart() {
  const { t, lang } = useI18n();
  const { isAuthenticated, loading } = useAuth();
  const { data: cartItems = [], refetch } = trpc.cart.list.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const removeItem = trpc.cart.remove.useMutation({
    onSuccess: () => { toast.success(t("cart.toastItemRemoved")); refetch(); },
    onError: e => toast.error(e.message),
  });
  const clearCart = trpc.cart.clear.useMutation({
    onSuccess: () => { toast.success(t("cart.toastCartCleared")); refetch(); },
    onError: e => toast.error(e.message),
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}><div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--link)", borderTopColor: "transparent" }} /></div>;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <PublicNav />
        <div className="text-center max-w-sm">
          <LogIn className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--link)" }} />
          <h2 className="font-sans text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>{t("cart.loginRequired")}</h2>
          <a href={getLoginUrl()}><Button style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>{t("cart.login")}</Button></a>
        </div>
      </div>
    );
  }

  const totalHt = cartItems.reduce((sum, item) => sum + (Number((item.training as any)?.priceHt ?? 0) * (item.quantity ?? 1)), 0);
  const totalTtc = cartItems.reduce((sum, item) => sum + (Number((item.training as any)?.priceTtc ?? 0) * (item.quantity ?? 1)), 0);
  const vatAmount = totalTtc - totalHt;

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <PublicNav />
      <div style={{ background: "var(--surface-strong)", paddingTop: "5rem" }}>
        <div className="container py-10">
          <BackButton dark />
          <h1 className="font-sans text-3xl font-bold text-white mb-1">{t("cart.title")}</h1>
          <p className="text-muted-foreground text-sm">{cartItems.length} {cartItems.length > 1 ? t("cart.itemsPlural") : t("cart.itemSingular")}</p>
        </div>
      </div>

      <div className="container py-8">
        {cartItems.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingCart className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--link)" }} />
            <h2 className="font-sans text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>{t("cart.emptyTitle")}</h2>
            <p className="text-sm mb-6" style={{ color: "var(--muted-foreground)" }}>{t("cart.emptyDescription")}</p>
            <Link href="/catalogue"><Button style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>{t("cart.viewCatalogue")}</Button></Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Items */}
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item) => (
                <div key={item.id} className="rounded-xl p-5 flex items-start justify-between gap-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1" style={{ color: "var(--foreground)" }}>{(item.training as any)?.title ?? t("cart.defaultTrainingTitle")}</h3>
                    <div className="text-xs mb-2" style={{ color: "var(--muted-foreground)" }}>
                      {t(catalogueKey("catalogue.type", (item.training as any)?.type))} · {formatHours((item.training as any)?.durationHours, lang)} · {(item.training as any)?.language?.toUpperCase()}
                    </div>
                    <div className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                      {formatEuro((item.training as any)?.priceTtc, lang)} {t("cart.priceTtcSuffix")}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t("cart.removeItem")}
                    onClick={() => removeItem.mutate({ itemId: item.id })}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => clearCart.mutate()} className="text-destructive">
                  {t("cart.clearCart")}
                </Button>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-xl p-6 h-fit" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <h2 className="font-semibold mb-4" style={{ color: "var(--foreground)" }}>{t("cart.summary")}</h2>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm" style={{ color: "var(--muted-foreground)" }}>
                  <span>{t("cart.subtotalHt")}</span>
                  <span>{formatEuro(totalHt, lang)}</span>
                </div>
                <div className="flex justify-between text-sm" style={{ color: "var(--muted-foreground)" }}>
                  <span>{t("cart.vat")}</span>
                  <span>{formatEuro(vatAmount, lang)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
                  <span>{t("cart.totalTtc")}</span>
                  <span>{formatEuro(totalTtc, lang)}</span>
                </div>
              </div>
              <Link href="/checkout">
                <Button size="lg" className="w-full btn-press font-semibold" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                  {t("cart.proceedToPayment")} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <p className="text-xs text-center mt-3" style={{ color: "var(--muted-foreground)" }}>
                {t("cart.securePayment")}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
