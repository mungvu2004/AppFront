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

## Tổng

| Trạng thái | Số mục |
|---|---|
| đã sửa | 80 |
| chờ quyết | 20 |
| không phải lỗi | 22 |
| ngoài FE | 8 |
| mở | 1 |
| **cộng** | **131** |

## Tổng

| Trạng thái | Số mục |
|---|---|
| đã sửa | 97 |
| không phải lỗi | 24 |
| ngoài FE | 9 |
| mở | 16 |
| đã quyết | 1 |
| **cộng** | **147** |

## Tổng

| Trạng thái | Số mục |
|---|---|
| đã sửa | 97 |
| không phải lỗi | 24 |
| ngoài FE | 9 |
| mở | 19 |
| đã quyết | 1 |
| **cộng** | **150** |

## Mục lục

| Mã | Lỗi | Trạng thái | Mức | Nguồn |
|---|---|---|---|---|
| B-G-01 | Từ màn 404 bấm "về danh sách dự án" thì bảng điều khiển đổ | đã sửa | cao | khung |
| B-G-02 | `Escape` ở `/thong-bao` mở trực tiếp đưa trình duyệt ra `about:blank` | đã sửa | cao | khung |
| B-G-03 | Mọi trang xin `/favicon.ico` và nhận 404 | đã sửa | thấp | khung |
| B-G-04 | Lúc tải route, màn hiện chữ tiếng Anh `Loading...` | đã sửa | trung bình | khung |
| B-G-05 | Màn đo gọi `/api/projects/:id/measurements` → 404 ở môi trường dev | đã sửa | thấp | khung |
| B-G-06 | `/thong-bao` mở luồng SSE `/api/streams/notifications` → 404 ở môi trường dev | ngoài FE | thấp | khung |
| B-G-07 | Mọi lượt lưu lớp không gian lên máy chủ thật trả 405 — FE gửi PATCH, BE chỉ có PUT | đã sửa | cao | khung |
| B-V1-01 | Mở thẳng một đường chết rồi bấm "quay lại" thì bị đưa ra khỏi ứng dụng | đã sửa | cao | khung |
| B-V1-02 | Đăng nhập với `?next=/login` bỏ người dùng lại trước biểu mẫu trống; `/\evil` lọt bộ lọc đích | đã sửa | trung bình | khung |
| B-V1-03 | Bản điện thoại `/m/du-an/:projectId` luôn nói "chưa có mô hình để xem" | đã sửa | cao | I6 |
| B-V1-04 | Cờ "đã xem màn chào" được ghi mà không ai đọc — mở lại `/onboarding` vẫn là màn chào | đã sửa | thấp | I3 |
| B-V1-05 | Màn "không có quyền" `/khong-co-quyen` không ai dẫn tới | ngoài FE | thấp | I3 |
| B-V1-06 | Nhãn login/onboarding viết hoa đầu câu, ba màn hệ thống viết thường hoàn toàn | đã sửa | thấp | I5 |
| B-V1-07 | `/login/invitation/*` và `/login/reset-password/*` ra màn 404 | không phải lỗi | — | khung |
| B-V1-08 | `role="status"` rỗng và 404 trên màn không có quyền | không phải lỗi | — | khung |
| B-V1-09 | Chữ nhân đôi trong `textContent` của nút ("Đăng nhậpĐăng nhập") | không phải lỗi | — | khung |
| B-V1-10 | Canvas của bản điện thoại không có mốc neo | không phải lỗi | — | khung |
| B-V1-11 | Tầng chưa có hình bị gắn "chưa tải"/mạng yếu; quy tắc `empty` của bản máy tính lệch bản điện thoại | mở | trung bình | I6 |
| B-V1-12 | Khoá `project.detail(id)` mang ba hình dữ liệu; đi `/3d` rồi sang `/m/du-an` thì ném lỗi | mở | trung bình | I6 |
| B-V1-41 | Câu `skipNotice` hứa "xem lại trong menu trợ giúp", nhưng menu đó không tồn tại | mở | thấp | I3 |
| B-V1-42 | Người đăng nhập lần đầu không được dẫn tới `/onboarding` | mở | thấp | I3 |
| B-V1-43 | Người ngoài dự án mở `/3d` ra trạng thái `error` thay vì màn không-tìm-thấy | mở | thấp | I3 |
| B-V1-44 | Chuỗi dùng chung `vi.json:2-72` viết hoa, và mẫu dữ liệu NotFound lệch khỏi hook | mở | thấp | I5 |
| B-V2-01 | Tour hướng dẫn không hiện khi người dùng lần đầu mở màn; nó bật lên giữa chừng ở cú bấm/resize sau | đã sửa | cao | khung |
| B-V2-02 | Sau "Đánh dấu tất cả đã đọc", trình đọc màn hình nghe "không có thông báo nào" trong khi danh sách vẫn còn | đã sửa | trung bình | khung |
| B-V2-03 | Tấm trượt thông báo là một "hộp thoại" không tên | đã sửa | trung bình | khung |
| B-V2-04 | Bấm một thông báo ở `/thong-bao` đưa người dùng về danh sách dự án thay vì màn của thông báo | đã sửa | cao | khung |
| B-V2-05 | Chip "xem hướng dẫn" che nút của màn chủ ("chia sẻ", "Góc nhìn sẵn") | đã sửa | trung bình | khung |
| B-V2-06 | "Đánh dấu tất cả đã đọc" không có toast/Hoàn tác | đã sửa | thấp | I4 |
| B-V3-01 | Bảng điều khiển đọc trạng thái màn bằng tiếng Anh cho trình đọc màn hình | đã sửa | trung bình | khung |
| B-V3-02 | Mở lại hộp thoại tạo dự án thì nó đứng ở bước 3 với dự án vừa tạo; "bỏ thay đổi" không bỏ gì | đã sửa | cao | khung |
| B-V3-03 | Ô đổi tên dự án tại chỗ không có tên truy cập | đã sửa | thấp | khung |
| B-V3-04 | Hộp thoại chia sẻ mở ra đã ở lỗi "thao tác chia sẻ đã bị huỷ" dù máy chủ khoẻ | đã sửa | cao | khung |
| B-V3-05 | Xoá dự án xong, danh sách dự án không báo gì (F4) | đã sửa | trung bình | khung |
| B-V3-06 | "Thu hồi" liên kết chia sẻ gửi ngay, không hỏi (F2) | đã sửa | cao | khung |
| B-V3-07 | Mọi toast của hộp thoại chia sẻ câm trên route thật (gồm Hoàn tác của "đổi quyền") | đã sửa | trung bình | khung |
| B-V3-08 | Nút chuông "Thông báo" ở danh sách dự án không làm gì | đã sửa | trung bình | I4 |
| B-V3-09 | Mỗi lượt tải `/export` đọc danh sách liên kết chia sẻ dù hộp thoại đóng | đã sửa | thấp | khung |
| B-V4-01 | Màn xử lý luôn "Chưa có bước nào để theo dõi", dù dự án có bản vẽ | đã sửa | cao | khung |
| B-V4-02 | "Tiếp tục xử lý" đi tiếp dù ô xác nhận mức Kém chưa tích | đã sửa | trung bình | khung |
| B-V4-03 | Hoàn tác xoá một bản vẽ đã gắn trả thẻ về "chờ xử lý" mãi | đã sửa | trung bình | khung |
| B-V4-04 | "Bắt đầu xử lý" cho qua tầng có tệp chưa tải xong (PDF chưa chọn trang, tệp hỏng) | đã sửa | cao | khung |
| B-V4-05 | Hoàn tác "Tự động nắn" chỉ trả một nửa: bộ đếm "còn lại" lệch | đã sửa | thấp | khung |
| B-V4-06 | Tệp `.dwg` kéo thả vào qua được kiểm tra nhưng bộ mẫu dev không trả 422 | ngoài FE | thấp | khung |
| B-V4-07 | Menu thẻ tải lên không nói mở/đóng, và mở ra bảng rỗng ở tầng có bản vẽ sẵn | đã sửa | thấp | khung |
| B-V4-08 | Bản vẽ vừa tải lên không hiện ở màn xử lý trên môi trường dev | ngoài FE | thấp | khung |
| B-V4-09 | A9 và xác nhận inline ở "Huỷ xử lý" / "Bỏ qua tầng đó" | đã quyết | thấp | I4 |
| B-V4-10 | Màn xử lý mở luồng SSE `/api/streams/projects/:id/uploads/:uploadId/progress` → 404 ở dev | ngoài FE | thấp | khung |
| B-V4-11 | Bấm "Hoàn tác" xong, toast ở lại mãi và che nút chính | đã sửa | trung bình | khung |
| B-V5-01 | "Áp dụng tỷ lệ" bấm không làm gì, không nói gì | đã sửa | cao | khung |
| B-V5-02 | Tỷ lệ chỉ sống trong phiên, "Tỷ lệ hiện tại" đổi ngay khi gõ | ngoài FE | thấp | khung |
| B-V5-03 | Sơ đồ xử lý khẳng định "mỗi tầng đang đi một nhánh khác nhau" khi chưa có dữ liệu nào | đã sửa | thấp | khung |
| B-V5-04 | Tầng không có trong dự án bị báo "Nắn ảnh thất bại" | đã sửa | thấp | khung |
| B-V5-05 | Hai quy ước số trên màn tỷ lệ (`4.800 mm` và `1600,00`) | không phải lỗi | — | khung |
| B-V5-06 | Tên phím viết hai kiểu (`ESCAPE` ở dòng nhắc, `Esc` ở ô phím) | không phải lỗi | — | khung |
| B-V5-07 | Người xem bấm "Vẫn dùng AI" vẫn được đưa sang màn xử lý | không phải lỗi | — | khung |
| B-V5-08 | `h1` màn nền và `h2` hộp thoại cùng chữ "Phát hiện tệp CAD" | không phải lỗi | — | khung |
| B-V5-09 | Người xem vẫn thấy nút "Đo lại" ở màn tỷ lệ | không phải lỗi | — | khung |
| B-V5-10 | `projectScale` với `L1` mở thẳng ra `error` | không phải lỗi | — | khung |
| B-V6-01 | Bảy màn QC treo skeleton / rỗng vĩnh viễn — cổng đọc lại chính cái kho rỗng | đã sửa | cao | khung |
| B-V6-02 | Toast xoá tường lộ mã máy `W-000001WALL` trong khi danh sách gọi nó `#W-001` | đã sửa | trung bình | khung |
| B-V6-03 | Màn QC không bao giờ tự lưu; "Có thay đổi chưa lưu" ở lại mãi | đã sửa | cao | khung |
| B-V6-04 | Nhãn A6 không nhất quán trong nhóm: "Ẩn lớp Tường" viết hoa giữa câu | đã sửa | thấp | I5 |
| B-V6-05 | Ghi chú lớp 1 ghi "NOT FOUND" cho ba chuỗi có thật (P4) | không phải lỗi | — | khung |
| B-V6-06 | Vùng trạng thái biến mất sau `Ctrl+Z` ở màn kích thước (F6/P7) | không phải lỗi | — | khung |
| B-V6-07 | Mô tả ảnh nền "Bản vẽ gốc của L-000001LVL0" lộ mã tầng | không phải lỗi | — | khung |
| B-V6-08 | Ray công cụ 3D quảng cáo phím R·H·C·V mà không phím nào chạy | đã sửa | trung bình | khung |
| B-V6-09 | Nhãn mã của màn QC trùng nhau với id của BE (ULID) và id bộ mẫu A14 | đã sửa | cao | khung |
| B-V6-10 | Màn đối tượng: ba nút "chọn nhóm" bị khoá cho tới khi đã chọn một nhóm bằng bàn phím | đã sửa | trung bình | khung |
| B-V6-11 | Màn tường: Escape không bỏ chọn, không bỏ nét đang vẽ dở | đã sửa | trung bình | khung |
| B-V6-12 | Ray công cụ tường/đối tượng không nói công cụ nào đang bật (`aria-pressed` vắng) | đã sửa | thấp | khung |
| B-V6-13 | Màn đối tượng chỉ hiện đối tượng có trong bảng mẫu cứng; dữ liệu thật vô hình | đã sửa | cao | I2 |
| B-V6-14 | Màn trục sẽ luôn rỗng trên BE thật — N16 v1 trả `axes: []` | ngoài FE | trung bình | khung |
| B-V6-40 | Màn đối tượng: `levelOfGraph` luôn lấy tầng đầu tiên của đồ thị, không theo tầng của URL | mở | trung bình | I2 |
| B-V6-41 | Màn đối tượng: "thêm thủ công" đề nghị mã cửa kế tiếp chỉ từ bảng mẫu | mở | thấp | I2 |
| B-V6-42 | Nhãn viết hoa chữ đầu ở các màn QC còn lại | mở | thấp | I5 |
| B-V7-01 | Phòng và độ dày tự lưu mà câm | đã sửa | trung bình | khung |
| B-V7-02 | Lưu thất bại thì câu báo bảo "lưu lại thủ công" — mà không có nút lưu nào | đã sửa | trung bình | khung |
| B-V7-03 | Mở lại hộp thoại "Gộp hai phòng" ở phòng khác thì ứng viên cũ vẫn được chọn ngầm, nút xác nhận bật | đã sửa | trung bình | khung |
| B-V7-04 | Ctrl+Z ngay sau khi dữ liệu nạp vào làm màn trống trơn | đã sửa | trung bình | khung |
| B-V7-05 | Câu lệnh, toast và câu luật lộ mã máy (`R-000001ROOM`, `W-000032THIK`) trong khi danh sách gọi thực thể là `#R-001` | đã sửa | thấp | khung |
| B-V7-06 | Ctrl+Z trong ô "Tên phòng" không hoàn tác lượt đổi tên | không phải lỗi | — | khung |
| B-V7-07 | "Áp dụng" chuẩn hoá độ dày không đổi gì | không phải lỗi | — | khung |
| B-V7-08 | Lệnh phòng bị từ chối (gộp, đổi tên trùng…) thì không một chữ nào — bấm xác nhận và không thấy gì xảy ra | đã sửa | cao | khung |
| B-V7-09 | Hoàn tác (vé toast hoặc Ctrl+Z) trả vùng chọn về TRƯỚC lần bấm gần nhất — phòng bị bỏ chọn, thanh tra đóng | đã sửa | thấp | khung |
| B-V7-10 | Câu trạng thái rỗng bảo bấm "Kiểm tra vòng hở" — nút thật tên là "Kiểm tra lại vòng hở" | đã sửa | thấp | khung |
| B-V7-11 | Ba màn QC-b chỉ có nội dung qua cửa bơm dev | đã sửa | cao | khung |
| B-V7-12 | Lớp QC-b không có đầu ghi máy chủ | đã sửa | cao | khung |
| B-V7-13 | `viewer3d.spec.ts` ghi màn tầng hiện "0 tầng" | không phải lỗi | — | khung |
| B-V7-14 | Màn phòng hiện 248,60 m² — không khớp số nào của A14 | không phải lỗi | — | khung |
| B-V7-15 | "mô hình 3d" viết thường trong câu nợ của màn tầng | không phải lỗi | — | khung |
| B-V7-21 | Màn tầng nói "chưa có tầng nào" khi danh sách tầng có bốn tầng (bộ mẫu dev) | ngoài FE | trung bình | khung |
| B-V7-22 | Kích thước và trục không có đường lưu nào — #35 chỉ nhận bốn danh sách | ngoài FE | cao | khung |
| B-V7-30 | Hoàn tác giữ phòng đang chọn nhưng ô "Tên phòng" vẫn hiện tên vừa bị hoàn tác | đã sửa | thấp | khung |
| B-V7-31 | Báo cáo luật: chip của hàng vi phạm và tấm chi tiết in mã máy (`D-DOOR0000000`) trong khi câu luật nói `#D-001` | đã sửa | thấp | I1 |
| B-V7-41 | Bộ mẫu màn quản lý tầng khai 7,31 m² mỗi phòng nhưng đường bao đo 17,00 | mở | thấp | I6 |
| B-V7-42 | Mã có tiền tố loại nhưng không có thực thể ra nhãn rác (`W-MISSING1AA` → `#W-MISSIN`) | mở | thấp | I1 |
| B-V8-01 | Thu phóng (cuộn chuột và nút "Phóng to") chết ở 3/4 góc nhìn 3D | đã sửa | cao | khung |
| B-V8-02 | Nút ray tầng hiện mã máy `L-01FIXTURE0` thay cho tên tầng | đã sửa | trung bình | khung |
| B-V8-03 | Thư viện đồ đạc nói sai lý do "vai chỉ xem" với admin/kỹ sư, và khoá kéo-thả với mọi vai | đã sửa | trung bình | I3 |
| B-V8-04 | Bảng diện tích và panel thuộc tính trên màn 3D kẹt "đang tải" mãi | đã sửa | cao | I6 |
| B-V8-05 | Cùng một bức tường mang hai mã: tiêu đề thanh tra `W-0403FIXTURE0`, dải chế độ sửa `W-403FI` | đã sửa | thấp | I1 |
| B-V8-06 | Hai mốc trùng tên "Thanh tra đối tượng" khi có đối tượng đang chọn | đã sửa | thấp | khung |
| B-V8-07 | Chip lọc lịch sử "AI" viết hoa | không phải lỗi | — | I5 |
| B-V8-08 | "Hai `role=status` cùng lúc khi dựng xong" (F7) | không phải lỗi | — | khung |
| B-V8-09 | Tour chắn cú bấm đầu trên màn 3D (F8) | không phải lỗi | — | khung |
| B-V8-10 | Ba con số "248,60 m²" từ hai bộ mẫu; số hình học của bộ mẫu chuẩn là 238,00 (F9) | đã sửa | thấp | I6 |
| B-V8-11 | Nút "Xong" của chế độ sửa hình học tường bấm không được — ViewCube đè lên | đã sửa | trung bình | khung |
| B-V8-12 | Kho đổi (hay bấm "Thử lại") thì cảnh 3D chết: "Trình duyệt này chưa xem được mô hình 3D" | đã sửa | cao | khung |
| B-V8-41 | Đích lưu trên `/3d` không theo tầng của đối tượng đang sửa (N1) | mở | cao | I6 |
| B-V8-42 | Câu chữ khi rỗng / không có đích lưu nói sai (N2) | mở | trung bình | I6 |
| B-V8-43 | Nhãn viết hoa trong HistoryPanel | mở | thấp | I5 |
| B-V8-44 | Tiêu đề cảnh báo ở ViewerInspector viết hoa chữ đầu | mở | thấp | I5 |
| B-V8-45 | Bộ mẫu vỏ 3D cho nhãn người đọc xấu (`W-403FI`, `R-11FIX`); ô tìm phòng in `room.id` | mở | thấp | I1 |
| B-V8-46 | Thư viện đồ đạc: dưới 1024 px, nhánh `collapsed` che câu "vai chỉ xem" | mở | thấp | I3 |
| B-V9-01 | Ba màn 3D (tách tầng, đo, đối chiếu) không có lối vào nào từ sản phẩm | đã sửa | trung bình | khung |
| B-V9-02 | Ở dev, tách tầng và đo hiện khung nhìn rỗng (canvas 300×150, "0 tầng") trong khi `/3d` có nhà bốn tầng | đã sửa | trung bình | khung |
| B-V9-03 | Nút "thoát chế độ đo (phím Esc)" không thoát chế độ đo | đã sửa | thấp | khung |
| B-V9-04 | Vai Người xem: phím M không vào chế độ đo, và vào bằng nút "bật tắt công cụ đo" thì ray không nút nào sáng | đã sửa | thấp | I1 |
| B-V9-05 | Hai câu "không có quyền" cạnh nhau ở tách tầng viết tên vai khác nhau | đã sửa | thấp | I5 |
| B-V9-06 | Từ `/3d` (nhà bốn tầng) sang đối chiếu, màn nói "dự án này chưa có tầng nào" | đã sửa | trung bình | khung |
| B-V9-07 | Nhãn ray quảng cáo phím `R`/`H`/`C`/`V` nhưng không phím nào hoạt động | đã sửa | trung bình | khung |
| B-V9-08 | Ray tầng của tách tầng và đo hiện mã bộ mẫu `L-01FIXTURE0…` | đã sửa | thấp | khung |
| B-V9-41 | Màn đo: nút xoá và phím Delete không bị chặn khi `forbidden` | mở | thấp | I1 |
| B-V10-01 | Sau `PASCAL-01`, bấm "thử lại" hay phím R không bao giờ nạp lại — kể cả khi gói đã trở lại | đã sửa | cao | khung |
| B-V10-02 | Màn Pascal chỉ cao 384 px; khung 3D là một dải 190 px trong cửa sổ 900 px | đã sửa | trung bình | khung |
| B-V10-03 | Cờ tắt vẫn tải và chạy bộ đổi bản vẽ sang Pascal | đã sửa | thấp | khung |
| B-V10-04 | Bộ đổi dữ liệu nạp hỏng rồi bấm "thử lại" thì kẹt khung xương "đang nạp…" mãi | đã sửa | trung bình | khung |
| B-V10-05 | Gói Pascal gây 1 vi phạm CSP `script-src eval` | đã sửa | thấp | I3 |
| B-V10-06 | Bốn số Pascal không phải bộ A14; trang chỉ có tường bao + phòng (P2 của V10) | không phải lỗi | thấp | I6 |
| B-V10-41 | `pascal-mount.js` không có mã băm nhưng `/assets/` gửi `immutable` một năm | mở | trung bình | I3 |
| B-V12-01 | Bốn màn luật/xuất/dữ liệu luôn rỗng khi đi bằng đường sản phẩm | đã sửa | cao | I6 |
| B-V12-02 | Nút chính "Chạy kiểm tra" của màn luật rỗng dẫn thẳng vào màn lỗi | đã sửa | trung bình | khung |
| B-V12-03 | Cài đặt bộ luật nói "chưa có luật nào" ngay dưới dòng "23/25 luật đang bật" | đã sửa | thấp | khung |
| B-V12-04 | Sửa luật ở cài đặt bộ luật không có toast hoàn tác | đã sửa | trung bình | khung |
| B-V12-05 | Bấm "xuất" không tải tệp nào về máy | đã sửa | cao | khung |
| B-V12-06 | Link "sửa" (màn xuất) và link khắc phục (màn luật) nạp lại cả trang | đã sửa | trung bình | khung |
| B-V12-07 | Màn dữ liệu rỗng vẫn khoe "Hợp lệ … — 0 lỗi" | đã sửa | thấp | khung |
| B-V12-08 | "Còn 2487 dòng nữa" không có dấu nhóm nghìn | đã sửa | thấp | khung |
| B-V12-09 | Chip "xem hướng dẫn" che nút "chia sẻ" ở màn xuất | đã sửa | trung bình | khung |
| B-V12-10 | Màn lịch sử phiên bản không mở được bằng bất kỳ đường nào | đã sửa | cao | khung |
| B-V12-11 | Màn cài đặt bộ luật không có lối vào trong giao diện | đã sửa | thấp | khung |
| B-V12b-01 | Bấm "xoá" trên hàng người dùng không hỏi gì — hộp thoại xoá hẳn không bao giờ hiện | đã sửa | trung bình | khung |
| B-V12b-02 | Khối mời người dùng không đóng bằng Esc (F11) | đã sửa | thấp | khung |
| B-V12b-03 | Sửa hồ sơ/giao diện ở `/tai-khoan` không có toast hoàn tác (F3) | đã sửa | trung bình | I4 |
| B-V12b-04 | Đường dẫn trang `/admin/models` viết hoa, lệch mọi màn quản trị khác (F14) | đã sửa | thấp | khung |
| B-V12b-05 | Nhánh 403 của bộ mẫu `/admin/users` không bao giờ được gọi (F10) | không phải lỗi | — | khung |
| B-V12b-06 | Bấm "Hoàn tác" xong toast vẫn treo, mời hoàn tác thêm lần nữa | đã sửa | trung bình | khung |
| B-V12b-07 | Tấm "chi tiết người dùng" (bố cục rộng) không đóng bằng Esc | đã sửa | thấp | khung |
| B-V12b-08 | Ghi chú lớp 1 thiếu (F13) | không phải lỗi | — | khung |

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

