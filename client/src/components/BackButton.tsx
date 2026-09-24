import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n";

/** Consistent "back" button. For a signed-in user it returns to their own dashboard —
 *  and, on that dashboard itself, to the public website instead of a no-op;
 *  otherwise it goes back in history, falling back to `fallback`. */
export default function BackButton({ fallback = "/", dark = false, label }: { fallback?: string; dark?: boolean; label?: string }) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { t } = useI18n();
  const roleHome = user
    ? (user.role === "admin" ? "/admin" : user.role === "company_manager" ? "/entreprise" : "/dashboard")
    : null;
  const onRoleHome = roleHome !== null && location === roleHome;
  const goBack = () => {
    if (onRoleHome) { setLocation("/"); return; }
    // Signed-in users always come back to their space.
    if (roleHome) { setLocation(roleHome); return; }
    if (typeof window !== "undefined" && window.history.length > 1) window.history.back();
    else setLocation(fallback);
  };
  return (
    <button
      onClick={goBack}
      className={`inline-flex items-center gap-1.5 text-sm font-medium mb-4 transition-colors ${dark ? "text-muted-foreground hover:text-white" : "hover:opacity-70"}`}
      style={dark ? undefined : { color: "var(--muted-foreground)" }}
    >
      <ArrowLeft className="w-4 h-4 rtl:rotate-180" /> {label ?? t(onRoleHome ? "common.backToSite" : "common.back")}
    </button>
  );
}
