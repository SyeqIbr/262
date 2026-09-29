/*
  LESSON 20: The welcome tour
  ---------------------------
  The first time someone opens My sky, a short tour points out the main
  features one at a time. The page dims, a glowing "spotlight" moves to each
  feature, and a small card explains it.

  How the spotlight works: one box sits exactly over the feature, and it has
  an enormous shadow (box-shadow: 0 0 0 9999px ...). The shadow covers the
  whole screen EXCEPT the box itself, so the feature looks lit up. Moving the
  box (with a CSS transition) moves the spotlight smoothly.

  The tour runs:
  - automatically on a first visit (it saves "tour:done" when finished or skipped)
  - again whenever the page is opened as index.html#tour
    (the "Take the tour again" button on How it works links there)
*/

(function () {
  // ---------- The stops on the tour ----------
  // target: a CSS selector for the feature (none = a card in the middle)
  const STEPS = [
    { title: "Welcome to Constellate ✦",
      text: "Every GCSE science topic is a star in your own night sky. Want a quick tour? It takes about 30 seconds.",
      next: "Show me around", skip: "No thanks" },
    { target: "#sky-frame",
      title: "This is your sky",
      text: "Each star is one topic: B1–B7, C1–C10 and P1–P8. They're all faint to begin with, and brighten as you revise." },
    { target: ".sky-key",
      title: "Three kinds of star",
      text: "Faint means not started. Shining means you've read a note or tried a blurt. Blazing means 80% or more in every blurt for that topic." },
    { target: '#sky [data-code="B1"]', pad: 16, round: true,
      title: "Tap a star",
      text: "Tapping a star opens its panel: every subtopic, with links to the notes, blurting and a quick check." },
    { target: "#next-step",
      title: "Your next star",
      text: "Not sure what to do? This box always shows the single most useful next step." },
    { target: ".mix-card",
      title: "Mixed blurting",
      text: "Exams mix topics together. Tick topics from any subject and blurt them all in one go." },
    { target: [".nav .nav-link.biology", ".nav .nav-link.chemistry", ".nav .nav-link.physics"],
      title: "Your subjects",
      text: "Notes, blurting and exam questions for each subject live here." },
    { target: ".look-toggle", pad: 6, round: true,
      title: "Make it yours",
      text: "The palette changes the look: night or day, five starlight colours, and a spinning star cursor." },
    { title: "You're all set!",
      text: "Read your first note to light up your first star. Good luck, and enjoy joining the dots.",
      next: "Let's go" },
  ];

  function load(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function save(key, value) { try { localStorage.setItem(key, value); return true; } catch (e) { return false; } }
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let index = 0, shown = [], layer, hole, card, lastFocus;

  // Find the feature on the page. Several selectors = one box around them all.
  function rectFor(step) {
    if (!step.target) return null;
    const list = Array.isArray(step.target) ? step.target : [step.target];
    let r = null;
    list.forEach(function (sel) {
      const el = document.querySelector(sel);
      if (!el || el.hidden || el.getClientRects().length === 0) return;
      const b = el.getBoundingClientRect();
      r = r ? { top: Math.min(r.top, b.top), left: Math.min(r.left, b.left), right: Math.max(r.right, b.right), bottom: Math.max(r.bottom, b.bottom) }
            : { top: b.top, left: b.left, right: b.right, bottom: b.bottom };
    });
    return r;
  }
  function firstElement(step) {
    const sel = Array.isArray(step.target) ? step.target[0] : step.target;
    return sel ? document.querySelector(sel) : null;
  }

  // ---------- Building the tour ----------
  function build() {
    layer = document.createElement("div");
    layer.className = "tour";
    layer.innerHTML =
      '<div class="tour-block"></div>' +
      '<div class="tour-hole" aria-hidden="true"></div>' +
      '<div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title">' +
        '<i class="load-dots"></i>' +
        '<button type="button" class="tour-x" aria-label="Skip the tour">×</button>' +
        '<p class="tour-count"></p>' +
        '<h2 id="tour-title"></h2>' +
        '<p class="tour-text"></p>' +
        '<div class="tour-dots" aria-hidden="true"></div>' +
        '<div class="tour-buttons">' +
          '<button type="button" class="tour-back">Back</button>' +
          '<button type="button" class="tour-next button"></button>' +
        "</div>" +
      "</div>";
    document.body.append(layer);
    hole = layer.querySelector(".tour-hole");
    card = layer.querySelector(".tour-card");

    layer.querySelector(".tour-x").addEventListener("click", finish);
    layer.querySelector(".tour-back").addEventListener("click", function () {
      if (STEPS[shown[index]].skip) finish(); else go(index - 1);
    });
    layer.querySelector(".tour-next").addEventListener("click", function () {
      if (index === shown.length - 1) finish(); else go(index + 1);
    });
    document.addEventListener("keydown", keys);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { passive: true });
  }

  function keys(e) {
    if (!layer) return;
    if (e.key === "Escape") finish();
    else if (e.key === "ArrowRight") layer.querySelector(".tour-next").click();
    else if (e.key === "ArrowLeft" && index > 0) go(index - 1);
  }

  // ---------- Showing one stop ----------
  function go(i) {
    index = i;
    const step = STEPS[shown[i]];
    card.querySelector(".tour-count").textContent = i === 0 || i === shown.length - 1 ? "Welcome tour" : "Step " + i + " of " + (shown.length - 2);
    card.querySelector("h2").textContent = step.title;
    card.querySelector(".tour-text").textContent = step.text;
    const back = card.querySelector(".tour-back");
    back.textContent = step.skip || "Back";
    back.hidden = i === 0 && !step.skip;
    card.querySelector(".tour-next").textContent = step.next || (i === shown.length - 1 ? "Done" : "Next");

    // Progress dots: one per stop, the current one lit
    const dots = card.querySelector(".tour-dots");
    dots.innerHTML = "";
    shown.forEach(function (_, d) {
      const dot = document.createElement("i");
      if (d === i) dot.className = "on";
      dots.append(dot);
    });

    // Bring the feature into view, then move the spotlight to it
    const el = firstElement(step);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
      place();
      setTimeout(place, calm ? 0 : 450);
    } else {
      place();
    }
    card.classList.remove("pop");
    void card.offsetWidth;            // restart the little "pop" animation
    card.classList.add("pop");
    card.querySelector(".tour-next").focus({ preventScroll: true });
  }

  // Put the spotlight over the feature and the card beside it
  function place() {
    if (!layer) return;
    const step = STEPS[shown[index]];
    const r = rectFor(step);
    const vw = window.innerWidth, vh = window.innerHeight;
    const cw = card.offsetWidth, ch = card.offsetHeight;

    if (!r) {
      // No feature: a small closed spotlight in the middle, card in the centre
      layer.classList.add("centred");
      Object.assign(hole.style, { top: vh / 2 + "px", left: vw / 2 + "px", width: "0px", height: "0px" });
      Object.assign(card.style, { top: Math.max(16, (vh - ch) / 2) + "px", left: Math.max(16, (vw - cw) / 2) + "px" });
      return;
    }
    layer.classList.remove("centred");

    const pad = step.pad || 10;
    // Keep the spotlight on screen, even for something taller than the screen
    const top = Math.max(r.top - pad, 8), bottom = Math.min(r.bottom + pad, vh - 8);
    Object.assign(hole.style, {
      top: top + "px", left: (r.left - pad) + "px",
      width: (r.right - r.left + pad * 2) + "px", height: Math.max(bottom - top, 0) + "px",
    });
    hole.classList.toggle("round", !!step.round);

    // The card goes below the feature if it fits, otherwise above, otherwise
    // along the bottom of the screen
    let cardTop;
    if (bottom + 14 + ch < vh - 8) cardTop = bottom + 14;
    else if (top - 14 - ch > 8) cardTop = top - 14 - ch;
    else cardTop = vh - ch - 16;
    const middle = (r.left + r.right) / 2;
    const cardLeft = Math.min(Math.max(middle - cw / 2, 16), vw - cw - 16);
    Object.assign(card.style, { top: cardTop + "px", left: cardLeft + "px" });
  }

  // ---------- Starting and finishing ----------
  function start() {
    if (layer) return;
    // Only the stops whose feature is on the page (e.g. no "next step" box
    // once everything's done). Stops without a target always show.
    shown = [];
    STEPS.forEach(function (step, i) { if (!step.target || rectFor(step)) shown.push(i); });
    lastFocus = document.activeElement;
    build();
    go(0);
  }

  function finish() {
    if (!layer) return;
    save("tour:done", "1");
    document.removeEventListener("keydown", keys);
    window.removeEventListener("resize", place);
    window.removeEventListener("scroll", place);
    const old = layer;
    layer = null;
    old.classList.add("closing");
    setTimeout(function () { old.remove(); }, calm ? 0 : 250);
    window.scrollTo({ top: 0, behavior: calm ? "auto" : "smooth" });
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  // Anyone can start it again from code: window.startTour()
  window.startTour = start;

  // index.html#tour starts it (the "Take the tour again" button)
  const asked = location.hash === "#tour";
  if (asked) history.replaceState(null, "", location.pathname + location.search);

  // A first visit starts it too. If the browser can't save anything we
  // don't start it, or it would pop up on every single visit.
  const canSave = save("tour:check", "1");
  const firstVisit = canSave && load("tour:done") === null;

  // Clicking a #tour link while already on My sky
  window.addEventListener("hashchange", function () {
    if (location.hash !== "#tour") return;
    history.replaceState(null, "", location.pathname + location.search);
    start();
  });

  if (asked || firstVisit) {
    // Wait for the sky to be drawn and any loading card to fade away
    setTimeout(start, asked ? 900 : 1200);
  }
})();
