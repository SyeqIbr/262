"use strict";
/* Storybook palettes and scenes. A scene paints its background once (plate), says where
   its creatures sit, and where each note grows something (a flower, a mushroom, a lit window). */
const PALETTES = {
  pastel: {
    label: "Soft pastel", paper: "#fbf6ee", ink: "#4a3f4f",
    skyTop: "#bfe3f0", skyBot: "#fde6e2", far: "#cfe6c8", mid: "#a9d7a6", near: "#93c98f", lane: "#a3d29b",
    wall: "#fbe7d3", wall2: "#f4d3c4", wood: "#d8a47f", glass: "#cfeaf5",
    roof: ["#f29e9e", "#9cc7e8", "#f7c873", "#b9a3e3", "#9fd6b8"],
    accent: ["#f7a6b5", "#f9d27a", "#9fd4f0", "#c7b3f0", "#a8e0c0", "#ffb48f"],
    light: "#fff1b8", sun: "#ffd27a", cat: "#f4b183", frog: "#8fd17a", bird: "#7fb8e8", night: false
  },
  honey: {
    label: "Warm honey", paper: "#f8efdf", ink: "#4b3527",
    skyTop: "#9fc4d8", skyBot: "#fbe0b8", far: "#d9c98f", mid: "#b8b46c", near: "#9fa95c", lane: "#c7a77a",
    wall: "#f3dcb8", wall2: "#e8c79a", wood: "#b07a4f", glass: "#fbe3b5",
    roof: ["#c8643b", "#d9a441", "#8b5a3c", "#e39a6b", "#a8673f"],
    accent: ["#e8743b", "#f2b84b", "#d65f5f", "#f6d38a", "#b8794a", "#f0a07a"],
    light: "#ffe2a0", sun: "#ffb85c", cat: "#e39a5a", frog: "#9cbf5a", bird: "#c95f4f", night: false
  },
  night: {
    label: "Cozy night", paper: "#efe9df", ink: "#1f2140",
    skyTop: "#1e2550", skyBot: "#4a4e8a", far: "#3a3f6e", mid: "#2f3560", near: "#2a2f58", lane: "#2c3158",
    wall: "#3b3f6b", wall2: "#30345e", wood: "#5a4a6a", glass: "#2a3466",
    roof: ["#5b5e96", "#7a5f8f", "#4c6b8f", "#8f6a7f", "#6a7aa8"],
    accent: ["#ffd38a", "#ffb3c1", "#a8d8ff", "#c9b6ff", "#fff0b3", "#9fe0c8"],
    light: "#ffd38a", sun: "#f6f1d1", cat: "#2e2d3d", frog: "#6fae7a", bird: "#8fb8ff", night: true
  },
  rain: {
    label: "Rainy lavender", paper: "#f6f2f6", ink: "#3d3550",
    skyTop: "#b2afd2", skyBot: "#e3d6e6", far: "#c9c3dd", mid: "#a9a6cc", near: "#9493c0", lane: "#9c9ac6",
    wall: "#e6dcea", wall2: "#d6c9de", wood: "#9a7f9e", glass: "#d8d6ee",
    roof: ["#8d86c4", "#c48da8", "#7fa3c4", "#b3a1d6", "#9fb8c9"],
    accent: ["#c9a7ff", "#ff9fc4", "#9fc8ff", "#ffd6a5", "#b8e0d2", "#f2b5d4"],
    light: "#fff0c9", sun: "#ffffff", cat: "#9a96a8", frog: "#8fc49a", bird: "#f29fbf", night: false, rain: true
  }
};

