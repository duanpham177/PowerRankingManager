# 04. Kỹ thuật xây dựng code (Coding Techniques)

## Python (backend)

1. **Hàm thuần (Pure function)** – cùng đầu vào cho cùng đầu ra, không tác dụng phụ (side effect).
2. **Context manager `with`** – `with DATA_LOCK:` tự mở/đóng khóa kể cả khi có lỗi.
3. **Xử lý ngoại lệ (Exception handling)** – `try/except ValueError` rồi trả `400` thay vì làm server sập; `raise ... from exc` giữ nguyên nhân gốc.
4. **Kế thừa (Inheritance)** – `BaseHandler` chứa hàm dùng chung (`send_json`, `read_json`).
5. **Hằng số cấu hình** – `MAX_LOGIN_FAILURES`... đặt một nơi.
6. **Đa luồng (Threading)** – `ThreadingHTTPServer` xử lý song song nên dữ liệu chung phải có lock.
7. **Header bảo mật** – `X-Content-Type-Options`, `X-Frame-Options`, `Cache-Control: no-store`.

## JavaScript (frontend)

1. **Template literal** – `` `<td>${name}</td>` `` dựng HTML nhanh.
2. **Escape HTML (`escapeHtml`)** – bắt buộc khi chèn dữ liệu người dùng vào HTML để chống **XSS**.
3. **Array methods** – `map`, `filter`, `reduce`, `find`, `some`.
4. **Destructuring & spread** – `const {a, b} = obj`, `{...old, x:1}`.
5. **Optional chaining `?.` & nullish `??`** – tránh lỗi khi dữ liệu thiếu.
6. **async/await + Promise + fetch** – gọi API tuần tự dễ đọc; hàm `request()` dùng chung xử lý lỗi và JSON.
7. **Event delegation** – một listener, phân loại theo `data-action`.
8. **Dataset attributes** – `data-order-id`, `data-player-row` gắn dữ liệu vào phần tử (`el.dataset`).
9. **Closure & biến trạng thái** – `newSettlementChip` nhớ chip vừa thêm để animate đúng một lần.
10. **Timers** – `setTimeout` chờ animation; cẩn thận để không chạy chồng.
11. **DOM API** – `querySelector`, `classList`, `closest`, `scrollTo`.
12. **requestAnimationFrame** – animation theo nhịp màn hình, không chặn giao diện.

## Nguyên tắc thiết kế (Design principles)

- **DRY** (Don't Repeat Yourself) – gom code lặp (ví dụ mẫu animation nút thành công).
- **KISS** (Keep It Simple) – chưa cần framework thì không dùng.
- **Single Responsibility (một trách nhiệm)** – mỗi hàm/file làm một việc.
- **Separation of Concerns (tách mối quan tâm)** – UI / logic / dữ liệu riêng.
- **Fail fast** – kiểm đầu vào sớm, báo lỗi rõ.
- **Đặt tên (Naming)** – tên nói lên ý (`animateRemoval`, `updateMatchSummary`).
- **Commit nhỏ, đúng mục đích**.

## Debug & quy trình (Workflow)

- DevTools: **Elements** (xem CSS áp dụng), **Network** (request/response), **Console**.
- **Hard reload (Ctrl+F5)** để bỏ cache khi sửa file tĩnh.
- Khởi động lại server khi sửa Python.
- Đọc **status code** và JSON lỗi để biết lỗi ở client hay server.
