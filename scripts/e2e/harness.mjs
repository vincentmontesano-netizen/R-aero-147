import fs from 'node:fs';
import {chromium} from 'playwright-core';
export const origin=process.env.RAERO_E2E_ORIGIN||'http://127.0.0.1:3177';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw new Error('E2E mutations require the isolated local app');
export const output=process.env.RAERO_E2E_OUTPUT||'tmp/e2e/simulation';
export const t=JSON.parse(fs.readFileSync('client/src/locales/fr.json','utf8'));
export const credentials=JSON.parse(fs.readFileSync('tmp/e2e/credentials.json','utf8'));
export async function suite(name,run){
 const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const report=process.env.RAERO_E2E_RESUME&&fs.existsSync(`${output}/${name}-progress.json`)?JSON.parse(fs.readFileSync(`${output}/${name}-progress.json`,'utf8')):[],pages=[],errors=[];
 const step=message=>{report.push(message);fs.writeFileSync(`${output}/${name}-progress.json`,JSON.stringify(report,null,2));console.log(message);};
 const page=async role=>{const context=await browser.newContext({storageState:role?`${output}/${role}-state.json`:undefined,viewport:{width:1440,height:1000},acceptDownloads:true});context.setDefaultTimeout(15000);const p=await context.newPage();p.on('pageerror',error=>errors.push(error.message));pages.push(p);return p;};
 try{await run({browser,page,step});if(errors.length)throw new Error(errors.join('\n'));fs.writeFileSync(`${output}/${name}-results.json`,JSON.stringify({steps:report,errors},null,2));}
 catch(error){for(let i=0;i<pages.length;i++){await pages[i].screenshot({path:`${output}/${name}-failure-${i}.png`,fullPage:true}).catch(()=>{});fs.writeFileSync(`${output}/${name}-failure-${i}.txt`,await pages[i].locator('body').innerText().catch(()=>''));}throw error;}
 finally{await browser.close();}
}
