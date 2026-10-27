# Hướng dẫn sử dụng Power Ranking

Tài liệu này hướng dẫn cài đặt, khởi chạy và sử dụng ứng dụng Power Ranking để quản lý người chơi, kết quả trận đấu và thứ hạng.

## 1. Ứng dụng làm gì?

Ứng dụng chạy trên trình duyệt, còn máy chủ xử lý và lưu dữ liệu trong tệp `data.json` cùng thư mục với `app.py`. Các chức năng chính:

- Xem bảng xếp hạng người chơi theo Tier, sao và các chuỗi trận.
- Random người chơi thành 2–4 đội, ưu tiên cân bằng Tier và chia đều thành viên.
- Ghi kết quả trận có 2, 3 hoặc 4 hạng.
- Xem lịch sử trận và nhật ký thay đổi thứ hạng gần đây.
- Xuất bảng xếp hạng thành tệp văn bản UTF-8.
- Quản lý tài khoản và danh sách người chơi nếu đăng nhập bằng Admin.

## 2. Yêu cầu

- Windows, macOS hoặc Linux có Python **3.9 trở lên**.
- Trình duyệt hiện đại có bật JavaScript.
- Không cần cài thư viện Python bên ngoài; ứng dụng dùng thư viện có sẵn của Python.

Kiểm tra Python trong PowerShell hoặc Terminal:

```powershell
python --version
```

Nếu Windows không nhận lệnh `python`, thử:

```powershell
py -3 --version
```

## 3. Khởi động ứng dụng

Mở PowerShell, chuyển đến thư mục chứa dự án rồi chạy máy chủ:

```powershell
cd "E:\visual\Repos_ToolFootball\Projects\ToolFootball"
python app.py
```

Nếu dùng Python Launcher trên Windows:

```powershell
py -3 app.py
```

Khi thấy thông báo máy chủ đang chạy, mở trình duyệt tại:

```text
http://127.0.0.1:5000
```

Giữ cửa sổ PowerShell mở trong khi sử dụng web. Để dừng máy chủ, quay lại cửa sổ đó và nhấn `Ctrl+C`.

Mặc định ứng dụng chỉ lắng nghe trên máy đang chạy nó (`127.0.0.1`) và dùng cổng `5000`. Có thể đổi cổng tạm thời trong PowerShell trước khi khởi động:

```powershell
$env:PORT = "8080"
python app.py
```

Sau đó truy cập `http://127.0.0.1:8080`. Đóng cửa sổ PowerShell sẽ xóa thiết lập biến môi trường tạm này.

## 4. Đăng nhập và tài khoản

### Thiết lập Admin đầu tiên

Nếu chưa có Admin đang hoạt động và được duyệt, trang mở đầu sẽ yêu cầu tạo tài khoản Admin. Hãy nhập tên đăng nhập (3–64 ký tự) và mật khẩu (ít nhất 10 ký tự). Có thể thiết lập thêm mật khẩu dự phòng; mật khẩu dự phòng phải khác mật khẩu chính.

Nếu trang hiển thị biểu mẫu đăng nhập thay vì thiết lập Admin, ứng dụng đã có tài khoản. Hãy đăng nhập bằng thông tin tài khoản hiện có. Không có mật khẩu mặc định được quy định trong hướng dẫn này.

### Tự đăng ký

1. Tại trang đăng nhập, chọn **Create account**.
2. Nhập tên đăng nhập, mật khẩu chính và xác nhận mật khẩu.
3. Mật khẩu chính phải có ít nhất 10 ký tự. Mật khẩu dự phòng là tùy chọn nhưng nên thiết lập để có thể tự khôi phục mật khẩu chính.
4. Sau khi gửi đăng ký, tài khoản ở trạng thái chờ Admin duyệt và chưa thể sử dụng.
5. Admin duyệt tài khoản trong mục **Manage users**. Hàng đợi đăng ký tối đa 100 tài khoản đang chờ.

### Khôi phục và đổi mật khẩu

- Chọn **Forgot password?** ở màn hình đăng nhập để đặt lại mật khẩu chính bằng tên tài khoản, mật khẩu dự phòng và mật khẩu chính mới.
- Khi đã đăng nhập, chọn **Change password** để đổi mật khẩu chính; cần nhập mật khẩu hiện tại.
- Tại cùng khu vực đổi mật khẩu, có thể tạo hoặc thay mật khẩu dự phòng bằng cách xác thực mật khẩu chính hiện tại.
- Mật khẩu mới phải có ít nhất 10 ký tự. Mật khẩu dự phòng phải khác mật khẩu chính.
- Sau 5 lần xác thực mật khẩu sai, tài khoản bị khóa. Liên hệ Admin để mở khóa.
- Đăng xuất bằng nút **Log out**. Phiên đăng nhập hết hạn sau 8 giờ.

