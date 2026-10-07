"use strict";
/* Keylight app: one clock for sound and picture, the controls, recording and saving. */
const $ = id => document.getElementById(id);
const app = $("app"), cv2d = $("cv2d"), ctx2d = cv2d.getContext("2d");
const R = Classic.R;

const TIME_UI = {
  day: { ink: "#0c1a2c", panel: "rgba(14,26,44,0.72)", fg: "#f4f8ff", muted: "rgba(230,238,255,0.62)", line: "rgba(200,220,255,0.16)", accent: "#9fd0ff" },
  golden: { ink: "#1c140c", panel: "rgba(40,28,16,0.72)", fg: "#fff6e8", muted: "rgba(255,240,220,0.62)", line: "rgba(255,225,180,0.18)", accent: "#ffcf7a" },
  dusk: { ink: "#151228", panel: "rgba(32,26,56,0.74)", fg: "#fff0f2", muted: "rgba(255,225,232,0.62)", line: "rgba(255,200,215,0.16)", accent: "#ffb08a" },
  night: { ink: "#04071a", panel: "rgba(10,16,40,0.76)", fg: "#e9eeff", muted: "rgba(205,215,255,0.6)", line: "rgba(160,180,255,0.16)", accent: "#cfe0ff" }
};

/* ---------- player: one clock for sound and picture ---------- */
const LEAD = 1.8;
const player = {
  song: null, analysis: null, playing: false, speed: 1, anchorSong: -LEAD, anchorCtx: 0, idx: 0,
  raw() { return this.playing ? this.anchorSong + (synth.ctx.currentTime - this.anchorCtx) * this.speed : this.anchorSong; },
  time() {
    if (!this.playing) return this.anchorSong;
    const c = synth.ctx, lat = (c.outputLatency || 0) + (c.baseLatency || 0);
    return Math.max(this.anchorSong, this.raw() - lat * this.speed);
  },
  load(song) {
    this.pause(); this.song = song; this.anchorSong = -LEAD;
    this.analysis = analyzeSong(song);
    R.layout(song, $("range").value); R.keys = []; R.hitIdx = 0; R.resetFx();
    Ghibli.setSong(song, this.analysis);
    applyStyle();
  },
  async play() {
    if (!this.song || this.playing || this.starting) return;
    this.starting = true;
    const c = synth.ensure();
    if (!synth.samples && window.KEYLIGHT_PIANO) {
      ui.toast("Loading the piano…", 0);
      await synth.ready;
      $("toast").hidden = true;
    }
    this.starting = false;
    if (this.anchorSong >= this.song.duration) this.anchorSong = -LEAD;
    this.anchorCtx = c.currentTime + 0.06;
    this.idx = lowerBound(this.song.notes, this.anchorSong);
    this.playing = true; this.tick();
    clearInterval(this.timer); this.timer = setInterval(() => this.tick(), 25);
    ui.sync();
  },
  pause() {
    if (!this.playing) return;
    this.anchorSong = this.raw(); this.playing = false;
    clearInterval(this.timer); synth.stopAll(); ui.sync();
  },
  seek(t) {
    const was = this.playing; this.pause();
    this.anchorSong = clamp(t, -LEAD, this.song.duration);
    R.hitIdx = lowerBound(this.song.notes, this.anchorSong); R.resetFx();
    Ghibli.reset();
    if (was) this.play(); else ui.sync();
  },
  setSpeed(v) { if (this.playing) { this.anchorSong = this.raw(); this.anchorCtx = synth.ctx.currentTime; } this.speed = v; },
  tick() {
    const ns = this.song.notes, now = this.raw(), horizon = now + 0.18 * this.speed;
    while (this.idx < ns.length && ns[this.idx].start < horizon) {
      const n = ns[this.idx++];
      if (n.start < now - 0.04) continue;
      const when = this.anchorCtx + (n.start - this.anchorSong) / this.speed;
      synth.play(n.pitch, n.vel, when, when + (n.aEnd - n.start) / this.speed);
    }
  }
};

