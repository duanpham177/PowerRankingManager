import argparse
import copy
import getpass
import hashlib
import hmac
import json
import os
import secrets
import threading

from datetime import datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


# ============================================================
# Configuration
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data.json"

HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "5000"))

SESSION_COOKIE_NAME = "power_ranking_session"
SESSION_LIFETIME_SECONDS = 8 * 60 * 60
MAX_LOGIN_FAILURES = 5
MAX_PENDING_USER_APPROVALS = 100

PASSWORD_HASH_N = 2**14
PASSWORD_HASH_R = 8
PASSWORD_HASH_P = 1

ROLES = {"Admin", "Operator", "Viewer"}

TIER_POINTS = {
    1: 5,
    2: 4,
    3: 3,
    4: 2,
    5: 1,
}

MATCH_STAR_CHANGES = {
    2: {1: 1, 2: -1},
    3: {1: 1, 2: 0, 3: -1},
    4: {1: 2, 2: 1, 3: -1, 4: -2},
}

MAX_MATCH_LOGS = 10

DATA_LOCK = threading.RLock()
SESSIONS = {}
SESSIONS_LOCK = threading.RLock()


# ============================================================
# Password security
# ============================================================

def hash_password(password):
    """Create a salted password hash using scrypt."""
    salt = secrets.token_bytes(16)

    password_hash = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=PASSWORD_HASH_N,
        r=PASSWORD_HASH_R,
        p=PASSWORD_HASH_P,
        dklen=64,
    )

    return {
        "algorithm": "scrypt",
        "salt": salt.hex(),
        "hash": password_hash.hex(),
    }


def verify_password(password, stored_hash):
    """Verify a password against a stored scrypt hash."""
    try:
        if not isinstance(stored_hash, dict):
            return False

        if stored_hash.get("algorithm") != "scrypt":
            return False

        salt = bytes.fromhex(stored_hash["salt"])
        expected_hash = bytes.fromhex(stored_hash["hash"])

        if len(expected_hash) != 64:
            return False

        actual_hash = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=PASSWORD_HASH_N,
            r=PASSWORD_HASH_R,
            p=PASSWORD_HASH_P,
            dklen=len(expected_hash),
        )

        return hmac.compare_digest(actual_hash, expected_hash)

    except (KeyError, TypeError, ValueError):
        return False


def validate_new_password(password):
    """Validate a new password."""
    if not isinstance(password, str):
        raise ValueError("Password is required.")

    if len(password) < 10:
        raise ValueError("Password must contain at least 10 characters.")

    return password


# ============================================================
# Initial data
# ============================================================

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


# ============================================================
# Data persistence
# ============================================================

def write_data_file(value):
    """Write JSON data atomically."""
    temporary_file = DATA_FILE.with_suffix(".tmp")

    with temporary_file.open("w", encoding="utf-8") as file:
        json.dump(value, file, ensure_ascii=False, indent=2)
        file.flush()
        os.fsync(file.fileno())

    os.replace(temporary_file, DATA_FILE)


def save_data():
    with DATA_LOCK:
        write_data_file(data)


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
    if not DATA_FILE.exists():
        initial_data = create_default_data()
        temporary_file = DATA_FILE.with_suffix(".tmp")

        with temporary_file.open("w", encoding="utf-8") as file:
            json.dump(initial_data, file, ensure_ascii=False, indent=2)
            file.flush()
            os.fsync(file.fileno())

        os.replace(temporary_file, DATA_FILE)
        return initial_data

    try:
        with DATA_FILE.open("r", encoding="utf-8") as file:
            loaded_data = json.load(file)

    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(
            "Unable to load data.json. Check the file format and permissions."
        ) from exc

    if not isinstance(loaded_data, dict):
        raise RuntimeError("Invalid data.json: root must be a JSON object.")

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

    deleted_player_data_pruned = prune_deleted_players(loaded_data)
    if user_auth_migrated or deleted_player_data_pruned:
        write_data_file(loaded_data)

    return loaded_data


data = load_data()


# ============================================================
# User and session management
# ============================================================

def find_user(username):
    if not isinstance(username, str):
        return None

    normalized_username = username.casefold()

    for user in data["users"]:
        if (
            isinstance(user, dict)
            and isinstance(user.get("username"), str)
            and user["username"].casefold() == normalized_username
        ):
            return user

    return None


def public_user(user):
    return {
        "username": user["username"],
        "role": user["role"],
        "active": user.get("active", True),
        "must_change_password": user.get(
            "must_change_password", False
        ),
        "has_backup_password": bool(user.get("backup_password_hash")),
        "locked": user.get("locked", False),
        "approved": user.get("approved", True),
    }


def record_failed_login(user):
    user["failed_login_attempts"] = user.get(
        "failed_login_attempts", 0
    ) + 1
    if user["failed_login_attempts"] >= MAX_LOGIN_FAILURES:
        user["locked"] = True


def bootstrap_required():
    return not any(
        user.get("role") == "Admin"
        and user.get("active", True)
        and user.get("approved", True)
        for user in data["users"]
    )


def create_session(username):
    token = secrets.token_urlsafe(32)

    with SESSIONS_LOCK:
        SESSIONS[token] = {
            "username": username,
            "created_at": datetime.now().timestamp(),
        }

    return token


def get_session_token(handler):
    cookie_header = handler.headers.get("Cookie", "")

    for cookie in cookie_header.split(";"):
        name, separator, value = cookie.strip().partition("=")

        if separator and name == SESSION_COOKIE_NAME:
            return value

    return None


def get_current_user(handler):
    token = get_session_token(handler)

    if not token:
        return None

    with SESSIONS_LOCK:
        session_data = SESSIONS.get(token)

        if session_data is None:
            return None

        current_time = datetime.now().timestamp()

        if (
            current_time - session_data["created_at"]
            > SESSION_LIFETIME_SECONDS
        ):
            SESSIONS.pop(token, None)
            return None

        username = session_data["username"]

    with DATA_LOCK:
        user = find_user(username)

        if (
            user is None
            or not user.get("active", True)
            or user.get("locked", False)
        ):
            with SESSIONS_LOCK:
                SESSIONS.pop(token, None)
            return None

        return user


