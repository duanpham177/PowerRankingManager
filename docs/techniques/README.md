# Kỹ thuật của dự án Power Ranking Manager
# Techniques used in the Power Ranking Manager project

Bộ tài liệu này giải thích **các kỹ thuật chính** trong dự án, viết cho người mới học lập trình web.
Thuật ngữ chuyên ngành được ghi song ngữ: *Tiếng Việt (English term)*.

## Mục lục (Table of contents)

| File | Nội dung (Content) |
|------|--------------------|
| [01-project-architecture.md](01-project-architecture.md) | Kiến trúc & thiết kế dự án (Architecture & project design) |
| [02-web-effects.md](02-web-effects.md) | Hiệu ứng web: CSS, animation, tương tác (Web effects) |
| [03-data-design.md](03-data-design.md) | Thiết kế dữ liệu (Data design) |
| [04-coding-techniques.md](04-coding-techniques.md) | Kỹ thuật viết code (Coding techniques) |
| [05-security.md](05-security.md) | Bảo mật (Security) |
| [06-suggested-improvements.md](06-suggested-improvements.md) | Kỹ thuật đề xuất thêm (Suggested techniques) |
| [07-glossary.md](07-glossary.md) | Bảng thuật ngữ song ngữ (Bilingual glossary) |

## Dự án làm gì? (What does it do?)

Web app quản lý **bảng xếp hạng cầu thủ bóng đá** (power ranking): ghi kết quả trận, tính sao/chuỗi thắng,
chia đội ngẫu nhiên, quản lý người dùng, và **tính tiền đồ uống** (drink-order bill settlement).

- **Backend (máy chủ)**: Python, thư viện chuẩn `http.server`, thư mục `power_ranking/`.
- **Frontend (giao diện)**: JavaScript thuần (vanilla JS) + CSS, thư mục `static/`.
- **Lưu trữ (storage)**: file JSON trong `data/`.
- Không dùng framework → hợp để học **nền tảng** thật sự.

## Cách đọc (How to read)

Đọc theo thứ tự 01 → 06. Mỗi mục nêu: **là gì**, **vì sao dùng**, **ví dụ trong dự án**.
