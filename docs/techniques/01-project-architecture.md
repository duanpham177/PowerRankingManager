# 01. Kiến trúc & thiết kế dự án (Architecture & Project Design)

## 1. Mô hình Client–Server (Client–Server model)
- **Client (máy khách)** = trình duyệt, chạy HTML/CSS/JS trong `static/`.
- **Server (máy chủ)** = chương trình Python (`run.py`, `app.py`, `power_ranking/server.py`).
- Hai bên nói chuyện qua **HTTP request/response** (yêu cầu/phản hồi).

## 2. Single Page Application – SPA (Ứng dụng một trang)
- `static/index.html` chỉ có một trang; JS (`static/app.js`) **vẽ lại giao diện** khi chuyển tab, không tải lại trang.
- Ưu: mượt, nhanh. Nhược: phải tự quản lý trạng thái (state) và render.

## 3. JSON API kiểu REST (REST-style JSON API)
- Frontend gọi `fetch("/api/...")`, server trả **JSON** (JavaScript Object Notation).
- Phương thức HTTP (HTTP methods): `GET` đọc, `POST` tạo/hành động, `PUT/PATCH` sửa, `DELETE` xóa.
- Mã trạng thái (status code): `200 OK`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `500 Server Error`.
- Route chia theo chức năng: `power_ranking/http/*_routes.py`.

## 4. Phân tầng (Layered architecture / Separation of concerns)

| Tầng (Layer) | Thư mục | Vai trò |
|---|---|---|
| Giao thức HTTP (HTTP layer) | `power_ranking/http/` | Nhận request, kiểm tra, trả response |
| Nghiệp vụ (Business logic / service) | `ranking/service.py`, `auth/service.py`, `drinks/service.py` | Quy tắc tính toán |
| Lưu trữ (Persistence / repository) | `storage/repository.py` | Đọc/ghi file JSON |
| Cấu hình (Configuration) | `config.py` | Hằng số, đường dẫn, giới hạn |

Nguyên tắc: *route không tự tính toán*, *service không tự đọc file* → dễ test, dễ đổi (ví dụ JSON → database).

## 5. Mô-đun hóa theo tính năng (Feature-based modularization)
- Python: mỗi thư mục là một **package** (có `__init__.py`).
- JS: tách theo tính năng trong `static/js/features/` (`ranking.js`, `players.js`, `drink-orders.js`...) và theo loại sự kiện (`click-events.js`, `form-events.js`, `change-events.js`).

## 6. Ủy quyền sự kiện (Event delegation)
- Gắn **một listener** ở `document` (`bootstrap.js`), rồi đọc `data-action` của phần tử được bấm.
- Nút vẽ lại (re-render) vẫn hoạt động; ít listener hơn.

## 7. Render theo trạng thái (State-driven rendering)
- Đối tượng `state` giữ dữ liệu; hàm render biến state thành HTML bằng **template literal**.
- Đây là ý tưởng cốt lõi của React/Vue, ở đây tự làm tay để hiểu bản chất.

## 8. Danh sách cho phép file tĩnh (Static file allowlist)
- Server chỉ phục vụ file nằm trong **whitelist** ở `power_ranking/http/base.py` (kèm Content-Type).
- File JS/CSS mới **phải thêm vào whitelist**, nếu không bị 404. Cách này chặn lộ file nhạy cảm (path traversal).

## 9. Điểm vào & cấu hình (Entry point & configuration)
- `run.py` / `app.py` khởi động `server.py` (`ThreadingHTTPServer`, cổng 5000).
- `config.py` gom hằng số – nguyên tắc **no magic numbers** (không rải số tùy tiện).

## 10. Kiểm thử (Testing)
- `tests/drink-settlement.test.js`: unit test (kiểm thử đơn vị) cho logic chia tiền. Hàm thuần (pure function) là loại dễ test nhất.

## 11. Kiểm soát phiên bản (Version control)
- Git + GitHub; commit nhỏ, thông điệp rõ; `.gitignore` bỏ file không cần.
