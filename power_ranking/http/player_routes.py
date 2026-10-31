from .common import *

class PlayerRoutes:
    def handle_add_player(self, body):
        admin = self.require_roles("Admin")

        if admin is None:
            return

        name = body.get("name")
        tier = body.get("tier", 5)
        stars = body.get("stars", 0)

        if not isinstance(name, str) or not name.strip():
            self.send_error_json(
                HTTPStatus.BAD_REQUEST, "Player name is required."
            )
            return

        name = name.strip()

        with DATA_LOCK:
            if name in data["players"]:
                self.send_error_json(
                    HTTPStatus.CONFLICT, "Player already exists."
                )
                return

            try:
                tier, stars = normalize_manual_edit(tier, stars)
            except ValueError as exc:
                self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
                return

            data["initial_players"][name] = {
                "tier": tier,
                "stars": stars,
            }

            data["players"][name] = {
                "tier": tier,
                "stars": stars,
                "win_streak": 0,
                "play_streak": 0,
                "off_streak": 0,
            }
            data["deleted_players"] = [
                deleted_name
                for deleted_name in data["deleted_players"]
                if deleted_name != name
            ]

            save_data()

        self.send_json(
            HTTPStatus.CREATED,
            {"message": "Player added successfully."},
        )


    def handle_delete_player(self, body):
        """Remove a player from the active roster without changing history or logs."""
        admin = self.require_roles("Admin")

        if admin is None:
            return

        name = body.get("name")
        if not isinstance(name, str) or not name.strip():
            self.send_error_json(
                HTTPStatus.BAD_REQUEST, "Player name is required."
            )
            return

        name = name.strip()
        if body.get("confirm") is not True:
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "Set confirm to true to delete this player.",
            )
            return

        with DATA_LOCK:
            if name not in data["players"]:
                self.send_error_json(
                    HTTPStatus.NOT_FOUND, "Player not found."
                )
                return

            del data["players"][name]
            if name not in data["deleted_players"]:
                data["deleted_players"].append(name)
            prune_deleted_players(data)
            save_data()

        self.send_json(
            HTTPStatus.OK,
            {
                "message": (
                    f"Player {name} removed from the active roster. "
                    "Match history and logs were unchanged."
                ),
                "name": name,
            },
        )


    def handle_delete_players(self, body):
        """Remove multiple players without changing history or logs."""
        admin = self.require_roles("Admin")

        if admin is None:
            return

        names = body.get("names")
        if (
            not isinstance(names, list)
            or not names
            or any(not isinstance(name, str) or not name.strip() for name in names)
        ):
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "A non-empty list of player names is required.",
            )
            return

        names = list(dict.fromkeys(name.strip() for name in names))
        if body.get("confirm") is not True:
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "Set confirm to true to delete these players.",
            )
            return

        with DATA_LOCK:
            missing_names = [
                name for name in names if name not in data["players"]
            ]
            if missing_names:
                self.send_error_json(
                    HTTPStatus.NOT_FOUND,
                    "Player(s) not found: " + ", ".join(missing_names),
                )
                return

            for name in names:
                del data["players"][name]
                if name not in data["deleted_players"]:
                    data["deleted_players"].append(name)
            prune_deleted_players(data)
            save_data()

        self.send_json(
            HTTPStatus.OK,
            {
                "message": (
                    f"{len(names)} player(s) removed from the active roster. "
                    "Match history and logs were unchanged."
                ),
                "names": names,
            },
        )


    def handle_edit_player(self, name, body):
        """Edit current player state without rewriting match history."""
        admin = self.require_roles("Admin")

        if admin is None:
            return

        with DATA_LOCK:
            player = data["players"].get(name)

            if player is None:
                self.send_error_json(
                    HTTPStatus.NOT_FOUND, "Player not found."
                )
                return

            tier = body.get("tier", player["tier"])
            stars = body.get("stars", player["stars"])

            try:
                tier, stars = normalize_manual_edit(tier, stars)
            except ValueError as exc:
                self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
                return

            streak_fields = (
                "win_streak",
                "play_streak",
                "off_streak",
            )
            new_streaks = {}

            for field in streak_fields:
                value = body.get(field, player.get(field, 0))

                if (
                    not isinstance(value, int)
                    or isinstance(value, bool)
                    or value < 0
                    or value > 100000
                ):
                    self.send_error_json(
                        HTTPStatus.BAD_REQUEST,
                        f"{field} must be an integer between 0 and 100000.",
                    )
                    return

                new_streaks[field] = value

            player["tier"] = tier
            player["stars"] = stars
            player.update(new_streaks)

            after_match_id = max(
                [
                    record["id"]
                    for record in data["match_records"]
                ]
                + [
                    edit["after_match_id"]
                    for edit in data["manual_ranking_edits"]
                ],
                default=0,
            )
            data["manual_ranking_edits"].append({
                "after_match_id": after_match_id,
                "player": name,
                "state": {
                    field: player[field]
                    for field in (
                        "tier",
                        "stars",
                        "win_streak",
                        "play_streak",
                        "off_streak",
                    )
                },
            })
            save_data()

            updated_player = {
                "name": name,
                "tier": player["tier"],
                "stars": player["stars"],
                "win_streak": player["win_streak"],
                "play_streak": player["play_streak"],
                "off_streak": player["off_streak"],
            }

        self.send_json(
            HTTPStatus.OK,
            {
                "message": "Player state updated successfully.",
                "player": updated_player,
            },
        )