def revoke_user_sessions(username):
    with SESSIONS_LOCK:
        expired_tokens = [
            token
            for token, session_data in SESSIONS.items()
            if session_data["username"].casefold()
            == username.casefold()
        ]

        for token in expired_tokens:
            SESSIONS.pop(token, None)


# ============================================================
# Ranking logic
# ============================================================

def transition_stars(player, delta):
    """
    Apply star changes and Tier transitions immediately.

    Tier 1 is the highest Tier.
    Tier 5 is the lowest Tier.
    Promotion resets stars to zero after four stars.
    Demotion resets stars to three after dropping below zero.
    """
    tier = player["tier"]
    stars = player["stars"]

    if delta > 0:
        for _ in range(delta):
            if tier == 1:
                stars = min(10, stars + 1)
                continue

            stars += 1

            if stars >= 4:
                tier -= 1
                stars = 0

    elif delta < 0:
        for _ in range(abs(delta)):
            if tier == 5:
                stars = max(0, stars - 1)
                continue

            stars -= 1

            if stars < 0:
                tier += 1
                stars = 3

    player["tier"] = tier
    player["stars"] = stars


def normalize_manual_edit(tier, stars):
    """Validate and normalize a direct Admin ranking edit."""
    if not isinstance(tier, int) or isinstance(tier, bool):
        raise ValueError("Tier must be an integer.")

    if not isinstance(stars, int) or isinstance(stars, bool):
        raise ValueError("Stars must be an integer.")

    if tier not in TIER_POINTS:
        raise ValueError("Tier must be between 1 and 5.")

    if stars < 0 or stars > 10:
        raise ValueError("Stars must be between 0 and 10.")

    while tier > 1 and stars >= 4:
        tier -= 1
        stars -= 4

    return tier, stars


def parse_match_date(value):
    if not isinstance(value, str):
        raise ValueError("Match date must be a string.")

    for date_format in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(
                value, date_format
            ).date().isoformat()
        except ValueError:
            continue

    raise ValueError(
        "Use YYYY-MM-DD or DD/MM/YYYY for the match date."
    )


def validate_match_record(body):
    if not isinstance(body, dict):
        raise ValueError("Match data must be a JSON object.")

    match_date = parse_match_date(body.get("date"))
    team_count = body.get("team_count")
    results = body.get("results")

    if (
        not isinstance(team_count, int)
        or isinstance(team_count, bool)
        or team_count not in MATCH_STAR_CHANGES
    ):
        raise ValueError("Team count must be 2, 3, or 4.")

    if not isinstance(results, list) or len(results) != team_count:
        raise ValueError(
            "The number of result entries must match team count."
        )

    seen_ranks = set()
    seen_players = set()
    normalized_results = []

    for result in results:
        if not isinstance(result, dict):
            raise ValueError("Each result must be a JSON object.")

        rank = result.get("rank")
        members = result.get("members")

        if (
            not isinstance(rank, int)
            or isinstance(rank, bool)
            or rank < 1
            or rank > team_count
        ):
            raise ValueError("Rank is outside the allowed range.")

        if rank in seen_ranks:
            raise ValueError("Tied ranks are not supported.")

        if not isinstance(members, list) or not members:
            raise ValueError(
                "Each result must contain at least one player."
            )

        normalized_members = []

        for member in members:
            if not isinstance(member, str) or not member.strip():
                raise ValueError(
                    "Player names must be non-empty strings."
                )

            name = member.strip()

            if name not in data["players"]:
                raise ValueError(f"Unknown player: {name}")

            if name in seen_players:
                raise ValueError(
                    "A player cannot appear more than once per match."
                )

            seen_players.add(name)
            normalized_members.append(name)

        seen_ranks.add(rank)
        normalized_results.append({
            "rank": rank,
            "members": normalized_members,
        })

    if seen_ranks != set(range(1, team_count + 1)):
        raise ValueError(
            "Every rank must be provided exactly once."
        )

    normalized_results.sort(key=lambda item: item["rank"])

    return {
        "date": match_date,
        "team_count": team_count,
        "results": normalized_results,
    }


def ranking_snapshot(player):
    """Return only the ranking fields needed for a log."""
    return {
        "tier": player["tier"],
        "stars": player["stars"],
    }


def describe_ranking_change(before, after):
    """Build a readable description of a player's ranking change."""
    before_text = f"Tier {before['tier']}, {before['stars']} stars"
    after_text = f"Tier {after['tier']}, {after['stars']} stars"

    if after["tier"] < before["tier"]:
        change_type = "promotion"
        description = f"Promoted: {before_text} → {after_text}"
    elif after["tier"] > before["tier"]:
        change_type = "demotion"
        description = f"Demoted: {before_text} → {after_text}"
    elif after["stars"] > before["stars"]:
        change_type = "star_up"
        description = (
            f"Stars increased: {before_text} → {after_text}"
        )
    elif after["stars"] < before["stars"]:
        change_type = "star_down"
        description = (
            f"Stars decreased: {before_text} → {after_text}"
        )
    else:
        change_type = "unchanged"
        description = f"Unchanged: {after_text}"

    return {
        "type": change_type,
        "before": copy.deepcopy(before),
        "after": copy.deepcopy(after),
        "description": description,
    }


