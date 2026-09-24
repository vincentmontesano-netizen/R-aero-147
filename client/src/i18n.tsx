import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {DirectionProvider} from '@radix-ui/react-direction';
import {loadDictionary,preferredLanguage,translate,type Dictionary,type Lang} from './locales/load';
export type {Lang} from './locales/load';
const STORAGE_KEY='raero-lang';
type I18nValue={lang:Lang;setLang:(language:Lang)=>void;t:(key:string,vars?:Record<string,string|number>)=>string};
const I18nContext=createContext<I18nValue>({lang:'fr',setLang:()=>{},t:key=>key});
function savedLanguage():Lang{try{return preferredLanguage(localStorage.getItem(STORAGE_KEY));}catch{return 'fr';}}
const loadingCopy={fr:{loading:'Chargement…',error:'La langue n’a pas pu être chargée.',retry:'Réessayer'},en:{loading:'Loading…',error:'The language could not be loaded.',retry:'Retry'},ar:{loading:'جارٍ التحميل…',error:'تعذّر تحميل اللغة.',retry:'إعادة المحاولة'}};
export function I18nProvider({children}:{children:ReactNode}){
 const [initial]=useState(savedLanguage);
 const [requested,setRequested]=useState<Lang>(initial);
 const [current,setCurrent]=useState<{lang:Lang;dictionary:Dictionary}|null>(null);
 const [failed,setFailed]=useState(false);
 const generation=useRef(0);
 const chooseLanguage=(lang:Lang)=>{
  const id=++generation.current;setRequested(lang);setFailed(false);
  void loadDictionary(lang).then(dictionary=>{if(id===generation.current)setCurrent({lang,dictionary});}).catch(()=>{if(id===generation.current)setFailed(true);});
 };
 useEffect(()=>{chooseLanguage(initial);return()=>{generation.current++;};},[initial]);
 useEffect(()=>{
  const lang=current?.lang??initial;
  document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';
  if(current)try{localStorage.setItem(STORAGE_KEY,lang);}catch{/* Preferences may be unavailable in restricted storage contexts. */}
 },[current,initial]);
 const copy=loadingCopy[requested];
 const error=<div role="alert" className="bg-card border rounded-md p-4 text-sm"><p>{copy.error}</p><button type="button" className="underline mt-2" onClick={()=>chooseLanguage(requested)}>{copy.retry}</button></div>;
 if(!current)return <div className="min-h-screen grid place-items-center">{failed?error:<p role="status">{copy.loading}</p>}</div>;
 // Radix primitives (tabs, menus, selects…) default to LTR unless told otherwise.
 return <I18nContext.Provider value={{lang:current.lang,setLang:chooseLanguage,t:(key,vars)=>translate(current.dictionary,key,vars)}}>
  <DirectionProvider dir={current.lang==='ar'?'rtl':'ltr'}>
  {failed&&<div className="fixed top-20 inset-x-4 z-50 max-w-md mx-auto">{error}</div>}
  {children}
  </DirectionProvider>
 </I18nContext.Provider>;
}
export function useI18n(){return useContext(I18nContext);}
