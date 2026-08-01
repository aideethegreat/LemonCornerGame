// ================================
// DIALOGUE SYSTEM
// All logic for the dialogue box, portraits, typewriter text effect,
// and the background dim/blur lives here — kept separate from
// script.js so it's easy to find and edit on its own.
// ================================

const dialogueOverlay = document.getElementById("dialogue-overlay");

if (dialogueOverlay) {
  const dialogueBox = document.getElementById("dialogue-box");
  const dialogueName = document.getElementById("dialogue-name");
  const dialogueText = document.getElementById("dialogue-text");

  // Pull what the player actually typed/picked on the character select screen
  const playerName = localStorage.getItem("playerName") || "Player";
  const playerCharacter = localStorage.getItem("playerCharacter") || "boy";
  // Make these available for whatever story logic you build next
  window.lemonCornerPlayer = { name: playerName, character: playerCharacter };


  let typingInterval = null;
  let isTyping = false;

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

  // If the player clicks while text is still typing, finish it instantly
  // instead of making them wait — feels much better to play.
  dialogueBox.addEventListener("click", () => {
    if (isTyping) {
      clearInterval(typingInterval);
      dialogueText.textContent = dialogueText.dataset.fullText || dialogueText.textContent;
      isTyping = false;
    }
    // (once you have a script of lines, this click can also advance
    // to the next line — hook that up here later)
  });

  // Show the dialogue box with a given speaker name + line of text.
  // The background dims/blurs automatically (see dialogue.css).
  function showDialogue(name, text) {
    dialogueName.textContent = name || playerName;
    dialogueText.dataset.fullText = text;
    dialogueOverlay.classList.add("visible");
    typeText(text);
  }

  // Hide the dialogue box and undim/unblur the background.
  function hideDialogue() {
    dialogueOverlay.classList.remove("visible");
    clearInterval(typingInterval);
  }

  // Make these callable from anywhere (e.g. your future story script,
  // or the browser console for testing) like:
  //   lemonCornerDialogue.show("Mia", "Welcome to our lemonade stand!");
  //   lemonCornerDialogue.hide();
  window.lemonCornerDialogue = { show: showDialogue, hide: hideDialogue };

  // ---- Story trigger: fires as soon as character select is done ----
  // (game.html only ever loads right after that step, so this IS the trigger)
  const partnerName = playerCharacter === "boy" ? "Lena" : "Finn";

  showDialogue(
    partnerName,
    `Welcome to Lemon Corner, ${playerName}! Ready to run our little lemonade stand together?`
  );
}
