import {useRef,useState} from 'react';
import {trpc} from '@/lib/trpc';
import {useI18n} from '@/i18n';
import {Button} from '@/components/ui/button';
type State='pending'|'sending'|'accepted'|'unconfirmed';
export default function SupportNotificationQueue(){
 const {t}=useI18n();const [open,setOpen]=useState(false);
 return <details className="border rounded-lg p-4 mb-4" onToggle={e=>setOpen(e.currentTarget.open)}><summary className="cursor-pointer font-medium">{t('supportQueue.title')}</summary>{open&&<Queue/>}</details>;
}
function Queue(){
 const {t,lang}=useI18n();const [state,setState]=useState<State|''>('pending');const [beforeId,setBeforeId]=useState<number>();
 const [notice,setNotice]=useState<'accepted'|'uncertain'|'conflict'|null>(null);const sending=useRef(false);
 const query=trpc.support.notificationQueue.useQuery({state:state===''?undefined:state,beforeId});
 const send=trpc.support.sendNotification.useMutation({
  onSuccess:async result=>{setNotice(result?.state==='accepted'?'accepted':'uncertain');await query.refetch();},
  onError:async error=>{setNotice(error.data?.code==='CONFLICT'?'conflict':'uncertain');await query.refetch();},
  onSettled:()=>{sending.current=false;},
 });
 const start=(id:number,ticketId:number,recipient:string)=>{
  if(sending.current)return;
  if(!window.confirm(t('supportQueue.confirm',{id:ticketId,email:recipient})))return;
  sending.current=true;setNotice(null);send.mutate({id,expectedRecipient:recipient});
 };
 return <div className="pt-3 space-y-3 text-sm">
  <p>{t('supportQueue.notice')}</p>
  <label className="flex gap-2 items-center">{t('supportQueue.filter')}<select className="border rounded p-2" value={state} disabled={send.isPending} onChange={e=>{setState(e.target.value as State|'');setBeforeId(undefined);setNotice(null);}}>
   <option value="">{t('supportQueue.all')}</option>{(['pending','sending','accepted','unconfirmed'] as const).map(value=><option key={value} value={value}>{t('supportQueue.state.'+value)}</option>)}
  </select></label>
  {notice&&<p role={notice==='accepted'?'status':'alert'}>{t('supportQueue.result.'+notice)}</p>}
  {query.isLoading&&<p role="status">{t('common.loading')}</p>}
  {query.isError?<p role="alert">{t('supportQueue.loadError')}</p>:<>
   {query.data&&!query.data.smtpConfigured&&<p role="status">{t('supportQueue.noSmtp')}</p>}
   {query.data?.entries.length===0&&<p>{t('supportQueue.empty')}</p>}
   <ol className="space-y-2">{query.data?.entries.map(item=><li key={item.id} className="border rounded p-3 space-y-1 break-words">
    <p>#{item.id} · {t('supportQueue.ticket',{id:item.ticketId})}{item.messageId!=null&&` · ${t('supportQueue.message',{id:item.messageId})}`} · {new Date(item.createdAt).toLocaleString(lang)}</p>
    <p>{t('supportQueue.state.'+item.state)}</p>
    <p>{t('supportQueue.recipient')}: <bdi>{item.recipient??item.currentRecipient??'—'}</bdi></p>
    {item.claimedAt&&<p>{t('supportQueue.attempted')}: {new Date(item.claimedAt).toLocaleString(lang)} · {item.claimedBy?t('supportQueue.actor',{id:item.claimedBy}):t('supportQueue.automatic')}</p>}
    {item.state==='pending'&&<Button size="sm" variant="outline" disabled={!item.canSend||send.isPending||query.isFetching} onClick={()=>start(item.id,item.ticketId,item.currentRecipient!)}>{t('supportQueue.send')}</Button>}
   </li>)}</ol>
  </>}
  <div className="flex gap-2"><Button variant="outline" disabled={query.isFetching||send.isPending} onClick={()=>{if(beforeId)setBeforeId(undefined);else void query.refetch();}}>{t('supportQueue.refresh')}</Button>
   {!query.isError&&query.data?.nextCursor&&<Button variant="outline" disabled={query.isFetching||send.isPending} onClick={()=>setBeforeId(query.data!.nextCursor!)}>{t('liveRoom.presenceOlder')}</Button>}
  </div>
 </div>;
}
