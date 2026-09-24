import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  cockpitViews,
  cockpitJourney,
  cockpitViewAtProgress,
} from "./cockpitCamera";

import { neutralizeCockpitDecals } from "./cockpitMaterials";

type Pose = {
  position: readonly number[];
  target: readonly number[];
  fov: number;
};
export function mountCockpit(
  host: HTMLDivElement,
  callbacks: {
    ready: () => void;
    progress: (value: number) => void;
    error: () => void;
  }
) {
  let disposed = false,
    failed = false,
    visible = true,
    invalidated = true;
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.004, 100);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.55;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xcce6ff, 0x41434e, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 6, -3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x53c8ff, 1.8);
  rim.position.set(-5, 2, 4);
  scene.add(rim);
  const loader = new GLTFLoader();
  const decoder = new DRACOLoader();
  decoder.setDecoderPath("/models/draco/");
  decoder.setWorkerLimit(2);
  loader.setDRACOLoader(decoder);
  let model: THREE.Group | undefined;
  const resources = (root: THREE.Object3D) => {
    const geometries = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>(),
      textures = new Set<THREE.Texture>();
    root.traverse(object => {
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          materials.add(material);
          for (const value of Object.values(material))
            if (value instanceof THREE.Texture) textures.add(value);
        }
      }
    });
    textures.forEach(texture => {
      const image = texture.source.data;
      texture.dispose();
      if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap)
        image.close();
    });
    materials.forEach(material => material.dispose());
    geometries.forEach(geometry => geometry.dispose());
  };
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = motion.matches;
  const wantedPosition = new THREE.Vector3(),
    wantedTarget = new THREE.Vector3(),
    currentTarget = new THREE.Vector3();
  let wantedFov = 45;
  const setPose = (pose: Pose, immediate = false) => {
    wantedPosition.fromArray(pose.position);
    wantedTarget.fromArray(pose.target);
    wantedFov = pose.fov;
    if (immediate || reduced) {
      camera.position.copy(wantedPosition);
      currentTarget.copy(wantedTarget);
      camera.fov = wantedFov;
    }
    invalidated = true;
  };
  setPose(cockpitViews[0], true);
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    invalidated = true;
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  let previousTime = 0;
  const draw = (time: number) => {
    const delta = previousTime
      ? Math.min((time - previousTime) / 1000, 0.05)
      : 0.016;
    previousTime = time;
    const moving =
      camera.position.distanceToSquared(wantedPosition) > 0.00000001 ||
      currentTarget.distanceToSquared(wantedTarget) > 0.00000001 ||
      Math.abs(camera.fov - wantedFov) > 0.01;
    if (!moving && !invalidated) return;
    const damping = reduced ? 1 : 1 - Math.exp(-delta * 5);
    camera.position.lerp(wantedPosition, damping);
    currentTarget.lerp(wantedTarget, damping);
    camera.fov = THREE.MathUtils.lerp(camera.fov, wantedFov, damping);
    camera.lookAt(currentTarget);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    invalidated = false;
  };
  const sync = () => {
    previousTime = 0;
    renderer.setAnimationLoop(
      visible && !document.hidden && !failed ? draw : null
    );
  };
  const intersection = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    sync();
  });
  intersection.observe(host);
  document.addEventListener("visibilitychange", sync);
  const onMotion = () => {
    reduced = motion.matches;
    invalidated = true;
  };
  motion.addEventListener("change", onMotion);
  const lost = (event: Event) => {
    event.preventDefault();
    failed = true;
    renderer.setAnimationLoop(null);
    callbacks.error();
  };
  renderer.domElement.addEventListener("webglcontextlost", lost);
  loader.load(
    "/models/a320/cockpit.glb",
    gltf => {
      if (disposed) {
        resources(gltf.scene);
        return;
      }
      model = gltf.scene;
      neutralizeCockpitDecals(model);
      scene.add(model);
      invalidated = true;
      callbacks.ready();
    },
    progress => {
      if (!disposed && progress.total)
        callbacks.progress(
          Math.round((progress.loaded / progress.total) * 100)
        );
    },
    () => {
      if (!disposed) callbacks.error();
    }
  );
  sync();
  return {
    travel(progress: number) {
      const p = THREE.MathUtils.clamp(progress, 0, 1);
      if (reduced) {
        setPose(cockpitViews[cockpitViewAtProgress(p)], true);
        return;
      }
      const endIndex = cockpitJourney.findIndex(stop => stop.at >= p);
      const end = cockpitJourney[Math.max(1, endIndex)];
      const start = cockpitJourney[Math.max(0, endIndex - 1)];
      const local = (p - start.at) / (end.at - start.at);
      const t = local * local * (3 - 2 * local);
      wantedPosition
        .fromArray(start.pose.position)
        .lerp(new THREE.Vector3(...end.pose.position), t);
      wantedTarget
        .fromArray(start.pose.target)
        .lerp(new THREE.Vector3(...end.pose.target), t);
      wantedFov = THREE.MathUtils.lerp(start.pose.fov, end.pose.fov, t);
      invalidated = true;
    },
    isSettled() {
      return (
        camera.position.distanceToSquared(wantedPosition) < 0.000001 &&
        currentTarget.distanceToSquared(wantedTarget) < 0.000001 &&
        Math.abs(camera.fov - wantedFov) < 0.02
      );
    },
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", onMotion);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      if (model) resources(model);
      environment.dispose();
      decoder.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
