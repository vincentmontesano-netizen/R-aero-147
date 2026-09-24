import { Mesh, ShaderChunk, type Object3D, type Material } from "three";

/** Hide manufacturer/model decals in the supplied atlas at render time.
 * Original licensed assets stay intact; all other instrument labels are preserved.
 * Rectangles use the glTF atlas UV convention (origin at the top left).
 */
export function neutralizeCockpitDecals(root: Object3D) {
  const masks: Record<string, string> = {
    m0mat: `
      if ((vMapUv.x > .152 && vMapUv.x < .227 && vMapUv.y > .674 && vMapUv.y < .695)
        || (vMapUv.x > .152 && vMapUv.x < .227 && vMapUv.y > .873 && vMapUv.y < .893))
        sampledDiffuseColor = texture2D(map, vec2(.19, .665));`,
    m0mat_004: `
      if (vMapUv.x > .670 && vMapUv.x < .696 && vMapUv.y > .340 && vMapUv.y < .393)
        sampledDiffuseColor = texture2D(map, vec2(.667, .362));`,
  };
  masks.m0mat_010 = masks.m0mat;
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      const mask = masks[material.name];
      if (!mask) continue;
      material.onBeforeCompile = (
        shader: Parameters<Material["onBeforeCompile"]>[0]
      ) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <map_fragment>",
          ShaderChunk.map_fragment.replace(
            "diffuseColor *= sampledDiffuseColor;",
            `${mask}\n diffuseColor *= sampledDiffuseColor;`
          )
        );
      };
      material.customProgramCacheKey = () => `neutral-decals-${material.name}`;
      material.needsUpdate = true;
    }
  });
}
