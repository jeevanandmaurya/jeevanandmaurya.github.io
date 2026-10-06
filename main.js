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

  // ── Liquid Wave Theme Transition ──────────────────────────────────────────
  var isTransitioning = false;

  function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  function drawWaveRegion(ctx, W, H, ySweep, amplitude, freq1, freq2, phase1, phase2, fillToBottom, fillColor, crestColor, targetTheme) {
    ctx.beginPath();
    if (fillToBottom) {
      ctx.moveTo(0, H);
    } else {
      ctx.moveTo(0, 0);
    }
    
    for (var x = 0; x <= W; x += 4) {
      // Calculate tree obstacle splitting lag (deforms only upon collision)
      var dx = x - W * 0.5;
      var obstacle = Math.exp(-Math.pow(dx / 160, 2));
      var lag = 0;
      
      if (targetTheme === 'dark') {
        var penetration = ySweep - H * 0.60;
        if (penetration > 0) {
          lag = Math.sin((penetration / (H * 0.40 + 50)) * Math.PI) * 85;
          lag = Math.max(0, lag);
        }
        var localSweep = ySweep - obstacle * lag;
      } else {
        var penetration = H - ySweep;
        if (penetration > 0) {
          lag = Math.sin((penetration / (H * 0.40 + 50)) * Math.PI) * 85;
          lag = Math.max(0, lag);
        }
        var localSweep = ySweep + obstacle * lag;
      }

      var y = localSweep + Math.sin(x * freq1 + phase1) * (amplitude * 0.5) + Math.cos(x * freq2 + phase2) * (amplitude * 0.3);
      ctx.lineTo(x, y);
    }
    
    if (fillToBottom) {
      ctx.lineTo(W, H);
    } else {
      ctx.lineTo(W, 0);
    }
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    if (crestColor) {
      ctx.beginPath();
      for (var x = 0; x <= W; x += 4) {
        var dx = x - W * 0.5;
        var obstacle = Math.exp(-Math.pow(dx / 160, 2));
        var lag = 0;
        
        if (targetTheme === 'dark') {
          var penetration = ySweep - H * 0.60;
          if (penetration > 0) {
            lag = Math.sin((penetration / (H * 0.40 + 50)) * Math.PI) * 85;
            lag = Math.max(0, lag);
          }
          var localSweep = ySweep - obstacle * lag;
        } else {
          var penetration = H - ySweep;
          if (penetration > 0) {
            lag = Math.sin((penetration / (H * 0.40 + 50)) * Math.PI) * 85;
            lag = Math.max(0, lag);
          }
          var localSweep = ySweep + obstacle * lag;
        }

        var y = localSweep + Math.sin(x * freq1 + phase1) * (amplitude * 0.5) + Math.cos(x * freq2 + phase2) * (amplitude * 0.3);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = crestColor;
      ctx.lineWidth = 4;
      ctx.shadowColor = crestColor;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0; // reset glow
    }
  }

  function startThemeTransition(targetTheme) {
    if (isTransitioning) return;
    isTransitioning = true;

    var canvas = document.getElementById('theme-transition-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'theme-transition-canvas';
      document.body.appendChild(canvas);
    }
    var ctx = canvas.getContext('2d');
    
    var W = canvas.width = window.innerWidth;
    var H = canvas.height = window.innerHeight;

    var duration = 3500; // majestic, slow fluid duration (3.5 seconds)
    var startTime = null;

    var waveFillColor = targetTheme === 'dark' ? '#080810' : '#F9F7F4';
    var backWaveFillColor = targetTheme === 'dark' ? 'rgba(78, 205, 196, 0.15)' : 'rgba(104, 128, 168, 0.15)';
    var crestColor = targetTheme === 'dark' ? '#9978E8' : '#C9A84C';

    var amplitude = Math.max(40, H * 0.05);
    var freq1 = 0.0035;
    var freq2 = 0.0075;

    // Elements that bob and tilt (physics interaction)
    var physicsItems = document.querySelectorAll('main section, .project-card, .about-wrap section');
    for (var i = 0; i < physicsItems.length; i++) {
      physicsItems[i].style.transition = 'none';
    }

    // All structural blocks and individual text elements that convert themes in real-time as the wave sweeps over them
    var conversionItems = document.querySelectorAll('header, main, footer, section, .project-card, .projects-stats, .about-wrap, a, button, h1, h2, h3, p, li, .sep');

    function render(ts) {
      if (!startTime) startTime = ts;
      var elapsed = ts - startTime;
      var progress = Math.min(1, elapsed / duration);
      var t = easeInOutCubic(progress);
      
      ctx.clearRect(0, 0, W, H);

      var wavePhase1 = t * Math.PI * 3.5;
      var wavePhase2 = t * Math.PI * 4.8 + 1.2;

      var ySweep = 0;

      if (targetTheme === 'dark') {
        // TOP TO BOTTOM sweep (to Dark)
        ySweep = -amplitude + t * (H + 2 * amplitude);

        // Back wave (fills top to ySweep)
        drawWaveRegion(ctx, W, H, ySweep, amplitude * 1.2, freq1 * 0.8, freq2 * 0.9, wavePhase1 * 0.9, wavePhase2 * 0.8, false, backWaveFillColor, null, targetTheme);
        // Front wave (fills top to ySweep)
        drawWaveRegion(ctx, W, H, ySweep, amplitude, freq1, freq2, wavePhase1, wavePhase2, false, waveFillColor, crestColor, targetTheme);
      } else {
        // BOTTOM TO TOP sweep (to Light)
        ySweep = (H + amplitude) - t * (H + 2 * amplitude);

        // Back wave (fills ySweep to bottom)
        drawWaveRegion(ctx, W, H, ySweep, amplitude * 1.2, freq1 * 0.8, freq2 * 0.9, wavePhase1 * 0.9, wavePhase2 * 0.8, true, backWaveFillColor, null, targetTheme);
        // Front wave (fills ySweep to bottom)
        drawWaveRegion(ctx, W, H, ySweep, amplitude, freq1, freq2, wavePhase1, wavePhase2, true, waveFillColor, crestColor, targetTheme);
      }

      // Expose state globally for fractal tree swaying interaction
      window.themeTransition = {
        active: true,
        ySweep: ySweep,
        targetTheme: targetTheme,
        progress: progress
      };

      // Real-time Element Conversion: check if wave crest has crossed item center
      for (var i = 0; i < conversionItems.length; i++) {
        var item = conversionItems[i];
        var rect = item.getBoundingClientRect();
        var centerX = rect.left + rect.width / 2;
        var centerY = rect.top + rect.height / 2;
        
        // Calculate localSweep at element horizontal coordinate (splitting around the tree)
        var dx = centerX - W * 0.5;
        var obstacle = Math.exp(-Math.pow(dx / 160, 2));
        var lag = 0;
        var localSweepItem = ySweep;
        
        if (targetTheme === 'dark') {
          var penetration = ySweep - H * 0.60;
          if (penetration > 0) {
            lag = Math.sin((penetration / (H * 0.40 + 50)) * Math.PI) * 85;
            lag = Math.max(0, lag);
          }
          localSweepItem = ySweep - obstacle * lag;
        } else {
          var penetration = H - ySweep;
          if (penetration > 0) {
            lag = Math.sin((penetration / (H * 0.40 + 50)) * Math.PI) * 85;
            lag = Math.max(0, lag);
          }
          localSweepItem = ySweep + obstacle * lag;
        }

        var itemTheme;
        if (targetTheme === 'dark') {
          itemTheme = localSweepItem >= centerY ? 'dark' : 'light';
        } else {
          itemTheme = localSweepItem <= centerY ? 'light' : 'dark';
        }

        if (item.getAttribute('data-theme') !== itemTheme) {
          item.setAttribute('data-theme', itemTheme);
        }
      }

      // Physics interaction: make cards bob up/down and tilt
      var waveRadius = 260; // range of wave physics influence in pixels
      var maxBob = 22;      // maximum vertical displacement in pixels
      var maxTilt = 3.5;    // maximum tilt angle in degrees

      for (var i = 0; i < physicsItems.length; i++) {
        var item = physicsItems[i];
        var rect = item.getBoundingClientRect();
        
        // Skip off-screen elements
        if (rect.bottom < 0 || rect.top > H) {
          item.style.transform = '';
          continue;
        }
        
        var centerX = rect.left + rect.width / 2;
        var centerY = rect.top + rect.height / 2;

        // Calculate localSweep at element horizontal coordinate (splitting around the tree)
        var dx = centerX - W * 0.5;
        var obstacle = Math.exp(-Math.pow(dx / 160, 2));
        var lag = 0;
        var localSweepItem = ySweep;
        
        if (targetTheme === 'dark') {
          var penetration = ySweep - H * 0.60;
          if (penetration > 0) {
            lag = Math.sin((penetration / (H * 0.40 + 50)) * Math.PI) * 85;
            lag = Math.max(0, lag);
          }
          localSweepItem = ySweep - obstacle * lag;
        } else {
          var penetration = H - ySweep;
          if (penetration > 0) {
            lag = Math.sin((penetration / (H * 0.40 + 50)) * Math.PI) * 85;
            lag = Math.max(0, lag);
          }
          localSweepItem = ySweep + obstacle * lag;
        }

        var dist = centerY - localSweepItem;
        
        if (Math.abs(dist) < waveRadius) {
          var angleRad = (dist / waveRadius) * (Math.PI / 2);
          // Cosine profile for buoyant lift (card rises up)
          var dy = -Math.cos(angleRad) * maxBob;
          // Sine profile for rotation/tilt
          var rotate = Math.sin((dist / waveRadius) * Math.PI) * maxTilt;
          
          // Reverse tilt direction if light theme (flowing bottom-to-top)
          if (targetTheme === 'light') {
            rotate = -rotate;
          }

          item.style.transform = 'translateY(' + dy + 'px) rotate(' + rotate + 'deg)';
        } else {
          item.style.transform = '';
        }
      }

      if (progress < 1) {
        requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, W, H);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        
        // Globally activate target theme
        applyTheme(targetTheme);

        // Reset global transition variable
        window.themeTransition = { active: false };

        // Clean up temporary local themes and physics styles
        for (var i = 0; i < conversionItems.length; i++) {
          conversionItems[i].removeAttribute('data-theme');
        }
        for (var i = 0; i < physicsItems.length; i++) {
          physicsItems[i].style.transform = '';
          physicsItems[i].style.transition = '';
        }
        
        isTransitioning = false;
      }
    }

    requestAnimationFrame(render);
  }

  if (toggle) toggle.addEventListener('click', function () {
    var targetTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    startThemeTransition(targetTheme);
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
    
    var waveWobble = 0;
    var branchColor = p.tree;

    if (window.themeTransition && window.themeTransition.active) {
      var transition = window.themeTransition;
      
      // Calculate localSweep at element horizontal coordinate (splitting around the tree)
      var dx = x - W * 0.5;
      var obstacle = Math.exp(-Math.pow(dx / 160, 2));
      var lag = 0;
      var localSweepItem = transition.ySweep;
      
      if (transition.targetTheme === 'dark') {
        var penetration = transition.ySweep - H * 0.60;
        if (penetration > 0) {
          lag = Math.sin((penetration / (H * 0.40 + 50)) * Math.PI) * 85;
          lag = Math.max(0, lag);
        }
        localSweepItem = transition.ySweep - obstacle * lag;
      } else {
        var penetration = H - transition.ySweep;
        if (penetration > 0) {
          lag = Math.sin((penetration / (H * 0.40 + 50)) * Math.PI) * 85;
          lag = Math.max(0, lag);
        }
        localSweepItem = transition.ySweep + obstacle * lag;
      }

      var dist = y - localSweepItem;
      if (Math.abs(dist) < 180) {
        var norm = dist / 180;
        var wobbleFactor = 1.3 - (d / MAX_DEPTH);
        waveWobble = Math.sin(norm * Math.PI) * Math.cos(t * 12) * 0.22 * wobbleFactor;
        if (transition.targetTheme === 'light') {
          waveWobble = -waveWobble;
        }
      }

      // Real-time branch color shifting aligned with the visual split wave front
      var isDarkBranch;
      if (transition.targetTheme === 'dark') {
        isDarkBranch = localSweepItem >= y;
      } else {
        isDarkBranch = localSweepItem > y;
      }
      branchColor = isDarkBranch ? '#4ECDC4' : '#8B7355';
    }

    var a = ang + Math.sin(t * 0.4 + d * 0.55) * 0.10 + tiltX * 0.14 * (d / MAX_DEPTH) + waveWobble;
    var x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    ctx.globalAlpha = 0.06 + (d / MAX_DEPTH) * 0.09;
    ctx.lineWidth = Math.max(0.3, (d / MAX_DEPTH) * 1.8);
    ctx.strokeStyle = branchColor;
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