/* ---------- style: a painted scene (auto or chosen) or a classic 2D theme ---------- */
const prefs = { style: "auto", time: "auto" };
try { Object.assign(prefs, JSON.parse(localStorage.getItem("keylight.scene") || "{}")); } catch (e) {}
const isStory = () => !prefs.style.startsWith("classic:");
const currentScene = () => prefs.style === "auto" ? (player.analysis ? player.analysis.scene : "hill") : prefs.style;
const currentTime = () => prefs.time === "auto" ? (player.analysis ? player.analysis.time : "golden") : prefs.time;
function setUiColors(u) {
  const rs = document.documentElement.style;
  for (const k of ["ink", "panel", "fg", "muted", "line", "accent"]) rs.setProperty("--" + k, u[k]);
}
function applyStyle() {
  if (!Ghibli.SCENES[prefs.style] && prefs.style !== "auto" && !prefs.style.startsWith("classic:")) prefs.style = "auto";
  if (!Ghibli.TIMES[prefs.time]) prefs.time = "auto";
  const story = isStory();
  document.querySelectorAll("#scenes button").forEach(b => b.setAttribute("aria-pressed", String(story && b.dataset.s === prefs.style)));
  $("classic").value = story ? "" : prefs.style.slice(8);
  $("time").value = prefs.time;
  $("time").hidden = !story;
  if (story) {
    Ghibli.setScene(currentScene()); Ghibli.setTime(currentTime());
    setUiColors(TIME_UI[currentTime()]);
  } else {
    const th = Classic.THEMES[prefs.style.slice(8)] || Classic.THEMES.aurora;
    R.theme = th; R.keys = []; R.resetFx(); setUiColors(th.ui);
  }
  const a = player.analysis;
  if (a) $("songWhy").textContent = `${a.key} · ♩ ${a.bpm}` + (story ? ` · ${Ghibli.SCENES[currentScene()].label}, ${Ghibli.TIMES[currentTime()].label.toLowerCase()}` + (prefs.style === "auto" ? `, because ${a.why}` : "") : "");
  resize();
  try { localStorage.setItem("keylight.scene", JSON.stringify(prefs)); } catch (e) {}
}
function setStyle(s) { prefs.style = s; applyStyle(); }

[["auto", "Auto"], ...Object.entries(Ghibli.SCENES).map(([k, v]) => [k, v.label])].forEach(([k, label], i) => {
  const b = document.createElement("button");
  b.type = "button"; b.dataset.s = k; b.textContent = label;
  b.title = k === "auto" ? "Pick a scene that suits the song (A)" : `${label} (${i})`;
  b.onclick = () => setStyle(k);
  $("scenes").appendChild(b);
});
$("classic").onchange = e => { if (e.target.value) setStyle("classic:" + e.target.value); };
$("time").onchange = e => { prefs.time = e.target.value; applyStyle(); };

/* ---------- canvas sizing ---------- */
const RES = { "9:16": [1080, 1920], "16:9": [1920, 1080], "1:1": [1440, 1440] };
function resize() {
  const mode = $("aspect").value, st = $("stage").getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  app.classList.toggle("fill", mode === "fill");
  let cssW, cssH, fullW, fullH;
  if (mode === "fill") { cssW = st.width; cssH = st.height; fullW = Math.round(cssW * dpr); fullH = Math.round(cssH * dpr); }
  else {
    [fullW, fullH] = RES[mode];
    const k = Math.min((st.width - (app.classList.contains("clean") ? 0 : 32)) / fullW, (st.height - (app.classList.contains("clean") ? 0 : 16)) / fullH);
    cssW = Math.floor(fullW * k); cssH = Math.floor(fullH * k);
  }
  cv2d.style.width = cssW + "px"; cv2d.style.height = cssH + "px";
  // the painted scenes render at screen resolution while previewing, full frame size while recording
  let w = fullW, h = fullH;
  if (isStory() && !recorder.active && mode !== "fill") { w = Math.min(fullW, Math.round(cssW * Math.min(dpr, 1.5))); h = Math.round(w * fullH / fullW); }
  if (cv2d.width !== w || cv2d.height !== h) { cv2d.width = w; cv2d.height = h; R.keys = []; }
}
window.addEventListener("resize", resize);

/* ---------- UI ---------- */
const ui = {
  sync() {
    const playing = player.playing;
    $("playIcon").setAttribute("d", playing ? "M6 4h4v16H6zM14 4h4v16h-4z" : "M6 4l15 8-15 8z");
    $("play").setAttribute("aria-label", playing ? "Pause" : "Play");
    $("bigPlay").hidden = playing || recorder.active;
  },
  toast(html, ms = 3500) {
    const t = $("toast"); t.innerHTML = html; t.hidden = false;
    clearTimeout(this.tt); if (ms) this.tt = setTimeout(() => t.hidden = true, ms);
  }
};

