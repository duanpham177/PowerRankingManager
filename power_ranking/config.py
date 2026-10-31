import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_FILE = DATA_DIR / "data.json"
DRINK_DATA_FILE = DATA_DIR / "drink_data.json"
LEGACY_DATA_FILE = BASE_DIR / "data.json"
LEGACY_DRINK_DATA_FILE = BASE_DIR / "drink_data.json"
STATIC_DIR = BASE_DIR / "static"

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
TIER_POINTS = {1: 5, 2: 4, 3: 3, 4: 2, 5: 1}
MATCH_STAR_CHANGES = {
    2: {1: 1, 2: -1},
    3: {1: 1, 2: 0, 3: -1},
    4: {1: 2, 2: 1, 3: -1, 4: -2},
}
MAX_MATCH_LOGS = 10