const SCENES = (() => {
  const { paint, wash, rect, ellipse, ribbon, bezier, shade, mix, rng, ink, dot } = Painter;
  const tri = (a, b, c) => [a, b, c];

  // little helpers shared by scenes
  function sunOrMoon(g, P, x, y, r, R, u) {
    if (P.night) {
      paint(g, ellipse(x, y, r, r), P.sun, { R, u, layers: 12 });
      paint(g, ellipse(x + r * 0.45, y - r * 0.25, r * 0.85, r * 0.85), P.skyTop, { R, u, alpha: 0.95 });
    } else paint(g, ellipse(x, y, r, r), P.sun, { R, u, layers: 12 });
  }
  function stars(g, P, x0, y0, w, h, R, u, n = 40) {
    if (!P.night) return;
    for (let i = 0; i < n; i++) {
      const x = x0 + R() * w, y = y0 + R() * h, s = (1.2 + R() * 2.2) * u;
      dot(g, x, y, s, "#fff6d8", 0.8);
      if (R() < 0.2) { ink(g, [[x - s * 3, y], [x + s * 3, y]], "#fff6d8", 0.8 * u); ink(g, [[x, y - s * 3], [x, y + s * 3]], "#fff6d8", 0.8 * u); }
    }
  }
  function cloud(g, P, x, y, s, R, u) {
    const c = P.night ? shade(P.skyBot, 0.12) : shade(P.skyBot, 0.6);
    for (const [dx, dy, r] of [[-1, 0, 0.7], [-0.3, -0.4, 0.9], [0.5, -0.2, 0.8], [1.1, 0.05, 0.6]]) paint(g, ellipse(x + dx * s, y + dy * s, r * s, r * s * 0.75), c, { R, u, alpha: 0.9 });
  }
  function grassTufts(g, color, x0, x1, y, R, u, n) {
    for (let i = 0; i < n; i++) {
      const x = x0 + R() * (x1 - x0), yy = y + R() * 8 * u, h = (8 + R() * 14) * u;
      for (let k = -1; k <= 1; k++) ink(g, [[x + k * 2 * u, yy], [x + k * 5 * u + (R() - 0.5) * 3 * u, yy - h * (k ? 0.8 : 1)]], shade(color, -0.2 + R() * 0.1), 1.8 * u);
    }
  }
  function laneFloor(g, L, P, R, u, kind) {
    g.fillStyle = P.paper; g.fillRect(0, L.SH + 2 * u, L.W, L.H - L.SH);
    paint(g, rect(-10 * u, L.SH - 4 * u, L.W + 20 * u, L.kbY - L.SH + 30 * u), P.lane, { R, u, wobble: 0.1 });
    if (kind === "boards") for (let x = 0; x < L.W; x += 90 * u) ink(g, [[x + R() * 6 * u, L.SH], [x + R() * 6 * u, L.kbY]], shade(P.lane, -0.2), 1.6 * u);
    if (kind === "stones") for (let i = 0; i < L.W * (L.kbY - L.SH) / (2600 * u * u); i++) paint(g, ellipse(R() * L.W, L.SH + R() * (L.kbY - L.SH), (10 + R() * 14) * u, (6 + R() * 7) * u), shade(P.lane, (R() - 0.5) * 0.25), { R, u, alpha: 0.7, layers: 4 });
    if (kind === "grass" || kind === "leaves") grassTufts(g, P.lane, 0, L.W, L.SH + 6 * u, R, u, Math.round(L.W / (14 * u)));
    if (kind === "leaves") for (let i = 0; i < 70; i++) paint(g, ellipse(R() * L.W, L.SH + R() * (L.kbY - L.SH), 7 * u, 3.5 * u, 8, R() * 3), P.accent[i % P.accent.length], { R, u, alpha: 0.55, layers: 3 });
    // soft shadow so the falling notes read clearly
    const gr = g.createLinearGradient(0, L.SH, 0, L.kbY);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.12)");
    g.fillStyle = gr; g.fillRect(0, L.SH, L.W, L.kbY - L.SH);
  }

  /* =================== Cozy room =================== */
  const room = {
    label: "Cozy room",
    layout(L) { const u = L.u, ww = Math.min(L.W * 0.46, 420 * u); return { win: { x: L.W * 0.36 - ww / 2, y: L.SH * 0.12, w: ww, h: L.SH * 0.46 } }; },
    plate(g, L, P, R, S) {
      const { W, SH, u } = L, win = S.win;
      wash(g, 0, 0, W, SH, P.wall, P.wall2, { R, u });
      for (let y = 30 * u; y < SH * 0.8; y += 70 * u) for (let x = (y / (70 * u)) % 2 * 35 * u; x < W; x += 70 * u) paint(g, ellipse(x, y, 5 * u, 5 * u, 8), shade(P.wall2, -0.06), { R, u, alpha: 0.6, layers: 3 });
      // window with the outside world
      g.save(); g.beginPath(); g.rect(win.x, win.y, win.w, win.h); g.clip();
      wash(g, win.x, win.y, win.w, win.h, P.skyTop, P.skyBot, { R, u });
      stars(g, P, win.x, win.y, win.w, win.h * 0.6, R, u, 14);
      sunOrMoon(g, P, win.x + win.w * 0.7, win.y + win.h * 0.3, 30 * u, R, u);
      paint(g, ellipse(win.x + win.w * 0.3, win.y + win.h * 1.05, win.w * 0.55, win.h * 0.35), P.far, { R, u });
      paint(g, ellipse(win.x + win.w * 0.85, win.y + win.h * 1.1, win.w * 0.5, win.h * 0.3), P.mid, { R, u });
      g.restore();
      const f = 14 * u;
      for (const r of [rect(win.x - f, win.y - f, win.w + 2 * f, f), rect(win.x - f, win.y + win.h, win.w + 2 * f, f), rect(win.x - f, win.y, f, win.h), rect(win.x + win.w, win.y, f, win.h), rect(win.x + win.w / 2 - f / 3, win.y, f * 0.66, win.h), rect(win.x, win.y + win.h / 2 - f / 3, win.w, f * 0.66)]) paint(g, r, P.wood, { R, u });
      paint(g, rect(win.x - f * 2.5, win.y + win.h + f * 0.6, win.w + f * 5, f * 1.2), shade(P.wood, 0.1), { R, u });
      // curtains
      for (const side of [-1, 1]) {
        const x = side < 0 ? win.x - f * 2.2 : win.x + win.w + f * 2.2, cw = win.w * 0.2 * side;
        paint(g, [[x, win.y - f * 2], [x + cw, win.y - f * 2], [x + cw * 0.55, win.y + win.h * 0.55], [x + cw * 0.9, win.y + win.h + f], [x, win.y + win.h + f]], P.accent[0], { R, u, angle: 1.4 });
      }
      paint(g, rect(win.x - f * 4, win.y - f * 2.6, win.w + f * 8, 7 * u), P.wood, { R, u });
      // picture frame and shelf with books
      const px = Math.min(W - 150 * u, win.x + win.w + 120 * u);
      paint(g, rect(px, SH * 0.16, 110 * u, 84 * u), P.wood, { R, u });
      paint(g, rect(px + 10 * u, SH * 0.16 + 10 * u, 90 * u, 64 * u), shade(P.wall, 0.4), { R, u });
      paint(g, ellipse(px + 55 * u, SH * 0.16 + 52 * u, 26 * u, 16 * u), P.accent[4], { R, u });
      paint(g, rect(px - 20 * u, SH * 0.5, 150 * u, 9 * u), P.wood, { R, u });
      let bx = px - 12 * u;
      for (let i = 0; i < 6; i++) { const bw = (14 + R() * 10) * u, bh = (40 + R() * 26) * u; paint(g, rect(bx, SH * 0.5 - bh, bw, bh), P.accent[(i + 1) % P.accent.length], { R, u }); bx += bw + 3 * u; }
      // floor lamp
      const lx = Math.min(W - 60 * u, px + 120 * u);
      paint(g, rect(lx - 3 * u, SH * 0.36, 6 * u, SH * 0.6), shade(P.ink, 0.3), { R, u });
      paint(g, [[lx - 40 * u, SH * 0.36], [lx + 40 * u, SH * 0.36], [lx + 24 * u, SH * 0.24], [lx - 24 * u, SH * 0.24]], P.accent[1], { R, u });
      S.glows = [{ x: lx, y: SH * 0.33, r: 140 * u }];
      // floor and rug
      paint(g, rect(-10 * u, SH * 0.82, W + 20 * u, SH * 0.2), P.wood, { R, u, wobble: 0.1 });
      for (let x = 0; x < W; x += 120 * u) ink(g, [[x, SH * 0.83], [x - 40 * u, SH]], shade(P.wood, -0.15), 1.4 * u);
      paint(g, ellipse(W * 0.58, SH * 0.93, Math.min(W * 0.32, 320 * u), 26 * u), P.accent[3], { R, u });
      paint(g, ellipse(W * 0.58, SH * 0.93, Math.min(W * 0.24, 240 * u), 16 * u), P.accent[2], { R, u, alpha: 0.8 });
      laneFloor(g, L, P, R, u, "boards");
    },
    creatures(L, S) {
      const u = L.u, win = S.win;
      return [
        { kind: "cat", x: L.W * 0.6, y: L.SH * 0.95, s: 1.15 },
        { kind: "bird", x: win.x + win.w * 0.18, y: win.y + win.h + 9 * u, s: 1, flip: -1 },
        { kind: "bird", x: win.x + win.w * 0.82, y: win.y + win.h + 9 * u, s: 0.9, flip: 1 }
      ];
    },
    growth: "flowers", growthY: L => L.SH * 0.985
  };

  /* =================== Garden cottage =================== */
  const cottage = {
    label: "Garden cottage",
    layout(L) {
      const u = L.u, cw = Math.min(300 * u, L.W * 0.36), cx = L.W * 0.66, by = L.SH * 0.8;
      return { house: { cx, by, cw, ch: cw * 0.66 }, pond: { x: L.W * 0.24, y: L.SH * 0.92, rx: Math.min(L.W * 0.18, 170 * u), ry: 34 * u } };
    },
    plate(g, L, P, R, S) {
      const { W, SH, u } = L, h = S.house, pd = S.pond;
      wash(g, 0, 0, W, SH, P.skyTop, P.skyBot, { R, u });
      stars(g, P, 0, 0, W, SH * 0.5, R, u);
      sunOrMoon(g, P, W * 0.2, SH * 0.2, 44 * u, R, u);
      cloud(g, P, W * 0.55, SH * 0.16, 46 * u, R, u); cloud(g, P, W * 0.88, SH * 0.3, 34 * u, R, u);
      paint(g, ellipse(W * 0.25, SH * 0.86, W * 0.7, SH * 0.3, 30), P.far, { R, u });
      paint(g, ellipse(W * 0.85, SH * 0.88, W * 0.6, SH * 0.25, 30), P.mid, { R, u });
      paint(g, rect(-10 * u, SH * 0.78, W + 20 * u, SH * 0.24), P.near, { R, u, wobble: 0.15 });
      // cottage
      const x0 = h.cx - h.cw / 2, y0 = h.by - h.ch;
      paint(g, rect(h.cx + h.cw * 0.18, y0 - h.ch * 0.75, h.cw * 0.12, h.ch * 0.5), shade(P.roof[2], -0.1), { R, u });
      paint(g, rect(x0, y0, h.cw, h.ch), P.wall, { R, u });
      paint(g, tri([x0 - h.cw * 0.1, y0 + 4 * u], [h.cx, y0 - h.ch * 0.72], [x0 + h.cw * 1.1, y0 + 4 * u]), P.roof[0], { R, u, angle: 0.6 });
      paint(g, rect(h.cx - h.cw * 0.09, h.by - h.ch * 0.58, h.cw * 0.18, h.ch * 0.58), P.wood, { R, u });
      S.windows = [];
      for (const wx of [x0 + h.cw * 0.13, x0 + h.cw * 0.67]) {
        const ww = h.cw * 0.2, wh = h.ch * 0.32, wy = y0 + h.ch * 0.25;
        paint(g, rect(wx, wy, ww, wh), P.night ? P.light : P.glass, { R, u });
        ink(g, [[wx + ww / 2, wy], [wx + ww / 2, wy + wh]], P.wood, 3 * u); ink(g, [[wx, wy + wh / 2], [wx + ww, wy + wh / 2]], P.wood, 3 * u);
        paint(g, rect(wx - 4 * u, wy + wh, ww + 8 * u, 12 * u), P.wood, { R, u });
        for (let i = 0; i < 4; i++) paint(g, ellipse(wx + ww * (0.1 + i * 0.27), wy + wh - 2 * u, 7 * u, 7 * u, 8), P.accent[i % P.accent.length], { R, u, layers: 4 });
        if (P.night) S.windows.push({ x: wx + ww / 2, y: wy + wh / 2, r: ww * 1.4 });
      }
      S.glows = S.windows;
      S.chimney = { x: h.cx + h.cw * 0.24, y: y0 - h.ch * 0.78 };
      // fence
      const fx1 = Math.max(W * 0.04, x0 - W * 0.45), fx2 = x0 - 20 * u, fy = SH * 0.8;
      paint(g, rect(fx1, fy - 34 * u, fx2 - fx1, 6 * u), shade(P.wood, 0.2), { R, u }); paint(g, rect(fx1, fy - 16 * u, fx2 - fx1, 6 * u), shade(P.wood, 0.2), { R, u });
      for (let x = fx1; x < fx2; x += 34 * u) paint(g, [[x, fy], [x, fy - 44 * u], [x + 6 * u, fy - 52 * u], [x + 12 * u, fy - 44 * u], [x + 12 * u, fy]], shade(P.wood, 0.3), { R, u });
      S.fence = { x1: fx1, x2: fx2, y: fy - 50 * u };
      // pond with lily pads
      paint(g, ellipse(pd.x, pd.y, pd.rx, pd.ry, 26), mix(P.skyTop, "#6fa8c8", 0.4), { R, u });
      S.pads = [];
      for (const k of [-0.5, 0.35]) { const x = pd.x + pd.rx * k, y = pd.y - 2 * u; paint(g, ellipse(x, y, 30 * u, 10 * u, 16), shade(P.frog, -0.15), { R, u }); S.pads.push({ x, y }); }
      paint(g, ellipse(pd.x + pd.rx * 0.8, pd.y + 6 * u, 18 * u, 6 * u), shade(P.frog, -0.2), { R, u });
      grassTufts(g, P.near, 0, W, SH * 0.82, R, u, Math.round(W / (20 * u)));
      laneFloor(g, L, P, R, u, "grass");
    },
    creatures(L, S) {
      const h = S.house, f = S.fence;
      return [
        { kind: "frog", x: S.pads[0].x, y: S.pads[0].y + 2 * L.u, s: 0.9 },
        { kind: "frog", x: S.pads[1].x, y: S.pads[1].y + 2 * L.u, s: 0.75, flip: -1 },
        { kind: "bird", x: f.x1 + (f.x2 - f.x1) * 0.35, y: f.y + 4 * L.u, s: 1 },
        { kind: "bird", x: f.x1 + (f.x2 - f.x1) * 0.7, y: f.y + 4 * L.u, s: 0.85, flip: -1 },
        { kind: "cat", x: h.cx + h.cw * 0.32, y: h.by + 10 * L.u, s: 0.95, flip: -1 }
      ];
    },
    growth: "flowers", growthY: L => L.SH * 0.975
  };

  /* =================== Rooftop town =================== */
  const town = {
    label: "Rooftop town",
    layout(L) {
      const u = L.u, R = rng(42), houses = [];
      let x = -20 * u;
      while (x < L.W + 20 * u) {
        const w = (110 + R() * 80) * u, h = Math.min(L.SH * 0.62, (150 + R() * 190) * u);
        houses.push({ x, w, h, roof: R() < 0.6 ? "peak" : "flat", c: Math.floor(R() * 5) });
        x += w + (4 + R() * 12) * u;
      }
      const windows = [];
      for (const hs of houses) {
        const cols = hs.w > 150 * u ? 3 : 2, rows = Math.max(1, Math.floor(hs.h / (70 * u))), ww = 18 * u, wh = 24 * u;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) windows.push({ x: hs.x + hs.w * (c + 0.5) / cols - ww / 2, y: L.SH - hs.h + 30 * u + r * 62 * u, w: ww, h: wh });
      }
      windows.sort((a, b) => a.x - b.x);
      return { houses, windows, wire: L.SH * 0.3 };
    },
    plate(g, L, P, R, S) {
      const { W, SH, u } = L;
      wash(g, 0, 0, W, SH, P.skyTop, P.skyBot, { R, u });
      stars(g, P, 0, 0, W, SH * 0.6, R, u, 70);
      sunOrMoon(g, P, W * 0.78, SH * 0.14, 40 * u, R, u);
      if (!P.night) { cloud(g, P, W * 0.25, SH * 0.12, 40 * u, R, u); }
      paint(g, ellipse(W * 0.3, SH * 0.75, W * 0.6, SH * 0.35, 30), P.far, { R, u });
      paint(g, ellipse(W * 0.9, SH * 0.7, W * 0.5, SH * 0.3, 30), shade(P.far, -0.05), { R, u });
      for (const hs of S.houses) {
        const col = P.roof[hs.c], wallc = mix(P.wall, col, 0.35), top = SH - hs.h;
        paint(g, rect(hs.x, top, hs.w, hs.h + 6 * u), wallc, { R, u });
        if (hs.roof === "peak") { paint(g, tri([hs.x - 8 * u, top + 4 * u], [hs.x + hs.w / 2, top - hs.w * 0.42], [hs.x + hs.w + 8 * u, top + 4 * u]), col, { R, u, angle: 0.7 }); hs.ridge = { x: hs.x + hs.w / 2, y: top - hs.w * 0.42 }; }
        else { paint(g, rect(hs.x - 6 * u, top - 12 * u, hs.w + 12 * u, 14 * u), col, { R, u }); hs.ridge = { x: hs.x + hs.w * 0.5, y: top - 10 * u }; }
      }
      for (const w of S.windows) paint(g, rect(w.x, w.y, w.w, w.h), shade(P.glass, -0.1), { R, u, layers: 4 });
      // telephone wire between two poles
      const p1 = W * 0.06, p2 = W * 0.94;
      for (const px of [p1, p2]) paint(g, rect(px - 4 * u, S.wire - 20 * u, 8 * u, SH), shade(P.wood, -0.25), { R, u });
      const sag = bezier([p1, S.wire], [W / 2, S.wire + 50 * u], [p2, S.wire], 30);
      ink(g, sag, shade(P.ink, 0.2), 2 * u);
      S.sag = sag;
      laneFloor(g, L, P, R, u, "stones");
    },
    creatures(L, S) {
      const peaks = S.houses.filter(h => h.ridge && h.x > 0 && h.x + h.w < L.W).sort((a, b) => b.h - a.h);
      const onWire = k => S.sag[Math.round(k * (S.sag.length - 1))];
      const out = [];
      if (peaks[0]) out.push({ kind: "cat", x: peaks[0].ridge.x, y: peaks[0].ridge.y + 6 * L.u, s: 0.85 });
      if (peaks[2]) out.push({ kind: "cat", x: peaks[2].ridge.x, y: peaks[2].ridge.y + 6 * L.u, s: 0.75, flip: -1 });
      for (const [k, s, f] of [[0.3, 0.9, 1], [0.48, 0.8, -1], [0.66, 0.9, 1]]) { const p = onWire(k); out.push({ kind: "bird", x: p[0], y: p[1] + 2 * L.u, s, flip: f }); }
      return out;
    },
    growth: "windows"
  };

  /* =================== Forest clearing =================== */
  const forest = {
    label: "Forest clearing",
    layout(L) { const u = L.u; return { stump: { x: L.W * 0.5, y: L.SH * 0.9, r: Math.min(90 * u, L.W * 0.12) }, branch: { x1: L.W * 0.62, x2: L.W, y: L.SH * 0.3 } }; },
    plate(g, L, P, R, S) {
      const { W, SH, u } = L, st = S.stump;
      wash(g, 0, 0, W, SH, P.skyTop, P.skyBot, { R, u });
      stars(g, P, 0, 0, W, SH * 0.3, R, u, 25);
      const greens = P.night ? ["#2c4a52", "#24404a", "#1e3640"] : [mix(P.far, "#7fb07a", 0.5), mix(P.mid, "#5f9a63", 0.5), mix(P.near, "#4f8a55", 0.5)];
      // three depths of trees
      for (let layer = 0; layer < 3; layer++) {
        const trunk = shade(P.wood, -0.1 * layer + (P.night ? -0.2 : 0.15 - layer * 0.1)), n = 4 + layer;
        for (let i = 0; i < n; i++) {
          const x = (i + 0.3 + R() * 0.4) / n * W, w = (24 + layer * 14) * u;
          paint(g, rect(x - w / 2, SH * (0.05 + layer * 0.04), w, SH), mix(trunk, P.skyBot, 0.45 - layer * 0.18), { R, u, wobble: 0.2 });
          paint(g, ellipse(x, SH * (0.08 + layer * 0.05), (90 + layer * 30) * u, (60 + layer * 18) * u, 18), mix(greens[layer], P.skyBot, 0.35 - layer * 0.15), { R, u });
        }
      }
      paint(g, rect(-10 * u, SH * 0.8, W + 20 * u, SH * 0.22), P.near, { R, u, wobble: 0.15 });
      for (let i = 0; i < 6; i++) paint(g, ellipse((i + 0.5) / 6 * W + (R() - 0.5) * 60 * u, SH * 0.82, (70 + R() * 50) * u, (34 + R() * 20) * u, 16), shade(greens[2], R() * 0.15), { R, u });
      // branch reaching in from the right for the birds
      const b = S.branch;
      paint(g, ribbon(bezier([b.x2 + 20 * u, b.y - 30 * u], [b.x1 + (b.x2 - b.x1) * 0.5, b.y + 20 * u], [b.x1, b.y], 14), 22 * u, 8 * u), shade(P.wood, -0.1), { R, u });
      for (let i = 0; i < 5; i++) paint(g, ellipse(b.x1 + (b.x2 - b.x1) * (0.1 + i * 0.2), b.y - 18 * u + (R() - 0.5) * 10 * u, 22 * u, 12 * u, 10, R()), greens[1], { R, u, layers: 5 });
      // stump
      paint(g, rect(st.x - st.r, st.y - st.r * 0.9, st.r * 2, st.r * 0.9), P.wood, { R, u });
      paint(g, ellipse(st.x, st.y - st.r * 0.9, st.r, st.r * 0.3, 20), shade(P.wood, 0.35), { R, u });
      for (let k = 0.3; k < 1; k += 0.3) ink(g, ellipse(st.x, st.y - st.r * 0.9, st.r * k, st.r * 0.3 * k, 20), shade(P.wood, -0.1), 1.2 * u, true);
      // mushrooms beside it
      S.shroom = { x: st.x + st.r * 2.2, y: st.y };
      for (const [dx, s, c] of [[2.2, 1, 0], [2.9, 0.65, 1], [-2.3, 0.8, 0]]) {
        const x = st.x + st.r * dx, y = st.y, r = 34 * u * s;
        paint(g, rect(x - r * 0.25, y - r * 1.1, r * 0.5, r * 1.1), shade(P.paper, -0.05), { R, u });
        paint(g, [...ellipse(x, y - r * 1.1, r, r * 0.7, 20).filter(p => p[1] <= y - r * 1.1 + 1)], c ? P.accent[1] : "#e8645a", { R, u });
        for (let i = 0; i < 3; i++) dot(g, x + (i - 1) * r * 0.4, y - r * 1.45 + (i % 2) * r * 0.15, r * 0.1, "#fffaf0", 0.9);
      }
      grassTufts(g, P.near, 0, W, SH * 0.84, R, u, Math.round(W / (18 * u)));
      laneFloor(g, L, P, R, u, "leaves");
    },
    creatures(L, S) {
      const st = S.stump, b = S.branch, u = L.u;
      return [
        { kind: "frog", x: st.x, y: st.y - st.r * 0.95, s: 1 },
        { kind: "frog", x: S.shroom.x, y: S.shroom.y - 38 * u, s: 0.6, flip: -1 },
        { kind: "bird", x: b.x1 + (b.x2 - b.x1) * 0.2, y: b.y - 2 * u, s: 0.9, flip: -1 },
        { kind: "bird", x: b.x1 + (b.x2 - b.x1) * 0.5, y: b.y + 4 * u, s: 0.8 },
        { kind: "cat", x: L.W * 0.18, y: L.SH * 0.86, s: 0.9 }
      ];
    },
    growth: "mushrooms", growthY: L => L.SH * 0.975
  };

  return { room, cottage, town, forest };
})();
