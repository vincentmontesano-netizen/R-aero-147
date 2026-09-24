import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from 'playwright-core';
const origin=process.env.RAERO_E2E_ORIGIN||'http://127.0.0.1:3177',output=process.env.RAERO_E2E_OUTPUT||'tmp/e2e/simulation';
const t=JSON.parse(fs.readFileSync('client/src/locales/fr.json','utf8'));
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({storageState:`${output}/learner-state.json`,viewport:{width:1440,height:1000}}),page=await context.newPage();context.setDefaultTimeout(20000);
const report=[];const step=name=>{report.push(name);fs.writeFileSync(`${output}/learning-progress.json`,JSON.stringify(report,null,2));};
try{
 await page.goto(origin+'/dashboard?tab=formations');const link=page.locator('a[href*="/apprendre?"]');await link.first().waitFor();const learningPath=await link.first().getAttribute('href');
 fs.writeFileSync(`${output}/learning.json`,JSON.stringify({learningPath},null,2));await link.first().click();
 await page.getByText('Préparation et contrôle',{exact:true}).first().waitFor();step('paid course available in dashboard and opens');
 assert.equal(await page.getByRole('button',{name:t['learningPlayer.finalExam'],exact:true}).first().isDisabled(),true);step('final exam locked before required chapter');
 await page.getByRole('button',{name:t['examEntry.start'],exact:true}).click();await page.getByRole('button',{name:'La procédure approuvée',exact:false}).click();await page.getByRole('button',{name:t['learningPlayer.submitAnswers'],exact:true}).click();
 await page.getByText(t['learningPlayer.chapterPassed'],{exact:true}).waitFor();step('chapter assessment passed and progress saved');
 await page.getByRole('button',{name:t['learningPlayer.finalExam'],exact:true}).first().click();await page.getByRole('button',{name:t['examEntry.start'],exact:true}).click();
 await page.getByRole('button',{name:'Enregistrer les opérations réalisées',exact:false}).click();await page.getByRole('button',{name:t['learningPlayer.submitAnswers'],exact:true}).click();
 await page.getByText(t['learningPlayer.trainingValidated'],{exact:true}).first().waitFor();step('final exam passed and training completed');
 await page.screenshot({path:`${output}/course-completed.png`,fullPage:true});
 await page.goto(origin+'/dashboard?tab=certificates');await page.getByText('Recette complète — Maintenance aéronautique',{exact:true}).waitFor();
 await page.screenshot({path:`${output}/certificate-dashboard.png`,fullPage:true});fs.writeFileSync(`${output}/certificate-dashboard.txt`,await page.locator('body').innerText());step('certificate appears in dashboard');
 fs.writeFileSync(`${output}/learning-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){await page.screenshot({path:`${output}/learning-failure.png`,fullPage:true});fs.writeFileSync(`${output}/learning-failure.txt`,await page.locator('body').innerText());throw error;}
finally{await browser.close();}
