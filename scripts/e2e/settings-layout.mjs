import assert from 'node:assert/strict';
import {suite,origin,output,t} from './harness.mjs';

await suite('settings-layout',async({page,step})=>{
 const admin=await page('admin');
 for(const width of [320,390,768,1024,1280,1920]){
  await admin.setViewportSize({width,height:900});
  await admin.goto(origin+'/admin?tab=settings');
  const field=admin.getByPlaceholder(t['adminDashboard.placeholderMistralKey'],{exact:true});
  await field.waitFor();
  await admin.evaluate(()=>document.fonts.ready);
  // Check live layout across frames: WebKit previously alternated mobile/desktop
  // layouts as the vertical scrollbar appeared and disappeared at 768 px.
  const frames=await admin.evaluate(async()=>{
   const values=[];const started=performance.now();
   while(performance.now()-started<600){
    values.push({clientWidth:document.documentElement.clientWidth,desktop:matchMedia('(min-width:48rem)').matches});
    await new Promise(requestAnimationFrame);
   }
   return values;
  });
  assert.equal(new Set(frames.map(frame=>frame.clientWidth)).size,1,`Viewport oscillates at ${width}px`);
  assert.equal(new Set(frames.map(frame=>frame.desktop)).size,1,`Breakpoint oscillates at ${width}px`);
  const collapse=admin.getByRole('button',{name:t['sidebar.collapse'],exact:true});
  if(await collapse.isVisible()){
   await collapse.click();
   await admin.waitForFunction(()=>document.querySelector('aside')?.getBoundingClientRect().width<=57);
   assert.equal(await admin.getByRole('button',{name:t['sidebar.expand'],exact:true}).getAttribute('aria-expanded'),'false');
  }else{
   assert.equal(await admin.locator('aside nav').evaluate(element=>getComputedStyle(element).flexDirection),'row');
  }
  const bounds=await field.boundingBox();
  assert.ok(bounds&&bounds.x>=0&&bounds.x+bounds.width<=width+1,`Mistral field outside viewport at ${width}px`);
  assert.ok(bounds.width>=200);
  assert.equal(await field.getAttribute('type'),'password');
  assert.ok(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  step(`settings remain stable and usable at ${width}px`);
 }
 await admin.screenshot({path:`${output}/settings-layout.png`,animations:'disabled'});
});
