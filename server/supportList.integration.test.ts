import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { getDb, getAdminTickets } from './db';
import { users, supportTickets } from '../drizzle/schema';

const url = process.env.RAERO_TEST_DATABASE_URL;
afterEach(() => vi.restoreAllMocks());
describe.skipIf(!url)('support administration list · PostgreSQL', () => {
  beforeAll(() => { process.env.DATABASE_URL = url!; });
  it('reads multiple authors in one query with stable ordering and only the intended identity fields', async () => {
    const db = (await getDb())!;
    const [named, unnamed] = await db.insert(users).values([
      {openId:randomUUID(),name:'Support list fixture',email:`${randomUUID()}@example.test`,passwordHash:'private-support-fixture'},
      {openId:randomUUID(),name:null,email:null,passwordHash:'other-private-support-fixture'},
    ]).returning();
    const marker = randomUUID();
    const older = new Date('2025-01-01T00:00:00Z');
    const newer = new Date('2025-01-02T00:00:00Z');
    const tickets = await db.insert(supportTickets).values([
      {userId:named.id,subject:marker+' Older',updatedAt:older},
      {userId:unnamed.id,subject:marker+' Newer first',updatedAt:newer,requestKind:'DATA_ACCESS'},
      {userId:named.id,subject:marker+' Newer second',updatedAt:newer,priority:'high'},
    ]).returning();
    const select = vi.spyOn(db,'select');
    const result = await getAdminTickets({search:marker});
    expect(select).toHaveBeenCalledTimes(1);
    const ids = new Set(tickets.map(ticket => ticket.id));
    const own = result.entries.filter(ticket => ids.has(ticket.id));
    expect(own).toEqual([
      {...tickets[2],userName:named.name,userEmail:named.email},
      {...tickets[1],userName:null,userEmail:null},
      {...tickets[0],userName:named.name,userEmail:named.email},
    ]);
    expect(JSON.stringify(own)).not.toContain('private-support-fixture');
    for (const row of own) {
      expect(row).not.toHaveProperty('passwordHash');
      expect(row).not.toHaveProperty('openId');
      expect(row).not.toHaveProperty('role');
    }
  });
  it('pages filtered results without duplicates after a new request and treats search symbols literally', async () => {
    const db = (await getDb())!;
    const marker = randomUUID();
    const [author] = await db.insert(users).values({openId:randomUUID(),name:marker+' Author',email:marker+'@example.test'}).returning();
    const tickets = await db.insert(supportTickets).values(Array.from({length:55},(_,i) => ({userId:author.id,subject:marker+' %_ '+i,status:'OPEN'}))).returning();
    await db.insert(supportTickets).values({userId:author.id,subject:marker+' nonmatching',status:'CLOSED'});
    const first = await getAdminTickets({status:'OPEN',search:'  '+marker.toUpperCase()+' %_  '});
    expect(first.entries).toHaveLength(50);
    expect(first.entries.map(t => t.id)).toEqual(tickets.slice(5).reverse().map(t => t.id));
    expect(first.nextBeforeId).toBe(first.entries[49].id);
    const [arrival] = await db.insert(supportTickets).values({userId:author.id,subject:marker+' %_ new',status:'OPEN'}).returning();
    const second = await getAdminTickets({status:'OPEN',search:marker+' %_',beforeId:first.nextBeforeId!});
    expect(second.entries.map(t => t.id)).toEqual(tickets.slice(0,5).reverse().map(t => t.id));
    expect(second.nextBeforeId).toBeNull();
    expect(second.entries.some(t => t.id === arrival.id)).toBe(false);
    expect(new Set([...first.entries,...second.entries].map(t => t.id)).size).toBe(55);
    expect((await getAdminTickets({status:'CLOSED',search:marker+' AUTHOR'})).entries).toHaveLength(1);
    expect((await getAdminTickets({status:'CLOSED',search:author.email!})).entries).toHaveLength(1);
    expect((await getAdminTickets({search:marker+' missing'})).entries).toEqual([]);
    for (const input of [{beforeId:0},{beforeId:1.5},{beforeId:2147483648},{status:'INVALID'},{search:'x'.repeat(256)},{unknown:true}]) {
      await expect(getAdminTickets(input)).rejects.toMatchObject({code:'BAD_REQUEST'});
    }
  });
});
