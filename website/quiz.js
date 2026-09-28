/*
  LESSON 4: Your first JavaScript
  -------------------------------
  HTML = content, CSS = design, JavaScript = BEHAVIOUR.

  This file builds a multiple-choice quiz. It doesn't contain any
  questions itself. Each topic page lists its own questions in a
  variable called QUESTIONS, then loads this file, so ONE quiz script
  works for every topic.

  Each question looks like this:
    {
      question: "Which part controls the cell?",
      options: ["Nucleus", "Ribosome", "Cell wall"],
      answer: 0,               <- position of the right option (counting from 0!)
      explain: "The nucleus contains genetic material..."
    }
*/

// Find the empty box on the page where the quiz should go.
const quizBox = document.getElementById("quiz");

// Variables that change as the student plays.
let score = 0;
let answered = 0;

// A "function" is a named set of instructions we can run whenever we like.
function buildQuiz() {
  score = 0;
  answered = 0;
  quizBox.innerHTML = "";   // empty the box (for "Try again")

  // The score line at the top of the quiz.
  const scoreLine = document.createElement("p");
  scoreLine.className = "quiz-score";
  scoreLine.setAttribute("aria-live", "polite");  // screen readers announce changes
  quizBox.appendChild(scoreLine);

  // "forEach" runs the code inside once for every question in the list.
  QUESTIONS.forEach(function (q, number) {
    const box = document.createElement("fieldset");
    box.className = "question";

    const title = document.createElement("legend");
    title.textContent = (number + 1) + ". " + q.question;
    box.appendChild(title);

    const options = document.createElement("div");
    options.className = "options";
    box.appendChild(options);

    const explanation = document.createElement("p");
    explanation.className = "explanation";
    explanation.hidden = true;   // stays hidden until the student answers

    q.options.forEach(function (text, index) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option";
      button.textContent = text;

      // "addEventListener" = when this button is clicked, run this code.
      button.addEventListener("click", function () {
        const buttons = options.querySelectorAll("button");
        buttons.forEach(function (b) { b.disabled = true; });  // one go only

        buttons[q.answer].classList.add("correct");            // always show the right one
        if (index === q.answer) {
          score = score + 1;
          explanation.textContent = "Correct! " + q.explain;
        } else {
          button.classList.add("wrong");
          explanation.textContent = "Not quite. " + q.explain;
        }
        explanation.hidden = false;

        answered = answered + 1;
        updateScore(scoreLine);
      });

      options.appendChild(button);
    });

    box.appendChild(explanation);
    quizBox.appendChild(box);
  });

  // The "Try again" button at the bottom.
  const again = document.createElement("button");
  again.type = "button";
  again.className = "button";
  again.textContent = "Try again";
  again.addEventListener("click", buildQuiz);
  quizBox.appendChild(again);

  updateScore(scoreLine);
}

function updateScore(scoreLine) {
  const total = QUESTIONS.length;
  if (answered < total) {
    scoreLine.textContent = "Score: " + score + " / " + answered + " answered (" + total + " questions)";
  } else {
    scoreLine.textContent = "Finished! You scored " + score + " out of " + total + ".";
  }
}

// Run it once when the page loads.
buildQuiz();
