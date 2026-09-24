import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const credentials=JSON.parse(fs.readFileSync('tmp/e2e/credentials.json','utf8'));
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const origin=process.env.RAERO_E2E_ORIGIN||'http://127.0.0.1:3177',output=process.env.RAERO_E2E_OUTPUT||'tmp/e2e/simulation';
const results=[];
try {
 for(const role of ['learner','manager','admin']){
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(role==='admin'){
   await page.goto(origin+'/login');await page.locator('#login-field-2').fill(credentials.adminEmail);await page.locator('#login-password').fill(credentials.adminPassword);await page.locator('form button[type="submit"]').click();await page.waitForURL('**/admin');
  } else {
   await page.goto(origin+'/register');await page.locator('#reg-field-1').fill(role==='learner'?'Recette Apprenant':'Recette Responsable');await page.locator('#reg-field-2').fill(credentials[role+'Email']);await page.locator('#reg-field-3').fill(credentials.password);
   if(role==='manager'){await page.getByRole('checkbox').first().check();await page.locator('#reg-field-4').fill('Recette Aero MRO');await page.locator('#reg-field-5').selectOption('MRO');await page.locator('#reg-field-6').fill('RECETTE-145');}
   await page.locator('form button[type="submit"]').click();await page.waitForURL('**/dashboard');
   if(role==='manager')await page.goto(origin+'/entreprise');
  }
  await page.locator('aside nav button').first().waitFor();await page.waitForLoadState('networkidle');await context.storageState({path:`${output}/${role}-state.json`});fs.chmodSync(`${output}/${role}-state.json`,0o600);
  await page.screenshot({path:`${output}/${role}-desktop.png`});
  const state=await page.evaluate(()=>({route:location.pathname,title:document.querySelector('h1')?.textContent,overflow:document.documentElement.scrollWidth>innerWidth}));
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);await page.screenshot({path:`${output}/${role}-mobile.png`});
  const mobile=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,viewport:innerWidth,document:document.documentElement.scrollWidth}));
  assert.deepEqual(errors,[]);results.push({role,...state,mobile,errors});console.log(JSON.stringify(results.at(-1)));await context.close();
 }
 fs.writeFileSync(`${output}/accounts-results.json`,JSON.stringify(results,null,2));
}finally{await browser.close();}
