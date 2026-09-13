import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function OrganizationStatusHistory({companyId,onClose}:{companyId:number;onClose:()=>void}) {
  const {lang}=useI18n();
  const [cursors,setCursors]=useState<(string|undefined)[]>([undefined]);
  const history=trpc.admin.organizations.statusHistory.useQuery({companyId,before:cursors[cursors.length-1]});
  const text=lang==='fr'?{
    title:'Historique des statuts',note:'Les changements sont conservés sans modification. Les noms affichés sont ceux des comptes actuels ; leur identifiant reste la référence.',
    empty:'Aucun changement enregistré depuis la mise en place du journal.',error:'Impossible de charger cet historique.',loading:'Chargement…',retry:'Réessayer',previous:'Plus récents',next:'Plus anciens',active:'Active',suspended:'Suspendue',date:'Date',actor:'Administrateur',change:'Changement',unknown:'Non renseigné',explain:'La suspension bloque les accès de la compagnie. La réactivation respecte les affiliations individuelles retirées.',
  }:lang==='ar'?{
    title:'سجل الحالات',note:'تُحفظ التغييرات دون تعديل. الأسماء المعروضة هي أسماء الحسابات الحالية، وتبقى المعرّفات مرجعًا ثابتًا.',
    empty:'لا توجد تغييرات مسجلة منذ بدء السجل.',error:'تعذر تحميل السجل.',loading:'جارٍ التحميل…',retry:'إعادة المحاولة',previous:'الأحدث',next:'الأقدم',active:'نشطة',suspended:'معلّقة',date:'التاريخ',actor:'المسؤول',change:'التغيير',unknown:'غير محدد',explain:'يمنع التعليق وصول الشركة. ولا تعيد إعادة التنشيط العضويات المسحوبة.',
  }:{
    title:'Status history',note:'Changes are retained without modification. Names reflect current accounts; account IDs remain the reference.',
    empty:'No changes recorded since this journal was introduced.',error:'Could not load this history.',loading:'Loading…',retry:'Retry',previous:'Newer',next:'Older',active:'Active',suspended:'Suspended',date:'Date',actor:'Administrator',change:'Change',unknown:'Not recorded',explain:'Suspension blocks company access. Reactivation respects individually withdrawn memberships.',
  };
  const status=(value:string|null)=>value==='ACTIVE'?text.active:value==='SUSPENDED'?text.suspended:text.unknown;
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
    <DialogHeader><DialogTitle>{text.title}{history.data?` — ${history.data.company.name}`:''}</DialogTitle><DialogDescription>{text.explain} {text.note}</DialogDescription></DialogHeader>
    {history.isPending?<p role="status">{text.loading}</p>:history.isError?<div role="alert"><p>{text.error}</p><Button variant="outline" onClick={()=>history.refetch()}>{text.retry}</Button></div>:<>
      {history.data.events.length===0?<p className="text-sm text-slate-600">{text.empty}</p>:<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{[text.date,text.actor,text.change].map(label=><th key={label} className="text-start p-2 border-b">{label}</th>)}</tr></thead><tbody>{history.data.events.map(event=><tr key={event.id}><td className="p-2 border-b whitespace-nowrap"><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString(lang)}</time></td><td className="p-2 border-b">{event.actorName||text.unknown} <span className="text-slate-500">#{event.actorId}</span></td><td className="p-2 border-b">{status(event.previousStatus)} → {status(event.status)}</td></tr>)}</tbody></table></div>}
      <div className="flex justify-between gap-2"><Button variant="outline" disabled={cursors.length===1||history.isFetching} onClick={()=>setCursors(values=>values.slice(0,-1))}>{text.previous}</Button><Button variant="outline" disabled={!history.data.nextCursor||history.isFetching} onClick={()=>{if(history.data.nextCursor)setCursors(values=>[...values,history.data.nextCursor!]);}}>{text.next}</Button></div>
    </>}
  </DialogContent></Dialog>;
}
