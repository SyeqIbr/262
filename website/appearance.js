/*
  LESSON 17: The Appearance panel
  -------------------------------
  The palette button in the menu opens a small panel where students choose
  how Constellate looks:

    Mode        Night, Day, or Auto (match the device)
    Starlight   the colour of every star detail (5 themes)
    Cursor      the normal arrow, or a star, comet or planet
    Effects     star trail behind the mouse; moving sky

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

  // Cursors are little SVG pictures. The browser needs them as a "data URL":
  // the picture's code squeezed into a url("data:image/svg+xml,...").
  // Each cursor has a normal look and a brighter "you can click this" look.
  function cursorSvg(kind, colour, hover) {
    const glow = hover ? '<circle cx="16" cy="16" r="11" fill="' + colour + '" opacity=".25"/>' : "";
    const shapes = {
      star: glow + '<path d="M16 3l2.8 10.2L29 16l-10.2 2.8L16 29l-2.8-10.2L3 16l10.2-2.8z" fill="' +
        (hover ? "#fff" : colour) + '" stroke="#0b0c10" stroke-width="1.4" stroke-linejoin="round"/>',
      comet: '<path d="M8 8L27 22" stroke="' + colour + '" stroke-width="' + (hover ? 5 : 4) + '" stroke-linecap="round" opacity=".45"/>' +
        '<path d="M8 8L21 17" stroke="' + colour + '" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>' +
        '<circle cx="7" cy="7" r="' + (hover ? 5.5 : 4.5) + '" fill="' + (hover ? "#fff" : colour) + '" stroke="#0b0c10" stroke-width="1.4"/>',
      planet: glow + '<circle cx="16" cy="16" r="' + (hover ? 7.5 : 6.5) + '" fill="' + (hover ? "#fff" : colour) + '" stroke="#0b0c10" stroke-width="1.4"/>' +
        '<ellipse cx="16" cy="16" rx="13" ry="4" fill="none" stroke="#0b0c10" stroke-width="3.2" transform="rotate(-20 16 16)"/>' +
        '<ellipse cx="16" cy="16" rx="13" ry="4" fill="none" stroke="' + colour + '" stroke-width="1.6" transform="rotate(-20 16 16)"/>',
    };
    return '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' + shapes[kind] + "</svg>";
  }
  const HOTSPOT = { star: "16 16", comet: "7 7", planet: "16 16" };

  function cursorUrl(kind, colour, hover) {
    return 'url("data:image/svg+xml,' + encodeURIComponent(cursorSvg(kind, colour, hover)) + '") ' + HOTSPOT[kind];
  }

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

  // The cursor needs the actual colour in its picture, so it's set from here
  // as two CSS variables that the stylesheet uses.
  function applyCursor() {
    const kind = load("look:cursor") || "normal";
    if (kind === "normal") {
      delete root.dataset.cursor;
      root.style.removeProperty("--cursor");
      root.style.removeProperty("--cursor-hover");
      return;
    }
    const colour = currentColour()[2];
    root.dataset.cursor = kind;
    root.style.setProperty("--cursor", cursorUrl(kind, colour, false) + ", auto");
    root.style.setProperty("--cursor-hover", cursorUrl(kind, colour, true) + ", pointer");
  }

  function applyFlags() {
    if (load("look:trail") === "off") root.dataset.trail = "off"; else delete root.dataset.trail;
    if (load("look:sky") === "off") root.dataset.sky = "off"; else delete root.dataset.sky;
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
        refreshCursorPreviews();
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
    { value: "star", label: "Star", pic: "" },
    { value: "comet", label: "Comet", pic: "" },
    { value: "planet", label: "Planet", pic: "" },
  ], "cursors");

  // The cursor pictures use the chosen starlight colour, so redraw them when it changes
  function refreshCursorPreviews() {
    const colour = currentColour()[2];
    cursors.querySelectorAll(".look-option").forEach(function (option) {
      const kind = option.querySelector("input").value;
      if (kind !== "normal") option.querySelector(".look-pic").innerHTML = cursorSvg(kind, colour, false);
    });
  }
  refreshCursorPreviews();

  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "look-reset";
  reset.textContent = "Reset to the original look";
  reset.addEventListener("click", function () {
    ["mode", "look:colour", "look:cursor", "look:trail", "look:sky"].forEach(function (k) {
      try { localStorage.removeItem(k); } catch (e) {}
    });
    applyAll();
    panel.querySelectorAll("input[type=radio]").forEach(function (i) {
      i.checked = ["dark", "lavender", "normal"].indexOf(i.value) !== -1;
    });
    panel.querySelectorAll("input[role=switch]").forEach(function (i) { i.checked = true; });
    refreshCursorPreviews();
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
