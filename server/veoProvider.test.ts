import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {startVideoGeneration,checkVideoGeneration,downloadGeneratedVideo,videoProviderConfigured,VideoProviderError} from './veoProvider';
let request:ReturnType<typeof vi.fn>;
const operation='models/veo-3.1-generate-preview/operations/fixture',uri='https://generativelanguage.googleapis.com/v1beta/files/fixture:download?alt=media';
const json=(v:unknown)=>new Response(JSON.stringify(v));
beforeEach(()=>{vi.stubEnv('GEMINI_API_KEY','fixture-secret');vi.stubEnv('GEMINI_VIDEO_MODEL','veo-3.1-generate-preview');request=vi.fn();vi.stubGlobal('fetch',request);});afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('submits one bounded generation and checks its existing operation without resubmitting',async()=>{
 request.mockResolvedValueOnce(json({name:operation}));expect(await startVideoGeneration({prompt:' Aircraft inspection ',durationSeconds:4})).toEqual({operationName:operation,model:'veo-3.1-generate-preview'});
 expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({instances:[{prompt:'Aircraft inspection'}],parameters:{aspectRatio:'16:9',durationSeconds:4,resolution:'720p',sampleCount:1}});
 request.mockResolvedValueOnce(json({name:operation}));expect(await checkVideoGeneration(operation)).toEqual({state:'running'});
 request.mockResolvedValueOnce(json({name:operation,done:true,response:{generateVideoResponse:{generatedSamples:[{video:{uri}}]}}}));expect(await checkVideoGeneration(operation)).toEqual({state:'ready',uri});expect(request.mock.calls.filter(c=>c[1].method==='POST')).toHaveLength(1);
});
it('rejects invalid operation identities, terminal missing outputs and leaked provider errors',async()=>{
 await expect(checkVideoGeneration('../secret')).rejects.toThrow();expect(request).not.toHaveBeenCalled();
 request.mockResolvedValueOnce(json({done:true,response:{}}));expect(await checkVideoGeneration(operation)).toEqual({state:'failed'});
 request.mockResolvedValueOnce(json({error:{message:'private provider error'}}));expect(await checkVideoGeneration(operation)).toEqual({state:'failed'});
 request.mockResolvedValueOnce(new Response('private provider error',{status:429}));await expect(startVideoGeneration({prompt:'Aircraft'})).rejects.toThrow('HTTP 429');
 request.mockResolvedValueOnce(json({name:'operations/different',done:false}));await expect(checkVideoGeneration(operation)).rejects.toBeInstanceOf(VideoProviderError);
 vi.stubEnv('GEMINI_VIDEO_MODEL','../../bad');expect(videoProviderConfigured()).toBe(false);
});
it('downloads MP4 through controlled redirects without forwarding the key to the storage host',async()=>{
 const bytes=Buffer.alloc(20);bytes.writeUInt32BE(20);bytes.write('ftyp',4);bytes.write('isom',8);
 request.mockResolvedValueOnce(new Response(null,{status:302,headers:{location:'https://storage.googleapis.com/fixture/video'}}));request.mockResolvedValueOnce(new Response(bytes));
 expect(await downloadGeneratedVideo(uri)).toEqual(bytes);expect(request.mock.calls[0][1].headers).toEqual({'x-goog-api-key':'fixture-secret'});expect(request.mock.calls[1][1].headers).toEqual({});
 request.mockClear();await expect(downloadGeneratedVideo('http://127.0.0.1/private')).rejects.toThrow();expect(request).not.toHaveBeenCalled();
 request.mockResolvedValueOnce(new Response(null,{status:302,headers:{location:'https://example.invalid/steal'}}));await expect(downloadGeneratedVideo(uri)).rejects.toThrow('refusée');expect(request).toHaveBeenCalledTimes(1);
});
it('cancels oversized streams and rejects non-video bytes',async()=>{
 const cancel=vi.fn();request.mockResolvedValueOnce(new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(50*1024*1024+1));},cancel}),{headers:{'Content-Type':'video/mp4'}}));await expect(downloadGeneratedVideo(uri)).rejects.toThrow('volumineuse');expect(cancel).toHaveBeenCalled();
 request.mockResolvedValueOnce(new Response('<html>not a video</html>'));await expect(downloadGeneratedVideo(uri)).rejects.toThrow('MP4');
 request.mockResolvedValueOnce(new Response('not json'));await expect(checkVideoGeneration(operation)).rejects.toThrow('JSON invalide');
});
