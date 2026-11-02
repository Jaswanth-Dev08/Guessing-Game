const screenStart = document.getElementById("screen-start");
const screenGame = document.getElementById("screen-game");
const screenResult = document.getElementById("screen-result");

const difficultyButtons = Array.from(document.querySelectorAll(".difficulty-card"));
const startError = document.getElementById("start-error");

const gameDifficulty = document.getElementById("game-difficulty");
const changeDifficulty = document.getElementById("change-difficulty");
const rangeLow = document.getElementById("range-low");
const rangeHigh = document.getElementById("range-high");
const attemptsLeft = document.getElementById("attempts-left");
const attemptsTotal = document.getElementById("attempts-total");
const attemptMeterFill = document.getElementById("attempt-meter-fill");
const guessForm = document.getElementById("guess-form");
const guessInput = document.getElementById("guess-input");
const guessButton = document.getElementById("guess-button");
const formError = document.getElementById("form-error");

const feedback = document.getElementById("feedback");
const feedbackIcon = document.getElementById("feedback-icon");
const feedbackTitle = document.getElementById("feedback-title");
const feedbackDetail = document.getElementById("feedback-detail");
const temperatureBadge = document.getElementById("temperature-badge");

const historyList = document.getElementById("history-list");
const historyCount = document.getElementById("history-count");
const historyEmpty = document.getElementById("history-empty");

const resultCard = document.getElementById("result-card");
const resultTitle = document.getElementById("result-title");
const resultEyebrow = document.getElementById("result-eyebrow");
const resultCopy = document.getElementById("result-copy");
const resultNumber = document.getElementById("result-number");
const resultSecret = document.getElementById("result-secret");
const resultGuesses = document.getElementById("result-guesses");
const resultStreak = document.getElementById("result-streak");
const playAgain = document.getElementById("play-again");
const pickLevel = document.getElementById("pick-level");
const confettiLayer = document.getElementById("confetti");

const statPlayed = document.getElementById("stat-played");
const statWins = document.getElementById("stat-wins");
const statStreak = document.getElementById("stat-streak");
const statBest = document.getElementById("stat-best");

const difficultyLabels = {
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
};

let currentDifficulty = "medium";
let lastGame = null;
let lastStats = { played: 0, wins: 0, streak: 0, best_guesses: null };
let busy = false;
let hasCelebrated = false;

function show(screen) {
    [screenStart, screenGame, screenResult].forEach((element) => {
        if (element) element.classList.toggle("is-hidden", element !== screen);
    });
    if (screen === screenResult && resultTitle) {
        window.requestAnimationFrame(() => {
            resultTitle.focus({ preventScroll: true });
        });
    }
}

function setStartError(message) {
    if (!startError) return;
    startError.textContent = message || "";
    startError.hidden = !message;
}

function setFormError(message) {
    if (!formError) return;
    formError.textContent = message || "";
    formError.hidden = !message;
}

function updateStats(stats) {
    if (!stats) return;
    lastStats = { ...lastStats, ...stats };
    if (statPlayed) statPlayed.textContent = lastStats.played ?? 0;
    if (statWins) statWins.textContent = lastStats.wins ?? 0;
    if (statStreak) statStreak.textContent = lastStats.streak ?? 0;
    if (statBest) {
        statBest.textContent =
            typeof lastStats.best_guesses === "number" ? lastStats.best_guesses : "\u2014";
    }
}

function renderHistory(history) {
    if (!historyList) return;
    historyList.innerHTML = "";

    if (!history || history.length === 0) {
        if (historyCount) historyCount.textContent = "0";
        if (historyEmpty) historyEmpty.classList.remove("is-hidden");
        return;
    }

    if (historyCount) historyCount.textContent = String(history.length);
    if (historyEmpty) historyEmpty.classList.add("is-hidden");

    [...history].reverse().forEach((entry) => {
        const item = document.createElement("li");
        item.className = "history-item";
        item.dataset.tone = entry.tone || "idle";

        const guess = document.createElement("span");
        guess.className = "history-guess";
        guess.textContent = entry.guess;

        const direction = document.createElement("span");
        direction.className = "history-direction";
        if (entry.direction === "correct") direction.textContent = "\u2713";
        else if (entry.direction === "low") direction.textContent = "\u2191";
        else if (entry.direction === "high") direction.textContent = "\u2193";
        else direction.textContent = "\u00b7";

        const temp = document.createElement("span");
        temp.className = "history-temperature";
        temp.textContent = entry.temperature || "";

        item.appendChild(guess);
        item.appendChild(direction);
        if (temp.textContent) item.appendChild(temp);
        historyList.appendChild(item);
    });
}

function feedbackIconFor(tone) {
    const icons = {
        low: "\u2191",
        high: "\u2193",
        blazing: "!",
        hot: "+",
        warm: "\u2248",
        cool: "~",
        cold: "\u00b7",
        correct: "\u2713",
        lost: "!",
    };
    return icons[tone] || "?";
}