### Vai trò và quyền hạn

| Vai trò | Quyền sử dụng |
|---|---|
| **Viewer** | Xem bảng xếp hạng, lịch sử và nhật ký; xuất bảng xếp hạng. Không ghi kết quả trận hoặc quản trị dữ liệu. |
| **Operator** | Có quyền của Viewer và được ghi kết quả trận. |
| **Admin** | Có toàn quyền: ghi trận, thêm/sửa/xóa người chơi, quản lý tài khoản, duyệt đăng ký và quản lý lịch sử/nhật ký. |

Admin tạo tài khoản từ **Manage users** có thể chọn vai trò; tài khoản mới phải đổi mật khẩu tạm thời ở lần đăng nhập đầu tiên. Admin cũng có thể đổi vai trò, kích hoạt/vô hiệu hóa, đặt lại mật khẩu, mở khóa hoặc xóa tài khoản. Khi đặt lại mật khẩu, người dùng phải đăng nhập lại và đổi mật khẩu. Hệ thống không cho phép tự xóa tài khoản, tự vô hiệu hóa tài khoản hoặc loại bỏ quyền Admin của Admin đang thao tác; luôn phải còn ít nhất một Admin đang hoạt động và được duyệt.

## 5. Các mục trên web

### Ranking

Mục **Ranking** hiển thị người chơi đã sắp xếp theo Tier tăng dần (Tier 1 đứng trước), số sao giảm dần trong cùng Tier, rồi theo tên người chơi. Bảng cũng hiển thị chuỗi thắng, chuỗi tham gia và chuỗi vắng mặt.

- Admin có nút **Edit** cạnh từng người chơi để chỉnh Tier, sao và các chuỗi.
- Phần **Export Player Ranking** cho phép chọn ngày, sửa tên tệp, xem trước nội dung Markdown dạng bảng và xuất bảng xếp hạng hiện tại thành `.txt`. Có thể đổi đuôi tệp thành `.md` để hiển thị bảng đã định dạng trong trình xem Markdown. Tệp được tải/xuất về vị trí do trình duyệt hoặc hộp thoại lưu tệp quyết định; ngày xuất chỉ dùng để ghi nhãn trong tệp, không thay đổi dữ liệu trận.

### Random teams

Mục **Random teams** chia người chơi đã chọn thành 2, 3 hoặc 4 đội:

- Có thể chọn tất cả người chơi hoặc chọn một nhóm cụ thể; mỗi người được chọn chỉ xuất hiện trong một đội.
- Điểm đội chỉ dựa trên Tier: Tier 1 = 5 điểm, Tier 2 = 4 điểm, Tier 3 = 3 điểm, Tier 4 = 2 điểm, Tier 5 = 1 điểm. Sao không ảnh hưởng đến điểm random.
- Số thành viên các đội được chia đều; chênh lệch số người giữa đội đông nhất và ít người nhất không quá 1.
- Khi chia, ứng dụng ưu tiên rải người Tier cao (Tier 1 cao nhất) qua các đội, rồi tìm cách giảm chênh lệch tổng điểm. Danh sách trong kết quả cũng hiển thị Tier cao trước.
- Kết quả chỉ hiển thị một phương án tại một thời điểm. Chọn **Random lại** để tạo cách chia khác.
- Nếu nhóm người chơi và số đội đã chọn không cho phép thỏa hoàn toàn quy tắc cân bằng điểm, ứng dụng hiển thị phương án gần nhất tìm được kèm thông báo.

### Record match

Admin và Operator có thể ghi trận:

1. Chọn ngày trận đấu.
2. Chọn **2 ranks**, **3 ranks** hoặc **4 ranks**.
3. Tìm người chơi bằng ô **Search player** nếu danh sách dài.
4. Chọn Rank cho từng người chơi tham gia. Người không tham gia để **Not selected**.
5. Kiểm tra **Match Result Summary**; mỗi Rank phải có ít nhất một người.
6. Chọn **Save match result** để lưu. Chọn **Reset form** nếu muốn làm lại trước khi lưu.

Một người chơi chỉ được xếp vào một Rank trong một trận. Có thể có nhiều người ở cùng Rank, ví dụ các thành viên của một đội. Ngày được chấp nhận theo định dạng `YYYY-MM-DD` hoặc `DD/MM/YYYY`.

Viewer vẫn thấy mục này nhưng không thể gửi kết quả.

### Quy tắc tính sao và thứ hạng

- Tier 1 là cao nhất, Tier 5 là thấp nhất. Điểm quy đổi lần lượt là Tier 1: 5 điểm, Tier 2: 4 điểm, Tier 3: 3 điểm, Tier 4: 2 điểm, Tier 5: 1 điểm.
- Kết quả theo số Rank đã chọn:

