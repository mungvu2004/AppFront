# Sổ lỗi sản phẩm — AppFront

Mỗi lỗi một mục. Mỗi mục **tái hiện được bằng tay và bằng máy** (một bài e2e), và mang
**trạng thái** để biết đã sửa chưa. Sổ này là nơi duy nhất ghi trạng thái lỗi; mục 9 của
`plan.md` là bản ghi lịch sử lúc lập kế hoạch.

## Trạng thái

| Trạng thái | Nghĩa | Bài e2e tái hiện ở dạng |
|---|---|---|
| `mở` | dựng lại được, chưa sửa | `test.fixme(...)` — kèm lý do + điều kiện mở lại |
| `đã sửa` | gốc đã chữa, có commit | `test(...)` xanh — từ đây nó là bài chặn hồi quy |
| `không phải lỗi` | dựng lại thì hành vi đúng / ghi chú cũ hiểu nhầm | không cần bài; ghi phép đo đã bác nó |
| `ngoài FE` | gốc nằm ở BE / bộ mẫu dev / hạ tầng | bài ghi nhận nếu có; nói rõ chủ |
| `chờ quyết` | sửa được nhưng đổi hành vi sản phẩm — cần người duyệt | `test.fixme(...)` |

Quy tắc: **chuyển `mở` → `đã sửa` chỉ khi** bài e2e tái hiện đổi từ `test.fixme` sang
`test` và chạy xanh, và mục ghi hash commit. Bài phải đỏ trên mã trước khi sửa — đã kiểm
bằng cách tạm bật/hoàn tác bản sửa, và ghi rằng đã kiểm.

## Khuôn một mục

```
### B-<nhóm>-<số> · <một dòng: người dùng thấy gì sai>

- **Trạng thái:** mở | đã sửa (`<hash>`) | không phải lỗi | ngoài FE | chờ quyết
- **Mức:** cao | trung bình | thấp — <vì sao: người dùng mất gì>
- **Bất biến vi phạm:** A<n> (CLAUDE.md) hoặc "—"
- **Phát hiện:** <ngày> · <bởi gì: bộ dò / spec / đọc mã>
- **Tái hiện bằng tay:**
  1. <bước>
  2. <bước>
  - Kỳ vọng: <...>
  - Thực tế: <...>
- **Tái hiện bằng máy:** `<tệp spec>` › "<tên bài>"
  `E2E_PORT=5181 E2E_SKIP_PASCAL=1 pnpm e2e <tệp spec> -g "<một mảnh tên bài, KHÔNG có |>"`
- **Gốc:** `<tệp>:<dòng>` — <cơ chế, một hai câu>
- **Sửa:** <tệp đã đổi> · bài đơn vị `<tệp test>` · commit `<hash>` — hoặc "chưa"
```

Nhóm: `G` (toàn cục), `V1`…`V12` theo `plan.md` mục 8.

---

## Tổng

| Trạng thái | Số mục |
|---|---|
| đã sửa | 77 |
| chờ quyết | 20 |
| không phải lỗi | 22 |
| ngoài FE | 8 |
| mở | 2 |
| **cộng** | **129** |

## Mục lục

| Mã | Lỗi | Trạng thái | Mức | Nguồn |
|---|---|---|---|---|
| B-G-01 | Từ màn 404 bấm "về danh sách dự án" thì bảng điều khiển đổ | đã sửa | cao | W01 |
| B-G-02 | `Escape` ở `/thong-bao` mở trực tiếp đưa trình duyệt ra `about:blank` | đã sửa | cao | W02 |
| B-G-03 | Mọi trang xin `/favicon.ico` và nhận 404 | đã sửa | thấp | W01 |
| B-G-04 | Lúc tải route, màn hiện chữ tiếng Anh `Loading...` | đã sửa | trung bình | W01 |
| B-G-05 | Màn đo gọi `/api/projects/:id/measurements` → 404 ở môi trường dev | đã sửa | thấp | W07 |
| B-G-06 | `/thong-bao` mở luồng SSE `/api/streams/notifications` → 404 ở môi trường dev | ngoài FE | thấp | W02 |
| B-G-07 | Mọi lượt lưu lớp không gian lên máy chủ thật trả 405 — FE gửi PATCH, BE chỉ có PUT | đã sửa | cao | W04 |
| B-V1-01 | Mở thẳng một đường chết rồi bấm "quay lại" thì bị đưa ra khỏi ứng dụng | đã sửa | cao | W01 |
| B-V1-02 | Đăng nhập với `?next=/login` bỏ người dùng lại trước biểu mẫu trống; `/\evil` lọt bộ lọc đích | đã sửa | trung bình | W01 |
| B-V1-03 | Bản điện thoại `/m/du-an/:projectId` luôn nói "chưa có mô hình để xem" | chờ quyết | cao | W01 |
| B-V1-04 | Cờ "đã xem màn chào" được ghi mà không ai đọc — mở lại `/onboarding` vẫn là màn chào | chờ quyết | thấp | W01 |
| B-V1-05 | Màn "không có quyền" `/khong-co-quyen` không ai dẫn tới | chờ quyết | trung bình | W01 |
| B-V1-06 | Nhãn login/onboarding viết hoa đầu câu, ba màn hệ thống viết thường hoàn toàn | chờ quyết | thấp | W01 |
| B-V1-07 | `/login/invitation/*` và `/login/reset-password/*` ra màn 404 | không phải lỗi | — | W01 |
| B-V1-08 | `role="status"` rỗng và 404 trên màn không có quyền | không phải lỗi | — | W01 |
| B-V1-09 | Chữ nhân đôi trong `textContent` của nút ("Đăng nhậpĐăng nhập") | không phải lỗi | — | W01 |
| B-V1-10 | Canvas của bản điện thoại không có mốc neo | không phải lỗi | — | W01 |
| B-V2-01 | Tour hướng dẫn không hiện khi người dùng lần đầu mở màn; nó bật lên giữa chừng ở cú bấm/resize sau | đã sửa | cao | W02 |
| B-V2-02 | Sau "Đánh dấu tất cả đã đọc", trình đọc màn hình nghe "không có thông báo nào" trong khi danh sách vẫn còn | đã sửa | trung bình | W02 |
| B-V2-03 | Tấm trượt thông báo là một "hộp thoại" không tên | đã sửa | trung bình | W02 |
| B-V2-04 | Bấm một thông báo ở `/thong-bao` đưa người dùng về danh sách dự án thay vì màn của thông báo | đã sửa | cao | W02 |
| B-V2-05 | Chip "xem hướng dẫn" che nút của màn chủ ("chia sẻ", "Góc nhìn sẵn") | đã sửa | trung bình | W02 |
| B-V2-06 | "Đánh dấu tất cả đã đọc" không có toast/Hoàn tác | chờ quyết | thấp | W02 |
| B-V3-01 | Bảng điều khiển đọc trạng thái màn bằng tiếng Anh cho trình đọc màn hình | đã sửa | trung bình | W02 |
| B-V3-02 | Mở lại hộp thoại tạo dự án thì nó đứng ở bước 3 với dự án vừa tạo; "bỏ thay đổi" không bỏ gì | đã sửa | cao | W02 |
| B-V3-03 | Ô đổi tên dự án tại chỗ không có tên truy cập | đã sửa | thấp | W02 |
| B-V3-04 | Hộp thoại chia sẻ mở ra đã ở lỗi "thao tác chia sẻ đã bị huỷ" dù máy chủ khoẻ | đã sửa | cao | W02 |
| B-V3-05 | Xoá dự án xong, danh sách dự án không báo gì (F4) | đã sửa | trung bình | W02 |
| B-V3-06 | "Thu hồi" liên kết chia sẻ gửi ngay, không hỏi (F2) | đã sửa | cao | W02 |
| B-V3-07 | Mọi toast của hộp thoại chia sẻ câm trên route thật (gồm Hoàn tác của "đổi quyền") | đã sửa | trung bình | W02 |
| B-V3-08 | Nút chuông "Thông báo" ở danh sách dự án không làm gì | chờ quyết | trung bình | W02 |
| B-V3-09 | Mỗi lượt tải `/export` đọc danh sách liên kết chia sẻ dù hộp thoại đóng | đã sửa | thấp | W02 |
| B-V4-01 | Màn xử lý luôn "Chưa có bước nào để theo dõi", dù dự án có bản vẽ | đã sửa | cao | W03 |
| B-V4-02 | "Tiếp tục xử lý" đi tiếp dù ô xác nhận mức Kém chưa tích | đã sửa | trung bình | W03 |
| B-V4-03 | Hoàn tác xoá một bản vẽ đã gắn trả thẻ về "chờ xử lý" mãi | đã sửa | trung bình | W03 |
| B-V4-04 | "Bắt đầu xử lý" cho qua tầng có tệp chưa tải xong (PDF chưa chọn trang, tệp hỏng) | đã sửa | cao | W03 |
| B-V4-05 | Hoàn tác "Tự động nắn" chỉ trả một nửa: bộ đếm "còn lại" lệch | đã sửa | thấp | W03 |
| B-V4-06 | Tệp `.dwg` kéo thả vào qua được kiểm tra nhưng bộ mẫu dev không trả 422 | ngoài FE | thấp | W03 |
| B-V4-07 | Menu thẻ tải lên không nói mở/đóng, và mở ra bảng rỗng ở tầng có bản vẽ sẵn | đã sửa | thấp | W03 |
| B-V4-08 | Bản vẽ vừa tải lên không hiện ở màn xử lý trên môi trường dev | ngoài FE | thấp | W03 |
| B-V4-09 | A9 và xác nhận inline ở "Huỷ xử lý" / "Bỏ qua tầng đó" | chờ quyết | thấp | W03 |
| B-V4-10 | Màn xử lý mở luồng SSE `/api/streams/projects/:id/uploads/:uploadId/progress` → 404 ở dev | ngoài FE | thấp | W03 |
| B-V4-11 | Bấm "Hoàn tác" xong, toast ở lại mãi và che nút chính | đã sửa | trung bình | W03 |
| B-V5-01 | "Áp dụng tỷ lệ" bấm không làm gì, không nói gì | đã sửa | cao | W12 |
| B-V5-02 | Tỷ lệ chỉ sống trong phiên, "Tỷ lệ hiện tại" đổi ngay khi gõ | ngoài FE | thấp | W03 |
| B-V5-03 | Sơ đồ xử lý khẳng định "mỗi tầng đang đi một nhánh khác nhau" khi chưa có dữ liệu nào | đã sửa | thấp | W03 |
| B-V5-04 | Tầng không có trong dự án bị báo "Nắn ảnh thất bại" | đã sửa | thấp | W03 |
| B-V5-05 | Hai quy ước số trên màn tỷ lệ (`4.800 mm` và `1600,00`) | không phải lỗi | — | W03 |
| B-V5-06 | Tên phím viết hai kiểu (`ESCAPE` ở dòng nhắc, `Esc` ở ô phím) | không phải lỗi | — | W03 |
| B-V5-07 | Người xem bấm "Vẫn dùng AI" vẫn được đưa sang màn xử lý | không phải lỗi | — | W03 |
| B-V5-08 | `h1` màn nền và `h2` hộp thoại cùng chữ "Phát hiện tệp CAD" | không phải lỗi | — | W03 |
| B-V5-09 | Người xem vẫn thấy nút "Đo lại" ở màn tỷ lệ | không phải lỗi | — | W03 |
| B-V5-10 | `projectScale` với `L1` mở thẳng ra `error` | không phải lỗi | — | W03 |
| B-V6-01 | Bảy màn QC treo skeleton / rỗng vĩnh viễn — cổng đọc lại chính cái kho rỗng | đã sửa | cao | W11 |
| B-V6-02 | Toast xoá tường lộ mã máy `W-000001WALL` trong khi danh sách gọi nó `#W-001` | đã sửa | trung bình | W04 |
| B-V6-03 | Màn QC không bao giờ tự lưu; "Có thay đổi chưa lưu" ở lại mãi | đã sửa | cao | W11 |
| B-V6-04 | Nhãn A6 không nhất quán trong nhóm: "Ẩn lớp Tường" viết hoa giữa câu | chờ quyết | thấp | W04 |
| B-V6-05 | Ghi chú lớp 1 ghi "NOT FOUND" cho ba chuỗi có thật (P4) | không phải lỗi | — | W04 |
| B-V6-06 | Vùng trạng thái biến mất sau `Ctrl+Z` ở màn kích thước (F6/P7) | không phải lỗi | — | W04 |
| B-V6-07 | Mô tả ảnh nền "Bản vẽ gốc của L-000001LVL0" lộ mã tầng | không phải lỗi | — | W04 |
| B-V6-08 | Ray công cụ 3D quảng cáo phím R·H·C·V mà không phím nào chạy | đã sửa | trung bình | W04 |
| B-V6-09 | Nhãn mã của màn QC trùng nhau với id của BE (ULID) và id bộ mẫu A14 | đã sửa | cao | W11 |
| B-V6-10 | Màn đối tượng: ba nút "chọn nhóm" bị khoá cho tới khi đã chọn một nhóm bằng bàn phím | đã sửa | trung bình | W04 |
| B-V6-11 | Màn tường: Escape không bỏ chọn, không bỏ nét đang vẽ dở | đã sửa | trung bình | W04 |
| B-V6-12 | Ray công cụ tường/đối tượng không nói công cụ nào đang bật (`aria-pressed` vắng) | đã sửa | thấp | W11 |
| B-V6-13 | Màn đối tượng chỉ hiện đối tượng có trong bảng mẫu cứng; dữ liệu thật vô hình | chờ quyết | cao | W04 |
| B-V6-14 | Màn trục sẽ luôn rỗng trên BE thật — N16 v1 trả `axes: []` | ngoài FE | trung bình | W04 |
| B-V7-01 | Phòng và độ dày tự lưu mà câm | đã sửa | trung bình | W11 |
| B-V7-02 | Lưu thất bại thì câu báo bảo "lưu lại thủ công" — mà không có nút lưu nào | đã sửa | trung bình | W05 |
| B-V7-03 | Mở lại hộp thoại "Gộp hai phòng" ở phòng khác thì ứng viên cũ vẫn được chọn ngầm, nút xác nhận bật | đã sửa | trung bình | W05 |
| B-V7-04 | Ctrl+Z ngay sau khi dữ liệu nạp vào làm màn trống trơn | đã sửa | trung bình | W05 |
| B-V7-05 | Toast đổi tên phòng lộ mã máy `R-000001ROOM`, trong khi danh sách gọi phòng ấy là `#R-001` | mở | thấp | W05 |
| B-V7-06 | Ctrl+Z trong ô "Tên phòng" không hoàn tác lượt đổi tên | không phải lỗi | — | W05 |
| B-V7-07 | "Áp dụng" chuẩn hoá độ dày không đổi gì | không phải lỗi | — | W05 |
| B-V7-08 | Lệnh phòng bị từ chối (gộp, đổi tên trùng…) thì không một chữ nào — bấm xác nhận và không thấy gì xảy ra | đã sửa | cao | W05 |
| B-V7-09 | Hoàn tác đổi tên bằng toast thì phòng bị bỏ chọn, thanh tra đóng lại | mở | thấp | W05 |
| B-V7-10 | Câu trạng thái rỗng bảo bấm "Kiểm tra vòng hở" — nút thật tên là "Kiểm tra lại vòng hở" | đã sửa | thấp | W05 |
| B-V7-11 | Ba màn QC-b chỉ có nội dung qua cửa bơm dev | đã sửa | cao | W11 |
| B-V7-12 | Lớp QC-b không có đầu ghi máy chủ | đã sửa | cao | W11 |
| B-V7-13 | `viewer3d.spec.ts` ghi màn tầng hiện "0 tầng" | không phải lỗi | — | W05 |
| B-V7-14 | Màn phòng hiện 248,60 m² — không khớp số nào của A14 | không phải lỗi | — | W05 |
| B-V7-15 | "mô hình 3d" viết thường trong câu nợ của màn tầng | không phải lỗi | — | W05 |
| B-V7-21 | Màn tầng nói "chưa có tầng nào" khi danh sách tầng có bốn tầng (bộ mẫu dev) | ngoài FE | trung bình | W11 |
| B-V7-22 | Kích thước và trục không có đường lưu nào — #35 chỉ nhận bốn danh sách | ngoài FE | cao | W11 |
| B-V8-01 | Thu phóng (cuộn chuột và nút "Phóng to") chết ở 3/4 góc nhìn 3D | đã sửa | cao | W06 |
| B-V8-02 | Nút ray tầng hiện mã máy `L-01FIXTURE0` thay cho tên tầng | đã sửa | trung bình | W06 |
| B-V8-03 | Thư viện đồ đạc khoá kéo-thả với mọi vai, kể cả admin, và nói sai lý do "vai chỉ xem" | chờ quyết | trung bình | W06 |
| B-V8-04 | Bảng diện tích và panel thuộc tính trên màn 3D kẹt "đang tải" mãi | chờ quyết | cao | W06 |
| B-V8-05 | Cùng một bức tường mang hai mã khác nhau: `W-403FI` và `W-0403FIXTURE0` | chờ quyết | thấp | W06 |
| B-V8-06 | Hai mốc trùng tên "Thanh tra đối tượng" khi có đối tượng đang chọn | đã sửa | thấp | W06 |
| B-V8-07 | Chip lọc lịch sử "AI" viết hoa | chờ quyết | thấp | W06 |
| B-V8-08 | "Hai `role=status` cùng lúc khi dựng xong" (F7) | không phải lỗi | — | W06 |
| B-V8-09 | Tour chắn cú bấm đầu trên màn 3D (F8) | không phải lỗi | — | W06 |
| B-V8-10 | Ba con số "248,60 m²" từ hai bộ mẫu; số hình học của bộ mẫu chuẩn là 238,00 (F9) | chờ quyết | thấp | W06 |
| B-V8-11 | Nút "Xong" của chế độ sửa hình học tường bấm không được — ViewCube đè lên | đã sửa | trung bình | W06 |
| B-V8-12 | Kho đổi (hay bấm "Thử lại") thì cảnh 3D chết: "Trình duyệt này chưa xem được mô hình 3D" | đã sửa | cao | W06 |
| B-V9-01 | Ba màn 3D (tách tầng, đo, đối chiếu) không có lối vào nào từ sản phẩm | đã sửa | trung bình | W07 |
| B-V9-02 | Ở dev, tách tầng và đo hiện khung nhìn rỗng (canvas 300×150, "0 tầng") trong khi `/3d` có nhà bốn tầng | đã sửa | trung bình | W07 |
| B-V9-03 | Nút "thoát chế độ đo (phím Esc)" không thoát chế độ đo | đã sửa | thấp | W07 |
| B-V9-04 | Vai Người xem đang đo mà ray công cụ không cho thấy gì | chờ quyết | thấp | W07 |
| B-V9-05 | Hai câu "không có quyền" cạnh nhau ở tách tầng viết tên vai khác nhau | chờ quyết | thấp | W07 |
| B-V9-06 | Từ `/3d` (nhà bốn tầng) sang đối chiếu, màn nói "dự án này chưa có tầng nào" | đã sửa | trung bình | W12 |
| B-V9-07 | Nhãn ray quảng cáo phím `R`/`H`/`C`/`V` nhưng không phím nào hoạt động | đã sửa | trung bình | W12 |
| B-V9-08 | Ray tầng của tách tầng và đo hiện mã bộ mẫu `L-01FIXTURE0…` | đã sửa | thấp | W12 |
| B-V10-01 | Sau `PASCAL-01`, bấm "thử lại" hay phím R không bao giờ nạp lại — kể cả khi gói đã trở lại | đã sửa | cao | W08 |
| B-V10-02 | Màn Pascal chỉ cao 384 px; khung 3D là một dải 190 px trong cửa sổ 900 px | đã sửa | trung bình | W08 |
| B-V10-03 | Cờ tắt vẫn tải và chạy bộ đổi bản vẽ sang Pascal | đã sửa | thấp | W08 |
| B-V10-04 | Bộ đổi dữ liệu nạp hỏng rồi bấm "thử lại" thì kẹt khung xương "đang nạp…" mãi | đã sửa | trung bình | W08 |
| B-V10-05 | Gói Pascal gây 1 vi phạm CSP `script-src eval`; tài liệu ghi "4 → 0" (P1 của V10) | chờ quyết | thấp | W08 |
| B-V10-06 | Bốn số Pascal không phải bộ A14; trang chỉ có tường bao + phòng (P2 của V10) | chờ quyết | thấp | W08 |
| B-V12-01 | Bốn màn luật/xuất/dữ liệu luôn rỗng khi đi bằng đường sản phẩm | chờ quyết | cao | W09 |
| B-V12-02 | Nút chính "Chạy kiểm tra" của màn luật rỗng dẫn thẳng vào màn lỗi | đã sửa | trung bình | W09 |
| B-V12-03 | Cài đặt bộ luật nói "chưa có luật nào" ngay dưới dòng "23/25 luật đang bật" | đã sửa | thấp | W09 |
| B-V12-04 | Sửa luật ở cài đặt bộ luật không có toast hoàn tác | đã sửa | trung bình | W09 |
| B-V12-05 | Bấm "xuất" không tải tệp nào về máy | đã sửa | cao | W09 |
| B-V12-06 | Link "sửa" (màn xuất) và link khắc phục (màn luật) nạp lại cả trang | đã sửa | trung bình | W09 |
| B-V12-07 | Màn dữ liệu rỗng vẫn khoe "Hợp lệ … — 0 lỗi" | đã sửa | thấp | W09 |
| B-V12-08 | "Còn 2487 dòng nữa" không có dấu nhóm nghìn | đã sửa | thấp | W09 |
| B-V12-09 | Chip "xem hướng dẫn" che nút "chia sẻ" ở màn xuất | đã sửa | trung bình | W09 |
| B-V12-10 | Màn lịch sử phiên bản không mở được bằng bất kỳ đường nào | đã sửa | cao | W09 |
| B-V12-11 | Màn cài đặt bộ luật không có lối vào trong giao diện | đã sửa | thấp | W09 |
| B-V12b-01 | Bấm "xoá" trên hàng người dùng không hỏi gì — hộp thoại xoá hẳn không bao giờ hiện | đã sửa | trung bình | W10 |
| B-V12b-02 | Khối mời người dùng không đóng bằng Esc (F11) | đã sửa | thấp | W10 |
| B-V12b-03 | Sửa hồ sơ/giao diện ở `/tai-khoan` không có toast hoàn tác (F3) | chờ quyết | trung bình | W10 |
| B-V12b-04 | Đường dẫn trang `/admin/models` viết hoa, lệch mọi màn quản trị khác (F14) | đã sửa | thấp | W10 |
| B-V12b-05 | Nhánh 403 của bộ mẫu `/admin/users` không bao giờ được gọi (F10) | không phải lỗi | — | W10 |
| B-V12b-06 | Bấm "Hoàn tác" xong toast vẫn treo, mời hoàn tác thêm lần nữa | đã sửa | trung bình | W10 |
| B-V12b-07 | Tấm "chi tiết người dùng" (bố cục rộng) không đóng bằng Esc | đã sửa | thấp | W10 |
| B-V12b-08 | Ghi chú lớp 1 thiếu (F13) | không phải lỗi | — | W10 |

---

## G — toàn cục

### B-G-01 · Từ màn 404 bấm "về danh sách dự án" thì bảng điều khiển đổ

- **Trạng thái:** đã sửa (`e63300c`) — bài tái hiện **đã kiểm đỏ trước sửa**
- **Mức:** cao — người dùng gõ sai đường, bấm lối ra duy nhất, và gặp màn lỗi
- **Bất biến vi phạm:** A11
- **Phát hiện:** 2026-10-02 · `scripts/probe-interact.mjs`
- **Tái hiện bằng tay:**
  1. Mở `/duong-khong-ton-tai-xyz`
  2. Bấm "về danh sách dự án"
  - Kỳ vọng: bảng điều khiển "Dự án của tôi"
  - Thực tế (trước khi sửa): `ProjectCardTile.tsx:149` ném `Cannot read properties of undefined (reading 'length')`
- **Tái hiện bằng máy:** `e2e/v1/exits.spec.ts` › "từ màn 404, "về danh sách dự án" dựng được bảng điều khiển, không lỗi trang"
  `… pnpm e2e e2e/v1/exits.spec.ts -g "từ màn 404,"`
- **Kiểm đỏ:** đã kiểm đỏ trước sửa — hoàn tác tạm `src/lib/query/queryKeys.ts` + `notFoundGateway.ts` về `e63300c^`: hai dòng "từ màn 404 …" đỏ, `Timed out 15000ms waiting for getByRole('heading', { name: 'Dự án của tôi' })` (bảng điều khiển đổ); dòng "màn không có quyền" vẫn xanh — đúng, nó không ghi bộ đệm ấy. Khôi phục, xanh.
- **Gốc:** một khoá bộ đệm, hai người ghi, hai hình dạng — 404 đọc `client.projects.list()`, bảng điều khiển đọc `SAMPLE_PROJECTS` có thêm `members`
- **Sửa:** `src/lib/query/queryKeys.ts`, `src/screens/system/NotFound/notFoundGateway.ts` · commit `e63300c` (lượt trước)

### B-G-02 · `Escape` ở `/thong-bao` mở trực tiếp đưa trình duyệt ra `about:blank`

- **Trạng thái:** đã sửa (`a73007b`)
- **Mức:** cao — một màn trắng do một phím gây ra
- **Bất biến vi phạm:** A11, A12
- **Phát hiện:** 2026-10-02 · `scripts/probe-interact.mjs`
- **Tái hiện bằng tay:**
  1. Mở tab mới, gõ thẳng `/thong-bao`
  2. Bấm `Escape`
  - Kỳ vọng: về bảng điều khiển, vẫn trong ứng dụng
  - Thực tế (trước khi sửa): trình duyệt ra `about:blank`
- **Tái hiện bằng máy:** `e2e/v2v3/notification-center.spec.ts` › "mở trực tiếp /thong-bao rồi Escape về
  danh sách dự án trong ứng dụng, không ra about:blank (B-G-02)"
  `E2E_PORT=5192 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v2v3/notification-center.spec.ts -g "B-G-02"`
  — **đã kiểm đỏ trước sửa** (gỡ tạm `a73007b`): `Expected: "/"  Received: "blank"`.
- **Gốc:** `onDismiss` gọi `navigate(-1)` mù; mở trực tiếp thì không có mục lịch sử phía trước
- **Sửa:** `NotificationCenter.container.tsx` hỏi `location.key` · commit `a73007b`

### B-G-03 · Mọi trang xin `/favicon.ico` và nhận 404

- **Trạng thái:** đã sửa (`3d76821`) — **đã kiểm đỏ trước sửa**
- **Mức:** thấp — người dùng không thấy; nhưng mọi bài "console sạch" phải lọc riêng nó
- **Bất biến vi phạm:** —
- **Phát hiện:** 2026-09-30 · CDP Network; đo lại 2026-10-03 bằng lượt dò tạm: `Failed to load resource: … 404 @ http://127.0.0.1:5191/favicon.ico`
- **Tái hiện bằng tay:** mở bất kỳ trang nào, DevTools › Network: `favicon.ico` 404
- **Tái hiện bằng máy:** `e2e/smoke-grid.spec.ts` — bộ lọc `isFavicon` đã GỠ, nên lưới nay là bài tái hiện: một `console.error` favicon làm đỏ dòng đầu tiên của mỗi tiến trình trình duyệt
  `… pnpm e2e e2e/smoke-grid.spec.ts`
- **Kiểm đỏ:** đã kiểm đỏ trước sửa — `index.html` về `1abfb22`, lưới không còn bộ lọc: 3 dòng đỏ (`accessDenied`, `projectPipeline`, `projectGrids`), mỗi dòng đúng MỘT lỗi console `Failed to load resource: … 404 … /favicon.ico`, không lỗi nào khác. Chỉ vài dòng đỏ chứ không cả 35 vì trình duyệt xin favicon một lần cho mỗi tiến trình — dòng nào chạy đầu ở một worker thì gánh. Khôi phục, 36/36 xanh.
- **Gốc:** `index.html` không có `<link rel="icon">` (questions.md Q10i)
- **Sửa:** `index.html` — `<link rel="icon" href="data:," />`: biểu tượng rỗng, trình duyệt thôi xin, không tệp nào phải phục vụ (repo không có `public/`). Biểu tượng thương hiệu thật là việc thiết kế — khi có thì chỉ đổi `href`. Không bài đơn vị: không có mã nào ngoài một thẻ HTML; lưới e2e là bài kiểm · commit `3d76821`

### B-G-04 · Lúc tải route, màn hiện chữ tiếng Anh `Loading...`

- **Trạng thái:** đã sửa (`3d76821`) — **đã kiểm đỏ trước sửa**
- **Mức:** trung bình — chữ tiếng Anh trên màn sản phẩm (A6), một dòng chữ ở góc màn trống thay cho trạng thái chờ (A11)
- **Bất biến vi phạm:** A6, A11
- **Phát hiện:** 2026-10-02 · đọc mã
- **Tái hiện bằng tay:** DevTools › Network › Slow 3G, mở `/duong-khong-ton-tai-xyz`, bấm "về danh sách dự án" — trước sửa: `Loading...` ở góc trên
- **Tái hiện bằng máy:** `e2e/v1/route-fallback.spec.ts` › "chuyển sang màn chưa tải: vỏ chờ tiếng Việt, không có "Loading...", rồi màn hiện ra"
  `… pnpm e2e e2e/v1/route-fallback.spec.ts`