- **Trạng thái:** đã sửa (`1ea0ad8`) — bài tái hiện **đã kiểm đỏ trước sửa**
- **Mức:** cao — bản điện thoại không xem được dự án nào
- **Bất biến vi phạm:** A11 (`empty` nói sai sự thật)
- **Phát hiện:** 2026-09-30 · kế hoạch mục 9 phát hiện 1; đo lại 2026-10-03
- **Tái hiện bằng tay:** khung 390×844, mở `/m/du-an/project-1`, bấm "tầng". Trước sửa: 0 tầng, thân
  màn "chưa có mô hình để xem". Sau sửa: 4 tầng thật của dự án ("tầng hầm…"), và vì mock chưa có hình
  nên "chưa có mô hình để xem" là câu ĐÚNG.
- **Tái hiện bằng máy:** `e2e/v1/mobile-viewer.spec.ts` › "không bơm: bốn tầng của dự án có thật,
  và nói thật rằng chưa có mô hình để xem" (docblock: đỏ khi mock N16 trả hình cho `project-1`) và
  › "bơm bộ mẫu A14 vào dự án đã nạp: thấy mô hình, không thấy "chưa có mô hình để xem"" (fixme cũ
  → `test`).
  `E2E_PORT=5193 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v1/mobile-viewer.spec.ts`
- **Gốc:** `MobileViewer.container.tsx` không nạp gì; `useMobileViewer.ts` đọc `store.spatial` rỗng.
- **Sửa:** `MobileViewerRoute` bọc cổng sau nhánh thiếu mã; `useMobileViewer.ts` — đang nạp thì
  `spatial = null` (không vẽ dự án cũ dưới tên dự án mới), `hasGeometry` quyết định cùng lúc lắp
  cảnh, `loading` (`spatialLoading ||`) và `empty`. Bài đơn vị `useMobileViewer.test.tsx` +3 ca
  (đang nạp → `loading` rồi `success`; 4 tầng rỗng → `empty`, không lắp cảnh; chỉ tường → `partial`).

### B-V1-04 · Cờ "đã xem màn chào" được ghi mà không ai đọc — mở lại `/onboarding` vẫn là màn chào

- **Trạng thái:** đã sửa (`6ccbb0e`)
- **Mức:** thấp — không chặn ai; nhưng một cờ ghi mà không đọc là một lời hứa ("lần sau không hiện nữa") không được giữ
- **Bất biến vi phạm:** —
- **Phát hiện:** 2026-10-03 · vòng Tester (đọc mã) + lượt dò tạm: sau "Bỏ qua" có khoá `appfront:onboarding-welcome-seen:user-mock`; `goto('/onboarding')` lần hai ⇒ vẫn `/onboarding`
- **Tái hiện bằng tay:**
  1. Mở `/onboarding`, bấm "Bỏ qua".
  2. Gõ lại `/onboarding`.
  - Kỳ vọng: về danh sách dự án `/`.
  - Thực tế (trước sửa): màn chào hiện lại.
- **Tái hiện bằng máy:** `e2e/v1/onboarding.spec.ts` › "đã "Bỏ qua" rồi thì mở lại /onboarding không thấy lại màn chào" (`test`, thêm khẳng định `pathOf(page.url()) === ROUTES.dashboard`)
  `E2E_PORT=5195 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v1/onboarding.spec.ts -g "mở lại"` — **đã kiểm đỏ trước sửa**: `Timed out 15000ms … toBeVisible` ở `onboarding.spec.ts:75`.
- **Gốc:** `useWelcomeScreen.ts` ghi cờ (`markWelcomeSeen`); `readWelcomeSeen` chỉ được xuất (`index.ts:43`), không route nào đọc.
- **Sửa:** `WelcomeScreen.container.tsx` › `WelcomeRoute`: `const [seen] = useState(() => readWelcomeSeen(session.user?.id ?? null))`; `seen` ⇒ `<Navigate replace to={ROUTES.dashboard} />`. Đọc MỘT lần, vì chính màn ghi cờ khi sang `success` — đọc ở mỗi lần dựng sẽ đá người dùng khỏi màn trước khi họ bấm "Vào danh sách dự án". Docblock ghi rõ: không có đường xem lại màn chào là CỐ Ý (xem lại hướng dẫn thuộc S-40); câu `skipNotice` lệch ghi riêng ở B-V1-41. `useWelcomeScreen.ts` bỏ cụm "Layer 3". Bài đơn vị `WelcomeScreen.test.tsx` (22 → 25 bài): có khoá ⇒ thấy "Dự án của tôi", không "Bỏ qua"; không khoá ⇒ thấy "Bỏ qua"; đi hết ba bước, chờ cờ, `rerender` một phần tử MỚI ⇒ nút "Vào danh sách dự án" vẫn còn. Docblock e2e "22 bài" → "25 bài".

### B-V1-05 · Màn "không có quyền" `/khong-co-quyen` không ai dẫn tới

