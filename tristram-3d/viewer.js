/* Tristram in 3D: the page's viewer and its download buttons.
   Reads window.T3D (set by the page): base, flags {original, texturedView, texturedDownloads}, counting, three, items.
   three.js is fetched only when the viewer comes near the screen; until then the stage shows pictures. */
(function () {
  'use strict';
  if (!window.bdT) window.bdT = function (s, v) { return v ? s.replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; }) : s; };
  var C = window.T3D, bdT = window.bdT;
  var $ = function (id) { return document.getElementById(id); };
  var stage = $('t3d-stage'), canvas = $('t3d-gl'), imgO = $('t3d-original'), imgP = $('t3d-poster'), note = $('t3d-note');
  if (!stage) return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cur = null, view = 'clay', split = 0.55, rotated = false;
  var mode = (C.flags.original && !C.capture) ? 'compare' : 'turn';   // compare: the game's picture against the model, a divider to drag; turn: the model alone, to turn
  var az = 0, el = 30, zoom = 1, active = false;
  var THREE = null, renderer = null, scene = null, cam = null, loader = null, cache = {}, shown = null, pending = 0, raf = 0;
  var byslug = {};
  C.items.forEach(function (it) { byslug[it.slug] = it; });

  // ---------- counting a download: one small switch (see DOWNLOAD_COUNTING.md)
  function countDownload(file) {
    var path = 'download/' + file;
    if (C.counting !== 'off' && window.goatcounter && window.goatcounter.count) {   // the click, whatever serves the file
      window.goatcounter.count({ path: path, title: 'Download ' + file, event: true });
    }
    if (C.debug) { var d = $('t3d-debug'); if (d) d.textContent = 'counting=' + C.counting + ': would count "' + path + '"'; }
  }
  // the thank-you panel opens beside the button that started the download: under the viewer's card when the click
  // came from there (no scrolling away from the model), else in its own place in the downloads; only its heading speaks
  var th = $('thanks'), thH = $('thanks-h'), thMsg = thH ? thH.textContent : '', thHome = null, opener = null;
  if (th) { thHome = document.createComment('thanks'); th.parentNode.insertBefore(thHome, th); }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-dl]');
    if (!a) return;
    countDownload(a.getAttribute('data-dl'));
    if (!th) return;
    opener = a;
    var card = a.closest('.about3d');
    if (card) card.parentNode.insertBefore(th, card.nextSibling); else thHome.parentNode.insertBefore(th, thHome.nextSibling);
    th.hidden = false;
    if (thH) { thH.textContent = ''; setTimeout(function () { thH.textContent = thMsg; }, 50); }
    if (!card) setTimeout(function () { th.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }); }, 60);
  });
  var tc = $('thanks-close');
  if (tc) tc.addEventListener('click', function () {
    th.hidden = true;
    if (opener && opener.offsetParent) opener.focus(); else stage.focus();
  });

  // ---------- the pictures and the state of the stage
  function file(it, kind) { return C.base + (kind === 'original' ? 'img/' + it.slug + '_original.webp' : kind === 'poster-clay' ? 'img/' + it.slug + '_clay.webp' : kind === 'poster-textured' ? 'img/' + it.slug + '_textured.webp' : 'models/' + it.slug + '_' + kind + '.glb'); }
  function modelView() { return view; }
  function paint() {
    var mv = view, ready = shown && shown.slug === cur.slug && shown.view === mv, cmp = mode === 'compare';
    imgO.hidden = !cmp;
    // the model on the divider's left, the game's picture on its right
    canvas.style.clipPath = imgP.style.clipPath = cmp ? 'inset(0 ' + ((1 - split) * 100) + '% 0 0)' : 'none';
    canvas.style.visibility = ready ? 'visible' : 'hidden';
    imgP.hidden = !(!ready && !rotated);
    if (!ready) imgP.src = file(cur, 'poster-' + mv);
    stage.style.setProperty('--s', split);
    stage.classList.toggle('compare', cmp);
    stage.classList.toggle('rotated', rotated);
    var lab = $('t3d-lab-l'); if (lab) lab.textContent = view === 'textured' ? bdT('Textured') : bdT('Clay');
    [].forEach.call(document.querySelectorAll('[data-view]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-view') === view ? 'true' : 'false'); });
    [].forEach.call(document.querySelectorAll('.tabs [data-mode]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-mode') === mode ? 'true' : 'false'); });
    stage.setAttribute('aria-label', cmp
      ? bdT('{name}: the model against the game’s picture. Drag the divider, or use the left and right arrow keys.', { name: cur.title })
      : bdT('{name}: a 3D model you can turn. Arrow keys turn it, plus and minus zoom, 0 goes back to the game’s view.', { name: cur.title }));
  }
  function say(s) { note.textContent = s || ''; note.hidden = !s; }

  // ---------- three.js, on demand
  var threeReady = null, sun = null;
  // a warm afternoon sun from the left and in front, as in the fly-through; a cool sky to fill the shade
  // from the left, so the left front wall is lit, the right one in shade and the shadows fall to the right where they show
  var LIGHT = { sun: 0xffc98f, sunI: 2.1, sky: 0xb9c8e0, earth: 0x3f3226, fill: 0.62, exposure: 0.95, dir: [-0.8, 0.55, 0.12], catcher: 0.42,
    // the paintings carry the game's own light already: a gentler sun on them, mostly for the shadows the buildings cast
    tex: { sunI: 1.0, fill: 0.75, exposure: 1.0, glow: 0.35, ground: 0.5 } };
  var hemi = null;
  function lightFor(v) {
    var t = v === 'textured' ? LIGHT.tex : LIGHT;
    sun.intensity = t.sunI; hemi.intensity = t.fill; renderer.toneMappingExposure = t.exposure;
  }
  var catcher = null;
  function fitSun(root) {
    var box = new THREE.Box3().setFromObject(root), c = box.getCenter(new THREE.Vector3()), R = box.getBoundingSphere(new THREE.Sphere()).radius;
    var d = new THREE.Vector3(LIGHT.dir[0], LIGHT.dir[1], LIGHT.dir[2]).normalize();
    sun.position.copy(c).addScaledVector(d, R * 2); sun.target.position.copy(c); sun.target.updateMatrixWorld();
    var big = R > 40, size = big ? Math.min(4096, renderer.capabilities.maxTextureSize) : 2048, sc = sun.shadow.camera;
    sc.left = sc.bottom = -R; sc.right = sc.top = R; sc.near = R * 0.5; sc.far = R * 3.5; sc.updateProjectionMatrix();
    if (sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    sun.shadow.normalBias = 2 * R / size;
    // a single building stands on nothing: an invisible floor that only takes its shadow
    if (!catcher) { catcher = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: LIGHT.catcher })); catcher.rotation.x = -Math.PI / 2; catcher.receiveShadow = true; scene.add(catcher); }
    var hasGround = false; root.traverse(function (o) { if (o.isMesh && /ground/.test(o.name)) hasGround = true; });
    catcher.visible = !hasGround; catcher.position.set(c.x, box.min.y + R * 0.002, c.z); catcher.scale.set(R * 4, R * 4, 1);
    renderer.shadowMap.needsUpdate = true;
  }
  function script(src) {
    return new Promise(function (ok, bad) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { bad(new Error(src)); }; document.head.appendChild(s); });
  }
  function needThree() {
    if (!threeReady) threeReady = (window.THREE ? Promise.resolve() : script(C.three.core)).then(function () { return window.THREE.GLTFLoader ? 0 : script(C.three.loader); }).then(function () {
      THREE = window.THREE;
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: !!C.capture });
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = LIGHT.exposure;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      // the sun stands still against the model, so its shadows are worked out once per model, not every frame
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
      scene = new THREE.Scene();
      hemi = new THREE.HemisphereLight(LIGHT.sky, LIGHT.earth, LIGHT.fill); scene.add(hemi);
      sun = new THREE.DirectionalLight(LIGHT.sun, LIGHT.sunI); sun.castShadow = true; sun.shadow.bias = -0.0004;
      scene.add(sun); scene.add(sun.target);
      cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -4000, 4000);
      loader = new THREE.GLTFLoader();
      // a lost context (the GPU reset, too many pages with 3D open) shows a note; three.js rebuilds on restore
      canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); lost = true; say(bdT('The 3D view was interrupted. It comes back on its own.')); });
      canvas.addEventListener('webglcontextrestored', function () { lost = false; say(''); renderer.shadowMap.needsUpdate = true; draw(); });
      size();
    }).catch(function (err) { threeReady = null; renderer = null; throw err; });   // the next pick tries again
    return threeReady;
  }
  var KEEP = 3, order = [], lost = false;
  function dispose(root) {
    root.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      [].concat(o.material || []).forEach(function (m) { ['map', 'emissiveMap'].forEach(function (k) { if (m[k]) m[k].dispose(); }); m.dispose(); });
    });
  }
  function keep(key) {
    order = order.filter(function (k) { return k !== key; }); order.push(key);
    for (var i = 0; order.length > KEEP && i < order.length;) {
      var k = order[i], c = cache[k];
      if (!c.root || (shown && shown.root === c.root)) { i++; continue; }   // still loading, or on the stage
      order.splice(i, 1); delete cache[k]; dispose(c.root);
    }
  }
  function load(it, v) {
    var key = it.slug + '_' + v;
    if (cache[key]) { keep(key); return cache[key].p; }
    var entry = { root: null };
    entry.p = new Promise(function (ok, bad) {
      loader.load(file(it, v), function (g) {
        var root = g.scene, edges = [];
        root.traverse(function (o) { if (o.isMesh) { o.castShadow = !/openings/.test(o.name); o.receiveShadow = true; } });
        if (v === 'clay') root.traverse(function (o) {
          if (!o.isMesh) return;
          o.material.flatShading = true; o.material.needsUpdate = true;
          // the outline of every sharp edge, as on a clay model; the rocks and trees go without
          if (o.geometry.index && o.geometry.index.count < 60000 && !/rocks|trees|graves|ground/.test(o.name)) {
            var l = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 25), new THREE.LineBasicMaterial({ color: 0x3a332b, transparent: true, opacity: 0.5 }));
            edges.push([o, l]);
          }
        });
        else root.traverse(function (o) {
          if (!o.isMesh) return;
          var m = o.material;
          // the files keep the paintings unlit (they look as painted anywhere); here they take the sun and the shadows
          if (m.isMeshBasicMaterial) {
            o.material = new THREE.MeshStandardMaterial({ name: m.name, map: m.map, color: m.color, roughness: 0.95, metalness: 0, flatShading: !o.geometry.attributes.normal, side: m.side, alphaTest: m.alphaTest, transparent: m.transparent });
            m.dispose(); m = o.material;
            // part of the painting's own light stays (the lamplit door still glows, the shade side keeps its colour);
            // the painted ground is darker under the sun, so it ends where the game paints it
            m.emissive = new THREE.Color(1, 1, 1); m.emissiveMap = m.map; m.emissiveIntensity = LIGHT.tex.glow;
            if (/ground/.test(o.name) || /ground/.test(m.name || '')) m.color.multiplyScalar(LIGHT.tex.ground);
          }
          if (m.map) m.map.anisotropy = 4;
        });
        edges.forEach(function (p) { p[0].add(p[1]); });
        root.traverse(function (o) { if (o.isMesh && /cards/.test(o.name + ' ' + (o.parent ? o.parent.name : ''))) { root.userData.bill = billboards(o); if (C.capture && window.LOG) LOG('cards: ' + root.userData.bill.cards.length); } });
        entry.root = root; ok(root);
      }, undefined, bad);
    });
    entry.p.then(function () { keep(key); }, function () { if (cache[key] === entry) delete cache[key]; });
    cache[key] = entry;
    return entry.p;
  }
  // the trees are cut-outs of the painting: each card turns about its own upright axis to face the camera, as in the
  // fly-through, so a tree looks like the game's tree from every side instead of going paper-thin
  function billboards(o) {
    var g = o.geometry, src = g.attributes.position, n = src.count, base = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) { base[3 * i] = src.getX(i); base[3 * i + 1] = src.getY(i); base[3 * i + 2] = src.getZ(i); }
    var attr = new THREE.BufferAttribute(base.slice(), 3); g.setAttribute('position', attr);
    var idx = g.index.array, cards = [];
    for (var t = 0; t + 5 < idx.length; t += 6) {
      var vs = [], cx = 0, cz = 0;
      for (var k = 0; k < 6; k++) if (vs.indexOf(idx[t + k]) < 0) vs.push(idx[t + k]);
      vs.forEach(function (v) { cx += base[3 * v]; cz += base[3 * v + 2]; });
      cards.push({ vs: vs, cx: cx / vs.length, cz: cz / vs.length });
    }
    g.computeBoundingSphere();
    return { attr: attr, base: base, cards: cards, a: 0 };
  }
  function turnCards() {
    var b = shown && shown.root.userData.bill; if (!b) return;
    var a = az * Math.PI / 180; if (a === b.a) return;
    var c = Math.cos(a), s = Math.sin(a), p = b.attr.array, q = b.base;
    b.cards.forEach(function (cd) {
      cd.vs.forEach(function (v) {
        var dx = q[3 * v] - cd.cx, dz = q[3 * v + 2] - cd.cz;
        p[3 * v] = cd.cx + dx * c + dz * s; p[3 * v + 2] = cd.cz - dx * s + dz * c;
      });
    });
    b.a = a; b.attr.needsUpdate = true;
  }
  function frustum() {
    turnCards();
    var f = cur.view.frustum, l = f[0], r = f[1], t = f[2], b = f[3];
    var w = stage.clientWidth || 1, h = stage.clientHeight || 1, as = w / h, ai = (r - l) / (t - b);
    if (as > ai) { var cx = (l + r) / 2, hw = (t - b) * as / 2; l = cx - hw; r = cx + hw; }
    else { var cy = (t + b) / 2, hh = (r - l) / as / 2; t = cy + hh; b = cy - hh; }
    cam.left = l; cam.right = r; cam.top = t; cam.bottom = b; cam.zoom = zoom;
    var c = cur.view.center, a = az * Math.PI / 180, e = el * Math.PI / 180, D = 1500;
    cam.position.set(c[0] + D * Math.cos(e) * Math.sin(a), c[1] + D * Math.sin(e), c[2] + D * Math.cos(e) * Math.cos(a));
    cam.up.set(0, 1, 0); cam.lookAt(c[0], c[1], c[2]); cam.updateProjectionMatrix();
  }
  function size() {
    if (!renderer) return;
    var w = stage.clientWidth, h = stage.clientHeight;
    if (w && h) renderer.setSize(w, h, false);
    draw();
  }
  function draw() {
    if (!renderer || !cur || raf) return;
    raf = requestAnimationFrame(function () { raf = 0; if (!shown) return; frustum(); renderer.render(scene, cam); });
  }
  function show() {
    if (!cur) return;
    var it = cur, v = modelView();
    paint();
    if (!v || !near) return;
    if (shown && shown.slug === it.slug && shown.view === v) { ++pending; say(''); draw(); resume(); if (C.onshown) C.onshown(it, v); return; }
    var my = ++pending;
    say(bdT('Loading the model…'));
    needThree().then(function () { return load(it, v); }).then(function (root) {
      if (my !== pending || it !== cur || v !== view) return;
      if (shown) scene.remove(shown.root);
      scene.add(root); shown = { slug: it.slug, view: v, root: root }; fitSun(root); lightFor(v);
      say(''); frustum(); renderer.render(scene, cam); paint(); keep(it.slug + '_' + v); resume();
      if (C.onshown) C.onshown(it, v);
    }).catch(function (err) { if (C.capture && window.LOG) window.LOG('viewer: ' + (err && err.message || err)); if (my === pending) say(bdT('The 3D view could not start here. The pictures and the downloads still work.')); });
  }

  // ---------- choosing a building and a view
  function pick(slug, keepView) {
    var it = byslug[slug]; if (!it) return;
    cur = it; az = 0; el = 30; zoom = 1; rotated = false;
    if (mode === 'turn') { halt(); spin(); }
    if (!keepView) view = 'clay';
    if (!C.flags.original) mode = 'turn';
    stage.style.setProperty('--ar', it.view.aspect);
    imgO.src = C.flags.original ? file(it, 'original') : '';
    imgO.alt = C.flags.original ? bdT('{name} as the game paints it', { name: it.title }) : '';
    [].forEach.call(document.querySelectorAll('.picker [data-pick]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-pick') === slug ? 'true' : 'false'); });
    [].forEach.call(document.querySelectorAll('[data-for]'), function (x) { x.hidden = x.getAttribute('data-for') !== slug; });
    show();
  }
  document.addEventListener('click', function (e) {
    var p = e.target.closest && e.target.closest('[data-pick]');
    if (p) { pick(p.getAttribute('data-pick'), true); if (p.hasAttribute('data-scroll')) $('viewer').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); return; }
    var v = e.target.closest && e.target.closest('[data-view]');
    if (v) { view = v.getAttribute('data-view'); show(); return; }
    var m = e.target.closest && e.target.closest('[data-mode]');
    if (m) { setMode(m.getAttribute('data-mode')); if (m.classList.contains('go3d')) stage.focus(); return; }
    var k = e.target.closest && e.target.closest('[data-act]');
    if (k) act(k.getAttribute('data-act'));
  });
  function setMode(m) {
    if (m === 'compare' && !C.flags.original) m = 'turn';
    mode = m; az = 0; el = 30; zoom = 1; rotated = false; pts = {};
    show();
    if (mode === 'turn') spin(); else halt();
  }
  // the 3D view turns by itself, slowly, until the visitor takes it (or asks for less motion)
  // the frame loop stops itself while the stage is off screen or has no model up; resume() starts it again
  var wantSpin = false, spinning = false, spinT = 0, onScreen = true;
  function spin() { if (reduce || C.capture) return; wantSpin = true; resume(); }
  function resume() {
    if (!wantSpin || spinning || !onScreen || mode !== 'turn' || !shown || !cur || shown.slug !== cur.slug) return;
    spinning = true; spinT = 0;
    requestAnimationFrame(function step(t) {
      if (!wantSpin || !onScreen || mode !== 'turn' || !shown || shown.slug !== cur.slug || shown.view !== view) { spinning = false; return; }
      if (spinT) { az += (t - spinT) * 0.012; turned(); }
      spinT = t; requestAnimationFrame(step);
    });
  }
  function halt() { wantSpin = false; }
  function setSplit(x) { split = Math.max(0, Math.min(1, x)); paint(); }
  function turned() { rotated = !(az === 0 && el === 30 && zoom === 1); paint(); if (shown && shown.view === view && shown.slug === cur.slug) draw(); }
  function act(a) {
    if (mode !== 'turn') return;
    halt();
    if (a === 'left') az -= 15; else if (a === 'right') az += 15;
    else if (a === 'up') el = Math.min(88, el + 10); else if (a === 'down') el = Math.max(4, el - 10);
    else if (a === 'in') zoom = Math.min(8, zoom * 1.25); else if (a === 'out') zoom = Math.max(0.4, zoom / 1.25);
    else if (a === 'reset') { az = 0; el = 30; zoom = 1; }
    turned();
  }

  // ---------- turning it: mouse drag, one finger sideways, two fingers to zoom and tilt; the page still scrolls
  var pts = {}, last = null, pinch = 0;
  function n() { return Object.keys(pts).length; }
  stage.addEventListener('pointerdown', function (e) {
    if (e.target.closest('button,input,a')) return;
    halt();
    active = true; stage.classList.add('active');
    pts[e.pointerId] = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: e.pointerType };
    try { stage.setPointerCapture(e.pointerId); } catch (_) { }
    last = { x: e.clientX, y: e.clientY }; pinch = 0;
    if (mode === 'compare') { e.preventDefault(); slide(e); }
  });
  stage.addEventListener('dragstart', function (e) { e.preventDefault(); });
  function slide(e) { var r = stage.getBoundingClientRect(); setSplit((e.clientX - r.left) / r.width); }
  stage.addEventListener('pointermove', function (e) {
    var p = pts[e.pointerId]; if (!p) return;
    if (mode === 'compare') { slide(e); return; }
    if (n() === 1) {
      p.x = e.clientX; p.y = e.clientY;
      var dx = e.clientX - last.x, dy = e.clientY - last.y;
      if (!rotated && Math.abs(e.clientX - p.sx) < 4 && Math.abs(e.clientY - p.sy) < 4) return;
      az -= dx * 0.4;
      if (p.t !== 'touch') el = Math.max(4, Math.min(88, el + dy * 0.3));
      last = { x: e.clientX, y: e.clientY }; turned();
    } else if (n() === 2) {
      p.x = e.clientX; p.y = e.clientY;
      var k = Object.keys(pts), a = pts[k[0]], b = pts[k[1]], d = Math.hypot(a.x - b.x, a.y - b.y), my = (a.y + b.y) / 2;
      if (pinch) { zoom = Math.max(0.4, Math.min(8, zoom * d / pinch.d)); el = Math.max(4, Math.min(88, el + (my - pinch.y) * 0.3)); turned(); }
      pinch = { d: d, y: my };
    }
  });
  function up(e) {
    delete pts[e.pointerId]; pinch = 0;
    var k = Object.keys(pts); if (k.length) last = { x: pts[k[0]].x, y: pts[k[0]].y };   // the finger still down goes on turning from where it is
  }
  stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
  document.addEventListener('pointerdown', function (e) { if (!stage.contains(e.target)) { active = false; stage.classList.remove('active'); } });
  // the wheel zooms only after a click inside, so scrolling the page past the viewer is never caught
  stage.addEventListener('wheel', function (e) {
    if (mode !== 'turn' || (!active && !e.ctrlKey)) return;
    halt();
    e.preventDefault();
    var px = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
    zoom = Math.max(0.4, Math.min(8, zoom * Math.exp(-Math.max(-1, Math.min(1, px * (e.ctrlKey ? 0.01 : 0.0015)))))); turned();
  }, { passive: false });
  stage.addEventListener('keydown', function (e) {
    if (mode === 'compare' && e.target === stage) {
      var d = { ArrowLeft: -1, ArrowRight: 1 }[e.key], ends = { Home: 0, End: 1 }[e.key];
      if (d) { e.preventDefault(); setSplit(split + d * (e.shiftKey ? 0.1 : 0.02)); }
      else if (ends != null) { e.preventDefault(); setSplit(ends); }
      return;
    }
    var m = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', '+': 'in', '=': 'in', '-': 'out', '0': 'reset', Escape: 'reset' }[e.key];
    if (m && e.target === stage) { e.preventDefault(); act(m); }
  });

  // ---------- start: pictures at once, the 3D when the viewer comes near the screen
  var near = false;
  function arrive() { if (near) return; near = true; show(); }
  if (C.capture) arrive();
  else if ('IntersectionObserver' in window) new IntersectionObserver(function (es, io) { es.forEach(function (x) { if (x.isIntersecting) { io.disconnect(); arrive(); } }); }, { rootMargin: '300px 0px' }).observe(stage);
  else arrive();
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; resume(); }).observe(stage);
  if ('ResizeObserver' in window) new ResizeObserver(size).observe(stage); else addEventListener('resize', size);
  var first = (location.hash || '').slice(1);
  // on a small screen the viewer opens on the Cathedral (a small file); the whole town, the heaviest, is one tap away
  var small = matchMedia('(max-width: 760px)').matches && !C.capture;
  pick(byslug[first] ? first : (small && byslug.cathedral ? 'cathedral' : (C.first || C.items[0].slug)));
  if (C.capture) window.T3D_API = { go: function (sl, v) { view = v; pick(sl, true); }, pick: pick, setView: function (v) { view = v; show(); }, setMode: setMode,
    sunTurn: function (deg) { var a = deg * Math.PI / 180, d = LIGHT.dir0 || (LIGHT.dir0 = LIGHT.dir.slice()); LIGHT.dir = [d[0] * Math.cos(a) + d[2] * Math.sin(a), d[1], -d[0] * Math.sin(a) + d[2] * Math.cos(a)]; if (shown) fitSun(shown.root); },
    frame: function (a, e, z, c) { az = a; el = e; zoom = z; var k = cur.view.center; if (c) cur.view.center = c; frustum(); renderer.render(scene, cam); cur.view.center = k; },
    // the middle of the parts whose names match: the header loop turns round the houses, not the board
    centreOf: function (re) { var b = new THREE.Box3(); shown.root.updateMatrixWorld(true); shown.root.traverse(function (o) { if (o.isMesh && re.test(o.name || (o.parent && o.parent.name) || '')) b.expandByObject(o); }); var c = b.getCenter(new THREE.Vector3()); return [c.x, c.y, c.z]; }, canvas: canvas };
})();
