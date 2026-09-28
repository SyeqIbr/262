/*
  LESSON 8: AI blurting
  ---------------------
  Blurting = answering from memory, without looking at your notes.

  How this page works:
    1. The student picks how many questions (20, 25 or 30).
    2. We ask Claude to WRITE questions, using only our notes as the source
       (so they stay on the AQA spec). Claude also writes a mark scheme.
    3. The student types their answers. Answers save automatically.
    4. We ask Claude to MARK the answers against the mark scheme.
    5. The student sees ✅ / 🟡 / ❌ for each answer, feedback, the model
       answer, and a rating for each section. They can retry or regenerate.

  Asking Claude uses claude.use("sample"). This only works inside the
  Claude preview, and it uses the viewer's own Claude account, so the
  first time, Claude asks the student for permission.

  The page gives us its details in window.BLURT (see the blurt page):
    { id, subject, topic, subtopic, notes, quickCheck }
*/

const CONFIG = window.BLURT;
const STORE_KEY = "blurt:" + CONFIG.id;
const box = document.getElementById("blurt");

let sample = null;          // the "ask Claude" function, once we have it
let aiState = "checking";   // "checking" → "ready" or "unavailable"
let controller = null;      // lets the Stop button cancel a request
let state = loadState() || { stage: "setup", count: 25 };

// If the page was closed halfway through asking Claude, go back a step.
if (state.stage === "generating") state = { stage: "setup", count: state.count || 25 };
if (state.stage === "marking") state.stage = "answering";

// ---------- Saving and loading (localStorage, wrapped in try/catch) ----------
function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY));
  } catch (error) {
    return null;
  }
}

function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (error) {
    // Storage blocked: the page still works, it just won't remember.
  }
}

function saveBest(percent) {
  try {
    const key = "best:" + CONFIG.id;
    const previous = localStorage.getItem(key);
    if (previous === null || percent > Number(previous)) {
      localStorage.setItem(key, percent);
    }
  } catch (error) {}
}

// ---------- Small helpers for building HTML safely ----------
// el("p", "note", "Hello") makes <p class="note">Hello</p>.
// We always use textContent, never innerHTML, for anything Claude or the
// student wrote. That way nobody can sneak code into the page.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text, className, onClick) {
  const b = el("button", className, text);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

function allQuestions() {
  return state.sections.flatMap(function (s) { return s.questions; });
}

function totalMarks() {
  return allQuestions().reduce(function (sum, q) { return sum + q.marks; }, 0);
}

// What to tell the student when asking Claude goes wrong.
function errorMessage(error) {
  switch (error && error.code) {
    case "not_granted":
    case "sampling_disabled":
    case "capability_disabled":
      return "Claude isn't allowed on this page, so AI blurting can't run. You can still use the quick check below.";
    case "rate_limited":
      return "You've asked Claude a lot recently. Wait a few minutes, then try again.";
    case "session_expired":
      return "You've been signed out of Claude. Sign in again, then try again.";
    case "invalid_json":
    case "empty_completion":
      return "Claude's reply came back in the wrong format. Press the button to try again.";
    default:
      return "Something went wrong talking to Claude. Press the button to try again.";
  }
}

