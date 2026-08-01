// ================================
// DIALOGUE SYSTEM
// All logic for the dialogue box, portraits, typewriter text effect,
// and the background dim/blur lives here — kept separate from
// script.js so it's easy to find and edit on its own.
//
// This file is a GENERIC ENGINE ONLY — it doesn't know about any
// particular story. Story content (what gets said, in what order,
// and what happens after) lives in story.js. That keeps this file
// reusable for any scene you build later.
// ================================

const dialogueOverlay = document.getElementById("dialogue-overlay");

if (dialogueOverlay) {
  const dialogueBox = document.getElementById("dialogue-box");
  const dialogueName = document.getElementById("dialogue-name");
  const dialogueText = document.getElementById("dialogue-text");
  const dialoguePortrait = document.getElementById("dialogue-portrait");

  // Expression filenames that have a matching idle animation in
  // dialogue.css (reaction-<name>). Keep this in sync with the
  // @keyframes react-* rules there.
  const PORTRAIT_REACTIONS = [
    "excited",
    "happy",
    "encourage",
    "surprised",
    "worried",
    "thinking",
    "neutral",
    "question",
  ];

  // Pull what the player actually typed/picked on the character select screen
  const playerName = localStorage.getItem("playerName") || "Player";
  const playerCharacter = localStorage.getItem("playerCharacter") || "boy";
  // Make these available for whatever story logic you build next
  window.lemonCornerPlayer = { name: playerName, character: playerCharacter };

  let typingInterval = null;
  let isTyping = false;

  // The current queue of lines being played, and what to call once
  // the whole queue has been shown and the box closes.
  let lineQueue = [];
  let onQueueDone = null;

  // Reveals text one letter at a time, like a classic visual novel.
  function typeText(text, speed = 28) {
    clearInterval(typingInterval);
    dialogueText.textContent = "";
    isTyping = true;

    let i = 0;
    typingInterval = setInterval(() => {
      dialogueText.textContent += text[i];
      i++;
      if (i >= text.length) {
        clearInterval(typingInterval);
        isTyping = false;
      }
    }, speed);
  }

  // Paints one line (speaker name + portrait + text) into the box.
  function renderLine(line) {
    dialogueName.textContent = line.speaker || playerName;
    dialogueText.dataset.fullText = line.text;

    if (dialoguePortrait) {
      if (line.portrait) {
        dialoguePortrait.src = line.portrait;
        dialoguePortrait.alt = line.speaker || "";
        dialoguePortrait.style.display = "block";

        // Figure out which animation to play, based on the
        // expression's filename (e.g. ".../finn/worried.png" -> "worried").
        const match = line.portrait.match(/([^/]+)\.png$/i);
        const reaction = match ? match[1].toLowerCase() : null;

        // Clear any previous reaction class first.
        dialoguePortrait.classList.remove(
          ...PORTRAIT_REACTIONS.map((r) => `reaction-${r}`)
        );

        if (reaction && PORTRAIT_REACTIONS.includes(reaction)) {
          // Wait a full paint frame before re-adding the class. This
          // guarantees the animation restarts even when the SAME
          // reaction plays on back-to-back lines — a plain reflow
          // trick (reading offsetWidth) isn't always enough to force
          // that in every browser/context, but two nested rAFs is.
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              dialoguePortrait.classList.add(`reaction-${reaction}`);
            });
          });
        }
      } else {
        dialoguePortrait.style.display = "none";
        dialoguePortrait.classList.remove(
          ...PORTRAIT_REACTIONS.map((r) => `reaction-${r}`)
        );
      }
    }

    typeText(line.text);
  }

  // Click handling: finish the typewriter instantly if it's still going,
  // otherwise move on to the next queued line. When the queue runs out,
  // hide the box and fire whatever callback was attached to this queue.
  function advance() {
    if (isTyping) {
      clearInterval(typingInterval);
      dialogueText.textContent = dialogueText.dataset.fullText || dialogueText.textContent;
      isTyping = false;
      return;
    }

    if (lineQueue.length > 0) {
      renderLine(lineQueue.shift());
      return;
    }

    hideDialogue();
    const done = onQueueDone;
    onQueueDone = null;
    if (typeof done === "function") done();
  }

  dialogueBox.addEventListener("click", advance);

  // Show a single line. `portrait` is an optional image path/URL.
  function showDialogue(name, text, portrait) {
    queueDialogue([{ speaker: name, text, portrait }]);
  }

  // Show a whole sequence of lines, one at a time, advancing on click.
  // `lines` is an array of { speaker, text, portrait } objects.
  // `onDone` (optional) fires once the last line has been dismissed.
  function queueDialogue(lines, onDone) {
    if (!Array.isArray(lines) || lines.length === 0) return;
    lineQueue = lines.slice();
    onQueueDone = typeof onDone === "function" ? onDone : null;
    dialogueOverlay.classList.add("visible");
    advance();
  }

  // Hide the dialogue box and undim/unblur the background.
  function hideDialogue() {
    dialogueOverlay.classList.remove("visible");
    clearInterval(typingInterval);
    isTyping = false;
  }

  // Make these callable from anywhere (story.js, other scenes later,
  // or the browser console for testing) like:
  //   lemonCornerDialogue.show("Leo", "Hello there!", "../images/portraits/leo-happy.png");
  //   lemonCornerDialogue.queue([{speaker:"Leo", text:"Hi!"}, {speaker:"Player", text:"Hey!"}], () => console.log("done"));
  //   lemonCornerDialogue.hide();
  window.lemonCornerDialogue = {
    show: showDialogue,
    queue: queueDialogue,
    hide: hideDialogue,
  };
}
