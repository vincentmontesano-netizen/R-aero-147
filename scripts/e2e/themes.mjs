import fs from 'node:fs';
import assert from 'node:assert/strict';
import { suite, origin, output } from './harness.mjs';

await suite('themes', async ({ page, browser, step }) => {
  const p = await page();
  await p.goto(origin + '/');
  await p.locator('.app-theme-switcher').waitFor();
  assert.equal(await p.locator('html').evaluate(el => el.classList.contains('dark')), true);
  await p.locator('.app-theme-switcher').click();
  await p.waitForFunction(() => !document.documentElement.classList.contains('dark'));
  assert.equal(await p.evaluate(() => localStorage.getItem('theme')), 'light');
  await p.goto(origin + '/catalogue');
  await p.locator('h1').waitFor();
  assert.equal(await p.locator('.app-theme-switcher').getAttribute('aria-pressed'), 'true');
  await p.reload();
  await p.locator('.app-theme-switcher').waitFor();
  assert.equal(await p.locator('html').evaluate(el => getComputedStyle(el).getPropertyValue('--primary').trim()), '#cfad62');
  await p.locator('.app-theme-switcher').focus();
  await p.keyboard.press('Space');
  await p.waitForFunction(() => document.documentElement.classList.contains('dark'));
  assert.equal(await p.evaluate(() => localStorage.getItem('theme')), 'dark');
  step('theme toggles by mouse and keyboard, uses gold, and persists across navigation and reload');
  const trainingId = JSON.parse(fs.readFileSync(`${output}/course.json`, 'utf8')).trainingId;
  const routes = [[null, '/'], [null, '/catalogue'], [null, '/login'], ['learner', '/dashboard'], ['manager', '/entreprise?tab=conformite'], ['admin', '/admin'], ['author', `/maker/${trainingId}`]];
  for (const [role, route] of routes) {
    const screen = await page(role);
    for (const theme of ['light', 'dark']) {
      await screen.goto(origin + route);
      await screen.locator('.app-theme-switcher').waitFor();
      if (await screen.evaluate(() => document.documentElement.classList.contains('dark')) !== (theme === 'dark')) await screen.locator('.app-theme-switcher').click();
      for (const width of [1440, 390]) {
        await screen.setViewportSize({ width, height: 1000 });
        await screen.waitForTimeout(200);
        assert.equal(await screen.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${route} ${theme} ${width} overflows`);
        if (route === '/') { await screen.waitForFunction(() => !document.querySelector('.flight-copy .academy-button')?.disabled); await screen.waitForTimeout(1200); }
        await screen.screenshot({ path: `${output}/theme-${role || (route === '/' ? 'home' : route.slice(1))}-${theme}-${width}.png` });
      }
    }
    step(`${route} fits desktop and mobile in both themes`);
    await screen.close();
  }
  const ar = await page('manager');
  await ar.setViewportSize({ width: 390, height: 844 });
  await ar.goto(origin + '/entreprise');
  await ar.locator('.app-language-switcher button').filter({ hasText: 'AR' }).click();
  await ar.waitForFunction(() => document.documentElement.lang === 'ar');
  await ar.locator('.app-theme-switcher').click();
  assert.equal(await ar.locator('html').getAttribute('dir'), 'rtl');
  assert.equal(await ar.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await ar.screenshot({ path: `${output}/theme-ar-mobile.png` });
  step('theme control and layout work in Arabic RTL');
  const restricted = await browser.newContext();
  await restricted.addInitScript(() => { Storage.prototype.getItem = () => { throw new DOMException('Storage blocked', 'SecurityError'); }; Storage.prototype.setItem = () => { throw new DOMException('Storage blocked', 'SecurityError'); }; });
  const restrictedPage = await restricted.newPage();
  await restrictedPage.goto(origin + '/login');
  await restrictedPage.locator('.app-theme-switcher').click();
  await restrictedPage.waitForFunction(() => !document.documentElement.classList.contains('dark'));
  await restricted.close();
  step('theme switching remains usable when browser storage is blocked');
});
