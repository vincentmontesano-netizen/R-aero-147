/** Scroll requests a position; playback cannot race past the final settled view. */
export type CockpitPlayback = {
  progress: number;
  finalHold: number;
  released: boolean;
};
export const initialCockpitPlayback = (): CockpitPlayback => ({
  progress: 0,
  finalHold: 0,
  released: false,
});
export function advanceCockpitPlayback(
  state: CockpitPlayback,
  target: number,
  elapsed: number,
  settled: boolean,
  reducedMotion: boolean
): CockpitPlayback {
  const dt = Math.max(0, Math.min(elapsed, 0.05)); // Background tabs must not skip the tour.
  const requested = Math.max(0, Math.min(1, target));
  const step = dt * 0.2;
  const difference = requested - state.progress;
  const progress =
    reducedMotion || Math.abs(difference) <= step
      ? requested
      : state.progress + Math.sign(difference) * step;
  const finalHold =
    progress === 1 && state.progress === 1 && settled
      ? state.finalHold + dt
      : 0;
  return { progress, finalHold, released: state.released || finalHold >= 0.8 };
}
