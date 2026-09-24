/** Fresh, isolated browser acceptance run. Docker + Chrome are required. */
import fs from 'node:fs';import path from 'node:path';import {randomBytes} from 'node:crypto';import {spawnSync} from 'node:child_process';
const runId=new Date().toISOString().replace(/\D/g,'').slice(0,14),container=`raero-e2e-${runId}`,image=`raero-e2e:${runId}`;
const port=Number(process.env.RAERO_E2E_PORT||3178),origin=`http://127.0.0.1:${port}`,output=`tmp/e2e/run-${runId}`;
fs.mkdirSync(output,{recursive:true});
const credentialsPath='tmp/e2e/credentials.json';
if(!fs.existsSync(credentialsPath))fs.writeFileSync(credentialsPath,JSON.stringify({adminEmail:'admin-ui-e2e@example.test',adminPassword:randomBytes(24).toString('hex'),learnerEmail:'learner-ui-e2e@example.test',managerEmail:'manager-ui-e2e@example.test',password:randomBytes(24).toString('hex')}),{mode:0o600});
const credentials=JSON.parse(fs.readFileSync(credentialsPath,'utf8'));
const envFile=path.resolve(output,'runtime.env');
fs.writeFileSync(envFile,Object.entries({ADMIN_EMAIL:credentials.adminEmail,ADMIN_PASSWORD:credentials.adminPassword,SEED_DEMO_DATA:'true',NODE_ENV:'test',APP_ORIGIN:origin,PUBLIC_APP_URL:origin,RAERO_E2E_SIMULATION:'1',STRIPE_SECRET_KEY:'sk_test_local_fixture_only',STRIPE_WEBHOOK_SECRET:randomBytes(24).toString('hex'),NODE_OPTIONS:'--import=/app/scripts/e2e/stripe-simulator.mjs'}).map(([key,value])=>`${key}=${value}`).join('\n'),{mode:0o600});
const command=(name,args,env=process.env)=>{const result=spawnSync(name,args,{stdio:'inherit',env});if(result.status!==0)throw new Error(`${name} failed (${result.status})`);};
const result={container,image,origin,output,startedAt:new Date().toISOString(),suites:[],status:'running'};
const save=()=>fs.writeFileSync(path.join(output,'run.json'),JSON.stringify(result,null,2));save();
try{
 command('docker',['build','-t',image,'.']);
 command('docker',['run','-d','--name',container,'--label','raero.e2e=1','-p',`127.0.0.1:${port}:3000`,'--env-file',envFile,'--mount',`type=bind,source=${path.resolve('scripts/e2e')},target=/app/scripts/e2e,readonly`,image]);
 let ready=false;for(let i=0;i<90;i++){try{if((await fetch(origin+'/health/ready')).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,1000));}if(!ready)throw new Error('Isolated application did not become ready');
 const env={...process.env,RAERO_E2E_ORIGIN:origin,RAERO_E2E_OUTPUT:output,RAERO_E2E_CONTAINER:container};delete env.RAERO_E2E_RESUME;
 for(const suite of ['accounts','course-authoring','course-publication','purchase','learning','documents','services','company','passport','verification','admin-content','live','security','sessions','final-ui','landing-scroll']){
  command(process.execPath,[`scripts/e2e/${suite}.mjs`],env);result.suites.push(suite);save();
 }
 result.status='passed';result.finishedAt=new Date().toISOString();save();console.log(JSON.stringify(result));
}catch(error){result.status='failed';result.error=String(error);save();throw error;}
// Kept available for evidence review; remove only this labeled container after review.
