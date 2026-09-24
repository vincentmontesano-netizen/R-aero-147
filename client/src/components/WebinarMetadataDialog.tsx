import {useState} from 'react';
import {trpc} from '@/lib/trpc';
import {useI18n} from '@/i18n';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';
export default function WebinarMetadataDialog({webinar,onClose,onSaved}:{webinar:{id:number;title:string;description:string|null;maxParticipants:number|null;registeredCount:number};onClose:()=>void;onSaved:()=>void}){
 const {lang}=useI18n();
 const text=lang==='fr'?{heading:'Modifier le webinaire',title:'Titre',description:'Description',capacity:'Nombre de places (vide : sans limite)',reason:'Motif du changement',save:'Enregistrer',cancel:'Annuler',count:'Inscriptions existantes',notice:'Les inscriptions sont conservées. La capacité ne peut pas être inférieure au nombre d’inscrits.'}:lang==='ar'?{heading:'تعديل الندوة',title:'العنوان',description:'الوصف',capacity:'عدد المقاعد (فارغ: غير محدود)',reason:'سبب التغيير',save:'حفظ',cancel:'إلغاء',count:'التسجيلات الحالية',notice:'يتم الاحتفاظ بالتسجيلات. لا يمكن أن تقل السعة عن عدد المسجلين.'}:{heading:'Edit webinar',title:'Title',description:'Description',capacity:'Seats (blank: unlimited)',reason:'Reason for change',save:'Save',cancel:'Cancel',count:'Existing registrations',notice:'Registrations are retained. Capacity cannot be lower than the number of registered participants.'};
 const [title,setTitle]=useState(webinar.title),[description,setDescription]=useState(webinar.description??''),[capacity,setCapacity]=useState(webinar.maxParticipants==null?'':String(webinar.maxParticipants)),[reason,setReason]=useState('');
 const mutation=trpc.admin.webinars.update.useMutation({onSuccess:onSaved});
 return <Dialog open onOpenChange={open=>{if(!open&&!mutation.isPending)onClose();}}><DialogContent><DialogHeader><DialogTitle>{text.heading}</DialogTitle></DialogHeader><form className="space-y-3" onSubmit={e=>{e.preventDefault();mutation.mutate({id:webinar.id,title,description:description||null,maxParticipants:capacity===''?null:Number(capacity),reason});}}>
 <p className="text-sm">{text.notice} {text.count}: {webinar.registeredCount}</p>
 <label htmlFor="webinar-edit-title">{text.title}</label><Input id="webinar-edit-title" required maxLength={255} value={title} onChange={e=>setTitle(e.target.value)} disabled={mutation.isPending}/>
 <label htmlFor="webinar-edit-description">{text.description}</label><textarea id="webinar-edit-description" className="w-full rounded border p-2" rows={4} maxLength={10000} value={description} onChange={e=>setDescription(e.target.value)} disabled={mutation.isPending}/>
 <label htmlFor="webinar-edit-capacity">{text.capacity}</label><Input id="webinar-edit-capacity" type="number" min={Math.max(1,webinar.registeredCount)} max={10000} value={capacity} onChange={e=>setCapacity(e.target.value)} disabled={mutation.isPending}/>
 <label htmlFor="webinar-edit-reason">{text.reason}</label><Input id="webinar-edit-reason" required minLength={3} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} disabled={mutation.isPending}/>
 {mutation.error&&<p role="alert" className="text-destructive text-sm">{mutation.error.message}</p>}
 <div className="flex gap-2"><Button type="submit" disabled={mutation.isPending||!title.trim()||reason.trim().length<3}>{text.save}</Button><Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>{text.cancel}</Button></div>
 </form></DialogContent></Dialog>;
}
