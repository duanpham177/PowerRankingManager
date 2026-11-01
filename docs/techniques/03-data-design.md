# 03. Kỹ thuật thiết kế dữ liệu (Data Design)

## 1. JSON làm cơ sở dữ liệu (JSON file as a database)
`data/data.json` (ranking, người dùng, lịch sử) và `data/drink_data.json` (quán nước).
- Ưu: không cần cài DB, đọc được bằng mắt, dễ backup.
- Nhược: truy vấn yếu, khó mở rộng. Hợp dự án nhỏ.

## 2. Tách nhiều file dữ liệu (Data separation)
Ranking và drink tách riêng → lỗi ở bên này không hỏng bên kia, file nhỏ hơn.

## 3. Dict theo khóa (Dictionary keyed by ID)
`players` là dict: `tên → {tier, stars, streaks...}`. Tra cứu nhanh theo tên, không trùng khóa. List thì giữ thứ tự tốt hơn.

## 4. ID tự tăng (Auto-increment ID)
`next_match_id` cấp mã trận. Khi xóa toàn bộ lịch sử thì **reset**. Luôn lưu bộ đếm riêng, không dùng `len(list)+1` (sẽ trùng khi xóa giữa chừng).

## 5. Lịch sử chỉ thêm (Append-only records)
`match_records` ghi từng trận. Có lịch sử → có thể **tính lại (recompute)** hoặc hoàn tác.

## 6. Ghi nguyên tử (Atomic write)
`repository.py`: ghi vào **file tạm** rồi `os.replace(temp, DATA_FILE)`. Mất điện giữa chừng thì file thật không bị cắt dở.

## 7. Khóa luồng (Lock / mutex)
`DATA_LOCK = threading.RLock()`. Server đa luồng; lock đảm bảo một lúc chỉ một luồng sửa dữ liệu → tránh **race condition** (tranh chấp dữ liệu). `RLock` (reentrant) cho phép cùng luồng khóa lại.

## 8. Kiểm tra dữ liệu vào (Validation)
- Kiểm kiểu: `is_plain_int` (loại `True/False` vì `bool` là con của `int` trong Python).
- Giới hạn body 1 MB trong `read_json`.
- Thông báo lỗi rõ, ví dụ *"A drink order has invalid person, item, size, or quantity"*.

## 9. Mô hình đồ uống (Drink domain model)
- **Shop** (quán) → **menu items** (món) với `type`: `drink` (S/M/L), `topping` (một giá), `food` (S/M/L).
- **Order** (đơn): người, món, size, số lượng; topping có thể đặt **riêng** không kèm món.
- Cùng cấu trúc, khác quy tắc giá theo type.

## 10. Tiền & làm tròn (Money & rounding)
- Phân bổ phí/giảm giá theo **tỉ lệ (proportional allocation)**.
- Chia đều phần chung (**equal share**), **làm tròn từng người** rồi cộng.
- Mẹo: dùng số nguyên (đồng) hoặc `Decimal`; tránh `float` cho tiền (0.1+0.2≠0.3).

## 11. Nhập/Xuất (Import/Export)
Xuất người chơi ra `.json`, nhập lại có **xác nhận ghi đè**. Nên kiểm tra cấu trúc (schema) trước khi nhập.

## 12. Dữ liệu dẫn xuất (Derived data)
Số lượng theo tier, thứ hạng... **tính từ** dữ liệu gốc khi cần, không lưu trùng → tránh mâu thuẫn (*single source of truth*).

## 13. Tài khoản & phiên (Users & sessions)
- Mật khẩu lưu **hash + salt**, không lưu bản gốc.
- Phiên (session) giữ trong bộ nhớ với token ngẫu nhiên; có cờ `locked`, đếm `failed_login_attempts`.