- **Trạng thái:** ngoài FE — chủ quyết: BE (lối mở liên kết chia sẻ công khai, BE-BIND v2) cùng người giữ sản phẩm
- **Mức:** thấp — hôm nay không có 403 thật nào mà màn này phải đón: người ngoài dự án nhận 404, và các màn tự chặn theo vai trước khi gọi API
- **Bất biến vi phạm:** —
- **Phát hiện:** 2026-09-30 · kế hoạch mục 9 phát hiện 2; đo lại 2026-10-03: `grep ROUTES.accessDenied` trong `src/` ngoài test = 0
- **Tái hiện bằng tay:** không có cú bấm nào dẫn tới màn — đó chính là lỗi
- **Tái hiện bằng máy:** không có bài, không `test.fixme` (thiết kế đã chốt). Bộ mẫu API chạy trong trang, không có request mạng để `page.route` trả 403; hai lối ra của màn đã có bài trong `exits.spec.ts`.
- **Gốc:** không nơi nào gọi `ROUTES.accessDenied`. Bằng chứng tiền đề "403 khi đọc dự án" sai:
  - K08: người ngoài dự án nhận **404**, không 403 (`AppBack/apps/api/projects/access.py:5-6,82-83`).
  - Các màn tự chặn theo vai TRƯỚC khi gọi API (`useViewer3D.ts:657`, `useUserManagement.ts:498,957-958`).
  - Bộ mã 403 của BE chỉ có `FORBIDDEN`, `ACCOUNT_DISABLED`, `ORIGIN_MISMATCH` (`AppBack/packages/core/error_codes.py:11,21-22`) — không mã nào chọn được ba lý do riêng (REVOK/EXPIR/PASSWORD) của màn.
- **Sửa:** chỉ tài liệu/chú thích, không đổi hành vi (`e0cbd5c`): `accessDeniedModel.ts` (tiền đề "403" → "404 (K08)"), `AccessDenied/index.ts` (bỏ lời hứa "điều phối viên chuyển người dùng tới đây", thay bằng "đích DÀNH SẴN; màn chủ dựng `AccessDeniedContainer` tại chỗ với prop `error`"), `docs/prompt-logic-S44-thieu.md` (`projects.read` trả 404 cho người không phải thành viên; ghi chú bộ mã 403).
- **Hai phương án cho chủ quyết:**
  - **PA-A (khuyên):** giữ màn làm đích dành sẵn, không nối gì cho tới khi liên kết chia sẻ v2 có lối mở công khai.
  - **PA-B:** BE làm `POST /share-links/{token}/unlock` (theo `docs/prompt-logic-S44-thieu.md`), trả 403 với `code` chứa REVOK/EXPIR/PASSWORD. Màn mở liên kết dựng `AccessDeniedContainer` tại chỗ: không `navigate`, không đổi URL. Ước ~15 dòng FE.

### B-V1-06 · Nhãn login/onboarding viết hoa đầu câu, ba màn hệ thống viết thường hoàn toàn

- **Trạng thái:** đã sửa (`cd75dd5`)
- **Mức:** thấp — hai lớp chữ của cùng một luồng đầu vào theo hai quy ước; trình đọc màn hình không sai, người đọc
  thấy lệch
- **Bất biến vi phạm:** A6 (nhãn viết thường)
- **Phát hiện:** 2026-09-30 · kế hoạch mục 9 phát hiện 4; đo lại 2026-10-03: onboarding sáu nút `Tạo dự án`,
  `Tải bản vẽ`, `Duyệt kết quả`, `Xem dự án mẫu`, `Xem hướng dẫn 2 phút`, `Bỏ qua`; accessDenied
  `đăng nhập bằng tài khoản khác`, `về danh sách dự án`
- **Tái hiện bằng tay:**
  1. Mở `/login`: tab, nhãn trường và nút gửi viết `Đăng nhập`, `Thư điện tử`, `Mật khẩu`.
  2. Mở `/onboarding`: các nút viết hoa chữ đầu.
  - Kỳ vọng: nhãn viết thường hoàn toàn như accessDenied (`đăng nhập bằng tài khoản khác`).
  - Thực tế (trước sửa): viết hoa chữ đầu.
- **Tái hiện bằng máy:** `e2e/v1/onboarding.spec.ts` › ""bỏ qua" đưa người dùng mới tới danh sách dự án" (và hai bài
  cùng tệp), `e2e/auth/login.spec.ts` (mọi bài đi qua nút `đăng nhập` exact), `e2e/smoke-grid.spec.ts` hàng `login`,
  `onboarding` · **đã kiểm đỏ trước sửa** (2026-10-03, `src/screens/onboarding` + `vi.json` của `8bb2734`:
  13 failed / 2 passed)
- **Gốc:** `useWelcomeScreen.ts` `STRINGS`, `WelcomeScreen.tsx` ba hằng, và `vi.json` `auth.*` (màn đăng nhập đọc
  thẳng `vi.json`) viết nhãn kiểu câu; ba màn hệ thống viết thường.
- **Sửa:** `useWelcomeScreen.ts` (lời chào, tiêu đề ba bước, nút, `skip`, `finish`), `WelcomeScreen.tsx`
  ('không đọc được tiến độ', 'thử lại', 'Vai người xem…'), `vi.json` `auth.tabs/fields/actions`, ba tiêu đề lỗi
  đăng nhập, và bản chép `onboarding.*`; `WelcomeScreen.stories.tsx`. E2E: `fixtures/session.ts:39-41`,
  `pascal-viewer.spec.ts`, `viewer3d.spec.ts` (ba hằng), `smoke-grid.spec.ts:77-78`, `v1/onboarding.spec.ts`,
  `v1/escape.spec.ts:22`, `v2v3/create-project.spec.ts:35`. Bài đơn vị `WelcomeScreen.test.tsx` (đủ chữ mới,
  gồm `queryByRole('tạo dự án')` ở ca đang tải để bài còn kiểm được), `EditorTour.test.tsx` (danh sách S-06) ·
  commit `cd75dd5`.

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

### B-V1-11 · Tầng chưa có hình bị gắn "chưa tải"/mạng yếu; quy tắc `empty` của bản máy tính lệch bản điện thoại

- **Trạng thái:** mở
- **Mức:** trung bình — câu sai về lý do màn không có hình
- **Bất biến vi phạm:** A11
- **Phát hiện:** 2026-10-03 · tranh luận nguồn dữ liệu (đọc mã)
- **Tái hiện bằng tay:** —
- **Tái hiện bằng máy:** chưa có bài (mục mới — lệnh giao: không làm)
- **Gốc:** `useViewer3D.ts` nhánh `empty` (`data.storeys.length === 0`) — tầng có tên mà 0 tường vẫn
  không `empty`; bản điện thoại nay dùng `hasGeometry` (B-V1-03). Trên điện thoại, hàng tầng chưa
  có hình vẫn mang huy hiệu "chưa tải" (đo: tên nút "tầng hầm chưa tải…" ở `project-1`) — câu ấy
  nói về mạng, không về việc tầng chưa được dựng.
- **Sửa:** chưa. Hướng: dùng chung một vị ngữ "có hình" cho hai bản.

### B-V1-12 · Khoá `project.detail(id)` mang ba hình dữ liệu; đi `/3d` rồi sang `/m/du-an` thì ném lỗi

- **Trạng thái:** mở
- **Mức:** trung bình — màn điện thoại sập khi đến từ `/3d` trong cùng phiên
- **Bất biến vi phạm:** A11
- **Phát hiện:** 2026-10-03 · tranh luận nguồn dữ liệu (đọc mã)
- **Tái hiện bằng máy:** chưa có bài (mục mới — lệnh giao: không làm)
- **Gốc:** `useViewer3D.ts` lưu CHUỖI tên dự án dưới `queryKeys.project.detail(id)`;
  `useMobileViewer.ts` đọc cùng khoá như một đối tượng và gọi `.name.trim()`. Cổng nạp kho của đợt
  này dùng khoá riêng `[...project.detail(id), 'spatial']` nên không thêm hình thứ tư.
- **Sửa:** chưa.

### B-V1-41 · Câu `skipNotice` hứa "xem lại trong menu trợ giúp", nhưng menu đó không tồn tại

- **Trạng thái:** mở
- **Mức:** thấp — câu chữ hứa một đường không có
- **Bất biến vi phạm:** —
- **Phát hiện:** 2026-10-03 · tranh luận B-V1-04 (đọc mã)
- **Tái hiện bằng tay:** bấm "Bỏ qua" ở `/onboarding`, đọc câu "Có thể xem lại hướng dẫn trong menu trợ giúp."
- **Tái hiện bằng máy:** chưa có bài
- **Gốc:** `useWelcomeScreen.ts:138` (`STRINGS.skipNotice`), `src/i18n/vi.json:498`; xem lại hướng dẫn thuộc S-40, chưa dựng
- **Sửa:** chưa

### B-V1-42 · Người đăng nhập lần đầu không được dẫn tới `/onboarding`

- **Trạng thái:** mở — quyết định thuộc luồng đăng nhập
- **Mức:** thấp — màn chào chỉ tới được bằng cách gõ URL
- **Bất biến vi phạm:** —
- **Phát hiện:** 2026-10-03 · tranh luận B-V1-04 (đọc mã)
- **Tái hiện bằng tay:** đăng nhập bằng một tài khoản chưa có cờ đã-xem ⇒ về `/`, không qua màn chào
- **Tái hiện bằng máy:** chưa có bài
- **Gốc:** `AuthScreen.container.tsx:262-276` chuyển thẳng tới `next` hoặc `/`
- **Sửa:** chưa

### B-V1-43 · Người ngoài dự án mở `/3d` ra trạng thái `error` thay vì màn không-tìm-thấy

- **Trạng thái:** mở
- **Mức:** thấp — BE trả 404 (K08) nhưng màn nói "lỗi", không nói "không tìm thấy"
- **Bất biến vi phạm:** —
- **Phát hiện:** 2026-10-03 · tranh luận B-V1-05 (đọc mã)
- **Tái hiện bằng tay:** chưa đo được với bộ mẫu trong trang (không có request mạng để trả 404)
- **Tái hiện bằng máy:** chưa có bài
- **Gốc:** `useViewer3D.ts:652` gộp mọi lỗi đọc dự án vào `error`
- **Sửa:** chưa

### B-V1-44 · Chuỗi dùng chung `vi.json:2-72` viết hoa, và mẫu dữ liệu NotFound lệch khỏi hook

- **Trạng thái:** mở
- **Mức:** thấp
- **Bất biến vi phạm:** A6 (nhãn viết thường)
- **Phát hiện:** 2026-10-03 · tranh luận A6 (`KQ-A6.md`, mục mới 4)
- **Tái hiện bằng tay:** `vi.json:2-72` ("Hoàn tác", "Thử lại"…); `NotFound/notFoundScenarios.ts:126,134,184`
  (`'Đăng nhập'`…) lệch với chữ hook trả.
- **Tái hiện bằng máy:** chưa lập
- **Gốc:** nhãn dùng chung viết kiểu câu; mẫu dữ liệu chép tay không theo hook
- **Sửa:** chưa

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

- **Trạng thái:** đã sửa (`6eb9d46`, cần `dfb2275`) — bài tái hiện **đã kiểm đỏ trước sửa**
- **Mức:** thấp — đánh dấu nhầm thì không lấy lại được "chưa đọc"
- **Bất biến vi phạm:** A8 (cách hiểu đã chốt: áp cho mọi lệnh người dùng chủ động bấm làm đổi
  trạng thái đã lưu; QV2-3 coi như chốt "có")
- **Phát hiện:** 2026-09-30 · lớp đo kế hoạch (V2 "Đo thêm" 2)
- **Tái hiện bằng tay:** `/thong-bao` › "Đánh dấu tất cả đã đọc": 0 `role="alert"`, 0 nút
  "Hoàn tác", 0 toast.
- **Tái hiện bằng máy:** `e2e/v2v3/notification-center.spec.ts` › ""Đánh dấu tất cả đã đọc" hiện
  toast kèm nút "Hoàn tác", và Hoàn tác trả lại số chưa đọc (B-V2-06)" — trên mã cũ:
  `locator.click … waiting for getByRole('button', { name: 'Hoàn tác' })`.
- **Gốc:** `useNotificationCenter.ts` gửi `markAllRead`/`markRead` ngay, không vé hoàn tác; máy chủ
  không có lệnh "đánh dấu lại chưa đọc" (`AppBack/apps/api/notifications/router.py:25-54`,
  `service.py:169-184`).
- **Sửa:** `useNotificationCenter.ts` — `deferMarkRead(ids, title)`: lớp phủ `pendingReadIds` trong
  memo `items`, vé `createUndoTicket` trên `appNotificationBus` (tiêm được qua
  `options.notifications`), hết `UNDO_WINDOW_MS` mới gửi `markRead` theo lô 200
  (`MARK_READ_MAX_IDS`, máy chủ 422 ngoài 1–200), `onSettled` gỡ lớp phủ. `onMarkAllRead` và
  `onMarkRead` cùng đi qua đó; `onItemClick` vẫn ghi ngay; `markAllReadMutation` bị xoá. Rời màn
  KHÔNG gửi sớm: toast nằm trên `NotificationHost` cả ứng dụng; nếu lúc hết giờ màn đã tháo thì
  gọi thẳng `gateway.markRead` rồi làm mới bộ đệm. Nghĩa lệnh đổi có chủ ý (ghi trong mã): chỉ id
  người dùng thấy lúc bấm, không như `mark_all_read`. Bài đơn vị `NotificationCenter.test.tsx`
  (6 bài: bấm/hoàn tác/hết giờ/250 id = 200+50/máy chủ hỏng ⇒ `partial` + hiện lại chưa đọc/rời
  màn vẫn gửi); `mountNotificationCenter` mặc định tiêm `createNotificationBus()` để không rò sang
  kênh chung. E2e: `fixme` → `test`, thêm bước bấm lại trong 5 giây thấy toast mới.

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

- **Trạng thái:** đã sửa (`f4bb1fe`) — bài tái hiện **đã kiểm đỏ trước sửa**
- **Mức:** trung bình — điều khiển trông bấm được, nằm trong thứ tự Tab, và chết; cũng là lý do
  không có đường nội bộ nào tới `/thong-bao`
