/*
  LESSON 9: Reading helpers (note pages only)
  -------------------------------------------
  1. A thin line under the nav that fills up as you read (every screen size).
  2. On laptops: a slim strip of little lines on the left edge, one per
     section. The current section's line is longer and coloured. Hover
     over the strip (or tab to it) to see the section names; click one
     to jump there.
  Both are built here from the note's own <h2> headings.
*/

(function () {
  const nav = document.querySelector(".nav");
  const headings = Array.from(document.querySelectorAll(".notes h2"));
  if (!nav || headings.length === 0) return;

  // Give every heading an id, so we can jump straight to it.
  // "Light vs electron microscopes" → id="light-vs-electron-microscopes"
  headings.forEach(function (h) {
    if (!h.id) {
      h.id = h.textContent.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }
  });

  // 1. The progress line
  const line = document.createElement("div");
  line.className = "read-line";
  document.body.append(line);

  // 2. The side strip
  const rail = document.createElement("nav");
  rail.className = "toc-rail";
  rail.setAttribute("aria-label", "Sections in this note");
  const list = document.createElement("ol");
  const links = headings.map(function (h) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = "#" + h.id;
    const tick = document.createElement("span");
    tick.className = "tick";
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = h.textContent;
    a.append(tick, label);
    li.append(a);
    list.append(li);
    return a;
  });
  rail.append(list);
  document.body.append(rail);

  // Every time the page scrolls, update both
  function update() {
    // Sit the line just under the nav (the nav is taller on phones)
    line.style.top = nav.getBoundingClientRect().bottom + "px";

    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? window.scrollY / scrollable : 1;
    line.style.width = Math.round(progress * 100) + "%";

    // The current section is the last heading above the top third of the screen
    let here = 0;
    headings.forEach(function (h, i) {
      if (h.getBoundingClientRect().top < window.innerHeight * 0.35) here = i;
    });
    links.forEach(function (a, i) {
      a.classList.toggle("active", i === here);
      a.classList.toggle("done", i < here);     // sections you've already passed
      if (i === here) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  }

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
})();
