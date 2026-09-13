export type Lang='en'|'fr'|'ar';
export type Dictionary=Record<string,string>;
export function preferredLanguage(saved:string|null):Lang{return saved==='en'||saved==='fr'||saved==='ar'?saved:'fr';}
const loaders={en:()=>import('./en.json'),fr:()=>import('./fr.json'),ar:()=>import('./ar.json')};
const pending:Partial<Record<Lang,Promise<Dictionary>>>={};
export function loadDictionary(lang:Lang):Promise<Dictionary>{
 return pending[lang]??(pending[lang]=loaders[lang]().then(module=>module.default).catch(error=>{delete pending[lang];throw error;}));
}
export function translate(dictionary:Dictionary,key:string,vars?:Record<string,string|number>){
 let text=dictionary[key]??key;
 if(vars)for(const [name,value] of Object.entries(vars))text=text.replaceAll(`{${name}}`,()=>String(value));
 return text;
}
