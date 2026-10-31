import copy
import threading

from ..config import MATCH_STAR_CHANGES, MAX_MATCH_LOGS, TIER_POINTS
from ..auth.service import (
    bootstrap_required,
    get_current_user,
    public_user,
)
from ..storage.repository import (
    DATA_LOCK, data, drink_shop, is_plain_int, prune_deleted_players,
    save_data,
)

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

        if player["win_streak"] == 3:
            adjustment += 1
            reasons.append("Won 3 consecutive matches: +1 star")

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
            if "Won 3 consecutive matches: +1 star" in streak_reasons[name]:
                category = "win_streak_reward"
                label = "Win streak reward"
            else:
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
        result["drink_shop"] = copy.deepcopy(drink_shop)

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
