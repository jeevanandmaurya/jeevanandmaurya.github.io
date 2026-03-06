// main.js — Living Mathematics
(function () {
  'use strict';
  var PHI = 1.6180339887;
  var MOBILE = navigator.hardwareConcurrency <= 4; // perf-only: depth + fps
  var MAX_DEPTH = MOBILE ? 7 : 10;
  var FRAME_MS = MOBILE ? 1000 / 30 : 1000 / 60;

  // ── Theme ─────────────────────────────────────────────────────────────────
  var html = document.documentElement;
  var toggle = document.getElementById('theme-toggle');

  function applyTheme(theme) {
    html.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    if (!toggle) return;
    var sun = toggle.querySelector('.icon-sun');
    var moon = toggle.querySelector('.icon-moon');
    if (sun) sun.style.display = theme === 'dark' ? 'block' : 'none';
    if (moon) moon.style.display = theme === 'dark' ? 'none' : 'block';
  }
  var saved = localStorage.getItem('theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(saved);
  if (toggle) toggle.addEventListener('click', function () {
    applyTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  // ── Tab title — looping typewriter ────────────────────────────────────────
  (function () {
    var NAME = 'Jeevanand', idx = 0, erasing = false;
    function tick() {
      if (!erasing) {
        idx++;
        document.title = NAME.slice(0, idx);
        if (idx >= NAME.length) { erasing = true; setTimeout(tick, 5000); }
        else { setTimeout(tick, 130); }
      } else {
        idx--;
        document.title = NAME.slice(0, idx);
        if (idx <= 0) { erasing = false; setTimeout(tick, 5000); }
        else { setTimeout(tick, 70); }
      }
    }
    tick(); // start immediately
  }());


  // ── Page fade-in ──────────────────────────────────────────────────────────
  document.body.style.opacity = '0';
  document.body.style.transition = 'opacity 0.6s ease';
  window.addEventListener('load', function () { document.body.style.opacity = '1'; });

  // ── Canvas setup ──────────────────────────────────────────────────────────
  var canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W, H, lastFrame = 0, t = 0;

  // ── ASCII Particles ───────────────────────────────────────────────────────
  var ASCII_CHARS = ['0', '1', '/', '\\', '|', '-', '+', '*', '#', '.', '_', '~'];
  var PARTICLE_COUNT = MOBILE ? 28 : 55;
  var particles = [];
  function makeParticle() {
    return {
      x: Math.random() * (W || window.innerWidth),
      y: (H || window.innerHeight) * (0.2 + Math.random() * 0.8),
      vy: -(0.12 + Math.random() * 0.22),
      vx: (Math.random() - 0.5) * 0.10,
      ch: ASCII_CHARS[Math.floor(Math.random() * ASCII_CHARS.length)],
      life: Math.random(),          // 0-1 phase offset
      speed: 0.004 + Math.random() * 0.006
    };
  }
  function initParticles() {
    particles = [];
    for (var i = 0; i < PARTICLE_COUNT; i++) {
      var p = makeParticle();
      p.y = Math.random() * (H || window.innerHeight); // scatter on init
      particles.push(p);
    }
  }
  var START_TS = null, curDepth = 0;

  function drawParticles(p) {
    ctx.font = '11px "Share Tech Mono", monospace';
    ctx.textBaseline = 'top';
    var dk = html.getAttribute('data-theme') === 'dark';
    for (var i = 0; i < particles.length; i++) {
      var par = particles[i];
      par.life += par.speed;
      par.x += par.vx;
      par.y += par.vy;
      // respawn when drifted off top or sides
      if (par.y < -20 || par.x < -20 || par.x > W + 20) {
        particles[i] = makeParticle();
        particles[i].y = H + 5;
        continue;
      }
      var alpha = (0.04 + Math.abs(Math.sin(par.life)) * 0.08);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = dk ? p.wave : p.tree;
      ctx.fillText(par.ch, par.x, par.y);
    }
  }

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    initParticles();
  }

  function pal() {
    var dk = html.getAttribute('data-theme') === 'dark';
    return {
      tree: dk ? '#4ECDC4' : '#8B7355',
      wave: dk ? '#9978E8' : '#6880A8'
    };
  }

  // ── Gyro tilt (mobile) ────────────────────────────────────────────────────
  var tiltX = 0;
  if (window.DeviceOrientationEvent)
    window.addEventListener('deviceorientation', function (e) {
      if (e.gamma !== null) tiltX = Math.max(-1, Math.min(1, e.gamma / 45));
    }, { passive: true });


  // ── Harmonic Wave field ───────────────────────────────────────────────────
  var RATIOS = [1, PHI, 2, 3, PHI * PHI];
  function drawWaves(p) {
    ctx.lineCap = 'butt';
    for (var i = 0; i < RATIOS.length; i++) {
      var bY = H * (0.52 + i * 0.10), amp = 12 + i * 5;
      var freq = RATIOS[i] * 0.0021, phase = t * 0.20 + i * Math.PI * 0.38;
      ctx.globalAlpha = 0.020 + i * 0.003;
      ctx.strokeStyle = p.wave; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(0, bY + Math.sin(phase) * amp);
      for (var x = 3; x <= W; x += 3)
        ctx.lineTo(x, bY + Math.sin(x * freq + phase) * amp);
      ctx.stroke();
    }
  }

  // ── Fractal Tree ──────────────────────────────────────────────────────────
  function branch(x, y, ang, len, d, p) {
    if (d <= 0 || len < 1.5) return;
    var a = ang + Math.sin(t * 0.4 + d * 0.55) * 0.10 + tiltX * 0.14 * (d / MAX_DEPTH);
    var x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    ctx.globalAlpha = 0.06 + (d / MAX_DEPTH) * 0.09;
    ctx.lineWidth = Math.max(0.3, (d / MAX_DEPTH) * 1.8);
    ctx.strokeStyle = p.tree;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    var nl = len / PHI;
    branch(x2, y2, a - 0.52, nl, d - 1, p);
    branch(x2, y2, a + 0.42, nl * 0.93, d - 1, p);
  }
  function drawTree(p) {
    ctx.lineCap = 'round';
    branch(W * 0.5, H + 2, -Math.PI / 2, H * 0.22, curDepth, p);
  }

  // ── Main loop ─────────────────────────────────────────────────────────────
  function loop(ts) {
    requestAnimationFrame(loop);
    if (document.hidden) return;
    if (START_TS === null) START_TS = ts;
    curDepth = Math.min(MAX_DEPTH, Math.ceil(((ts - START_TS) / 1500) * MAX_DEPTH));
    var dt = ts - lastFrame;
    if (dt < FRAME_MS) return;
    lastFrame = ts - (dt % FRAME_MS);
    t += 0.016;
    ctx.clearRect(0, 0, W, H);
    var p = pal();
    drawParticles(p);
    drawWaves(p);
    drawTree(p);
    ctx.globalAlpha = 1;
  }

  window.addEventListener('resize', resize, { passive: true });
  resize();
  requestAnimationFrame(loop);
}());
