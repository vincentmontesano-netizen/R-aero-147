import {it,expect} from 'vitest';
import {loadDictionary,preferredLanguage,translate} from '../client/src/locales/load';
it('restores all supported preferences, including Arabic, with French fallback',()=>{
 for(const lang of ['fr','en','ar'] as const)expect(preferredLanguage(lang)).toBe(lang);
 for(const value of [null,'','invalid'])expect(preferredLanguage(value)).toBe('fr');
});
it('loads complete dictionaries with retained overrides and English fallback',async()=>{
 const [en,fr,ar]=await Promise.all([loadDictionary('en'),loadDictionary('fr'),loadDictionary('ar')]);
 expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
 expect(fr['passport.delete']).toBe('Archiver');expect(en['passport.delete']).toBe('Archive');
 expect(ar['reconcile.title']).toBe('مطابقة الدفع');
 expect(await loadDictionary('fr')).toBe(fr);
});
it('keeps interpolation literal and replaces repeated placeholders',()=>{
 expect(translate({line:'{name} / {name}'},'line',{name:'$&'})).toBe('$& / $&');
 expect(translate({},'missing')).toBe('missing');
});
