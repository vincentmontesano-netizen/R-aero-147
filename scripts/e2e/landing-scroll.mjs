import fs from 'node:fs';
import assert from 'node:assert/strict';
import {suite,origin,output} from './harness.mjs';

await suite('landing-scroll',async({page,step})=>{
 for(const frameDelay of [0,333,2000]) for(const size of (frameDelay===2000?[{width:1440,height:1000}]:[{width:1440,height:1000},{width:390,height:844}])){
  const p=await page();await p.setViewportSize(size);p.setDefaultTimeout(30000);
  if(frameDelay)await p.addInitScript(delay=>{
   // Exercise the real scene/playback at a controlled low frame rate.
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
  await p.evaluate(pauseAtSecondView=>{
   const canvas=document.querySelector('.flight-canvas canvas'),gl=canvas?.getContext('webgl2');
   const extension=gl?.getExtension('WEBGL_debug_renderer_info');
   window.__tourRenderer=extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):null;
   window.__tour=[];window.__tourPaused=null;window.__tourTransitions=[];
   const sample=()=>{
    const section=document.querySelector('.flight-experience'),stage=document.querySelector('.flight-stage');
    const row={time:performance.now(),step:Number(section.dataset.view)-1,pinned:section.classList.contains('is-pinned'),top:stage.getBoundingClientRect().top,y:scrollY,pixelRatio:canvas.width/canvas.clientWidth};
    window.__tour.push(row);return row;
   };
   sample();
   // Observe committed views even when a slow renderer delays interval callbacks.
   // Arm the visibility check before wheel input, which may itself take several frames.
   window.__tourObserver=new MutationObserver(()=>{
    const row=sample();window.__tourTransitions.push(row);
    if(pauseAtSecondView&&row.step===1&&window.__tourPaused===null){
     window.__tourPaused='2';
     Object.defineProperty(document,'hidden',{configurable:true,value:true});
     document.dispatchEvent(new Event('visibilitychange'));
    }
   });
   window.__tourObserver.observe(document.querySelector('.flight-experience'),{attributes:true,attributeFilter:['data-view']});
   window.__tourTimer=setInterval(sample,40);
  },frameDelay===0&&size.width===1440);
  const fling=async()=>{
   // Firefox caps each event to roughly one viewport. Stop at the tour boundary
   // so slow input delivery cannot scroll past a tour that has already completed.
   for(let i=0;i<8;i++){
    if(await p.evaluate(()=>{
     const section=document.querySelector('.flight-experience'),stage=document.querySelector('.flight-stage');
     const end=scrollY+section.getBoundingClientRect().top+section.offsetHeight-stage.offsetHeight-64;
     return document.hidden||scrollY>=end-1;
    }))break;
    await p.mouse.wheel(0,20000);await p.waitForTimeout(50);
   }
  };
  try{
   assert.equal(await p.locator('.flight-stops, .flight-controls').count(),0);
   await fling();
   if(frameDelay===0&&size.width===1440){
    await p.waitForFunction(()=>window.__tourPaused==='2');
    await p.waitForTimeout(1500);
    assert.equal(await p.locator('.flight-experience').getAttribute('data-view'),'2');
    await p.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    await fling();
    step('hidden-document notification pauses the tour and resumes without skipping a view');
   }
   await p.waitForFunction(()=>document.querySelector('.flight-experience')?.dataset.view==='5');
   await p.locator('.flight-view-note a').waitFor();
   assert.equal(await p.locator('.flight-view-logo').evaluate(img=>img.complete&&img.naturalWidth>0),true);
   assert.equal(await p.locator('.flight-view-note > span').count(),0);
   const samples=await p.evaluate(()=>window.__tour),moving=samples.filter(row=>row.y>100&&row.step<4);
   // A software renderer can delay timers; verify coverage of every moving view.
   assert.deepEqual([...new Set(moving.map(row=>row.step))],[0,1,2,3]);
   assert.ok(moving.every(row=>row.pinned&&row.top>=0));
   assert.deepEqual([...new Set(samples.map(row=>row.step))],[0,1,2,3,4]);
   const duration=samples.find(row=>row.step===4).time-samples.find(row=>row.y>100).time;
   assert.ok(duration>2500&&duration<15000,`Five views took ${duration}ms`);
   await p.mouse.wheel(0,1800);
   await p.waitForFunction(()=>!document.querySelector('.flight-experience')?.classList.contains('is-pinned'));
   step(`${size.width}px tour visits all five views and releases at ${frameDelay===2000?'0.5fps':frameDelay?'3fps':'native cadence'}`);
   await p.screenshot({path:`${output}/scroll-release-${size.width}-${frameDelay}.png`});
  }finally{
   const evidence=await p.evaluate(()=>{clearInterval(window.__tourTimer);window.__tourObserver.disconnect();return {samples:window.__tour,transitions:window.__tourTransitions,renderer:window.__tourRenderer};}).catch(()=>({samples:[],renderer:null}));
   fs.writeFileSync(`${output}/landing-scroll-${size.width}-${frameDelay}-results.json`,JSON.stringify({viewport:size,frameDelay,...evidence},null,2));
  }
  await p.close();
 }
});
