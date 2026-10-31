from .common import *

class AuthRoutes:
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
