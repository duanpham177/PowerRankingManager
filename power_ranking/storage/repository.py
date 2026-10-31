import copy
import json
import os
import threading

from ..config import (
    DATA_DIR, DATA_FILE, DRINK_DATA_FILE, LEGACY_DATA_FILE,
    LEGACY_DRINK_DATA_FILE, MAX_MATCH_LOGS, TIER_POINTS,
)

DATA_LOCK = threading.RLock()

def create_initial_players():
    """Return the initial Power Ranking roster."""
    initial = {
        "A1": (1, 1),
        "A2": (1, 1),
        "A3": (1, 0),
        "B1": (2, 0),
        "B2": (2, 1),
        "B3": (2, 0),
        "B4": (2, 2),
        "C1": (3, 0),
        "C2": (3, 0),
        "C3": (3, 0),
        "C4": (3, 2),
        "D1": (4, 0),
        "D2": (4, 1),
        "D3": (4, 0),
        "D4": (4, 2),
        "D5": (4, 2),
        "E1": (5, 0),
        "E2": (5, 0),
        "E3": (5, 1),
        "E4": (5, 1),
        "E5": (5, 1),
        "E6": (5, 2),
        "E7": (5, 2),
    }

    return {
        name: {"tier": tier, "stars": stars}
        for name, (tier, stars) in initial.items()
    }


def create_player_state(initial_players):
    """Create ranking state with empty streak counters."""
    return {
        name: {
            "tier": values["tier"],
            "stars": values["stars"],
            "win_streak": 0,
            "play_streak": 0,
            "off_streak": 0,
        }
        for name, values in initial_players.items()
    }


def create_default_data():
    initial_players = create_initial_players()

    return {
        "users": [],
        "initial_players": initial_players,
        "players": create_player_state(initial_players),
        "deleted_players": [],
        "match_records": [],
        "manual_ranking_edits": [],
        "match_history": [],
        "hidden_match_ids": [],
        "match_logs": [],
        "next_match_id": 1,
    }


def create_default_drink_shop():
    return {
        "shops": [],
        "orders": [],
        "next_order_id": 1,
    }


def write_data_file(value):
    """Write JSON data atomically."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    temporary_file = DATA_FILE.with_suffix(".tmp")

    with temporary_file.open("w", encoding="utf-8") as file:
        json.dump(value, file, ensure_ascii=False, indent=2)
        file.flush()
        os.fsync(file.fileno())

    os.replace(temporary_file, DATA_FILE)


def write_drink_data_file(value):
    """Write drink-shop data atomically, separately from ranking data."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    temporary_file = DRINK_DATA_FILE.with_suffix(".tmp")

    with temporary_file.open("w", encoding="utf-8") as file:
        json.dump(value, file, ensure_ascii=False, indent=2)
        file.flush()
        os.fsync(file.fileno())

    os.replace(temporary_file, DRINK_DATA_FILE)


def save_data():
    with DATA_LOCK:
        write_data_file(data)


def load_drink_shop_data(embedded_data=None):
    source_file = next(
        (
            candidate
            for candidate in (DRINK_DATA_FILE, LEGACY_DRINK_DATA_FILE)
            if candidate.exists()
        ),
        None,
    )
    if source_file is not None:
        try:
            with source_file.open("r", encoding="utf-8") as file:
                drink_data = json.load(file)
        except (OSError, json.JSONDecodeError) as exc:
            raise RuntimeError(
                "Unable to load drink_data.json. Check the file format and permissions."
            ) from exc
        needs_write = source_file != DRINK_DATA_FILE
    else:
        drink_data = (
            embedded_data
            if isinstance(embedded_data, dict) and "shops" in embedded_data
            else create_default_drink_shop()
        )
        needs_write = True

    if (
        not isinstance(drink_data, dict)
        or not isinstance(drink_data.get("shops"), list)
        or not isinstance(drink_data.get("orders"), list)
        or not is_plain_int(drink_data.get("next_order_id"))
        or drink_data["next_order_id"] < 1
    ):
        raise RuntimeError("Invalid drink_data.json: drink data is invalid.")

    if needs_write:
        write_drink_data_file(drink_data)

    return drink_data


def is_plain_int(value):
    return isinstance(value, int) and not isinstance(value, bool)


def prune_deleted_players(target_data):
    """Forget deleted players once no retained source match references them."""
    deleted_players = list(dict.fromkeys(target_data["deleted_players"]))
    referenced_players = set()

    for record in target_data["match_records"]:
        if not isinstance(record, dict):
            continue

        results = record.get("results")
        if not isinstance(results, list):
            continue

        for result in results:
            if not isinstance(result, dict):
                continue

            members = result.get("members")
            if isinstance(members, list):
                referenced_players.update(
                    name for name in members if isinstance(name, str)
                )

    retained_deleted_players = [
        name for name in deleted_players if name in referenced_players
    ]
    stale_deleted_players = set(deleted_players) - referenced_players
    changed = target_data["deleted_players"] != retained_deleted_players

    target_data["deleted_players"] = retained_deleted_players

    for name in deleted_players:
        if name in target_data["players"]:
            del target_data["players"][name]
            changed = True

    for name in stale_deleted_players:
        if name in target_data["initial_players"]:
            del target_data["initial_players"][name]
            changed = True

    retained_edits = [
        edit
        for edit in target_data["manual_ranking_edits"]
        if edit["player"] not in stale_deleted_players
    ]
    if len(retained_edits) != len(target_data["manual_ranking_edits"]):
        target_data["manual_ranking_edits"] = retained_edits
        changed = True

    return changed


