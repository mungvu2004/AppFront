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
| `G2-R19-size` | A — tách React ra chunk riêng bằng `manualChunks`, không nới ngân sách | **chưa trả lời** | `mungvu2004/pascal-t51-vijson`, commit `a922118` |
| `G2-THREE (c)` | A — giữ khoá cờ `scene.soft-shadows`, thêm chú thích "hết tác dụng" | **chưa trả lời** | `mungvu2004/pascal-b2-three`, commit `df8b783`, chú thích sửa lại ở `3e8c4ca` |

> **Chuỗi chú thích của `G2-THREE (c)` cũng đã sửa, và bảng trên trích bản MỚI.** Bản đầu ghi
> "hết tác dụng từ **three r182**". Con số r182 **không truy được về tệp nào**: gói đã cài khai
> `@deprecated since **r186**` (`three/src/constants.js:73-75`), và hằng `PCFSoftShadowMap` **vẫn còn**
> — cái bị gỡ là **bộ lọc** (`WebGLShadowMap.js:99-104` cảnh báo rồi tự ép `PCFShadowMap`). Sáu chỗ
> trong mã và tài liệu nói "đã bị gỡ" đã sửa ở `3e8c4ca`, và mốc "r182" bị gỡ khỏi cả sáu thay vì đổi
> thành r186. **Quyết định A không đổi** — chỉ chữ mô tả nó đổi.

> **Hai băm ở bảng trên đã đổi một lần, và lý do đáng ghi lại.** Bản đầu trỏ `7add59d` và
> `66bbbc3` — hai băm **trước** khi hai nhánh được rebase lên master. Sau rebase chúng thành commit
> **mồ côi**: `git cat-file -e` vẫn nói "có", nên một phép kiểm hời sẽ báo xanh, nhưng
> `git branch --contains` trả về **rỗng** và chúng sẽ mất sau `gc`. Băm ở bảng nay là băm **đã push**,
> nên chúng ổn định. Bài học cho lần sau: trích băm trong tài liệu thì kiểm bằng
> `git branch -a --contains`, không bằng `cat-file`.

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

## Hồ sơ trình cổng (T4.1) — nơi đặt số

Số để trả lời ba câu trên nằm ở `F:/pascal-work/G3/T4.1-ho-so-cong.md` (đợt G3, 2026-09-26),
kèm nhật ký `F:/pascal-work/G3/nhat-ky.md` và output thô `F:/pascal-work/G3/raw/`.

Ba con số nên đọc trước khi chốt trần:

- **Đơn vị của cổng thứ năm lớn hơn con số 1 563,8 KiB mà mọi tài liệu đang nhắc 5,6 lần.**
  1 563,8 là `X_a` — chỉ JS của chunk màn. Tổng-thư-mục (quét đệ quy, cộng gzip mọi tệp) là
  **8 693,0 KiB** chưa cắt và **8 198,1 KiB** đã cắt. Chốt trần theo `X_a` rồi đo bằng
  tổng-thư-mục là chốt sai đơn vị.
- **Thư mục vách ngăn đo riêng: 2 170,4 KiB** mã (8 tệp), **≈ 1 727,6 KiB** sau nhát cắt C2,
  **cộng 5 398,2 KiB** tài sản Pascal phải chuyển vào cùng thư mục theo luật số 6 của T9.1 →
  **≈ 7 125,8 KiB**.
- **Ba con số đó đã gồm React và three trùng bản**, vì vách ngăn là một lượt dựng riêng
  (Q2 = B). Không trừ chúng ra rồi báo số nhỏ hơn.

Dưới mạng chậm (Slow 4G + CPU ×4), Pascal mở chậm hơn màn cũ **3,2 %** trước cắt và **5,3 %**
sau cắt — nhưng đó là số của **dự án thử**, và dung lượng **không** biểu hiện thành giây ở phép
đo này. Đừng dùng hai con số ấy để nới trần.

---

## Bản 3 — cổng T4.2 đã mở (2026-09-27)

Người dùng mở phiên bằng một câu: «hãy thực hiện triển khai theo kế hoạch trên chính nhánh này»
(kèm đường dẫn sổ tay bản 2.2). Câu đó **không** tự trả lời T4.2, nên cổng được hỏi trước khi thi
công, và dưới đây là nguyên lựa chọn người dùng đã chọn — không diễn giải.

| Mã | Nội dung câu hỏi | Chọn | Nguyên lời người dùng | Ngày |
|---|---|---|---|---|
| T4.2 (1) | Phạm vi Pascal: A xem + sửa · B chỉ xem · D dừng | **A** | «A — xem + sửa (khuyên)» | 2026-09-27 |
| T8.1 | Được thêm cổng nhập ESLint cho gói Pascal trong đợt này? | **được** | «Cổng nhập ESLint (T8.1)» | 2026-09-27 |
| T8.2 | Được sửa `CLAUDE.md` (câu react-three-fiber, ranh giới tầng)? | **được** | «Sửa CLAUDE.md (T8.2)» | 2026-09-27 |

**Hai câu còn lại của T4.2 vẫn TREO** (E.10 — không ghi thành quyết định thứ đã không được hỏi):

| Mã | Nội dung | Trạng thái | Cần khi nào |
|---|---|---|---|
| T4.2 (2) | Ba con số trần cho cổng thứ năm, theo đơn vị **tổng-thư-mục** (≈ 7 125,8 KiB sau C2) | **chưa hỏi** | T9.1 — lúc cài cổng, sau khi có fork |
| T4.2 (3) | lucide 8,2 KiB: để hai bản cùng chạy, hay nâng AppFront lên lucide 1.x | **chưa hỏi** | T5.4 — trước khi thêm gói Pascal |

Hai câu ấy chưa cần cho Bước 8, nên đợt này không hỏi. `G2-R19-size` và `G2-THREE (c)` vẫn để trống
ô "nguyên lời" như bảng bản 2 đã ghi.

### Cái người dùng biết khi chọn A

Phạm vi được chốt **sau** khi một đính chính được đặt lên bàn: điều kiện dừng duy nhất mà đợt G3 báo
là "CHẠM" — độ mượt 5/5 cặp — đo phải một **trần nhịp vẽ mặc định** của Pascal (`maxFps = 50`,
`@pascal-app/viewer/dist/components/viewer/index.js:229`), không phải một engine chậm. Chi tiết và
bốn dòng bằng chứng ở `01-ho-so-cong-T4.1.md` §11. Hệ quả cho hồ sơ cổng: phán quyết độ mượt đọc là
**"chưa đo được"**, và phép đo lại vẫn **chưa chạy**.

### Việc thi hành ngay sau cổng, trên nhánh `mungvu2004/tich-hop-pascal`

Bước 8 — bộ đổi dữ liệu ở `src/lib/pascal`, cộng T8.1 và T8.2. Bước 5 (thêm gói Pascal), Bước 6–7
(fork) và Bước 9 (màn xem) **chưa chạy được**: cả ba đứng sau một bản phát hành của fork mà quyền
tạo fork chưa được dùng tới trong đợt này.