function setFeedback(result) {
    if (!feedback) return;

    if (!result) {
        feedback.dataset.tone = "idle";
        if (feedbackIcon) feedbackIcon.textContent = "?";
        if (feedbackTitle) feedbackTitle.textContent = "Make your first guess";
        if (feedbackDetail) {
            feedbackDetail.textContent = "The range is wide open. Try splitting in half.";
        }
        if (temperatureBadge) {
            temperatureBadge.hidden = true;
            temperatureBadge.textContent = "";
        }
        return;
    }

    feedback.dataset.tone = result.tone || "idle";
    if (feedbackIcon) feedbackIcon.textContent = feedbackIconFor(result.tone);
    if (feedbackTitle) feedbackTitle.textContent = result.title || "";
    if (feedbackDetail) feedbackDetail.textContent = result.detail || "";
    if (temperatureBadge) {
        temperatureBadge.textContent = result.temperature || "";
        temperatureBadge.hidden = !result.temperature;
    }
}

function renderGame(game, result) {
    if (!game) return;
    lastGame = game;
    currentDifficulty = game.difficulty;

    const label = difficultyLabels[game.difficulty] || game.label || "Level";
    if (gameDifficulty) {
        gameDifficulty.textContent = `${label} \u00b7 ${game.min}\u2013${game.max}`;
    }

    if (rangeLow) rangeLow.textContent = game.low;
    if (rangeHigh) rangeHigh.textContent = game.high;
    if (attemptsLeft) attemptsLeft.textContent = game.remaining;
    if (attemptsTotal) attemptsTotal.textContent = game.max_attempts;

    if (attemptMeterFill) {
        const percent = Math.max(
            0,
            Math.min(100, (game.remaining / game.max_attempts) * 100),
        );
        attemptMeterFill.style.width = `${percent}%`;
        attemptMeterFill.classList.toggle("is-low", percent <= 28);
    }

    if (guessInput) {
        guessInput.min = String(game.low);
        guessInput.max = String(game.high);
        guessInput.disabled = game.status !== "playing";
    }
    if (guessButton) guessButton.disabled = game.status !== "playing";
    if (changeDifficulty) {
        changeDifficulty.textContent =
            game.status === "playing" ? "Quit round" : "Pick a new level";
    }

    renderHistory(game.history || []);
    setFeedback(result || game.last_result || null);
    setFormError("");
}

function applyGame(game, result) {
    renderGame(game, result);
    if (!game) return;
    if (game.status === "playing") {
        show(screenGame);
        if (guessInput && !busy) guessInput.focus({ preventScroll: true });
    } else {
        showResult(game);
    }
}

function launchConfetti() {
    if (!confettiLayer) return;
    confettiLayer.innerHTML = "";
    const colors = ["#c8ff5c", "#6ee7ff", "#ffb866", "#b69cff", "#f5f7ff"];
    const count = window.innerWidth < 640 ? 40 : 64;

    for (let index = 0; index < count; index += 1) {
        const piece = document.createElement("i");
        piece.style.setProperty("--piece-color", colors[index % colors.length]);
        piece.style.left = `${Math.random() * 100}%`;
        piece.style.setProperty("--delay", `${Math.random() * 0.18}s`);
        piece.style.setProperty("--duration", `${0.9 + Math.random() * 0.7}s`);
        piece.style.setProperty("--drift", `${(Math.random() - 0.5) * 26}vw`);
        piece.style.setProperty("--spin", `${Math.random() * 720}deg`);
        confettiLayer.appendChild(piece);
    }

    window.setTimeout(() => {
        if (confettiLayer) confettiLayer.innerHTML = "";
    }, 1400);
}

function showResult(game) {
    if (!resultCard) return;
    const won = game.status === "won";

    resultCard.dataset.result = won ? "won" : "lost";
    if (resultNumber) resultNumber.textContent = game.secret ?? "?";
    if (resultSecret) resultSecret.textContent = game.secret ?? "?";
    if (resultGuesses) resultGuesses.textContent = `${game.attempts} / ${game.max_attempts}`;
    if (resultStreak) resultStreak.textContent = lastStats.streak ?? 0;

    if (won) {
        if (resultEyebrow) resultEyebrow.textContent = "Congratulations";
        if (resultTitle) resultTitle.textContent = "Bullseye.";
        if (resultCopy) {
            resultCopy.textContent =
                "Sharp instincts. You found the secret number before your guesses ran out.";
        }
        if (!hasCelebrated) {
            hasCelebrated = true;
            launchConfetti();
        }
    } else {
        hasCelebrated = false;
        if (resultEyebrow) resultEyebrow.textContent = "Nice try";
        if (resultTitle) resultTitle.textContent = "Out of guesses.";
        if (resultCopy) {
            resultCopy.textContent =
                "The range closed in, but this round slipped away. One more try makes all the difference.";
        }
    }

    show(screenResult);
}

async function api(path, options = {}) {
    const response = await fetch(path, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });

    let data = null;
    if ((response.headers.get("content-type") || "").includes("application/json")) {
        data = await response.json().catch(() => null);
    }

    return { ok: response.ok, status: response.status, data };
}

