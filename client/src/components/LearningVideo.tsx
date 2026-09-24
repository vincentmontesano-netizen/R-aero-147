import {useRef,useState,type RefObject,type ComponentPropsWithoutRef} from 'react';
import {Button} from '@/components/ui/button';
import {useI18n} from '@/i18n';

type Props=Omit<ComponentPropsWithoutRef<'video'>,'onError'|'onLoadedData'> & {mediaRef?:RefObject<HTMLVideoElement|null>};
/** Keep native media controls and cue events while exposing failed source loads. */
export default function LearningVideo({mediaRef,...props}:Props){
 const localRef=useRef<HTMLVideoElement|null>(null);
 const ref=mediaRef??localRef;
 const {t}=useI18n();
 const [failedSource,setFailedSource]=useState<string|null>(null);
 return <>
  <video {...props} ref={ref} onError={()=>setFailedSource(props.src??'')} onLoadedData={()=>setFailedSource(null)} />
  {failedSource===(props.src??'')&&<div role="alert" className="rounded border bg-card p-3 text-sm text-foreground space-y-2">
   <p>{t('learningMedia.videoError')}</p>
   <Button variant="outline" onClick={()=>{setFailedSource(null);ref.current?.load();}}>{t('learningMedia.reload')}</Button>
  </div>}
 </>;
}
