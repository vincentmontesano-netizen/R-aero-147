import {useState} from 'react';
import {trpc} from '@/lib/trpc';
import {useI18n} from '@/i18n';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
function localDate(value:Date|null){if(!value)return '';const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
export default function SessionScheduleDialog({session,onClose,onSaved}:{session:{id:number;title:string;startDate:Date;endDate:Date|null};onClose:()=>void;onSaved:()=>void}){
 const {lang}=useI18n();
 const text=lang==='fr'?{title:'Horaires de la classe',start:'Début',end:'Fin',reason:'Motif du changement',save:'Enregistrer les horaires',cancel:'Annuler',notice:'Heures locales de votre navigateur. Accès vidéo : 15 min avant (30 min pour le modérateur), jusqu’à 15 min après. Le changement sera journalisé.',invalid:'La fin doit être après le début.'}:lang==='ar'?{title:'مواعيد الفصل',start:'البداية',end:'النهاية',reason:'سبب التغيير',save:'حفظ المواعيد',cancel:'إلغاء',notice:'التوقيت المحلي للمتصفح. يفتح الفيديو قبل 15 دقيقة (30 للمشرف) ويغلق بعد 15 دقيقة. يتم تسجيل التغيير.',invalid:'يجب أن تكون النهاية بعد البداية.'}:{title:'Class schedule',start:'Start',end:'End',reason:'Reason for change',save:'Save schedule',cancel:'Cancel',notice:'Times use your browser’s local time zone. Video opens 15 min before (30 for moderators), until 15 min after. The change will be recorded.',invalid:'End must be after start.'};
 const [start,setStart]=useState(localDate(session.startDate)),[end,setEnd]=useState(localDate(session.endDate)),[reason,setReason]=useState('');
 const valid=Number.isFinite(Date.parse(start))&&Date.parse(end)>Date.parse(start);
 const mutation=trpc.admin.sessions.update.useMutation({onSuccess:onSaved});
 return <Dialog open onOpenChange={open=>{if(!open&&!mutation.isPending)onClose();}}><DialogContent><DialogHeader><DialogTitle>{text.title} — {session.title}</DialogTitle></DialogHeader><form className="space-y-3" onSubmit={e=>{e.preventDefault();if(valid)mutation.mutate({id:session.id,startDate:new Date(start).toISOString(),endDate:new Date(end).toISOString(),reason});}}>
 <p className="text-sm text-muted-foreground">{text.notice}</p>
 <label htmlFor="schedule-start">{text.start}</label><Input id="schedule-start" type="datetime-local" required value={start} onChange={e=>setStart(e.target.value)} disabled={mutation.isPending}/>
 <label htmlFor="schedule-end">{text.end}</label><Input id="schedule-end" type="datetime-local" required value={end} onChange={e=>setEnd(e.target.value)} disabled={mutation.isPending}/>
 {!valid&&<p className="text-sm text-red-600">{text.invalid}</p>}
 <label htmlFor="schedule-reason">{text.reason}</label><Input id="schedule-reason" required minLength={3} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} disabled={mutation.isPending}/>
 {mutation.error&&<p role="alert" className="text-sm text-red-600">{mutation.error.message}</p>}
 <div className="flex gap-2"><Button type="submit" disabled={!valid||reason.trim().length<3||mutation.isPending}>{text.save}</Button><Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>{text.cancel}</Button></div>
 </form></DialogContent></Dialog>;
}
