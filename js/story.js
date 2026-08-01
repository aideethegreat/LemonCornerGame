// ================================
// STORY: Day 1 — Opening Lemon Corner
// This file holds the actual scripted content and game logic for the
// opening scene. It uses window.lemonCornerDialogue (see dialogue.js)
// to play lines, and drives the pitcher + lemon shop popups.
//
// GAME STATE — IMPORTANT
// Lemon stock and coins are NOT tracked here. script.js already owns
// that (window.lemonCornerGame.gameState / updateLemonStock / updateCoins)
// and keeps the top-right display in sync. This file just reads and
// writes through that existing API so there's only one source of truth.
//
// PORTRAIT IMAGES
// Each character has its own folder with one file per expression:
//   images/finn/celebrate.png  images/finn/agree.png    images/finn/question.png
//   images/finn/encourage.png  images/finn/worried.png  images/finn/surprised.png
//   images/finn/happy.png      images/finn/thinking.png images/finn/excited.png
//   images/finn/neutral.png
//   images/lena/... (same file names, assumed to mirror Finn's set)
// Since either character can end up as "player" or "helper" depending on
// who's picked, both folders need the full set.
//
// images/marice/... — the traveling customer from the Day 1 "broke"
// beat below. She asks her own simple money question (age 5-8 level,
// no offscreen kid involved) and only needs a handful of expressions:
//   images/marice/happy.png  images/marice/thinking.png
//   images/marice/encourage.png  images/marice/excited.png
//
// This story's lines were originally written around a couple of
// expressions that don't exist as separate files here — "pointing" and
// "encouraging" both map to encourage.png below, and "questioning" maps
// to question.png. Edit EXPRESSION_FILE if you'd rather split those out
// once you have art for them.
// ================================

