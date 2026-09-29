/*
  LESSON 14: Mixed blurting
  -------------------------
  This page lists every subtopic you can blurt, from all three subjects.
  When you tick boxes, we build the notes Claude should write questions from,
  and put them in window.BLURT, which blurt.js reads when you press
  "Generate questions". Your ticks are remembered for next time.
*/
(function () {
  const groups = document.getElementById("pick-groups");
  const summary = document.getElementById("pick-summary");
  const boxes = Array.from(groups.querySelectorAll('input[type="checkbox"]'));

  function update() {
    const picked = boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; });
    const labels = picked.map(function (id) { return window.MIX_SOURCES[id].label; });

    // The notes for everything ticked, one after another, each with its name as a heading
    window.BLURT.notes = picked.map(function (id) {
      return "# " + window.MIX_SOURCES[id].label + "\n" + window.MIX_SOURCES[id].notes;
    }).join("\n\n").slice(0, 45000);      // keep well under Claude's size limit
    window.BLURT.subtopic = labels.join(", ");

    summary.textContent = picked.length === 0
      ? "Nothing ticked yet."
      : picked.length + " subtopic" + (picked.length === 1 ? "" : "s") + " ticked: " + labels.join(", ");

    try { localStorage.setItem("mix:picked", JSON.stringify(picked)); } catch (e) {}
    // Tell blurt.js the choice changed, so it can update its wording
    window.dispatchEvent(new Event("blurt-config"));
  }

  // Put back what was ticked last time
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem("mix:picked")) || []; } catch (e) {}
  boxes.forEach(function (b) {
    b.checked = saved.includes(b.value);
    b.addEventListener("change", update);
  });

  // "Select all Biology" (press again to clear them)
  groups.querySelectorAll(".select-all").forEach(function (button) {
    button.addEventListener("click", function () {
      const inGroup = Array.from(button.closest("fieldset").querySelectorAll('input[type="checkbox"]'));
      const allOn = inGroup.length > 0 && inGroup.every(function (b) { return b.checked; });
      inGroup.forEach(function (b) { b.checked = !allOn; });
      update();
    });
  });

  update();
})();
