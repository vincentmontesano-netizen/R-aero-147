import { useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useI18n } from '@/i18n';
import { requestId } from '@/lib/requestId';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function BroadcastRetry({recipientId}: {recipientId:number}) {
  const {t} = useI18n();const utils=trpc.useUtils();
  const [open,setOpen]=useState(false);const identity=useRef(requestId());const sending=useRef(false);
  const preview=trpc.admin.previewBroadcastRetry.useQuery({recipientId},{enabled:open});
  const retry=trpc.admin.retryBroadcastRecipient.useMutation({onSettled:()=>{
    sending.current=false;void utils.admin.broadcastHistory.invalidate();void utils.admin.broadcastRecipients.invalidate();void preview.refetch();
  }});
  return <>
    <Button size="sm" variant="outline" className="ms-2" onClick={()=>setOpen(true)}>{t('broadcastRetry.prepare')}</Button>
    <Dialog open={open} onOpenChange={value=>{if(!sending.current) setOpen(value);}}><DialogContent className="max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{t('broadcastRetry.title')}</DialogTitle></DialogHeader>
      {preview.isError ? <p role="alert">{preview.error.message}</p> : !preview.data ? <p role="status">{t('common.loading')}</p> : <div className="space-y-3">
        <p>{preview.data.name ?? t('broadcastRecipients.account',{id:preview.data.userId})} · {preview.data.email ?? '—'}</p>
        <h4 className="font-semibold">{preview.data.title}</h4>
        <p className="whitespace-pre-wrap text-sm">{preview.data.body}</p>
        {preview.data.link && <p className="break-all text-sm">{preview.data.link}</p>}
        <p className="text-sm">{t('broadcastRetry.confirmInfo')}</p>
        {preview.data.reason && <p role="status">{t(`broadcastRetry.${preview.data.reason}`)}{preview.data.existingRunId ? ` #${preview.data.existingRunId}` : ''}</p>}
        {!preview.data.reason && !retry.data && <Button disabled={retry.isPending||preview.isFetching} onClick={()=>{
          if(sending.current||!preview.data?.email) return;sending.current=true;
          retry.mutate({recipientId,expectedEmail:preview.data.email,requestId:identity.current});
        }}>{t('broadcastRetry.send')}</Button>}
      </div>}
      {retry.isPending && <p role="status">{t('broadcastRetry.sending')}</p>}
      {retry.isError && <p role="alert">{retry.error.message}</p>}
      {retry.data && <p role="status">{t('broadcastHistory.emailCounts',{accepted:retry.data.email.accepted,failed:retry.data.email.failed,skipped:retry.data.email.skipped})}</p>}
      <Button variant="outline" disabled={retry.isPending||preview.isFetching} onClick={()=>void preview.refetch()}>{t('broadcastRecipients.refresh')}</Button>
    </DialogContent></Dialog>
  </>;
}
