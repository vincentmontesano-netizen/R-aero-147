import {expect,it} from 'vitest';
import {compactLivePollOptions} from '../shared/livePollOptions';
it('retains the selected answer after removing leading and intermediate blank options',()=>{
  const options=[' ', ' A ', '', ' ب ', 'C'];
  expect(compactLivePollOptions(options,[3])).toEqual({options:['A','ب','C'],correct:[1]});
  expect(options).toEqual([' ', ' A ', '', ' ب ', 'C']);
  expect(compactLivePollOptions(options,[])).toEqual({options:['A','ب','C'],correct:[]});
});
it('rejects a selected blank or nonexistent option instead of grading a different answer',()=>{
  for(const index of [0,2,-1,5,1.5])expect(compactLivePollOptions(['','A',' ','B'],[index])).toBeNull();
});