- **Bất biến vi phạm:** A2
- **Phát hiện:** 2026-10-03 · `e2e/v2v3`
- **Tái hiện bằng tay:** `/` › bấm chuông "Thông báo": URL không đổi, không panel nào.
- **Tái hiện bằng máy:** `e2e/v2v3/dashboard.spec.ts` › describe "chuông "Thông báo" ở danh sách dự
  án (B-V3-08)" › "bấm chuông mở tấm trượt thông báo; Esc đóng và trả tiêu điểm về chuông" và
  "chuông → "Xem tất cả" tới /thong-bao, Esc ở đó quay về danh sách dự án" — trên mã cũ:
  `getByRole('dialog', { name: 'Thông báo' })` không có.
- **Gốc:** `ProjectDashboard.tsx` `<button aria-label="Thông báo">` không `onClick`;
  `NotificationBellContainer` không vỏ nào dựng.
- **Đích đã chốt:** tấm trượt (`NotificationBellContainer`), không dẫn thẳng sang `/thong-bao`.
- **Sửa:** `ProjectDashboard.tsx` — khe `notificationBell?: ReactNode` trên view và
  `ProjectDashboardProps`, `ProjectDashboardConnected` chuyển thẳng xuống; khe trống không vẽ gì
  (A2); bỏ nhập `Bell`. `ProjectDashboard.container.tsx` cắm `<NotificationBellContainer />` (view
  không nhập gì từ NotificationCenter). Story `base` truyền `<NotificationBell unreadBadge="3" …>`.
  Chú thích cập nhật: `NotificationCenter.container.tsx` (người gắn chuông đầu tiên; nhánh
  `navigate(-1)` của `/thong-bao` nay với tới được) và đầu `notification-center.spec.ts`. Bài đơn
  vị `ProjectDashboard.test.tsx` (mock `notificationCenterGateway` theo khuôn
  `NotificationCenterRoute.test.tsx` — jsdom không có `EventSource`): route bấm chuông có `dialog`
  + `aria-expanded="true"`; view không khe có 0 nút "Thông báo". E2e: `fixme` → 2 bài (Esc trả
  tiêu điểm về chuông, `aria-expanded="false"`; đường "Xem tất cả" → `/thong-bao` → Esc → `/`).
  `smoke-grid.spec.ts` dòng `dashboard` nhận `expectedConsole` 404 `/api/streams/notifications`
  (chuông mở luồng SSE mà bộ mẫu dev không có). `app.visual.spec.ts` chờ huy hiệu "3" rồi mới chụp
  — **`dashboard-1440.png` (win32) cần chụp lại**, lệch 62 px đúng vùng chuông.

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

- **Trạng thái:** đã quyết — hoãn tới khi BE có endpoint (`a165450`: chỉ chú thích)
- **Mức:** thấp — cả hai đường đều TẮT trên bản thật
- **Bất biến vi phạm:** A8/A9 khi cờ bật — hôm nay không đường nào chạy
- **Phát hiện:** 2026-09-30 · plan.md V4 P3 (đọc mã)
- **Gốc (sửa lại):** mục cũ nói hai màn dùng xác nhận inline. Đúng một nửa:
  - "Huỷ xử lý" có xác nhận inline (đặc tả `BO-PROMPT-FE-HOP-NHAT-v2.md` dòng 1620) — nhưng nút
    không hiện trên bản thật (`useProcessingScreen.ts`, `cancelProcessing: false` ở
    `processingGateway.ts`).
  - "Bỏ qua tầng đó" **không** có xác nhận inline: `PipelineFailureAlert.tsx` gọi thẳng
    `onSkipFloor`; đặc tả dòng 1958 và 1984 chỉ đòi một câu cảnh báo. Trên bản thật nó chỉ gửi một
    báo cáo lỗi (`usePipelineFailure.ts`, `skipFloor: false` ở `pipelineFailureGateway.ts`).
  - Máy chủ chưa có endpoint huỷ hay bỏ qua tầng (`AppBack/apps/api/drawings/router.py:50-106`).
  - Theo cách hiểu A9 đã chốt: một câu cảnh báo hay xác nhận ngay trên màn KHÔNG thoả A9.
- **Tái hiện bằng máy:** không có — cả hai bề mặt không dựng được trên dev
  (`e2e/v4v5/processing.spec.ts:17-19`).
- **Thiết kế chờ cờ (đã chốt, làm khi bật cờ):**
  - giữ xác nhận inline (đặc tả dòng 1620) và chồng toast hoàn tác lên, giữ lệnh `UNDO_WINDOW_MS`;
  - loại thông báo `processing-cancel:${projectId}` và `pipeline-skip:${projectId}:${floorId}`;
  - Thử lại hay đổi ngưỡng trong lúc chờ thì huỷ lệnh bỏ qua đang chờ (không thì lượt thử thành
    công đóng màn lỗi rồi lệnh bỏ qua vẫn đi — mất một tầng vừa chạy xong);
  - hết giờ chỉ huỷ những lượt tải lên chụp lúc xác nhận mà vẫn đang chạy; câu toast đúng cả khi
    lượt chạy xong trước hạn;
  - rời màn thì không gửi sớm;
  - khi đang chờ, đưa tiêu điểm vào một nút Hoàn tác ngay tại chỗ.
- **Sửa:** chú thích khoá điều kiện bật cờ trên `skipFloor: false` (`pipelineFailureGateway.ts`) và
  `cancelProcessing: false` (`processingGateway.ts`); sửa chú thích "A9 nói ra điều đó trước khi
  gọi" (một câu cảnh báo không thoả A9); một dòng dẫn B-V4-09 ở hai bài khoá cờ
  (`usePipelineFailure.test.ts`, `useProcessingScreen.test.ts`). Không bài e2e.

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

- **Trạng thái:** đã sửa (`cd75dd5`)
- **Mức:** thấp — trình đọc màn hình đọc "Ẩn lớp Tường" ở màn tường nhưng "Ẩn lớp cửa đi" ở màn đối tượng
- **Bất biến vi phạm:** A6 (nhãn viết thường)
- **Phát hiện:** 2026-09-30 · khảo sát V6 (F7/P5)
- **Tái hiện bằng tay:** màn tường: nút `Ẩn lớp Tường`, cây lớp `Tường`, `Cửa và nội thất`, `Kích thước`, `Trục`,
  `Phòng`, nút thành công `Sang lớp Cửa và nội thất`; màn đối tượng `Ẩn lớp cửa đi`.
  - Kỳ vọng: `ẩn lớp tường`, `tường`, `sang lớp cửa và nội thất`, `ẩn lớp cửa đi`.
- **Tái hiện bằng máy:** `e2e/v6/wall-layer-review.spec.ts` › "[bơm] nút ẩn lớp viết thường hoàn toàn: "ẩn lớp tường"
  (A6, B-V6-04)" — `test.fixme` → `test` · **đã kiểm đỏ trước sửa** (2026-10-03, `WallLayerLeftPanel.tsx` của
  `8bb2734`: "element(s) not found")
- **Gốc:** chẩn đoán cũ ("ghép tên lớp viết hoa vào nút") sai: `WallLayerLeftPanel.tsx` gõ cứng nguyên chuỗi
  `'Ẩn lớp Tường'`/`'Hiện lớp Tường'`, và năm mục cây cùng nút thành công viết hoa chữ đầu. Màn đối tượng ghép
  tiền tố `'Ẩn lớp '` với tên lớp viết thường.
- **Sửa:** `WallLayerLeftPanel.tsx` (hai nhãn con mắt, nút thành công, năm mục cây, chú thích; `'Cây lớp'` giữ vì
  là tên vùng chứa), `ObjectLayerLeftPanel.tsx` (`'hiện lớp '`/`'ẩn lớp '`), `useWallLayerReview.ts` (xoá hai khoá
  `showWallLayerLabel`/`hideWallLayerLabel` không ai đọc), `vi.json` `wallLayerReview.state.successContinue`,
  `layerTree.*`, `objectLayerReview.layerTree.*`. Bài đơn vị `WallLayerReview.test.tsx` (chữ mới + `treeitem`
  'tường'), `ObjectLayerReview.test.tsx` [NGHIEM-2] (nút 'ẩn lớp cửa đi') · commit `cd75dd5`.

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

