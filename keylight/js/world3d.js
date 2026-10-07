"use strict";
/* Keylight 3D engine for the nature worlds.
   Everything a song grows (branches, flowers, ripples, sparks) is built once when the
   song loads, each piece tagged with the moment it is born. Shaders reveal and animate
   pieces from the current song time, so a frame costs almost nothing on the CPU and
   seeking backwards simply un-grows the scene. */
const World3D = (() => {
  if (!window.THREE || !THREE.EffectComposer || !THREE.UnrealBloomPass || !THREE.OrbitControls) return null;
  const T = THREE;

  // Uniforms shared by every material, updated once per frame
  const U = {
    uTime: { value: 0 }, uWind: { value: 1 }, uLoud: { value: 0 }, uSeason: { value: 0 }, uEndGlow: { value: 0 },
    uLightDir: { value: new T.Vector3(0.3, 1, 0.5).normalize() }, uLightColor: { value: new T.Color(1, 1, 1) },
    uAmbient: { value: new T.Color(0.35, 0.35, 0.4) }, uSpeed: { value: 7 }, uFallH: { value: 18 }, uPx: { value: 800 }
  };

  /* ---------- small helpers ---------- */
  function rng(seed) {
    return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const col = c => c instanceof T.Color ? c : new T.Color(c);
  const UP = new T.Vector3(0, 1, 0);
  const quatFromDir = (dir) => new T.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
  const randQuat = (r) => new T.Quaternion().setFromEuler(new T.Euler(r() * 6.28, r() * 6.28, r() * 6.28));

  // Merge several geometries into one non-indexed geometry (positions + normals)
  function merge(geos) {
    const parts = geos.map(g => g.index ? g.toNonIndexed() : g);
    let n = 0; for (const g of parts) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    let o = 0;
    for (const g of parts) { g.computeVertexNormals(); pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
    const out = new T.BufferGeometry();
    out.setAttribute("position", new T.BufferAttribute(pos, 3)); out.setAttribute("normal", new T.BufferAttribute(nor, 3));
    return out;
  }

  /* ---------- shaders ---------- */
  const QROT = "vec3 qrot(vec4 q, vec3 v){ return v + 2.0*cross(q.xyz, cross(q.xyz, v) + q.w*v); }";
  const GROW_VS = `
    attribute vec3 iPos; attribute vec4 iQuat; attribute vec3 iScale; attribute vec3 iColor; attribute vec4 iTime;
    uniform float uTime, uWind, uPop, uSeason, uSway;
    varying vec3 vColor; varying vec3 vN; varying float vGlow; varying float vH;
    #include <fog_pars_vertex>
    ${QROT}
    #ifdef SEASON_LEAF
    vec3 seasonColor(float v, float s){
      vec3 spring = mix(vec3(0.62,0.86,0.45), vec3(1.0,0.72,0.82), step(0.72, v));
      vec3 summer = mix(vec3(0.20,0.50,0.20), vec3(0.36,0.62,0.25), v);
      vec3 autumn = mix(mix(vec3(0.93,0.45,0.13), vec3(0.80,0.20,0.12), step(0.5, v)), vec3(0.97,0.72,0.20), step(0.8, v));
      vec3 c = mix(spring, summer, smoothstep(0.18, 0.3, s));
      return mix(c, autumn, smoothstep(0.45, 0.55, s));
    }
    #endif
    void main(){
      float t = uTime - iTime.x;
      float u = clamp(t / iTime.y, 0.0, 1.0);
      float g = 1.0 - pow(1.0 - u, 3.0);
      g += uPop * sin(u * 3.14159) * 0.35;
      g *= 1.0 - clamp((uTime - iTime.z) / 1.4, 0.0, 1.0);
      vColor = iColor;
      #ifdef SEASON_LEAF
        g *= 1.0 - smoothstep(0.70, 0.78, uSeason + iColor.g * 0.05);
        vColor = seasonColor(iColor.r, uSeason);
      #endif
      vec3 p = position * iScale * g;
      float h = max(position.y, 0.0);
      p.x += sin(uTime * 1.6 + iTime.w) * uWind * uSway * h * h * min(iScale.y, 2.0) * 0.08;
      p.z += cos(uTime * 1.2 + iTime.w * 1.3) * uWind * uSway * h * h * min(iScale.y, 2.0) * 0.05;
      vec3 wp = iPos + qrot(iQuat, p);
      vN = qrot(iQuat, normal / max(iScale, vec3(1e-4)));
      vH = position.y;
      vGlow = t > 0.0 ? exp(-t * 2.2) : 0.0;
      vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`;
  const GROW_FS = `
    uniform vec3 uLightDir, uLightColor, uAmbient; uniform float uEmissive, uGlowBoost, uEndGlow, uSeason, uSnow;
    varying vec3 vColor; varying vec3 vN; varying float vGlow; varying float vH;
    #include <fog_pars_fragment>
    void main(){
      vec3 n = normalize(vN);
      float d = max(dot(n, uLightDir), 0.0) * 0.85 + abs(dot(n, uLightDir)) * 0.15;
      vec3 base = vColor;
      if (uSnow > 0.0) base = mix(base, vec3(0.92,0.95,1.0), smoothstep(0.74, 0.8, uSeason) * smoothstep(0.2, 0.7, n.y) * uSnow);
      vec3 c = base * (uAmbient + uLightColor * d) + base * (uEmissive * (1.0 + uEndGlow) + vGlow * uGlowBoost);
      gl_FragColor = vec4(c, 1.0);
      #include <fog_fragment>
    }`;
  function growMaterial(o = {}) {
    const m = new T.ShaderMaterial({
      uniforms: Object.assign(T.UniformsUtils.merge([T.UniformsLib.fog]), {
        uTime: U.uTime, uWind: U.uWind, uSeason: U.uSeason, uEndGlow: U.uEndGlow, uLightDir: U.uLightDir, uLightColor: U.uLightColor, uAmbient: U.uAmbient,
        uPop: { value: o.pop || 0 }, uSway: { value: o.sway ?? 1 }, uEmissive: { value: o.emissive || 0 }, uGlowBoost: { value: o.glow || 0 }, uSnow: { value: o.snow || 0 }
      }),
      vertexShader: GROW_VS, fragmentShader: GROW_FS, fog: true, side: o.side || T.FrontSide
    });
    if (o.seasonLeaf) m.defines = { SEASON_LEAF: 1 };
    return m;
  }
  // A batch of instances that share one geometry and one draw call
  function growLayer(geo, cap) {
    cap = Math.max(1, cap);
    const A = { iPos: new Float32Array(cap * 3), iQuat: new Float32Array(cap * 4), iScale: new Float32Array(cap * 3), iColor: new Float32Array(cap * 3), iTime: new Float32Array(cap * 4) };
    let n = 0;
    return {
      get count() { return n; },
      add(pos, quat, scale, color, birth, grow = 1, death = 1e9, phase = 0) {
        if (n >= cap) return;
        const c = col(color);
        A.iPos.set([pos.x, pos.y, pos.z], n * 3); A.iQuat.set([quat.x, quat.y, quat.z, quat.w], n * 4);
        A.iScale.set(typeof scale === "number" ? [scale, scale, scale] : [scale.x, scale.y, scale.z], n * 3);
        A.iColor.set([c.r, c.g, c.b], n * 3); A.iTime.set([birth, grow, death, phase], n * 4);
        n++;
      },
      mesh(material) {
        const g = new T.InstancedBufferGeometry();
        g.index = geo.index; g.setAttribute("position", geo.attributes.position); g.setAttribute("normal", geo.attributes.normal);
        g.setAttribute("iPos", new T.InstancedBufferAttribute(A.iPos.slice(0, n * 3), 3));
        g.setAttribute("iQuat", new T.InstancedBufferAttribute(A.iQuat.slice(0, n * 4), 4));
        g.setAttribute("iScale", new T.InstancedBufferAttribute(A.iScale.slice(0, n * 3), 3));
        g.setAttribute("iColor", new T.InstancedBufferAttribute(A.iColor.slice(0, n * 3), 3));
        g.setAttribute("iTime", new T.InstancedBufferAttribute(A.iTime.slice(0, n * 4), 4));
        g.instanceCount = n;
        const m = new T.Mesh(g, material); m.frustumCulled = false;
        return m;
      }
    };
  }

  // Particles: flights (key -> target), drifting motes, falling petals/leaves/snow
  const FX_VS = `
    attribute vec3 aA; attribute vec3 aB; attribute vec3 aColor; attribute vec4 aT; attribute float aSeed;
    uniform float uTime, uPx;
    varying vec3 vColor; varying float vA; varying float vKind;
    void main(){
      float t = uTime - aT.x; float u = t / aT.y;
      vKind = aT.z; vColor = aColor;
      if (u < 0.0 || u > 1.0) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; return; }
      vec3 p; float a;
      if (aT.z < 0.5) {
        float e = u * u * (3.0 - 2.0 * u);
        p = mix(aA, aB, e); p.y += sin(u * 3.14159) * (1.5 + length(aB - aA) * 0.22);
        a = smoothstep(0.0, 0.08, u) * (1.0 - smoothstep(0.9, 1.0, u));
      } else if (aT.z < 1.5) {
        p = aA + aB * t + vec3(sin(t * 1.7 + aSeed * 10.0), sin(t * 2.3 + aSeed * 4.0) * 0.3, cos(t * 1.3 + aSeed * 7.0)) * 0.6;
        a = smoothstep(0.0, 0.15, u) * (1.0 - u) * (0.55 + 0.45 * sin(t * 5.0 + aSeed * 20.0));
      } else {
        p = aA + aB * t + vec3(sin(t * 1.1 + aSeed * 9.0) * 1.2, 0.0, cos(t * 0.8 + aSeed * 5.0) * 0.9);
        a = smoothstep(0.0, 0.06, u) * (1.0 - smoothstep(0.8, 1.0, u));
      }
      vA = a;
      vec4 mv = viewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = min(aT.w * uPx / max(0.1, -mv.z), 96.0);
    }`;
  const FX_FS = `
    varying vec3 vColor; varying float vA; varying float vKind;
    void main(){
      vec2 c = gl_PointCoord - 0.5; float d = length(c) * 2.0; if (d > 1.0) discard;
      float a = vKind < 1.5 ? pow(1.0 - d, 2.2) : smoothstep(1.0, 0.55, d);
      gl_FragColor = vec4(vColor * (vKind < 1.5 ? 1.7 : 1.0), a * vA);
    }`;
  function fxBatch(additive) {
    const L = { aA: [], aB: [], aColor: [], aT: [], aSeed: [] };
    return {
      add(kind, a, b, birth, dur, size, color, seed = Math.random()) {
        const c = col(color);
        L.aA.push(a.x, a.y, a.z); L.aB.push(b.x, b.y, b.z); L.aColor.push(c.r, c.g, c.b); L.aT.push(birth, dur, kind, size); L.aSeed.push(seed);
      },
      points() {
        const g = new T.BufferGeometry(), n = L.aSeed.length;
        g.setAttribute("position", new T.BufferAttribute(new Float32Array(n * 3), 3));
        for (const [k, s] of [["aA", 3], ["aB", 3], ["aColor", 3], ["aT", 4], ["aSeed", 1]]) g.setAttribute(k, new T.BufferAttribute(new Float32Array(L[k]), s));
        const m = new T.ShaderMaterial({
          uniforms: { uTime: U.uTime, uPx: U.uPx }, vertexShader: FX_VS, fragmentShader: FX_FS,
          transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending
        });
        const p = new T.Points(g, m); p.frustumCulled = false; return p;
      }
    };
  }

  // Expanding rings on water or ground
  function rippleBatch() {
    const L = { iPos: [], iT: [], iColor: [] };
    return {
      add(pos, birth, life, size, color) { const c = col(color); L.iPos.push(pos.x, pos.y, pos.z); L.iT.push(birth, life, size); L.iColor.push(c.r, c.g, c.b); },
      mesh() {
        const base = new T.PlaneGeometry(1, 1), g = new T.InstancedBufferGeometry();
        g.index = base.index; g.setAttribute("position", base.attributes.position); g.setAttribute("uv", base.attributes.uv);
        for (const [k, s] of [["iPos", 3], ["iT", 3], ["iColor", 3]]) g.setAttribute(k, new T.InstancedBufferAttribute(new Float32Array(L[k]), s));
        g.instanceCount = L.iT.length / 3;
        const m = new T.ShaderMaterial({
          uniforms: { uTime: U.uTime },
          vertexShader: `attribute vec3 iPos; attribute vec3 iT; attribute vec3 iColor; uniform float uTime;
            varying vec2 vUv; varying float vU; varying vec3 vColor;
            void main(){ float u = (uTime - iT.x) / iT.y; vU = u; vUv = uv; vColor = iColor;
              float s = (u < 0.0 || u > 1.0) ? 0.0 : iT.z * (0.12 + 0.88 * sqrt(u));
              vec3 p = iPos + vec3(position.x * s, 0.03, position.y * s);
              gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
          fragmentShader: `varying vec2 vUv; varying float vU; varying vec3 vColor;
            void main(){ float r = length(vUv - 0.5) * 2.0;
              float ring = smoothstep(0.09, 0.0, abs(r - 0.9)) + 0.55 * smoothstep(0.07, 0.0, abs(r - 0.62)) * step(0.2, vU);
              gl_FragColor = vec4(vColor, ring * (1.0 - vU) * 0.75); }`,
          transparent: true, depthWrite: false, blending: T.AdditiveBlending
        });
        const mesh = new T.Mesh(g, m); mesh.frustumCulled = false; return mesh;
      }
    };
  }

  // Gradient sky dome with a soft sun or moon
  function skyDome(o) {
    const m = new T.ShaderMaterial({
      uniforms: {
        top: { value: col(o.top) }, mid: { value: col(o.mid) }, bottom: { value: col(o.bottom) },
        sunDir: { value: o.sunDir.clone().normalize() }, sunColor: { value: col(o.sunColor) }, sunSize: { value: o.sunSize || 0.03 }, glowSize: { value: o.glow || 0.25 },
        uSeason: U.uSeason, seasonal: { value: o.seasonal ? 1 : 0 }
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 top, mid, bottom, sunDir, sunColor; uniform float sunSize, glowSize, uSeason, seasonal; varying vec3 vDir;
        vec3 seasonSky(float y, float s){
          vec3 tSp = vec3(0.45,0.62,0.86), hSp = vec3(1.0,0.84,0.86);
          vec3 tSu = vec3(0.22,0.48,0.88), hSu = vec3(0.86,0.93,1.0);
          vec3 tAu = vec3(0.32,0.27,0.45), hAu = vec3(1.0,0.66,0.38);
          vec3 tWi = vec3(0.36,0.43,0.55), hWi = vec3(0.86,0.89,0.95);
          float k = clamp(s, 0.0, 1.0) * 3.0;
          vec3 tc = k < 1.0 ? mix(tSp, tSu, smoothstep(0.6,1.0,k)) : k < 2.0 ? mix(tSu, tAu, smoothstep(1.6,2.0,k)) : mix(tAu, tWi, smoothstep(2.6,3.0,k));
          vec3 hc = k < 1.0 ? mix(hSp, hSu, smoothstep(0.6,1.0,k)) : k < 2.0 ? mix(hSu, hAu, smoothstep(1.6,2.0,k)) : mix(hAu, hWi, smoothstep(2.6,3.0,k));
          return mix(hc, tc, smoothstep(0.0, 0.6, y));
        }
        void main(){
          float y = vDir.y;
          vec3 c = y > 0.0 ? mix(mid, top, smoothstep(0.0, 0.55, y)) : mix(mid, bottom, smoothstep(0.0, -0.25, y));
          if (seasonal > 0.5) c = seasonSky(max(y, 0.0), uSeason);
          float d = dot(normalize(vDir), sunDir);
          c = min(c, vec3(0.92)) + sunColor * (smoothstep(1.0 - sunSize, 1.0 - sunSize * 0.85, d) * 1.1 + pow(max(d, 0.0), 1.0 / glowSize) * 0.16);
          gl_FragColor = vec4(c, 1.0);
        }`,
      side: T.BackSide, depthWrite: false, fog: false
    });
    const mesh = new T.Mesh(new T.SphereGeometry(900, 32, 16), m); mesh.renderOrder = -10; return mesh;
  }
  function starField(n, r) {
    const R = rng(99), p = new Float32Array(n * 3), s = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const th = R() * 6.283, y = 0.05 + R() * 0.95, rr2 = Math.sqrt(1 - y * y);
      p.set([Math.cos(th) * rr2 * 800, y * 800, Math.sin(th) * rr2 * 800], i * 3); s[i] = R();
    }
    const g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(p, 3)); g.setAttribute("seed", new T.BufferAttribute(s, 1));
    const m = new T.ShaderMaterial({
      uniforms: { uTime: U.uTime },
      vertexShader: `attribute float seed; uniform float uTime; varying float vA;
        void main(){ vA = (0.35 + 0.65 * seed) * (0.6 + 0.4 * sin(uTime * (0.8 + seed * 2.0) + seed * 40.0));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = 1.0 + seed * seed * 2.6; }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(vec3(0.9,0.93,1.0), vA * (1.0 - d)); }`,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending
    });
    const pts = new T.Points(g, m); pts.frustumCulled = false; return pts;
  }

  // Tree skeleton: returns segments in growth order (breadth first)
  function genTree(R, o) {
    const segs = [];
    const queue = [{ a: o.base.clone(), dir: new T.Vector3(0, 1, 0), len: o.height * 0.26, rad: o.height * 0.032, depth: 0, parent: -1 }];
    while (queue.length) {
      const b = queue.shift();
      const end = b.a.clone().addScaledVector(b.dir, b.len);
      const idx = segs.length;
      segs.push({ a: b.a.clone(), b: end.clone(), r: b.rad, depth: b.depth, parent: b.parent, tip: b.depth >= o.maxDepth });
      if (b.depth >= o.maxDepth) continue;
      const kids = b.depth === 0 ? 1 : b.depth < 2 ? 2 : (R() < 0.55 ? 2 : 3);
      for (let k = 0; k < kids; k++) {
        const spread = b.depth === 0 ? 0.08 : 0.35 + R() * 0.45;
        const perp = new T.Vector3(1, 0, 0).cross(b.dir);
        if (perp.lengthSq() < 1e-4) perp.set(0, 0, 1);
        perp.normalize();
        const nd = b.dir.clone().applyAxisAngle(perp, spread).applyAxisAngle(b.dir, (k / kids) * 6.283 + R() * 1.2);
        nd.lerp(UP, 0.12).normalize();
        queue.push({ a: end, dir: nd, len: b.len * (b.depth === 0 ? 0.8 : 0.7 + R() * 0.14), rad: b.rad * 0.68, depth: b.depth + 1, parent: idx });
      }
    }
    // stretch the crown horizontally to the requested width
    let minX = 1e9, maxX = -1e9;
    for (const s of segs) { minX = Math.min(minX, s.b.x); maxX = Math.max(maxX, s.b.x); }
    const sx = clamp(o.width / Math.max(1, maxX - minX), 0.7, 2.6);
    for (const s of segs) for (const p of [s.a, s.b]) { p.x = o.base.x + (p.x - o.base.x) * sx; p.z = o.base.z + (p.z - o.base.z) * sx * 0.7; }
    return segs;
  }
  const BRANCH_GEO = (() => { const g = new T.CylinderGeometry(0.62, 1, 1, 7, 1); g.translate(0, 0.5, 0); return g; })();
  function branchLayer(segs, birthOf, color) {
    const L = growLayer(BRANCH_GEO, segs.length);
    segs.forEach((s, i) => {
      const d = s.b.clone().sub(s.a), len = d.length();
      L.add(s.a, quatFromDir(d), new T.Vector3(s.r, len, s.r), color, birthOf(i), 1.2 + s.depth * 0.1, 1e9, i);
    });
    return L;
  }

  /* ---------- engine state ---------- */
  let renderer, scene, camera, composer, bloom, finalPass, controls, canvas, hud;
  let worldName = "pond", song = null, analysis = null, rangeMode = "auto", dirty = true, W = null, built = null;
  let keyLayout = null, keyMeshes = null;
  const cam = { manual: false, lastInteract: 0, dragging: false, pos: new T.Vector3(0, 10, 30), target: new T.Vector3() };
  const glowArr = new Float32Array(128);
  let lastLoud = 0, fallSecs = 2.4;

  function init(cv) {
    canvas = cv;
    renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(1);
    renderer.autoClear = false;
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(38, 9 / 16, 0.5, 2500);
    const rt = new T.WebGLRenderTarget(16, 16, { type: T.HalfFloatType, samples: renderer.capabilities.isWebGL2 ? 4 : 0 });
    composer = new T.EffectComposer(renderer, rt);
    composer.addPass(new T.RenderPass(scene, camera));
    bloom = new T.UnrealBloomPass(new T.Vector2(16, 16), 0.9, 0.55, 0.62);
    composer.addPass(bloom);
    finalPass = new T.ShaderPass({
      uniforms: { tDiffuse: { value: null }, uTime: U.uTime, uExposure: { value: 1.0 }, uVig: { value: 0.32 }, uGrain: { value: 0.018 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uExposure, uVig, uGrain; varying vec2 vUv;
        void main(){
          vec3 c = texture2D(tDiffuse, vUv).rgb * uExposure;
          vec3 over = max(c - 0.8, 0.0); c = min(c, 0.8) + 0.2 * (1.0 - exp(-over / 0.2)); // soft shoulder: only highlights compress
          float v = smoothstep(0.95, 0.25, length((vUv - 0.5) * vec2(1.0, 1.15)) * 1.2);
          c *= mix(1.0 - uVig, 1.0, v);
          float n = fract(sin(dot(vUv * 913.7 + fract(uTime * 7.31), vec2(12.9898, 78.233))) * 43758.5453);
          c += (n - 0.5) * uGrain;
          gl_FragColor = vec4(c, 1.0);
        }`
    });
    composer.addPass(finalPass);
    controls = new T.OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false;
    controls.rotateSpeed = 0.6; controls.zoomSpeed = 0.7;
    controls.addEventListener("start", () => { cam.manual = true; cam.dragging = true; cam.lastInteract = performance.now(); });
    controls.addEventListener("end", () => { cam.dragging = false; cam.lastInteract = performance.now(); });
    hud = makeHud();
  }

  function makeHud() {
    const c = document.createElement("canvas"); c.width = c.height = 16;
    const tex = new T.CanvasTexture(c);
    const m = new T.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
    const s = new T.Scene(); s.add(new T.Mesh(new T.PlaneGeometry(2, 2), m));
    return { c, tex, m, s, cam: new T.OrthographicCamera(-1, 1, 1, -1, 0, 1), key: "" };
  }
  function drawHud(w, h) {
    if (!song) return;
    const key = `${song.title}|${w}x${h}|${worldName}|${document.fonts ? document.fonts.status : ""}`;
    if (key === hud.key) return;
    hud.key = key;
    const c = hud.c; c.width = w; c.height = h;
    const g = c.getContext("2d"), sc = Math.min(w, h) / 1080, portrait = h > w;
    g.clearRect(0, 0, w, h);
    g.textAlign = "center";
    const size = (portrait ? 96 : 80) * sc * (song.title.length > 22 ? 0.7 : 1);
    g.font = `${size}px Italiana, Didot, "Bodoni 72", Georgia, serif`;
    g.shadowColor = "rgba(0,0,0,0.45)"; g.shadowBlur = 24 * sc;
    g.fillStyle = "rgba(255,250,244,0.94)";
    const y = h * (portrait ? 0.2 : 0.24);
    const words = song.title.split(/\s+/), lines = []; let line = "";
    for (const wd of words) { const t = line ? line + " " + wd : wd; if (g.measureText(t).width > w * 0.84 && line) { lines.push(line); line = wd; } else line = t; }
    lines.push(line);
    lines.slice(0, 3).forEach((l, i, arr) => g.fillText(l, w / 2, y - (arr.length - 1 - i) * size * 1.06));
    g.font = `500 ${21 * sc}px "JetBrains Mono", ui-monospace, monospace`;
    g.fillStyle = "rgba(255,250,244,0.72)";
    const meta = analysis ? `${analysis.key}  ·  ♩ ${song.bpm}  ·  ${WORLDS[worldName].label}` : `♩ ${song.bpm}`;
    g.fillText(meta.toUpperCase(), w / 2, y + size * 0.72);
    hud.tex.needsUpdate = true;
  }

  /* ---------- keyboard ---------- */
  function layoutKeys() {
    let lo = 21, hi = 108;
    if (rangeMode !== "88" && song && song.notes.length) {
      lo = 127; hi = 0; for (const n of song.notes) { lo = Math.min(lo, n.pitch); hi = Math.max(hi, n.pitch); }
      lo -= 2; hi += 2; while (hi - lo < 36) { lo--; hi++; }
      lo = clamp(lo, 21, 108); hi = clamp(hi, 21, 108);
      while (isBlack(lo)) lo--; while (isBlack(hi)) hi++;
    }
    let whites = 0; for (let p = lo; p <= hi; p++) if (!isBlack(p)) whites++;
    const keyX = [], KW = whites; let wi = 0;
    const adj = { 1: -0.06, 3: 0.06, 6: -0.08, 8: 0, 10: 0.08 };
    for (let p = lo; p <= hi; p++) {
      if (!isBlack(p)) { keyX[p] = wi + 0.5 - KW / 2; wi++; }
      else keyX[p] = wi + adj[p % 12] - KW / 2;
    }
    const x = p => keyX[clamp(p, lo, hi)] !== undefined ? keyX[clamp(p, lo, hi)] : 0;
    return { lo, hi, KW, keyX: x };
  }
  function buildKeyboard(K, look, group) {
    const whites = [], blacks = [];
    for (let p = K.lo; p <= K.hi; p++) (isBlack(p) ? blacks : whites).push(p);
    const wMat = new T.MeshStandardMaterial({ color: col(look.white), roughness: look.roughness ?? 0.45, metalness: look.metalness ?? 0.05 });
    const bMat = new T.MeshStandardMaterial({ color: col(look.black), roughness: 0.35, metalness: look.metalness ?? 0.05 });
    const wm = new T.InstancedMesh(new T.BoxGeometry(0.94, 0.6, 5.2), wMat, whites.length);
    const bm = new T.InstancedMesh(new T.BoxGeometry(0.56, 0.5, 3.3), bMat, blacks.length);
    const gm = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ transparent: true, blending: T.AdditiveBlending, depthWrite: false }), whites.length + blacks.length);
    gm.instanceColor = new T.InstancedBufferAttribute(new Float32Array((whites.length + blacks.length) * 3), 3);
    const caseMesh = new T.Mesh(new T.BoxGeometry(K.KW + 1.4, 1.3, 1.1), new T.MeshStandardMaterial({ color: col(look.case || look.black), roughness: 0.5 }));
    caseMesh.position.set(0, 0.05, -0.55);
    const rail = new T.Mesh(new T.BoxGeometry(K.KW + 1.4, 0.5, 5.6), caseMesh.material);
    rail.position.set(0, -0.62, 2.6);
    for (const m of [wm, bm, gm, caseMesh, rail]) group.add(m);
    keyMeshes = { wm, bm, gm, whites, blacks, K, glowColor: look.glow, dummy: new T.Object3D(), last: new Float32Array(128).fill(-1) };
    updateKeys(true);
  }
  function updateKeys(force) {
    const km = keyMeshes; if (!km) return;
    const d = km.dummy;
    const place = (mesh, i, p, cy, cz, black) => {
      const g = glowArr[p];
      if (!force && Math.abs(km.last[p] - g) < 0.01) return false;
      km.last[p] = g;
      const ang = g > 0.45 ? 0.055 : 0;
      d.position.set(km.K.keyX(p), cy * Math.cos(ang) - cz * Math.sin(ang), cy * Math.sin(ang) + cz * Math.cos(ang));
      d.rotation.set(ang, 0, 0); d.scale.set(1, 1, 1); d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      // glow plate on top of the key
      const gi = black ? km.whites.length + i : i, top = black ? 0.32 : 0.02;
      d.position.set(km.K.keyX(p), (cy + top) * Math.cos(ang) - cz * Math.sin(ang) + (black ? 0 : 0.0), (cy + top) * Math.sin(ang) + cz * Math.cos(ang));
      d.scale.set(black ? 0.6 : 0.98, black ? 0.06 : 0.04, black ? 3.35 : 5.25); d.updateMatrix();
      km.gm.setMatrixAt(gi, d.matrix);
      const c = km.glowColor(p);
      km.gm.instanceColor.setXYZ(gi, c.r * g, c.g * g, c.b * g);
      return true;
    };
    let a = false, b = false, gl = false;
    km.whites.forEach((p, i) => { if (place(km.wm, i, p, -0.3, 2.6, false)) a = gl = true; });
    km.blacks.forEach((p, i) => { if (place(km.bm, i, p, 0.08, 1.65, true)) b = gl = true; });
    if (a) km.wm.instanceMatrix.needsUpdate = true;
    if (b) km.bm.instanceMatrix.needsUpdate = true;
    if (gl) { km.gm.instanceMatrix.needsUpdate = true; km.gm.instanceColor.needsUpdate = true; }
  }

  /* ---------- falling notes ---------- */
  function noteRain(notes, K, colorOf) {
    const base = new T.CylinderGeometry(1, 1, 1, 8, 1); base.translate(0, 0.5, 0);
    const g = new T.InstancedBufferGeometry();
    g.index = base.index; g.setAttribute("position", base.attributes.position);
    const n = notes.length, P = new Float32Array(n * 3), N = new Float32Array(n * 4), C = new Float32Array(n * 3);
    notes.forEach((nt, i) => {
      const bl = isBlack(nt.pitch);
      P.set([K.keyX(nt.pitch), bl ? 0.35 : 0.03, bl ? 0.9 : 1.6], i * 3);
      N.set([nt.start, nt.end - nt.start, nt.vel, bl ? 0.17 : 0.24], i * 4);
      const c = colorOf(nt); C.set([c.r, c.g, c.b], i * 3);
    });
    g.setAttribute("iPos", new T.InstancedBufferAttribute(P, 3)); g.setAttribute("iN", new T.InstancedBufferAttribute(N, 4)); g.setAttribute("iColor", new T.InstancedBufferAttribute(C, 3));
    g.instanceCount = n;
    const m = new T.ShaderMaterial({
      uniforms: { uTime: U.uTime, uSpeed: U.uSpeed, uFallH: U.uFallH },
      vertexShader: `attribute vec3 iPos; attribute vec4 iN; attribute vec3 iColor; uniform float uTime, uSpeed;
        varying float vY; varying vec3 vColor; varying float vV; varying float vL;
        void main(){ float y0 = (iN.x - uTime) * uSpeed; float len = max(iN.y * uSpeed, 0.25);
          vec3 p = vec3(position.x * iN.w, position.y * len + y0, position.z * iN.w) + iPos;
          vY = p.y - iPos.y; vColor = iColor; vV = iN.z; vL = position.y;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
      fragmentShader: `uniform float uFallH; varying float vY; varying vec3 vColor; varying float vV; varying float vL;
        void main(){ if (vY < 0.0 || vY > uFallH) discard;
          float a = 1.0 - smoothstep(uFallH * 0.45, uFallH, vY);
          gl_FragColor = vec4(vColor * (0.5 + vV * 0.9) * (0.8 + 0.6 * (1.0 - vL)), a * 0.6); }`,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending
    });
    const mesh = new T.Mesh(g, m); mesh.frustumCulled = false; return mesh;
  }

  /* ---------- build a world for the current song ---------- */
  function build() {
    dirty = false;
    if (built) { scene.remove(built.group); built.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); } }); }
    built = null; keyMeshes = null;
    if (!song) return;
    W = WORLDS[worldName];
    const K = keyLayout = layoutKeys();
    const notes = song.notes;
    let lastEnd = 0; for (const n of notes) lastEnd = Math.max(lastEnd, n.end);
    let h = 7; for (const c of song.title) h = (h * 31 + c.charCodeAt(0)) | 0;
    const group = new T.Group();
    const ctx = {
      T, U, song, notes, K, KW: K.KW, lastEnd, R: rng(h ^ notes.length), group,
      growLayer, growMaterial, fxBatch, rippleBatch, skyDome, starField, genTree, branchLayer, merge, quatFromDir, randQuat, col,
      // the time at which a given fraction of all notes has been played
      atFraction: f => notes[clamp(Math.floor(f * notes.length), 0, notes.length - 1)].start,
      glowFx: fxBatch(true), softFx: fxBatch(false), ripples: rippleBatch()
    };
    const w = W.build(ctx);
    // flights from each key to wherever that note grows
    const flightDur = 0.85;
    notes.forEach((n, i) => {
      const tgt = w.targets[i]; if (!tgt) return;
      const from = new T.Vector3(K.keyX(n.pitch), 0.6, isBlack(n.pitch) ? 0.9 : 1.6);
      ctx.glowFx.add(0, from, tgt, n.start, flightDur, 0.5 + n.vel * 0.5, w.noteColor(n), i * 0.618 % 1);
    });
    group.add(ctx.glowFx.points(), ctx.softFx.points(), ctx.ripples.mesh());
    group.add(noteRain(notes, K, w.noteColor));
    buildKeyboard(K, w.keys, group);
    // lights for the keyboard (instanced growth uses the shared light uniforms)
    const L = w.light;
    group.add(new T.HemisphereLight(col(L.sky), col(L.ground), L.hemi ?? 0.9));
    const dl = new T.DirectionalLight(col(L.color), L.intensity ?? 0.9); dl.position.copy(L.dir).multiplyScalar(50); group.add(dl);
    U.uLightDir.value.copy(L.dir).normalize(); U.uLightColor.value.copy(col(L.color)).multiplyScalar(L.intensity ?? 0.9); U.uAmbient.value.copy(col(L.ambient));
    scene.fog = new T.FogExp2(col(w.fog.color), w.fog.density);
    U.uFallH.value = w.fallH || K.KW * 0.4;
    U.uSpeed.value = U.uFallH.value / fallSecs;
    bloom.strength = w.bloom?.strength ?? 0.9; bloom.radius = w.bloom?.radius ?? 0.5; bloom.threshold = 1.0;
    finalPass.uniforms.uExposure.value = w.exposure ?? 1.0;
    scene.add(group);
    built = { group, w, lastEnd, K };
    cam.manual = false; cam.snap = true;
    hud.key = "";
  }

  /* ---------- per frame ---------- */
  function frame(t, dt, now, playing) {
    if (!renderer || !song) return;
    if (dirty) build();
    if (!built) return;
    const { w, lastEnd } = built;
    U.uTime.value = t;
    // which keys are sounding
    const notes = song.notes, act = new Float32Array(128);
    let loud = 0;
    for (let i = lowerBound(notes, t - 30.5); i < notes.length; i++) {
      const n = notes[i]; if (n.start > t) break;
      if (n.end > t) { act[n.pitch] = Math.max(act[n.pitch], n.vel); loud += n.vel; }
    }
    const k = Math.exp(-dt * 7);
    for (let p = 0; p < 128; p++) glowArr[p] = Math.max(glowArr[p] * k, act[p]);
    lastLoud += (clamp(loud / 5, 0, 1) - lastLoud) * Math.min(1, dt * 3);
    U.uLoud.value = lastLoud;
    const prog = clamp(t / Math.max(1, lastEnd), 0, 1);
    const ending = clamp((t - lastEnd - 0.4) / 4, 0, 1);
    U.uEndGlow.value = ending * (w.endGlow ?? 0.6);
    U.uWind.value = 1 + lastLoud * 1.5 + (w.windEnd ? ending * w.windEnd : 0);
    w.update && w.update(t, dt, prog, ending);
    updateKeys(false);
    bloom.strength = (w.bloom?.strength ?? 0.9) * (1 + lastLoud * 0.35 + ending * 0.25);

    // camera: scripted path unless the viewer is orbiting; ease back 4s after they let go
    if (cam.manual && !cam.dragging && performance.now() - cam.lastInteract > 4000) cam.manual = false;
    if (cam.manual) {
      controls.update();
      cam.pos.copy(camera.position); cam.target.copy(controls.target);
    } else {
      const goal = ending > 0 ? w.reveal(camera.aspect, now) : anchorKeyboard(w.pose(t, prog, camera.aspect, now));
      const push = 1 - lastLoud * 0.06;
      const gp = goal.target.clone().addScaledVector(goal.pos.clone().sub(goal.target), push);
      const kk = cam.snap ? 1 : 1 - Math.exp(-dt * (ending > 0 ? 0.7 : 1.4));
      cam.snap = false;
      cam.pos.lerp(gp, kk); cam.target.lerp(goal.target, kk);
      camera.position.copy(cam.pos); camera.lookAt(cam.target);
      controls.target.copy(cam.target);
    }
    render(t);
  }
  // Slide a camera pose up or down so the keyboard sits in the lower part of the frame
  const tmpCam = new T.PerspectiveCamera();
  function anchorKeyboard(goal) {
    tmpCam.fov = camera.fov; tmpCam.aspect = camera.aspect; tmpCam.updateProjectionMatrix();
    const want = camera.aspect < 1 ? -0.62 : -0.5;
    for (let i = 0; i < 2; i++) {
      tmpCam.position.copy(goal.pos); tmpCam.lookAt(goal.target); tmpCam.updateMatrixWorld();
      const kb = new T.Vector3(0, 0, 2.6), dist = kb.distanceTo(goal.pos);
      const ndc = kb.clone().project(tmpCam);
      const up = new T.Vector3(0, 1, 0).applyQuaternion(tmpCam.quaternion);
      const shift = (ndc.y - want) * dist * Math.tan(camera.fov * Math.PI / 360);
      goal.pos.addScaledVector(up, shift); goal.target.addScaledVector(up, shift);
    }
    return goal;
  }
  function render(t) {
    const size = renderer.getSize(new T.Vector2());
    U.uPx.value = size.y / (2 * Math.tan(camera.fov * Math.PI / 360));
    renderer.clear();
    composer.render();
    // title card over the first seconds
    const a = t < 2.5 ? 1 : clamp(1 - (t - 2.5) / 1.5, 0, 1);
    if (a > 0) {
      drawHud(size.x, size.y);
      hud.m.opacity = a;
      renderer.clearDepth();
      renderer.render(hud.s, hud.cam);
    }
  }

  function resize(w, h) {
    if (!renderer) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    hud.key = "";
  }

  // Render the finished artwork at poster resolution and return a 2D canvas with a caption
  function poster() {
    if (!built) return null;
    const size = renderer.getSize(new T.Vector2()), aspect = size.x / size.y;
    const PW = aspect < 1 ? 2160 : Math.round(2160 * aspect), PH = aspect < 1 ? Math.round(2160 / aspect) : 2160;
    const saved = { t: U.uTime.value, pos: camera.position.clone(), q: camera.quaternion.clone(), end: U.uEndGlow.value };
    resize(PW, PH);
    U.uTime.value = built.w.posterTime ?? built.lastEnd + 0.8;
    U.uEndGlow.value = built.w.endGlow ?? 0.6;
    const r = built.w.reveal(aspect, performance.now() / 1000);
    camera.position.copy(r.pos); camera.lookAt(r.target);
    U.uPx.value = PH / (2 * Math.tan(camera.fov * Math.PI / 360));
    renderer.clear(); composer.render();
    const out = document.createElement("canvas"); out.width = PW; out.height = PH;
    const g = out.getContext("2d");
    g.drawImage(canvas, 0, 0);
    const sc = Math.min(PW, PH) / 1080;
    const grad = g.createLinearGradient(0, PH * 0.78, 0, PH);
    grad.addColorStop(0, "rgba(0,0,0,0)"); grad.addColorStop(1, "rgba(0,0,0,0.55)");
    g.fillStyle = grad; g.fillRect(0, PH * 0.7, PW, PH * 0.3);
    g.textAlign = "center"; g.fillStyle = "rgba(255,250,244,0.95)";
    g.font = `${70 * sc}px Italiana, Didot, Georgia, serif`;
    g.fillText(song.title, PW / 2, PH - 120 * sc);
    g.font = `500 ${18 * sc}px "JetBrains Mono", ui-monospace, monospace`; g.fillStyle = "rgba(255,250,244,0.7)";
    g.fillText(`${analysis ? analysis.key + "  ·  " : ""}${song.notes.length.toLocaleString()} NOTES  ·  ${WORLDS[worldName].label.toUpperCase()}  ·  KEYLIGHT`, PW / 2, PH - 72 * sc);
    resize(size.x, size.y);
    U.uTime.value = saved.t; U.uEndGlow.value = saved.end;
    camera.position.copy(saved.pos); camera.quaternion.copy(saved.q);
    return out;
  }

  const WORLDS = {};
  return {
    U, WORLDS, init, resize, frame, poster,
    setSong(s, a) { song = s; analysis = a; dirty = true; for (let p = 0; p < 128; p++) glowArr[p] = 0; },
    setWorld(name) { if (WORLDS[name] && name !== worldName) { worldName = name; dirty = true; } else if (WORLDS[name]) worldName = name; },
    setRange(m) { rangeMode = m; dirty = true; },
    setFall(s) { fallSecs = s; U.uSpeed.value = U.uFallH.value / s; },
    resetCamera() { cam.manual = false; },
    snapCamera() { cam.manual = false; cam.snap = true; },
    get world() { return worldName; },
    get canvas() { return canvas; }
  };
})();
