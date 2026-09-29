import assert from 'node:assert/strict';
import {suite,origin,output,t} from './harness.mjs';
import fs from 'node:fs';
const text=(key,n)=>t[key].replace('{n}',String(n)).replace('{title}',String(n));
await suite('author-forms',async({page,step})=>{
 const p=await page('author');
 await p.goto(origin+'/maker');await p.getByRole('button',{name:t['maker.newCourse'],exact:true}).click();
 let d=p.getByRole('dialog');await d.locator('input').fill('Recette formats UI '+Date.now());
 const created=p.waitForResponse(r=>r.url().includes('maker.createCourse')&&r.request().method()==='POST');
 await d.getByRole('button',{name:t['maker.create'],exact:true}).click();
 const raw=await(await created).json(),{trainingId}=(Array.isArray(raw)?raw[0]:raw).result.data.json;
 await d.waitFor({state:'hidden'});step('instructor creates a separate draft for all question formats');
 for(const [button,keys] of [
  [t['adminContentManager.moduleButton'],['moduleTitleLabel','moduleShortDescriptionLabel','moduleContentLabel','moduleVideoLabel','modulePdfLabel','moduleDurationLabel','orderLabel']],
  [t['adminContentManager.objectiveButton'],['objectiveCodeLabel','knowledgeLevelLabel','objectiveTitleLabel','descriptionLabel','objectiveSubmoduleLabel','orderLabel']],
 ]){
  await p.getByRole('button',{name:button,exact:true}).click();d=p.getByRole('dialog');
  for(const key of keys)assert.equal(await d.getByLabel(t['adminContentManager.'+key],{exact:true}).count(),1,key);
  await d.getByRole('button',{name:t['adminContentManager.cancelButton'],exact:true}).click();
 }
 step('module and objective fields expose their visible labels');
 await p.getByRole('button',{name:t['maker.addSlide'],exact:true}).click();
 await p.getByRole('button',{name:text('courseMaker.editSlide',1),exact:true}).click();d=p.getByRole('dialog');
 assert.equal(await d.getByLabel(t['maker.slideTitle'],{exact:true}).count(),1);
 assert.equal(await d.getByLabel(t['maker.slideText'],{exact:true}).count(),1);
 await d.getByRole('button',{name:t['common.cancel'],exact:true}).click();step('slide title and text expose their visible labels');
 const types=['qcu','qcm','true_false','free_text','matching'];
 for(const type of types){
  await p.getByRole('button',{name:t['adminContentManager.questionButton'],exact:true}).click();d=p.getByRole('dialog');
  await d.getByLabel(t['adminContentManager.questionTypeLabel'],{exact:true}).selectOption(type);
  for(const key of ['questionModuleLabel','questionObjectiveLabel','pointsLabel','explanationLabel'])assert.equal(await d.getByLabel(t['adminContentManager.'+key],{exact:true}).count(),1,key);
  await d.getByLabel(t['adminContentManager.questionTextLabel'],{exact:true}).fill('Recette '+type);
  if(type==='free_text')await d.getByLabel(t['adminContentManager.keywordsLabel'],{exact:true}).fill('procédure approuvée, documentation approuvée');
  else if(type==='matching'){
   for(let i=0;i<2;i++){
    await d.getByPlaceholder(text('adminContentManager.itemPlaceholder',i+1),{exact:true}).fill('Élément '+i);
    await d.getByPlaceholder(text('adminContentManager.answerPlaceholder',i+1),{exact:true}).fill('Association '+i);
    await d.getByRole('combobox',{name:t['adminContentManager.matchingCorrectPairsLabel']+' Élément '+i,exact:true}).selectOption(String(1-i));
    assert.equal(await d.getByRole('button',{name:t['common.delete']+' '+text('adminContentManager.itemPlaceholder',i+1),exact:true}).count(),1);
    assert.equal(await d.getByRole('button',{name:t['common.delete']+' '+text('adminContentManager.answerPlaceholder',i+1),exact:true}).count(),1);
   }
  }else{
   if(type!=='true_false')for(let i=0;i<2;i++)await d.getByLabel(text('adminContentManager.answerPlaceholder',i+1),{exact:true}).fill('Choix '+i);
   const correct=d.getByTitle(t['adminContentManager.markCorrectAnswerTitle']);await correct.first().click();
   assert.equal(await correct.first().getAttribute('aria-pressed'),'true');
   if(type==='qcm'){await correct.nth(1).click();assert.equal(await correct.nth(1).getAttribute('aria-pressed'),'true');}
  }
  const response=p.waitForResponse(r=>r.url().includes('maker.content.questions.create')&&r.request().method()==='POST');
  await d.getByRole('button',{name:t['adminContentManager.saveButton'],exact:true}).click();assert.equal((await response).status(),200);await d.waitFor({state:'hidden'});
  await p.getByText('Recette '+type,{exact:true}).waitFor();
 }
 step('all five question formats save through named form controls');
 await p.goto(origin+'/maker/'+trainingId);
 for(const type of types)await p.getByText('Recette '+type,{exact:true}).waitFor();
 const response=await p.context().request.get(origin+'/api/trpc/maker.content.questions.list?input='+encodeURIComponent(JSON.stringify({json:{trainingId}})));
 assert.equal(response.status(),200);const rows=(await response.json()).result.data.json;
 assert.deepEqual(rows.map(q=>q.type).sort(),[...types].sort());
 for(const q of rows){
  if(q.type==='free_text')assert.deepEqual(q.answerKey.keywords,['procédure approuvée','documentation approuvée']);
  else if(q.type==='matching')assert.deepEqual(q.answerKey.pairs,[[0,1],[1,0]]);
  else assert.deepEqual(q.correctAnswer,q.type==='qcm'?[0,1]:[0]);
 }
 fs.writeFileSync(`${output}/author-forms-course.json`,JSON.stringify({trainingId}));
 step('all formats and answer keys persist after reopening the course');
});
