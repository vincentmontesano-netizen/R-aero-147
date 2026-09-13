import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {aiGenerateOutline,aiGenerateQuiz,aiWriteSlideText,AIError} from './ai';
const quiz={question:'Which action?',options:['Inspect','Ignore','Remove','Paint'],correct:[0],explanation:'Inspect first.'};
const slide={title:'Inspection',body:'Inspect the component.',imagePrompt:'An aircraft component',quiz};
let request:ReturnType<typeof vi.fn>;
function response(value:unknown){request.mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:typeof value==='string'?value:JSON.stringify(value)}}]}),{status:200,headers:{'Content-Type':'application/json'}}));}
beforeEach(()=>{vi.stubEnv('OPENAI_API_KEY','fixture-not-a-real-key');request=vi.fn();vi.stubGlobal('fetch',request);});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('validated AI authoring output',()=>{
 it('accepts a complete Arabic outline and validates quiz coverage without inventing missing slides',async()=>{
  const outline={title:'Course',description:'Description',slides:[slide,{...slide,quiz:null}]};response('```json\n'+JSON.stringify(outline)+'\n```');
  const result=await aiGenerateOutline({provider:'openai',topic:'Inspection',slideCount:2,quizCoverage:'some',language:'ar'});
  expect(result.slides).toHaveLength(2);expect(result.slides[1].quiz).toBeUndefined();
  expect(JSON.parse(request.mock.calls[0][1].body).messages[0].content).toContain('العربية');
  expect(request.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  for(const patch of [{slideCount:3},{quizCoverage:'all'},{quizCoverage:'none'}]){response(outline);await expect(aiGenerateOutline({provider:'openai',topic:'Inspection',slideCount:2,...patch})).rejects.toBeInstanceOf(AIError);}
 });
 it('rejects malformed answers, duplicate options and answer indices before returning a quiz',async()=>{
  for(const invalid of [{...quiz,correct:[4]},{...quiz,correct:[0,0]},{...quiz,correct:[]},{...quiz,correct:[0.5]},{...quiz,options:['A','a','B','C']},{...quiz,options:['A','B']},{...quiz,explanation:''},null,[],{...quiz,secret:'unexpected'}]){
   response(invalid);await expect(aiGenerateQuiz({provider:'openai',content:'Inspection'})).rejects.toBeInstanceOf(AIError);
  }
  response({...quiz,correct:[0,2]});expect(await aiGenerateQuiz({provider:'openai',content:'Inspection'})).toMatchObject({correct:[0,2]});
 });
 it('rejects invalid or excessive outlines and empty slide text without leaking the model output',async()=>{
  for(const invalid of ['not-json private-response',{title:'Course',description:'Description',slides:{}},{title:'Course',description:'Description',slides:[slide,{...slide,body:''}]},{title:'Course',description:'Description',slides:Array.from({length:15},()=>slide)},'x'.repeat(200001)]){
   response(invalid);await expect(aiGenerateOutline({provider:'openai',topic:'Inspection',slideCount:2,quizCoverage:'all'})).rejects.toBeInstanceOf(AIError);
  }
  response('not-json private-response');await expect(aiGenerateQuiz({provider:'openai',content:'Inspection'})).rejects.not.toThrow('private-response');
  request.mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:{unexpected:'object'}}}]})));
  await expect(aiWriteSlideText({provider:'openai',instruction:'Write content'})).rejects.toBeInstanceOf(AIError);
  response('  ');await expect(aiWriteSlideText({provider:'openai',instruction:'Write content'})).rejects.toBeInstanceOf(AIError);
  response(' Valid slide body. ');expect(await aiWriteSlideText({provider:'openai',instruction:'Write content'})).toBe('Valid slide body.');
 });
});
