import {useState} from 'react';
import {trpc} from '@/lib/trpc';
import {useI18n} from '@/i18n';
import {Button} from '@/components/ui/button';
const labels={received:'quoteStatusReceived',in_progress:'quoteStatusInProgress',quote_sent:'quoteStatusQuoteSent',accepted:'quoteStatusAccepted',refused:'quoteStatusRefused'};
export default function QuoteStatusHistory({quoteId}:{quoteId:number}){
 const {t,lang}=useI18n();
 const [open,setOpen]=useState(false);
 const [beforeId,setBeforeId]=useState<number>();
 const query=trpc.admin.quotes.statusHistory.useQuery({quoteId,beforeId},{enabled:open});
 return <section className="space-y-2">
  <Button variant="outline" aria-expanded={open} onClick={()=>setOpen(!open)}>{t('quoteHistory.title')}</Button>
  {open&&<>
   <p className="text-xs">{t('quoteHistory.hint')}</p>
   <Button variant="outline" disabled={query.isFetching} onClick={()=>{if(beforeId)setBeforeId(undefined);else void query.refetch();}}>{t('quoteHistory.refresh')}</Button>
   {query.isError?<p role="alert">{t('quoteHistory.error')}</p>:!query.data?<p role="status">{t('common.loading')}</p>:<>
    {!query.data.entries.length&&<p>{t('quoteHistory.empty')}</p>}
    {query.data.entries.map(event=><article className="border rounded p-2 text-sm" key={event.id}>
     <p>{t('adminDashboard.'+labels[event.previousStatus])} → {t('adminDashboard.'+labels[event.status])}</p>
     <p>{new Date(event.createdAt).toLocaleString(lang)} · {event.actorId?t('quoteHistory.actor',{id:event.actorId}):t('quoteHistory.unknownActor')} · #{event.id}</p>
    </article>)}
    {query.data.nextBeforeId&&<Button variant="outline" disabled={query.isFetching} onClick={()=>setBeforeId(query.data!.nextBeforeId!)}>{t('quoteHistory.more')}</Button>}
   </>}
  </>}
 </section>;
}
