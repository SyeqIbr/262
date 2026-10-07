"use strict";
/* Painter: draws shapes as watercolor, gouache, crayon or oil pastel.
   Everything here is slow-ish by design and runs once into cached canvases;
   the per-frame renderer only blits the results. */
const Painter = (() => {
  const MEDIA = {
    watercolor: { label: "Watercolor" },
    gouache: { label: "Gouache" },
    crayon: { label: "Crayon" },
    pastel: { label: "Oil pastel" }
  };

  function rng(seed) {
    return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const gauss = R => (R() + R() + R() - 1.5) / 1.5;

  /* ---------- colour ---------- */
  function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function hex([r, g, b]) { return "#" + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join(""); }
  // amt > 0 lightens toward white, < 0 darkens toward black
  function shade(c, amt) { const a = rgb(c); return hex(a.map(v => amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))); }
  function mix(c1, c2, k) { const a = rgb(c1), b = rgb(c2); return hex(a.map((v, i) => v + (b[i] - v) * k)); }

  /* ---------- shapes (arrays of [x, y]) ---------- */
  const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  function ellipse(cx, cy, rx, ry, n = 22, rot = 0) {
    const out = [];
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const x = Math.cos(a) * rx, y = Math.sin(a) * ry; out.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]); }
    return out;
  }
  // a thick curved stroke (for tails, stems, branches) as a closed polygon
  function ribbon(pts, w0, w1) {
    const L = [], Rr = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const w = (w0 + (w1 - w0) * i / (pts.length - 1)) / 2;
      L.push([pts[i][0] + nx * w, pts[i][1] + ny * w]); Rr.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
    }
    return L.concat(Rr.reverse());
  }
  function bezier(p0, p1, p2, n = 12) {
    const out = [];
    for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]); }
    return out;
  }
  // wobble the outline: recursive midpoint displacement, scaled to each edge
  function deform(pts, depth, v, R) {
    let p = pts;
    for (let d = 0; d < depth; d++) {
      const out = [];
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length];
        const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
        const off = gauss(R) * v * Math.min(len, 60) * 0.5;
        out.push(a, [(a[0] + b[0]) / 2 - dy / len * off, (a[1] + b[1]) / 2 + dx / len * off]);
      }
      p = out; v *= 0.65;
    }
    return p;
  }
  function trace(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }
  function bbox(pts) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }; }

  /* ---------- paper ---------- */
  // Grey texture (near white) that is multiplied over the whole frame
  function paperTexture(W, H, medium, seed = 3) {
    const cv = mkCanvas(W, H), g = cv.getContext("2d"), R = rng(seed);
    // soft large-scale mottling from a small noise field scaled up
    const s = mkCanvas(Math.ceil(W / 24), Math.ceil(H / 24)), sg = s.getContext("2d"), sd = sg.createImageData(s.width, s.height);
    for (let i = 0; i < sd.data.length; i += 4) { const v = 255 - R() * (medium === "watercolor" ? 12 : 6); sd.data[i] = sd.data[i + 1] = sd.data[i + 2] = v; sd.data[i + 3] = 255; }
    sg.putImageData(sd, 0, 0);
    g.imageSmoothingEnabled = true; g.drawImage(s, 0, 0, W, H);
    // fine tooth
    const img = g.getImageData(0, 0, W, H), d = img.data;
    const tooth = { watercolor: 10, gouache: 6, crayon: 22, pastel: 26 }[medium];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      let n = R();
      if (medium === "crayon" || medium === "pastel") n = n * 0.6 + 0.4 * ((Math.sin(x * 0.9 + Math.sin(y * 0.13) * 3) + 1) / 2) * R();
      const v = -n * tooth;
      d[i] += v; d[i + 1] += v; d[i + 2] += v * 0.95;
    }
    g.putImageData(img, 0, 0);
    return cv;
  }

  /* ---------- painting a shape ---------- */
  function paint(ctx, pts, col, o = {}) {
    const medium = o.medium || Painter.medium, R = o.R || rng(o.seed || 1), u = o.u || 1;
    ctx.save();
    if (medium === "watercolor") {
      const base = deform(pts, 2, o.wobble ?? 0.35, R), layers = o.layers || 9;
      ctx.fillStyle = col;
      for (let i = 0; i < layers; i++) { ctx.globalAlpha = (o.alpha ?? 1) * 1.7 / layers; trace(ctx, deform(base, 2, 0.28, R)); ctx.fill(); }
      ctx.globalAlpha = 0.22 * (o.alpha ?? 1); ctx.strokeStyle = shade(col, -0.3); ctx.lineWidth = 1.4 * u; trace(ctx, base); ctx.stroke();
    } else if (medium === "gouache") {
      const base = deform(pts, 2, (o.wobble ?? 0.35) * 0.35, R);
      ctx.globalAlpha = o.alpha ?? 1; ctx.fillStyle = col; trace(ctx, base); ctx.fill();
      ctx.clip();
      const b = bbox(base), ang = o.angle ?? -0.25, n = clamp(Math.round((b.w + b.h) / (10 * u)), 4, 70);
      for (let i = 0; i < n; i++) {
        ctx.globalAlpha = 0.16; ctx.strokeStyle = shade(col, (R() - 0.5) * 0.18); ctx.lineWidth = (2 + R() * 6) * u;
        const cx = b.x0 + R() * b.w, cy = b.y0 + R() * b.h, L = (b.w + b.h) * 0.6;
        ctx.beginPath(); ctx.moveTo(cx - Math.cos(ang) * L, cy - Math.sin(ang) * L); ctx.lineTo(cx + Math.cos(ang) * L, cy + Math.sin(ang) * L); ctx.stroke();
      }
    } else if (medium === "crayon") {
      const base = deform(pts, 2, (o.wobble ?? 0.35) * 0.5, R);
      ctx.globalAlpha = 0.28 * (o.alpha ?? 1); ctx.fillStyle = col; trace(ctx, base); ctx.fill();
      ctx.save(); ctx.clip();
      const b = bbox(base), sp = 3.4 * u;
      for (const [ang, spacing, alpha] of [[o.angle ?? 1.0, sp, 0.6], [(o.angle ?? 1.0) - 1.3, sp * 1.8, 0.32]]) {
        ctx.strokeStyle = col; ctx.lineWidth = 1.7 * u; ctx.lineCap = "round";
        const dx = Math.cos(ang), dy = Math.sin(ang), diag = b.w + b.h, cx = b.x0 + b.w / 2, cy = b.y0 + b.h / 2;
        for (let k = -diag / 2; k < diag / 2; k += spacing * (0.7 + R() * 0.6)) {
          ctx.globalAlpha = alpha * (0.6 + R() * 0.4) * (o.alpha ?? 1);
          const ox = cx - dy * k, oy = cy + dx * k;
          ctx.beginPath(); ctx.moveTo(ox - dx * diag / 2, oy - dy * diag / 2);
          for (let s = -diag / 2; s <= diag / 2; s += 18 * u) ctx.lineTo(ox + dx * s + (R() - 0.5) * u, oy + dy * s + (R() - 0.5) * u);
          ctx.stroke();
        }
      }
      ctx.restore();
      ctx.globalAlpha = 0.75 * (o.alpha ?? 1); ctx.strokeStyle = shade(col, -0.38); ctx.lineWidth = 2.1 * u; ctx.lineJoin = "round";
      trace(ctx, deform(base, 1, 0.12, R)); ctx.stroke();
    } else { // oil pastel
      const base = deform(pts, 2, (o.wobble ?? 0.35) * 0.6, R);
      ctx.globalAlpha = 0.9 * (o.alpha ?? 1); ctx.fillStyle = col; trace(ctx, base); ctx.fill();
      ctx.save(); ctx.clip();
      const b = bbox(base), n = clamp(Math.round(b.w * b.h / (150 * u * u)), 6, 420), ang = o.angle ?? -0.35;
      ctx.lineCap = "round";
      for (let i = 0; i < n; i++) {
        const a = ang + (R() - 0.5) * 0.7, L = (12 + R() * 18) * u, x = b.x0 + R() * b.w, y = b.y0 + R() * b.h;
        ctx.globalAlpha = 0.75; ctx.strokeStyle = shade(col, (R() - 0.5) * 0.45); ctx.lineWidth = (5 + R() * 5) * u;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); ctx.stroke();
      }
      // paper tooth showing through the wax
      ctx.globalCompositeOperation = "destination-out"; ctx.globalAlpha = 0.7; ctx.fillStyle = "#000";
      for (let i = 0; i < n * 6; i++) { const x = b.x0 + R() * b.w, y = b.y0 + R() * b.h; ctx.fillRect(x, y, (1.5 + R() * 3.5) * u, (0.8 + R() * 1.2) * u); }
      ctx.restore();
      ctx.globalAlpha = 0.85 * (o.alpha ?? 1); ctx.strokeStyle = shade(col, -0.42); ctx.lineWidth = 4.2 * u; ctx.lineJoin = "round";
      trace(ctx, base); ctx.stroke();
    }
    ctx.restore();
  }

  // A sky or wall: vertical blend from top to bottom colour, in the medium's manner
  function wash(ctx, x, y, w, h, top, bottom, o = {}) {
    const medium = o.medium || Painter.medium, R = o.R || rng(o.seed || 7), u = o.u || 1;
    ctx.save();
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, top); g.addColorStop(1, bottom);
    if (medium === "gouache") {
      const bands = 5;
      for (let i = 0; i < bands; i++) paint(ctx, rect(x - 20 * u, y + h * i / bands - 6 * u, w + 40 * u, h / bands + 30 * u), mix(top, bottom, i / (bands - 1)), { ...o, R, wobble: 0.5, medium });
    } else {
      ctx.fillStyle = g; ctx.globalAlpha = medium === "crayon" ? 0.35 : 1; ctx.fillRect(x, y, w, h);
      if (medium === "watercolor") {
        for (let i = 0; i < 26; i++) {
          const cx = x + R() * w, cy = y + R() * h, r = (40 + R() * 160) * u, c = mix(top, bottom, (cy - y) / h);
          ctx.globalAlpha = 0.07; ctx.fillStyle = shade(c, (R() - 0.5) * 0.2); trace(ctx, deform(ellipse(cx, cy, r, r * 0.7, 14), 2, 0.5, R)); ctx.fill();
        }
      } else {
        ctx.lineCap = "round";
        const step = (medium === "crayon" ? 4 : 9) * u;
        for (let yy = y; yy < y + h; yy += step) {
          const c = mix(top, bottom, (yy - y) / h);
          ctx.strokeStyle = shade(c, (R() - 0.5) * (medium === "crayon" ? 0.1 : 0.3)); ctx.globalAlpha = medium === "crayon" ? 0.55 : 0.75;
          ctx.lineWidth = (medium === "crayon" ? 1.8 : 11) * u;
          for (let xx = x - 20 * u; xx < x + w; xx += (60 + R() * 120) * u) {
            const L = (50 + R() * 140) * u, a = (R() - 0.5) * 0.12 + (medium === "crayon" ? -0.15 : 0);
            ctx.beginPath(); ctx.moveTo(xx, yy + (R() - 0.5) * 3 * u); ctx.lineTo(xx + Math.cos(a) * L, yy + Math.sin(a) * L); ctx.stroke();
          }
        }
      }
    }
    ctx.restore();
  }

  // Ink line (eyes, mouths, outlines of tiny details)
  function ink(ctx, pts, color, width, closed = false) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (closed) ctx.closePath();
    ctx.stroke(); ctx.restore();
  }
  function dot(ctx, x, y, r, color, alpha = 1) { ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore(); }

  // Render something into its own canvas. draw(ctx) works in a box from (-w/2, -h) to (w/2, 0): origin = bottom centre.
  function sprite(w, h, draw, padding) {
    const pad = Math.ceil(padding ?? Math.max(w, h) * 0.12);
    const cv = mkCanvas(Math.ceil(w + pad * 2), Math.ceil(h + pad * 2)), g = cv.getContext("2d");
    g.translate(cv.width / 2, h + pad); draw(g);
    cv.ox = cv.width / 2; cv.oy = h + pad; // anchor
    return cv;
  }
  function blit(ctx, spr, x, y, sx = 1, sy = sx, rot = 0, alpha = 1) {
    if (!spr) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.scale(sx, sy);
    ctx.drawImage(spr, -spr.ox, -spr.oy); ctx.restore();
  }

  return { MEDIA, medium: "watercolor", rng, gauss, shade, mix, rect, ellipse, ribbon, bezier, deform, trace, paint, wash, ink, dot, sprite, blit, paperTexture };
})();
