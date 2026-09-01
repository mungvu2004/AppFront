# S-14 T4 — Bảng đối chiếu chuỗi "Đọc kích thước OCR"

| Khoá | Chuỗi tiếng Việt | Chỗ xuất hiện trên màn |
|---|---|---|
| `screen.title` | đọc kích thước OCR | Tiêu đề trang |
| `screen.canvasAriaLabel` | Bản vẽ lớp kích thước OCR | nhãn aria canvas |
| `screen.dimensionListAriaLabel` | Danh sách kích thước đọc được | nhãn aria danh sách |
| `screen.comparisonBarAriaLabel` | Thanh so sánh với hình học | nhãn aria thanh đối chiếu |
| `panel.title` | Kích thước đọc được | Tiêu đề bảng duyệt |
| `panel.unitLabel` | mm | Nhãn đơn vị cố định bên phải ô nhập |
| `filter.ariaLabel` | Lọc theo trạng thái duyệt | nhãn aria SegmentedControl |
| `filter.allLabel` | tất cả | Nút bộ lọc "tất cả" |
| `filter.lowConfidenceLabel` | độ tin cậy thấp | Nút bộ lọc "độ tin cậy thấp" |
| `filter.unreviewedLabel` | chưa duyệt | Nút bộ lọc "chưa duyệt" |
| `row.approveLabel` | Duyệt kích thước này | Nhãn nút duyệt trên mỗi hàng |
| `row.skipLabel` | Bỏ qua | Nhãn nút bỏ qua trên mỗi hàng |
| `row.imageAltPrefix` | Cắt vùng gốc của chuỗi kích thước  | Tiền tố nhãn alt ảnh cắt vùng |
| `row.inputAriaLabelPrefix` | Giá trị kích thước  | Tiền tố nhãn aria ô nhập từng hàng |
| `row.approveButtonAriaLabelPrefix` | Duyệt kích thước  | Tiền tố nhãn aria nút duyệt |
| `comparisonBar.ariaLabel` | Thanh so sánh với hình học | Nhãn aria thanh so sánh |
| `keyboard.caption` | Chế độ duyệt bàn phím — đường nhanh nhất để đi qua danh sách kích thước | Caption chỉ ra chế độ bàn phím |
| `keyboard.toggleOnLabel` | Bật chế độ duyệt bàn phím | Nhãn nút bật chế độ |
| `keyboard.toggleOffLabel` | Tắt chế độ duyệt bàn phím | Nhãn nút tắt chế độ |
| `keyboard.shortcutHint` | Hoặc bấm R để bật | Gợi ý phím tắt |
| `keyboard.keys.enter.label` | Enter | Tên phím Enter |
| `keyboard.keys.enter.description` | lưu và nhảy dòng sau | Mô tả hành động Enter |
| `keyboard.keys.tab.label` | Tab | Tên phím Tab |
| `keyboard.keys.tab.description` | sang cột sau | Mô tả hành động Tab |
| `keyboard.keys.esc.label` | Esc | Tên phím Esc |
| `keyboard.keys.esc.description` | bỏ sửa | Mô tả hành động Esc |
| `keyboard.keys.r.label` | R | Tên phím R |
| `keyboard.keys.r.description` | bật chế độ duyệt bàn phím | Mô tả hành động R |
| `states.empty.title` | chưa đọc được chuỗi kích thước nào | Tiêu đề trạng thái rỗng (A11 state 1) |
| `states.empty.description` | Chuỗi kích thước trên bản vẽ có nét mảnh hoặc không rõ, nên OCR không tách được số. Hiệu chỉnh tỷ lệ bằng tay để đo độ dài từ bản vẽ. | Mô tả trạng thái rỗng + dẫn hướng |
| `states.empty.actionLabel` | Hiệu chỉnh tỷ lệ | Nhãn nút dẫn sang hiệu chỉnh tỷ lệ |
| `states.loading.title` | đang đọc kích thước | Tiêu đề trạng thái đang tải (A11 state 2) |
| `states.loading.description` | Hệ thống đang nhận diện chuỗi kích thước trên bản vẽ. Đợi một lát… | Mô tả trạng thái đang tải |
| `states.partial.title` | một phần kích thước đã duyệt | Tiêu đề trạng thái một phần (A11 state 3) |
| `states.partial.descriptionComplete` | {{count}} chuỗi dưới ngưỡng tin cậy. Bấm "Chỉ hiện mục cần xem" để xem những chuỗi đó. | Mô tả khi OCR đã xong toàn bộ |
| `states.partial.descriptionPartialOcr` | Vừa đọc xong một phần bản vẽ. {{count}} chuỗi dưới ngưỡng tin cậy, bộ lọc đã chỉnh sẵn. | Mô tả khi OCR vừa xong một phần |
| `states.partial.filterHintLabel` | Chỉ hiện mục cần xem | Nhãn bộ lọc dành cho trạng thái một phần |
| `states.error.title` | không đọc được kích thước | Tiêu đề trạng thái lỗi (A11 state 4) |
| `states.error.description` | Hệ thống gặp lỗi khi xử lý bản vẽ. Thử lại để chạy lại bước này. | Mô tả trạng thái lỗi |
| `states.error.actionLabel` | Thử lại | Nhãn nút thử lại |
| `states.done.title` | tất cả kích thước đã duyệt | Tiêu đề trạng thái xong (A11 state 5) |
| `states.done.description` | Mọi chuỗi kích thước trên bản vẽ đã kiểm tra xong. | Mô tả trạng thái xong |
| `states.forbidden.title` | không có quyền duyệt kích thước | Tiêu đề trạng thái không quyền (A11 state 6) |
| `states.forbidden.description` | Vai trò hiện tại chỉ được xem, không được chỉnh sửa lớp kích thước OCR. Liên hệ quản trị dự án nếu cần. | Mô tả trạng thái không quyền |
| `states.collapsed.title` | bảng duyệt đang thu gọn | Tiêu đề trạng thái thu gọn (A11 state 7) |
| `states.collapsed.description` | Bung bảng để xem danh sách kích thước và chỉnh sửa giá trị. | Mô tả trạng thái thu gọn |

