"use strict";
/* Classic 2D styles (Aurora, Sumi ink, Constellation, Dusk) drawn on a canvas */
const Classic = (() => {
/* ============================================================
   Shared drawing helpers
   ============================================================ */
function rr(c, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
}
const sprites = new Map();
function glow(h, s, l) {
  const key = (Math.round(h / 4) * 4) + "|" + s + "|" + l;
  let c = sprites.get(key);
  if (!c) {
    c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, `hsla(${h},${s}%,${Math.min(97, l + 25)}%,1)`);
    gr.addColorStop(0.18, `hsla(${h},${s}%,${l}%,0.55)`);
    gr.addColorStop(0.5, `hsla(${h},${s}%,${l}%,0.12)`);
    gr.addColorStop(1, `hsla(${h},${s}%,${l}%,0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    sprites.set(key, c);
  }
  return c;
}
function blit(c, sp, x, y, r, a) { c.globalAlpha = a; c.drawImage(sp, x - r, y - r, r * 2, r * 2); c.globalAlpha = 1; }
function mkCanvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

/* ============================================================
   Themes
   ============================================================ */
const THEMES = {};

/* --- Aurora: light curtains rise from every key, mirrored in black glass --- */
THEMES.aurora = {
  label: "Aurora", swatch: "linear-gradient(135deg,#3ff0c8,#8a6bff,#ff6fb5)",
  ui: { ink: "#03040a", panel: "rgba(12,14,30,0.72)", fg: "#eef0ff", muted: "rgba(220,225,255,0.58)", line: "rgba(190,200,255,0.14)", accent: "#8fe8d8" },
  reflection: true, text: "#eef0ff", sub: "rgba(220,228,255,0.6)",
  hue(s, p) { const u = (p - s.low) / Math.max(1, s.high - s.low); return 168 + u * 150; },
  reset() { this.parts = []; },
  bg(s) {
    const c = s.ctx, { W, H, sc } = s;
    c.fillStyle = "#03040a"; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      const x = W * (0.5 + 0.38 * Math.sin(s.now * 0.06 + i * 2.1)), y = s.hitY * (0.35 + 0.2 * Math.sin(s.now * 0.045 + i * 1.3));
      const r = Math.max(W, H) * 0.5, gr = c.createRadialGradient(x, y, 0, x, y, r);
      const h = [165, 265, 315][i];
      gr.addColorStop(0, `hsla(${h},85%,45%,${0.06 + s.loud * 0.1})`); gr.addColorStop(1, `hsla(${h},85%,45%,0)`);
      c.fillStyle = gr; c.fillRect(0, 0, W, s.hitY);
    }
    c.globalCompositeOperation = "source-over";
    c.fillStyle = "rgba(255,255,255,0.035)";
    for (const k of s.keys) if (k.p % 12 === 0) c.fillRect(Math.round(k.x), 0, Math.max(1, sc), s.hitY);
  },
  note(s, n, x, y, w, h) {
    const c = s.ctx, hue = this.hue(s, n.pitch), r = w / 2;
    c.globalCompositeOperation = "lighter";
    rr(c, x - 5 * s.sc, y - 5 * s.sc, w + 10 * s.sc, h + 10 * s.sc, r + 5 * s.sc);
    c.fillStyle = `hsla(${hue},100%,60%,${0.1 + n.vel * 0.08})`; c.fill();
    const gr = c.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, `hsla(${hue},90%,55%,0.15)`); gr.addColorStop(1, `hsla(${hue},100%,${62 + n.vel * 12}%,0.95)`);
    rr(c, x, y, w, h, r); c.fillStyle = gr; c.fill();
    c.fillStyle = `rgba(255,255,255,${0.35 + n.vel * 0.4})`;
    c.fillRect(x + w / 2 - s.sc, y + h * 0.3, 2 * s.sc, h * 0.7 - r * 0.5);
    c.globalCompositeOperation = "source-over";
  },
  hit(s, n, k) {
    const hue = this.hue(s, n.pitch), cnt = 6 + Math.round(n.vel * 10);
    for (let i = 0; i < cnt; i++) this.parts.push({ x: k.cx + (Math.random() - 0.5) * k.w, y: s.hitY, vx: (Math.random() - 0.5) * 40, vy: -(50 + Math.random() * 190 * n.vel), life: 0, max: 0.9 + Math.random() * 1.6, r: (3 + Math.random() * 7) * (0.6 + n.vel), hue });
    this.parts.push({ flash: true, x: k.cx, y: s.hitY, life: 0, max: 0.35, r: k.w * 4 * (0.5 + n.vel), hue });
  },
  fx(s) {
    const c = s.ctx, sc = s.sc;
    c.globalCompositeOperation = "lighter";
    // curtains
    for (const k of s.keys) {
      const g = s.glow[k.p]; if (g < 0.02) continue;
      const hue = this.hue(s, k.p), flick = 0.75 + 0.25 * Math.sin(s.now * 9 + k.p * 1.7);
      const hh = s.hitY * (0.18 + 0.32 * g) * flick, wid = k.w * 2.2;
      const gr = c.createLinearGradient(0, s.hitY - hh, 0, s.hitY);
      gr.addColorStop(0, `hsla(${hue},100%,60%,0)`); gr.addColorStop(1, `hsla(${hue},100%,62%,${0.28 * g})`);
      c.fillStyle = gr; c.fillRect(k.cx - wid / 2, s.hitY - hh, wid, hh);
    }
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i]; q.life += s.dt;
      if (q.life > q.max) { this.parts.splice(i, 1); continue; }
      const a = 1 - q.life / q.max;
      if (q.flash) { c.save(); c.translate(q.x, q.y); c.scale(1, 0.18); blit(c, glow(q.hue, 100, 65), 0, 0, q.r * (0.6 + q.life * 2), a * 0.9); c.restore(); continue; }
      q.vy *= 0.985; q.x += (q.vx + Math.sin(q.life * 3 + q.r) * 18) * s.dt * sc; q.y += q.vy * s.dt * sc;
      blit(c, glow(q.hue, 100, 65), q.x, q.y, q.r * sc, a * 0.8);
    }
    const lg = c.createLinearGradient(0, 0, s.W, 0);
    lg.addColorStop(0, "hsla(168,100%,60%,0)"); lg.addColorStop(0.5, `hsla(250,100%,75%,${0.35 + s.loud * 0.5})`); lg.addColorStop(1, "hsla(315,100%,60%,0)");
    c.fillStyle = lg; c.fillRect(0, s.hitY - 1.5 * sc, s.W, 3 * sc);
    c.globalCompositeOperation = "source-over";
  },
  whiteKey(s, k, g, y, h) {
    const c = s.ctx;
    const gr = c.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, "#1c1e2e"); gr.addColorStop(1, "#0b0c15");
    c.fillStyle = gr; c.fillRect(k.x + 0.5 * s.sc, y, k.w - s.sc, h);
    if (g > 0.01) { const hue = this.hue(s, k.p); const pg = c.createLinearGradient(0, y, 0, y + h); pg.addColorStop(0, `hsla(${hue},100%,70%,${g})`); pg.addColorStop(1, `hsla(${hue},100%,45%,${g * 0.5})`); c.fillStyle = pg; c.fillRect(k.x + 0.5 * s.sc, y, k.w - s.sc, h); }
  },
  blackKey(s, k, g, y, h) {
    const c = s.ctx;
    rr(c, k.x, y - 2 * s.sc, k.w, h, 2.5 * s.sc); c.fillStyle = "#020205"; c.fill();
    c.fillStyle = "rgba(255,255,255,0.07)"; c.fillRect(k.x + k.w * 0.2, y, k.w * 0.6, h * 0.85);
    if (g > 0.01) { rr(c, k.x, y - 2 * s.sc, k.w, h, 2.5 * s.sc); c.fillStyle = `hsla(${this.hue(s, k.p)},100%,62%,${g * 0.9})`; c.fill(); }
  },
  water(s, top, h) {
    const c = s.ctx, gr = c.createLinearGradient(0, top, 0, top + h);
    gr.addColorStop(0, "rgba(3,4,10,0.45)"); gr.addColorStop(1, "rgba(3,4,10,0.95)");
    c.fillStyle = gr; c.fillRect(0, top, s.W, h);
  }
};

/* --- Sumi: brush strokes that bleed ink smoke into wet paper --- */
THEMES.sumi = {
  label: "Sumi ink", swatch: "radial-gradient(circle at 40% 40%,#efe6d4 0 34%,#1b1a20 36% 70%,#b8321f 72%)",
  ui: { ink: "#d8cdb8", panel: "rgba(245,238,224,0.82)", fg: "#1b1a20", muted: "rgba(27,26,32,0.6)", line: "rgba(27,26,32,0.16)", accent: "#b8321f" },
  reflection: false, text: "#1b1a20", sub: "rgba(27,26,32,0.6)",
  INK: "22,20,28", RED: "184,50,31",
  isRed(n) { return n.vel > 0.72; },
  reset(s) {
    this.parts = [];
    if (s && (!this.layer || this.layer.width !== s.W || this.layer.height !== s.H)) {
      this.layer = mkCanvas(s.W, s.H); this.paper = this.makePaper(s.W, s.H);
    } else if (this.layer) this.layer.getContext("2d").clearRect(0, 0, this.layer.width, this.layer.height);
  },
  makePaper(W, H) {
    const cv = mkCanvas(W, H), c = cv.getContext("2d");
    c.fillStyle = "#efe6d4"; c.fillRect(0, 0, W, H);
    const img = c.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const v = (Math.random() - 0.5) * 14; d[i] += v; d[i + 1] += v; d[i + 2] += v * 0.9; }
    c.putImageData(img, 0, 0);
    c.strokeStyle = "rgba(120,100,70,0.06)"; c.lineWidth = 1;
    for (let i = 0; i < W * H / 9000; i++) { const x = Math.random() * W, y = Math.random() * H, a = Math.random() * Math.PI; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12 + 6, x + Math.cos(a) * 26, y + Math.sin(a) * 26); c.stroke(); }
    const v = c.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.8);
    v.addColorStop(0, "rgba(90,60,30,0)"); v.addColorStop(1, "rgba(90,60,30,0.22)");
    c.fillStyle = v; c.fillRect(0, 0, W, H);
    return cv;
  },
  bg(s) {
    if (!this.layer || this.layer.width !== s.W || this.layer.height !== s.H) this.reset(s);
    const c = s.ctx;
    c.drawImage(this.paper, 0, 0);
    // ink layer slowly dissolves
    const l = this.layer.getContext("2d");
    l.globalCompositeOperation = "destination-out"; l.fillStyle = `rgba(0,0,0,${0.5 * s.dt})`; l.fillRect(0, 0, s.W, s.H);
    l.globalCompositeOperation = "source-over";
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i]; q.life += s.dt;
      if (q.life > q.max) { this.parts.splice(i, 1); continue; }
      const a = 1 - q.life / q.max;
      q.vx += Math.sin(q.life * 2.3 + q.seed) * 26 * s.dt; q.vy *= 0.993;
      q.x += q.vx * s.dt * s.sc; q.y += q.vy * s.dt * s.sc; q.r += q.grow * s.dt * s.sc;
      l.fillStyle = `rgba(${q.red ? this.RED : this.INK},${q.a * a})`;
      l.beginPath(); l.arc(q.x, q.y, q.r, 0, 7); l.fill();
    }
    c.globalCompositeOperation = "multiply"; c.drawImage(this.layer, 0, 0); c.globalCompositeOperation = "source-over";
  },
  note(s, n, x, y, w, h) {
    const c = s.ctx, red = this.isRed(n), col = red ? this.RED : this.INK;
    const seed = (n.pitch * 7.13 + n.start * 13.7) % 1;
    const tw = w * (0.55 + seed * 0.2), lift = Math.min(h * 0.35, w * 1.6);
    c.beginPath();
    c.moveTo(x + (w - tw) / 2, y + lift * 0.4);
    c.quadraticCurveTo(x + w / 2, y - w * 0.15, x + (w + tw) / 2, y + lift * 0.3);
    c.lineTo(x + w, y + h - w / 2);
    c.quadraticCurveTo(x + w, y + h, x + w / 2, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - w / 2);
    c.closePath();
    c.fillStyle = `rgba(${col},${0.62 + n.vel * 0.3})`; c.fill();
    c.fillStyle = "rgba(239,230,212,0.28)";
    for (let i = 0; i < 3; i++) { const fx = x + w * (0.2 + ((seed * 9.7 + i * 0.31) % 0.6)); c.fillRect(fx, y + lift * (0.6 + i * 0.3), Math.max(1, w * 0.06), h * (0.35 + ((seed + i * 0.27) % 0.4))); }
  },
  hit(s, n, k) {
    const red = this.isRed(n);
    const cnt = 3 + Math.round(n.vel * 4);
    for (let i = 0; i < cnt; i++) this.parts.push({ x: k.cx + (Math.random() - 0.5) * k.w * 0.6, y: s.hitY - 2 * s.sc, vx: (Math.random() - 0.5) * 30, vy: -(25 + Math.random() * 70), r: (1.5 + Math.random() * 2.5) * s.sc, grow: 2 + Math.random() * 5, life: 0, max: 2.2 + Math.random() * 2.6, a: 0.05 + n.vel * 0.05, red, seed: Math.random() * 9 });
    this.parts.push({ x: k.cx, y: s.hitY + 1, vx: 0, vy: 0, r: k.w * 0.4, grow: 26 * n.vel, life: 0, max: 0.6, a: 0.12 * n.vel, red, seed: 0 });
  },
  fx(s) {
    const c = s.ctx;
    c.strokeStyle = `rgba(${this.INK},0.75)`; c.lineWidth = 2 * s.sc; c.beginPath();
    for (let x = 0; x <= s.W; x += 12 * s.sc) { const y = s.hitY - 1 + Math.sin(x * 0.013 / s.sc) * 0.9 * s.sc + Math.sin(x * 0.051 / s.sc) * 0.5 * s.sc; x ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.stroke();
  },
  whiteKey(s, k, g, y, h) {
    const c = s.ctx;
    c.fillStyle = "#f4ecdc"; c.fillRect(k.x, y, k.w, h);
    if (g > 0.01) { c.fillStyle = `rgba(${this.INK},${0.16 * g})`; c.fillRect(k.x, y, k.w, h); c.fillStyle = `rgba(${this.RED},${0.9 * g})`; c.fillRect(k.x + k.w * 0.3, y + h - 7 * s.sc, k.w * 0.4, 3 * s.sc); }
    c.strokeStyle = `rgba(${this.INK},0.6)`; c.lineWidth = 1.2 * s.sc; c.strokeRect(k.x, y, k.w, h);
  },
  blackKey(s, k, g, y, h) {
    const c = s.ctx;
    rr(c, k.x, y - 1, k.w, h, 2 * s.sc); c.fillStyle = g > 0.01 ? `rgba(${this.RED},${0.4 + 0.6 * g})` : `rgb(${this.INK})`; c.fill();
    if (g <= 0.01) { c.fillStyle = "rgba(239,230,212,0.12)"; c.fillRect(k.x + k.w * 0.25, y, k.w * 0.18, h * 0.8); }
  },
  overlay(s) {
    const c = s.ctx, sz = 64 * s.sc, x = s.W - sz - 36 * s.sc, y = 40 * s.sc;
    c.save(); c.translate(x + sz / 2, y + sz / 2); c.rotate(-0.05);
    rr(c, -sz / 2, -sz / 2, sz, sz, 6 * s.sc); c.fillStyle = `rgba(${this.RED},0.85)`; c.fill();
    c.strokeStyle = "rgba(239,230,212,0.7)"; c.lineWidth = 2 * s.sc; rr(c, -sz / 2 + 6 * s.sc, -sz / 2 + 6 * s.sc, sz - 12 * s.sc, sz - 12 * s.sc, 3 * s.sc); c.stroke();
    c.fillStyle = "#efe6d4"; c.font = `${sz * 0.56}px "Hiragino Mincho ProN","Yu Mincho","Noto Serif CJK JP","Songti SC",serif`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("音", 0, sz * 0.03); c.restore();
  }
};

/* --- Constellation: each note becomes a star; chords and phrases draw the lines between them --- */
THEMES.stars = {
  label: "Constellation", swatch: "radial-gradient(circle at 60% 35%,#fff 0 6%,#9fb4ff 8%,#1b1f4a 40%,#070a1c)",
  ui: { ink: "#04061a", panel: "rgba(10,14,38,0.74)", fg: "#e9ecff", muted: "rgba(200,210,255,0.6)", line: "rgba(160,180,255,0.16)", accent: "#b8c6ff" },
  reflection: false, text: "#eef1ff", sub: "rgba(200,210,255,0.62)",
  hue(p) { return fifthsHue(p); },
  reset(s) {
    this.stars = []; this.edges = []; this.parts = []; this.lastGroup = []; this.lastGroupT = -9;
    if (s && (!this.sky || this.sky.width !== s.W || this.sky.height !== s.H)) {
      const cv = this.sky = mkCanvas(s.W, s.H), c = cv.getContext("2d");
      const gr = c.createLinearGradient(0, 0, 0, s.H);
      gr.addColorStop(0, "#04061a"); gr.addColorStop(0.6, "#0b1233"); gr.addColorStop(1, "#1d1846");
      c.fillStyle = gr; c.fillRect(0, 0, s.W, s.H);
      const band = c.createLinearGradient(0, s.H * 0.1, s.W, s.H * 0.6);
      band.addColorStop(0, "rgba(140,150,255,0)"); band.addColorStop(0.5, "rgba(140,150,255,0.07)"); band.addColorStop(1, "rgba(140,150,255,0)");
      c.fillStyle = band; c.fillRect(0, 0, s.W, s.H);
      for (let i = 0; i < s.W * s.H / 2600; i++) { c.fillStyle = `rgba(255,255,255,${Math.random() * Math.random() * 0.8})`; const r = Math.random() < 0.97 ? 0.7 : 1.4; c.fillRect(Math.random() * s.W, Math.random() * s.H, r * s.sc, r * s.sc); }
      this.twinkle = Array.from({ length: 50 }, () => ({ x: Math.random() * s.W, y: Math.random() * s.H * 0.8, ph: Math.random() * 7, sp: 0.6 + Math.random() * 2 }));
    }
  },
  bg(s) {
    if (!this.sky || this.sky.width !== s.W || this.sky.height !== s.H) this.reset(s);
    const c = s.ctx; c.drawImage(this.sky, 0, 0);
    c.globalCompositeOperation = "lighter";
    for (const t of this.twinkle) blit(c, glow(225, 60, 80), t.x, t.y, 7 * s.sc, 0.25 + 0.25 * Math.sin(s.now * t.sp + t.ph));
    c.globalCompositeOperation = "source-over";
  },
  note(s, n, x, y, w, h) {
    const c = s.ctx, hue = this.hue(n.pitch), cx = x + w / 2, hy = y + h;
    c.globalCompositeOperation = "lighter";
    rr(c, x + w * 0.15, y, w * 0.7, h, w * 0.35); c.strokeStyle = `hsla(${hue},80%,78%,0.22)`; c.lineWidth = s.sc; c.stroke();
    const gr = c.createLinearGradient(0, y, 0, hy);
    gr.addColorStop(0, `hsla(${hue},80%,80%,0)`); gr.addColorStop(1, `hsla(${hue},90%,82%,0.85)`);
    c.fillStyle = gr; const lw = Math.max(1.5 * s.sc, w * 0.16); c.fillRect(cx - lw / 2, y, lw, h);
    blit(c, glow(hue, 85, 72), cx, hy - w * 0.2, w * (1.1 + n.vel * 0.6), 0.95);
    c.globalCompositeOperation = "source-over";
  },
  hit(s, n, k) {
    const hue = this.hue(n.pitch);
    const st = { x: k.cx + (Math.random() - 0.5) * k.w * 0.6, y: s.hitY - 8 * s.sc, vy: -(38 + Math.random() * 34), vx: (Math.random() - 0.5) * 8, life: 0, max: 9 + Math.random() * 4, r: (8 + n.vel * 12) * s.sc, hue };
    if (s.t - this.lastGroupT > 0.06) { this.prevGroup = this.lastGroup; this.prevT = this.lastGroupT; this.lastGroup = []; this.lastGroupT = s.t; }
    for (const o of this.lastGroup) this.edges.push([o, st, 1]);
    if (this.prevGroup && this.prevGroup.length && s.t - this.prevT < 0.7 && !this.lastGroup.length) {
      let best = this.prevGroup[0]; for (const o of this.prevGroup) if (Math.abs(o.x - st.x) < Math.abs(best.x - st.x)) best = o;
      this.edges.push([best, st, 0.6]);
    }
    this.lastGroup.push(st); this.stars.push(st);
    for (let i = 0; i < 5; i++) { const a = Math.random() * 7; this.parts.push({ x: st.x, y: st.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, life: 0, max: 0.5, hue }); }
  },
  fx(s) {
    const c = s.ctx, sc = s.sc;
    for (const st of this.stars) { st.life += s.dt; st.x += st.vx * s.dt * sc; st.y += st.vy * s.dt * sc; }
    c.globalCompositeOperation = "lighter";
    c.lineWidth = 1.2 * sc;
    this.edges = this.edges.filter(([a, b]) => a.life < a.max && b.life < b.max);
    for (const [a, b, wgt] of this.edges) {
      const al = Math.min(1 - a.life / a.max, 1 - b.life / b.max, Math.min(a.life, b.life) * 4) * 0.55 * wgt;
      c.strokeStyle = `rgba(210,220,255,${al})`; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    }
    this.stars = this.stars.filter(st => st.life < st.max);
    for (const st of this.stars) {
      const a = 1 - st.life / st.max, flare = Math.max(0, 1 - st.life * 2.5);
      blit(c, glow(st.hue, 80, 75), st.x, st.y, st.r * (1 + flare * 1.6), a);
      c.fillStyle = `rgba(255,255,255,${a})`; c.fillRect(st.x - sc, st.y - sc, 2 * sc, 2 * sc);
      if (flare > 0) { c.fillStyle = `hsla(${st.hue},90%,85%,${flare * 0.6})`; c.fillRect(st.x - st.r * 2.5, st.y - 0.5 * sc, st.r * 5, sc); c.fillRect(st.x - 0.5 * sc, st.y - st.r * 2.5, sc, st.r * 5); }
    }
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i]; q.life += s.dt; if (q.life > q.max) { this.parts.splice(i, 1); continue; }
      q.x += q.vx * s.dt * sc; q.y += q.vy * s.dt * sc; q.vx *= 0.94; q.vy *= 0.94;
      blit(c, glow(q.hue, 90, 80), q.x, q.y, 4 * sc, 1 - q.life / q.max);
    }
    c.fillStyle = "rgba(190,205,255,0.35)"; c.fillRect(0, s.hitY - 0.5 * sc, s.W, sc);
    c.globalCompositeOperation = "source-over";
  },
  whiteKey(s, k, g, y, h) {
    const c = s.ctx;
    c.fillStyle = "#0a0f2a"; c.fillRect(k.x, y, k.w, h);
    if (g > 0.01) { const pg = c.createLinearGradient(0, y, 0, y + h); pg.addColorStop(0, `hsla(${this.hue(k.p)},90%,80%,${g * 0.9})`); pg.addColorStop(1, `hsla(${this.hue(k.p)},90%,60%,${g * 0.2})`); c.fillStyle = pg; c.fillRect(k.x, y, k.w, h); }
    c.strokeStyle = "rgba(170,190,255,0.28)"; c.lineWidth = s.sc; c.strokeRect(k.x + 0.5, y + 0.5, k.w - 1, h - 1);
  },
  blackKey(s, k, g, y, h) {
    const c = s.ctx;
    rr(c, k.x, y - 1, k.w, h, 2 * s.sc); c.fillStyle = "#03051a"; c.fill();
    c.strokeStyle = "rgba(170,190,255,0.3)"; c.lineWidth = s.sc; c.stroke();
    if (g > 0.01) { c.fillStyle = `hsla(${this.hue(k.p)},90%,72%,${g * 0.85})`; c.fill(); }
  }
};

/* --- Dusk: silhouetted notes against a low sun, rippling on a lake --- */
THEMES.dusk = {
  label: "Dusk", swatch: "linear-gradient(180deg,#3a2a66,#e0708a 55%,#ffc27a)",
  ui: { ink: "#1a1230", panel: "rgba(40,24,60,0.7)", fg: "#fff3ea", muted: "rgba(255,236,225,0.65)", line: "rgba(255,220,200,0.18)", accent: "#ffc27a" },
  reflection: true, text: "#fff4ec", sub: "rgba(255,240,230,0.75)",
  reset() { this.parts = []; },
  bg(s) {
    const c = s.ctx, { W, H } = s;
    const gr = c.createLinearGradient(0, 0, 0, s.hitY);
    gr.addColorStop(0, "#241a4a"); gr.addColorStop(0.45, "#6a3a78"); gr.addColorStop(0.75, "#d9688a"); gr.addColorStop(1, "#ffb37c");
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
    const sx = W * 0.5, sy = s.hitY - Math.min(W, H) * 0.06, sr = Math.min(W, H) * (0.26 + s.loud * 0.02);
    const halo = c.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 2.6);
    halo.addColorStop(0, "rgba(255,210,150,0.55)"); halo.addColorStop(1, "rgba(255,170,140,0)");
    c.fillStyle = halo; c.fillRect(0, 0, W, s.hitY);
    const sun = c.createLinearGradient(0, sy - sr, 0, sy + sr);
    sun.addColorStop(0, "#fff0c8"); sun.addColorStop(1, "#ff9a78");
    c.fillStyle = sun; c.beginPath(); c.arc(sx, sy, sr, 0, 7); c.fill();
    c.fillStyle = "rgba(255,255,255,0.12)";
    for (let i = 0; i < 4; i++) {
      const cy = s.hitY * (0.18 + i * 0.13), cx = ((s.now * (6 + i * 3) * s.sc + i * W * 0.37) % (W * 1.6)) - W * 0.3;
      c.beginPath(); c.ellipse(cx, cy, W * 0.22, 7 * s.sc + i * 2 * s.sc, 0, 0, 7); c.fill();
    }
  },
  note(s, n, x, y, w, h) {
    const c = s.ctx;
    const body = c.createLinearGradient(0, y, 0, y + h);
    body.addColorStop(0, "rgba(30,18,46,0.25)"); body.addColorStop(Math.min(1, w * 3 / Math.max(h, 1)), `rgba(30,18,46,${0.82 + n.vel * 0.15})`); body.addColorStop(1, `rgba(30,18,46,${0.82 + n.vel * 0.15})`);
    rr(c, x, y, w, h, w * 0.45); c.fillStyle = body; c.fill();
    const near = clamp(1 - (s.hitY - (y + h)) / (s.hitY * 0.5), 0, 1);
    const rim = c.createLinearGradient(0, y + h - w * 1.2, 0, y + h);
    rim.addColorStop(0, "rgba(255,200,140,0)"); rim.addColorStop(1, `rgba(255,214,160,${0.25 + near * 0.6})`);
    rr(c, x, y, w, h, w * 0.45); c.fillStyle = rim; c.fill();
  },
  hit(s, n, k) {
    const cnt = 2 + Math.round(n.vel * 5);
    for (let i = 0; i < cnt; i++) this.parts.push({ x: k.cx, y: s.hitY, vx: (Math.random() - 0.5) * 70, vy: -(80 + Math.random() * 140), life: 0, max: 0.9 + Math.random() * 0.6, spark: true });
    const top = s.kbY + s.kbH;
    this.parts.push({ x: k.cx, y: top + (s.H - top) * (0.2 + Math.random() * 0.5), life: 0, max: 2.2, r: 0, v: k.w * (1.4 + n.vel * 2) });
  },
  fx(s) {
    const c = s.ctx, sc = s.sc;
    c.globalCompositeOperation = "lighter";
    for (const k of s.keys) { const g = s.glow[k.p]; if (g > 0.02) blit(c, glow(30, 100, 70), k.cx, s.hitY, k.w * 2.4, g * 0.7); }
    for (const q of this.parts) {
      if (!q.spark) continue; q.life += s.dt;
      q.vy += 260 * s.dt; q.x += q.vx * s.dt * sc; q.y += q.vy * s.dt * sc;
      if (q.y < s.hitY) blit(c, glow(36, 100, 75), q.x, q.y, 5 * sc, 1 - q.life / q.max);
    }
    c.globalCompositeOperation = "source-over";
  },
  whiteKey(s, k, g, y, h) {
    const c = s.ctx;
    c.fillStyle = "#1e1430"; c.fillRect(k.x, y, k.w, h);
    if (g > 0.01) { const pg = c.createLinearGradient(0, y, 0, y + h); pg.addColorStop(0, `rgba(255,214,160,${g})`); pg.addColorStop(1, `rgba(255,140,120,${g * 0.5})`); c.fillStyle = pg; c.fillRect(k.x, y, k.w, h); }
    c.fillStyle = "rgba(255,200,170,0.16)"; c.fillRect(k.x, y, Math.max(1, s.sc), h);
  },
  blackKey(s, k, g, y, h) {
    const c = s.ctx;
    rr(c, k.x, y - 1, k.w, h, 2 * s.sc); c.fillStyle = g > 0.01 ? `rgba(255,170,120,${0.3 + g * 0.7})` : "#0e0818"; c.fill();
  },
  water(s, top, h) {
    const c = s.ctx, gr = c.createLinearGradient(0, top, 0, top + h);
    gr.addColorStop(0, "rgba(40,22,70,0.35)"); gr.addColorStop(1, "rgba(20,12,40,0.85)");
    c.fillStyle = gr; c.fillRect(0, top, s.W, h);
    c.globalCompositeOperation = "lighter";
    const sx = s.W * 0.5;
    for (let i = 0; i < 26; i++) {
      const yy = top + h * ((i * 0.618) % 1), f = Math.sin(s.now * 3 + i * 4.1);
      if (f > 0.3) { c.fillStyle = `rgba(255,210,150,${(f - 0.3) * 0.5})`; const ww = s.W * (0.04 + ((i * 0.37) % 0.12)) * (1 - (yy - top) / h * 0.5); c.fillRect(sx - ww / 2 + Math.sin(i * 2.7) * s.W * 0.06, yy, ww, 2 * s.sc); }
    }
    c.globalCompositeOperation = "source-over";
    c.lineWidth = 1.5 * s.sc;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      if (q.spark) { if (q.life > q.max) this.parts.splice(i, 1); continue; }
      q.life += s.dt; if (q.life > q.max) { this.parts.splice(i, 1); continue; }
      const a = 1 - q.life / q.max, r = q.v * (0.3 + q.life * 1.2);
      c.strokeStyle = `rgba(255,220,180,${a * 0.55})`;
      c.beginPath(); c.ellipse(q.x, q.y, r, r * 0.18, 0, 0, 7); c.stroke();
      if (q.life > 0.3) { c.strokeStyle = `rgba(255,220,180,${a * 0.3})`; c.beginPath(); c.ellipse(q.x, q.y, r * 0.6, r * 0.11, 0, 0, 7); c.stroke(); }
    }
  }
};
const THEME_ORDER = ["aurora", "sumi", "stars", "dusk"];

/* ============================================================
   Renderer
   ============================================================ */
const cv = document.getElementById("cv2d"), ctx = cv.getContext("2d");
const R = {
  theme: THEMES.aurora, keys: [], keyOf: [], glow: new Float32Array(128), low: 21, high: 108, lookahead: 2.6, loud: 0, hitIdx: 0,
  layout(song, mode) {
    let lo = 21, hi = 108;
    if (mode !== "88" && song && song.notes.length) {
      lo = 127; hi = 0; for (const n of song.notes) { if (n.pitch < lo) lo = n.pitch; if (n.pitch > hi) hi = n.pitch; }
      lo -= 2; hi += 2;
      while (hi - lo < 36) { lo--; hi++; }
      lo = clamp(lo, 21, 108); hi = clamp(hi, 21, 108);
      while (isBlack(lo)) lo--; while (isBlack(hi)) hi++;
    }
    this.low = lo; this.high = hi;
  },
  geometry(W, H) {
    const th = this.theme;
    let whites = 0; for (let p = this.low; p <= this.high; p++) if (!isBlack(p)) whites++;
    const ww = W / whites;
    const kbH = clamp(ww * 6, H * 0.07, H * (th.reflection ? 0.12 : 0.15));
    const kbY = th.reflection ? Math.round(H * 0.8 - kbH) : Math.round(H - kbH);
    const keys = [], keyOf = [];
    let wi = 0;
    const adj = { 1: -0.06, 3: 0.06, 6: -0.08, 8: 0, 10: 0.08 };
    for (let p = this.low; p <= this.high; p++) {
      let k;
      if (!isBlack(p)) { k = { p, x: wi * ww, w: ww, black: false }; wi++; }
      else { const bw = ww * 0.6; k = { p, x: wi * ww + adj[p % 12] * ww - bw / 2, w: bw, black: true }; }
      k.cx = k.x + k.w / 2; keys.push(k); keyOf[p] = k;
    }
    Object.assign(this, { W, H, ww, kbH, kbY, keys, keyOf });
  },
  resetFx() { this.glow.fill(0); this.theme.reset && this.theme.reset(this.state()); },
  state() {
    return { ctx, W: cv.width, H: cv.height, sc: Math.min(cv.width, cv.height) / 1080, keys: this.keys, keyOf: this.keyOf, low: this.low, high: this.high, kbY: this.kbY, kbH: this.kbH, hitY: this.kbY, glow: this.glow, loud: this.loud };
  },
  frame(song, t, dt, now) {
    const W = cv.width, H = cv.height;
    if (W !== this.W || H !== this.H || !this.keys.length) this.geometry(W, H);
    const th = this.theme, s = this.state();
    s.t = t; s.dt = dt; s.now = now;
    const notes = song ? song.notes : [];
    const pps = this.kbY / this.lookahead;

    // which notes are sounding / newly struck
    const act = new Float32Array(128);
    const lo = lowerBound(notes, t - 30.5);
    const visible = [];
    let loud = 0;
    for (let i = lo; i < notes.length; i++) {
      const n = notes[i];
      if (n.start > t + this.lookahead) break;
      if (n.end < t - 0.1) continue;
      visible.push(n);
      if (n.start <= t && n.end > t) { act[n.pitch] = Math.max(act[n.pitch], n.vel); loud += n.vel; }
    }
    const k = Math.exp(-dt * 7);
    for (let p = 0; p < 128; p++) this.glow[p] = Math.max(this.glow[p] * k, act[p]);
    this.loud += (clamp(loud / 5, 0, 1) - this.loud) * Math.min(1, dt * 4);
    s.loud = this.loud;
    while (this.hitIdx < notes.length && notes[this.hitIdx].start <= t) {
      const n = notes[this.hitIdx++], key = this.keyOf[n.pitch];
      if (key && t - n.start < 0.25 && th.hit) th.hit(s, n, key);
    }

    th.bg(s);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, this.kbY); ctx.clip();
    for (const n of visible) {
      const key = this.keyOf[n.pitch]; if (!key) continue;
      const yb = this.kbY - (n.start - t) * pps, yt = this.kbY - (n.end - t) * pps;
      if (yb < 0) continue;
      const w = key.black ? key.w * 0.9 : key.w * 0.8;
      th.note(s, n, key.cx - w / 2, yt, w, Math.max(yb - yt, w * 0.6));
    }
    ctx.restore();
    th.fx && th.fx(s);

    // keyboard
    const press = 2 * s.sc;
    for (const key of this.keys) if (!key.black) th.whiteKey(s, key, this.glow[key.p], this.kbY + (this.glow[key.p] > 0.5 ? press : 0), this.kbH);
    for (const key of this.keys) if (key.black) th.blackKey(s, key, this.glow[key.p], this.kbY + (this.glow[key.p] > 0.5 ? press : 0), this.kbH * 0.62);
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(0, this.kbY, W, 3 * s.sc);

    if (th.reflection) this.reflect(s);
    th.overlay && th.overlay(s);
    this.titleCard(s, song, t);
    if (song && song.duration > 0) { ctx.fillStyle = th.sub; ctx.fillRect(0, 0, W * clamp(t / song.duration, 0, 1), 3 * s.sc); }
  },
  reflect(s) {
    const top = Math.round(this.kbY + this.kbH), h = s.H - top; if (h < 4) return;
    // Copy the mirrored source once, then draw a few wavy strips from the copy.
    const srcH = Math.min(top, Math.ceil(h / 0.92) + 2);
    if (!this.mirror || this.mirror.width !== s.W || this.mirror.height !== srcH) this.mirror = mkCanvas(s.W, srcH);
    const m = this.mirror.getContext("2d");
    m.clearRect(0, 0, s.W, srcH);
    m.save(); m.translate(0, srcH); m.scale(1, -1); m.drawImage(cv, 0, top - srcH, s.W, srcH, 0, 0, s.W, srcH); m.restore();
    const step = Math.max(4, Math.round(6 * s.sc));
    for (let y = 0; y < h; y += step) {
      const sy = Math.min(srcH - step, y * 0.92);
      const dx = (Math.sin(y * 0.11 / s.sc + s.now * 1.7) * 0.7 + Math.sin(y * 0.031 / s.sc - s.now * 1.1)) * (0.4 + y / s.sc * 0.012) * s.sc;
      ctx.drawImage(this.mirror, 0, sy, s.W, step, dx, top + y, s.W, step + 1);
    }
    this.theme.water(s, top, h);
  },
  titleCard(s, song, t) {
    if (!song) return;
    const a = t < 2.5 ? 1 : clamp(1 - (t - 2.5) / 1.5, 0, 1);
    if (a <= 0) return;
    const portrait = s.H > s.W;
    const size = (portrait ? 92 : 78) * s.sc * (song.title.length > 22 ? 0.7 : 1);
    ctx.save(); ctx.globalAlpha = a; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = this.theme.text;
    ctx.font = `${size}px Italiana, Didot, "Bodoni 72", Georgia, serif`;
    const y = s.H * (portrait ? 0.24 : 0.3);
    wrapText(song.title, s.W / 2, y, s.W * 0.84, size * 1.08);
    ctx.fillStyle = this.theme.sub; ctx.font = `500 ${22 * s.sc}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.fillText(`♩ = ${song.bpm}   ·   ${song.notes.length.toLocaleString()} notes   ·   ${fmt(song.duration)}`.toUpperCase(), s.W / 2, y + size * 0.75);
    ctx.restore();
  }
};
function wrapText(text, x, y, max, lh) {
  const words = text.split(/\s+/), lines = []; let line = "";
  for (const w of words) { const tr = line ? line + " " + w : w; if (ctx.measureText(tr).width > max && line) { lines.push(line); line = w; } else line = tr; }
  lines.push(line);
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, x, y - (Math.min(lines.length, 3) - 1 - i) * lh));
}
  return { R, THEMES, THEME_ORDER, canvas: cv };
})();
