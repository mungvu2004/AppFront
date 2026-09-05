# Hợp đồng chuỗi — `PropertyInspector` (T4)

Nguồn kiểu: `src/screens/viewer/PropertyInspector/propertyInspectorTypes.ts`.
Nguồn chuỗi: `src/i18n/vi.json`, khoá gốc `propertyInspector` — đây là TỪ ĐIỂN KIỂM TRA của
`expectVietnamese`, không phải bảng dịch chạy lúc runtime (xem CLAUDE.md, "Trạng thái hiện
tại"). `usePropertyInspector` (T5) là nơi thật sự tạo ra các chuỗi hiển thị; các khoá dưới
đây là nguồn tham chiếu để T5 lấy đúng chữ, T6 dựng đúng khối, T8 đếm đúng số trường.

Không worker nào khác được sửa `src/i18n/vi.json` — file đó dùng chung toàn repo và T4 là
chủ sở hữu duy nhất của phần `propertyInspector` trong nó.

---

## 1. Khoá i18n → câu tiếng Việt → khối hiển thị

| Khoá `propertyInspector.*` | Câu tiếng Việt | Xuất hiện ở khối nào |
|---|---|---|
| `regionLabel` | Thanh tra đối tượng | `aria-label` của toàn panel |
| `groups.geometry` | Kích thước hình học | Tiêu đề nhóm 1 |
| `groups.material` | Vật liệu | Tiêu đề nhóm 2 |
| `groups.relations` | Quan hệ | Tiêu đề nhóm 3 |
| `groups.inspection` | Kiểm tra | Tiêu đề nhóm 4 |
| `groups.advanced` | Thông số nâng cao | Tiêu đề khối gập (nhóm 5, mặc định đóng) |
| `objectKind.wall` | tường | `kindLabel` gốc trước khi hook viết hoa/số nhiều cho header |
| `objectKind.opening` | ô mở | nt |
| `objectKind.furniture` | nội thất | nt |
| `objectKind.room` | phòng | nt |
| `fields.wall.*` | Độ dày / Chiều dài / Chiều cao / Loại tường / Tường nội thất / Số ô mở | Nhãn 40% trái của dòng thuộc tính — tường |
| `fields.opening.*` | Chiều rộng / Chiều cao / Cao độ bậu / Chiều mở / Tường chủ | Nhãn dòng thuộc tính — ô mở |
| `fields.furniture.*` | Kích thước bao / Góc xoay | Nhãn dòng thuộc tính — nội thất (2 trường cố định; tối đa 3 trường nữa tuỳ hạng mục, không có khoá cố định) |
| `fields.room.*` | Tên / Công năng / Diện tích / Số cửa / Số cửa sổ | Nhãn dòng thuộc tính — phòng |
| `fields.advanced.*` | Lệch Z / Toạ độ đầu / Toạ độ cuối / Mã đối tượng gốc / Độ tin cậy | Nhãn dòng trong khối gập "Thông số nâng cao", chung cho cả bốn loại |
| `wallType.loadBearing` / `.partition` / `.envelope` | Chịu lực / Ngăn / Bao che | Lựa chọn của control `select` ở dòng `wallType` |
| `value.mixed` | **Giá trị khác nhau** | Hiện thay giá trị khi `PropertyValue.kind === 'mixed'` (chọn nhiều, các mục lệch giá trị) |
| `empty.message` | Chưa chọn đối tượng nào để xem thuộc tính. | Câu đầy của trạng thái `empty` |
| `empty.tabHint` | Nhấn Tab để duyệt vòng qua các đối tượng trên mô hình. | Gợi ý phím dưới câu chính của `empty` |
| `loading.label` | Đang tải thuộc tính… | Nhãn ẩn/`aria-live` đi cùng dòng khung xương của `loading` |
| `partial.unavailable` | Không áp dụng cho đối tượng này. | Caption thay dòng trống khi `PropertyValue.kind === 'unavailable'` |
| `partial.selectionSummary` | Đang chọn {{count}} đối tượng | Có thể ghép vào `header.objectKindLabel` khi chọn nhiều |
| `error.title` | Không lưu được thay đổi | Tiêu đề cảnh báo tại dòng lỗi (`warning.level === 'blocking'`) |
| `error.message` | Giá trị vừa nhập không hợp lệ với hình học hiện tại của mô hình. | Nội dung `warning.message` mẫu của trạng thái `error` |
| `error.retry` | Thử lại | Nút `warning.onRetry` tại đúng dòng lỗi |
| `forbidden.message` | Bạn đang xem ở vai chỉ xem nên không sửa được thuộc tính này. | Thông điệp chỉ đọc của trạng thái `forbidden` |
| `collapsed.expandChip` | Mở lại thanh tra đối tượng | Nhãn/`aria-label` của thẻ phụ (`variant: 'chip'`, dưới 1280px) |
| `collapsed.expandSheet` | Kéo lên để xem thuộc tính | Tay cầm tấm trượt (`variant: 'sheet'`, di động) |
| `header.copyAsTemplate` | Lưu làm khuôn mẫu | Nút khuôn ở header (`onCopyAsTemplate`) |
| `header.close` | Đóng | Nút đóng ở header (`onClose`) |
| `footer.approve` | Duyệt | Nút chính ở chân panel (`onApprove`) |
| `footer.skip` | Bỏ qua | Nút chìm ở chân panel (`onSkip`) |
| `footer.savedAt` | Đã lưu lúc {{time}} | Mẫu ghép `lastEditedCaption` khi chỉ có thời điểm |
| `footer.lastEditedBy` | Đã sửa lúc {{time}} bởi {{name}} | Mẫu ghép `lastEditedCaption` khi có cả người sửa |
| `actions.openRuleScreen` | Xem quy tắc | Nút sang màn luật, gọi `onOpenRuleScreen` (nhóm "Kiểm tra") |
| `actions.navigateToObject` | Đi tới đối tượng {{code}} | `aria-label` của một liên kết quan hệ bấm được |
| `relations.onWall` | Nằm trên #{{code}} | Mẫu `value.formatted` của dòng `link` — ô mở trỏ tới tường chủ |
| `relations.inRoom` | Thuộc phòng #{{code}} | Mẫu `value.formatted` của dòng `link` — đối tượng trỏ tới phòng chứa nó |
| `status.verified` | Đã duyệt | `statusBadge.label` khi `tone === 'verified'` — CHỈ do người dùng bấm "Duyệt" đặt (A5) |
| `status.attention` | Cần chú ý | `statusBadge.label` khi `tone === 'attention'` |
| `status.violation` | Vi phạm | `statusBadge.label` khi `tone === 'violation'` |

---

## 2. Bảy trạng thái → phần tử giao diện hiện ra

| `PropertyInspectorState['kind']` | Phần tử giao diện |
|---|---|
| `empty` | Biểu tượng nét 32px + `empty.message` (một câu đầy) + `empty.tabHint` ngay dưới. Không header, không nhóm, không chân panel. |
| `loading` | Các dòng khung xương cao 36px (`PROPERTY_INSPECTOR_LAYOUT.loadingSkeletonRowHeightPx`), không chữ. |
| `partial` | Đủ header + dải ảnh + các nhóm + chân panel; một số dòng mang `value.kind === 'mixed'` ("Giá trị khác nhau") hoặc `'unavailable'` (caption `partial.unavailable`) thay vì điều khiển bình thường. |
| `error` | Giống `success`, cộng: đúng một dòng (`erroredRowId`) mang `warning.level === 'blocking'`, hiện `error.message` NGAY TẠI DÒNG đó kèm nút `error.retry`; giá trị dòng đó đã quay về giá trị cũ. |
| `success` | Đủ header + dải ảnh + các nhóm + chân panel, không dòng nào mang cảnh báo `blocking`. |
| `forbidden` | Giống `success` về bố cục, nhưng mọi `PropertyRow.isLocked === true`, không viền quanh điều khiển (vẫn chọn/sao chép được), có `forbidden.message`. |
| `collapsed` | Dưới 1280px (`PROPERTY_INSPECTOR_LAYOUT.collapsedBreakpointPx`): thẻ phụ mang `collapsed.expandChip`. Trên di động: tấm trượt cao 60% (`collapsedSheetHeightPercent`) mang `collapsed.expandSheet` ở tay cầm. |

Khối luôn có mặt ở panel dù trạng thái nào (không đổi bố cục theo A11/CẤM TUYỆT ĐỐI số 3):
không có — bảy trạng thái ở đây có hình dạng dữ liệu khác nhau thật sự (xem docblock đầu
`propertyInspectorTypes.ts`), nên "khối cố định" duy nhất là **số đo** (chiều cao dòng 36px,
nhãn 40%/điều khiển 60%, dải ảnh 64px) chứ không phải một khối UI chung cho cả bảy.

---

## 3. Năm trường mặc định của từng loại đối tượng (P5)

`DEFAULT_VISIBLE_FIELD_COUNT = 5` — đúng năm trường hiện ra trước khi mở khối gập "Thông số
nâng cao", với mọi loại đối tượng. T6 (view) và T8 (test) đếm số dòng hiện ra ở mỗi
`PropertyGroup` khác `advanced` và đối chiếu với bảng này.

| Loại | Hằng số kiểu | Thứ tự 5 trường | Control | Khoá i18n |
|---|---|---|---|---|
| `wall` | `DEFAULT_WALL_FIELD_IDS` | 1. `thickness` | `segmented` (110/220/330, có ô màu) | `fields.wall.thickness` |
| | | 2. `length` | `numeric` | `fields.wall.length` |
| | | 3. `height` | `numeric` | `fields.wall.height` |
| | | 4. `wallType` | `select` (chịu lực/ngăn/bao che) | `fields.wall.wallType` |
| | | 5. `isInterior` | `toggle` | `fields.wall.isInterior` |
| `opening` | `DEFAULT_OPENING_FIELD_IDS` | 1. `width` | `numeric` | `fields.opening.width` |
| | | 2. `height` | `numeric` | `fields.opening.height` |
| | | 3. `sillHeight` | `numeric` | `fields.opening.sillHeight` |
| | | 4. `swingDirection` | `select` | `fields.opening.swingDirection` |
| | | 5. `hostWallId` | `link` | `fields.opening.hostWallId` |
| `furniture` | `DEFAULT_FURNITURE_FIELD_IDS` | 1. `boundingSize` | `text`/`numeric` | `fields.furniture.boundingSize` |
| | | 2. `rotation` | `numeric`/`slider` | `fields.furniture.rotation` |
| | | 3-5. tối đa 3 trường tuỳ hạng mục | tuỳ hạng mục | không có khoá cố định — hook chọn theo loại đồ đạc |
| `room` | `DEFAULT_ROOM_FIELD_IDS` | 1. `name` | `text` | `fields.room.name` |
| | | 2. `function` | `select` | `fields.room.function` |
| | | 3. `area` | `readonly` | `fields.room.area` |
| | | 4. `doorCount` | `readonly` | `fields.room.doorCount` |
| | | 5. `windowCount` | `readonly` | `fields.room.windowCount` |

Ghi chú riêng của tường: số ô mở (`fields.wall.openingCount`) **không** nằm trong năm trường
mặc định — nó thuộc nhóm "Quan hệ" (`relations`), đúng đặc tả gốc.

Bốn trường của khối gập "Thông số nâng cao" (`ADVANCED_FIELD_IDS`, giống nhau ở cả bốn
loại): `zOffset`, `startPoint`, `endPoint`, `sourceEntityId`, `confidence` — khoá
`fields.advanced.*`.
