import assert from 'node:assert/strict';
import { simpleParser } from 'mailparser';
import { suite, origin, output, t } from './harness.mjs';

await suite('production-regressions', async ({ page, step }) => {
  const publicPage = await page();
  await publicPage.setViewportSize({ width: 320, height: 844 });
  for (const route of ['/about', '/devis']) {
    await publicPage.goto(origin + route);
    await publicPage.locator('h1').waitFor();
    await publicPage.evaluate(() => document.fonts.ready);
    const size = await publicPage.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
    assert.ok(size.document <= size.viewport, `${route}: ${JSON.stringify(size)}`);
    await publicPage.screenshot({ path: `${output}/regression-${route.slice(1)}-320.png`, fullPage: true });
    step(`${route} has no overflow at 320px`);
  }
  const emptyLinks = await publicPage.locator('a').evaluateAll(links => links.filter(link => {
    const visible = link.getClientRects().length && getComputedStyle(link).visibility !== 'hidden';
    return visible && !link.innerText.trim() && !link.getAttribute('aria-label') && !link.querySelector('[aria-label],img[alt]');
  }).map(link => link.outerHTML));
  assert.deepEqual(emptyLinks, []);
  step('mobile navigation has no visible unnamed links');

  const learner = await page('learner');
  await learner.goto(origin + '/dashboard');
  for (const key of ['filterSearchLabel', 'filterDateFrom', 'filterDateTo', 'filterStatusLabel']) {
    await learner.getByLabel(t[`dashboard.${key}`], { exact: true }).waitFor();
  }
  for (const progress of await learner.getByRole('progressbar').all()) assert.ok(await progress.getAttribute('aria-label'));
  step('learner filters and progress bars have accessible names');

  const admin = await page('admin');
  for (const [role, author] of [['admin', admin], ['instructor', await page('author')]]) {
    await author.setViewportSize({ width: 320, height: 844 });
    await author.goto(origin + '/maker');
    await author.getByRole('button', { name: t['maker.newCourse'], exact: true }).waitFor();
    await author.evaluate(() => document.fonts.ready);
    assert.ok(await author.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${role} maker header overflows at 320px`);
    step(`${role} maker header wraps language and account actions at 320px`);
  }
  await admin.setViewportSize({ width: 1440, height: 1000 });
  const payload = `<p>Message synthétique QA</p>
    <script>document.documentElement.dataset.qaInboxXss='script';parent.document.documentElement.dataset.qaInboxXss='script'</script>
    <img src="/qa-image-absente.png" onerror="document.documentElement.dataset.qaInboxXss='event';parent.document.documentElement.dataset.qaInboxXss='event'">
    <svg onload="document.documentElement.dataset.qaInboxXss='svg';parent.document.documentElement.dataset.qaInboxXss='svg'"></svg>
    <a href="javascript:document.documentElement.dataset.qaInboxXss='url'">Lien QA</a>`;
  const parsed = await simpleParser('From: fixture@example.test\r\nTo: admin@example.test\r\nSubject: QA HTML inbox\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n\r\n' + payload);
  assert.ok(parsed.html.includes('onerror'));
  await admin.route('**/api/trpc/**', async route => {
    const url = new URL(route.request().url());
    const names = url.pathname.split('/api/trpc/')[1].split(',');
    if (!names.some(name => name.startsWith('admin.inbox.'))) return route.continue();
    let original = [];
    if (names.some(name => !name.startsWith('admin.inbox.'))) original = await (await route.fetch()).json();
    const responses = names.map((name, i) => name === 'admin.inbox.list'
      ? { result: { data: { json: [{ uid: 9001, from: 'fixture@example.test', subject: 'QA HTML inbox', seen: false }] } } }
      : name === 'admin.inbox.message'
        ? { result: { data: { json: { html: parsed.html, text: parsed.text } } } } : original[i]);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(url.searchParams.has('batch') ? responses : responses[0]) });
  });
  await admin.goto(origin + '/admin?tab=emails');
  await admin.getByRole('button', { name: t['adminDashboard.emailTabInbox'], exact: true }).click();
  await admin.getByRole('button', { name: /QA HTML inbox/ }).click();
  const iframe = admin.locator('iframe[title="QA HTML inbox"]');
  await iframe.waitFor();
  assert.equal(await iframe.getAttribute('sandbox'), '');
  const frame = await (await iframe.elementHandle()).contentFrame();
  await frame.getByText('Message synthétique QA', { exact: true }).waitFor();
  await frame.getByRole('link', { name: 'Lien QA' }).click();
  assert.equal(await frame.evaluate(() => document.documentElement.dataset.qaInboxXss), undefined);
  assert.equal(await admin.evaluate(() => document.documentElement.dataset.qaInboxXss), undefined);
  await admin.screenshot({ path: `${output}/regression-inbox-isolated.png`, fullPage: true });
  step('HTML email renders in an isolated frame; script, event, SVG and javascript URL payloads cannot execute');
});
