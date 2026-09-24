import { toast } from 'sonner';
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n";
import { trpc } from "@/lib/trpc";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { LayoutDashboard, User, FileText, LifeBuoy, LogOut, Shield, Building2 } from "lucide-react";

const GOLD = "var(--link)";
const BLUE = "var(--foreground)";
const MUTED = "var(--muted-foreground)";
const RED = "var(--destructive)";

function initials(name?: string | null, email?: string | null): string {
  const src = (name && name.trim()) || email || "";
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  const ini = ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  return ini || (email?.[0] ?? "U").toUpperCase();
}

/** Connected-user avatar + dropdown (profile, spaces, logout). */
export default function UserMenu() {
  const { user, logout, loading } = useAuth();
  const { t, lang } = useI18n();
  const { data: myOrgs = [] } = trpc.me.organizations.useQuery(undefined, { enabled: !!user });
  if (!user) return null;
  const isAdmin = (user as any).role === "admin";
  const isManager = myOrgs.some(o => o.role === "MANAGER");
  const canAuthor = isAdmin || user.role === "instructor" || isManager;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={t("userMenu.accountMenuAria")}
          title={user.name ?? user.email ?? ""}
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ring-2 ring-white/20 hover:ring-white/50 transition-shadow shrink-0"
          style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {initials(user.name, user.email)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="font-semibold truncate" style={{ color: "var(--foreground)" }}>{user.name ?? t("userMenu.myAccount")}</div>
          {user.email && <div className="text-xs font-normal truncate" style={{ color: "var(--muted-foreground)" }}>{user.email}</div>}
          {(myOrgs as any[]).map((o) => (
            <div key={o.orgId} className="flex items-center gap-1 text-xs font-normal mt-1 truncate" style={{ color: "var(--link)" }}>
              <Building2 className="w-3 h-3 shrink-0" />
              <span className="truncate">{o.name}</span>
              <span style={{ color: "var(--muted-foreground)" }}>· {o.role === "MANAGER" ? t("org.roleManager") : t("org.roleMember")}</span>
            </div>
          ))}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isAdmin && (
          <DropdownMenuItem asChild><Link href="/admin"><Shield className="w-4 h-4 mr-2" /> {t("userMenu.administration")}</Link></DropdownMenuItem>
        )}
        {isAdmin && <DropdownMenuItem asChild><Link href="/admin/approval"><Shield className="w-4 h-4 mr-2" /> {t("approval.menu")}</Link></DropdownMenuItem>}
        {isManager && (
          <DropdownMenuItem asChild><Link href="/entreprise"><LayoutDashboard className="w-4 h-4 mr-2" /> {t("userMenu.companySpace")}</Link></DropdownMenuItem>
        )}
        {!isAdmin && <DropdownMenuItem asChild><Link href="/dashboard"><LayoutDashboard className="w-4 h-4 mr-2" /> {t("userMenu.mySpace")}</Link></DropdownMenuItem>}
        {(isManager || isAdmin) && <DropdownMenuItem asChild><Link href="/abonnements"><Building2 className="w-4 h-4 mr-2" />{lang === "fr" ? "Abonnements compagnie" : lang === "ar" ? "اشتراكات الشركات" : "Company subscriptions"}</Link></DropdownMenuItem>}
        {canAuthor && <DropdownMenuItem asChild><Link href="/maker"><FileText className="w-4 h-4 mr-2" /> {t("maker.title")}</Link></DropdownMenuItem>}
        <DropdownMenuItem asChild><Link href="/licences"><FileText className="w-4 h-4 mr-2" /> {t("licenses.title")}</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/verifications"><Shield className="w-4 h-4 mr-2" /> {t("verification.menu")}</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/profil"><User className="w-4 h-4 mr-2" /> {t("userMenu.myProfile")}</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/mes-devis"><FileText className="w-4 h-4 mr-2" /> {t("userMenu.myQuotes")}</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href="/support"><LifeBuoy className="w-4 h-4 mr-2" /> {t("userMenu.support")}</Link></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={loading} onClick={() => { void logout().catch(() => toast.error(t("userMenu.logoutUnconfirmed"))); }} style={{ color: "var(--destructive)" }}>
          <LogOut className="w-4 h-4 mr-2" /> {t("userMenu.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
