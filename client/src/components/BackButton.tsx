import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

/** Consistent "back" button. Goes to the previous page, or to `fallback` if there's no history. */
export default function BackButton({ fallback = "/", dark = false, label = "Retour" }: { fallback?: string; dark?: boolean; label?: string }) {
  const [, setLocation] = useLocation();
  const goBack = () => {
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
