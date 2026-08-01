// ================================
// GLOBAL — runs on every page
// ================================

// Block dragging on every image, everywhere, no exceptions.
document.querySelectorAll("img").forEach((img) => {
  img.setAttribute("draggable", "false");
  img.addEventListener("dragstart", (e) => e.preventDefault());
});
document.addEventListener("dragstart", (e) => e.preventDefault());

// Fade the page IN as soon as it loads
window.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("page-visible");
});

// Fade the page OUT, then go to the next page once the fade finishes
function goToPage(url) {
  document.body.classList.add("page-leaving");
  setTimeout(() => {
    window.location.href = url;
  }, 350); // matches the transition time set in style.css
}


// ================================
// TITLE SCREEN (index.html)
// Only runs if a play button exists on the page
// ================================
const playButton = document.getElementById("play-button");

// Creates a little burst of sparkle particles around a click point
function spawnParticles(x, y) {
  const count = 12;
  for (let i = 0; i < count; i++) {
    const particle = document.createElement("div");
    particle.className = "particle";

    // send each particle flying in a random direction
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const distance = 40 + Math.random() * 40;
    particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;

    document.body.appendChild(particle);
    // clean up after the animation finishes so we don't clutter the page
    setTimeout(() => particle.remove(), 650);
  }
}

if (playButton) {
  playButton.addEventListener("click", (e) => {
    playButton.classList.add("pressed");
    spawnParticles(e.clientX, e.clientY);

    setTimeout(() => {
      goToPage("character-select.html");
    }, 300);
  });
}


// ================================
// CHARACTER SELECT (character-select.html)
// Only runs if the name input exists on the page
// ================================
const nameInput = document.getElementById("player-name");

if (nameInput) {
  const cards = document.querySelectorAll(".character-card");
  const confirmButton = document.getElementById("confirm-button");
  const backButton = document.getElementById("back-button");
  const backButtonImg = document.getElementById("back-button-img");
  let selectedCharacter = null;

  // Check if images/back-button.png actually exists.
  // If it loads successfully, switch the button to "image mode".
  // If not, it just quietly keeps showing the text version above.
  const imageCheck = new Image();
  imageCheck.onload = () => backButton.classList.add("has-image");
  imageCheck.onerror = () => backButton.classList.remove("has-image");
  imageCheck.src = backButtonImg.src;

  backButton.addEventListener("click", () => {
    backButton.classList.add("pressed");
    setTimeout(() => {
      goToPage("index.html");
    }, 150);
  });

  cards.forEach((card) => {
    card.addEventListener("click", () => {
      cards.forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      selectedCharacter = card.dataset.character;
      checkReady();
    });
  });

  nameInput.addEventListener("input", checkReady);

  function checkReady() {
    const nameEntered = nameInput.value.trim().length > 0;
    confirmButton.disabled = !(nameEntered && selectedCharacter);
  }

  confirmButton.addEventListener("click", () => {
    if (confirmButton.disabled) return;

    confirmButton.classList.add("pressed");

    const playerName = nameInput.value.trim();
    localStorage.setItem("playerName", playerName);
    localStorage.setItem("playerCharacter", selectedCharacter);

    setTimeout(() => {
      goToPage("game.html");
    }, 150);
  });
}


// ================================
// GAME PLACEHOLDER (game.html)
// Only runs if the game-placeholder screen exists
// ================================
const gamePlaceholder = document.getElementById("game-placeholder");

if (gamePlaceholder) {

  // Reusable helper: checks if a button's PNG actually exists.
  // If it loads, the button switches to "image mode" (see CSS .has-image).
  // If not, it keeps showing its simple placeholder shape/text.
  function setupImageButton(buttonEl) {
    const img = buttonEl.querySelector("img");
    if (!img) return;

    const check = new Image();
    check.onload = () => buttonEl.classList.add("has-image");
    check.onerror = () => buttonEl.classList.remove("has-image");
    check.src = img.src;
  }

  // Same idea, but for the lemon-stock/coins pills (divs, not buttons)
  function setupImageDisplay(displayEl) {
    const img = displayEl.querySelector("img");
    if (!img) return;

    const check = new Image();
    check.onload = () => displayEl.classList.add("has-image");
    check.onerror = () => displayEl.classList.remove("has-image");
    check.src = img.src;
  }

  // Wire up all five UI pieces
  const menuButton = document.getElementById("menu-button");
  const triviaButton = document.getElementById("trivia-button");
  const lemonStockDisplay = document.getElementById("lemon-stock-display");
  const coinsDisplay = document.getElementById("coins-display");

  [menuButton, triviaButton].forEach(setupImageButton);
  [lemonStockDisplay, coinsDisplay].forEach(setupImageDisplay);

  // Simple "press" animation helper, reused by all three buttons
  function pressAnimation(button) {
    button.classList.add("pressed");
    setTimeout(() => button.classList.remove("pressed"), 150);
  }

  menuButton.addEventListener("click", () => {
    pressAnimation(menuButton);
    // Menu popup logic lives in story.js, which attaches its own click
    // listener to this same button — this listener just handles the
    // visual "press" feedback.
  });

  triviaButton.addEventListener("click", () => {
    pressAnimation(triviaButton);
    // Lesson + quiz popup logic lives in story.js, which attaches its
    // own click listener to this same button — this listener just
    // handles the visual "press" feedback.
  });


  // ---- Lemonade stand items: pitcher + cups ----
  const pitcherBtn = document.getElementById("pitcher-btn");
  const cupsBtn = document.getElementById("cups-btn");

  pitcherBtn.addEventListener("click", (e) => {
    pressAnimation(pitcherBtn);
    spawnParticles(e.clientX, e.clientY);
    // Popup + game logic for the pitcher (fill/buy lemons) lives in
    // story.js, which attaches its own click listener to this same
    // button — this listener just handles the visual feedback.
  });

  cupsBtn.addEventListener("click", (e) => {
    pressAnimation(cupsBtn);
    spawnParticles(e.clientX, e.clientY);
    // Popup + shop logic for cups lives in story.js, which attaches
    // its own click listener to this same button — this listener
    // just handles the visual feedback.
  });


  // ---- Live lemon stock & coins ----
  // This is the "game state" for now. Update these numbers from
  // anywhere in your game code and the display updates automatically.
  // Starting values match the Day 1 opening story (see story.js):
  // no lemons yet, $15 in savings.
  const gameState = {
    lemonStock: 0,
    coins: 10,
  };

  const lemonStockText = document.getElementById("lemon-stock-text");
  const coinsText = document.getElementById("coins-text");

  function updateLemonStock(newAmount) {
    gameState.lemonStock = newAmount;
    lemonStockText.textContent = gameState.lemonStock;
  }

  function updateCoins(newAmount) {
    gameState.coins = newAmount;
    coinsText.textContent = `$${gameState.coins}`;
  }

  // Make these callable from anywhere (e.g. the browser console, or
  // other game logic you add later) like:
  //   lemonCornerGame.updateCoins(50);
  //   lemonCornerGame.updateLemonStock(7);
  window.lemonCornerGame = { gameState, updateLemonStock, updateCoins };

  // Show the starting numbers right away
  updateLemonStock(gameState.lemonStock);
  updateCoins(gameState.coins);
}
