# FloorUploadScreen — Vietnamese Copy

## Reused Error Keys

The following existing error keys from `src/i18n/vi.json` are reused for per-file errors (HTTP 413 for file too large, HTTP 422 for file cannot be read):

- `errors.upload.title` → "Tải tệp chưa xong" (L-03 context: file too large)
- `errors.upload.description` → "Tệp tải lên chưa xong. Kiểm tra kết nối rồi thử lại với tệp khác nếu cần."
- `errors.validation.title` → "Dữ liệu chưa phù hợp" (L-03 context: file cannot be read)
- `errors.validation.description` → "Kiểm tra lại các trường được đánh dấu rồi thử lại."

## String Mapping

All strings are rendered in order of screen appearance. Placeholders are documented in the rightmost column.

| Key Path | Vietnamese String | Placeholder(s) |
|---|---|---|
| `floorUpload.breadcrumb.projects` | Dự án | — |
| `floorUpload.breadcrumb.upload` | Tải lên bản vẽ | — |
| `floorUpload.dropZone.title` | Kéo thả bản vẽ vào đây, hoặc chọn tệp | — |
| `floorUpload.dropZone.selectFile` | Chọn tệp | — |
| `floorUpload.dropZone.formats` | Định dạng hỗ trợ: {{formats}}. Kích thước tối đa: {{maxSize}}. | `{{formats}}`, `{{maxSize}}` |
| `floorUpload.floorCard.elevation` | cao độ | — |
| `floorUpload.floorCard.height` | chiều cao thông thuỷ | — |
| `floorUpload.floorCard.fileInfo` | {{fileName}} · {{fileSize}} · {{pageCount}} trang | `{{fileName}}`, `{{fileSize}}`, `{{pageCount}}` |
| `floorUpload.floorCard.reassignLabel` | Gán cho tầng khác | — |
| `floorUpload.floorCard.pagePickerLabel` | Chọn trang | — |
| `floorUpload.floorCard.menuButton` | Tùy chọn của tầng {{floorName}} | `{{floorName}}` |
| `floorUpload.status.waiting` | chờ xử lý | — |
| `floorUpload.status.uploading` | đang tải lên | — |
| `floorUpload.status.attached` | đã gắn kèm | — |
| `floorUpload.status.error` | lỗi | — |
| `floorUpload.cadPill` | Nhánh CAD · độ chính xác cao | — |
| `floorUpload.autoMatch` | Ghép tự động từ tên tệp — kiểm tra lại | — |
| `floorUpload.unassignedTray` | Tệp chưa gán tầng | — |
| `floorUpload.emptyState` | Chưa có tầng nào có bản vẽ. Kéo thả tệp đầu tiên để bắt đầu. | — |
| `floorUpload.offlineBanner` | Đang làm việc ngoại tuyến | — |
| `floorUpload.footer.counter` | {{done}} / {{total}} tầng đã có bản vẽ | `{{done}}`, `{{total}}` |
| `floorUpload.footer.submit` | Bắt đầu xử lý | — |
| `floorUpload.blockedSubmit.title` | Không thể bắt đầu xử lý | — |
| `floorUpload.blockedSubmit.missingFile` | Tầng {{floorName}} chưa có bản vẽ. | `{{floorName}}` |
| `floorUpload.blockedSubmit.missingElevation` | Tầng {{floorName}} chưa nhập cao độ. | `{{floorName}}` |
| `floorUpload.blockedSubmit.duplicateElevation` | Hai tầng {{floor1}} và {{floor2}} có cùng cao độ {{elevation}}. | `{{floor1}}`, `{{floor2}}`, `{{elevation}}` |
| `floorUpload.blockedSubmit.uploading` | Tầng {{floorName}} đang tải lên bản vẽ. | `{{floorName}}` |
| `floorUpload.removeAction.aria` | Xoá bản vẽ {{fileName}} | `{{fileName}}` |
| `floorUpload.removeAction.undo` | Đã xoá bản vẽ {{fileName}} | `{{fileName}}` |
| `floorUpload.readOnlyNotice` | Vai hiện tại chỉ được xem danh sách tệp, không tải lên và không sửa. | — |
| `floorUpload.aria.uploadProgress` | Đã tải {{percent}}% của {{total}} | `{{percent}}`, `{{total}}` |
| `floorUpload.aria.uploadComplete` | Tải xong {{fileName}} | `{{fileName}}` |

## Deviations from Spec (Rule A6 Applied)

- **`floorUpload.status.*` labels**: Spec provided uppercase first letters; changed to **lowercase sentence case** per invariant A6. Example: "Waiting" → "chờ xử lý"
- **`floorUpload.floorCard.elevation` and `floorUpload.floorCard.height`**: Spec context is labels, not standalone translations. Kept **lowercase** per A6 (these are field labels used inline).
- **`floorUpload.unassignedTray`**: Spec said "unassigned tray"; rendered as **lowercase noun phrase** per A6 for a card/section heading context.

All Vietnamese strings include full diacritics and comply with `expectVietnamese()` checks.
