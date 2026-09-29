# Dùng màn xem 3D Pascal

Trang này trả lời đúng bốn câu: bật ở đâu, vào bằng đường nào, cần dựng gì, và
hỏng thì đọc gì.

---

## 1. Bật cờ

Màn nằm sau cờ `scene.pascal-viewer`, **mặc định tắt**. Ba cách bật, theo thứ tự
ưu tiên mà `lib/telemetry/flags.ts` đọc:

| Cách | Làm thế nào | Dùng khi |
|---|---|---|
| **Ghi đè tại máy** | Mở bàn điều khiển của trình duyệt: `localStorage.setItem('appfront-feature-flags', JSON.stringify({ 'scene.pascal-viewer': true }))` rồi tải lại trang | thử tại máy |
| **Máy chủ** | Trả `{"scene.pascal-viewer": true}` trong bảng cờ của phiên | bật theo nhóm người dùng |
| **Mặc định** | `false` trong `FEATURE_FLAGS` | không ai có ý kiến |

Tắt lại: `localStorage.removeItem('appfront-feature-flags')`.

## 2. Đường vào

```
/projects/<mã dự án>/3d/pascal
```

Màn 3D cũ vẫn ở `/projects/<mã dự án>/3d` và **không bị đụng tới**. Hai màn chạy
song song; cờ quyết định màn mới có hiện hay không, không thay thế màn cũ.

**Cần đăng nhập.** Route nằm sau cổng phiên của `routes/router.tsx`, nên phải có
AppBack chạy ở `localhost:8080`. Không có nó thì mọi route đều rơi về màn đăng
nhập — đó là hành vi của cả ứng dụng, không riêng màn này.

## 3. Dựng

```bash
pnpm dev      # tự chép tài sản + dựng vách ngăn, rồi mới chạy vite
pnpm build    # y như trên, cho bản sản phẩm
```

Không phải gõ thêm lệnh nào. `pnpm dev` và `pnpm build` đều gọi `pnpm pascal`
trước, và lệnh ấy làm hai việc:

| Lệnh con | Việc | Ra đâu |
|---|---|---|
| `pnpm pascal:assets` | chép 293 tệp vật liệu `.ktx2` và 2 tệp bộ giải Basis | `public/pascal/`, `public/basis/` |
| `pnpm build:pascal` | lượt dựng **thứ hai**, gói riêng cho Pascal | `public/assets/pascal/` (251 tệp) |

Ba thư mục ấy đều **gitignore** — chúng là kết quả dựng, sinh lại được. Dựng từ
một bản clone sạch vẫn ra đủ; đã kiểm bằng cách xoá cả ba rồi chạy `pnpm build`.

Sửa mã Pascal trong `vendor/pascal` thì chạy lại `pnpm pascal`. Chỉ khi **bề mặt
API** đổi mới phải sinh lại `.d.ts` — xem `vendor/pascal/NGUON.md`.

## 4. Bàn phím

| Phím | Việc | Có nút chuột song song? |
|---|---|---|
| `Esc` | thu khung xem 3D lại (ngừng chạy WebGL) | có — nút "mở khung xem" khi đã thu |
| `E` | mở lại khung xem | có |
| `R` | thử nạp lại, chỉ khi đang lỗi | có — nút "thử lại" |

Không phím nào là cách **duy nhất** làm được việc gì (A12).

## 5. Bảy trạng thái, và cái gì gây ra mỗi trạng thái

| Trạng thái | Khi nào | Có chạy WebGL không |
|---|---|---|
| `forbidden` | cờ tắt | không |
| `loading` | chưa có bản vẽ, hoặc khung chưa dựng xong | không |
| `empty` | bản vẽ không có tường, phòng, ô mở, đồ đạc nào | **không** |
| `collapsed` | bấm `Esc`, hoặc nơi gọi truyền `collapsed` | **không** |
| `error` | xem bảng mã dưới | không |
| `partial` | dựng xong, nhưng có thứ không chuyển sang Pascal được | có |
| `success` | dựng xong trọn vẹn | có |

Năm trạng thái đầu **không dựng hộp canvas** — không tốn GPU khi không cần.

## 6. Hỏng thì đọc gì

| Mã trên màn | Nghĩa | Việc cần làm |
|---|---|---|
| `PASCAL-01` | không tải được gói vách ngăn từ `/assets/pascal/` | chạy `pnpm pascal` rồi tải lại |
| `PASCAL-02` | gói tải được nhưng khung dựng hình chết giữa chừng | báo người trực kèm mã |

Màn **không bao giờ** hiện thông điệp lỗi thô của JavaScript: chuỗi ấy do thư
viện sinh, luôn tiếng Anh, và A6 không có cách nào thoả. Thông điệp thô thuộc về
telemetry.

## 7. Cái màn này CHƯA làm

Ghi ra để không ai tưởng là đã xong:

- **Chưa sửa được gì.** Đây là màn **xem**. Mọi thay đổi vẫn đi qua màn 3D cũ.
- ~~**Chưa có trong CI.**~~ — **đã có.** `e2e/pascal-viewer.spec.ts` chạy trong
  Chromium thật và canh ba việc mà jsdom không canh được: hộp Pascal dựng ra một
  `<canvas>` có vùng đệm vẽ thật; ảnh PNG chụp canvas vượt sàn 8 000 byte, tức
  trên khung hình **có hình học** chứ không phải một mảng trời trơn (đo được
  33 440 byte khi chạy riêng, 208 492 khi chạy cả bộ); và **không node nào** bị
  store Pascal dọn đi trong im lặng.

  49 bài đơn vị của màn vẫn canh máy trạng thái, bảy trạng thái, tiếng Việt, khả
  năng tiếp cận và vòng đời — chúng không canh khung hình, và không cần canh.
- **Không có lối vào trên giao diện, và đó là quyết định chứ không phải bỏ sót.**
  Đường duy nhất để cắm một liên kết vào màn 3D cũ là khe `inspectorSections`, mà khe ấy đi qua
  `Viewer3DPanels` — nơi bài kiểm khẳng định **đúng ba bảng phụ loại trừ nhau**
  (`Viewer3DPanels.test.tsx:188-234`). Thêm mục thứ tư là phá một bất biến thật của màn cũ để đổi
  lấy một phím tắt.
  Và bản thân cờ đã là cơ chế mở dần: máy chủ quyết ai thấy màn này theo vai. Một liên kết cố định
  sẽ hoặc hiện cho người chưa được bật (rồi dẫn tới trạng thái "chưa bật"), hoặc phải tự đọc cờ lần
  nữa — tức chép lại quyết định đã nằm ở chỗ khác.
  Nên hiện tại vào bằng đường dẫn. Khi nào chốt đưa màn này thành màn chính thì lối vào đi cùng
  quyết định ấy, không đi trước nó.
- **Chiều cao đồ đạc là số danh nghĩa, không phải số đo.** Đồ thị của AppFront
  chưa lưu chiều cao đồ đạc, nên `toPascal.ts` giữ một bảng theo loại (bàn 750
  mm, tủ áo 2 000 mm, …). Cái thang là ngoại lệ: nó lấy chiều cao tầng thật, vì
  số ấy đồ thị CÓ lưu. Số danh nghĩa không bao giờ đi ngược về bản vẽ — lượt về
  dựng lại hộp bao từ siêu dữ liệu và chỉ đọc bề rộng với bề sâu.
