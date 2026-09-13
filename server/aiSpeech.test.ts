import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
vi.mock('./courseMedia',()=>({saveCourseMedia:vi.fn(async()=>({url:'/storage/course-media/1/fixture.mp3'}))}));
import {generateSpeech,AIError} from './ai';
import {saveCourseMedia} from './courseMedia';
const bytes=Buffer.from('ID3-fixture-audio');
let request:ReturnType<typeof vi.fn>;
const base={actor:{id:1,role:'instructor'},trainingId:1,text:' Narration '};
beforeEach(()=>{vi.stubEnv('GOOGLE_API_KEY','fixture');vi.stubEnv('GEMINI_API_KEY','');vi.stubEnv('MISTRAL_API_KEY','fixture');vi.stubEnv('OPENAI_API_KEY','fixture');request=vi.fn();vi.stubGlobal('fetch',request);vi.mocked(saveCourseMedia).mockClear();});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('speech provider adapter',()=>{
 it('selects French, English and Arabic Google voices and preserves media ownership',async()=>{
  for(const [language,code] of [['fr','fr-FR'],['en','en-US'],['ar','ar-XA']]){
   request.mockResolvedValueOnce(new Response(JSON.stringify({audioContent:bytes.toString('base64')})));
   await generateSpeech({...base,provider:'google',language});const sent=JSON.parse(request.mock.calls.at(-1)![1].body);expect(sent.voice.languageCode).toBe(code);expect(sent.input.text).toBe('Narration');expect(sent.audioConfig.audioEncoding).toBe('MP3');
  }
  expect(saveCourseMedia).toHaveBeenLastCalledWith(base.actor,1,bytes,'audio/mpeg');
 });
 it('handles binary and JSON speech transports and rejects malformed output before persistence',async()=>{
  request.mockResolvedValueOnce(new Response(bytes));await generateSpeech({...base,provider:'openai'});
  request.mockResolvedValueOnce(new Response(JSON.stringify({audio_data:bytes.toString('base64')})));await generateSpeech({...base,provider:'mistral',language:'ar'});expect(JSON.parse(request.mock.calls.at(-1)![1].body)).toMatchObject({stream:false,response_format:'mp3'});
  vi.mocked(saveCourseMedia).mockClear();
  for(const value of [null,{}, {audioContent:123},{audioContent:'%%%%'},{audioContent:bytes.toString('base64')+'='},{audioContent:Buffer.from('<html>Error</html>').toString('base64')}]){
   request.mockResolvedValueOnce(new Response(JSON.stringify(value)));await expect(generateSpeech({...base,provider:'google'})).rejects.toBeInstanceOf(AIError);
  }
  request.mockResolvedValueOnce(new Response('private malformed response'));await expect(generateSpeech({...base,provider:'google'})).rejects.toThrow('Réponse audio JSON invalide');
  request.mockResolvedValueOnce(new Response(''));await expect(generateSpeech({...base,provider:'openai'})).rejects.toBeInstanceOf(AIError);expect(saveCourseMedia).not.toHaveBeenCalled();
 });
 it('does not echo provider errors or send whitespace-only text',async()=>{
  for(const provider of ['google','mistral','openai'] as const){request.mockResolvedValueOnce(new Response('private provider payload',{status:429}));await expect(generateSpeech({...base,provider})).rejects.toThrow('HTTP 429');}
  request.mockResolvedValueOnce(new Response('private provider payload',{status:500}));await expect(generateSpeech({...base,provider:'google'})).rejects.not.toThrow('private provider payload');
  request.mockClear();await expect(generateSpeech({...base,provider:'google',text:'  '})).rejects.toThrow();await expect(generateSpeech({...base,provider:'google',language:'invalid'})).rejects.toThrow();expect(request).not.toHaveBeenCalled();expect(saveCourseMedia).not.toHaveBeenCalled();
 });
});
