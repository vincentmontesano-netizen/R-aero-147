import {expect,it} from 'vitest';
import {mergeDraftGroups,questionMergeGroups} from '../shared/slideMerge';
it('combines a local answer edit with independent placement and order changes',()=>{
 const base={type:'qcu',text:'Choose',options:['A','B'],correct:[0],moduleId:1,objectiveId:1,sortOrder:1};
 const draft={...base,correct:[1]},latest={...base,moduleId:2,objectiveId:2,sortOrder:4};
 expect(mergeDraftGroups(base,draft,latest,questionMergeGroups)).toMatchObject({conflicts:[],merged:{correct:[1],moduleId:2,objectiveId:2,sortOrder:4}});
 expect(base.correct).toEqual([0]);
});
it('keeps the whole assessment together across a question type change',()=>{
 const base={type:'qcu',text:'Choose',options:['A','B'],correct:[0],optionsRight:[],pairs:[],points:1};
 const draft={...base,text:'My statement',points:2},latest={...base,type:'matching',optionsRight:['Right A','Right B'],correct:[],pairs:[[0,1],[1,0]]};
 expect(mergeDraftGroups(base,draft,latest,questionMergeGroups).conflicts).toEqual(['assessment']);
 expect(mergeDraftGroups(base,draft,latest,questionMergeGroups,{assessment:'latest'}).merged).toMatchObject(latest);
 expect(mergeDraftGroups(base,draft,latest,questionMergeGroups,{assessment:'draft'}).merged).toMatchObject(draft);
});
it('does not carry a legacy-rule replacement confirmation onto a newly changed rule',()=>{
 const base={type:'free_text',keywords:'old',legacyRegex:'old rule',replaceLegacyRegex:false};
 const draft={...base,keywords:'replacement',replaceLegacyRegex:true},latest={...base,legacyRegex:'new rule'};
 expect(mergeDraftGroups(base,draft,latest,questionMergeGroups).conflicts).toEqual(['assessment']);
 expect(mergeDraftGroups(base,draft,latest,questionMergeGroups,{assessment:'latest'}).merged).toMatchObject({legacyRegex:'new rule',replaceLegacyRegex:false});
});
