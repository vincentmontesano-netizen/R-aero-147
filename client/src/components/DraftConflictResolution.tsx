import {useState} from 'react';
import {mergeDraftGroups,slideMergeGroups,moduleMergeGroups,questionMergeGroups,objectiveMergeGroups} from '@shared/slideMerge';
import {useI18n} from '@/i18n';
import {Button} from '@/components/ui/button';

export default function DraftConflictResolution<T extends Record<string,unknown>>({base,draft,latest,onApply,onCancel,kind="slide"}:{kind?:"slide"|"module"|"question"|"objective";base:T;draft:T;latest:T;onApply:(merged:T)=>void;onCancel:()=>void}) {
 const {lang,t}=useI18n();
 const tr=(fr:string,en:string,ar:string)=>lang==='fr'?fr:lang==='ar'?ar:en;
 const [choices,setChoices]=useState<Partial<Record<string,'draft'|'latest'>>>({});
 const groups:Record<string,readonly string[]>=kind==='objective'?objectiveMergeGroups:kind==='module'?moduleMergeGroups:kind==='question'?questionMergeGroups:slideMergeGroups;
 const conflicts=mergeDraftGroups(base,draft,latest,groups).conflicts;
 const result=mergeDraftGroups(base,draft,latest,groups,choices);
 const labels:Record<string,string>={
  definition:tr("Définition de l’objectif","Objective definition","تعريف الهدف"),code:tr("Code","Code","الرمز"),knowledgeLevel:tr("Niveau de connaissances","Knowledge level","مستوى المعرفة"),
  assessment:tr('Question et corrigé','Question and answer key','السؤال والتصحيح'),type:tr('Type de question','Question type','نوع السؤال'),text:tr('Énoncé','Question text','نص السؤال'),options:tr('Choix / colonne gauche','Options / left column','الخيارات / العمود الأيسر'),correct:tr('Numéros des bonnes réponses','Correct answer numbers','أرقام الإجابات الصحيحة'),explanation:tr('Explication','Explanation','الشرح'),points:tr('Points','Points','النقاط'),optionsRight:tr('Colonne droite','Right column','العمود الأيمن'),keywords:tr('Mots-clés','Keywords','الكلمات المفتاحية'),legacyRegex:tr('Ancienne règle de correction','Legacy answer rule','قاعدة التصحيح القديمة'),replaceLegacyRegex:tr('Remplacement de l’ancienne règle confirmé','Legacy rule replacement confirmed','تم تأكيد استبدال القاعدة القديمة'),pairs:tr('Associations gauche → droite','Left → right pairs','الأزواج من اليسار إلى اليمين'),
  description:tr('Description','Description','الوصف'),content:tr('Contenu','Content','المحتوى'),pdf:tr('Document PDF','PDF document','مستند PDF'),pdfUrl:tr('Adresse du PDF','PDF address','عنوان PDF'),duration:tr('Durée','Duration','المدة'),durationMinutes:tr('Durée en minutes','Duration in minutes','المدة بالدقائق'),order:tr('Ordre','Order','الترتيب'),sortOrder:tr('Position','Position','الموضع'),required:tr('Obligatoire','Required','إلزامي'),isRequired:tr('Obligatoire','Required','إلزامي'),quizPolicy:tr('Règles du QCM','Quiz rules','قواعد الاختبار'),quizPassingScore:tr('Seuil de réussite (%)','Passing score (%)','درجة النجاح (%)'),quizMaxAttempts:tr('Nombre de tentatives','Attempt limit','عدد المحاولات'),quizTimeLimitMin:tr('Temps limite (minutes)','Time limit (minutes)','الحد الزمني (دقائق)'),
  title:tr('Titre','Title','العنوان'),body:tr('Texte','Text','النص'),image:tr('Image','Image','الصورة'),audio:tr('Audio','Audio','الصوت'),video:kind==='module'?tr('Vidéo','Video','الفيديو'):tr('Vidéo et interactions','Video and interactions','الفيديو والتفاعلات'),placement:tr('Chapitre et objectif','Chapter and objective','الفصل والهدف'),quiz:tr('QCM intégré','Embedded quiz','الاختبار المضمن'),
  imageUrl:tr('Adresse de l’image','Image address','عنوان الصورة'),imagePrompt:tr('Description de l’image','Image description','وصف الصورة'),audioUrl:tr('Adresse audio','Audio address','عنوان الصوت'),videoUrl:tr('Adresse vidéo','Video address','عنوان الفيديو'),videoCues:tr('Détails des interactions','Interaction details','تفاصيل التفاعلات'),moduleId:tr('Référence du chapitre','Chapter reference','مرجع الفصل'),objectiveId:tr('Référence de l’objectif','Objective reference','مرجع الهدف'),quizQuestion:tr('Question','Question','السؤال'),quizOptions:tr('Réponses proposées','Answer options','خيارات الإجابة'),quizCorrect:tr('Numéros des bonnes réponses','Correct answer numbers','أرقام الإجابات الصحيحة'),quizExplanation:tr('Explication','Explanation','الشرح'),
 };
 const questionTypes:Record<string,string>={qcu:'adminContentManager.questionTypeQcu',qcm:'adminContentManager.questionTypeQcm',true_false:'adminContentManager.questionTypeTrueFalse',free_text:'adminContentManager.questionTypeFreeText',matching:'adminContentManager.questionTypeMatching'};
 const describe=(record:T,group:string)=>groups[group].map(key=>{
  const value=record[key];
  const text=key==='type'&&typeof value==='string'&&questionTypes[value]?t(questionTypes[value]):key==='pairs'&&Array.isArray(value)?value.map(pair=>Array.isArray(pair)?`${Number(pair[0])+1} → ${Number(pair[1])+1}`:'').join('\n'):typeof value==='boolean'?(value?tr('Oui','Yes','نعم'):tr('Non','No','لا')):(key==='quizCorrect'||key==='correct')&&Array.isArray(value)?value.map(i=>Number(i)+1).join(', '):(key==='quizOptions'||key==='options'||key==='optionsRight')&&Array.isArray(value)?value.map((v,i)=>`${i+1}. ${v}`).join('\n'):typeof value==='string'||typeof value==='number'?String(value):value==null?'':JSON.stringify(value,null,2);
  return `${labels[key]??key}\n${text||'—'}`;
 }).join('\n\n');
 return <section className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-4 space-y-4">
  <h3 className="font-semibold">{tr('Rapprocher les versions','Reconcile versions','مراجعة النسختين')}</h3>
  <p className="text-sm">{tr('Les changements sans conflit sont conservés ensemble. Pour chaque conflit, choisissez le contenu à garder. Vous pourrez ensuite vérifier le brouillon avant de l’enregistrer.','Non-conflicting changes are combined. For each conflict, choose which content to keep. You can then review the draft before saving.','يتم دمج التغييرات غير المتعارضة. اختر المحتوى الذي تريد الاحتفاظ به لكل تعارض، ثم راجع المسودة قبل الحفظ.')}</p>
  {conflicts.length===0&&<p className="text-sm">{tr('Aucun choix nécessaire : les changements sont compatibles.','No choices needed: the changes are compatible.','لا يلزم اختيار: التغييرات متوافقة.')}</p>}
  {conflicts.map(group=><fieldset key={group} className="border rounded-md p-3 space-y-3">
   <legend className="font-medium px-1">{labels[group]}</legend>
   <div className="grid sm:grid-cols-2 gap-3">{(['draft','latest'] as const).map(source=><label key={source} className="space-y-2 min-w-0 block">
    <span className="flex items-center gap-2 text-sm"><input type="radio" name={`draft-merge-${group}`} checked={choices[group]===source} onChange={()=>setChoices(previous=>({...previous,[group]:source}))}/>{source==='draft'?tr('Mon brouillon','My draft','مسودتي'):tr('Version enregistrée','Saved version','النسخة المحفوظة')}</span>
    <textarea readOnly aria-label={`${labels[group]} — ${source==='draft'?tr('Mon brouillon','My draft','مسودتي'):tr('Version enregistrée','Saved version','النسخة المحفوظة')}`} value={describe(source==='draft'?draft:latest,group)} className="w-full h-40 border rounded p-2 bg-card text-xs resize-y"/>
   </label>)}</div>
  </fieldset>)}
  <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={onCancel}>{tr('Revenir au brouillon','Back to draft','العودة إلى المسودة')}</Button><Button disabled={result.conflicts.length>0} onClick={()=>onApply(result.merged)}>{tr('Préparer le brouillon rapproché','Prepare reconciled draft','إعداد المسودة المراجعة')}</Button></div>
 </section>;
}
