import BroadcastRetry from './BroadcastRetry';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';

export default function BroadcastRecipients({runId}: {runId: number}) {
  const {t} = useI18n();
  const [open,setOpen] = useState(false);
  const [beforeId,setBeforeId] = useState<number>();
  const query = trpc.admin.broadcastRecipients.useQuery({runId,beforeId},{enabled:open});
  if (!open) return <Button variant="outline" onClick={()=>setOpen(true)}>{t('broadcastRecipients.show')}</Button>;
  return <div className="space-y-3 border-t pt-3">
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={query.isFetching} onClick={()=>{if(beforeId) setBeforeId(undefined);else void query.refetch();}}>{t('broadcastRecipients.refresh')}</Button>
      <Button variant="ghost" onClick={()=>setOpen(false)}>{t('broadcastRecipients.hide')}</Button>
    </div>
    <p className="text-xs text-muted-foreground">{t('broadcastRecipients.info')}</p>
    {query.isError ? <p role="alert">{t('broadcastHistory.error')}</p> : !query.data ? <p role="status">{t('common.loading')}</p> : <>
      {!query.data.entries.length && <p>{t('broadcastRecipients.unavailable')}</p>}
      <ul className="space-y-2">{query.data.entries.map(({recipient,outcome})=><li key={recipient.id}>
        {t('broadcastRecipients.account',{id:recipient.userId})} · {t(`broadcastRecipients.${outcome?.status ?? 'pending'}`)}
        {outcome && ['skipped_configuration','skipped_missing_email','skipped_access'].includes(outcome.status) && <BroadcastRetry recipientId={recipient.id} />}
      </li>)}</ul>
      {query.data.nextCursor && <Button variant="outline" disabled={query.isFetching} onClick={()=>setBeforeId(query.data!.nextCursor!)}>{t('broadcastRecipients.more')}</Button>}
    </>}
  </div>;
}
