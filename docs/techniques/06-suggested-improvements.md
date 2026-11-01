# 06. Kỹ thuật đề xuất thêm (Suggested Techniques)

Những kỹ thuật chưa dùng (hoặc dùng chưa đầy đủ), xếp từ dễ đến khó.

## Dễ (Beginner)
1. **Dọn file thừa** – `temp.txt` nên xóa hoặc thêm vào `.gitignore`.
2. **`.gitattributes` / EditorConfig** – thống nhất xuống dòng LF/CRLF để hết cảnh báo git.
3. **Debounce tìm kiếm** – trì hoãn lọc khi gõ để đỡ render thừa.
4. **ARIA & quản lý focus** – `aria-live` cho thông báo, giữ focus trong dialog, đóng bằng `Esc`.
5. **Khung chờ (Loading skeleton)** thay vì để trống khi tải.
6. **Toast (thông báo nhỏ)** thay cho thông báo dài trong form.

## Trung bình (Intermediate)
7. **ES Modules** (`import/export`) thay script toàn cục → hết phụ thuộc thứ tự tải và biến global.
8. **Linter & formatter** – ESLint + Prettier (JS), Ruff/Black (Python).
9. **Unit test Python** – `pytest` cho `ranking/service.py`, `auth/service.py`; chạy tự động bằng **CI** (GitHub Actions).
10. **Type hints (Python) / JSDoc hoặc TypeScript** – bắt lỗi kiểu sớm.
11. **Schema validation** – kiểm cấu trúc JSON nhập vào (jsonschema/pydantic).
12. **Sao lưu có phiên bản (Backup & versioning)** – bản sao kèm timestamp trước mỗi lần ghi lớn.
13. **Logging có cấp độ** – module `logging` (INFO/WARNING/ERROR) thay `print`.
14. **Biến môi trường (`.env`)** – cổng, đường dẫn, secret không hardcode.
15. **Tổ chức CSS** – đặt tên BEM, chia file theo component, giảm `!important`, dùng `@layer`.
16. **Dark mode theo hệ thống** – `prefers-color-scheme`.
17. **Phân trang (Pagination) / virtual list** cho lịch sử dài.
18. **Cache busting** – `app.js?v=hash` để khỏi phải Ctrl+F5.

## Nâng cao (Advanced)
19. **SQLite** thay JSON – truy vấn SQL, giao dịch (**transaction**), ràng buộc (**constraint**), chỉ mục (**index**).
20. **Chống CSRF** – token khi dùng cookie session.
21. **Cookie an toàn** – `HttpOnly`, `Secure`, `SameSite=Strict`.
22. **Giới hạn tần suất theo IP (Rate limiting)** – bổ sung cho khóa tài khoản.
23. **HTTPS / reverse proxy** (nginx, Caddy) khi đưa lên internet.
24. **Framework** – FastAPI/Flask (backend); Vue/React/Svelte (frontend) khi dự án lớn.
25. **WebSocket / Server-Sent Events** – cập nhật realtime.
26. **Optimistic UI (cập nhật lạc quan)** – cập nhật giao diện trước, hoàn tác nếu server lỗi.
27. **Docker** – đóng gói chạy giống nhau mọi máy.
28. **E2E test** – Playwright mô phỏng người dùng bấm thật.
29. **Hiệu năng (Performance)** – đo bằng Lighthouse; chỉ animate `transform/opacity` (GPU) thay vì `width/height`.
30. **PWA (Progressive Web App)** – cài như app, chạy offline với Service Worker.
31. **Đa ngôn ngữ (i18n)** – tách chuỗi UI (Việt/Anh) ra file riêng.
32. **Kiểu tiền tệ (Money type)** – số nguyên hoặc `Decimal`, test các ca làm tròn.

## Lộ trình học gợi ý (Learning path)
HTML/CSS cơ bản → JavaScript DOM & fetch → Python `http.server`/JSON → Git → Test → Bảo mật cơ bản → Database → Framework.
