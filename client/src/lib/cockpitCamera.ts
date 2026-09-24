/** Coordinates in the supplied aircraft model, preserved by asset optimisation. */
export const cockpitViews = [
  { position: [6, 2.8, -6.5], target: [0, 0, 3.2], fov: 45 },
  { position: [0, 0.2, 0.8], target: [0, 0.07, 0.05], fov: 70 },
  // Stay in the aisle, in front of the headrests. Aim left at the instruments
  // instead of moving the camera through the captain's seat.
  { position: [-0.025, 0.2, 0.67], target: [-0.14, 0.07, 0.43], fov: 62 },
  { position: [0, 0.23, 0.77], target: [0, -0.045, 0.5], fov: 58 },
  { position: [0, 0.12, 0.85], target: [0, 0.36, 0.59], fov: 68 },
] as const;
/** Approach the glazing before moving inside, avoiding a flight through the cabin door. */
export const cockpitApproach = {
  position: [0.25, 0.38, -0.4],
  target: [0, 0.16, 0.68],
  fov: 55,
} as const;

export const cockpitEntryProgress = 0.36;
export const cockpitJourney = [
  { at: 0, pose: cockpitViews[0] },
  { at: 0.18, pose: cockpitApproach },
  { at: cockpitEntryProgress, pose: cockpitViews[1] },
  { at: 0.5, pose: cockpitViews[1] },
  { at: 0.62, pose: cockpitViews[2] },
  { at: 0.7, pose: cockpitViews[2] },
  { at: 0.8, pose: cockpitViews[3] },
  { at: 0.88, pose: cockpitViews[3] },
  { at: 0.96, pose: cockpitViews[4] },
  { at: 1, pose: cockpitViews[4] },
] as const;
export function cockpitViewAtProgress(p: number) {
  return p < 0.3 ? 0 : p < 0.56 ? 1 : p < 0.75 ? 2 : p < 0.92 ? 3 : 4;
}
