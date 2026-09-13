import { expect, it, vi } from 'vitest';
import { createExamCountdown } from '../client/src/lib/examCountdown';

it('uses elapsed time from the server anchor despite changes to the local wall clock', () => {
  let elapsed = 200;
  const clock = vi.spyOn(Date, 'now').mockReturnValue(0);
  try {
    const remaining = createExamCountdown(1_060_000, 1_000_000, () => elapsed);
    expect(remaining()).toBe(60);
    clock.mockReturnValue(99_000_000);
    elapsed += 20_000;
    expect(remaining()).toBe(40);
    clock.mockReturnValue(-99_000_000);
    elapsed += 39_500;
    expect(remaining()).toBe(1);
    elapsed += 500;
    expect(remaining()).toBe(0);
    elapsed += 5_000;
    expect(remaining()).toBe(0);
  } finally { clock.mockRestore(); }
});

it('starts a resumed estimate from the newer server time and clamps expired sessions to zero', () => {
  expect(createExamCountdown(60_000, 45_000, () => 0)()).toBe(15);
  expect(createExamCountdown(60_000, 61_000, () => 0)()).toBe(0);
});