- **Kiểm đỏ:** đã kiểm đỏ trước sửa — `router.tsx` + `SessionBootstrap.tsx` về `1abfb22`: `Timed out 5000ms waiting for getByRole('status', { name: 'đang tải màn hình' })`. Khôi phục, xanh.
- **Gốc:** `src/routes/router.tsx:22` — `fallback={<div>Loading...</div>}`
- **Sửa:** `src/routes/router.tsx` dùng `<PendingShell label="đang tải màn hình" />` — đúng khối chờ của `SessionGate` (`role="status"`, `aria-busy`, khung xương), tách thành `PendingShell` trong `src/routes/SessionBootstrap.tsx`; nó đã nằm trong chunk vào nên không thêm byte vào đường tải đầu. `router.tsx` xuất thêm mảng `routes` cho bài đơn vị · bài đơn vị `src/routes/router.test.tsx` › "[router] vỏ chờ lúc chunk màn còn trên đường (B-G-04)" — đỏ trên mã cũ, xanh sau sửa · commit `3d76821`

### B-G-05 · Màn đo gọi `/api/projects/:id/measurements` → 404 ở môi trường dev

- **Trạng thái:** đã sửa (`9378e2d`)
- **Mức:** thấp — chỉ dev/mock; nhưng màn đo ở dev luôn `error` và không ghim được gì, nên mọi ca
  ghim/xoá/hoàn tác của e2e bị chặn
- **Bất biến vi phạm:** A11 (màn đo luôn ở trạng thái lỗi, dù không có lỗi thật)
- **Phát hiện:** 2026-10-02 · `e2e/smoke-grid.spec.ts`
- **Lỗi FE hay bộ mẫu thiếu?** **Lỗi FE.** Bộ mẫu không thiếu gì cho `ApiClient`; chỗ đứt là
  `createAppHttpClient()` (`src/api/appClient.ts:101`) — nơi mà docblock tự nhận "the one place the
  mock-vs-real decision get made" — **không** xét chế độ mock: luôn `fetch` thật. Cổng đo đi qua nó
  (`measurementToolGateway.ts:734`, mutation `lib/mutations/measurement.ts:104,168`), nên cả đọc lẫn
  ghi rơi ra máy chủ Vite. Cùng gốc với `shareDialogGateway.ts:73` (không đổi hành vi ở đó).
- **Tái hiện bằng tay:**
  1. `VITE_USE_MOCK_API=true pnpm dev`, mở `/projects/project-1/3d/measure`
  - Kỳ vọng: mục "Phép đo" ghi `0 phép đo`, câu rỗng, không lỗi
  - Thực tế (trước khi sửa): `Chưa tải được danh sách phép đo của dự án. …`, Network: `measurements` 404
- **Tái hiện bằng máy:** `e2e/v9/measure.spec.ts` › "danh sách phép đo tải được ở dev"
  `E2E_PORT=5197 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v9/measure.spec.ts -g "danh sách phép đo tải được"`
  — **đã kiểm đỏ trước sửa**. Cộng: `e2e/v9/measure.spec.ts` › "ghim một phép đo, xoá nó, rồi Hoàn tác".
- **Gốc:** `src/api/appClient.ts:124` (trước sửa) — `fetchImpl` gọi `requirePlatformFetch` bất kể
  `resolveUseMockApi()`.
- **Sửa:** `src/api/__mocks__/client.ts` thêm `createMockHttpTransport(next)` theo khuôn
  `createMockAuthTransport` — trả lời GET/POST/DELETE của `ENDPOINTS.measurements` từ bộ nhớ, đường
  khác đi tiếp `next` (mạng) nên mọi nơi gọi khác giữ hành vi; `appClient.ts` chọn nó khi mock. Không
  mô phỏng 409 trùng mã (thêm khi cần ca hoà giải hoàn tác). Bài đơn vị
  `src/api/__tests__/appClient.test.ts` (2 bài mới). `e2e/smoke-grid.spec.ts` dòng `projectMeasure`
  bỏ `expectedConsole`. Commit `9378e2d`.

### B-G-06 · `/thong-bao` mở luồng SSE `/api/streams/notifications` → 404 ở môi trường dev

- **Trạng thái:** ngoài FE — chủ: bộ mẫu dev (`src/api/__mocks__`) / BE
- **Mức:** thấp — người dùng không thấy; một dòng console ở dev
- **Bất biến vi phạm:** —
- **Phát hiện:** 2026-10-02 · bộ dò 35 màn
- **Tái hiện bằng tay:** `pnpm dev` (mock), mở `/thong-bao`, DevTools › Network: `streams/notifications` 404
- **Tái hiện bằng máy:** `e2e/smoke-grid.spec.ts` › "màn notifications" — dòng `expectedConsole`
- **Gốc (đã đọc tới cùng):** FE đúng hợp đồng. `notificationCenterGateway.ts:304-322` mở
  `createEventChannel` (một `EventSource`) tới `toApiUrl(resolveApiBaseUrl(), ENDPOINTS.streams.notifications())`
  — đường có thật ở BE (`endpoints.ts:211-223`, "Hai luồng SSE của BE … B4-01"). Bộ mẫu dev là một
  `ApiClient` hỏi-đáp trong bộ nhớ (`appClient.ts:150-157`, `createMockApiClient`); `EventSource` không đi qua
  client nào (`client.ts:579`), nên ở chế độ mock nó ra thẳng máy chủ Vite và nhận 404. **Repo không có
  khuôn nào cho luồng ở bộ mẫu**: luồng còn lại (`ProcessingScreen`, `processingGateway.ts:663`) cũng mở
  `EventSource` thật — không có bản giả `EventSource`, không MSW. Thêm một khuôn luồng giả là việc hạ tầng
  mới, không phải sửa lỗi ⇒ không làm. Kênh tự lùi theo cấp số nhân nên không vòng 404 dày.
- **Sửa:** không (ngoài FE). Khi bộ mẫu có khuôn luồng: gỡ `expectedConsole` của dòng `notifications`.

### B-G-07 · Mọi lượt lưu lớp không gian lên máy chủ thật trả 405 — FE gửi PATCH, BE chỉ có PUT

- **Trạng thái:** đã sửa (`4da7d91`)
- **Mức:** cao — trên BE thật không lượt tự lưu nào của lớp không gian thành công
- **Bất biến vi phạm:** A7
- **Phát hiện:** 2026-10-03 · điều phối viên đối chiếu repo BE (`apps/api/spatial_write/router.py:45`)
- **Tái hiện bằng tay:** không làm được trên máy chủ dev (mock trong tiến trình, không có HTTP)
- **Tái hiện bằng máy:** bài ĐƠN VỊ `src/api/__tests__/client.test.ts` › "writeLayer PUTs {baseVersion, body:
  {layer}}…" — e2e không thấy động từ HTTP của mock trong tiến trình. Đã kiểm đỏ trước sửa (client cũ:
  `http.patch` được gọi).
- **Gốc:** `src/api/client.ts` `writeLayer` = `callPatch(…, body)` trần lớp. BE #35: `PUT`, thân
  `{baseVersion, body: {layer?, scaleMillimetresPerPixel?}}` (`spatial_write/schemas.py:61-87`), trả
  `{revision, layer}`; thiếu `baseVersion` → 428. FE đã có `FloorLayerWriteSchema`/`…ResultSchema` khớp,
  chưa ai dùng.
- **Sửa:** `writeLayer` → `PUT {baseVersion, body:{layer}}`, giải mã `FloorLayerWriteResultSchema`;
  `WriteSpatialLayerInput.baseVersion` bắt buộc; `spatialLayerSave` mang `baseVersion`; PropertyInspector lấy
  `baseVersion` từ N16 ở lượt đầu, từ `revision` vừa ghi ở lượt sau (`ponytail:` lượt đầu không thấy một lượt
  sửa của người khác xảy ra trước nó) · bài `client.test.ts`, `spatial.test.ts`, `spatialLayerSave.test.ts`,
  `propertyInspectorGateway.revision.test.ts` · commit `4da7d91`

## V1

### B-V1-01 · Mở thẳng một đường chết rồi bấm "quay lại" thì bị đưa ra khỏi ứng dụng

- **Trạng thái:** đã sửa (`958614a`) — **đã kiểm đỏ trước sửa**
- **Mức:** cao — người theo một liên kết cũ bấm lối ra hiển nhiên nhất và rời ứng dụng; cùng lớp lỗi với B-G-02
- **Bất biến vi phạm:** A11 (màn trắng), A12
- **Phát hiện:** 2026-10-03 · đọc mã (`navigate(-1)` mù — đúng khuôn đã chữa ở `a73007b`), vòng Tester
- **Tái hiện bằng tay:**
  1. Mở tab mới, gõ thẳng `/duong-khong-ton-tai-xyz`
  2. Bấm "quay lại"
  - Kỳ vọng: vẫn trong ứng dụng — về danh sách dự án
  - Thực tế (trước sửa): URL rời ứng dụng — bài đỏ `Timed out 15000ms waiting for getByRole('heading', { name: 'Dự án của tôi' })` khi `useNotFound.ts` về `1abfb22`; **đã kiểm đỏ trước sửa**, khôi phục xanh
- **Tái hiện bằng máy:** `e2e/v1/exits.spec.ts` › "mở thẳng một đường chết rồi bấm "quay lại" thì về danh sách dự án, không ra khỏi ứng dụng (B-V1-01)"
  `… pnpm e2e e2e/v1/exits.spec.ts -g "quay lại"`
- **Gốc:** `src/screens/system/NotFound/useNotFound.ts:288` — `navigate(-1)` không hỏi có mục lịch sử nào của ứng dụng phía trước
- **Sửa:** `useNotFound.ts` — `location.key === 'default'` (mục lịch sử đầu tiên của router) ⇒ `navigate(ROUTES.dashboard, { replace: true })`; còn lại lùi như cũ · bài đơn vị `src/screens/system/NotFound/useNotFound.test.tsx` (2 bài: không lịch sử → danh sách dự án, đỏ trên mã cũ; có màn trước → lùi về đó) · commit `958614a`

### B-V1-02 · Đăng nhập với `?next=/login` bỏ người dùng lại trước biểu mẫu trống; `/\evil` lọt bộ lọc đích

