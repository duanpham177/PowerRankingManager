from .common import *

class MatchRoutes:
    def handle_add_match(self, body):
        user = self.require_roles("Admin", "Operator")

        if user is None:
            return

        with DATA_LOCK:
            try:
                normalized = validate_match_record(body)
            except ValueError as exc:
                self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
                return

            record = {
                "id": data["next_match_id"],
                **normalized,
            }

            # Build detailed log events while applying this match.
            log_events = []

            apply_match_record(
                data["players"],
                record,
                log_events=log_events,
            )

            data["next_match_id"] += 1
            data["match_records"].append(copy.deepcopy(record))

            refresh_history()
            append_match_log(record, log_events)

            # Ranking, records, history, and logs are persisted together.
            save_data()

            players = player_rows()
            saved_log = copy.deepcopy(data["match_logs"][-1])

        self.send_json(
            HTTPStatus.CREATED,
            {
                "message": "Match recorded successfully.",
                "match": record,
                "players": players,
                "log": saved_log,
            },
        )
