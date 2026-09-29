import fs from 'node:fs';
import assert from 'node:assert/strict';
import {suite,origin,output} from './harness.mjs';

await suite('landing-scroll',async({page,step})=>{
 for(const frameDelay of [0,333]) for(const size of [{width:1440,height:1000},{width:390,height:844}]){
  const p=await page();await p.setViewportSize(size);p.setDefaultTimeout(30000);
  if(frameDelay)await p.addInitScript(delay=>{
   // Exercise the real scene/playback at about three frames per second.
   const raf=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);
   const pending=new Map();let id=0;
   window.requestAnimationFrame=callback=>{
    const key=++id;
    pending.set(key,{timer:setTimeout(()=>{const entry=pending.get(key);if(entry)entry.frame=raf(time=>{pending.delete(key);callback(time);});},delay)});
    return key;
   };
   window.cancelAnimationFrame=key=>{const entry=pending.get(key);if(entry){clearTimeout(entry.timer);if(entry.frame)cancel(entry.frame);pending.delete(key);}};
  },frameDelay);
  await p.goto(origin+'/');
  await p.waitForFunction(()=>{const button=document.querySelector('.flight-copy .academy-button');return button&&!button.disabled;});
  await p.evaluate(()=>{
   window.__tour=[];
   window.__tourTimer=setInterval(()=>{
    const section=document.querySelector('.flight-experience'),stage=document.querySelector('.flight-stage');
    window.__tour.push({time:performance.now(),step:Number(section.dataset.view)-1,pinned:section.classList.contains('is-pinned'),top:stage.getBoundingClientRect().top,y:scrollY});
   },40);
  });
  try{
   assert.equal(await p.locator('.flight-stops, .flight-controls').count(),0);
   // Firefox caps each wheel event to roughly one viewport; repeat the fling.
   for(let i=0;i<8;i++){await p.mouse.wheel(0,20000);await p.waitForTimeout(50);}
   await p.waitForFunction(()=>document.querySelector('.flight-experience')?.dataset.view==='5');
   await p.locator('.flight-view-note a').waitFor();
   assert.equal(await p.locator('.flight-view-logo').evaluate(img=>img.complete&&img.naturalWidth>0),true);
   assert.equal(await p.locator('.flight-view-note > span').count(),0);
   const samples=await p.evaluate(()=>window.__tour),moving=samples.filter(row=>row.y>100&&row.step<4);
   assert.ok(moving.length>10);
   assert.ok(moving.every(row=>row.pinned&&row.top>=0));
   assert.deepEqual([...new Set(samples.map(row=>row.step))],[0,1,2,3,4]);
   const duration=samples.find(row=>row.step===4).time-samples.find(row=>row.y>100).time;
   assert.ok(duration>2500&&duration<15000,`Five views took ${duration}ms`);
   await p.mouse.wheel(0,1800);
   await p.waitForFunction(()=>!document.querySelector('.flight-experience')?.classList.contains('is-pinned'));
   step(`${size.width}px tour visits all five views and releases at ${frameDelay?'3fps':'native cadence'}`);
   await p.screenshot({path:`${output}/scroll-release-${size.width}-${frameDelay}.png`});
  }finally{
   const samples=await p.evaluate(()=>{clearInterval(window.__tourTimer);return window.__tour;}).catch(()=>[]);
   fs.writeFileSync(`${output}/landing-scroll-${size.width}-${frameDelay}-results.json`,JSON.stringify({viewport:size,frameDelay,samples},null,2));
  }
  await p.close();
 }
});
