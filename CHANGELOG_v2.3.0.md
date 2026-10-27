# Pandakeyauto v2.3.0 — Fix chuột PC ↔ Điện thoại, mượt hơn, GUI gọn hơn

## 🐭 Nguyên nhân gốc rễ lỗi chuột khi chuyển PC → Điện thoại (đã fix)

Có **4 lỗi chồng nhau**, không phải 1:

1. **Trạng thái chuột bị chia 2 nơi (desync)**
   Tiến trình `--watch` (giữ hook Alt) giữ `isInsidePhone` trong RAM của nó,
   còn nút bấm trên UI lại chạy `switch_mouse.exe` như **một tiến trình one-shot riêng**
   để toggle. One-shot đổi file state + đổi chế độ, nhưng tiến trình `--watch`
   vẫn tin ở chế độ cũ → nó xử lý phím/chuột theo logic ngược lại, chuột kẹt/nhảy loạn.
   **Fix:** UI giờ gửi yêu cầu qua file `pandakey_mouse_toggle_request.txt`,
   **chỉ tiến trình `--watch` mới thực thi toggle** (single owner). Watcher cũng
   tự đồng bộ lại nếu file state bị tiến trình khác đổi, và tự khởi động lại (tối đa 5 lần) nếu bị chết.

2. **Giữ Alt để thoát thì bị bắt trở lại điện thoại**
   Ở chế độ điện thoại, Alt-DOWN nhả chuột về PC. Nhưng khi **giữ** Alt, Windows
   tự lặp Alt-DOWN (auto-repeat) → các lần lặp đó rơi vào logic PC và được hiểu là
   "Alt tap mới", nên vừa thả Alt ra là chuột **bị capture lại vào điện thoại**.
   **Fix:** cờ `suppressAltUntilUp` nuốt toàn bộ auto-repeat + Alt-UP của chính lần nhấn đó.
   Thêm: các phím tổng hợp do chính tool gửi (nhả RCtrl/Alt…) được đánh dấu
   `dwExtraInfo = "PAND"` để hook bỏ qua, không tự kích hoạt lại chính nó.

3. **Mỗi lần chuyển sang điện thoại là game nhận 1 click chuột trái**
   `CaptureToPhone()` gửi `mouse_event(LEFTDOWN/UP)` giả để "kích hoạt" scrcpy —
   click đó lọt thẳng vào game (tự bắn / bấm nhầm nút).
   **Fix:** bỏ click giả. Chỉ focus + `ClipCursor` là đủ, scrcpy tự bắt chuột ở thao tác thật đầu tiên.
   Kèm theo: vị trí chuột PC được **lưu xuống file** (`pandakey_pc_cursor.txt`) nên
   khi nhả về PC, con trỏ trả về **đúng chỗ cũ + đúng cửa sổ PC cũ**, bất kể tiến trình nào thực thi,
   và không bị ghi đè bởi tâm cửa sổ điện thoại khi capture lại.

4. **Chuột bị giật về giữa màn hình mỗi khi lia tới biên**
   Hook chuột gọi `SetCursorPos(giữa)` ngay trong low-level hook mỗi khi con trỏ cách biên 25px —
   làm mất delta lia chuột, gây xoay/giật, đặc biệt khi quay 180°/360°.
   **Fix:** bỏ hoàn toàn việc giật con trỏ trong hook. Chỉ dùng `ClipCursor`, và
   refresh vùng clip **tối đa 2 lần/giây, chỉ khi cửa sổ scrcpy thật sự di chuyển/resize**
   (trước đây vùng clip bị "đóng băng" theo vị trí cũ khi kéo cửa sổ scrcpy đi nơi khác).

   Ngoài ra: ghi file state giờ là **atomic** (ghi tạm rồi thay thế),
   và không còn snapshot tốc độ chuột PC khi đang ở chế độ điện thoại
   (trước đây có thể lưu nhầm tốc độ của điện thoại thành "tốc độ gốc của PC").

