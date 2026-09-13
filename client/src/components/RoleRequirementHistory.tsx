import {useState} from 'react';
import {trpc} from '@/lib/trpc';
import {useI18n} from '@/i18n';
import {Button} from '@/components/ui/button';

export default function RoleRequirementHistory(){
 const {t,lang}=useI18n();
 const [open,setOpen]=useState(false);
 const [beforeId,setBeforeId]=useState<number>();
 const query=trpc.company.roleRequirementHistory.useQuery({beforeId},{enabled:open});
 return <section className="mt-6 rounded-xl border bg-white p-4 space-y-3">
  <Button variant="outline" aria-expanded={open} onClick={()=>setOpen(!open)}>{t('companyDashboard.ruleHistoryTitle')}</Button>
  {open&&<>
   <p className="text-sm">{t('companyDashboard.ruleHistoryHint')}</p>
   <Button variant="outline" disabled={query.isFetching} onClick={()=>{if(beforeId)setBeforeId(undefined);else void query.refetch();}}>{t('companyDashboard.ruleHistoryFirst')}</Button>
   {query.isError?<p role="alert">{t('companyDashboard.dataUnavailable')}</p>:!query.data?<p role="status">{t('common.loading')}</p>:<>
    {!query.data.entries.length&&<p>{t('companyDashboard.ruleHistoryEmpty')}</p>}
    {query.data.entries.map(rule=><article key={rule.id} className="rounded-lg border p-3 text-sm space-y-1">
     <p className="font-semibold">#{rule.id} · {rule.label || t('companyDashboard.ruleHistoryTraining',{id:rule.trainingId})}</p>
     <p>{t(rule.companyId==null?'companyDashboard.ruleGlobalScope':'companyDashboard.ruleCompanyScope')}</p>
     <p>{rule.createdBy == null ? t('companyDashboard.ruleCreatorUnknown') : t('companyDashboard.ruleCreator',{id:rule.createdBy,date:new Date(rule.createdAt).toLocaleString(lang)})}</p>
     <p>{t('companyDashboard.ruleHistoryTraining',{id:rule.trainingId})} · {t('companyDashboard.periodMonths',{count:rule.periodMonths})}</p>
     {rule.jobTitleContains && rule.licenseCategoryContains && <p>{t("companyDashboard.ruleEither",{job:rule.jobTitleContains,license:rule.licenseCategoryContains})}</p>}
     {rule.jobTitleContains&&!rule.licenseCategoryContains&&<p>{t('companyDashboard.ruleJobTitleMatch',{value:rule.jobTitleContains})}</p>}
     {rule.licenseCategoryContains&&!rule.jobTitleContains&&<p>{t('companyDashboard.ruleLicenseMatch',{value:rule.licenseCategoryContains})}</p>}
     {!rule.jobTitleContains&&!rule.licenseCategoryContains&&<p>{t('companyDashboard.ruleAll')}</p>}
     <p>{t('companyDashboard.ruleHistoryAttribution',{date:rule.archivedAt?new Date(rule.archivedAt).toLocaleString(lang):'—',id:rule.archivedBy??'—'})}</p>
    </article>)}
    {query.data.nextBeforeId&&<Button variant="outline" disabled={query.isFetching} onClick={()=>setBeforeId(query.data!.nextBeforeId!)}>{t('companyDashboard.ruleHistoryMore')}</Button>}
   </>}
  </>}
 </section>;
}
