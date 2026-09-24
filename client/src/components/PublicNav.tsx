import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { LogIn, Menu, X } from "lucide-react";
import { LOGO_EMBLEM, BRAND_NAME } from "@/lib/brand";
import UserMenu from "@/components/UserMenu";
import { getLoginUrl } from "@/const";
import ThemeToggle from "@/components/ThemeToggle";

/** Compact EN/FR/AR language switcher. */
export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex shrink-0 items-center gap-2">
      <ThemeToggle />
    <div className="app-language-switcher">
      {(["fr", "en", "ar"] as const).map(l => (
        <button
          type="button"
          key={l}
          aria-label={{ fr: "Français", en: "English", ar: "العربية" }[l]}
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
    </div>
  );
}

/** Shared top navigation for public-facing pages. */
export default function PublicNav() {
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [location, navigate] = useLocation();
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);
  // "Entreprises" presents the B2B offer on the home page; the company workspace itself
  // (/entreprise) is only reachable by managers, from the account menu.
  const LINKS = [
    { label: t("nav.catalogue"), href: "/catalogue" },
    { label: t("nav.webinars"), href: "/webinars" },
    { label: t("nav.companies"), href: "/#entreprises" },
    { label: t("nav.about"), href: "/about" },
  ];
  const isCurrent = (href: string) =>
    !href.includes("#") &&
    (location === href || location.startsWith(href + "/"));
  /** Client-side navigation for plain routes; section anchors scroll (or load the home page then scroll). */
  const followLink = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    )
      return;
    const [path, hash] = href.split("#");
    e.preventDefault();
    if (hash && location === (path || "/")) {
      document
        .getElementById(hash)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(window.history.state, "", href);
      return;
    }
    navigate(href);
  };
  return (
    <nav
      className="app-public-nav fixed top-0 left-0 right-0 z-50"
      style={{
        background:
          "color-mix(in srgb, var(--surface-strong) 97%, transparent)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="container flex items-center justify-between h-16">
        <Link href="/">
          <div className="flex items-center gap-3 cursor-pointer">
            <img
              src={LOGO_EMBLEM}
              alt={BRAND_NAME}
              className="h-10 w-auto object-contain"
            />
            <div className="hidden sm:block">
              <div className="font-sans font-bold text-foreground text-base leading-tight tracking-wide">
                {BRAND_NAME}
              </div>
              <div
                className="text-xs tracking-widest"
                style={{ color: "var(--link)" }}
              >
                {t("publicNav.tagline")}
              </div>
            </div>
          </div>
        </Link>
        <div className="hidden lg:flex items-center gap-6">
          {LINKS.map(item => (
            <a
              key={item.href}
              href={item.href}
              onClick={e => followLink(e, item.href)}
              aria-current={isCurrent(item.href) ? "page" : undefined}
              className={`text-sm transition-colors ${isCurrent(item.href) ? "text-foreground font-semibold" : "text-foreground/80 hover:text-foreground"}`}
            >
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
                <Button
                  aria-label={t("nav.login")}
                  variant="ghost"
                  size="sm"
                  className="text-foreground/80 hover:text-foreground hover:bg-foreground/10"
                >
                  <LogIn className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("nav.login")}</span>
                </Button>
              </Link>
              <Link href="/devis">
                <Button
                  size="sm"
                  className="hidden sm:inline-flex"
                  style={{
                    background: "var(--primary)",
                    color: "var(--primary-foreground)",
                  }}
                >
                  {t("nav.demo")}
                </Button>
              </Link>
            </>
          )}
          <button
            type="button"
            ref={menuButton}
            className="lg:hidden p-2 text-foreground"
            aria-expanded={open}
            aria-controls="public-mobile-menu"
            aria-label={
              lang === "fr"
                ? "Menu principal"
                : lang === "ar"
                  ? "القائمة الرئيسية"
                  : "Main menu"
            }
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {open && (
        <div
          id="public-mobile-menu"
          className="lg:hidden container pb-5 border-t border-foreground/15"
        >
          {LINKS.map(item => (
            <a
              key={item.href}
              href={item.href}
              onClick={e => {
                setOpen(false);
                followLink(e, item.href);
              }}
              aria-current={isCurrent(item.href) ? "page" : undefined}
              className="block py-3 text-foreground border-b border-foreground/10"
            >
              {item.label}
            </a>
          ))}
          <Link
            href="/devis"
            onClick={() => setOpen(false)}
            className="block py-3 text-warning"
          >
            {t("nav.demo")}
          </Link>
        </div>
      )}
    </nav>
  );
}
