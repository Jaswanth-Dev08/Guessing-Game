import random

DIFFICULTIES = {
    "easy": (1, 50),
    "medium": (1, 100),
    "hard": (1, 500),
}

QUIT_KEYS = {"q", "quit", "exit"}


def prompt_difficulty():
    names = list(DIFFICULTIES)
    print("\nChoose a difficulty:")
    for i, name in enumerate(names, start=1):
        low, high = DIFFICULTIES[name]
        print(f"  {i}. {name.capitalize():<7} ({low}-{high})")
    while True:
        choice = input("> ").strip().lower()
        if choice in DIFFICULTIES:
            return choice
        if choice.isdigit() and 1 <= int(choice) <= len(names):
            return names[int(choice) - 1]
        print("Invalid choice. Pick a number or type a difficulty.")


def read_guess(low, high):
    while True:
        raw = input("Your guess: ").strip()
        if raw.lower() in QUIT_KEYS:
            return None
        try:
            guess = int(raw)
        except ValueError:
            print("That's not a number.")
            continue
        if not low <= guess <= high:
            print(f"Out of range. Stay between {low} and {high}.")
            continue
        return guess


def closeness(guess, secret):
    distance = abs(guess - secret)
    if distance <= 3:
        return "Scorching hot!"
    if distance <= 10:
        return "Warm."
    if distance <= 25:
        return "Cool."
    return "Way off."


def play_round(difficulty):
    low, high = DIFFICULTIES[difficulty]
    secret = random.randint(low, high)
    print(f"\nI'm thinking of a number between {low} and {high}.")
    print("(type 'quit' to give up)")

    attempts = 0
    while True:
        guess = read_guess(low, high)
        if guess is None:
            print(f"\nYou gave up after {attempts} guesses. The number was {secret}.")
            return None

        attempts += 1
        if guess < secret:
            print(f"Too low! {closeness(guess, secret)}")
        elif guess > secret:
            print(f"Too high! {closeness(guess, secret)}")
        else:
            print(f"\nCorrect! It was {secret} and you found it in {attempts} guesses.")
            return attempts


def ask_play_again():
    while True:
        answer = input("\nPlay again? [y/n] ").strip().lower()
        if answer in {"y", "yes"}:
            return True
        if answer in {"n", "no"}:
            return False
        print("Please answer y or n.")


def show_stats(wins, played, total_attempts):
    print("\n" + "=" * 34)
    print("  GAME OVER".center(34))
    print("=" * 34)
    print(f"  Rounds played : {played}")
    print(f"  Rounds won    : {wins}")
    if played:
        win_rate = wins / played * 100
        print(f"  Win rate      : {win_rate:.0f}%")
    if total_attempts:
        print(f"  Avg. guesses  : {total_attempts / wins:.1f} per win")
    print("=" * 34)


def main():
    print("=" * 34)
    print("  NUMBER GUESSING GAME".center(34))
    print("=" * 34)

    wins = 0
    played = 0
    total_attempts = 0

    try:
        while True:
            difficulty = prompt_difficulty()
            result = play_round(difficulty)

            if result is None:
                break

            played += 1
            total_attempts += result
            wins += 1

            if not ask_play_again():
                break

        show_stats(wins, played, total_attempts)
    except (KeyboardInterrupt, EOFError):
        print("\n\nInterrupted. Bye!")


if __name__ == "__main__":
    main()