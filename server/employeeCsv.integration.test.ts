import postgres from 'postgres';
import { beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { getDb, importEmployeesCSV } from './db';
import { affiliations, companies, employees, users } from '../drizzle/schema';
const url = process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('employee CSV · PostgreSQL', () => {
  beforeAll(() => { process.env.DATABASE_URL = url!; });
  it('stores decoded fields, rejects invalid emails, and writes nothing from syntactically broken documents', async () => {
    const db = (await getDb())!;
    const [company] = await db.insert(companies).values({name: 'CSV fixture'}).returning();
    const [user] = await db.insert(users).values({openId: randomUUID(), companyId: company.id}).returning();
    await db.insert(affiliations).values({personId: user.id, orgId: company.id, role: 'MANAGER'});
    const header = 'prenom;nom;email;fonction\n';
    const result = await importEmployeesCSV(user.id, header + 'Zoé;Test;zoe@example.com;"B1; B2"\nInvalid;Test;bad;Job', company.id);
    expect(result).toMatchObject({imported: 1, errors: [expect.stringContaining('Ligne 3')]});
    const read = () => db.select().from(employees).where(eq(employees.companyId, company.id));
    const rows = await read();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({firstName: 'Zoé', jobTitle: 'B1; B2'});
    const broken = await importEmployeesCSV(user.id, header + 'Valid;Test;new@example.com;Job\n"Broken', company.id);
    expect(broken).toMatchObject({imported: 0, errors: [expect.stringContaining('guillemets')]});
    expect(await read()).toEqual(rows);
  });
  it('pins the destination and refuses suspended actors, companies and revoked manager affiliations', async () => {
    const db = (await getDb())!;
    const [company, other] = await db.insert(companies).values([{name: 'CSV rights'}, {name: 'Other CSV'}]).returning();
    const [user] = await db.insert(users).values({openId: randomUUID(), companyId: company.id}).returning();
    const [aff] = await db.insert(affiliations).values({personId: user.id, orgId: company.id, role: 'MANAGER'}).returning();
    const csv = 'prenom;nom;email\nA;B;a@example.com';
    const run = () => importEmployeesCSV(user.id, csv, company.id);
    await db.update(users).set({companyId: other.id}).where(eq(users.id, user.id));
    await expect(run()).rejects.toMatchObject({code: 'CONFLICT'});
    await db.update(users).set({companyId: company.id, status: 'suspended'}).where(eq(users.id, user.id));
    await expect(run()).rejects.toMatchObject({code: 'FORBIDDEN'});
    await db.update(users).set({status: 'active'}).where(eq(users.id, user.id));
    await db.update(affiliations).set({status: 'INACTIVE'}).where(eq(affiliations.id, aff.id));
    await expect(run()).rejects.toMatchObject({code: 'FORBIDDEN'});
    await db.update(users).set({role: 'admin'}).where(eq(users.id, user.id));
    await db.update(companies).set({status: 'SUSPENDED'}).where(eq(companies.id, company.id));
    await expect(run()).rejects.toMatchObject({code: 'FORBIDDEN'});
    expect(await db.select().from(employees).where(eq(employees.companyId, company.id))).toHaveLength(0);
    expect(await db.select().from(employees).where(eq(employees.companyId, other.id))).toHaveLength(0);
    await db.update(companies).set({status: 'ACTIVE'}).where(eq(companies.id, company.id));
    expect(await run()).toMatchObject({imported: 1, errors: []});
  });
  it('recovers from a SQL row failure through a savepoint and keeps valid rows', async () => {
    const db = (await getDb())!;
    const [company] = await db.insert(companies).values({name: 'CSV savepoint'}).returning();
    const [user] = await db.insert(users).values({openId: randomUUID(), companyId: company.id, role: 'admin'}).returning();
    const name = `csv_row_failure_${company.id}`;
    await db.execute(sql.raw(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."companyId"=${company.id} AND NEW."firstName"='Fail' THEN RAISE EXCEPTION 'fixture failure'; END IF; RETURN NEW; END $$`));
    await db.execute(sql.raw(`CREATE TRIGGER ${name} BEFORE INSERT ON employees FOR EACH ROW EXECUTE FUNCTION ${name}()`));
    try {
      const result = await importEmployeesCSV(user.id, 'prenom;nom;email\nBefore;B;b@example.com\nFail;B;f@example.com\nAfter;B;a@example.com', company.id);
      expect(result).toMatchObject({imported: 2, errors: [expect.stringContaining('Ligne 3')]});
      expect((await db.select().from(employees).where(eq(employees.companyId, company.id)).orderBy(employees.id)).map(row => row.firstName)).toEqual(['Before', 'After']);
    } finally {
      await db.execute(sql.raw(`DROP TRIGGER ${name} ON employees`));
      await db.execute(sql.raw(`DROP FUNCTION ${name}()`));
    }
  });

  it('holds access rows until commit, then permits revocation and refuses the next import', async () => {
    const db = (await getDb())!;
    const [company] = await db.insert(companies).values({name: 'CSV concurrent rights'}).returning();
    const [user] = await db.insert(users).values({openId: randomUUID(), companyId: company.id}).returning();
    const [aff] = await db.insert(affiliations).values({personId: user.id, orgId: company.id, role: 'MANAGER'}).returning();
    const name = `csv_wait_${company.id}`;
    const control = postgres(url!, {max: 1});
    let pending: Promise<unknown> | undefined;
    await db.execute(sql.raw(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."companyId"=${company.id} THEN PERFORM pg_advisory_xact_lock(${company.id}, 229); END IF; RETURN NEW; END $$`));
    await db.execute(sql.raw(`CREATE TRIGGER ${name} BEFORE INSERT ON employees FOR EACH ROW EXECUTE FUNCTION ${name}()`));
    try {
      await control`SELECT pg_advisory_lock(${company.id}, 229)`;
      pending = importEmployeesCSV(user.id, 'prenom;nom;email\nA;B;a@example.com', company.id).then(value => ({value}), error => ({error}));
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const rows = await control`SELECT pid FROM pg_locks WHERE locktype='advisory' AND classid=${company.id}::oid AND objid=229::oid AND objsubid=2 AND NOT granted`;
        if (rows.length) { waiting = true; break; }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      expect(waiting, 'the import must reach its insert while retaining access locks').toBe(true);
      await control`SET lock_timeout='100ms'`;
      await expect(control`UPDATE users SET status='suspended' WHERE id=${user.id}`).rejects.toMatchObject({code: '55P03'});
      await expect(control`UPDATE companies SET status='SUSPENDED' WHERE id=${company.id}`).rejects.toMatchObject({code: '55P03'});
      await expect(control`UPDATE affiliations SET status='INACTIVE' WHERE id=${aff.id}`).rejects.toMatchObject({code: '55P03'});
      await control`SELECT pg_advisory_unlock(${company.id}, 229)`;
      expect(await pending).toEqual({value: {imported: 1, errors: []}});
      await control`UPDATE affiliations SET status='INACTIVE' WHERE id=${aff.id}`;
      await expect(importEmployeesCSV(user.id, 'prenom;nom;email\nC;D;c@example.com', company.id)).rejects.toMatchObject({code: 'FORBIDDEN'});
      expect(await db.select().from(employees).where(eq(employees.companyId, company.id))).toHaveLength(1);
    } finally {
      await control`SELECT pg_advisory_unlock_all()`;
      await pending;
      await db.execute(sql.raw(`DROP TRIGGER ${name} ON employees`));
      await db.execute(sql.raw(`DROP FUNCTION ${name}()`));
      await control.end();
    }
  }, 10000);

});