function loadSong(parsed, fallbackName) {
  if (!parsed.notes.length) { ui.toast("That file has no notes to play. Try another MIDI file."); return; }
  const t0 = parsed.notes[0].start;
  for (const n of parsed.notes) { n.start -= t0; n.end -= t0; n.aEnd -= t0; }
  let end = 0; for (const n of parsed.notes) end = Math.max(end, n.end);
  const title = (fallbackName || parsed.name || "Untitled").replace(/\.(mid|midi)$/i, "").replace(/[_]+/g, " ").replace(/\s+-\s+/g, " – ").trim();
  // a few seconds after the last note for the closing shot
  player.load({ notes: parsed.notes, bpm: parsed.bpm, title, duration: end + 7 });
  $("songName").textContent = title; $("tDur").textContent = fmt(player.song.duration);
  ui.sync();
}
async function openFile(file) {
  if (!file) return;
  try { loadSong(parseMidi(await file.arrayBuffer()), file.name); }
  catch (e) { ui.toast("That file couldn't be read as MIDI. Pick a .mid or .midi file."); }
}
$("file").addEventListener("change", e => { openFile(e.target.files[0]); e.target.value = ""; });
$("demo").onclick = () => loadSong(makeDemo(), "Late Light");
const toggle = () => player.playing ? player.pause() : player.play();
$("play").onclick = toggle; $("bigPlay").onclick = toggle;
$("aspect").onchange = () => { resize(); try { localStorage.setItem("keylight.aspect", $("aspect").value); } catch (e) {} };
$("range").onchange = () => { R.layout(player.song, $("range").value); R.keys = []; Ghibli.setRange($("range").value); };
$("speed").oninput = e => player.setSpeed(+e.target.value);
$("fall").oninput = e => { R.lookahead = +e.target.value; Ghibli.setFall(+e.target.value); };
$("fs").onclick = () => { const el = document.documentElement; try { const p = document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen && el.requestFullscreen(); p && p.catch && p.catch(() => {}); } catch (e) {} };
let scrubbing = false;
$("scrub").addEventListener("input", e => { scrubbing = true; if (player.song) player.seek(-LEAD + (+e.target.value / 1000) * (player.song.duration + LEAD)); });
$("scrub").addEventListener("change", () => scrubbing = false);

let dragDepth = 0;
window.addEventListener("dragenter", e => { e.preventDefault(); dragDepth++; $("drop").hidden = false; });
window.addEventListener("dragleave", () => { if (--dragDepth <= 0) { dragDepth = 0; $("drop").hidden = true; } });
window.addEventListener("dragover", e => e.preventDefault());
window.addEventListener("drop", e => { e.preventDefault(); dragDepth = 0; $("drop").hidden = true; openFile(e.dataTransfer.files[0]); });

window.addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT" && e.target.type !== "range") return;
  if (e.target.tagName === "SELECT") return;
  const order = Object.keys(Ghibli.SCENES);
  if (e.code === "Space") { e.preventDefault(); toggle(); }
  else if (e.key === "ArrowRight" && player.song) player.seek(player.time() + 5);
  else if (e.key === "ArrowLeft" && player.song) player.seek(player.time() - 5);
  else if (/^[1-3]$/.test(e.key)) setStyle(order[+e.key - 1]);
  else if (e.key === "a" || e.key === "A") setStyle("auto");
  else if (e.key === "f" || e.key === "F") $("fs").click();
  else if (e.key === "h" || e.key === "H") { app.classList.toggle("clean"); resize(); }
  else if (e.key === "Escape" && app.classList.contains("clean")) { app.classList.remove("clean"); resize(); }
});
let idleTimer;
function wake() { app.classList.remove("idle"); clearTimeout(idleTimer); idleTimer = setTimeout(() => { if (player.playing) app.classList.add("idle"); }, 2600); }
["mousemove", "pointerdown", "keydown", "touchstart"].forEach(ev => window.addEventListener(ev, wake, { passive: true }));

