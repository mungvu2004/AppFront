A. 15 BẤT BIẾN
1. Mọi màu, khoảng cách, bo góc, bóng, thời lượng đều lấy từ token. Không có ngoại lệ.
2. Chỉ một màu nhấn. Không thêm màu thương hiệu thứ hai.
3. Chỉ hai cấp viền: hairline và default.
4. Chỉ ba màu trạng thái: verified, attention, violation.
5. Xanh verified chỉ dùng cho việc người dùng đã duyệt, không dùng cho kết quả AI.
6. Nhãn nhóm viết thường kiểu câu. IN HOA chỉ cho mã trục và mã lỗi.
7. Không có nút "Lưu". Hệ thống tự lưu sau 800ms và hiển thị "Đã lưu lúc 14:32".
8. Mọi thao tác thay đổi dữ liệu đều hoàn tác được, qua toast 8s có nút "Hoàn tác".
9. Không dùng modal chặn trong lúc QC. Modal chỉ cho tạo mới, xoá, và xuất bản.
10. Không gọi trực tiếp set() của store trong component; mọi thay đổi đi qua commit(patch, label).
11. Mọi component có đúng bảy trạng thái được xử lý: rỗng, đang tải, một phần, lỗi, thành công, không có quyền, thu gọn.
12. Bàn phím dùng được 100%; luôn có focus ring 2px offset 2px; Esc luôn đóng lớp trên cùng.
13. Tương phản chữ ≥ 4,5:1; caption ≥ 3:1.
14. Mọi số liệu mẫu phải dùng bộ dữ liệu chuẩn 48/21/34/14/4 và 248,60 m².
15. Dấu thập phân là dấu phẩy; đơn vị mm cho tường, m cho cao độ, m² cho diện tích.

B. DANH SÁCH CẤM
- Cấm hex/rgb/hsl trong src/components và src/screens.
- Cấm gradient, glow, neon, đổ bóng màu, viền phát sáng.
- Cấm chữ IN HOA cho nhãn giao diện.
- Cấm khối màu đặc lớn hơn 120px mỗi chiều.
- Cấm thời lượng animation ngoài 120/180/260/340/700 ms.
- Cấm gọi set() store trực tiếp trong component.
- Cấm viết logic tính toán trong component; logic phải ở src/lib hoặc hook.
- Cấm thêm dependency mới mà không nêu lý do trong phần báo cáo.
- Cấm tạo component mới nếu đã có component chung phù hợp trong src/components.
- Cấm để lại chip/nút dành cho lập trình viên (ví dụ "Toggle Empty State") trên màn hình sản phẩm; công cụ đó chỉ nằm ở route /design-system/states.
- Cấm dùng tiếng Việt hoặc tiếng Việt không dấu cho tên biến, hàm, type, interface, enum, hằng, field, file test, mô tả test, mock, fixture, id kỹ thuật, action, hook, component, story; tất cả phải dùng tiếng Anh.

C. QUY ƯỚC ĐẶT TÊN
- Component: PascalCase, một component một file, export named.
- Hook logic: useTaskName, đặt cạnh component hoặc trong src/hooks nếu dùng chung.
- Hàm thuần: camelCase trong src/lib, không import React.
- Store slice: nameSlice.ts, action là động từ tiếng Anh ngắn.
- Test: cùng tên file kèm .test.ts(x); e2e trong e2e/.
- Story: ComponentName.stories.tsx, mỗi trạng thái một story.

D. KIẾN TRÚC TÁCH LOGIC VÀ GIAO DIỆN (bắt buộc)
- Mỗi component phức tạp gồm hai phần: hook useX chứa toàn bộ trạng thái và tính toán, và view nhận props thuần rồi chỉ render.
- View không được gọi store, không gọi API, không tính toán hình học.
- Hook không được chứa JSX, không import token, không biết về Tailwind.
- Nhờ vậy view test được bằng props, hook test được không cần DOM.

E. DEFINITION OF DONE — 10 điều, áp dụng cho mọi lượt sau
1. Không có hex/rgb/hsl trong src/components và src/screens.
2. Bảy trạng thái đều có story hoặc test.
3. Bàn phím 100%, focus ring đúng, Esc đóng lớp trên.
4. Tương phản ≥ 4,5:1 (caption ≥ 3:1).
5. Chuyển động chỉ dùng 5 mốc thời lượng, có prefers-reduced-motion.
6. Không gradient, không neon, không khối màu quá 120px, không nhãn IN HOA.
7. Dùng đúng bộ dữ liệu mẫu chuẩn.
8. Có ảnh chụp ở 1440px kèm trong phần báo cáo.
9. CI xanh: lint, typecheck, unit, build, visual snapshot.
10. Cấm báo cáo pass/thành công cho các lệnh kiểm tra (lint, typecheck, test, build...) nếu chưa thực sự chạy lệnh và có kết quả cuối cùng. Bắt buộc phải có log chứng minh.

F. CHECKLIST TỰ KIỂM TRƯỚC KHI TRẢ LỜI
Mỗi lượt, trước khi kết thúc, agent phải in ra bảng 10 dòng của mục E kèm đạt/không đạt và bằng chứng (lệnh đã chạy, số dòng grep).
