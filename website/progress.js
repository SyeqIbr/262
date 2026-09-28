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

// 3. Quiz links: show your best score and fill the ring.
//    e.g. <a data-quiz="b1-cell-structure" data-total="7">
document.querySelectorAll("[data-quiz]").forEach(function (el) {
  const best = bestScore(el.dataset.quiz);
  const total = Number(el.dataset.total);
  const ring = el.querySelector(".ring");
  const label = el.querySelector(".best");
  if (ring) ring.style.setProperty("--p", Math.round((best / total) * 100));
  if (label) label.textContent = loadValue("best:" + el.dataset.quiz) === null
    ? "Not started"
    : "Best " + best + " / " + total;
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
