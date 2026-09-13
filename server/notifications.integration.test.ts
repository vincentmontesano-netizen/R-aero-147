import {beforeAll,describe,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {eq} from 'drizzle-orm';
import {getDb,getUserNotifications,getUnreadNotificationCount,markNotificationRead,markAllNotificationsRead} from './db';
import {users,notifications} from '../drizzle/schema';
const url=process.env.RAERO_TEST_DATABASE_URL;
describe.skipIf(!url)('notification listing and counts',()=>{
 beforeAll(()=>{process.env.DATABASE_URL=url!;});
 it('counts all own unread records, lists deterministic newest fifty and scopes read marks',async()=>{
  const db=(await getDb())!;
  const [owner,other]=await db.insert(users).values([{openId:randomUUID()},{openId:randomUUID()}]).returning();
  const createdAt=new Date();
  const rows=await db.insert(notifications).values(Array.from({length:61},(_,i)=>({userId:owner.id,type:'support',title:'Count fixture',isRead:i===60,createdAt}))).returning();
  const [foreign]=await db.insert(notifications).values({userId:other.id,type:'support',title:'Foreign notification'}).returning();
  expect((await getUserNotifications(owner.id)).map(row=>row.id)).toEqual(rows.map(row=>row.id).reverse().slice(0,50));
  expect(await getUnreadNotificationCount(owner.id)).toBe(60);
  await markNotificationRead(foreign.id,owner.id);
  expect(await getUnreadNotificationCount(other.id)).toBe(1);
  await markNotificationRead(rows[0].id,owner.id);await markNotificationRead(rows[0].id,owner.id);
  expect(await getUnreadNotificationCount(owner.id)).toBe(59);
  await markAllNotificationsRead(owner.id);expect(await getUnreadNotificationCount(owner.id)).toBe(0);
  expect((await db.select().from(notifications).where(eq(notifications.id,foreign.id)))[0].isRead).toBe(false);
 });
});