- **Trạng thái:** đã sửa (`82c64d3`)
- **Mức:** cao — ô mở/nội thất thật không bao giờ hiện; dòng "mồ côi" của bộ mẫu (#D-009) hiện trên mọi tầng
- **Bất biến vi phạm:** A11, A5 (duyệt một thứ không có)
- **Phát hiện:** 2026-10-03 · đường nạp thật mới
- **Tái hiện bằng tay:** `/projects/project-1/floors/L-LEVEL000001/layers/objects` — đồ thị có 2 cửa đi + 2 cửa sổ +
  5 bàn; màn hiện đúng một dòng "#D-009 — 0/1, Chưa gắn vào tường nào" lấy từ bảng mẫu
  - Kỳ vọng: "0/9 đối tượng đã duyệt", 9 dòng (`D-001`, `D-002`, `S-001`, `S-002`, `F-001`…`F-005` "nội thất khác"), không `#D-009`
- **Tái hiện bằng máy:** `e2e/v6/object-layer-review.spec.ts` › "đường nạp thật: màn liệt kê đúng ô mở và nội thất của
  tầng từ đồ thị, không bịa dòng mồ côi #D-009 (B-V6-13)"
  `E2E_PORT=5193 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v6/object-layer-review.spec.ts`
  — **đã kiểm đỏ trước sửa**: `getByText('0/9 đối tượng đã duyệt')` không tìm thấy (màn hiện "0/1").
- **Gốc:** `objectsOf` (`objectLayerReviewGateway.ts`) lặp `OBJECT_LAYER_SEED`, không lặp đồ thị; cổng thật mặc định
  mang chính bảng mẫu ấy, nên dòng seed có `tracedCentre` mà đồ thị không có (`D-009`) được đẩy vào mọi tầng.
- **Quyết định (tranh luận hai agent + điều phối):** (a)+(b) — ánh xạ kind miền, mọi kind còn lại vào loại con mới
  "nội thất khác"; `table` → "nội thất khác" chứ không "bàn ăn" (điều phối quyết, đổi lại một dòng); thêm
  `entityId` vào `ReviewObjectCore` (điều phối quyết, dù tệp kiểu ghi "đóng băng").
- **Sửa:**
  - `objectLayerTypes.ts`: loại con `otherFurniture` ("nội thất khác", lớp nội thất); `ReviewObjectCore.entityId`;
    `entityIdOf` + ba hằng chuyển từ cổng sang (tránh vòng import, cổng xuất lại); vị từ
    `isUnattachedOpening = isOrphanObject(o) && o.layer !== 'furniture'`.
  - `objectLayerReviewGateway.ts`:
    - `objectsOf` lặp `graphOpeningsOf` (lọc theo tường của tầng) và `graphFurnitureOf` (lọc `levelId`). Mã hiển thị:
      dòng mẫu nếu có, không thì `displayCodesOf` riêng cho cửa đi (`D-`), cửa sổ (`S-`), nội thất (`F-`). Nội thất có
      dòng mẫu kèm tường chủ đi đường cũ; MỌI trường hợp khác thành đối tượng đứng tự do ở `centre`, cỡ từ
      `boundingBox` — hai nhánh `continue` vốn ẩn đối tượng thật đã bỏ. Dòng mẫu `tracedCentre` chỉ nối khi thực thể
      chưa có trên đồ thị.
    - `SUBTYPE_BY_FURNITURE_KIND: Record<FurnitureKind, ObjectSubtype>`: `bed` → giường, bảy kind còn lại → nội thất khác.
    - Cổng thật: `seed: options.seed ?? []`; cổng giả giữ bộ 21.
    - Ba hàm dựng lệnh (đổi loại, đổi chiều mở, duyệt) nhận `displayId`; xoá `seedOf`/`seedOfEntity`/`displayIdOf`.
    - `toObjectRow`/`toObjectInspector`/`toObjectPlacement` đặt `isOrphan` bằng `isUnattachedOpening`.
  - `useObjectLayerReview.ts`: bảy chỗ `entityIdOf(object.id, …)` → `object.entityId`; vùng chọn tra
    `objects.find(o => o.entityId === anchor)`; `onSelect` đi đường riêng chỉ cho `isUnattachedOpening` (nội thất đứng
    tự do có trên đồ thị nên chọn qua S-10 như thường). Kéo/đổi loại vẫn chặn bằng `isOrphanObject`.
  - View: `Box` cho "nội thất khác" ở thanh tra và ray; ký hiệu khung chữ nhật (`objectLayerSymbols.ts`); danh sách và
    thanh tra hiện huy hiệu "chưa gắn" chỉ cho lỗ mở, nội thất đứng tự do ghi "đứng tự do".
  - Bài đơn vị (`useObjectLayerReview.test.ts` › "danh sách dựng từ đồ thị (B-V6-13)", 23 bài): `it.each` 8 kind nội
    thất; `it.each` 2 kind × 5 swing ô mở; A14 tầng `L-LEVEL000001` với seed `[]` → 9 đối tượng (2/2/5), 0 đã duyệt,
    không `D-009`, mã không trùng, mọi `entityId` có trong `byId`; mô tả lệnh duyệt chứa "D-001" không chứa "DOOR"; bàn
    đứng tự do cách tường 2.000 mm không "attention", vẽ đúng `centre`, chọn/duyệt/xoá được; gắn `D-009` trên cổng giả
    không đổi tổng và không nhân đôi dòng; cổng thật có `seed` rỗng.

### B-V6-14 · Màn trục sẽ luôn rỗng trên BE thật — N16 v1 trả `axes: []`

- **Trạng thái:** ngoài FE (chủ: BE)
- **Mức:** trung bình — trên máy chủ thật màn trục luôn "chưa có trục nào", kể cả khi pipeline dò được trục
- **Phát hiện:** 2026-10-03 · đọc mã BE `apps/api/spatial_read/router.py` (`axes=[]` cố định) và docstring
  `AxisOut` "v1 danh sách luôn rỗng"
- **Tái hiện bằng máy:** không có — bộ mẫu dev cố ý phục vụ trục của bộ A14 để màn dùng được ở dev (ghi trong
  docblock `makeLayerDocument`)
- **Gốc:** BE chưa lưu/trả trục ở N16; `persistAxisLayer` của FE cũng chưa có đường (B-V6-03)
- **Sửa:** chưa — việc của BE

### B-V6-40 · Màn đối tượng: `levelOfGraph` luôn lấy tầng đầu tiên của đồ thị, không theo tầng của URL

- **Trạng thái:** mở
- **Mức:** trung bình — chưa thấy ở đường nạp thật (N16 trả đồ thị MỘT tầng), nhưng đồ thị nhiều tầng trong kho (vd.
  sau màn khác nạp cả dự án) sẽ cho màn duyệt tầng 0 dưới URL của tầng khác
- **Phát hiện:** 2026-10-03 · tranh luận thiết kế B-V6-13 ("Mục mới nên mở")
- **Gốc:** `levelOfGraph` (`objectLayerReviewGateway.ts:566`) đọc `graph.byKind.level[0]`, không nhận `floorId`.
- **Tái hiện bằng máy:** chưa có bài.
- **Sửa:** chưa

### B-V6-41 · Màn đối tượng: "thêm thủ công" đề nghị mã cửa kế tiếp chỉ từ bảng mẫu

- **Trạng thái:** mở
- **Mức:** thấp — rủi ro, chưa dựng lại được: nút chỉ hiện ở trạng thái rỗng, lúc ấy tầng không có cửa nào nên mã đề
  nghị không trùng thực thể nào trên tầng
- **Phát hiện:** 2026-10-03 · tranh luận thiết kế B-V6-13 ("Rủi ro còn lại")
- **Gốc:** `nextDoorDisplayId` (`objectLayerReviewGateway.ts:2097`) chỉ đọc `seed`; cổng thật nay có `seed` rỗng nên
  luôn đề nghị `D-001` → mã máy `D-000001DOOR`, không kiểm mã ấy đã có trên đồ thị chưa.
- **Tái hiện bằng máy:** chưa có bài.
- **Sửa:** chưa

### B-V6-42 · Nhãn viết hoa chữ đầu ở các màn QC còn lại

- **Trạng thái:** mở
- **Mức:** thấp
- **Bất biến vi phạm:** A6 (nhãn viết thường)
- **Phát hiện:** 2026-10-03 · tranh luận A6 (`KQ-A6.md`, mục mới 1)
- **Tái hiện bằng tay:** `WallLayerLeftPanel.tsx` `'Hiện tim tường'`, `WallLayerToolRail.tsx:78-79`,
  `ObjectLayerStatusBar.tsx:35-36`, `AxisGridFloorAlignList.tsx:50-51` (`Căn chỉnh tự động`),
  `ObjectLayerInspector.tsx:180`, `ProcessingSummary.tsx:19`, `vi.json:1516,1723-1724`.
- **Tái hiện bằng máy:** chưa lập
- **Gốc:** nhãn viết kiểu câu trước khi quy ước A6 được chốt
- **Sửa:** chưa

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

### B-V7-05 · Câu lệnh, toast và câu luật lộ mã máy (`R-000001ROOM`, `W-000032THIK`) trong khi danh sách gọi thực thể là `#R-001`

- **Trạng thái:** đã sửa (`dff0d29`, `ec527ae`)
- **Mức:** thấp — người đọc toast/câu luật không nối được câu với hàng trong danh sách; cùng họ W-3 của tường
- **Bất biến vi phạm:** A6 (mã hiển thị)
- **Phát hiện:** 2026-09-30 · ghi chú V7 (F-R1); đo lại 2026-10-03 (W05)
- **Tái hiện bằng tay:**
  1. Bơm bộ mẫu màn phòng, chọn `#R-001`, đổi tên, Enter
  - Kỳ vọng: toast "Đổi tên phòng #R-001 từ …"
  - Thực tế (trước khi sửa): "Đổi tên phòng R-000001ROOM từ "phòng khách chung" thành "Phòng thử e2e", diện tích 17,00 m²."
- **Tái hiện bằng máy:** `e2e/v7/room-label-review.spec.ts` › "bơm bộ mẫu: toast đổi tên gọi phòng bằng mã hiển thị #R-001, không lộ mã máy R-000001ROOM (B-V7-05, A6)"
  `E2E_PORT=5191 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v7/room-label-review.spec.ts -g "B-V7-05, A6"`
  — **đã kiểm đỏ trước sửa**: `Expected "Đổi tên phòng #R-001 từ"`, `Received "Đổi tên phòng R-000001ROOM từ …"`.
- **Gốc:** `src/lib/commands/business/roomFloorCommands.ts:230` (và ~90 câu khác của `src/lib/commands/business/*`,
  ~40 câu của `src/domain/rules/{registry,geometry,function,fitout}`) nội suy thẳng `room.id`/`wall.id`… vào câu người
  đọc. Tầng lệnh không có cách lấy mã hiển thị: hàm duy nhất (`roomDisplayCode`) nằm ở cổng màn, và có thêm ba bản chép
  (`wallDisplayCode`, `hostWallDisplayCode`, `dimensionDisplayCode`).
- **Sửa:**
  - `displayCodeIn(graph, id)` — `src/domain/spatial/normalize.ts`: `#` + `displayCodesOf` trên mọi thực thể CÙNG LOẠI,
    CÙNG TẦNG (lỗ mở theo tầng của tường; tầng trên mọi tầng) — đúng cách các danh sách QC đánh số; mã không có trong
    đồ thị rơi về quy tắc số đếm.
  - Mọi câu người đọc của `src/lib/commands/business/*` và câu luật dùng nó. Giữ nguyên mã máy ở đúng các câu NÓI VỀ
    mã máy ("Mã … không đúng định dạng", "Bản vẽ đã có đối tượng mang mã …").
  - Bốn bản chép hàm cắt mã ở cổng màn gọi cùng nguồn (`displayCodesOf([id])`); `approveDescription` của màn phòng và
    màn tường nhận bảng mã của tầng ("Duyệt tường W-…" cũ lộ mã máy).
  - Bài đơn vị: `src/domain/spatial/__tests__/normalize.test.ts` › "displayCodeIn" (3 bài);
    `business.test.ts` › "names the room by the code its list shows…"; các bài luật/lệnh vốn khẳng định mã máy trong câu
    (`geometry`, `function`, `fitout`, `runner`, `geometryCommands`, `business`, `PropertyInspector`) nay khẳng định
    `displayCodeIn(...)` và `runner.test.ts` khẳng định câu KHÔNG chứa mã máy.
  - `e2e/v12a/rules.spec.ts:87` bám chính chỗ lộ mã (`/^Lỗ mở D-DOOR/u`) nên đỏ sau bản sửa (đo: hết hạn chờ ở
    `getByRole('button', { name: /^Lỗ mở D-DOOR/u })`); điều phối viên cho sửa đúng dòng ấy thành `/^Lỗ mở #D-\d{3}/u`.
    Soát cả `e2e/**`: không bài nào khác khẳng định câu lệnh/luật bằng mã máy (`viewer3d.spec.ts:767` và
    `v8/wall-geometry.spec.ts` B-V8-05 đọc thanh tra của vỏ — không phải câu bản sửa này đổi).
- **Còn lại / giới hạn đã biết:**
  - Thực thể MỚI chưa có trong đồ thị (câu "Vẽ tường …", "Thêm đồ đạc …", "đoạn mới …") lấy nhãn theo số đếm của mã;
    với mã BE (nhánh đánh số theo thứ tự) nhãn ấy có thể lệch hàng mới trong danh sách.
  - Màn độ dày đánh số tường trên CẢ đồ thị (`useThicknessStandardization.ts:387`), các màn khác theo tầng; với mã BE
    nhiều tầng, nhãn câu lệnh (theo tầng) có thể khác nhãn hàng độ dày. Với bộ mẫu và mã `createId` hai cách cho cùng nhãn.
  - Ngoài phạm vi, chưa sửa: thanh tra vỏ viewer (`useViewerShell.ts:975`), `PropertyInspector`/`HistoryPanel`/
    `furnitureLibraryPanelGateway` vẫn tự ghép mã máy vào câu của chính màn; chip báo cáo luật — xem B-V7-31.

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

### B-V7-09 · Hoàn tác (vé toast hoặc Ctrl+Z) trả vùng chọn về TRƯỚC lần bấm gần nhất — phòng bị bỏ chọn, thanh tra đóng

- **Trạng thái:** đã sửa (`dff0d29`)
- **Mức:** thấp — tên về đúng, nhưng người duyệt mất chỗ đang làm
- **Bất biến vi phạm:** A8 (hoàn tác trả lại trạng thái lúc thao tác, gồm vùng chọn — S-06)
- **Phát hiện:** 2026-10-03 · trình duyệt (W05, lượt đầu của V7-ROOMS-03)
- **Tái hiện bằng tay:**
  1. Bơm bộ mẫu màn phòng, chọn `#R-001`, đổi tên, bấm "Hoàn tác" trên toast
  - Kỳ vọng: tên về cũ, `#R-001` vẫn đang chọn, ô "Tên phòng" hiện tên cũ
  - Thực tế (trước khi sửa): ô "Tên phòng" biến mất (vùng chọn về `[]`)
  2. Màn tường: chọn `#W-001`, J sang `#W-002`, phím 1 (110 mm), Ctrl+Z
  - Thực tế (trước khi sửa): độ dày về 330 mm nhưng vùng chọn nhảy về `#W-001`
- **Tái hiện bằng máy:**
  - `e2e/v7/room-label-review.spec.ts` › "bơm bộ mẫu: hoàn tác đổi tên bằng toast giữ nguyên phòng đang chọn (B-V7-09)"
  - `e2e/v6/wall-layer-review.spec.ts` › "[bơm] Ctrl+Z trả độ dày và giữ tường đang chọn lúc đổi (B-V7-09, A8)"
  — **đã kiểm đỏ trước sửa**: phòng — ô "Tên phòng" không về `phòng khách chung`; tường — sau Ctrl+Z
  `330 mm` checked nhưng `#W-002` `aria-selected="false"`.
- **Gốc:** năm hook QC (`useRoomLabelReview.ts`, `useWallLayerReview.ts`, `useThicknessStandardization.ts`,
  `useDimensionOcrReview.ts`, `useObjectLayerReview.ts`) đưa cho bộ ghi lệnh `selectionBefore: selectionBeforeRef.current`
  — ref cập nhật ở MỖI lần đổi vùng chọn thành vùng chọn trước đó, nên bước hoàn tác mang vùng chọn trước lần bấm
  gần nhất, không phải vùng chọn lúc lệnh chạy.
- **Sửa:** một chỗ dùng chung — `currentSelection()` ở `src/store/commit.ts` đọc `useStore.getState().selectedIds`
  ngay lúc `dispatch` đẩy bước; năm hook dùng nó cho `selectionBefore`/`selectionAfter` và bỏ `selectionBeforeRef`.
  Bài đơn vị `useRoomLabelReview.test.ts` › "chọn phòng khác rồi chọn #R-005, đổi tên, hoàn tác bằng vé: #R-005 vẫn đang
  chọn" — **đã kiểm đỏ trước sửa** (`expected [ 'R-000001ROOM' ] to deeply equal [ 'R-000005ROOM' ]`).

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

### B-V7-30 · Hoàn tác giữ phòng đang chọn nhưng ô "Tên phòng" vẫn hiện tên vừa bị hoàn tác

- **Trạng thái:** đã sửa (`dff0d29`)
- **Mức:** thấp — danh sách nói tên cũ, ô nói tên mới; rời ô là cam kết lại tên mới, tức hoàn tác bị huỷ ngầm
- **Bất biến vi phạm:** A8
- **Phát hiện:** 2026-10-03 · bài e2e B-V7-09 sau bản sửa vùng chọn (bị B-V7-09 che: trước đó hoàn tác bỏ chọn phòng nên ô bị gỡ)
- **Tái hiện bằng tay:** bơm bộ mẫu, chọn `#R-001`, đổi tên, "Hoàn tác" trên toast ⇒ ô vẫn "Phòng thử e2e"
- **Tái hiện bằng máy:** cùng bài e2e B-V7-09 của màn phòng (`toHaveValue("phòng khách chung")`, nhận "Phòng thử e2e")
- **Gốc:** `src/screens/qc/RoomLabelReview/RoomLabelNameField.tsx` — `draft` khởi tạo một lần từ `name`, chỉ `key={room.id}`
  dựng lại ô; tên đổi từ ngoài ô mà cùng phòng thì ô không theo.
- **Sửa:** ô theo `name` khi `name` đổi (chỉnh state ngay lúc vẽ, không `useEffect`, nên tiêu điểm không mất; chữ gõ dở
  vẫn giữ khi tên lưu không đổi). Bài đơn vị `RoomLabelNameField.test.tsx` (2 bài) — **đã kiểm đỏ trước sửa**.

### B-V7-31 · Báo cáo luật: chip của hàng vi phạm và tấm chi tiết in mã máy (`D-DOOR0000000`) trong khi câu luật nói `#D-001`

- **Trạng thái:** đã sửa (`957a711`)
- **Mức:** thấp — người duyệt không đối chiếu được chip với câu luật ngay bên cạnh; ở tấm chi tiết cả đầu tấm lẫn
  khối "phát hiện" đều nói mã máy
- **Bất biến vi phạm:** A6 (một thực thể, một cách gọi)
- **Phát hiện:** 2026-10-03 · đơn vị (`RuleReport.test.tsx` sau B-V7-05)
- **Tái hiện bằng tay:**
  1. Bơm bộ mẫu A14, mở `/projects/project-1/rules`.
  2. Mở nhóm "lỗ mở nằm trọn…", xem chip mã cạnh câu "Lỗ mở #D-001 …"; bấm câu để mở tấm chi tiết.
  - Kỳ vọng: chip và tấm nói `#D-001`, cùng mã câu luật.
  - Thực tế (trước sửa): chip `D-DOOR0000000`; tấm in `D-DOOR0000000` ở đầu tấm và ở "phát hiện".
- **Tái hiện bằng máy:** `e2e/v12a/rules.spec.ts` › "có bơm kho: chip của hàng và tấm chi tiết gọi lỗ mở bằng mã người đọc như câu luật, không bằng mã máy (B-V7-31)"
  `E2E_PORT=5191 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v12a/rules.spec.ts -g "B-V7-31"`
- **Gốc:** `RuleReport/RuleReportGroups.tsx:174` in `row.entityId`; `ViolationDetailSections.tsx:161` và
  `ViolationDetail.tsx:130` in mã máy. Thêm: `displayCodeIn` (`domain/spatial/normalize.ts`) cắt mọi id theo quy
  tắc số đếm, nên id không có tiền tố loại (`BUILDING`) ra rác `#B-ILDING`. Phần "không có tầng" của mục cũ là
  chẩn đoán sai — cột tầng đã có (`RuleReportGroups.tsx` `LevelText`).
- **Sửa:** `normalize.ts` — tách `displayLabelIn`; tiền tố không biết trả id nguyên văn; `displayCodeIn` chỉ thêm
  `#` khi tiền tố biết. `useRuleReport.ts` — `runReport` dựng `codeByEntityId` trên cùng ảnh chụp đồ thị với câu
  luật; hàng mang `entityCode` (`types.ts`); `RuleReportGroups.tsx` in nó. `ViolationDetail` — `ViolationObject.code`
  và prop view `subjectCode` thay `subjectEntityId`; `key`/`onSelectObject` vẫn mã máy. Bài đơn vị:
  `normalize.test.ts` (`BUILDING` → `BUILDING`), `RuleReport.test.tsx` R-73 (mọi `tbody code` khớp
  `/^#[A-Z]-\d{3}$/`), `ViolationDetail.test.tsx` "B-V7-31" (hook in mã người đọc 2 lần, không in mã máy) ·
  commit `957a711` · **đã kiểm đỏ trước sửa** (2026-10-03, `src/` của `f2e7e73`: chip ra `"D-DOOR0000000"`).

### B-V7-41 · Bộ mẫu màn quản lý tầng khai 7,31 m² mỗi phòng nhưng đường bao đo 17,00

- **Trạng thái:** mở
- **Mức:** thấp — cùng bệnh B-V8-10, chỉ bẫy người viết bài
- **Bất biến vi phạm:** —
- **Phát hiện:** 2026-10-03 · tranh luận nguồn dữ liệu (đọc mã)
- **Gốc:** `floorManagerGateway.ts:1421,1441` — 34 phòng khai `areaM2` 7,31, đường bao 4000×4250.
- **Sửa:** chưa.

### B-V7-42 · Mã có tiền tố loại nhưng không có thực thể ra nhãn rác (`W-MISSING1AA` → `#W-MISSIN`)

- **Trạng thái:** mở
- **Mức:** thấp — câu từ chối nêu một thực thể đã mất bằng một mã không ai nhận ra
- **Bất biến vi phạm:** A6
- **Phát hiện:** 2026-10-03 · tranh luận B-V7-31 (đọc mã)
- **Tái hiện bằng tay:** một câu luật/từ chối nêu id có tiền tố hợp lệ mà đồ thị không giữ, và thân id không có
  số đếm ở sáu ký tự đầu.
- **Tái hiện bằng máy:** chưa — chép từ "Mục mới nên mở", không viết bài.
- **Gốc:** `domain/spatial/normalize.ts` `displayLabelIn` — nhánh `entity === undefined` dùng `displayCodesOf([id])`,
  tức quy tắc số đếm cắt sáu ký tự đầu bất kể có phải số hay không.
- **Sửa:** chưa.

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

### B-V8-03 · Thư viện đồ đạc nói sai lý do "vai chỉ xem" với admin/kỹ sư, và khoá kéo-thả với mọi vai

- **Trạng thái:** đã sửa một nửa (`67860e3`) — câu chữ, nhánh `forbidden`, cổng quyền của "Thay thế tất cả". Nửa kéo-thả **chờ B-V8-04** (chưa có đích thả), giữ bằng `test.fixme`.
- **Mức:** trung bình — admin/kỹ sư đọc một câu giải thích sai về vai của chính họ; "Thay thế tất cả" ghi dữ liệu mà không xét vai
- **Bất biến vi phạm:** — (câu chữ sai sự thật; A11 `forbidden` dùng sai nhánh)
- **Phát hiện:** 2026-09-30 · ghi chú V8 (F2), đo lại 2026-10-03; lỗ "Thay thế tất cả" do phản biện tìm thêm (2026-10-03)
- **Tái hiện bằng tay:**
  1. Đăng nhập `admin@example.com`, mở `/projects/P-01/3d`, bấm "Thư viện đồ đạc".
  - Kỳ vọng: không có câu "vai chỉ xem".
  - Thực tế (trước sửa): "Bạn đang xem ở vai chỉ xem nên không kéo mô hình vào bản vẽ được."
- **Tái hiện bằng máy:** `e2e/v8/viewer-panels.spec.ts`:
  - › "admin mở thư viện đồ đạc thì không bị báo "vai chỉ xem" (B-V8-03)" (`test`) — **đã kiểm đỏ trước sửa**: `/vai chỉ xem/` đếm ra 1 ở `viewer-panels.spec.ts:219`.
  - › "người xem mở thư viện đồ đạc thì được báo "vai chỉ xem" (B-V8-03)" (`test`, bài giữ chiều ngược lại; xanh cả trước sửa — đúng dự kiến).
  - › "kỹ sư kéo được thẻ đồ đạc vào khung nhìn (B-V8-03 · chờ B-V8-04)" (`test.fixme`). Lý do: `canDrag` khoá cứng `false` vì `Viewer3DPanels` chưa có đích thả. Mở lại khi: màn 3D nối đường thả và `canDrag = options.canPlaceModel`. Bài sẽ đỏ đúng lý do: thẻ không có `draggable="true"`.
  `E2E_PORT=5195 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v8/viewer-panels.spec.ts -g "thư viện đồ đạc"`
- **Gốc:** `useFurnitureLibraryPanel.ts` `canDrag = options.canUploadModel`, và `forbidden` xét cùng cờ; `canUploadModel = can('manage','library') && onUploadModel !== undefined` (`FurnitureLibraryPanel.container.tsx`), mà `Viewer3DPanels.tsx` không truyền `onUploadModel` ⇒ `forbidden` với mọi vai. Quyền "đặt mô hình" bị gắn nhầm vào quyền "tải lên".
- **Sửa:** `furnitureLibraryPanelTypes.ts` thêm `canPlaceModel: boolean`; container tính `can('edit','layer',{roles})`; hook: `forbidden` và `detectedGroups` ("Thay thế tất cả") theo `canPlaceModel`, `canDrag` khoá `false` kèm chú thích `ponytail:` dẫn B-V8-04, `isLocked: !canDrag` giữ khoá cho mọi vai (thẻ chết không lời giải thích là mất tín hiệu A2/A12). Bài đơn vị `FurnitureLibraryPanel.test.tsx`: `[N6]` (người xem, có sofa trên tầng) — "vai chỉ xem" hiện, 0 nút "Thay thế tất cả"; `[N6c]` (kỹ sư) — không "vai chỉ xem", 0 thẻ kéo được, thẻ vẫn `aria-disabled`.

### B-V8-04 · Bảng diện tích và panel thuộc tính trên màn 3D kẹt "đang tải" mãi

- **Trạng thái:** đã sửa (`1632fa9`) — bài tái hiện **đã kiểm đỏ trước sửa**
- **Mức:** cao — người dùng không xem được diện tích hay thuộc tính trên màn 3D
- **Bất biến vi phạm:** A11 (loading không bao giờ kết thúc)
- **Phát hiện:** 2026-09-30 · ghi chú V8 (F3); đo lại 2026-10-03
- **Tái hiện bằng tay:** mở `/projects/P-01/3d`, bấm "Diện tích phòng". Kỳ vọng: một trạng thái nói
  ra được. Thực tế (trước sửa): `div[aria-label="Đang tính diện tích…"][aria-busy]` mãi.
- **Tái hiện bằng máy:** `e2e/v8/viewer-panels.spec.ts` › "chưa bơm kho: bảng diện tích không kẹt
  "đang tính" — cổng nạp kho xong thì bảng nói ra trạng thái của nó (B-V8-04)" (ca mồi Q1 của /3d,
  `[aria-busy="true"]` đếm 0 + heading hoặc "Tổng diện tích sàn toàn nhà").
  `E2E_PORT=5193 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v8/viewer-panels.spec.ts -g "không kẹt"`