def load_data():
    source_file = next(
        (
            candidate
            for candidate in (DATA_FILE, LEGACY_DATA_FILE)
            if candidate.exists()
        ),
        None,
    )
    if source_file is None:
        initial_data = create_default_data()
        drink_data = load_drink_shop_data()
        write_data_file(initial_data)
        return initial_data, drink_data

    try:
        with source_file.open("r", encoding="utf-8") as file:
            loaded_data = json.load(file)

    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(
            "Unable to load data.json. Check the file format and permissions."
        ) from exc

    if not isinstance(loaded_data, dict):
        raise RuntimeError("Invalid data.json: root must be a JSON object.")

    drink_data_migrated = "drink_shop" in loaded_data
    embedded_drink_shop = loaded_data.pop("drink_shop", None)
    defaults = create_default_data()

    for key, value in defaults.items():
        loaded_data.setdefault(key, copy.deepcopy(value))

    required_lists = (
        "users",
        "deleted_players",
        "match_records",
        "manual_ranking_edits",
        "match_history",
        "hidden_match_ids",
        "match_logs",
    )

    for key in required_lists:
        if not isinstance(loaded_data.get(key), list):
            raise RuntimeError(
                f"Invalid data.json: {key} must be a list."
            )

    if not isinstance(loaded_data.get("players"), dict):
        raise RuntimeError("Invalid data.json: players must be an object.")

    if not isinstance(loaded_data.get("initial_players"), dict):
        raise RuntimeError(
            "Invalid data.json: initial_players must be an object."
        )

    for edit in loaded_data["manual_ranking_edits"]:
        if (
            not isinstance(edit, dict)
            or not is_plain_int(edit.get("after_match_id"))
            or edit["after_match_id"] < 0
            or not isinstance(edit.get("player"), str)
            or not edit["player"]
            or not isinstance(edit.get("state"), dict)
        ):
            raise RuntimeError(
                "Invalid data.json: manual_ranking_edits contains an invalid entry."
            )
        state = edit["state"]
        if (
            any(
                not is_plain_int(state.get(field))
                for field in (
                    "tier",
                    "stars",
                    "win_streak",
                    "play_streak",
                    "off_streak",
                )
            )
            or state["tier"] not in TIER_POINTS
            or not 0 <= state["stars"] <= 10
            or any(
                not 0 <= state[field] <= 100000
                for field in ("win_streak", "play_streak", "off_streak")
            )
        ):
            raise RuntimeError(
                "Invalid data.json: manual_ranking_edits contains an invalid player state."
            )

    if not all(
        isinstance(name, str) and name
        for name in loaded_data["deleted_players"]
    ):
        raise RuntimeError(
            "Invalid data.json: deleted_players must contain player names."
        )

    user_auth_migrated = False
    for user in loaded_data["users"]:
        if not isinstance(user, dict):
            raise RuntimeError("Invalid data.json: users contains an invalid entry.")

        for key, value in (
            ("backup_password_hash", None),
            ("failed_login_attempts", 0),
            ("locked", False),
            ("approved", True),
        ):
            if key not in user:
                user[key] = value
                user_auth_migrated = True

        if (
            not is_plain_int(user["failed_login_attempts"])
            or user["failed_login_attempts"] < 0
        ):
            user["failed_login_attempts"] = 0
            user_auth_migrated = True

        if not isinstance(user["locked"], bool):
            user["locked"] = False
            user_auth_migrated = True
        if not isinstance(user["approved"], bool):
            user["approved"] = True
            user_auth_migrated = True

    # Source match records are the single source of truth for history.
    for record in loaded_data["match_records"]:
        if (
            not isinstance(record, dict)
            or not is_plain_int(record.get("id"))
            or not isinstance(record.get("date"), str)
            or not is_plain_int(record.get("team_count"))
            or not isinstance(record.get("results"), list)
        ):
            raise RuntimeError(
                "Invalid data.json: match_records contains an invalid entry."
            )

    # Keep only integer IDs in the hidden list.
    loaded_data["hidden_match_ids"] = [
        match_id
        for match_id in loaded_data["hidden_match_ids"]
        if is_plain_int(match_id)
    ]

    # Never reuse an existing match ID.
    highest_id = max(
        (record["id"] for record in loaded_data["match_records"]),
        default=0,
    )
    next_id = loaded_data.get("next_match_id")

    if not is_plain_int(next_id) or next_id <= highest_id:
        loaded_data["next_match_id"] = highest_id + 1

    # Older files stored a full ranking snapshot in every history entry.
    # History is display-only now, so drop the snapshots to keep it small.
    loaded_data["match_history"] = [
        {
            key: value
            for key, value in entry.items()
            if key != "ranking_after_match"
        }
        for entry in loaded_data["match_history"]
        if isinstance(entry, dict)
    ]

    # Keep only the newest log entries.
    loaded_data["match_logs"] = [
        entry
        for entry in loaded_data["match_logs"]
        if isinstance(entry, dict)
    ][-MAX_MATCH_LOGS:]

    drink_data = load_drink_shop_data(embedded_drink_shop)
    deleted_player_data_pruned = prune_deleted_players(loaded_data)
    if (
        source_file != DATA_FILE
        or user_auth_migrated
        or deleted_player_data_pruned
        or drink_data_migrated
    ):
        write_data_file(loaded_data)

    return loaded_data, drink_data


data, drink_shop = load_data()