| Số Rank | Rank 1 | Rank 2 | Rank 3 | Rank 4 |
|---|---:|---:|---:|---:|
| 2 | +1 sao | −1 sao | — | — |
| 3 | +1 sao | Không đổi | −1 sao | — |
| 4 | +2 sao | +1 sao | −1 sao | −2 sao |

- Ở Tier 2–4, đạt 3 sao sẽ thăng lên Tier cao hơn và số sao trở về 0. Mất sao dưới 0 sẽ xuống Tier thấp hơn và đặt về 2 sao.
- Tier 1 không thăng tiếp; Tier 5 không xuống thấp hơn. Người chơi ở Tier 1 có thể tích lũy tối đa 10 sao.
- Chuỗi thắng chỉ được theo dõi để hiển thị, không thưởng sao. Tham gia 3 trận liên tiếp được cộng 1 sao; chuỗi tham gia được tính lại từ đầu sau khi nhận thưởng.
- Người vắng mặt 2 trận liên tiếp bị trừ 1 sao. Vắng mặt sẽ đặt lại chuỗi thắng và chuỗi tham gia.
- Các thay đổi do kết quả trận được áp dụng trước, sau đó mới áp dụng thưởng/phạt chuỗi. Có thể xem giải thích thay đổi ở nhật ký.

### Match history

Mục **Match history** hiển thị các trận theo ngày, gồm số trận, số Rank và danh sách người chơi ở từng Rank. Các bản ghi mới hơn được hiển thị trước. Người đã đăng nhập cũng có thể xem **Recent ranking changes**; phần này giữ tối đa 10 nhật ký trận gần nhất.

Các thao tác sau chỉ dành cho Admin:

- **Hide displayed history**: ẩn toàn bộ lịch sử đang hiển thị. Bản ghi nguồn, thứ hạng và nhật ký không bị thay đổi. Dùng **Restore hidden history** để hiện lại.
- **Delete permanently** trên một trận: xóa vĩnh viễn trận đó, sau đó tính lại thứ hạng và chuỗi từ dữ liệu người chơi ban đầu cùng các trận còn lại. Nhật ký **Recent ranking changes** vẫn được giữ nguyên.
- **Delete all history permanently**: xóa vĩnh viễn toàn bộ bản ghi trận, tính lại dữ liệu từ trạng thái người chơi ban đầu và đặt lại số trận để lịch sử mới bắt đầu từ **Match #1**. Nhật ký **Recent ranking changes** vẫn được giữ nguyên; log cũ là bản ghi độc lập nên có thể có cùng số Match với trận mới.
- **Clear match logs**: chỉ xóa nhật ký thay đổi gần đây; không ảnh hưởng thứ hạng hoặc lịch sử trận. Đây là thao tác riêng để xóa log.

Xóa vĩnh viễn một hoặc toàn bộ trận sẽ không giữ lại các chỉnh sửa người chơi thủ công trước đó; thứ hạng sẽ được dựng lại từ trạng thái ban đầu và các trận còn lại. Hãy đọc kỹ hộp xác nhận trước khi tiếp tục.
Nhật ký là bản ghi độc lập của các thay đổi đã xảy ra; log của trận đã xóa vẫn được giữ, cho đến khi bị đẩy khỏi danh sách 10 log gần nhất bởi các trận mới hoặc được Admin xóa bằng **Clear match logs**.

### Manage players (Admin)

- **Add player**: nhập tên, chọn Tier và số sao ban đầu (0–10), sau đó chọn **Add player**.
- Danh sách người chơi cho phép chọn một hoặc nhiều người rồi chọn **Delete selected**; cũng có thể xóa từng người.
- Xóa người chơi sẽ loại họ khỏi danh sách đang hoạt động, nhưng lịch sử trận và nhật ký cũ được giữ nguyên.
- Chọn **Edit** trong bảng Ranking để chỉnh Tier, sao, chuỗi thắng, chuỗi tham gia và chuỗi vắng mặt. Việc sửa trực tiếp này không viết lại lịch sử trận.

Nếu sau này Admin xóa trận và hệ thống dựng lại thứ hạng, các chỉnh sửa thủ công sẽ không được bảo toàn.

### Manage users (Admin)

