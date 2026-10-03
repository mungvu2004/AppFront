# Soát đóng đợt G3 — còn lại gì, và mỗi việc chặn bởi cái gì

2026-09-27. Đối chiếu **71 mã việc** của sổ tay (`T1.0 … T11.5`) cộng 4 việc không mã.
Luật: không có bằng chứng thì ghi **"không biết"** — nhãn đó hợp lệ và cần hơn một phỏng đoán.

---

## 0. Đếm theo nhãn

| Nhãn | Số việc |
|---|---|
| **XONG** | **23** |
| **CHỜ NGƯỜI DÙNG** | **41** |
| **CHỜ THỨ NGOÀI TẦM** | **6** |
| **LÀM ĐƯỢC NGAY** | **1** |

Sổ tay **không** cấp mã riêng cho Bước 10; Bước 11 đánh số theo 5 điểm của kế hoạch
(`ke-hoach-ghep-pascal-ban-2.md:356-363`). Nói rõ để không ai đi tìm `T10.1`.

---

## 1. "Hoàn thành" của đợt này = năm việc. Bốn đã xong.

| # | Việc | Trạng thái |
|---|---|---|
| 1 | PR cho T5.0 (`verify` đọc được) | **XONG** — [#4](https://github.com/mungvu2004/AppFront/pull/4) |
| 2 | PR cho T5.1 + T5.2 (React 19 + cắt `vi.json`) | **XONG** — [#6](https://github.com/mungvu2004/AppFront/pull/6) |
| 3 | PR cho T5.3 (three 0.186), **kèm số cây hợp lực** | **XONG** — [#7](https://github.com/mungvu2004/AppFront/pull/7) |
| 4 | Bỏ nhánh `viewer-fixture-lazy`, ghi lý do | **XONG** — commit `1d7dccd`, phán quyết "KHÔNG khuyên gộp" nằm trong chính thân commit |
| 5 | **Gộp ba PR** | **CHỜ NGƯỜI DÙNG** — việc của người duyệt, chưa được phép |

Sau năm việc đó, **mọi thứ còn lại đứng sau một câu của người dùng hoặc một thứ ngoài tầm cả
hai**. Đó là "hết việc thật" của đợt. Nó **không** phải "xong Pascal" — Pascal còn 38–74 ngày
công và chưa ai được phép bắt đầu.

---

## 2. Con số đáng đọc nhất của cả đợt: **cây hợp lực**

Bốn nhánh chưa bao giờ nằm cùng một cây, nên không ai cộng trừ được trên giấy. Nay đã đo:
nhánh `mungvu2004/pascal-hop-luc` (đã push) = master `299ff15` + 8 commit cherry-pick theo thứ tự
**#4 → #6 → #7**. `pnpm install --frozen-lockfile` **EXIT=0**.

| Cây | Cổng "chi phí thêm cho một màn" | Dư |
|---|---|---|
| master | 264,2 | 15,8 |
| + React 19 + cắt `vi.json` | 264,6 | 15,4 |
| + three 0.186 (riêng) | 279,2 | 0,8 |
| **cả bốn cùng một cây** | **279,6** | **0,4** |

Bốn cổng trên cây hợp lực: màn đầu **137,4/175** · chunk lớn nhất **154,1/170** ·
route **279,6/280** · CSS **10,9/12** → **4/4**.

**`pnpm verify` 7/7, mã thoát 0, ở tải CPU 50,4 %** — cao nhất mọi lượt của đợt. Điều đó trả lời
câu để ngỏ: **7 tệp hỏng của nhánh three biến mất khi có PR #4.**

**Con số phải mang tới cổng quyết định là 0,4 KiB**, không phải 0,8 và không phải 15,4.

Thô: `A-HL-hop-luc.txt` · `A-HL-size-chi-tiet.txt` · `A-X2-bang-route-hop-luc.txt`.

---

## 3. Ba câu phán đoán

### 3a. Việc đã làm mà **không nên** làm

**Một, đã xác nhận bằng số:** nhát cắt fixture nhà mẫu (`viewer-fixture-lazy`). Cổng route
264,2 → **263,0** (−1,2) nhưng **tổng JS 1 068,0 → 1 068,2** (+0,2, **xấu đi**). Lời khuyên của
cổng là *"đưa fixture ra khỏi gói sản phẩm"*; nhát cắt chỉ **dời** nó sang chunk nạp muộn, mà
chunk nạp muộn vẫn ở trong gói. Giá: 11 tệp, +259/−75, một cạnh nhập đảo chiều, một tham số mặc
định bị gỡ, và **một thay đổi hành vi thật ở chế độ dev**. Để mua 1,2 KiB ở cổng đang dư 15,8.

**Hai, về thứ tự:** PR #6 gói T5.1 **lên trên** T5.2. Kế hoạch đòi T5.1 đi **trước** như một PR
riêng. Không sai về số, nhưng nó lấy mất đường lùi — gộp được nhát cắt mà chưa gộp React thì
không còn.

### 3b. Việc bỏ sót, lẽ ra phải làm trước

**`verify` của nhánh three được đo trên cây KHÔNG có PR #4.** Tức đo một khuyết tật đã có lời
chữa, trên cây cố ý không có lời chữa. Thứ tự đúng của sổ tay — T5.0 → T5.1 → T5.2 → T5.3 — bị
đảo ở đây. **Đã sửa** bằng cây hợp lực (§2).

### 3c. "Đạt khi" của từng Bước

| Bước | Phán quyết |
|---|---|
| **1** | **ĐẠT — nhưng chỉ nhờ cây hợp lực.** Trước đó 7/7 và 4/4 đo trên **hai cây khác nhau**; chưa cây nào đạt cả hai. Cây hợp lực đạt **cả hai cùng lúc** |
| **2** | **Không thể đạt trọn mà không có người dùng.** Hai điều kiện không chạm; điều kiện thứ ba **chạm ở CPU/giây 5/5** còn độ mượt **0/5**. Luật nào giữ = Câu 2 |
| **3** | **ĐẠT TRỌN** — Bước duy nhất không kèm chữ "nhưng" |
| **4** | **Không thể đạt mà không có người dùng.** T4.1 đạt; T4.2 là ba câu; T4.3 ~15 phút sau đó |
| **5–11** | **Không thể đạt trọn mà không có người dùng**: T4.2 + mười chỗ HỎI + hai quyền bị cấm (thêm dependency, tạo fork) |

---

## 4. Một câu mở ra bao nhiêu việc

| # | Câu | Việc mở ra |
|---|---|---|
| **1** | **T4.2 — phạm vi A/B/D** | **45**. Nếu **D** thì 44 trong số đó **biến mất** thay vì mở ra. Dù thế nào nó cũng là câu duy nhất giải quyết 45 dòng |
| 1b | *(trong T4.2)* ba con số trần | 1 riêng — T9.1. Phải trích theo **tổng-thư-mục** (≈7 125,8 KiB sau C2), **không** theo X_a 1 563,8: lệch **5,6 lần** |
| 1c | *(trong T4.2)* lucide | 1 riêng — T5.4 |
| **2** | **Gộp ba PR** | **3** — và nó là điều kiện để mọi cổng sau đọc được |
| 3 | `G2-R19-size` | 1 — không mở việc mới, nhưng gộp #6 khi ô trống là áp A thay người dùng |
| 4 | `G2-THREE (c)` | 1 — y như trên, cho #7 |
| 5 | Câu 2 — ngưỡng độ mượt | **0 trực tiếp**, nhưng là **dữ kiện của câu mở 45 việc**. Chốt phạm vi trước khi biết điều kiện dừng là thật hay là hằng số `maxFps = 50` là chốt trên một con số chưa biết nghĩa |
| 6 | Câu 3 — ảnh chuẩn linux | 0 bây giờ, 2 sau khi gỡ khoá thanh toán. **Câu trả lời một mình không đủ** |
| 7 | Câu 4 — CSP | 0 — **đã bị việc làm trả lời trước**: đo 4 → 0 (trên trang spike; màn thật đo lại 2026-10-03 ra **1** — `01-ho-so-cong-T4.1.md` §8e). Thiếu một câu xác nhận hồi tố |
| 8 | Câu 5 — thi công T5.1 | 0 — y như trên: phương án **B đã thi hành** (PR #6) mà chưa có câu |
| 9 | Câu 6 — đồng bộ sổ tay | 0 — **đã xong**, sổ tay nay bản **2.4** |
| 10 | Câu 7 — `T2.7 sau T2.5` | 0 — chỉ ảnh hưởng thứ tự đợt sau |

**Đọc theo một câu:** trong mười câu treo, **một** mở 45 việc và **một** mở 3; **hai** chỉ cần
điền ô; **ba** đã bị việc làm trả lời trước mà chưa ai xác nhận; **ba** mở 0 việc.

---

## 5. Sáu việc CHỜ THỨ NGOÀI TẦM

| Việc | Chờ gì |
|---|---|
| PR #5 — cổng visual | **GitHub gỡ khoá thanh toán.** Cả năm job mỗi lượt chết 2–3 giây, `steps=0`, từ 18/08/2026. Mục đích PR cần CI **chạy** |
| Hai ảnh chuẩn linux | y như trên. Nợ này có **trước** Pascal |
| T9.8 | **F-04a**, đợt W10 |
| T11.1–T11.5 | **F-14**, đợt W14 |

Cảnh báo GitHub tự đưa: nhãn `ubuntu-latest` chuyển **Ubuntu 26 từ 19/10/2026** → ảnh chuẩn sinh
trước mốc có thể phải sinh lại.

---

## 6. Chỗ ghi "không biết"

| # | Không biết | Vì sao |
|---|---|---|
| 1 | Danh tính **sáu** trong bảy tệp hỏng của nhánh three | Log chỉ in một bài. Cây hợp lực cho thấy cả bảy **biến mất** khi có PR #4, nhưng không nói chúng **là** tệp nào |
| 2 | PR #4 có **cần** hay không | Một lượt đầy đủ trên cây **chưa sửa** đạt 341/341 ở tải 35,1 %. Cơ chế đứng; tính *cần* thì chưa có A/B tinh khiết |
| 3 | 145,3 KiB `draco_decoder-*.js` có bao giờ được tải lúc chạy | three 0.186 phát nó qua `new URL(...)`; `assets.ts:130-133` vẫn `setDecoderPath('/draco/')`, nên nó **có thể** là trọng lượng chết trong `dist` |
| 4 | 4 vi phạm CSP có giữ được 0 trên cảnh có `loadScene` | T3.7 đo bản `mount()` **tối giản** |
| 5 | Nâng AppFront lên lucide 1.x có hỏng gì | Chỉ có phép đối chiếu **tên icon**, chưa có lượt dựng |
| 6 | `T2.7 sau T2.5` là ràng buộc thật hay chữ dư | Hai bản sổ tay ghi khác nhau, **không tệp thô nào** giải thích |
| 7 | Bao giờ GitHub gỡ khoá thanh toán | Ngoài tầm cả hai |

---

## 7. Hai con số tôi đã báo sai cho người dùng, nay có tệp thô

| Tôi nói | Đúng là | Thô |
|---|---|---|
| "26 trong 59 đích không phải route" | **30 trong 63** (63 đích, 33 suy được route) | `A-X2-bang-route-master.txt` |
| "vực 78 KiB" | **77,9** — đích #6 `216,5` → đích #11 `138,6` | cùng tệp |
| "nhánh three hỏng **một** tệp" | **7 tệp / 8 test** — log chỉ in một | `A-X1-three-verify.txt:31-32` |
| "cổng route tốt lên 14,6 nhờ cắt `vi.json`" | **264,5 → 264,6**, xấu 0,1. 279,2 là của **nhánh three** | đã đính chính lên PR #6 |
| "`collect` 450,82 → 273,78 chứng minh nhát sửa" | Hai lượt ở hai trạng thái máy. Một cây **chưa sửa** cho 256,79 | đã đính chính lên PR #4 |

Cả năm cùng một khuôn: **ghép hai số từ hai cây (hoặc hai lượt) thành một cặp trước/sau.**
Luật từ đây: một cặp "trước → sau" chỉ được viết khi **cùng một cây, cùng một lượt**; khác thì
viết **hai dòng riêng**, không viết mũi tên.

---

## 8. Nhát gỡ draco — **đã thi công, đã đo, rồi hoàn nguyên theo yêu cầu**

Người dùng chốt 2026-09-27: *"mục tiêu là tích hợp và kết hợp xong, đã conf những thứ khác tất cả
để sau."* Nên nhát này **không vào PR nào**; số ghi lại để đợt sau khỏi đo lại.

Plugin Vite `enforce: 'pre'` chặn năm `new URL('../libs/draco/…', import.meta.url)` ở
`three/examples/jsm/loaders/DRACOLoader.js:17-23`. Kiểm regex bằng chính Node: khớp **5/5**, sau khi
thay còn **0**.

Đo trên nhánh `mungvu2004/pascal-b2-three` (thô: `A-DRACO-*.txt`):

| | Trước | Sau |
|---|---|---|
| **tổng JS mọi chunk** | 1 251,6 | **1 083,4** (−168,2) |
| asset draco trong `dist/assets` | 5 | **1** — chỉ còn chính chunk `DRACOLoader`, hợp lệ |
| cảnh báo của plugin | — | **0** (regex còn khớp) |
| `typecheck` · `lint` · `build` · `size` | — | **0 · 0 · 0 · 4/4** |
| màn đầu · chunk lớn nhất · route · CSS | — | 163,6 · 163,6 · **279,2** · 10,9 |

Con số **−168,2** khớp đúng dự đoán của lượt đọc mã (ba tệp `.js` = 145,3 + 11,5 + 11,4 = 168,2).
Hai `.wasm` (148,3 KiB) cũng rời `dist` nhưng cổng không đếm chúng (`check-bundle-size.mjs:143` chỉ
lọc `.js`/`.css`), nên khoản đó không hiện trong bảng trên.

**Và nó gỡ một rủi ro cổng cứng**: trước nhát này `draco_decoder-*.js` **145,3 KiB là chunk lớn thứ
hai**, nằm trong phép `Math.max` phẳng của `largestJsChunk` (`:334`), dưới trần 170 đúng 24,7 KiB —
cho một tệp không bao giờ được tải.

**Khoản cùng loại trên master, CHƯA làm:** `dist/draco/draco_decoder.js` = **104,7 KiB gzip / 500,5
KiB thô**, cũng chỉ nạp ở nhánh `useJS` (không WebAssembly). Bỏ một mục khỏi regex `WANTED` trong
`scripts/copy-draco.mjs` là gỡ nó khỏi mọi lần deploy. **Có một cái mất đi**: trình duyệt không có
WebAssembly sẽ mất đường dự phòng giải mã Draco. Đó là quyết định của người duyệt, không phải của
người đang dọn rác.

Đường thứ ba đã lắp sẵn chưa nổ: `KTX2Loader.js:106-107` cũng có `new URL` cho
`basis_transcoder.wasm`/`.js`. Nó chưa phát asset vì module không trong đồ thị (manifest 0 lần chữ
`KTX2`). **Ngày nào có ai gọi `setKTX2Loader`, gói nhận thêm hai tệp theo đúng cơ chế này.**
