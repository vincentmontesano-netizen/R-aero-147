import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, Trash2, Shield, User } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";

const BLUE = "oklch(19% 0.08 252)";
const GOLD = "oklch(68% 0.1 78)";
const MUTED = "oklch(45% 0.02 240)";
const BORDER = "oklch(88% 0.015 88)";
const GREEN = "oklch(55% 0.18 145)";

/** Manager-scoped module: list the org's affiliations (managers + members),
 *  affiliate a Person by email, change their role, or detach them. */
export default function CompanyMembers({ meId }: { meId?: number }) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: affiliates = [], isLoading } = trpc.company.affiliates.useQuery();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"MEMBER" | "MANAGER">("MEMBER");
  const invalidate = () => utils.company.affiliates.invalidate();

  const add = trpc.company.addAffiliate.useMutation({
    onSuccess: () => { toast.success(t("companyMembers.added")); setEmail(""); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const setRoleM = trpc.company.setAffiliateRole.useMutation({
    onSuccess: () => { toast.success(t("companyMembers.roleUpdated")); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.company.removeAffiliate.useMutation({
    onSuccess: () => { toast.success(t("companyMembers.removed")); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const active = (affiliates as any[]).filter((a) => a.status === "ACTIVE");
  const submit = () => { if (email.trim()) add.mutate({ email: email.trim(), role }); };

  return (
    <div className="rounded-2xl p-6" style={{ background: "white", border: `1px solid ${BORDER}` }}>
      <h2 className="font-semibold mb-1" style={{ color: BLUE }}>{t("companyMembers.title")}</h2>
      <p className="text-xs mb-4" style={{ color: MUTED }}>{t("companyMembers.description")}</p>

      {/* Add by email */}
      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder={t("companyMembers.emailPlaceholder")} className="flex-1"
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
        <select value={role} onChange={(e) => setRole(e.target.value as "MEMBER" | "MANAGER")}
          className="h-9 rounded-md border px-2 text-sm" style={{ borderColor: BORDER }}>
          <option value="MEMBER">{t("companyMembers.roleMember")}</option>
          <option value="MANAGER">{t("companyMembers.roleManager")}</option>
        </select>
        <Button disabled={!email.trim() || add.isPending} onClick={submit} style={{ background: BLUE, color: "white" }}>
          <UserPlus className="w-4 h-4 mr-1" /> {t("companyMembers.add")}
        </Button>
      </div>

      {/* List */}
      <div className="space-y-1.5">
        {isLoading && <p className="text-xs" style={{ color: MUTED }}>{t("companyMembers.loading")}</p>}
        {!isLoading && active.length === 0 && <p className="text-xs" style={{ color: MUTED }}>{t("companyMembers.empty")}</p>}
        {active.map((a) => {
          const isManager = a.role === "MANAGER";
          const isSelf = meId != null && a.personId === meId;
          return (
            <div key={a.affiliationId} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: "oklch(97% 0.01 88)" }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: isManager ? `${GOLD}22` : "oklch(92% 0.01 240)" }}>
                {isManager ? <Shield className="w-4 h-4" style={{ color: GOLD }} /> : <User className="w-4 h-4" style={{ color: MUTED }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: BLUE }}>
                  {a.name ?? a.email ?? `#${a.personId}`}{isSelf ? ` · ${t("companyMembers.you")}` : ""}
                </div>
                <div className="text-xs truncate" style={{ color: MUTED }}>{a.email ?? "—"}</div>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                style={{ background: isManager ? `${GOLD}22` : "oklch(92% 0.01 240)", color: isManager ? GOLD : MUTED }}>
                {isManager ? t("companyMembers.roleManager") : t("companyMembers.roleMember")}
              </span>
              {!isSelf && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setRoleM.mutate({ affiliationId: a.affiliationId, role: isManager ? "MEMBER" : "MANAGER" })}
                    className="text-xs px-2 py-1 rounded hover:underline" style={{ color: BLUE }}
                    title={isManager ? t("companyMembers.demote") : t("companyMembers.promote")}>
                    {isManager ? t("companyMembers.demote") : t("companyMembers.promote")}
                  </button>
                  <button onClick={() => remove.mutate({ affiliationId: a.affiliationId })}
                    className="text-red-500 p-1" title={t("companyMembers.remove")}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
