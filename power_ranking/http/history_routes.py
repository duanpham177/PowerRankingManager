from .common import *

class HistoryRoutes:
    def handle_delete_history(self, body):
        """
        Hide every match from the displayed history.

        Source records, rankings, and logs are not changed.
        """
        admin = self.require_roles("Admin")

        if admin is None:
            return

        if body.get("confirm") is not True:
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "Set confirm to true to clear the displayed history.",
            )
            return

        with DATA_LOCK:
            record_ids = {
                record["id"] for record in data["match_records"]
            }
            already_hidden = record_ids & set(data["hidden_match_ids"])

            data["hidden_match_ids"] = sorted(record_ids)
            refresh_history()
            save_data()

            newly_hidden = len(record_ids) - len(already_hidden)

        self.send_json(
            HTTPStatus.OK,
            {
                "message": (
                    "Displayed match history cleared. "
                    "Source records and rankings are unchanged."
                ),
                "hidden_count": newly_hidden,
                "hidden_match_count": len(record_ids),
                "source_match_count": len(record_ids),
                "match_history": [],
            },
        )


    def handle_delete_match(self, body):
        """Delete one match, rebuild ranking, and preserve edits and logs."""
        admin = self.require_roles("Admin")

        if admin is None:
            return

        match_id = body.get("match_id")
        if not is_plain_int(match_id) or match_id < 1:
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "A valid match_id is required.",
            )
            return

        if body.get("confirm") is not True:
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "Set confirm to true to permanently delete this match.",
            )
            return

        with DATA_LOCK:
            record = next(
                (
                    item for item in data["match_records"]
                    if item["id"] == match_id
                ),
                None,
            )

            if record is None:
                self.send_error_json(
                    HTTPStatus.NOT_FOUND, "Match not found."
                )
                return

            previous_records = data["match_records"]
            previous_hidden_ids = data["hidden_match_ids"]
            previous_deleted_players = data["deleted_players"]
            previous_initial_players = data["initial_players"].copy()
            previous_manual_edits = data["manual_ranking_edits"]
            data["match_records"] = [
                item for item in previous_records
                if item["id"] != match_id
            ]
            data["hidden_match_ids"] = [
                item for item in previous_hidden_ids
                if item != match_id
            ]
            prune_deleted_players(data)

            try:
                rebuild_ranking()
            except ValueError as exc:
                data["match_records"] = previous_records
                data["hidden_match_ids"] = previous_hidden_ids
                data["deleted_players"] = previous_deleted_players
                data["initial_players"] = previous_initial_players
                data["manual_ranking_edits"] = previous_manual_edits
                self.send_error_json(HTTPStatus.CONFLICT, str(exc))
                return

            save_data()
            source_count = len(data["match_records"])

        self.send_json(
            HTTPStatus.OK,
            {
                "message": (
                    f"Match #{match_id} permanently deleted. "
                    "Ranking rebuilt with saved manual player edits."
                ),
                "deleted_match_id": match_id,
                "source_match_count": source_count,
            },
        )


    def handle_delete_all_history(self, body):
        """Delete all source matches, rebuild ranking, and preserve logs."""
        admin = self.require_roles("Admin")

        if admin is None:
            return

        if body.get("confirm") is not True:
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "Set confirm to true to permanently delete all match history.",
            )
            return

        with DATA_LOCK:
            deleted_count = len(data["match_records"])
            previous_records = data["match_records"]
            previous_hidden_ids = data["hidden_match_ids"]
            previous_deleted_players = data["deleted_players"]
            previous_initial_players = data["initial_players"].copy()
            previous_manual_edits = data["manual_ranking_edits"]
            data["match_records"] = []
            data["hidden_match_ids"] = []
            prune_deleted_players(data)

            try:
                rebuild_ranking()
            except ValueError as exc:
                data["match_records"] = previous_records
                data["hidden_match_ids"] = previous_hidden_ids
                data["deleted_players"] = previous_deleted_players
                data["initial_players"] = previous_initial_players
                data["manual_ranking_edits"] = previous_manual_edits
                self.send_error_json(HTTPStatus.CONFLICT, str(exc))
                return

            save_data()

        self.send_json(
            HTTPStatus.OK,
            {
                "message": (
                    f"{deleted_count} source match(es) permanently deleted. "
                    "Ranking rebuilt with saved manual player edits."
                ),
                "deleted_count": deleted_count,
                "source_match_count": 0,
            },
        )


    def handle_restore_history(self, body):
        """Show every hidden match again. Rankings are unchanged."""
        admin = self.require_roles("Admin")

        if admin is None:
            return

        with DATA_LOCK:
            restored_count = hidden_match_count()

            data["hidden_match_ids"] = []
            refresh_history()
            save_data()

            history = copy.deepcopy(data["match_history"])
            source_count = len(data["match_records"])

        self.send_json(
            HTTPStatus.OK,
            {
                "message": (
                    "Hidden match history restored. "
                    "Rankings are unchanged."
                ),
                "restored_count": restored_count,
                "hidden_match_count": 0,
                "source_match_count": source_count,
                "match_history": history,
            },
        )


    def handle_clear_logs(self, body):
        """Clear match logs without changing rankings or match history."""
        admin = self.require_roles("Admin")

        if admin is None:
            return

        if body.get("confirm") is not True:
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "Set confirm to true to clear match logs.",
            )
            return

        with DATA_LOCK:
            deleted_count = len(data["match_logs"])
            data["match_logs"] = []
            save_data()

        self.send_json(
            HTTPStatus.OK,
            {
                "message": "Match logs cleared successfully.",
                "deleted_count": deleted_count,
                "match_logs": [],
            },
        )
