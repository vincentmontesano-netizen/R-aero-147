import {it,expect} from 'vitest';
import {placeVideoItem} from '../shared/videoPlacement';
it('moves a placed item without duplication and returns a replaced item to the available pool',()=>{
 const before={left:'a',right:'b'};const after=placeVideoItem(before,'right','a',['left','right'],['a','b']);expect(after).toEqual({right:'a'});expect(before).toEqual({left:'a',right:'b'});
 expect(placeVideoItem(after,'left','b',['left','right'],['a','b'])).toEqual({left:'b',right:'a'});
});
it('ignores foreign drag payloads and handles identifiers without prototype side effects',()=>{
 const previous={};expect(placeVideoItem(previous,'zone','foreign',['zone'],['a'])).toBe(previous);expect(placeVideoItem(previous,'foreign','a',['zone'],['a'])).toBe(previous);
 const next=placeVideoItem(previous,'__proto__','constructor',['__proto__'],['constructor']);expect(Object.hasOwn(next,'__proto__')).toBe(true);expect(next['__proto__']).toBe('constructor');expect(Object.getPrototypeOf(next)).toBe(Object.prototype);
});