// ---------- The prompts: what we ask Claude ----------
function generatePrompt(count) {
  return [
    "You are an expert AQA GCSE " + CONFIG.subject + " teacher writing BLURTING questions.",
    "Blurting means the student answers from memory, without their notes.",
    "",
    "Topic: " + CONFIG.topic + ". Subtopic: " + CONFIG.subtopic + ".",
    "Use ONLY the revision notes below as your source. Do not test anything that isn't in them.",
    "",
    "Write exactly " + count + " questions that, together, cover every important point in the notes,",
    "including the small details that separate a grade 9 answer from a grade 7.",
    "- Mix the command words: define, name, state, give two..., describe, explain, compare, calculate, put in order.",
    "- Include at least two calculations with real numbers if the notes contain a formula (e.g. unit conversions).",
    "- Each question must be answerable in one to three sentences, without seeing the notes.",
    "- Never give away the answer in the question.",
    "- If something is Triple only, start the question with \"(Triple only)\".",
    "- Group the questions into sections that follow the headings in the notes, in order.",
    "- marks is 1, 2 or 3. answer is a short mark scheme: the marking points an examiner would accept.",
    "",
    "Reply with only JSON in this shape:",
    '{"sections":[{"title":"Microscopy","questions":[{"q":"What is magnification?","marks":1,"answer":"How many times bigger the image is than the real object."}]}]}',
    "",
    "REVISION NOTES:",
    CONFIG.notes,
  ].join("\n");
}

function markPrompt(answered) {
  const items = answered.map(function (q) {
    return {
      id: q.id, question: q.q, marks: q.marks,
      markScheme: q.answer, studentAnswer: state.answers[q.id],
    };
  });
  return [
    "You are a fair, encouraging AQA GCSE " + CONFIG.subject + " examiner marking a student's blurting answers.",
    "Topic: " + CONFIG.topic + ", " + CONFIG.subtopic + ".",
    "",
    "For each answer:",
    "- Compare it with the mark scheme. Accept equivalent wording and ignore spelling mistakes.",
    "- Give credit only for correct science. Require key terms where examiners do",
    "  (e.g. osmosis must mention water and a partially permeable membrane).",
    "- verdict is \"correct\" (full marks), \"partial\" (some marks) or \"incorrect\" (no marks).",
    "- awarded is the number of marks earned, from 0 up to the question's marks.",
    "- feedback is one short sentence (max 25 words) to the student: say exactly what was missing or wrong,",
    "  or for a correct answer, how to make it even more exam-ready (e.g. a more formal definition).",
    "",
    "Then rate each section as \"secure\", \"nearly\" or \"revisit\", with a one-sentence comment,",
    "and write a two-sentence summary: the biggest strength, and the most important thing to revise.",
    "",
    "Reply with only JSON in this shape:",
    '{"results":[{"id":1,"verdict":"partial","awarded":1,"feedback":"..."}],',
    ' "sections":[{"title":"Microscopy","rating":"secure","comment":"..."}],',
    ' "summary":"..."}',
    "",
    "SECTIONS: " + state.sections.map(function (s) { return s.title; }).join(" | "),
    "ANSWERS TO MARK:",
    JSON.stringify(items),
  ].join("\n");
}

// ---------- Asking Claude ----------
async function generate(count) {
  if (!sample) return showError(errorMessage({ code: "not_granted" }));
  const previous = state;
  controller = new AbortController();
  state = { stage: "generating", count: count };
  render();

  try {
    const data = await sample.json(generatePrompt(count), {
      signal: controller.signal,
      cache: false,                       // "New questions" must really be new
      onText: function (update) {
        // Count questions as they stream in, to show progress
        const found = (update.text.match(/"q"\s*:/g) || []).length;
        setProgress("Writing questions… " + found + " of " + count, found / count);
      },
    });

    // Check Claude's reply has the shape we asked for, and tidy it up.
    let id = 0;
    const sections = (Array.isArray(data && data.sections) ? data.sections : [])
      .map(function (s) {
        return {
          title: String(s.title || "Questions"),
          questions: (Array.isArray(s.questions) ? s.questions : [])
            .filter(function (q) { return q && q.q && q.answer; })
            .map(function (q) {
              id = id + 1;
              return {
                id: id,
                q: String(q.q),
                marks: Math.min(3, Math.max(1, Number(q.marks) || 1)),
                answer: String(q.answer),
              };
            }),
        };
      })
      .filter(function (s) { return s.questions.length > 0; });

    if (id === 0) throw { code: "invalid_json" };

    state = { stage: "answering", count: count, sections: sections, answers: {} };
    saveState();
    render();
  } catch (error) {
    state = previous;
    render();
    if (error.code !== "cancelled") showError(errorMessage(error));
  }
}

