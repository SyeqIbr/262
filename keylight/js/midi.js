"use strict";
/* ============================================================
   MIDI parsing
   ============================================================ */
function parseMidi(buf) {
  const d = new DataView(buf);
  let p = 0;
  const u8 = () => d.getUint8(p++);
  const u16 = () => { const v = d.getUint16(p); p += 2; return v; };
  const u32 = () => { const v = d.getUint32(p); p += 4; return v; };
  const id = () => String.fromCharCode(u8(), u8(), u8(), u8());
  const vlq = () => { let v = 0, b; do { b = u8(); v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };

  // Find the header (some files are wrapped in RIFF)
  const bytes = new Uint8Array(buf);
  let start = -1;
  for (let i = 0; i < Math.min(bytes.length - 4, 4096); i++) {
    if (bytes[i] === 0x4d && bytes[i + 1] === 0x54 && bytes[i + 2] === 0x68 && bytes[i + 3] === 0x64) { start = i; break; }
  }
  if (start < 0) throw new Error("not a MIDI file");
  p = start + 4;
  const hlen = u32(); const hEnd = p + hlen;
  u16(); const ntrks = u16(); const division = u16();
  p = hEnd;

  let smpteTps = 0;
  if (division & 0x8000) smpteTps = (256 - (division >> 8)) * (division & 0xff);

  const ev = []; // {tick, kind, ...}
  let order = 0;
  const names = [];
  for (let t = 0; t < ntrks && p + 8 <= d.byteLength; t++) {
    const cid = id(); const len = u32(); const end = Math.min(p + len, d.byteLength);
    if (cid !== "MTrk") { p = end; continue; }
    let tick = 0, running = 0;
    while (p < end) {
      tick += vlq();
      let st = d.getUint8(p);
      if (st & 0x80) p++; else st = running;
      if (st === 0xff) {
        const type = u8(); const l = vlq(); const dataStart = p;
        if (type === 0x51 && l >= 3) ev.push({ tick, k: 0, o: order++, tempo: (d.getUint8(p) << 16) | (d.getUint8(p + 1) << 8) | d.getUint8(p + 2) });
        else if ((type === 0x03 || type === 0x01) && names.length < 8) {
          let s = ""; for (let i = 0; i < l && i < 80; i++) s += String.fromCharCode(d.getUint8(p + i));
          if (type === 0x03) names.push(s.trim());
        }
        p = dataStart + l;
        if (type === 0x2f) break;
      } else if (st === 0xf0 || st === 0xf7) {
        p += vlq();
      } else if (st & 0x80) {
        running = st;
        const hi = st & 0xf0, ch = st & 0x0f;
        const a = u8();
        const b = (hi === 0xc0 || hi === 0xd0) ? 0 : u8();
        if (hi === 0x90 && b > 0) ev.push({ tick, k: 3, o: order++, ch, pitch: a, vel: b, track: t });
        else if (hi === 0x80 || hi === 0x90) ev.push({ tick, k: 1, o: order++, ch, pitch: a });
        else if (hi === 0xb0 && a === 64) ev.push({ tick, k: 2, o: order++, ch, val: b });
      } else { break; } // corrupt data: stop this track
    }
    p = end;
  }
  ev.sort((x, y) => x.tick - y.tick || x.k - y.k || x.o - y.o);

  // ticks -> seconds through the tempo map
  let tempo = 500000, lastTick = 0, lastSec = 0, firstTempo = null;
  const tps = () => smpteTps || (division / (tempo / 1e6));
  for (const e of ev) {
    lastSec += (e.tick - lastTick) / tps();
    lastTick = e.tick;
    e.sec = lastSec;
    if (e.k === 0) { tempo = e.tempo; if (firstTempo === null) firstTempo = tempo; }
  }

  // pair note on/off, track sustain pedal for audio release
  const open = new Map(), notes = [];
  const pedal = new Array(16).fill(false), held = Array.from({ length: 16 }, () => []);
  for (const e of ev) {
    if (e.k === 3) {
      const key = e.ch * 128 + e.pitch;
      if (!open.has(key)) open.set(key, []);
      const n = { pitch: e.pitch, start: e.sec, end: e.sec, vel: e.vel / 127, ch: e.ch, track: e.track, aEnd: e.sec };
      open.get(key).push(n); notes.push(n);
    } else if (e.k === 1) {
      const q = open.get(e.ch * 128 + e.pitch);
      if (q && q.length) {
        const n = q.shift(); n.end = n.aEnd = e.sec;
        if (pedal[e.ch]) held[e.ch].push(n);
      }
    } else if (e.k === 2) {
      const down = e.val >= 64;
      if (!down && pedal[e.ch]) { for (const n of held[e.ch]) n.aEnd = Math.max(n.aEnd, e.sec); held[e.ch].length = 0; }
      pedal[e.ch] = down;
    }
  }
  for (const q of open.values()) for (const n of q) { n.end = n.aEnd = Math.max(n.start + 0.5, lastSec); }
  for (const c of held) for (const n of c) n.aEnd = Math.max(n.aEnd, lastSec);

  let out = notes.filter(n => n.ch !== 9); // drop GM drum channel
  if (!out.length) out = notes;
  for (const n of out) {
    if (n.end - n.start < 0.04) n.end = n.start + 0.04;
    n.end = Math.min(n.end, n.start + 30);
    n.aEnd = Math.max(n.aEnd, n.end);
  }
  out.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  return { notes: out, bpm: Math.round(60e6 / (firstTempo || 500000)), name: names.find(s => s && !/^(track|untitled)/i.test(s)) || "" };
}

/* ============================================================
   Demo piece (an original, generated in code)
   ============================================================ */
function makeDemo() {
  const bpm = 76, beat = 60 / bpm, notes = [];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const add = (b, pitch, len, vel) => {
    const h = (rnd() - 0.5) * 0.016;
    const s = b * beat + h;
    notes.push({ pitch, start: s, end: s + len * beat * 0.96, aEnd: s + len * beat * 1.15, vel: Math.min(1, vel + (rnd() - 0.5) * 0.08), ch: 0, track: 0 });
  };
  const chords = { Am: [45, 3], F: [41, 4], C: [48, 4], G: [43, 4], Em: [40, 3], Dm: [38, 3] };
  const prog = ["Am", "F", "C", "G", "Am", "F", "C", "G", "F", "G", "Em", "Am", "F", "G", "Am", "C"];
  // left hand: rolling arpeggio, 8ths, held like a pedal
  prog.forEach((c, bar) => {
    const [r, third] = chords[c];
    const pat = [r, r + 7, r + 12, r + 12 + third, r + 19, r + 12 + third, r + 12, r + 7];
    pat.forEach((pp, i) => add(bar * 4 + i * 0.5, pp, i === 0 ? 4 : 2.2 - i * 0.2, i === 0 ? 0.58 : 0.4));
    if (bar >= 8) { // mid-register chord pad in the second half
      const tri = [r + 24, r + 24 + third, r + 31].map(x => x > 76 ? x - 12 : x);
      tri.forEach(pp => add(bar * 4, pp, 3.6, 0.36));
    }
  });
  const M = { C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, A4: 69, B4: 71, C5: 72, D5: 74, E5: 76, F5: 77, G5: 79, A5: 81, B5: 83, C6: 84, D6: 86, E6: 88 };
  const mel = [
    ["E5", 1], ["D5", .5], ["C5", .5], ["D5", 1], ["E5", 1],
    ["C5", 1.5], ["A4", .5], ["C5", 1], ["F5", 1],
    ["E5", 1.5], ["G5", .5], ["E5", 1], ["D5", 1],
    ["D5", 2], ["B4", 1], ["D5", 1],
    ["E5", 1], ["A5", 1], ["G5", .5], ["E5", .5], ["D5", 1],
    ["C5", 1], ["D5", .5], ["E5", .5], ["F5", 1], ["A5", 1],
    ["G5", 1.5], ["E5", .5], ["C5", 1], ["E5", 1],
    ["D5", 3], [null, 1],
    ["A5", 1], ["C6", 1], ["A5", 1], ["G5", 1],
    ["G5", 1.5], ["D5", .5], ["G5", 1], ["B5", 1],
    ["B5", 1.5], ["G5", .5], ["E5", 1], ["G5", 1],
    ["A5", 2], ["E5", 1], ["C6", 1],
    ["C6", 1], ["A5", 1], ["F5", 1], ["A5", 1],
    ["B5", 1], ["D6", 1], ["B5", 1], ["G5", 1],
    ["C6", 1.5], ["B5", .5], ["A5", 1], ["E5", 1],
    ["E5", 1], [null, 3]
  ];
  let b = 0;
  for (const [n, len] of mel) { if (n) add(b, M[n], len, 0.8 + (len >= 1.5 ? 0.06 : 0)); b += len; }
  // sparkle runs into bars 13 and 16
  [[47, [69, 72, 76, 81, 84, 88]], [59, [72, 76, 79, 84, 88, 91]]].forEach(([at, run]) => run.forEach((pp, i) => add(at + i * 0.16, pp, 0.5, 0.5 + i * 0.05)));
  // closing rolled chord across the keyboard
  [36, 43, 48, 52, 55, 60, 64, 67, 72, 76, 79, 84].forEach((pp, i) => add(64 + i * 0.09, pp, 6 - i * 0.1, 0.55 + i * 0.02));
  notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  return { notes, bpm, name: "Late Light" };
}


/* ============================================================
   Song analysis: pick a world that suits the music
   ============================================================ */
const KEY_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const SCENE_WORDS = {
  sea: /\b(sea|ocean|beach|wave|waves|harbou?r|port|island|summer|blue|sail|gulls?|coast|shore|town|city|kiki|delivery|ponyo)\b/i,
  forest: /\b(forest|woods?|spirit|spirits|totoro|mononoke|moss|shrine|lantern|night|moon|stars?|firefl(y|ies)|dream|secret|deep|path|light)\b/i,
  hill: /\b(wind|sky|cloud|clouds|hill|field|meadow|castle|howl|merry|go\s*round|journey|home|grass|valley|spring|days?|always|memory|memories)\b/i
};
function analyzeSong(song) {
  // Key: correlate a duration-weighted pitch-class profile with Krumhansl–Kessler profiles
  const maj = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const min = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  const pc = new Array(12).fill(0);
  for (const n of song.notes) pc[n.pitch % 12] += Math.min(2, n.end - n.start) * (0.3 + n.vel);
  const corr = (prof, r) => {
    const mx = pc.reduce((a, b) => a + b) / 12, my = prof.reduce((a, b) => a + b) / 12;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < 12; i++) { const x = pc[(i + r) % 12] - mx, y = prof[i] - my; num += x * y; dx += x * x; dy += y * y; }
    return num / Math.sqrt(dx * dy || 1);
  };
  let best = { r: 0, minor: false, c: -2 };
  for (let r = 0; r < 12; r++) {
    const a = corr(maj, r), b = corr(min, r);
    if (a > best.c) best = { r, minor: false, c: a };
    if (b > best.c) best = { r, minor: true, c: b };
  }
  const playing = Math.max(1, song.duration - 1.2);
  const density = song.notes.length / playing;
  let avgVel = 0; for (const n of song.notes) avgVel += n.vel; avgVel /= song.notes.length;
  const bpm = song.bpm;
  const key = `${KEY_NAMES[best.r]} ${best.minor ? "minor" : "major"}`;
  const pace = density < 3 ? "sparse" : density < 7 ? "flowing" : "busy";

  // palette from the mood, scene from the title (or the palette when the title says nothing)
  // time of day from the mood; scene from the title, otherwise from the time of day
  const time = best.minor ? (bpm < 100 || density < 4 ? "night" : "dusk") : (density >= 5 || bpm >= 118 ? "day" : "golden");
  const moodWord = { night: "minor and slow", dusk: "minor with motion", day: "bright and busy", golden: "warm and steady" }[time];
  let scene = null, why = "";
  for (const [s, re] of Object.entries(SCENE_WORDS)) {
    const m = song.title.match(re);
    if (m) { scene = s; why = `the title says “${m[0].toLowerCase()}”`; break; }
  }
  if (!scene) { scene = { night: "forest", dusk: "sea", day: "sea", golden: "hill" }[time]; why = `it sounds ${moodWord}`; }
  return { key, bpm, density, pace, avgVel, scene, time, why, moodWord };
}