def apply_match_record(players, record, log_events=None):
    """Apply match results and streak rewards or penalties."""
    if log_events is None:
        log_events = []

    team_count = record["team_count"]
    result_changes = MATCH_STAR_CHANGES[team_count]
    rank_by_player = {}

    for result in record["results"]:
        for name in result["members"]:
            rank_by_player[name] = result["rank"]

    # Snapshot before applying match-result stars.
    before_results = {
        name: ranking_snapshot(player)
        for name, player in players.items()
    }

    # Apply match results first.
    for name, rank in rank_by_player.items():
        transition_stars(players[name], result_changes[rank])

    # Log star changes caused directly by match results.
    for name, rank in rank_by_player.items():
        before = before_results[name]
        after = ranking_snapshot(players[name])

        if before != after:
            change = describe_ranking_change(before, after)
            log_events.append({
                "player": name,
                "category": "match_result",
                "rank": rank,
                **change,
            })

    # Track streak rewards and penalties separately.
    streak_adjustments = {}
    streak_reasons = {}

    for name, player in players.items():
        rank = rank_by_player.get(name)

        if rank is None:
            player["win_streak"] = 0
            player["play_streak"] = 0
            player["off_streak"] += 1

            if player["off_streak"] >= 2:
                streak_adjustments[name] = -1
                streak_reasons[name] = (
                    "Absent for 2 consecutive matches: -1 star"
                )
                player["off_streak"] = 0

            continue

        player["off_streak"] = 0
        player["play_streak"] += 1

        if rank == 1:
            player["win_streak"] += 1
        else:
            player["win_streak"] = 0

        adjustment = 0
        reasons = []

        if player["play_streak"] >= 3:
            adjustment += 1
            reasons.append("Played 3 consecutive matches: +1 star")
            player["play_streak"] = 0

        if adjustment:
            streak_adjustments[name] = adjustment
            streak_reasons[name] = "; ".join(reasons)

    # Snapshot after match results but before streak adjustments.
    before_streaks = {
        name: ranking_snapshot(player)
        for name, player in players.items()
    }

    # Apply streak changes after match results.
    for name, adjustment in streak_adjustments.items():
        transition_stars(players[name], adjustment)

        before = before_streaks[name]
        after = ranking_snapshot(players[name])

        change = describe_ranking_change(before, after)

        if adjustment > 0:
            category = "attendance_reward"
            label = "Attendance reward"
        else:
            category = "attendance_penalty"
            label = "Attendance penalty"

        log_events.append({
            "player": name,
            "category": category,
            "adjustment": adjustment,
            "reason": streak_reasons.get(name, label),
            "label": label,
            **change,
        })


# ============================================================
# Match history and match logs
# ============================================================
#
# match_records  : source of truth. Never changed by display actions.
# hidden_match_ids: records hidden from the displayed history.
# match_history  : display list derived from records minus hidden IDs.
# match_logs     : the newest MAX_MATCH_LOGS ranking-change logs.
#                  Cleared separately from history.
# ============================================================

def make_history_entry(record):
    """Build one display-only history entry from a source record."""
    return {
        "id": record["id"],
        "date": record["date"],
        "team_count": record["team_count"],
        "results": copy.deepcopy(record["results"]),
        "participants": sorted(
            name
            for result in record["results"]
            for name in result["members"]
        ),
    }


def refresh_history():
    """Rebuild the displayed history from source records."""
    hidden_ids = set(data["hidden_match_ids"])

    ordered_records = sorted(
        data["match_records"],
        key=lambda record: (record["date"], record["id"]),
    )

    data["match_history"] = [
        make_history_entry(record)
        for record in ordered_records
        if record["id"] not in hidden_ids
    ]


def build_log_entry(record, events):
    """Build one match log containing all ranking and streak changes."""
    return {
        "match_id": record["id"],
        "date": record["date"],
        "created_at": datetime.now().astimezone().isoformat(
            timespec="seconds"
        ),
        "team_count": record["team_count"],
        "events": copy.deepcopy(events),
    }


def append_match_log(record, events):
    """Save one match log and keep only the newest entries."""
    data["match_logs"].append(build_log_entry(record, events))
    data["match_logs"] = data["match_logs"][-MAX_MATCH_LOGS:]


def rebuild_ranking():
    """
    Recalculate ranking from initial players, matches, and manual edits.

    Raises ValueError, without changing any data, if a record
    references a player who no longer exists.
    """
    deleted_players = set(data["deleted_players"])
    active_initial_players = {
        name: values
        for name, values in data["initial_players"].items()
        if name not in deleted_players
    }
    players = create_player_state(active_initial_players)

    ordered_records = sorted(
        data["match_records"],
        key=lambda record: (record["date"], record["id"]),
    )

    for record in ordered_records:
        unknown = sorted(
            {
                name
                for result in record["results"]
                for name in result["members"]
            }
            - set(players)
            - deleted_players
        )

        if unknown:
            raise ValueError(
                f"Match #{record['id']} references unknown player(s): "
                + ", ".join(unknown)
            )

    remaining_records = list(ordered_records)
    edit_index = 0
    manual_edits = data["manual_ranking_edits"]

    def apply_active_record(record):
        active_record = {
            **record,
            "results": [
                {
                    **result,
                    "members": [
                        name
                        for name in result["members"]
                        if name in players
                    ],
                }
                for result in record["results"]
            ],
        }
        apply_match_record(players, active_record)

    while edit_index < len(manual_edits):
        after_match_id = manual_edits[edit_index]["after_match_id"]
        earlier_records = [
            record
            for record in remaining_records
            if record["id"] <= after_match_id
        ]
        remaining_records = [
            record
            for record in remaining_records
            if record["id"] > after_match_id
        ]
        for record in earlier_records:
            apply_active_record(record)

        while (
            edit_index < len(manual_edits)
            and manual_edits[edit_index]["after_match_id"] == after_match_id
        ):
            edit = manual_edits[edit_index]
            player = players.get(edit["player"])
            if player is not None:
                for field in (
                    "tier",
                    "stars",
                    "win_streak",
                    "play_streak",
                    "off_streak",
                ):
                    player[field] = edit["state"][field]
            edit_index += 1

    for record in remaining_records:
        apply_active_record(record)

    data["players"] = players
    refresh_history()


# ============================================================
# API state
# ============================================================

