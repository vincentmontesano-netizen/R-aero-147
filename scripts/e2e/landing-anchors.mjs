import assert from 'node:assert/strict';
import fs from 'node:fs';
import { suite, origin, output, t } from './harness.mjs';

await suite('landing-anchors', async ({ page, step }) => {
  for (const width of [1440, 390]) {
    const p = await page();
    await p.setViewportSize({ width, height: 1000 });
    const evidence = [];
    let releaseModel;
    const gate = new Promise(resolve => { releaseModel = resolve; });
    await p.route('**/models/a320/cockpit.glb', async route => {
      await gate;
      await route.continue().catch(() => {});
    });
    const atAnchor = async id => p.waitForFunction(id => {
      const rect = document.getElementById(id)?.getBoundingClientRect();
      return rect && rect.top >= -1 && rect.top < 160;
    }, id, { timeout: 3000 }).finally(async () => {
      evidence.push(await p.evaluate(id => ({ id, top: document.getElementById(id)?.getBoundingClientRect().top, y: scrollY, height: innerHeight, documentHeight: document.documentElement.scrollHeight, canvasCount: document.querySelectorAll('.flight-canvas canvas').length }), id));
    });
    try {
      await p.goto(origin + '/#faq');
      await atAnchor('faq');
      assert.equal(await p.locator('.flight-canvas canvas').count(), 0);
      assert.equal(await p.locator('.flight-copy .academy-button').isDisabled(), true);
      await p.locator('#faq summary').first().click();
      assert.equal(await p.locator('#faq details').first().getAttribute('open'), '');
      step(`direct FAQ anchor stays usable while the 3D model loads at ${width}px`);
      // Returning to the introduction starts the real model request. An anchor
      // must still bypass the tour while that request remains deliberately held.
      const requested = p.waitForRequest(request => request.url().endsWith('/models/a320/cockpit.glb'));
      await p.evaluate(() => { history.replaceState(null, '', location.pathname); window.scrollTo({ top: 0, behavior: 'instant' }); });
      await requested;
      await p.evaluate(() => { location.hash = 'faq'; });
      await atAnchor('faq');
      assert.equal(await p.locator('.flight-copy .academy-button').isDisabled(), true);
      step(`returning starts the model and FAQ navigation bypasses the pending request at ${width}px`);
    } finally {
      fs.writeFileSync(`${output}/landing-anchor-${width}-results.json`, JSON.stringify(evidence, null, 2));
      releaseModel();
    }
    await p.close();
  }
  const p = await page();
  let releaseCourses;
  const coursesGate = new Promise(resolve => { releaseCourses = resolve; });
  await p.route('**/api/trpc/**', async route => {
    if (route.request().url().includes('public.featuredTrainings')) await coursesGate;
    await route.continue().catch(() => {});
  });
  await p.goto(origin + '/');
  await p.getByRole('link', { name: t['nav.companies'], exact: true }).click();
  const atCompany = () => p.waitForFunction(() => {
    const rect = document.getElementById('entreprises')?.getBoundingClientRect();
    return rect && rect.top >= -1 && rect.top < 160;
  }, undefined, { timeout: 3000 });
  // Resolve while smooth navigation is in flight, when native scroll anchoring is suppressed.
  await p.waitForTimeout(100);
  releaseCourses();
  await p.waitForFunction(() => document.querySelectorAll('.academy-course').length > 0);
  await atCompany();
  step('company anchor stays in view after a delayed featured-course response');
  step('same-page company navigation bypasses the introductory tour');
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await p.waitForFunction(() => scrollY === 0);
  await p.getByRole('link', { name: t['nav.companies'], exact: true }).click();
  await atCompany();
  step('the same anchor remains usable after returning to the top');
  await p.goto(origin + '/about');
  await p.getByRole('link', { name: t['nav.companies'], exact: true }).click();
  await atCompany();
  step('company navigation from another route reaches the requested section');
});
