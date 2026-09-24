import { describe, expect, it } from "vitest";
import { Box3, Vector3 } from "three";
import { cockpitViews } from "../client/src/lib/cockpitCamera";

describe("cockpit seat clearance", () => {
  it("keeps views 02–04 and their damped transitions clear of the left headrest", () => {
    // World-space bounds measured from the headrest component of Object_55
    // in public/models/a320/cockpit.glb, rounded outward.
    const headrest = new Box3(
      new Vector3(-0.171, 0.144, 0.684),
      new Vector3(-0.082, 0.202, 0.729)
    );
    const [post, instruments, console] = cockpitViews
      .slice(1, 4)
      .map(pose => new Vector3(...pose.position));
    // The whole triangle covers both segments and any corner-cutting from
    // exponential damping, including a direction reversal between views.
    for (let a = 0; a <= 100; a++) {
      for (let b = 0; b <= 100 - a; b++) {
        const position = post.clone().multiplyScalar(a / 100)
          .addScaledVector(instruments, b / 100)
          .addScaledVector(console, (100 - a - b) / 100);
        expect(headrest.distanceToPoint(position)).toBeGreaterThan(0.05);
      }
    }
  });
});