async function loadState() {
    try {
        const response = await api("/api/state", { method: "GET" });
        if (!response.ok || !response.data) {
            show(screenStart);
            return;
        }

        updateStats(response.data.stats);
        const game = response.data.game;
        if (!game) {
            show(screenStart);
            return;
        }

        hasCelebrated = game.status === "won";
        renderGame(game, game.last_result || null);
        if (game.status === "playing") {
            show(screenGame);
        } else {
            showResult(game);
        }
    } catch (error) {
        show(screenStart);
    }
}

async function startGame(difficulty, triggerButton) {
    if (busy) return;
    busy = true;
    difficultyButtons.forEach((button) => {
        button.disabled = true;
    });
    if (triggerButton) triggerButton.setAttribute("aria-busy", "true");
    setStartError("");

    try {
        const response = await api("/api/new-game", {
            method: "POST",
            body: JSON.stringify({ difficulty }),
        });
        if (!response.ok) {
            setStartError(response.data?.error || "Could not start the game.");
            return;
        }

        updateStats(response.data.stats);
        hasCelebrated = false;
        if (guessInput) guessInput.value = "";
        const game = response.data.game;
        renderGame(game, null);
        if (game.status === "playing") show(screenGame);
    } catch (error) {
        setStartError("Could not start the game. Is the server running?");
    } finally {
        busy = false;
        difficultyButtons.forEach((button) => {
            button.disabled = false;
        });
        if (triggerButton) triggerButton.removeAttribute("aria-busy");
    }
}

difficultyButtons.forEach((button) => {
    button.addEventListener("click", () => {
        const difficulty = button.dataset.difficulty;
        if (difficulty) startGame(difficulty, button);
    });
});

if (guessForm) {
    guessForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (busy || !lastGame || lastGame.status !== "playing") return;

        const raw = guessInput ? guessInput.value.trim() : "";
        setFormError("");
        if (raw === "") {
            setFormError("Enter a number first.");
            if (guessInput) guessInput.focus();
            return;
        }

        const guess = Number(raw);
        if (!Number.isSafeInteger(guess)) {
            setFormError("Enter a whole number.");
            if (guessInput) guessInput.focus();
            return;
        }
        if (guess < lastGame.low || guess > lastGame.high) {
            setFormError(`Pick a number from ${lastGame.low} to ${lastGame.high}.`);
            if (guessInput) guessInput.focus();
            return;
        }

        busy = true;
        if (guessInput) guessInput.disabled = true;
        if (guessButton) guessButton.disabled = true;

        try {
            const response = await api("/api/guess", {
                method: "POST",
                body: JSON.stringify({ guess }),
            });
            const data = response.data || {};

            if (!response.ok) {
                if (response.status === 409 && data.code === "no_game") {
                    lastGame = null;
                    show(screenStart);
                    return;
                }
                if (response.status === 409 && data.game) {
                    updateStats(data.stats);
                    applyGame(data.game, data.game.last_result || null);
                    return;
                }
                setFormError(data.error || "Could not submit that guess.");
                return;
            }

            updateStats(data.stats);
            const game = data.game;
            renderGame(game, data.result);
            if (guessInput) guessInput.value = "";

            if (game.status === "playing") {
                show(screenGame);
                if (guessInput) guessInput.focus({ preventScroll: true });
            } else {
                const finishedGame = game;
                show(screenGame);
                window.setTimeout(() => {
                    if (lastGame === finishedGame) showResult(finishedGame);
                }, 850);
            }
        } catch (error) {
            setFormError("Could not submit that guess. Check your connection.");
        } finally {
            busy = false;
            if (lastGame && lastGame.status === "playing") {
                if (guessInput) {
                    guessInput.disabled = false;
                    guessInput.focus({ preventScroll: true });
                }
                if (guessButton) guessButton.disabled = false;
            }
        }
    });
}

async function returnToStart() {
    if (busy) return;
    busy = true;
    if (changeDifficulty) changeDifficulty.disabled = true;
    if (pickLevel) pickLevel.disabled = true;

    try {
        await api("/api/abandon", { method: "POST" });
    } catch (error) {
        // The local session may already be gone; continue to the start screen.
    } finally {
        busy = false;
        if (changeDifficulty) changeDifficulty.disabled = false;
        if (pickLevel) pickLevel.disabled = false;
    }

    lastGame = null;
    hasCelebrated = false;
    setFormError("");
    setStartError("");
    if (guessInput) {
        guessInput.value = "";
        guessInput.disabled = false;
    }
    show(screenStart);
}

if (changeDifficulty) {
    changeDifficulty.addEventListener("click", returnToStart);
}

if (pickLevel) {
    pickLevel.addEventListener("click", returnToStart);
}

if (playAgain) {
    playAgain.addEventListener("click", async () => {
        if (busy) return;
        await startGame(currentDifficulty, playAgain);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    show(screenStart);
    loadState();
});
