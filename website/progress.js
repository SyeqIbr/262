/*
  LESSON 5: Remembering progress
  ------------------------------
  "localStorage" is a small notebook the browser keeps for each website.
  We write things like "read:b1-microscopy" = "1" into it, and they're still
  there next time the student visits (on the same device and browser).

  Some browsers block it (e.g. private browsing), so every read and write
  is wrapped in try { ... } catch { ... }. If it fails, the site still works;
  it just doesn't remember anything.
*/

function loadValue(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function saveValue(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    // Storage is blocked: nothing to do.
  }
}

// Best quiz score, as a number (0 if never tried).
function bestScore(quizId) {
  return Number(loadValue("best:" + quizId)) || 0;
}

function isRead(noteId) {
  return loadValue("read:" + noteId) === "1";
}

// 0. Always start a new page at the top.
//    Some browsers and preview windows try to keep your old scroll
//    position when a new page opens, which is confusing after "Next".
//    So we jump to the top in three ways, to cover every case.
function goToTop() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";   // don't restore old positions
}

// (a) When you click a link to another page, go to the top FIRST,
//     so the position that gets remembered is already the top.
document.addEventListener("click", function (event) {
  const link = event.target.closest("a[href]");
  if (!link) return;
  const href = link.getAttribute("href");
  if (href.startsWith("#") || link.target === "_blank") return;  // same-page jumps
  goToTop();
});

// (b) When a page opens (unless the link was to a #section), go to the top,
// (c) and try again a few times in case something restores the old
//     position late. Stop as soon as the student scrolls themselves.
if (!location.hash) {
  let userScrolled = false;
  ["wheel", "touchstart", "keydown"].forEach(function (type) {
    window.addEventListener(type, function () { userScrolled = true; }, { once: true, passive: true });
  });
  function topUnlessScrolled() {
    if (!userScrolled) goToTop();
  }
  goToTop();
  window.addEventListener("load", topUnlessScrolled);
  window.addEventListener("pageshow", topUnlessScrolled);
  [50, 200, 500].forEach(function (ms) { setTimeout(topUnlessScrolled, ms); });
}

// Light / dark mode and the other looks now live in appearance.js (Lesson 17).

// "Continue where you left off": note and blurting pages remember
// themselves (their <body> carries data-path, data-title, data-where),
// and the homepage / overview show a card to jump back.
if (document.body.dataset.path) {
  saveValue("last", JSON.stringify({
    path: document.body.dataset.path,
    title: document.body.dataset.title,
    where: document.body.dataset.where,
    nextPath: document.body.dataset.nextPath || "",
    nextTitle: document.body.dataset.nextTitle || "",
  }));
}

const continueBox = document.getElementById("continue");
if (continueBox) {
  let last = null;
  try { last = JSON.parse(loadValue("last")); } catch (error) {}
  if (last && last.path) {
    const card = document.createElement("div");
    card.className = "continue-inner";
    const text = document.createElement("div");
    const label = document.createElement("span");
    label.className = "continue-label";
    label.textContent = "Pick up where you left off";
    const title = document.createElement("b");
    title.textContent = last.title;
    const where = document.createElement("small");
    where.textContent = last.where;
    text.append(label, title, where);

    const actions = document.createElement("div");
    actions.className = "continue-actions";
    const go = document.createElement("a");
    go.className = "button";
    go.href = last.path;
    go.textContent = "Continue";
    actions.append(go);
    if (last.nextPath) {
      const next = document.createElement("a");
      next.className = "button ghost";
      next.href = last.nextPath;
      next.textContent = "Next: " + last.nextTitle;
      actions.append(next);
    }
    card.append(text, actions);
    continueBox.append(card);
    continueBox.hidden = false;
  }
}

