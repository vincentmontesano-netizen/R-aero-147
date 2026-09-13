import {z} from 'zod';
const time=z.number().finite().min(0).max(86400);
const pct=z.number().finite().min(0).max(100);
const label=z.string().trim().min(1).max(2000);
const unique=(values:unknown[])=>new Set(values).size===values.length;
export const videoCueSchema=z.object({
 atSeconds:time,kind:z.enum(['quiz','branch','hotspot','dragdrop']).optional(),question:z.string().max(2000).optional(),
 options:z.array(z.string().max(2000)).max(10).optional(),correct:z.array(z.number().int().min(0).max(9)).max(10).optional(),explanation:z.string().max(5000).optional(),onCorrectSeek:time.nullable().optional(),
 branches:z.array(z.object({label,seekTo:time})).max(20).optional(),
 hotspots:z.array(z.object({xPct:pct,yPct:pct,label:z.string().max(2000).optional(),correct:z.boolean().optional(),seekTo:time.optional()})).max(20).optional(),
 dragItems:z.array(z.object({id:z.string().trim().min(1).max(100),label})).max(20).optional(),
 dropZones:z.array(z.object({id:z.string().trim().min(1).max(100),label:z.string().max(2000).optional(),xPct:pct,yPct:pct,wPct:pct.refine(v=>v>0),hPct:pct.refine(v=>v>0),correctItemId:z.string().trim().min(1).max(100)})).max(20).optional(),
}).superRefine((cue,ctx)=>{
 const fail=(message:string)=>ctx.addIssue({code:'custom',message});
 switch(cue.kind??'quiz'){
  case 'quiz':{const options=cue.options??[],correct=cue.correct??[];if(!cue.question?.trim()||options.length<2||options.some(v=>!v.trim())||!unique(options.map(v=>v.trim().toLowerCase()))||!correct.length||!unique(correct)||correct.some(i=>i>=options.length))fail('QCM vidéo incomplet ou réponses invalides.');break;}
  case 'branch':if(!cue.branches?.length)fail('Ajoutez au moins un choix de parcours.');break;
  case 'hotspot':if(!cue.hotspots?.length||!cue.hotspots.some(h=>h.correct!==false))fail('Ajoutez au moins une zone correcte.');break;
  case 'dragdrop':{const items=cue.dragItems??[],zones=cue.dropZones??[];if(!items.length||!zones.length||!unique(items.map(i=>i.id))||!unique(zones.map(z=>z.id))||!unique(zones.map(z=>z.correctItemId))||zones.some(z=>!items.some(i=>i.id===z.correctItemId)||z.xPct+z.wPct>100||z.yPct+z.hPct>100))fail('Zones ou éléments de glisser-déposer incohérents.');break;}
 }
});
export const videoCuesSchema=z.array(videoCueSchema).max(100);
