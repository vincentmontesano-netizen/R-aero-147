import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n";
import { trpc } from "@/lib/trpc";
import PublicNav from "@/components/PublicNav";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
export default function Licenses() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const [selected, setSelected] = useState<number | null>(null);
  const [learner, setLearner] = useState("");
  const list = trpc.licenses.list.useQuery(undefined, { enabled: !!user });
  const candidates = trpc.licenses.candidates.useQuery({ licenseId: selected ?? 0 }, { enabled: selected != null });
  const assign = trpc.licenses.assign.useMutation({ onSuccess: () => { toast.success(t("licenses.assigned")); setSelected(null); setLearner(""); list.refetch(); }, onError: e => toast.error(e.message) });
  const rows = list.data ?? [];
  return <div className="min-h-screen bg-[#f7f5ef]"><PublicNav /><main className="container pt-28 pb-16">
    <Link href="/dashboard" className="text-sm underline">{t("licenses.back")}</Link>
    <h1 className="text-3xl font-serif mt-4 mb-2">{t("licenses.title")}</h1><p className="text-muted-foreground mb-8">{t("licenses.hint")}</p>
    {loading || list.isLoading ? <p>{t("common.loading")}</p> : !user ? <Link href={getLoginUrl()}>{t("nav.login")}</Link> : list.error ? <p role="alert">{list.error.message}</p> : <>
      <div className="grid sm:grid-cols-3 gap-4 mb-6">{[[t("licenses.total"), rows.length], [t("licenses.available"), rows.filter(r => !r.assignedUserId && !r.revokedAt && r.paymentStatus === "paid").length], [t("licenses.assigned"), rows.filter(r => r.assignedUserId).length]].map(([label, count]) => <div key={label} className="rounded-xl border bg-white p-5"><p className="text-sm">{label}</p><strong className="text-3xl">{count}</strong></div>)}</div>
      {selected != null && <section className="bg-white border rounded-xl p-5 mb-6"><h2 className="font-semibold mb-3">{t("licenses.choose")}</h2>{candidates.error && <p role="alert">{candidates.error.message}</p>}<select className="border rounded p-2 w-full mb-3" value={learner} onChange={e => setLearner(e.target.value)}><option value="">—</option>{candidates.data?.map(p => <option key={p.id} value={p.id}>{p.name || p.email}</option>)}</select><div className="flex gap-3"><Button disabled={!learner || assign.isPending} onClick={() => assign.mutate({ licenseId: selected, userId: Number(learner) })}>{t("licenses.assign")}</Button><Button variant="outline" onClick={() => setSelected(null)}>{t("common.cancel")}</Button></div></section>}
      {!rows.length && <p>{t("licenses.empty")}</p>}
      <div className="grid gap-3">{rows.map(row => <article key={row.id} className="rounded-xl border bg-white p-5 flex flex-wrap gap-4 justify-between items-center"><div><h2 className="font-semibold">{row.title}</h2><p className="text-sm text-muted-foreground">{t("curriculum.version", { version: row.version })} · {t("licenses.order")} #{row.orderId}</p></div><div className="flex gap-3 items-center"><span className="text-sm">{row.revokedAt || row.paymentStatus !== "paid" ? t("licenses.unavailable") : row.assignedUserId ? `${t("licenses.assigned")} · ${row.assignedName ?? row.assignedUserId}` : t("licenses.available")}</span>{row.ownerOrgId && !row.assignedUserId && !row.revokedAt && row.paymentStatus === "paid" && <Button variant="outline" onClick={() => { setSelected(row.id); setLearner(""); }}>{t("licenses.assign")}</Button>}</div></article>)}</div>
    </>}
  </main></div>;
}
