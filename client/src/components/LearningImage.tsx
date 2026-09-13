import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {useI18n} from '@/i18n';

/** Preserve the whole teaching image, including annotations near its edges. */
export default function LearningImage({src,alt}:{src:string;alt:string}){
 const {t}=useI18n();
 const [failed,setFailed]=useState(false);
 const [attempt,setAttempt]=useState(0);
 return <div className="mb-4">
  <img key={attempt} src={src} alt={alt} hidden={failed} onError={()=>setFailed(true)} onLoad={()=>setFailed(false)} className="w-full rounded-xl object-contain" style={{maxHeight:380}} />
  {failed&&<div role="alert" className="rounded border bg-white p-3 text-sm text-slate-900 space-y-2">
   <p>{t('learningMedia.imageError')}</p>
   <Button variant="outline" onClick={()=>{setFailed(false);setAttempt(value=>value+1);}}>{t('learningMedia.reload')}</Button>
  </div>}
 </div>;
}
