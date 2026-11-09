// The theme switch, the projects filter, and the tree that grows beside the name.
(function () {
  'use strict';
  var root = document.documentElement, still = matchMedia('(prefers-reduced-motion: reduce)').matches, redraw = null;

  // ------------------------------------------------------------------ theme: opens out from the switch, in under half a second
  var toggle = document.getElementById('theme');
  function setTheme(t) {
    root.setAttribute('data-theme', t);
    try { localStorage.setItem('theme', t); } catch (e) { /* private window: it lasts for this page */ }
    if (redraw) redraw();
  }
  if (toggle) toggle.addEventListener('click', function () {
    var t = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    if (still || !document.startViewTransition) return setTheme(t);
    var r = toggle.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    var far = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.startViewTransition(function () { setTheme(t); }).ready.then(function () {
      root.animate({ clipPath: ['circle(0 at ' + x + 'px ' + y + 'px)', 'circle(' + far + 'px at ' + x + 'px ' + y + 'px)'] }, { duration: 420, easing: 'cubic-bezier(.3,.7,.2,1)', pseudoElement: '::view-transition-new(root)' });
    });
  });

  // ------------------------------------------------------------------ projects filter (with no script, every project simply shows)
  var filters = document.querySelectorAll('.filters button'), rows = document.querySelectorAll('.row'), count = document.getElementById('count');
  filters.forEach(function (b) {
    b.addEventListener('click', function () {
      var f = b.getAttribute('data-f'), n = 0;
      filters.forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
      rows.forEach(function (r) { var on = f === 'all' || r.getAttribute('data-c').split(' ').indexOf(f) >= 0; r.hidden = !on; if (on) n++; });
      if (count) count.textContent = n;
    });
  });

  // ------------------------------------------------------------------ the tree: each branch 1/φ of the last. It grows once, then breathes, and leans a little toward the pointer
  var cv = document.getElementById('tree');
  if (!cv) return;
  var ctx = cv.getContext('2d'), PHI = 1.6180339887, small = innerWidth < 760 || navigator.hardwareConcurrency <= 4, DEPTH = small ? 8 : 10;
  var W = 0, H = 0, t = 0, grow = still ? 1 : 0, lean = 0, want = 0, seen = true, last = 0, born = 0, paths = [], color = '#000', baseX = 0.56;
  function size() {
    var r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
    W = r.width; H = r.height; baseX = W < 700 ? 0.7 : 0.5; cv.width = Math.round(W * d); cv.height = Math.round(H * d); ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  function branch(x, y, a, len, d) {
    if (d <= 0) return;
    var k = DEPTH - d, reach = Math.min(1, Math.max(0, grow * DEPTH - k));
    if (reach <= 0) return;
    var s = d / DEPTH, an = a + Math.sin(t * 0.55 + k * 0.6) * 0.035 * (1.2 - s) + lean * 0.11 * (1 - s);
    var x2 = x + Math.cos(an) * len * reach, y2 = y + Math.sin(an) * len * reach, p = paths[k];
    p.moveTo(x, y); p.lineTo(x2, y2);
    if (reach < 1) return;
    branch(x2, y2, an - 0.5, len / PHI, d - 1);
    branch(x2, y2, an + 0.4, len / PHI * 0.94, d - 1);
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    paths = []; for (var i = 0; i < DEPTH; i++) paths.push(new Path2D());
    branch(W * baseX, H + 2, -Math.PI / 2 - 0.03, Math.min(H * 0.28, W * 0.3), DEPTH);
    ctx.lineCap = 'round'; ctx.strokeStyle = color;
    for (var k = 0; k < DEPTH; k++) { var s = 1 - k / DEPTH; ctx.globalAlpha = 0.28 + s * 0.5; ctx.lineWidth = Math.max(0.6, s * s * 7); ctx.stroke(paths[k]); }
    ctx.globalAlpha = 1;
  }
  redraw = function () { color = getComputedStyle(root).getPropertyValue('--leaf').trim() || '#0E6B62'; draw(); };
  function loop(ts) {
    requestAnimationFrame(loop);
    if (!seen || document.hidden || ts - last < 33) return;
    if (!born) born = ts;   // (growth goes by the clock, so a slow device grows the whole tree in the same time)
    var dt = Math.min(0.05, (ts - last) / 1000); last = ts;
    t += dt; grow = Math.min(1, (ts - born) / 1800); lean += (want - lean) * Math.min(1, dt * 2.5);
    draw();
  }
  size(); redraw();
  addEventListener('resize', function () { size(); draw(); }, { passive: true });
  if (still) return;
  addEventListener('pointermove', function (e) { want = (e.clientX / innerWidth - 0.5) * 2; }, { passive: true });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { seen = es[0].isIntersecting; }).observe(cv);
  requestAnimationFrame(loop);
}());
