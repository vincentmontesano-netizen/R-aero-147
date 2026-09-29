import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { suite, origin, output, credentials, t } from './harness.mjs';

async function call(page, procedure, input, mutation = false) {
  return page.evaluate(async ({ procedure, input, mutation }) => {
    const response = await fetch('/api/trpc/' + procedure + (mutation ? '' : '?input=' + encodeURIComponent(JSON.stringify({ json: input }))), {
      method: mutation ? 'POST' : 'GET', headers: { 'content-type': 'application/json' },
      ...(mutation ? { body: JSON.stringify({ json: input }) } : {}),
    });
    const body = await response.json();
    return { status: response.status, data: body.result?.data?.json, error: body.error?.json?.data?.code };
  }, { procedure, input, mutation });
}
const ok = result => { assert.equal(result.error, undefined, JSON.stringify(result)); return result.data; };

await suite('company-scope', async ({ page, step }) => {
  const admin = await page('admin'); await admin.goto(origin + '/admin');
  const suffix = randomUUID();
  const actor = ok(await call(admin, 'admin.createUser', { email: `scope-${suffix}@example.test`, name: 'QA multi-organisation', password: credentials.password, role: 'user' }, true));
  const companies = [];
  for (const name of ['Alpha', 'Bravo', 'Interdite']) {
    const company = ok(await call(admin, 'admin.organizations.create', { name: `QA ${name} ${suffix}` }, true));
    if (name !== 'Interdite') ok(await call(admin, 'admin.organizations.addManager', { orgId: company.id, email: actor.email }, true));
    companies.push(company);
  }
  const [a, b, foreign] = companies;
  const p = await page(), otherTab = await page();
  for (const tab of [p, otherTab]) {
    await tab.goto(origin + '/login');
    ok(await call(tab, 'auth.login', { email: actor.email, password: credentials.password }, true));
    await tab.goto(origin + '/entreprise');
    await tab.getByLabel(t['companyDashboard.selectOrganization'], { exact: true }).waitFor();
    assert.equal(await tab.getByLabel(t['companyDashboard.selectOrganization'], { exact: true }).inputValue(), '');
  }
  step('multiple MANAGER affiliations require an explicit choice when no primary organization exists');
  await p.getByLabel(t['companyDashboard.selectOrganization'], { exact: true }).selectOption(String(a.id));
  await otherTab.getByLabel(t['companyDashboard.selectOrganization'], { exact: true }).selectOption(String(b.id));
  for (const [tab, company, name] of [[p, a, 'EmployeAlpha'], [otherTab, b, 'EmployeBravo']]) {
    await tab.getByRole('heading', { name: company.name, exact: true }).waitFor();
    await tab.getByRole('button', { name: t['companyDashboard.addEmployee'], exact: true }).click();
    const dialog = tab.getByRole('dialog');
    await dialog.getByPlaceholder('Jean', { exact: true }).fill(name);
    await dialog.getByPlaceholder('Dupont', { exact: true }).fill('Recette');
    await dialog.getByPlaceholder('jean.dupont@mro.com', { exact: true }).fill(`${name}-${suffix}@example.test`);
    await dialog.getByRole('button', { name: t['companyDashboard.add'], exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await tab.getByText(name, { exact: false }).first().waitFor();
  }
  await p.reload();
  await p.getByRole('heading', { name: a.name, exact: true }).waitFor();
  assert.equal(await p.getByText('EmployeBravo', { exact: false }).count(), 0);
  assert.equal(await otherTab.getByText('EmployeAlpha', { exact: false }).count(), 0);
  const actorAfter = ok(await call(admin, 'admin.users')).find(u => u.id === actor.id);
  assert.equal(actorAfter.companyId, null);
  step('two sessions of the same account create and read separate rosters without changing companyId');
  await otherTab.getByRole('button', { name: t['companyDashboard.importCsv'], exact: true }).click();
  const csvDialog = otherTab.getByRole('dialog');
  await csvDialog.locator('input[type=file]').setInputFiles({ name: 'scoped-roster.csv', mimeType: 'text/csv', buffer: Buffer.from(`prenom;nom;email\nImportedBravo;Recette;import-${suffix}@example.test\n`) });
  await csvDialog.getByRole('button', { name: t['companyDashboard.csvStartImport'], exact: true }).click();
  await csvDialog.getByText('1 employé(s) importé(s) avec succès', { exact: true }).waitFor();
  await csvDialog.getByRole('button', { name: t['companyDashboard.close'], exact: true }).click();
  await otherTab.getByText('ImportedBravo', { exact: false }).first().waitFor();
  assert.equal(ok(await call(p, 'companyWorkspace.employees', { orgId: a.id })).length, 1);
  step('CSV import writes only to the explicitly selected organization');
  const employeeA = ok(await call(p, 'companyWorkspace.employees', { orgId: a.id }))[0];
  assert.equal((await call(p, 'companyWorkspace.updateEmployee', { orgId: b.id, id: employeeA.id, firstName: 'Wrong scope' }, true)).error, 'FORBIDDEN');
  assert.equal((await call(p, 'companyWorkspace.technicianFile', { orgId: b.id, employeeId: employeeA.id })).error, 'FORBIDDEN');
  ok(await call(p, 'companyWorkspace.addAffiliate', { orgId: b.id, email: credentials.learnerEmail, role: 'MEMBER' }, true));
  assert.ok(ok(await call(p, 'companyWorkspace.affiliates', { orgId: b.id })).some(m => m.email === credentials.learnerEmail));
  assert.ok(!ok(await call(p, 'companyWorkspace.affiliates', { orgId: a.id })).some(m => m.email === credentials.learnerEmail));
  step('mutations and affiliations honor the selected organization; cross-scope employee access is refused');
  await p.getByLabel(t['companyDashboard.selectOrganization'], { exact: true }).selectOption(String(b.id));
  await p.getByRole('heading', { name: b.name, exact: true }).waitFor();
  await p.getByText('EmployeBravo', { exact: false }).first().waitFor();
  assert.equal(await p.getByText('EmployeAlpha', { exact: false }).count(), 0);
  await p.goBack();
  await p.getByRole('heading', { name: a.name, exact: true }).waitFor();
  await p.setViewportSize({ width: 390, height: 844 });
  const dimensions = await p.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  assert.ok(dimensions.document <= dimensions.viewport, JSON.stringify(dimensions));
  await p.screenshot({ path: `${output}/company-scope-mobile.png`, fullPage: true });
  step('switching, browser back and refresh preserve the selected organization without stale roster data');
  const rollback = await page();
  await rollback.goto(origin + '/login');
  ok(await call(rollback, 'auth.login', { email: actor.email, password: credentials.password }, true));
  await rollback.route('**/api/trpc/**', async route => {
    const names = new URL(route.request().url()).pathname.split('/api/trpc/')[1].split(',');
    if (!names.some(name => name.startsWith('companyWorkspace.'))) return route.continue();
    const original = await (await route.fetch()).json();
    const rows = Array.isArray(original) ? original : [original];
    const unavailable = { error: { json: { message: 'No procedure found on legacy server', code: -32004, data: { code: 'NOT_FOUND', httpStatus: 404 } } } };
    const result = rows.map((row, i) => names[i].startsWith('companyWorkspace.') ? unavailable : row);
    await route.fulfill({ status: names.length > 1 ? 207 : 404, contentType: 'application/json', body: JSON.stringify(Array.isArray(original) ? result : result[0]) });
  });
  await rollback.goto(origin + '/entreprise?orgId=' + a.id);
  await rollback.getByText(t['companyDashboard.scopeUnavailable'], { exact: true }).waitFor();
  assert.equal(await rollback.getByRole('button', { name: t['companyDashboard.addEmployee'], exact: true }).count(), 0);
  await rollback.close();
  step('an older server without the scoped API shows a reload message and exposes no company mutation controls');
  await p.goto(origin + '/entreprise?orgId=' + foreign.id);
  await p.getByText(t['companyDashboard.organizationUnavailable'], { exact: true }).waitFor();
  assert.equal((await call(p, 'companyWorkspace.get', { orgId: foreign.id })).error, 'FORBIDDEN');
  ok(await call(admin, 'admin.organizations.setStatus', { id: b.id, status: 'SUSPENDED' }, true));
  await otherTab.reload();
  await otherTab.getByText(t['companyDashboard.organizationUnavailable'], { exact: true }).waitFor();
  assert.equal((await call(otherTab, 'companyWorkspace.createEmployee', { orgId: b.id, firstName: 'Suspended', lastName: 'Blocked', email: `blocked-${suffix}@example.test` }, true)).error, 'FORBIDDEN');
  assert.equal(ok(await call(otherTab, 'companyWorkspace.get', { orgId: a.id })).id, a.id);
  step('foreign and suspended organizations are unavailable while authorized organizations remain usable');
});
