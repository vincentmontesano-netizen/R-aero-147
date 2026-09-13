/** Display estimate anchored to the server response; grading still uses server time. */
export function createExamCountdown(deadline: number, serverNow: number, monotonicNow: () => number = () => performance.now()) {
  const receivedAt = monotonicNow();
  return () => Math.max(0, Math.ceil((deadline - serverNow - Math.max(0, monotonicNow() - receivedAt)) / 1000));
}
