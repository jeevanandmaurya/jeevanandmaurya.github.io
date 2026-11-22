// Physics worker for the demo. Loads either the official single-threaded SIMD build or the
// multi-threaded build from jsDelivr, builds a scene, and streams collider transforms back.
import { buildWorld } from "./build-world.js";

const CDN = {
  threads: "https://cdn.jsdelivr.net/npm/@jeevanand/rapier3d-threads@0.21.0/rapier.js",
  official: "https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-simd-compat@0.21.0/dist/rapier.mjs",
};

let R, world, dynamicColliders = [];

async function loadEngine(engine, threads) {
  const RAPIER = (await import(CDN[engine])).default;
  await (engine === "threads" ? RAPIER.init({ threads }) : RAPIER.init());
  return RAPIER;
}

// Upstream testbed demos call testbed.setWorld()/lookAt(); this is all they need.
async function buildDemo(RAPIER, id) {
  const [kind, name] = id.split(":");
  if (kind === "scene") {
    const scene = await (await fetch(`scenes/${name}.json`)).json();
    return { world: buildWorld(RAPIER, scene).world, camera: null };
  }
  const mod = await import(`./demos/${name}.js`);
  let w, camera;
  mod.initWorld(RAPIER, { setWorld: (x) => (w = x), lookAt: (c) => (camera = c), setpreTimestepAction() {}, parameters: {} });
  return { world: w, camera };
}

function describe(RAPIER, world) {
  const T = RAPIER.ShapeType, shapes = [];
  dynamicColliders = [];
  world.forEachCollider((c) => {
    const body = c.parent();
    const dynamic = !!body && !body.isFixed();
    const t = c.shapeType();
    let s = null;
    if (t === T.Cuboid || t === T.RoundCuboid) { const h = c.halfExtents(); s = { kind: "cuboid", d: [h.x, h.y, h.z] }; }
    else if (t === T.Ball) s = { kind: "ball", d: [c.radius()] };
    else if (t === T.Capsule) s = { kind: "capsule", d: [c.halfHeight(), c.radius()] };
    else if (t === T.Cylinder || t === T.RoundCylinder) s = { kind: "cylinder", d: [c.halfHeight(), c.radius()] };
    else if (t === T.Cone || t === T.RoundCone) s = { kind: "cone", d: [c.halfHeight(), c.radius()] };
    else if (t === T.TriMesh) s = { kind: "trimesh", v: Array.from(c.vertices()), i: Array.from(c.indices()) };
    if (!s) return;
    const p = c.translation(), q = c.rotation();
    s.pose = [p.x, p.y, p.z, q.x, q.y, q.z, q.w];
    s.dynamic = dynamic;
    if (dynamic) { s.slot = dynamicColliders.length; dynamicColliders.push(c); }
    shapes.push(s);
  });
  return shapes;
}

function poses() {
  const buf = new Float32Array(dynamicColliders.length * 8);
  for (let i = 0; i < dynamicColliders.length; i++) {
    const c = dynamicColliders[i], p = c.translation(), q = c.rotation(), o = i * 8;
    buf[o] = p.x; buf[o + 1] = p.y; buf[o + 2] = p.z; buf[o + 3] = q.x; buf[o + 4] = q.y; buf[o + 5] = q.z; buf[o + 6] = q.w;
    buf[o + 7] = c.parent().isSleeping() ? 1 : 0;
  }
  return buf;
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === "load") {
      R = await loadEngine(data.engine, data.threads);
      const built = await buildDemo(R, data.demo);
      world = built.world;
      const shapes = describe(R, world);
      self.postMessage({ type: "loaded", shapes, camera: built.camera, bodies: world.bodies.len(), version: R.version(),
        threads: data.engine === "threads" ? R.threadCount() : 1 });
    } else if (data.type === "step") {
      const t0 = performance.now();
      world.step();
      const ms = performance.now() - t0;
      const buf = poses();
      self.postMessage({ type: "frame", ms, buf }, [buf.buffer]);
    } else if (data.type === "bench") {
      const RAPIER = await loadEngine(data.engine, data.threads);
      const w = (await buildDemo(RAPIER, data.demo)).world;
      const times = [];
      for (let i = 0; i < data.steps; i++) { const t0 = performance.now(); w.step(); times.push(performance.now() - t0); }
      const bodies = w.bodies.len();
      w.free();
      self.postMessage({ type: "bench", times, bodies, threads: data.engine === "threads" ? RAPIER.threadCount() : 1 });
    }
  } catch (e) {
    self.postMessage({ type: "error", message: String(e?.message ?? e) });
  }
};
