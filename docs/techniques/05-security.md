# 05. Bảo mật (Security)

| Kỹ thuật (Technique) | Giải thích | Vị trí |
|---|---|---|
| **Băm mật khẩu (Password hashing)** bằng `scrypt` | Hàm băm chậm, tốn bộ nhớ → khó brute-force. Không lưu mật khẩu gốc | `auth/service.py` |
| **Muối (Salt)** ngẫu nhiên 16 byte | Hai người cùng mật khẩu vẫn có hash khác; chống rainbow table | `secrets.token_bytes(16)` |
| **So sánh thời gian cố định (Constant-time compare)** | `hmac.compare_digest` chống timing attack | `auth/service.py` |
| **Token phiên ngẫu nhiên (Session token)** | `secrets.token_urlsafe(32)` – không đoán được | `auth/service.py` |
| **Khóa tài khoản (Account lockout)** | Sai quá `MAX_LOGIN_FAILURES` thì khóa | `failed_login_attempts`, `locked` |
| **Phân quyền (Authorization)** | Kiểm tra vai trò (`Admin`...) trước thao tác nhạy cảm | `http/*_routes.py` |
| **Chống XSS** | `escapeHtml` mọi dữ liệu người dùng trước khi vào HTML | frontend |
| **Allowlist file tĩnh** | Chặn path traversal (`../`) | `http/base.py` |
| **Giới hạn kích thước request** | Từ chối body > 1 MB | `read_json` |
| **Kiểm Content-Type** | Chỉ nhận `application/json` | `read_json` |
| **Header bảo mật** | `nosniff`, `X-Frame-Options: DENY` (chống clickjacking), `Referrer-Policy` | `send_json` |
| **No-store cache** | Không cache dữ liệu API | `Cache-Control: no-store` |
| **Ghi nguyên tử + lock** | Bảo vệ toàn vẹn dữ liệu (integrity) | `repository.py` |
| **Reset mật khẩu admin từ terminal** | Khôi phục không cần đăng nhập web, chỉ người có quyền truy cập máy chủ | `reset_admin_password_from_terminal` |

## Khái niệm cần biết
- **Authentication (xác thực)**: bạn là ai? **Authorization (phân quyền)**: bạn được làm gì?
- **Never trust the client (không tin client)**: luôn kiểm tra lại ở server.
- **Defense in depth (phòng thủ nhiều lớp)**.
- **Least privilege (đặc quyền tối thiểu)**.
