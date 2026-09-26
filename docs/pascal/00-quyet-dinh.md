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

---

## Bản 2 — 4 đáp án (2026-09-26)

Hỏi sau khi người dùng đọc `F:/pascal-work/ke-hoach-ghep-pascal-ban-2.md` (bản 2). Chép nguyên
lựa chọn, không diễn giải. Nguồn: mục 0 của chính kế hoạch bản 2.

| Mã | Nội dung câu hỏi | Chọn | Nguyên lời người dùng | Ngày |
|---|---|---|---|---|
| Q1 | Mở cổng đi/dừng bằng số bản chưa cắt (ngày 1) hay chờ bản đã cắt (ngày 5)? | B | «B — ngày 5, sau bảng cắt gọt» | 2026-09-26 |
| Q2 | Màn Pascal dựng chung gói hay dựng riêng? | B | «B — dựng riêng + cổng thứ năm» | 2026-09-26 |
| Q3 | Đo độ mượt trước cổng hay sau? | A | «A — sửa cho công bằng rồi đo ngay» | 2026-09-26 |
| Q4 | Ảnh chuẩn cảnh 3D trên CI Linux? | A | «A — thêm đúng một ảnh» | 2026-09-26 |

Hệ quả đã ghi vào kế hoạch:

- **Q1 = B** → chỉ còn **một** cổng quyết định, ở Bước 4. Chi phí tới cổng: 3,5–4 ngày.
- **Q2 = B** → đích là **`public/assets/pascal/` kèm `publicDir: false`**, không phải `dist/pascal`;
  lượt dựng thứ hai nối vào chính `pnpm build` và chạy trước lượt chính; kèm **cổng thứ năm**
  (quét đệ quy, tổng gzip, ném lỗi khi thiếu thư mục) và một dòng khai ở chính file này — dùng
  vách ngăn mà không khai là lách cổng (E.10). Giá phải trả: React và three **trùng bản**, vì
  import map nội tuyến bị CSP chặn.
- **Q3 = A** → mục b và c nằm trong Bước 2, trước cổng; giữ nguyên p95 ≤ 33,3 ms làm điều kiện dừng.
- **Q4 = A** → Bước 9 có **đúng một** ảnh chuẩn linux của màn Pascal, tắt hiệu ứng hậu kỳ, không
  đụng `viewer3d.spec.ts`.

## Hai câu G2 — đã áp phương án A, **chưa có nguyên lời người dùng**

E.10: hai ô "nguyên lời" dưới đây để trống vì người dùng **chưa trả lời**. Mã trên nhánh đã làm
theo phương án A từ trước, theo khuyến nghị của kế hoạch — ghi lại đúng như vậy, không ghi thành
quyết định của người dùng.

| Mã | Chọn (đã áp trong mã) | Nguyên lời người dùng | Chỗ làm |
|---|---|---|---|
| `G2-R19-size` | A — tách React ra chunk riêng bằng `manualChunks`, không nới ngân sách | **chưa trả lời** | `mungvu2004/pascal-b2-react19`, commit `7add59d` |
| `G2-THREE (c)` | A — giữ khoá cờ `scene.soft-shadows`, thêm chú thích "hết tác dụng từ three r182" | **chưa trả lời** | `mungvu2004/pascal-b2-three`, commit `66bbbc3` |

Câu chờ người dùng: `F:/pascal-work/hoi/T1.1-hai-dap-an-G2.md`. Câu gốc:
`F:/pascal-work/hoi/G2-R19-size.md`, `F:/pascal-work/hoi/G2-THREE.md`.

Câu `H10b` **không còn cần trả lời**: Q3 = A đổi cách đo, nên luật "máy ≤ 10 % CPU" không còn là
điều kiện chặn.

## Ba câu còn lại, hỏi ở Bước 4 (T4.2)

Cả ba chỉ trả lời được khi có số, nên chúng nằm ở cổng chứ không hỏi bây giờ:

1. **Phạm vi** — A (xem + sửa), B (chỉ xem), hay D (dừng hướng Pascal).
2. **Ba con số trần cho cổng thứ năm** — KiB JS, KiB CSS, KiB `.wasm`. Trích **theo đơn vị
   tổng-thư-mục** (cổng thứ năm quét đệ quy và cộng gzip cả thư mục), và ghi rõ nó **đã gồm** phần
   React + three trùng bản.
3. **lucide 8,2 KiB** — để hai bản cùng chạy, hay nâng AppFront lên lucide 1.x.