/* ---------- saving files (artifact viewer's save prompt, or a normal download) ---------- */
async function saveFile(blob, name) {
  const dl = window.claude && window.claude.use ? await window.claude.use("downloads").catch(() => null) : null;
  if (dl) {
    try { await dl.save({ filename: name, data: blob }); ui.toast(`Saved ${name.replace(/</g, "")}.`); }
    catch (e) { ui.toast(e && e.code === "declined" ? "Not saved." : "This view can't save files. Open index.html locally instead."); }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  ui.toast(`Saved <b>${name.replace(/</g, "")}</b>. If the download didn't start, <a href="${url}" download="${name.replace(/"/g, "")}">save it here</a>.`, 0);
}
const safeName = () => (player.song.title || "keylight").replace(/[^\w\- ]+/g, "").trim() || "keylight";
const styleLabel = () => isStory() ? `${Ghibli.SCENES[currentScene()].label} ${Ghibli.TIMES[currentTime()].label}` : Classic.THEMES[prefs.style.slice(8)].label;

$("poster").onclick = () => { if (player.song) cv2d.toBlob(b => b && saveFile(b, `${safeName()} - ${styleLabel()}.png`), "image/png"); };

/* ---------- video recording (canvas + piano audio) ---------- */
const recorder = {
  active: false,
  start() {
    if (!player.song) return;
    const canvas = cv2d;
    if (!window.MediaRecorder || !canvas.captureStream) { ui.toast("This browser can't record video. Try Chrome, Edge or Safari."); return; }
    synth.ensure();
    const types = ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    const type = types.find(t => MediaRecorder.isTypeSupported(t)) || "";
    this.active = true; app.classList.add("recording"); $("recBadge").hidden = false;
    resize();
    const stream = new MediaStream([...canvas.captureStream(60).getVideoTracks(), ...synth.recStream().getAudioTracks()]);
    let mr;
    try { mr = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 16e6, audioBitsPerSecond: 192e3 }); }
    catch (e) { this.active = false; app.classList.remove("recording"); $("recBadge").hidden = true; resize(); ui.toast("Recording couldn't start in this browser."); return; }
    this.chunks = []; this.mr = mr; this.type = type || "video/webm"; this.t0 = performance.now();
    mr.ondataavailable = e => e.data.size && this.chunks.push(e.data);
    mr.onstop = () => this.finish();
    player.seek(-LEAD); R.resetFx();
    mr.start(250); player.play(); ui.sync();
  },
  stop() { if (!this.active) return; this.active = false; player.pause(); try { this.mr.stop(); } catch (e) {} },
  finish() {
    app.classList.remove("recording"); $("recBadge").hidden = true; resize();
    const ext = this.type.includes("mp4") ? "mp4" : "webm";
    saveFile(new Blob(this.chunks, { type: this.type }), `${safeName()} - ${styleLabel()}.${ext}`);
    ui.sync();
  }
};
$("rec").onclick = () => recorder.start();
$("recStop").onclick = () => recorder.stop();

/* ---------- main loop ---------- */
let last = performance.now(), painting = false;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const song = player.song;
  let t = player.time();
  if (player.playing && song && t >= song.duration) { if (recorder.active) recorder.stop(); else player.pause(); player.anchorSong = song.duration; t = song.duration; ui.sync(); }
  const sdt = player.playing ? dt * player.speed : dt * 0.5;
  if (isStory()) {
    // repainting a scene takes a moment: say so, then paint on the next frame
    if (Ghibli.isDirty() && !painting) { painting = true; ui.toast("Painting the scene…", 0); requestAnimationFrame(loop); return; }
    Ghibli.frame(ctx2d, cv2d.width, cv2d.height, t, sdt, now / 1000);
    if (painting) { painting = false; $("toast").hidden = true; }
  } else R.frame(song, t, sdt, now / 1000);
  if (song) {
    $("tCur").textContent = fmt(t);
    if (!scrubbing) $("scrub").value = Math.round(((t + LEAD) / (song.duration + LEAD)) * 1000);
    if (recorder.active) $("recTime").textContent = "REC " + fmt((now - recorder.t0) / 1000);
  }
  requestAnimationFrame(loop);
}

(function boot() {
  let aspect = "9:16";
  try { aspect = localStorage.getItem("keylight.aspect") || aspect; } catch (e) {}
  if ([...$("aspect").options].some(o => o.value === aspect)) $("aspect").value = aspect;
  loadSong(makeDemo(), "Late Light");
  requestAnimationFrame(loop);
  (document.fonts && document.fonts.ready || Promise.resolve()).then(() => { R.keys = []; });
})();