- **Gốc:** panel đọc kho (`useRoomAreaPanel.ts` `spatialLoaded: spatial !== null`,
  `usePropertyInspector.ts`), mà `useViewer3DSource` chỉ tiêm bộ mẫu vào vỏ + cảnh.
- **Sửa:** `Viewer3DRoute` bọc cổng (docblock "một nguồn dữ liệu" viết lại);
  `shouldUseViewerFixture` thêm vế mock + kho 0 tường (`ponytail:` — mock không trả nhà; nhà mẫu chỉ
  vào vỏ và cảnh); `spatialLoading` ở `useRoomAreaPanel.ts`, `usePropertyInspector.ts`,
  `useViewerShell.ts`, `useViewer3D.ts` (nhánh loading; nhánh empty là B-V1-11); docblock
  `useRoomAreaPanel.ts` + `.model.ts`; `useViewer3DSource` gọi `setActiveFloor(null)` khi gắn
  (`ponytail:` gỡ khi B-V8-41/N1). Bỏ hợp đồng (iv) như thiết kế. Bài đơn vị:
  `viewerShellGateway.test.ts`, `useViewer3DSource.test.ts`, `useViewer3D.preview.test.tsx`,
  `Viewer3DPanels.test.tsx`.
- **Còn `fixme` (đúng thiết kế):** "chưa bơm kho: bảng diện tích vẫn ra tổng diện tích sàn" và
  "chưa bơm kho: chọn một phòng thì panel thuộc tính ra thuộc tính…" — nay tag
  "(B-V8-04 · chờ kho nạp có phòng)". Mock nạp 4 tầng không phòng nên không có tổng / không có phòng
  để chọn. Đã tạm bật (2026-10-03): đỏ ĐÚNG lý do — `getByText(/Tổng diện tích sàn toàn nhà — \d+
  phòng/)` không có; `getByRole('heading', { name: 'Phòng' })` không có. Bài thuộc tính đã siết
  trước khi mở lại (heading "Phòng", 0 "Đang tải thuộc tính…", 0 "Chưa chọn đối tượng nào").
  Mở lại khi: kho nạp (không bơm) có ít nhất một phòng — mock N16 trả hình cho dự án.

### B-V8-05 · Cùng một bức tường mang hai mã: tiêu đề thanh tra `W-0403FIXTURE0`, dải chế độ sửa `W-403FI`

- **Trạng thái:** đã sửa (`957a711`)
- **Mức:** thấp — người dùng không đối chiếu được dải chế độ sửa với panel thanh tra
- **Bất biến vi phạm:** A6 (một thực thể, một cách gọi) · mục B (panel vỏ in mã máy)
- **Phát hiện:** 2026-09-30 ghi chú V8 (F4); đo lại 2026-10-03 trên `f2e7e73`: thanh tra và dải CÙNG in mã máy
  `W-0403FIXTURE0` (dải rơi về mã máy vì kho rỗng trên `/3d`, B-V8-04) — vẫn là lỗi: tiêu đề người đọc in mã máy
- **Tái hiện bằng tay:**
  1. Mở `/projects/P-01/3d`, chọn một tường trên canvas.
  2. Đọc tiêu đề panel "Thanh tra đối tượng", bấm "Sửa hình học tường", đọc dải "Đang sửa: …".
  - Kỳ vọng: tiêu đề "tường W-403FI" và dải "Đang sửa: W-403FI"; hàng "mã đối tượng" giữ mã máy.
  - Thực tế (trước sửa): tiêu đề "tường W-0403FIXTURE0".
- **Tái hiện bằng máy:** `e2e/v8/wall-geometry.spec.ts` › "cùng một bức tường mang cùng một mã ở thanh tra và ở dải chế độ sửa (B-V8-05)"
  `E2E_PORT=5191 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v8/wall-geometry.spec.ts -g "B-V8-05"`
- **Gốc:** `ViewerShell/useViewerShell.ts` `selection.title` và `hoverLabel` in `entityId` thô;
  `PropertyInspector/usePropertyInspector.ts` đầu panel `objectCode: primaryEntity.id`, tóm tắt thu gọn và hai
  liên kết "Nằm trên #…"/"Thuộc phòng #…" ghép `#` vào mã máy; `WallGeometryEditor/useWallGeometryEditor.ts`
  rơi về `wallId` thô khi kho không giữ tường.
- **Sửa:** vỏ dùng `displayLabelIn` cho tiêu đề và nhãn di chuột (hàng "mã đối tượng" giữ mã máy);
  panel thuộc tính dùng `displayLabelIn` cho đầu panel + tóm tắt thu gọn, `displayCodeIn` cho hai liên kết,
  thêm `header.entityId` làm `key` của khối nội dung (mã người đọc có thể trùng giữa các tầng); dải "Đang sửa"
  rơi về quy tắc số đếm. Bài đơn vị: `normalize.test.ts` (`'#' + label === code`), `ViewerShell.test.tsx`
  `[VS-16]` (tiêu đề = `tường ${wallCodesOnLevel(...)}`, không `FIXTURE`, `rows[0].value === id`, nhãn di chuột
  cùng mã), `PropertyInspector.test.tsx` `[N10]`, `useWallGeometryEditor.displayCodes.test.ts` (kho không giữ
  tường → `W-403FI`). `e2e/viewer3d.spec.ts:146` thêm ghi chú: `ROOM_ID` khớp hàng mã máy, không khớp tiêu đề ·
  commit `957a711` · **đã kiểm đỏ trước sửa** (2026-10-03, `src/` của `f2e7e73`: tiêu đề ra `"W-0403FIXTURE0"`).

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

- **Trạng thái:** không phải lỗi — đóng, không sửa mã sản phẩm. "AI" là viết tắt, giữ hoa theo quy ước viết tắt
  của `KQ-A6.md` (chờ người dùng thêm dòng ấy vào A6 trong `CLAUDE.md`).
- **Mức:** —
- **Bất biến vi phạm:** —
- **Phát hiện:** 2026-09-30 ghi chú V8 (F6); đo lại 2026-10-03: chip `tất cả · chỉnh sửa · duyệt · AI`
- **Tái hiện bằng tay:** mở `/projects/P-01/3d`, mở "Lịch sử thao tác": bốn chip `tất cả`, `chỉnh sửa`, `duyệt`, `AI`.
- **Tái hiện bằng máy:** `e2e/v8/viewer-panels.spec.ts` › "lịch sử mở ra ca rỗng thật: lời giải thích, bốn chip loại
  việc, lọc người thực hiện" (tên giữ nguyên vì `fragments/W06.md` trích) đã so đúng chữ, phân biệt hoa thường,
  đủ bốn chip. Bài `test.fixme` "chip lọc lịch sử viết thường kiểu câu, kể cả chip "ai"" đã xoá.
- **Gốc:** `HistoryPanel/historyPanelTypes.ts` `ai: 'AI'` — cố ý. Viết "ai" sẽ đọc thành đại từ "ai" của tiếng Việt.
  Không đổi chip thành "máy dò tự động": đó là phần đọc ẩn của từng dòng, và tên đọc khác chữ thấy là trái WCAG 2.5.3.
