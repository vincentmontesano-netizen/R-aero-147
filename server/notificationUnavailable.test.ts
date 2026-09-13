import {afterEach,expect,it,vi} from 'vitest';
afterEach(()=>vi.unstubAllEnvs());
it('does not report empty notifications or successful read marks without a database',async()=>{
 vi.stubEnv('DATABASE_URL','');
 const db=await import('./db');expect(await db.getDb()).toBeNull();
 for(const read of [()=>db.getUserNotifications(1),()=>db.getUnreadNotificationCount(1),()=>db.markNotificationRead(1,1),()=>db.markAllNotificationsRead(1)])await expect(read()).rejects.toMatchObject({code:'INTERNAL_SERVER_ERROR'});
});
