import {describe,it,expect} from 'vitest';
import {videoCuesSchema} from '../shared/videoCues';
const quiz={atSeconds:10,question:'Choose',options:['One','Two'],correct:[1]};
const drag={atSeconds:20,kind:'dragdrop',dragItems:[{id:'a',label:'A'},{id:'b',label:'B'}],dropZones:[{id:'z',xPct:20,yPct:20,wPct:30,hPct:30,correctItemId:'a'}]};
describe('usable video interactions',()=>{
 it('accepts all four interaction types including legacy default quiz and default-correct hotspots',()=>{
  expect(videoCuesSchema.parse([quiz,{...quiz,correct:[0,1]},{atSeconds:0,kind:'branch',branches:[{label:'Replay',seekTo:0}]},{atSeconds:15,kind:'hotspot',hotspots:[{xPct:50,yPct:50}]},drag])).toHaveLength(5);
  expect(videoCuesSchema.parse([])).toEqual([]);
 });
 it('rejects unsolvable quizzes, empty choices and invalid times without dropping the interaction',()=>{
  for(const patch of [{correct:[]},{correct:[2]},{correct:[1,1]},{correct:[0.5]},{question:' '},{options:['A',' a ']},{options:['A','']},{atSeconds:-1},{atSeconds:Infinity},{onCorrectSeek:-1}])expect(videoCuesSchema.safeParse([{...quiz,...patch}]).success).toBe(false);
  for(const cue of [{atSeconds:1,kind:'branch',branches:[]},{atSeconds:1,kind:'branch',branches:[{label:'',seekTo:0}]},{atSeconds:1,kind:'hotspot',hotspots:[{xPct:50,yPct:50,correct:false}]},{atSeconds:1,kind:'hotspot',hotspots:[{xPct:101,yPct:50}]}])expect(videoCuesSchema.safeParse([cue]).success).toBe(false);
  expect(videoCuesSchema.safeParse(Array.from({length:101},()=>quiz)).success).toBe(false);
 });
 it('rejects ambiguous, missing, reused or unreachable drag targets',()=>{
  const zone=drag.dropZones[0];for(const patch of [{dragItems:[{id:'a',label:'A'},{id:'a',label:'Duplicate'}]},{dropZones:[{...zone,correctItemId:'missing'}]},{dropZones:[zone,zone]},{dropZones:[zone,{...zone,id:'other'}]},{dropZones:[{...zone,xPct:90}]},{dropZones:[{...zone,wPct:0}]}])expect(videoCuesSchema.safeParse([{...drag,...patch}]).success).toBe(false);
 });
});
