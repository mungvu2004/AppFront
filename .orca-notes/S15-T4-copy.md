# S-15 T4 — Bảng đối chiếu chuỗi "Trục và gốc toạ độ"

| Khoá | Chuỗi tiếng Việt | Chỗ xuất hiện trên màn |
|---|---|---|
| `screen.breadcrumb` | Dự án > Trục và gốc toạ độ | Breadcrumb dẫn hướng |
| `screen.title` | quản lý trục và gốc toạ độ | Tiêu đề trang |
| `screen.description` | Kiểm tra các trục nằm trùng khớp giữa các tầng và điều chỉnh khoảng cách nếu cần. | Mô tả ngắn màn hình |
| `axisPanel.title` | Trục | Tiêu đề bảng trục bên trái |
| `axisPanel.groupHorizontal` | Trục ngang | Tiêu đề nhóm trục ngang |
| `axisPanel.groupVertical` | Trục dọc | Tiêu đề nhóm trục dọc |
| `axisPanel.addAxisButton` | Thêm trục | Nhãn nút thêm trục mới |
| `axisPanel.toggleVisibility.on` | Hiện trục {{code}} | Nhãn aria nút bật hiển thị trục |
| `axisPanel.toggleVisibility.off` | Ẩn trục {{code}} | Nhãn aria nút tắt hiển thị trục |
| `axisPanel.toggleShadow.on` | Hiện bóng ma tầng dưới | Nhãn aria nút bật bóng ma |
| `axisPanel.toggleShadow.off` | Ẩn bóng ma tầng dưới | Nhãn aria nút tắt bóng ma |
| `axisPanel.rowAriaLabel` | Trục {{code}}, cách trục kế là {{distance}} mm | Nhãn aria cho mỗi hàng trục |
| `originPanel.title` | Gốc toạ độ | Tiêu đề mục gốc toạ độ |
| `originPanel.selectLabel` | Chọn giao trục neo | Nhãn Select chọn giao trục |
| `originPanel.selectDescription` | Gốc toạ độ sẽ tính từ giao điểm trục này, khi di chuyển tầng để căn lên tầng gốc. | Mô tả chức năng của Select |
| `originPanel.selectPlaceholder` | A-1 | Giá trị mặc định của Select |
| `originPanel.offsetXPixels` | lệch X (pixel) | Nhãn FieldRow chỉ đọc — lệch X theo pixel |
| `originPanel.offsetYPixels` | lệch Y (pixel) | Nhãn FieldRow chỉ đọc — lệch Y theo pixel |
| `originPanel.offsetXMm` | lệch X (mm) | Nhãn FieldRow chỉ đọc — lệch X theo milimét |
| `originPanel.offsetYMm` | lệch Y (mm) | Nhãn FieldRow chỉ đọc — lệch Y theo milimét |
| `alignmentPanel.title` | Căn chỉnh giữa các tầng | Tiêu đề mục căn chỉnh |
| `alignmentPanel.autoAlignButton` | Căn chỉnh tự động | Nhãn nút căn chỉnh tự động |
| `alignmentPanel.statusWithinTolerance` | trong dung sai | Trạng thái — các trục trong dung sai |
| `alignmentPanel.statusNeedsAttention` | cần chú ý | Trạng thái — các trục ngoài dung sai |
| `alignmentPanel.statusCannotAlign` | không căn được | Trạng thái — không thể căn trục (nghĩa ngoại lệ A4) |
| `alignmentPanel.rootFloorLabel` | tầng gốc | Nhãn cho tầng mọi tầng khác căn theo |
| `alignmentPanel.rowAriaLabel` | {{floorName}}, lệch {{offset}} mm, {{status}} | Nhãn aria cho mỗi hàng tầng |
| `warning.title` | cảnh báo lệch quá ngưỡng | Tiêu đề dải cảnh báo |
| `warning.message` | Tầng {{floorName}} lệch {{offset}} mm so với tầng gốc, vượt quá 100 mm được phép. | Câu cảnh báo có chỗ chèn tên tầng và độ lệch |
| `warning.actionLabel` | Xem trên bản vẽ | Nhãn nút dẫn đến bản vẽ |
| `constraint.message` | không thể đặt {{axis1}} và {{axis2}} cách nhau dưới 100 mm — khoảng cách tối thiểu này giữ cho bước dò hai trục khác nhau phân biệt được. khoảng cách hiện tại: {{distance}} mm. | Câu chặn khoảng cách tối thiểu với ba chỗ chèn |
| `constraint.ariaLive` | không thể đặt {{axis1}} và {{axis2}} cách dưới 100 mm | Phiên bản ngắn dùng cho aria-live |
| `undoToast.message` | Đã căn chỉnh {{count}} tầng thành công. | Câu toast sau khi căn tự động |
| `undoToast.actionLabel` | Hoàn tác | Nhãn nút hoàn tác |
| `undoToast.confirmMessage` | Đã hoàn tác căn chỉnh. | Câu xác nhận sau khi đã hoàn tác |
| `states.empty.title` | chưa có trục nào | Tiêu đề trạng thái rỗng (A11 state 1) |
| `states.empty.description` | Bạn có thể vẽ trục thủ công từ bản vẽ, hoặc cho hệ thống suy ra trục từ hình học tường bao. | Mô tả trạng thái rỗng |
| `states.empty.actionDrawManual` | Vẽ trục thủ công | Nhãn nút vẽ thủ công |
| `states.empty.actionInfer` | Suy ra từ tường bao | Nhãn nút suy ra từ hình học |
| `states.loading.title` | đang tính trục | Tiêu đề trạng thái đang tải (A11 state 2) |
| `states.loading.description` | Hệ thống đang suy ra trục từ hình học tường bao. Đợi một lát… | Mô tả trạng thái đang tải |
| `states.partial.titleVerticalOnly` | chỉ có trục dọc | Tiêu đề khi chỉ có trục dọc (A11 state 3) |
| `states.partial.titleMissingFloors` | một số tầng chưa có trục | Tiêu đề khi một số tầng còn thiếu (A11 state 3) |
| `states.partial.descriptionMissingFloors` | {{floors}} chưa có trục. Bạn có thể vẽ thủ công hoặc suy ra từ tường bao. | Mô tả khi tầng còn thiếu, với chỗ chèn danh sách tầng |
| `states.error.title` | không tính được trục | Tiêu đề trạng thái lỗi (A11 state 4) |
| `states.error.description` | Hệ thống gặp lỗi khi xử lý hình học tường. Thử lại để chạy lại bước này. | Mô tả trạng thái lỗi |
| `states.error.actionLabel` | Thử lại | Nhãn nút thử lại |
| `states.done.title` | mọi tầng trong dung sai | Tiêu đề trạng thái xong (A11 state 5) |
| `states.done.description` | Mọi trục của các tầng đã được căn chỉnh và nằm trong dung sai cho phép. | Mô tả trạng thái xong |
| `states.done.badgeLabel` | đã duyệt | Nhãn badge trạng thái xong |
| `states.forbidden.title` | không có quyền sửa trục | Tiêu đề trạng thái không quyền (A11 state 6) |
| `states.forbidden.description` | Vai trò hiện tại chỉ được xem, không được chỉnh sửa các trục. Liên hệ quản trị dự án nếu cần. | Mô tả trạng thái không quyền |
| `states.collapsed.title` | bảng trục đang thu gọn | Tiêu đề trạng thái thu gọn (A11 state 7) |
| `states.collapsed.description` | Bung bảng để xem danh sách trục và căn chỉnh các tầng. | Mô tả trạng thái thu gọn |
| `canvas.ariaLabel` | Khung xem bản vẽ quản lý trục và gốc toạ độ | Nhãn aria canvas |
| `canvas.originLabel` | gốc toạ độ 0,0 | Nhãn cho gốc toạ độ trên canvas |
| `canvas.axisAriaLabel` | trục {{code}}, {{description}} | Nhãn aria cho một trục trên canvas |
| `canvas.shadowFloorAriaLabel` | bóng ma tầng {{floorName}} | Nhãn aria cho bóng ma tầng dưới |

## Ghi chú

- Tất cả chuỗi tiếng Việt viết thường, kiểu câu (A6)
- Không chữ hoa trừ: mã trục (A, B, C, 1, 2, 3), mã lỗi, tên phím (Enter, Esc, Shift)
- Đủ dấu tiếng Việt — không chữ mất dấu
- Đơn vị viết đúng: mm, px (không có khoảng trước đơn vị)
- Ba trạng thái căn chỉnh chính xác (A4): trong dung sai, cần chú ý, không căn được
- Dấu thập phân là dấu phẩy (A15): "100,5 mm", không "100.5 mm"
- Nhãn aria bắt buộc cho mọi nút không chữ (R-72, A12)
- Bảy trạng thái (A11): empty, loading, partial (hai biến thể), error, done, forbidden, collapsed