- **Trạng thái:** đã sửa (`89c5009`) — **đã kiểm đỏ trước sửa**
- **Mức:** trung bình — người vừa đăng nhập đúng vẫn đứng ở màn đăng nhập trống, không biết đã vào chưa; và bộ lọc chống chuyển hướng mở chỉ an toàn nhờ may
- **Bất biến vi phạm:** — (bảo mật: chuyển hướng mở — hôm nay chưa khai thác được, xem Gốc)
- **Phát hiện:** 2026-09-30 · kế hoạch mục 9 phát hiện 3; cơ chế `\` điều tra 2026-10-03
- **Tái hiện bằng tay:**
  1. Mở `/login?next=%2Flogin`, đăng nhập `engineer@example.com` / `matkhau-du-dai`
  - Kỳ vọng: danh sách dự án
  - Thực tế (trước sửa): URL cuối `/login`, biểu mẫu trống (bài đỏ: `Expected "/" · Received "/login"`); ca gạch ngược hạ cánh `/tai-khoan` (`Received "/tai-khoan"`) — host `evil.example` bị react-router vứt âm thầm. **Đã kiểm đỏ trước sửa** (`AuthScreen.container.tsx` về `1abfb22`), khôi phục xanh
- **Tái hiện bằng máy:** `e2e/auth/login.spec.ts` › "đăng nhập với đích không an toàn (chính màn đăng nhập) rơi về danh sách dự án, không rời khỏi trang" và "đích có dấu gạch ngược sau gạch chéo bị từ chối: về danh sách dự án, cùng origin"
  `… pnpm e2e e2e/auth/login.spec.ts -g "chính màn đăng nhập"`
- **Gốc:** `src/screens/auth/AuthScreen/AuthScreen.container.tsx:105-111` — `safeDestination` chỉ thử `startsWith('/') && !startsWith('//')`. Nó nhận `/login`, và nhận `/\evil.example`, `/<tab>/evil.example` — hai chuỗi `URL` của trình duyệt đọc thành host `evil.example`. Hôm nay vô hại chỉ vì `@remix-run/router` dựng lại bằng `new URL(href, origin)` rồi giữ phần đường dẫn (`router.js:414-425`, `:1774`)
- **Sửa:** `safeDestination` phân tích bằng `URL` trên một gốc giả; khác origin, không phân tích được, hoặc chính `/login` (không phân biệt hoa thường, bỏ gạch chéo cuối, sau khi giải `..`) ⇒ danh sách dự án; đường hợp lệ giữ nguyên query + hash · bài đơn vị `AuthScreen.test.tsx` › "safeDestination — never off this origin, never back onto the sign-in page" (13 bài; 5 đỏ trên mã cũ: `\`, tab, `/login`, `/LOGIN/`, `/tai-khoan/../login`) · commit `89c5009`

### B-V1-03 · Bản điện thoại `/m/du-an/:projectId` luôn nói "chưa có mô hình để xem"

- **Trạng thái:** chờ quyết
- **Mức:** cao — bản điện thoại hôm nay không xem được dự án nào; người nhận liên kết chia sẻ trên điện thoại đọc một câu sai về một dự án có mô hình
- **Bất biến vi phạm:** A11 (trạng thái `empty` nói sai sự thật)
- **Phát hiện:** 2026-09-30 · kế hoạch mục 9 phát hiện 1; đo lại 2026-10-03 (lượt dò tạm, 390×844): thân màn "chưa có mô hình để xem | dự án này chưa có bản dựng 3D nào để mở trên điện thoại."
- **Tái hiện bằng tay:** khung 390×844, mở `/m/du-an/project-1` — tên "Chung cư Hoàng Anh" hiện, thân màn là trạng thái rỗng
- **Tái hiện bằng máy:** `e2e/v1/mobile-viewer.spec.ts` › `test.fixme` "mở bản điện thoại của một dự án có mô hình thì thấy mô hình, không thấy "chưa có mô hình để xem""
  `… pnpm e2e e2e/v1/mobile-viewer.spec.ts`
- **Kiểm đỏ đúng lý do:** tạm đổi `test.fixme` → `test`: đỏ ĐÚNG lý do — `getByText('chưa có mô hình để xem')` `Expected: 0 · Received: 1` sau khi `h1` đã là tên dự án thật (không đỏ vì hạn chờ hay mốc sai). Trả lại `fixme`.
- **Gốc:** `MobileViewer.container.tsx:129-141` chỉ truyền `projectId` + `roles`; hình học đọc từ `store.spatial` (`useMobileViewer.ts:249-250`), không gì trên đường này nạp nó, không request hình học nào. Đơn vị xanh vì tiêm `spatial` thẳng
- **Sửa:** chưa — **vì sao chờ quyết:** chọn đường nạp hình học (nguồn nào, khoá bộ đệm nào, ai ghi `store.spatial`) là quyết định kiến trúc dữ liệu, cùng gốc với bảy màn QC (Q1 = A′)

### B-V1-04 · Cờ "đã xem màn chào" được ghi mà không ai đọc — mở lại `/onboarding` vẫn là màn chào

- **Trạng thái:** chờ quyết
- **Mức:** thấp — không chặn ai; nhưng một cờ ghi mà không đọc là một lời hứa ("lần sau không hiện nữa") không được giữ
- **Bất biến vi phạm:** —
- **Phát hiện:** 2026-10-03 · vòng Tester (đọc mã) + lượt dò tạm: sau "Bỏ qua" có khoá `appfront:onboarding-welcome-seen:user-mock`; `goto('/onboarding')` lần hai ⇒ vẫn `/onboarding`
- **Tái hiện bằng tay:** mở `/onboarding`, bấm "Bỏ qua", gõ lại `/onboarding` — màn chào hiện lại
- **Tái hiện bằng máy:** `e2e/v1/onboarding.spec.ts` › `test.fixme` "đã "Bỏ qua" rồi thì mở lại /onboarding không thấy lại màn chào"
  `… pnpm e2e e2e/v1/onboarding.spec.ts`
- **Kiểm đỏ đúng lý do:** tạm đổi `test.fixme` → `test`: đỏ ĐÚNG lý do — lần mở lại `/onboarding` không có tiêu đề "Dự án của tôi" (`Timed out 15000ms … toBeVisible`), tức vẫn là màn chào. Trả lại `fixme`.
- **Gốc:** `useWelcomeScreen.ts:159` ghi; `readWelcomeSeen` (`useWelcomeScreen.ts:175`) chỉ được xuất (`index.ts:43`), không nơi nào gọi; và không route nào đưa người dùng mới tới `/onboarding`
- **Sửa:** chưa — **vì sao chờ quyết:** hành vi đúng chưa ai chốt (chuyển về `/`? màn chào rút gọn? ai dẫn người dùng MỚI tới đây sau lần đăng nhập đầu?) — đổi luồng sản phẩm

### B-V1-05 · Màn "không có quyền" `/khong-co-quyen` không ai dẫn tới

- **Trạng thái:** chờ quyết
- **Mức:** trung bình — một 403 thật hôm nay không đưa người dùng tới màn được dựng riêng để giải thích 403
- **Bất biến vi phạm:** —
- **Phát hiện:** 2026-09-30 · kế hoạch mục 9 phát hiện 2; đo lại 2026-10-03: `grep ROUTES.accessDenied` trong `src/` ngoài test = 0
- **Tái hiện bằng tay:** không có cú bấm nào dẫn tới màn — đó chính là lỗi
- **Tái hiện bằng máy:** **không lập `test.fixme`**. Lý do: bộ mẫu API chạy TRONG trang (`src/api/__mocks__/client.ts`), không có request mạng nào để `page.route` trả 403; và chỗ nào phải chuyển sang màn này (403 khi đọc dự án? khi mở liên kết chia sẻ?) chưa ai chốt, nên không viết được kỳ vọng. Hai lối ra của màn đã có bài trong `exits.spec.ts`
- **Gốc:** không nơi nào trong `src/` gọi `ROUTES.accessDenied`; phần hợp đồng máy chủ còn thiếu (mã lý do 403) ghi ở `docs/prompt-logic-S44-thieu.md`
- **Sửa:** chưa — **vì sao chờ quyết:** nối 403 → màn này là đổi luồng sản phẩm

### B-V1-06 · Nhãn login/onboarding viết hoa đầu câu, ba màn hệ thống viết thường hoàn toàn

- **Trạng thái:** chờ quyết
- **Mức:** thấp
- **Bất biến vi phạm:** A6 (nửa "viết thường, kiểu câu") — **nếu** nó là luật
- **Phát hiện:** 2026-09-30 · kế hoạch mục 9 phát hiện 4; đo lại 2026-10-03: onboarding sáu nút `Tạo dự án`, `Tải bản vẽ`, `Duyệt kết quả`, `Xem dự án mẫu`, `Xem hướng dẫn 2 phút`, `Bỏ qua`; accessDenied `đăng nhập bằng tài khoản khác`, `về danh sách dự án`
- **Tái hiện bằng máy:** **không lập** — Q10f chốt B: kế hoạch không khẳng định "viết thường kiểu câu" khi luật chỉ có ở `CLAUDE.md` và chưa có hàm khẳng định trong `lib/testing`
- **Gốc:** hai lớp chữ viết theo hai quy ước
- **Sửa:** chưa — chờ phần A của Q10f (chốt luật ở `LUAT_MAN_HINH.md` + `expectSentenceCase`)

### B-V1-07 · `/login/invitation/*` và `/login/reset-password/*` ra màn 404

- **Trạng thái:** không phải lỗi
- **Phép đo đã bác:** `src/routes/paths.ts:176-199` ghi rõ hai tiền tố này là chỗ F-09a sẽ đặt route; `PUBLIC_ROUTE_PATTERNS` chỉ là danh sách công khai, không dựng route nào, và `src/screens` không có màn lời mời hay đặt lại mật khẩu. Tính năng chưa làm; route bắt-hết làm đúng việc của nó. `safeDestination` vẫn nhận đích dưới tiền tố này (bài đơn vị "lets a page under the sign-in prefix through"), để ngày F-09a có route thì không phải sửa bộ lọc.

### B-V1-08 · `role="status"` rỗng và 404 trên màn không có quyền

- **Trạng thái:** không phải lỗi
- **Phép đo đã bác:** `status` là vùng thông báo toàn cục `region aria-live="polite"` có ở mọi màn; 404 là `/favicon.ico` (B-G-03, nay đã sửa). Lượt dò 2026-10-03 trên `/khong-co-quyen`: lỗi console duy nhất là favicon.

### B-V1-09 · Chữ nhân đôi trong `textContent` của nút ("Đăng nhậpĐăng nhập")

- **Trạng thái:** không phải lỗi
- **Phép đo đã bác:** `outerHTML` thật của nút gửi (lượt dò 2026-10-03): bản thứ nhất nằm trong `<span aria-hidden="true" class="invisible …">` — bản sao giữ bề rộng nút khi chuyển sang trạng thái đang tải (`Button.tsx:67-74`); bản thứ hai là chữ thấy được. Tên truy cập là "Đăng nhập" một lần. Hệ quả cho người viết bài: dùng `getByRole(…, { name })`, không `getByText`.

### B-V1-10 · Canvas của bản điện thoại không có mốc neo

- **Trạng thái:** không phải lỗi
- **Phép đo đã bác:** canvas là mặt vẽ trang trí, `aria-hidden="true"` là đúng (`MobileViewer.tsx:208`); mốc của màn là `region` "xem mô hình 3D trên điện thoại". Không ca nào hôm nay cần neo canvas (`success` không dựng được — B-V1-03). Thêm `data-testid` khi có ca đầu tiên cần nó.

## V2

### B-V2-01 · Tour hướng dẫn không hiện khi người dùng lần đầu mở màn; nó bật lên giữa chừng ở cú bấm/resize sau

- **Trạng thái:** đã sửa (`dd00268`, `f35ce7a`) — điều phối chốt sửa gốc (hỏi 2026-10-03)
- **Mức:** cao — người dùng lần đầu không thấy hướng dẫn; rồi nền tối của nó bật lên giữa việc khác và
  nuốt cú bấm (bấm nền = bỏ qua)
- **Bất biến vi phạm:** A12 (một lớp phủ không thấy được lúc cần, rồi chặn bàn phím/chuột lúc không cần)
- **Phát hiện:** 2026-09-30 · lớp đo kế hoạch (V2 phát hiện 1, 2, 10); gốc tìm bằng đọc mã 2026-10-03
- **Tái hiện bằng tay:**
  1. Ngữ cảnh mới (localStorage trống), mở `/projects/project-1/floors/L1/layers/walls` (hoặc `/3d`)
  2. Chờ 10 s, không đổi cỡ cửa sổ
  - Kỳ vọng: thẻ hướng dẫn bước 1 hiện
  - Thực tế (trước sửa): 0 thẻ; đổi cỡ cửa sổ 1 px hoặc cú bấm đầu tiên ⇒ thẻ hiện
- **Tái hiện bằng máy:** `e2e/v2v3/editor-tour.spec.ts` › "tour tự hiện khi người dùng lần đầu mở màn
  tường, không cần sự kiện cửa sổ nào (B-V2-01)", "vỏ 3D: tour tự hiện đúng một bước …", "màn xuất có bơm
  bộ mẫu: nút xuất vừa có là tour tự hiện …"
  `E2E_PORT=5192 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v2v3/editor-tour.spec.ts -g "tự hiện"`
  — **đã kiểm đỏ trước sửa**: `Timed out 6000ms … getByRole('region', { name: 'chọn công cụ ở ray bên trái' })`
  (và `'đổi sang khung nhìn khối'` ở `/3d`).
- **Gốc:** `useEditorTour.ts` đọc `registry.listShortcuts()` và neo DOM ngay lúc render nhưng không nghe
  chúng đổi. Màn chủ đăng ký phím trong effect (SAU lượt render đầu của lớp phủ) và dựng neo muộn (vỏ 3D
  sau khi mô hình về, màn xuất khi có thứ để xuất) ⇒ 0 bước sống ⇒ `empty`; chỉ `subscribeViewport`
  (`resize`/`scroll`) hay một lượt render lại tình cờ mới làm nó hiện.
- **Sửa:** `ShortcutRegistry.subscribe()` (chỉ thêm; phát sau mỗi register/unregister) + hook nghe sổ phím
  và nghe neo vào/rời DOM (`MutationObserver`), cả hai qua `useSyncExternalStore` với ảnh chụp chuỗi.
  Bài đơn vị: `shortcutRegistryListing.test.ts` (subscribe), `EditorTour.test.tsx` (hai bài B-V2-01) — đỏ
  khi gỡ dây nghe · commit `dd00268`, `f35ce7a`.
- **Màn có tour tự hiện sau bản sửa:** WallLayerReview (lúc tải, 4 bước), ViewerShell `/3d` (khi mô hình dựng
  xong, 1 bước), ExportPanel (khi nút "xuất" có mặt — tức chỉ khi có thứ để xuất; kho rỗng thì không).

### B-V2-02 · Sau "Đánh dấu tất cả đã đọc", trình đọc màn hình nghe "không có thông báo nào" trong khi danh sách vẫn còn

- **Trạng thái:** đã sửa (`f188221`)
- **Mức:** trung bình — người dùng trình đọc màn hình được bảo hộp thư rỗng
- **Bất biến vi phạm:** A7 (nói ra trạng thái cho trình đọc màn hình — nói sai)
- **Phát hiện:** 2026-09-30 · lớp đo kế hoạch (V2 phát hiện 4)
- **Tái hiện bằng tay:** mở `/thong-bao`, bấm "Đánh dấu tất cả đã đọc"; vùng `role="status"` đọc
  "không có thông báo nào", 5 dòng vẫn hiện.
- **Tái hiện bằng máy:** `e2e/v2v3/notification-center.spec.ts` › "\"Đánh dấu tất cả đã đọc\" xoá số chưa đọc,
  khoá nút, và trạng thái nói … (B-V2-02)" `-g "B-V2-02"` — **đã kiểm đỏ trước sửa** (chỉ gỡ câu mới):
  `Expected "không còn thông báo chưa đọc"  Received "không có thông báo nào"`.
- **Gốc:** `useNotificationCenter.ts` `liveMessage`: `unreadCount === 0 ⇒ liveEmpty` — gộp "hết chưa đọc"
  với "hộp thư rỗng".
- **Sửa:** câu thứ ba `liveAllRead` = "không còn thông báo chưa đọc" khi còn mục · bài đơn vị
  `NotificationCenter.test.tsx` › "B-V2-02 …" · commit `f188221`

### B-V2-03 · Tấm trượt thông báo là một "hộp thoại" không tên

- **Trạng thái:** đã sửa (`f188221`) cho NotificationCenter; nợ còn ở năm nơi gọi `Drawer` khác
- **Mức:** trung bình — trình đọc màn hình đọc "hộp thoại" trống; không mốc neo khả dụng
- **Bất biến vi phạm:** — (khả năng tiếp cận; plan V2 phát hiện 7, ngoại lệ 7.2 sửa khả năng tiếp cận)
- **Phát hiện:** 2026-09-30 · lớp đo kế hoạch (đo `name: null`)
- **Tái hiện bằng tay:** mở `/thong-bao`, công cụ trợ năng: `role="dialog"` không có tên.
- **Tái hiện bằng máy:** mọi bài của `notification-center.spec.ts` neo `getByRole('dialog', { name: 'Thông báo' })`;
  bộ lọc `-g "bộ lọc"` — **đã kiểm đỏ trước sửa**: `getByRole('dialog', { name: 'Thông báo' }) … <element(s) not found>`.
- **Gốc:** `Drawer.tsx` dựng `role="dialog" aria-modal` mà không có đường nào nhận tên.
- **Sửa:** `Drawer.Root` nhận `label` (tuỳ chọn) ⇒ `aria-label`; NotificationCenter truyền "Thông báo" · bài
  đơn vị `NotificationCenter.test.tsx` › "B-V2-03 …" · commit `f188221`. **Còn nợ:** `AppShell.tsx:312,319`,
  `UserManagementDetail.tsx:365`, `ConnectionStates.tsx:38`, `DemoSharedControls.tsx:196` chưa truyền `label`.

### B-V2-04 · Bấm một thông báo ở `/thong-bao` đưa người dùng về danh sách dự án thay vì màn của thông báo

- **Trạng thái:** đã sửa (`fa56cc9`)
- **Mức:** cao — đường chính của màn (mở thứ được báo) không tới đích
- **Bất biến vi phạm:** —
- **Phát hiện:** 2026-10-03 · `e2e/v2v3/notification-center.spec.ts` (V2 MỤC 3 trường 6c)
- **Tái hiện bằng tay:** mở thẳng `/thong-bao`, bấm "hệ thống AI đã xử lý xong bản vẽ tầng trệt".
  - Kỳ vọng: `/projects/project-1/floors/L1/layers/walls`
  - Thực tế: lịch sử `push …/walls` rồi `replace /` hai lần — về `/`. "Mở cài đặt thông báo" cùng gốc.
- **Tái hiện bằng máy:** `notification-center.spec.ts` › "bấm một thông báo ở /thong-bao mở thẳng đưa người
  dùng tới đúng màn của thông báo ấy" `-g "bấm một thông báo"` — **đã kiểm đỏ trước sửa** (gỡ riêng `fa56cc9`):
  `Expected "/projects/project-1/floors/L1/layers/walls"  Received "/"`.
- **Gốc:** `useNotificationCenter.ts` `onItemClick` gọi `onNavigate(đích)` rồi `closeDrawer()`; view gọi
  `onClose` thêm sau 180 ms. Ở route `onClose` = `goBack` ("đóng = rời route") ⇒ đè lên lượt điều hướng.
- **Sửa:** `NotificationCenterRoute` tự cấp `onNavigate`; đã điều hướng đi thì `goBack` không làm gì · bài
  đơn vị `NotificationCenterRoute.test.tsx` (mới) · commit `fa56cc9`

### B-V2-05 · Chip "xem hướng dẫn" che nút của màn chủ ("chia sẻ", "Góc nhìn sẵn")

- **Trạng thái:** đã sửa (`b51b966`) — điều phối chốt; **đóng luôn B-V12-09 của W09**
- **Mức:** trung bình — sau khi bỏ tour, nút ở góc phải trên không bấm được bằng chuột
- **Bất biến vi phạm:** A12 (điều khiển thấy được mà không dùng được)
- **Phát hiện:** 2026-10-03 · `e2e/v2v3/share-dialog.spec.ts`
- **Tái hiện bằng tay:** `/projects/project-1/export` có dữ liệu, 1280×720, bỏ qua tour, bấm "chia sẻ" ⇒
  không mở; ở `/3d` bấm "Góc nhìn sẵn" ⇒ trúng chip.
- **Tái hiện bằng máy:** `e2e/v2v3/tour-chip.spec.ts` (7 bài) — **đã kiểm đỏ trước sửa** (trả vị trí cũ):
  `5 failed · 2 passed`; `+ "button \"chia sẻchia sẻ\" @1161,24"`, `+ "button \"Góc nhìn sẵn\" @1096,9"`,
  `locator.click: … <span>xem hướng dẫn</span> … subtree intercepts pointer events`.
- **Gốc:** `EditorTour.tsx:381` chip `fixed right-[16px] top-[16px]` — đúng góc của điều khiển màn chủ.
- **Sửa:** chip `bottom-[16px] left-1/2 -translate-x-1/2`. Đo 3 màn × 2 cỡ: giữa đáy trống cả 6;
  dưới-trái nằm trên cột "Danh sách đoạn tường"; dưới-phải là chỗ toast (`Toast.tsx:231`). Hở còn lại:
  cuộn màn tường tới đáy thì chip nằm trên chữ "Thanh trạng thái" (không có nút). Không ảnh chuẩn nào lệch
  (`app.visual` chụp `/`, `motion.visual` chụp `/demo`). Không bài đơn vị (một bài soi class Tailwind
  không chứng minh chuyện đè; bằng chứng là e2e) · commit `b51b966`

### B-V2-06 · "Đánh dấu tất cả đã đọc" không có toast/Hoàn tác

- **Trạng thái:** chờ quyết — QV2-3 (A8 có áp cho đánh dấu đã đọc không) chưa chốt
- **Mức:** thấp — đánh dấu nhầm thì không lấy lại được "chưa đọc"
- **Bất biến vi phạm:** A8 (nếu QV2-3 chốt "có")
- **Phát hiện:** 2026-09-30 · lớp đo kế hoạch (V2 "Đo thêm" 2)
- **Tái hiện bằng tay:** `/thong-bao` › "Đánh dấu tất cả đã đọc": 0 `role="alert"`, 0 nút "Hoàn tác", 0 toast.
- **Tái hiện bằng máy:** `notification-center.spec.ts` › `test.fixme` "\"Đánh dấu tất cả đã đọc\" hiện toast kèm
  nút \"Hoàn tác\" (A8 — chờ quyết QV2-3)" — bật tạm: `Timed out 5000ms … getByRole('button', { name: 'Hoàn tác' })`.
- **Gốc:** `useNotificationCenter.ts` `useMutation` không kèm toast/undo; API không có "đánh dấu chưa đọc".
- **Sửa:** chưa. Mở lại khi QV2-3 chốt "có" (cần API đảo); chốt "không" thì xoá bài và ghi lý do.

## V3

### B-V3-01 · Bảng điều khiển đọc trạng thái màn bằng tiếng Anh cho trình đọc màn hình

- **Trạng thái:** đã sửa (`f05443e`) — questions.md "Việc sản phẩm" #6, F1 của kế hoạch
- **Mức:** trung bình — người dùng trình đọc màn hình nghe "success", "forbidden"
- **Bất biến vi phạm:** A6
- **Phát hiện:** 2026-09-30 · lớp đo kế hoạch (V3 F1)
- **Tái hiện bằng tay:** mở `/`, công cụ trợ năng: `<span class="sr-only" role="status">` = "success".
- **Tái hiện bằng máy:** `dashboard.spec.ts` › "F1 — … › lúc tải đọc \"thành công\" …", "tìm không khớp đọc
  \"một phần\" …", và "khung 700 px thu gọn …" (đọc "thu gọn") — **đã kiểm đỏ trước sửa**:
  `getByRole('status').filter({ hasText: /^thu gọn$/u }) Expected: 1 Received: 0`.
- **Gốc:** `ProjectDashboard.tsx:343-345` in thẳng khoá `SevenState`; màn duy nhất trong 49 không gọi
  `expectVietnamese` (Q10h).
- **Sửa:** bảng `STATE_ANNOUNCEMENT` (khuôn `ProjectSettings.tsx`/`CreateProjectModal.tsx`); Q10h chốt lấp
  A6 ở đơn vị: `ProjectDashboard.test.tsx` thêm `expectVietnamese` cho cả bảy trạng thái — đỏ 7/7 trên mã cũ
  · commit `f05443e`

### B-V3-02 · Mở lại hộp thoại tạo dự án thì nó đứng ở bước 3 với dự án vừa tạo; "bỏ thay đổi" không bỏ gì

- **Trạng thái:** đã sửa (`9c6fd89`)
- **Mức:** cao — một cú "tạo dự án" nữa là tạo trùng; dữ liệu "đã bỏ" quay lại
- **Bất biến vi phạm:** —
- **Phát hiện:** 2026-10-03 · `e2e/v2v3/create-project.spec.ts`
- **Tái hiện bằng tay:** (1) `/` hoặc `/onboarding`: tạo trọn một dự án, bấm mở lại ⇒ "bước 3 / 3" đầy dữ liệu.
  (2) `/`: gõ tên, `Escape`, `Escape`, mở lại ⇒ tên còn.
- **Tái hiện bằng máy:** `create-project.spec.ts` › "(dashboard|onboarding) tạo xong rồi mở lại: …", "bỏ thay đổi
  bằng Escape hai lần rồi mở lại: …" — **đã kiểm đỏ trước sửa**: `status /^bước 1 \/ 3$/ Expected 1 Received 0`;
  `toHaveValue Expected "" Received "Dự án gõ dở"`.
- **Gốc:** cả hai màn chủ giữ `CreateProjectModalContainer` luôn mount, chỉ đổi `isOpen`; state của
  `useCreateProjectModal` sống qua mỗi lần đóng.
- **Sửa:** `CreateProjectModal` đổi `key` mỗi lần mở (khuôn "so với giá trị trước" của `Drawer.tsx`) · bài đơn vị
  `CreateProjectModal.test.tsx` › "opens on a fresh form every time … (B-V3-02)" · commit `9c6fd89`

### B-V3-03 · Ô đổi tên dự án tại chỗ không có tên truy cập

- **Trạng thái:** đã sửa (`dc325fd`)
- **Mức:** thấp — trình đọc màn hình đọc "ô nhập" không biết đổi tên dự án nào
- **Bất biến vi phạm:** — (khả năng tiếp cận)
- **Phát hiện:** 2026-10-03 · `e2e/v2v3/dashboard.spec.ts` (đo `name: null`)
- **Tái hiện bằng tay:** `/` › menu thẻ › "Đổi tên": ô nhập không nhãn.
- **Tái hiện bằng máy:** `dashboard.spec.ts` › "đổi tên tại chỗ: …", "Escape trong ô đổi tên huỷ: …" (neo
  `getByRole('textbox', { name: 'đổi tên Chung cư Sunrise Block B' })`) — **đã kiểm đỏ trước sửa**.
- **Gốc:** hai `<input>` (lưới `ProjectCardTile.tsx`, bảng `ProjectDashboard.tsx` `nameField`) không nhãn.
- **Sửa:** `aria-label="đổi tên <tên dự án>"` cho cả hai · bài đơn vị `ProjectDashboard.test.tsx` (hai kiểu xem)
  · commit `dc325fd`

### B-V3-04 · Hộp thoại chia sẻ mở ra đã ở lỗi "thao tác chia sẻ đã bị huỷ" dù máy chủ khoẻ

- **Trạng thái:** đã sửa (`ffb83a5`)
- **Mức:** cao — người dùng thấy lỗi ngay khi mở; nhánh dữ liệu của hộp thoại không bao giờ tới được
- **Bất biến vi phạm:** A11 (một `error` không có lỗi thật)
- **Phát hiện:** 2026-09-30 · lớp đo kế hoạch (V3 mục 0.3), gốc tìm 2026-10-03
- **Tái hiện bằng tay:** `/projects/project-1/export` có dữ liệu, mở "chia sẻ": `role="alert"` "thao tác chia sẻ
  đã bị huỷ".
- **Tái hiện bằng máy:** `share-dialog.spec.ts` › "bơm kho + máy chủ giả trả danh sách rỗng: mở hộp thoại chia sẻ
  thì không hiện lỗi …" — **đã kiểm đỏ trước sửa** (gỡ riêng `ffb83a5`): `getByRole('dialog', { name: 'chia sẻ
  bản vẽ' }).getByRole('alert') Expected 0 Received 1`.
- **Gốc:** `src/lib/http/client.ts` `request()` gộp GET cùng URL vào một lượt bay chạy trên `signal` của NGƯỜI
  KHỞI XƯỚNG. StrictMode gỡ-gắn lại ⇒ lượt đầu bị huỷ, lượt gắn lại nhập vào nó và nhận `aborted` dù tín hiệu
  của chính nó còn sống (đo: `fetch` được gọi với `signal.aborted === true`); `useShareDialog.ts:315-319` biến
  nó thành `Error` thường. Ảnh hưởng mọi GET có `signal` qua `createAppHttpClient`, không riêng màn này.
- **Sửa:** kết quả chung `aborted` mà người gọi không huỷ ⇒ người ấy hỏi lại một lần trên tín hiệu của mình ·
  bài đơn vị `src/lib/http/__tests__/client.test.ts` (đỏ trên mã cũ) · commit `ffb83a5`

### B-V3-05 · Xoá dự án xong, danh sách dự án không báo gì (F4)

- **Trạng thái:** đã sửa (`e049fe9`)
- **Mức:** trung bình — một việc không hoàn tác được xong mà không có xác nhận kết quả
- **Bất biến vi phạm:** A9 (hỏi trước có, nhưng kết quả không được nói ra)
- **Phát hiện:** 2026-09-30 · lớp đo kế hoạch (V3 F4, "chưa xác minh chắc"); xác minh 2026-10-03
- **Tái hiện bằng tay:** `admin@example.com` › `/projects/project-1/settings` › "vùng nguy hiểm" › "Xoá dự án" › gõ
  "Chung cư Hoàng Anh" › xác nhận: về `/`, vùng "Thông báo" rỗng (đo suốt 1,75 s).
- **Tái hiện bằng máy:** `project-settings.spec.ts` › "xoá dự án xong thì ở danh sách dự án có toast \"Đã xoá dự
  án.\" (B-V3-05)" — **đã kiểm đỏ trước sửa**: `getByRole('region', { name: 'Thông báo' }).getByText('Đã xoá dự án.')
  … <element(s) not found>`.
- **Gốc:** toast vào `Toast.Provider` riêng của route cài đặt (`ProjectSettings.container.tsx`), rồi
  `navigate('/')` gỡ chính provider ấy cùng lượt (`useProjectSettings.ts:748-749`).
- **Sửa:** `onProjectDeleted(notice)` mang câu báo (có nó thì hook không toast tại chỗ); route đẩy câu lên
  `appNotificationBus`, `NotificationHost` cạnh `RouterProvider` vẽ nó · bài đơn vị `ProjectSettings.test.tsx` ·
  commit `e049fe9`

### B-V3-06 · "Thu hồi" liên kết chia sẻ gửi ngay, không hỏi (F2)

- **Trạng thái:** đã sửa (`11c427a`) — điều phối chốt (A9 bắt buộc)
- **Mức:** cao — một cú bấm vô hiệu hoá liên kết người khác đang dùng, không có đường khôi phục
- **Bất biến vi phạm:** A9
- **Phát hiện:** 2026-09-30 · lớp đo kế hoạch (V3 F2, đọc mã); dựng được bằng `page.route` 2026-10-03
- **Tái hiện bằng tay:** hộp thoại chia sẻ có một liên kết › "thu hồi" ⇒ DELETE đi ngay, không hộp thoại.
- **Tái hiện bằng máy:** `share-dialog.spec.ts` › "bơm kho + máy chủ giả có một liên kết: \"thu hồi\" hỏi xác nhận
  trước; …" — **đã kiểm đỏ trước sửa** (gỡ riêng `11c427a`): `getByRole('dialog', { name: 'thu hồi liên kết này?' })
  … <element(s) not found>`.
- **Gốc:** `ShareDialogLink.tsx:85-89` → `useShareDialog.ts:599` `revokeMutation.mutate` thẳng; toast không có
  `onUndo` (không có API khôi phục).
- **Sửa:** `revokeLink` chỉ hỏi (`pendingRevokeId`), `confirmRevoke`/`cancelRevoke`; hộp thoại "thu hồi liên kết
  này?" (để nguyên / thu hồi) là anh em của hộp thoại chia sẻ · bài đơn vị `ShareDialog.test.tsx` › "A9 — …
  (B-V3-06)" · commit `11c427a`

### B-V3-07 · Mọi toast của hộp thoại chia sẻ câm trên route thật (gồm Hoàn tác của "đổi quyền")

- **Trạng thái:** đã sửa (`f4f765e`)
- **Mức:** trung bình — A8 của "đổi quyền" mà bài đơn vị khẳng định không bao giờ tới người dùng
- **Bất biến vi phạm:** A8
- **Phát hiện:** 2026-10-03 · đọc mã khi điều tra F2
- **Tái hiện bằng tay:** hộp thoại chia sẻ › "tạo liên kết" (hoặc đổi quyền): không toast nào.
- **Tái hiện bằng máy:** `share-dialog.spec.ts` › "bơm kho + máy chủ giả: \"tạo liên kết\" trong hộp thoại chia sẻ
  hiện toast …" — **đã kiểm đỏ trước sửa** (gỡ riêng `f4f765e`): `getByRole('region', { name: 'Thông báo' })
  .filter({ hasText: 'đã tạo liên kết chia sẻ' }) … <element(s) not found>`.
- **Gốc:** `ExportPanel.container.tsx:149-154` dựng `ShareDialogContainer` không `onToast`; route không có
  `Toast.Provider`.
- **Sửa:** `ExportPanelRoute` dựng `Toast.Provider` (khuôn `ProjectSettingsRoute`), truyền `addToast` · bài đơn vị
  `ExportPanel.route.test.tsx` (mới) · commit `f4f765e` — **tệp màn V12**

### B-V3-08 · Nút chuông "Thông báo" ở danh sách dự án không làm gì

- **Trạng thái:** chờ quyết — đích của nút (tấm trượt hay `/thong-bao`) chưa chốt
- **Mức:** trung bình — điều khiển trông bấm được, nằm trong thứ tự Tab, và chết; cũng là lý do không có
  đường nội bộ nào tới `/thong-bao`
- **Bất biến vi phạm:** A2 (hover/nhấn dành cho thứ tương tác được)
- **Phát hiện:** 2026-10-03 · `e2e/v2v3` (subagent đo khi tìm đường vào `/thong-bao`)
- **Tái hiện bằng tay:** `/` › bấm chuông "Thông báo": URL không đổi, không panel nào.
- **Tái hiện bằng máy:** `dashboard.spec.ts` › `test.fixme` "bấm chuông \"Thông báo\" ở danh sách dự án mở các
  thông báo (B-V3-08)" — bật tạm: `getByRole('dialog', { name: 'Thông báo' }) … <element(s) not found>`.
- **Gốc:** `ProjectDashboard.tsx:194` `<button aria-label="Thông báo">` không `onClick`; `NotificationBellContainer`
  không vỏ nào dựng (V2 phát hiện 9).
- **Sửa:** chưa. Mở lại khi người duyệt chốt đích; cả hai lựa chọn đều cho `dialog` "Thông báo" nên bài giữ nguyên.

### B-V3-09 · Mỗi lượt tải `/export` đọc danh sách liên kết chia sẻ dù hộp thoại đóng

- **Trạng thái:** đã sửa (`048530b`)
- **Mức:** thấp — một lượt mạng thừa mỗi lần mở màn; ở dev nó là một 404 trên console
- **Bất biến vi phạm:** —
- **Phát hiện:** 2026-10-03 · `e2e/smoke-grid.spec.ts` › `projectExport` đỏ sau bản sửa B-V3-04 (lượt thừa trước đó bị
  StrictMode huỷ lặng lẽ, nay ra tới mạng)
- **Tái hiện bằng tay:** mở `/projects/project-1/export`, DevTools › Network: `GET …/share-links` dù chưa bấm "chia sẻ".
- **Tái hiện bằng máy:** `e2e/smoke-grid.spec.ts` › "màn projectExport mở được …" — **đã kiểm đỏ trước sửa**:
  `+ "Failed to load resource: … 404 … /api/projects/project-1/share-links"`.
- **Gốc:** `useShareDialog.ts` `useQuery` danh sách liên kết `enabled: canCreateLink` — không xét `isOpen`, trái luật
  container tự ghi cho lượt đọc thành viên ("một hộp thoại đóng không có lý do gì gọi mạng").
- **Sửa:** `UseShareDialogOptions.isOpen` (mặc định `true`), `enabled: canCreateLink && isOpen` · bài đơn vị
  `ShareDialog.test.tsx` › "B-V3-09 …" (đỏ khi gỡ điều kiện) · commit `048530b`. Khi mở hộp thoại ở dev, `share-links` vẫn 404 —
  cùng loại B-G-05 (cổng gọi thẳng mạng, bộ mẫu không phục vụ); chưa ghi mục riêng.

### Phát hiện kế hoạch kết luận "không phải lỗi"

- **V2 #5 — bấm nền tối = bỏ qua tour:** thiết kế (`handleSkip`: "Esc và bấm ra nền đều BỎ QUA"), đo bằng cú bấm
  thật tại (5, 450): thẻ biến mất, chip hiện, khoá `'true'`. Hệ quả "nuốt cú bấm" là của B-V2-01 (tour bật lên
  giữa chừng), đã sửa ở đó.
- **V2 #8 — docblock ViewCube ở `Viewer3DOverlays.tsx:70-96`:** kể lỗi kèm ngày đo và đứng ngay trên hằng số đã chữa
  (`PRESENCE_ANCHOR`); bài `collaboration.spec.ts` đo tâm nút "Ai đang xem" trúng chính nút. Không phải lỗi.
- **V2 #9 — `ConnectionStates`/`NotificationBell` không ai dựng:** quyết định phạm vi Q10b; phần chuông chết của
  dashboard tách thành B-V3-08.
- **V3 F3 — tiêu điểm đầu ở "Đóng hộp thoại":** hành vi chung của mọi `Modal` (bẫy tiêu điểm đưa tới phần tử đầu),
  không riêng màn này; bài ghi "hiện trạng". Đổi là quyết định thiết kế cho cả `Modal`.
- **V3 F5 — hai `Toast.Provider` cho hai đường mở hộp thoại tạo:** đúng; V3-CP-1 chạy ở cả hai host, cả hai xanh.
- **V3 F6 — "Xoá" hiện với người xem:** có `disabled` + `aria-disabled="true"`; bấm `force` không mở gì (bài F6).
- **V3 F7/F8 — thiếu `setFloors` trong ghi chú; chữ nút nhân đôi trong `textContent`:** lỗi ghi chú / bẫy `getByText`,
  không phải lỗi sản phẩm (toast cũng nhân đôi "Hoàn tácHoàn tác"; tên truy cập vẫn khớp).

## V4

### B-V4-01 · Màn xử lý luôn "Chưa có bước nào để theo dõi", dù dự án có bản vẽ

- **Trạng thái:** đã sửa (`c8bf4ab`)
- **Mức:** cao — đích của cả chuỗi nhận bản vẽ; người dùng bấm "Bắt đầu xử lý" / "Tiếp tục xử lý" /
  "Vẫn dùng AI" và thấy "Đã xong 0/0 tầng"
- **Bất biến vi phạm:** A11 (một `empty` nói sai sự thật)
- **Phát hiện:** 2026-09-30 · plan.md V4 mục 0(a), P2
- **Tái hiện bằng tay:**
  1. Mở `/projects/project-1/pipeline` (hoặc tải đủ 4 tầng rồi bấm "Bắt đầu xử lý")
  - Kỳ vọng: Tầng 1 (bản vẽ sẵn, đã xử lý) hiện với sáu bước, "Đã xong 1/1 tầng"
  - Thực tế (trước khi sửa): "Chưa có bước nào để theo dõi … Đã xong 0/0 tầng"
- **Tái hiện bằng máy:** `e2e/v4v5/processing.spec.ts` › "B-V4-01: mở thẳng /pipeline…" và
  "B-V4-01: tới từ "Vẫn dùng AI"…"
  `E2E_PORT=5193 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v4v5/processing.spec.ts -g "B-V4-01"`
- **Gốc:** `ProcessingScreen.container.tsx` — `ProcessingScreenRoute` không truyền `floorUploads`,
  container mặc định `[]`; danh sách chỉ sinh từ prop ấy. Endpoint liệt kê (N7) có ở BE và có
  schema ở FE nhưng chưa có phương thức `ApiClient` nào gọi.
- **Sửa:** `src/api/client.ts` (`drawings.latestUploads`, đọc hết các trang `nextCursor`, từng mục
  qua `safeParseList`) · `src/api/endpoints.ts` (`drawings.latestUploads`) · `src/api/__mocks__/client.ts`
  (N7 của bộ mẫu: Tầng 1 mang lượt mồi `upl_…` đã xong; lượt `initUpload` ghi vào danh sách) ·
  `src/lib/query/queryKeys.ts` (`progress.latestUploads`) · `processingGateway.ts`
  (`readLatestUploads`) · `useProcessingScreen.ts` (không ai truyền `floorUploads` thì đọc N7;
  N7 hỏng ⇒ `error` có "Thử lại", không giả vờ rỗng) · container bỏ mặc định `[]`, sửa docblock
  lỗi thời (P8). `src/lib/upload/uploadTask.ts`: `api` thu về `Pick<DrawingsApi, 4 lời gọi tải>`
  (lượt tải không cần đọc danh sách). Bài đơn vị: `src/api/__tests__/client.test.ts` (2) ·
  `ProcessingScreen.test.tsx` (2). Đã kiểm đỏ trước sửa.
  - Phụ hệ quả: lưới khói `projectPipeline` bỏ nhãn `known` (đã hết hỏng), thêm `expectedConsole`
    cho B-V4-10.

### B-V4-02 · "Tiếp tục xử lý" đi tiếp dù ô xác nhận mức Kém chưa tích

- **Trạng thái:** đã sửa (`c8bf4ab`)
- **Mức:** trung bình — người dùng đọc "Đánh dấu ô xác nhận bên trên rồi thử lại." rồi vẫn bị đưa
  đi; cảnh báo chất lượng thành lời nói suông
- **Bất biến vi phạm:** —  (lời trên màn mâu thuẫn hành vi)
- **Phát hiện:** 2026-09-30 · plan.md V4 P1
- **Tái hiện bằng tay:** `/projects/project-1/quality` → bấm hàng "Tầng 1" → không tích ô →
  "Tiếp tục xử lý"
  - Kỳ vọng: ở lại; lời chặn đứng cạnh nút
  - Thực tế (trước khi sửa): sang `/projects/project-1/pipeline`
- **Tái hiện bằng máy:** `e2e/v4v5/quality.spec.ts` › "B-V4-02: chưa tích ô xác nhận…"
- **Gốc:** `useInputQualityGate.ts` `onContinue` không xét `footer.canContinue`
- **Sửa:** `onContinue` dừng khi `!footer.canContinue` (nút vẫn bấm được — không chặn cứng, đúng
  `InputQualityGateFooter.tsx:4-9`; cùng khuôn `submit` của màn tải lên) · bài đơn vị
  `InputQualityGate.test.tsx` "chặn cho tới khi tích ô…" thêm hai khẳng định điều hướng. Đã kiểm đỏ
  trước sửa.

### B-V4-03 · Hoàn tác xoá một bản vẽ đã gắn trả thẻ về "chờ xử lý" mãi

- **Trạng thái:** đã sửa (`c8bf4ab`)
- **Mức:** trung bình — A8 hứa lấy lại được; thực tế bộ đếm tụt "3 / 4" vĩnh viễn và nút chính
  chặn, người dùng phải tải lại tệp
- **Bất biến vi phạm:** A8
- **Phát hiện:** 2026-10-03 · vòng tranh luận hai vai (Tech Lead Tester), đọc mã
- **Tái hiện bằng tay:** tải `tang-ham.png`, `tang-2.png`, `tang-3.png` → "4 / 4" → menu
  "Tùy chọn của tầng Tầng 2" → "Xoá bản vẽ tang-2.png" → toast → "Hoàn tác"
  - Kỳ vọng: thẻ Tầng 2 "đã gắn kèm", "4 / 4"
  - Thực tế (trước khi sửa): "chờ xử lý", "3 / 4", không ai tải lại
- **Tái hiện bằng máy:** `e2e/v4v5/upload.spec.ts` › "B-V4-03: xoá một bản vẽ đã gắn…"
- **Gốc:** `useFloorUploadScreen.ts` `removeFile` → vé hoàn tác đẩy lại tệp với
  `status: 'waiting'` và không gọi `startUpload`
- **Sửa:** hoàn tác trả lại ĐÚNG bản ghi đã xoá; chỉ lượt đang tải (bị chính lần xoá cắt ngang)
  mới tải lại · bài đơn vị `useFloorUploadScreen.test.ts` "xoá xảy ra ngay…" (hoàn tất lượt tải
  trước khi xoá, khẳng định `attached` sau hoàn tác). Đã kiểm đỏ trước sửa.

### B-V4-04 · "Bắt đầu xử lý" cho qua tầng có tệp chưa tải xong (PDF chưa chọn trang, tệp hỏng)

- **Trạng thái:** đã sửa (`c8bf4ab`)
- **Mức:** cao — bộ đếm nói "3 / 4" nhưng nút đưa người dùng sang xử lý với một tầng không có bản vẽ
- **Bất biến vi phạm:** —
- **Phát hiện:** 2026-10-03 · vòng tranh luận hai vai (Tech Lead Tester), đọc mã
- **Tái hiện bằng tay:** tải `tang-2.pdf` (3 trang, chưa chọn trang), `tang-ham.png`, `tang-3.png`
  → "3 / 4" → "Bắt đầu xử lý"
  - Kỳ vọng: khối "Không thể bắt đầu xử lý" nêu Tầng 2
  - Thực tế (trước khi sửa): sang `/pipeline`
- **Tái hiện bằng máy:** `e2e/v4v5/upload.spec.ts` › "B-V4-04: PDF chưa chọn trang…"
- **Gốc:** `useFloorUploadScreen.ts` `blockReasons`: `hasFile = attachment !== null || …` — đếm cả
  tệp `waiting`/`error`; bộ đếm thì chỉ đếm `attached`
- **Sửa:** tệp `waiting`/`error` là lý do `missingFile` với câu "`<Tầng>` chưa tải xong bản vẽ."
  (tệp đang tải giữ lý do `uploading` sẵn có) · bài đơn vị `useFloorUploadScreen.test.ts` "PDF 3
  trang…". Đã kiểm đỏ trước sửa.

### B-V4-05 · Hoàn tác "Tự động nắn" chỉ trả một nửa: bộ đếm "còn lại" lệch

- **Trạng thái:** đã sửa (`c8bf4ab`)
- **Mức:** thấp — phát hiện "ảnh bị nghiêng" quay lại nhưng "2 phát hiện còn lại" đứng nguyên
- **Bất biến vi phạm:** A8
- **Phát hiện:** 2026-10-03 · vòng tranh luận hai vai, đọc mã; đo trong trình duyệt
- **Tái hiện bằng máy:** `e2e/v4v5/quality.spec.ts` › "B-V4-05: "Hoàn tác" sau "Tự động nắn"…"
- **Gốc:** `useInputQualityGate.ts` — lượt ghi đánh dấu phát hiện "đã xong" (`markResolved`), vé hoàn
  tác chỉ trả bộ đệm query, không gỡ dấu. Cùng bệnh ở "Gửi bốn góc".
- **Sửa:** cả hai vé gọi `unmarkResolved(findingIds)` · bài đơn vị `InputQualityGate.test.tsx`
  "nắn thẳng xong thì một toast…". Đã kiểm đỏ trước sửa.
- **Còn lại (ngoài FE):** hoàn tác chỉ ở bộ đệm — máy chủ vẫn giữ bản đã nắn (không có endpoint
  "bỏ nắn"), nên lượt đọc lại sau 30 s dữ liệu cũ sẽ xoá công hoàn tác. Cần endpoint; không viết bài.

### B-V4-06 · Tệp `.dwg` kéo thả vào qua được kiểm tra nhưng bộ mẫu dev không trả 422

- **Trạng thái:** ngoài FE (bộ mẫu dev)
- **Mức:** thấp
- **Phát hiện:** 2026-09-30 · plan.md V4 P4
- **Gốc:** cố ý ở sản phẩm — `validate.ts:53-62` nhận `.dwg` khi thả, để máy chủ trả 422
  `CAD_NOT_SUPPORTED` và thẻ nói câu về CAD (bài đơn vị `useFloorUploadScreen.test.ts` "#5 trả
  422…"). Bộ mẫu dev không mô phỏng 422 nên trên dev tệp vào khay im lặng.
- **Sửa:** chưa — thuộc bộ mẫu dev; không viết bài e2e (đơn vị đã phủ đường 422).

### B-V4-07 · Menu thẻ tải lên không nói mở/đóng, và mở ra bảng rỗng ở tầng có bản vẽ sẵn

- **Trạng thái:** đã sửa (`c8bf4ab`)
- **Mức:** thấp — trình đọc màn hình không biết bảng đã mở; Tầng 1 có nút "Tùy chọn" mở ra khung
  trống
- **Bất biến vi phạm:** A12 (điều khiển không làm gì)
- **Phát hiện:** 2026-09-30 · plan.md V4 P7; bảng rỗng đo 2026-10-03
- **Tái hiện bằng máy:** `e2e/v4v5/upload.spec.ts` › "B-V4-07: nút tuỳ chọn của thẻ…"
- **Gốc:** `FloorUploadCard.tsx` `CardMenu` — nút không có `aria-expanded`; nút vẽ ra khi có
  `row.file` dù ba mục (huỷ/thử lại/xoá) đều tắt
- **Sửa:** `aria-expanded={isOpen}`; không mục nào ⇒ không nút · bài đơn vị
  `FloorUploadScreen.test.tsx` "nút tuỳ chọn của thẻ…". Đã kiểm đỏ trước sửa. (Không thêm
  `role="menu"`: các mục là nút thường, `aria-haspopup="menu"` sẽ hứa điều hướng mũi tên mà bảng
  không có.)

### B-V4-08 · Bản vẽ vừa tải lên không hiện ở màn xử lý trên môi trường dev

- **Trạng thái:** ngoài FE (bộ mẫu dev)
- **Mức:** thấp — chỉ dev; máy chủ thật trả N7 từ cùng một kho
- **Phát hiện:** 2026-10-03 · đọc mã khi sửa B-V4-01; gộp P5 (tải lại trang là mất)
- **Tái hiện bằng máy:** `e2e/v4v5/processing.spec.ts` › "B-V4-08: ba bản vẽ vừa tải lên…"
  (`test.fixme`; đã tạm bật: đỏ đúng chỗ "x/4 tầng" — màn chỉ thấy "1/1")
- **Gốc:** `src/api/appClient.ts:151` — `createAppApiClient()` gọi `createMockApiClient()` MỖI lần,
  và mỗi cổng màn gọi nó một lần ⇒ mỗi màn một bộ mẫu riêng; lượt tải của màn tải lên không có
  trong bộ mẫu của màn xử lý.
- **Sửa:** chưa. Không gọn: dùng chung một bản đổi hành vi dev của mọi màn (đi trong ứng dụng thì
  thấy lại dữ liệu đã sửa) và có thể rò trạng thái giữa các bài đơn vị chạy với
  `VITE_USE_MOCK_API`. Cần người quyết.

### B-V4-09 · A9 và xác nhận inline ở "Huỷ xử lý" / "Bỏ qua tầng đó"

- **Trạng thái:** chờ quyết
- **Mức:** thấp
- **Phát hiện:** 2026-09-30 · plan.md V4 P3 (đọc mã)
- **Gốc:** A9 (`CLAUDE.md`) đòi hộp thoại cho việc không hoàn tác được; đặc tả hai màn cấm
  `role=dialog` (`ProcessingScreen.test.tsx`, `PipelineFailure.test.tsx`) và dùng xác nhận inline.
  Mâu thuẫn giữa hai văn bản, không phải giữa mã và văn bản.
- **Tái hiện bằng máy:** không có — cả hai bề mặt không dựng được trên dev (`cancelProcessing:
  false`; không lượt nào `failed`).
- **Sửa:** chưa — người duyệt chốt A9 có chấp nhận xác nhận inline không.

### B-V4-10 · Màn xử lý mở luồng SSE `/api/streams/projects/:id/uploads/:uploadId/progress` → 404 ở dev

- **Trạng thái:** ngoài FE (bộ mẫu dev) — cùng họ B-G-05/B-G-06
- **Mức:** thấp — màn lùi về đọc định kỳ, tiến độ vẫn đúng
- **Phát hiện:** 2026-10-03 · lộ ra sau khi sửa B-V4-01 (trước đó màn không có lượt nào để nghe)
- **Tái hiện bằng máy:** `e2e/smoke-grid.spec.ts` › "màn projectPipeline" — dòng `expectedConsole`
- **Gốc:** `processingGateway.ts` `subscribeProgress` mở `EventSource` thật; bộ mẫu dev không phục vụ SSE
- **Sửa:** chưa

### B-V4-11 · Bấm "Hoàn tác" xong, toast ở lại mãi và che nút chính

- **Trạng thái:** đã sửa (`c8bf4ab`)
- **Mức:** trung bình — ở màn tải lên toast nằm đúng chỗ nút "Bắt đầu xử lý"; người dùng vừa hoàn
  tác không bấm được nút chính (Playwright đo: cú bấm bị toast chặn suốt 30 s), và toast còn một
  nút "Hoàn tác" không làm gì (vé đã dùng)
- **Bất biến vi phạm:** A8 (đường về để lại một nút chết), A12
- **Phát hiện:** 2026-10-03 · lượt xanh của `upload.spec.ts` (B-V4-03) đỏ 2/2 ở cú bấm sau hoàn tác
- **Tái hiện bằng tay:** tải ba tệp → xoá `tang-2.png` → bấm "Hoàn tác" và để chuột yên ở đó
  - Kỳ vọng: toast rời đi
  - Thực tế (trước khi sửa): toast đứng mãi (đồng hồ 8 s dừng vì chuột đang trên toast)
- **Tái hiện bằng máy:** `e2e/v4v5/upload.spec.ts` › "B-V4-03: xoá một bản vẽ đã gắn…" — khẳng định
  `toast` `toHaveCount(0)` sau "Hoàn tác"
- **Gốc:** `src/components/feedback/Toast.tsx` `ToastItem` — `onUndoClick` gọi `onUndo` mà không
  đóng toast; đồng hồ đếm lùi dừng khi `isHovered`
- **Sửa:** `onUndoClick` cho toast rời đi (`setIsExiting` + `onRemove` sau `durationMs('fast')`) ·
  bài đơn vị `Toast.test.tsx` "bấm "Hoàn tác" thì toast rời đi…". Tệp dùng chung (84 nơi nhập) —
  đổi ở một chỗ cho mọi toast hoàn tác. Đã kiểm đỏ trước sửa.

## V5

### B-V5-01 · "Áp dụng tỷ lệ" bấm không làm gì, không nói gì

- **Trạng thái:** đã sửa (`d2264a5`; phần "nói lý do tại chỗ" đã sửa ở `c8bf4ab`, W03)
- **Mức:** cao — màn quyết định độ chính xác của cả mô hình; người dùng tưởng đã áp
- **Bất biến vi phạm:** A11
- **Phát hiện:** 2026-09-30 · plan.md V5 phát hiện 1
- **Tái hiện bằng tay:**
  1. `/projects/project-1/floors/L2/scale` (vào thẳng, kho rỗng)
  2. Kéo một đoạn trên bản vẽ → "Chiều dài thật" = 4800 → "Áp dụng tỷ lệ"
  - Kỳ vọng: "Đã áp tỷ lệ cho bản vẽ" + hoàn tác
  - Thực tế (trước sửa): "Chưa nạp dữ liệu không gian của tầng này, nên chưa áp được tỷ lệ."
- **Tái hiện bằng máy:** `e2e/v4v5/scale.spec.ts` › "B-V5-01: vào thẳng route, áp tỷ lệ xong thì màn nói…"
  `E2E_PORT=5193 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v4v5/scale.spec.ts -g "B-V5-01"` — **đã kiểm đỏ trước sửa**.
  Bài "kho chưa có tầng thì nói lý do" của W03 đã bỏ khỏi e2e: nhánh ấy nay chỉ tới được khi N16
  hỏng, bộ mẫu không làm N16 hỏng và `page.route` không bắt được client giả — nó sống ở bài đơn vị.
- **Gốc:** hai lớp. (1) Route không nạp đồ thị: `onApply` (`useScaleCalibration.ts`) đọc
  `store.spatial` mà không ai nạp. (2) Ở bộ mẫu, N16 trả tầng `L2` với mã `Level` = `'L2'` — không
  phải `LevelId` hợp lệ ⇒ `isEntityOfKind('level', …)` sai ⇒ vẫn "chưa nạp" dù kho đã có tầng (đo
  bằng trình duyệt thật: kho có `byKind.level = ['L2']`, màn vẫn báo chặn).
- **Sửa:**
  - `scaleCalibrationGateway.ts`: thêm `readFloorLayer` = `readFloorLayerGraph(client.spatial, …)`.
  - `useScaleCalibration.ts`: `useQuery` khoá `queryKeys.space.byFloor(floorId)` (cùng khoá màn QC);
    kho rỗng thì `setSpatial(loaded)` — cùng khuôn `useWallLayerReview.ts`; `levelId` = mã tầng N16
    trả (rơi về mã route khi chưa đọc xong), dùng cho `storedRatio`, `onApply`, tự lưu. Trên BE
    ánh xạ này là đồng nhất (hai mã trùng); nó cần cho bộ mẫu.
  - `src/api/__mocks__/client.ts` (**ngoài nhóm**): tầng ngoài bộ mẫu A14 nhận mã `Level` hợp lệ
    (`L2` → `L-00000000L2`) thay vì mã tầng ép kiểu — ánh xạ của RIÊNG bộ mẫu, ghi rõ trong chú thích.
  - Bài đơn vị: `useScaleCalibration.test.ts` "kho rỗng thì nạp tầng qua N16, và áp vào đúng mã
    Level N16 trả…" (đã kiểm đỏ với `levelId = floorId`) và "kho rỗng và N16 hỏng thì… nói lý do";
    `src/api/__tests__/floorLayerGraph.test.ts` "tầng chưa có tài liệu…" nay khẳng định mã `Level`
    hợp lệ và khác mã tầng (đã kiểm đỏ trên mock cũ) — bài này của W04, trước khẳng định đúng giá
    trị lỗi `['L1']`.

### B-V5-02 · Tỷ lệ chỉ sống trong phiên, "Tỷ lệ hiện tại" đổi ngay khi gõ

- **Trạng thái:** ngoài FE
- **Mức:** thấp
- **Phát hiện:** 2026-09-30 · plan.md V5 phát hiện 2
- **Gốc:** `persistScale: false` ở cổng thật (không có endpoint lưu tỷ lệ); thanh trạng thái nói
  thật "tỉ lệ chỉ áp trong phiên này, chưa lưu lên máy chủ". "Tỷ lệ hiện tại" hiện tỷ lệ ĐỀ XUẤT
  khi chưa áp (`displayRatio = storedRatio ?? proposedRatio`) — một câu chữ đáng xem lại, không
  sai dữ liệu.
- **Sửa:** chưa — cần endpoint BE; không viết bài.

### B-V5-03 · Sơ đồ xử lý khẳng định "mỗi tầng đang đi một nhánh khác nhau" khi chưa có dữ liệu nào

- **Trạng thái:** đã sửa (`c8bf4ab`)
- **Mức:** thấp — câu sai sự thật ở cả ba vai
- **Bất biến vi phạm:** A11 (trạng thái rỗng nói sai)
- **Phát hiện:** 2026-09-30 · plan.md V5 phát hiện 3
- **Tái hiện bằng máy:** `e2e/v4v5/pipeline-graph.spec.ts` › "B-V5-03: chưa có báo cáo nhánh…"
- **Gốc:** `usePipelineGraph.ts` — `activeBranch === undefined` gộp "chưa có báo cáo" với "nhiều
  nhánh" (`isMixedBranch` đã tính sẵn mà không dùng ở đây)
- **Sửa:** câu riêng `reasonNoReport` "Chưa có lượt xử lý nào, nên chưa biết hồ sơ đi nhánh nào."
  (`pipelineGraphText.ts`) · bài đơn vị `PipelineGraph.test.tsx` "chưa có báo cáo nhánh…". Đã kiểm
  đỏ trước sửa.

### B-V5-04 · Tầng không có trong dự án bị báo "Nắn ảnh thất bại"

- **Trạng thái:** đã sửa (`c8bf4ab`)
- **Mức:** thấp — lỗi đọc bị gọi là lỗi nắn ảnh, dẫn người dùng đi sai hướng
- **Bất biến vi phạm:** A11
- **Phát hiện:** 2026-09-30 · plan.md V5 phát hiện 4
- **Tái hiện bằng máy:** `e2e/v4v5/scale.spec.ts` › "B-V5-04: tầng không có trong dự án…"
- **Gốc:** `ScaleCalibration.tsx` một tiêu đề `error` cố định; `useScaleCalibration.ts` đặt
  `canvas.warpingNotice` cho MỌI `error`
- **Sửa:** lượt đọc hỏng mang `errorTitle` (từ `describeError`, ví dụ "Có trục trặc"), khung vẽ
  chỉ nói "nắn ảnh thất bại" khi ảnh méo thật · bài đơn vị `useScaleCalibration.test.ts` "lượt
  đọc hỏng có tiêu đề riêng…", `ScaleCalibration.test.tsx` "lỗi đọc dùng tiêu đề…". Đã kiểm đỏ
  trước sửa. (Còn: ảnh méo vẫn in "Mã lỗi: UNKNOWN" — mã lấy từ `toAppError(new Error(...))`;
  ghi nhận, chưa sửa.)

### B-V5-05 · Hai quy ước số trên màn tỷ lệ (`4.800 mm` và `1600,00`)

- **Trạng thái:** không phải lỗi
- **Phát hiện:** plan.md V5 phát hiện 5. Dấu chấm là dấu phân nhóm nghìn (được phép, HOP-DONG §2);
  toạ độ con trỏ không phân nhóm. Dấu thập phân đều là phẩy — `scale.spec.ts` khẳng định không có
  `\d\.\d+ mm/px`.

### B-V5-06 · Tên phím viết hai kiểu (`ESCAPE` ở dòng nhắc, `Esc` ở ô phím)

- **Trạng thái:** không phải lỗi
- **Phát hiện:** plan.md V5 phát hiện 6. Dòng nhắc in qua `formatCombo` dùng chung
  (`src/lib/input/shortcutRegistry.ts:160`), cùng kiểu với bảng phím tắt của màn Tài khoản; A6 cho
  phép chữ hoa ở tên phím. Đổi là việc toàn cục, không riêng màn này.

### B-V5-07 · Người xem bấm "Vẫn dùng AI" vẫn được đưa sang màn xử lý

- **Trạng thái:** không phải lỗi
- **Phát hiện:** plan.md V5 phát hiện 7. Thiết kế (`useCadBranchConfirm.ts:19-23`: nhánh AI luôn còn
  đường về); không ghi gì (0 yêu cầu ghi). `cad-confirm.spec.ts` › "vai Người xem…" khẳng định đúng
  hành vi ấy.

### B-V5-08 · `h1` màn nền và `h2` hộp thoại cùng chữ "Phát hiện tệp CAD"

- **Trạng thái:** không phải lỗi
- **Phát hiện:** plan.md V5 phát hiện 8. Hộp thoại lặp tiêu đề màn nó che; chỉ là bẫy mốc neo —
  bài bám `role="dialog"`.

### B-V5-09 · Người xem vẫn thấy nút "Đo lại" ở màn tỷ lệ

- **Trạng thái:** không phải lỗi
- **Phát hiện:** plan.md V5 phát hiện 9. Đo: nút ở trạng thái `disabled` cho người xem (không kéo được
  đoạn nào ⇒ `canRemeasure` luôn sai, `useScaleCalibration.ts`); "Áp dụng tỷ lệ" thì biến hẳn.

### B-V5-10 · `projectScale` với `L1` mở thẳng ra `error`

- **Trạng thái:** không phải lỗi
- **Phát hiện:** plan.md V5 phát hiện 10 / `plan.md:1228`. Đúng thiết kế bộ mẫu (khung `L1` "không tìm
  thấy"); `scale.spec.ts` › "L1: bộ mẫu không tìm thấy khung…" khẳng định nó như một ca `error`
  có chủ đích.

### Phát hiện V4 không thành mục riêng

- **P6** ("màn duy nhất dùng `L-1`"): lỗi tài liệu HOP-DONG, không phải sản phẩm — không phải lỗi.
- **P8** (docblock "route CHƯA đăng ký"): sửa kèm B-V4-01.

## V6

### B-V6-01 · Bảy màn QC treo skeleton / rỗng vĩnh viễn — cổng đọc lại chính cái kho rỗng

- **Trạng thái:** đã sửa — 4 màn V6 (`4da7d91`, `4522575`, W04) · 3 màn V7 (`58822be`, W11)
- **Mức:** cao — người dùng vào thẳng màn duyệt không bao giờ thấy dữ liệu
- **Bất biến vi phạm:** A11
- **Phát hiện:** 2026-09-30 · khảo sát V6 (F1) và V7 (F-Q1); điều tra gốc 2026-10-03
- **Tái hiện bằng tay:**
  1. Mở `/projects/project-1/floors/L-LEVEL000001/layers/rooms` (hay `…/thickness`, hay `/projects/project-1/floors`)
  - Kỳ vọng: 4 phòng (Room 1, 5, 9, 13) / thẻ "12 tổng số đoạn tường" / bảng tầng có nút "Thêm tầng"
  - Thực tế (trước sửa): "chưa dò ra phòng nào" / bốn thẻ "0" / khung xương mãi
- **Tái hiện bằng máy:** `e2e/v7/room-label-review.spec.ts` › "đường nạp thật: mở thẳng ở một tầng có lớp thì
  danh sách hiện các phòng đọc từ máy chủ (V7-ROOMS-01, B-V6-01)"; `e2e/v7/thickness-standardization.spec.ts` ›
  "đường nạp thật: mở thẳng ở một tầng có lớp thì thẻ đếm đọc tường từ máy chủ…"; `e2e/v7/floor-manager.spec.ts` ›
  "đường nạp thật: mở thẳng thì màn không treo khung xương…" (và bốn bài V6 của W04)
  `E2E_PORT=5191 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v7 -g "đường nạp thật"` — đã kiểm đỏ trước sửa
- **Gốc:** cổng mặc định `read: () => useStore.getState().spatial` và `readXLayer: () => Promise.resolve(graph.read())`
  (`roomLabelReviewGateway.ts`, `thicknessStandardizationGateway.ts`); màn tầng trả `graph: graph.read()` trong
  `readFloorList` (`floorManagerGateway.ts`). Không nơi nào nạp kho từ mạng.
- **Sửa:** phòng, độ dày: `readXLayer = graph.read() ?? readFloorLayerGraph(api.spatial, input)` + hook nạp kho từ
  `query.data` (khuôn W04; độ dày thêm tuỳ chọn `apiClient`). Tầng: `readProjectLayerGraph` (`src/api/floorLayerGraph.ts`)
  đọc N16 của từng tầng trong danh sách rồi ghép (`ponytail:` một lượt N16 mỗi tầng; có endpoint cả dự án thì thay
  đúng hàm này); một tầng hỏng thì NÉM → `error` của A11. Kho có thì giữ (không đè sửa chưa lưu) ở cả ba ·
  bài đơn vị `src/api/__tests__/floorLayerGraph.test.ts` (12 → 24: hai cổng V7 vào `describe.each` đọc ×2 bài,
  bốn bài `readProjectLayerGraph`/cổng tầng, `describe.each` lưu ×4 — xem B-V6-03) · commit `58822be`
- **Ghi chú:** kho chỉ giữ MỘT đồ thị (Lưu ý 3 kế hoạch): mở màn tầng sau một màn một-tầng thì màn tầng thấy
  đúng một tầng. Chưa sửa — đổi kiến trúc kho. Ca `error` chỉ phủ ở đơn vị (mock trong tiến trình, `page.route`
  không chặn được).

### B-V6-02 · Toast xoá tường lộ mã máy `W-000001WALL` trong khi danh sách gọi nó `#W-001`

- **Trạng thái:** đã sửa (`4522575`)
- **Mức:** trung bình — người duyệt không đối chiếu được toast với hàng vừa xoá
- **Bất biến vi phạm:** A6, mục B (thứ của lập trình viên lên màn)
- **Phát hiện:** 2026-09-30 · khảo sát V6 (F4)
- **Tái hiện bằng tay:** màn tường (bộ mẫu riêng), chọn `#W-001`, `Backspace` — Kỳ vọng "Đã xoá tường #W-001."
  · Thực tế (trước sửa): "Đã xoá tường W-000001WALL."
- **Tái hiện bằng máy:** `e2e/v6/wall-layer-review.spec.ts` › "[bơm] toast xoá gọi tường bằng nhãn của danh
  sách…" — đã kiểm đỏ trước sửa
- **Gốc:** `wallLayerReviewGateway.ts` `deleteToastDescription = (wallId) => "Đã xoá tường ${wallId}."`
- **Sửa:** dùng nhãn của danh sách (cùng bảng mã với hàng, xem B-V6-09) · bài `useWallLayerReview.test.ts`
  · commit `4522575`. Cùng họ ở V7: `R-000001ROOM` của phòng (F-R1) — không sửa ở đây.

### B-V6-03 · Màn QC không bao giờ tự lưu; "Có thay đổi chưa lưu" ở lại mãi

- **Trạng thái:** đã sửa cho tường, đối tượng, phòng, độ dày (`58822be`) · **ngoài FE** cho kích thước và trục (B-V7-22)
- **Mức:** cao — mọi công duyệt mất khi tải lại trang
- **Bất biến vi phạm:** A7
- **Phát hiện:** 2026-09-30 · khảo sát V6 (F3/P3)
- **Tái hiện bằng tay:**
  1. Mở `/projects/project-1/floors/L-LEVEL000001/layers/walls`, chọn một tường, `Backspace`, đợi 2 s
  - Kỳ vọng: thanh trạng thái "Đã lưu lúc HH:mm"
  - Thực tế (trước sửa): "Có thay đổi chưa lưu" mãi; màn đối tượng im lặng; phòng/độ dày nói "Lưu thất bại…" sau 65 s
- **Tái hiện bằng máy:**
  - `e2e/v6/wall-layer-review.spec.ts` › "xoá một tường thì hệ thống tự lưu và thanh trạng thái nói "Đã lưu lúc …" (A7, B-V6-03)"
  - `e2e/v6/object-layer-review.spec.ts` › "[bơm] duyệt một đối tượng thì hệ thống tự lưu và trình đọc màn hình nghe…"
  - `e2e/v7/room-label-review.spec.ts` › "đường nạp thật: đổi tên phòng thì hệ thống tự lưu…"
  `E2E_PORT=5191 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v6 e2e/v7 -g "tự lưu"` — đã kiểm đỏ trước sửa (cả ba; phòng kiểm
  cô lập bằng cách tạm cho `persistRoomLabels` ném trên mã mới)
- **Gốc:** cổng thật trả `unsupported('persistX')` cho `persistWallLayer`, `persistObjectLayer`, `persistRoomLabels`,
  `persistThicknessStandardization`. Thêm hai lỗi ẩn sau nó, lộ ra ngay khi lưu chạy thật:
  (a) `useWallLayerReview.ts` dựng engine ngoài sổ Ctrl+S (`useFlushOnSave` vắng — W05 ghi B-V7-01 (b));
  (b) màn đối tượng gửi một lượt ghi lạc quan cho MỖI lệnh (`createObjectLayerMutation`) và hoàn tác lệnh khi lượt
  ghi hỏng — với #35 có version, hai lượt duyệt liền tay là hai `PUT` cùng `baseVersion`, lượt sau 409, công duyệt bị gỡ.
- **Sửa:** `createFloorLayerSave` (`src/lib/autosave/spatialLayerSave.ts`): `PUT` lớp của ĐÚNG tầng URL
  (`spatialLayerOf`, chuyển từ `propertyInspectorGateway.ts` xuống `lib` để dùng chung), `baseVersion` lấy từ N16 ở
  lượt đầu rồi từ `revision` vừa ghi (`ponytail:` lượt đầu không thấy một lượt sửa của người khác xảy ra giữa lúc nạp
  và lúc lưu — cùng trần với PropertyInspector); **không ghi** khi đồ thị không có tầng của URL (một `PUT` rỗng là xoá
  sạch tầng); `HttpError` đi theo `cause` để `isTransientWireError` dừng ở 409/422 thay vì thử lại. Bốn cổng gọi nó; bốn
  danh sách `*_MISSING_CAPABILITIES` ngắn đi. Màn tường thêm `useFlushOnSave`. Màn đối tượng bỏ lượt ghi lạc quan (xoá
  `createObjectLayerMutation` + bài `nullGraph` của nó) để dùng khuôn tự lưu 800 ms + `useFlushOnSave` + `useSaveIndicator`;
  hoàn tác cũng báo tự lưu. Bài đơn vị: `spatialLayerSave.test.ts` (+3), `floorLayerGraph.test.ts` (`describe.each` lưu
  ×4), `useWallLayerReview.test.ts` (+1 Ctrl+S), `useObjectLayerReview.test.ts` (+3: một lượt cho hai thao tác liền tay,
  Ctrl+S, lượt lưu hỏng không gỡ thao tác) — cả bốn bài hook đã kiểm đỏ trên hook cũ · commit `58822be`
- **Ghi chú:** câu "Lưu thất bại…" (B-V7-02) không còn dựng được trên e2e (mock trong tiến trình luôn lưu được) —
  bài đơn vị `useSaveIndicator.test.ts` vẫn giữ nó.

### B-V6-04 · Nhãn A6 không nhất quán trong nhóm: "Ẩn lớp Tường" viết hoa giữa câu

- **Trạng thái:** chờ quyết — theo Q10f (luật "viết thường kiểu câu" chỉ có ở `CLAUDE.md`; việc riêng)
- **Mức:** thấp
- **Bất biến vi phạm:** A6 (nếu luật được nâng lên tài liệu ưu tiên cao)
- **Phát hiện:** 2026-09-30 · khảo sát V6 (F7/P5)
- **Tái hiện bằng tay:** màn tường: `Ẩn lớp Tường`, `Cây lớp`, `Duyệt lớp tường`; kích thước `Bản vẽ lớp kích
  thước OCR`; trục `Căn chỉnh tự động`; ngược lại đối tượng `Ẩn lớp cửa đi`, `cây lớp`
- **Tái hiện bằng máy:** `e2e/v6/wall-layer-review.spec.ts` › `test.fixme` "[bơm] nút ẩn lớp viết thường kiểu câu…" —
  đã bật tạm: đỏ đúng lý do (không có nút "Ẩn lớp tường")
- **Gốc:** tên lớp trong cây viết hoa đầu (`Tường`) rồi ghép vào "Ẩn lớp …"
- **Sửa:** chưa

### B-V6-05 · Ghi chú lớp 1 ghi "NOT FOUND" cho ba chuỗi có thật (P4)

- **Trạng thái:** không phải lỗi (sản phẩm) — chỗ thiếu của ghi chú khảo sát
- **Phát hiện:** 2026-09-30 · P4 của kế hoạch
- **Phép đo đã bác:** "Có thay đổi chưa lưu" = `vi.json:68` → `useSaveIndicator.ts:55`; "Thêm trục ngang/dọc"
  = hằng ở `useAxisGridManager.ts:155`; nhãn nhóm đối tượng = `ObjectLayerToolRail.tsx:130`. Cả ba hiện đúng
  trên trình duyệt (đo 2026-10-03).

### B-V6-06 · Vùng trạng thái biến mất sau `Ctrl+Z` ở màn kích thước (F6/P7)

- **Trạng thái:** không phải lỗi
- **Phát hiện:** 2026-09-30 · khảo sát V6, trên bộ mẫu CHUNG
- **Phép đo đã bác:** với dữ liệu nạp thật (tầng A14 `L-LEVEL000001`, sau B-V6-09): duyệt `#M-002` → "1/9 kích
  thước đã duyệt"; `Ctrl+Z` → "0/9" hiện lại. Bài `e2e/v6/dimension-ocr-review.spec.ts` › "nút duyệt của một
  dòng duyệt đúng dòng ấy, và Ctrl+Z trả lại bộ đếm" xanh hai lượt. F6 là hệ quả của nhãn trùng (B-V6-09).

### B-V6-07 · Mô tả ảnh nền "Bản vẽ gốc của L-000001LVL0" lộ mã tầng

- **Trạng thái:** không phải lỗi (bộ mẫu dev)
- **Phát hiện:** 2026-10-03 · bộ dò trình duyệt
- **Phép đo đã bác:** chuỗi ghép từ `Floor.name` (`backgroundImageAlt`, `wallLayerReviewGateway.ts`); mã chỉ hiện
  vì tầng ấy không có trong bộ mẫu API nên `readFloor` dựng tầng dự phòng với `name = floorId`
  (`src/api/__mocks__/client.ts` `makeFallbackFloor`). Tầng có thật mang tên tầng.

### B-V6-08 · Ray công cụ 3D quảng cáo phím R·H·C·V mà không phím nào chạy

- **Trạng thái:** đã sửa (`a5e2dbc`)
- **Mức:** trung bình — người dùng bàn phím thử phím được dạy rồi tưởng màn treo
- **Bất biến vi phạm:** A12
- **Phát hiện:** 2026-10-01 · Q10e (đo trên `projectMeasure`); đo lại 2026-10-03 trên `/3d`
- **Tái hiện bằng tay:** `/projects/project-1/3d`, bấm `c` — Kỳ vọng nút "mặt cắt (C)" bật · Thực tế (trước sửa):
  không gì đổi; chỉ `m` chạy
- **Tái hiện bằng máy:** `e2e/v6/viewer-tool-keys.spec.ts` › "mỗi phím đơn mà ray công cụ 3D ghi trong nhãn đều
  chọn đúng công cụ ấy" (đọc nhãn trên màn, tự phủ công cụ thêm sau) — đã kiểm đỏ trước sửa ("phím V")
- **Gốc:** `useViewerShell.ts` `VIEWER_TOOLS` viết cứng `keyLabel: 'R'|'H'|'C'|'V'`; `buildViewerShortcuts`
  chỉ đăng ký `M`. **Không** phải `TOOL_SHORTCUTS` (`lib/tools/shortcuts.ts`) như Q10e ghi — bảng ấy là của máy
  công cụ 2D và chỉ bản demo `AppShell` đọc.
- **Sửa:** bảng `TOOL_COMBOS` (`viewerShellShortcuts.ts`) làm nguồn cho cả nhãn lẫn binding; `activateMeasure` →
  `activateTool(id)`, chỉ bật công cụ có trong ray · bài `ViewerShell.test.tsx` (+3, đã kiểm đỏ) · commit `a5e2dbc`.
  **Tệp ngoài nhóm:** ba tệp `src/screens/viewer/ViewerShell/*` — đã báo điều phối viên (W06 đang ở vỏ 3D).

### B-V6-09 · Nhãn mã của màn QC trùng nhau với id của BE (ULID) và id bộ mẫu A14

- **Trạng thái:** đã sửa — 3 màn V6 (`4522575`, W04) · phòng, độ dày, sửa hình học tường (`58822be`, W11)
- **Mức:** cao — trên dữ liệu thật mọi hàng một lượt pipeline cùng nhãn
- **Bất biến vi phạm:** A11, A5
- **Phát hiện:** 2026-10-03 · đường nạp thật
- **Tái hiện bằng tay:** mở `/projects/project-1/floors/L-LEVEL000001/layers/rooms` — Kỳ vọng `#R-001`…`#R-004` ·
  Thực tế (trước sửa): bốn hàng cùng `#R-ROOM00` (mã `R-ROOM0000010`… có chỉ số đứng SAU)
- **Tái hiện bằng máy:** `e2e/v7/room-label-review.spec.ts` › "đường nạp thật: mỗi phòng một mã hiển thị riêng, theo
  thứ tự tạo (B-V6-09)" — đã kiểm đỏ CÔ LẬP (trên mã mới, tạm bỏ bảng `displayCodesOf` khỏi `roomCodeLabel`).
  Độ dày và sửa hình học tường: không có bài e2e (độ dày qua N16 cho 12 tường cùng nhóm chuẩn — không hàng nào hiện
  mã; màn sửa hình học là của nhóm V8) — phủ ở đơn vị.
- **Gốc:** ba bản chép hàm cắt sáu ký tự đầu thân mã (`roomDisplayCode`, `wallDisplayCode` ×2).
- **Sửa:** `displayCodesOf` trên cả danh sách cùng loại: phòng của tầng (`roomCodeLabel(id, codes)`, hàng, ảnh cắt,
  ứng viên gộp, xem trước chuẩn hoá), mọi tường trong kho (độ dày, `toSegmentRows` nhận `codes`), tường cùng tầng (sửa
  hình học, `wallCodesOnLevel`). Xoá hai bản chép ở độ dày và sửa hình học. Khoá dòng/khoá tra vốn đã dùng id thực
  thể ở cả ba màn (soát lại, không có chỗ nào dùng nhãn) · bài đơn vị `useRoomLabelReview.displayCodes.test.ts`,
  `useThicknessStandardization.displayCodes.test.ts`, `useWallGeometryEditor.displayCodes.test.ts` (đã kiểm đỏ:
  `expected 1 to be 3` ×2, `'Đang sửa: W-WALL00'`) · commit `58822be`
- **Còn lại:** câu lệnh/toast (`approveDescription` "Duyệt tên phòng #R-…", ~40 câu `src/lib/commands/business/*`) vẫn
  dùng nhãn cắt chuỗi — đó là B-V7-05 (mở), cần hàm mã hiển thị dùng chung ở tầng lệnh.

### B-V6-10 · Màn đối tượng: ba nút "chọn nhóm" bị khoá cho tới khi đã chọn một nhóm bằng bàn phím

- **Trạng thái:** đã sửa (`4522575`)
- **Mức:** trung bình — người dùng chuột không chọn được nhóm cửa đi/cửa sổ/nội thất
- **Bất biến vi phạm:** A12 (điều khiển nhìn thấy mà không dùng được)
- **Phát hiện:** 2026-10-03 · bộ dò trình duyệt (`disabled` trên cả ba nút lúc mở màn; bấm `d` thì mở khoá)
- **Tái hiện bằng tay:** màn đối tượng (bộ mẫu riêng), di chuột lên "chọn nhóm cửa đi (phím D)" — nút xám, bấm không được
- **Tái hiện bằng máy:** `e2e/v6/object-layer-review.spec.ts` › "[bơm] ba nút "chọn nhóm" bấm được bằng chuột ngay
  từ đầu (B-V6-10)" — đã kiểm đỏ trước sửa
- **Gốc:** `ObjectLayerToolRail.tsx` `disabled={activeLayer === null}` — nút chọn nhóm khoá vì chưa nhóm nào được chọn
- **Sửa:** bỏ điều kiện · bài `ObjectLayerReview.test.tsx` (+1, đã kiểm đỏ) · commit `4522575`

### B-V6-11 · Màn tường: Escape không bỏ chọn, không bỏ nét đang vẽ dở

- **Trạng thái:** đã sửa (`4522575`)
- **Mức:** trung bình
- **Bất biến vi phạm:** A12 ("Esc đóng lớp trên cùng"; `RESERVED_KEYS`: Escape bỏ cử chỉ đang dở)
- **Phát hiện:** 2026-10-03 · bộ dò trình duyệt (đối tượng/kích thước bỏ chọn được, tường thì không)
- **Tái hiện bằng tay:** màn tường, bấm một hàng, `Escape` — hàng vẫn được chọn
- **Tái hiện bằng máy:** `e2e/v6/wall-layer-review.spec.ts` › "[bơm] Escape bỏ chọn tường (B-V6-11)" — đã kiểm đỏ
- **Gốc:** `useWallLayerReview.ts` không đăng ký `Escape`; không chỗ nào gửi sự kiện `cancel` cho máy công cụ
- **Sửa:** binding `wallLayerReview.closeTopLayer` (chỉ bật khi có nét dở hoặc có chọn — không nuốt
  `global.closeTopLayer`) · bài `useWallLayerReview.test.ts` (+2, đã kiểm đỏ) · commit `4522575`

### B-V6-12 · Ray công cụ tường/đối tượng không nói công cụ nào đang bật (`aria-pressed` vắng)

- **Trạng thái:** đã sửa (`58822be`)
- **Mức:** thấp — trình đọc màn hình không biết công cụ đang bật
- **Bất biến vi phạm:** A12 (khả năng tiếp cận)
- **Phát hiện:** 2026-10-03 · bộ dò trình duyệt (W04)
- **Tái hiện bằng tay:** màn tường, bấm `w` — Kỳ vọng nút "vẽ tường (phím W)" `aria-pressed="true"` · Thực tế (trước
  sửa): không phần tử nào mang `aria-pressed`
- **Tái hiện bằng máy:** `e2e/v6/wall-layer-review.spec.ts` › "[bơm] phím W bật công cụ vẽ và ray nói ra công cụ đang
  bật bằng aria-pressed (B-V6-12)" — bỏ `fixme`, đã kiểm đỏ trước sửa
- **Gốc:** `src/components/ui/IconButton.tsx` nhận `isActive` mà không phát `aria-pressed`
- **Sửa:** `aria-pressed={isActive}` — trừ khi nút khai `aria-expanded` (nút mở/đóng, vd `FloorUploadCard.tsx`, không
  phải nút bật); `isActive` vắng thì không phát gì (nút thường không thành nút bật). Chín nơi gọi có `isActive` đều là
  ray công cụ / nút bật, đã soát · bài `IconButton.test.tsx` (+2, đã kiểm đỏ: 1 failed trên bản cũ) · commit `58822be`

### B-V6-13 · Màn đối tượng chỉ hiện đối tượng có trong bảng mẫu cứng; dữ liệu thật vô hình

- **Trạng thái:** chờ quyết (điều phối viên đưa lên người dùng)
- **Mức:** cao — ô mở/nội thất thật không bao giờ hiện; dòng "mồ côi" của bộ mẫu (#D-009) hiện trên mọi tầng
- **Bất biến vi phạm:** A11, A5 (duyệt một thứ không có)
- **Phát hiện:** 2026-10-03 · đường nạp thật mới
- **Tái hiện bằng tay:** `/projects/project-1/floors/L-LEVEL000001/layers/objects` — đồ thị có 2 cửa đi + 2 cửa sổ +
  5 bàn; màn hiện đúng một dòng "#D-009 — 0/1, Chưa gắn vào tường nào" lấy từ bảng mẫu
- **Tái hiện bằng máy:** `e2e/v6/object-layer-review.spec.ts` › `test.fixme` "đường nạp thật: màn liệt kê đúng ô mở
  và nội thất…" — đã bật tạm: đỏ đúng lý do (không có "0/9 đối tượng đã duyệt")
- **Gốc:** `objectsOf` (`objectLayerReviewGateway.ts:1456`) lặp `OBJECT_LAYER_SEED`, không lặp đồ thị; dòng seed có
  `tracedCentre` mà đồ thị không có thì vẫn được đẩy vào (`orphanObjectOf`).
- **Đề xuất cho người dùng chọn:**
  - (a) ánh xạ kind miền → 8 loại con hiện có: ô mở `door` + `swing: double` → `doubleDoor`, `door` khác →
    `singleDoor`, `window` → `window`; nội thất `bed` → `bed`, `table` → `diningTable`; `chair`, `wardrobe`,
    `kitchenCabinet`, `stair`, `other` **không có** loại con;
  - (b) thêm nhóm/loại con "khác" cho mọi kind không ánh xạ được (không ẩn — ẩn là chính lỗi này);
  - (c) `sanitaryFixture` → `toilet` hay `basin` (miền không phân biệt hai thứ).
  Sau khi chốt: danh sách dựng từ đồ thị, bảng mẫu chỉ còn là siêu dữ liệu tuỳ chọn.
- **Sửa:** chưa

### B-V6-14 · Màn trục sẽ luôn rỗng trên BE thật — N16 v1 trả `axes: []`

- **Trạng thái:** ngoài FE (chủ: BE)
- **Mức:** trung bình — trên máy chủ thật màn trục luôn "chưa có trục nào", kể cả khi pipeline dò được trục
- **Phát hiện:** 2026-10-03 · đọc mã BE `apps/api/spatial_read/router.py` (`axes=[]` cố định) và docstring
  `AxisOut` "v1 danh sách luôn rỗng"
- **Tái hiện bằng máy:** không có — bộ mẫu dev cố ý phục vụ trục của bộ A14 để màn dùng được ở dev (ghi trong
  docblock `makeLayerDocument`)
- **Gốc:** BE chưa lưu/trả trục ở N16; `persistAxisLayer` của FE cũng chưa có đường (B-V6-03)
- **Sửa:** chưa — việc của BE

## V7

### B-V7-01 · Phòng và độ dày tự lưu mà câm

- **Trạng thái:** đã sửa (`8219876`, W05) — bài e2e đổi theo B-V6-03
- **Mức:** trung bình · **Bất biến vi phạm:** A7 · **Phát hiện:** 2026-09-30 · đọc mã (Q13)
- **Tái hiện bằng máy:** `e2e/v7/room-label-review.spec.ts` › "đường nạp thật: đổi tên phòng thì hệ thống tự lưu và
  trình đọc màn hình nghe "Đã lưu lúc …" (A7, B-V6-03, B-V7-01)" — thay bài cũ khẳng định câu "Lưu thất bại" (lượt lưu
  nay thành công thật, nên trình đọc màn hình nghe "Đã lưu lúc …").
- **Còn lại của W05 (a)–(d):** (b) màn tường vào sổ Ctrl+S — **đã làm** (B-V6-03). (a) chữ nhìn thấy được ở phòng/độ dày,
  (c) ba màn cài đặt, (d) lớp lỗi riêng cho "chưa có đầu máy chủ" — chưa; (d) nay chỉ còn chạm kích thước/trục.

### B-V7-02 · Lưu thất bại thì câu báo bảo "lưu lại thủ công" — mà không có nút lưu nào

- **Trạng thái:** đã sửa (`8219876`)
- **Mức:** trung bình — câu duy nhất hệ thống nói lúc mất dữ liệu chỉ tới một việc không làm được
- **Bất biến vi phạm:** A7
- **Phát hiện:** 2026-09-30 · đọc mã (Q10d)
- **Tái hiện bằng tay:** đưa một engine tự lưu vào `failed` (vd. màn phòng sau B-V7-01, đợi hết lịch thử lại) — câu nghe là "Lưu thất bại sau nhiều lần thử. Chỉnh sửa hoặc lưu lại thủ công."
- **Tái hiện bằng máy:** Q10d chốt **tầng đơn vị**: `src/hooks/useSaveIndicator.test.ts` › "never tells the user to save by hand when saving failed (A7)" — **đã kiểm đỏ trước sửa** (3 failed trên chuỗi cũ). Bài e2e của B-V7-01 khẳng định đúng câu mới (đọc từ `vi.json`).
- **Gốc:** `src/i18n/vi.json` `autosave.failed`.
- **Sửa:** "Lưu thất bại. Hệ thống sẽ thử lưu lại ở lần chỉnh sửa tới." — đúng với `createAutosave` (`notifyChange` kéo `failed` về `dirty`). Không nhắc Ctrl+S: Ctrl+S chỉ với tới màn đã vào sổ (B-V7-01 c).

### B-V7-03 · Mở lại hộp thoại "Gộp hai phòng" ở phòng khác thì ứng viên cũ vẫn được chọn ngầm, nút xác nhận bật

- **Trạng thái:** đã sửa (`8219876`)
- **Mức:** trung bình — A9 bắt người dùng tự chọn trước một việc khó hoàn tác; ở đây lựa chọn của câu hỏi TRƯỚC (có khi chính là phòng đang chọn) bị đem sang câu hỏi sau
- **Bất biến vi phạm:** A9
- **Phát hiện:** 2026-10-03 · đọc mã (tranh luận hai vai) · dựng lại bằng trình duyệt
- **Tái hiện bằng tay:**
  1. Bơm bộ mẫu, chọn `#R-001`, "Gộp phòng", chọn `#R-002 · phòng ngủ 3`, "Huỷ"
  2. Chọn `#R-002`, "Gộp phòng"
  - Kỳ vọng: ô chọn hiện "Chọn phòng", nút "Gộp hai phòng" tắt
  - Thực tế (trước khi sửa): nút "Gộp hai phòng" BẬT — ứng viên ngầm là `#R-002`, chính phòng đang chọn
- **Tái hiện bằng máy:** `e2e/v7/room-label-review.spec.ts` › "bơm bộ mẫu: mở lại hộp thoại gộp ở phòng khác thì không còn chọn sẵn ứng viên cũ (B-V7-03, A9)" — **đã kiểm đỏ trước sửa** (`toBeDisabled` nhận enabled).
- **Gốc:** `RoomLabelInspector.tsx` — `mergeCandidateId` là state của thanh tra, không reset khi hộp thoại mở lại hay khi đổi phòng (thanh tra không mang `key` theo phòng).
- **Sửa:** nút "Gộp phòng" đặt `mergeCandidateId` về `null` trước khi mở. Bài đơn vị `RoomLabelReview.test.tsx` › "không chọn sẵn ứng viên của lần hỏi trước…" — đã kiểm đỏ trước sửa. (F-Q4 — "tầng đơn vị không có bài chạy hộp thoại gộp" — lấp bằng chính bài này.)

### B-V7-04 · Ctrl+Z ngay sau khi dữ liệu nạp vào làm màn trống trơn

- **Trạng thái:** đã sửa (`8219876`)
- **Mức:** trung bình — một phím trả màn về "chưa dò ra phòng nào". Hôm nay chỉ chạm được qua cửa bơm, nhưng đó đúng là đường mọi màn QC nạp đồ thị (`setSpatial(seed)`), nên ngày B-V6-01 có đường nạp thật thì người dùng chạm được
- **Bất biến vi phạm:** A8 (hoàn tác trả một THAY ĐỔI của người dùng, không phải lượt nạp), A11
- **Phát hiện:** 2026-09-30 · đo ở thickness (F-T1)
- **Tái hiện bằng tay:**
  1. Mở `projectRooms`, bơm bộ mẫu (14 phòng)
  2. Bấm ra ngoài ô nhập, Ctrl+Z
  - Kỳ vọng: không gì đổi (chưa có thay đổi nào của người dùng)
  - Thực tế (trước khi sửa): 0 phòng, màn về trạng thái rỗng
- **Tái hiện bằng máy:** `e2e/v7/room-label-review.spec.ts` › "bơm bộ mẫu: Ctrl+Z ngay sau lượt nạp không trả màn về rỗng (B-V7-04)" — **đã kiểm đỏ trước sửa** (mong 14, nhận 0).
- **Gốc:** `src/store/spatialSlice.ts` `setSpatial` — `zundo` ghi MỌI `set` của `spatial`, kể cả lượt nạp, thành một bước (`pastStates` = 1 sau nạp).
- **Sửa:** `setSpatial` xoá lịch sử `temporal` sau khi đặt đồ thị mới. Bài đơn vị `src/store/__tests__/slices.test.ts` › "leaves no undo step behind…" — đã kiểm đỏ trước sửa. Chạy lại 86 tệp / 1236 bài (store + mọi màn QC/viewer/pipeline/rules + hooks): xanh. Ràng buộc 3 của `plan.md` 6.1 và docblock `e2e/fixtures/seedSpatial.ts` hết lý do (xem "Chỗ kế hoạch sai").

### B-V7-05 · Toast đổi tên phòng lộ mã máy `R-000001ROOM`, trong khi danh sách gọi phòng ấy là `#R-001`

- **Trạng thái:** mở
- **Mức:** thấp — người đọc toast không nối được câu với hàng trong danh sách; cùng họ W-3 của tường
- **Bất biến vi phạm:** A6 (mã hiển thị)
- **Phát hiện:** 2026-09-30 · ghi chú V7 (F-R1); đo lại 2026-10-03: toast "Đổi tên phòng R-000001ROOM từ "phòng khách chung" thành "Phòng thử e2e", diện tích 17,00 m²."; câu nhắc luật (ROOM-NOT-CLOSED…) cũng lộ `R-000001ROOM`; độ dày có `Chọn dòng W-000032THIK`
- **Tái hiện bằng tay:** bơm bộ mẫu, đổi tên `#R-001`, đọc toast
- **Tái hiện bằng máy:** `e2e/v7/room-label-review.spec.ts` › "bơm bộ mẫu: toast đổi tên gọi phòng bằng mã hiển thị #R-001, không lộ mã máy R-000001ROOM (B-V7-05, A6)" — `test.fixme`; đã bật tạm: đỏ đúng chỗ (`toContainText("Đổi tên phòng R-001 từ")`).
- **Gốc:** `src/lib/commands/business/roomFloorCommands.ts:230` dùng `room.id`; cùng khuôn ở ~40 câu của `src/lib/commands/business/*` và câu luật.
- **Sửa:** chưa — cần MỘT hàm mã hiển thị dùng chung ở tầng lệnh, chốt cùng nhóm V6 (W-3) để không ra hai bộ định dạng. `roomDisplayCode` đang ở cổng màn (`roomLabelReviewGateway.ts:398`), tầng `lib` không nhập được.

### B-V7-06 · Ctrl+Z trong ô "Tên phòng" không hoàn tác lượt đổi tên

- **Trạng thái:** không phải lỗi
- **Phát hiện:** 2026-09-30 · ghi chú V7 (F-R3)
- **Phép đo đã bác:** sau Enter, Ctrl+Z trong ô trả CHỮ của ô về "phòng khách chung" (hoàn tác văn bản của chính ô — quy ước nền tảng của mọi ô nhập); danh sách giữ tên mới cho tới khi ô được xác nhận. Rời ô rồi Ctrl+Z thì hoàn tác thao tác đúng (`V7-ROOMS-04`, xanh). Đổi điều này là cướp phím hoàn tác chữ của ô nhập — ngược A12.

### B-V7-07 · "Áp dụng" chuẩn hoá độ dày không đổi gì

- **Trạng thái:** không phải lỗi
- **Phát hiện:** 2026-09-30 · ghi chú V7 (F-T2, "nghi")
- **Phép đo đã bác:** tích ô đồng ý bằng Space, "Xem trước", "Áp dụng" (`exact`) ⇒ "đã ở đúng nhóm chuẩn" 3 → 33, nhóm 220 mm 1 → 31 tường, toast "Chuẩn hoá độ dày 30 tường." + "Hoàn tác" trả về 3 (`V7-THICK-05`, xanh). Lượt đo cũ `check({force:true})` một ô `sr-only` mà khối vẽ (trong `<label>`) đè lên, rồi bấm nhầm nút. Cho người viết bài: `getByRole('checkbox').click()` ở ô này hết hạn vì khối đè — dùng Space hoặc bấm nhãn.

### B-V7-08 · Lệnh phòng bị từ chối (gộp, đổi tên trùng…) thì không một chữ nào — bấm xác nhận và không thấy gì xảy ra

- **Trạng thái:** đã sửa (`8219876`)
- **Mức:** cao — người duyệt xác nhận gộp, hộp thoại đóng, 14 phòng vẫn 14, không lý do: không biết lệnh đã chạy chưa, càng không biết phải sang lớp tường sửa gì
- **Bất biến vi phạm:** A11 (thất bại phải nói ra), A9 (hỏi xong phải có kết cục)
- **Phát hiện:** 2026-10-03 · trình duyệt (bài đo V7-ROOMS-05)
- **Tái hiện bằng tay:**
  1. Bơm bộ mẫu, chọn `#R-001`, "Gộp phòng", chọn `#R-002 · phòng ngủ 3`, "Gộp hai phòng"
  - Kỳ vọng: toast nói vì sao chưa gộp được
  - Thực tế (trước khi sửa): hộp thoại đóng, không toast, vẫn 14 phòng
- **Tái hiện bằng máy:** `e2e/v7/room-label-review.spec.ts` › "bơm bộ mẫu: xác nhận gộp mà lệnh bị từ chối thì toast nói lý do, không phòng nào mất (V7-ROOMS-05, B-V7-08)" — **đã kiểm đỏ trước sửa** (toast không chứa câu lý do).
- **Gốc:** `useRoomLabelReview.ts` `run` — cổng đã soạn sẵn câu từ chối (`ROOM_LABEL_TEXT`: "Chưa gộp được: …", "Chưa đọc được đồ thị tường…"), nhưng sáu nơi gọi `run` gập `CommandResult` thành `Command | null`, và nhánh `dispatch` thất bại cũng `return null` im lặng.
- **Sửa:** `run` nhận `CommandResult`; bị từ chối ở bước dựng hay ở `dispatch` thì đăng một toast (loại `<type>.refused`, không vé hoàn tác) mang lý do — khuôn `useObjectLayerReview.ts`. Bài đơn vị `useRoomLabelReview.test.ts` › "gộp khi chưa đọc được tường: toast nói lý do…". Ghi thêm: màn độ dày có cùng khuôn im lặng ở `runBatch` (nhánh `!result.ok`) — chưa dựng lại được trên trình duyệt nên chưa sửa.

### B-V7-09 · Hoàn tác đổi tên bằng toast thì phòng bị bỏ chọn, thanh tra đóng lại

- **Trạng thái:** mở
- **Mức:** thấp — tên về đúng, nhưng người duyệt mất chỗ đang làm
- **Bất biến vi phạm:** A8 (hoàn tác trả lại trạng thái lúc thao tác, gồm vùng chọn — S-06)
- **Phát hiện:** 2026-10-03 · trình duyệt (lượt đầu của V7-ROOMS-03 đỏ ở ô "Tên phòng")
- **Tái hiện bằng tay:** bơm bộ mẫu, chọn `#R-001`, đổi tên, bấm "Hoàn tác" trên toast ⇒ ô "Tên phòng" biến mất
- **Tái hiện bằng máy:** `e2e/v7/room-label-review.spec.ts` › "bơm bộ mẫu: hoàn tác đổi tên bằng toast giữ nguyên phòng đang chọn (B-V7-09)" — `test.fixme`; đã bật tạm: đỏ đúng chỗ (ô "Tên phòng" not found).
- **Gốc:** `selectionBefore` của bộ ghi lệnh trả `selectionBeforeRef` — vùng chọn TRƯỚC lần chọn phòng gần nhất (`onSelect`), không phải lúc lệnh chạy. Cùng khuôn ở `useWallLayerReview.ts:708-744`, `useThicknessStandardization.ts:446-572`.
- **Sửa:** chưa — sửa một chỗ cho cả ba màn QC (màn tường của nhóm V6, đang có người sửa).

### B-V7-10 · Câu trạng thái rỗng bảo bấm "Kiểm tra vòng hở" — nút thật tên là "Kiểm tra lại vòng hở"

- **Trạng thái:** đã sửa (`8219876`)
- **Mức:** thấp — người dùng (và trình đọc màn hình) đi tìm một nút không có tên ấy
- **Bất biến vi phạm:** A6 (nhãn nhất quán), A12 (tìm theo tên)
- **Phát hiện:** 2026-10-03 · trình duyệt (cây truy cập của ca mồi)
- **Tái hiện bằng tay:** mở thẳng `projectRooms` — câu "…rồi bấm "Kiểm tra vòng hở" để dò lại." đứng ngay trên nút "Kiểm tra lại vòng hở"
- **Tái hiện bằng máy:** `e2e/v7/room-label-review.spec.ts` › ca mồi "…(V7-ROOMS-01)" — **đã kiểm đỏ trước sửa** (`1 failed`).
- **Gốc:** `useRoomLabelReview.ts:155` (và bản từ điển `vi.json` `…empty.notice`).
- **Sửa:** cả hai chuỗi gọi đúng "Kiểm tra lại vòng hở"; bài đơn vị `useRoomLabelReview.test.ts` › "trạng thái rỗng nói ra hai bước đi tiếp" khẳng định đúng tên nút.

### B-V7-11 · Ba màn QC-b chỉ có nội dung qua cửa bơm dev

- **Trạng thái:** đã sửa (`58822be`) — trùng gốc B-V6-01, xem mục ấy
- **Mức:** cao · **Bất biến vi phạm:** A11 · **Phát hiện:** 2026-09-30 · ghi chú V7 (F-Q1)
- **Tái hiện bằng máy:** ba bài "đường nạp thật" ở trên (ca mồi Q1 = A′ đã đỏ đúng thiết kế và được đổi chiều)

### B-V7-12 · Lớp QC-b không có đầu ghi máy chủ

- **Trạng thái:** đã sửa một nửa (`58822be`): phòng và độ dày lưu qua #35 (B-V6-03) · **ngoài FE** phần còn lại:
  `persistFloorContents`, `hideFloorFrom3d` (`floorManagerGateway.ts`) — chủ: BE (#35 không có nội dung nhân bản tầng
  hay cờ ẩn 3D)
- **Mức:** cao · **Bất biến vi phạm:** A7 (nửa "lưu") · **Phát hiện:** 2026-09-30 · đọc mã (F-Q2)
- **Tái hiện bằng máy:** màn tầng nói thật bằng hai câu nợ — `e2e/v7/floor-manager.spec.ts` › "đường nạp thật: mở thẳng
  thì màn không treo khung xương — có nút "Thêm tầng", hai câu nợ nói thật…"

### B-V7-13 · `viewer3d.spec.ts` ghi màn tầng hiện "0 tầng"

- **Trạng thái:** không phải lỗi (sản phẩm) — chữ trong docblock của tệp nhóm V8
- **Phép đo đã bác:** mở thẳng `projectFloors`: không một chữ "0 tầng"; bảng chỉ có hàng tiêu đề, không hàng tầng, không nút "Thêm tầng" (khung xương), hai câu nợ có mặt (`V7-FLOORS-01`). Docblock `e2e/viewer3d.spec.ts:44` nên đổi thành "treo khung xương" — tệp của W06/V8, tôi không sửa.

### B-V7-14 · Màn phòng hiện 248,60 m² — không khớp số nào của A14

- **Trạng thái:** không phải lỗi
- **Phép đo đã bác:** 248,60 là tổng của bộ mẫu RIÊNG của màn (`roomLabelFixture.ts:167`, `totalArea` trên 14 đường bao, `#R-014` = 26,20 m²), không phải `createSampleBuilding()`. Q4 = B. Bài V7-ROOMS-02 khẳng định số của bộ riêng.

### B-V7-15 · "mô hình 3d" viết thường trong câu nợ của màn tầng

- **Trạng thái:** không phải lỗi (của nhóm V7) — câu hỏi chép chữ toàn sản phẩm
- **Phép đo đã bác:** hai cách viết cùng sống có chủ ý: "mô hình 3d" ở `floorManagerGateway.ts:212`, `vi.json:1893`, `PascalViewer.tsx:25,90,155`, `pascalViewerTypes.ts:101`; "mô hình 3D" ở menu `FloorTable.tsx:168`. Q10f chốt kế hoạch không khẳng định "viết thường kiểu câu" khi chưa có chuẩn. Chuẩn hoá "3D" là việc chép chữ toàn sản phẩm cho điều phối viên.

### B-V7-21 · Màn tầng nói "chưa có tầng nào" khi danh sách tầng có bốn tầng (bộ mẫu dev)

- **Trạng thái:** ngoài FE — chủ: bộ mẫu dev (`src/mocks/spatial.ts`, `src/api/__mocks__/client.ts`); điều phối viên quyết
- **Mức:** trung bình (chỉ ở dev) — màn tầng dev không có hàng nào để thao tác nếu không bơm
- **Bất biến vi phạm:** — (BE thật trả mã tầng hợp lệ)
- **Phát hiện:** 2026-10-03 · trình duyệt, sau B-V6-01 phần V7
- **Tái hiện bằng tay:** mở `/projects/project-1/floors` — kho có bốn tầng (đo `byKind.level` = `L-1, L1, L2, L3`), bảng nói
  "chưa có tầng nào"
- **Tái hiện bằng máy:** `e2e/v7/floor-manager.spec.ts` › `test.fixme` "đường nạp thật: bảng hiện đủ bốn tầng của danh sách
  tầng… (B-V7-21)" — đã bật tạm: đỏ đúng lý do (`Expected: 4 · Received: 0`, nút "Thêm tầng" có mặt — không phải khung xương)
- **Gốc:** mã tầng của bộ mẫu dev không phải `LevelId` hợp lệ (`L-<thân ≥10 ký tự [0-9A-Z]>`, `src/domain/spatial/ids.ts`);
  `levelsOf` (`floorManagerGateway.ts:254`) lọc bằng `isEntityOfKind('level', …)` nên bỏ cả bốn. W04 đã ghi cùng gốc ở
  "Chỗ kế hoạch sai" (`L1` không phải `LevelId`).
- **Sửa:** chưa — đổi mã tầng của bộ mẫu chạm mọi bài đang dùng `L1` (lưới khói mặc định `floorId: 'L1'`).

### B-V7-22 · Kích thước và trục không có đường lưu nào — #35 chỉ nhận bốn danh sách

- **Trạng thái:** ngoài FE — chủ: BE
- **Mức:** cao — duyệt kích thước OCR và chỉnh trục/gốc toạ độ mất khi tải lại trang
- **Bất biến vi phạm:** A7
- **Phát hiện:** 2026-10-03 · đọc hợp đồng khi nối B-V6-03
- **Tái hiện bằng máy:** không có e2e (mock trong tiến trình); cổng vẫn khai `persistDimensionLayer`, `persistAxisGrid`,
  `persistAxisOrigin` trong `*_MISSING_CAPABILITIES`, `useDimensionOcrReview.test.ts` ghim `persistDimensionLayer` thiếu.
- **Gốc:** thân `PUT …/spatial/layer` là `{layer?: {walls, openings, rooms, furniture}, scaleMillimetresPerPixel?}`
  (`FloorLayerWriteBodySchema`, `src/api/schemas/spatialLayer.ts`); N16 trả `dimensions` chỉ để đọc và `axes: []`
  (B-V6-14). Không endpoint nào nhận kích thước đã duyệt hay trục.
- **Sửa:** không phải việc FE. Khi BE có trường, nối `persistDimensionLayer`/`persistAxisGrid` vào `createFloorLayerSave`.

## V8

### B-V8-01 · Thu phóng (cuộn chuột và nút "Phóng to") chết ở 3/4 góc nhìn 3D

- **Trạng thái:** đã sửa (`1241210`)
- **Mức:** cao — ở góc Trục đo / Trên xuống / Mặt cắt người dùng không phóng to được bằng bất kỳ cách nào nhìn thấy được
- **Bất biến vi phạm:** A12 (điều khiển nhìn thấy được mà không làm gì)
- **Phát hiện:** 2026-10-02 · chẩn đoán bài chập chờn `viewer3d.spec.ts`, đo bằng trình duyệt thật
- **Tái hiện bằng tay:**
  1. Mở `/projects/P-01/3d`, chờ "Mô hình 3D đã dựng xong"
  2. Bấm mặt "Trên xuống" của khối định hướng
  3. Cuộn chuột 5 nấc giữa khung nhìn, rồi bấm "Phóng to"
  - Kỳ vọng: nhãn mức thu phóng tăng
  - Thực tế (trước sửa): đứng ở 100%
- **Tái hiện bằng máy:** `e2e/viewer3d.spec.ts` › `thu phóng được ở góc "…"` (ba bài, nay `test`)
  `E2E_PORT=5196 E2E_SKIP_PASCAL=1 pnpm e2e e2e/viewer3d.spec.ts -g "thu phóng được ở góc"`
- **Gốc:** `ViewerShell/useViewerShell.ts` `onViewportWheel` chỉ gọi `dolly` (`OrbitCameraMode`); `FlatCameraMode` (`lib/three/camera/modes.ts:702`) chỉ có `zoom`. Nút `+`/`−` đi qua cùng hàm nên chết theo.
- **Sửa:** `useViewerShell.ts` thêm nhánh `zoom` · bài đơn vị `ViewerShell.test.tsx` `[VS-15]` (bốn góc; ba góc phẳng đỏ trước sửa: "3 failed | 1 passed") · commit `1241210` · **đã kiểm đỏ trước sửa** (lượt đỏ 2026-10-03: `git checkout 1241210~1 --` 11 tệp sản phẩm, chạy `e2e/v8` + `e2e/viewer3d.spec.ts` ⇒ 8 failed / 19 passed / 5 skipped; ba bài `thu phóng được ở góc …` đỏ ở `expect.poll … toBeGreaterThan`).

### B-V8-02 · Nút ray tầng hiện mã máy `L-01FIXTURE0` thay cho tên tầng

- **Trạng thái:** đã sửa (`1241210`) — Q8 = A
- **Mức:** trung bình — người dùng đọc mã máy ở điều khiển chọn tầng; dữ liệu thật cũng lộ `id`
- **Bất biến vi phạm:** A6; mục B ("điều khiển cho lập trình viên không xuất hiện trên màn sản phẩm")
- **Phát hiện:** 2026-09-30 · đo lớp 2 của kế hoạch (F1)
- **Tái hiện bằng tay:** mở `/projects/P-01/3d`, nhìn bốn nút ray trái. Kỳ vọng: tên tầng. Thực tế: `L-01FIXTURE0`…`L-04FIXTURE0` (aria-label thì đúng "Tầng trệt, cao độ 0,00 m" — nên `getByRole` không bắt được).
- **Tái hiện bằng máy:** `e2e/v8/viewer-shell.spec.ts` › "vỏ 3D nói số bằng dấu phẩy thập phân, và nút tầng hiện tên tầng chứ không hiện mã máy"
  `E2E_PORT=5196 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v8/viewer-shell.spec.ts -g "nút tầng hiện tên tầng"`
- **Gốc:** `useViewerShell.ts` `code: storey.id`; `ViewerStoreyRail.tsx:78` vẽ `{storey.code}`.
- **Sửa:** `useViewerShell.ts` `storeyShortLabel(name)` — tên bỏ "Tầng " đầu, viết hoa chữ đầu ("Trệt", "02", "03", "Mái"); nút 40 px nên không đủ chỗ cho tên đủ, tên đủ vẫn ở `aria-label`; `ViewerStoreyRail.tsx` thêm `truncate` cho tên dài; `viewerShellTypes.ts` sửa docblock · bài đơn vị `ViewerShell.test.tsx` `[VS-5]` · commit `1241210` · **đã kiểm đỏ trước sửa** (lượt đỏ 2026-10-03: `git checkout 1241210~1 --` 11 tệp sản phẩm, chạy `e2e/v8` + `e2e/viewer3d.spec.ts` ⇒ 8 failed / 19 passed / 5 skipped; bài đỏ ở `toHaveText(['Trệt','02','03','Mái'])`).

### B-V8-03 · Thư viện đồ đạc khoá kéo-thả với mọi vai, kể cả admin, và nói sai lý do "vai chỉ xem"

- **Trạng thái:** chờ quyết — sửa là mở một đường ghi mới (thả mô hình vào kho đang rỗng, B-V8-04) và tách quyền "đặt mô hình" khỏi quyền "tải lên"
- **Mức:** trung bình — admin/kỹ sư không bố trí được nội thất từ màn 3D, và đọc một câu giải thích sai về vai của chính họ
- **Bất biến vi phạm:** — (câu chữ sai sự thật; A11 `forbidden` dùng sai nhánh)
- **Phát hiện:** 2026-09-30 · ghi chú V8 (F2), đo lại 2026-10-03: mọi thẻ "Chỉ xem được, không kéo vào bản vẽ." ở vai kỹ sư mặc định
- **Tái hiện bằng tay:** đăng nhập `admin@example.com`, mở `/projects/P-01/3d`, bấm "Thư viện đồ đạc". Kỳ vọng: thẻ kéo được. Thực tế: "Bạn đang xem ở vai chỉ xem nên không kéo mô hình vào bản vẽ được."
- **Tái hiện bằng máy:** `e2e/v8/viewer-panels.spec.ts` › "admin mở thư viện đồ đạc thì không bị báo "vai chỉ xem", thẻ kéo được (B-V8-03)" (`test.fixme`)
- **Gốc:** `useFurnitureLibraryPanel.ts:302` `canDrag = options.canUploadModel`, và `:475` xét `forbidden` theo cùng cờ; `FurnitureLibraryPanel.container.tsx:118` `canUploadModel = canManageLibrary && uploadModel !== undefined`; `Viewer3DPanels.tsx` không truyền `onUploadModel`.
- **Sửa:** chưa — cần người duyệt chốt quyền kéo và đường thả. Điều kiện mở `test.fixme`: khi `Viewer3DPanels` nối đường thả và `canDrag` không còn gắn với tải lên.

### B-V8-04 · Bảng diện tích và panel thuộc tính trên màn 3D kẹt "đang tải" mãi

- **Trạng thái:** chờ quyết — gốc là sản phẩm chưa có đường nạp `store.spatial` (Q1 của `questions.md`, "bảy màn QC đọc vòng tròn")
- **Mức:** cao — người dùng không xem được diện tích hay thuộc tính trên màn 3D
- **Bất biến vi phạm:** A11 (loading không bao giờ kết thúc)
- **Phát hiện:** 2026-09-30 · ghi chú V8 (F3); đo lại 2026-10-03: bảng diện tích `div[aria-label="Đang tính diện tích…"][aria-busy]`, panel thuộc tính `role=status` "Đang tải thuộc tính…" sau 1,5 s; bơm kho thì bảng ra tổng ngay (0 `aria-busy`)
- **Tái hiện bằng tay:** mở `/projects/P-01/3d`, bấm "Diện tích phòng" — hoặc tìm "phong ngu 4" và chọn. Kỳ vọng: số liệu. Thực tế: "Đang tính diện tích…" / "Đang tải thuộc tính…" mãi.
- **Tái hiện bằng máy:** `e2e/v8/viewer-panels.spec.ts` › "chưa bơm kho: bảng diện tích vẫn ra tổng diện tích sàn (B-V8-04)" và "chưa bơm kho: chọn một phòng thì panel thuộc tính ra thuộc tính…" (hai `test.fixme`)
- **Gốc:** `Viewer3D/useViewer3DSource.ts:32-43` chỉ tiêm bộ mẫu vào vỏ + cảnh; panel đọc kho: `useRoomAreaPanel.ts:213,283` (`spatialLoaded: spatial !== null`), `usePropertyInspector.ts:1015`.
- **Sửa:** chưa. Vá bằng `setSpatial` lúc chạy bộ mẫu sẽ đánh thức `useAutosave` (Q13) và che mất Q1 — là thay đổi kiến trúc dữ liệu, không tự làm.

### B-V8-05 · Cùng một bức tường mang hai mã khác nhau: `W-403FI` và `W-0403FIXTURE0`

- **Trạng thái:** chờ quyết — chọn một mã hiển thị cho tường là quyết định sản phẩm
- **Mức:** thấp — người dùng không đối chiếu được dải chế độ sửa với panel thanh tra
- **Bất biến vi phạm:** — (gần mục B: panel vỏ in mã máy đầy đủ)
- **Phát hiện:** 2026-09-30 ghi chú V8 (F4); đo lại 2026-10-03: thanh tra "tường W-0403FIXTURE0 · mã đối tượng W-0403FIXTURE0", dải "Đang sửa: W-403FI"
- **Tái hiện bằng tay:** chọn một tường trên canvas, bấm "Sửa hình học tường", so mã ở thanh tra và ở dải trên cùng.
- **Tái hiện bằng máy:** `e2e/v8/wall-geometry.spec.ts` › "cùng một bức tường mang cùng một mã ở thanh tra và ở dải chế độ sửa (B-V8-05)" (`test.fixme`)
- **Gốc:** `WallGeometryEditor/wallGeometryEditorGateway.ts:385-388` `wallDisplayCode` giả định thân mã là 6 ký tự đếm của `createId` (`domain/spatial/ids.ts:110`); mã bộ mẫu `W-0404FIXTURE0` (`viewerShellFixture.ts:77`) nên ra `W-404FI`. Panel vỏ in mã thô (`useViewerShell.ts:948`). Có sáu bản chép của hàm rút mã trong các màn (ranh giới mục 0.4).
- **Sửa:** chưa. Hướng: một hàm rút mã chung ở `domain/spatial/ids.ts`, vỏ dùng nó; mã bộ mẫu theo đúng khuôn `createId`. Điều kiện mở `test.fixme`: hai nơi in cùng một mã.

### B-V8-06 · Hai mốc trùng tên "Thanh tra đối tượng" khi có đối tượng đang chọn

- **Trạng thái:** đã sửa (`1241210`)
- **Mức:** thấp — người dùng trình đọc màn hình gặp hai điểm mốc cùng tên lồng nhau
- **Bất biến vi phạm:** — (khả năng tiếp cận, `expectAccessible` không bắt mốc trùng tên)
- **Phát hiện:** 2026-09-30 · ghi chú V8 (F5)
- **Tái hiện bằng tay:** chọn một phòng; danh sách mốc của trình đọc màn hình có `complementary` "Thanh tra đối tượng" và bên trong nó `region` "Thanh tra đối tượng".
- **Tái hiện bằng máy:** `e2e/v8/viewer-shell.spec.ts` › "khi có chọn, chỉ MỘT mốc mang tên "Thanh tra đối tượng" (B-V8-06)"
- **Gốc:** `PropertyInspector/PropertyInspector.tsx:66` `REGION_LABEL` trùng `aria-label` của `ViewerShell/ViewerInspector.tsx:55`. (Nút "Sửa hình học tường" trùng chữ với vùng lớp phủ thì không phải mốc — không sửa.)
- **Sửa:** `PropertyInspector.tsx` đổi thành "Thuộc tính đối tượng" · bài đơn vị `Viewer3DPanels.test.tsx` `[VP-1]` · commit `1241210` · **đã kiểm đỏ trước sửa** (lượt đỏ 2026-10-03: `git checkout 1241210~1 --` 11 tệp sản phẩm, chạy `e2e/v8` + `e2e/viewer3d.spec.ts` ⇒ 8 failed / 19 passed / 5 skipped; bài đỏ ở `getByRole('region',{name:'Thuộc tính đối tượng'})` không có — vùng còn tên cũ).

### B-V8-07 · Chip lọc lịch sử "AI" viết hoa

- **Trạng thái:** chờ quyết — A6 chỉ miễn mã trục, mã lỗi, tên phím; người duyệt chọn giữa viết "ai" hay thêm "AI" vào danh sách miễn của `CLAUDE.md`
- **Mức:** thấp
- **Bất biến vi phạm:** A6 (nếu không miễn)
- **Phát hiện:** 2026-09-30 ghi chú V8 (F6); đo lại 2026-10-03: chip `tất cả · chỉnh sửa · duyệt · AI`
- **Tái hiện bằng máy:** `e2e/v8/viewer-panels.spec.ts` › "chip lọc lịch sử viết thường kiểu câu, kể cả chip "ai" (A6 · B-V8-07)" (`test.fixme`)
- **Gốc:** `HistoryPanel/historyPanelTypes.ts:92` `ai: 'AI'`
- **Sửa:** chưa. Điều kiện mở: người duyệt chọn "viết thường".

### B-V8-08 · "Hai `role=status` cùng lúc khi dựng xong" (F7)

- **Trạng thái:** không phải lỗi
- **Phép đo đã bác:** 2026-10-03, sau "Mô hình 3D đã dựng xong." trên `/projects/P-01/3d`: `getByRole('status')` đếm **1** — "đang làm việc riêng / chỉ mình bạn đang xem" (`CollaborationLayer.tsx:351`). Khối `sr-only` (`Viewer3D.tsx:254`) không mang role; lớp "Đang dựng mô hình" (`:67`) chỉ có lúc dựng.

### B-V8-09 · Tour chắn cú bấm đầu trên màn 3D (F8)

- **Trạng thái:** không phải lỗi (của nhóm V8) — hành vi thiết kế: nền tối `pointer-events-auto`, bấm vào là "bỏ qua" (`EditorTour.tsx:248-250`)
- **Phép đo:** 2026-10-03 — tour hiện một lần mỗi trang, ngay sau neo đầu tiên (cú bấm canvas 65 ms, mở Lịch sử 19 ms, mở ô tìm 9 ms), không hiện lại sau "bỏ qua". Thời điểm hiện (giữa chừng thay vì lúc tải) là lỗi của V2, W02 đang sửa — bài nhóm V8 đã chuẩn bị cho cả hai (đóng tour lúc tải nếu có, rồi sau mỗi lần mở neo).

### B-V8-10 · Ba con số "248,60 m²" từ hai bộ mẫu; số hình học của bộ mẫu chuẩn là 238,00 (F9)

- **Trạng thái:** chờ quyết — đúng câu A14 chưa chốt của `CLAUDE.md` (Q4 = B: không ghim, gộp hai bộ mẫu là việc riêng)
- **Mức:** thấp — không người dùng thật nào thấy; bẫy cho người viết bài
- **Phát hiện / đo 2026-10-03:** thanh trạng thái vỏ (bộ mẫu vỏ `VIEWER_FIXTURE_GRAPH`, `totalArea()` hình học) `4 tầng · 14 phòng · 248,60 m²`; bơm `createSampleBuilding()` rồi mở bảng diện tích: `238,00 m² · Tổng diện tích sàn toàn nhà — 14 phòng`, bốn tầng `68,00 / 68,00 / 51,00 / 51,00`, mỗi phòng `17,00`.
- **Tái hiện bằng máy:** không có `test.fixme` — giá trị kỳ vọng chính là câu chưa chốt. Bài VS-A15 ghim 248,60 và ghi rõ đó là số của bộ mẫu vỏ; bài RA-2 chỉ ghim hình dạng số.
- **Gốc:** hai bộ mẫu: `ViewerShell/viewerShellFixture.ts:304` và `domain/spatial/__fixtures__/sampleBuilding.ts:34-44`.
- **Sửa:** chưa.

### B-V8-11 · Nút "Xong" của chế độ sửa hình học tường bấm không được — ViewCube đè lên

- **Trạng thái:** đã sửa (`1241210`)
- **Mức:** trung bình — nút thoát nhìn thấy được mà không bấm được; người dùng chuột phải biết Esc hoặc nút "Thoát chế độ sửa hình học" ở cột phải
- **Bất biến vi phạm:** A12 (điều khiển nhìn thấy được mà không làm gì)
- **Phát hiện:** 2026-10-03 · bài đo của W06 (`click()` thường, không `force`)
- **Tái hiện bằng tay:**
  1. Mở `/projects/P-01/3d`, bấm vào một bức tường trên khung nhìn
  2. Bấm "Sửa hình học tường" ở cột phải
  3. Bấm "Xong" ở cuối dải "Đang sửa: W-…" trên cùng khung nhìn
  - Kỳ vọng: thoát chế độ sửa
  - Thực tế: cú bấm rơi vào cụm ViewCube + bản đồ nhỏ góc trên phải, chế độ vẫn bật
- **Tái hiện bằng máy:** `e2e/v8/wall-geometry.spec.ts` › "chế độ sửa hình học thoát được bằng nút "Xong" của chính nó (B-V8-11)"
  `E2E_PORT=5196 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v8/wall-geometry.spec.ts -g "Xong"`
- **Gốc:** hai nửa, đo lần lượt: (1) dải `WallGeometryEditorBand.tsx` trải hết bề ngang, đặt "Xong" ở mép phải — nằm dưới ô ViewCube (`ViewerShell.tsx:178` `absolute right-2 top-2`): Playwright báo `subtree intercepts pointer events` từ nút "Trục đo"; (2) lùi dải 88 px rồi vẫn bị chặn — lần này bởi khoảng trống 56 px bên trái ViewCube: cụm rộng bằng bản đồ nhỏ (128 px) mà khung bọc vẫn nhận chuột (`ViewerOverlays.tsx` `ViewerTopRightControls`). Lần thứ ba góc này bị lấn (sau `MiniMap` và thanh hiện diện).
- **Sửa:** `Viewer3DOverlays.tsx` truyền `bandEndInsetClassName="pr-[88px]"` (màn chủ biết góc của nó — cùng khuôn `presenceAnchorClassName`) qua `WallGeometryEditor.container.tsx` / `WallGeometryEditor.tsx` / `wallGeometryEditorTypes.ts`; `ViewerShell.tsx` + `ViewerOverlays.tsx`: khung cụm góc `pointer-events-none`, chỉ ViewCube và bản đồ nhỏ `pointer-events-auto` · bài đơn vị `Viewer3DOverlays.test.tsx` `[VO-2]`, `ViewerShell.test.tsx` `[VS-9]` (chỉ canh lớp — jsdom không dàn trang; nửa hình học là bài e2e) · commit `1241210` · **đã kiểm đỏ trước sửa** (lượt đỏ 2026-10-03: `git checkout 1241210~1 --` 11 tệp sản phẩm, chạy `e2e/v8` + `e2e/viewer3d.spec.ts` ⇒ 8 failed / 19 passed / 5 skipped; `locator.click: Test timeout` — `subtree intercepts pointer events` từ nút "Trục đo"; và một lượt riêng sau nửa (1) chỉ: chặn bởi khoảng trống của cụm).

### B-V8-12 · Kho đổi (hay bấm "Thử lại") thì cảnh 3D chết: "Trình duyệt này chưa xem được mô hình 3D"

- **Trạng thái:** đã sửa (`1241210`)
- **Mức:** cao — mọi lượt dựng lại cảnh trên cùng khung nhìn hỏng vĩnh viễn: dữ liệu không gian đổi (ghi hình học tường vào kho, nạp kho), hoặc bấm "Thử lại" sau một lần dựng lỗi. Người dùng thấy câu "máy/trình duyệt không có WebGL" — sai sự thật — và chỉ tải lại trang mới cứu được
- **Bất biến vi phạm:** A11 (lỗi giả, không phục hồi được)
- **Phát hiện:** 2026-10-03 · W06, khi viết bài RA-2 (bơm kho rồi chờ "Mô hình 3D đã dựng xong." — không bao giờ tới). Đo: sau `seedSpatial` khung nhìn đứng ở "Trình duyệt này chưa xem được mô hình 3D … Thử lại · Xem bản 2D" suốt 20 s, console `THREE.WebGLRenderer: Cannot read properties of null (reading 'precision')`
- **Tái hiện bằng tay:**
  1. Mở `/projects/P-01/3d` (bộ mẫu), chờ dựng xong
  2. Làm kho đổi — ở dev: `await (await import('/src/store/index.ts')).useStore.getState().setSpatial(…)` (đúng `e2e/fixtures/seedSpatial.ts`)
  - Kỳ vọng: cảnh dựng lại với đồ thị mới
  - Thực tế: "Trình duyệt này chưa xem được mô hình 3D"
- **Tái hiện bằng máy:** `e2e/v8/viewer-panels.spec.ts` › "BƠM KHO: kho đổi thì cảnh 3D dựng lại được trên cùng khung nhìn (B-V8-12)"
  `E2E_PORT=5196 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v8/viewer-panels.spec.ts -g "dựng lại được"`
- **Gốc:** `Viewer3D/viewer3dScene.ts` `dispose()` gọi `renderer.forceContextLoss()`, chép từ `lib/three/present/mount.ts` — nơi canvas "không bao giờ được vẽ lại". Ở đây `useViewer3D.ts:553-595` gọi lại `mountViewerScene` trên CÙNG canvas mỗi khi `levels` hay `buildAttempt` đổi; một canvas chỉ có một ngữ cảnh WebGL suốt đời, nên `new WebGLRenderer({ canvas })` nhận lại ngữ cảnh đã chết, `getShaderPrecisionFormat` trả `null`, renderer ném, hook vào nhánh `webglUnavailable`.
- **Sửa:** `viewer3dScene.ts` bỏ `forceContextLoss()` (giữ `renderer.dispose()`; rời màn thì canvas rời DOM, ngữ cảnh đi theo) · bài đơn vị `viewer3dScene.test.ts` "dọn xong thì CÙNG canvas ấy dựng lại được" — renderer giả theo đúng luật một-canvas-một-ngữ-cảnh, đỏ trước sửa (`expected false to be true`) · commit `1241210` · **đã kiểm đỏ trước sửa** (lượt đỏ 2026-10-03: `git checkout 1241210~1 --` 11 tệp sản phẩm, chạy `e2e/v8` + `e2e/viewer3d.spec.ts` ⇒ 8 failed / 19 passed / 5 skipped; bài đỏ ở "cảnh 3D báo không có WebGL": Expected 0, Received 1).

## V9

### B-V9-01 · Ba màn 3D (tách tầng, đo, đối chiếu) không có lối vào nào từ sản phẩm

- **Trạng thái:** đã sửa (`82f572b`)
- **Mức:** trung bình — người dùng không bấm tới được ba chức năng; chỉ ai biết gõ địa chỉ mới thấy
- **Bất biến vi phạm:** —
- **Phát hiện:** 2026-09-30 · đọc mã + grep (`plan.md` V9 0.2, P1) · Q10g = A′
- **Tái hiện bằng tay:**
  1. Mở `/projects/project-1/3d`
  2. Tìm đường sang tách tầng / đo / đối chiếu
  - Kỳ vọng: có nút dẫn tới
  - Thực tế (trước khi sửa): không nơi nào trong `src/` gọi `ROUTES.project.exploded|measure|overlay`
- **Tái hiện bằng máy:** `e2e/v9/entry.spec.ts` › ba ca "từ /3d, nút … mở đúng màn ấy"
  `E2E_PORT=5197 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v9/entry.spec.ts` — **đã kiểm đỏ trước sửa**.
  (Q10g dặn `test.fixme`; vì thêm liên kết là sửa nhỏ, ca viết thẳng thành `test`.)
- **Gốc:** `src/routes/paths.ts:141,146,149-150` khai route, không màn nào điều hướng tới.
- **Sửa:** `Viewer3DPanels.tsx` thêm `<nav aria-label="Màn 3D khác">` ba nút (đối chiếu chỉ dựng khi
  có tầng); `Viewer3D.container.tsx` nối `onOpenScreen` theo khuôn `onOpenExport`. Bài đơn vị
  `Viewer3DPanels.test.tsx` › `[VP-9]` (2 bài). **Tệp ngoài nhóm** (màn `/3d` của V8 — đã báo
  điều phối viên).

### B-V9-02 · Ở dev, tách tầng và đo hiện khung nhìn rỗng (canvas 300×150, "0 tầng") trong khi `/3d` có nhà bốn tầng

- **Trạng thái:** đã sửa (`4e3a17a`)
- **Mức:** trung bình — ở dev/demo hai màn không có gì để tách hay đo; mọi ca e2e trên mô hình phải
  dựa vào cửa bơm nội bộ
- **Bất biến vi phạm:** A11 (khung nhìn trống, không câu nào nói vì sao — chỉ thanh trạng thái `0 tầng`)
- **Phát hiện:** 2026-09-30 · V9 lớp 1 (bộ đệm 300×150) · đọc mã 2026-10-03
- **Tái hiện bằng tay:**
  1. `VITE_USE_MOCK_API=true pnpm dev`, mở `/projects/project-1/3d` — nhà bốn tầng
  2. Mở `/projects/project-1/3d/exploded` (hoặc `/3d/measure`)
  - Kỳ vọng: cùng nhà mẫu như `/3d`
  - Thực tế (trước khi sửa): canvas `width×height = 300×150`, thanh trạng thái `0 tầng · 0 phòng · 0,00 m²`
- **Tái hiện bằng máy:** `e2e/v9/exploded.spec.ts` › "ca mồi Q1 (không bơm)"
  `E2E_PORT=5197 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v9/exploded.spec.ts -g "ca mồi"` — **đã kiểm đỏ trước sửa**.
- **Gốc:** luật "mock + kho rỗng ⇒ nhà mẫu" (`shouldUseViewerFixture`, `viewerShellGateway.ts:307`)
  chỉ được áp ở `/3d` (`useViewer3DSource.ts`) và Pascal (`PascalViewer.container.tsx:120-131`);
  `ExplodedViewRoute` và `MeasurementToolRoute` không truyền `spatial`, nên hook đọc kho trần
  (`useExplodedView.ts:470-471`, `useMeasurementTool.ts:313-314`).
- **Sửa:** `resolveViewerSpatial(storeSpatial)` cạnh vị ngữ ấy trong `viewerShellGateway.ts` (cùng
  module hai màn đã nhập — không đẻ chunk mới; chưa đo `pnpm size`, ngoài lệnh được phép); hai route
  truyền `spatial`. Vỏ tính thanh trạng thái từ prop (`useViewerShell.ts:432`), cổng tách tầng đọc
  qua `spatialRef` — không cần sửa hook. Bài đơn vị `viewerShellGateway.test.ts` (3 bài).
  `seedSpatial` vẫn chạy: kho có đồ thị thì kho thắng.

### B-V9-03 · Nút "thoát chế độ đo (phím Esc)" không thoát chế độ đo

- **Trạng thái:** đã sửa (`be4eddd`)
- **Mức:** thấp — nhãn hứa một việc, phím làm việc khác; người dùng bàn phím mất niềm tin vào nhãn
- **Bất biến vi phạm:** A12 (nhãn phím là lời hứa của đường bàn phím)
- **Phát hiện:** 2026-09-30 · V9 (P4)
- **Tái hiện bằng tay:**
  1. Mở `/projects/project-1/3d/measure`, nhấn `M`, bấm một điểm trên mô hình
  2. Nhấn `Esc` (hoặc bấm nút "thoát chế độ đo (phím Esc)")
  - Kỳ vọng: nhãn nói đúng điều xảy ra
  - Thực tế (trước khi sửa): bản nháp mất, ray vẫn `đo (M)` — công cụ không tắt
- **Tái hiện bằng máy:** `e2e/v9/measure.spec.ts` › "bản nháp: bấm canvas thì có nút ghim; Esc bỏ nháp…"
  `-g "bản nháp"` — **đã kiểm đỏ trước sửa**.
- **Gốc:** hành vi là thiết kế (máy công cụ `cancel` → `resetTo(state, state.tool)`,
  `lib/tools/toolMachine.ts:549-550`; `partialHint` "nhấn Esc để bỏ"; bài đơn vị
  `MeasurementTool.test.tsx:465-518` khoá nó); sai là chữ ở `MeasurementTool.tsx:184`,
  `useMeasurementTool.ts:169`, `vi.json`.
- **Sửa:** nhãn `bỏ phần đo dở (phím Esc)`, mô tả sổ phím `bỏ phần đường đo dở dang, vẫn ở chế độ đo`.
  Không đổi hành vi (đổi `Esc` thành "thoát hẳn" là đổi sản phẩm — không làm). Bài đơn vị sửa theo:
  `MeasurementTool.test.tsx:389`.

### B-V9-04 · Vai Người xem đang đo mà ray công cụ không cho thấy gì

- **Trạng thái:** chờ quyết
- **Mức:** thấp — người dùng trình đọc màn hình/bàn phím không có dấu hiệu "đang đo"
- **Bất biến vi phạm:** A12
- **Phát hiện:** 2026-09-30 · V9 lớp 2 (P5); đo lại 2026-10-03: sau `M`, không nút ray nào `aria-pressed=true`
- **Tái hiện bằng tay:** đăng nhập `viewer@example.com`, mở `/3d/measure`, nhấn `M` — ray 5 nút, không nút nào sáng
- **Tái hiện bằng máy:** `e2e/v9/measure.spec.ts` › `test.fixme` "vai Người xem: ray công cụ cho thấy
  đang đo" — đã tạm bật: đỏ vì không có nút `đo (M)` trên ray (đúng lý do).
- **Gốc:** hai đặc tả mâu thuẫn — màn đo: Người xem "vẫn đo và đọc số bình thường"
  (`MeasurementTool.test.tsx:540-560`); vỏ: gỡ công cụ cần quyền sửa khỏi ray, và `đo` là công cụ
  duy nhất có `requiresEdit: true` (`useViewerShell.ts:153`; bài vỏ VS-2 `ViewerShell.test.tsx:139-140`
  dựa vào đúng cờ này).
- **Cần quyết:** (1) bỏ cờ — đo là thao tác chỉ đọc; viết lại VS-2, ray `/3d` của Người xem 5 → 6 nút;
  hay (2) giữ cờ, chặn `M` cho Người xem (`viewerShellShortcuts.ts`) và đổi câu của màn đo.
  Nghiêng về (1). Không tự sửa: đổi hành vi `/3d` của nhóm V8.
- **Sửa:** chưa

### B-V9-05 · Hai câu "không có quyền" cạnh nhau ở tách tầng viết tên vai khác nhau

- **Trạng thái:** chờ quyết
- **Mức:** thấp — trình đọc màn hình đọc "vai người xem" rồi "vai Người xem"
- **Bất biến vi phạm:** A6 (chưa rõ — tuỳ cách viết tên vai được chốt)
- **Phát hiện:** 2026-09-30 · V9 lớp 2 (P6)
- **Tái hiện bằng tay:** đăng nhập `viewer@example.com`, mở `/3d/exploded`: `Bạn đang xem ở vai người
  xem nên không sửa được vị trí tầng.` (sr-only, `ExplodedView.tsx:130`) cạnh `Bạn đang xem ở vai
  Người xem nên không sửa được mô hình.` (`ViewerInspector.tsx:86`)
- **Tái hiện bằng máy:** `e2e/v9/exploded.spec.ts` › `test.fixme` "hai câu … viết tên vai giống nhau"
  — đã tạm bật: đỏ vì hai cách viết (đúng lý do).
- **Gốc:** không có quy ước tên vai: grep `src/` thấy cả hai cách ở nhiều màn (`vi.json:1414,1945,2064,2163,2256`,
  `axisGridManagerScenarios.ts:294`…). Sửa một câu không chốt được quy ước.
- **Cần quyết:** tên vai là danh từ riêng ("Người xem") hay chữ thường kiểu câu (A6)? Rồi sửa đồng loạt.
- **Sửa:** chưa

### B-V9-06 · Từ `/3d` (nhà bốn tầng) sang đối chiếu, màn nói "dự án này chưa có tầng nào"

- **Trạng thái:** đã sửa (`d2264a5`)
- **Mức:** trung bình — một cú bấm đưa người dùng từ màn có bốn tầng sang màn nói không có tầng
- **Bất biến vi phạm:** A11
- **Phát hiện:** 2026-10-03 · W07, đọc mã sau B-V9-01
- **Tái hiện bằng tay:** dev mock, `/projects/project-1/3d` → nav "Màn 3D khác" → "Đối chiếu bản vẽ"
  - Kỳ vọng: màn có tầng; tầng nhà mẫu không có ảnh quét thì nói thế
  - Thực tế (trước sửa): `dự án này chưa có tầng nào để đối chiếu.`; vào thẳng `/floors/L1/overlay`
    cũng vậy
- **Tái hiện bằng máy:** `e2e/v9/overlay.spec.ts` › "mở từ /3d bằng nav "Màn 3D khác", màn đối chiếu
  đọc được tầng…" và "vào thẳng một tầng: màn nói chưa căn được và mở lối sang hiệu chỉnh tỷ lệ…" —
  **đã kiểm đỏ trước sửa** (cả hai).
  `E2E_PORT=5193 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v9/overlay.spec.ts`
- **Gốc:** `useOverlayComparison.ts` đọc `store.floors`/`store.spatial`, không ai nạp (`setFloors`
  có 0 nơi gọi ngoài test). Khi đã nạp qua N16 thì lộ lớp thứ hai: ảnh quét (`quality.assess`) khoá
  theo mã tầng API, lối "sang màn hiệu chỉnh tỷ lệ" cũng dựng bằng mã `Level` — ở bộ mẫu hai mã
  khác nhau (xem B-V5-01) nên tầng mất ảnh và lối sửa trỏ sai tầng.
- **Sửa:** `overlayComparisonGateway.ts` thêm `readFloorLayer` (N16). `useOverlayComparison.ts`:
  kho rỗng thì đọc tầng của route qua N16 — **chỉ đọc, không nạp kho**, để `/3d` không bị thay đồ
  thị; danh sách tầng = `store.floors` hoặc tầng của đồ thị; `scanFloorIdOf` đưa tầng N16 về mã
  route khi tra ảnh, gọi `readFloorScans` và dựng `scaleFixHref`. Bài đơn vị
  `useOverlayComparison.test.ts` "kho rỗng thì đọc tầng của route qua N16…" và "tầng N16 mang mã
  Level khác mã tầng API vẫn tìm ra ảnh quét và lối sửa tỷ lệ…" (cả hai đã kiểm đỏ). Ba bài cũ của
  `overlay.spec.ts` khẳng định "chưa có tầng" — viết lại theo sự thật mới (`L1` → `error` có chủ đích
  của bộ mẫu: khung không tìm thấy).
- **Còn lại (ghi nhận, không sửa):** từ `/3d` ở mock, danh sách chỉ có MỘT tầng (tầng của route),
  không phải bốn tầng nhà mẫu: `/3d` dựng `VIEWER_FIXTURE`, bộ mẫu API không biết mã của nó. Liệt
  kê đủ tầng cần N15 hoặc một nguồn danh sách tầng — ngoài đợt này.

### B-V9-07 · Nhãn ray quảng cáo phím `R`/`H`/`C`/`V` nhưng không phím nào hoạt động

- **Trạng thái:** đã sửa (`a5e2dbc`, W04 — B-V6-08; bài bật ở `d2264a5`)
- **Mức:** trung bình — A12: người dùng bàn phím bấm theo nhãn và kết luận màn treo
- **Bất biến vi phạm:** A12
- **Phát hiện:** 2026-09-30 · V9 (P7), `questions.md` Q10e
- **Tái hiện bằng tay:** `/projects/project-1/3d/measure`, nhấn `c`
  - Kỳ vọng: nút "mặt cắt (C)" bật · Thực tế (trước sửa): ray không đổi
- **Tái hiện bằng máy:** `e2e/v9/measure.spec.ts` › "phím R/H/C/V trên nhãn ray đổi được công cụ trên
  màn đo (B-V9-07)" — **đã kiểm đỏ trước sửa** (lùi phần sản phẩm của `a5e2dbc`: đỏ ở
  `mặt cắt (C)` không `aria-pressed`).
- **Gốc:** `useViewerShell.ts` viết cứng nhãn phím, `buildViewerShortcuts` chỉ đăng ký `M` (W04 đính
  chính: không phải `TOOL_SHORTCUTS`). Màn đo dùng cùng vỏ nên bản sửa ở `/3d` phủ luôn màn đo —
  không thiếu phần nào.
- **Sửa:** `a5e2dbc` (W04) · không cần sửa thêm.

### B-V9-08 · Ray tầng của tách tầng và đo hiện mã bộ mẫu `L-01FIXTURE0…`

- **Trạng thái:** đã sửa (`1241210`, W06 — gốc chung B-V8-02) ở tách tầng và đo · **không phải lỗi
  sản phẩm** ở đối chiếu (dữ liệu giả, điều phối viên chốt A 2026-10-03)
- **Mức:** thấp — chuỗi kỹ thuật trên màn sản phẩm
- **Bất biến vi phạm:** A6, mục B
- **Phát hiện:** 2026-09-30 · V9 (P10)
- **Tái hiện bằng tay:** `/projects/project-1/3d/exploded` (hoặc `/3d/measure`), nhìn ray tầng trái
  - Kỳ vọng: `Trệt · 02 · 03 · Mái` · Thực tế (trước sửa): `L-01FIXTURE0 … L-04FIXTURE0`
- **Tái hiện bằng máy:** `e2e/v9/exploded.spec.ts` › "ray tầng của màn tách tầng gọi tầng bằng tên…"
  và "ray tầng của màn đo gọi tầng bằng tên…" (khẳng định 0 chữ `FIXTURE` + bốn `option` có chữ
  `Trệt, 02, 03, Mái`) — **đã kiểm đỏ trước sửa** (lùi phần sản phẩm của `1241210`: còn 4 chữ `FIXTURE`).
- **Gốc:** `useViewerShell.ts` `code: storey.id` — vỏ dùng chung, nên bản sửa của W06 ở `/3d` đã phủ
  tách tầng và đo.
- **Đối chiếu — phép đo đã bác:** đi `/3d` → "Đối chiếu bản vẽ" ở mock, ô chọn tầng hiện
  `L-01FIXTURE0 — không có ảnh bản vẽ gốc`. Nhãn là `Level.name` của N16; tên ấy do API giả bịa:
  `/3d` ở mock dựng `VIEWER_FIXTURE` (mã `L-0nFIXTURE0`) mà bộ mẫu API không biết, và
  `makeFallbackFloor` (`src/api/__mocks__/client.ts:131`) đặt `name = floorId` cho tầng lạ. Trên BE
  mã `Level` = mã tầng (`assemble.py:56-65`) và tầng có tên thật, nên màn không lộ mã. Cùng gốc bộ
  mẫu rời rạc của B-V4-08 (W03, chờ quyết). Không sửa mock lượt này (điều phối viên).
- **Sửa:** `1241210` (W06) · không cần sửa thêm.

## V10

### B-V10-01 · Sau `PASCAL-01`, bấm "thử lại" hay phím R không bao giờ nạp lại — kể cả khi gói đã trở lại

- **Trạng thái:** đã sửa (`62df87a`)
- **Mức:** cao — "thử lại" là lối thoát duy nhất trên màn lỗi; nó là lối thoát giả, người dùng kẹt
  tới khi tự tải lại trang.
- **Bất biến vi phạm:** A11 (trạng thái lỗi phải có đường đi tiếp thật)
- **Phát hiện:** 2026-10-03 · bài đo `page.route` (ca mở rộng "chưa chạy" của B-5)
- **Tái hiện bằng tay:**
  1. Bật cờ `scene.pascal-viewer`, chặn/đổi tên tạm `public/assets/pascal/pascal-mount.js`, mở `/projects/P-01/3d/pascal`.
  2. Thấy "không nạp được khung dựng hình". Trả tệp về chỗ cũ.
  3. Bấm "thử lại" (hoặc R).
  - Kỳ vọng: màn nạp lại và dựng xong.
  - Thực tế: vẫn lỗi; suốt cả lượt chỉ có **1** request tới `pascal-mount.js` (đo cả ba cách chặn: 404, `text/html`, `abort`).
- **Tái hiện bằng máy:** `e2e/pascal-viewer.spec.ts` › "gói vách ngăn hỏng (404) thì báo PASCAL-01, và thử lại bằng nút…" và "…(text/html)… bằng phím R…"
  `E2E_PORT=5198 pnpm e2e e2e/pascal-viewer.spec.ts -g "gói vách ngăn hỏng"`
- **Gốc:** `src/screens/viewer/PascalViewer/usePascalViewer.ts:96-137` — sau lỗi, `mountModulePromise`
  được xoá nhưng lượt sau thêm lại `<script type="module">` **cùng `src`**; trình duyệt giữ kết quả
  module (kể cả lỗi) theo URL suốt đời trang, nên trả lỗi cũ mà không gửi request.
- **Sửa:** `usePascalViewer.ts` — đếm `failedLoads` cấp module, lượt sau một lần hỏng xin
  `pascal-mount.js?attempt=N` (lượt đầu giữ URL trơn), gỡ thẻ hỏng. Giới hạn ghi bằng `ponytail:`: chunk
  con hỏng vẫn bị giữ theo URL chunk. Bài đơn vị `usePascalViewer.test.tsx` › "gói hỏng rồi "thử lại"
  thì xin gói ở URL KHÁC" · commit `62df87a`. **Đã kiểm đỏ trước sửa** (e2e và đơn vị).

### B-V10-02 · Màn Pascal chỉ cao 384 px; khung 3D là một dải 190 px trong cửa sổ 900 px

- **Trạng thái:** đã sửa (`62df87a`)
- **Mức:** trung bình — thứ chính của màn chiếm ~21 % chiều cao cửa sổ, phần dưới trống; vùng bấm/kéo
  trên canvas nhỏ. (Là phát hiện P4 của V11 và trường 12 của V10-b, nay có số đo nguyên nhân.)
- **Bất biến vi phạm:** —
- **Phát hiện:** 2026-10-03 · bài đo (đi chuỗi cha của hộp, `getBoundingClientRect`)
- **Tái hiện bằng tay:**
  1. Bật cờ, mở `/projects/P-01/3d/pascal` ở cửa sổ 1440×900.
  - Kỳ vọng: khung dựng lấp gần hết cửa sổ.
  - Thực tế: `HTML/BODY/#root/section` đều cao 384 px (`min-h-[24rem]`), hộp dựng 192 px, canvas 1406×190.
- **Tái hiện bằng máy:** `e2e/pascal-viewer.spec.ts` › "khung dựng chiếm phần lớn cửa sổ, không phải một dải 190 px (B-V10-02)"
- **Gốc:** `PascalViewer.container.tsx` `PascalViewerRoute` — màn đứng một mình dưới router, không vỏ
  nào cấp chiều cao, nên `h-full` của `Frame` (`PascalViewer.tsx:26`) ra 0. Các màn route khác tự đặt
  `h-screen`/`min-h-screen`; stories của chính màn này bọc `h-screen` (`PascalViewer.stories.tsx:91`).
- **Sửa:** bọc `<div className="h-screen">` ở `PascalViewerRoute` (không ở `Frame`, để chỗ nhúng tự
  quyết). Không có bài đơn vị: jsdom không tính bố cục, khẳng định tên lớp là bám nội bộ — bài e2e là
  bài chặn. Commit `62df87a`. **Đã kiểm đỏ trước sửa** (`Received: 192`).

### B-V10-03 · Cờ tắt vẫn tải và chạy bộ đổi bản vẽ sang Pascal

- **Trạng thái:** đã sửa (`62df87a`)
- **Mức:** thấp — tốn tải mạng + CPU đổi cả bản vẽ cho một màn chỉ nói "chưa bật"; gói nặng thì không tải (A-2 xanh).
- **Bất biến vi phạm:** —
- **Phát hiện:** 2026-10-03 · bài đo A-2 (`page.on('request')`): cờ tắt vẫn có `/src/lib/pascal/toPascal.ts`, `ids.ts`.
- **Tái hiện bằng tay:** mở `/projects/P-01/3d/pascal` (cờ mặc định tắt), xem tab Network.
  - Kỳ vọng: không module `lib/pascal` nào. — Thực tế: 4 request `/src/lib/pascal/*`.
- **Tái hiện bằng máy:** `e2e/pascal-viewer.spec.ts` › "cờ tắt: màn nói "chưa bật" chứ không dựng gì (forbidden, A11)"
- **Gốc:** `usePascalViewer.ts:210-230` — effect `import('@/lib/pascal/toPascal')` chỉ chặn `graph === null || isEmpty`, không chặn cờ.
- **Sửa:** thêm `!enabled` vào điều kiện + deps. Bài đơn vị › "cờ tắt thì KHÔNG chạy cả bộ đổi dữ liệu"
  (chờ 1 500 ms có tên + lý do: không có mốc dương cho "không làm gì"; chỉ sai được về phía xanh).
  Commit `62df87a`. **Đã kiểm đỏ trước sửa** (e2e và đơn vị).

### B-V10-04 · Bộ đổi dữ liệu nạp hỏng rồi bấm "thử lại" thì kẹt khung xương "đang nạp…" mãi

- **Trạng thái:** đã sửa (`62df87a`)
- **Mức:** trung bình — từ màn lỗi có lối thoát sang khung xương vô hạn không lối thoát (hỏng chunk sau một lượt triển khai là chuyện thường).
- **Bất biến vi phạm:** A11
- **Phát hiện:** 2026-10-03 · vai Tech Lead Tester đọc mã; tôi dựng lại bằng `page.route` abort `toPascal.ts`.
- **Tái hiện bằng tay:** làm hỏng lượt tải chunk `toPascal` (DevTools › Network › block request URL), bật cờ, mở màn → lỗi PASCAL-01; bỏ chặn, bấm "thử lại".
  - Kỳ vọng: dựng xong. — Thực tế: `đang nạp khung dựng hình…` mãi.
- **Tái hiện bằng máy:** `e2e/pascal-viewer.spec.ts` › "bộ đổi dữ liệu nạp hỏng thì báo PASCAL-01, và thử lại không kẹt khung xương (B-V10-04)"
- **Gốc:** `usePascalViewer.ts:230` — deps `[graph, isEmpty]` không có `attempt`; `onRetry` xoá
  `failure`, `result` còn `null` ⇒ trạng thái `loading`, mà không ai chạy lại lượt nạp.
- **Sửa:** deps thêm `attempt`. Bài đơn vị › "bộ đổi dữ liệu hỏng rồi "thử lại" thì CHẠY LẠI nó".
  Commit `62df87a`. **Đã kiểm đỏ trước sửa** (e2e và đơn vị; e2e đỏ đúng câu "màn kẹt "đang nạp" sau
  khi thử lại"). Đo sau sửa: lượt `import()` thử lại lúc thì dựng xong, lúc thì trả lại lỗi cũ
  (1 lần / 3 lượt dựng xong — trình duyệt có giữ lỗi module theo URL hay không), nên bài khẳng định
  đúng điều lỗi nói: màn **rời** "đang nạp" và tới một trạng thái có đường đi tiếp (cảnh, hoặc lỗi
  kèm nút "thử lại") — đọc bằng nhật ký `MutationObserver` để không đọc trúng chữ lỗi cũ.
  Giới hạn còn lại (không phải lỗi này): chunk `toPascal` hỏng thật thì chỉ tải lại trang mới gỡ được.

### B-V10-05 · Gói Pascal gây 1 vi phạm CSP `script-src eval`; tài liệu ghi "4 → 0" (P1 của V10)

- **Trạng thái:** chờ quyết — tài liệu đã sửa (`4e1d1d4`); bản vá mã chờ chính sách CSP thật (Q5 = B).
- **Mức:** thấp — cảnh vẫn dựng (zod bắt lỗi phép dò); hiện chỉ là một dòng báo CSP. Thành thật hơn: ai đọc "0" sẽ tưởng chỗ ấy xong.
- **Bất biến vi phạm:** —
- **Phát hiện:** plan.md mục 9 V10 P1 · đo lại 2026-10-03.
- **Tái hiện bằng tay:** phục vụ trang với `script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'`, bật cờ, mở màn, nghe `securitypolicyviolation`.
  - Kỳ vọng (theo tài liệu): 0. — Thực tế: `["script-src | eval | …/assets/pascal/pascalMount-D-XGBRdU.js"]`.
- **Tái hiện bằng máy:** không có bài — Q5 = B cấm viết ca CSP trên chính sách tự dựng. Phép đo dùng bài tạm (đã xoá).
- **Gốc:** nhát vá `window.__zod_globalConfig = { jitless: true }` chỉ sống trong trang spike
  `src/vach-ngan.tsx` (không còn trong cây); `grep -rn jitless src vite.pascal.config.ts` → 0. Màn thật chưa từng có nó.
- **Sửa:** tài liệu — `docs/pascal/01-ho-so-cong-T4.1.md` §8e, `02-soat-dong-dot-G3.md:107`,
  `IMPLEMENTATION_STATUS.md:685` (questions.md "Việc sản phẩm" #7). Mã: chưa — khi chính sách thật vào
  repo thì đặt cờ `jitless` trước khi thẻ script Pascal được thêm (`defaultLoadMount`) và viết ca đếm vi phạm.

### B-V10-06 · Bốn số Pascal không phải bộ A14; trang chỉ có tường bao + phòng (P2 của V10)

- **Trạng thái:** chờ quyết (Q1/Q4 — chọn bộ mẫu chuẩn là việc riêng)
- **Mức:** thấp — `ô mở 0` luôn hiện; không kiểm được cửa/cửa sổ/đồ đạc trên màn này.
- **Bất biến vi phạm:** A14 (bộ mẫu chuẩn dùng chung) — có chủ ý, chưa chốt.
- **Phát hiện:** plan.md mục 9 V10 P2; đọc `viewerShellFixture.ts` (`openings: []`).
- **Tái hiện bằng máy:** không có bài — Q4 = B: không khẳng định con số nào trên màn Pascal.
- **Gốc:** `VIEWER_FIXTURE_GRAPH` là bộ riêng của màn (4 tầng × 4 tường bao, 0 ô mở); `toPascal.ts` không làm mất gì.
- **Sửa:** chưa.

### Phát hiện còn lại — đã đo, không phải lỗi

- **V10 P3 — đồ đạc cao 0 m:** `không phải lỗi` — đã chữa trước lượt này: `toPascal.ts:84`
  `FURNITURE_HEIGHT_MM` (bảng chiều cao danh nghĩa theo loại, docblock `:66-83` kể đúng lỗi cũ);
  `grep FURNITURE_HEIGHT_M =` → 0.
- **V10 P4 — nhãn nút lặp đôi:** `không phải lỗi` — `textContent` lặp vì bản sao `aria-hidden` giữ bề
  rộng (`Button.tsx:74`); tên truy cập đo bằng `getByRole('button',{name:'thử lại',exact:true})` và
  `'mở khung xem'` exact → khớp đúng 1. Hai bài B-3/B-5 dùng `exact` làm bằng chứng thường trực.
- **V10 P5 — docblock spec lỗi thời:** `không phải lỗi` sản phẩm — đã sửa docblock trong commit test
  (33 bài đơn vị, `error` dựng được bằng `page.route`, thêm ba chỗ sai nêu ở "Chỗ kế hoạch sai").
- **V10 P6 — 141 vs 145 ký tự:** `không phải lỗi` — đo `innerText` = 145 =
  141 + hai cặp `\n\n` (4 ký tự dòng trống); hai cách đếm. Không ca nào khẳng định độ dài.
- **V10 P7 / V11 P3 — 404 console:** `không phải lỗi` của Pascal — CDP `Network.responseReceived`
  trên màn Pascal (cờ tắt và bật): chuỗi 404 duy nhất là `Other 404 http://127.0.0.1:5198/favicon.ico`.
  Trùng **B-G-03** (chủ khác).
- **V11 P1 — `00-quyet-dinh.md:197` lạc hậu:** đã sửa tài liệu (`4e1d1d4`) bằng một ghi chú có ngày:
  bốn gói đã cài, `nodes` nạp thật (`pascalScene.ts:27`), `grep pascal-app/editor src` → 0.
- **V11 P2 — HOP-DONG sai hai chi tiết:** `không phải lỗi` — đã sửa ở HOP-DONG-BO-SUNG 7.1/7.2 (tệp ngoài repo).
- **V11 P4 — hộp cao 190 px:** là **B-V10-02** (đã sửa).
- **V11 P5 — trang không có nút:** `không phải lỗi` — xác nhận: hộp `pascal-canvas` 0 phần tử
  `button,[role],input,select,textarea,a[href]` khi đã dựng xong; H-1 giữ điều này.

## V12

### B-V12-01 · Bốn màn luật/xuất/dữ liệu luôn rỗng khi đi bằng đường sản phẩm

- **Trạng thái:** chờ quyết — đường nạp kho thật là tính năng mới (questions.md Q1 = A′: dùng cửa
  bơm + ca mồi trong lúc chờ)
- **Mức:** cao — người dùng không bao giờ thấy kết quả kiểm tra luật, cài đặt luật, xuất, dữ liệu
- **Bất biến vi phạm:** —
- **Phát hiện:** 2026-09-30 · V12 0.1 (đo) — plan.md mục 9 F1
- **Tái hiện bằng tay:**
  1. Mở `/projects/project-1/rules` (hoặc `/rules/settings`, `/export`, `/data`)
  - Kỳ vọng: nội dung của mô hình dự án
  - Thực tế: `empty` ("Chưa có mô hình để kiểm tra luật", "chưa có gì được duyệt để xuất", …)
- **Tái hiện bằng máy:** `e2e/v12a/rules.spec.ts` › "B-V12-01: vào màn luật bằng đường sản phẩm …"
  (`test.fixme`); ba ca mồi không bơm (`rules`, `rule-settings`, `data`; `export` ở `smoke-grid`)
  đỏ đúng ngày có đường nạp.
  `E2E_PORT=5199 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v12a/rules.spec.ts -g "B-V12-01"`
  Đã tạm bật (2026-10-03): đỏ vì "Chạy kiểm tra lại" không hiện sau 15 s — màn ở `empty`, đúng lý do.
- **Gốc:** `store/projectSlice.ts` `setFloors`/`setProject`: 0 nơi gọi ngoài kho và test;
  `setSpatial` chỉ ở các hook QC và chúng đọc lại kho rỗng.
- **Sửa:** chưa

### B-V12-02 · Nút chính "Chạy kiểm tra" của màn luật rỗng dẫn thẳng vào màn lỗi

- **Trạng thái:** đã sửa (`c254885`)
- **Mức:** trung bình — người dùng bấm nút chính duy nhất của màn và rơi vào "Không chạy được
  lượt kiểm tra" mà không biết vì sao
- **Bất biến vi phạm:** A11 (`empty` dẫn sang một `error` giả)
- **Phát hiện:** 2026-09-30 · V12 (đo) — plan.md mục 9 F2. Nút "Chạy kiểm tra lại" ở đầu màn cùng
  bệnh (đo 2026-10-03, bài đo tạm)
- **Tái hiện bằng tay:**
  1. Mở `/projects/project-1/rules`
  2. Bấm "Chạy kiểm tra" (hoặc "Chạy kiểm tra lại" ở đầu màn)
  - Kỳ vọng: màn nói thật là chưa có mô hình để kiểm, không mời một lượt chạy chắc chắn hỏng
  - Thực tế (trước sửa): "Không chạy được lượt kiểm tra — không chạy được bộ kiểm tra trên mô hình này."
- **Tái hiện bằng máy:** `e2e/v12a/rules.spec.ts` › "ca mồi, không bơm: màn luật nói thẳng là chưa có mô hình …"
  `E2E_PORT=5199 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v12a/rules.spec.ts -g "ca mồi"` — đã kiểm đỏ trước sửa (2026-10-03: cất bản sửa sản phẩm, chạy `e2e/v12a`: đỏ đúng chỗ khẳng định của lỗi)
- **Gốc:** `useRuleReport.ts` `onRerun` gọi `query.refetch()`; `refetch` bỏ qua `enabled: graph !== null`
  nên `queryFn` ném `RUN_FAILED_MESSAGE`. `empty` chỉ xảy ra khi `graph === null` (có mô hình mà chưa
  có kết quả là `loading`), nên mọi nút chạy ở `empty` đều chắc chắn hỏng.
- **Sửa:** `RuleReport.tsx` — `empty` nói "Chưa có mô hình để kiểm tra luật" + chỉ đường (pipeline), bỏ
  nút chạy; ẩn "Chạy kiểm tra lại" ở `empty`. `useRuleReport.ts` — `onRerun` không làm gì khi
  `graph === null` (chặn ở hàm chung cho mọi nơi gọi). Bài đơn vị `RuleReport.test.tsx` "B-V12-02".

### B-V12-03 · Cài đặt bộ luật nói "chưa có luật nào" ngay dưới dòng "23/25 luật đang bật"

- **Trạng thái:** đã sửa (`c254885`) — questions.md Q7 = B′ (lỗi diễn đạt, sửa chuỗi)
- **Mức:** thấp — hai câu trái nhau; người dùng đọc "không có luật" trong khi có 25
- **Bất biến vi phạm:** —
- **Phát hiện:** 2026-09-30 · V12 (đo) — plan.md mục 9 F12
- **Tái hiện bằng tay:** mở `/projects/project-1/rules/settings`
  - Kỳ vọng: thân màn nói đúng lý do rỗng (chưa có mô hình), không mâu thuẫn dòng đếm
  - Thực tế (trước sửa): "chưa có bộ luật để cài đặt — Chưa có luật không gian nào được nạp cho dự án này."
- **Tái hiện bằng máy:** `e2e/v12a/rule-settings.spec.ts` › "ca mồi, không bơm: màn cài đặt đếm luật …"
  `E2E_PORT=5199 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v12a/rule-settings.spec.ts -g "ca mồi"` — đã kiểm đỏ trước sửa (2026-10-03: cất bản sửa sản phẩm, chạy `e2e/v12a`: đỏ đúng chỗ khẳng định của lỗi)
- **Gốc:** `RuleSettings.tsx` nhánh `empty` nói về luật, nhưng `empty` đến từ `graph === null`
  (`useRuleSettings.ts`), còn số luật đến từ sổ đăng ký của domain — không phụ thuộc kho.
- **Sửa:** `RuleSettings.tsx` — "chưa có mô hình để áp bộ luật" + "Bản vẽ này chưa được xử lý xong, …".
  Bài đơn vị `RuleSettings.test.tsx` "B-V12-03".

### B-V12-04 · Sửa luật ở cài đặt bộ luật không có toast hoàn tác

- **Trạng thái:** đã sửa (`c254885`)
- **Mức:** trung bình — tắt nhầm một luật thì không có lối hoàn tác (`Ctrl+Z` toàn cục chỉ theo dõi `spatial`)
- **Bất biến vi phạm:** A8
- **Phát hiện:** 2026-09-30 · V12 (đo) — plan.md mục 9 F3 (nửa RuleSettings)
- **Tái hiện bằng tay:**
  1. Mở `/projects/project-1/rules/settings` khi kho có mô hình (dev: bơm kho)
  2. Tắt luật "lỗ mở nằm trọn trong tường chứa nó"
  - Kỳ vọng: toast có nút "Hoàn tác"; bấm thì luật bật lại
  - Thực tế (trước sửa): không có toast nào (đo 2026-10-03: hai vùng `status` chỉ nói "Đã lưu lúc …")
- **Tái hiện bằng máy:** `e2e/v12a/rule-settings.spec.ts` › "có bơm kho: tắt một luật hiện toast có nút "Hoàn tác" …"
  `E2E_PORT=5199 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v12a/rule-settings.spec.ts -g "toast"` — đã kiểm đỏ trước sửa (2026-10-03: cất bản sửa sản phẩm, chạy `e2e/v12a`: đỏ đúng chỗ khẳng định của lỗi)
- **Gốc:** `RuleSettings.container.tsx` `RuleSettingsRoute` dựng `<RuleSettingsContainer />` trần; hook
  đã có vé hoàn tác (`useRuleSettings.ts` `applyConfig`) nhưng không ai truyền `onToast`.
- **Sửa:** route đẩy toast vào `appNotificationBus` (`NotificationHost` ở `main.tsx` vẽ nó; khuôn
  `FloorManager`/`UserManagement`; còn sống khi rời màn trong cửa sổ hoàn tác); `RuleSettingsToast`
  mang thêm chính vé `undoTicket` để không dựng vé thứ hai. Bài đơn vị `RuleSettings.test.tsx` "B-V12-04".

### B-V12-05 · Bấm "xuất" không tải tệp nào về máy

- **Trạng thái:** đã sửa (`c254885`) — điều phối chốt 2A (2026-10-03)
- **Mức:** cao — màn hứa "tệp tải về thư mục tải xuống của trình duyệt", hàng ghi đã xuất, mà không có tệp
- **Bất biến vi phạm:** —
- **Phát hiện:** 2026-09-30 · V12 (`download` không nổ) — plan.md mục 9 F5; gốc đo lại 2026-10-03
- **Tái hiện bằng tay:**
  1. Mở `/projects/project-1/export` khi kho có mô hình (dev: bơm kho)
  2. Bấm "xuất" (định dạng `.glb`)
  - Kỳ vọng: trình duyệt tải `….glb`
  - Thực tế (trước sửa): chỉ hiện một dòng trong "tệp đã xuất"; phải bấm "tải lại" mới có tệp
- **Tái hiện bằng máy:** `e2e/v12a/export.spec.ts` › "có bơm kho: bấm "xuất" .glb thì tệp tải về máy …"
  `E2E_PORT=5199 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v12a/export.spec.ts -g "tải về máy"` — đã kiểm đỏ trước sửa (2026-10-03: cất bản sửa sản phẩm, chạy `e2e/v12a`: đỏ đúng chỗ khẳng định của lỗi)
- **Gốc:** `useExportPanel.ts` `onSuccess` chỉ `gateway.track(...)`; `gateway.deliver` chỉ có ở
  `onDownload` (nút "tải lại"). Giả thuyết cũ (`revokeObjectURL` sớm) sai: "tải lại" tải được trên Chrome.
- **Sửa:** `onSuccess` gọi `gateway.deliver(file)`. Bài đơn vị `ExportPanel.container.test.tsx` "B-V12-05".

### B-V12-06 · Link "sửa" (màn xuất) và link khắc phục (màn luật) nạp lại cả trang

- **Trạng thái:** đã sửa (`c254885`)
- **Mức:** trung bình — rời màn bằng link trong ứng dụng thì mất mọi thứ chỉ sống trong phiên (kho,
  danh sách "tệp đã xuất", phiên đăng nhập của bộ mẫu dev)
- **Bất biến vi phạm:** —
- **Phát hiện:** 2026-10-03 · vòng tranh luận (Tech Lead Tester) + bài đo tạm: sự kiện `load` +1
- **Tái hiện bằng tay:**
  1. Mở `/projects/project-1/export` khi kho có mô hình; ở "kiểm tra trước khi xuất" bấm "sửa"
     cạnh dòng "… vi phạm chưa xử lý"
  - Kỳ vọng: sang màn luật, bảng luật hiện ngay (kho còn)
  - Thực tế (trước sửa): trình duyệt nạp lại trang; màn luật ở `empty`
- **Tái hiện bằng máy:** `e2e/v12a/export.spec.ts` › "có bơm kho: link "sửa" … KHÔNG tải lại trang …"
  `E2E_PORT=5199 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v12a/export.spec.ts -g "KHÔNG tải lại"` — đã kiểm đỏ trước sửa (2026-10-03: cất bản sửa sản phẩm, chạy `e2e/v12a`: đỏ đúng chỗ khẳng định của lỗi)
- **Gốc:** `ExportPanelPreflight.tsx` `<a href onClick>`: `onClick` gọi `navigate`, không `preventDefault`,
  nên trình duyệt đi theo `href` ngay sau. Cùng họ: `RuleReport.tsx` `SkippedNotice` `<a href>` trần.
- **Sửa:** `ExportPanelPreflight.tsx` chặn mặc định với bấm trái thường (giữ Ctrl/Cmd/Shift/chuột giữa);
  `RuleReport.container.tsx` chặn ở chỗ ráp mọi `<a href="/…">` trong màn và đẩy qua router (khuôn
  `UserManagement.container.tsx`). Bài đơn vị `ExportPanel.test.tsx` "B-V12-06",
  `RuleReport.test.tsx` "B-V12-11 / B-V12-06".

### B-V12-07 · Màn dữ liệu rỗng vẫn khoe "Hợp lệ … — 0 lỗi"

- **Trạng thái:** đã sửa (`c254885`)
- **Mức:** thấp — câu "hợp lệ" khi chưa có gì để kiểm là một lời xác nhận không có căn cứ
- **Bất biến vi phạm:** —
- **Phát hiện:** 2026-09-30 · V12 — plan.md mục 9 F7
- **Tái hiện bằng tay:** mở `/projects/project-1/data` — dưới thanh công cụ có "Hợp lệ theo hợp đồng Spatial JSON — 0 lỗi."
- **Tái hiện bằng máy:** `e2e/v12a/data.spec.ts` › "ca mồi, không bơm: màn dữ liệu nói chưa có dữ liệu …"
  `E2E_PORT=5199 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v12a/data.spec.ts -g "ca mồi"` — đã kiểm đỏ trước sửa (2026-10-03: cất bản sửa sản phẩm, chạy `e2e/v12a`: đỏ đúng chỗ khẳng định của lỗi)
- **Gốc:** `spatialJsonModel.ts` `summariseValidity([])` cho "0 lỗi"; `SpatialJsonViewer.tsx` vẽ dải ở mọi trạng thái.
- **Sửa:** `SpatialJsonViewer.tsx` không vẽ dải ở `empty`/`loading`. Bài đơn vị `SpatialJsonViewer.test.tsx` "B-V12-07".

### B-V12-08 · "Còn 2487 dòng nữa" không có dấu nhóm nghìn

- **Trạng thái:** đã sửa (`c254885`)
- **Mức:** thấp — cùng ứng dụng viết `5.000`, `57,9 KB`; số này viết thô
- **Bất biến vi phạm:** — (A15 nói dấu thập phân; đây là nhất quán định dạng số)
- **Phát hiện:** 2026-09-30 · V12 — plan.md mục 9 F8
- **Tái hiện bằng tay:** `/projects/project-1/data` khi kho có mô hình → tab "JSON" → cuối khung chữ thô
- **Tái hiện bằng máy:** `e2e/v12a/data.spec.ts` › "có bơm kho: cây dùng dấu phẩy thập phân, …"
  `E2E_PORT=5199 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v12a/data.spec.ts -g "dấu nghìn"` — đã kiểm đỏ trước sửa (2026-10-03: cất bản sửa sản phẩm, chạy `e2e/v12a`: đỏ đúng chỗ khẳng định của lỗi)
- **Gốc:** `SpatialJsonDetail.tsx` in `{hiddenCount}` thô.
- **Sửa:** `formatNumber(hiddenCount)` (`@/lib/format/number`; tiền lệ view: `CadBranchConfirm.tsx`).
  Bài đơn vị `SpatialJsonViewer.test.tsx` "B-V12-08".

### B-V12-09 · Chip "xem hướng dẫn" che nút "chia sẻ" ở màn xuất

- **Trạng thái:** đã sửa (`b51b966`) — sửa dưới mã **B-V2-05** (W02): chip xuống giữa đáy; bài e2e của B-V2-05 đo cả ba màn chủ ở hai cỡ khung nhìn
- **Mức:** trung bình — sau khi bỏ qua tour, bấm chuột vào "chia sẻ" trúng chip, không mở hộp chia sẻ
- **Bất biến vi phạm:** A12 (điều khiển nhìn thấy mà không bấm được bằng chuột)
- **Phát hiện:** 2026-09-30 · V12 (`elementFromPoint` = `SPAN:xem hướng dẫn`) — plan.md mục 9 F6
- **Tái hiện bằng tay:**
  1. Mở `/projects/project-1/export` khi kho có mô hình; đổi cỡ cửa sổ để tour hiện; bấm "bỏ qua"
  2. Bấm "chia sẻ"
  - Kỳ vọng: hộp thoại "chia sẻ bản vẽ"
  - Thực tế: chip "xem hướng dẫn" hứng cú bấm
- **Tái hiện bằng máy:** `e2e/v12a/export.spec.ts` › "có bơm kho: sau khi tour bị bỏ qua, chip … không che nút "chia sẻ"" (`test.fixme`)
  `E2E_PORT=5199 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v12a/export.spec.ts -g "chip"`
  Đã tạm bật (2026-10-03): đỏ ở `share.click` — "`<span>xem hướng dẫn</span>` … intercepts pointer events", đúng lý do.
- **Gốc:** `system/EditorTour/EditorTour.tsx` chip `fixed right-[16px] top-[16px]` trùng chỗ nút
  `chia sẻ` của `ExportPanel.tsx` ở mọi bề rộng ≥ 1280 px.
- **Sửa:** chưa (W02)

### B-V12-10 · Màn lịch sử phiên bản không mở được bằng bất kỳ đường nào

- **Trạng thái:** đã sửa (`c254885`) — questions.md Q6 = C; điều phối chốt 1C (2026-10-03): nối N17
- **Mức:** cao — người dùng không xem được phiên bản cũ nào
- **Bất biến vi phạm:** A11 (màn chỉ có nhánh lỗi)
- **Phát hiện:** 2026-09-30 · V12 (đo) — plan.md mục 9 F9
- **Tái hiện bằng tay:** mở `/projects/project-1/versions`
  - Kỳ vọng: danh sách phiên bản của một tầng
  - Thực tế (trước sửa): "Không xác định được bản vẽ"; kể cả có tầng đang mở thì "không tải được
    lịch sử phiên bản — chưa có nguồn dữ liệu phiên bản nào được nối vào màn này"
- **Tái hiện bằng máy:** `e2e/v12a/versions.spec.ts` › "mở "lịch sử phiên bản" từ đường dẫn của dự án …";
  dòng `projectVersions` của `e2e/smoke-grid.spec.ts` (nay neo `navigation 'Danh sách phiên bản'`, bỏ `known`)
  `E2E_PORT=5199 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v12a/versions.spec.ts` — đã kiểm đỏ trước sửa (2026-10-03: cất bản sửa sản phẩm, chạy `e2e/v12a`: đỏ đúng chỗ khẳng định của lỗi)
- **Gốc:** hai lớp. (1) Không nguồn dữ liệu: `endpoints.ts` chỉ có đường chi tiết; gateway ném
  `NO_VERSION_SOURCE_REASON` khi không ai bơm `entries`/`loadVersions`. BE có N17
  (`GET /projects/{id}/versions?floorId=`, `AppBack apps/api/versions/router.py`), FE có sẵn
  `FloorVersionPageSchema` mà không nơi gọi. (2) Route đọc tầng từ `activeFloorId` của kho — không ai đặt.
- **Sửa:** `endpoints.ts` `spatial.versions` · `client.ts` `spatial.listVersions` (chỉ THÊM) · bộ mẫu dev
  `__mocks__/client.ts` (3 phiên bản cho mỗi tầng có thật, tầng lạ → trang rỗng) · `versionHistoryGateway.ts`
  `createApiVersionLoader` (dòng `metadataOnly` — N18 chưa nối nên so sánh/phục hồi nói thẳng là chưa có nội
  dung) · `VersionHistory.container.tsx`: route chọn tầng `?floorId=` → tầng đang mở → tầng đầu tiên của dự
  án (`floors.list`, khoá con riêng dưới `floor.list` để không lặp B-G-01), câu lỗi nói thật ·
  `lib/versioning/restore.ts` `creatorName?` + `versionHistoryModel.ts` hiện tên người tạo thay vì mã `usr_…`.
  Bài đơn vị `VersionHistory.test.tsx` "B-V12-10" (bộ nạp + route).

### B-V12-11 · Màn cài đặt bộ luật không có lối vào trong giao diện

- **Trạng thái:** đã sửa (`c254885`) — điều phối chốt 4B (cùng khuôn Q10g A′)
- **Mức:** thấp — người dùng chỉ tới được bằng gõ đường dẫn
- **Bất biến vi phạm:** —
- **Phát hiện:** 2026-10-03 · vòng tranh luận (grep `ROUTES.project.ruleSettings`: chỉ `paths.ts`, `router.tsx`)
- **Tái hiện bằng tay:** mở `/projects/project-1/rules`, tìm đường sang cài đặt bộ luật — không có
- **Tái hiện bằng máy:** `e2e/v12a/rule-settings.spec.ts` › "màn cài đặt bộ luật tới được từ màn kiểm tra luật bằng liên kết …"
  `E2E_PORT=5199 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v12a/rule-settings.spec.ts -g "liên kết"` — đã kiểm đỏ trước sửa (2026-10-03: cất bản sửa sản phẩm, chạy `e2e/v12a`: đỏ đúng chỗ khẳng định của lỗi)
- **Gốc:** không màn nào dựng liên kết tới `ROUTES.project.ruleSettings`.
- **Sửa:** `RuleReport.tsx` liên kết "cài đặt bộ luật" ở đầu màn (prop tuỳ chọn `settingsPath`, hook dựng từ
  `ROUTES`), đi qua router (B-V12-06). Bài đơn vị `RuleReport.test.tsx` "B-V12-11 / B-V12-06".

### (F4) · Tấm chi tiết vi phạm không có hành động sửa

- **Trạng thái:** không phải lỗi
- **Phép đo đã bác:** `ruleReportGateway.ts` `canAutoFix/canDismiss/canPreview3d = false` có docblock lập
  luận (repo không có lệnh sửa/bỏ qua vi phạm); tấm nói thật "Chưa có cách sửa tự động nào cho vi phạm
  này. …" (đo 2026-10-03). Bài `rules.spec.ts` khẳng định đúng hiện trạng ấy (VD-3), không chờ "Lựa chọn xử lý".

### (F13) · Ghi chú lớp 1 thiếu `viewer` ở `/export`

- **Trạng thái:** không phải lỗi sản phẩm (lỗi ghi chú) — `viewer` ở `/export` là `forbidden` thật; bài
  `export.spec.ts` "vai người xem mở màn xuất …" khẳng định nó. Phần `ModelLibraryDetail` thuộc V12b.

## Tệp `src/` ngoài sáu màn của nhóm đã sửa

- `src/api/endpoints.ts`, `src/api/client.ts` (chỉ THÊM `spatial.versions` / `spatial.listVersions`),
  `src/api/__mocks__/client.ts` (thêm `listVersions`) — B-V12-10
- `src/lib/versioning/restore.ts` (thêm trường tuỳ chọn `creatorName`) — B-V12-10

Ghi chú gộp: W02 đổi tour để hiện ngay lúc mở màn — mọi bài có bơm ở `export.spec.ts` đã gọi
`dismissTourIfShown` sau khi nút `xuất` hiện, trước cú bấm đầu.

## V12b

### B-V12b-01 · Bấm "xoá" trên hàng người dùng không hỏi gì — hộp thoại xoá hẳn không bao giờ hiện

- **Trạng thái:** đã sửa (commit fix(admin-users) trên nhánh này)
- **Mức:** trung bình — quản trị viên không xoá được ai từ bảng (nút im lặng); khi sau đó mở
  tấm chi tiết của BẤT KỲ ai, hộp thoại xoá người cũ bật ra bất ngờ (gốc của "đến muộn 0,6 s" V12 ghi)
- **Bất biến vi phạm:** A9, A11 (hành động không phản hồi)
- **Phát hiện:** 2026-10-03 · đọc mã (vai Tester) + e2e
- **Tái hiện bằng tay:**
  1. Đăng nhập `admin@example.com`, mở `/admin/users`
  2. Không chọn ai; bấm `xoá` ở hàng `Nguyễn Bình`
  - Kỳ vọng: hộp thoại `xoá hẳn Nguyễn Bình?`
  - Thực tế: không có gì
- **Tái hiện bằng máy:** `e2e/v12b/admin-users.spec.ts` › "UM-3 · B-V12b-01 …"
  `E2E_PORT=5200 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v12b/admin-users.spec.ts -g "B-V12b-01"`
  Đã kiểm đỏ trước sửa: `getByRole('dialog', { name: 'xoá hẳn Nguyễn Bình?' })` — not found.
- **Gốc:** `UserManagementDetail.tsx` dựng `RemoveConfirmDialog` "ở gốc component, bất kể
  `detail`" (chính docblock nói vậy), nhưng `UserManagement.tsx:155` chỉ dựng cả component khi
  `model.detail !== null` — lời hứa của docblock bị cổng của cha nuốt.
- **Sửa:** xuất `RemoveConfirmDialog`, đặt ở gốc `UserManagement.tsx` ngoài nhánh `detail`;
  bỏ prop `removeConfirm` khỏi `UserManagementDetailProps`. Bài đơn vị
  `UserManagement.test.tsx` › "nút "xoá" trên hàng mở hộp hỏi trước cả khi chưa chọn ai".

### B-V12b-02 · Khối mời người dùng không đóng bằng Esc (F11)

- **Trạng thái:** đã sửa
- **Mức:** thấp — có nút `Huỷ`; nhưng phá lời hứa bàn phím A12
- **Bất biến vi phạm:** A12
- **Phát hiện:** 2026-09-30 · V12 (F11); đo lại 2026-10-03
- **Tái hiện bằng tay:** admin → `/admin/users` → `Mời người dùng` → `Escape` — khối vẫn còn.
- **Tái hiện bằng máy:** `admin-users.spec.ts` › "UM-4 · B-V12b-02 Esc đóng khối mời người dùng (A12)".
  Đã kiểm đỏ trước sửa: ô `email người được mời` vẫn visible sau Esc.
- **Gốc:** `UserManagement*.tsx` không có đăng ký `Escape` nào; khối mời là khối inline, không `Modal`.
- **Sửa:** một `useShortcut` phạm vi `sidePanel` ở `UserManagement.tsx` (khuôn `ModelLibraryDetail.tsx:283`),
  bật khi khối mời mở → `onCloseInvite`. Q-V12-C (fixme hay hiện trạng) hết cần hỏi: lỗi đã chữa,
  bài là `test` xanh. Bài đơn vị › "Esc đóng khối mời khi nó đang mở".

### B-V12b-03 · Sửa hồ sơ/giao diện ở `/tai-khoan` không có toast hoàn tác (F3)

- **Trạng thái:** chờ quyết
- **Mức:** trung bình — sửa nhầm họ tên thì không có đường quay lại ngoài gõ lại
- **Bất biến vi phạm:** A8
- **Phát hiện:** 2026-09-30 · V12 (F3); đo lại 2026-10-03: không toast nào sau `Đã lưu lúc …`
  (`[role=alert]` rỗng), `Ctrl+Z` chỉ là hoàn tác gốc của ô nhập
- **Tái hiện bằng tay:** `/tai-khoan` → sửa `họ tên` → chờ `Đã lưu lúc HH:mm` → không có `Hoàn tác`.
- **Tái hiện bằng máy:** `account.spec.ts` › "F3 sửa họ tên có toast "Hoàn tác" …" (`test.fixme`).
  Bật tạm thành `test`: đỏ đúng lý do — lưu xong, chờ nút `Hoàn tác` hết 30 s, không có.
- **Gốc:** `useAccountSettings.ts` (`bridgeRef.current.save`, ~:212) lưu mà không phát vé hoàn
  tác; toast hoàn tác chỉ có ở `useAccountAuth.ts:248-268` (đăng xuất phiên).
- **Vì sao chờ quyết:** mỗi lượt tự lưu 800 ms một toast là đổi hành vi (A7 × A8 va nhau: gõ
  chậm thì toast liên tục); `useUndoableToast` chỉ nghe commit của store, không dùng lại được.
  Cần người duyệt chọn: toast mỗi lượt lưu / gộp theo phiên sửa / chỉ cho thay đổi rời rạc
  (chủ đề, công tắc). Q-V12-D khuyến nghị A ("chưa phủ", không ca khẳng định hiện trạng) — ca
  `fixme` khẳng định hành vi **mong muốn**, tự xanh khi được nối.
- **Sửa:** chưa

### B-V12b-04 · Đường dẫn trang `/admin/models` viết hoa, lệch mọi màn quản trị khác (F14)

- **Trạng thái:** đã sửa
- **Mức:** thấp — nợ A6; nhưng neo `getByRole` thiếu `exact` không bao giờ bắt được
- **Bất biến vi phạm:** A6
- **Phát hiện:** 2026-09-30 · V12 (F14); đo 2026-10-03: nav `Đường dẫn trang`, chữ `Quản trị › Thư viện model`
- **Tái hiện bằng máy:** `admin-models.spec.ts` › "B-V12b-04 đường dẫn trang viết thường …".
  Đã kiểm đỏ trước sửa: nav `name: 'đường dẫn trang', exact` — not found.
- **Gốc:** `ModelLibrary.tsx:36-38` + `vi.json` `modelLibrary.breadcrumb` viết hoa; `UserManagement.tsx:47`,
  `RuleReport.tsx:82` viết thường.
- **Sửa:** ba hằng + ba khoá `vi.json` sang `đường dẫn trang` / `quản trị` / `thư viện model`.
  Bài đơn vị `ModelLibrary.test.tsx` › "A6 — đường dẫn trang viết thường …".

### B-V12b-05 · Nhánh 403 của bộ mẫu `/admin/users` không bao giờ được gọi (F10)

- **Trạng thái:** không phải lỗi
- **Phép đo đã bác nó:** vai thấp thấy `role=alert` forbidden + ma trận, 0 hàng người, 0 địa chỉ
  của người khác (UM-1 a–c xanh). Bộ nghe `request` chỉ thấy tệp mã nguồn — nhưng bộ mẫu chạy
  TRONG trình duyệt nên mạng không phân biệt được "không gọi" với "gọi bộ mẫu"; bằng chứng
  "không gọi" là mã: hook chặn trước bằng `enabled: canManage` (`useUserManagement.ts:498,510,522`). Chặn ở client là đúng thiết kế; ép quyền là việc của
  máy chủ (ngoài FE). Hệ quả cho bài: UM-1 nói "cổng phía client", không nói "máy chủ trả 403".

### B-V12b-06 · Bấm "Hoàn tác" xong toast vẫn treo, mời hoàn tác thêm lần nữa

- **Trạng thái:** đã sửa
- **Mức:** trung bình — mọi toast hoàn tác của ứng dụng (dùng chung `Toast.Item`); bấm lần hai gọi
  lại vé đã dùng
- **Bất biến vi phạm:** A8
- **Phát hiện:** 2026-10-03 · đo (kế hoạch ghi "toast còn: 1 — chưa rõ")
- **Tái hiện bằng tay:** admin → `/admin/users` → `vô hiệu hoá` Nguyễn Bình → `Hoàn tác` — hàng
  về `đang hoạt động` nhưng toast `đã vô hiệu hoá tài khoản — Nguyễn Bình · Hoàn tác` còn tới hết 8 s.
- **Tái hiện bằng máy:** `admin-users.spec.ts` › "UM-2 · B-V12b-06 …". Đã kiểm đỏ trước sửa:
  toast `toHaveCount(0)` — nhận 1.
- **Gốc:** `components/feedback/Toast.tsx` `onUndoClick` chỉ gọi `toast.onUndo()`, không rời đi.
- **Sửa:** sau `onUndo`, toast rời đi như khi hết giờ — trừ toast gộp (`summary-toast-group`), vì
  hoàn tác ở đó chỉ gỡ một lượt khỏi nhóm (prop `keepAfterUndo`). Bài đơn vị `Toast.test.tsx` ›
  "bấm "Hoàn tác" chạy lượt hoàn tác đúng một lần rồi toast rời đi" (đỏ trước sửa). Bài nhóm cũ vẫn xanh.

### B-V12b-07 · Tấm "chi tiết người dùng" (bố cục rộng) không đóng bằng Esc

- **Trạng thái:** đã sửa
- **Mức:** thấp — có nút đóng; A12. Bố cục hẹp (`Drawer`) thì có
- **Bất biến vi phạm:** A12
- **Phát hiện:** 2026-10-03 · đọc mã (vai Tester) + e2e
- **Tái hiện bằng máy:** `admin-users.spec.ts` › "UM-3b · B-V12b-07 …" — Esc thứ nhất đóng hộp thoại
  (phạm vi `dialog`), Esc thứ hai phải đóng tấm. Đã kiểm đỏ trước sửa: tấm vẫn visible.
- **Gốc:** `<aside>` ở `UserManagementDetail.tsx` không đăng ký Esc (khác `ModelLibraryDetail`).
- **Sửa:** cùng một đăng ký với B-V12b-02 (hai đăng ký cùng tổ hợp cùng phạm vi thì sổ phím cảnh
  báo trùng): khối mời mở → đóng nó, không thì đóng tấm (chỉ ở bố cục rộng). Bài đơn vị ›
  "Esc đóng tấm chi tiết ở bố cục rộng khi khối mời đóng".

### B-V12b-08 · Ghi chú lớp 1 thiếu (F13)

- **Trạng thái:** không phải lỗi — là ghi chú về kế hoạch. Phần của nhóm này (`ModelLibraryDetail`
  Esc phạm vi `sidePanel`) đo lại đúng: MD-2 xanh. Phần `viewer` trên `/export` đã vào lưới viewer
  (dòng `projectExport`, xanh).