## Hàm tự xây dựng chuỗi (không thay vào i18n)

Những hàm này xây dựng chuỗi với tham số đã định dạng sẵn. Chúng nằm trong `dimensionOcrText.ts`:

| Hàm | Tham số | Kết quả ví dụ |
|---|---|---|
| `reviewProgressLabel(reviewed, total)` | `reviewed`="18", `total`="34" | "18/34 kích thước đã duyệt" |
| `wallReferenceLabel(wallCode)` | `wallCode`="#W-014" | "Gắn với #W-014" |
| `dimensionImageAlt(dimensionCode)` | `dimensionCode`="D-005" | "Cắt vùng gốc của chuỗi kích thước D-005" |
| `comparisonLine(readValue, measuredValue, deviationPercent)` | `readValue`="4.800 mm", `measuredValue`="4.812 mm", `deviationPercent`="0,25%" | "So sánh với hình học: chuỗi đọc được 4.800 mm · đo từ bản vẽ 4.812 mm · lệch 0,25%" |
| `outlierHint(description)` | `description`="phòng dài bất thường" | "Giá trị này hàm ý phòng dài bất thường: phòng dài bất thường. Kiểm tra lại sao cho phù hợp với bản vẽ." |
| `lowConfidencePartialNotice(count)` | `count`="9" | "9 mục dưới ngưỡng tin cậy, đã lọc sẵn" |
| `dimensionRowInputAriaLabel(dimensionCode)` | `dimensionCode`="D-005" | "Giá trị kích thước D-005" |
| `approveButtonAriaLabel(dimensionCode)` | `dimensionCode`="D-005" | "Duyệt kích thước D-005" |

## Ghi chú

- Tất cả chuỗi tiếng Việt viết thường, kiểu câu (A6)
- Không chữ hoa trừ: mã trục/chuỗi (W-014, D-005), tên phím (Enter, Tab, Esc, R)
- Đủ dấu tiếng Việt — không chữ mất dấu
- Nhãn aria bắt buộc cho mọi thành phần không chữ (R-72, A12)
- Bảy trạng thái (A11): empty, loading, partial, error, done, forbidden, collapsed
