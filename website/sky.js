/*
  LESSON 11–12, simplified in LESSON 15: Your sky
  ----------------------------------------------
  Every topic is a star. Its brightness comes from what the student has
  actually done (read notes and blurt scores, saved by progress.js and
  blurt.js in localStorage). There are just three stages, so the key is
  easy to learn at a glance:

    0 Faint     not started yet
    1 Shining   started: at least one note read or one blurt done
    2 Blazing   every subtopic's best blurt is 80% or more

  Topics without notes yet are "forming" (a dotted ring).
  Lit stars in the same subject join up into a constellation.

  LESSON 15 also adds life to the sky: a soft Milky Way, background stars
  in three layers that drift as the mouse moves (parallax), and the odd
  shooting star.

  NEW: students can set a star brighter themselves (e.g. a topic they
  already know from class). They must confirm first, self-set stars get
  a dashed ring, and once their tracked progress catches up, the self-set
  value is dropped automatically.

  The page gives us the course in window.SKY.
*/

(function () {
  const DATA = window.SKY;
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.getElementById("sky");
  const frame = document.getElementById("sky-frame");
  const panel = document.getElementById("star-panel");
  const stats = document.getElementById("sky-stats");
  const nextBox = document.getElementById("next-step");
  const toast = document.getElementById("sky-toast");
  const exampleSwitch = document.getElementById("example");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const STAGES = ["Faint", "Shining", "Blazing"];
  const TOP = STAGES.length - 1;       // the brightest stage (2)
  const HINTS = [
    "Read a note or try a blurt to make it shine.",
    "Get 80% or more in every subtopic's blurt to make it blaze.",
    "This star is blazing. Blurt it again now and then to keep it that way.",
  ];
  // Can the page move things about? Not if the student asked for less motion.
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  // Where each star sits (wide screens). On narrow screens we swap x and y,
  // which stacks the three subjects on top of each other.
  const POS = {
    B1: [90, 120], B2: [170, 80], B3: [250, 130], B4: [210, 210], B5: [120, 250], B6: [190, 320], B7: [280, 290],
    C1: [360, 90], C2: [440, 60], C3: [520, 100], C4: [580, 170], C5: [500, 220], C6: [420, 200], C7: [370, 280],
    C8: [450, 330], C9: [540, 300], C10: [590, 360],
    P1: [660, 110], P2: [740, 70], P3: [820, 120], P4: [790, 210], P5: [700, 230], P6: [650, 310], P7: [740, 340], P8: [840, 300],
  };
  const SUBJECT_NAMES = { biology: "Biology", chemistry: "Chemistry", physics: "Physics" };

  let tall = false;          // narrow-screen layout?
  let example = false;       // showing the example sky?
  let selected = null;       // the topic code whose panel is open

  // ---------- Saving and loading (always inside try/catch) ----------
  function load(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  // Stars the student has set themselves: { "B3": 3, ... }
  let manual = {};
  try { manual = JSON.parse(load("sky:manual")) || {}; } catch (e) { manual = {}; }
  function saveManual() { save("sky:manual", JSON.stringify(manual)); }

  // Before Lesson 15 there were five stages (0–4). Saved values from then
  // are converted once to the new three: 1, 2 and 3 become Shining, 4 Blazing.
  if (load("sky:v") !== "3") {
    const OLD_TO_NEW = [0, 1, 1, 1, 2];
    ["sky:manual", "sky:seen"].forEach(function (key) {
      let obj = {};
      try { obj = JSON.parse(load(key)) || {}; } catch (e) {}
      for (const code in obj) obj[code] = OLD_TO_NEW[obj[code]] === undefined ? TOP : OLD_TO_NEW[obj[code]];
      save(key, JSON.stringify(obj));
    });
    try { manual = JSON.parse(load("sky:manual")) || {}; } catch (e) { manual = {}; }
    save("sky:v", "3");
  }

  // ---------- Progress ----------
  // What the site has actually tracked for one topic
  function trackedOf(topic) {
    if (topic.subtopics.length === 0) return { forming: true, stage: 0, subs: [] };
    let read = 0, blurted = 0, secure = 0;
    const subs = topic.subtopics.map(function (s) {
      const r = s.notes.filter(function (n) { return load("read:" + n.id) === "1"; }).length;
      const bestRaw = load("best:" + s.blurt.id);
      const best = bestRaw === null ? null : Number(bestRaw);
      read += r;
      if (best !== null) blurted++;
      if (best !== null && best >= 80) secure++;
      const nextNote = s.notes.find(function (n) { return load("read:" + n.id) !== "1"; });
      return { s: s, read: r, total: s.notes.length, best: best, nextNote: nextNote };
    });
    const n = topic.subtopics.length;
    const stage = secure === n ? 2 : read > 0 || blurted > 0 ? 1 : 0;
    return { forming: false, stage: stage, subs: subs, secure: secure };
  }

  // What the sky shows: tracked progress, unless the student set it higher
  function progressOf(topic) {
    if (example) return exampleProgress(topic);
    const p = trackedOf(topic);
    p.tracked = p.stage;
    const m = manual[topic.code];
    if (m !== undefined) {
      if (p.stage >= m) {
        // Real progress has caught up, so the self-set value isn't needed any more
        delete manual[topic.code];
        saveManual();
      } else {
        p.stage = m;
        p.manual = true;
      }
    }
    return p;
  }

  // A made-up sky, to show what a term of revision could look like
  const EXAMPLE = { B1: 2, B2: 1, B3: 1, B4: 1, B5: 1, C1: 2, C2: 1, C3: 1, C4: 1, P1: 2, P2: 1, P3: 1, P5: 1 };
  function exampleProgress(topic) {
    const stage = EXAMPLE[topic.code] || 0;
    const bests = [[null, null, null], [81, 64, null], [92, 85, 88]][stage];
    const subs = bests.map(function (b, i) {
      return { s: { label: "Subtopic " + (i + 1) }, read: stage === 2 || i < 2 ? 1 : 0, total: 1, best: b };
    });
    return { forming: false, stage: stage, subs: stage === 0 ? [] : subs, example: true };
  }

  // What should the student do next? Go subtopic by subtopic,
  // skipping stars they've told us they already know.
  function nextStep() {
    for (const topic of DATA.topics) {
      if (topic.subtopics.length === 0) continue;
      const p = progressOf(topic);
      if (p.manual) continue;
      for (const sp of p.subs) {
        if (sp.nextNote) return { topic: topic, text: "Read " + sp.nextNote.title, url: sp.nextNote.url, button: "Read it" };
        if (sp.best === null) return { topic: topic, text: "Blurt " + sp.s.label, url: sp.s.blurt.url, button: "Blurt it" };
      }
      for (const sp of p.subs) {
        if (sp.best < 80) return { topic: topic, text: "Blurt " + sp.s.label + " again (best so far: " + sp.best + "%)", url: sp.s.blurt.url, button: "Blurt it" };
      }
    }
    return null;
  }

  // ---------- Drawing ----------
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    (parent || svg).append(e);
    return e;
  }
  function pos(code) {
    const p = POS[code];
    return tall ? [p[1], p[0]] : p;
  }
  // Red / amber / green for a best blurt score (used by the dots in the panel)
  function scoreColour(best) {
    if (best === null || best === undefined) return "var(--moon-none)";
    if (best >= 80) return "var(--moon-good)";
    if (best >= 50) return "var(--moon-warn)";
    return "var(--moon-bad)";
  }

  // ---------- The backdrop: Milky Way + three layers of background stars ----------
  // Each layer moves a different amount with the mouse. Far things move a
  // little, near things move more, and your brain reads that as depth.
  // The topic stars never move, so they're always where you tap.
  const DEPTH = { far: 4, mid: 9, near: 16 };     // how far each layer can drift
  let layers = {};
  let drift = [0, 0];                            // where the mouse is, from -0.5 to 0.5

  function drawBackdrop(W, H) {
    // Soft blur for the Milky Way, defined once per drawing
    const defs = el("defs", {});
    const blur = el("filter", { id: "nebula-blur", x: "-50%", y: "-50%", width: "200%", height: "200%" }, defs);
    el("feGaussianBlur", { stdDeviation: 28 }, blur);
    const shoot = el("linearGradient", { id: "shoot-tail", x1: "0", x2: "1", y1: "0", y2: "0" }, defs);
    el("stop", { offset: "0", "stop-color": "#ffffff", "stop-opacity": "0" }, shoot);
    el("stop", { offset: "1", "stop-color": "#ffffff", "stop-opacity": "0.9" }, shoot);

    let seed = 11;
    const rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    layers = {};
    ["far", "mid", "near"].forEach(function (name) { layers[name] = el("g", { class: "layer " + name }); });

    // The Milky Way: a few big blurred blobs along a diagonal band
    const band = el("g", { class: "nebula", filter: "url(#nebula-blur)" }, layers.far);
    const blobs = [[0.08, 0.85, "#6d5bd0"], [0.28, 0.62, "#3b6fd8"], [0.5, 0.45, "#8b5cf6"], [0.72, 0.3, "#2f7fb8"], [0.93, 0.12, "#6d5bd0"]];
    blobs.forEach(function (b) {
      const x = tall ? b[1] * W : b[0] * W, y = tall ? b[0] * H : b[1] * H;
      el("ellipse", { cx: x.toFixed(0), cy: y.toFixed(0), rx: (tall ? 110 : 150), ry: (tall ? 150 : 70), fill: b[2] }, band);
    });

    // Background stars, in the same places every time. They reach a little
    // past the edges so drifting never shows a gap.
    const counts = { far: 110, mid: 45, near: 14 };
    const sizes = { far: [0.3, 0.7], mid: [0.6, 1.1], near: [1, 1.6] };
    ["far", "mid", "near"].forEach(function (name) {
      for (let i = 0; i < counts[name]; i++) {
        const r = sizes[name][0] + rnd() * (sizes[name][1] - sizes[name][0]);
        const x = rnd() * (W + 40) - 20, y = rnd() * (H + 40) - 20;
        const s = el("circle", { class: "bg", cx: x.toFixed(1), cy: y.toFixed(1), r: r.toFixed(2) }, layers[name]);
        s.style.setProperty("--dur", (2 + rnd() * 4).toFixed(2) + "s");
        s.style.setProperty("--delay", (-rnd() * 5).toFixed(2) + "s");
        // A few near stars get a little four-point glint
        if (name === "near" && i % 3 === 0) {
          const g = el("path", { class: "glint", d: "M" + x.toFixed(1) + " " + (y - 5).toFixed(1) + " v10 M" + (x - 5).toFixed(1) + " " + y.toFixed(1) + " h10" }, layers[name]);
          g.style.setProperty("--dur", (3 + rnd() * 3).toFixed(2) + "s");
        }
      }
    });

    layers.shooting = el("g", { class: "shooting-layer" });
    applyDrift();
  }

  function applyDrift() {
    for (const name in DEPTH) {
      if (!layers[name]) continue;
      layers[name].style.transform = "translate(" + (drift[0] * DEPTH[name]).toFixed(1) + "px, " + (drift[1] * DEPTH[name]).toFixed(1) + "px)";
    }
  }

  // Follow the mouse (only with a real mouse, and only if motion is welcome)
  if (finePointer && !reduceMotion) {
    let queued = false;
    window.addEventListener("pointermove", function (e) {
      drift = [e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5];
      // requestAnimationFrame: update at most once per screen refresh
      if (!queued) { queued = true; requestAnimationFrame(function () { queued = false; applyDrift(); }); }
    });
  }

  // ---------- Shooting stars ----------
  // A streak with a fading tail: a gradient line plus a bright head,
  // moved across the sky with the Web Animations API (element.animate).
  function shootingStar(big) {
    if (reduceMotion || !layers.shooting) return;
    const vb = svg.viewBox.baseVal, W = vb.width, H = vb.height;
    const angle = 20 + Math.random() * 25;                 // degrees below horizontal
    const len = big ? 140 : 70 + Math.random() * 50;
    const x0 = W * (0.05 + Math.random() * 0.6), y0 = H * (Math.random() * 0.35);
    const dist = big ? 360 : 180 + Math.random() * 160;
    const rad = angle * Math.PI / 180;
    const g = el("g", { class: "shooting-star" }, layers.shooting);
    el("line", { x1: -len, y1: 0, x2: 0, y2: 0, stroke: "url(#shoot-tail)", "stroke-width": big ? 2.4 : 1.6, "stroke-linecap": "round" }, g);
    el("circle", { cx: 0, cy: 0, r: big ? 2.4 : 1.6, fill: "#ffffff" }, g);
    const at = function (d) { return "translate(" + (x0 + Math.cos(rad) * d).toFixed(1) + "px, " + (y0 + Math.sin(rad) * d).toFixed(1) + "px) rotate(" + angle + "deg)"; };
    const run = g.animate(
      [{ transform: at(0), opacity: 0 }, { opacity: 1, offset: 0.15 }, { transform: at(dist), opacity: 0 }],
      { duration: big ? 1400 : 900 + Math.random() * 500, easing: "cubic-bezier(.3,.1,.6,1)" });
    run.onfinish = function () { g.remove(); };
  }

  // Every 6–16 seconds, one streaks past. Rare enough to feel like a treat.
  function scheduleShootingStars() {
    if (reduceMotion) return;
    setTimeout(function () {
      if (!document.hidden) shootingStar(false);
      scheduleShootingStars();
    }, 6000 + Math.random() * 10000);
  }

  function draw() {
    tall = frame.clientWidth < 620;
    const W = tall ? 420 : 900, H = tall ? 880 : 420;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    while (svg.firstChild) svg.firstChild.remove();

    drawBackdrop(W, H);

    // Subject names
    const labels = tall
      ? [["biology", 20, 50], ["chemistry", 20, 330], ["physics", 20, 620]]
      : [["biology", 185, 402], ["chemistry", 470, 405], ["physics", 750, 402]];
    labels.forEach(function (l) {
      const t = el("text", { class: "cluster" + (tall ? " left" : ""), x: l[1], y: l[2] });
      t.style.setProperty("--c", "var(--sky-" + l[0] + ")");
      t.textContent = SUBJECT_NAMES[l[0]];
    });

    const progress = {};
    DATA.topics.forEach(function (t) { progress[t.code] = progressOf(t); });

    // Constellation lines: join lit stars in each subject, in topic order
    const lines = el("g", {});
    ["biology", "chemistry", "physics"].forEach(function (subject) {
      const lit = DATA.topics.filter(function (t) { return t.subject === subject && progress[t.code].stage >= 1; });
      for (let i = 1; i < lit.length; i++) {
        const a = pos(lit[i - 1].code), b = pos(lit[i].code);
        const line = el("line", { class: "link", x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, lines);
        line.style.setProperty("--c", "var(--sky-" + subject + ")");
      }
    });

    const next = example ? null : nextStep();

    // The stars themselves
    DATA.topics.forEach(function (topic) {
      const p = progress[topic.code];
      const formingLook = p.forming && !p.manual;      // a dotted "still forming" star
      const xy = pos(topic.code), x = xy[0], y = xy[1];
      const g = el("g", { class: "star stage-" + p.stage + (formingLook ? " forming" : "") + (p.manual ? " self-set" : ""), tabindex: "0", role: "button" });
      g.style.setProperty("--c", "var(--sky-" + topic.subject + ")");
      g.setAttribute("aria-label", topic.code + " " + topic.name + ": " +
        (formingLook ? "notes coming soon" : STAGES[p.stage] + (p.manual ? ", set by you" : "")));
      if (selected === topic.code) g.classList.add("selected");

      // An invisible, fingertip-sized circle, so even tiny stars are easy to tap
      el("circle", { class: "hit", cx: x, cy: y, r: 22 }, g);
      if (next && next.topic.code === topic.code) el("circle", { class: "pulse", cx: x, cy: y, r: 16 }, g);
      el("circle", { class: "halo", cx: x, cy: y, r: [0, 15, 24][p.stage] }, g);
      if (formingLook) el("circle", { class: "ring", cx: x, cy: y, r: 7 }, g);
      if (p.manual) el("circle", { class: "self-ring", cx: x, cy: y, r: [9, 19, 28][p.stage] }, g);
      el("circle", { class: "core", cx: x, cy: y, r: formingLook ? 2 : [2.5, 4.5, 7][p.stage] }, g);
      if (p.stage === TOP) {
        el("path", { class: "sparkle", d: "M" + x + " " + (y - 18) + " V" + (y + 18) + " M" + (x - 18) + " " + y + " H" + (x + 18) }, g);
      }

      el("text", { class: "code", x: x + [10, 14, 20][p.stage], y: y - [8, 10, 14][p.stage] }, g).textContent = topic.code;

      function open() { selected = topic.code; showPanel(topic); draw(); focusStar(topic.code); }
      g.addEventListener("click", open);
      g.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      });
      g.dataset.code = topic.code;
    });

    // The little stars next to each topic in "All 25 stars" match the sky
    document.querySelectorAll("[data-star]").forEach(function (mini) {
      const p = progress[mini.dataset.star];
      if (!p) return;
      const formingLook = p.forming && !p.manual;
      mini.className = "mini-star stage-" + p.stage + (formingLook ? " forming" : "") + (p.manual ? " self-set" : "");
      mini.title = formingLook ? "Still forming" : STAGES[p.stage] + (p.manual ? " (set by you)" : "");
    });

    // Numbers at the top
    const lit = DATA.topics.filter(function (t) { return progress[t.code].stage >= 1; }).length;
    const blazing = DATA.topics.filter(function (t) { return progress[t.code].stage === TOP; }).length;
    const mine = DATA.topics.filter(function (t) { return progress[t.code].manual; }).length;
    stats.textContent = lit + " of " + DATA.topics.length + " stars lit · " + blazing + " blazing" +
      (mine ? " · " + mine + " set by you" : "");

    // "Your next star"
    nextBox.innerHTML = "";
    if (next) {
      const text = document.createElement("div");
      const label = document.createElement("span");
      label.className = "next-label";
      label.textContent = "Your next star: " + next.topic.code + " " + next.topic.name;
      const what = document.createElement("b");
      what.textContent = next.text;
      text.append(label, what);
      const a = document.createElement("a");
      a.className = "button";
      a.href = next.url;
      a.textContent = next.button;
      nextBox.append(text, a);
      nextBox.hidden = false;
    } else {
      nextBox.hidden = true;
    }
  }

  function focusStar(code) {
    const g = svg.querySelector('[data-code="' + code + '"]');
    if (g) g.focus({ preventScroll: true });
  }

  // ---------- Small helpers for building the panel ----------
  function make(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function btn(text, className, onClick) {
    const b = make("button", className, text);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }
  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () { toast.hidden = true; }, 5000);
  }

  // An "Are you sure?" box inside the panel (confirm() doesn't work in the preview)
  // danger = true makes it red, for things that take progress away.
  function askFirst(where, question, yesText, onYes, danger, onCancel) {
    where.innerHTML = "";
    const box = make("div", "confirm-box" + (danger ? " danger" : ""));
    box.setAttribute("role", "alertdialog");
    if (danger) box.append(make("b", "confirm-title", "Are you sure?"));
    box.append(make("p", "", question));
    const row = make("div", "confirm-row");
    const cancel = btn("Cancel", "button ghost", function () { where.innerHTML = ""; if (onCancel) onCancel(); });
    row.append(btn(yesText, "button" + (danger ? " danger" : ""), onYes), cancel);
    box.append(row);
    where.append(box);
    cancel.focus();
  }

  // ---------- The panel for one star ----------
  function showPanel(topic) {
    const p = progressOf(topic);
    const formingLook = p.forming && !p.manual;
    panel.innerHTML = "";
    panel.style.setProperty("--accent", "var(--sky-" + topic.subject + ")");

    const head = make("div", "panel-head");
    head.append(make("span", "code", topic.code), make("h2", "", topic.name),
      make("p", "panel-sub", SUBJECT_NAMES[topic.subject] + (topic.triple ? " · Triple only" : "")));
    panel.append(head);

    if (!formingLook) {
      // Brightness meter: one dot per stage
      const meter = make("div", "meter");
      for (let i = 0; i < STAGES.length; i++) meter.append(make("span", i <= p.stage ? "on" : ""));
      meter.append(make("b", "", STAGES[p.stage] + (p.manual ? " (set by you)" : "")));
      panel.append(meter);
    }

    if (p.example) {
      panel.append(make("p", "panel-note", "This is the example sky, not your real progress."));
    } else if (p.manual) {
      panel.append(make("p", "panel-note", "You set this star to " + STAGES[p.stage] + ". Your tracked progress is " +
        STAGES[p.tracked] + ". When your tracked progress catches up, it takes over."));
    } else if (formingLook) {
      panel.append(make("p", "panel-note", "This star is still forming: notes for " + topic.name +
        " are on the way. If you already know it from class, you can light it up yourself."));
    } else {
      let hint = HINTS[p.stage];
      if (p.stage === 1) hint += " So far: " + p.secure + " of " + p.subs.length + " at 80% or more.";
      panel.append(make("p", "panel-note", hint));
    }

    if (p.forming && p.manual) {
      panel.append(make("p", "panel-note", "Notes for this topic are on the way."));
    }

    // One row per subtopic
    if (p.subs.length) {
      const list = make("ul", "sub-rows");
      p.subs.forEach(function (sp) {
        const li = make("li");
        const top = make("div", "sub-top");
        const dot = make("span", "moon-dot");
        dot.style.background = scoreColour(sp.best);
        top.append(dot, make("b", "", sp.s.label));
        li.append(top, make("p", "sub-facts", "Notes " + sp.read + " / " + sp.total + " · " +
          (sp.best === null ? "not blurted yet" : "best blurt " + sp.best + "%")));
        if (!p.example) {
          const links = make("div", "sub-links");
          [["Notes", (sp.nextNote || sp.s.notes[0]).url], ["Blurt", sp.s.blurt.url], ["Quick check", sp.s.quick.url]].forEach(function (l) {
            const a = make("a", "", l[0]);
            a.href = l[1];
            links.append(a);
          });
          li.append(links);
        }
        list.append(li);
      });
      panel.append(list);
    }

    if (!p.example) panel.append(selfSetControls(topic, p));
  }

  // "Set this star myself" and "Go back to my tracked progress"
  function selfSetControls(topic, p) {
    const wrap = make("div", "self-set");
    const confirmArea = make("div");

    if (p.manual) {
      // A red button with an "undo" arrow: it takes brightness away, so it looks different
      const undo = btn("", "button undo-star", function () {
        undo.hidden = true;
        askFirst(confirmArea,
          "This removes the brightness you set for " + topic.code + " " + topic.name + ". The star goes back to " +
          STAGES[p.tracked] + ", which is your tracked progress. Your notes and blurt scores won't change.",
          "Yes, remove it",
          function () {
            delete manual[topic.code];
            saveManual();
            showToast(topic.code + " is back to your tracked progress.");
            showPanel(topic); draw(); focusStar(topic.code);
          },
          true,
          function () { undo.hidden = false; undo.focus(); });
      });
      undo.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>';
      undo.append("Remove the brightness I set");
      wrap.append(undo, confirmArea);
      return wrap;
    }

    const tracked = p.tracked || 0;
    if (tracked >= TOP) return wrap;          // already blazing: nothing brighter to set

    const open = btn("✦ Set this star myself", "button ghost set-star", function () {
      open.hidden = true;
      chooser.hidden = false;
      chooser.querySelector("button").focus();
    });
    const chooser = make("div", "chooser");
    chooser.hidden = true;
    chooser.append(make("p", "blurt-small", "Already know this topic? Pick how bright it should be:"));
    const options = make("div", "chooser-options");
    for (let s = tracked + 1; s <= TOP; s++) {
      (function (stage) {
        options.append(btn(STAGES[stage], "chooser-option", function () {
          askFirst(confirmArea,
            "Set " + topic.code + " " + topic.name + " to " + STAGES[stage] + "? This only changes how the star looks. " +
            "It won't mark any notes as read or change your blurt scores, and you can change it back at any time.",
            "Yes, set it",
            function () {
              manual[topic.code] = stage;
              saveManual();
              showToast(topic.code + " set to " + STAGES[stage] + " by you.");
              showPanel(topic); draw(); focusStar(topic.code);
            });
        }));
      })(s);
    }
    chooser.append(options, btn("Cancel", "button ghost", function () {
      chooser.hidden = true; open.hidden = false; confirmArea.innerHTML = "";
    }));
    wrap.append(open, chooser, confirmArea);
    return wrap;
  }

  // ---------- A shooting star when a star got brighter since last time ----------
  // Only real (tracked) progress counts here, not stars set by hand.
  function celebrate() {
    let seen = {};
    try { seen = JSON.parse(load("sky:seen")) || {}; } catch (e) {}
    const now = {}, brighter = [];
    DATA.topics.forEach(function (t) {
      const stage = trackedOf(t).stage;
      now[t.code] = stage;
      if (seen[t.code] !== undefined && stage > seen[t.code]) brighter.push([t, stage]);
    });
    save("sky:seen", JSON.stringify(now));
    if (!brighter.length) return;

    const t = brighter[0][0];
    showToast(t.code + " " + t.name + " got brighter: it's now " + STAGES[brighter[0][1]] + ".");
    const g = svg.querySelector('[data-code="' + t.code + '"]');
    if (g) g.classList.add("upgraded");
    shootingStar(true);
  }

  // ---------- Start ----------
  exampleSwitch.addEventListener("change", function () {
    example = exampleSwitch.checked;
    selected = null;
    panel.innerHTML = '<p class="panel-empty">Tap a star to see its topic.</p>';
    draw();
  });

  let lastTall = null;
  window.addEventListener("resize", function () {
    const nowTall = frame.clientWidth < 620;
    if (nowTall !== lastTall) { lastTall = nowTall; draw(); }
  });

  // Open the panel for the "next star" straight away, so the page is useful at once
  const first = nextStep();
  if (first) {
    selected = first.topic.code;
    showPanel(first.topic);
  }
  draw();
  lastTall = tall;
  celebrate();   // after drawing, so the shooting star isn't wiped straight away
  setTimeout(function () { shootingStar(false); }, 2500);   // one early on, so it's noticed
  scheduleShootingStars();
})();
