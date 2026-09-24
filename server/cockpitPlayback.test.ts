import { describe, expect, it } from "vitest";
import {
  advanceCockpitPlayback,
  initialCockpitPlayback,
} from "../client/src/lib/cockpitPlayback";
import { cockpitViewAtProgress } from "../client/src/lib/cockpitCamera";

describe("cockpit scroll release", () => {
  it("visits all five views after a large scroll and only releases after the final camera settles and holds", () => {
    let state = initialCockpitPlayback();
    const visited = new Set<number>();
    for (let i = 0; i < 400; i++) {
      state = advanceCockpitPlayback(state, 1, 1 / 60, false, false);
      visited.add(cockpitViewAtProgress(state.progress));
      expect(state.released).toBe(false);
    }
    expect([...visited]).toEqual([0, 1, 2, 3, 4]);
    expect(state.progress).toBe(1);
    for (let i = 0; i < 40; i++)
      state = advanceCockpitPlayback(state, 1, 1 / 60, true, false);
    expect(state.released).toBe(false);
    for (let i = 0; i < 10; i++)
      state = advanceCockpitPlayback(state, 1, 1 / 60, true, false);
    expect(state.released).toBe(true);
  });
  it("cannot skip the tour after a background-tab delay or release on an unfinished view", () => {
    const state = advanceCockpitPlayback(
      initialCockpitPlayback(),
      1,
      20,
      true,
      false
    );
    expect(state.progress).toBeCloseTo(0.01);
    expect(state.released).toBe(false);
    let final = { progress: 1, finalHold: 0.6, released: false };
    final = advanceCockpitPlayback(final, 0.5, 0.05, true, false);
    expect(final.finalHold).toBe(0);
    expect(final.released).toBe(false);
  });
  it("supports reduced motion immediately without removing the final reading pause", () => {
    let state = advanceCockpitPlayback(
      initialCockpitPlayback(),
      1,
      0.05,
      true,
      true
    );
    expect(state.progress).toBe(1);
    expect(state.released).toBe(false);
    for (let i = 0; i < 17; i++)
      state = advanceCockpitPlayback(state, 1, 0.05, true, true);
    expect(state.released).toBe(true);
  });
});
