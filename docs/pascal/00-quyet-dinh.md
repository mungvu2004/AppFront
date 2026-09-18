# Quyết định trước khi ghép Pascal (G0)

Câu hỏi lấy từ "Lộ trình ghép Pascal" bản 1.1 (17/09/2026), mục "6 câu cần trả lời trước khi
bắt đầu", và "Sổ tay ghép Pascal" bản 1 (18/09/2026), bước B0.1.
Hỏi trên AppFront master `7dccb44`. Người điều phối chép nguyên lời người dùng, không diễn giải.

Người dùng trả lời bằng hộp chọn của người điều phối. Các đoạn nguyên lời trong hai bảng dưới là
chữ của lựa chọn mà người dùng đã chọn, hoặc chữ mô tả của lựa chọn đó như người dùng đã thấy.

## Đã chốt trước B0.1 (2026-09-18)

- Bộ prompt backend (`docs/backend`) không commit vào repo này; nó ở lại thư mục AppBack, ngoài
  repo. Nguyên lời: theo ghi chép của người điều phối, Pha 0.
- Thư mục `docs/pascal/` chỉ chứa file này. Nguyên lời: theo ghi chép của người điều phối, Pha 0.
- Lựa chọn "chỉ lưu ở máy": file này được commit vào master của máy, không push, không mở PR.
  Nguyên lời: theo ghi chép của người điều phối, sau Pha 1.

## 6 đáp án

| Câu | Nội dung câu hỏi | Chọn | Nguyên lời người dùng | Ngày |
|---|---|---|---|---|
| 1 | Cho phép tạo fork Pascal công khai? (nửa `docs/backend` đã chốt ở trên) | Có (nửa fork) | «Theo hết khuyên dùng» · «1 fork có» | 2026-09-18 |
| 2 | Đợt đầu thay những màn nào? | A | «Theo hết khuyên dùng» · «2A (chỉ màn 3D chính)» | 2026-09-18 |
| 3 | Kéo góc tường thì tường nối có đi theo? | A | «Theo hết khuyên dùng» · «3A (đi theo, mất dấu xác minh)» | 2026-09-18 |
| 4 | Bật màn mới thế nào? | A | «Theo hết khuyên dùng» · «4A (bật/tắt từ máy chủ theo vai)» | 2026-09-18 |
| 5 | Màn 3D mới nặng tối đa bao nhiêu? | B | «Theo hết khuyên dùng» · «5B (trần riêng cho màn này)» | 2026-09-18 |
| 6 | Chặn sửa sai làm kẹt công cụ Pascal thì sao? (chỉ áp dụng khi B3.7 thấy kẹt) | A | «Theo hết khuyên dùng» · «6A (thả tay rồi đưa về chỗ cũ)» | 2026-09-18 |

## 3 trần dung lượng (KiB sau gzip)

| Con số | Trần người dùng chọn | Nguyên lời | Ngày | Số tham chiếu lúc hỏi |
|---|---|---|---|---|
| (a) JS của màn editor | «JS 280» | «Giữ trần hiện có» | 2026-09-18 | trần chung 280; màn 3D cũ 258,4 |
| (b) Chunk JS lớn nhất | «chunk 170» | «Giữ trần hiện có» | 2026-09-18 | trần 170; hiện 159,8 (chunk vào) |
| (c) CSS của Pascal | «CSS Pascal 1,1 (phần còn dư)» | «Giữ trần hiện có» | 2026-09-18 | tổng CSS 10,9 / 12, còn dư 1,1 |

Số tham chiếu đo bằng `pnpm build && pnpm size` trên master `7dccb44` ngày 2026-09-18, mã thoát 0.
Trần trên sẽ được cài thành cổng riêng ở B6.1.
