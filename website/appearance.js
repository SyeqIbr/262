/*
  LESSON 17: The Appearance panel
  -------------------------------
  The palette button in the menu opens a small panel where students choose
  how Constellate looks:

    Mode        Night, Day, or Auto (match the device)
    Starlight   the colour of every star detail (5 themes)
    Cursor      the normal arrow, or a spinning star (Lesson 18)
    Effects     star trail; moving sky; page names when you change page

  How it works:
  - Every choice is saved in localStorage ("mode", "look:colour", ...).
  - Each choice is also written onto <html> as a data- attribute, e.g.
    <html data-colour="aurora">. The CSS has rules for each one, so the
    whole site changes instantly without reloading.
  - A tiny script in each page's <head> re-applies the saved choices
    before the page draws, so there's no flash between pages.

  The panel's HTML is built here in JavaScript, so it lives in one place
  instead of being copied into every page.
*/

(function () {
  const root = document.documentElement;
  const button = document.querySelector(".look-toggle");

  function load(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function save(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }

  // ---------- The choices ----------
  const COLOURS = [
    // [id, name, main colour, deep colour]
    ["lavender", "Lavender", "#c4b5fd", "#7c3aed"],
    ["aurora",   "Aurora",   "#5eead4", "#0f766e"],
    ["rose",     "Rose",     "#f9a8d4", "#be185d"],
    ["gold",     "Gold",     "#fcd34d", "#b45309"],
    ["ice",      "Ice",      "#93c5fd", "#1d4ed8"],
  ];

  // The star picture, used for the cursor and its preview in the panel
  const STAR_SVG = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2l3.2 10.8L30 16l-10.8 3.2L16 30l-3.2-10.8L2 16l10.8-3.2z"/></svg>';

  // ---------- Applying choices ----------
  function currentColour() {
    const id = load("look:colour") || "lavender";
    return COLOURS.find(function (c) { return c[0] === id; }) || COLOURS[0];
  }

  function applyMode() {
    const mode = load("mode") || "dark";
    const light = mode === "light" || (mode === "auto" && window.matchMedia("(prefers-color-scheme: light)").matches);
    if (light) root.dataset.mode = "light"; else delete root.dataset.mode;
  }

  function applyColour() {
    const c = currentColour();
    if (c[0] === "lavender") delete root.dataset.colour; else root.dataset.colour = c[0];
  }

  // The star cursor is drawn by the page (see "The star cursor" below), so
  // here we only record the choice. Older saved choices (comet, planet) become star.
  function applyCursor() {
    const kind = load("look:cursor") || "normal";
    if (kind === "normal") delete root.dataset.cursor; else root.dataset.cursor = "star";
  }

  function applyFlags() {
    if (load("look:trail") === "off") root.dataset.trail = "off"; else delete root.dataset.trail;
    if (load("look:sky") === "off") root.dataset.sky = "off"; else delete root.dataset.sky;
    if (load("look:names") === "off") root.dataset.names = "off"; else delete root.dataset.names;
  }

  function applyAll() { applyMode(); applyColour(); applyCursor(); applyFlags(); }
  applyAll();

  // "Auto" follows the device, even if it switches while the page is open
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", applyMode);

  if (!button) return;

  // ---------- Building the panel ----------
  const panel = document.createElement("div");
  panel.className = "look-panel";
  panel.id = "look-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Appearance");
  panel.hidden = true;

  // A group of radio buttons. Real <input type="radio"> elements mean the
  // keyboard and screen readers already know how to use them.
  function radioGroup(name, key, fallback, options, className) {
    const wrap = document.createElement("div");
    wrap.className = "look-options " + className;
    wrap.setAttribute("role", "radiogroup");
    options.forEach(function (o) {
      const label = document.createElement("label");
      label.className = "look-option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = name;
      input.value = o.value;
      input.checked = (load(key) || fallback) === o.value;
      input.addEventListener("change", function () {
        save(key, o.value);
        applyAll();
      });
      const pic = document.createElement("span");
      pic.className = "look-pic";
      pic.innerHTML = o.pic;
      if (o.style) pic.setAttribute("style", o.style);
      const text = document.createElement("span");
      text.className = "look-name";
      text.textContent = o.label;
      label.append(input, pic, text);
      wrap.append(label);
    });
    return wrap;
  }

  // An on/off switch
  function toggle(key, labelText, hint) {
    const label = document.createElement("label");
    label.className = "look-switch";
    const text = document.createElement("span");
    text.innerHTML = "<b></b><small></small>";
    text.querySelector("b").textContent = labelText;
    text.querySelector("small").textContent = hint;
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("role", "switch");
    input.checked = load(key) !== "off";
    input.addEventListener("change", function () {
      save(key, input.checked ? "on" : "off");
      applyFlags();
    });
    const track = document.createElement("span");
    track.className = "look-track";
    track.setAttribute("aria-hidden", "true");
    label.append(text, input, track);
    return label;
  }

  function section(title, content, className) {
    const s = document.createElement("section");
    s.className = "look-section" + (className ? " " + className : "");
    const h = document.createElement("h3");
    h.textContent = title;
    s.append(h);
    content.forEach(function (c) { s.append(c); });
    return s;
  }

  const head = document.createElement("div");
  head.className = "look-head";
  head.innerHTML = '<h2>Appearance</h2><button type="button" class="look-close" aria-label="Close">×</button>';

  const modes = radioGroup("look-mode", "mode", "dark", [
    { value: "dark", label: "Night", pic: '<span class="mode-pic night"><i></i><i></i><i></i></span>' },
    { value: "light", label: "Day", pic: '<span class="mode-pic day"><i></i></span>' },
    { value: "auto", label: "Auto", pic: '<span class="mode-pic auto"><i></i></span>' },
  ], "modes");

  const colours = radioGroup("look-colour", "look:colour", "lavender", COLOURS.map(function (c) {
    return { value: c[0], label: c[1], pic: '<span class="swatch"></span>', style: "--swatch:" + c[2] + ";--swatch-deep:" + c[3] };
  }), "colours");

  const cursors = radioGroup("look-cursor", "look:cursor", "normal", [
    { value: "normal", label: "Normal", pic: '<svg viewBox="0 0 32 32"><path d="M9 5v20l5.5-5.5 3.5 8 3-1.3-3.5-7.8H25z" fill="#fff" stroke="#0b0c10" stroke-width="1.4" stroke-linejoin="round"/></svg>' },
    { value: "star", label: "Spinning star", pic: '<span class="cursor-pic">' + STAR_SVG + "</span>" },
  ], "cursors");
  // Old saved choices (comet, planet) show as Star
  if (!cursors.querySelector("input:checked")) cursors.querySelector('input[value="star"]').checked = true;

  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "look-reset";
  reset.textContent = "Reset to the original look";
  reset.addEventListener("click", function () {
    ["mode", "look:colour", "look:cursor", "look:trail", "look:sky", "look:names"].forEach(function (k) {
      try { localStorage.removeItem(k); } catch (e) {}
    });
    applyAll();
    panel.querySelectorAll("input[type=radio]").forEach(function (i) {
      i.checked = ["dark", "lavender", "normal"].indexOf(i.value) !== -1;
    });
    panel.querySelectorAll("input[role=switch]").forEach(function (i) { i.checked = true; });
  });

  panel.append(
    head,
    section("Mode", [modes]),
    section("Starlight colour", [colours]),
    // Cursors and the trail only make sense with a mouse; CSS hides them on touch screens
    section("Cursor", [cursors], "mouse-only"),
    section("Effects", [
      toggle("look:trail", "Star trail", "Tiny stars follow the mouse"),
      toggle("look:sky", "Moving sky", "Shooting stars, twinkling and drift"),
      toggle("look:names", "Page names", "Show where you're going when you change page"),
    ]),
    reset
  );
  // The trail switch is mouse-only too
  panel.querySelector(".look-switch").classList.add("mouse-only");
  document.body.append(panel);

  // ---------- Opening and closing ----------
  function open() {
    panel.hidden = false;
    button.setAttribute("aria-expanded", "true");
    panel.querySelector("input:checked").focus();
  }
  function close(returnFocus) {
    if (panel.hidden) return;
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
    if (returnFocus) button.focus();
  }
  button.addEventListener("click", function (e) {
    e.stopPropagation();
    if (panel.hidden) open(); else close(false);
  });
  head.querySelector(".look-close").addEventListener("click", function () { close(true); });
  // Click anywhere outside the panel to close it
  document.addEventListener("click", function (e) {
    if (!panel.hidden && !panel.contains(e.target)) close(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close(true);
  });

  // ---------- Page names (Lesson 18) ----------
  // Every page's friendly name comes from page-names.js, e.g.
  // "biology/b1-microscopy.html" -> ["Microscopy", "Biology"].
  // This script sits in the site's top folder, so its own address tells us
  // where the site starts, and we can turn any link into a key for that list.
  const scriptSrc = (document.currentScript && document.currentScript.src) || "";
  const siteRoot = scriptSrc.slice(0, scriptSrc.lastIndexOf("/") + 1);
  function nameFor(link) {
    if (!link || !link.href || link.target === "_blank" || !siteRoot) return null;
    const url = new URL(link.href, location.href);
    const here = new URL(location.href);
    if (url.origin !== here.origin || !url.href.startsWith(siteRoot)) return null;
    if (url.pathname === here.pathname && url.hash) return null;       // a jump within this page
    let key = url.pathname.slice(new URL(siteRoot).pathname.length) || "index.html";
    return (window.PAGE_NAMES || {})[key] || null;
  }

  // The loading card (Lesson 19): a small night sky floating above the page,
  // with the logo, the name of the page you're going to, a ringed planet,
  // a moon, twinkling dots and a couple of shooting stars. The page behind
  // is dimmed and softly blurred.
  function loadingCard(name, sub) {
    const box = document.createElement("div");
    box.className = "page-overlay";
    box.setAttribute("aria-hidden", "true");
    const logo = document.querySelector(".nav .brand .logo");
    box.innerHTML =
      '<div class="load-card">' +
        '<i class="load-dots"></i>' +
        '<i class="load-shoot one"></i><i class="load-shoot two"></i>' +
        '<i class="load-planet"></i><i class="load-moon"></i>' +
        '<span class="load-brand">' + (logo ? logo.outerHTML : "") + '<span>Constellate</span></span>' +
        '<small></small><b></b>' +
      "</div>";
    box.querySelector("small").textContent = sub;
    box.querySelector("b").textContent = name;
    return box;
  }

  // Leaving: show the card, then go (a short pause so you can see it)
  document.addEventListener("click", function (e) {
    const link = e.target.closest && e.target.closest("a[href]");
    if (!link || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (root.dataset.names === "off") return;
    const name = nameFor(link);
    if (!name) return;
    e.preventDefault();
    const card = loadingCard(name[0], name[1]);
    // The new page gets the same card, already showing (class "arriving")
    try {
      const saved = card.cloneNode(true);
      saved.classList.add("arriving");
      sessionStorage.setItem("arrive-card", saved.outerHTML);
    } catch (err) {}
    document.body.append(card);
    const wait = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 320;
    setTimeout(function () { location.href = link.href; }, wait);
  });

  // Arriving: the <head> script already put the card up. Hold it a moment,
  // then let it float away.
  function arrive() {
    document.querySelectorAll(".page-overlay.arriving").forEach(function (card) {
      card.classList.add("leaving");
      setTimeout(function () { card.remove(); }, 450);
    });
  }
  requestAnimationFrame(function () { setTimeout(arrive, 300); });
  // Coming back with the Back button can restore the old page as it was left,
  // card and all, so clear it away.
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) document.querySelectorAll(".page-overlay").forEach(function (o) { o.remove(); });
  });

  // ---------- The star cursor (Lesson 18) ----------
  // A browser can't animate a normal cursor, so when the star is chosen we
  // hide the real one (cursor: none) and draw our own star that follows the
  // mouse. That star can spin, grow over links and pulse when you click.
  // Next to it, a small label says where a link goes.
  const hasMouse = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (hasMouse) {
    const star = document.createElement("div");
    star.className = "star-cursor";
    star.setAttribute("aria-hidden", "true");
    star.innerHTML = '<span class="spin">' + STAR_SVG + "</span>";
    const label = document.createElement("div");
    label.className = "cursor-label";
    label.setAttribute("aria-hidden", "true");
    document.body.append(star, label);

    let x = -100, y = -100, queued = false;
    function place() {
      queued = false;
      star.style.transform = "translate(" + x + "px," + y + "px)";
      label.style.transform = "translate(" + (x + 20) + "px," + (y + 16) + "px)";
    }

    document.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      x = e.clientX; y = e.clientY;
      // The class that hides the real cursor is only added once our star is
      // actually moving, so if anything goes wrong the normal cursor stays.
      root.classList.add("star-cursor-on");
      if (!queued) { queued = true; requestAnimationFrame(place); }

      // What's under the mouse?
      const t = e.target;
      const typing = t.closest && t.closest("textarea, input[type=text], input[type=search], input:not([type])");
      const clickable = t.closest && t.closest("a[href], button, label, summary, [role=button], select");
      star.classList.toggle("over-text", !!typing);
      star.classList.toggle("over-link", !!clickable && !typing);

      // The label: a page name for links, or the topic for a star in the sky
      let text = "";
      const link = t.closest && t.closest("a[href]");
      const name = nameFor(link);
      if (name) text = name[0];
      const skyStar = t.closest && t.closest(".sky .star");
      if (skyStar) text = (skyStar.getAttribute("aria-label") || "").split(":")[0];
      if (text !== label.textContent) label.textContent = text;
      label.classList.toggle("show", !!text && root.dataset.cursor === "star");
    }, { passive: true });

    document.addEventListener("pointerdown", function () { star.classList.add("pressed"); });
    document.addEventListener("pointerup", function () { star.classList.remove("pressed"); });
    document.documentElement.addEventListener("pointerleave", function () { star.classList.add("away"); label.classList.remove("show"); });
    document.documentElement.addEventListener("pointerenter", function () { star.classList.remove("away"); });
  }

  // ---------- The star trail behind the mouse (moved here from progress.js) ----------
  // Every time the mouse travels about 16px, a small four-point star appears,
  // drifts down a little, spins and fades. Only with a real mouse, only when
  // the trail is switched on, and never if the device asks for less motion.
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!fine || calm) return;

  let lastX = -100, lastY = -100, alive = 0;
  window.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse" || root.dataset.trail === "off") return;
    const moved = Math.hypot(e.clientX - lastX, e.clientY - lastY);
    if (moved < 16 || alive > 24) return;
    lastX = e.clientX; lastY = e.clientY;

    const star = document.createElement("span");
    star.className = "trail-star" + (Math.random() < 0.3 ? " tint" : "");
    star.setAttribute("aria-hidden", "true");
    const size = 5 + Math.random() * 6;
    star.style.width = star.style.height = size + "px";
    document.body.append(star);
    alive++;

    const x = e.clientX - size / 2 + (Math.random() - 0.5) * 8;
    const y = e.clientY - size / 2 + (Math.random() - 0.5) * 8;
    const spin = (Math.random() < 0.5 ? -1 : 1) * (90 + Math.random() * 90);
    star.animate([
      { transform: "translate(" + x + "px," + y + "px) scale(1) rotate(0deg)", opacity: 0.95 },
      { transform: "translate(" + (x + (Math.random() - 0.5) * 20) + "px," + (y + 14 + Math.random() * 12) + "px) scale(0.2) rotate(" + spin + "deg)", opacity: 0 },
    ], { duration: 700 + Math.random() * 300, easing: "ease-out" }).onfinish = function () {
      star.remove();
      alive--;
    };
  }, { passive: true });
})();
