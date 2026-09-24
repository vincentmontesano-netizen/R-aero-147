import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import BackButton from "@/components/BackButton";
import QuoteThread from "@/components/QuoteThread";
import { ChevronDown, ChevronUp, LogIn } from "lucide-react";
import { useI18n } from "@/i18n";

const BLUE = "var(--foreground)";
const MUTED = "var(--muted-foreground)";
const BORDER = "var(--border)";

/** Client view of their own quotes + per-quote message thread (INV-agnostic B2B). */
export default function MyQuotes() {
  const { t,lang } = useI18n();
  const STATUS: Record<string, string> = { received: t("myQuotes.statusReceived"), in_progress: t("myQuotes.statusInProgress"), quote_sent: t("myQuotes.statusQuoteSent"), accepted: t("myQuotes.statusAccepted"), refused: t("myQuotes.statusRefused") };
  const { user, isAuthenticated, loading, error, refresh } = useAuth();
  const [beforeId,setBeforeId]=useState<number>();
  const query = trpc.quotes.myList.useQuery({beforeId}, { enabled: isAuthenticated });
  const quotes=query.data?.entries??[];
  const [open, setOpen] = useState<number | null>(null);

  if (loading) return <div className="container py-20" role="status">{t("common.loading")}</div>;
  if (error) return <div className="container py-20"><p role="alert">{t("myQuotes.unavailable")}</p><Button variant="outline" onClick={()=>void refresh()}>{t("quoteThread.retry")}</Button></div>;
  if (!isAuthenticated) {
    return (
      <div className="container py-20 text-center">
        <p className="mb-4" style={{ color: "var(--muted-foreground)" }}>{t("myQuotes.loginPrompt")}</p>
        <a href={getLoginUrl()}><Button style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}><LogIn className="w-4 h-4 mr-1" /> {t("myQuotes.login")}</Button></a>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-3xl">
      <BackButton />
      <h1 className="text-2xl font-bold mb-1 mt-2" style={{ color: "var(--foreground)" }}>{t("myQuotes.title")}</h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted-foreground)" }}>{t("myQuotes.subtitle")}</p>
      <p className="text-xs mb-2">{t("myQuotes.orderHint")}</p>
      <Button className="mb-4" variant="outline" disabled={query.isFetching} onClick={()=>{if(beforeId){setBeforeId(undefined);setOpen(null);}else void query.refetch();}}>{t("myQuotes.firstPage")}</Button>
      {query.isError ? (
        <div><p role="alert">{t("myQuotes.unavailable")}</p><Button variant="outline" disabled={query.isFetching} onClick={()=>void query.refetch()}>{t("quoteThread.retry")}</Button></div>
      ) : query.isPending ? (
        <div role="status" aria-label={t("common.loading")} className="h-24 animate-pulse rounded-xl" style={{ background: "var(--border)" }} />
      ) : quotes.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{t(beforeId?"myQuotes.pageEmpty":"myQuotes.empty")} <a href="/devis" className="underline" style={{ color: "var(--foreground)" }}>{t("myQuotes.requestQuote")}</a>.</p>
      ) : (
        <div className="space-y-3">
          {quotes.map((q: any) => (
            <div key={q.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${"var(--border)"}`, background: "var(--card)" }}>
              <button aria-expanded={open===q.id} onClick={() => setOpen(open === q.id ? null : q.id)} className="w-full flex items-center justify-between p-4 text-start">
                <div>
                  <div className="font-semibold" style={{ color: "var(--foreground)" }}>{q.companyName}</div>
                  <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{STATUS[q.status] ?? q.status} · {new Date(q.createdAt).toLocaleDateString(lang)}{q.trainingTypes ? ` · ${q.trainingTypes}` : ""}</div>
                </div>
                {open === q.id ? <ChevronUp className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />}
              </button>
              {open === q.id && <div className="px-4 pb-4">{q.status === "accepted" && <a href="/dashboard" className="inline-block mb-3"><Button variant="outline" size="sm">{t("checkout.resume")}</Button></a>}<QuoteThread quoteId={q.id} meId={user?.id} /></div>}
            </div>
          ))}
        </div>
      )}
      {!query.isError&&query.data?.nextBeforeId&&<Button className="mt-4" variant="outline" disabled={query.isFetching} onClick={()=>{setBeforeId(query.data!.nextBeforeId!);setOpen(null);}}>{t("myQuotes.more")}</Button>}
    </div>
  );
}