async function mark() {
  if (!sample) return showError("AI marking only works inside the Claude preview for now. Your answers are still saved.");
  const questions = allQuestions();
  const answered = questions.filter(function (q) {
    return (state.answers[q.id] || "").trim() !== "";
  });
  if (answered.length === 0) {
    showError("Answer at least one question first.");
    return;
  }

  controller = new AbortController();
  state.stage = "marking";
  render();

  try {
    const data = await sample.json(markPrompt(answered), {
      signal: controller.signal,
      cache: false,
      onText: function (update) {
        const found = (update.text.match(/"verdict"\s*:/g) || []).length;
        setProgress("Marking… " + found + " of " + answered.length + " answers", found / answered.length);
      },
    });

    const results = {};
    (Array.isArray(data && data.results) ? data.results : []).forEach(function (r) {
      const q = questions.find(function (x) { return x.id === Number(r.id); });
      if (!q) return;
      const verdict = ["correct", "partial", "incorrect"].includes(r.verdict) ? r.verdict : "incorrect";
      results[q.id] = {
        verdict: verdict,
        awarded: Math.min(q.marks, Math.max(0, Number(r.awarded) || 0)),
        feedback: String(r.feedback || ""),
      };
    });
    // Blank answers score 0 without bothering Claude.
    questions.forEach(function (q) {
      if (!results[q.id]) {
        results[q.id] = { verdict: "blank", awarded: 0, feedback: "No answer. Look this one up in the notes." };
      }
    });

    const scored = Object.values(results).reduce(function (sum, r) { return sum + r.awarded; }, 0);
    const percent = Math.round((scored / totalMarks()) * 100);

    state.stage = "results";
    state.results = results;
    state.sectionRatings = Array.isArray(data.sections) ? data.sections : [];
    state.summary = String(data.summary || "");
    state.score = scored;
    state.percent = percent;
    saveState();
    saveBest(percent);
    render();
    box.scrollIntoView({ block: "start" });
  } catch (error) {
    state.stage = "answering";
    render();
    if (error.code !== "cancelled") showError(errorMessage(error));
  }
}

// ---------- Drawing the page for each stage ----------
function render() {
  box.innerHTML = "";
  if (state.stage === "generating" || state.stage === "marking") return renderWorking();
  if (state.stage === "answering") return renderAnswering();
  if (state.stage === "results") return renderResults();
  renderSetup();
}

function showError(message) {
  const old = box.querySelector(".blurt-error");
  if (old) old.remove();
  const p = el("p", "blurt-error", message);
  p.setAttribute("role", "alert");
  box.prepend(p);
}

function renderSetup() {
  const card = el("div", "blurt-card");
  card.append(el("h2", "blurt-h", "Ready to blurt?"));
  card.append(el("p", "blurt-p",
    "Close your notes. Claude will write fresh questions on " + CONFIG.subtopic +
    ", you answer from memory, then Claude marks every answer and shows you what you missed."));

  // Choose how many questions: 20 / 25 / 30
  const label = el("p", "blurt-label", "How many questions?");
  const choice = el("div", "segmented");
  choice.setAttribute("role", "radiogroup");
  choice.setAttribute("aria-label", "Number of questions");
  [20, 25, 30].forEach(function (n) {
    const b = button(String(n), "segment", function () {
      state.count = n;
      choice.querySelectorAll(".segment").forEach(function (x) {
        x.setAttribute("aria-checked", x === b ? "true" : "false");
      });
    });
    b.setAttribute("role", "radio");
    b.setAttribute("aria-checked", state.count === n ? "true" : "false");
    choice.append(b);
  });
  card.append(label, choice);

  const actions = el("div", "blurt-actions");
  const go = button("Generate questions", "button", function () { generate(state.count); });
  actions.append(go);

  const note = el("p", "blurt-small");
  if (aiState === "checking") {
    go.disabled = true;
    go.textContent = "Connecting to Claude…";
  } else if (aiState === "unavailable") {
    go.disabled = true;
    note.textContent = "AI blurting only works inside the Claude preview for now.";
  } else {
    note.textContent = "Uses your Claude account. Writing the questions takes about a minute.";
  }
  card.append(actions, note);
  card.append(quickCheckLink());
  box.append(card);
}

