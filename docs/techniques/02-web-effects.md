# 02. Kỹ thuật hiệu ứng web (Web Effects)

CSS nền được chèn bằng JS trong `static/app.js`; CSS bổ sung nằm ở `static/css/style.css`.

## 1. Biến CSS (CSS variables / custom properties)
```css
:root { --accent: #6c5ce7; --panel: #e9e9f2; }
button { background: var(--accent); }
```
Đổi một biến → đổi cả giao diện. Nền tảng của **theme** (chủ đề) sáng/tối.

## 2. Đổi theme mượt (Theme transition)
`setTheme()` thêm class `theme-transition` vào `<html>` trong 650ms; CSS có `transition` cho màu, nền, viền, bóng; xong thì gỡ để không làm chậm hiệu ứng khác.

## 3. Neumorphism (thiết kế nổi/chìm mềm)
Dùng hai `box-shadow` (sáng + tối) và `inset` (bóng trong) để tạo cảm giác nút nổi/lõm.

## 4. Transition (chuyển tiếp)
`transition: opacity .3s, transform .3s;` – đổi mượt giữa hai trạng thái. Dropdown chọn người dùng `opacity + transform + visibility` thay vì `display:none` vì `display` **không animate được**.

## 5. Hoạt ảnh khung chính (Keyframe animation)
`@keyframes` mô tả nhiều bước. Dùng cho: đèn LCD nhấp nháy (`lcd-flicker`), vệt sáng quét thanh vàng Tier 1, chip nảy lên (`chip-new`), hóa đơn trượt lên (`result-enter`).

## 6. Hiệu ứng lần lượt (Staggered animation)
Mỗi dòng trễ hơn dòng trước bằng `animation-delay` tăng dần → cảm giác "chảy" tự nhiên.

## 7. Làm mượt chuyển động (Easing)
`ease`, `ease-out`, `cubic-bezier(...)`. Với cuộn trang tự viết dùng **sine ease**: `0.5 - cos(πt)/2` – chậm đầu, nhanh giữa, chậm cuối.

## 8. Cuộn mượt tự viết bằng requestAnimationFrame
`scrollIntoView({behavior:"smooth"})` không chỉnh được tốc độ. Giải pháp (`form-events.js`):
1. Tạm đặt `scroll-behavior: auto` trên `<html>`.
2. Mỗi frame tính vị trí theo easing, gọi `window.scrollTo`.
3. Xong thì khôi phục. Thời lượng thích nghi theo khoảng cách (min–max).

## 9. Phản hồi trạng thái nút (Button state feedback)
Nút Save/Add/Calculate: spinner (`is-saving`) → "Saved ✓" xanh (`is-saved`) → trở lại. Cho người dùng **phản hồi tức thì** (instant feedback). Có dùng `element.animate()` (Web Animations API) cho hiệu ứng scale + vòng sáng.

## 10. Hiệu ứng xóa mượt (Removal animation)
Trước khi xóa dòng: thêm class làm mờ + thu nhỏ, chờ rồi mới xóa khỏi DOM (`animateRemoval`). Hộp xác nhận xóa trượt vào/ra, nút xuất hiện lần lượt.

## 11. Giảm chuyển động (Reduced motion)
```js
window.matchMedia("(prefers-reduced-motion: reduce)").matches
```
Nếu bật thì bỏ qua animation – một phần của **accessibility (khả năng truy cập)**.

## 12. CSS Grid & Flexbox (bố cục)
- `.match-split`: 2 cột, xuống 1 cột ở ≤900px bằng **media query** (responsive – đáp ứng).
- `.stars-cell`: grid `3.6em auto` để số thẳng hàng.
- `position: sticky` giữ hộp Summary dính khi cuộn.

## 13. Bố cục bảng (Table layout)
`table-layout: fixed` chia cột đều; `auto` co theo nội dung. Bảng roster dùng `fixed`, cột sao căn giữa.

## 14. Phần tử giả & gradient (Pseudo-element & gradient)
`::before/::after` vẽ vạch vàng, vệt sáng; `linear-gradient` cho huy hiệu "★ Tier 1" và hero hóa đơn. Không cần ảnh → nhẹ, sắc nét.

## 15. Scrollbar & checkbox tùy biến
- `::-webkit-scrollbar` mảnh, bo tròn. **Lưu ý**: nếu đặt `scrollbar-width`/`scrollbar-color`, Chrome bỏ qua `::-webkit-scrollbar`.
- Checkbox tự thiết kế bằng `appearance:none` + `:checked`.

## 16. Độ ưu tiên CSS (Specificity & cascade)
CSS nền trong app.js có thể đè CSS mới → dùng selector mạnh hơn (`:root button.is-saved`) hoặc `!important` có chủ đích. Hiểu **cascade (thác đổ)** giúp debug "sao CSS không ăn".

## 17. Hộp thoại trong trang (In-page dialogs)
`static/js/dialogs.js` thay `alert/confirm` mặc định bằng hộp thoại đẹp, trả **Promise** để dùng `await`.

## 18. Dropdown tự đóng (Delayed close)
Tự đóng ~250ms sau `mouseout` bằng `setTimeout` và hủy nếu chuột quay lại.
