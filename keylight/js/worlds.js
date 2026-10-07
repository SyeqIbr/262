"use strict";
/* The four nature worlds. Each build() turns the song's notes into an artwork that
   grows over the song, and returns where each note lands so the engine can fly a
   spark from the key to that spot. */
(() => {
  if (!World3D) return;
  const T = THREE, WORLDS = World3D.WORLDS, U = World3D.U;

  /* ---------- shared shapes ---------- */
  const petalRing = (count, sx, sz, tilt, offset, rot = 0) => {
    const out = [];
    for (let k = 0; k < count; k++) {
      const g = new T.SphereGeometry(1, 8, 5); g.scale(sx, 0.08, sz); g.translate(0, 0, offset); g.rotateX(-tilt); g.rotateY(rot + k * 6.283 / count); out.push(g);
    }
    return out;
  };
  let GEO = null;
  function geos(merge) {
    if (GEO) return GEO;
    const center = r => { const g = new T.SphereGeometry(r, 8, 6); g.scale(1, 0.6, 1); return g; };
    const blossom = merge([...petalRing(5, 0.42, 0.62, 0.35, 0.55), center(0.22)]);
    const lotus = merge([...petalRing(8, 0.3, 0.72, 0.55, 0.62), ...petalRing(6, 0.26, 0.6, 1.0, 0.42, 0.3), center(0.2)]);
    const daisy = merge([...petalRing(12, 0.16, 0.62, 0.15, 0.62), center(0.26)]);
    const tulip = (() => { const g = new T.SphereGeometry(0.55, 10, 8, 0, 6.283, Math.PI * 0.32, Math.PI * 0.68); g.scale(1, 1.4, 1); g.translate(0, 0.62, 0); return g; })();
    const leaf = (() => { const g = new T.SphereGeometry(1, 6, 4); g.scale(0.34, 0.04, 0.72); g.translate(0, 0, 0.62); return g; })();
    const pad = (() => { const g = new T.CylinderGeometry(1, 1, 0.06, 18, 1, false, 0.35, 5.9); return g; })();
    const stem = (() => { const g = new T.CylinderGeometry(0.045, 0.07, 1, 5); g.translate(0, 0.5, 0); return g; })();
    const crystal = (() => { const g = new T.OctahedronGeometry(1, 0); g.scale(0.32, 1.1, 0.32); g.translate(0, 0.9, 0); return g; })();
    const mushroom = (() => {
      const cap = new T.SphereGeometry(0.6, 12, 6, 0, 6.283, 0, Math.PI / 2); cap.scale(1, 0.7, 1); cap.translate(0, 0.65, 0);
      const st = new T.CylinderGeometry(0.16, 0.22, 0.7, 7); st.translate(0, 0.35, 0);
      return merge([cap, st]);
    })();
    const blade = (() => {
      const g = new T.PlaneGeometry(0.11, 1, 1, 3); g.translate(0, 0.5, 0);
      const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * (1 - p.getY(i) * 0.92));
      g.computeVertexNormals(); return g;
    })();
    GEO = { blossom, lotus, daisy, tulip, leaf, pad, stem, crystal, mushroom, blade };
    return GEO;
  }

  /* ---------- helpers ---------- */
  const FOV = 38;
  function fit(w, h, aspect) { const v = Math.tan(FOV * Math.PI / 360); return Math.max((h / 2) / v, (w / 2) / (v * aspect)); }
  function orbit(target, dist, elev, azim) {
    return { target, pos: new T.Vector3(target.x + Math.sin(azim) * Math.cos(elev) * dist, target.y + Math.sin(elev) * dist, target.z + Math.cos(azim) * Math.cos(elev) * dist) };
  }
  const pcIndex = p => (p % 12) * 7 % 12; // circle of fifths order
  const pal = (list, p) => new T.Color(list[pcIndex(p) % list.length]);
  const inSphere = (R, r) => { let v; do { v = new T.Vector3(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1); } while (v.lengthSq() > 1); return v.multiplyScalar(r); };
  const tilt = (R, amt) => new T.Quaternion().setFromEuler(new T.Euler((R() - 0.5) * amt, R() * 6.283, (R() - 0.5) * amt));
  const lerpColors = (list, s) => {
    const k = clamp(s, 0, 1) * (list.length - 1), i = Math.min(list.length - 2, Math.floor(k));
    return new T.Color(list[i]).lerp(new T.Color(list[i + 1]), k - i);
  };

  /* =========================================================
     Growing tree — the song grows a blossom tree behind the piano
     ========================================================= */
  const SAKURA = ["#ffd3df", "#ffb3c7", "#ff98b2", "#fff1f4", "#ffc6a3", "#ffe39b", "#efc2ff", "#ffcfe9", "#ffa8bf", "#fff6e8", "#ff8fab", "#ffdcc0"];
  WORLDS.tree = {
    label: "Growing tree",
    build(c) {
      const { KW, notes, R, K, lastEnd, group } = c, G = geos(c.merge);
      const H = KW * 0.95, u = H / 30, baseZ = -KW * 0.42;
      group.add(c.skyDome({ top: "#121845", mid: "#c98a92", bottom: "#231c30", sunDir: new T.Vector3(0.35, 0.05, -1), sunColor: "#ffb98a", sunSize: 0.016, glow: 0.07 }));
      group.add(c.starField(500));
      const ground = new T.Mesh(new T.CircleGeometry(700, 48), new T.MeshStandardMaterial({ color: "#26332d", roughness: 1 }));
      ground.rotation.x = -Math.PI / 2; ground.position.y = -1.2; group.add(ground);
      const mound = new T.Mesh(new T.SphereGeometry(KW * 0.32, 32, 12), new T.MeshStandardMaterial({ color: "#2f4236", roughness: 1 }));
      mound.scale.set(1, 0.16, 0.8); mound.position.set(0, -1.1, baseZ); group.add(mound);

      const segs = c.genTree(R, { base: new T.Vector3(0, -1, baseZ), height: H, width: KW * 1.05, maxDepth: 7 });
      const segBirth = i => c.atFraction(0.8 * i / segs.length) - (i === 0 ? 0.4 : 0);
      const bark = c.branchLayer(segs, segBirth, "#3d2c27");
      group.add(bark.mesh(c.growMaterial({ emissive: 0.03, sway: 0 })));

      // leaves at the twig ends
      const tips = [];
      segs.forEach((s, i) => { if (s.depth >= 5) tips.push({ p: s.b, i }); if (s.depth >= 6) tips.push({ p: s.a.clone().lerp(s.b, 0.5), i }); });
      tips.sort((a, b) => a.p.x - b.p.x);
      const leaves = c.growLayer(G.leaf, tips.length * 2);
      for (const tp of tips) for (let k = 0; k < 2; k++) {
        leaves.add(tp.p.clone().add(inSphere(R, u * 0.8)), c.randQuat(R), u * (0.7 + R() * 0.5), ["#4f7d46", "#6a9a52", "#8db567", "#3f6b3e"][Math.floor(R() * 4)], segBirth(tp.i) + 1, 1.4, 1e9, R() * 6);
      }
      group.add(leaves.mesh(c.growMaterial({ emissive: 0.04, side: T.DoubleSide })));

      // one blossom per note, in the part of the crown above its key
      const xs = tips.map(t => t.p.x), crownScale = (xs[xs.length - 1] - xs[0]) / KW;
      const blossoms = c.growLayer(G.blossom, notes.length), targets = [];
      const petalStart = lastEnd + 5;
      notes.forEach((n, i) => {
        const x = K.keyX(n.pitch) * crownScale;
        let lo = 0, hi = xs.length; while (lo < hi) { const m = (lo + hi) >> 1; if (xs[m] < x) lo = m + 1; else hi = m; }
        const j = clamp(lo + Math.floor((R() - 0.5) * 8), 0, tips.length - 1);
        const pos = tips[j].p.clone().add(inSphere(R, u * 1.3));
        const colr = pal(SAKURA, n.pitch), dur = n.end - n.start;
        const blow = petalStart + R() * 6;
        blossoms.add(pos, c.randQuat(R), u * (0.32 + n.vel * 0.42) * (dur > 0.8 ? 1.25 : 1), colr, n.start + 0.85, 0.9, blow, R() * 6);
        c.softFx.add(2, pos, new T.Vector3(2.2 + R() * 2.5, -0.5 + R() * 0.5, (R() - 0.5) * 1.2), blow, 10, u * 0.5, colr, R());
        if (i % 2 === 0) c.glowFx.add(1, pos, new T.Vector3(0, 0.45, 0), n.start + 0.9, 2.6, u * 0.4, "#ffe2b4", R());
        targets.push(pos);
      });
      group.add(blossoms.mesh(c.growMaterial({ emissive: 0.18, glow: 2.6, pop: 1, side: T.DoubleSide })));
      for (let i = 0; i < 160; i++) c.glowFx.add(1, new T.Vector3((R() - 0.5) * KW * 1.6, R() * H * 0.5, baseZ + (R() - 0.5) * KW), new T.Vector3(0, 0.15, 0), R() * (lastEnd + 10), 8, u * 0.35, "#e9ff9c", R());

      return {
        targets, noteColor: n => pal(SAKURA, n.pitch),
        keys: { white: "#eadcc5", black: "#3a2a22", case: "#2a1c16", roughness: 0.6, glow: p => pal(SAKURA, p).multiplyScalar(0.9) },
        light: { dir: new T.Vector3(-0.4, 0.8, 0.6), color: "#ffd8b8", intensity: 0.75, ambient: "#4a4560", sky: "#a9a7d8", ground: "#3a2f2a", hemi: 0.55 },
        fog: { color: "#a77b8c", density: 0.0034 }, fallH: KW * 0.33,
        bloom: { strength: 1.0, radius: 0.55 }, endGlow: 0.5, windEnd: 1.5, posterTime: lastEnd + 1,
        pose(t, prog, aspect, now) {
          const tg = new T.Vector3(0, H * (0.3 + 0.16 * prog), baseZ * 0.55);
          return orbit(tg, fit(KW * 1.12, H * 1.15, aspect), 0.12, Math.sin(now * 0.05) * 0.22);
        },
        reveal(aspect, now) { return orbit(new T.Vector3(0, H * 0.45, baseZ), fit(KW * 1.35, H * 1.35, aspect), 0.2, 0.35 + Math.sin(now * 0.06) * 0.35); }
      };
    }
  };

  /* =========================================================
     Night pond — lotuses spiral out across moonlit water
     ========================================================= */
  const LOTUS = ["#ffc4df", "#f6a3d6", "#e2b4ff", "#c8c2ff", "#ffe0ef", "#ffd5c0", "#bfe6ff", "#f9b8ff", "#ffcfd8", "#d9c9ff", "#ffeaf6", "#b8d8ff"];
  WORLDS.pond = {
    label: "Night pond",
    build(c) {
      const { KW, notes, R, lastEnd, group } = c, G = geos(c.merge);
      const Rr = KW * 0.62, C = new T.Vector3(0, 0, -(Rr + 7));
      const moonDir = new T.Vector3(-0.32, 0.3, -1).normalize();
      group.add(c.skyDome({ top: "#03050f", mid: "#0f2142", bottom: "#02040a", sunDir: moonDir, sunColor: "#e4ecff", sunSize: 0.011, glow: 0.07 }));
      group.add(c.starField(1600));
      const water = new T.Mesh(new T.PlaneGeometry(1400, 1400), new T.ShaderMaterial({
        uniforms: Object.assign(T.UniformsUtils.merge([T.UniformsLib.fog]), { uTime: U.uTime, moonDir: { value: moonDir } }),
        vertexShader: `varying vec3 vW;
          #include <fog_pars_vertex>
          void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }`,
        fragmentShader: `uniform float uTime; uniform vec3 moonDir; varying vec3 vW;
          #include <fog_pars_fragment>
          void main(){
            vec2 q = vW.xz;
            float h1 = sin(dot(q, vec2(0.31, 0.12)) + uTime * 0.8), h2 = sin(dot(q, vec2(-0.17, 0.43)) - uTime * 1.1);
            float h3 = sin(dot(q, vec2(0.71, -0.53)) + uTime * 1.7), h4 = sin(dot(q, vec2(-1.13, -0.91)) - uTime * 2.3);
            vec3 n = normalize(vec3(h1 * 0.03 + h3 * 0.018 + h4 * 0.01, 1.0, h2 * 0.03 - h3 * 0.012 + h4 * 0.012));
            vec3 v = normalize(cameraPosition - vW); vec3 r = reflect(-v, n);
            float d = max(dot(r, moonDir), 0.0);
            float spec = pow(d, 420.0) * 1.4 + pow(d, 28.0) * 0.06;
            float fres = pow(1.0 - max(dot(v, n), 0.0), 4.0);
            vec3 c = mix(vec3(0.008, 0.016, 0.04), vec3(0.07, 0.12, 0.24), fres) + vec3(0.85, 0.9, 1.0) * spec;
            gl_FragColor = vec4(c, 1.0);
            #include <fog_fragment>
          }`,
        fog: true
      }));
      water.rotation.x = -Math.PI / 2; water.position.y = -0.18; group.add(water);

      const N = notes.length, padR = clamp(Rr * 1.5 / Math.sqrt(N), 0.25, 1.8);
      const pads = c.growLayer(G.pad, N), lotus = c.growLayer(G.lotus, N), targets = [];
      notes.forEach((n, k) => {
        const r = Rr * Math.sqrt((k + 0.5) / N), th = k * 2.39996;
        const pos = new T.Vector3(C.x + Math.cos(th) * r, -0.12, C.z + Math.sin(th) * r);
        const dur = n.end - n.start, colr = pal(LOTUS, n.pitch), birth = n.start + 0.85;
        pads.add(pos, new T.Quaternion().setFromEuler(new T.Euler(0, R() * 6.283, 0)), new T.Vector3(padR * (0.75 + n.vel * 0.35), 1, padR * (0.75 + n.vel * 0.35)), ["#1b3a2b", "#234a38", "#16302a", "#2a5040"][k % 4], birth, 0.8, 1e9, R() * 6);
        if (k % 3 === 0 || dur > 0.9) lotus.add(pos.clone().setY(-0.08), tilt(R, 0.25), padR * (0.32 + n.vel * 0.3), colr, birth + 0.1, 1.1, 1e9, R() * 6);
        c.ripples.add(pos, birth, 2.8, padR * 5.5, "#4d6f9e");
        if (R() < 0.35) c.glowFx.add(1, pos.clone().setY(0.6), new T.Vector3((R() - 0.5) * 0.5, 0.5 + R() * 0.5, (R() - 0.5) * 0.5), birth + 0.2, 5, 0.5, "#d4ff7c", R());
        targets.push(pos.clone().setY(0.1));
      });
      group.add(pads.mesh(c.growMaterial({ emissive: 0.12, glow: 0.8 })));
      group.add(lotus.mesh(c.growMaterial({ emissive: 0.3, glow: 2.8, pop: 1, side: T.DoubleSide })));
      for (let i = 0; i < 220; i++) c.glowFx.add(1, new T.Vector3(C.x + (R() - 0.5) * Rr * 2.6, 0.3 + R() * 3, C.z + (R() - 0.5) * Rr * 2.4), new T.Vector3(0, 0.12, 0), R() * (lastEnd + 12), 9, 0.4, "#c8ff80", R());

      return {
        targets, noteColor: n => pal(LOTUS, n.pitch),
        keys: { white: "#c9d3ee", black: "#0c1226", case: "#070a16", roughness: 0.22, metalness: 0.35, glow: p => pal(LOTUS, p) },
        light: { dir: new T.Vector3(-0.3, 0.5, 0.6), color: "#b9c8ff", intensity: 0.8, ambient: "#2a3150", sky: "#3a4a80", ground: "#05070f", hemi: 0.7 },
        fog: { color: "#0a1428", density: 0.0042 }, fallH: KW * 0.3,
        bloom: { strength: 1.2, radius: 0.6 }, endGlow: 1.2, posterTime: lastEnd + 1,
        pose(t, prog, aspect, now) {
          const tg = new T.Vector3(0, 0, C.z * (0.45 + 0.15 * prog));
          return orbit(tg, fit(KW * 1.12, Rr * 1.6, aspect), 0.42, Math.sin(now * 0.04) * 0.3);
        },
        reveal(aspect, now) { return orbit(C.clone(), fit(Rr * 2.35, Rr * 2.35, aspect), 1.32, now * 0.05); }
      };
    }
  };

  /* =========================================================
     Flower field — a piano roll you can walk through
     ========================================================= */
  const WILD = ["#e8443a", "#f2b632", "#fbf7ef", "#7a8cff", "#c77dff", "#ff8fb1", "#ff7a3d", "#ffe36e", "#9ad4ff", "#ff5d8f", "#f5ecd7", "#b38cff"];
  WORLDS.field = {
    label: "Flower field",
    build(c) {
      const { KW, notes, R, K, lastEnd, group } = c, G = geos(c.merge);
      const D = KW * 1.4, z0 = -2.6;
      group.add(c.skyDome({ top: "#3f71bb", mid: "#ffd7a6", bottom: "#5f7f3a", sunDir: new T.Vector3(-0.45, 0.09, -1), sunColor: "#ffd59a", sunSize: 0.03, glow: 0.3 }));
      const ground = new T.Mesh(new T.PlaneGeometry(1400, 1400), new T.MeshStandardMaterial({ color: "#58772f", roughness: 1 }));
      ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; group.add(ground);

      const blades = Math.min(26000, Math.round(KW * D * 9));
      const grass = c.growLayer(G.blade, blades + 4000);
      const greens = ["#5d8a2f", "#7aa63a", "#9bbf4a", "#4f7a2a", "#b6c95a", "#6f9a35"];
      for (let i = 0; i < blades; i++) grass.add(new T.Vector3((R() - 0.5) * KW * 1.5, -0.05, z0 + 1.5 - R() * (D + 10)), tilt(R, 0.5), new T.Vector3(1, 0.5 + R() * 1.1, 1), greens[i % 6], -100, 1, 1e9, R() * 6);
      for (let i = 0; i < 4000; i++) grass.add(new T.Vector3((R() - 0.5) * KW * 4, -0.05, 4 - R() * (D + 40)), tilt(R, 0.5), new T.Vector3(1.4, 0.7 + R() * 1.3, 1.4), greens[i % 6], -100, 1, 1e9, R() * 6);
      group.add(grass.mesh(c.growMaterial({ emissive: 0.05, side: T.DoubleSide })));

      const stems = c.growLayer(G.stem, notes.length), tul = c.growLayer(G.tulip, notes.length), dai = c.growLayer(G.daisy, notes.length), sml = c.growLayer(G.blossom, notes.length);
      const targets = [];
      notes.forEach((n, i) => {
        const x = K.keyX(n.pitch) + (R() - 0.5) * 0.3, z = z0 - (n.start / Math.max(1, lastEnd)) * D + (R() - 0.5) * 0.5;
        const hs = 0.8 + Math.min(n.end - n.start, 3) * 0.9 + n.vel * 0.6;
        const base = new T.Vector3(x, -0.05, z), head = new T.Vector3(x, hs - 0.05, z);
        const colr = pal(WILD, n.pitch), birth = n.start + 0.85;
        stems.add(base, tilt(R, 0.12), new T.Vector3(1, hs, 1), "#4c7a2a", birth, 0.6, 1e9, R() * 6);
        const s = 0.55 + n.vel * 0.55;
        if (n.pitch < 52) tul.add(head.clone().setY(hs - 0.4), tilt(R, 0.15), s, colr, birth + 0.25, 0.9, 1e9, R() * 6);
        else if (n.pitch < 74) dai.add(head, new T.Quaternion().setFromEuler(new T.Euler(-0.5 + (R() - 0.5) * 0.4, R() * 6.28, 0)), s, colr, birth + 0.25, 0.9, 1e9, R() * 6);
        else sml.add(head, tilt(R, 0.6), s * 0.7, colr, birth + 0.25, 0.9, 1e9, R() * 6);
        if (i % 3 === 0) c.glowFx.add(1, head, new T.Vector3((R() - 0.5) * 0.3, 0.35, (R() - 0.5) * 0.3), birth + 0.4, 3, 0.35, "#fff1c4", R());
        targets.push(head);
      });
      const flowerMat = c.growMaterial({ emissive: 0.1, glow: 2.2, pop: 1, side: T.DoubleSide });
      group.add(stems.mesh(c.growMaterial({ emissive: 0.04 })), tul.mesh(flowerMat), dai.mesh(flowerMat), sml.mesh(flowerMat));
      for (let i = 0; i < 260; i++) c.softFx.add(2, new T.Vector3((R() - 0.7) * KW * 1.6, 1 + R() * 6, z0 - R() * D), new T.Vector3(0.9, 0.12, 0.25), R() * (lastEnd + 12), 11, 0.18, "#fffaf0", R());

      return {
        targets, noteColor: n => pal(WILD, n.pitch),
        keys: { white: "#fbf3e3", black: "#2b1d14", case: "#6b4a2f", roughness: 0.4, glow: p => pal(WILD, p).multiplyScalar(0.85) },
        light: { dir: new T.Vector3(-0.35, 0.75, 0.55), color: "#ffe2b6", intensity: 0.75, ambient: "#55544a", sky: "#bcd2ff", ground: "#4d6a2a", hemi: 0.5 },
        fog: { color: "#e9cfa2", density: 0.0026 }, fallH: KW * 0.28,
        bloom: { strength: 0.8, radius: 0.45 }, endGlow: 0.4, windEnd: 1.2, posterTime: lastEnd + 1,
        pose(t, prog, aspect, now) {
          const front = z0 - prog * D;
          return orbit(new T.Vector3(0, 0.5, front * 0.55 - 1), fit(KW * 1.1, KW * 0.5 + prog * D * 0.4, aspect), 0.5, Math.sin(now * 0.04) * 0.28);
        },
        reveal(aspect, now) { return orbit(new T.Vector3(0, 0, z0 - D / 2 + 2), fit(KW * 1.25, D * 1.2, aspect), 1.18, Math.sin(now * 0.05) * 0.18); }
      };
    }
  };

  /* =========================================================
     Changing seasons — a year turns on an island while notes plant a wheel around it
     ========================================================= */
  const SEASON_PAL = [
    ["#ffd1e0", "#ffffff", "#ffb3cc", "#fff0b3"],
    ["#ffd23f", "#ff9f1c", "#e85d75", "#fff8e0"],
    ["#d9480f", "#f08c00", "#a61e4d", "#e8590c"],
    ["#dff3ff", "#bde4ff", "#ffffff", "#a5d8ff"]
  ];
  const seasonOf = s => Math.min(3, Math.floor(s * 4));
  WORLDS.seasons = {
    label: "Changing seasons",
    build(c) {
      const { KW, notes, R, K, lastEnd, group } = c, G = geos(c.merge);
      const Ri = KW * 0.6, C = new T.Vector3(0, 0, -(Ri + 3)), H = KW * 0.55, u = H / 30;
      group.add(c.skyDome({ top: "#000", mid: "#000", bottom: "#3a4048", sunDir: new T.Vector3(0.7, 0.1, -1), sunColor: "#fff1d6", sunSize: 0.016, glow: 0.09, seasonal: true }));
      const groundMat = new T.MeshStandardMaterial({ color: "#7fb54a", roughness: 1 });
      const island = new T.Mesh(new T.CylinderGeometry(Ri, Ri * 0.86, 2.6, 72), groundMat);
      island.position.set(C.x, -1.45, C.z); group.add(island);
      const sea = new T.Mesh(new T.PlaneGeometry(1400, 1400), new T.MeshStandardMaterial({ color: "#3d6e86", roughness: 0.6, metalness: 0.1 }));
      sea.rotation.x = -Math.PI / 2; sea.position.y = -1.9; group.add(sea);

      const segs = c.genTree(R, { base: new T.Vector3(C.x, -0.2, C.z), height: H, width: Ri * 0.85, maxDepth: 6 });
      const segBirth = i => -1.5 + c.atFraction(0.08 * i / segs.length) * 0.5;
      group.add(c.branchLayer(segs, segBirth, "#4a372c").mesh(c.growMaterial({ emissive: 0.03, snow: 1, sway: 0 })));
      const tips = segs.map((s, i) => ({ s, i })).filter(o => o.s.depth >= 4);
      const leaves = c.growLayer(G.leaf, tips.length * 3);
      for (const { s, i } of tips) for (let k = 0; k < 3; k++) {
        const pos = s.a.clone().lerp(s.b, 0.4 + R() * 0.6).add(inSphere(R, u * 0.9));
        leaves.add(pos, c.randQuat(R), u * (0.8 + R() * 0.5), new T.Color(R(), R(), 0), segBirth(i) + 1, 1.5, 1e9, R() * 6);
        if (R() < 0.4) c.softFx.add(2, pos, new T.Vector3((R() - 0.5) * 0.8, -1.1 - R() * 0.6, (R() - 0.5) * 0.8), lastEnd * (0.6 + R() * 0.17), 7, u * 0.45, SEASON_PAL[2][Math.floor(R() * 4)], R());
      }
      group.add(leaves.mesh(c.growMaterial({ emissive: 0.05, side: T.DoubleSide, seasonLeaf: true })));

      // the wheel of the year: angle = time, distance from the tree = pitch
      const L = [G.blossom, G.daisy, G.mushroom, G.crystal].map(g => c.growLayer(g, notes.length));
      const stems = c.growLayer(G.stem, notes.length), targets = [];
      const span = Math.max(1, K.hi - K.lo);
      notes.forEach(n => {
        const s = n.start / Math.max(1, lastEnd), th = s * Math.PI * 2, r = Ri * (0.4 + 0.52 * (n.pitch - K.lo) / span);
        const pos = new T.Vector3(C.x + Math.sin(th) * r, -0.15, C.z + Math.cos(th) * r);
        const se = seasonOf(s), colr = new T.Color(SEASON_PAL[se][pcIndex(n.pitch) % 4]), birth = n.start + 0.85, sc = 0.5 + n.vel * 0.6;
        if (se === 1) { const hs = 0.8 + Math.min(n.end - n.start, 2) * 0.8; stems.add(pos, tilt(R, 0.1), new T.Vector3(1, hs, 1), "#4c7a2a", birth, 0.5, 1e9, R() * 6); L[1].add(pos.clone().setY(hs - 0.15), new T.Quaternion().setFromEuler(new T.Euler(-0.6, th + Math.PI, 0)), sc, colr, birth + 0.2, 0.8, 1e9, R() * 6); }
        else L[se].add(pos, se === 0 ? c.randQuat(R) : tilt(R, 0.3), sc * (se === 3 ? 0.9 : 1), colr, birth, 0.9, 1e9, R() * 6);
        if (se === 3) c.glowFx.add(1, pos.clone().setY(1), new T.Vector3(0, 0.2, 0), birth + 0.2, 3, 0.35, "#cfe9ff", R());
        targets.push(pos.clone().setY(0.4));
      });
      const fm = c.growMaterial({ emissive: 0.1, glow: 2.2, pop: 1, side: T.DoubleSide });
      group.add(L[0].mesh(fm), L[1].mesh(fm), L[2].mesh(fm), L[3].mesh(c.growMaterial({ emissive: 0.25, glow: 2.6, pop: 1 })), stems.mesh(c.growMaterial({ emissive: 0.04 })));

      // weather through the year
      const over = (a, b) => (a + R() * (b - a)) * lastEnd;
      const above = () => new T.Vector3(C.x + (R() - 0.5) * Ri * 2.4, 6 + R() * H, C.z + (R() - 0.5) * Ri * 2.4);
      for (let i = 0; i < 260; i++) c.softFx.add(2, above(), new T.Vector3(0.5, -0.9, 0.2), over(0, 0.25), 9, 0.32, ["#ffc8dc", "#fff0f5"][i % 2], R());
      for (let i = 0; i < 240; i++) c.glowFx.add(1, new T.Vector3(C.x + (R() - 0.5) * Ri * 2, 0.4 + R() * 3, C.z + (R() - 0.5) * Ri * 2), new T.Vector3(0, 0.25, 0), over(0.26, 0.5), 6, 0.45, "#e6ff8a", R());
      for (let i = 0; i < 1100; i++) { const p = above(); p.y += 8; c.softFx.add(2, p, new T.Vector3(0.25, -1.5, 0.1), (0.74 + R() * 0.3) * lastEnd + R() * 6, 16, 0.22, "#ffffff", R()); }

      const groundCols = ["#8cc455", "#4f8f36", "#b9873b", "#e9eef4", "#e9eef4"];
      const fogCols = ["#f3d7e0", "#cfe3f5", "#e8b07c", "#d9e0ea", "#d9e0ea"];
      const seaCols = ["#4f87a1", "#2f7ea6", "#4a5a6a", "#6a7d8e", "#6a7d8e"];
      return {
        targets, noteColor: n => new T.Color(SEASON_PAL[seasonOf(n.start / Math.max(1, lastEnd))][pcIndex(n.pitch) % 4]),
        keys: { white: "#f2eadc", black: "#2a2320", case: "#5a4636", roughness: 0.45, glow: p => new T.Color(SEASON_PAL[seasonOf(U.uSeason.value)][pcIndex(p) % 4]) },
        light: { dir: new T.Vector3(0.35, 0.8, 0.55), color: "#fff2dc", intensity: 0.75, ambient: "#55596a", sky: "#d8e6ff", ground: "#6a7a50", hemi: 0.5 },
        fog: { color: fogCols[0], density: 0.0028 }, fallH: KW * 0.28,
        bloom: { strength: 0.8, radius: 0.45 }, endGlow: 0.5, posterTime: lastEnd + 1,
        update(t, dt, prog) {
          U.uSeason.value = prog;
          groundMat.color.copy(lerpColors(groundCols, prog));
          sea.material.color.copy(lerpColors(seaCols, prog));
          const scene = group.parent; if (scene && scene.fog) scene.fog.color.copy(lerpColors(fogCols, prog));
        },
        pose(t, prog, aspect, now) {
          const tg = new T.Vector3(C.x, H * 0.25, C.z * 0.62);
          return orbit(tg, fit(KW * 1.12, H * 1.4, aspect), 0.32, -0.45 + prog * 0.9 + Math.sin(now * 0.05) * 0.08);
        },
        reveal(aspect, now) { return orbit(C.clone(), fit(Ri * 2.4, Ri * 2.4, aspect), 1.25, now * 0.05); }
      };
    }
  };
})();