function quickCheckLink() {
  const p = el("p", "blurt-small");
  p.append("No time? Try the ");
  const a = el("a", "accent-link", "multiple-choice quick check");
  a.href = CONFIG.quickCheck;
  p.append(a, " instead.");
  return p;
}

function renderWorking() {
  const card = el("div", "blurt-card working");
  const title = state.stage === "generating" ? "Writing your questions" : "Marking your answers";
  card.append(el("h2", "blurt-h", title));
  const status = el("p", "blurt-p progress-text", "Claude is thinking… this usually takes 30–90 seconds.");
  status.setAttribute("aria-live", "polite");
  const bar = el("div", "progress-bar");
  bar.append(el("span"));
  card.append(status, bar);
  card.append(button("Stop", "button ghost", function () { if (controller) controller.abort(); }));
  box.append(card);
}

function setProgress(text, fraction) {
  const status = box.querySelector(".progress-text");
  const fill = box.querySelector(".progress-bar span");
  if (status) status.textContent = text;
  if (fill) fill.style.width = Math.min(100, Math.round(fraction * 100)) + "%";
}

function renderAnswering() {
  const total = allQuestions().length;
  const intro = el("div", "blurt-card slim");
  intro.append(el("p", "blurt-p",
    total + " questions · " + totalMarks() + " marks. Answer from memory: no peeking! " +
    "Your answers save as you type, so you can come back later."));
  box.append(intro);

  state.sections.forEach(function (section) {
    box.append(el("h2", "blurt-section", section.title));
    section.questions.forEach(function (q) {
      const item = el("div", "blurt-q");
      const head = el("label", "blurt-question");
      head.htmlFor = "answer-" + q.id;
      head.append(el("span", "q-num", q.id + "."), " " + q.q + " ");
      head.append(el("span", "q-marks", "[" + q.marks + (q.marks === 1 ? " mark]" : " marks]")));
      const input = el("textarea", "blurt-input");
      input.id = "answer-" + q.id;
      input.rows = q.marks > 1 ? 3 : 2;
      input.value = state.answers[q.id] || "";
      input.placeholder = "Your answer…";
      input.addEventListener("input", function () {
        state.answers[q.id] = input.value;
        saveState();
        updateCounter();
      });
      item.append(head, input);
      box.append(item);
    });
  });

  // A bar that sticks to the bottom of the screen with the main button
  const bar = el("div", "blurt-bar");
  bar.append(el("span", "blurt-count"));
  bar.append(button("Mark my answers", "button", mark));
  box.append(bar);
  box.append(newQuestionsControl());
  updateCounter();
}

function updateCounter() {
  const counter = box.querySelector(".blurt-count");
  if (!counter) return;
  const done = allQuestions().filter(function (q) {
    return (state.answers[q.id] || "").trim() !== "";
  }).length;
  counter.textContent = done + " of " + allQuestions().length + " answered";
}

// "New questions" throws away the current set, so it asks first
// (confirm() doesn't work in the preview, so we build our own).
function newQuestionsControl() {
  const wrap = el("div", "blurt-regen");
  const ask = button("New questions", "button ghost", function () {
    ask.hidden = true;
    sure.hidden = false;
  });
  const sure = el("div", "regen-confirm");
  sure.hidden = true;
  sure.append(el("span", "blurt-small", "This replaces your current questions and answers. "));
  sure.append(button("Yes, make new ones", "button", function () { generate(state.count || 25); }));
  sure.append(button("Cancel", "button ghost", function () { sure.hidden = true; ask.hidden = false; }));
  if (aiState !== "ready") ask.disabled = true;
  wrap.append(ask, sure);
  return wrap;
}

