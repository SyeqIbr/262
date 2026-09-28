/*
  LESSON 9: The reading bar (note pages only)
  -------------------------------------------
  Once you scroll past the title, a slim bar appears under the nav. It shows
    - which section you're reading,
    - a "Sections" button that opens a list of every section, to jump to,
    - a thin line along the bottom that fills up as you read.
  All of it is built here from the note's own <h2> headings.
*/

(function () {
  const nav = document.querySelector(".nav");
  const title = document.querySelector(".note-title");
  const headings = Array.from(document.querySelectorAll(".notes h2"));
  if (!nav || !title || headings.length === 0) return;

  // Give every heading an id, so we can jump straight to it.
  // "Light vs electron microscopes" → id="light-vs-electron-microscopes"
  headings.forEach(function (h) {
    if (!h.id) {
      h.id = h.textContent.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }
  });

  // Build the bar
  const bar = document.createElement("div");
  bar.className = "readbar";
  bar.innerHTML =
    '<span class="readbar-title"></span>' +
    '<button class="readbar-button" type="button" aria-expanded="false">Sections <span aria-hidden="true">▾</span></button>' +
    '<ol class="readbar-menu" hidden></ol>' +
    '<span class="readbar-fill"></span>';
  nav.append(bar);

  const current = bar.querySelector(".readbar-title");
  const button = bar.querySelector(".readbar-button");
  const menu = bar.querySelector(".readbar-menu");
  const fill = bar.querySelector(".readbar-fill");

  headings.forEach(function (h) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = "#" + h.id;
    a.textContent = h.textContent;
    a.addEventListener("click", closeMenu);
    li.append(a);
    menu.append(li);
  });

  function openMenu() {
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
  }
  function closeMenu() {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }
  button.addEventListener("click", function () {
    if (menu.hidden) openMenu(); else closeMenu();
  });
  // Close the list if you click anywhere else or press Escape
  document.addEventListener("click", function (e) {
    if (!bar.contains(e.target)) closeMenu();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMenu();
  });

  // Every time the page scrolls, update the bar
  function update() {
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? window.scrollY / scrollable : 1;
    fill.style.width = Math.round(progress * 100) + "%";

    // Show the bar once the big title has scrolled out of view
    bar.classList.toggle("show", title.getBoundingClientRect().bottom < nav.getBoundingClientRect().bottom);

    // The current section is the last heading above the middle-ish of the screen
    let here = headings[0];
    headings.forEach(function (h) {
      if (h.getBoundingClientRect().top < window.innerHeight * 0.35) here = h;
    });
    current.textContent = here.textContent;
    menu.querySelectorAll("a").forEach(function (a) {
      a.classList.toggle("active", a.textContent === here.textContent);
    });
  }

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
})();
