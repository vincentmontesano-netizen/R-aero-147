import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n";
import { ShoppingCart } from "lucide-react";

const BLUE = "oklch(19% 0.08 252)";
const GOLD = "oklch(68% 0.1 78)";

// Don't show on cart/checkout/auth pages, nor on the dashboards (which carry an
// inline cart button in their header, aligned with the bell + avatar).
const HIDE_ON = ["/cart", "/checkout", "/login", "/register", "/reset-password", "/dashboard", "/entreprise", "/admin", "/profil", "/support", "/mes-devis"];

/** Floating top-right cart indicator — visible only when the connected user has
 *  items in their cart. Links to the cart page with a live item count. */
export default function CartWidget() {
  const { isAuthenticated } = useAuth();
  const { t } = useI18n();
  const [loc] = useLocation();
  const { data: count = 0 } = trpc.cart.count.useQuery(undefined, {
    enabled: isAuthenticated, retry: false, refetchInterval: 15000,
  });

  if (!isAuthenticated || !count || HIDE_ON.some((p) => loc.startsWith(p))) return null;

  return (
    <Link href="/cart">
      <button
        className="fixed top-20 right-4 z-40 flex items-center gap-2 rounded-full pl-3 pr-4 py-2 shadow-lg hover:shadow-xl transition-shadow"
        style={{ background: GOLD, color: BLUE }}
        title={t("cartWidget.title")}
        aria-label={t("cartWidget.title")}
      >
        <span className="relative">
          <ShoppingCart className="w-5 h-5" />
          <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
            style={{ background: BLUE, color: "white" }}>{count}</span>
        </span>
        <span className="text-sm font-semibold hidden sm:inline">{t("cartWidget.label")}</span>
      </button>
    </Link>
  );
}
