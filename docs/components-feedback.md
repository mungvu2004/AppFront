# Feedback Components

Tài liệu hướng dẫn sử dụng các component nhóm Feedback (trạng thái, tiến trình, thông báo).
Tuân thủ 15 nguyên tắc bất biến trong hệ thống.

## 1. Toast
Sử dụng qua Context / Provider `useToast()` hoặc hook `useUndoableToast` (tự động link store).
- Toast tự gộp lại nếu xuất hiện quá 3 thông báo trên màn hình.
- Có timer tự tắt sau 8s, tự động reset timer khi thêm mới toast hoặc hoàn tác.
- Group toast áp dụng thuật toán LIFO (Hoàn tác component mới nhất được add).

## 2. Skeleton
- Chỉ hỗ trợ đúng 4 preset cố định: `table-row`, `project-card`, `property-panel`, `canvas`.
- Tự động fallback dừng animation với `motion-reduce`.

## 3. EmptyState
- Bắt buộc chứa 1 icon chuẩn 32px, text-muted.
- Phải có tiêu đề (h3) và một câu giải thích rõ ràng + Call to Action (CTA).

## 4. InlineAlert
- Dùng để hiển thị thông báo ngay tại chỗ thay vì Modal chặn.
- Có 3 level: `verified`, `attention`, `violation`.

## 5. PipelineStepper
- Hiển thị quy trình 6 bước của hệ thống.
- Sử dụng trực tiếp danh sách bước cố định từ `src/store/pipelineSlice.ts`.
- Hỗ trợ hiển thị lỗi có mã lỗi và nút thử lại.

## 6. ProgressOverlay
- Component phủ (Overlay) thuần túy thông báo tiến độ % mà không chặn tác vụ ngầm.
- Cho phép người dùng chuyển quá trình sang chạy nền.

## 7. SaveIndicator
- Tự động đồng bộ với `spatial` object trong global store.
- Ba trạng thái rõ ràng: Pending -> Saving -> Saved.
- Không đếm số thay đổi, chỉ hiện thông báo trạng thái.

## QA Testing
Mở route `/design-system/states` (State Gallery) để view đầy đủ 14 biến thể Empty State và 8 biến thể Skeleton. Có công cụ DevStateSwitcher (chỉ hiển thị ở màn này) để QA đổi nhanh 7 trạng thái component tiêu chuẩn.
