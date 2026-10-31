# Power Ranking Manager

Ứng dụng web chạy cục bộ để quản lý thứ hạng người chơi, kết quả trận đấu, chia đội và đơn nước. Backend dùng Python standard library; giao diện chạy trên trình duyệt và không cần cài package Python bên ngoài.

## Tính năng

- **Ranking:** xem Tier, sao và các chuỗi thắng, tham gia, vắng mặt; chỉnh sửa thứ hạng và xuất bảng xếp hạng.
- **Random teams:** chia người chơi thành 2–4 đội, cân bằng số thành viên và ưu tiên cân bằng Tier.
- **Record match:** ghi trận với 2–4 hạng; xem trước phân hạng và đặt lại biểu mẫu trước khi lưu.
- **Drink orders:** quản lý nhiều quán, menu, topping, đơn nước và chia hóa đơn theo người hoặc team.
- **Match history:** xem lịch sử trận, nhật ký thay đổi thứ hạng; Admin có thể ẩn hoặc xóa lịch sử và quản lý nhật ký.
- **Manage players / users:** Admin quản lý người chơi, tài khoản, vai trò và quyền truy cập.
- **Giao diện:** chọn theme Ocean, Midnight hoặc Light; lựa chọn được lưu trong trình duyệt.

## Yêu cầu

- Python 3.9 trở lên.
- Trình duyệt hiện đại có bật JavaScript.
- Không cần cài thư viện Python bên ngoài.

Kiểm tra Python:

```powershell
python --version
```

Trên Windows, có thể dùng Python Launcher nếu lệnh `python` không khả dụng:

```powershell
py -3 --version
```

## Chạy ứng dụng

Mở Terminal hoặc PowerShell tại thư mục dự án và chạy:

```powershell
python run.py
```

Hoặc trên Windows:

```powershell
py -3 run.py
```

Mở địa chỉ được hiển thị trong Terminal, mặc định là <http://127.0.0.1:5000>. Giữ cửa sổ Terminal mở khi sử dụng ứng dụng; nhấn `Ctrl+C` để dừng máy chủ.

Đổi cổng cho lần chạy hiện tại trong PowerShell:

```powershell
$env:PORT = "8080"
python run.py
```

Sau đó truy cập <http://127.0.0.1:8080>. Ứng dụng mặc định chỉ lắng nghe trên `127.0.0.1`. Không đổi `HOST` để mở ra mạng công cộng nếu chưa cấu hình triển khai an toàn.

## Tài khoản và quyền

### Tạo Admin đầu tiên

Ở lần chạy đầu, ứng dụng yêu cầu tạo tài khoản Admin nếu chưa có Admin đang hoạt động và được duyệt. Tên đăng nhập dài 3–64 ký tự; mật khẩu có ít nhất 10 ký tự. Có thể đặt thêm mật khẩu dự phòng, nhưng mật khẩu dự phòng phải khác mật khẩu chính.

Nếu trang đăng nhập đã xuất hiện, hãy đăng nhập bằng tài khoản hiện có. Ứng dụng không đặt sẵn mật khẩu mặc định.

### Đăng ký và mật khẩu

- Người dùng có thể tự đăng ký; tài khoản mới phải chờ Admin duyệt.
- Dùng **Forgot password?** để khôi phục mật khẩu bằng mật khẩu dự phòng.
- Sau khi đăng nhập, mục **Change password** cho phép đổi mật khẩu chính hoặc thiết lập mật khẩu dự phòng.
- Admin có thể duyệt, khóa/mở khóa, kích hoạt/vô hiệu hóa, đặt lại mật khẩu hoặc xóa tài khoản.
- Sau 5 lần đăng nhập sai, tài khoản bị khóa. Phiên đăng nhập hết hạn sau 8 giờ.
- Mật khẩu do ứng dụng lưu được băm bằng scrypt; không lưu mật khẩu rõ trong tệp dữ liệu.

### Vai trò

| Vai trò | Quyền |
|---|---|
| **Viewer** | Xem bảng xếp hạng, lịch sử, menu và tổng đơn; xuất bảng xếp hạng. |
| **Operator** | Có quyền Viewer, được ghi kết quả trận và quản lý quán, menu, đơn nước. |
| **Admin** | Toàn quyền, bao gồm quản lý người chơi, tài khoản, lịch sử và nhật ký. |

Tài khoản do Admin tạo có thể được yêu cầu đổi mật khẩu tạm ở lần đăng nhập đầu tiên. Hệ thống không cho phép Admin tự vô hiệu hóa hoặc xóa tài khoản của mình, loại bỏ quyền Admin của tài khoản cuối cùng đang hoạt động, hoặc xóa Admin cuối cùng.

## Sử dụng

### Ranking

Người chơi được sắp xếp theo Tier tăng dần (Tier 1 cao nhất), sao giảm dần, rồi theo tên. Admin có thể chỉnh Tier, sao và các chuỗi trận. Phần **Export Player Ranking** cho phép chọn ngày, xem trước nội dung và tải bảng xếp hạng dạng văn bản/Markdown.

### Random teams

Chọn người chơi và số đội từ 2 đến 4, sau đó tạo phương án chia đội. Mỗi người chỉ xuất hiện trong một đội; số thành viên giữa các đội chênh nhau tối đa một người. Điểm cân bằng chỉ dựa trên Tier: Tier 1 = 5 điểm, Tier 2 = 4, Tier 3 = 3, Tier 4 = 2, Tier 5 = 1. Chọn **Randomize teams** để tạo phương án khác.