def player_rows():
    """Return all players as sorted API rows."""
    rows = [
        {
            "name": name,
            "tier": player["tier"],
            "tier_points": TIER_POINTS[player["tier"]],
            "stars": player["stars"],
            "win_streak": player["win_streak"],
            "play_streak": player["play_streak"],
            "off_streak": player["off_streak"],
        }
        for name, player in data["players"].items()
    ]

    rows.sort(
        key=lambda player: (
            player["tier"],
            -player["stars"],
            player["name"].casefold(),
        )
    )

    return rows


def hidden_match_count():
    record_ids = {record["id"] for record in data["match_records"]}
    return len(record_ids & set(data["hidden_match_ids"]))


def build_state(handler):
    current_user = get_current_user(handler)

    result = {
        "bootstrap_required": bootstrap_required(),
        "current_user": (
            public_user(current_user) if current_user else None
        ),
        "players": player_rows(),
        "match_history": copy.deepcopy(data["match_history"]),
    }

    if current_user:
        # Visible to authenticated users.
        result["match_logs"] = copy.deepcopy(data["match_logs"])
        result["match_log_limit"] = MAX_MATCH_LOGS

    if current_user and current_user["role"] == "Admin":
        result["users"] = [
            public_user(user) for user in data["users"]
        ]
        result["pending_user_approval_count"] = sum(
            not user.get("approved", True) for user in data["users"]
        )
        result["source_match_count"] = len(data["match_records"])
        result["hidden_match_count"] = hidden_match_count()

    return result


# ============================================================
# HTTP request handler
# ============================================================

