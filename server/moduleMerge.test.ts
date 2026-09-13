import {expect,it} from 'vitest';
import {mergeDraftGroups,moduleMergeGroups} from '../shared/slideMerge';
it('combines independent chapter edits without mutating the opening draft',()=>{
 const base={title:'Original',content:'Original lesson',isRequired:true,durationMinutes:30};
 const draft={...base,content:'My lesson'},latest={...base,title:'Updated title',durationMinutes:45};
 const result=mergeDraftGroups(base,draft,latest,moduleMergeGroups);
 expect(result.conflicts).toEqual([]);expect(result.merged).toMatchObject({title:'Updated title',content:'My lesson',isRequired:true,durationMinutes:45});
 expect(base.content).toBe('Original lesson');expect(draft.title).toBe('Original');
});
it('requires one explicit choice for the complete chapter quiz policy',()=>{
 const base={quizPassingScore:75,quizMaxAttempts:3,quizTimeLimitMin:30},draft={...base,quizPassingScore:90},latest={...base,quizMaxAttempts:1,quizTimeLimitMin:15};
 expect(mergeDraftGroups(base,draft,latest,moduleMergeGroups).conflicts).toEqual(['quizPolicy']);
 expect(mergeDraftGroups(base,draft,latest,moduleMergeGroups,{quizPolicy:'draft'}).merged).toMatchObject(draft);
 expect(mergeDraftGroups(base,draft,latest,moduleMergeGroups,{quizPolicy:'latest'}).merged).toMatchObject(latest);
});