// LESSON 15: a star burst when you make progress.
// A small star pops out of the page, then flies up into "My sky" in the
// menu, which glows. It shows that what you just did made your sky brighter.
// Other scripts (like blurt.js) can call window.starBurst(element) too.
window.starBurst = function (fromElement) {
  const target = document.querySelector(".nav .sky-link");
  if (!target || !fromElement) return;
  const glow = function () {
    target.classList.remove("sky-glow");
    void target.offsetWidth;                 // restart the glow animation
    target.classList.add("sky-glow");
  };
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { glow(); return; }

  const from = fromElement.getBoundingClientRect();
  const to = (target.querySelector(".nav-icon") || target).getBoundingClientRect();
  const x0 = from.left + from.width / 2, y0 = from.top + Math.min(from.height / 2, 60);
  const x1 = to.left + to.width / 2, y1 = to.top + to.height / 2;

  // The star, plus a ring of tiny sparks that burst outwards
  const star = document.createElement("span");
  star.className = "burst-star";
  star.setAttribute("aria-hidden", "true");
  document.body.append(star);
  for (let i = 0; i < 8; i++) {
    const spark = document.createElement("span");
    spark.className = "burst-spark";
    spark.setAttribute("aria-hidden", "true");
    document.body.append(spark);
    const angle = (i / 8) * Math.PI * 2;
    spark.animate([
      { transform: "translate(" + x0 + "px," + y0 + "px) scale(1)", opacity: 1 },
      { transform: "translate(" + (x0 + Math.cos(angle) * 44) + "px," + (y0 + Math.sin(angle) * 44) + "px) scale(0.2)", opacity: 0 },
    ], { duration: 650, easing: "cubic-bezier(.2,.7,.3,1)" }).onfinish = function () { spark.remove(); };
  }
  // Pop in, pause, then curve up to the menu (the middle keyframe bends the path)
  const midX = (x0 + x1) / 2 + 60, midY = Math.min(y0, y1) + (y0 - y1) * 0.25;
  star.animate([
    { transform: "translate(" + x0 + "px," + y0 + "px) scale(0.2) rotate(0deg)", opacity: 0 },
    { transform: "translate(" + x0 + "px," + y0 + "px) scale(1.4) rotate(90deg)", opacity: 1, offset: 0.25 },
    { transform: "translate(" + midX + "px," + midY + "px) scale(1) rotate(200deg)", opacity: 1, offset: 0.6 },
    { transform: "translate(" + x1 + "px," + y1 + "px) scale(0.4) rotate(360deg)", opacity: 0.9 },
  ], { duration: 1300, easing: "ease-in-out" }).onfinish = function () { star.remove(); glow(); };
};

// 1. On a note page, <body data-note="..."> marks that note as read.
//    If it's the first time, a star flies up to your sky when you reach
//    the end of the note (the Previous / Next buttons).
if (document.body.dataset.note) {
  const firstTime = !isRead(document.body.dataset.note);
  saveValue("read:" + document.body.dataset.note, "1");
  const end = document.querySelector(".pager");
  if (firstTime && end && "IntersectionObserver" in window) {
    const watcher = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        watcher.disconnect();
        window.starBurst(end);
      }
    }, { threshold: 0.6 });
    watcher.observe(end);
  }
}

// 2. Fill in the dot of every note link you've already read.
document.querySelectorAll("a[data-note]").forEach(function (link) {
  if (isRead(link.dataset.note)) {
    link.classList.add("done");
  }
});

// 3. Quiz and blurting links: show your best score and fill the ring.
//    e.g. <a data-quiz="b1-cell-structure" data-total="7">            → "Best 6 / 7"
//         <a data-quiz="blurt-b1-cell-structure" data-total="100" data-unit="%"> → "Best 80%"
document.querySelectorAll("[data-quiz]").forEach(function (el) {
  const tried = loadValue("best:" + el.dataset.quiz) !== null;
  const best = bestScore(el.dataset.quiz);
  const total = Number(el.dataset.total);
  const ring = el.querySelector(".ring");
  const label = el.querySelector(".best");
  if (ring) ring.style.setProperty("--p", Math.round((best / total) * 100));
  if (!label) return;
  if (el.dataset.unit === "%") {
    label.textContent = tried ? "Best " + best + "%" : (label.hasAttribute("data-quiet") ? "" : "Not started");
  } else {
    label.textContent = tried ? "Best " + best + " / " + total : "Not started";
  }
});

// 4. Topic rings: how much of the topic is done.
//    On the notes page it counts read notes; on the quizzes page, quiz marks.
document.querySelectorAll("details.topic").forEach(function (topic) {
  const ring = topic.querySelector("summary .ring");
  if (!ring) return;

  const notes = topic.querySelectorAll("a[data-note]");
  const quizzes = topic.querySelectorAll("[data-quiz]");
  let done = 0;
  let total = 0;

  notes.forEach(function (link) {
    total = total + 1;
    if (isRead(link.dataset.note)) done = done + 1;
  });
  quizzes.forEach(function (el) {
    total = total + Number(el.dataset.total);
    done = done + bestScore(el.dataset.quiz);
  });

  if (total > 0) ring.style.setProperty("--p", Math.round((done / total) * 100));
});

// 5. Counters on the overview page, e.g. "Notes read 3 / 9".
document.querySelectorAll("[data-count-notes]").forEach(function (el) {
  const ids = el.dataset.countNotes.split(" ");
  const read = ids.filter(isRead).length;
  el.textContent = read + " / " + ids.length;
});

document.querySelectorAll("[data-count-quizzes]").forEach(function (el) {
  const ids = el.dataset.countQuizzes.split(" ");
  const tried = ids.filter(function (id) { return loadValue("best:" + id) !== null; }).length;
  el.textContent = tried + " / " + ids.length;
});

// (The star trail behind the mouse moved to appearance.js in Lesson 17.)
