import {toast} from "sonner";
import BroadcastRecipients from './BroadcastRecipients';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';

export default function BroadcastHistory() {
  const { t, lang } = useI18n();
  const [beforeId, setBeforeId] = useState<number>();
  const utils=trpc.useUtils();
  const recovery=trpc.admin.recoverBroadcastOutcome.useMutation({onSuccess:()=>toast.success(t('broadcastHistory.recovered')),onError:e=>toast.error(e.message),onSettled:()=>{void utils.admin.broadcastHistory.invalidate();}});
  const query = trpc.admin.broadcastHistory.useQuery({beforeId});
  return <section className="rounded-xl border bg-white p-5 max-w-2xl space-y-3">
    <h3 className="font-semibold">{t('broadcastHistory.title')}</h3>
    <p className="text-sm text-muted-foreground">{t('broadcastHistory.scope')}</p>
    <Button variant="outline" disabled={query.isFetching} onClick={() => {if (beforeId) setBeforeId(undefined); else void query.refetch();}}>{t('broadcastHistory.refresh')}</Button>
    {query.isError ? <p role="alert">{t('broadcastHistory.error')}</p> : query.data === undefined ? <p role="status">{t('common.loading')}</p> : <>
      {!query.data.entries.length && <p>{t('broadcastHistory.empty')}</p>}
      {query.data.entries.map(({run, outcome}) => <details key={run.id} className="rounded-md border p-3">
        <summary className="cursor-pointer text-sm font-medium">#{run.id} · {run.title} · {new Date(run.createdAt).toLocaleString(lang)} · {t(outcome ? 'broadcastHistory.recorded' : 'broadcastHistory.unconfirmed')}</summary>
        <div className="mt-3 space-y-2 text-sm">
          <p>{t('broadcastHistory.counts', {recipients: run.recipients, notifications: run.sent})}</p>
          <p>{t('broadcastHistory.author', {id: run.actorId})}</p>
          {!outcome&&<div className="space-y-2"><p>{t('broadcastHistory.recoveryHint')}</p><Button variant="outline" disabled={recovery.isPending||query.isFetching} onClick={()=>recovery.mutate({runId:run.id})}>{t('broadcastHistory.recover')}</Button></div>}
          {!run.emailRequested ? <p>{t('broadcastHistory.noEmail')}</p> : outcome ? <p>{t('broadcastHistory.emailCounts', {accepted: outcome.accepted, failed: outcome.failed, skipped: outcome.skipped})}</p> : <p role="status">{t('broadcastHistory.unknownInfo')}</p>}
          <BroadcastRecipients runId={run.id} />
        </div>
      </details>)}
      {query.data.nextCursor && <Button variant="outline" disabled={query.isFetching} onClick={() => setBeforeId(query.data!.nextCursor!)}>{t('broadcastHistory.older')}</Button>}
    </>}
  </section>;
}
