export type CockpitQuality = { pixelRatio: number; slowFrames: number };

/** Reduce only the drawing buffer when visible rendering cannot keep up.
 * A single short stall is ignored. Never alter CSS size, geometry or camera poses.
 */
export function sampleCockpitQuality(
  state: CockpitQuality,
  frameMs: number
): CockpitQuality {
  if (!Number.isFinite(frameMs) || frameMs <= 100)
    return { ...state, slowFrames: 0 };
  const slowFrames = state.slowFrames + 1;
  if (slowFrames < 2 && frameMs < 1000) return { ...state, slowFrames };
  return {
    pixelRatio: Math.min(state.pixelRatio, Math.max(0.25, state.pixelRatio * Math.sqrt(50 / frameMs))),
    slowFrames: 0,
  };
}
