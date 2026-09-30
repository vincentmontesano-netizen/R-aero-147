import { describe, expect, it } from "vitest";
import { sampleCockpitQuality } from "../client/src/lib/cockpitQuality";

describe("cockpit rendering resolution", () => {
  it("retains full resolution for normal frames and an isolated short stall", () => {
    let state = { pixelRatio: 1.5, slowFrames: 0 };
    for (const ms of [16, 20, 180, 16, 50, 90]) state = sampleCockpitQuality(state, ms);
    expect(state).toEqual({ pixelRatio: 1.5, slowFrames: 0 });
  });
  it("reduces the drawing buffer after two consecutive slow frames", () => {
    const first = sampleCockpitQuality({ pixelRatio: 1.5, slowFrames: 0 }, 200);
    expect(first.pixelRatio).toBe(1.5);
    expect(sampleCockpitQuality(first, 200)).toEqual({ pixelRatio: 0.75, slowFrames: 0 });
  });
  it("reacts immediately to a multi-second render instead of waiting through another one", () => {
    expect(sampleCockpitQuality({ pixelRatio: 1, slowFrames: 0 }, 6200))
      .toEqual({ pixelRatio: 0.25, slowFrames: 0 });
  });
  it("keeps a bounded buffer and never oscillates upward during the tour", () => {
    let state = { pixelRatio: 0.25, slowFrames: 0 };
    for (const ms of [4000, 6000, 10, 10, 16, 16]) state = sampleCockpitQuality(state, ms);
    expect(state.pixelRatio).toBe(0.25);
    expect(sampleCockpitQuality({ pixelRatio: 0.2, slowFrames: 0 }, 4000).pixelRatio).toBe(0.2);
  });
  it("ignores invalid timing samples", () => {
    for (const ms of [NaN, Infinity, -1, 0])
      expect(sampleCockpitQuality({ pixelRatio: 1, slowFrames: 1 }, ms))
        .toEqual({ pixelRatio: 1, slowFrames: 0 });
  });
});
