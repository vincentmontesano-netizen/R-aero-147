import {expect,it} from 'vitest';
import {mergeSlideDraft} from '../shared/slideMerge';
it('combines independent changes and preserves the input snapshots',()=>{
 const base={title:'Original',body:'Original body'},draft={...base,title:'My title'},latest={...base,body:'Their body'};
 expect(mergeSlideDraft(base,draft,latest)).toMatchObject({merged:{title:'My title',body:'Their body'},conflicts:[]});
 expect(base.title).toBe('Original');expect(draft.body).toBe('Original body');
});
it('requires an explicit choice for conflicting fields and keeps quiz groups coherent',()=>{
 const base={title:'A',quizQuestion:'Q',quizOptions:['A','B'],quizCorrect:[0]},draft={...base,title:'Mine',quizCorrect:[1]},latest={...base,title:'Theirs',quizOptions:['C','D']};
 expect(mergeSlideDraft(base,draft,latest).conflicts).toEqual(['title','quiz']);
 const result=mergeSlideDraft(base,draft,latest,{title:'draft',quiz:'latest'});
 expect(result.conflicts).toEqual([]);expect(result.merged).toMatchObject({title:'Mine',quizOptions:['C','D'],quizCorrect:[0]});
});
it('does not flag identical updates or overwrite local-only changes',()=>{
 const base={title:'A',body:'B'},draft={title:'New',body:'My body'},latest={...base,title:'New'};
 expect(mergeSlideDraft(base,draft,latest)).toMatchObject({merged:draft,conflicts:[]});
});
