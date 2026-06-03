import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { PanelLeft } from "lucide-react";

const BLUE = "oklch(19% 0.08 252)";
const GOLD = "oklch(68% 0.1 78)";
const MUTED = "oklch(45% 0.02 240)";
const BORDER = "oklch(88% 0.015 88)";

export type SidebarItem = { key: string; label: string; icon: LucideIcon; badge?: number | string; section?: string };

/** Responsive navigation for the connected dashboards.
 *  - Desktop (md+): vertical, sticky, collapsible sidebar (icons-only when collapsed).
 *  - Mobile (<md): a full-width horizontal scrollable bar of pills above the content. */
export default function DashboardSidebar({ items, active, onSelect, heading }: {
  items: SidebarItem[];
  active: string;
  onSelect: (key: string) => void;
  heading?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <aside
      className={`w-full md:self-start md:sticky md:top-20 rounded-xl overflow-hidden md:transition-[width] md:duration-200 ${collapsed ? "md:w-14" : "md:w-56"}`}
      style={{ background: "white", border: `1px solid ${BORDER}` }}
    >
      {/* Header + collapse toggle — desktop only */}
      <div className="hidden md:flex items-center gap-2 p-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
        {!collapsed && heading && <span className="text-[11px] font-semibold tracking-widest px-1.5 truncate flex-1" style={{ color: MUTED }}>{heading}</span>}
        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Déplier" : "Replier"}
          aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
          className="p-1.5 rounded-md hover:bg-black/5 ml-auto shrink-0"
          style={{ color: MUTED }}
        >
          <PanelLeft className="w-4 h-4" />
        </button>
      </div>
      <nav className="flex md:flex-col gap-1 p-2 overflow-x-auto md:overflow-visible">
        {items.map((it, i) => {
          const on = active === it.key;
          const showSection = !!it.section && it.section !== items[i - 1]?.section;
          return (
            <div key={it.key} className="contents">
            {showSection && !collapsed && (
              <div className="hidden md:block text-[10px] font-semibold tracking-widest px-2 pt-3 pb-1 first:pt-1" style={{ color: MUTED }}>{it.section}</div>
            )}
            <button
              onClick={() => onSelect(it.key)}
              title={it.label}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors shrink-0 md:w-full justify-start ${collapsed ? "md:justify-center" : ""}`}
              style={{
                background: on ? `${GOLD}22` : "transparent",
                color: on ? BLUE : MUTED,
                border: on ? `1px solid ${GOLD}55` : "1px solid transparent",
              }}
            >
              <it.icon className="w-4 h-4 shrink-0" style={{ color: on ? GOLD : MUTED }} />
              <span className={`truncate text-left ${collapsed ? "md:hidden" : "md:flex-1"}`}>{it.label}</span>
              {it.badge != null && (
                <span className={`text-[10px] px-1.5 rounded-full ${collapsed ? "md:hidden" : ""}`} style={{ background: `${GOLD}22`, color: BLUE }}>{it.badge}</span>
              )}
            </button>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
