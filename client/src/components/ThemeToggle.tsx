import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useI18n } from "@/i18n";

export default function ThemeToggle() {
  const { theme, toggleTheme, switchable } = useTheme();
  const { t } = useI18n();
  if (!switchable) return null;
  const light = theme === "light";
  return (
    <button
      type="button"
      className="app-theme-switcher"
      onClick={toggleTheme}
      aria-label={t("theme.light")}
      aria-pressed={light}
      title={t(light ? "theme.switchDark" : "theme.switchLight")}
    >
      {light ? <Moon aria-hidden="true" size={18} /> : <Sun aria-hidden="true" size={18} />}
    </button>
  );
}
