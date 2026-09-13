import {expect,it} from 'vitest';
import {mergeDraftGroups,objectiveMergeGroups} from '../shared/slideMerge';
const base={code:'9.1',title:'Human factors',description:'Introduction',knowledgeLevel:'1',moduleId:1,isRequired:true,sortOrder:0};
it('combines a local objective definition with remote placement and order',()=>{
 const draft={...base,title:'Human performance'},latest={...base,moduleId:2,sortOrder:3};
 expect(mergeDraftGroups(base,draft,latest,objectiveMergeGroups)).toEqual({merged:{...draft,moduleId:2,sortOrder:3},conflicts:[]});
 expect(base.title).toBe('Human factors');expect(draft.moduleId).toBe(1);
});
it('requires an explicit choice for competing definitions and keeps each definition together',()=>{
 const draft={...base,title:'Local title'},latest={...base,description:'Expanded scope',knowledgeLevel:'3'};
 expect(mergeDraftGroups(base,draft,latest,objectiveMergeGroups).conflicts).toEqual(['definition']);
 expect(mergeDraftGroups(base,draft,latest,objectiveMergeGroups,{definition:'latest'})).toEqual({merged:latest,conflicts:[]});
 expect(mergeDraftGroups(base,draft,latest,objectiveMergeGroups,{definition:'draft'})).toEqual({merged:draft,conflicts:[]});
});
