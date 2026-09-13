import {z} from 'zod';
const origin='https://generativelanguage.googleapis.com';
const operationSchema=z.string().max(300).regex(/^(?:models\/[a-zA-Z0-9][a-zA-Z0-9._-]*\/)?operations\/[a-zA-Z0-9_-]+$/);
export class VideoProviderError extends Error {}
export const videoGenerationInput=z.object({prompt:z.string().trim().min(2).max(5000),aspectRatio:z.enum(['16:9','9:16']).default('16:9'),durationSeconds:z.union([z.literal(4),z.literal(6),z.literal(8)]).default(8)}).strict();
function config(){const key=(process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY||'').trim(),model=(process.env.GEMINI_VIDEO_MODEL||'').trim();if(!key||!/^veo-[a-zA-Z0-9._-]+$/.test(model))throw new VideoProviderError('La génération vidéo Google doit être configurée.');return {key,model};}
export function videoProviderModel(){return config().model;}
export function videoProviderConfigured(){try{config();return true;}catch{return false;}}
async function boundedBody(response:Response,maximum:number){
 const length=response.headers.get('content-length');if(length&&/^\d+$/.test(length)&&Number(length)>maximum){await response.body?.cancel();throw new VideoProviderError('Réponse vidéo trop volumineuse.');}
 const reader=response.body?.getReader();if(!reader)throw new VideoProviderError('Réponse vidéo vide.');
 const chunks:Uint8Array[]=[];let total=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maximum){await reader.cancel();throw new VideoProviderError('Réponse vidéo trop volumineuse.');}chunks.push(value);}}finally{reader.releaseLock();}
 return Buffer.concat(chunks,total);
}
async function jsonRequest(path:string,body?:unknown):Promise<unknown>{
 const {key}=config();const response=await fetch(`${origin}/v1beta/${path}`,{method:body===undefined?'GET':'POST',redirect:'error',signal:AbortSignal.timeout(180000),headers:{'x-goog-api-key':key,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 if(!response.ok){await response.body?.cancel();throw new VideoProviderError(`Google vidéo : requête refusée (HTTP ${response.status}).`);}
 const bytes=await boundedBody(response,1024*1024);try{return JSON.parse(bytes.toString('utf8'));}catch{throw new VideoProviderError('Réponse vidéo JSON invalide.');}
}
export async function startVideoGeneration(raw:z.input<typeof videoGenerationInput>, frozenModel?:string){
 const input=videoGenerationInput.parse(raw),model=frozenModel??config().model;
 if(!/^veo-[a-zA-Z0-9._-]+$/.test(model))throw new VideoProviderError("Modèle vidéo invalide.");const data=await jsonRequest(`models/${model}:predictLongRunning`,{instances:[{prompt:input.prompt}],parameters:{aspectRatio:input.aspectRatio,durationSeconds:input.durationSeconds,resolution:'720p',sampleCount:1}});
 const result=z.object({name:operationSchema}).safeParse(data);if(!result.success)throw new VideoProviderError('Identifiant de génération vidéo invalide.');return {operationName:result.data.name,model};
}
export async function checkVideoGeneration(operationName:string):Promise<{state:'running'}|{state:'failed'}|{state:'ready';uri:string}>{
 const name=operationSchema.parse(operationName),raw=await jsonRequest(name);const result=z.object({name:operationSchema.optional(),done:z.boolean().optional(),error:z.unknown().optional(),response:z.unknown().optional()}).safeParse(raw);
 if(!result.success||(result.data.name&&result.data.name!==name))throw new VideoProviderError('État de génération vidéo invalide.');
 if(result.data.error!=null)return {state:'failed'};
 if(!result.data.done)return {state:'running'};
 const output=z.object({generateVideoResponse:z.object({generatedSamples:z.array(z.object({video:z.object({uri:z.string().url().max(8192)})})).length(1)})}).safeParse(result.data.response);
 if(!output.success)return {state:'failed'};
 const uri=output.data.generateVideoResponse.generatedSamples[0].video.uri;downloadUrl(uri,true);return {state:'ready',uri};
}
function downloadUrl(raw:string,initial=false){let url:URL;try{url=new URL(raw);}catch{throw new VideoProviderError('Adresse de téléchargement vidéo invalide.');}
 const host=url.hostname;const allowed=host==='generativelanguage.googleapis.com'||(!initial&&(host==='storage.googleapis.com'||host.endsWith('.googleusercontent.com')));
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash||!allowed)throw new VideoProviderError('Adresse de téléchargement vidéo refusée.');return url;
}
export async function downloadGeneratedVideo(uri:string){
 let url=downloadUrl(uri,true);const {key}=config();const signal=AbortSignal.timeout(180000);
 for(let redirects=0;redirects<=3;redirects++){
  const response=await fetch(url,{redirect:'manual',signal,headers:url.origin===origin?{'x-goog-api-key':key}:{}});
  if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');await response.body?.cancel();if(!location)throw new VideoProviderError('Redirection vidéo invalide.');url=downloadUrl(new URL(location,url).href);continue;}
  if(!response.ok){await response.body?.cancel();throw new VideoProviderError(`Google vidéo : téléchargement refusé (HTTP ${response.status}).`);}
  const bytes=await boundedBody(response,50*1024*1024);
  if(bytes.length<16||bytes.subarray(4,8).toString()!=='ftyp'||bytes.readUInt32BE(0)<16||bytes.readUInt32BE(0)>bytes.length||!['isom','iso2','iso6','mp41','mp42','avc1','M4V ','dash'].includes(bytes.subarray(8,12).toString()))throw new VideoProviderError('Le résultat vidéo ne contient pas un MP4 reconnu.');
  return bytes;
 }
 throw new VideoProviderError('Trop de redirections vidéo.');
}
