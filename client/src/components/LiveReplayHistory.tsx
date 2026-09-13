import {useState} from 'react';
import {trpc} from '@/lib/trpc';
import {useI18n} from '@/i18n';
import {Button} from '@/components/ui/button';
type Props={roomType:'session'|'webinar';roomId:number};
export default function LiveReplayHistory(props:Props){
 const {t}=useI18n();const [open,setOpen]=useState(false);
 return <details className="bg-white p-4 text-sm" onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary className="cursor-pointer underline">{t('liveRoom.replayHistory')}</summary>
  {open&&<History {...props}/>}
 </details>;
}
function History({roomType,roomId}:Props){
 const {t,lang}=useI18n();const [beforeId,setBeforeId]=useState<number>();
 const query=trpc.live.replayHistory.useQuery({roomType,roomId,beforeId});
 const status=(value:string|null)=>t(`liveRoom.replayState.${['scheduled','live','full','completed','cancelled'].includes(value??'')?value:'unknown'}`);
 return <div className="space-y-3 pt-3">
  <p>{t('liveRoom.replayHistoryNotice')}</p>
  {query.isLoading&&<p role="status">{t('common.loading')}</p>}
  {query.isError?<div role="alert"><p>{t('liveRoom.activityLoadError')}</p><Button variant="outline" disabled={query.isFetching} onClick={()=>void query.refetch()}>{t('learningPlayer.save.retry')}</Button></div>:<>
   {query.data?.entries.length===0&&<p>{t('liveRoom.noData')}</p>}
   <ol className="space-y-2">{query.data?.entries.map(event=><li key={event.id} className="border rounded p-3 space-y-1 break-words">
    <p>#{event.id} · {new Date(event.createdAt).toLocaleString(lang)} · {t('liveRoom.replayActor',{id:event.actorId})}</p>
    <p>{status(event.previousStatus)} → {status(event.status)}</p>
    <p>{t('liveRoom.replayPrevious')}: <bdi>{event.previousUrl??'—'}</bdi></p>
    <p>{t('liveRoom.replayCurrent')}: <bdi>{event.url}</bdi></p>
   </li>)}</ol>
  </>}
  <div className="flex gap-2">
   <Button variant="outline" disabled={query.isFetching} onClick={()=>{if(beforeId)setBeforeId(undefined);else void query.refetch();}}>{t('liveRoom.presenceLatest')}</Button>
   {!query.isError&&query.data?.nextCursor&&<Button variant="outline" disabled={query.isFetching} onClick={()=>setBeforeId(query.data!.nextCursor!)}>{t('liveRoom.presenceOlder')}</Button>}
  </div>
 </div>;
}
