import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
const origin=process.env.RAERO_E2E_ORIGIN||'http://127.0.0.1:3177',output=process.env.RAERO_E2E_OUTPUT||'tmp/e2e/simulation';
const t=JSON.parse(fs.readFileSync('client/src/locales/fr.json','utf8'));
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({storageState:`${output}/learner-state.json`,viewport:{width:1440,height:1000}}),page=await context.newPage();
context.setDefaultTimeout(20000);
const report=[];const step=name=>{report.push(name);fs.writeFileSync(`${output}/purchase-progress.json`,JSON.stringify(report,null,2));};
try {
 await page.goto(origin+'/catalogue');await page.locator('#catalogue-search').fill('Recette complète');
 const details=page.locator('a[href^="/formation/"]').filter({hasText:t['catalogue.details']||'Détails'});
 await details.first().waitFor();const coursePath=await details.first().getAttribute('href');
 await page.goto(origin+coursePath);await page.getByRole('button',{name:t['trainingDetail.addToCart'],exact:true}).click();
 await page.getByText(/ajoutée? au panier/i).first().waitFor();await page.goto(origin+'/cart');
 await page.getByRole('button',{name:t['cart.clearCart'],exact:true}).click();await page.getByText(t['cart.emptyTitle'],{exact:true}).waitFor();step('add course and clear cart');
 await page.goto(origin+coursePath);await page.getByRole('button',{name:t['trainingDetail.addToCart'],exact:true}).click();await page.getByText(/ajoutée? au panier/i).first().waitFor();await page.goto(origin+'/cart');
 await page.getByRole('link',{name:t['cart.proceedToPayment'],exact:true}).click();await page.getByRole('heading',{name:t['checkout.pageTitle']}).waitFor();
 await page.route('**/__e2e/checkout?**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="fr"><body><h1>Prestataire de paiement simulé</h1><p>Environnement de recette local, aucun débit.</p><button>Simuler le paiement</button></body></html>'}));
 await page.getByRole('button',{name:/^Payer /}).click();await page.waitForURL('**/__e2e/checkout?**');
 const id=new URL(page.url()).searchParams.get('session_id');assert.ok(id?.startsWith('cs_test_'));step('real checkout creates frozen order and provider session');
 await page.getByRole('button',{name:'Simuler le paiement'}).click();
 const payment=JSON.parse(execFileSync('docker',['exec','--user','node',process.env.RAERO_E2E_CONTAINER||'raero-e2e-simulation-20260923','node','/app/scripts/e2e/stripe-control.mjs','pay',id],{encoding:'utf8'}));
 await page.goto(payment.successUrl.replace('{CHECKOUT_SESSION_ID}',id));
 await page.getByText(/paiement confirmé|paiement réussi|commande confirmée/i).first().waitFor();step('signed provider webhook pays order; return confirms purchase');
 await page.screenshot({path:`${output}/purchase-confirmed.png`,fullPage:true});
 await page.goto(origin+'/dashboard?tab=formations');const learning=page.locator('a[href*="/apprendre?"]');await learning.first().waitFor();
 const learningPath=await learning.first().getAttribute('href');fs.writeFileSync(`${output}/purchase.json`,JSON.stringify({...payment,coursePath,learningPath},null,2));step('purchased course becomes available in learner dashboard');
 await learning.first().click();await page.getByText('Préparation et contrôle',{exact:true}).first().waitFor();
 await page.screenshot({path:`${output}/learning-entry.png`,fullPage:true});fs.writeFileSync(`${output}/learning-entry.txt`,await page.locator('body').innerText());step('learner opens paid frozen course');
 fs.writeFileSync(`${output}/purchase-results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){await page.screenshot({path:`${output}/purchase-failure.png`,fullPage:true});fs.writeFileSync(`${output}/purchase-failure.txt`,await page.locator('body').innerText());throw error;}
finally{await browser.close();}