- Tạo tài khoản với tên đăng nhập, mật khẩu tạm (ít nhất 10 ký tự), vai trò và tùy chọn mật khẩu dự phòng.
- Tài khoản tự đăng ký được ghi nhãn **Pending approval · inactive**; chọn **Approve** để duyệt và kích hoạt.
- Chọn **Save role** để lưu vai trò đã chọn.
- Dùng **Deactivate**/**Activate** để vô hiệu hóa/kích hoạt tài khoản; tài khoản bị vô hiệu hóa không thể đăng nhập.
- **Reset password** đặt mật khẩu tạm mới và yêu cầu người dùng đăng nhập lại.
- **Unlock** mở khóa tài khoản bị khóa do đăng nhập sai quá số lần cho phép.
- **Delete** xóa vĩnh viễn tài khoản người dùng. Không thể xóa tài khoản của chính Admin đang đăng nhập.

## 6. Dữ liệu, sao lưu và khôi phục quyền Admin

- Dữ liệu tài khoản, người chơi, lịch sử và thứ hạng được lưu trong `data.json` cạnh `app.py`. Ứng dụng tự tạo tệp này nếu chưa có.
- Nên dừng máy chủ bằng `Ctrl+C` trước khi sao lưu. Sao chép `data.json` sang nơi an toàn; khôi phục bằng cách đưa bản sao trở lại thư mục dự án khi máy chủ đã dừng.
- Không chỉnh sửa `data.json` khi máy chủ đang chạy. JSON sai định dạng có thể khiến ứng dụng không khởi động hoặc không đọc được dữ liệu.
- Nếu quên mật khẩu Admin và không thể dùng mật khẩu dự phòng, có thể đặt lại từ cửa sổ dòng lệnh trên máy chủ:

  ```powershell
  cd "E:\visual\Repos_ToolFootball\Projects\ToolFootball"
  python app.py --reset-admin-password TEN_DANG_NHAP_ADMIN
  ```

  Thay `TEN_DANG_NHAP_ADMIN` bằng tên tài khoản Admin đang hoạt động. Nhập mật khẩu mới và xác nhận khi được nhắc; ký tự mật khẩu không hiển thị trong cửa sổ dòng lệnh. Tài khoản sẽ phải đổi mật khẩu sau lần đăng nhập tiếp theo.

## 7. Lưu ý khi sử dụng trên mạng

Mặc định web chỉ phục vụ trên máy cục bộ. Không nên mở máy chủ ra mạng công cộng bằng cách thay đổi địa chỉ lắng nghe nếu chưa thiết lập HTTPS, kiểm soát truy cập và cấu hình triển khai an toàn. Nếu nhiều người cần dùng qua mạng, hãy nhờ người quản trị triển khai đúng cách; không chia sẻ tệp `data.json` vì tệp chứa dữ liệu tài khoản và thông tin xác thực đã băm.

## 8. Xử lý sự cố thường gặp

- **Không mở được trang:** kiểm tra cửa sổ dòng lệnh còn đang chạy `app.py` hay không và thử lại `http://127.0.0.1:5000`.
- **Cổng đã được sử dụng:** chọn cổng khác bằng biến `PORT` như hướng dẫn ở mục 3.
- **Trang báo không tải được dữ liệu:** đảm bảo truy cập qua địa chỉ máy chủ ở trên, không mở trực tiếp `index.html` bằng cách nhấp đúp vào tệp.
- **Tài khoản chờ duyệt:** nhờ Admin duyệt trong **Manage users**.
- **Tài khoản bị khóa:** nhờ Admin dùng **Unlock**.
- **Máy chủ báo không đọc được `data.json`:** dừng máy chủ, kiểm tra tệp có còn là JSON hợp lệ không hoặc khôi phục bản sao lưu.


# Power Ranking

## 27/10

Legend: 💠 Stars | 👑 Win streak | 🔥 Play streak | 🧊 Off streak

| Tier | Player | 💠 | 👑 | 🔥 | 🧊 |
|---:|---|---:|---:|---:|---:|
| 1 | Alan | 0 | 0 | 0 | 0 |
| 1 | Austin | 0 | 0 | 0 | 0 |
| 1 | Kovo | 0 | 0 | 0 | 0 |
| 1 | Logan | 0 | 0 | 0 | 0 |
| 1 | Walker | 0 | 0 | 0 | 0 |
| 2 | Senju | 1 | 0 | 2 | 0 |
| 2 | Andiez | 0 | 0 | 0 | 0 |
| 3 | Bryant | 0 | 0 | 0 | 0 |
| 3 | Chovy | 0 | 0 | 0 | 0 |
| 3 | Demon | 0 | 0 | 0 | 0 |
| 3 | Hanzo | 0 | 0 | 0 | 0 |
| 3 | Timbo | 0 | 0 | 0 | 0 |
| 3 | Travis | 0 | 0 | 0 | 0 |
| 4 | Philip | 0 | 0 | 0 | 0 |
| 4 | Shin | 0 | 0 | 0 | 0 |
| 5 | Ares | 0 | 0 | 0 | 0 |
| 5 | Kalos | 0 | 0 | 0 | 0 |
| 5 | Noway | 0 | 2 | 2 | 0 |
