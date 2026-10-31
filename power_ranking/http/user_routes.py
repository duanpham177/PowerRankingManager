from .common import *

class UserRoutes:
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
