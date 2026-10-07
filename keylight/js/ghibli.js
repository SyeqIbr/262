"use strict";
/* Cinematic painted scenes: layered landscapes with depth, drifting clouds, wind in the grass,
   light shafts, and a camera that slowly drifts and lifts into the sky at the end.
   Scenery is painted once into layer canvases; each frame only moves layers and draws the
   animated bits (grass, particles, birds, light). */
const Ghibli = (() => {
  const { rng, shade, mix, ellipse, deform, trace, bezier, ribbon } = Painter;
  const TAU = Math.PI * 2;
  const pcIndex = p => (p % 12) * 7 % 12;
  const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const SERIF = '"Shippori Mincho", "Cormorant Garamond", "Hiragino Mincho ProN", Georgia, serif';

  const TIMES = {
    day: {
      label: "Summer day", skyTop: "#2c69bd", skyMid: "#6aa7e2", horizon: "#d6ecf5", sun: "#fffbe8", sunPos: [0.78, 0.12],
      cloudLit: "#ffffff", cloudShade: "#a9bddb", cloudWarm: "#fff6ea", haze: "#a8c8e0", far: "#7ea5c8", mid: "#5d9a63", near: "#4b8a45", foot: "#2f5f2e",
      grass: ["#5e9e45", "#77b250", "#93c45d", "#4a8a3c", "#b3d470"], flowers: ["#ffffff", "#ffe27a", "#ffb0c4", "#d9ccff"],
      light: "#fff3c8", bark: "#4a3a2c", leaf: ["#3f7a3a", "#5a9a45", "#7cb757", "#2f6230"], sea: ["#2b66ad", "#5c9fd6", "#a8d6ee"],
      wall: "#f6efe2", roofs: ["#c8553d", "#3f8f8a", "#d98b3a", "#5d7fb5", "#b7643f"], rays: 0.18, night: false
    },
    golden: {
      label: "Golden hour", skyTop: "#4874b8", skyMid: "#e7b78c", horizon: "#ffdca3", sun: "#fff1c4", sunPos: [0.72, 0.3],
      cloudLit: "#fff0d2", cloudShade: "#b98f9a", cloudWarm: "#ffc489", haze: "#d8b39c", far: "#9e8a92", mid: "#728d4d", near: "#5f803a", foot: "#384d22",
      grass: ["#7f9a3f", "#a6b04a", "#c9b65c", "#6a8a35", "#e0c46a"], flowers: ["#fff4d6", "#ffd06a", "#ff9e7a", "#efb8ff"],
      light: "#ffd890", bark: "#3f2f22", leaf: ["#4f6f2f", "#6f8f3a", "#a3a94a", "#3a5525"], sea: ["#4a68a0", "#c99a86", "#ffd3a0"],
      wall: "#fbe6c8", roofs: ["#b8492f", "#3f7f7a", "#c97a2f", "#5a6fa0", "#a8553a"], rays: 0.32, night: false
    },
    dusk: {
      label: "Dusk", skyTop: "#232a66", skyMid: "#a86799", horizon: "#ffb08a", sun: "#ffe2c8", sunPos: [0.3, 0.38],
      cloudLit: "#ffc6b2", cloudShade: "#5f5288", cloudWarm: "#ff9e8a", haze: "#8a6f9a", far: "#5d5483", mid: "#3d585a", near: "#334a40", foot: "#1a2a26",
      grass: ["#3f5f45", "#50704f", "#6a7f55", "#2f4a3a", "#86905f"], flowers: ["#ffd0e0", "#ffe0a0", "#c4b4ff", "#ffffff"],
      light: "#ffc8a0", bark: "#2a2230", leaf: ["#2f4a40", "#3f5f4a", "#5a6f50", "#22382f"], sea: ["#36397a", "#a8708f", "#ffb59a"],
      wall: "#e8c8c8", roofs: ["#8f3f4f", "#3f5f7a", "#a8603f", "#4f4f8a", "#7f3f5f"], rays: 0.22, night: false, lamps: true
    },
    night: {
      label: "Starry night", skyTop: "#050a22", skyMid: "#132157", horizon: "#34468a", sun: "#f4f1de", sunPos: [0.74, 0.14],
      cloudLit: "#6f7fb6", cloudShade: "#1c254d", cloudWarm: "#8f9fd6", haze: "#28346a", far: "#1d2954", mid: "#163048", near: "#13283a", foot: "#08131c",
      grass: ["#1f3f45", "#2a4f50", "#36615a", "#183236", "#457068"], flowers: ["#cfe8ff", "#fff4c0", "#b8c8ff", "#ffffff"],
      light: "#cfe0ff", bark: "#121a26", leaf: ["#17303a", "#1f3f45", "#2f5550", "#10242c"], sea: ["#0d1c48", "#24397a", "#7f97d6"],
      wall: "#9aa6cf", roofs: ["#3a3f6f", "#2f4f6a", "#5a4a6f", "#2f3a5f", "#4a3f5f"], rays: 0.1, night: true, lamps: true
    }
  };

  let song = null, analysis = null, sceneName = "hill", timeName = "day", lookahead = 2.2, rangeMode = "auto";
  let C = null, dirty = true;

  /* ---------- layout ---------- */
  function layout(W, H) {
    const portrait = H >= W;
    const kbH = Math.round(H * (portrait ? 0.085 : 0.13)), kbY = Math.round(H - kbH - H * 0.018);
    const SH = Math.round(H * (portrait ? 0.7 : 0.66)), horizon = Math.round(H * (portrait ? 0.42 : 0.44));
    const u = Math.min(W * 16 / 9, H) / 1920, M = Math.round(W * 0.14);
    return { W, H, kbH, kbY, SH, horizon, u, M, portrait };
  }
  function keyLayout(L) {
    let lo = 21, hi = 108;
    if (rangeMode !== "88" && song) {
      lo = 127; hi = 0; for (const n of song.notes) { lo = Math.min(lo, n.pitch); hi = Math.max(hi, n.pitch); }
      lo -= 2; hi += 2; while (hi - lo < 36) { lo--; hi++; }
      lo = clamp(lo, 21, 108); hi = clamp(hi, 21, 108);
      while (isBlack(lo)) lo--; while (isBlack(hi)) hi++;
    }
    const margin = L.W * 0.025, KW = L.W - margin * 2;
    let whites = 0; for (let p = lo; p <= hi; p++) if (!isBlack(p)) whites++;
    const ww = KW / whites, keys = [], keyOf = [], adj = { 1: -0.06, 3: 0.06, 6: -0.08, 8: 0, 10: 0.08 };
    let wi = 0;
    for (let p = lo; p <= hi; p++) {
      let k;
      if (!isBlack(p)) { k = { p, x: margin + wi * ww, w: ww, black: false }; wi++; }
      else { const bw = ww * 0.58; k = { p, x: margin + wi * ww + adj[p % 12] * ww - bw / 2, w: bw, black: true }; }
      k.cx = k.x + k.w / 2; keys.push(k); keyOf[p] = k;
    }
    return { keys, keyOf, ww };
  }

  /* ---------- painting helpers ---------- */
  function fillPoly(g, pts, style) { g.fillStyle = style; trace(g, pts); g.fill(); }
  function vgrad(g, y0, y1, stops) { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
  // A ridge line: smooth random heights across [x0, x1]
  function ridge(R, x0, x1, yBase, amp, step, rough = 0.5) {
    const pts = []; let y = 0, v = 0;
    for (let x = x0; x <= x1 + step; x += step) { v += (R() - 0.5) * rough; v *= 0.85; y = clamp(y + v, -1, 1); pts.push([x, yBase - amp * (0.5 + 0.5 * Math.sin(x * 0.004 + y)) - y * amp * 0.3]); }
    return pts;
  }
  // Peaked mountain line built from ridged sine layers
  function peaks(R, x0, x1, yBase, amp, step) {
    const ph = [R() * 9, R() * 9, R() * 9, R() * 9], f = [1.3, 2.9, 6.1, 13] .map(v => v / (x1 - x0) * Math.PI);
    const pts = [];
    for (let x = x0; x <= x1 + step; x += step) {
      const r = (k) => 1 - Math.abs(Math.sin(x * f[k] + ph[k]));
      const h = 0.45 * r(0) + 0.3 * r(1) + 0.17 * Math.sin(x * f[2] + ph[2]) * 0.5 + 0.08 * r(3) + (R() - 0.5) * 0.02;
      pts.push([x, yBase - amp * h]);
    }
    return pts;
  }
  // Brushy texture strokes inside a region (gives the flat colours a painted surface)
  function strokes(g, R, x0, y0, w, h, colors, n, len, width, angle = 0, alpha = 0.18) {
    g.save(); g.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const x = x0 + R() * w, y = y0 + R() * h, a = angle + (R() - 0.5) * 0.5, l = len * (0.5 + R());
      g.globalAlpha = alpha * (0.5 + R() * 0.5); g.strokeStyle = colors[Math.floor(R() * colors.length)]; g.lineWidth = width * (0.6 + R() * 0.8);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    g.restore();
  }
  // A cumulus cloud: one painted silhouette with soft sunlight and a cool shadowed base
  function makeCloud(w, h, P, R, lightX) {
    const cv = mkCanvas(Math.ceil(w), Math.ceil(h)), g = cv.getContext("2d");
    const blobs = [];
    for (let i = 0; i < 34; i++) {
      const x = w * (0.12 + R() * 0.76), prof = Math.sin(((x / w) - 0.08) / 0.84 * Math.PI);
      const r = h * (0.12 + R() * 0.15) * (0.55 + prof * 0.75);
      blobs.push({ x, y: h * 0.8 - prof * h * 0.48 * Math.sqrt(R()) - r * 0.2, r });
    }
    g.fillStyle = mix(P.cloudLit, P.cloudShade, 0.5);
    for (const b of blobs) { trace(g, deform(ellipse(b.x, b.y, b.r, b.r * 0.9, 20), 2, 0.12, R)); g.fill(); }
    g.fillRect(w * 0.14, h * 0.62, w * 0.72, h * 0.18);
    g.globalCompositeOperation = "source-atop";
    for (const b of blobs) { // soft sunlit tops
      const x = b.x - lightX * b.r * 0.25, y = b.y - b.r * 0.45, r = b.r * 1.6;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, P.cloudLit); gr.addColorStop(0.45, mix(P.cloudLit, P.cloudWarm, 0.35)); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.globalAlpha = 0.45; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
    g.fillStyle = vgrad(g, h * 0.45, h, [[0, "rgba(0,0,0,0)"], [1, P.cloudShade]]); g.fillRect(0, h * 0.45, w, h * 0.55);
    strokes(g, R, 0, 0, w, h * 0.6, [P.cloudLit, P.cloudWarm], 60, w * 0.05, h * 0.02, -0.15, 0.25);
    g.globalCompositeOperation = "source-over";
    return cv;
  }
  // Tree with a clumpy, sunlit crown. Origin: bottom centre of the trunk.
  function makeTree(w, h, P, R, lightX) {
    const cv = mkCanvas(Math.ceil(w), Math.ceil(h)), g = cv.getContext("2d"), bx = w / 2, by = h;
    const trunk = ribbon(bezier([bx, by], [bx - w * 0.02, by - h * 0.3], [bx + w * 0.03, by - h * 0.55], 14), w * 0.07, w * 0.035);
    fillPoly(g, trunk, P.bark);
    for (const [ex, ey] of [[-0.25, 0.62], [0.22, 0.66], [-0.1, 0.75], [0.12, 0.8]]) fillPoly(g, ribbon(bezier([bx, by - h * 0.45], [bx + w * ex * 0.5, by - h * (ey - 0.05)], [bx + w * ex, by - h * ey], 10), w * 0.03, w * 0.01), P.bark);
    const cx = bx, cy = by - h * 0.66, rx = w * 0.46, ry = h * 0.32;
    const clumps = [];
    for (let i = 0; i < 46; i++) { const a = R() * TAU, d = Math.sqrt(R()); clumps.push({ x: cx + Math.cos(a) * rx * d, y: cy + Math.sin(a) * ry * d * 0.9 - ry * 0.05, r: w * (0.07 + R() * 0.07) }); }
    crown(g, clumps, P, R, lightX, cy - ry, cy + ry);
    return cv;
  }

  // Leafy mass: dark silhouette, soft sunlit clumps clipped inside, leaf texture on top
  function crown(g, clumps, P, R, lightX, top, bottom) {
    g.fillStyle = P.leaf[3];
    for (const c of clumps) { trace(g, deform(ellipse(c.x, c.y, c.r, c.r * 0.85, 16), 2, 0.25, R)); g.fill(); }
    g.save(); g.globalCompositeOperation = "source-atop";
    for (const c of clumps) {
      const lit = clamp(0.75 - (c.y - top) / (bottom - top) * 0.9 + lightX * 0.15, 0, 1);
      const x = c.x + lightX * c.r * 0.3, y = c.y - c.r * 0.35, r = c.r * 1.1;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, mix(mix(P.leaf[1], P.leaf[2], lit), P.light, 0.2 * lit)); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.globalAlpha = 0.35 + lit * 0.6; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
    let x0 = 1e9, x1 = -1e9; for (const c of clumps) { x0 = Math.min(x0, c.x - c.r); x1 = Math.max(x1, c.x + c.r); }
    // small leaf clusters catching light
    const n = clamp(Math.round((x1 - x0) * (bottom - top) / 900), 20, 900);
    for (let i = 0; i < n; i++) {
      const c = clumps[Math.floor(R() * clumps.length)], a = R() * TAU, d = R() * c.r * 0.9, x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d * 0.8, r = c.r * (0.08 + R() * 0.1);
      g.globalAlpha = 0.25 + R() * 0.3; g.fillStyle = y < c.y ? mix(P.leaf[2], P.light, 0.2) : P.leaf[3];
      g.beginPath(); g.ellipse(x, y, r, r * 0.7, R() * 3, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
    g.restore();
  }

  // Soft sunbeams, painted once and swayed per frame
  function makeRays(L, P, R, shafts) {
    const size = Math.round(Math.max(L.W, L.H) * 1.2), cv = mkCanvas(size, size), g = cv.getContext("2d"), c = size / 2;
    const n = shafts ? 7 : 6;
    for (let i = 0; i < n; i++) {
      const a = Math.PI / 2 + (shafts ? -0.35 : 0) + (i - (n - 1) / 2) * (shafts ? 0.15 : 0.2) + (R() - 0.5) * 0.05;
      const spread = (shafts ? 0.03 : 0.05) * (0.6 + R() * 0.8), len = c;
      for (let k = 0; k < 16; k++) {
        const sp = spread * (0.15 + k * 0.1);
        const gr = g.createLinearGradient(c, c, c + Math.cos(a) * len, c + Math.sin(a) * len);
        gr.addColorStop(0, P.light); gr.addColorStop(0.6, mix(P.light, "#000000", 0.6)); gr.addColorStop(1, "rgba(0,0,0,0)");
        g.globalAlpha = 0.035; g.fillStyle = gr; g.beginPath(); g.moveTo(c, c);
        g.lineTo(c + Math.cos(a - sp) * len, c + Math.sin(a - sp) * len); g.lineTo(c + Math.cos(a + sp) * len, c + Math.sin(a + sp) * len); g.fill();
      }
    }
    return cv;
  }
  // Cached soft glow sprites, one per colour
  const glowCache = new Map();
  function glowSprite(color) {
    let s = glowCache.get(color);
    if (!s) {
      s = mkCanvas(64, 64); const g = s.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, color); gr.addColorStop(0.25, color); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64); glowCache.set(color, s);
    }
    return s;
  }

  /* ---------- scenes ---------- */
  // Each returns { layers: [{cv, x, y, par}], blades: [...], extras } built in layer-space coordinates
  function layerCanvas(L, y0, y1) { const cv = mkCanvas(L.W + L.M * 2, Math.max(1, Math.round(y1 - y0))); cv.y0 = y0; return cv; }

  function farMountains(L, P, R) {
    const cv = layerCanvas(L, L.horizon - L.H * 0.2, L.horizon + L.H * 0.12), g = cv.getContext("2d"), y0 = cv.y0, W2 = cv.width;
    for (const [k, col] of [[0, mix(P.far, P.haze, 0.55)], [1, mix(P.far, P.haze, 0.2)]]) {
      const pts = peaks(R, 0, W2, L.horizon - y0 + L.H * (0.02 + k * 0.02), L.H * (0.2 - k * 0.07), 6 * L.u);
      pts.push([W2, cv.height], [0, cv.height]);
      fillPoly(g, pts, vgrad(g, 0, cv.height, [[0, shade(col, 0.06)], [1, mix(col, P.haze, 0.6)]]));
      // sunlit snow / light catching the ridges
      g.save(); trace(g, pts); g.clip(); strokes(g, R, 0, 0, W2, cv.height * 0.5, [shade(col, 0.2), shade(col, -0.08)], 160, 30 * L.u, 5 * L.u, -0.5, 0.2); g.restore();
    }
    return { cv, par: 0.15 };
  }
  function rollingHills(L, P, R, top, colorA, colorB, par, trees) {
    const cv = layerCanvas(L, top - L.H * 0.06, L.SH + L.H * 0.02), g = cv.getContext("2d"), y0 = cv.y0, W2 = cv.width;
    const pts = ridge(R, 0, W2, top - y0 + L.H * 0.03, L.H * 0.035, 22 * L.u, 0.6);
    const edge = pts.slice();
    pts.push([W2, cv.height], [0, cv.height]);
    fillPoly(g, pts, vgrad(g, 0, cv.height, [[0, colorA], [1, colorB]]));
    g.save(); trace(g, pts); g.clip();
    strokes(g, R, 0, 0, W2, cv.height, [shade(colorA, 0.12), shade(colorB, -0.1), P.grass[2]], 700, 26 * L.u, 4 * L.u, -0.1, 0.16);
    g.restore();
    if (trees) for (let i = 0; i < trees; i++) { // distant tree clumps along the ridge
      const p = edge[Math.floor(R() * edge.length)], r = (10 + R() * 16) * L.u;
      for (let k = 0; k < 4; k++) { g.fillStyle = mix(shade(P.leaf[k % 4], -0.05), P.haze, 0.25); trace(g, ellipse(p[0] + (k - 1.5) * r * 0.7, p[1] - r * (0.5 + R() * 0.6), r, r * 0.9, 12)); g.fill(); }
    }
    return { cv, par, edge: edge.map(([x, y]) => [x, y + y0]) };
  }
  function foreground(L, P, R) {
    const cv = layerCanvas(L, L.SH - L.H * 0.05, L.H), g = cv.getContext("2d"), y0 = cv.y0, W2 = cv.width;
    const pts = ridge(R, 0, W2, L.SH - y0, L.H * 0.012, 30 * L.u, 0.5);
    const edge = pts.slice(); pts.push([W2, cv.height], [0, cv.height]);
    fillPoly(g, pts, vgrad(g, 0, cv.height, [[0, P.near], [0.2, mix(P.near, P.foot, 0.5)], [0.7, P.foot], [1, mix(P.foot, "#000000", 0.35)]]));
    g.save(); trace(g, pts); g.clip();
    strokes(g, R, 0, 0, W2, cv.height * 0.6, [shade(P.near, 0.12), P.grass[3], P.grass[0]], 2200, 26 * L.u, 3 * L.u, -1.45, 0.22);
    strokes(g, R, 0, cv.height * 0.3, W2, cv.height * 0.7, [P.foot, shade(P.foot, 0.15)], 1200, 40 * L.u, 4 * L.u, -1.5, 0.25);
    g.restore();
    return { cv, par: 1, edge: edge.map(([x, y]) => [x, y + y0]) };
  }

  // Tall grass at the bottom corners, close to the camera
  function corners(L) {
    const e = [];
    for (let x = 0; x <= L.M + L.W * 0.18; x += 8 * L.u) e.push([x, L.kbY - 6 * L.u]);
    const e2 = []; for (let x = L.M + L.W * 0.82; x <= L.W + L.M * 2; x += 8 * L.u) e2.push([x, L.kbY - 6 * L.u]);
    return { edge: e.concat([[L.M + L.W * 0.5, L.kbY + 400 * L.u]]).concat(e2), par: 1.15, n: 160, h: 150, w: 6, cornerOnly: true };
  }
  const SCENES = {
    hill: {
      label: "Hilltop",
      build(L, P, R, S) {
        const layers = [farMountains(L, P, R)];
        layers.push(rollingHills(L, P, R, L.horizon + L.H * 0.02, mix(P.mid, P.haze, 0.35), mix(P.mid, P.near, 0.4), 0.3, 26));
        // the big hill on the right, with its lone tree
        const cv = layerCanvas(L, L.H * 0.4, L.SH + L.H * 0.03), g = cv.getContext("2d"), y0 = cv.y0, W2 = cv.width;
        const peakX = L.M + L.W * 0.66, peakY = L.H * (L.portrait ? 0.53 : 0.52) - y0;
        const hill = bezier([L.M + L.W * 0.05, cv.height], [peakX - L.W * 0.25, peakY - L.H * 0.02], [peakX, peakY], 20).concat(bezier([peakX, peakY], [peakX + L.W * 0.3, peakY], [W2, peakY + L.H * 0.05], 16).slice(1));
        hill.push([W2, cv.height]);
        fillPoly(g, hill, vgrad(g, peakY, cv.height, [[0, shade(P.near, 0.12)], [1, mix(P.near, P.foot, 0.3)]]));
        g.save(); trace(g, hill); g.clip(); strokes(g, R, 0, 0, W2, cv.height, [P.grass[2], P.grass[4], shade(P.near, -0.1)], 900, 28 * L.u, 4.5 * L.u, -0.2, 0.2); g.restore();
        layers.push({ cv, par: 0.55, edge: hill.slice(0, -1).map(([x, y]) => [x, y + y0]) });
        layers.push(foreground(L, P, R));
        const tw = 420 * L.u, th = 470 * L.u;
        S.tree = { cv: makeTree(tw, th, P, R, P.sunPos[0] > 0.5 ? 1 : -1), x: peakX + 20 * L.u, y: peakY + y0 + 8 * L.u, par: 0.55 };
        S.figure = { x: peakX - 170 * L.u, y: peakY + y0 + 6 * L.u, par: 0.55 };
        S.blades = [{ edge: layers[2].edge, par: 0.55, n: 260, h: 18, w: 2.2 }, { edge: layers[3].edge, par: 1, n: 380, h: 60, w: 4 }, corners(L)];
        S.clouds = 6;
        return layers;
      }
    },
    sea: {
      label: "Seaside town",
      build(L, P, R, S) {
        const layers = [];
        // the sea, with a far island
        const cv = layerCanvas(L, L.horizon - L.H * 0.04, L.SH + L.H * 0.02), g = cv.getContext("2d"), y0 = cv.y0, W2 = cv.width, hz = L.horizon - y0;
        const isl = ridge(R, W2 * 0.55, W2 * 0.85, hz, L.H * 0.025, 12 * L.u, 0.9); isl.push([W2 * 0.85, hz], [W2 * 0.55, hz]);
        fillPoly(g, isl, mix(P.far, P.haze, 0.45));
        g.fillStyle = vgrad(g, hz, cv.height, [[0, P.sea[2]], [0.15, P.sea[1]], [1, P.sea[0]]]); g.fillRect(0, hz, W2, cv.height - hz);
        strokes(g, R, 0, hz, W2, cv.height - hz, [shade(P.sea[1], 0.15), shade(P.sea[0], -0.1)], 900, 40 * L.u, 2.5 * L.u, 0, 0.25);
        layers.push({ cv, par: 0.2 });
        S.sea = { y0: L.horizon, y1: L.SH, par: 0.2 };
        // lighthouse on a small cliff
        const lc = layerCanvas(L, L.horizon - L.H * 0.12, L.horizon + L.H * 0.04), lg = lc.getContext("2d"), lx = L.M + L.W * 0.86, ly = L.horizon - lc.y0 + L.H * 0.01;
        fillPoly(lg, [[lx - 60 * L.u, ly + 20 * L.u], [lx - 30 * L.u, ly - 20 * L.u], [lx + 50 * L.u, ly - 26 * L.u], [lx + 90 * L.u, ly + 20 * L.u]], mix(P.mid, P.haze, 0.3));
        fillPoly(lg, [[lx - 9 * L.u, ly - 22 * L.u], [lx - 6 * L.u, ly - 110 * L.u], [lx + 6 * L.u, ly - 110 * L.u], [lx + 9 * L.u, ly - 22 * L.u]], P.wall);
        lg.fillStyle = P.roofs[0];
        for (let k = 0; k < 3; k++) lg.fillRect(lx - 8 * L.u, ly - (40 + k * 26) * L.u, 16 * L.u, 7 * L.u);
        fillPoly(lg, [[lx - 10 * L.u, ly - 110 * L.u], [lx, ly - 126 * L.u], [lx + 10 * L.u, ly - 110 * L.u]], P.roofs[0]);
        layers.push({ cv: lc, par: 0.25 });
        S.beacon = { x: lx, y: lc.y0 + ly - 112 * L.u, par: 0.25 };
        // hillside town on the left
        const tc = layerCanvas(L, L.H * 0.3, L.SH + L.H * 0.03), tg = tc.getContext("2d"), ty0 = tc.y0;
        const slope = x => (L.SH - ty0) - (1 - clamp((x - L.M * 0.2) / (L.W * 0.62), 0, 1)) * L.H * 0.26;
        const hillPts = [[0, slope(0) - 20 * L.u]]; for (let x = 0; x <= L.M + L.W * 0.7; x += 20 * L.u) hillPts.push([x, slope(x)]);
        hillPts.push([L.M + L.W * 0.75, tc.height], [0, tc.height]);
        fillPoly(tg, hillPts, vgrad(tg, 0, tc.height, [[0, P.mid], [1, mix(P.mid, P.foot, 0.4)]]));
        S.windows = [];
        const houses = [];
        for (let row = 0; row < 6; row++) for (let i = 0; i < 9; i++) {
          if (R() < 0.3) continue;
          const x = L.M * 0.4 + i * 76 * L.u + (row % 2) * 34 * L.u + (R() - 0.5) * 20 * L.u;
          if (x > L.M + L.W * 0.55) continue;
          const base = slope(x) - row * 0;
          const y = base - row * 52 * L.u - R() * 10 * L.u;
          if (y < slope(x) - L.H * 0.24) continue;
          houses.push({ x, y, w: (48 + R() * 26) * L.u, h: (38 + R() * 24) * L.u, roof: P.roofs[Math.floor(R() * P.roofs.length)] });
        }
        houses.sort((a, b) => a.y - b.y);
        for (const hs of houses) {
          const lit = shade(P.wall, P.sunPos[0] > 0.5 ? 0.05 : -0.08), dark = shade(P.wall, -0.22);
          tg.fillStyle = lit; tg.fillRect(hs.x, hs.y - hs.h, hs.w, hs.h + 30 * L.u);
          tg.fillStyle = dark; tg.fillRect(hs.x + hs.w * 0.72, hs.y - hs.h, hs.w * 0.28, hs.h + 30 * L.u);
          fillPoly(tg, [[hs.x - 5 * L.u, hs.y - hs.h + 2 * L.u], [hs.x + hs.w * 0.5, hs.y - hs.h - hs.w * 0.36], [hs.x + hs.w + 5 * L.u, hs.y - hs.h + 2 * L.u]], hs.roof);
          for (let k = 0; k < 2; k++) {
            const wx = hs.x + hs.w * (0.18 + k * 0.38), wy = hs.y - hs.h * 0.62, ww = 8 * L.u, wh = 11 * L.u;
            tg.fillStyle = P.night || P.lamps ? shade(P.wall, -0.45) : mix(P.sea[0], "#22324a", 0.5); tg.fillRect(wx, wy, ww, wh);
            S.windows.push({ x: wx + ty0 * 0, y: wy + ty0, w: ww, h: wh, lx: wx - L.M });
          }
        }
        for (let i = 0; i < 26; i++) { // cypress and round trees among the houses
          const x = L.M * 0.3 + R() * (L.W * 0.62), y = slope(x) - R() * L.H * 0.2;
          if (y < slope(x) - L.H * 0.24) continue;
          const r = (10 + R() * 12) * L.u;
          tg.fillStyle = shade(P.leaf[R() < 0.5 ? 0 : 3], 0.05);
          if (R() < 0.5) { trace(tg, ellipse(x, y - r * 2, r * 0.55, r * 2.2, 14)); tg.fill(); }
          else { trace(tg, ellipse(x, y - r, r * 1.2, r, 14)); tg.fill(); tg.fillStyle = shade(P.leaf[2], 0.1); trace(tg, ellipse(x - r * 0.3, y - r * 1.3, r * 0.6, r * 0.45, 10)); tg.fill(); }
        }
        strokes(tg, R, 0, 0, tc.width, tc.height, [shade(P.mid, 0.1), P.grass[3]], 200, 20 * L.u, 3 * L.u, -0.3, 0.12);
        layers.push({ cv: tc, par: 0.5 });
        S.windowsPar = 0.5;
        layers.push(foreground(L, P, R));
        S.blades = [{ edge: layers[layers.length - 1].edge, par: 1, n: 380, h: 56, w: 4 }, corners(L)];
        S.clouds = 5;
        return layers;
      }
    },
    forest: {
      label: "Forest of light",
      build(L, P, R, S) {
        const layers = [];
        const deep = mix(P.leaf[3], P.haze, 0.45);
        // three depths of tall trunks, hazier the further away
        for (let d = 0; d < 3; d++) {
          const cv = layerCanvas(L, 0, L.SH + L.H * 0.03), g = cv.getContext("2d"), W2 = cv.width;
          const haze = [0.62, 0.38, 0.12][d], tcol = mix(P.bark, P.haze, haze), n = [9, 6, 4][d];
          for (let i = 0; i < n; i++) {
            const x = (i + 0.2 + R() * 0.6) / n * W2, w = [26, 46, 90][d] * L.u * (0.7 + R() * 0.6);
            g.fillStyle = vgrad(g, 0, cv.height, [[0, mix(tcol, P.haze, 0.2)], [1, tcol]]);
            trace(g, deform([[x - w / 2, -10], [x + w / 2, -10], [x + w * 0.62, cv.height], [x - w * 0.62, cv.height]], 2, 0.06, R)); g.fill();
            g.save(); g.globalAlpha = 0.25; g.fillStyle = mix(P.leaf[1], P.light, 0.2); g.fillRect(x - w / 2, 0, w * 0.22, cv.height); g.restore(); // lit edge
            strokes(g, R, x - w / 2, 0, w, cv.height, [shade(tcol, -0.15), shade(tcol, 0.12)], Math.round(cv.height / (14 * L.u)), 60 * L.u, 3 * L.u, Math.PI / 2, 0.35); // bark
            if (d === 2) { g.save(); g.globalAlpha = 0.8; g.fillStyle = vgrad(g, cv.height * 0.6, cv.height, [[0, "rgba(0,0,0,0)"], [1, mix(P.leaf[2], P.near, 0.3)]]); g.fillRect(x - w * 0.62, cv.height * 0.6, w * 1.24, cv.height * 0.4); g.restore(); } // moss at the roots
          }
          // canopy
          const cl = []; for (let i = 0; i < 40; i++) cl.push({ x: R() * W2, y: R() * L.H * (0.1 + d * 0.03) - 20 * L.u, r: (70 + R() * 90) * L.u * (1 + d * 0.25) });
          const hz = { ...P, leaf: P.leaf.map(c => mix(c, P.haze, haze * 0.8)) };
          crown(g, cl, hz, R, -1, -100 * L.u, L.H * 0.2);
          layers.push({ cv, par: [0.2, 0.4, 0.7][d] });
        }
        // mossy ground and a stone lantern
        const fg = foreground(L, P, R);
        const gc = layerCanvas(L, L.SH - L.H * 0.1, L.SH + L.H * 0.02), gg = gc.getContext("2d");
        fillPoly(gg, ridge(R, 0, gc.width, gc.height * 0.5, L.H * 0.02, 30 * L.u, 0.7).concat([[gc.width, gc.height], [0, gc.height]]), mix(P.near, deep, 0.2));
        const lx = L.M + L.W * 0.3, ly = gc.height * 0.72, s = L.u;
        gg.fillStyle = shade(P.haze, -0.25);
        gg.fillRect(lx - 30 * s, ly - 14 * s, 60 * s, 14 * s); gg.fillRect(lx - 10 * s, ly - 70 * s, 20 * s, 56 * s);
        fillPoly(gg, [[lx - 34 * s, ly - 70 * s], [lx + 34 * s, ly - 70 * s], [lx + 24 * s, ly - 100 * s], [lx - 24 * s, ly - 100 * s]], shade(P.haze, -0.2));
        gg.fillStyle = shade(P.haze, -0.35); gg.fillRect(lx - 18 * s, ly - 100 * s, 36 * s, 26 * s);
        fillPoly(gg, [[lx - 46 * s, ly - 98 * s], [lx, ly - 128 * s], [lx + 46 * s, ly - 98 * s]], shade(P.haze, -0.15));
        S.lantern = { x: lx, y: gc.y0 + ly - 87 * s, par: 0.85 };
        layers.push({ cv: gc, par: 0.85 });
        layers.push(fg);
        S.blades = [{ edge: fg.edge, par: 1, n: 340, h: 52, w: 4, fern: true }, { ...corners(L), fern: true }];
        S.shafts = true; S.clouds = 0; S.motes = true;
        return layers;
      }
    }
  };

  /* ---------- keyboard ---------- */
  function keyboardPlate(L, K, P) {
    const cv = mkCanvas(L.W, L.H - L.kbY + 20), g = cv.getContext("2d"), oy = L.kbY - 14;
    const first = K.keys[0], last = K.keys[K.keys.length - 1];
    const x0 = first.x - 12 * L.u, x1 = last.x + last.w + 12 * L.u;
    g.fillStyle = vgrad(g, 0, cv.height, [[0, "#2a1d16"], [0.3, "#3b291e"], [1, "#1a110c"]]); g.fillRect(x0, 0, x1 - x0, cv.height);
    g.fillStyle = "rgba(255,230,190,0.18)"; g.fillRect(x0, 2, x1 - x0, 2);
    for (const k of K.keys) if (!k.black) {
      g.fillStyle = vgrad(g, L.kbY - oy, L.kbY - oy + L.kbH, [[0, "#f6efe2"], [0.85, "#fffaf0"], [1, "#d9cfbf"]]);
      g.fillRect(k.x + 0.8 * L.u, L.kbY - oy, k.w - 1.6 * L.u, L.kbH);
    }
    for (const k of K.keys) if (k.black) {
      g.fillStyle = vgrad(g, L.kbY - oy, L.kbY - oy + L.kbH * 0.62, [[0, "#141016"], [0.9, "#2b2630"], [1, "#0a080b"]]);
      g.fillRect(k.x, L.kbY - oy, k.w, L.kbH * 0.62);
      g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(k.x + k.w * 0.18, L.kbY - oy, k.w * 0.14, L.kbH * 0.55);
    }
    g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(x0, L.kbY - oy, x1 - x0, 4 * L.u);
    cv.oy = oy;
    return cv;
  }

  /* ---------- build ---------- */
  function build(W, H) {
    dirty = false;
    const L = layout(W, H), P = TIMES[timeName], R = rng(1234 + sceneName.length * 77 + (song ? song.notes.length : 0));
    const S = {};
    const sky = mkCanvas(W, H), sg = sky.getContext("2d");
    sg.fillStyle = vgrad(sg, 0, L.SH, [[0, P.skyTop], [0.55, P.skyMid], [1, P.horizon]]); sg.fillRect(0, 0, W, H);
    strokes(sg, R, 0, 0, W, L.SH, [shade(P.skyMid, 0.08), shade(P.skyTop, 0.05)], 500, 80 * L.u, 10 * L.u, -0.05, 0.06);
    if (P.night) for (let i = 0; i < 260; i++) { const x = R() * W, y = R() * L.horizon, r = (0.6 + R() * R() * 2.2) * L.u; sg.globalAlpha = 0.4 + R() * 0.6; sg.fillStyle = "#fff8e6"; sg.beginPath(); sg.arc(x, y, r, 0, TAU); sg.fill(); }
    sg.globalAlpha = 1;
    const sunX = W * P.sunPos[0], sunY = L.H * P.sunPos[1];
    const glow = sg.createRadialGradient(sunX, sunY, 0, sunX, sunY, L.H * 0.5);
    glow.addColorStop(0, mix(P.light, "#ffffff", 0.3)); glow.addColorStop(0.08, P.light); glow.addColorStop(1, "rgba(255,255,255,0)");
    sg.globalAlpha = P.night ? 0.25 : 0.55; sg.fillStyle = glow; sg.fillRect(0, 0, W, H); sg.globalAlpha = 1;
    sg.fillStyle = P.sun; sg.beginPath(); sg.arc(sunX, sunY, (P.night ? 34 : 46) * L.u, 0, TAU); sg.fill();
    if (P.night) { sg.fillStyle = P.skyTop; sg.globalAlpha = 0.9; sg.beginPath(); sg.arc(sunX + 16 * L.u, sunY - 8 * L.u, 30 * L.u, 0, TAU); sg.fill(); sg.globalAlpha = 1; }

    const scene = SCENES[sceneName];
    const layers = scene.build(L, P, R, S);
    // canvas grain baked into the opaque layers (sky and foreground) instead of blended every frame
    const grain = Painter.paperTexture(W, H, "gouache", 5);
    sg.save(); sg.globalCompositeOperation = "multiply"; sg.globalAlpha = 0.7; sg.drawImage(grain, 0, 0); sg.restore();

    // clouds
    const clouds = [];
    for (let i = 0; i < (S.clouds || 0); i++) {
      const w = (260 + R() * 380) * L.u * (L.portrait ? 1 : 1.2), h = w * (0.45 + R() * 0.25);
      clouds.push({ cv: makeCloud(w, h, P, R, P.sunPos[0] > 0.5 ? -1 : 1), x: R() * (W + w) - w / 2, y: L.H * (0.05 + R() * 0.24) * (L.portrait ? 1 : 1.1), sp: (4 + R() * 7) * L.u, par: 0.08 + R() * 0.08 });
    }
    clouds.sort((a, b) => a.y - b.y);
    // grass blades along layer edges
    const blades = [];
    for (const set of S.blades || []) {
      const e = set.edge;
      for (let i = 0; i < set.n; i++) {
        const k = R() * (e.length - 1), j = Math.floor(k), f = k - j;
        const x = e[j][0] + (e[j + 1][0] - e[j][0]) * f, y = e[j][1] + (e[j + 1][1] - e[j][1]) * f + R() * 10 * L.u * set.par;
        if (set.cornerOnly && x > L.M + L.W * 0.18 && x < L.M + L.W * 0.82) continue;
        blades.push({ x, y, h: set.h * L.u * (0.5 + R()), w: set.w * L.u * (0.6 + R() * 0.6), c: Math.floor(R() * P.grass.length), ph: R() * TAU, par: set.par, flower: !set.fern && R() < 0.12 ? P.flowers[Math.floor(R() * P.flowers.length)] : null, fern: set.fern });
      }
    }
    blades.sort((a, b) => a.par - b.par || a.y - b.y);
    const K = keyLayout(L);
    let lastEnd = 0, firstNote = 0;
    if (song) { firstNote = song.notes[0].start; for (const n of song.notes) lastEnd = Math.max(lastEnd, n.end); }
    const pitches = song ? song.notes.map(n => n.pitch).sort((a, b) => a - b) : [];
    // vignette + canvas grain, drawn over everything
    const vig = mkCanvas(W, H), vg = vig.getContext("2d"), vr = vg.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.75);
    vr.addColorStop(0, "rgba(0,0,0,0)"); vr.addColorStop(1, P.night ? "rgba(0,0,10,0.55)" : "rgba(20,10,0,0.32)");
    vg.fillStyle = vr; vg.fillRect(0, 0, W, H);
    C = {
      W, H, L, P, S, K, sky, layers, clouds, blades, lastEnd, firstNote,
      kb: keyboardPlate(L, K, P), vig, rays: makeRays(L, P, R, !!S.shafts),
      low: pitches[Math.floor(pitches.length * 0.25)] ?? 52, high: pitches[Math.floor(pitches.length * 0.8)] ?? 76,
      keyCol: Array.from({ length: 12 }, (_, pc) => mix(P.light, P.flowers[pcIndex(pc) % P.flowers.length], 0.4)), parts: [], birds: [], gusts: [], glow: new Float32Array(128), loud: 0, wind: 0.3, hitIdx: 0, lastT: undefined, lastFlock: -9,
      extraPars: [...new Set(blades.map(b => b.par))].filter(p => !layers.some(l => l.par === p)),
      motes: Array.from({ length: S.motes ? 70 : 24 }, () => ({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random(), p: Math.random() * TAU }))
    };
  }

  /* ---------- per frame ---------- */
  function windAt(x, t) {
    let w = C.wind;
    for (const g of C.gusts) { const front = g.x0 + (t - g.t0) * 900 * C.L.u; w += g.s * Math.exp(-Math.pow((x - front) / (260 * C.L.u), 2)); }
    return w;
  }
  function onNote(n, t) {
    const L = C.L, k = C.K.keyOf[n.pitch];
    if (k) for (let i = 0; i < (n.vel > 0.6 ? 2 : 1); i++) C.parts.push({ x: k.cx + (Math.random() - 0.5) * k.w, y: L.kbY - 4 * L.u, vx: (Math.random() - 0.5) * 30 * L.u, vy: -(70 + Math.random() * 80 + n.vel * 60) * L.u, life: 0, max: 3.5 + Math.random() * 2.5, r: (5 + n.vel * 6) * L.u, rot: Math.random() * TAU, spin: (Math.random() - 0.5) * 4, col: C.P.flowers[pcIndex(n.pitch) % C.P.flowers.length], petal: !C.P.night && Math.random() < 0.6 });
    if (n.pitch <= C.low && n.vel > 0.35) C.gusts.push({ t0: t, x0: -300 * L.u, s: 0.6 + n.vel * 0.8 });
    if (n.pitch >= C.high && t - C.lastFlock > 6) {
      C.lastFlock = t;
      const dir = Math.random() < 0.5 ? 1 : -1, n0 = 5 + Math.floor(Math.random() * 5), y = L.H * (0.12 + Math.random() * 0.15);
      for (let i = 0; i < n0; i++) C.birds.push({ x: dir > 0 ? -60 * L.u - i * 30 * L.u : L.W + 60 * L.u + i * 30 * L.u, y: y + Math.abs(i - n0 / 2) * 14 * L.u + (Math.random() - 0.5) * 10 * L.u, vx: dir * (120 + Math.random() * 20) * L.u, ph: Math.random() * TAU, s: (0.7 + Math.random() * 0.5) * L.u });
    }
    if (C.parts.length > 420) C.parts.splice(0, C.parts.length - 420);
  }

  function frame(ctx, W, H, t, dt, now) {
    if (!song) return;
    if (dirty || !C || C.W !== W || C.H !== H) build(W, H);
    const { L, P, S } = C, u = L.u, notes = song.notes;
    // music state
    const act = new Float32Array(128); let loud = 0;
    for (let i = lowerBound(notes, t - 30.5); i < notes.length; i++) { const n = notes[i]; if (n.start > t) break; if (n.end > t) { act[n.pitch] = Math.max(act[n.pitch], n.vel); loud += n.vel; } }
    const kk = Math.exp(-dt * 6); for (let p = 0; p < 128; p++) C.glow[p] = Math.max(C.glow[p] * kk, act[p]);
    C.loud += (clamp(loud / 4, 0, 1) - C.loud) * Math.min(1, dt * 2);
    const ending = smooth((t - C.lastEnd - 0.6) / 4.5);
    C.wind = (0.25 + 0.15 * Math.sin(now * 0.4) + C.loud * 0.9) * (1 - ending * 0.7);
    if (C.lastT === undefined || t < C.lastT - 0.05) { C.hitIdx = lowerBound(notes, t); C.parts = []; C.gusts = []; C.birds = []; }
    C.lastT = t;
    while (C.hitIdx < notes.length && notes[C.hitIdx].start <= t) { const n = notes[C.hitIdx++]; if (t - n.start < 0.25) onNote(n, t); }
    C.gusts = C.gusts.filter(g => t - g.t0 < 3);

    // camera: slow drift, a gentle pan across the song, a lift into the sky at the end
    const prog = clamp(t / Math.max(1, C.lastEnd), 0, 1);
    const camX = Math.sin(now * 0.07) * L.M * 0.35 + (prog - 0.5) * L.M * 0.9;
    const lift = ending * L.H * 0.42;
    const layerX = par => -L.M + camX * par;
    const layerY = par => lift; // the whole landscape tilts out of frame together

    ctx.save();
    ctx.drawImage(C.sky, 0, 0);
    // light shafts from the sun (or through the canopy)
    const rays = (P.rays + C.loud * 0.15) * (1 - ending * 0.5);
    if (rays > 0.02) {
      const sx = W * P.sunPos[0], sy = H * P.sunPos[1] + lift * 0.1, sz = C.rays.width;
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = clamp(rays * (S.shafts ? 2.6 : 1.8) * (0.8 + 0.2 * Math.sin(now * 0.3)), 0, 1);
      ctx.drawImage(C.rays, sx - sz / 2 + Math.sin(now * 0.1) * 12 * u, sy - sz / 2);
      ctx.restore();
    }
    // clouds drift on the wind
    for (const c of C.clouds) {
      c.x += c.sp * dt * (1 + C.wind * 1.5) * (dt > 0 ? 1 : 0);
      if (c.x > W + L.M) c.x = -c.cv.width - L.M * 0.5;
      ctx.drawImage(c.cv, c.x + camX * c.par, c.y + lift * 0.15);
    }
    // birds
    C.birds = C.birds.filter(b => b.x > -400 * u && b.x < W + 400 * u);
    ctx.save(); ctx.strokeStyle = P.night ? "rgba(220,230,255,0.75)" : shade(P.far, -0.5); ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const b of C.birds) {
      b.x += b.vx * dt; const f = Math.sin(now * 9 + b.ph), y = b.y + lift * 0.2 + Math.sin(now * 2 + b.ph) * 4 * u, s = 12 * b.s;
      ctx.lineWidth = 2.2 * b.s; ctx.beginPath(); ctx.moveTo(b.x - s, y - f * s * 0.6); ctx.quadraticCurveTo(b.x - s * 0.4, y - f * s * 0.2, b.x, y); ctx.quadraticCurveTo(b.x + s * 0.4, y - f * s * 0.2, b.x + s, y - f * s * 0.6); ctx.stroke();
    }
    ctx.restore();
    // scenery layers (with per-scene living details slotted in by depth)
    const windows = S.windows;
    for (let li = 0; li < C.layers.length; li++) {
      const ly = C.layers[li];
      ctx.drawImage(ly.cv, layerX(ly.par), ly.cv.y0 + layerY(ly.par));
      if (S.sea && ly.par === S.sea.par) drawSea(ctx, now, layerX(S.sea.par), layerY(S.sea.par));
      if (S.beacon && ly.par === S.beacon.par && (P.night || P.lamps)) glowAt(ctx, S.beacon.x + layerX(S.beacon.par), S.beacon.y + layerY(S.beacon.par), 60 * u, "#ffe9b0", 0.5 + 0.4 * Math.max(0, Math.sin(now * 1.3)));
      if (windows && ly.par === S.windowsPar && (P.night || P.lamps)) {
        const lit = Math.floor(windows.length * clamp(0.25 + prog * 0.8, 0, 1) * (1 - ending));
        ctx.save(); ctx.fillStyle = "#ffd890";
        for (let i = 0; i < lit; i++) { const w = windows[(i * 7) % windows.length]; ctx.globalAlpha = 0.85; ctx.fillRect(w.lx + layerX(S.windowsPar) + L.M, w.y + layerY(S.windowsPar), w.w, w.h); }
        ctx.restore();
      }
      if (S.tree && ly.par === S.tree.par) drawTree(ctx, now, layerX(S.tree.par), layerY(S.tree.par), t);
      if (S.lantern && ly.par === S.lantern.par && (P.night || P.lamps || S.shafts)) glowAt(ctx, S.lantern.x + layerX(S.lantern.par), S.lantern.y + layerY(S.lantern.par), 90 * u, "#ffd88a", (P.night || P.lamps ? 0.75 : 0.25) * (0.85 + C.loud * 0.3));
      drawBlades(ctx, ly.par, layerX, layerY, t, now);
    }
    for (const par of C.extraPars) drawBlades(ctx, par, layerX, layerY, t, now);
    // floating motes / fireflies
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const m of C.motes) {
      const x = ((m.x + now * 0.004 * m.s + Math.sin(now * 0.3 + m.p) * 0.01) % 1) * W, y = (m.y * 0.9 + Math.sin(now * 0.5 * m.s + m.p) * 0.02) * L.SH + lift * 0.6;
      const a = (P.night || P.lamps ? 0.9 : 0.35) * (0.4 + 0.6 * Math.sin(now * 1.5 * m.s + m.p * 3)) * (0.6 + C.loud * 0.6);
      glowAt(ctx, x, y, (P.night ? 7 : 4) * u * m.s, P.night || P.lamps ? "#e8ff9a" : P.light, a, true);
    }
    ctx.restore();
    // petals and lights released by notes, riding the wind
    ctx.save();
    for (const p of C.parts) {
      p.life += dt; const w = windAt(p.x, t);
      p.vx += (w * 140 * u - p.vx) * dt * 0.8; p.vy += 8 * u * dt; p.vy *= 0.995;
      p.x += (p.vx + Math.sin(p.life * 2 + p.rot) * 20 * u) * dt; p.y += p.vy * dt; p.rot += p.spin * dt;
      const a = Math.min(1, p.life * 3) * (1 - p.life / p.max);
      if (a <= 0) continue;
      if (p.petal) { const cs = Math.cos(p.rot), sn = Math.sin(p.rot), sq = 0.45 + 0.4 * Math.sin(p.life * 5 + p.rot); ctx.setTransform(cs, sn, -sn * sq, cs * sq, p.x, p.y + lift * 0.9); ctx.globalAlpha = a; ctx.fillStyle = p.col; ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.6, 0, 0, TAU); ctx.fill(); ctx.setTransform(1, 0, 0, 1, 0, 0); }
      else { ctx.globalCompositeOperation = "lighter"; glowAt(ctx, p.x, p.y + lift * 0.9, p.r * 1.6, p.col, a * 0.8, true); ctx.globalCompositeOperation = "source-over"; }
    }
    C.parts = C.parts.filter(p => p.life < p.max && p.y > -100 * u);
    ctx.restore();
    ctx.restore(); // camera

    // falling notes: soft threads of light over the foreground
    const kbA = 1 - ending;
    if (kbA > 0.01) {
      const pps = (L.kbY - L.SH) / lookahead;
      ctx.save(); ctx.globalAlpha = kbA; ctx.beginPath(); ctx.rect(0, L.SH - 10 * u, W, L.kbY - L.SH + 10 * u); ctx.clip();
      ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
      for (let i = lowerBound(notes, t - 30.5); i < notes.length; i++) {
        const n = notes[i]; if (n.start > t + lookahead) break; if (n.end < t) continue;
        const k = C.K.keyOf[n.pitch]; if (!k) continue;
        const yb = L.kbY - (n.start - t) * pps, yt = Math.max(L.SH - 10 * u, L.kbY - (n.end - t) * pps);
        const col = mix(P.light, C.P.flowers[pcIndex(n.pitch) % C.P.flowers.length], 0.5), w = (k.black ? 0.5 : 0.62) * k.w;
        const fade = clamp((yb - L.SH) / (60 * u), 0, 1);
        ctx.globalAlpha = kbA * (0.25 + n.vel * 0.3) * fade; ctx.strokeStyle = col; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(k.cx, yt + w / 2); ctx.lineTo(k.cx, Math.max(yt + w / 2, yb - w / 2)); ctx.stroke();
        ctx.globalAlpha = kbA * (0.55 + n.vel * 0.45) * fade; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = Math.max(1.5 * u, w * 0.22);
        ctx.beginPath(); ctx.moveTo(k.cx, yt + w / 2); ctx.lineTo(k.cx, Math.max(yt + w / 2, yb - w / 2)); ctx.stroke();
      }
      ctx.restore();
      // keyboard
      ctx.save(); ctx.globalAlpha = kbA;
      ctx.drawImage(C.kb, 0, C.kb.oy + lift * 0.5);
      for (const k of C.K.keys) {
        const g = C.glow[k.p]; if (g < 0.02) continue;
        const h = k.black ? L.kbH * 0.62 : L.kbH, y = L.kbY + lift * 0.5;
        ctx.globalAlpha = kbA * g * 0.55; ctx.fillStyle = C.keyCol[k.p % 12]; ctx.fillRect(k.x + 1, y, k.w - 2, h);
        ctx.globalCompositeOperation = "lighter"; glowAt(ctx, k.cx, y, k.w * 2.2, P.light, kbA * g * 0.35, true); ctx.globalCompositeOperation = "source-over";
      }
      ctx.restore();
    }
    // vignette, canvas grain
    ctx.drawImage(C.vig, 0, 0);
    // title at the start, "fin" at the end
    const tA = t < 3.2 ? 1 : clamp(1 - (t - 3.2) / 1.4, 0, 1);
    if (tA > 0) titleCard(ctx, song.title, analysis ? `${analysis.key}  ·  ${TIMES[timeName].label}` : "", tA, H * 0.22);
    const eA = smooth((t - C.lastEnd - 2.2) / 1.6);
    if (eA > 0) titleCard(ctx, "fin", song.title, eA, H * 0.42, true);
  }

  function glowAt(ctx, x, y, r, color, a, additive) {
    if (a <= 0.003) return;
    const prevA = ctx.globalAlpha, prevC = ctx.globalCompositeOperation;
    if (!additive) ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = Math.min(1, a); ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = prevA; ctx.globalCompositeOperation = prevC;
  }
  function drawSea(ctx, now, ox, oy) {
    const { L, P } = C, u = L.u, sx = L.W * P.sunPos[0];
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
    for (let i = 0; i < 70; i++) {
      const k = (i * 0.61803) % 1, y = L.horizon + (L.SH - L.horizon) * Math.pow(k, 1.4) + oy, near = (y - L.horizon) / (L.SH - L.horizon);
      const x = sx + ((i * 0.377) % 1 - 0.5) * L.W * (0.15 + near * 0.5) + Math.sin(now * 0.6 + i) * 10 * u;
      const a = Math.max(0, Math.sin(now * 2.2 + i * 2.7)) * (0.5 - near * 0.3);
      ctx.globalAlpha = a; ctx.strokeStyle = P.light; ctx.lineWidth = (1.5 + near * 2) * u;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (12 + near * 30) * u, y); ctx.stroke();
    }
    ctx.restore();
  }
  function drawTree(ctx, now, ox, oy, t) {
    const { L, S, P } = C, tr = S.tree, u = L.u;
    const sway = Math.sin(now * 0.9) * 0.012 + C.wind * 0.03 + Math.sin(now * 2.3) * C.wind * 0.01;
    ctx.save(); ctx.translate(tr.x + ox, tr.y + oy);
    ctx.transform(1, 0, -sway, 1, 0, 0);
    ctx.drawImage(tr.cv, -tr.cv.width / 2, -tr.cv.height);
    ctx.restore();
    // a girl and her cat sitting under the tree, looking out over the valley
    const f = S.figure, x = f.x + ox, y = f.y + oy, s = u * 2.6, sil = mix(P.foot, "#000000", 0.6), w = Math.min(1, C.wind);
    ctx.save(); ctx.fillStyle = sil; ctx.strokeStyle = sil; ctx.lineCap = "round";
    ctx.beginPath(); ctx.ellipse(x, y - 22 * s, 15 * s, 22 * s, -0.1, 0, TAU); ctx.fill(); // body
    ctx.beginPath(); ctx.moveTo(x - 14 * s, y - 6 * s); ctx.quadraticCurveTo(x + 10 * s, y + 2 * s, x + 34 * s, y - 4 * s); ctx.lineWidth = 9 * s; ctx.stroke(); // legs
    ctx.beginPath(); ctx.arc(x + 2 * s, y - 52 * s, 11 * s, 0, TAU); ctx.fill(); // head
    ctx.lineWidth = 2.2 * s; // hair in the wind
    for (let i = 0; i < 6; i++) {
      const by = y - (54 - i * 3) * s, len = (16 + i * 3) * s, flow = (6 + w * 26) * s;
      ctx.beginPath(); ctx.moveTo(x - 6 * s, by); ctx.quadraticCurveTo(x - 6 * s - len * 0.5, by + 6 * s + Math.sin(now * 3 + i) * 3 * s, x - 6 * s - len - flow * 0.6, by + 10 * s - flow * 0.2 + Math.sin(now * 4 + i * 0.7) * 4 * s); ctx.stroke();
    }
    ctx.lineWidth = 4 * s; // scarf
    ctx.beginPath(); ctx.moveTo(x - 4 * s, y - 40 * s); ctx.quadraticCurveTo(x - 20 * s - w * 20 * s, y - 34 * s + Math.sin(now * 3.4) * 4 * s, x - 34 * s - w * 36 * s, y - 38 * s + Math.sin(now * 4.1) * 6 * s); ctx.strokeStyle = P.night ? "#7f8fd0" : "#c8553d"; ctx.stroke();
    // cat, ears up, tail curling with the music
    ctx.fillStyle = sil; ctx.strokeStyle = sil;
    const cx = x + 46 * s, cy = y;
    ctx.beginPath(); ctx.ellipse(cx, cy - 12 * s, 9 * s, 12 * s, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 1 * s, cy - 27 * s, 7 * s, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 5 * s, cy - 31 * s); ctx.lineTo(cx - 4 * s, cy - 39 * s); ctx.lineTo(cx, cy - 33 * s); ctx.moveTo(cx + 2 * s, cy - 33 * s); ctx.lineTo(cx + 6 * s, cy - 39 * s); ctx.lineTo(cx + 7 * s, cy - 30 * s); ctx.fill();
    ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(cx + 7 * s, cy - 3 * s); ctx.quadraticCurveTo(cx + 22 * s, cy - 2 * s, cx + 20 * s + Math.sin(now * 2 + C.loud * 3) * 6 * s, cy - 18 * s); ctx.stroke();
    ctx.restore();
  }
  function drawBlades(ctx, par, layerX, layerY, t, now) {
    const { P, L } = C, u = L.u, ox = layerX(par), oy = layerY(par);
    const groups = P.grass.map(() => []);
    let flowers = null;
    for (const b of C.blades) if (b.par === par) { groups[b.c].push(b); if (b.flower) (flowers = flowers || []).push(b); }
    ctx.save(); ctx.lineCap = "round";
    groups.forEach((g, ci) => {
      if (!g.length) return;
      ctx.strokeStyle = P.grass[ci]; ctx.beginPath();
      let lw = 0;
      for (const b of g) {
        const x = b.x + ox, y = b.y + oy, w = windAt(x, t);
        const bend = (w * 0.55 + Math.sin(now * 2.1 + b.ph + x * 0.004) * (0.08 + w * 0.12)) * b.h;
        if (b.fern) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + bend * 0.2 - b.h * 0.3, y - b.h * 0.6, x + bend * 0.6 - b.h * 0.5, y - b.h * 0.8); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + bend * 0.2 + b.h * 0.3, y - b.h * 0.6, x + bend * 0.6 + b.h * 0.5, y - b.h * 0.8); }
        ctx.moveTo(x, y); ctx.quadraticCurveTo(x + bend * 0.3, y - b.h * 0.6, x + bend, y - b.h + Math.abs(bend) * 0.3);
        lw += b.w;
      }
      ctx.lineWidth = lw / g.length; ctx.stroke();
    });
    if (flowers) for (const b of flowers) {
      const x = b.x + ox, y = b.y + oy, w = windAt(x, t), bend = (w * 0.55 + Math.sin(now * 2.1 + b.ph + x * 0.004) * (0.08 + w * 0.12)) * b.h;
      ctx.fillStyle = b.flower; ctx.beginPath(); ctx.arc(x + bend, y - b.h + Math.abs(bend) * 0.3, b.w * 1.3, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function titleCard(ctx, title, sub, a, y, big) {
    const W = C.W, u = C.L.u;
    ctx.save(); ctx.globalAlpha = a; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 18 * u;
    ctx.fillStyle = "#fffaf0";
    let size = (big ? 120 : 84) * u; ctx.font = `${size}px ${SERIF}`;
    while (ctx.measureText(title).width > W * 0.86 && size > 30 * u) { size *= 0.9; ctx.font = `${size}px ${SERIF}`; }
    ctx.fillText(title, W / 2, y);
    ctx.shadowBlur = 8 * u; ctx.font = `${26 * u}px ${SERIF}`; ctx.globalAlpha = a * 0.85;
    if (sub) {
      ctx.fillText(sub, W / 2, y + size * 0.75);
      const tw = Math.min(ctx.measureText(sub).width, W * 0.6) / 2 + 30 * u;
      ctx.fillRect(W / 2 - tw, y + size * 0.75 - 22 * u, tw * 0.7, 1.2 * u); ctx.fillRect(W / 2 + tw * 0.3, y + size * 0.75 - 22 * u, tw * 0.7, 1.2 * u);
    }
    ctx.restore();
  }

  return {
    TIMES, SCENES,
    setSong(s, a) { song = s; analysis = a; dirty = true; },
    setScene(s) { if (SCENES[s] && s !== sceneName) { sceneName = s; dirty = true; } },
    setTime(p) { if (TIMES[p] && p !== timeName) { timeName = p; dirty = true; } },
    setRange(m) { rangeMode = m; dirty = true; },
    setFall(s) { lookahead = s; },
    reset() { if (C) C.lastT = undefined; },
    isDirty() { return dirty; },
    frame
  };
})();
