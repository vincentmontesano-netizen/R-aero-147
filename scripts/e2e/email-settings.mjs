import assert from 'node:assert/strict';
import { suite, origin, output, t } from './harness.mjs';

await suite('email-settings', async ({ page, step }) => {
  const admin = await page('admin');
  await admin.goto(origin + '/admin?tab=emails');
  const provider = admin.getByLabel(t['adminDashboard.emailProvider'], { exact: true });
  await provider.waitFor();
  const card = admin.locator('div.rounded-xl').filter({ has: provider });
  const save = card.getByRole('button', { name: t['adminDashboard.btnSaveSetting'], exact: true });
  const readSettings = () => admin.evaluate(async () => {
    const response = await fetch('/api/trpc/admin.settings.get?input=' + encodeURIComponent(JSON.stringify({ json: null })));
    return (await response.json()).result.data.json;
  });
  const initial = await readSettings();
  assert.equal(initial.emailTransport.provider, 'smtp');
  assert.equal(initial.emailTransport.tokenSet, false);
  const saveDraft = async () => {
    const response = admin.waitForResponse(r => r.url().includes('admin.settings.setEmailTransport') && r.request().method() === 'POST');
    await save.click();
    assert.equal((await response).ok(), true);
    await card.getByRole('button', { name: t['adminDashboard.btnSaveSetting'], exact: true }).waitFor();
  };
  try {
    await provider.selectOption('hostinger');
    const token = admin.getByLabel(t['adminDashboard.hostingerToken'], { exact: true });
    assert.equal(await token.getAttribute('type'), 'password');
    await admin.getByLabel(t['adminDashboard.hostingerMailbox'], { exact: true }).fill('ACbrowserfixture');
    await admin.getByLabel(t['adminDashboard.hostingerAddress'], { exact: true }).fill('mailbox@example.test');
    await token.fill('synthetic-browser-token');
    await saveDraft();
    let settings = await readSettings();
    assert.equal(settings.emailTransport.tokenSet, true);
    assert.equal(settings.smtp.configured, true);
    assert.equal(settings.imap.configured, true);
    assert.equal(JSON.stringify(settings).includes('synthetic-browser-token'), false);
    await admin.reload(); await token.waitFor();
    assert.equal(await token.inputValue(), '');
    assert.equal(await provider.inputValue(), 'hostinger');
    await saveDraft(); settings = await readSettings();
    assert.equal(settings.emailTransport.tokenSet, true);
    step('admin saves Hostinger settings, receives no token, and preserves a blank token after reload');

    for (const width of [320, 390, 768, 1280]) {
      await admin.setViewportSize({ width, height: 900 });
      // Desktop navigation animates from its previous width when crossing md.
      // Inspect the final layout after the actual transition, not an arbitrary sleep.
      await admin.locator('aside').evaluate(async element => {
        getComputedStyle(element).width;
        await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {})));
      });
      for (const field of [provider, token, admin.locator('#hostinger-mailbox'), admin.locator('#hostinger-address')]) {
        const box = await field.boundingBox();
        assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1, `Email field outside ${width}px viewport`);
      }
      assert.ok(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      step(`Hostinger settings usable at ${width}px`);
    }
    await admin.screenshot({ path: `${output}/email-settings.png`, fullPage: true });
    await admin.getByLabel(t['adminDashboard.hostingerClearToken'], { exact: true }).check();
    await saveDraft();
    await admin.reload(); await token.waitFor();
    settings = await readSettings();
    assert.equal(settings.emailTransport.tokenSet, false);
    assert.equal(settings.smtp.configured, false);
    assert.equal(settings.imap.configured, false);
    step('explicit token removal persists and disables both sending and inbox access');
  } finally {
    const restored = await admin.evaluate(async initial => {
      const response = await fetch('/api/trpc/admin.settings.setEmailTransport', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: { provider: initial.provider, mailboxId: initial.mailboxId, mailboxEmail: initial.mailboxEmail, token: '', clearToken: true } }),
      });
      return response.ok;
    }, initial.emailTransport);
    assert.equal(restored, true);
  }
  assert.equal((await readSettings()).emailTransport.provider, 'smtp');
  step('isolated configuration restored; no email sent');
});
