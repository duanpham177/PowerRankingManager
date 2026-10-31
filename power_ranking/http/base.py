from .common import *

class BaseHandler:
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
            "/js/features/ranking.js",
            "/js/features/random-teams.js",
            "/js/features/matches.js",
            "/js/features/drink-orders.js",
            "/js/features/history.js",
            "/js/features/players.js",
            "/js/features/users.js",
            "/js/events.js",
            "/js/form-events.js",
            "/js/click-events.js",
            "/js/change-events.js",
            "/js/bootstrap.js",
            "/css/style.css",
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
            "app.js": "text/javascript; charset=utf-8",
            "js/features/ranking.js": "text/javascript; charset=utf-8",
            "js/features/random-teams.js": "text/javascript; charset=utf-8",
            "js/features/matches.js": "text/javascript; charset=utf-8",
            "js/features/drink-orders.js": "text/javascript; charset=utf-8",
            "js/features/history.js": "text/javascript; charset=utf-8",
            "js/features/players.js": "text/javascript; charset=utf-8",
            "js/features/users.js": "text/javascript; charset=utf-8",
            "js/events.js": "text/javascript; charset=utf-8",
            "js/form-events.js": "text/javascript; charset=utf-8",
            "js/click-events.js": "text/javascript; charset=utf-8",
            "js/change-events.js": "text/javascript; charset=utf-8",
            "js/bootstrap.js": "text/javascript; charset=utf-8",
            "css/style.css": "text/css; charset=utf-8",
            "favicon.svg": "image/svg+xml",
            "favicon.ico": "image/x-icon",
        }

        if filename not in allowed_files:
            self.send_error_json(
                HTTPStatus.NOT_FOUND, "File not found."
            )
            return

        file_path = STATIC_DIR / filename

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
            "/api/drink-shop": self.handle_save_drink_shop,
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
