import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n";
import { ShoppingCart } from "lucide-react";

const GOLD = "oklch(68% 0.1 78)";
const BLUE = "oklch(19% 0.08 252)";

/** Inline cart button for dashboard headers (aligned with the bell + avatar).
 *  Shows only when the connected user has items in their cart. */
export default function CartButton({ dark = false }: { dark?: boolean }) {
  const { isAuthenticated } = useAuth();
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const { data: count = 0 } = trpc.cart.count.useQuery(undefined, {
    enabled: isAuthenticated, retry: false, refetchInterval: 15000,
  });
  if (!isAuthenticated || !count) return null;

  return (
    <button
      type="button"
      onClick={() => setLocation("/cart")}
      aria-label={t("cartWidget.title")}
      title={t("cartWidget.title")}
      className="relative h-9 w-9 flex items-center justify-center rounded-lg transition-colors"
      style={dark ? { color: "white", border: "1px solid oklch(1 0 0 / 0.2)" } : { color: BLUE, border: "1px solid oklch(88% 0.015 88)" }}
    >
      <ShoppingCart className="w-4 h-4" />
      <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
        style={{ background: GOLD, color: BLUE }}>{count}</span>
    </button>
  );
}
