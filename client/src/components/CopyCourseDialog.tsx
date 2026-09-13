import {useState} from 'react';
import {trpc} from '@/lib/trpc';
import {useI18n} from '@/i18n';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
export default function CopyCourseDialog({course,orgId,workspaceName,onClose,onCreated}:{course:{id:number;title:string};orgId:number|null;workspaceName:string;onClose:()=>void;onCreated:(id:number)=>void}){
 const {lang}=useI18n();
 const text=lang==='fr'?{heading:'Dupliquer la formation',title:'Titre de la copie',destination:'Espace de destination',notice:'Les chapitres, objectifs, diapositives, médias et QCM seront repris dans un nouveau brouillon. Une nouvelle revue sera nécessaire avant publication.',copy:'Créer la copie',cancel:'Annuler'}:lang==='ar'?{heading:'نسخ الدورة',title:'عنوان النسخة',destination:'مساحة الوجهة',notice:'سيتم نسخ الفصول والأهداف والشرائح والوسائط والاختبارات إلى مسودة جديدة. تتطلب النشر مراجعة جديدة.',copy:'إنشاء نسخة',cancel:'إلغاء'}:{heading:'Duplicate course',title:'Copy title',destination:'Destination workspace',notice:'Chapters, objectives, slides, media and quizzes will be included in a new draft. A new review will be required before publication.',copy:'Create copy',cancel:'Cancel'};
 const [title,setTitle]=useState(course.title);
 const mutation=trpc.maker.copyCourse.useMutation({onSuccess:r=>onCreated(r.trainingId)});
 return <Dialog open onOpenChange={open=>{if(!open&&!mutation.isPending)onClose();}}><DialogContent><DialogHeader><DialogTitle>{text.heading}</DialogTitle></DialogHeader>
 <form className="space-y-4" onSubmit={e=>{e.preventDefault();mutation.mutate({trainingId:course.id,title,orgId});}}>
 <p className="text-sm">{text.destination}: <strong>{workspaceName}</strong></p><p className="text-sm text-muted-foreground">{text.notice}</p>
 <label htmlFor="copy-course-title">{text.title}</label><Input id="copy-course-title" value={title} onChange={e=>setTitle(e.target.value)} required maxLength={255} disabled={mutation.isPending}/>
 {mutation.error&&<p role="alert" className="text-sm text-red-600">{mutation.error.message}</p>}
 <div className="flex gap-2"><Button type="submit" disabled={mutation.isPending||!title.trim()}>{text.copy}</Button><Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>{text.cancel}</Button></div>
 </form></DialogContent></Dialog>;
}
