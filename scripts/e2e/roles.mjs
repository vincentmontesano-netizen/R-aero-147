import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { suite, origin, credentials, t } from './harness.mjs';

async function call(page, procedure, input, mutate = false) {
  return page.evaluate(async ({ procedure, input, mutate }) => {
    const response = await fetch('/api/trpc/' + procedure + (mutate ? '' : '?input=' + encodeURIComponent(JSON.stringify({ json: input }))), {
      method: mutate ? 'POST' : 'GET', headers: { 'content-type': 'application/json' },
      ...(mutate ? { body: JSON.stringify({ json: input }) } : {}),
    });
    const body = await response.json();
    return { status: response.status, data: body.result?.data?.json, error: body.error?.json?.data?.code };
  }, { procedure, input, mutate });
}
const success = result => { assert.equal(result.error, undefined, JSON.stringify(result)); return result.data; };

await suite('roles', async ({ page, step }) => {
  const admin = await page('admin'); await admin.goto(origin + '/admin');
  const learner = await page('learner'); await learner.goto(origin + '/dashboard');
  const instructor = await page('author'); await instructor.goto(origin + '/maker');
  const manager = await page('manager'); await manager.goto(origin + '/maker');
  const publicPage = await page(); await publicPage.goto(origin + '/login');
  assert.equal((await call(publicPage, 'maker.courses')).error, 'UNAUTHORIZED');
  for (const actor of [learner, instructor, manager]) assert.equal((await call(actor, 'admin.users')).error, 'FORBIDDEN');
  assert.equal((await call(learner, 'maker.courses')).error, 'FORBIDDEN');
  step('anonymous and learner cannot author; non-admin roles cannot list all users');

  const ownerCourse = success(await call(instructor, 'maker.courses'))[0];
  assert.equal((await call(manager, 'maker.slides', { trainingId: ownerCourse.id })).error, 'FORBIDDEN');
  step('company manager cannot read another instructor’s draft');

  const suffix = randomUUID();
  const legacy = success(await call(admin, 'admin.createUser', { email: `legacy-${suffix}@example.test`, name: 'QA role without affiliation', password: credentials.password, role: 'company_manager' }, true));
  const legacyPage = await page(); await legacyPage.goto(origin + '/login');
  await legacyPage.locator('#login-field-2').fill(legacy.email); await legacyPage.locator('#login-password').fill(credentials.password);
  await legacyPage.locator('form button[type=submit]').click(); await legacyPage.waitForURL(/\/(dashboard|entreprise)$/);
  assert.deepEqual(success(await call(legacyPage, 'maker.workspaces')), []);
  assert.equal((await call(legacyPage, 'maker.createCourse', { title: 'Forbidden', slug: suffix }, true)).error, 'PRECONDITION_FAILED');
  await legacyPage.goto(origin + '/maker'); await legacyPage.getByRole('heading', { name: '403', exact: true }).waitFor();
  step('company_manager without affiliation cannot create a course');

  const organization = success(await call(admin, 'admin.organizations.create', { name: `QA scoped organization ${suffix}` }, true));
  success(await call(admin, 'admin.organizations.addManager', { orgId: organization.id, email: legacy.email }, true));
  success(await call(admin, 'admin.setUserRole', { id: legacy.id, role: 'user' }, true));
  assert.equal(success(await call(legacyPage, 'company.get')).id, organization.id);
  assert.deepEqual(success(await call(legacyPage, 'company.employees')), []);
  await legacyPage.goto(origin + '/entreprise');
  await legacyPage.getByRole('heading', { name: organization.name, exact: true }).waitFor();
  step('MANAGER affiliation opens the company dashboard without a historical companyId');
  await legacyPage.goto(origin + '/maker');
  await legacyPage.reload();
  await legacyPage.getByRole('button', { name: t['maker.newCourse'], exact: true }).waitFor();
  assert.deepEqual(success(await call(legacyPage, 'maker.workspaces')).map(w => w.orgId), [organization.id]);
  await legacyPage.getByRole('button', { name: t['maker.newCourse'], exact: true }).click();
  const dialog = legacyPage.getByRole('dialog'); await dialog.locator('input').fill('QA formation interne par affiliation');
  const created = legacyPage.waitForResponse(r => r.url().includes('maker.createCourse') && r.request().method() === 'POST');
  await dialog.getByRole('button', { name: t['maker.create'], exact: true }).click();
  const response = await (await created).json(); const courseId = (Array.isArray(response) ? response[0] : response).result.data.json.trainingId;
  await dialog.waitFor({ state: 'hidden' });
  const course = success(await call(legacyPage, 'maker.courses')).find(c => c.id === courseId);
  assert.equal(course.ownerOrgId, organization.id);
  assert.equal((await call(instructor, 'maker.slides', { trainingId: courseId })).error, 'FORBIDDEN');
  assert.equal((await call(legacyPage, 'maker.publish', { id: courseId, isPublished: true }, true)).error, 'PRECONDITION_FAILED');
  step('active MANAGER with global user role creates an internal draft in the browser; foreign access and premature publication fail');

  success(await call(admin, 'admin.organizations.setStatus', { id: organization.id, status: 'SUSPENDED' }, true));
  assert.equal((await call(legacyPage, 'maker.slides', { trainingId: courseId })).error, 'FORBIDDEN');
  assert.deepEqual(success(await call(legacyPage, 'maker.workspaces')), []);
  success(await call(admin, 'admin.setUserStatus', { id: legacy.id, status: 'suspended' }, true));
  assert.equal((await call(legacyPage, 'maker.courses')).error, 'UNAUTHORIZED');
  step('organization suspension removes author access; user suspension invalidates the existing session');
});
