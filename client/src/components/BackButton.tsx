import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

/** Consistent "back" button. For a signed-in user it returns to their own dashboard;
 *  otherwise it goes back in history, falling back to `fallback`. */
export default function BackButton({ fallback = "/", dark = false, label = "Retour" }: { fallback?: string; dark?: boolean; label?: string }) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const roleHome = user
    ? (user.role === "admin" ? "/admin" : user.role === "company_manager" ? "/entreprise" : "/dashboard")
    : null;
  const goBack = () => {
    // Signed-in users always come back to their space.
    if (roleHome) { setLocation(roleHome); return; }
    if (typeof window !== "undefined" && window.history.length > 1) window.history.back();
    else setLocation(fallback);
  };
  return (
    <button
      onClick={goBack}
      className={`inline-flex items-center gap-1.5 text-sm font-medium mb-4 transition-colors ${dark ? "text-white/70 hover:text-white" : "hover:opacity-70"}`}
      style={dark ? undefined : { color: "oklch(45% 0.02 240)" }}
    >
      <ArrowLeft className="w-4 h-4" /> {label}
    </button>
  );
}