## ⚡ Mượt hơn

- `resolveActiveAdbDevice()` từng chạy `execSync("adb devices")` — **đóng băng toàn bộ
  Electron main process 50–300ms**, và 2 poller gọi nó mỗi 6 giây. Giờ dùng cache
  được cập nhật bất đồng bộ từ `get-devices` / `set-selected-device`: poller không bao giờ block nữa.
- 2 poller thêm **in-flight guard** (không chồng lệnh `adb shell` khi máy chậm),
  giãn nhịp: game-detect 6s → 10s, hardware 6s → 8s.
- Renderer: `updateDeviceList` / `refreshBatteryStats` có in-flight guard;
  pin 8s → 20s và **dừng poll khi cửa sổ ẩn / đang trong session**
  (main đã đẩy `hardware-stats` mỗi 8s rồi, poll cũ chỉ là trùng lặp tốn CPU).
- Output của watcher chuột giờ được **buffer theo dòng** — trước đây một chunk bị cắt giữa
  `RELEASED_TO_PC` là mất luôn thông báo đổi chế độ.
- Thoát app: chạy `--restore` **trước** khi kill watcher, tránh kẹt clip/tốc độ chuột sau khi đóng app.
- CSS: tắt animation phát sáng vô hạn khi cửa sổ không được hover, tôn trọng `prefers-reduced-motion`.

## 📐 GUI nhỏ gọn & tiện hơn

- Cửa sổ mặc định **340×450 → 320×420**, phóng to **520×680 → 480×620**.
- Thanh tiêu đề bỏ bớt 2 nút ít dùng (Radial, Mini-Dock) khỏi hàng nút cửa sổ chật chội
  (vẫn bật lại được bằng cách xoá 1 dòng CSS trong khối `v2.3 COMPACT` cuối `style.css`),
  nút cửa sổ nhỏ lại 17px, hero button 48 → 42px, giảm padding/gap toàn HUD.
- **Nhấp đúp thanh tiêu đề** = phóng to / thu gọn.
- **Esc** đóng ngăn Cài đặt trước, khỏi phải tìm nút ✕ nhỏ.

## 🤖 Thông minh hơn

- Watcher chuột tự hồi phục khi crash, tự re-clip khi cửa sổ scrcpy di chuyển/resize.
- CI (`.github/workflows/build.yml`) giờ **biên dịch lại `switch_mouse.exe` /
  `recoil_assist.exe` / `sniper_assist.exe` từ `.cs` bằng csc.exe** trước khi đóng gói —
  trước đây exe prebuilt commit tay nên sửa `.cs` mà quên build lại là bản phát hành vẫn chạy code cũ.
  Ở máy Windows, chạy `bin\build_helpers.bat` để build lại các helper thủ công.
- `bin/switch_mouse.exe` trong repo **đã được build lại từ source mới** (chỉ phụ thuộc mscorlib).

## ✅ Cách test trên Windows (cần làm tay — môi trường build không có Android/scrcpy thật)

1. Mở app, bấm **Bắt đầu** chiếu màn hình.
2. Nhấn-thả Alt nhanh → vào điện thoại: **không** còn phát bắn/click thừa, lia chuột tới biên không bị giật về giữa.
3. Đang ở điện thoại: **giữ Alt ~1 giây** rồi thả → về PC và **ở yên PC** (không bị bắt lại), con trỏ về đúng vị trí cũ.
4. Bấm nút đổi chuột trên HUD (mouse-mode) nhiều lần liên tục → chế độ trên HUD và thực tế luôn khớp nhau.
5. Kéo cửa sổ scrcpy sang vị trí khác khi đang ở chế độ điện thoại → chuột vẫn clip đúng vùng mới.
6. Đóng app khi đang ở chế độ điện thoại → chuột PC dùng bình thường ngay, không bị khoá vùng/tốc độ lạ.

Phiên bản: `2.2.1 → 2.3.0`