- **Sửa:** không sửa sản phẩm. `historyPanelTypes.ts` chú thích "Viết thường hoàn toàn (A6); "AI" là viết tắt nên
  giữ hoa…". Bài đơn vị `HistoryPanel.test.tsx` `[G3]` thêm khẳng định đúng chữ trên phần đã vẽ
  (`['tất cả', 'chỉnh sửa', 'duyệt', 'AI']`), vì `expectVietnamese` không phân biệt "AI" với "ai" · commit `cd75dd5`.
  Tài liệu cần gộp: `bugs.md:163,1539-1547` ghi "đóng — không sửa"; `plan.md:1851,2735` bỏ ý "chờ người duyệt";
  `fragments/W06.md:22` gỡ khỏi danh sách fixme.

### B-V8-08 · "Hai `role=status` cùng lúc khi dựng xong" (F7)

- **Trạng thái:** không phải lỗi
- **Phép đo đã bác:** 2026-10-03, sau "Mô hình 3D đã dựng xong." trên `/projects/P-01/3d`: `getByRole('status')` đếm **1** — "đang làm việc riêng / chỉ mình bạn đang xem" (`CollaborationLayer.tsx:351`). Khối `sr-only` (`Viewer3D.tsx:254`) không mang role; lớp "Đang dựng mô hình" (`:67`) chỉ có lúc dựng.

### B-V8-09 · Tour chắn cú bấm đầu trên màn 3D (F8)

- **Trạng thái:** không phải lỗi (của nhóm V8) — hành vi thiết kế: nền tối `pointer-events-auto`, bấm vào là "bỏ qua" (`EditorTour.tsx:248-250`)
- **Phép đo:** 2026-10-03 — tour hiện một lần mỗi trang, ngay sau neo đầu tiên (cú bấm canvas 65 ms, mở Lịch sử 19 ms, mở ô tìm 9 ms), không hiện lại sau "bỏ qua". Thời điểm hiện (giữa chừng thay vì lúc tải) là lỗi của V2, W02 đang sửa — bài nhóm V8 đã chuẩn bị cho cả hai (đóng tour lúc tải nếu có, rồi sau mỗi lần mở neo).

### B-V8-10 · Ba con số "248,60 m²" từ hai bộ mẫu; số hình học của bộ mẫu chuẩn là 238,00 (F9)

- **Trạng thái:** đã sửa (`4501889`) — câu A14 người dùng đã duyệt; bài đơn vị **đã kiểm đỏ trước sửa**
- **Mức:** thấp — không người dùng thật nào thấy; bẫy cho người viết bài
- **Bất biến vi phạm:** A14 (khai 248,60, đo 238,00)
- **Phát hiện:** 2026-10-03 · đo bảng diện tích khi bơm `createSampleBuilding()`: 238,00 m², mỗi phòng 17,00
- **Tái hiện bằng máy:** `src/domain/rooms/__tests__/area.test.ts` › "the standard sample schedule" —
  nay đọc `room.outline` thật; trên bộ mẫu cũ 4 bài đỏ. Không e2e (thiết kế).
- **Gốc:** `sampleBuilding.ts` phòng cuối khai `areaM2 = 27,6` nhưng đường bao 4000×4250 (17,00);
  `area.test.ts` tự dựng lại đường bao từ `areaM2` nên đo chính nó.
- **Sửa:** `sampleBuilding.ts` `LARGE_ROOM_DEPTH_MM = 6900` (phòng `R-ROOM0000130` 4000×6900 =
  27,60; tổng 248,60); `area.test.ts` bỏ `createSampleRoomOutlines`; `RoomAreaPanel.stories.tsx` bỏ
  phần dựng lại đường bao (giữ tên tiếng Việt; bỏ `SCHEDULE_ROOM_WIDTH_MM` không còn ai dùng);
  docblock: `RoomAreaPanel.test.tsx`, `viewerShellFixture.ts` (bỏ "34 phòng và sảnh"), 
  `viewerShellGateway.ts` (`shellDataOf` đo bằng `totalArea()` trên `outline`, không cộng
  `areaM2`), `mobileViewerScenarios.ts`, `versionHistoryFixtures.ts`, `houseScene.ts`,
  `viewer-panels.spec.ts`; `CLAUDE.md` hàng A14 đoạn "Về diện tích" — đúng câu đã duyệt.
  ~50 nơi gọi `createSampleBuilding`: `pnpm test` toàn bộ xanh; chỉ `y_max` của phòng 13 đổi.

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

### B-V8-41 · Đích lưu trên `/3d` không theo tầng của đối tượng đang sửa (N1)

- **Trạng thái:** mở
- **Mức:** cao — sau B-V8-04 panel thuộc tính tới được đường lưu; đích lưu là `activeFloorId`
- **Bất biến vi phạm:** A7 (báo "Đã lưu" cho một lượt ghi sai tầng)
- **Phát hiện:** 2026-10-03 · tranh luận nguồn dữ liệu (phản biện B-V8-04)
- **Tái hiện bằng máy:** chưa có bài (lệnh giao: không làm)
- **Gốc:** `propertyInspectorGateway.ts` chọn đích lưu theo `activeFloorId`; đi màn đối chiếu → `/3d`
  để lại tầng cũ. Vá tạm trong `1632fa9`: `useViewer3DSource` gọi `setActiveFloor(null)` khi gắn
  (`ponytail:`), nên đường lưu rơi về "không có đích" thay vì ghi tầng cũ.
- **Sửa:** chưa. Hướng: đích lưu theo `levelId` của đối tượng; xong thì gỡ `setActiveFloor(null)`.

### B-V8-42 · Câu chữ khi rỗng / không có đích lưu nói sai (N2)

- **Trạng thái:** mở
- **Mức:** trung bình
- **Bất biến vi phạm:** A11
- **Phát hiện:** 2026-10-03 · tranh luận nguồn dữ liệu; đo lại bằng bài `fixme` tạm bật ở B-V8-04
- **Tái hiện bằng máy:** `e2e/v8/viewer-panels.spec.ts` › "chưa bơm kho: chọn một phòng thì panel
  thuộc tính ra thuộc tính…" (`fixme`) — ở mock, panel không có heading "Phòng" dù vừa chọn
  "Phòng ngủ 4" trên cảnh nhà mẫu.
- **Gốc:** `NO_SAVE_TARGET_REASON` nói "Chưa mở dự án" dù dự án đã mở (câu chép 3 nơi); ở mock panel
  nói "Chưa chọn đối tượng nào" dù đang có đối tượng được chọn (đối tượng của nhà mẫu không có trong kho).
- **Sửa:** chưa.

### B-V8-43 · Nhãn viết hoa trong HistoryPanel

- **Trạng thái:** mở
- **Mức:** thấp
- **Bất biến vi phạm:** A6 (nhãn viết thường)
- **Phát hiện:** 2026-10-03 · tranh luận A6 (`KQ-A6.md`, mục mới 2)
- **Tái hiện bằng tay:** các tiêu đề và nút ở `HistoryPanel.chrome.tsx:56-69`, `rows.tsx:53`, và hai lựa chọn
  'Bạn' / 'Người dùng khác'.
- **Tái hiện bằng máy:** chưa lập. Khi sửa: `e2e/v8/viewer-panels.spec.ts:126` phải sửa theo.
- **Gốc:** nhãn viết kiểu câu
- **Sửa:** chưa

### B-V8-44 · Tiêu đề cảnh báo ở ViewerInspector viết hoa chữ đầu

- **Trạng thái:** mở
- **Mức:** thấp
- **Bất biến vi phạm:** A6 (tiêu đề là nhãn)
- **Phát hiện:** 2026-10-03 · tranh luận A6 (`KQ-A6.md`, mục mới 3)
- **Tái hiện bằng tay:** `ViewerShell/ViewerInspector.tsx:72,87` (tiêu đề hai cảnh báo).
- **Tái hiện bằng máy:** chưa lập. Bẫy: `viewer3d.spec.ts:755` vẫn xanh nhưng không còn kiểm gì nếu chỉ đổi chữ —
  phải sửa cùng `:790`.
- **Gốc:** nhãn viết kiểu câu
- **Sửa:** chưa

### B-V8-45 · Bộ mẫu vỏ 3D cho nhãn người đọc xấu (`W-403FI`, `R-11FIX`); ô tìm phòng in `room.id`

- **Trạng thái:** mở
- **Mức:** thấp — nhãn nhất quán nhưng khó đọc; ô tìm phòng lộ mã máy
- **Bất biến vi phạm:** — (mục B)
- **Phát hiện:** 2026-10-03 · tranh luận B-V8-05 (đọc mã)
- **Tái hiện bằng tay:** mở `/3d`, chọn tường hoặc phòng: tiêu đề "tường W-403FI" / "phòng R-11FIX".
- **Tái hiện bằng máy:** chưa — chép từ "Mục mới nên mở", không viết bài.
- **Gốc:** `ViewerShell/viewerShellFixture.ts:78` `fixtureId` ghép mã số ngắn (`"0403"`, `"011"`) với `FIXTURE0`
  thay vì đệm đủ sáu chữ số đếm như `createId`; `Viewer3D/ObjectSearch.tsx:252` in `room.id`.
- **Sửa:** chưa — padStart mã bộ mẫu kéo theo các bài khớp chuỗi con (`viewer3d.spec.ts` `ROOM_ID`), làm cùng ô tìm.

### B-V8-46 · Thư viện đồ đạc: dưới 1024 px, nhánh `collapsed` che câu "vai chỉ xem"

- **Trạng thái:** mở
- **Mức:** thấp — Người xem ở màn hẹp không được nói vì sao thẻ khoá (câu thẻ "Chỉ xem được, không kéo vào bản vẽ." vẫn còn)
- **Bất biến vi phạm:** —
- **Phát hiện:** 2026-10-03 · tranh luận B-V8-03 (đọc mã)
- **Tái hiện bằng tay:** vai Người xem, khung nhìn < 1024 px, mở "Thư viện đồ đạc"
- **Tái hiện bằng máy:** chưa có bài
- **Gốc:** `useFurnitureLibraryPanel.ts`, `if (shell.leftAsDrawer)` trả `collapsed` TRƯỚC `if (!options.canPlaceModel)`
- **Sửa:** chưa

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

### B-V9-04 · Vai Người xem: phím M không vào chế độ đo, và vào bằng nút "bật tắt công cụ đo" thì ray không nút nào sáng

- **Trạng thái:** đã sửa (`957a711`)
- **Mức:** thấp — người dùng bàn phím/trình đọc màn hình không có đường vào và không có dấu hiệu "đang đo"
- **Bất biến vi phạm:** A12
- **Phát hiện:** 2026-09-30 · V9 lớp 2 (P5); đo lại 2026-10-03: sau `M`, không nút ray nào `aria-pressed=true`
- **Tái hiện bằng tay:**
  1. Đăng nhập `viewer@example.com`, mở `/3d/measure`, nhấn `M`.
  2. Bấm nút "bật tắt công cụ đo (phím M)" của màn đo.
  - Kỳ vọng: ray có nút `đo (M)` và nó sáng; bấm canvas ra bản nháp, nút ghim hiện nhưng khoá.
  - Thực tế (trước sửa): ray 5 nút, không có `đo`; phím M bị chốt `tools.some` nuốt; nút chuột bật đo mà ray
    không nút nào sáng.
- **Tái hiện bằng máy:** `e2e/v9/measure.spec.ts` › "vai Người xem: ray công cụ cho thấy đang đo, qua phím M lẫn qua nút bật tắt (A12 · B-V9-04)"
  và "vai Người xem: vẫn vào được chế độ đo, và màn nói vì sao không ghim được" (làm chặt: `đo (M)` sáng, ghim khoá;
  bỏ khẳng định `DROP_DRAFT` vì nút ấy luôn dựng nên bài cũ rỗng)
  `E2E_PORT=5191 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v9/measure.spec.ts -g "B-V9-04"`
- **Gốc:** `ViewerShell/useViewerShell.ts` — `đo` là công cụ duy nhất mang `requiresEdit: true`, `tools` lọc nó
  khi `forbidden`, và `activateTool` chặn mọi id không có trong `tools`. Đo là thao tác chỉ đọc (màn đo đã cho
  Người xem đo — `MeasurementTool.test.tsx` mục [9]).
- **Sửa:** phương án (1) đã chốt ở tranh luận — bỏ cờ `requiresEdit`, xoá `useMemo` lọc, `tools: VIEWER_TOOLS`,
  `activateTool: setActiveToolId`. Bài đơn vị `ViewerShell.test.tsx`: `[VS-2]` viết lại (Người xem 6 nút = kỹ sư,
  có `đo`), bài phím "vai người xem: bấm m bật công cụ đo" lật thành `'measure'` · commit `957a711` ·
  **đã kiểm đỏ trước sửa** (2026-10-03, `src/` của `f2e7e73`: cả hai bài đỏ ở "không có nút `đo (M)` trên ray").

### B-V9-05 · Hai câu "không có quyền" cạnh nhau ở tách tầng viết tên vai khác nhau

- **Trạng thái:** đã sửa (`cd75dd5`)
- **Mức:** thấp — trình đọc màn hình đọc "vai người xem" rồi "vai Người xem"
- **Bất biến vi phạm:** A6 (tên vai là danh từ chung, chốt ở `KQ-A6.md`)
- **Phát hiện:** 2026-09-30 · V9 lớp 2 (P6)
- **Tái hiện bằng tay:** đăng nhập `viewer@example.com`, mở `/3d/exploded`: `Bạn đang xem ở vai người xem nên không
  sửa được vị trí tầng.` (sr-only, `ExplodedView.tsx`) cạnh `Bạn đang xem ở vai Người xem nên không sửa được mô hình.`
  (`ViewerInspector.tsx`).
  - Kỳ vọng: cả hai viết "vai người xem".
- **Tái hiện bằng máy:** `e2e/v9/exploded.spec.ts` › "vai người xem: hai câu "không có quyền" cạnh nhau viết tên vai
  giống nhau (B-V9-05)" — `test.fixme` → `test`; `getByText(/vai người xem/u)` phân biệt hoa thường, `toHaveCount(2)`
  · **đã kiểm đỏ trước sửa** (2026-10-03, `ViewerInspector.tsx` + `Viewer3D.tsx` của `8bb2734`: nhận "1")
- **Gốc:** không có quy ước tên vai; bốn câu người đọc viết "vai Người xem".
- **Sửa:** `ViewerInspector.tsx`, `Viewer3D.tsx`, `useThicknessStandardization.ts`, `useRoomLabelReview.ts` → "vai người
  xem"; bản chép `vi.json` (bốn khoá). Cùng commit: `e2e/viewer3d.spec.ts` › `waitForViewerReady` và
  `e2e/v8/viewer.ts` (không sửa thì bài chờ 20 s rồi đỏ). Khoảng 70 chỗ trong chú thích và tên bài không đổi.
  Bài đơn vị: `Viewer3D.test.tsx` (ca không có quyền, `getByText` câu đầy đủ), `ViewerShell.test.tsx` [VS-2],
  `useRoomLabelReview.test.ts` và `useThicknessStandardization.test.ts` (`not.toBeNull()` → `toBe(<câu đầy đủ>)`)
  · commit `cd75dd5`.

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

