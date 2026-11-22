// Builds a Rapier (JS/WASM) world from a scene JSON. Shared by the Node runner and the browser app.
export function buildWorld(RAPIER, scene) {
  const world = new RAPIER.World({ x: scene.gravity[0], y: scene.gravity[1], z: scene.gravity[2] });
  world.timestep = scene.dt;
  world.numSolverIterations = scene.solverIterations ?? 4;
  const handles = [];
  for (const b of scene.bodies) {
    const desc = b.type === "fixed" ? RAPIER.RigidBodyDesc.fixed() : RAPIER.RigidBodyDesc.dynamic();
    desc.setTranslation(b.pos[0], b.pos[1], b.pos[2]);
    if (scene.disableSleep) desc.setCanSleep(false);
    if (b.rot) desc.setRotation({ x: b.rot[0], y: b.rot[1], z: b.rot[2], w: b.rot[3] });
    const body = world.createRigidBody(desc);
    const col = colliderDesc(RAPIER, b.shape);
    col.setDensity(b.density ?? 1).setFriction(b.friction ?? 0.5).setRestitution(b.restitution ?? 0);
    world.createCollider(col, body);
    handles.push(body);
  }
  for (const j of scene.joints) {
    const a = { x: j.anchorA[0], y: j.anchorA[1], z: j.anchorA[2] };
    const bb = { x: j.anchorB[0], y: j.anchorB[1], z: j.anchorB[2] };
    let data;
    if (j.kind === "spherical") data = RAPIER.JointData.spherical(a, bb);
    else if (j.kind === "revolute") data = RAPIER.JointData.revolute(a, bb, { x: j.axis[0], y: j.axis[1], z: j.axis[2] });
    else throw new Error(`unknown joint ${j.kind}`);
    world.createImpulseJoint(data, handles[j.a], handles[j.b], true);
  }
  return { world, bodies: handles };
}

export function colliderDesc(RAPIER, s) {
  switch (s.kind) {
    case "cuboid": return RAPIER.ColliderDesc.cuboid(s.hx, s.hy, s.hz);
    case "ball": return RAPIER.ColliderDesc.ball(s.r);
    case "capsule": return RAPIER.ColliderDesc.capsule(s.hh, s.r);
    case "cylinder": return RAPIER.ColliderDesc.cylinder(s.hh, s.r);
    case "trimesh": return RAPIER.ColliderDesc.trimesh(new Float32Array(s.vertices), new Uint32Array(s.indices));
    default: throw new Error(`unknown shape ${s.kind}`);
  }
}

// Summary statistics over per-step times (ms).
export function stats(times) {
  const sorted = [...times].sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  return { mean, median: q(0.5), p95: q(0.95), p99: q(0.99), max: sorted[sorted.length - 1], total: mean * times.length };
}

// Runs a scene headless and returns the result record (same schema as the native runner).
export function runScene(RAPIER, scene, { steps = scene.steps, now = () => performance.now(), onStep } = {}) {
  const t0 = now();
  const { world, bodies } = buildWorld(RAPIER, scene);
  const buildMs = now() - t0;
  world.profilerEnabled = true;
  const times = new Array(steps);
  const phases = { collision: 0, broadPhase: 0, narrowPhase: 0, solver: 0 };
  for (let i = 0; i < steps; i++) {
    const s = now();
    world.step();
    times[i] = now() - s;
    phases.collision += world.timingCollisionDetection();
    phases.broadPhase += world.timingBroadPhase();
    phases.narrowPhase += world.timingNarrowPhase();
    phases.solver += world.timingSolver();
    onStep?.(i, times[i]);
  }
  for (const k in phases) phases[k] /= steps;
  let checksum = 0, sleeping = 0, dynamicBodies = 0;
  for (const b of bodies) {
    if (!b.isDynamic()) continue;
    dynamicBodies++;
    const t = b.translation();
    checksum += t.y;
    if (b.isSleeping()) sleeping++;
  }
  world.free();
  return {
    scene: scene.name, dynamicBodies, joints: scene.joints.length, steps, buildMs,
    stepMs: stats(times), phasesMs: phases, avgHeight: checksum / dynamicBodies, sleeping,
  };
}
