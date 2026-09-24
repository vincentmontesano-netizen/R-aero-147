import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const origin=process.env.RAERO_E2E_ORIGIN||'http://127.0.0.1:3177',output=process.env.RAERO_E2E_OUTPUT||'tmp/e2e/simulation';
const credentials=JSON.parse(fs.readFileSync('tmp/e2e/credentials.json','utf8'));
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const report=[];
const authorEmail='author-ui-e2e@example.test';
try {
 const admin=await browser.newContext({storageState:`${output}/admin-state.json`,viewport:{width:1440,height:1000}}),a=await admin.newPage();
 await a.goto(origin+'/admin?tab=users');await a.getByRole('button',{name:'Ajouter un utilisateur',exact:true}).waitFor();
 await a.getByRole('button',{name:'Ajouter un utilisateur',exact:true}).click();
 const newUser=a.getByRole('dialog');await newUser.getByPlaceholder('Jean Dupont').fill('Recette Formateur');await newUser.locator('input[type=email]').fill(authorEmail);await newUser.getByPlaceholder('≥ 6 caractères').fill(credentials.password);await newUser.locator('select').first().selectOption('instructor');await newUser.getByRole('button',{name:'Enregistrer',exact:true}).click();await newUser.waitFor({state:'hidden'});report.push('admin creates instructor');
 const author=await browser.newContext({viewport:{width:1440,height:1000}}),page=await author.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/login');await page.locator('#login-field-2').fill(authorEmail);await page.locator('#login-password').fill(credentials.password);await page.locator('form button[type=submit]').click();await page.waitForURL('**/dashboard');await page.locator('aside nav button').first().waitFor();await author.storageState({path:`${output}/author-state.json`});fs.chmodSync(`${output}/author-state.json`,0o600);
 await page.goto(origin+'/maker');await page.getByRole('button',{name:'Nouvelle formation',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.locator('input').fill('Recette complète — Maintenance aéronautique');
 const created=page.waitForResponse(r=>r.url().includes('maker.createCourse')&&r.request().method()==='POST');await dialog.getByRole('button',{name:'Créer la formation',exact:true}).click();const raw=await(await created).json();const course=(Array.isArray(raw)?raw[0]:raw).result.data.json;
 fs.writeFileSync(`${output}/course.json`,JSON.stringify(course,null,2));await dialog.waitFor({state:'hidden'});report.push('instructor creates course');
 await page.getByRole('button',{name:'Module',exact:true}).click();
 const module=page.getByRole('dialog');await module.getByPlaceholder('Introduction aux facteurs humains').fill('Préparation et contrôle');await module.getByPlaceholder('Contenu du module e-learning…').fill('Avant une intervention, consulter la procédure approuvée, identifier les risques et vérifier les outillages. Après intervention, enregistrer les opérations réalisées et effectuer le contrôle prévu.');
 await module.getByRole('button',{name:'Enregistrer',exact:true}).click();await module.waitFor({state:'hidden'});report.push('chapter content saved');
 for(const chapter of [true,false]){
  await page.getByRole('button',{name:'Question',exact:true}).click();const question=page.getByRole('dialog');
  if(chapter)await question.locator('select').nth(1).selectOption({label:'Préparation et contrôle'});
  await question.locator('textarea').first().fill(chapter?'Que faut-il consulter avant une intervention ?':'Quelle action termine une intervention ?');
  await question.getByPlaceholder('Réponse 1',{exact:true}).fill(chapter?'La procédure approuvée':'Enregistrer les opérations réalisées');await question.getByPlaceholder('Réponse 2',{exact:true}).fill(chapter?'Une instruction non vérifiée':'Quitter sans contrôle');
  await question.getByTitle('Marquer comme bonne réponse').first().click();await question.getByRole('button',{name:'Enregistrer',exact:true}).click();await question.waitFor({state:'hidden'});
  report.push(chapter?'chapter quiz saved':'final exam saved');
 }
 await page.getByRole('button',{name:'Revérifier',exact:true}).click();await page.waitForLoadState('networkidle');
 await page.screenshot({path:`${output}/course-authored.png`,fullPage:true});
 fs.writeFileSync(`${output}/authoring-results.json`,JSON.stringify({report,course,errors},null,2));console.log(JSON.stringify({report,course,errors}));assert.deepEqual(errors,[]);
} catch(error) {fs.writeFileSync(`${output}/authoring-progress.json`,JSON.stringify(report,null,2));throw error;}
finally{await browser.close();}