### B-V9-41 · Màn đo: nút xoá và phím Delete không bị chặn khi `forbidden`

- **Trạng thái:** mở
- **Mức:** thấp — vai chỉ xem vẫn được mời xoá phép đo (có toast hoàn tác, nhưng lệnh lẽ ra không được gửi)
- **Bất biến vi phạm:** —
- **Phát hiện:** 2026-10-03 · tranh luận B-V9-04 (đọc mã)
- **Tái hiện bằng tay:** đăng nhập `viewer@example.com`, mở `/3d/measure` có ít nhất một phép đo đã ghim, bấm
  "Xoá …" hoặc chọn rồi nhấn Delete.
- **Tái hiện bằng máy:** chưa — chép từ "Mục mới nên mở", không viết bài.
- **Gốc:** `MeasurementTool/useMeasurementTool.ts` `onDelete` (`:776-779`) và đường phím Delete (`:862-873`)
  không xét `canPin`/trạng thái `forbidden`, khác `onPin`.
- **Sửa:** chưa.

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

### B-V10-05 · Gói Pascal gây 1 vi phạm CSP `script-src eval`

- **Trạng thái:** đã sửa (`eaa20c3`)
- **Mức:** thấp — cảnh vẫn dựng (zod bắt lỗi phép dò); chỉ là một dòng báo CSP mỗi lần nạp
- **Bất biến vi phạm:** —
- **Phát hiện:** plan.md mục 9 V10 P1 · đo lại 2026-10-03
- **Tái hiện bằng tay:**
  1. Phục vụ trang với `script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'; worker-src 'self' blob:` (phần `script-src`/`worker-src` của chính sách BE, cộng `'unsafe-inline'` cho phần mở đầu của `vite dev`).
  2. Bật cờ `scene.pascal-viewer`, đăng nhập, mở `/projects/P-01/3d/pascal`, nghe `securitypolicyviolation` tới khi "đã dựng xong toàn bộ bản vẽ.".
  - Kỳ vọng: 0 vi phạm.
  - Thực tế (trước sửa): `["script-src | eval | …/assets/pascal/pascalMount-D-XGBRdU.js"]`.
- **Tái hiện bằng máy:** không có bài nộp — Q5 = B cấm ca CSP trên chính sách tự dựng. Phép đo dùng bài tạm (đã xoá), chạy qua khoá chung, gói Pascal dựng thật: **trước vá 1, sau vá 0** (cùng chính sách, cùng máy, 2026-10-03). Lưu ý: bỏ `worker-src 'self' blob:` thì xuất hiện 4 vi phạm `worker-src | blob` — do chính sách tạm thiếu chỉ thị, không phải lỗi; chính sách BE có `worker-src 'self' blob:`. Bài đơn vị `usePascalViewer.test.tsx` (bài nạp thật duy nhất) khẳng định `window.__zod_globalConfig?.jitless === true` khi thẻ script đã vào DOM; đột biến bỏ dòng sửa ⇒ đỏ.
- **Gốc:** nhát vá `jitless` chỉ sống ở trang spike `src/vach-ngan.tsx` (không còn trong cây); màn thật chưa từng đặt cờ, nên zod 4 trong gói dò `new Function` (`zod/v4/core/util.js:149-151`).
- **Sửa:** `usePascalViewer.ts` › `defaultLoadMount`, sau nhánh `existing`, trước khi tạo thẻ script: `(window.__zod_globalConfig ??= {}).jitless = true;` + `declare global` cho `Window.__zod_globalConfig` (khuôn `pascalMount.tsx`). Docblock `e2e/pascal-viewer.spec.ts` ("Không kiểm CSP") và `docs/pascal/01-ho-so-cong-T4.1.md` §8e cập nhật số đo.
  - **Lệch thiết kế (lý do thật):** thiết kế chốt `window.__zod_globalConfig = { ...window.__zod_globalConfig, jitless: true }` (thay cả đối tượng). Tôi sửa TẠI CHỖ, vì zod giữ tham chiếu tới đối tượng lúc nạp (`zod/v4/core/core.js:135-136`: `export const globalConfig = globalThis.__zod_globalConfig`) — một đối tượng mới đặt sau khi zod đã nạp (ví dụ lượt thử lại sau khi một chunk con hỏng) sẽ không tới được zod. Cùng một dòng, không đổi hướng.

### Mục mới nên mở (từ tranh luận, thuộc vùng I3 — chưa có bài)

### B-V10-06 · Bốn số Pascal không phải bộ A14; trang chỉ có tường bao + phòng (P2 của V10)

- **Trạng thái:** không phải lỗi
- **Mức:** thấp
- **Bất biến vi phạm:** — (A14 không cấm một màn có bộ mẫu riêng — khuôn B-V7-14)
- **Phát hiện:** plan.md mục 9 V10 P2
- **Phép đo đã bác:** "ô mở 0" là số thật của bộ vỏ (`VIEWER_FIXTURE_GRAPH`, `openings: []`); bộ đổi
  dữ liệu không làm rơi gì — `pascalScene.test.ts` (store Pascal thật, `droppedIds` rỗng) và
  `roundTrip.test.ts`. Hai bộ trùng ba số (4 tầng · 14 phòng · 248,60) và khác năm loại (tường
  16/48, ô mở 0/16, đồ đạc 0/21, trục 0/4, kích thước 0/34). Dựng hình WebGL chỉ đo tay.
- **Sửa:** chỉ tài liệu, trong `4501889`: `viewerShellFixture.ts` mục "Quan hệ với bộ mẫu chuẩn A14 —
  bộ RIÊNG của màn" và chú thích `FIXTURE_TOTAL_AREA_M2`; `explodedViewGateway.ts` cổng giả dẫn R-70
  thay A14. Hàng tổng của `bugs.md:182` nên ghi `| không phải lỗi | — | khung |`.

### B-V10-41 · `pascal-mount.js` không có mã băm nhưng `/assets/` gửi `immutable` một năm

- **Trạng thái:** mở — cần FE và BE cùng quyết
- **Mức:** trung bình — sau mỗi lần triển khai, trình duyệt có thể giữ tệp vào cũ trỏ tới chunk đã xoá ⇒ `PASCAL-01`
- **Bất biến vi phạm:** —
- **Phát hiện:** 2026-10-03 · tranh luận B-V10-05 (đọc mã)
- **Tái hiện bằng tay:** chưa đo (cần môi trường triển khai thật)
- **Tái hiện bằng máy:** chưa có bài
- **Gốc:** `AppBack/deploy/nginx/.../app_locations.conf:62` (`immutable`), `vite.pascal.config.ts:72` (tệp vào tên cố định)
- **Sửa:** chưa

## Tổng theo trạng thái (mục của I3)

| Trạng thái | Số | Mục |
|---|---|---|
| đã sửa | 2 + 1 một nửa | B-V1-04, B-V10-05; B-V8-03 (nửa câu chữ/quyền, nửa kéo-thả chờ B-V8-04) |
| ngoài FE | 1 | B-V1-05 |
| mở (mới) | 5 | B-V1-41, B-V1-42, B-V1-43, B-V8-41, B-V10-41 |
| chờ quyết / không phải lỗi | 0 | — |

## V12

### B-V12-01 · Bốn màn luật/xuất/dữ liệu luôn rỗng khi đi bằng đường sản phẩm

- **Trạng thái:** đã sửa (`6dbbe4d`, `287970b`, mở rộng `4d8a4a7`) — bài tái hiện **đã kiểm đỏ trước sửa**
- **Mức:** cao — người dùng không bao giờ thấy kết quả kiểm tra luật, cài đặt luật, xuất, dữ liệu
- **Bất biến vi phạm:** A11 (`empty` nói sai sự thật)
- **Phát hiện:** 2026-09-30 · V12 0.1 (đo) — plan.md mục 9 F1
- **Tái hiện bằng tay:**
  1. Mở `/projects/project-1/rules` (hoặc `/rules/settings`, `/export`, `/data`)
  - Kỳ vọng: nội dung của mô hình dự án
  - Thực tế (trước sửa): `empty` ("Chưa có mô hình để kiểm tra luật", "chưa có gì được duyệt để xuất", …)
- **Tái hiện bằng máy:** `e2e/v12a/rules.spec.ts` › "B-V12-01: vào màn luật bằng đường sản phẩm
  (không bơm) thì cổng nạp kho dự án và màn có kết quả kiểm tra, không nói "chưa có mô hình""; cùng
  khuôn ở `rule-settings.spec.ts`, `data.spec.ts`, `share-dialog.spec.ts` (ca đầu), dòng
  `projectExport` của `smoke-grid.spec.ts` (mốc heading "xuất bản vẽ", bỏ `known`).
  `E2E_PORT=5193 E2E_SKIP_PASCAL=1 pnpm e2e e2e/v12a -g "B-V12-01"`
- **Gốc:** `store/projectSlice.ts` `setFloors`/`setProject` không có nơi gọi ngoài kho và test; không
  route nào nạp `store.spatial`.
- **Sửa:**
  - `src/api/floorLayerGraph.ts` — `readProjectSpatial` (N3 rồi N16 mọi tầng; dự án 0 tầng ra đồ thị
    rỗng thật; lỗi thì ném; `toStoreProject`).
  - `src/hooks/useProjectSpatial.ts` (mới) — `needsProjectSpatial` (kho rỗng / dự án khác / kho QC
    chưa sửa thì nạp; có `pastStates` thì giữ — `ponytail:`), `useQuery` khoá
    `[...project.detail(id), 'spatial']`, `staleTime` từ `CACHE_POLICY.projectSpatialLoad`, cờ
    `spatialLoading` bật trong `useLayoutEffect`, ghi kho đồng bộ `setProject → setSpatial →
    setFloors` chỉ khi `isFetchedAfterMount && !isFetching` và kiểm lại bằng `getState()`,
    telemetry qua `createScreenErrorRecorder`; client và bộ đọc nạp lười (`import()`).
  - `src/components/feedback/ProjectSpatialGate.tsx` (mới) — lỗi thì `role="alert"` + `EmptyState`
    thay màn con, "Thử lại" chỉ khi thử lại được; còn lại trả màn con.
  - Bọc cổng trong `RulesRoute`, `RuleSettingsRoute`, `ExportPanelRoute` (trong `Toast.Provider`),
    `SpatialJsonViewerRoute`; bước 4: `ExplodedViewRoute`, `MeasurementToolRoute`,
    `PascalViewerRoute` đọc `selectViewerSpatial` (`viewerShellGateway.ts`: đang nạp thì `null`,
    xong thì luật nhà mẫu như `/3d`).
  - Sửa kèm: `useAutosave.ts` chỉ hẹn lưu khi `pastStates + futureStates > 0` (Q13: lượt nạp không
    gây tự lưu); `levelOfGraph(graph, levelId?)` ở `objectLayerReviewGateway.ts` và
    `dimensionOcrReviewGateway.ts`, nơi gọi truyền `floorId` (lệch 1 ở trên).
  - `e2e/fixtures/seedSpatial.ts` — `seedSpatial(page, { projectId })` chờ `project.id === projectId`
    (đăng ký `subscribe`, không chờ đồng hồ) rồi mới `setSpatial` + `setFloors`; không `setProject` giả.
  - Bài đơn vị: `ProjectSpatialGate.test.tsx` (8 ca của thiết kế), `floorLayerGraph.test.ts`,
    `useAutosave.test.ts`, `cachePolicy.test.ts`, `RuleSettings.test.tsx` (đặt sẵn kho + `keepStore`),
    `viewerShellGateway.test.ts` (3 ca `selectViewerSpatial`), `PascalViewer.tree.test.tsx` (2 ca route).

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

- **Trạng thái:** đã sửa (`aeac98c`, cần `dfb2275`) — bài tái hiện **đã kiểm đỏ trước sửa**
- **Mức:** trung bình — sửa nhầm họ tên thì không có đường quay lại ngoài gõ lại
- **Bất biến vi phạm:** A8
- **Phát hiện:** 2026-09-30 · V12 (F3); đo lại 2026-10-03
- **Tái hiện bằng tay:** `/tai-khoan` → sửa `họ tên` → chờ `Đã lưu lúc HH:mm` → không có `Hoàn tác`.
- **Tái hiện bằng máy:** `e2e/v12b/account.spec.ts` › "F3 sửa họ tên có toast "Hoàn tác" đưa họ tên
  cũ trở lại (A8)" — trên mã cũ: `Timed out 5000ms … getByRole('button', { name: 'Hoàn tác' })`.
- **Gốc:** `useAccountSettings.ts` (`bridgeRef.current.save`) lưu mà không phát vé hoàn tác.
- **Vì sao không còn chờ quyết:** kênh chung đã gộp thông báo cùng loại trong 5 giây vào một toast
  (`notificationBus.ts`), nên "gộp theo phiên sửa" có sẵn, không toast liên tục; lệnh ngược có thật
  (`PATCH /me` chỉ ghi các cột có mặt, `AppBack/apps/api/me/router.py:115-143`).
- **Sửa:** `useAccountSettings.ts` — `save`: chụp `previous = saved`, lưu, rồi (trừ lượt hoàn tác
  và lượt đầu) phát `{ type: 'account-settings', title: 'Đã lưu cài đặt tài khoản.', description: '' }`
  kèm vé; Hoàn tác đặt `restoringRef`, `restoredDraft` (bản sao mới → `port.saved` đổi), `setDraft`,
  `autosave.notifyChange()` — lượt ghi lại đi qua chính đường tự lưu, chỉ báo A7 vẫn nói thật, không
  sinh vé mới. `useAccountPreferences.ts`: nạp lại ô ngay trong lượt render khi `port.saved` đổi
  (khuôn `useAccountTables`). Lệch thiết kế (không `setQueryData`) ở mục "Lệch thiết kế". Phạm vi:
  hồ sơ, giao diện, ma trận thông báo — không mật khẩu/phiên/vùng nguy hiểm/phím tắt. Bài đơn vị
  `AccountSettings.test.tsx` (3 bài, có `<NotificationHost bus>`). E2e: `fixme` → `test`, khẳng định
  "Hoàn tác" hiện trước khi bấm; regex chỉ báo lưu siết `Đã lưu.*` → `Đã lưu lúc.*` (bản cũ khớp cả
  toast).

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
