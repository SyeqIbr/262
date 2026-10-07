"use strict";
/* Storybook renderer: a painted scene with creatures that react to the music.
   All painting happens once in build(); frame() only places cached images. */
const Storybook = (() => {
  const { paint, rect, ellipse, ribbon, bezier, shade, mix, rng, ink, dot, sprite, blit, paperTexture } = Painter;
  const TAU = Math.PI * 2;
  const pcIndex = p => (p % 12) * 7 % 12;
  const easeOut = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const HAND = '"Patrick Hand", "Comic Sans MS", "Chalkboard SE", cursive';

  let song = null, analysis = null, sceneName = "cottage", paletteName = "pastel", lookahead = 2.2, rangeMode = "auto";
  let C = null; // everything built for the current size/scene/palette/medium/song
  let dirty = true;

  /* ---------- layout ---------- */
  function layout(W, H) {
    const portrait = H >= W;
    const kbH = Math.round(H * (portrait ? 0.1 : 0.15)), kbY = Math.round(H - kbH - H * 0.02);
    const SH = Math.round(H * (portrait ? 0.64 : 0.55));
    const u = Math.min(W, SH * 1.7) / 1000;
    return { W, H, kbH, kbY, SH, u, portrait };
  }
  function keyLayout(L) {
    let lo = 21, hi = 108;
    if (rangeMode !== "88" && song) {
      lo = 127; hi = 0; for (const n of song.notes) { lo = Math.min(lo, n.pitch); hi = Math.max(hi, n.pitch); }
      lo -= 2; hi += 2; while (hi - lo < 36) { lo--; hi++; }
      lo = clamp(lo, 21, 108); hi = clamp(hi, 21, 108);
      while (isBlack(lo)) lo--; while (isBlack(hi)) hi++;
    }
    const margin = L.W * 0.03, KW = L.W - margin * 2;
    let whites = 0; for (let p = lo; p <= hi; p++) if (!isBlack(p)) whites++;
    const ww = KW / whites, keys = [], keyOf = [], adj = { 1: -0.06, 3: 0.06, 6: -0.08, 8: 0, 10: 0.08 };
    let wi = 0;
    for (let p = lo; p <= hi; p++) {
      let k;
      if (!isBlack(p)) { k = { p, x: margin + wi * ww, w: ww, black: false }; wi++; }
      else { const bw = ww * 0.6; k = { p, x: margin + wi * ww + adj[p % 12] * ww - bw / 2, w: bw, black: true }; }
      k.cx = k.x + k.w / 2; keys.push(k); keyOf[p] = k;
    }
    return { lo, hi, keys, keyOf, ww };
  }

  /* ---------- creature sprites ---------- */
  function makeCreatures(P, u, seed) {
    const R = rng(seed), ic = P.ink, blush = "#ff8fa3";
    const lighter = c => shade(c, 0.4);
    const catEyes = (g, open, y) => {
      if (open) {
        if (P.night) { for (const x of [-11, 11]) { dot(g, x * u, y, 4.6 * u, "#ffe07a"); dot(g, x * u, y, 2 * u, ic); } }
        else for (const x of [-11, 11]) { dot(g, x * u, y, 3.4 * u, ic); dot(g, (x + 1.2) * u, y - 1.2 * u, 1 * u, "#fff"); }
      } else for (const x of [-11, 11]) ink(g, bezier([(x - 5) * u, y], [x * u, y + 4 * u], [(x + 5) * u, y], 6), P.night ? "#d9d4ff" : ic, 2 * u);
    };
    const catFace = (g, open, y0) => {
      catEyes(g, open, y0 - 4 * u);
      paint(g, [[-3 * u, y0 + 3 * u], [3 * u, y0 + 3 * u], [0, y0 + 6 * u]], "#f59aa8", { R, u, layers: 3 });
      ink(g, [[-5 * u, y0 + 9 * u], [-2.5 * u, y0 + 11 * u], [0, y0 + 8 * u], [2.5 * u, y0 + 11 * u], [5 * u, y0 + 9 * u]], P.night ? "#d9d4ff" : ic, 1.6 * u);
      dot(g, -18 * u, y0 + 6 * u, 5 * u, blush, 0.45); dot(g, 18 * u, y0 + 6 * u, 5 * u, blush, 0.45);
      for (const s of [-1, 1]) for (const k of [-1, 1]) ink(g, [[s * 22 * u, y0 + 6 * u + k * 2 * u], [s * 36 * u, y0 + 4 * u + k * 5 * u]], P.night ? "#9f9ac8" : shade(ic, 0.3), 1 * u);
    };
    const catHead = (g, open) => {
      for (const s of [-1, 1]) {
        paint(g, [[s * 28 * u, -36 * u], [s * 20 * u, -66 * u], [s * 4 * u, -48 * u]], P.cat, { R, u });
        paint(g, [[s * 22 * u, -42 * u], [s * 18 * u, -58 * u], [s * 10 * u, -48 * u]], "#f7b6c2", { R, u, layers: 4 });
      }
      paint(g, ellipse(0, -30 * u, 31 * u, 27 * u), P.cat, { R, u });
      catFace(g, open, -28 * u);
    };
    const cat = {
      body: sprite(90 * u, 100 * u, g => {
        paint(g, ellipse(0, -42 * u, 33 * u, 42 * u), P.cat, { R, u });
        paint(g, ellipse(0, -38 * u, 15 * u, 24 * u), lighter(P.cat), { R, u, alpha: 0.9 });
        for (const s of [-1, 1]) paint(g, ellipse(s * 13 * u, -6 * u, 11 * u, 7 * u), lighter(P.cat), { R, u });
      }),
      head: sprite(80 * u, 70 * u, g => catHead(g, true)),
      headSleep: sprite(80 * u, 70 * u, g => catHead(g, false)),
      tail: sprite(60 * u, 70 * u, g => paint(g, ribbon(bezier([0, 0], [34 * u, -6 * u], [36 * u, -52 * u], 14), 11 * u, 7 * u), P.cat, { R, u })),
      loaf: sprite(140 * u, 70 * u, g => {
        paint(g, ribbon(bezier([40 * u, -8 * u], [10 * u, 6 * u], [-50 * u, -4 * u], 14), 12 * u, 8 * u), P.cat, { R, u });
        paint(g, ellipse(8 * u, -28 * u, 52 * u, 28 * u), P.cat, { R, u });
        g.save(); g.translate(-30 * u, 4 * u); g.scale(0.85, 0.85); catHead(g, false); g.restore();
      })
    };
    const frogBody = open => sprite(90 * u, 74 * u, g => {
      for (const s of [-1, 1]) paint(g, ellipse(s * 28 * u, -6 * u, 13 * u, 7 * u), shade(P.frog, -0.1), { R, u });
      paint(g, ellipse(0, -24 * u, 36 * u, 24 * u), P.frog, { R, u });
      paint(g, ellipse(0, -16 * u, 23 * u, 13 * u), lighter(P.frog), { R, u, alpha: 0.85 });
      for (const s of [-1, 1]) paint(g, ellipse(s * 16 * u, -46 * u, 12 * u, 11 * u), P.frog, { R, u });
      for (const s of [-1, 1]) {
        if (open) { dot(g, s * 16 * u, -47 * u, 7 * u, "#fffaf0"); dot(g, s * 16 * u, -46 * u, 3.6 * u, ic); dot(g, (s * 16 + 1.5) * u, -48 * u, 1.1 * u, "#fff"); }
        else ink(g, bezier([(s * 16 - 6) * u, -47 * u], [s * 16 * u, -43 * u], [(s * 16 + 6) * u, -47 * u], 6), ic, 2 * u);
      }
      ink(g, bezier([-14 * u, -28 * u], [0, -21 * u], [14 * u, -28 * u], 8), ic, 1.8 * u);
      dot(g, -24 * u, -30 * u, 5 * u, blush, 0.5); dot(g, 24 * u, -30 * u, 5 * u, blush, 0.5);
    });
    const frog = { open: frogBody(true), closed: frogBody(false) };
    const birdHead = open => sprite(40 * u, 40 * u, g => {
      paint(g, ellipse(0, -18 * u, 14 * u, 13 * u), P.bird, { R, u });
      if (open) { paint(g, [[-11 * u, -21 * u], [-24 * u, -24 * u], [-12 * u, -17 * u]], "#f6b24a", { R, u, layers: 4 }); paint(g, [[-11 * u, -15 * u], [-22 * u, -10 * u], [-12 * u, -18 * u]], "#f6b24a", { R, u, layers: 4 }); }
      else paint(g, [[-11 * u, -20 * u], [-22 * u, -17 * u], [-11 * u, -14 * u]], "#f6b24a", { R, u, layers: 4 });
      dot(g, -4 * u, -21 * u, 2.4 * u, ic); dot(g, -3.4 * u, -21.8 * u, 0.8 * u, "#fff");
      dot(g, 2 * u, -13 * u, 4 * u, blush, 0.5);
    });
    const bird = {
      body: sprite(64 * u, 50 * u, g => {
        ink(g, [[-4 * u, 0], [-4 * u, -8 * u]], ic, 1.4 * u); ink(g, [[4 * u, 0], [4 * u, -8 * u]], ic, 1.4 * u);
        paint(g, [[16 * u, -20 * u], [34 * u, -30 * u], [32 * u, -14 * u]], shade(P.bird, -0.15), { R, u });
        paint(g, ellipse(0, -20 * u, 21 * u, 16 * u), P.bird, { R, u });
        paint(g, ellipse(-4 * u, -15 * u, 12 * u, 8 * u), lighter(P.bird), { R, u, alpha: 0.9 });
        paint(g, ellipse(7 * u, -22 * u, 12 * u, 7 * u, 12, 0.35), shade(P.bird, -0.18), { R, u });
      }),
      head: birdHead(false), headSing: birdHead(true)
    };
    return { cat, frog, bird };
  }

  /* ---------- growth sprites ---------- */
  function makeGrowth(P, u, kind, seed) {
    const R = rng(seed), out = [];
    if (kind === "flowers") {
      P.accent.forEach((c, i) => {
        out.push(sprite(40 * u, 70 * u, g => { // daisy
          paint(g, ribbon(bezier([0, 0], [3 * u, -25 * u], [0, -48 * u], 8), 3.5 * u, 2.5 * u), shade(P.near, -0.15), { R, u, layers: 4 });
          paint(g, ellipse(8 * u, -22 * u, 8 * u, 4 * u, 10, -0.5), shade(P.near, -0.05), { R, u, layers: 4 });
          for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; paint(g, ellipse(Math.cos(a) * 9 * u, -50 * u + Math.sin(a) * 9 * u, 7 * u, 4.5 * u, 10, a), c, { R, u, layers: 4 }); }
          dot(g, 0, -50 * u, 5 * u, i % 2 ? "#fff3c4" : "#f6b24a");
        }));
        out.push(sprite(36 * u, 64 * u, g => { // tulip
          paint(g, ribbon(bezier([0, 0], [-3 * u, -20 * u], [0, -38 * u], 8), 3.5 * u, 2.5 * u), shade(P.near, -0.15), { R, u, layers: 4 });
          paint(g, [[-11 * u, -50 * u], [-6 * u, -38 * u], [6 * u, -38 * u], [11 * u, -50 * u], [5 * u, -44 * u], [0, -54 * u], [-5 * u, -44 * u]], c, { R, u, layers: 5 });
        }));
      });
    } else if (kind === "mushrooms") {
      const caps = ["#e8645a", P.accent[1], P.accent[3], "#f2a65a", P.accent[0]];
      caps.forEach((c, i) => {
        out.push(sprite(40 * u, 50 * u, g => {
          paint(g, rect(-4 * u, -24 * u, 8 * u, 24 * u), shade(P.paper, -0.04), { R, u, layers: 4 });
          paint(g, ellipse(0, -24 * u, 16 * u, 12 * u, 16).filter(p => p[1] <= -23 * u), c, { R, u, layers: 5 });
          for (let k = 0; k < 3; k++) dot(g, (k - 1) * 6 * u, -31 * u + (k % 2) * 3 * u, 1.8 * u, "#fffaf0", 0.9);
        }));
        out.push(sprite(40 * u, 50 * u, g => { // fern / flower clump
          for (let k = -2; k <= 2; k++) paint(g, ribbon(bezier([0, 0], [k * 6 * u, -16 * u], [k * 12 * u, -30 * u + Math.abs(k) * 6 * u], 8), 4 * u, 1.5 * u), shade(P.near, -0.1 + i * 0.03), { R, u, layers: 3 });
          dot(g, 0, -32 * u, 4.5 * u, P.accent[(i + 2) % P.accent.length]);
        }));
      });
    }
    return out;
  }

  /* ---------- painted note strokes and key dabs ---------- */
  function noteTex(P, color, u, seed) {
    return sprite(36 * u, 220 * u, g => paint(g, ribbon([[0, -6 * u], [0, -110 * u], [0, -214 * u]], 32 * u, 28 * u), color, { R: rng(seed), u, wobble: 0.15, angle: Math.PI / 2 }), 3 * u);
  }
  function tag(P, u, title, sub) {
    const c = mkCanvas(10, 10).getContext("2d");
    c.font = `${58 * u}px ${HAND}`; const tw = Math.max(c.measureText(title).width, 280 * u);
    const w = Math.min(tw + 90 * u, 960 * u), h = 132 * u;
    return sprite(w, h, g => {
      paint(g, rect(-w / 2, -h, w, h), shade(P.paper, -0.02), { R: rng(5), u, wobble: 0.25 });
      g.fillStyle = P.ink; g.textAlign = "center"; g.textBaseline = "middle";
      g.font = `${58 * u}px ${HAND}`;
      let t = title; while (g.measureText(t).width > w - 60 * u && t.length > 4) t = t.slice(0, -2);
      g.fillText(t === title ? t : t + "…", 0, -h * 0.6);
      g.font = `${26 * u}px ${HAND}`; g.globalAlpha = 0.7; g.fillText(sub, 0, -h * 0.22);
      dot(g, -w / 2 + 18 * u, -h + 18 * u, 6 * u, "#e8645a", 0.85);
    });
  }

  /* ---------- build everything for the current settings ---------- */
  function build(W, H) {
    dirty = false;
    const L = layout(W, H), P = PALETTES[paletteName], scene = SCENES[sceneName], u = L.u;
    const seed = (song ? song.notes.length : 1) * 31 + sceneName.length;
    const S = scene.layout(L);
    const plate = mkCanvas(W, H), g = plate.getContext("2d");
    g.fillStyle = P.paper; g.fillRect(0, 0, W, H);
    scene.plate(g, L, P, rng(seed), S);
    // painted keyboard
    const K = keyLayout(L);
    const kbR = rng(seed + 3);
    paint(g, rect(K.keys[0].x - 14 * u, L.kbY - 12 * u, K.keys[K.keys.length - 1].x + K.keys[K.keys.length - 1].w - K.keys[0].x + 28 * u, L.kbH + 22 * u), P.wood, { R: kbR, u, wobble: 0.08 });
    const ivory = mix(P.paper, "#ffffff", 0.5), ebony = P.night ? "#191a2e" : shade(P.ink, -0.1);
    for (const k of K.keys) if (!k.black) paint(g, rect(k.x + 1.2 * u, L.kbY, k.w - 2.4 * u, L.kbH), ivory, { R: kbR, u, wobble: 0.05, layers: 4 });
    for (const k of K.keys) if (k.black) paint(g, rect(k.x, L.kbY - 2 * u, k.w, L.kbH * 0.62), ebony, { R: kbR, u, wobble: 0.08, layers: 4 });
    const paper = paperTexture(W, H, Painter.medium, 9);
    const sprites = makeCreatures(P, u, seed + 7);
    const growthKind = scene.growth;
    const growthSprites = growthKind === "windows" ? [] : makeGrowth(P, u, growthKind, seed + 11);
    const colors = P.accent;
    const notes = colors.map((c, i) => noteTex(P, c, u, 100 + i));
    const dabW = colors.map((c, i) => sprite(40 * u, 100 * u, gg => paint(gg, rect(-19 * u, -100 * u, 38 * u, 100 * u), c, { R: rng(200 + i), u, wobble: 0.1, layers: 5 }), 2 * u));
    // creatures with animation state
    const creatures = scene.creatures(L, S).map((c, i) => ({ ...c, s: c.s * 1.5, flip: c.flip || 1, i, hop: -9, sing: -9, tilt: 0, nod: 0, lastZ: -9 }));
    // what each note grows
    const R = rng(seed + 13), growth = [];
    if (song) {
      if (growthKind === "windows") {
        const free = S.windows.slice();
        for (const n of song.notes) {
          if (!free.length) break;
          const key = K.keyOf[n.pitch]; if (!key) continue;
          let best = 0; for (let i = 1; i < free.length; i++) if (Math.abs(free[i].x - key.cx) < Math.abs(free[best].x - key.cx)) best = i;
          if (Math.abs(free[best].x - key.cx) > 160 * u) continue;
          const w = free.splice(best, 1)[0];
          growth.push({ win: w, birth: n.start + 0.1, color: P.light });
        }
      } else {
        const perKey = new Map(), y0 = scene.growthY(L);
        const stride = Math.max(1, Math.floor(song.notes.length / 700));
        song.notes.forEach((n, i) => {
          if (i % stride) return;
          const key = K.keyOf[n.pitch]; if (!key) return;
          const c = perKey.get(n.pitch) || 0; if (c >= 4) return; perKey.set(n.pitch, c + 1);
          growth.push({ x: key.cx + (R() - 0.5) * K.ww * 1.2, y: y0 - c * 7 * u + R() * 4 * u, spr: growthSprites[(pcIndex(n.pitch) * 2 + c) % growthSprites.length], s: 0.75 + n.vel * 0.45 + R() * 0.15, birth: n.start + 0.15 });
        });
      }
      growth.sort((a, b) => a.birth - b.birth);
    }
    // song-wide stats for creature reactions
    let lastEnd = 0; const pitches = [];
    if (song) for (const n of song.notes) { lastEnd = Math.max(lastEnd, n.end); pitches.push(n.pitch); }
    pitches.sort((a, b) => a - b);
    const lowSplit = pitches[Math.floor(pitches.length * 0.33)] ?? 55, highSplit = pitches[Math.floor(pitches.length * 0.72)] ?? 72;
    const sub = analysis ? `${analysis.key}  ·  ♩ ${song.bpm}` : "";
    C = {
      W, H, L, P, S, K, plate, paper, sprites, creatures, growth, notes, dabW, scene, lastEnd, lowSplit, highSplit,
      growthLayer: mkCanvas(W, H), stamped: 0, stampT: -1e9, hitIdx: 0, glow: new Float32Array(128), parts: [], loud: 0,
      tag: song ? tag(P, u, song.title, sub) : null, endTag: song ? tag(P, u, song.title, "~ the end ~") : null,
      rain: P.rain ? Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), l: 0.5 + Math.random() })) : null,
      flies: (sceneName === "forest" || P.night) ? Array.from({ length: 18 }, () => ({ x: Math.random(), y: 0.35 + Math.random() * 0.55, p: Math.random() * 9 })) : null
    };
  }

  /* ---------- growth layer: finished blooms are stamped once ---------- */
  function syncGrowth(t) {
    const gl = C.growthLayer.getContext("2d");
    if (t < C.stampT) { gl.clearRect(0, 0, C.W, C.H); C.stamped = 0; }
    C.stampT = t;
    while (C.stamped < C.growth.length && C.growth[C.stamped].birth + 0.6 <= t) { drawGrowth(gl, C.growth[C.stamped], 1, 0); C.stamped++; }
  }
  function drawGrowth(g, it, k, wiggle) {
    if (it.win) {
      const w = it.win;
      g.save(); g.globalAlpha = k; g.fillStyle = C.P.light; g.fillRect(w.x, w.y, w.w, w.h);
      g.globalAlpha = 0.35 * k; g.fillStyle = shade(C.P.light, 0.3); g.fillRect(w.x - 3 * C.L.u, w.y - 3 * C.L.u, w.w + 6 * C.L.u, w.h + 6 * C.L.u);
      g.restore();
      return;
    }
    blit(g, it.spr, it.x, it.y, it.s * k, it.s * easeOut(k * 1.2), wiggle);
  }

  /* ---------- creatures ---------- */
  function trigger(n, t) {
    const kind = n.pitch <= C.lowSplit ? "frog" : n.pitch >= C.highSplit ? "bird" : "cat";
    let pool = C.creatures.filter(c => c.kind === kind);
    if (!pool.length) pool = C.creatures;
    const c = pool[(n.pitch + Math.floor(n.start * 3)) % pool.length];
    if (c.kind === "frog" && t - c.hop > 0.45) c.hop = t;
    if (c.kind === "bird" && t - c.sing > 0.2) {
      c.sing = t;
      C.parts.push({ type: "note", x: c.x - 18 * C.L.u * c.flip * c.s, y: c.y - 40 * C.L.u * c.s, t0: t, ch: Math.random() < 0.5 ? "♪" : "♫", col: shade(C.P.accent[pcIndex(n.pitch) % C.P.accent.length], -0.25) });
    }
    if (c.kind === "cat") c.tilt = (Math.random() < 0.5 ? -1 : 1) * 0.16;
  }
  function drawCreature(g, c, t, phase, beat, dt) {
    const u = C.L.u * c.s, sp = C.sprites, f = c.flip, firstNote = song ? song.notes[0].start : 0;
    const asleep = t < firstNote - 0.2 || t > C.lastEnd + 1.9;
    const bowing = t > C.lastEnd + 0.3 && t <= C.lastEnd + 1.9 ? Math.sin(clamp((t - C.lastEnd - 0.3) / 1.2, 0, 1) * Math.PI) : 0;
    if (asleep && t - c.lastZ > 1.3) { c.lastZ = t; C.parts.push({ type: "z", x: c.x + 14 * u * f, y: c.y - 50 * u, t0: t }); }
    const breathe = 1 + Math.sin(phase * 1.7 + c.i) * 0.02;
    c.tilt *= Math.exp(-dt * 6);
    if (c.kind === "cat") {
      if (asleep) { blit(g, sp.cat.loaf, c.x, c.y, c.s * f, c.s * breathe); return; }
      const bob = Math.sin(beat * TAU) * 0.05 * (0.4 + C.loud) + c.tilt - bowing * 0.35;
      const swish = Math.sin(phase * 2.2 + c.i) * (0.25 + C.loud * 0.35);
      blit(g, sp.cat.tail, c.x + 22 * u * f, c.y - 8 * u, c.s * f, c.s, swish * f);
      blit(g, sp.cat.body, c.x, c.y, c.s * f, c.s * breathe, -bowing * 0.12 * f);
      blit(g, sp.cat.head, c.x + bowing * 10 * u * f, c.y - 72 * u + bowing * 14 * u, c.s * f, c.s, bob * f);
    } else if (c.kind === "frog") {
      const h = (t - c.hop) / 0.42, air = h >= 0 && h <= 1 ? Math.sin(h * Math.PI) : 0;
      const squash = h >= 0 && h <= 1 ? 1 + Math.sin(h * TAU) * 0.12 : breathe;
      blit(g, asleep ? sp.frog.closed : sp.frog.open, c.x, c.y - air * 34 * u, c.s * f * (2 - squash), c.s * squash, -bowing * 0.25 * f);
    } else {
      const s = t - c.sing, singing = s >= 0 && s < 0.2;
      const hop = s >= 0 && s < 0.25 ? Math.sin(s / 0.25 * Math.PI) * 6 * u : 0;
      const nod = asleep ? 0.5 : (Math.sin(beat * TAU) * 0.08 * (0.3 + C.loud) + bowing * 0.6);
      blit(g, sp.bird.body, c.x, c.y - hop, c.s * f, c.s * breathe);
      blit(g, singing ? sp.bird.headSing : sp.bird.head, c.x - 13 * u * f, c.y - 22 * u - hop + bowing * 8 * u, c.s * f, c.s, (asleep ? 0.6 : nod) * f);
    }
  }

  /* ---------- per frame ---------- */
  function frame(ctx, W, H, t, dt, now) {
    if (!song) return;
    if (dirty || !C || C.W !== W || C.H !== H) build(W, H);
    const { L, P, K } = C, u = L.u, notes = song.notes;
    // sounding keys, loudness
    const act = new Float32Array(128); let loud = 0;
    for (let i = lowerBound(notes, t - 30.5); i < notes.length; i++) { const n = notes[i]; if (n.start > t) break; if (n.end > t) { act[n.pitch] = Math.max(act[n.pitch], n.vel); loud += n.vel; } }
    const kk = Math.exp(-dt * 7);
    for (let p = 0; p < 128; p++) C.glow[p] = Math.max(C.glow[p] * kk, act[p]);
    C.loud += (clamp(loud / 4, 0, 1) - C.loud) * Math.min(1, dt * 3);
    // note onsets wake creatures
    if (t < C.lastT - 0.05 || C.lastT === undefined) C.hitIdx = lowerBound(notes, t);
    C.lastT = t;
    while (C.hitIdx < notes.length && notes[C.hitIdx].start <= t) { const n = notes[C.hitIdx++]; if (t - n.start < 0.25) trigger(n, t); }

    ctx.drawImage(C.plate, 0, 0);
    syncGrowth(t);
    ctx.drawImage(C.growthLayer, 0, 0);
    // blooms in progress
    for (let i = C.stamped; i < C.growth.length; i++) {
      const it = C.growth[i]; if (it.birth > t) break;
      const k = (t - it.birth) / 0.6;
      drawGrowth(ctx, it, easeOut(k) * (1 + Math.sin(k * Math.PI) * 0.15), Math.sin(k * 9) * 0.08 * (1 - k));
    }
    // glows: lamps and lit windows breathe with the music
    const ending = clamp((t - C.lastEnd - 1.5) / 2.5, 0, 1);
    if (C.S.glows && C.S.glows.length) {
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (const gl of C.S.glows) {
        const r = gl.r * (1 + C.loud * 0.15), gr = ctx.createRadialGradient(gl.x, gl.y, 0, gl.x, gl.y, r);
        gr.addColorStop(0, P.light); gr.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = (P.night ? 0.32 : 0.16) * (1 - ending * 0.8); ctx.fillStyle = gr; ctx.fillRect(gl.x - r, gl.y - r, r * 2, r * 2);
      }
      ctx.restore();
    }
    // weather and little lights
    if (C.rain) {
      ctx.save(); ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1.4 * u; ctx.lineCap = "round"; ctx.beginPath();
      for (const d of C.rain) { const y = ((d.y + now * 0.5 * d.l) % 1) * L.SH, x = ((d.x + now * 0.04) % 1) * W; ctx.moveTo(x, y); ctx.lineTo(x - 4 * u, y + 16 * u * d.l); }
      ctx.stroke(); ctx.restore();
    }
    if (C.flies) for (const f of C.flies) {
      const x = (f.x + Math.sin(now * 0.3 + f.p) * 0.03) * W, y = (f.y + Math.cos(now * 0.4 + f.p) * 0.03) * L.SH, a = (0.4 + 0.6 * Math.sin(now * 2 + f.p * 3)) * (0.5 + C.loud);
      dot(ctx, x, y, 5 * u, P.light, 0.25 * a); dot(ctx, x, y, 2 * u, "#fffbe0", 0.9 * a);
    }
    if (C.S.chimney) for (let i = 0; i < 4; i++) {
      const k = (now * 0.25 + i / 4) % 1;
      dot(ctx, C.S.chimney.x + Math.sin(k * 5 + i) * 8 * u + k * 30 * u, C.S.chimney.y - k * 90 * u, (8 + k * 16) * u, P.night ? "#9aa0c8" : "#ffffff", 0.35 * (1 - k));
    }
    // creatures
    const beat = song.bpm ? t * song.bpm / 60 : t;
    for (const c of C.creatures) drawCreature(ctx, c, t, now, beat, dt);
    // bedtime: the scene dims once everyone is asleep
    if (ending > 0) { ctx.save(); ctx.globalAlpha = ending * 0.38; ctx.fillStyle = "#1c1f45"; ctx.fillRect(0, 0, W, L.SH); ctx.restore(); }

    // falling painted notes, clipped to the lane between the scene and the keys
    const pps = (L.kbY - L.SH) / lookahead;
    ctx.save(); ctx.beginPath(); ctx.rect(0, L.SH, W, L.kbY - L.SH); ctx.clip();
    for (let i = lowerBound(notes, t - 30.5); i < notes.length; i++) {
      const n = notes[i]; if (n.start > t + lookahead) break; if (n.end < t) continue;
      const k = K.keyOf[n.pitch]; if (!k) continue;
      const yb = L.kbY - (n.start - t) * pps, yt = L.kbY - (n.end - t) * pps, w = k.black ? k.w * 0.95 : k.w * 0.82;
      const tex = C.notes[pcIndex(n.pitch) % C.notes.length];
      ctx.globalAlpha = 0.6 + n.vel * 0.4;
      ctx.drawImage(tex, k.cx - w / 2 - 4 * u, yt - 4 * u, w + 8 * u, Math.max(yb - yt, w * 0.8) + 8 * u);
    }
    ctx.restore();
    // pressed keys
    for (const k of K.keys) {
      const gv = C.glow[k.p]; if (gv < 0.02) continue;
      const spr = C.dabW[pcIndex(k.p) % C.dabW.length];
      ctx.save(); ctx.globalAlpha = gv * 0.85;
      ctx.drawImage(spr, k.x, k.black ? L.kbY - 2 * u : L.kbY, k.w, k.black ? L.kbH * 0.62 : L.kbH);
      ctx.restore();
    }
    // floating zzz and music notes
    ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    C.parts = C.parts.filter(p => t - p.t0 < 1.8 && t >= p.t0);
    for (const p of C.parts) {
      const k = (t - p.t0) / 1.8;
      ctx.globalAlpha = Math.sin(k * Math.PI);
      if (p.type === "z") { ctx.fillStyle = P.night ? "#e8e4ff" : P.ink; ctx.font = `${(18 + k * 14) * u}px ${HAND}`; ctx.fillText("z", p.x + k * 24 * u, p.y - k * 50 * u); }
      else { ctx.fillStyle = p.col; ctx.font = `${30 * u}px ${HAND}`; ctx.fillText(p.ch, p.x + Math.sin(k * 7) * 8 * u, p.y - k * 70 * u); }
    }
    ctx.restore();
    // title tag at the start, "the end" tag after bedtime
    const tagA = t < 3 ? 1 : clamp(1 - (t - 3) / 1, 0, 1), endA = clamp((t - C.lastEnd - 2.6) / 1, 0, 1);
    if (tagA > 0 && C.tag) blit(ctx, C.tag, W / 2, L.SH * 0.05 + 132 * u, 1, 1, -0.02, tagA);
    if (endA > 0 && C.endTag) blit(ctx, C.endTag, W / 2, L.SH * 0.5, 1, 1, 0.02, endA);
    // paper grain over everything
    ctx.save(); ctx.globalCompositeOperation = "multiply"; ctx.drawImage(C.paper, 0, 0); ctx.restore();
  }

  return {
    get scene() { return sceneName; }, get palette() { return paletteName; },
    setSong(s, a) { song = s; analysis = a; dirty = true; },
    setScene(s) { if (SCENES[s] && s !== sceneName) { sceneName = s; dirty = true; } },
    setPalette(p) { if (PALETTES[p] && p !== paletteName) { paletteName = p; dirty = true; } },
    setMedium(m) { if (Painter.MEDIA[m] && m !== Painter.medium) { Painter.medium = m; dirty = true; } },
    setRange(m) { rangeMode = m; dirty = true; },
    setFall(s) { lookahead = s; },
    reset() { if (C) { C.parts = []; C.lastT = undefined; } },
    isDirty() { return dirty; },
    frame,
    lastEnd() { return C ? C.lastEnd : 0; }
  };
})();
