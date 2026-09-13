import {expect,it} from 'vitest';
import {addCalendarMonths} from '../shared/calendarMonths';
it.each([
  ['2026-01-31T23:59:59.123Z',1,'2026-02-28T23:59:59.123Z'],
  ['2024-01-31T12:00:00Z',1,'2024-02-29T12:00:00.000Z'],
  ['2024-02-29T12:00:00Z',12,'2025-02-28T12:00:00.000Z'],
  ['2026-12-31T12:00:00Z',2,'2027-02-28T12:00:00.000Z'],
  ['2026-03-31T12:00:00Z',-1,'2026-02-28T12:00:00.000Z'],
  ['2026-03-29T01:30:00Z',1,'2026-04-29T01:30:00.000Z'],
] as const)('adds %s + %s months without overflow', (source,months,expected)=>{
  const date=new Date(source),before=date.getTime();
  expect(addCalendarMonths(date,months).toISOString()).toBe(expected);
  expect(date.getTime()).toBe(before);
});
it('rejects invalid dates, fractional months and out-of-range results',()=>{
  for(const months of [NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER]) expect(()=>addCalendarMonths(new Date(),months)).toThrow(RangeError);
  expect(()=>addCalendarMonths(new Date('invalid'),1)).toThrow(RangeError);
});
