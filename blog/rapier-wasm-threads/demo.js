import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const $ = (id) => document.getElementById(id);
const BUDGET = 1000 / 60;
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

// ---------- three.js ----------
const view = $("view");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
view.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a2620, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.8);
sun.position.set(40, 80, 30);
scene.add(sun);
function resize() {
  const w = view.clientWidth, h = view.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(view);
const COLORS = { cuboid: 0xe0a458, ball: 0x5fb3ff, capsule: 0x7bd88f, cylinder: 0xc792ea, cone: 0xff8a65 };
const SLEEP = new THREE.Color(0x56606e);

function geometry(s) {
  const [a, b, c] = s.d || [];
  switch (s.kind) {
    case "cuboid": return new THREE.BoxGeometry(a * 2, b * 2, c * 2);
    case "ball": return new THREE.SphereGeometry(a, 14, 10);
    case "capsule": return new THREE.CapsuleGeometry(b, a * 2, 4, 10);
    case "cylinder": return new THREE.CylinderGeometry(b, b, a * 2, 14);
    case "cone": return new THREE.ConeGeometry(b, a * 2, 14);
    case "trimesh": { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(s.v, 3)); g.setIndex(s.i); g.computeVertexNormals(); return g; }
  }
}

let groups = [], statics = new THREE.Group();
scene.add(statics);
function buildScene(shapes, cam) {
  for (const g of groups) { scene.remove(g.mesh); g.mesh.geometry.dispose(); }
  scene.remove(statics);
  statics = new THREE.Group();
  scene.add(statics);
  groups = [];
  const byKey = new Map(), box = new THREE.Box3();
  for (const s of shapes) {
    if (!s.dynamic) {
      const m = new THREE.Mesh(geometry(s), new THREE.MeshStandardMaterial({ color: 0x3b4250, roughness: 0.95, transparent: true, opacity: s.kind === "trimesh" ? 1 : 0.55, flatShading: s.kind === "trimesh" }));
      m.position.fromArray(s.pose); m.quaternion.fromArray(s.pose, 3);
      statics.add(m);
      continue;
    }
    box.expandByPoint(new THREE.Vector3().fromArray(s.pose));
    const key = s.kind + s.d.map((x) => x.toFixed(3)).join(",");
    if (!byKey.has(key)) byKey.set(key, { s, slots: [], poses: [] });
    byKey.get(key).slots.push(s.slot);
    byKey.get(key).poses.push(s.pose);
  }
  for (const { s, slots, poses } of byKey.values()) {
    const mesh = new THREE.InstancedMesh(geometry(s), new THREE.MeshStandardMaterial({ roughness: 0.6 }), slots.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    const base = new THREE.Color(COLORS[s.kind] ?? 0xffffff);
    for (let k = 0; k < slots.length; k++) {
      mesh.setColorAt(k, base);
      // Start at the initial pose so the scene shows before the first physics frame (or while paused).
      const p = poses[k];
      mesh.setMatrixAt(k, new THREE.Matrix4().compose(new THREE.Vector3(p[0], p[1], p[2]), new THREE.Quaternion(p[3], p[4], p[5], p[6]), new THREE.Vector3(1, 1, 1)));
    }
    scene.add(mesh);
    groups.push({ mesh, slots, base, asleep: new Uint8Array(slots.length) });
  }
  if (cam) {
    camera.position.set(cam.eye.x, cam.eye.y, cam.eye.z);
    controls.target.set(cam.target.x, cam.target.y, cam.target.z);
  } else {
    const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length();
    controls.target.set(c.x, Math.max(2, c.y * 0.5), c.z);
    camera.position.set(c.x + r * 0.7, c.y + r * 0.45, c.z + r * 0.8);
  }
}
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _one = new THREE.Vector3(1, 1, 1);
function applyPoses(buf) {
  let awake = 0;
  for (const g of groups) {
    let dirty = false;
    for (let k = 0; k < g.slots.length; k++) {
      const o = g.slots[k] * 8, sl = buf[o + 7];
      if (!sl) awake++;
      if (sl !== g.asleep[k]) { g.asleep[k] = sl; g.mesh.setColorAt(k, sl ? SLEEP : g.base); dirty = true; }
      _m.compose(_p.set(buf[o], buf[o + 1], buf[o + 2]), _q.set(buf[o + 3], buf[o + 4], buf[o + 5], buf[o + 6]), _one);
      g.mesh.setMatrixAt(k, _m);
    }
    g.mesh.instanceMatrix.needsUpdate = true;
    if (dirty) g.mesh.instanceColor.needsUpdate = true;
  }
  return awake;
}

// ---------- worker + stats ----------
let worker = null, waiting = false, hist = [], awake = 0, frames = 0, fps = 0, fpsT = performance.now(), info = {};
const newWorker = () => new Worker(new URL("./demo-worker.js", import.meta.url), { type: "module" });
function load() {
  worker?.terminate();
  hist = []; waiting = true;
  $("status").textContent = "loading engine and scene…";
  worker = newWorker();
  worker.onmessage = ({ data }) => {
    if (data.type === "error") { $("status").textContent = `error: ${data.message}`; return; }
    if (data.type === "loaded") {
      info = data;
      buildScene(data.shapes, data.camera);
      $("status").textContent = "";
      waiting = false;
    } else if (data.type === "frame") {
      hist.push(data.ms); if (hist.length > 240) hist.shift();
      awake = applyPoses(data.buf);
      waiting = false;
    }
  };
  worker.postMessage({ type: "load", engine: $("engine").value, threads: +$("threads").value, demo: $("demo").value });
}

function loop(now) {
  requestAnimationFrame(loop);
  if (worker && !waiting && info.shapes && $("play").dataset.on === "1") { waiting = true; worker.postMessage({ type: "step" }); }
  controls.update();
  renderer.render(scene, camera);
  frames++;
  if (now - fpsT > 500) { fps = (frames * 1000) / (now - fpsT); frames = 0; fpsT = now; drawStats(); }
}

function drawStats() {
  const n = hist.length, mean = n ? hist.reduce((a, b) => a + b, 0) / n : 0;
  const p95 = n ? [...hist].sort((a, b) => a - b)[Math.floor(n * 0.95)] : 0;
  const cls = (v) => (v > BUDGET ? "over" : v > BUDGET / 2 ? "near" : "ok");
  $("sEngine").textContent = info.version ? `${$("engine").selectedOptions[0].dataset.short} · ${info.threads} thread${info.threads > 1 ? "s" : ""}` : "–";
  $("sBodies").textContent = info.bodies ? `${info.bodies.toLocaleString()} (${awake.toLocaleString()} awake)` : "–";
  $("sStep").innerHTML = n ? `<span class="${cls(mean)}">${mean.toFixed(2)}</span> / <span class="${cls(p95)}">${p95.toFixed(2)}</span> ms` : "–";
  $("sFps").textContent = fps.toFixed(0);
  const cv = $("spark"), ctx = cv.getContext("2d"), w = (cv.width = cv.clientWidth * devicePixelRatio), h = (cv.height = cv.clientHeight * devicePixelRatio);
  const max = Math.max(BUDGET * 1.2, ...hist), y = (v) => h - (v / max) * h;
  ctx.strokeStyle = css("--soft"); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(0, y(BUDGET)); ctx.lineTo(w, y(BUDGET)); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = css("--gold"); ctx.lineWidth = 1.5 * devicePixelRatio; ctx.beginPath();
  hist.forEach((v, i) => { const x = (i / 239) * w; i ? ctx.lineTo(x, y(v)) : ctx.moveTo(x, y(v)); });
  ctx.stroke();
}

// ---------- side-by-side benchmark ----------
function benchOne(engine, threads, demo, steps) {
  return new Promise((res) => {
    const w = newWorker();
    w.onmessage = ({ data }) => { if (data.type === "bench" || data.type === "error") { w.terminate(); res(data); } };
    w.postMessage({ type: "bench", engine, threads, demo, steps });
  });
}
async function compare() {
  const demo = $("demo").value, threads = +$("threads").value, steps = 300, out = $("compare-out");
  $("play").dataset.on = "0"; $("play").textContent = "Play";
  out.innerHTML = `<p class="muted">Running ${steps} steps of “${$("demo").selectedOptions[0].text}” on each engine, without rendering…</p>`;
  const rows = [];
  for (const [engine, label] of [["official", "Official SIMD · 1 thread"], ["threads", `Threads · ${threads} threads`]]) {
    const r = await benchOne(engine, threads, demo, steps);
    if (r.type === "error") { out.innerHTML = `<p class="over">error: ${r.message}</p>`; return; }
    const mean = r.times.reduce((a, b) => a + b, 0) / r.times.length;
    const p95 = [...r.times].sort((a, b) => a - b)[Math.floor(r.times.length * 0.95)];
    rows.push({ label, mean, p95, bodies: r.bodies });
  }
  const max = Math.max(...rows.map((r) => r.p95));
  out.innerHTML = `<table class="data"><thead><tr><th>Engine</th><th>Mean step</th><th>p95</th><th></th></tr></thead><tbody>${rows
    .map((r) => `<tr><td>${r.label}</td><td>${r.mean.toFixed(2)} ms</td><td>${r.p95.toFixed(2)} ms</td><td class="barcell"><span class="hbar" style="width:${(r.mean / max) * 100}%"></span></td></tr>`)
    .join("")}</tbody></table><p class="big-stat"><strong>${(rows[0].mean / rows[1].mean).toFixed(2)}×</strong> faster with ${threads} threads · ${rows[0].bodies.toLocaleString()} bodies</p>`;
}

// ---------- UI ----------
const hc = navigator.hardwareConcurrency || 4;
$("threads").value = Math.max(2, Math.floor(hc / 2));
$("threads").max = hc;
$("hc").textContent = hc;
for (const id of ["demo", "engine", "threads"]) $(id).onchange = load;
$("play").onclick = () => { const on = $("play").dataset.on !== "1"; $("play").dataset.on = on ? "1" : "0"; $("play").textContent = on ? "Pause" : "Play"; };
$("reset").onclick = load;
$("compare").onclick = compare;
if (!crossOriginIsolated) $("status").textContent = "Enabling cross-origin isolation (the page reloads once)…";
else { load(); requestAnimationFrame(loop); }
