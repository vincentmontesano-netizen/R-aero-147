import { trpc } from "@/lib/trpc";
import { supportRequestLabels } from "@shared/supportRequest";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import TicketThread from "@/components/TicketThread";

export default function SupportTicket({ params }: { params: { id: string } }) {
  const { t, lang } = useI18n();
  const { user, loading, error } = useAuth();
  const labels = lang === "fr"
    ? { back: "Mes demandes de support", ticket: "Demande de support", invalid: "Ce lien de support est invalide." }
    : lang === "ar"
      ? { back: "طلبات الدعم الخاصة بي", ticket: "طلب الدعم", invalid: "رابط الدعم هذا غير صالح." }
      : { back: "My support requests", ticket: "Support request", invalid: "This support link is invalid." };
  const ticketId = Number(params.id);
  const valid = /^[1-9]\d*$/.test(params.id) && Number.isSafeInteger(ticketId) && ticketId <= 2147483647;

  return <main className="container py-8 max-w-3xl space-y-5">
    <Link href="/support" className="underline">{labels.back}</Link>
    {!valid ? <p role="alert">{labels.invalid}</p>
      : loading ? <p role="status">{t("common.loading")}</p>
      : error ? <div role="alert"><p>{t("support.authError")}</p><Button onClick={() => window.location.reload()}>{t("supportList.retry")}</Button></div>
      : !user ? <div><p>{t("support.loginPrompt")}</p><a className="underline" href={getLoginUrl(`/support/ticket/${ticketId}`)}>{t("support.login")}</a></div>
      : <>
        <h1 className="text-2xl font-semibold">{labels.ticket} <bdi>#{ticketId}</bdi></h1>
        <SupportTicketContent key={`${user.id}:${ticketId}`} ticketId={ticketId} meId={user.id} />
      </>}
  </main>;
}


function SupportTicketContent({ ticketId, meId }: { ticketId: number; meId: number }) {
  const { t, lang } = useI18n();
  const detail = trpc.support.detail.useQuery({ ticketId }, { refetchInterval: 8000 });
  const ticket = detail.isError ? undefined : detail.data;
  const status: Record<string, string> = { OPEN: t("support.statusOpen"), PENDING: t("support.statusPending"), CLOSED: t("support.statusClosed") };
  return <>
    {detail.isPending ? <p role="status">{t("common.loading")}</p> : detail.isError ? <div role="alert">
      <p>{t("ticketThread.loadError")}</p>
      <Button variant="outline" disabled={detail.isFetching} onClick={() => void detail.refetch()}>{t("supportList.retry")}</Button>
    </div> : ticket && <div className="space-y-2 border-b pb-4">
      <h2 className="text-xl font-semibold break-words">{ticket.subject}</h2>
      <p>{status[ticket.status] ?? ticket.status} · {supportRequestLabels[lang][ticket.requestKind]}</p>
    </div>}
    <TicketThread ticketId={ticketId} meId={meId} />
  </>;
}