(function () {
  // Maps the internal "boy"/"girl" character keys to their image folder.
  const FOLDER = { boy: "finn", girl: "lena" };

  // Maps the semantic expression names used in the dialogue lines below
  // to the actual filenames that exist in images/finn/ and images/lena/.
  const EXPRESSION_FILE = {
    excited: "excited",
    happy: "happy",
    encouraging: "encourage",
    surprised: "surprised",
    worried: "worried",
    thinking: "thinking",
    neutral: "neutral",
    questioning: "question",
  };

  function portrait(characterKey, expression) {
    const folder = FOLDER[characterKey];
    const file = EXPRESSION_FILE[expression] || expression;
    return `../images/${folder}/${file}.png`;
  }

  // ---- Work out who's the player and who's the helper ------------------
  // Matches the data-character values and names from character-select.html.
  const CHARACTERS = { boy: "Finn", girl: "Lena" };

  const rawChoice = (window.lemonCornerPlayer.character || "boy").toLowerCase();
  const playerKey = CHARACTERS[rawChoice] ? rawChoice : "boy"; // safe fallback
  const helperKey = playerKey === "boy" ? "girl" : "boy";

  const playerDisplayName = window.lemonCornerPlayer.name; // typed name, e.g. "Aidee"
  const helperDisplayName = CHARACTERS[helperKey]; // "Finn" or "Lena" — whichever wasn't picked

  function playerPortrait(expression) {
    return portrait(playerKey, expression);
  }
  function helperPortrait(expression) {
    return portrait(helperKey, expression);
  }
  function maricePortrait(expression) {
    const file = EXPRESSION_FILE[expression] || expression;
    return `../images/marice/${file}.png`;
  }

  // ---- Game state — reads/writes through script.js's existing API ------
  const game = window.lemonCornerGame; // set up by script.js before this file runs

  function currentLemons() {
    return game.gameState.lemonStock;
  }
  function currentCoins() {
    return game.gameState.coins;
  }

  // Tracks story beats that aren't part of script.js's coin/lemon state:
  // whether the pitcher has been filled, whether cups have been secured
  // (bought OR gifted by Marice), and whether Marice's whole event has
  // already played out (so she doesn't show up twice).
  let pitcherFilled = false;
  let cupsOwned = false;
  let mariceResolved = false;

  // Which flow the Marice quiz/reward popups are currently serving —
  // "shop" for the Day-1 can't-afford-cups event, "customer" for her
  // Day-2+ walk-up-customer appearance. The shared finish logic
  // (finishMariceEvent, handleMariceAnswer) branches on this so each
  // context wraps up correctly (resume the day's customer loop vs.
  // the Day-1 open-sign intro).
  let mariceEventContext = "shop";

  // True only while Marice herself is the one standing at the
  // counter (see maybeSpawnMariceCustomer in randomCustomer() and the
  // branch in finishOrder()) — guards against picking her twice while
  // her own encounter is still playing out.
  let isMariceCustomerActive = false;

  // Becomes true the moment the "let's open!" beat has played and the
  // sign has been revealed/highlighted. Stops that intro from firing
  // twice if pitcher-filled and cups-owned both become true more than
  // once in a row (e.g. redirectIfWrongReward round-trips).
  let signShown = false;

  // Tracks the sign itself: false = showing the Closed art, true =
  // showing the Open art. Flipping it closed->open is what starts
  // Day 1 (see the sign-btn click handler below).
  let signOpen = false;

  // Gates for flipping the sign back to Closed. Both need to be true
  // before the player's allowed to close up — can't close if nothing's
  // been sold, and can't close mid-day either. Neither exists yet
  // since the selling loop isn't built — TODO: have that loop set
  // hasSoldToday to true after the first sale, and dayComplete to true
  // once the day's customers are done.
  let hasSoldToday = false;
  let dayComplete = false;

  // Becomes true the first time the pitcher gets filled. Before that,
  // the pitcher popup behaves like the scripted tutorial: Fill Pitcher
  // is shown first, and Buy Lemons only appears after the player
  // discovers (by clicking Fill) that they're short on lemons. After
  // that first fill, the popup switches to "smart" mode — it picks
  // Fill or Buy automatically based on current lemon stock, no need
  // to click Fill first to find out.
  let pitcherIntroDone = false;

  // Becomes true the first time the "we don't have enough lemons"
  // explainer dialogue has played. If the player clicks Fill again
  // after that (instead of Buy Lemons), they get a short reminder
  // line instead of hearing the whole explanation a second time.
  let lemonExplainerShown = false;

  // Becomes true the first time a lemon purchase goes through. Used to
  // stop the player from exiting the Lemon Shop empty-handed the very
  // first time it's introduced — see shopPopupClose below.
  let lemonShopPurchased = false;

  // Cup rack isn't clickable until the tutorial actually introduces it
  // (right after the pitcher gets filled — see the "Click the cup
  // rack!" dialogue further down). Keeps the pitcher-first tutorial
  // order enforced instead of the player wandering off to cups early.
  let cupsUnlocked = false;

  // ---- Popup elements ----------------------------------------------------
  const pitcherPopup = document.getElementById("pitcher-popup");
  const pitcherPopupStock = document.getElementById("pitcher-popup-stock");
  const fillPitcherBtn = document.getElementById("fill-pitcher-btn");
  const buyLemonsBtn = document.getElementById("buy-lemons-btn");
  const pitcherPopupClose = document.getElementById("pitcher-popup-close");

  const shopPopup = document.getElementById("shop-popup");
  const shopPopupClose = document.getElementById("shop-popup-close");
  const shopPopupLemonStock = document.getElementById("shop-popup-lemon-stock");
  const storeBuyBtns = document.querySelectorAll(".store-buy-btn");

  // Keeps the "Your Lemons: X" overlay on the shop template in sync.
  // Called right before the popup opens, and again after any purchase.
  function refreshShopStock() {
    if (shopPopupLemonStock) shopPopupLemonStock.textContent = currentLemons();
  }

  const cupShopPopup = document.getElementById("cup-shop-popup");
  const cupShopPopupClose = document.getElementById("cup-shop-popup-close");
  const cupStoreBuyBtns = document.querySelectorAll(".cup-store-buy-btn");

  const pitcherBtn = document.getElementById("pitcher-btn");
  const cupsBtn = document.getElementById("cups-btn");

  const mariceQuizPopup = document.getElementById("marice-quiz-popup");
  const mariceQuizQuestion = document.getElementById("marice-quiz-question");
  const mariceQuizChoices = document.getElementById("marice-quiz-choices");

  const mariceRewardPopup = document.getElementById("marice-reward-popup");
  const mariceRewardCupsBtn = document.getElementById("marice-reward-cups-btn");
  const mariceRewardLemonsBtn = document.getElementById(
    "marice-reward-lemons-btn",
  );

  const mariceLemonadePopup = document.getElementById("marice-lemonade-popup");
  const mariceLemonadeYesBtn = document.getElementById(
    "marice-lemonade-yes-btn",
  );
  const mariceLemonadeNoBtn = document.getElementById("marice-lemonade-no-btn");

  const signBtn = document.getElementById("sign-btn");
  const dayBanner = document.getElementById("day-banner");
  const dayBannerText = document.getElementById("day-banner-text");

  const customerSlot = document.getElementById("customer-slot");
  const customerSprite = document.getElementById("customer-sprite");
  const orderBubble = document.getElementById("order-bubble");
  const orderBubbleText = document.getElementById("order-bubble-text");
  const servedCupsGrid = document.getElementById("served-cups");
  const duskBackground = document.getElementById("dusk-background");
  if (duskBackground) {
    duskBackground.addEventListener("error", () => {
      console.error(
        "[Lemon Corner] dusk-background.png failed to load — check it exists at images/dusk-background.png",
      );
    });
  }

  function openPopup(popupEl) {
    if (popupEl) popupEl.classList.add("visible");
  }
  function closePopup(popupEl) {
    if (popupEl) popupEl.classList.remove("visible");
  }

  function openPitcherPopup() {
    // Pitcher's already full and ready to pour. If cups are out
    // waiting to be filled, each click now fills one of them instead;
    // otherwise there's nothing to buy/fill, so skip the popup.
    if (pitcherFilled) {
      fillCupForOrder();
      return;
    }

    if (pitcherPopupStock) pitcherPopupStock.textContent = currentLemons();

    if (pitcherIntroDone) {
      // Smart mode: show whichever button actually applies right now.
      const hasEnoughLemons = currentLemons() >= 5;
      if (fillPitcherBtn) fillPitcherBtn.hidden = !hasEnoughLemons;
      if (buyLemonsBtn) buyLemonsBtn.hidden = hasEnoughLemons;
    }
    // Else: still in the tutorial — leave the buttons exactly as the
    // scripted beats have set them (Fill shown first; Buy revealed
    // only after the "not enough lemons" dialogue plays out).

    openPopup(pitcherPopup);
  }

  if (pitcherPopupClose) {
    pitcherPopupClose.addEventListener("click", () => {
      closePopup(pitcherPopup);
      // Exited without filling it — re-highlight the pitcher so it's
      // still obvious what to do next.
      if (!pitcherFilled && pitcherBtn) {
        pitcherBtn.classList.add("highlight-pulse");
      }
    });
  }
  if (shopPopupClose) {
    shopPopupClose.addEventListener("click", () => {
      // First time the shop's open and nothing's been bought yet —
      // don't let them wander off empty-handed. Dialogue plays right
      // over the still-open shop popup (see z-index note in story.css).
      if (!lemonShopPurchased) {
        window.lemonCornerDialogue.queue([
          {
            speaker: helperDisplayName,
            portrait: helperPortrait("worried"),
            text: "We should buy some lemons first! :<",
          },
        ]);
        return;
      }
      closePopup(shopPopup);
    });
  }
  if (cupShopPopupClose) {
    cupShopPopupClose.addEventListener("click", () => closePopup(cupShopPopup));
  }

  // ---- Store data ---------------------------------------------------------
  // Prices and offer sizes are randomized each time a shop is opened (see
  // randomizeStores / randomizeCupStores below). MIN_OFFER is the floor for
  // how many lemons/cups a store can offer; prices are always capped so
  // they never exceed the coins the player currently has.
  const MIN_OFFER = 5;
  const MAX_OFFER = 12;

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Rolls a random price that never exceeds the player's current coins
  // (falls back to 1 if the player is flat broke, since a store can't
  // sensibly offer something for $0).
  function randomPrice(maxAffordable) {
    // Prices are capped by the player's coins, but never free — a $0
    // item isn't a real lesson in spending. If the player can't afford
    // even $1, the store just stays out of reach until they earn more
    // (via the trivia quiz) or Marice shows up with free stock.
    const cap = Math.max(1, Math.min(maxAffordable, 20));
    return randInt(1, cap);
  }

  const STORES = {
    sunny: { name: "Sunny Farm", price: 10, lemons: 5 },
    golden: { name: "Golden Orchard", price: 15, lemons: 5 },
  };

  const shopOfferLeftLemonEl = document.getElementById("shop-offer-left-lemon");
  const shopOfferLeftPriceEl = document.getElementById("shop-offer-left-price");
  const shopOfferRightLemonEl = document.getElementById(
    "shop-offer-right-lemon",
  );
  const shopOfferRightPriceEl = document.getElementById(
    "shop-offer-right-price",
  );

  // Re-rolls both lemon stores' offer (lemon count) and price, keeping the
  // right-hand ("premium") store at least as expensive as the left-hand
  // one so the cheap-vs-pricier reaction lines still make sense. Prices
  // are capped by the player's current coins; offers never drop below
  // MIN_OFFER lemons.
  //
  // EXCEPTION — the very first visit (before lemonShopPurchased): both
  // stores are priced at EXACTLY the player's current coins, no matter
  // which one they pick. That guarantees they spend every coin on
  // lemons, so they're broke by the time they hit the cup shop right
  // after — which is what reliably triggers Marice's introduction.
  function randomizeStores() {
    const coins = currentCoins();

    STORES.sunny.lemons = randInt(MIN_OFFER, MAX_OFFER);
    STORES.golden.lemons = randInt(MIN_OFFER, MAX_OFFER);

    if (!lemonShopPurchased && coins >= 1) {
      STORES.sunny.price = coins;
      STORES.golden.price = coins;
    } else {
      const priceA = randomPrice(coins);
      const priceB = randomPrice(coins);
      STORES.sunny.price = Math.min(priceA, priceB);
      STORES.golden.price = Math.max(priceA, priceB);
    }

    if (shopOfferLeftLemonEl) {
      shopOfferLeftLemonEl.textContent = `${STORES.sunny.lemons} Lemons`;
    }
    if (shopOfferLeftPriceEl) {
      shopOfferLeftPriceEl.textContent = `$${STORES.sunny.price}`;
    }
    if (shopOfferRightLemonEl) {
      shopOfferRightLemonEl.textContent = `${STORES.golden.lemons} Lemons`;
    }
    if (shopOfferRightPriceEl) {
      shopOfferRightPriceEl.textContent = `$${STORES.golden.price}`;
    }
  }

  storeBuyBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const store = STORES[btn.dataset.store];
      if (!store) return;

      if (currentCoins() < store.price) {
        window.lemonCornerDialogue.queue([
          {
            speaker: helperDisplayName,
            portrait: helperPortrait("worried"),
            text: `We don't have enough for ${store.name} — that one's $${store.price}.`,
          },
        ]);
        return;
      }

      game.updateCoins(currentCoins() - store.price);
      game.updateLemonStock(currentLemons() + store.lemons);
      lemonShopPurchased = true;
      refreshShopStock();

      closePopup(shopPopup);

      // Different reaction depending on whether they picked the
      // pricier store, the cheaper one, or (first visit only) both
      // stores cost the exact same, since price is pinned to their
      // coins that one time.
      const allPrices = Object.values(STORES).map((s) => s.price);
      const pricesTied = allPrices.every((p) => p === allPrices[0]);
      const isPricier =
        !pricesTied && store.price === Math.max(...allPrices);

      const reactionLine = pricesTied
        ? {
            speaker: helperDisplayName,
            portrait: helperPortrait("happy"),
            text: "Alright, that's all our coins spent on lemons — let's make it count!",
          }
        : isPricier
          ? {
              speaker: helperDisplayName,
              portrait: helperPortrait("worried"),
              text: "That one cost more, but at least we've got our lemons now!",
            }
          : {
              speaker: helperDisplayName,
              portrait: helperPortrait("happy"),
              text: "Nice, going with the cheaper store saved us some coins!",
            };

      window.lemonCornerDialogue.queue([reactionLine], () => {
        // Now that lemons are in stock, the pitcher popup should offer
        // Fill again, not Buy.
        if (buyLemonsBtn) buyLemonsBtn.hidden = true;
        openPitcherPopup();
      });
    });
  });

  // ---- Cup shop -----------------------------------------------------------
  const CUP_STORES = {
    party: { name: "Party Supplies Co.", price: 5, cups: 10 },
    deluxe: { name: "Deluxe Dinnerware", price: 8, cups: 10 },
  };

  const cupShopOfferLeftLemonEl = document.getElementById(
    "cup-shop-offer-left-lemon",
  );
  const cupShopOfferLeftPriceEl = document.getElementById(
    "cup-shop-offer-left-price",
  );
  const cupShopOfferRightLemonEl = document.getElementById(
    "cup-shop-offer-right-lemon",
  );
  const cupShopOfferRightPriceEl = document.getElementById(
    "cup-shop-offer-right-price",
  );

  // Same idea as randomizeStores() above, but for the cup shop.
  function randomizeCupStores() {
    const coins = currentCoins();

    CUP_STORES.party.cups = randInt(MIN_OFFER, MAX_OFFER);
    CUP_STORES.deluxe.cups = randInt(MIN_OFFER, MAX_OFFER);

    const priceA = randomPrice(coins);
    const priceB = randomPrice(coins);
    CUP_STORES.party.price = Math.min(priceA, priceB);
    CUP_STORES.deluxe.price = Math.max(priceA, priceB);

    if (cupShopOfferLeftLemonEl) {
      cupShopOfferLeftLemonEl.textContent = `${CUP_STORES.party.cups} Cups`;
    }
    if (cupShopOfferLeftPriceEl) {
      cupShopOfferLeftPriceEl.textContent = `$${CUP_STORES.party.price}`;
    }
    if (cupShopOfferRightLemonEl) {
      cupShopOfferRightLemonEl.textContent = `${CUP_STORES.deluxe.cups} Cups`;
    }
    if (cupShopOfferRightPriceEl) {
      cupShopOfferRightPriceEl.textContent = `$${CUP_STORES.deluxe.price}`;
    }
  }

  if (cupsBtn) {
    cupsBtn.addEventListener("click", () => {
      // Tutorial hasn't introduced cups yet — pitcher comes first.
      if (!cupsUnlocked) return;

      cupsBtn.classList.remove("highlight-pulse");

      // Cups already secured. If there's an active order, each click
      // now serves one empty cup toward it; otherwise there's nothing
      // to buy, so skip the shop popup entirely.
      if (cupsOwned) {
        serveCupForOrder();
        return;
      }

      // Re-roll the offers before deciding whether the player can even
      // afford to browse, so cheapestCup reflects this visit's prices.
      randomizeCupStores();

      const cheapestCup = Math.min(
        ...Object.values(CUP_STORES).map((s) => s.price),
      );
      if (!mariceResolved && currentCoins() < cheapestCup) {
        startMariceEvent();
        return;
      }

      openPopup(cupShopPopup);
    });
  }

  cupStoreBuyBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const store = CUP_STORES[btn.dataset.cupstore];
      if (!store) return;

      if (currentCoins() < store.price) {
        window.lemonCornerDialogue.queue([
          {
            speaker: helperDisplayName,
            portrait: helperPortrait("worried"),
            text: `We don't have enough for ${store.name} — that one's $${store.price}.`,
          },
        ]);
        return;
      }

      game.updateCoins(currentCoins() - store.price);
      cupsOwned = true;
      closePopup(cupShopPopup);

      if (cupsBtn) {
        cupsBtn.src = "../images/cups.png";
        cupsBtn.classList.remove("cup-fill-pop");
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            cupsBtn.classList.add("cup-fill-pop");
          });
        });
      }

      // Same compare-and-choose reaction pattern as the lemon shop.
      const isPricier =
        store.price ===
        Math.max(...Object.values(CUP_STORES).map((s) => s.price));

      const reactionLine = isPricier
        ? {
            speaker: helperDisplayName,
            portrait: helperPortrait("worried"),
            text: "Those were the pricier cups, but they'll look nice on the stand!",
          }
        : {
            speaker: helperDisplayName,
            portrait: helperPortrait("happy"),
            text: "Good call — the cheaper cups work just as well!",
          };

      window.lemonCornerDialogue.queue([reactionLine], maybeIntroduceSign);
    });
  });

  // ---- Marice: the traveling customer with a simple money question ------
  // Two ways this can start:
  //  1. "shop" context — player can't afford ANY cup store on Day 1.
  //     Wrong answers replay through Marice (portrait + text) and the
  //     SAME question reopens so they can try again.
  //  2. "customer" context — starting Day 2, she has a chance to show
  //     up as a regular walk-up customer instead (see
  //     maybeSpawnMariceCustomer/startMariceCustomerQuiz). She's served
  //     like anyone else first; once her order's delivered she reveals
  //     herself and asks one question. A wrong answer here does NOT
  //     get a retry — she just explains the answer and leaves.
  // Either way it can only happen once total (mariceResolved), and a
  // correct answer leads to the same reward choice — free cups or free
  // lemons — with the same follow-up lemonade offer if that choice
  // leaves them with a full pitcher AND cups in hand.
  //
  // These are Marice's own questions, kept simple enough for a 5-8 year
  // old — small numbers, everyday words, no accounting jargon.
  const MARICE_QUESTIONS = [
    {
      question:
        "If we spend $10 on lemons and $5 on cups, how much did we spend altogether?",
      choices: ["$10", "$15", "$5"],
      correct: 1,
      hint: "Put both amounts together: $10 and $5 more.",
    },
    {
      question:
        "A cup of lemonade sells for $2, and it costs $1 to make. How much do we get to keep?",
      choices: ["$1", "$2", "$3"],
      correct: 0,
      hint: "Take away what it cost from what it sold for: $2 take away $1.",
    },
    {
      question:
        "We had $10, and spent all of it on lemons. How much money is left?",
      choices: ["$10", "$5", "$0"],
      correct: 2,
      hint: "If we spend every single dollar, there's none left over.",
    },
    {
      question: "What do we call money we GET from selling lemonade?",
      choices: ["Spending", "Earning", "Losing"],
      correct: 1,
      hint: "It's the word for money that comes TO you when you sell something.",
    },
    {
      question:
        "What do we call money we PAY to buy things like lemons and cups?",
      choices: ["Earning", "Saving", "Spending"],
      correct: 2,
      hint: "It's the word for money that goes AWAY from you to buy something.",
    },
    {
      question: "Cups cost $5, and we have $0 right now. Can we buy them?",
      choices: ["Yes", "No", "Maybe"],
      correct: 1,
      hint: "We'd need at least $5, and right now we have none of that.",
    },
  ];

  let currentMariceQuestion = null;

  function startMariceEvent() {
    if (mariceResolved) return;
    mariceEventContext = "shop";

    window.lemonCornerDialogue.queue(
      [
        {
          speaker: helperDisplayName,
          portrait: helperPortrait("worried"),
          text: "Uh oh... we don't have enough coins for cups either.",
        },
        {
          speaker: playerDisplayName,
          portrait: playerPortrait("worried"),
          text: "What are we going to do now? We've spent all our money on lemonade!",
        },
        {
          speaker: "Marice",
          portrait: maricePortrait("happy"),
          text: "Wow, it's the perfect time! I saw you two having trouble stocking lemons and cups.",
        },
        {
          speaker: "Marice",
          portrait: maricePortrait("thinking"),
          text: "I'm a student, and I could really use some help with my accounting homework.",
        },
        {
          speaker: "Marice",
          portrait: maricePortrait("encourage"),
          text: "Help me out, and I'll give you free lemons or cups in return!",
        },
      ],
      openMariceQuiz,
    );
  }

  function openMariceQuiz() {
    currentMariceQuestion =
      MARICE_QUESTIONS[Math.floor(Math.random() * MARICE_QUESTIONS.length)];
    renderMariceQuiz();
    openPopup(mariceQuizPopup);
  }

  // Reopens the SAME question after a wrong answer (no re-roll), so the
  // hint they just heard still applies to what's on screen.
  function reopenMariceQuiz() {
    renderMariceQuiz();
    openPopup(mariceQuizPopup);
  }

  function renderMariceQuiz() {
    if (mariceQuizQuestion)
      mariceQuizQuestion.textContent = currentMariceQuestion.question;
    if (!mariceQuizChoices) return;

    mariceQuizChoices.innerHTML = "";
    currentMariceQuestion.choices.forEach((choice, index) => {
      const btn = document.createElement("button");
      btn.className = "popup-btn";
      btn.textContent = choice;
      btn.addEventListener("click", () => handleMariceAnswer(index));
      mariceQuizChoices.appendChild(btn);
    });
  }

  function handleMariceAnswer(index) {
    closePopup(mariceQuizPopup);

    if (index === currentMariceQuestion.correct) {
      window.lemonCornerDialogue.queue(
        [
          {
            speaker: "Marice",
            portrait: maricePortrait("excited"),
            text: "That's exactly right! You two are naturals.",
          },
        ],
        openMariceReward,
      );
      return;
    }

    if (mariceEventContext === "customer") {
      // No retry in this version — she just tells them the right
      // answer, explains it once, and heads off with her lemonade.
      const correctAnswerText =
        currentMariceQuestion.choices[currentMariceQuestion.correct];

      window.lemonCornerDialogue.queue(
        [
          {
            speaker: "Marice",
            portrait: maricePortrait("thinking"),
            text: `Aw, not quite — the answer was ${correctAnswerText}.`,
          },
          {
            speaker: "Marice",
            portrait: maricePortrait("encourage"),
            text: currentMariceQuestion.hint,
          },
          {
            speaker: "Marice",
            portrait: maricePortrait("happy"),
            text: "That's okay — thanks for the lemonade, I should get going!",
          },
        ],
        finishMariceEvent,
      );
      return;
    }

    // Wrong answer — Marice teaches through an actual dialogue line
    // (portrait + text), not a quiet popup hint, then the same
    // question comes right back so they can try again.
    window.lemonCornerDialogue.queue(
      [
        {
          speaker: "Marice",
          portrait: maricePortrait("thinking"),
          text: currentMariceQuestion.hint,
        },
        {
          speaker: "Marice",
          portrait: maricePortrait("encourage"),
          text: "Want to try again?",
        },
      ],
      reopenMariceQuiz,
    );
  }

  function openMariceReward() {
    openPopup(mariceRewardPopup);
  }

  // Figures out which reward actually helps right now, so we can catch
  // the player picking the "wrong" one for their current state:
  //   - pitcher already full + no cups yet  -> they need CUPS, not lemons.
  //   - cups already in hand + pitcher empty -> they need LEMONS, not cups.
  // (cupsOwned is always false when Marice's event starts, so today that
  // second case can't actually trigger — but it's here so the same check
  // keeps working correctly if that ever changes.)
  function redirectIfWrongReward(pickedReward) {
    const needsCups = pitcherFilled && !cupsOwned;
    const needsLemons = !pitcherFilled && cupsOwned;

    if (pickedReward === "lemons" && needsCups) {
      window.lemonCornerDialogue.queue(
        [
          {
            speaker: helperDisplayName,
            portrait: helperPortrait("thinking"),
            text: "Wait — our pitcher's already full of lemonade!",
          },
          {
            speaker: helperDisplayName,
            portrait: helperPortrait("worried"),
            text: "More lemons won't help right now — we need cups instead.",
          },
          {
            speaker: "Marice",
            portrait: maricePortrait("encourage"),
            text: "No trouble — pick whichever one actually helps you!",
          },
        ],
        openMariceReward,
      );
      return true;
    }

    if (pickedReward === "cups" && needsLemons) {
      window.lemonCornerDialogue.queue(
        [
          {
            speaker: helperDisplayName,
            portrait: helperPortrait("thinking"),
            text: "Wait — we already have cups!",
          },
          {
            speaker: helperDisplayName,
            portrait: helperPortrait("worried"),
            text: "More cups won't help right now — we need lemons instead.",
          },
          {
            speaker: "Marice",
            portrait: maricePortrait("encourage"),
            text: "No trouble — pick whichever one actually helps you!",
          },
        ],
        openMariceReward,
      );
      return true;
    }

    return false;
  }

  if (mariceRewardCupsBtn) {
    mariceRewardCupsBtn.addEventListener("click", () => {
      closePopup(mariceRewardPopup);
      if (redirectIfWrongReward("cups")) return;

      cupsOwned = true;

      if (cupsBtn) {
        cupsBtn.src = "../images/cups.png";
        cupsBtn.classList.remove("cup-fill-pop");
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            cupsBtn.classList.add("cup-fill-pop");
          });
        });
      }

      window.lemonCornerDialogue.queue(
        [
          {
            speaker: "Marice",
            portrait: maricePortrait("happy"),
            text: "Here you go — a free stack of cups!",
          },
          {
            speaker: helperDisplayName,
            portrait: helperPortrait("excited"),
            text: "Wow, thank you so much, Marice!",
          },
        ],
        afterMariceReward,
      );
    });
  }

  if (mariceRewardLemonsBtn) {
    mariceRewardLemonsBtn.addEventListener("click", () => {
      closePopup(mariceRewardPopup);
      if (redirectIfWrongReward("lemons")) return;

      game.updateLemonStock(currentLemons() + 5);

      window.lemonCornerDialogue.queue(
        [
          {
            speaker: "Marice",
            portrait: maricePortrait("happy"),
            text: "Here you go — a free bag of lemons!",
          },
          {
            speaker: helperDisplayName,
            portrait: helperPortrait("excited"),
            text: "Thank you, Marice!",
          },
        ],
        afterMariceReward,
      );
    });
  }

  function afterMariceReward() {
    // Only offer her a lemonade if that's actually possible — a full
    // pitcher AND cups in hand. If they picked free lemons instead of
    // cups, they still can't pour her one, so skip straight to the
    // goodbye.
    if (pitcherFilled && cupsOwned) {
      openPopup(mariceLemonadePopup);
    } else {
      mariceGoodbye(finishMariceEvent);
    }
  }

  // Marice's farewell — plays right before she's marked resolved, no
  // matter which path got her there (lemonade poured, lemonade
  // declined, or skipped straight past the lemonade offer). Leaves
  // the door open for her to show up again later: she'll trade free
  // lemons or cups for help with her homework again.
  function mariceGoodbye(nextStep) {
    window.lemonCornerDialogue.queue(
      [
        {
          speaker: "Marice",
          portrait: maricePortrait("happy"),
          text: "I'll come by again sometime!",
        },
        {
          speaker: "Marice",
          portrait: maricePortrait("encourage"),
          text: "If you ever need free lemons or cups, here's my number — just give me a call!",
        },
        {
          speaker: "Marice",
          portrait: maricePortrait("happy"),
          text: "All I ask in return is a little help with my homework again. Deal?",
        },
      ],
      nextStep,
    );
  }

  if (mariceLemonadeYesBtn) {
    mariceLemonadeYesBtn.addEventListener("click", () => {
      closePopup(mariceLemonadePopup);
      window.lemonCornerDialogue.queue(
        [
          {
            speaker: playerDisplayName,
            portrait: playerPortrait("happy"),
            text: "Here's a fresh cup of lemonade, on the house!",
          },
          {
            speaker: "Marice",
            portrait: maricePortrait("excited"),
            text: "Mmm, delicious! Thank you both — good luck today!",
          },
        ],
        () => mariceGoodbye(finishMariceEvent),
      );
    });
  }

  if (mariceLemonadeNoBtn) {
    mariceLemonadeNoBtn.addEventListener("click", () => {
      closePopup(mariceLemonadePopup);
      window.lemonCornerDialogue.queue(
        [
          {
            speaker: "Marice",
            portrait: maricePortrait("happy"),
            text: "No worries — good luck with your stand today!",
          },
        ],
        () => mariceGoodbye(finishMariceEvent),
      );
    });
  }

  function finishMariceEvent() {
    mariceResolved = true;

    if (mariceEventContext === "customer") {
      // She showed up as a regular customer this time — wrap her
      // encounter up and let the rest of today's customers keep coming.
      isMariceCustomerActive = false;
      window.setTimeout(advanceDay, 400);
      return;
    }

    // If they still don't have cups (took the free-lemons reward), the
    // normal cup-shop flow just keeps working from here on as usual —
    // they'll need to earn/find coins another way before opening up.
    maybeIntroduceSign();
  }

  // ---- Open/Closed sign + Day banner -------------------------------------
  // Fires the very first time BOTH the pitcher is full and cups are in
  // hand (however that happened — bought outright, or via Marice's
  // reward/lemonade beat). Plays the "let's open!" line, then reveals
  // and highlights the sign so it's obvious what to click next.
  function maybeIntroduceSign() {
    if (signShown || !pitcherFilled || !cupsOwned) return;
    signShown = true;

    window.lemonCornerDialogue.queue(
      [
        {
          speaker: helperDisplayName,
          portrait: helperPortrait("excited"),
          text: "Pitcher full, cups ready...",
        },
        {
          speaker: playerDisplayName,
          portrait: playerPortrait("excited"),
          text: "Let's open Lemon Corner for business!",
        },
        {
          speaker: helperDisplayName,
          portrait: helperPortrait("happy"),
          text: "Flip the sign to Open!",
        },
      ],
      () => {
        if (signBtn) signBtn.classList.add("highlight-pulse");
      },
    );
  }

  // Shows the "Day X" title card for a couple seconds, then fades it
  // back out on its own.
  function showDayBanner(dayNumber) {
    if (!dayBanner) return;
    if (dayBannerText) dayBannerText.textContent = `Day ${dayNumber}`;

    dayBanner.classList.add("visible");
    window.setTimeout(() => {
      dayBanner.classList.remove("visible");

      // Day 1's first customer is always the scripted tutorial
      // customer (CU1); every later day just jumps straight into the
      // regular random-customer loop via advanceDay().
      if (dayNumber === 1) {
        showCustomer(CU1);
      } else {
        advanceDay();
      }
    }, 1800);
  }

  // ---- Customers -----------------------------------------------------
  // CU1 is the Day 1 tutorial customer.
  const CU1 = {
    id: "CU1",
    sprite: "../images/CU1.png",
    order: { emoji: "🥤", quantity: 2 },
  };

  // Pool of random (non-tutorial) customers, picked from once CU1's
  // tutorial order is done. Each just needs { id, sprite } — order is
  // generated fresh per customer by randomCustomer() below. Matches
  // the 8 total customer sprites (CU1 + CU2-CU8) — add more entries
  // here if more art gets made later.
  const CUSTOMER_POOL = [
    { id: "CU2", sprite: "../images/CU2.png" },
    { id: "CU3", sprite: "../images/CU3.png" },
    { id: "CU4", sprite: "../images/CU4.png" },
    { id: "CU5", sprite: "../images/CU5.png" },
    { id: "CU6", sprite: "../images/CU6.png" },
    { id: "CU7", sprite: "../images/CU7.png" },
    { id: "CU8", sprite: "../images/CU8.png" },
  ];

  // Marice, appearing as a random walk-up customer starting Day 2 —
  // see maybeSpawnMariceCustomer() below. Uses her own full-body
  // customer sprite (distinct from the dialogue-box portrait busts in
  // ../images/marice/). Update the path once that art exists.
  const MARICE_CUSTOMER = { id: "Marice", sprite: "../images/marice/customer.png" };

  // Odds that Marice shows up instead of a regular customer on any
  // given Day-2+ customer slot. She's gated by mariceResolved so this
  // can only ever fire once, however many days it takes to land.
  const MARICE_CUSTOMER_CHANCE = 0.75;

  // How many customers show up in a single day, and how many
  // customers left (including whichever's about to be served) counts
  // as "almost closing" — that's when the dusk overlay kicks in.
  const MAX_CUSTOMERS_PER_DAY = 8;
  const DUSK_WARNING_CUSTOMERS_LEFT = 2;

  // True for CU1 only — while it's on, the step-by-step "click the
  // cups", "tap the pitcher", "drag to the customer" dialogue plays.
  // Turns off for good right after CU1's order is delivered.
  let tutorialActive = true;

  let customersServedToday = 0;
  let duskTriggered = false;

  // Which day the player is currently on — feeds the "Day X" banner
  // and the "Day X Summary" popup title. Starts at 1 and ticks up
  // each time "Start Next Day" is clicked (see the day-summary
  // popup's button handler further down).
  let currentDay = 1;

  // Per-day totals, reset back to 0 in trySignOpen whenever a new day
  // starts. Read by showDaySummary() once the day is closed out.
  let cupsSoldToday = 0;
  let coinsEarnedToday = 0;

  // No customer's order can ask for more than this.
  const MAX_ORDER_QUANTITY = 3;

  // The order currently being filled (or null between customers), how
  // many empty cups have been placed toward it, how many of those
  // have been filled with lemonade, and how many still need to be
  // dragged over to the customer.
  let currentOrder = null;
  let cupsServedForOrder = 0;
  let cupsFilledForOrder = 0;
  let cupsRemainingToDeliver = 0;

  // Coins earned per cup dragged to the customer. Placeholder value —
  // adjust to whatever Lemon Corner actually charges per cup.
  const LEMONADE_PRICE = 2;

  // Swaps in a customer's sprite, slides them up from below into
  // view, then pops their order bubble in a beat after they've
  // settled — matches the "pop up from below, then order bubble"
  // entrance. Once the bubble's up, their order actually starts.
  function showCustomer(customer) {
    if (!customerSlot || !customerSprite) return;

    customerSprite.src = customer.sprite;
    customerSprite.alt = customer.id;

    if (orderBubble) orderBubble.classList.remove("visible");
    clearServedCups();

    customerSlot.classList.add("visible");

    window.setTimeout(() => {
      if (orderBubbleText) {
        orderBubbleText.textContent = `${customer.order.emoji} x${customer.order.quantity}`;
      }
      if (orderBubble) orderBubble.classList.add("visible");

      startOrder(customer.order);
    }, 500);
  }

  // Explains the order in dialogue, then arms the cup rack so each
  // click serves one empty cup toward it.
  function startOrder(order) {
    const quantity = Math.min(order.quantity, MAX_ORDER_QUANTITY);
    currentOrder = { ...order, quantity };
    cupsServedForOrder = 0;
    cupsFilledForOrder = 0;
    clearServedCups();

    const plural = quantity > 1 ? "s" : "";

    if (tutorialActive) {
      window.lemonCornerDialogue.queue(
        [
          {
            speaker: helperDisplayName,
            portrait: helperPortrait("excited"),
            text: `We have our first customer, and they want ${quantity} lemonade${plural} — click the cups ${quantity} times!`,
          },
        ],
        () => {
          if (cupsBtn) cupsBtn.classList.add("highlight-pulse");
        },
      );
    } else {
      if (cupsBtn) cupsBtn.classList.add("highlight-pulse");
    }
  }

  // Places one more empty cup on the table toward the current order.
  // No-ops once the order's fully served, or if there's no order.
  function serveCupForOrder() {
    if (!currentOrder || cupsServedForOrder >= currentOrder.quantity) return;

    cupsServedForOrder += 1;

    if (servedCupsGrid) {
      const cup = document.createElement("img");
      cup.src = "../images/emptycup.png";
      cup.alt = "";
      cup.draggable = false;
      cup.className = "served-cup";
      servedCupsGrid.appendChild(cup);
    }

    if (cupsServedForOrder >= currentOrder.quantity) {
      if (cupsBtn) cupsBtn.classList.remove("highlight-pulse");
      cupsFilledForOrder = 0;

      if (tutorialActive) {
        const quantity = currentOrder.quantity;
        const timesText =
          quantity === 1 ? "once" : quantity === 2 ? "twice" : `${quantity} times`;

        window.lemonCornerDialogue.queue(
          [
            {
              speaker: helperDisplayName,
              portrait: helperPortrait("excited"),
              text: `Fill the cups by tapping the pitcher ${timesText} also!`,
            },
          ],
          () => {
            if (pitcherBtn) pitcherBtn.classList.add("highlight-pulse");
          },
        );
      } else {
        if (pitcherBtn) pitcherBtn.classList.add("highlight-pulse");
      }
    }
  }

  // Fills the next empty cup on the table with lemonade, one per
  // pitcher tap. No-ops if the cups aren't all out yet, there's no
  // order, or every cup's already filled.
  function fillCupForOrder() {
    if (!currentOrder || cupsServedForOrder < currentOrder.quantity) return;
    if (cupsFilledForOrder >= currentOrder.quantity) return;

    if (servedCupsGrid) {
      const cup = servedCupsGrid.children[cupsFilledForOrder];
      if (cup) {
        cup.src = "../images/lemonade.png";
        cup.classList.remove("pitcher-fill-pop");
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            cup.classList.add("pitcher-fill-pop");
          });
        });
      }
    }

    cupsFilledForOrder += 1;

    if (cupsFilledForOrder >= currentOrder.quantity) {
      if (pitcherBtn) pitcherBtn.classList.remove("highlight-pulse");
      startHandoffPhase();
    }
  }

  // Explains the drag-to-customer step in dialogue (tutorial only),
  // then makes each filled cup draggable.
  function startHandoffPhase() {
    cupsRemainingToDeliver = currentOrder.quantity;

    if (tutorialActive) {
      window.lemonCornerDialogue.queue(
        [
          {
            speaker: helperDisplayName,
            portrait: helperPortrait("excited"),
            text: "Now drag the cups to the customer!",
          },
        ],
        enableCupDragging,
      );
    } else {
      enableCupDragging();
    }
  }

  // Highlights every filled cup and wires up pointer-based dragging
  // on each (works for mouse and touch alike).
  function enableCupDragging() {
    if (!servedCupsGrid) return;
    Array.from(servedCupsGrid.children).forEach((cup) => {
      cup.classList.add("cup-draggable", "highlight-pulse");
      cup.addEventListener("pointerdown", onCupPointerDown);
    });
  }

  // ---- Cup drag-and-drop ------------------------------------------------
  let activeDragCup = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let dragOriginParent = null;
  let dragOriginNextSibling = null;

  function onCupPointerDown(event) {
    const cup = event.currentTarget;
    activeDragCup = cup;
    dragOriginParent = cup.parentElement;
    dragOriginNextSibling = cup.nextElementSibling;

    const rect = cup.getBoundingClientRect();
    dragOffsetX = event.clientX - rect.left;
    dragOffsetY = event.clientY - rect.top;

    cup.setPointerCapture(event.pointerId);
    cup.classList.remove("highlight-pulse");
    cup.classList.add("cup-dragging");

    // Move to <body> so it can travel over everything else while
    // being dragged, positioned with fixed left/top from here on.
    document.body.appendChild(cup);
    cup.style.position = "fixed";
    cup.style.left = `${rect.left}px`;
    cup.style.top = `${rect.top}px`;
    cup.style.margin = "0";

    cup.addEventListener("pointermove", onCupPointerMove);
    cup.addEventListener("pointerup", onCupPointerUp);
    cup.addEventListener("pointercancel", onCupPointerUp);
  }

  function onCupPointerMove(event) {
    if (!activeDragCup) return;
    activeDragCup.style.left = `${event.clientX - dragOffsetX}px`;
    activeDragCup.style.top = `${event.clientY - dragOffsetY}px`;
  }

  function onCupPointerUp(event) {
    if (!activeDragCup) return;
    const cup = activeDragCup;

    cup.removeEventListener("pointermove", onCupPointerMove);
    cup.removeEventListener("pointerup", onCupPointerUp);
    cup.removeEventListener("pointercancel", onCupPointerUp);

    if (isOverCustomer(event.clientX, event.clientY)) {
      deliverCup(cup);
    } else {
      // Missed the customer — snap back to its spot in the grid.
      cup.style.position = "";
      cup.style.left = "";
      cup.style.top = "";
      cup.style.margin = "";
      cup.classList.remove("cup-dragging");
      cup.classList.add("highlight-pulse");

      if (dragOriginNextSibling) {
        dragOriginParent.insertBefore(cup, dragOriginNextSibling);
      } else if (dragOriginParent) {
        dragOriginParent.appendChild(cup);
      }
    }

    activeDragCup = null;
  }

  function isOverCustomer(x, y) {
    if (!customerSprite) return false;
    const rect = customerSprite.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  // A cup successfully reached the customer: it disappears, the order
  // bubble's count ticks down, and coins go up. Once nothing's left
  // to deliver, the order wraps up.
  function deliverCup(cup) {
    cup.remove();

    cupsRemainingToDeliver = Math.max(0, cupsRemainingToDeliver - 1);
    game.updateCoins(currentCoins() + LEMONADE_PRICE);
    coinsEarnedToday += LEMONADE_PRICE;
    cupsSoldToday += 1;
    hasSoldToday = true;

    if (cupsRemainingToDeliver > 0) {
      if (orderBubbleText) {
        orderBubbleText.textContent = `${currentOrder.emoji} x${cupsRemainingToDeliver}`;
      }
    } else {
      finishOrder();
    }
  }

  // Order's fully delivered: bubble swaps to a thank-you, then the
  // customer pops back down and everything resets for the next one
  // — which is either the tutorial hand-off message (after CU1), a
  // reveal-and-quiz beat (if that customer was Marice), or the next
  // random customer, unless today's customer count is up.
  function finishOrder() {
    if (orderBubbleText) orderBubbleText.textContent = "Thank you! 💛";

    window.setTimeout(() => {
      if (customerSlot) customerSlot.classList.remove("visible");
      if (orderBubble) orderBubble.classList.remove("visible");

      currentOrder = null;
      cupsServedForOrder = 0;
      cupsFilledForOrder = 0;
      cupsRemainingToDeliver = 0;
      clearServedCups();

      customersServedToday += 1;

      if (tutorialActive) {
        tutorialActive = false;
        window.lemonCornerDialogue.queue(
          [
            {
              speaker: helperDisplayName,
              portrait: helperPortrait("happy"),
              text: "Nice work! The rest of today's customers are yours to serve.",
            },
          ],
          () => {
            window.setTimeout(advanceDay, 400);
          },
        );
        return;
      }

      if (isMariceCustomerActive) {
        window.setTimeout(startMariceCustomerQuiz, 400);
        return;
      }

      window.setTimeout(advanceDay, 400);
    }, 1500);
  }

  // That "regular customer" who was just served was actually Marice —
  // she reveals herself and asks for help with one more homework
  // question, same question pool as her Day-1 event, but see
  // handleMariceAnswer for how a wrong answer plays out differently
  // here (no retry).
  function startMariceCustomerQuiz() {
    window.lemonCornerDialogue.queue(
      [
        {
          speaker: "Marice",
          portrait: maricePortrait("happy"),
          text: "Hey, we meet again — remember me?",
        },
        {
          speaker: "Marice",
          portrait: maricePortrait("thinking"),
          text: "I've still got homework to finish. Mind helping with one more question?",
        },
      ],
      openMariceQuiz,
    );
  }

  // Picks a random order size within the allowed max.
  function randomOrderQuantity() {
    return 1 + Math.floor(Math.random() * MAX_ORDER_QUANTITY);
  }

  // Grabs a random customer from the pool (falling back to CU1's
  // sprite if the pool's still empty) and gives them a fresh order.
  // From Day 2 onward, there's a chance Marice shows up instead —
  // see maybeSpawnMariceCustomer().
  function randomCustomer() {
    const marice = maybeSpawnMariceCustomer();
    if (marice) return marice;

    const base = CUSTOMER_POOL.length
      ? CUSTOMER_POOL[Math.floor(Math.random() * CUSTOMER_POOL.length)]
      : CU1;

    return {
      id: base.id,
      sprite: base.sprite,
      order: { emoji: "🥤", quantity: randomOrderQuantity() },
    };
  }

  // Rolls the dice on Marice showing up as this slot's customer.
  // Returns her customer object (and flags her encounter as active)
  // if she's chosen, or null to fall through to a regular customer.
  function maybeSpawnMariceCustomer() {
    if (currentDay < 2 || mariceResolved || isMariceCustomerActive) {
      return null;
    }
    if (Math.random() >= MARICE_CUSTOMER_CHANCE) return null;

    isMariceCustomerActive = true;
    mariceEventContext = "customer";

    return {
      id: MARICE_CUSTOMER.id,
      sprite: MARICE_CUSTOMER.sprite,
      order: { emoji: "🥤", quantity: randomOrderQuantity() },
    };
  }

  // Either brings up the next customer, or — once today's customer
  // count is reached — ends the day. Triggers the dusk overlay once
  // only DUSK_WARNING_CUSTOMERS_LEFT (or fewer) customers remain.
  function advanceDay() {
    if (customersServedToday >= MAX_CUSTOMERS_PER_DAY) {
      endDay();
      return;
    }

    const customersLeft = MAX_CUSTOMERS_PER_DAY - customersServedToday;
    if (!duskTriggered && customersLeft <= DUSK_WARNING_CUSTOMERS_LEFT) {
      duskTriggered = true;
      triggerDusk();
    }

    showCustomer(randomCustomer());
  }

  // Crossfades the daytime backdrop into the sunset dusk artwork —
  // the "day's almost over" cue.
  function triggerDusk() {
    if (duskBackground) duskBackground.classList.add("visible");
  }

  // Today's customers are all served. Lets the player close up (see
  // trySignClose's hasSoldToday/dayComplete gate).
  // TODO: hook up the real end-of-day summary here once it exists.
  function endDay() {
    dayComplete = true;

    window.lemonCornerDialogue.queue([
      {
        speaker: helperDisplayName,
        portrait: helperPortrait("happy"),
        text: "That's everyone for today — flip the sign to close up shop!",
      },
    ]);
  }

  // Wipes the empty-cup grid clean — used when a new customer shows
  // up (and later, once an order's handed off).
  function clearServedCups() {
    if (servedCupsGrid) servedCupsGrid.innerHTML = "";
  }

  if (signBtn) {
    signBtn.addEventListener("click", () => {
      if (signOpen) {
        trySignClose();
      } else {
        trySignOpen();
      }
    });
  }

  // Attempts to flip Closed -> Open. Blocked (with an explanatory
  // line) unless the pitcher's full AND cups are in hand.
  function trySignOpen() {
    const missingPitcher = !pitcherFilled;
    const missingCups = !cupsOwned;

    if (missingPitcher || missingCups) {
      let text;
      if (missingPitcher && missingCups) {
        text =
          "We can't open yet — the pitcher isn't full and we don't have any cups!";
      } else if (missingPitcher) {
        text = "We can't open yet — the pitcher isn't full!";
      } else {
        text = "We can't open yet — we don't have any cups!";
      }

      window.lemonCornerDialogue.queue([
        {
          speaker: helperDisplayName,
          portrait: helperPortrait("worried"),
          text,
        },
      ]);
      return;
    }

    signOpen = true;
    signBtn.classList.remove("highlight-pulse");
    signBtn.src = "../images/sign-open.png";

    customersServedToday = 0;
    duskTriggered = false;
    hasSoldToday = false;
    dayComplete = false;
    cupsSoldToday = 0;
    coinsEarnedToday = 0;
    if (duskBackground) duskBackground.classList.remove("visible");

    showDayBanner(currentDay);
  }

  // Attempts to flip Open -> Closed. Blocked (with an explanatory
  // line) unless something's actually been sold AND the day's done.
  function trySignClose() {
    const nothingSoldYet = !hasSoldToday;
    const dayStillGoing = !dayComplete;

    if (nothingSoldYet || dayStillGoing) {
      let text;
      if (nothingSoldYet && dayStillGoing) {
        text =
          "We can't close yet — we haven't sold anything, and the day isn't over!";
      } else if (nothingSoldYet) {
        text = "We can't close yet — we haven't sold any lemonade!";
      } else {
        text = "We can't close yet — the day isn't over!";
      }

      window.lemonCornerDialogue.queue([
        {
          speaker: helperDisplayName,
          portrait: helperPortrait("worried"),
          text,
        },
      ]);
      return;
    }

    signOpen = false;
    signBtn.src = "../images/sign-closed.png";
    showDaySummary();
  }

  // ---- Day summary popup -------------------------------------------------
  const daySummaryPopup = document.getElementById("day-summary-popup");
  const daySummaryTitle = document.getElementById("day-summary-title");
  const daySummaryCustomers = document.getElementById("day-summary-customers");
  const daySummaryCups = document.getElementById("day-summary-cups");
  const daySummaryEarned = document.getElementById("day-summary-earned");
  const daySummaryLemons = document.getElementById("day-summary-lemons");
  const daySummaryTotalCoins = document.getElementById(
    "day-summary-total-coins",
  );
  const daySummaryNextBtn = document.getElementById("day-summary-next-btn");

  // Fills in today's numbers and opens the recap popup. Called right
  // after the sign flips to Closed.
  function showDaySummary() {
    if (daySummaryTitle) {
      daySummaryTitle.textContent = `Day ${currentDay} Summary`;
    }
    if (daySummaryCustomers) {
      daySummaryCustomers.textContent = customersServedToday;
    }
    if (daySummaryCups) daySummaryCups.textContent = cupsSoldToday;
    if (daySummaryEarned) {
      daySummaryEarned.textContent = `$${coinsEarnedToday}`;
    }
    if (daySummaryLemons) {
      daySummaryLemons.textContent = `${currentLemons()} 🍋`;
    }
    if (daySummaryTotalCoins) {
      daySummaryTotalCoins.textContent = `$${currentCoins()}`;
    }
    openPopup(daySummaryPopup);
  }

  // ---- Trivia button: money lesson + quiz, rewards coins ----------------
  const triviaQuizPopup = document.getElementById("trivia-quiz-popup");
  const triviaQuizQuestion = document.getElementById("trivia-quiz-question");
  const triviaQuizChoices = document.getElementById("trivia-quiz-choices");

  // Kid-friendly (5-8 y/o) money concepts. Each entry has a couple of
  // short "lesson" lines the helper says out loud first, then a quiz
  // question testing that same idea. Reward is how many coins the
  // player wins for getting it right on the first try.
  const TRIVIA_QUESTIONS = [
    {
      lesson: [
        "Ooh, quiz time! Here's a money tip: the price is how much something costs to buy.",
        "So if lemons cost $10, that $10 is the price!",
      ],
      question: "If cups cost $5, what do we call that $5?",
      choices: ["The price", "The profit", "The change"],
      correct: 0,
      hint: "It's the amount we have to pay to get the cups — that's the price.",
      reward: 4,
    },
    {
      lesson: [
        "Here's another one: earning means getting coins by selling something.",
        "Every time we sell a cup of lemonade, we're earning!",
      ],
      question: "We sell 3 cups of lemonade. What are we doing with those coins we get?",
      choices: ["Spending", "Earning", "Losing"],
      correct: 1,
      hint: "Coins coming TO us from a sale is earning.",
      reward: 4,
    },
    {
      lesson: [
        "Quick lesson: saving means keeping coins instead of spending them right away.",
        "If we don't buy anything, our coins just sit safely with us — that's saving!",
      ],
      question: "We have $8 and don't spend any of it today. What are we doing?",
      choices: ["Spending", "Saving", "Earning"],
      correct: 1,
      hint: "Keeping coins instead of spending them is saving.",
      reward: 3,
    },
    {
      lesson: [
        "Money tip: profit is what's left over after we pay for what something cost us.",
        "If a cup sells for $2 and cost $1 to make, we keep $1 — that's our profit!",
      ],
      question: "A cup sells for $3 and cost $1 to make. How much profit do we keep?",
      choices: ["$1", "$2", "$3"],
      correct: 1,
      hint: "Take the cost away from the sale price: $3 take away $1.",
      reward: 5,
    },
    {
      lesson: [
        "Here's a good one: spending means paying coins away to get something we want.",
        "Buying lemons or cups both use up our coins — that's spending!",
      ],
      question: "We pay $6 for cups. What are we doing with our coins?",
      choices: ["Earning", "Saving", "Spending"],
      correct: 2,
      hint: "Coins going AWAY from us to buy something is spending.",
      reward: 3,
    },
    {
      lesson: [
        "One more: change is the extra coins we get back if we pay more than the price.",
        "Pay $5 for something that costs $3, and we get $2 back as change!",
      ],
      question: "Lemons cost $4. We pay with a $5 coin. How much change do we get back?",
      choices: ["$1", "$2", "$4"],
      correct: 0,
      hint: "Take the price away from what we paid: $5 take away $4.",
      reward: 5,
    },
  ];

  let currentTriviaQuestion = null;

  // Plays the short lesson for a random question, then opens the quiz
  // popup for it. Can be replayed any time — repetition is part of the
  // point for this age group, and it's a legitimate way to earn extra
  // coins toward lemons and cups.
  function startTrivia() {
    currentTriviaQuestion =
      TRIVIA_QUESTIONS[Math.floor(Math.random() * TRIVIA_QUESTIONS.length)];

    const lessonLines = currentTriviaQuestion.lesson.map((text) => ({
      speaker: helperDisplayName,
      portrait: helperPortrait("happy"),
      text,
    }));

    window.lemonCornerDialogue.queue(lessonLines, openTriviaQuiz);
  }

  function openTriviaQuiz() {
    renderTriviaQuiz();
    openPopup(triviaQuizPopup);
  }

  // Reopens the SAME question after a wrong answer (no re-roll), so the
  // hint they just heard still applies to what's on screen.
  function reopenTriviaQuiz() {
    renderTriviaQuiz();
    openPopup(triviaQuizPopup);
  }

  function renderTriviaQuiz() {
    if (triviaQuizQuestion) {
      triviaQuizQuestion.textContent = currentTriviaQuestion.question;
    }
    if (!triviaQuizChoices) return;

    triviaQuizChoices.innerHTML = "";
    currentTriviaQuestion.choices.forEach((choice, index) => {
      const btn = document.createElement("button");
      btn.className = "popup-btn";
      btn.textContent = choice;
      btn.addEventListener("click", () => handleTriviaAnswer(index));
      triviaQuizChoices.appendChild(btn);
    });
  }

  function handleTriviaAnswer(index) {
    closePopup(triviaQuizPopup);

    if (index === currentTriviaQuestion.correct) {
      const reward = currentTriviaQuestion.reward;
      game.updateCoins(currentCoins() + reward);

      window.lemonCornerDialogue.queue([
        {
          speaker: helperDisplayName,
          portrait: helperPortrait("excited"),
          text: `That's right! Here's ${reward} coins for getting it right.`,
        },
      ]);
      return;
    }

    // Wrong answer — teach through a dialogue line, then let them try
    // the same question again instead of just losing the chance.
    window.lemonCornerDialogue.queue(
      [
        {
          speaker: helperDisplayName,
          portrait: helperPortrait("thinking"),
          text: "Not quite! " + currentTriviaQuestion.hint,
        },
        {
          speaker: helperDisplayName,
          portrait: helperPortrait("encourage"),
          text: "Let's give it another try!",
        },
      ],
      reopenTriviaQuiz,
    );
  }

  // ---- Trivia tutorial (plays once, right before Day 2 opens) -----------
  // Introduces the trivia button (lesson + quiz above) to the player at
  // the right story beat and gives it a highlight-pulse nudge.
  const triviaBtn = document.getElementById("trivia-button");
  let triviaTutorialShown = false;

  if (triviaBtn) {
    triviaBtn.addEventListener("click", () => {
      triviaBtn.classList.remove("highlight-pulse");
      startTrivia();
    });
  }

  // Queues the tutorial line (once, on the Day 1 -> Day 2 transition) and
  // then continues with whatever should happen next (normally
  // trySignOpen). On every other day this just calls next() immediately.
  function maybeShowTriviaTutorial(next) {
    if (currentDay !== 2 || triviaTutorialShown) {
      next();
      return;
    }

    triviaTutorialShown = true;

    window.lemonCornerDialogue.queue(
      [
        {
          speaker: helperDisplayName,
          portrait: helperPortrait("happy"),
          text: "Ooh, before we open — see that Trivia button up top?",
        },
        {
          speaker: helperDisplayName,
          portrait: helperPortrait("happy"),
          text: "It's got a quick lesson about money, then a little quiz!",
        },
        {
          speaker: helperDisplayName,
          portrait: helperPortrait("happy"),
          text: "Get the quiz right and we win bonus coins — more coins means more lemons and cups!",
        },
      ],
      () => {
        if (triviaBtn) triviaBtn.classList.add("highlight-pulse");
        next();
      },
    );
  }

  // "Start Next Day" — closes the recap and reopens the stand for the
  // next day. Reuses trySignOpen so the reset logic (customer count,
  // dusk, sold-today flags, banner) stays in exactly one place.
  if (daySummaryNextBtn) {
    daySummaryNextBtn.addEventListener("click", () => {
      closePopup(daySummaryPopup);
      currentDay += 1;

      // Fresh day, fresh supplies: the pitcher empties out and the
      // cups run out overnight, so both need restocking before the
      // sign can flip open again. trySignOpen()'s existing guard
      // handles telling the player that ("We can't open yet...") —
      // once they refill the pitcher and buy cups again, clicking the
      // sign carries them the rest of the way into the new day.
      pitcherFilled = false;
      cupsOwned = false;
      if (pitcherBtn) {
        pitcherBtn.src = "../images/emptypitcher.png";
        pitcherBtn.classList.remove("pitcher-fill-pop");
      }
      if (cupsBtn) {
        cupsBtn.src = "../images/cupracks.png";
        cupsBtn.classList.remove("cup-fill-pop");
      }

      maybeShowTriviaTutorial(trySignOpen);
    });
  }

  // ---- Pitcher click flow ---------------------------------------------
  if (pitcherBtn) {
    pitcherBtn.addEventListener("click", openPitcherPopup);
  }

  if (fillPitcherBtn) {
    fillPitcherBtn.addEventListener("click", () => {
      if (currentLemons() >= 5) {
        game.updateLemonStock(currentLemons() - 5);
        pitcherFilled = true;
        pitcherIntroDone = true;
        closePopup(pitcherPopup);

        if (pitcherBtn) {
          pitcherBtn.src = "../images/pitcher.png";
          // Restart the fill animation fresh, same trick as the
          // dialogue portrait reactions — wait a paint frame so it
          // plays even if this class was already applied before.
          pitcherBtn.classList.remove("pitcher-fill-pop");
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              pitcherBtn.classList.add("pitcher-fill-pop");
            });
          });
        }

        window.lemonCornerDialogue.queue(
          [
            {
              speaker: helperDisplayName,
              portrait: helperPortrait("excited"),
              text: "Yay, the pitcher is full!",
            },
            {
              speaker: helperDisplayName,
              portrait: helperPortrait("thinking"),
              text: "But wait, we still need cups to serve the lemonade in!",
            },
            {
              speaker: playerDisplayName,
              portrait: playerPortrait("questioning"),
              text: "Right! Let's go buy some cups.",
            },
            {
              speaker: helperDisplayName,
              portrait: helperPortrait("excited"),
              text: "Click the cup rack!",
            },
          ],
          () => {
            cupsUnlocked = true;
            if (cupsBtn) cupsBtn.classList.add("highlight-pulse");
          },
        );
        return;
      }

      // Not enough lemons yet.
      closePopup(pitcherPopup);

      if (!lemonExplainerShown) {
        // First time finding this out — play the full "we need
        // lemons" beat, then reveal Buy Lemons and highlight it so
        // it's obvious what to click next.
        lemonExplainerShown = true;
        window.lemonCornerDialogue.queue(
          [
            {
              speaker: helperDisplayName,
              portrait: helperPortrait("surprised"),
              text: "Oh no!",
            },
            {
              speaker: helperDisplayName,
              portrait: helperPortrait("worried"),
              text: "We need 5 lemons to fill the pitcher.",
            },
            {
              speaker: helperDisplayName,
              portrait: helperPortrait("worried"),
              text: "But we don't have any lemons yet.",
            },
            {
              speaker: playerDisplayName,
              portrait: playerPortrait("worried"),
              text: "So... how do we make lemonade?",
            },
            {
              speaker: helperDisplayName,
              portrait: helperPortrait("excited"),
              text: "We'll have to buy some lemons first!",
            },
            {
              speaker: helperDisplayName,
              portrait: helperPortrait("thinking"),
              text: "We have $10 in our savings.",
            },
            {
              speaker: helperDisplayName,
              portrait: helperPortrait("happy"),
              text: "Let's spend it wisely!",
            },
          ],
          () => {
            if (buyLemonsBtn) {
              buyLemonsBtn.hidden = false;
              buyLemonsBtn.classList.add("highlight-pulse");
            }
            openPitcherPopup();
          },
        );
        return;
      }

      // They've already heard the explanation and clicked Fill again
      // instead of Buy Lemons — keep it short this time.
      window.lemonCornerDialogue.queue(
        [
          {
            speaker: helperDisplayName,
            portrait: helperPortrait("worried"),
            text: "We still need to buy lemons first!",
          },
        ],
        () => {
          if (buyLemonsBtn) {
            buyLemonsBtn.hidden = false;
            buyLemonsBtn.classList.add("highlight-pulse");
          }
          openPitcherPopup();
        },
      );
    });
  }

  if (buyLemonsBtn) {
    buyLemonsBtn.addEventListener("click", () => {
      buyLemonsBtn.classList.remove("highlight-pulse");
      closePopup(pitcherPopup);
      refreshShopStock();
      randomizeStores();
      openPopup(shopPopup);

      // The comparison-shopping beat plays with the shop already open
      // behind it, so the two stores are visible while the helper talks.
      window.lemonCornerDialogue.queue([
        {
          speaker: playerDisplayName,
          portrait: playerPortrait("thinking"),
          text: "Hmm...",
        },
        {
          speaker: playerDisplayName,
          portrait: playerPortrait("questioning"),
          text: "Which one should we buy from?",
        },
        {
          speaker: helperDisplayName,
          portrait: helperPortrait("thinking"),
          text: "We should compare the prices first.",
        },
        {
          speaker: helperDisplayName,
          portrait: helperPortrait("thinking"),
          text: "If both stores give us the same number of lemons...",
        },
        {
          speaker: helperDisplayName,
          portrait: helperPortrait("questioning"),
          text: "...it's smarter to choose the cheaper one.",
        },
      ]);
    });
  }

  // ---- Opening sequence -------------------------------------------------
  // Fires as soon as the game screen loads. After the last line, the
  // pitcher gets a gentle highlight so it's obvious what to click next.
  window.lemonCornerDialogue.queue(
    [
      {
        speaker: playerDisplayName,
        portrait: playerPortrait("excited"),
        text: "Wow! I can't believe we're finally opening our Lemon Corner!",
      },
      {
        speaker: helperDisplayName,
        portrait: helperPortrait("excited"),
        text: "Me too!",
      },
      {
        speaker: helperDisplayName,
        portrait: helperPortrait("happy"),
        text: "But before customers arrive...",
      },
      {
        speaker: helperDisplayName,
        portrait: helperPortrait("happy"),
        text: "Let's set up our stand first!",
      },
      {
        speaker: helperDisplayName,
        portrait: helperPortrait("question"),
        text: "We'll need lemonade...",
      },
      {
        speaker: helperDisplayName,
        portrait: helperPortrait("happy"),
        text: "...and plenty of cups!",
      },
      {
        speaker: helperDisplayName,
        portrait: helperPortrait("excited"),
        text: "First, let's fill our lemonade pitcher.",
      },
      {
        speaker: helperDisplayName,
        portrait: helperPortrait("happy"),
        text: "Click the pitcher!",
      },
    ],
    () => {
      if (pitcherBtn) pitcherBtn.classList.add("highlight-pulse");
    },
  );

  // Remove the highlight whenever the pitcher gets clicked. Not a
  // one-time listener since pitcherPopupClose above can re-add the
  // highlight if the player exits before filling it.
  if (pitcherBtn) {
    pitcherBtn.addEventListener("click", () =>
      pitcherBtn.classList.remove("highlight-pulse"),
    );
  }
  // ---- Menu popup ---------------------------------------------------------
  const menuBtn = document.getElementById("menu-button");
  const menuPopup = document.getElementById("menu-popup");
  const menuPopupClose = document.getElementById("menu-popup-close");
  const menuHomeBtn = document.getElementById("menu-home-btn");
  const menuResetBtn = document.getElementById("menu-reset-btn");
  const menuTutorialBtn = document.getElementById("menu-tutorial-btn");
  const menuRenameBtn = document.getElementById("menu-rename-btn");
  const menuChangeCharacterBtn = document.getElementById(
    "menu-change-character-btn",
  );

  if (menuBtn) {
    menuBtn.addEventListener("click", () => openPopup(menuPopup));
  }
  if (menuPopupClose) {
    menuPopupClose.addEventListener("click", () => closePopup(menuPopup));
  }

  // ---- Generic confirm popup ----------------------------------------------
  // Reused by any menu option that needs an "are you sure?" step before
  // doing something that affects progress (leaving, resetting, switching
  // character) instead of building one bespoke popup per action.
  const confirmPopup = document.getElementById("confirm-popup");
  const confirmPopupTitle = document.getElementById("confirm-popup-title");
  const confirmPopupText = document.getElementById("confirm-popup-text");
  const confirmPopupYesBtn = document.getElementById("confirm-popup-yes-btn");
  const confirmPopupNoBtn = document.getElementById("confirm-popup-no-btn");

  function askConfirm(title, text, onYes) {
    if (confirmPopupTitle) confirmPopupTitle.textContent = title;
    if (confirmPopupText) confirmPopupText.textContent = text;
    openPopup(confirmPopup);

    function cleanup() {
      closePopup(confirmPopup);
      if (confirmPopupYesBtn)
        confirmPopupYesBtn.removeEventListener("click", handleYes);
      if (confirmPopupNoBtn)
        confirmPopupNoBtn.removeEventListener("click", handleNo);
    }
    function handleYes() {
      cleanup();
      onYes();
    }
    function handleNo() {
      cleanup();
    }

    if (confirmPopupYesBtn)
      confirmPopupYesBtn.addEventListener("click", handleYes);
    if (confirmPopupNoBtn)
      confirmPopupNoBtn.addEventListener("click", handleNo);
  }

  // Back to Home — leaves the stand entirely, back to the title screen.
  if (menuHomeBtn) {
    menuHomeBtn.addEventListener("click", () => {
      closePopup(menuPopup);
      askConfirm(
        "Back to Home?",
        "This leaves the stand and heads back to the title screen.",
        () => goToPage("index.html"),
      );
    });
  }

  // Reset to Day 1 — nothing here is saved outside this page's memory
  // (coins, lemon stock, day number, etc. all live in script.js/story.js
  // variables), so a fresh reload is the cleanest, most reliable reset.
  if (menuResetBtn) {
    menuResetBtn.addEventListener("click", () => {
      closePopup(menuPopup);
      askConfirm(
        "Reset to Day 1?",
        "This starts the stand over from Day 1 — today's coins, lemons, and cups will all reset.",
        () => window.location.reload(),
      );
    });
  }

  // Review Tutorial — a quick recap of the core actions, safe to replay
  // any time without touching the player's current stock or coins.
  if (menuTutorialBtn) {
    menuTutorialBtn.addEventListener("click", () => {
      closePopup(menuPopup);
      playTutorialRecap();
    });
  }

  function playTutorialRecap() {
    window.lemonCornerDialogue.queue([
      {
        speaker: helperDisplayName,
        portrait: helperPortrait("happy"),
        text: "Quick recap! Click the pitcher to fill it up, or buy more lemons if we run low.",
      },
      {
        speaker: helperDisplayName,
        portrait: helperPortrait("happy"),
        text: "Click the cup rack to buy cups, then click it again to serve each customer's order.",
      },
      {
        speaker: helperDisplayName,
        portrait: helperPortrait("happy"),
        text: "Flip the sign to Open once we're stocked up, and back to Closed when we're done for the day.",
      },
      {
        speaker: helperDisplayName,
        portrait: helperPortrait("happy"),
        text: "And don't forget the Trivia button — quick money lessons that can win us bonus coins!",
      },
    ]);
  }

  // Rename Character — saves straight to localStorage and reloads, since
  // dialogue.js reads the name from there once at page load.
  const renamePopup = document.getElementById("rename-popup");
  const renamePopupClose = document.getElementById("rename-popup-close");
  const renamePopupInput = document.getElementById("rename-popup-input");
  const renamePopupSaveBtn = document.getElementById("rename-popup-save-btn");

  if (menuRenameBtn) {
    menuRenameBtn.addEventListener("click", () => {
      closePopup(menuPopup);
      if (renamePopupInput) renamePopupInput.value = playerDisplayName || "";
      openPopup(renamePopup);
      if (renamePopupInput) renamePopupInput.focus();
    });
  }
  if (renamePopupClose) {
    renamePopupClose.addEventListener("click", () => closePopup(renamePopup));
  }
  if (renamePopupSaveBtn) {
    renamePopupSaveBtn.addEventListener("click", () => {
      const newName = renamePopupInput ? renamePopupInput.value.trim() : "";
      if (!newName) return;
      localStorage.setItem("playerName", newName);
      closePopup(renamePopup);
      window.location.reload();
    });
  }

  // Change Character — back to character select. Like Reset, this drops
  // the current in-progress day since nothing persists outside memory.
  if (menuChangeCharacterBtn) {
    menuChangeCharacterBtn.addEventListener("click", () => {
      closePopup(menuPopup);
      askConfirm(
        "Change Character?",
        "This takes you back to character select. Today's progress won't carry over.",
        () => goToPage("character-select.html"),
      );
    });
  }
})();
