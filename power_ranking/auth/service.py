import getpass
import hashlib
import hmac
import secrets
import threading
from datetime import datetime

from ..config import (
    DATA_FILE, MAX_LOGIN_FAILURES, MAX_PENDING_USER_APPROVALS,
    PASSWORD_HASH_N, PASSWORD_HASH_P, PASSWORD_HASH_R,
    SESSION_COOKIE_NAME, SESSION_LIFETIME_SECONDS,
)
from ..storage.repository import DATA_LOCK, data, is_plain_int, save_data

SESSIONS = {}
SESSIONS_LOCK = threading.RLock()

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
