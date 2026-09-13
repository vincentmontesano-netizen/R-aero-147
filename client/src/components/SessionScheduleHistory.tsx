import {useState} from 'react';
import {trpc} from '@/lib/trpc';
import {useI18n} from '@/i18n';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
export default function SessionScheduleHistory({id,onClose}:{id:number;onClose:()=>void}){
 const {lang}=useI18n();
 const text=lang==='fr'?{title:'Historique des horaires',before:'Avant',after:'Après',empty:'Aucun changement enregistré depuis la mise en place du journal.',notice:'Les noms affichés sont les noms actuels ; les identifiants des auteurs sont conservés. Heures locales du navigateur.',missing:'Fin non renseignée',loading:'Chargement…',retry:'Réessayer',older:'Plus ancien',newer:'Plus récent'}:lang==='ar'?{title:'سجل المواعيد',before:'قبل',after:'بعد',empty:'لا توجد تغييرات مسجلة منذ إنشاء السجل.',notice:'الأسماء المعروضة حالية؛ يتم الاحتفاظ بمعرفات المؤلفين. توقيت المتصفح المحلي.',missing:'نهاية غير محددة',loading:'جار التحميل…',retry:'إعادة المحاولة',older:'أقدم',newer:'أحدث'}:{title:'Schedule history',before:'Before',after:'After',empty:'No changes recorded since this journal was introduced.',notice:'Displayed names are current; actor identifiers are retained. Times use your browser’s local time zone.',missing:'End not recorded',loading:'Loading…',retry:'Retry',older:'Older',newer:'Newer'};
 const [cursors,setCursors]=useState<Array<number|undefined>>([undefined]);
 const query=trpc.admin.sessions.scheduleHistory.useQuery({id,before:cursors[cursors.length-1]});
 const date=(value:string|null)=>value?new Date(value).toLocaleString(lang):text.missing;
 return <Dialog open onOpenChange={open=>!open&&onClose()}><DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{text.title}{query.data?` — ${query.data.session.title}`:''}</DialogTitle></DialogHeader>
 <p className="text-sm text-muted-foreground">{text.notice}</p>
 {query.isLoading?<p role="status">{text.loading}</p>:query.error?<div role="alert"><p>{query.error.message}</p><Button variant="outline" onClick={()=>query.refetch()}>{text.retry}</Button></div>:<>
 {!query.data?.events.length&&<p>{text.empty}</p>}
 <ol className="space-y-3">{query.data?.events.map(event=><li key={event.id} className="border rounded-lg p-3 space-y-2 text-sm">
 <p className="font-medium">{date(event.createdAt)} · {event.actorName ?? '—'} (#{event.actorId})</p>
 <p><strong>{text.before}: </strong>{date(event.previousStart)} → {date(event.previousEnd)}</p>
 <p><strong>{text.after}: </strong>{date(event.nextStart)} → {date(event.nextEnd)}</p>
 <p className="whitespace-pre-wrap break-words">{event.reason}</p>
 </li>)}</ol>
 <div className="flex gap-2"><Button variant="outline" disabled={cursors.length<2||query.isFetching} onClick={()=>setCursors(v=>v.slice(0,-1))}>{text.newer}</Button><Button variant="outline" disabled={!query.data?.nextCursor||query.isFetching} onClick={()=>setCursors(v=>[...v,query.data!.nextCursor!])}>{text.older}</Button></div>
 </>}
 </DialogContent></Dialog>;
}
