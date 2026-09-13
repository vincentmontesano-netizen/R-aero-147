import {useState} from 'react';
import type {inferRouterOutputs} from '@trpc/server';
import type {AppRouter} from '../../../server/routers';
import {trpc} from '@/lib/trpc';
import {useI18n} from '@/i18n';
import {Button} from '@/components/ui/button';
import {toast} from 'sonner';

type Dossier=inferRouterOutputs<AppRouter>['me']['selfView'];
const words={
 fr:{title:'Mes preuves et leurs destinataires',intro:'Partagez un certificat valide avec une compagnie. Elle le verra pour les formations qu’elle exige. Le document d’origine reste dans votre dossier.',certificate:'Certificat',company:'Compagnie destinataire',choose:'Choisir…',share:'Partager le certificat',shared:'Certificat partagé',withdraw:'Retirer le partage',withdrawn:'Partage retiré',confirm:'Retirer le partage avec cette compagnie ? Le justificatif et les décisions passées seront conservés.',private:'Non partagé',assigned:'Formation attribuée par la compagnie',retained:'Retrait verrouillé',active:'Partagé',unknown:'Destination non renseignée',noProof:'Aucune preuve enregistrée.',noCertificate:'Aucun certificat valide à partager.',noCompany:'Aucune affiliation active.',pending:'Enregistrement…'},
 en:{title:'My evidence and its recipients',intro:'Share a valid certificate with a company. It will appear for training that company requires. The original document stays in your dossier.',certificate:'Certificate',company:'Recipient company',choose:'Choose…',share:'Share certificate',shared:'Certificate shared',withdraw:'Withdraw sharing',withdrawn:'Sharing withdrawn',confirm:'Withdraw sharing with this company? The evidence and past decisions will be retained.',private:'Not shared',assigned:'Training assigned by the company',retained:'Withdrawal locked',active:'Shared',unknown:'Destination not recorded',noProof:'No evidence recorded.',noCertificate:'No valid certificate to share.',noCompany:'No active affiliation.',pending:'Saving…'},
 ar:{title:'أدلتي والجهات المستلمة',intro:'شارك شهادة سارية مع شركة. ستظهر في التدريبات التي تطلبها الشركة. يبقى المستند الأصلي في ملفك.',certificate:'الشهادة',company:'الشركة المستلمة',choose:'اختر…',share:'مشاركة الشهادة',shared:'تمت مشاركة الشهادة',withdraw:'سحب المشاركة',withdrawn:'تم سحب المشاركة',confirm:'هل تريد سحب المشاركة مع هذه الشركة؟ سيُحتفظ بالدليل والقرارات السابقة.',private:'غير مشارك',assigned:'تدريب أسندته الشركة',retained:'السحب مقفل',active:'مشارك',unknown:'الجهة المستلمة غير مسجلة',noProof:'لا توجد أدلة مسجلة.',noCertificate:'لا توجد شهادة سارية للمشاركة.',noCompany:'لا يوجد ارتباط نشط.',pending:'جارٍ الحفظ…'},
};
export default function CredentialSharing({data}:{data:Dossier}){
 const {lang}=useI18n();const w=words[lang];const utils=trpc.useUtils();
 const [orgId,setOrgId]=useState('');const [certificateId,setCertificateId]=useState('');
 const [historyOpen,setHistoryOpen]=useState(false);
 const history=trpc.me.credentialSharingHistory.useInfiniteQuery({}, {enabled:historyOpen,getNextPageParam:page=>page.nextCursor??undefined});
 const h=lang==='fr'?{title:'Historique du partage',empty:'Aucun événement enregistré depuis la mise en place de cet historique.',shared:'Partage',withdrawn:'Retrait',more:'Afficher la suite',retry:'Réessayer',error:'Historique indisponible.',loading:'Chargement…'}:lang==='ar'?{title:'سجل المشاركة',empty:'لا توجد أحداث مسجلة منذ بدء هذا السجل.',shared:'مشاركة',withdrawn:'سحب',more:'عرض المزيد',retry:'إعادة المحاولة',error:'السجل غير متاح.',loading:'جارٍ التحميل…'}:{title:'Sharing history',empty:'No events recorded since this history was introduced.',shared:'Shared',withdrawn:'Withdrawn',more:'Show more',retry:'Retry',error:'History unavailable.',loading:'Loading…'};
 const refresh=()=>{void utils.me.credentialSharingHistory.invalidate();void utils.me.selfView.invalidate();void utils.me.credentials.invalidate();};
 const share=trpc.me.shareCertificate.useMutation({onSuccess:()=>{toast.success(w.shared);setCertificateId('');refresh();},onError:e=>toast.error(e.message)});
 const withdraw=trpc.me.unsurfaceCredential.useMutation({onSuccess:()=>{toast.success(w.withdrawn);refresh();},onError:e=>toast.error(e.message)});
 const valid=data.certificates.filter(c=>c.isValid===true&&(c.expiresAt==null||new Date(c.expiresAt).getTime()>Date.now()));
 const busy=share.isPending||withdraw.isPending;
 return <section className="rounded-xl border bg-white p-4 space-y-4" aria-labelledby="credential-sharing-title">
  <div><h3 id="credential-sharing-title" className="font-semibold">{w.title}</h3><p className="text-sm text-muted-foreground mt-1">{w.intro}</p></div>
  {data.orgViews.length===0?<p className="text-sm">{w.noCompany}</p>:valid.length===0?<p className="text-sm">{w.noCertificate}</p>:<form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();if(!busy&&orgId&&certificateId)share.mutate({orgId:Number(orgId),certificateId:Number(certificateId)});}}>
   <label className="text-sm space-y-1"><span>{w.certificate}</span><select required value={certificateId} disabled={busy} onChange={e=>setCertificateId(e.target.value)} className="w-full min-w-0 rounded-md border bg-white p-2"><option value="">{w.choose}</option>{valid.map(c=><option key={c.id} value={c.id}>{data.privateCredentials.find(p=>p.certificateId===c.id)?.displayTitle??c.certificateNumber} · {c.certificateNumber}</option>)}</select></label>
   <label className="text-sm space-y-1"><span>{w.company}</span><select required value={orgId} disabled={busy} onChange={e=>setOrgId(e.target.value)} className="w-full min-w-0 rounded-md border bg-white p-2"><option value="">{w.choose}</option>{data.orgViews.map(o=><option key={o.orgId} value={o.orgId}>{o.orgName??`#${o.orgId}`}</option>)}</select></label>
   <Button className="sm:col-span-2 sm:justify-self-start" type="submit" disabled={busy||!orgId||!certificateId}>{share.isPending?w.pending:w.share}</Button>
  </form>}
  {data.privateCredentials.length===0?<p className="text-sm text-muted-foreground">{w.noProof}</p>:<ul className="divide-y">{data.privateCredentials.map(p=>{
   const retained=p.lockedInOrgViewUntil!=null&&new Date(p.lockedInOrgViewUntil).getTime()>Date.now();
   const isShared=p.surfacedByPersonAt!=null;
   const assigned=p.origin==='ORG_ASSIGNED';
   return <li key={p.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
    <div className="min-w-0 break-words"><p className="text-sm font-medium">{p.displayTitle}</p><p className="text-sm text-muted-foreground">{assigned?w.assigned:isShared?w.active:w.private}{p.destinationOrgName?` · ${p.destinationOrgName}`:(isShared||assigned)?` · ${w.unknown}`:''}</p>{retained&&<p className="text-sm text-muted-foreground">{w.retained}</p>}</div>
    {p.origin==='INDEPENDENT'&&isShared&&!retained&&<Button type="button" variant="outline" size="sm" disabled={busy} onClick={()=>{if(window.confirm(w.confirm))withdraw.mutate({credentialId:p.id});}}>{withdraw.isPending&&withdraw.variables?.credentialId===p.id?w.pending:w.withdraw}</Button>}
   </li>;
  })}</ul>}
 <details onToggle={e=>setHistoryOpen(e.currentTarget.open)} className="border-t pt-3">
  <summary className="cursor-pointer text-sm font-medium">{h.title}</summary>
  {historyOpen&&<div className="mt-3 space-y-3 text-sm" aria-live="polite">
   {history.isLoading?<p>{h.loading}</p>:history.isError?<div><p>{h.error}</p><Button variant="outline" onClick={()=>void history.refetch()}>{h.retry}</Button></div>:history.data?.pages[0]?.entries.length===0?<p>{h.empty}</p>:<ol className="space-y-3">{history.data?.pages.flatMap(p=>p.entries).map(e=><li key={e.id} className="break-words"><p className="font-medium">{e.action==='SHARED'?h.shared:h.withdrawn} · {e.proofLabel??`#${e.credentialId}`}</p><p className="text-muted-foreground">{e.orgName??w.unknown} · <time dateTime={new Date(e.createdAt).toISOString()}>{new Date(e.createdAt).toLocaleString(lang)}</time></p></li>)}</ol>}
   {history.hasNextPage&&<Button variant="outline" disabled={history.isFetchingNextPage} onClick={()=>void history.fetchNextPage()}>{history.isFetchingNextPage?h.loading:h.more}</Button>}
  </div>}
 </details>
 </section>;
}
