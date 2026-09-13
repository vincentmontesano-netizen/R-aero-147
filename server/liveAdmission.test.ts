import {describe,it,expect} from 'vitest';
import {liveAdmission} from './liveAdmission';
describe('live admission boundaries',()=>{
 it('uses inclusive opening and exclusive closing for both roles',()=>{
  const start=new Date('2026-09-13T12:00:00Z'),end=new Date('2026-09-13T13:00:00Z');
  for(const moderator of [false,true]){
   const opens=start.getTime()-(moderator?30:15)*60000,closes=end.getTime()+15*60000;
   expect(liveAdmission(start,end,'scheduled',moderator,opens-1).state).toBe('early');
   expect(liveAdmission(start,end,'scheduled',moderator,opens).state).toBe('open');
   expect(liveAdmission(start,end,'live',moderator,closes-1).state).toBe('open');
   expect(liveAdmission(start,end,'live',moderator,closes).state).toBe('closed');
   expect(liveAdmission(start,end,'completed',moderator,opens).state).toBe('closed');
   expect(liveAdmission(start,end,'cancelled',moderator,opens).state).toBe('closed');
  }
 });
});