class PowerRankingHandler(BaseHTTPRequestHandler):
    server_version = "PowerRankingServer/1.0"

    def log_message(self, format_string, *args):
        print(
            f"[{self.log_date_time_string()}] "
            f"{self.address_string()} - {format_string % args}"
        )

    def send_json(self, status, payload, extra_headers=None):
        body = json.dumps(
            payload, ensure_ascii=False
        ).encode("utf-8")

        self.send_response(status)
        self.send_header(
            "Content-Type", "application/json; charset=utf-8"
        )
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "same-origin")

        if extra_headers:
            for header_name, header_value in extra_headers.items():
                self.send_header(header_name, header_value)

        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, status, message):
        self.send_json(status, {"error": message})

    def read_json(self):
        content_type = self.headers.get("Content-Type", "")

        if "application/json" not in content_type.lower():
            raise ValueError(
                "Content-Type must be application/json."
            )

        try:
            content_length = int(
                self.headers.get("Content-Length", "0")
            )
        except ValueError as exc:
            raise ValueError(
                "Invalid Content-Length header."
            ) from exc

        if content_length <= 0:
            raise ValueError("A JSON request body is required.")

        if content_length > 1024 * 1024:
            raise OverflowError("Request body is too large.")

        raw_body = self.rfile.read(content_length)

        try:
            return json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError(
                "Request body must contain valid JSON."
            ) from exc

    def require_login(self):
        user = get_current_user(self)

        if user is None:
            self.send_error_json(
                HTTPStatus.UNAUTHORIZED,
                "Authentication required.",
            )
            return None

        return user

    def require_roles(self, *allowed_roles):
        user = self.require_login()

        if user is None:
            return None

        if user["role"] not in allowed_roles:
            self.send_error_json(
                HTTPStatus.FORBIDDEN,
                "You do not have permission to perform this action.",
            )
            return None

        return user

    def set_session_cookie(self, token):
        secure = os.environ.get("COOKIE_SECURE", "0") == "1"

        cookie = (
            f"{SESSION_COOKIE_NAME}={token}; "
            "Path=/; HttpOnly; SameSite=Lax; "
            f"Max-Age={SESSION_LIFETIME_SECONDS}"
        )

        if secure:
            cookie += "; Secure"

        return {"Set-Cookie": cookie}

    def clear_session_cookie(self):
        return {
            "Set-Cookie": (
                f"{SESSION_COOKIE_NAME}=; Path=/; HttpOnly; "
                "SameSite=Lax; Max-Age=0"
            )
        }

    # --------------------------------------------------------
    # GET
    # --------------------------------------------------------

    def do_GET(self):
        path = urlparse(self.path).path

        if path == "/api/health":
            self.send_json(HTTPStatus.OK, {"status": "ok"})
            return

        if path == "/api/state":
            with DATA_LOCK:
                state = build_state(self)

            self.send_json(HTTPStatus.OK, state)
            return

        if path == "/":
            self.serve_static_file("index.html")
            return

        if path in {
            "/app.js",
            "/style.css",
            "/favicon.svg",
            "/favicon.ico",
        }:
            self.serve_static_file(path.lstrip("/"))
            return

        self.send_error_json(
            HTTPStatus.NOT_FOUND, "Resource not found."
        )

    def serve_static_file(self, filename):
        allowed_files = {
            "index.html": "text/html; charset=utf-8",
            "app.js": "application/javascript; charset=utf-8",
            "style.css": "text/css; charset=utf-8",
            "favicon.svg": "image/svg+xml",
            "favicon.ico": "image/x-icon",
        }

        if filename not in allowed_files:
            self.send_error_json(
                HTTPStatus.NOT_FOUND, "File not found."
            )
            return

        file_path = BASE_DIR / filename

        if not file_path.is_file():
            self.send_error_json(
                HTTPStatus.NOT_FOUND,
                f"{filename} has not been created yet.",
            )
            return

        content = file_path.read_bytes()

        self.send_response(HTTPStatus.OK)
        self.send_header(
            "Content-Type", allowed_files[filename]
        )
        self.send_header("Content-Length", str(len(content)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(content)

    # --------------------------------------------------------
    # POST
    # --------------------------------------------------------

    def do_POST(self):
        path = urlparse(self.path).path

        try:
            body = self.read_json()
        except OverflowError as exc:
            self.send_error_json(
                HTTPStatus.REQUEST_ENTITY_TOO_LARGE, str(exc)
            )
            return
        except ValueError as exc:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
            return

        if not isinstance(body, dict):
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "Request body must be a JSON object.",
            )
            return

        routes = {
            "/api/bootstrap-admin": self.handle_bootstrap_admin,
            "/api/register": self.handle_register,
            "/api/login": self.handle_login,
            "/api/recover-password": self.handle_recover_password,
            "/api/change-password": self.handle_change_password,
            "/api/change-backup-password": self.handle_change_backup_password,
            "/api/admin/users": self.handle_create_user,
            "/api/admin/users/delete": self.handle_delete_user_request,
            "/api/matches": self.handle_add_match,
            "/api/admin/history/delete": self.handle_delete_history,
            "/api/admin/history/delete-match": self.handle_delete_match,
            "/api/admin/history/delete-all": self.handle_delete_all_history,
            "/api/admin/history/restore": self.handle_restore_history,
            "/api/admin/logs/clear": self.handle_clear_logs,
            "/api/admin/players": self.handle_add_player,
            "/api/admin/players/delete": self.handle_delete_player,
            "/api/admin/players/delete-bulk": self.handle_delete_players,
        }

        if path == "/api/logout":
            self.handle_logout()
            return

        handler = routes.get(path)

        if handler is None:
            self.send_error_json(
                HTTPStatus.NOT_FOUND, "API endpoint not found."
            )
            return

        handler(body)

    # --------------------------------------------------------
    # PATCH
    # --------------------------------------------------------

    def do_PATCH(self):
        path = urlparse(self.path).path

        try:
            body = self.read_json()
        except OverflowError as exc:
            self.send_error_json(
                HTTPStatus.REQUEST_ENTITY_TOO_LARGE, str(exc)
            )
            return
        except ValueError as exc:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
            return

        if not isinstance(body, dict):
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "Request body must be a JSON object.",
            )
            return

        if path.startswith("/api/admin/users/"):
            username = unquote(
                path.removeprefix("/api/admin/users/")
            )

            if username.endswith("/reset-password"):
                username = username.removesuffix("/reset-password")
                self.handle_reset_user_password(username, body)
            else:
                self.handle_update_user(username, body)

            return

        if path.startswith("/api/admin/players/"):
            name = unquote(
                path.removeprefix("/api/admin/players/")
            )
            self.handle_edit_player(name, body)
            return

        self.send_error_json(
            HTTPStatus.NOT_FOUND, "API endpoint not found."
        )

    def do_DELETE(self):
        path = urlparse(self.path).path
        prefix = "/api/admin/users/"

        if path.startswith(prefix):
            username = unquote(path.removeprefix(prefix))
            self.handle_delete_user(username)
            return

        self.send_error_json(
            HTTPStatus.NOT_FOUND, "API endpoint not found."
        )

    # --------------------------------------------------------
    # Authentication endpoints
    # --------------------------------------------------------

    def handle_bootstrap_admin(self, body):
        username = body.get("username")
        password = body.get("password")

        if not isinstance(username, str) or not username.strip():
            self.send_error_json(
                HTTPStatus.BAD_REQUEST, "Username is required."
            )
            return

        username = username.strip()

        if len(username) < 3 or len(username) > 64:
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "Username must contain between 3 and 64 characters.",
            )
            return

        try:
            validate_new_password(password)
        except ValueError as exc:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
            return

        backup_password = body.get("backup_password")
        backup_confirm = body.get("backup_confirm")
        if backup_password:
            try:
                validate_new_password(backup_password)
            except ValueError as exc:
                self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
                return
            if backup_password != backup_confirm:
                self.send_error_json(
                    HTTPStatus.BAD_REQUEST,
                    "Backup password and confirmation do not match.",
                )
                return
            if backup_password == password:
                self.send_error_json(
                    HTTPStatus.BAD_REQUEST,
                    "Backup password must differ from the main password.",
                )
                return
        elif backup_confirm:
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "A backup password is required for its confirmation.",
            )
            return

        with DATA_LOCK:
            if not bootstrap_required():
                self.send_error_json(
                    HTTPStatus.FORBIDDEN,
                    "Initial Admin setup has already been completed.",
                )
                return

            if find_user(username):
                self.send_error_json(
                    HTTPStatus.CONFLICT, "Username already exists."
                )
                return

            user = {
                "username": username,
                "password_hash": hash_password(password),
                "backup_password_hash": (
                    hash_password(backup_password)
                    if backup_password else None
                ),
                "role": "Admin",
                "active": True,
                "must_change_password": False,
                "failed_login_attempts": 0,
                "locked": False,
                "approved": True,
            }

            data["users"].append(user)
            save_data()

        token = create_session(username)

        self.send_json(
            HTTPStatus.CREATED,
            {
                "message": "Admin account created successfully.",
                "user": public_user(user),
            },
            self.set_session_cookie(token),
        )

    def handle_register(self, body):
        username = body.get("username")
        password = body.get("password")
        confirm_password = body.get("confirm_password")
        backup_password = body.get("backup_password")
        backup_confirm = body.get("backup_confirm")

        if not isinstance(username, str) or not username.strip():
            self.send_error_json(
                HTTPStatus.BAD_REQUEST, "Username is required."
            )
            return

        username = username.strip()
        if len(username) < 3 or len(username) > 64:
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "Username must contain between 3 and 64 characters.",
            )
            return

        try:
            validate_new_password(password)
        except ValueError as exc:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
            return

        if password != confirm_password:
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "Password and confirmation do not match.",
            )
            return

        if backup_password:
            try:
                validate_new_password(backup_password)
            except ValueError as exc:
                self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
                return
            if backup_password != backup_confirm:
                self.send_error_json(
                    HTTPStatus.BAD_REQUEST,
                    "Backup password and confirmation do not match.",
                )
                return
            if backup_password == password:
                self.send_error_json(
                    HTTPStatus.BAD_REQUEST,
                    "Backup password must differ from the main password.",
                )
                return
        elif backup_confirm:
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "A backup password is required for its confirmation.",
            )
            return

        with DATA_LOCK:
            if find_user(username):
                self.send_error_json(
                    HTTPStatus.CONFLICT, "Username already exists."
                )
                return

            pending_count = sum(
                not user.get("approved", True)
                for user in data["users"]
            )
            if pending_count >= MAX_PENDING_USER_APPROVALS:
                self.send_error_json(
                    HTTPStatus.TOO_MANY_REQUESTS,
                    "The account approval queue is full. Please try again later.",
                )
                return

            user = {
                "username": username,
                "password_hash": hash_password(password),
                "backup_password_hash": (
                    hash_password(backup_password)
                    if backup_password else None
                ),
                "role": "Viewer",
                "active": True,
                "must_change_password": False,
                "failed_login_attempts": 0,
                "locked": False,
                "approved": False,
                "active": False,
            }
            data["users"].append(user)
            save_data()

        self.send_json(
            HTTPStatus.CREATED,
            {
                "message": (
                    "Registration received. Your account is waiting for "
                    "Admin approval. You can sign in after it is approved."
                ),
                "user": public_user(user),
            },
        )

    def handle_login(self, body):
        username = body.get("username")
        password = body.get("password")

        if not isinstance(username, str) or not isinstance(password, str):
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "Username and password are required.",
            )
            return

        with DATA_LOCK:
            user = find_user(username.strip())

            if user is None:
                self.send_error_json(
                    HTTPStatus.UNAUTHORIZED,
                    "Invalid username or password.",
                )
                return

            if user.get("locked", False):
                self.send_error_json(
                    HTTPStatus.LOCKED,
                    "Account locked after 5 failed attempts. Contact an Admin to unlock it.",
                )
                return

            if not verify_password(password, user.get("password_hash", {})):
                record_failed_login(user)
                save_data()
                if user["locked"]:
                    revoke_user_sessions(user["username"])
                    message = (
                        "Account locked after 5 failed attempts. "
                        "Contact an Admin to unlock it."
                    )
                    status = HTTPStatus.LOCKED
                else:
                    message = "Invalid username or password."
                    status = HTTPStatus.UNAUTHORIZED
                self.send_error_json(status, message)
                return

            user["failed_login_attempts"] = 0
            if not user.get("approved", True):
                save_data()
                self.send_error_json(
                    HTTPStatus.FORBIDDEN,
                    "Your account is inactive and waiting for Admin approval.",
                )
                return

            if not user.get("active", True):
                save_data()
                self.send_error_json(
                    HTTPStatus.UNAUTHORIZED,
                    "Your account is inactive. Contact an Admin.",
                )
                return

            save_data()
            token = create_session(user["username"])

        self.send_json(
            HTTPStatus.OK,
            {
                "message": "Login successful.",
                "user": public_user(user),
            },
            self.set_session_cookie(token),
        )

    def handle_recover_password(self, body):
        username = body.get("username")
        backup_password = body.get("backup_password")
        new_password = body.get("new_password")
        confirm_password = body.get("confirm_password")

        if not all(
            isinstance(value, str)
            for value in (username, backup_password, new_password, confirm_password)
        ):
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "All recovery fields are required.",
            )
            return

        try:
            validate_new_password(new_password)
        except ValueError as exc:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
            return

        if new_password != confirm_password:
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "New password and confirmation do not match.",
            )
            return
        if new_password == backup_password:
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "New main password must differ from the backup password.",
            )
            return

        with DATA_LOCK:
            user = find_user(username.strip())
            if (
                user is None
                or not user.get("active", True)
                or user.get("locked", False)
                or not user.get("backup_password_hash")
            ):
                self.send_error_json(
                    HTTPStatus.UNAUTHORIZED,
                    "Unable to verify account. Check your details or contact an Admin.",
                )
                return

            if not verify_password(
                backup_password, user["backup_password_hash"]
            ):
                record_failed_login(user)
                save_data()
                if user["locked"]:
                    revoke_user_sessions(user["username"])
                    self.send_error_json(
                        HTTPStatus.LOCKED,
                        "Account locked after 5 failed attempts. Contact an Admin to unlock it.",
                    )
                else:
                    self.send_error_json(
                        HTTPStatus.UNAUTHORIZED,
                        "Unable to verify account. Check your details or contact an Admin.",
                    )
                return

            if verify_password(new_password, user.get("password_hash", {})):
                self.send_error_json(
                    HTTPStatus.BAD_REQUEST,
                    "New password must differ from the current password.",
                )
                return

            user["password_hash"] = hash_password(new_password)
            user["failed_login_attempts"] = 0
            user["must_change_password"] = False
            save_data()
            revoke_user_sessions(user["username"])

        self.send_json(
            HTTPStatus.OK,
            {"message": "Main password reset successfully. You can now sign in."},
        )

    def handle_logout(self):
        token = get_session_token(self)

        if token:
            with SESSIONS_LOCK:
                SESSIONS.pop(token, None)

        self.send_json(
            HTTPStatus.OK,
            {"message": "Logged out successfully."},
            self.clear_session_cookie(),
        )

    def handle_change_password(self, body):
        user = self.require_login()

        if user is None:
            return

        current_password = body.get("current_password")
        new_password = body.get("new_password")
        confirm_password = body.get("confirm_password")

        if not all(
            isinstance(value, str)
            for value in (
                current_password,
                new_password,
                confirm_password,
            )
        ):
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "All password fields are required.",
            )
            return

        if new_password != confirm_password:
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "New password and confirmation do not match.",
            )
            return

        try:
            validate_new_password(new_password)
        except ValueError as exc:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
            return

        with DATA_LOCK:
            user = find_user(user["username"])

            if user is None:
                self.send_error_json(
                    HTTPStatus.UNAUTHORIZED,
                    "Authentication required.",
                )
                return

            if not verify_password(
                current_password, user.get("password_hash", {})
            ):
                record_failed_login(user)
                save_data()
                if user["locked"]:
                    revoke_user_sessions(user["username"])
                    self.send_error_json(
                        HTTPStatus.LOCKED,
                        "Account locked after 5 failed attempts. Contact an Admin to unlock it.",
                    )
                    return
                self.send_error_json(
                    HTTPStatus.UNAUTHORIZED,
                    "Current password is incorrect.",
                )
                return

            if current_password == new_password:
                self.send_error_json(
                    HTTPStatus.BAD_REQUEST,
                    "New password must differ from the current password.",
                )
                return

            user["password_hash"] = hash_password(new_password)
            user["must_change_password"] = False
            user["failed_login_attempts"] = 0
            save_data()

        self.send_json(
            HTTPStatus.OK,
            {"message": "Password changed successfully."},
        )

    def handle_change_backup_password(self, body):
        user = self.require_login()

        if user is None:
            return

        current_password = body.get("current_password")
        new_backup_password = body.get("new_backup_password")
        confirm_backup_password = body.get("confirm_backup_password")

        if not all(
            isinstance(value, str)
            for value in (
                current_password,
                new_backup_password,
                confirm_backup_password,
            )
        ):
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "All password fields are required.",
            )
            return

        if new_backup_password != confirm_backup_password:
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "Backup password and confirmation do not match.",
            )
            return

        try:
            validate_new_password(new_backup_password)
        except ValueError as exc:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
            return

        with DATA_LOCK:
            user = find_user(user["username"])
            if user is None or not user.get("active", True):
                self.send_error_json(
                    HTTPStatus.UNAUTHORIZED,
                    "Authentication required.",
                )
                return

            if not verify_password(
                current_password, user.get("password_hash", {})
            ):
                record_failed_login(user)
                save_data()
                if user["locked"]:
                    revoke_user_sessions(user["username"])
                    self.send_error_json(
                        HTTPStatus.LOCKED,
                        "Account locked after 5 failed attempts. Contact an Admin to unlock it.",
                    )
                    return
                self.send_error_json(
                    HTTPStatus.UNAUTHORIZED,
                    "Current main password is incorrect.",
                )
                return

            if new_backup_password == current_password:
                self.send_error_json(
                    HTTPStatus.BAD_REQUEST,
                    "Backup password must differ from the main password.",
                )
                return

            user["backup_password_hash"] = hash_password(
                new_backup_password
            )
            user["failed_login_attempts"] = 0
            save_data()

        self.send_json(
            HTTPStatus.OK,
            {"message": "Backup password saved successfully."},
        )

    # --------------------------------------------------------
    # User administration
    # --------------------------------------------------------

    def handle_create_user(self, body):
        admin = self.require_roles("Admin")

        if admin is None:
            return

        username = body.get("username")
        password = body.get("password")
        role = body.get("role")
        backup_password = body.get("backup_password")
        backup_confirm = body.get("backup_confirm")

        if not isinstance(username, str) or not username.strip():
            self.send_error_json(
                HTTPStatus.BAD_REQUEST, "Username is required."
            )
            return

        username = username.strip()

        if len(username) < 3 or len(username) > 64:
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "Username must contain between 3 and 64 characters.",
            )
            return

        if role not in ROLES:
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "Role must be Admin, Operator, or Viewer.",
            )
            return

        try:
            validate_new_password(password)
        except ValueError as exc:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
            return

        if backup_password:
            try:
                validate_new_password(backup_password)
            except ValueError as exc:
                self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
                return
            if backup_password != backup_confirm:
                self.send_error_json(
                    HTTPStatus.BAD_REQUEST,
                    "Backup password and confirmation do not match.",
                )
                return
            if backup_password == password:
                self.send_error_json(
                    HTTPStatus.BAD_REQUEST,
                    "Backup password must differ from the main password.",
                )
                return
        elif backup_confirm:
            self.send_error_json(
                HTTPStatus.BAD_REQUEST,
                "A backup password is required for its confirmation.",
            )
            return

        with DATA_LOCK:
            if find_user(username):
                self.send_error_json(
                    HTTPStatus.CONFLICT, "Username already exists."
                )
                return

            user = {
                "username": username,
                "password_hash": hash_password(password),
                "backup_password_hash": (
                    hash_password(backup_password)
                    if backup_password else None
                ),
                "role": role,
                "active": True,
                "must_change_password": True,
                "failed_login_attempts": 0,
                "locked": False,
                "approved": True,
            }

            data["users"].append(user)
            save_data()

        self.send_json(
            HTTPStatus.CREATED,
            {
                "message": "User created successfully.",
                "user": public_user(user),
            },
        )

    def handle_update_user(self, username, body):
        admin = self.require_roles("Admin")

        if admin is None:
            return

        with DATA_LOCK:
            user = find_user(username)

            if user is None:
                self.send_error_json(
                    HTTPStatus.NOT_FOUND, "User not found."
                )
                return

            new_role = body.get("role")
            new_active = body.get("active")
            unlock = body.get("unlock", False)

            if new_role is not None and new_role not in ROLES:
                self.send_error_json(
                    HTTPStatus.BAD_REQUEST,
                    "Role must be Admin, Operator, or Viewer.",
                )
                return

            if new_active is not None and not isinstance(new_active, bool):
                self.send_error_json(
                    HTTPStatus.BAD_REQUEST,
                    "Active must be a boolean.",
                )
                return

            if not isinstance(unlock, bool):
                self.send_error_json(
                    HTTPStatus.BAD_REQUEST,
                    "Unlock must be a boolean.",
                )
                return

            approved = body.get("approved")
            if approved is not None and not isinstance(approved, bool):
                self.send_error_json(
                    HTTPStatus.BAD_REQUEST,
                    "Approved must be a boolean.",
                )
                return
            if (
                approved is False
                or (
                    approved is None
                    and not user.get("approved", True)
                )
            ) and (
                new_role or user.get("role")
            ) == "Admin":
                self.send_error_json(
                    HTTPStatus.BAD_REQUEST,
                    "Admin accounts cannot be pending approval.",
                )
                return

            if (
                user["username"].casefold() == admin["username"].casefold()
                and new_role is not None
                and new_role != "Admin"
            ):
                self.send_error_json(
                    HTTPStatus.BAD_REQUEST,
                    "You cannot remove your own Admin role.",
                )
                return

            if (
                user["username"].casefold() == admin["username"].casefold()
                and new_active is False
            ):
                self.send_error_json(
                    HTTPStatus.BAD_REQUEST,
                    "You cannot deactivate your own account.",
                )
                return

            old_role = user["role"]
            old_active = user.get("active", True)
            old_approved = user.get("approved", True)

            if new_role is not None:
                user["role"] = new_role

            if new_active is not None:
                user["active"] = new_active

            if approved is not None:
                user["approved"] = approved
                if approved and not old_approved:
                    user["active"] = True

            if unlock:
                user["locked"] = False
                user["failed_login_attempts"] = 0

            active_admins = [
                item for item in data["users"]
                if item.get("role") == "Admin"
                and item.get("active", True)
                and item.get("approved", True)
            ]

            if not active_admins:
                user["role"] = old_role
                user["active"] = old_active
                user["approved"] = old_approved

                self.send_error_json(
                    HTTPStatus.BAD_REQUEST,
                    "At least one active, approved Admin must remain.",
                )
                return

            save_data()

            if not user.get("active", True):
                revoke_user_sessions(user["username"])

        self.send_json(
            HTTPStatus.OK,
            {
                "message": "User updated successfully.",
                "user": public_user(user),
            },
        )

    def handle_delete_user(self, username):
        admin = self.require_roles("Admin")

        if admin is None:
            return

        with DATA_LOCK:
            user = find_user(username)
            if user is None:
                self.send_error_json(
                    HTTPStatus.NOT_FOUND, "User not found."
                )
                return

            if (
                user["username"].casefold()
                == admin["username"].casefold()
            ):
                self.send_error_json(
                    HTTPStatus.BAD_REQUEST,
                    "You cannot delete your own account.",
                )
                return

            if (
                user.get("role") == "Admin"
                and user.get("active", True)
                and user.get("approved", True)
                and sum(
                    item.get("role") == "Admin"
                    and item.get("active", True)
                    and item.get("approved", True)
                    for item in data["users"]
                ) <= 1
            ):
                self.send_error_json(
                    HTTPStatus.BAD_REQUEST,
                    "At least one active Admin must remain.",
                )
                return

            data["users"].remove(user)
            save_data()
            revoke_user_sessions(user["username"])

        self.send_json(
            HTTPStatus.OK,
            {"message": "User deleted successfully."},
        )

    def handle_delete_user_request(self, body):
        username = body.get("username")
        if not isinstance(username, str) or not username.strip():
            self.send_error_json(
                HTTPStatus.BAD_REQUEST, "Username is required."
            )
            return

        self.handle_delete_user(username.strip())

    def handle_reset_user_password(self, username, body):
        admin = self.require_roles("Admin")

        if admin is None:
            return

        new_password = body.get("new_password")

        try:
            validate_new_password(new_password)
        except ValueError as exc:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
            return

        with DATA_LOCK:
            user = find_user(username)

            if user is None:
                self.send_error_json(
                    HTTPStatus.NOT_FOUND, "User not found."
                )
                return

            user["password_hash"] = hash_password(new_password)
            user["must_change_password"] = True
            save_data()
            revoke_user_sessions(user["username"])

        self.send_json(
            HTTPStatus.OK,
            {
                "message": (
                    "Password reset successfully. "
                    "The user must sign in again."
                )
            },
        )

    # --------------------------------------------------------
    # Player administration
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # Match administration
    # --------------------------------------------------------

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


