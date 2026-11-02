from __future__ import annotations

import os
import secrets

from flask import Flask, jsonify, render_template, request, session

DIFFICULTIES = {
    "easy": {
        "label": "Easy",
        "min": 1,
        "max": 50,
        "max_attempts": 8,
        "blurb": "A quick warm-up for sharp instincts.",
    },
    "medium": {
        "label": "Medium",
        "min": 1,
        "max": 100,
        "max_attempts": 10,
        "blurb": "The classic challenge. Find your rhythm.",
    },
    "hard": {
        "label": "Hard",
        "min": 1,
        "max": 500,
        "max_attempts": 12,
        "blurb": "A wider range for brave guessers.",
    },
}

DEFAULT_STATS = {
    "played": 0,
    "wins": 0,
    "streak": 0,
    "best_streak": 0,
    "best_guesses": None,
}

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY") or secrets.token_hex(32)
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
)


def get_stats() -> dict:
    stats = DEFAULT_STATS.copy()
    saved = session.get("stats")
    if isinstance(saved, dict):
        for key in stats:
            if key in saved:
                stats[key] = saved[key]
    return stats


def public_game(game: dict) -> dict:
    return {
        "difficulty": game["difficulty"],
        "label": DIFFICULTIES[game["difficulty"]]["label"],
        "min": game["min"],
        "max": game["max"],
        "low": game["low"],
        "high": game["high"],
        "attempts": game["attempts"],
        "max_attempts": game["max_attempts"],
        "remaining": game["max_attempts"] - game["attempts"],
        "status": game["status"],
        "history": game["history"],
        "last_result": game.get("last_result"),
        "secret": game["secret"] if game["status"] != "playing" else None,
    }


def temperature_for(guess: int, secret: int, span: int) -> tuple[str, str]:
    distance = abs(guess - secret)
    if distance <= max(2, span * 0.02):
        return "Blazing hot", "blazing"
    if distance <= max(6, span * 0.07):
        return "Hot", "hot"
    if distance <= max(12, span * 0.15):
        return "Warm", "warm"
    if distance <= max(25, span * 0.30):
        return "Cool", "cool"
    return "Freezing", "cold"


def plural_guesses(count: int) -> str:
    return "guess" if count == 1 else "guesses"


@app.get("/")
def index():
    return render_template("index.html", difficulties=DIFFICULTIES)


@app.get("/api/state")
def game_state():
    game = session.get("game")
    return jsonify(
        game=public_game(game) if isinstance(game, dict) else None,
        stats=get_stats(),
    )


@app.post("/api/new-game")
def new_game():
    payload = request.get_json(silent=True) or {}
    difficulty = str(payload.get("difficulty", "")).lower()

    if difficulty not in DIFFICULTIES:
        return jsonify(error="Choose easy, medium, or hard."), 400

    config = DIFFICULTIES[difficulty]
    game = {
        "difficulty": difficulty,
        "min": config["min"],
        "max": config["max"],
        "low": config["min"],
        "high": config["max"],
        "attempts": 0,
        "max_attempts": config["max_attempts"],
        "status": "playing",
        "secret": secrets.randbelow(config["max"] - config["min"] + 1)
        + config["min"],
        "history": [],
        "last_result": None,
    }
    session["game"] = game

    return jsonify(game=public_game(game), stats=get_stats())


@app.post("/api/guess")
def make_guess():
    payload = request.get_json(silent=True) or {}
    game = session.get("game")

    if not isinstance(game, dict):
        return (
            jsonify(error="Start a new game first.", code="no_game"),
            409,
        )

    if game["status"] != "playing":
        return (
            jsonify(
                error="This round is already over.",
                code="round_over",
                game=public_game(game),
                stats=get_stats(),
            ),
            409,
        )

    raw_guess = payload.get("guess")
    try:
        if isinstance(raw_guess, bool) or raw_guess is None:
            raise ValueError
        if isinstance(raw_guess, float) and not raw_guess.is_integer():
            raise ValueError
        guess = int(raw_guess)
    except (TypeError, ValueError):
        return (
            jsonify(
                error="Enter a whole number.",
                code="invalid_guess",
                game=public_game(game),
            ),
            400,
        )

    if not game["low"] <= guess <= game["high"]:
        return (
            jsonify(
                error=f"Pick a number between {game['low']} and {game['high']}.",
                code="out_of_range",
                game=public_game(game),
            ),
            400,
        )

    game["attempts"] += 1
    secret = game["secret"]
    attempts = game["attempts"]

    if guess == secret:
        game["status"] = "won"
        game["low"] = game["high"] = secret
        stats = get_stats()
        stats["played"] += 1
        stats["wins"] += 1
        stats["streak"] += 1
        stats["best_streak"] = max(stats["best_streak"], stats["streak"])
        if stats["best_guesses"] is None or attempts < stats["best_guesses"]:
            stats["best_guesses"] = attempts
        session["stats"] = stats

        result = {
            "outcome": "correct",
            "tone": "correct",
            "temperature": "Bullseye",
            "title": "Bullseye",
            "detail": (
                f"The secret number was {secret}. "
                f"You found it in {attempts} {plural_guesses(attempts)}."
            ),
        }
        game["history"].append(
            {
                "guess": guess,
                "direction": "correct",
                "temperature": "Bullseye",
                "tone": "correct",
            }
        )
    else:
        direction = "low" if guess < secret else "high"
        temperature, tone = temperature_for(
            guess, secret, game["max"] - game["min"]
        )

        if direction == "low":
            game["low"] = max(game["low"], guess + 1)
        else:
            game["high"] = min(game["high"], guess - 1)

        game["history"].append(
            {
                "guess": guess,
                "direction": direction,
                "temperature": temperature,
                "tone": tone,
            }
        )

        if attempts >= game["max_attempts"]:
            game["status"] = "lost"
            stats = get_stats()
            stats["played"] += 1
            stats["streak"] = 0
            session["stats"] = stats

            result = {
                "outcome": "lost",
                "tone": "lost",
                "temperature": None,
                "title": "Out of guesses",
                "detail": (
                    f"The secret number was {secret}. "
                    "Start another round and try again."
                ),
            }
        else:
            phrase = {
                "Blazing hot": "You're practically touching it.",
                "Hot": "You're close.",
                "Warm": "You're in the neighborhood.",
                "Cool": "Not quite there.",
                "Freezing": "You're far away.",
            }[temperature]
            result = {
                "outcome": direction,
                "tone": tone,
                "temperature": temperature,
                "title": "Too low" if direction == "low" else "Too high",
                "detail": (
                    f"{phrase} Try a "
                    f"{'higher' if direction == 'low' else 'lower'} number."
                ),
            }

    game["last_result"] = result
    session["game"] = game

    return jsonify(game=public_game(game), result=result, stats=get_stats())


@app.post("/api/abandon")
def abandon_game():
    session.pop("game", None)
    return jsonify(ok=True, stats=get_stats())


if __name__ == "__main__":
    app.run(debug=True)
