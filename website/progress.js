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

// 1. On a note page, <body data-note="..."> marks that note as read.
if (document.body.dataset.note) {
  saveValue("read:" + document.body.dataset.note, "1");
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
