import { useState, type MouseEvent } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { LogIn, Menu, X } from "lucide-react";
import { LOGO_EMBLEM, BRAND_NAME } from "@/lib/brand";
import UserMenu from "@/components/UserMenu";
import { getLoginUrl } from "@/const";

const DEEP_BLUE = "oklch(19% 0.08 252)";
const GOLD = "oklch(68% 0.1 78)";

/** Compact EN/FR/AR language switcher. */
export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid oklch(68% 0.1 78 / 0.4)" }}>
      {(["fr", "en", "ar"] as const).map((l) => (
        <button key={l} aria-label={{ fr: "Français", en: "English", ar: "العربية" }[l]} aria-pressed={lang === l} onClick={() => setLang(l)} className="px-2 py-1 text-sm font-semibold transition-colors"
          style={{ background: lang === l ? GOLD : "transparent", color: lang === l ? DEEP_BLUE : "rgba(255,255,255,0.8)" }}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/** Shared top navigation for public-facing pages. */
export default function PublicNav() {
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [location, navigate] = useLocation();
  // "Entreprises" presents the B2B offer on the home page; the company workspace itself
  // (/entreprise) is only reachable by managers, from the account menu.
  const LINKS = [
    { label: t("nav.catalogue"), href: "/catalogue" },
    { label: t("nav.webinars"), href: "/webinars" },
    { label: t("nav.companies"), href: "/#entreprises" },
    { label: t("nav.about"), href: "/about" },
  ];
  const isCurrent = (href: string) => !href.includes("#") && (location === href || location.startsWith(href + "/"));
  /** Client-side navigation for plain routes; section anchors scroll (or load the home page then scroll). */
  const followLink = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const [path, hash] = href.split("#");
    e.preventDefault();
    if (hash && location === (path || "/")) {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(window.history.state, "", href);
      return;
    }
    navigate(href);
  };
  return (
    <nav className="fixed top-0 left-0 right-0 z-50" style={{ background: "oklch(19% 0.08 252 / 0.97)", backdropFilter: "blur(12px)", borderBottom: "1px solid oklch(68% 0.1 78 / 0.2)" }}>
      <div className="container flex items-center justify-between h-16">
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer">
            <img src={LOGO_EMBLEM} alt={BRAND_NAME} className="h-10 w-auto object-contain" />
            <div className="hidden sm:block">
              <div className="font-sans font-bold text-white text-base leading-tight tracking-wide">{BRAND_NAME}</div>
              <div className="text-xs tracking-widest" style={{ color: GOLD }}>{t("publicNav.tagline")}</div>
            </div>
          </div>
        </Link>
        <div className="hidden lg:flex items-center gap-6">
          {LINKS.map((item) => (
            <a key={item.href} href={item.href} onClick={(e) => followLink(e, item.href)} aria-current={isCurrent(item.href) ? "page" : undefined}
              className={`text-sm transition-colors ${isCurrent(item.href) ? "text-white font-semibold" : "text-white/80 hover:text-white"}`}>
              {item.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {isAuthenticated ? (
            <UserMenu />
          ) : (
            <>
              <Link href={getLoginUrl(location)}>
                <Button aria-label={t("nav.login")} variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">
                  <LogIn className="w-4 h-4" /><span className="hidden sm:inline">{t("nav.login")}</span>
                </Button>
              </Link>
              <Link href="/devis">
                <Button size="sm" className="hidden sm:inline-flex" style={{ background: GOLD, color: DEEP_BLUE }}>{t("nav.demo")}</Button>
              </Link>
            </>
          )}
          <button className="lg:hidden p-2 text-white" aria-expanded={open} aria-controls="public-mobile-menu"
            aria-label={lang === "fr" ? "Menu principal" : lang === "ar" ? "القائمة الرئيسية" : "Main menu"} onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
      </div>
      {open && <div id="public-mobile-menu" className="lg:hidden container pb-5 border-t border-white/15">
        {LINKS.map(item => <a key={item.href} href={item.href} onClick={(e) => { setOpen(false); followLink(e, item.href); }} aria-current={isCurrent(item.href) ? "page" : undefined} className="block py-3 text-white border-b border-white/10">{item.label}</a>)}
        <Link href="/devis" onClick={() => setOpen(false)} className="block py-3 text-amber-200">{t("nav.demo")}</Link>
      </div>}
    </nav>
  );
}