### Record match

Admin và Operator có thể ghi trận:

1. Chọn ngày và số hạng (2, 3 hoặc 4).
2. Chọn một hạng cho từng người tham gia; để **Not selected** với người không tham gia.
3. Kiểm tra **Match Result Summary**. Mỗi hạng phải có ít nhất một người và một người không thể nằm ở nhiều hạng.
4. Chọn **Save match result** để lưu. Chọn **Reset form** để xóa phân hạng và tìm kiếm, trở về 4 hạng cùng ngày hiện tại.

Viewer có thể xem mục này nhưng không thể gửi kết quả.

### Drink orders và chia hóa đơn

Admin và Operator có thể tạo nhiều quán, nhập menu theo từng quán, thêm topping, ghi đơn và quản lý đơn. Giá đồ uống, topping, phí và giảm giá nhập theo nghìn đồng; ví dụ `25` tương ứng `25.000 ₫`. Viewer chỉ xem menu và tổng đơn.

Trong **Bill settlement**, chọn team (1–4 team) hoặc **Individual orders** cho từng người có đơn. Mọi người đặt phải được phân vào đúng một nhóm. Thành viên không có đơn vẫn có thể tham gia team và chia phần chi phí chung. Tỷ lệ các team phải không âm và tổng bằng 100%.

Ứng dụng phân bổ hóa đơn cuối theo tỷ lệ giữa tổng bill sau phí/giảm giá và tổng giá món gốc. Chi phí team được chia theo tỷ lệ team; phần chi phí chung chia đều cho mọi thành viên, kể cả người không đặt. Phép phân bổ dùng đồng nguyên và phương pháp phần dư lớn nhất để đối soát tổng; số tiền cuối mỗi người được làm tròn đến 1.000 ₫ gần nhất (500 ₫ làm tròn lên). Vì làm tròn từng người, tổng phải thu sau làm tròn có thể khác tổng hóa đơn; màn hình hiển thị phần chênh lệch.

Chọn **Preview bill** để xem/copy danh sách thanh toán Markdown. Có thể nhập prefix để đánh số người trong danh sách.

### Match history và quản trị

Match history hiển thị các trận mới nhất trước và tối đa 10 nhật ký thay đổi thứ hạng gần đây. Admin có thể ẩn/khôi phục lịch sử hiển thị, xóa một trận hoặc toàn bộ trận, và xóa nhật ký riêng. Xóa trận sẽ tính lại thứ hạng từ dữ liệu ban đầu cùng các trận còn lại; các chỉnh sửa người chơi thủ công có thể không được giữ.

Trong **Manage players**, Admin có thể thêm, sửa hoặc xóa người chơi. Trong **Manage users**, Admin có thể tạo tài khoản, đổi vai trò, duyệt tài khoản, kích hoạt/vô hiệu hóa, đặt lại mật khẩu, mở khóa và xóa tài khoản.

## Dữ liệu và sao lưu

- `data/data.json`: tài khoản, người chơi, thứ hạng và lịch sử trận.
- `data/drink_data.json`: quán, menu và đơn nước.
- Thư mục `data/` được tạo tự động và không đưa vào Git.

Để sao lưu, dừng máy chủ bằng `Ctrl+C` rồi sao chép toàn bộ thư mục `data/` sang nơi an toàn. Khôi phục bằng cách chép lại thư mục khi máy chủ đã dừng. Không sửa các tệp JSON khi máy chủ đang chạy. Tệp `data/data.json` chứa dữ liệu tài khoản và hash mật khẩu; không chia sẻ công khai.

Nếu quên mật khẩu Admin và không thể dùng mật khẩu dự phòng, đặt lại từ Terminal trên máy chủ:

```powershell
python run.py --reset-admin-password TEN_DANG_NHAP_ADMIN
```

Thay `TEN_DANG_NHAP_ADMIN` bằng tên Admin hiện có rồi làm theo hướng dẫn nhập mật khẩu. Admin đó sẽ phải đổi mật khẩu sau lần đăng nhập tiếp theo.

## Cấu trúc dự án

```text
power_ranking/   Backend Python: xác thực, xếp hạng, đồ uống, lưu trữ và HTTP
static/          HTML, CSS và JavaScript của giao diện
data/            Dữ liệu ứng dụng được tạo khi chạy (không đưa vào Git)
tests/           Kiểm thử JavaScript
run.py           Lệnh khởi chạy ứng dụng
app.py           Entry point tương thích với cách chạy cũ
```

## Kiểm thử

Kiểm thử tính toán chia hóa đơn cần Node.js:

```powershell
node --test tests/drink-settlement.test.js
```

## Xử lý sự cố

- **Không mở được trang:** kiểm tra máy chủ còn chạy và truy cập đúng địa chỉ/port được in trong Terminal.
- **Cổng đang được sử dụng:** đặt `PORT` sang cổng khác rồi chạy lại.
- **Không tải được dữ liệu:** truy cập ứng dụng qua địa chỉ máy chủ, không mở trực tiếp `static/index.html`.
- **Tài khoản chờ duyệt hoặc bị khóa:** liên hệ Admin để duyệt hoặc mở khóa.
- **Lỗi dữ liệu:** dừng máy chủ, kiểm tra JSON trong `data/` hoặc khôi phục bản sao lưu gần nhất.
