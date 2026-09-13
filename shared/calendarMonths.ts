/** Adds calendar months in UTC, clamping to the target month's last day. */
export function addCalendarMonths(date: Date, months: number): Date {
  if (!Number.isFinite(date.getTime()) || !Number.isSafeInteger(months)) throw new RangeError('Invalid calendar month input');
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(result);
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0);
  result.setUTCDate(Math.min(day, lastDay.getUTCDate()));
  if (!Number.isFinite(result.getTime())) throw new RangeError('Calendar date out of range');
  return result;
}