# ============================================================
# Terminal Admin password reset
# ============================================================

def reset_admin_password_from_terminal(username):
    """
    Reset an existing active Admin password without web login.
    Password input is hidden and only a scrypt hash is saved.
    """
    if not DATA_FILE.exists():
        print("Error: data.json does not exist.")
        return 1

    with DATA_LOCK:
        user = find_user(username)

        if user is None:
            print(f"Error: user '{username}' was not found.")
            return 1

        if user.get("role") != "Admin":
            print("Error: the specified account is not an Admin.")
            return 1

        if not user.get("active", True):
            print("Error: this Admin account is inactive.")
            return 1

        print(f"Resetting password for Admin: {user['username']}")

        try:
            new_password = getpass.getpass(
                "New password (minimum 10 characters): "
            )
            confirm_password = getpass.getpass(
                "Confirm new password: "
            )
        except (EOFError, KeyboardInterrupt):
            print("\nPassword reset cancelled.")
            return 1

        try:
            validate_new_password(new_password)
        except ValueError as exc:
            print(f"Error: {exc}")
            return 1

        if new_password != confirm_password:
            print("Error: passwords do not match.")
            return 1

        user["password_hash"] = hash_password(new_password)
        user["must_change_password"] = True
        user["locked"] = False
        user["failed_login_attempts"] = 0

        save_data()
        revoke_user_sessions(user["username"])

    print("Admin password reset successfully.")
    print("The Admin must change the password after signing in.")
    return 0


# ============================================================
# Server startup
# ============================================================

def run_server():
    server = ThreadingHTTPServer((HOST, PORT), PowerRankingHandler)

    print("Power Ranking server is running.")
    print(f"Open http://{HOST}:{PORT} in your browser.")
    print("Press Ctrl+C to stop the server.")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down the server.")
    finally:
        server.server_close()


def main():
    parser = argparse.ArgumentParser(
        description="Power Ranking server"
    )
    parser.add_argument(
        "--reset-admin-password",
        metavar="USERNAME",
        help="Reset an existing Admin password without web login.",
    )

    args = parser.parse_args()

    if args.reset_admin_password:
        raise SystemExit(
            reset_admin_password_from_terminal(
                args.reset_admin_password
            )
        )

    run_server()


if __name__ == "__main__":
    main()