const VERDICT = {
  correct:   { icon: "✓", label: "Correct" },
  partial:   { icon: "½", label: "Partly right" },
  incorrect: { icon: "✗", label: "Not right" },
  blank:     { icon: "–", label: "Not answered" },
};

const RATING = { secure: "Secure", nearly: "Nearly there", revisit: "Revisit" };

function renderResults() {
  // Summary card
  const card = el("div", "blurt-card results-card");
  const score = el("div", "score-ring");
  score.style.setProperty("--p", state.percent);
  score.append(el("span", "", state.percent + "%"));
  const text = el("div", "results-text");
  text.append(el("h2", "blurt-h", state.score + " / " + totalMarks() + " marks"));
  if (state.summary) text.append(el("p", "blurt-p", state.summary));
  card.append(score, text);
  box.append(card);

  // Section ratings
  if (state.sectionRatings.length) {
    const list = el("div", "ratings");
    state.sectionRatings.forEach(function (r) {
      const rating = RATING[r.rating] ? r.rating : "nearly";
      const row = el("div", "rating-row");
      row.append(el("span", "rating-chip " + rating, RATING[rating]));
      const t = el("div");
      t.append(el("b", "", String(r.title || "")));
      if (r.comment) t.append(el("p", "blurt-small", String(r.comment)));
      row.append(t);
      list.append(row);
    });
    box.append(list);
  }

  // Every question, with the student's answer, the mark, feedback and model answer
  state.sections.forEach(function (section) {
    box.append(el("h2", "blurt-section", section.title));
    section.questions.forEach(function (q) {
      const r = state.results[q.id];
      const v = VERDICT[r.verdict];
      const item = el("div", "blurt-q marked " + r.verdict);
      const head = el("p", "blurt-question");
      head.append(el("span", "q-num", q.id + "."), " " + q.q);
      const badge = el("span", "verdict " + r.verdict);
      badge.append(el("span", "verdict-icon", v.icon), " " + r.awarded + "/" + q.marks);
      badge.title = v.label;
      head.append(" ", badge);
      item.append(head);

      const yours = el("p", "your-answer", state.answers[q.id] || "(no answer)");
      item.append(yours);
      if (r.feedback) item.append(el("p", "feedback", r.feedback));
      const model = el("p", "model-answer");
      model.append(el("b", "", "Model answer: "), q.answer);
      item.append(model);
      box.append(item);
    });
  });

  const actions = el("div", "blurt-actions");
  actions.append(button("Try the same questions again", "button", function () {
    state = { stage: "answering", count: state.count, sections: state.sections, answers: {} };
    saveState();
    render();
    box.scrollIntoView({ block: "start" });
  }));
  box.append(actions);
  box.append(newQuestionsControl());
}

// ---------- Start ----------
render();

// Ask the Claude preview for the "sample" ability. This can take a moment,
// and it's null outside the preview, so we draw the page first and then
// switch the button on (or explain why not).
(async function connect() {
  try {
    sample = window.claude && window.claude.use ? await window.claude.use("sample") : null;
  } catch (error) {
    sample = null;
  }
  aiState = sample ? "ready" : "unavailable";
  if (state.stage === "setup" || state.stage === "answering" || state.stage === "results") {
    // Re-draw only the parts that depend on it, without losing typing focus
    if (state.stage === "setup") render();
    else box.querySelectorAll(".blurt-regen button").forEach(function (b) {
      if (b.textContent === "New questions") b.disabled = aiState !== "ready";
    });
  }
  if (aiState === "unavailable" && state.stage === "answering") {
    showError("AI marking only works inside the Claude preview for now. Your answers are still saved.");
  }
})();
