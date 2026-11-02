import unittest

from app import DIFFICULTIES, app


class NumberGuessingGameTests(unittest.TestCase):
    def setUp(self):
        app.config.update(TESTING=True, SECRET_KEY="test-secret")
        self.client = app.test_client()

    def start_game(self, difficulty="easy"):
        response = self.client.post("/api/new-game", json={"difficulty": difficulty})
        self.assertEqual(response.status_code, 200)
        return response.get_json()

    def game_state(self):
        with self.client.session_transaction() as session:
            return session["game"]

    def test_home_page_renders(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"NUMERIS", response.data)
        self.assertIn(b"Find the secret number", response.data)

    def test_new_game_rejects_unknown_difficulty(self):
        response = self.client.post("/api/new-game", json={"difficulty": "impossible"})
        self.assertEqual(response.status_code, 400)

    def test_winning_a_round_updates_stats_and_reveals_secret(self):
        game = self.start_game("medium")["game"]
        secret = self.game_state()["secret"]

        response = self.client.post("/api/guess", json={"guess": secret})
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()

        self.assertEqual(payload["game"]["status"], "won")
        self.assertEqual(payload["game"]["secret"], secret)
        self.assertEqual(payload["game"]["attempts"], 1)
        self.assertEqual(payload["stats"]["wins"], 1)
        self.assertEqual(payload["stats"]["played"], 1)
        self.assertEqual(payload["stats"]["streak"], 1)
        self.assertEqual(payload["stats"]["best_guesses"], 1)

        state = self.client.get("/api/state").get_json()
        self.assertEqual(state["game"]["status"], "won")
        self.assertEqual(state["game"]["secret"], secret)

    def test_wrong_guess_returns_hint_and_narrows_range(self):
        self.start_game("easy")
        secret = self.game_state()["secret"]
        guess = 1 if secret != 1 else 50

        response = self.client.post("/api/guess", json={"guess": guess})
        payload = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["game"]["status"], "playing")
        self.assertEqual(payload["game"]["attempts"], 1)
        self.assertEqual(len(payload["game"]["history"]), 1)
        self.assertEqual(payload["result"]["outcome"], "low" if guess < secret else "high")
        if guess < secret:
            self.assertGreaterEqual(payload["game"]["low"], guess + 1)
        else:
            self.assertLessEqual(payload["game"]["high"], guess - 1)

    def test_out_of_range_guess_does_not_use_an_attempt(self):
        self.start_game("easy")
        secret = self.game_state()["secret"]

        response = self.client.post("/api/guess", json={"guess": secret + 1000})
        payload = response.get_json()

        self.assertEqual(response.status_code, 400)
        self.assertEqual(payload["code"], "out_of_range")
        self.assertEqual(self.game_state()["attempts"], 0)

    def test_losing_a_round_resets_the_streak(self):
        self.start_game("easy")
        with self.client.session_transaction() as session:
            session["game"]["max_attempts"] = 1
            session["stats"] = {
                "played": 2,
                "wins": 2,
                "streak": 2,
                "best_streak": 2,
                "best_guesses": 4,
            }
            secret = session["game"]["secret"]
        wrong_guess = 1 if secret != 1 else 2

        response = self.client.post("/api/guess", json={"guess": wrong_guess})
        payload = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["game"]["status"], "lost")
        self.assertEqual(payload["game"]["secret"], secret)
        self.assertEqual(payload["stats"]["played"], 3)
        self.assertEqual(payload["stats"]["wins"], 2)
        self.assertEqual(payload["stats"]["streak"], 0)

    def test_abandon_clears_the_current_round(self):
        self.start_game("hard")
        response = self.client.post("/api/abandon")

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(self.client.get("/api/state").get_json()["game"])


if __name__ == "__main__":
    unittest.main()
