# Quyết định và bằng chứng

Tệp này có hai nửa, và nửa đầu là **kết luận**.

**Nửa đầu — QUYẾT ĐỊNH.** 24 câu đã chốt, mỗi câu ghi chọn gì · vì sao · đổi cái gì trong
`plan.md` và `coverage-map.md`. Ba quyết định đánh dấu **↺** là chỗ tôi **đổi ý** so với
lượt trước, vì đi kiểm thêm và dữ kiện mới lật chúng.

**Nửa sau — BẰNG CHỨNG.** 22 câu đầy đủ, mỗi câu kèm **số đã đo** và hai phương án A/B.
Đọc nửa này khi muốn kiểm lại một quyết định, hoặc khi bạn muốn chọn khác. Không câu nào ở
đây có dữ kiện quyết định còn ghi "chưa đo" — chỗ chưa đo nằm riêng ở mục
"cần đo trước khi hỏi", và chúng **không** chặn Chặng 0.

Sau đó là phần **hai vai đối nghịch** (hai vòng) và **phụ lục** câu hỏi cấp nhóm.

Ranh giới giữ suốt: quyết định về **kế hoạch test** thì đã chốt và đã áp vào `plan.md`;
quyết định là **thay đổi sản phẩm** thì chỉ chốt *khuyến nghị* và ghi ra — mục 7.2 của kế
hoạch cấm sửa mã sản phẩm để bài xanh. Bảy việc sản phẩm nằm ở cuối phần QUYẾT ĐỊNH.

Kế hoạch: `plan.md` · bảng hở: `coverage-map.md` · điều phối: `dag.md`.

---

# QUYẾT ĐỊNH — 24 câu, đã chốt

Người dùng yêu cầu tự tranh luận rồi chọn. Phần này là **kết luận**; phần dưới (Q1…Q13 và
"Hai vai đối nghịch") là **bằng chứng** dẫn tới nó. Mỗi quyết định ghi: chọn gì · vì sao ·
**đổi cái gì** trong `plan.md` / `coverage-map.md`.

Ba quyết định **đổi khác** khuyến nghị tôi viết ở lượt trước, vì lượt này đi kiểm thêm và
dữ kiện mới lật chúng: **Q6**, **Q10g**, **Q11**. Chúng được đánh dấu **↺**.

Ranh giới tôi giữ suốt: quyết định về **kế hoạch test** thì tôi chốt và áp luôn; quyết định
là **thay đổi sản phẩm** thì tôi chốt *khuyến nghị* và ghi ra, **không tự sửa mã** — mục 7.2
của kế hoạch cấm đúng việc đó.

---

## Bảng chốt nhanh

| Câu | Chọn | Một dòng |
|---|---|---|
| **Q1** | **A′** | Dùng cửa bơm kho, nhưng mỗi màn QC kèm **một ca mồi** không bơm — ca ấy đỏ đúng lúc sản phẩm có đường nạp thật |
| **Q2** | **A, sắc hơn** | Ghi thành nợ. Nợ thật không phải "không có tự lưu" mà "engine chạy, không ai nói ra" |
| **Q3** | **A** | Khẳng định thứ tự **phạm vi** như đo được; đổi sang thứ tự thấy-được là thay đổi sản phẩm, không phải việc của bài kiểm |
| **Q4** | **B** | Không khẳng định con số nào trên màn Pascal; gộp hai bộ mẫu là việc riêng |
| **Q5** | **B, cộng một việc sửa tài liệu** | Không viết ca CSP khi chưa có chính sách thật; nhưng dòng "CSP 4 → 0" **phải sửa** — số đúng là 1 |
| **Q6** ↺ | **C — không phải A cũng không phải B** | Màn **không có nguồn dữ liệu nào**; thiếu `:floorId` chỉ là vấn đề thứ hai |
| **Q7** | **B′** | Lỗi diễn đạt, không phải lỗi dữ liệu. Một ca khẳng định `empty` trung thực |
| **Q8** | **A** | Lỗi hiển thị thật — gốc là `code: storey.id`, mọi dữ liệu đều lộ, không riêng bộ mẫu |
| **Q9** | **A** | Sinh tệp bằng `Buffer`; chỉ commit tệp thật nếu có ca cần nội dung bản vẽ thật |
| **Q10** | **A** | Giữ trong bảng kèm lý do và điều kiện mở cổng; không bỏ khỏi phạm vi |
| **Q10b** | **B** | `ConnectionStates` ghi `chưa phủ` + lý do; không viết mục 13 trường cho thứ không ai dựng |
| **Q10c** | **A** | `navigate(-1)` mù phải thành một đích xác định; ca kiểm rẻ và chắc |
| **Q10d** | **A** | Sửa chuỗi, đừng mọc nút lưu. Kiểm ở **tầng đơn vị**, không phải e2e |
| **Q10e** | **A** | Đăng ký `TOOL_SHORTCUTS`; ca kiểm tự tổng quát hoá |
| **Q10f** | **B cho kế hoạch, A là việc riêng** | Kế hoạch không khẳng định "viết thường kiểu câu" khi chưa có nơi phát ngôn và chưa có hàm khẳng định |
| **Q10g** ↺ | **A′** | Kiểm bằng `goto`, **cộng** một ca `test.fixme` cho liên kết còn thiếu — không phải ca đỏ thường trực |
| **Q10h** | **A cho A6, B cho A8/A9** | Chữ tiếng Việt lấp ở tầng đơn vị; xoá/đổi tên dự án đi qua store + toast + render lại nên thuộc e2e |
| **Q10i** | **A, cộng B** | Thêm thẻ icon (một dòng, chữa gốc) **và** giữ bộ lọc ở một chỗ cho những 404 nhiễu chưa ai gặp |
| **Q10j** | **A** | Ghi vào tài liệu — **đã làm**, docblock `run-playwright.mjs` |
| **Q11** ↺ | **Giữ, KHÔNG dựng cổng riêng** | `scripts/` có **12** tệp `.mjs`, **không tệp nào** được lint. Bắt riêng một tệp theo luật mười một tệp kia không theo là bất nhất |
| **Q12** | **Trước Chặng 0** | Một cổng CI đỏ vì lý do đã biết dạy cả nhóm bỏ qua màu đỏ |
| **Q13** *(mới)* | **Phát hiện, không phải ca** | `useAutosave` khoá cứng vào slice `spatial`, nên năm màn tự lưu đúng mà `Ctrl+S` không với tới |
| **QA/B-1** | **B, dưới dạng `test.fixme`** | Ca tồn tại, đọc được, tự bật xanh khi ai đó chữa — thứ một mục tài liệu không làm được |
| **QA/B-2** | **A7 = `đơn vị` · A8 = `chưa phủ` · HistoryPanel A7 = `chưa phủ`** | Không ca riêng; thêm **một khẳng định** vào `V7-ROOMS-03` |
| **QA/B-3** | **Bài sinh từ dữ liệu** | Một bảng `[màn, chuỗi mong đợi]`, bảy `test()` sinh ra — cùng hình dạng đã giải xong Chặng 1 |

---

## Phần tranh luận — những câu không hiển nhiên

Mười lăm câu còn lại chọn đúng như bảng và đúng lý do đã viết ở phần bằng chứng bên dưới;
chín câu dưới đây là chỗ tôi phải cân, hoặc phải đổi ý.

### Q1 — keystone, và cả hai phương án ban đầu đều thiếu một thứ

**Bên A (dùng cửa):** bảy màn QC, ~34 ca. Không có cửa thì A7 · A8 · A12 · A15 của **cả
tầng QC** không chứng minh được ở e2e. Và cửa ấy chạy thật trong CI, vì CI cũng dùng máy
chủ dev của Vite.

**Bên B (không dùng):** một bài kiểm đi qua cửa người dùng không có thì chứng minh sai thứ —
nó nói "màn duyệt tường chạy được" trong khi đường thật của người dùng vẫn rỗng. Tệ hơn: nó
**che đúng cái khiếm khuyết** mà e2e đáng ra phải phơi ra. Và nó buộc bộ test vào một đường
nội bộ (`/src/store/index.ts`), thứ vỡ ngay khi kho dời chỗ.

**Câu hỏi quyết định, mà cả hai bên đều không hỏi: *khi sản phẩm được chữa thì bộ test nói gì?***

- Bên B: **không gì cả.** Tầng QC vẫn không được phủ, và không ai biết nó đã chữa.
- Bên A: **không gì cả.** Ca bơm vẫn xanh, và cái nạng lặng lẽ thành vĩnh viễn.

Cả hai đều không tự sửa được. Nên chọn **A′**:

1. Dùng cửa, qua **một** fixture tên `seedSpatial`, docblock nói thẳng nó chạm vào nội bộ
   dev và vì sao.
2. **Tên bài** của mọi ca bơm phải nói ra rằng nó bơm.
3. **Mỗi màn QC thêm một "ca mồi" KHÔNG bơm**, khẳng định đúng chuỗi người dùng thấy hôm
   nay (`empty`/skeleton). Ngày sản phẩm có đường nạp thật, **ca mồi đỏ** — và tên nó nói
   người đọc hãy xoá `seedSpatial`.

A′ là phương án duy nhất **tự nhắc mình gỡ cái nạng**. Giá phải trả: bảy ca mồi. Rẻ.

Thêm một lợi ích không tính trước: ca bơm **bơm sau khi đã tới màn** (`goto` → bơm → khẳng
định), nên nó không cần điều hướng trong ứng dụng — và mục "chưa đo" *"kho có sống sót qua
điều hướng nội bộ không"* **thôi chặn**. Một quyết định làm biến mất một phép đo còn thiếu.

### Q2 — nợ thật không phải nợ tôi tưởng

Lượt trước tôi viết "không cờ `persist*` nào bật ⇒ A7 không kiểm được". Lượt này truy sâu
hơn: `rooms` và `thickness` **có** dựng engine tự lưu thật (`useRoomLabelReview.ts:602`,
`useThicknessStandardization.ts:534`). Engine chạy, 800 ms chạy, lưu chạy — **chỉ là không
có gì nói ra**, vì chúng không đi qua `useSaveIndicator`/`SaveIndicator`.

Nên nợ đúng tên là: **"tự lưu chạy nhưng câm"**, không phải "không có tự lưu". Khác nhau ở
chỗ chữa: cái sau cần dựng cơ chế, cái trước chỉ cần nối một chỉ báo.

Giữ **A** (ghi thành nợ, không viết ca giả vờ), nhưng câu ghi phải là câu đúng.

### Q5 — chia làm hai, vì hai nửa có giá khác hẳn nhau

Không viết ca CSP: **đúng**, vì chính sách thật không có trong repo, và một ca dựng trên
chính sách tự bịa thì đo một sản phẩm khác.

Nhưng dòng *"CSP 4 → 0"* trong `docs/pascal/` **đang nói một điều không còn đúng** — nhát vá
`jitless` ở `src/vach-ngan.tsx` đã không còn trong cây, và đo thật ra **1** vi phạm
(`script-src | eval | pascalMount-*.js`). Ai đọc dòng ấy sẽ tưởng chỗ đó xong.

Hai nửa tách được, nên tách: **hoãn ca, sửa tài liệu ngay.** Một dòng sai trong tài liệu
không đắt hơn một dòng sai trong mã, nó chỉ chậm lộ hơn.

### Q6 ↺ — đổi ý, vì cả hai phương án cũ đều chữa sai chỗ

Lượt trước tôi chọn B ("màn tự chọn tầng"). Lượt này đọc
`versionHistoryGateway.ts` và thấy:

```ts
/** Câu nói ra khi chưa nơi nào bơm danh sách phiên bản vào màn. */
export const NO_VERSION_SOURCE_REASON =
  'chưa có nguồn dữ liệu phiên bản nào được nối vào màn này';
```

**Màn không có nguồn dữ liệu nào.** Nên kể cả khi route mang `:floorId`, và kể cả khi màn
tự chọn tầng, nó vẫn không có gì để liệt kê. A và B đều chữa **vấn đề thứ hai** trong khi
vấn đề thứ nhất còn nguyên.

⇒ **C:** kế hoạch ghi `projectVersions` là `empty` **trung thực** (nó tự nói ra lý do), có
đúng một ca khẳng định điều đó, **không** có ca luồng. Hai việc sản phẩm xếp đúng thứ tự:
(1) nối một nguồn dữ liệu; (2) *rồi mới* bàn route mang `:floorId` hay màn tự chọn tầng.
Bàn (2) trước (1) là bàn màu sơn của một căn phòng chưa xây.

Đây là chỗ đáng ghi lại về cách làm: **tôi đã suýt trả lời một câu hỏi đặt sai.** Hai phương
án nghe hợp lý, tôi có khuyến nghị, và chỉ vì lượt này đi đọc thêm một tệp mới thấy cả hai
đều lạc. Câu hỏi có hai phương án nghe hợp lý **không** bảo đảm một trong hai đúng.

### Q10g ↺ — đổi ý nhờ một quyết định khác

Lượt trước tôi chọn A "kèm điều kiện bạn chấp nhận một ca đỏ có chủ đích", và tự thấy gợn.

Sau khi chốt **QA/B-1 = `test.fixme` kèm lý do và điều kiện mở lại**, chỗ gợn biến mất: ca
"phải có đường vào từ vỏ 3D" viết được ngay, dưới dạng `fixme`, và nó **tự bật xanh** ngày
ai đó thêm liên kết. Không ai phải sống với một bộ test đỏ thường trực, và cái lỗ không bị
quên.

⇒ **A′.** Bài học: một quyết định có thể mở khoá một quyết định khác, nên đừng chốt từng
câu độc lập rồi cộng lại.

### Q10i — chọn cả hai, và đó không phải nước đôi

`index.html` không có thẻ icon ⇒ mọi trang xin `/favicon.ico` và nhận 404. Ba worker độc
lập gặp nó và đoán **ba nguồn khác nhau**; chỉ CDP Network mới truy ra (bộ nghe `response`
của Playwright **không** thấy).

Thêm thẻ icon (A) chữa gốc. Nhưng bộ lọc (B) vẫn nên có: nó không phải để chữa favicon, nó
là lưới cho những 404 nhiễu **chưa ai gặp** — và lượt này đã chứng minh loại nhiễu ấy tốn
một buổi chiều để truy. Hai việc khác mục đích, nên làm cả hai không phải là không quyết.

### Q11 ↺ — đổi ý, vì một phép đếm

Lượt trước tôi viết: *"Giữ, nhưng kèm điều kiện: thêm nó vào `pnpm lint`… Một script không
cổng nào bảo vệ sẽ mục."* Lượt này đếm: `scripts/` có **12** tệp `.mjs`, và
`eslint . --ext ts,tsx` **không đọc tệp nào trong số đó** — kể cả `verify.mjs`,
`check-bundle-size.mjs`, `check-file-length.mjs`, tức chính ba tệp dựng nên cổng tổng.

Lập luận cũ của tôi vẫn đúng ở phần "sẽ mục". Nó sai ở phần **phạm vi**: nếu mười hai tệp
chịu lực đều không được lint, thì bắt riêng tệp thứ mười ba theo một luật không tệp nào theo
là bất nhất, và nó giấu vấn đề thật đi sau một ngoại lệ.

⇒ **Giữ `probe-survey.mjs` đúng như mười một tệp kia.** Và ghi ra vấn đề thật thành một
dòng: *12 tệp `.mjs` chịu lực trong `scripts/` không cổng nào đọc* — đó là câu đáng hỏi,
không phải câu về một tệp.

### QA/B-1 — chỗ hai vai lệch xa nhất, và một hình dạng thứ ba giải được

Vai cắt: một ca đỏ thường trực làm giảm tin cậy của **mọi** ca xanh. Đúng.
Vai bịt lỗ: bỏ bốn ca ấy thì **ba lỗ nghiêm trọng nhất không ai chứng minh**. Cũng đúng.

Vai cắt tự nói ra cái giá của phương án mình, nguyên văn: *"khi đó ba lỗ nghiêm trọng nhất
không có ca nào chứng minh, và tôi nói thẳng đó là cái giá."*

Hình dạng thứ ba: **`test.fixme` kèm lý do và điều kiện mở lại.** Kế hoạch cấm `test.skip`
*không* có hai thứ đó — có thì được, và cấm ấy tồn tại chính vì hình dạng này.

Nó lấy được cả hai: CI không đỏ (vai cắt hài lòng), ca tồn tại và đọc được và **tự bật
xanh** đúng lúc ai đó chữa (vai bịt lỗ hài lòng). Một mục PHÁT HIỆN trong tài liệu không
làm được vế sau — tài liệu không biết khi nào nó hết đúng.

Áp cho: bốn ca của QA/B-1, cộng `W-3` (toast tường lộ mã máy — cả hai vai đã đồng ý), cộng
ca liên kết còn thiếu của Q10g.

### QA/B-3 — cùng một hình dạng đã giải xong Chặng 1

Vai cắt muốn một ca `forbidden` dùng chung; vai bịt lỗ muốn bảy ca vì mỗi màn tự khai một
câu giải thích **khác nhau**.

Nhưng bảy ca khác nhau ở đúng **một chuỗi chữ** là định nghĩa của một bài sinh từ dữ liệu:
một bảng `[màn, chuỗi mong đợi]`, một vòng `for` sinh bảy lời gọi `test()`. Vai cắt được một
khuôn mã để bảo trì; vai bịt lỗ được bảy kết quả độc lập, chạy song song, mỗi cái nói rõ màn
nào vỡ.

Đây **lần thứ hai** trong lượt này một tranh chấp "một ca hay N ca" tan ra khi tách
**đơn vị bảo trì** khỏi **số lời gọi `test()`**. Lần đầu là Chặng 1. Đủ hai lần để thành
một quy ước của kế hoạch — xem mục dưới.

---

## Hai quy ước rút ra, áp cho cả kế hoạch

### 1. Đếm hai con số, đừng đếm một

Suốt hai vòng, vai cắt và vai bịt lỗ cãi nhau bằng **cùng một con số** mang hai nghĩa khác
nhau. Tách ra thì phần lớn tranh chấp biến mất:

| Con số | Nghĩa | Ai quan tâm |
|---|---|---|
| **Đơn vị bảo trì** | bao nhiêu khuôn mã một người phải đọc và sửa | vai cắt |
| **Lời gọi `test()`** | bao nhiêu kết quả độc lập CI báo về | vai bịt lỗ |

Một bài sinh từ dữ liệu cho **1** đơn vị bảo trì và **N** lời gọi `test()`. Hai bên cùng
thắng, và không mất bằng chứng nào — đó là lý do cả Chặng 1 lẫn QA/B-3 đều giải được.

`plan.md` từ đây ghi **cả hai** con số cho mỗi nhóm.

### 2. Ca ghi nhận khiếm khuyết đi bằng `test.fixme`, không bằng một dòng tài liệu

Điều kiện đủ: **lý do** và **điều kiện mở lại**, cả hai viết trong chính bài. Thiếu một
trong hai thì nó là `test.skip` trá hình và kế hoạch cấm.

Vì sao hơn một mục PHÁT HIỆN: tài liệu không biết khi nào nó hết đúng; một bài `fixme` thì
biết — nó xanh lên.

---

## Ước lượng lại số ca sau khi chốt

Lấy con số **53** của vai cắt sau vòng 2 làm gốc (nó đã gồm việc gộp Chặng 1), rồi cộng trừ
theo các quyết định trên:

| Thay đổi | Đơn vị bảo trì |
|---|---|
| Gốc — vai cắt, sau vòng 2 | 53 |
| Chặng 1 tách làm hai lưới (35 route + 13 màn không route) thay vì một | +1 |
| QA/B-3 — bảy ca vai `viewer` thành **một** lưới sinh từ dữ liệu | +1 |
| **Q1 = A′** — bảy ca mồi không bơm | +7 |
| Q10g = A′ — một ca `fixme` cho liên kết còn thiếu | +1 |
| `B-DIM-A7`, `B-GRID-KBD` — nhận, vì Q1 = A′ làm dữ liệu có thật | +2 |
| `B-RA-RENAME` — gộp thành một khẳng định trong `V7-ROOMS-03` | 0 |
| **Tổng** | **~65 đơn vị bảo trì** |

Quy ra lời gọi `test()`: ~65 − 3 lưới + (35 + 13 + 7) = **~117 lời gọi `test()`**.

So với **173** của bản lắp ghép đầu. Phần lớn chỗ cắt đến từ đúng một quyết định — **lưới
sinh từ dữ liệu thay cho 48 mục viết tay** — và quyết định ấy không mất bằng chứng nào.

Hai chỗ con số này còn mềm, nói thẳng: vai cắt ghi **ba** chỗ nó cắt **có điều kiện**, dựa
vào nội dung bài đơn vị nó **chưa đọc**; nếu đọc ra bài ấy không khẳng định điều kế hoạch
nói thì ba ca được khôi phục. Và bảy ca mồi của Q1 chưa ai viết thử nên chưa biết có màn nào
cần hai ca thay vì một.

---

## Việc sản phẩm — tôi khuyến nghị, KHÔNG tự sửa

Bảy việc dưới đây là thay đổi mã hoặc tài liệu sản phẩm. Kế hoạch mục 7.2 cấm tôi sửa mã để
bài xanh, nên tôi ghi ra kèm chủ và mức. **Không việc nào chặn Chặng 0.**

| # | Việc | Ở đâu | Mức |
|---|---|---|---|
| 1 | `Escape` ở `/thong-bao` gọi `navigate(-1)` mù ⇒ ra `about:blank` | màn thông báo | **cao** — một màn trắng do phím gây ra |
| 2 | Thêm `<link rel="icon">` | `index.html` | **cao** — một dòng, xoá một bộ lọc mọi bài sau phải nhớ |
| 3 | `vi.json:70` bảo "lưu lại thủ công" khi không có nút lưu | `src/i18n/vi.json` | trung bình |
| 4 | Đăng ký `TOOL_SHORTCUTS` vào sổ phím (`R·H·C·V` hiện không tồn tại lúc chạy) | tầng công cụ | trung bình |
| 5 | Nhãn tầng hiện `storey.id` (`L-01FIXTURE0`) | `ViewerStoreyRail.tsx:78` | trung bình |
| 6 | `ProjectDashboard` đọc khoá trạng thái **tiếng Anh** cho trình đọc màn hình | `ProjectDashboard.tsx:343` | trung bình |
| 7 | Sửa dòng "CSP 4 → 0" — số đúng là **1** | `docs/pascal/` | thấp, nhưng rẻ |

Hai việc lớn hơn, cần bạn quyết chứ không chỉ sửa:

- **Bảy màn QC đọc vòng tròn** (`read: () => useStore.getState().spatial`). Đây là gốc của
  Q1, Q2 và phần lớn ô `chưa phủ`. Chữa nó thì bảy ca mồi của Q1 đỏ lên — đúng như thiết kế.
- **`useAutosave` khoá cứng vào slice `spatial`** (Q13), nên năm màn tự lưu đúng mà `Ctrl+S`
  không với tới. Ba trong năm có lý do đã ghi; `rooms` và `thickness` thì **không** — hai
  màn ấy *có* `spatial` nên dùng được hook, mà lại không dùng.

---

# Bằng chứng — 22 câu, mỗi câu kèm số đã đo và hai phương án

Phần trên đã chốt. Phần này là thứ dẫn tới chốt ấy; đọc khi muốn kiểm lại một quyết định.

## Q1 — Bảy màn QC: dùng cửa `import('/src/store/index.ts')` của dev server, hay chờ đường thật?

**Đã đo.** Năm màn QC treo skeleton mãi: `walls` 61 · `grids` 24 · `floors` 17 ·
`dimensions` 16 · `objects` 16. Nguyên nhân: mọi chỗ gọi `setSpatial` nạp từ một cổng mà
bản thật là `read: () => useStore.getState().spatial` — đọc lại chính cái kho đang rỗng.

**Có một cửa, và nó chạy.** Trong trang đang mở, `await import('/src/store/index.ts')` trả
về **cùng một bản module** ứng dụng đang dùng (Vite dev phục vụ module ES theo URL). Gọi
`setSpatial(<bộ mẫu riêng của màn>, null)` thì cả bốn màn rời skeleton **ngay**:

| Màn | skeleton trước | sau khi tiêm | Hiện gì |
|---|---|---|---|
| `walls` | 61 | **0** | `12/48 tường đã duyệt`, 48 `role="option"` |
| `objects` | 16 | **0** | `9/21 đối tượng đã duyệt`, 5 `option` |
| `dimensions` | 16 | **0** | chuỗi thật `900 mm`…`9.225 mm`, 9 `option` |
| `grids` | 24 | **0** | trục A/B/C/D + 1/2/3/4, `4.000 mm`, `5.000 mm`, 8 `option` |

Hai điều kiện đã đo kèm theo:

1. **`:floorId` của URL phải là mã `Level` của đồ thị**, không phải chuỗi `L1`
   (`WallLayerReview.container.tsx:260`). Đo: `/floors/L1/layers/walls` ra
   "0/0 tường … Chưa có đoạn tường nào"; `/floors/L-000001LVL0/layers/walls` ra 12/48.
   `grids` dùng `L-AXISFLOOR1`. `objects` và `dimensions` không lọc theo tầng nên `L1` vẫn ra.
2. **Chỉ có ở bản dev.** `import('/src/…')` không tồn tại trong bản dựng production.
   `scripts/run-playwright.mjs` chạy `vite` dev nên e2e hiện có đi qua được. `page.goto`
   tải lại trang ⇒ store về `null`, nên phải tiêm **sau** khi tải và điều hướng **trong**
   ứng dụng.

| | Phương án |
|---|---|
| **A** | Dùng cửa ấy trong fixture, và **ghi thẳng vào docblock của fixture** rằng nó chạm vào nội bộ, chỉ sống được trên máy chủ dev, và nó là cái giá của việc kiểm bảy màn QC ở tầng e2e. |
| **B** | Không dùng. Bảy màn QC chỉ có ca `loading` ở tầng e2e; phần còn lại do 278 bài đơn vị của chúng chứng minh. Mở cổng khi sản phẩm có đường nạp thật. |

**Khuyến nghị: B, với một ngoại lệ hẹp.** Một bài kiểm tích hợp đi qua cửa mà người dùng
không có là một bài kiểm chứng minh sai thứ: nó nói "màn duyệt tường chạy được" trong khi
đường thật của người dùng vẫn rỗng. Ngoại lệ hẹp: **một** bài dùng cửa ấy để khoá lại bất
biến A12/A15 trên dữ liệu thật (thứ chỉ trình duyệt chứng minh được), đặt tên nói rõ nó
tiêm dữ liệu — và bảy màn vẫn xếp sau trong `plan.md` kèm điều kiện mở cổng.

---

## Q2 — A7 không kiểm được ở cả tầng QC: ghi thành nợ, hay chữa trước?

**Đã đo.** Không cờ `persist*` nào bật:

| Màn | Cờ | file:dòng |
|---|---|---|
| `walls` | `persistWallLayer: false` | `wallLayerReviewFixture.ts` |
| `rooms` | không bật | `roomLabelReviewGateway.ts:445` |
| `floors` | không bật | `floorManagerGateway.ts:1257` |
| `thickness` | không bật | `thicknessStandardizationGateway.ts:221` |

Và bốn vùng `role="status"` của `projectThickness` — thứ trông như bốn chỗ có thể nói
"đã lưu" — thật ra là **bốn thẻ đếm** (`ThicknessSummary.tsx:54`), không phải vùng tự lưu.

A7 có hai nửa. Nửa đầu ("không có nút lưu") **đã chứng minh cho cả 35 màn**: 0 nút mang chữ
"lưu". Nửa sau ("tự lưu 800 ms, và **nói ra** trạng thái đó cho trình đọc màn hình") thì ở
tầng QC **không có chỗ nào nói ra** — nên không có gì để khẳng định.

| | Phương án |
|---|---|
| **A** | Kế hoạch ghi A7-nửa-sau là **`chưa phủ`** cho bảy màn QC, kèm lý do đã đo. Không viết ca nào. Đây là một lỗ được ghi nhận, không phải một lỗ bị che. |
| **B** | Coi đây là lỗi sản phẩm phải chữa trước: bật `persist*` hoặc gắn `useSaveIndicator` cho tầng QC, rồi mới viết ca. |

**Khuyến nghị: A** cho lượt này, và đưa B thành một việc riêng có người chủ. Lý do: kế hoạch
test không phải chỗ quyết định sản phẩm nên tự lưu ở đâu. Nhưng **phải** ghi ra, vì A7 là
một trong bảy bất biến và "không kiểm được" khác hẳn "đã đạt".

Tham chiếu: `projectSettings` **có** tự lưu và đo được **~851 ms** — khớp hằng 800 ms của
`useAutosave`. Nên ca A7 đầy đủ tồn tại được, chỉ là không ở tầng QC.

---

## Q3 — Ca `Escape` xếp lớp khẳng định thứ tự PHẠM VI hay thứ tự THẤY ĐƯỢC?

**Đã đo, 8 kịch bản trên vỏ 3D**, mỗi kịch bản một context sạch, `Escape` từng cái một,
350 ms giữa hai lượt.

Kết quả: thứ tự đóng là **theo phạm vi trước, theo thời điểm đăng ký sau (LIFO)** —
**không** theo lớp nào *nhìn thấy* nằm trên. `SCOPE_PRIORITY`
(`lib/input/shortcutRegistry.ts:59`) đặt `dialog` → `sidePanel` → `canvas` → `global`.

Hệ quả cụ thể: khi lớp phủ **sửa hình học tường** đang mở (nhìn thấy nằm trên cùng, phủ
khung nhìn) **và** một bảng phụ ở cột phải cũng đang mở, thì `Escape` đầu tiên đóng **bảng
phụ**, không đóng lớp phủ. Đó **không phải lỗi mã** —
`viewerShellShortcuts.ts:28-34` và `Viewer3DPanels.tsx:32-37` giải thích là cố ý.

| | Phương án |
|---|---|
| **A** | Ca kiểm khẳng định **thứ tự phạm vi như đo được**, và tên bài nói thẳng điều đó ("Esc đóng theo phạm vi, không theo lớp thấy được"). Xanh hôm nay. |
| **B** | Ca kiểm khẳng định **thứ tự thấy được** (lớp phủ trên cùng đóng trước). **Đỏ hôm nay**, và đòi sửa sản phẩm. |

**Khuyến nghị: A.** A12 hứa "Esc đóng lớp trên cùng"; nếu "trên cùng" nghĩa là phạm vi cao
nhất thì lời hứa đứng vững. Nhưng người dùng không đọc phạm vi — nên nếu bạn muốn lời hứa
ấy đúng theo nghĩa người dùng đọc, thì đó là một thay đổi sản phẩm, và nó phải là quyết
định của bạn chứ không phải hệ quả phụ của một bài kiểm.

---

## Q4 — Hai bộ mẫu không gian, hai bộ số. Bộ nào là chuẩn?

**Đã đo.** Màn Pascal in ra bốn con số, và chúng đến từ `graph.walls.length` đếm thẳng
(`usePascalViewer.ts:366-373`) trên `VIEWER_FIXTURE_GRAPH`
(`ViewerShell/viewerShellFixture.ts:286,308`), **không** từ bộ đổi dữ liệu
`src/lib/pascal/toPascal.ts` (bộ đổi này đổi trung thực từng tường và từng ô mở).

| | `VIEWER_FIXTURE_GRAPH` | `createSampleBuilding()` (A14) |
|---|---|---|
| tầng | 4 | 4 |
| tường | **16** (4 tầng × 4 tường bao) | **48** |
| ô mở | **0** (`openings: []`) | **16** (9 cửa + 7 cửa sổ) |
| phòng | 14 | 14 |

Và A14 đã có sẵn một chỗ lệch thứ hai, đã ghi trong `CLAUDE.md`: `SAMPLE_TOTAL_AREA_M2`
khai **248,60 m²** nhưng đo bằng chính `totalArea()` trên 14 đường bao thật ra
**238,00 m²** — và `CLAUDE.md` nói rõ **chưa chốt cái nào là chuẩn**.

| | Phương án |
|---|---|
| **A** | Chốt `createSampleBuilding()` là bộ mẫu chuẩn duy nhất; `VIEWER_FIXTURE_GRAPH` đổi để khớp, hoặc đổi tên thành thứ gì nói rõ nó là bộ mẫu **hình học tối giản của vỏ**, không phải bộ mẫu nghiệp vụ. |
| **B** | Giữ hai bộ, và kế hoạch test **không** khẳng định con số nào cho màn Pascal — chỉ khẳng định "có bốn con số, và chúng khớp với đồ thị đang nạp". |

**Khuyến nghị: B cho lượt này, A là việc riêng.** Một ca kiểm khẳng định "48 tường" trên màn
Pascal sẽ đỏ, và nó đỏ vì hai bộ mẫu khác nhau — không vì màn sai. Nhưng hai bộ mẫu cùng
tồn tại là một cái bẫy dài hạn, và người sửa fixture cần biết lệch ở đâu.

---

## Q5 — "CSP 4 → 0" trong `docs/pascal/` không còn đúng. Ghi lại số mới, hay chữa?

**Đã đo.** Nhát vá cũ nằm ở `src/vach-ngan.tsx:30`
(`window.__zod_globalConfig = { jitless: true }`). **Tệp đó không còn trong cây**, và
`grep -rn jitless src vite.pascal.config.ts vendor/pascal/shims` ra **0** kết quả — gói dựng
chỉ còn *đọc* `jitless`, không ai *đặt* nó.

Chèn một CSP bằng `page.route` rồi đếm `securitypolicyviolation`: **1 vi phạm** —
`script-src | eval | …/assets/pascal/pascalMount-*.js`. Cảnh vẫn dựng, nên **không ai thấy**.

Hạn chế của phép đo, đã ghi: CSP dùng để đo là tự dựng (chính sách thật ở `B0-08.md:119`
không có trong repo) và có `'unsafe-inline'` vì dev server cần — nhưng vi phạm `eval` không
phụ thuộc hai điểm ấy.

| | Phương án |
|---|---|
| **A** | Sửa tài liệu thành con số đúng (**1**, không 0), và thêm một ca e2e đếm `securitypolicyviolation` để nó không âm thầm tăng lại. Ca ấy cần chính sách CSP thật — mà chính sách ấy chưa có trong repo. |
| **B** | Ghi thành nợ có mã, không thêm ca nào, cho tới khi chính sách CSP thật được đưa vào repo. |

**Khuyến nghị: B trước, A sau khi có chính sách.** Một ca CSP dựng bằng chính sách tự bịa sẽ
đo một sản phẩm khác. Nhưng dòng "CSP 4 → 0" trong tài liệu **phải sửa ngay** — nó đang nói
một điều không còn đúng, và ai đọc nó sẽ tưởng chỗ ấy đã xong.

---

## Q6 — `projectVersions` không mở được vì route thiếu `:floorId`

**Đã đo.** `/projects/project-1/versions` cho ra:

> "Không xác định được bản vẽ / Đường dẫn thiếu mã dự án hoặc chưa có tầng nào đang mở, nên
> không biết phải hiện lịch sử phiên bản của bản vẽ nào."

Thân 140 ký tự, 0 nút, 0 `h1`. Nhưng route **có** `:projectId`. Màn cần thêm `floorId` mà
route không mang.

| | Phương án |
|---|---|
| **A** | Route nhận thêm `:floorId`: `/projects/:projectId/floors/:floorId/versions`. Đường cũ chuyển hướng hoặc hiện chỗ chọn tầng. |
| **B** | Màn tự chọn tầng khi đường dẫn không nói: hiện danh sách tầng, người dùng chọn, rồi mới hiện lịch sử. |

**Khuyến nghị: B.** Một đường dẫn chia sẻ được cho người khác thì nên mở được — đổi route
biến mọi liên kết cũ thành liên kết chết. Và màn đã có sẵn nhánh nói ra vấn đề, nên nó chỉ
thiếu chỗ chọn. Trong cả hai trường hợp, **kế hoạch lượt này ghi màn ấy là `empty` và không
có ca luồng chính** — đó là hiện trạng.

---

## Q7 — `projectRuleSettings` tự nói hai câu trái nhau

**Đã đo.** Cùng một lượt tải, màn hiện đồng thời:

> "cài đặt bộ luật không gian · **23/25 luật đang bật** · Chưa có thay đổi"

và

> "**chưa có bộ luật để cài đặt** · Chưa có luật không gian nào được nạp cho dự án này."

Một màn không thể vừa có 25 luật vừa không có luật nào. Hai con số đến từ hai nguồn.

| | Phương án |
|---|---|
| **A** | Lỗi sản phẩm: một trong hai nguồn phải thắng, và màn chỉ được hiện một câu. Chữa trước, rồi viết ca. |
| **B** | Kế hoạch ghi đây là trạng thái `partial` có chủ ý (đếm từ danh mục luật tĩnh, danh sách từ dữ liệu dự án rỗng) và viết ca khẳng định **cả hai** câu cùng hiện. |

**Đã đọc mã (V12), và nó chốt được một nửa.** Hai con số đến từ hai nguồn khác nhau, đúng
như giả thuyết ở phương án B:

- **"23/25 luật đang bật"** đọc từ **sổ luật của hệ thống** (danh mục tĩnh).
- **"chưa có bộ luật để cài đặt"** hiện vì **`graph === null`** — dự án chưa nạp đồ thị
  không gian nào.

Nên màn **không tự mâu thuẫn về dữ kiện**: nó nói "hệ thống có 25 luật, 23 đang bật" và
"dự án này chưa có gì để áp luật lên". Hai câu đúng.

⇒ **Khuyến nghị đổi thành B', một biến thể của B:** không phải lỗi dữ liệu, mà là **lỗi
diễn đạt**. Hai câu ở cạnh nhau, cùng cỡ chữ, không nói ra rằng chúng nói về hai phạm vi
khác nhau, nên người đọc thấy chúng phủ định nhau. Sửa là việc của chữ, không phải của mã:
câu thứ hai cần nói rõ "dự án **này** chưa có bản vẽ nào để áp luật".

Ca kiểm tương ứng: khẳng định **cả hai** câu cùng hiện (đó là trạng thái `empty` trung
thực), và đó là một ca rẻ. Nhưng câu hỏi "hai câu ấy có làm người dùng hiểu sai không" là
câu của bạn, không phải của bài kiểm.

---

## Q8 — Nhãn `L-01FIXTURE0` lọt chuỗi bộ mẫu ra màn sản phẩm

**Đã đo.** Nút chọn tầng trên vỏ 3D (vai `viewer`) mang nhãn `L-01FIXTURE0`,
`L-02FIXTURE0`, `L-03FIXTURE0`, `L-04FIXTURE0`.

`FIXTURE0` là chuỗi của bộ mẫu nằm trong nhãn người dùng đọc. Mục B của `CLAUDE.md`:
"Điều khiển dành cho lập trình viên không xuất hiện trên màn sản phẩm".

| | Phương án |
|---|---|
| **A** | Lỗi hiển thị: nhãn phải là tên tầng ("Tầng trệt", "Tầng 02"…), mã bộ mẫu không được lộ. Chữa, rồi ca A6 khẳng định nhãn không chứa chuỗi in hoa lạ. |
| **B** | Chỉ xảy ra với bộ mẫu, dữ liệu thật không có `FIXTURE0` ⇒ không phải lỗi sản phẩm, chỉ là bộ mẫu đặt mã xấu. Sửa bộ mẫu. |

**Gốc nguyên nhân đã truy ra (V8 lớp 2), và nó đổi câu trả lời:**
`ViewerStoreyRail.tsx:78` vẽ `{storey.code}`, và `useViewerShell.ts:600` đặt
`code: storey.id`. Tức nhãn ấy **là mã máy**, không phải "mã bộ mẫu xấu" — bất cứ đồ thị
nào cũng sẽ lộ `id` của tầng lên nhãn, kể cả dữ liệu thật.

⇒ **Khuyến nghị đổi thành A.** Đây là lỗi hiển thị thật: một `id` không bao giờ nên là thứ
người dùng đọc. Nhưng một ca A6 quét nhãn nhìn thấy được sẽ bắt được cả hai khả năng, và
nó rẻ. Lưu ý cho người viết ca: cùng nút ấy cũng hiện "Ẩn Tầng trệt", "Ẩn Tầng 02" — tức
**tên tầng đẹp có sẵn ở ngay cạnh**, nên A không khó.

---

## Q9 — Tệp mẫu để tải lên: sinh bằng `Buffer`, hay commit một tệp thật?

**Đã đo.** `setInputFiles` **dùng được**; mốc neo `[data-testid="floor-upload-file-input"]`.
Nhưng **không có tệp mẫu nào trong repo** để tải lên, và PDF cần đúng chữ ký
(`%PDF-` + `/Type /Page`) mới được nhận.

| | Phương án |
|---|---|
| **A** | Sinh tại chỗ bằng `Buffer` trong fixture. Không thêm tệp nhị phân vào repo; đổi lại tệp sinh ra là tệp tối giản, không giống bản vẽ thật. |
| **B** | Commit một PNG và một PDF thật, nhỏ, vào `e2e/fixtures/assets/`. Giống thật hơn; đổi lại repo mang thêm tệp nhị phân và ai đó sẽ hỏi chúng từ đâu ra. |

**Khuyến nghị: A cho luồng "tải lên được", B nếu có ca nào cần nội dung bản vẽ thật** (ví dụ
màn chất lượng ảnh đo độ nghiêng). Kế hoạch ghi rõ tệp mẫu là **tiền đề** (trường 3) của
mọi ca tải lên, không để trống.

---

## Q10 — Ba màn không tới được: xếp sau, hay bỏ khỏi phạm vi e2e?

**Đã đo**, ba màn khác nhau ba lý do:

| Màn | Lý do đã đo |
|---|---|
| `ProcessingScreen` + `PipelineFailure` | `ProcessingScreenRoute` không truyền `floorUploads`, và màn tải lên điều hướng bằng đường trần ⇒ `/pipeline` **luôn `0/0`**, nên `PipelineFailure` không bao giờ dựng |
| `ShareDialog` | `ExportPanel` trên bộ mẫu **luôn `empty`** ("chưa có gì được duyệt để xuất"), nên không có nút "chia sẻ". Ép mở thì rơi `error` vì gọi HTTP thật |
| ~16 bề mặt editor Pascal | không nơi nào trong `src` nhập `@pascal-app/editor`; grep 251 tệp `.js` đã dựng cho thấy chuỗi chữ của chúng gần như vắng mặt (tree-shake) |

| | Phương án |
|---|---|
| **A** | Cả ba nằm trong `coverage-map.md` với ô `chưa phủ` + điều kiện mở cổng, và `plan.md` có mục cho chúng ghi rõ "không tới được". Phạm vi giữ nguyên 65 bề mặt. |
| **B** | Đưa chúng ra khỏi phạm vi lượt này. Phạm vi thành ~46 bề mặt, và ba màn kia vào một danh sách chờ riêng. |

**Khuyến nghị: A.** Một bề mặt biến khỏi bảng là một bề mặt không ai còn nhớ. Ô `chưa phủ`
kèm lý do đã đo thì đọc được trong mười giây và đòi được một quyết định; một danh sách chờ
riêng thì không ai mở lại.

Với Pascal editor, A có một hình dạng cụ thể: **một** mục kế hoạch cho cả nhóm, cộng
**một** ca hàng rào — khẳng định bên trong `[data-testid="pascal-canvas"]` có đúng một
`<canvas>` và **không** có `button`/`role=tab` nào. Bài ấy đỏ đúng lúc ai đó gắn `Editor`
vào, và đó chính là lúc cần biết. Một ca hàng rào đáng hơn 16 ca `test.skip`.

---

## Q10b — `ConnectionStates`: một màn hoàn chỉnh không nơi nào dựng ra

**Đã xác minh.** `grep -rn "ConnectionStates" src` ngoài thư mục của chính nó ra đúng năm
dòng, và **không dòng nào là một nơi gọi**:

| Dòng | Nó là gì |
|---|---|
| `lib/offline/queueStore.ts:8` | một **chú thích** nói `ConnectionStates` "là nơi gọi đầu tiên" của hằng `MAX_PENDING_COMMANDS`. Tệp đó **không nhập gì** từ màn |
| `StateGallery.test.tsx:31,175` | bài kiểm của bảng kê |
| `stateGalleryManifest.ts:198,559-560` | bảng kê **tên**, không dựng màn |

`useConnectionStates` và `createConnectionStatesGateway`: **0** nơi gọi ngoài thư mục.
Và `index.ts` của chính màn tự khai: *"Không có `ConnectionStatesRoute`, và đó là chủ ý…
nhúng vào vỏ ứng dụng"* — **nhưng không vỏ nào nhúng nó.**

Nó có **35 bài đơn vị**, tức có người đã viết nó cẩn thận. Nó chỉ không được cắm vào.

| | Phương án |
|---|---|
| **A** | Nhúng nó vào vỏ ứng dụng như `index.ts` của nó nói. Rồi nó vào kế hoạch e2e bình thường. |
| **B** | Ghi nó là **`chưa phủ` ở tầng e2e, có lý do "không có nơi gọi"**, và 35 bài đơn vị là toàn bộ bằng chứng hiện có. Không mục 13 trường. |

**Khuyến nghị: B cho lượt này** — kế hoạch test không quyết được sản phẩm có gắn một màn
hay không. Nhưng đây là câu đáng hỏi riêng, vì "một màn hoàn chỉnh, có 35 bài kiểm, không ai
dựng" thường nghĩa là một quyết định sản phẩm bị bỏ giữa đường.

---

## Q10c — `Escape` ở `/thong-bao` đưa trình duyệt ra `about:blank`

**Đã đo.** Vào **thẳng** `/thong-bao` (không qua màn khác) rồi bấm `Escape`: màn gọi
`navigate(-1)`, và vì tab không có trang trước trong lịch sử, trình duyệt ra **`about:blank`**.

Đây là **một màn trắng do `Escape` gây ra** — đúng thứ A11 tồn tại để chặn. Và nó đi ngược
lời hứa A12: "Esc đóng lớp trên cùng", không phải "Esc rời khỏi ứng dụng".

Nó chỉ xảy ra khi người dùng **mở trực tiếp** đường dẫn — tức đúng tình huống của một liên
kết được chia sẻ, hoặc một thông báo đẩy, hoặc một tab mới.

| | Phương án |
|---|---|
| **A** | Lỗi sản phẩm. `Escape` phải về một đích xác định (`ROUTES.dashboard`) khi không có gì để lùi, chứ không gọi `navigate(-1)` mù. Chữa, rồi ca A12 khẳng định `Escape` không bao giờ rời ứng dụng. |
| **B** | Chấp nhận: `/thong-bao` là panel chồng lên một màn khác, và mở trực tiếp nó là cách dùng ngoài thiết kế. Kế hoạch ghi ca A12 của màn này là "chỉ kiểm khi vào từ màn khác". |

**Khuyến nghị: A.** `/thong-bao` là một route thật, có trong `ROUTE_PATTERNS`, nên nó **được
phép** mở trực tiếp — và một route mở trực tiếp được thì không được để `Escape` đưa người
dùng ra trang trắng. B biến một lỗ thành một quy ước không ai viết ra.

Ghi chú cho người viết ca: bài kiểm này rẻ và chắc — `page.goto('/thong-bao')`,
`page.keyboard.press('Escape')`, khẳng định `page.url()` vẫn thuộc ứng dụng.

---

## Q10d — Chuỗi tự lưu bảo người dùng "lưu lại thủ công", mà A7 nói không có nút lưu

**Đã xác minh nguyên văn**, `src/i18n/vi.json:70`:

> `"failed": "Lưu thất bại sau nhiều lần thử. Chỉnh sửa hoặc lưu lại thủ công."`

A7 nói **không có nút lưu**, và điều đó đã đo: 0/35 màn có nút mang chữ "lưu". Nên khi tự
lưu thất bại, hệ thống bảo người dùng làm một việc **không có đường nào để làm**.

Đây là chỗ hai bất biến gặp nhau và một trong hai phải nhường: A7 ("không có nút lưu") và
lời hứa ngầm rằng mọi câu hệ thống nói ra đều dẫn tới một hành động làm được.

| | Phương án |
|---|---|
| **A** | Sửa chuỗi: nói ra việc người dùng **thật sự** làm được — "thử lại" (một nút thử lại, không phải nút lưu), hoặc "chỉnh sửa rồi hệ thống lưu lại". A7 giữ nguyên. |
| **B** | Trong đúng nhánh `failed` này, cho phép một nút "lưu lại" xuất hiện — tức một ngoại lệ có phạm vi hẹp của A7, được ghi vào sổ ngoại lệ. |

**Khuyến nghị: A.** A7 không phải quy ước đặt tên, nó là một lời hứa về mô hình tương tác
("hệ thống tự lưu, bạn không phải nghĩ về việc lưu"). Một nút lưu mọc lên đúng lúc mọi thứ
đang sai là lúc nó gây hoang mang nhất. Còn chuỗi thì chỉ cần nói đúng việc làm được.

Ghi chú cho người viết ca: ca này kiểm được ở tầng **đơn vị** rẻ hơn e2e (đẩy engine tự lưu
vào `failed` rồi khẳng định chuỗi hiện ra không chứa chữ "thủ công" trong khi
`getByRole('button', { name: /lưu/i })` vẫn là 0). Ghi vào `coverage-map.md` cột A7 là
`đơn vị`, không phải `e2e`.

---

## Q10e — Bốn nhãn quảng cáo phím tắt mà sổ phím tắt không đăng ký

**Đã đo bằng hai cách**, trên `projectMeasure`: đọc sổ (`listShortcuts`) **và** bấm phím thật.

| Nhãn nút (nguyên văn) | Phím nó quảng cáo | Có trong sổ? |
|---|---|---|
| "quay quanh mô hình (R)" | `R` | **không** |
| "kéo màn (H)" | `H` | **không** |
| "mặt cắt (C)" | `C` | **không** |
| "chọn (V)" | `V` | **không** |

**Điều phối viên đã truy thêm, và gốc nguyên nhân sắc hơn "quên đăng ký":**

- Bốn phím ấy **có** một bảng khai: `TOOL_SHORTCUTS` (`src/lib/tools/shortcuts.ts:81`), và
  nhãn lấy `keyLabel` từ đó (`useViewerShell.ts:151-152`).
- Vỏ 3D **cố ý không** đăng ký lại `H`, và docblock nói rõ vì sao:
  *"`TOOL_SHORTCUTS.pan` … đã là `'H'` … Cướp `H` cho 'ẩn' nghĩa là một phím làm hai việc
  tuỳ chỗ con trỏ đang đứng — thứ `shortcutConflicts` sinh ra để chặn"*
  (`viewerShellShortcuts.ts:13-19`).
- Nhưng **không tầng nào khác đăng ký `TOOL_SHORTCUTS` vào `appShortcutRegistry`**.
  `useKeyboardMap.ts:26` chỉ *đọc* bảng để vẽ ra bảng phím tắt.

⇒ Bảng khai tồn tại, vỏ nhường đúng chỗ, và **không ai nhận** — nên bốn phím có nhãn, có
bảng, và không có binding lúc chạy.

Nút vẫn bấm được bằng chuột. Nhưng A12 nói bàn phím là **đường hạng nhất, không phải phương
án dự phòng** — và một nhãn tự khai một phím không tồn tại thì tệ hơn là không khai gì: nó
dạy người dùng một thứ sai, và người dùng bàn phím sẽ thử `R` rồi kết luận màn bị treo.

| | Phương án |
|---|---|
| **A** | Đăng ký bốn phím vào `shortcutRegistry` ở phạm vi `canvas`. Nhãn thành đúng. Rồi ca A12 khẳng định mỗi phím quảng cáo trong nhãn đều đổi được trạng thái nút (`aria-pressed`). |
| **B** | Gỡ bốn ký tự trong ngoặc khỏi nhãn. Rẻ hơn, nhưng mất một đường bàn phím mà thiết kế rõ ràng đã có ý làm. |

**Khuyến nghị: A**, và nó rẻ hơn tưởng: bảng `TOOL_SHORTCUTS` đã có, chỉ thiếu một chỗ
đăng ký nó vào `appShortcutRegistry` ở phạm vi `canvas`. Nhãn đã nói ra ý định; thiếu là
phần thực hiện. Và ca kiểm cho A là loại
ca đáng có nhất trong cả kế hoạch — nó **tự tổng quát hoá**: quét mọi nút có dạng
`(<phím>)` trong nhãn rồi khẳng định phím ấy có trong sổ. Một ca như thế bắt được cả những
nhãn chưa ai viết.

---

## Q10f — "Viết thường, kiểu câu" của A6 chỉ có ở tài liệu ưu tiên THẤP nhất

**Đã xác minh.** Thứ tự tài liệu khi xung đột là `LUAT_MAN_HINH.md` → `RULE.md` →
`CLAUDE.md` → prompt màn. Cả hai tệp đầu **tồn tại** (25,8 KB và 63,6 KB). Nhưng:

```
grep -rn "kiểu câu|viết thường" LUAT_MAN_HINH.md RULE.md CLAUDE.md
  → CLAUDE.md:102   (đúng một dòng, ở tài liệu ưu tiên THẤP nhất trong ba)
```

Nửa còn lại của A6 — "nhãn tiếng Việt" — thì có bằng chứng dày (`src/i18n/vi.json`,
`lib/testing/expectVietnamese`). Nửa "viết thường, kiểu câu" thì **không có gì ngoài một
dòng bảng**, và không có hàm khẳng định nào trong `lib/testing` kiểm nó.

Hệ quả thực tế: nếu một ca e2e khẳng định "nhãn phải viết thường kiểu câu" và ai đó phản
đối, không có tài liệu ưu tiên cao hơn để viện.

| | Phương án |
|---|---|
| **A** | Chốt nó ở `LUAT_MAN_HINH.md` (tài liệu ưu tiên cao nhất), kèm danh sách ngoại lệ chữ hoa đầy đủ (mã trục, mã lỗi, tên phím — và nếu có thêm thì ghi ra). Rồi viết một hàm `expectSentenceCase` trong `lib/testing`, và ca e2e gọi nó. |
| **B** | Coi nó là quy ước mềm: ca e2e **không** khẳng định nó, chỉ khẳng định nửa "tiếng Việt, đủ dấu" mà `expectVietnamese` đã làm. `coverage-map.md` ghi A6 là `đơn vị` cho nửa đó và `chưa phủ` cho nửa kia. |

**Khuyến nghị: A**, nhưng nó là việc của bạn chứ không phải của kế hoạch test: một bất biến
không có nơi phát ngôn rõ và không có hàm khẳng định thì mọi ca kiểm nó đều là một cuộc
tranh luận chờ xảy ra. Lượt này kế hoạch đi theo **B** và ghi rõ đang đi theo B — **ba** ô
`A6` trong `coverage-map.md` (`login`, `onboarding`, `mobileViewer`) đã ghi `chưa phủ` chính
vì chỗ này.

---

## Q10g — Ba route 3D là route MỒ CÔI: không nơi nào trong ứng dụng dẫn tới chúng

**Đã xác minh** (V9 lớp 2, điều phối viên kiểm lại bằng grep):

```
grep -rn "ROUTES.project.exploded|measure|overlay|projectExploded|projectMeasure|projectOverlay" src
  (bỏ test, paths.ts, router.tsx, stateGalleryManifest)
  → đúng 2 dòng, cả hai là CHÚ THÍCH trong docblock của OverlayComparison
```

Ba route `/projects/:projectId/3d/exploded`, `/projects/:projectId/3d/measure`,
`/projects/:projectId/floors/:floorId/overlay` **được đăng ký trong router và mở được bằng
URL**, nhưng **không một nút, liên kết hay `navigate()` nào trong ứng dụng dẫn tới chúng**.

Chúng có 20 + 56 + 65 = **141 bài đơn vị**, tức có người đã làm chúng cẩn thận.

Điều này đổi câu hỏi "e2e nên kiểm chúng đến mức nào":

| | Phương án |
|---|---|
| **A** | Chúng là màn thật, chỉ chưa có đường vào. Kế hoạch kiểm chúng bình thường bằng `page.goto` (đó là cách duy nhất người dùng vào được hôm nay), và **thêm một ca** khẳng định có đường vào từ vỏ 3D — ca ấy **đỏ hôm nay**, và nó đỏ đúng chỗ: sản phẩm thiếu một liên kết. |
| **B** | Chỉ kiểm mức "mở được, không trắng" (chặng 1) và ghi `chưa phủ` cho phần còn lại, cho tới khi sản phẩm có đường vào. Không ca nào đỏ. |

**Khuyến nghị: A, nhưng ca-đỏ-có-chủ-đích phải được bạn chấp nhận trước khi viết.** Một bài
đỏ ngay từ lúc sinh ra chỉ có giá trị khi cả nhóm biết vì sao nó đỏ và đồng ý để nó đỏ. Nếu
bạn không muốn thế thì B, và `coverage-map.md` giữ ba dòng `chưa phủ` để nhắc.

Lưu ý: đây **không** phải chuyện "route chết". Route sống, dữ liệu sống (cửa bơm kho của Q1
đưa canvas `exploded` từ 300×150 lên **960×362** và `measure` lên **960×460**). Thiếu đúng
một liên kết.

---

## Q10h — `ProjectDashboard` là màn DUY NHẤT trong 49 không gọi `expectVietnamese`

**Đã đếm.** Quét cả 49 thư mục màn xem thư mục nào không có lời gọi `expectVietnamese` ở
bất cứ tệp nào:

```
→ đúng một: ProjectDashboard.   48/49 màn còn lại đều gọi.
```

Và nó là màn của route **`/`** — màn nhiều người mở nhất trong cả ứng dụng, và màn có **ít
bài đơn vị nhất trong nhóm nặng** (10 bài).

**Hai lỗ khớp nhau, và điều phối viên đã xác minh chỗ vỡ.** `ProjectDashboard.tsx:343-345`:

```tsx
<span className="sr-only" role="status">
  {state}
</span>
```

`state` là **khoá `SevenState` thô** — trình đọc màn hình đọc ra "success", "forbidden",
"partial", "collapsed", **tiếng Anh**. Đây là vi phạm A6 thật, ở đúng chỗ A6 quan trọng nhất
(người dùng trình đọc màn hình không có kênh nào khác để biết màn đang ở trạng thái gì). Và
nó sống được vì đây là màn duy nhất không gọi `expectVietnamese` — **hai lỗ khớp nhau: một
lỗ sản phẩm nằm đúng trong lỗ độ phủ.**

Đối chiếu: `projectSettings` in **"trạng thái: thành công"** (tiếng Việt). Hai màn cùng cơ
chế, hai kết quả khác nhau — nên đây là một chỗ quên, không phải một quyết định. V3 còn đo thêm: `ProjectDashboard.test.tsx`
không có bài nào chạy luồng **xoá** hay **đổi tên** dự án, nên A8 và A9 của màn ấy **không
bài nào bắt**, và chữ trạng thái tiếng Anh nếu có thì không ai thấy.

| | Phương án |
|---|---|
| **A** | Lấp ở **tầng đơn vị**: thêm `expectVietnamese` và hai bài luồng xoá/đổi tên vào `ProjectDashboard.test.tsx`. Rẻ, nhanh, và nó thuộc đúng tầng — 48 màn kia đã làm như vậy. |
| **B** | Lấp ở **tầng e2e** trong kế hoạch này: một ca A6 quét chữ trên `/` và một ca A8/A9 cho xoá dự án. Đắt hơn một bậc, nhưng nó đi qua đường thật của người dùng. |

**Khuyến nghị: A cho A6, B cho A8/A9.** Chữ tiếng Việt là thứ `expectVietnamese` kiểm rẻ nhất
ở tầng đơn vị, và 48 màn kia đã chứng minh khuôn ấy chạy. Nhưng "xoá một dự án rồi hoàn tác"
là việc đi qua store thật, toast thật và một lượt render lại — đúng loại việc e2e đáng làm.
Và V3 đo được một dữ kiện làm B đáng hơn: **danh sách dashboard là 3 dự án viết cứng**
(`projectsGateway.ts:57`), nên tạo dự án xong không hiện trong lưới và xoá thì tải lại là có
lại. Một ca e2e sẽ nói ra chuyện đó; một bài đơn vị tiêm sẵn danh sách thì không.

---

## Q10i — `index.html` không có thẻ icon, nên mọi màn sinh một 404 và mọi ca "console sạch" sẽ đỏ

**Đã đếm:** `grep -c 'rel="icon"|favicon' index.html` → **0**.

Hệ quả đo được: **mọi** lượt tải trang xin `/favicon.ico` và nhận **404**. Ba worker độc lập
gặp dòng 404 ấy trên bốn màn khác nhau và mỗi người đoán một nguồn khác; truy ra bằng CDP
Network mới thấy. **Bộ nghe `response` của Playwright không thấy nó** — đó là lý do nó khó
truy.

Điều này chặn ngay chặng 1 của kế hoạch: 35 bài "mở đúng đường, có nội dung, console không có
lỗi" sẽ **đỏ cả 35** vì một lý do không liên quan tới màn nào.

| | Phương án |
|---|---|
| **A** | Thêm một thẻ `<link rel="icon">` vào `index.html`. Một dòng, chữa gốc, và mọi ca "console sạch" đúng ngay. Đây là sửa sản phẩm — nên nó cần bạn đồng ý. |
| **B** | Không đụng sản phẩm. Fixture dùng chung lọc lượt xin `/favicon.ico` trước khi khẳng định, **một chỗ**, và docblock của fixture ghi vì sao bộ lọc ấy tồn tại. |

**Khuyến nghị: A.** Một trang web không có icon là một thiếu sót thật (tab trình duyệt hiện ô
trống), và chữa nó xoá luôn cả một bộ lọc mà mọi bài sau này phải nhớ. B vẫn nên làm **kèm**
A: bộ lọc ở một chỗ là lưới an toàn cho những 404 nhiễu khác chưa ai gặp.

---

## Q10j — P0 chữa cổng, nhưng còn một tài nguyên dùng chung thứ hai: `public/assets/pascal/`

**Đã đo, hai lượt `smoke` song song trong CÙNG một worktree, hai cổng khác nhau:**

| Lượt | Kết quả |
|---|---|
| `E2E_PORT=5184 pnpm e2e --grep smoke` | chạy được |
| `E2E_PORT=5185 pnpm e2e --grep smoke` | **exit 1 ngay ở bước dựng** |

```
EPERM, Permission denied: \?\F:\AppFront\publicssets\pascalloorplan-tool-*.js
    at emptyDir (…vite…)  ←  prepareOutDir
```

Nguyên nhân: `vite.pascal.config.ts:65-66` đặt `outDir: 'public/assets/pascal'` với
**`emptyOutDir: true`**, và mỗi `pnpm e2e` chạy `pnpm pascal` trước. Hai lượt song song có
một lượt đang ghi trong lúc lượt kia đang xoá sạch.

**Phạm vi:** hai **worktree khác nhau** thì mỗi cái có `public/` riêng nên không đụng — đó
đúng là tình huống §9.2 nhắm tới, và P0 vẫn đủ cho nó (**chưa đo**). **Cùng một worktree**
thì đụng, và `E2E_PORT` khiến nó *trông như* đã cô lập.

Lỗi này **ồn ào** (exit 1, thông báo rõ), không âm thầm như lỗi cổng — nên nó ít nguy hiểm
hơn nhiều. Nhưng nó làm lời hứa "đặt `E2E_PORT` là chạy song song được" thành nửa đúng.

| | Phương án |
|---|---|
| **A** | Ghi vào tài liệu và để nguyên mã: "một lượt `pnpm e2e` mỗi worktree; `E2E_PORT` là để hai **worktree** không đụng nhau, không phải để hai lượt trong một worktree". Rẻ nhất, và đúng với cách người ta thực sự dùng. |
| **B** | Cho `outDir` của vách ngăn Pascal đọc `E2E_PORT` (ví dụ `public/assets/pascal-<port>/`), rồi màn Pascal nạp theo cùng biến. Cô lập thật; đổi lại một đường dẫn tài sản chạy-thời-gian nay phụ thuộc một biến môi trường của test — thứ dễ rò vào bản dựng sản phẩm. |

**Khuyến nghị: A.** B đưa một biến của test vào đường dẫn tài sản sản phẩm, và đó là cái
giá cao cho một lỗi đã ồn ào sẵn. Thêm một câu vào docblock của `run-playwright.mjs` là đủ:
`E2E_PORT` cô lập **cổng**, không cô lập **thư mục dựng**.

Ghi chú: phần này không chạm tới CI — CI đặt `workers: 1` và chạy đúng một lượt.

---

## Q11 — `scripts/probe-survey.mjs` giữ trong repo hay xoá sau khi dùng?

**Đã đo.** Nó dò 35 màn trong ~2 phút và là nguồn của mọi mốc neo trong `plan.md`. Nó không
nằm trong `e2e/`, `pnpm e2e` không chạy nó, `eslint . --ext ts,tsx` không lint `.mjs` nên nó
không qua cổng nào.

| | Phương án |
|---|---|
| **A** | Giữ. Nó là công cụ đo lại được: ai sửa một nhãn thì chạy nó và biết ngay mốc neo nào lệch. Đổi lại repo mang thêm một script không cổng nào bảo vệ. |
| **B** | Xoá sau lượt này. Kế hoạch đã có số; cần đo lại thì viết lại. |

**Khuyến nghị: A**, nhưng kèm điều kiện: thêm nó vào `pnpm lint` (hoặc đặt nó dưới `e2e/`
với đuôi `.ts` để `tsc --noEmit` nhìn thấy). Một script không cổng nào bảo vệ sẽ mục, và
lúc mục thì nó nói sai — tệ hơn là không có.

---

## Q12 — CI: ảnh chuẩn `linux` vẫn chưa có, và lượt đầu sẽ đỏ

**Đã đo.** Ảnh chuẩn hiện có chỉ ở dạng `*-chromium-win32.png`; CI chạy `ubuntu-latest`.
Cổng `visual` nay gọi `pnpm e2e` (so sánh) chứ không `pnpm e2e:visual` (ghi đè).

Đây **không** phải câu A/B — thứ tự đã rõ: **chạy → lượt đầu ĐỎ → lấy artifact → commit ảnh
linux một lần.** Câu duy nhất là **khi nào**: trước chặng 0, hay sau chặng cuối?

**Khuyến nghị: trước chặng 0.** Một cổng CI đỏ vì lý do đã biết sẽ dạy cả nhóm bỏ qua màu
đỏ, và đó là thứ đắt nhất một bộ test có thể mất.

---

## Q13 — `useAutosave` khoá cứng vào slice `spatial`, nên năm màn tự lưu đúng mà `Ctrl+S` không với tới

**Đã truy ra bằng đọc mã, ba chặng:**

1. `flushAutosaves()` lặp qua **`mountedAutosaves`** (`hooks/useAutosave.ts:27,40`).
2. Engine vào tập ấy ở **đúng một** chỗ: `mountedAutosaves.add(autosave)` (`:112`) — tức
   **chỉ khi màn gọi hook `useAutosave`**. Dựng engine thẳng bằng `createAutosave<T>({…})`
   thì engine chạy đúng nhưng **không ai đăng ký nó**.
3. `useProjectSettings.ts:15-19` nói thẳng vì sao nó không dùng hook ấy:
   *"Cũng không dùng `useAutosave` hay `ConnectedSaveIndicator` — **cả hai khoá cứng vào
   slice `spatial` của store, thứ màn này không có**."*

| Màn | Cơ chế | `Ctrl+S` xả được? | Có `spatial` không? |
|---|---|---|---|
| `ScaleCalibration:630` · `DimensionOcrReview:576` · `PropertyInspector:1119` | `useAutosave(…)` | **có** | — |
| `ProjectSettings` · `RuleSettings` · `AccountSettings` | `createAutosave<T>` + `SaveIndicator` thuần | không | **không** — nên buộc phải thế |
| `RoomLabelReview:602` · `ThicknessStandardization:534` | `createAutosave<T>` trần | không | **có** — nên **không buộc** phải thế |

`ConnectedSaveIndicator` (biến thể **có** gọi `useAutosave`) **không màn nào render**.

Hai nhóm dưới cùng khác nhau ở chỗ quyết định: ba màn cài đặt không có `spatial` nên chỗ
ghép cứng **bắt** chúng đi đường vòng — có lý do, đã ghi. `rooms` và `thickness` thì **có**
`spatial`, tức dùng được hook, mà lại không dùng — và **không dòng nào giải thích vì sao**.

| | Phương án |
|---|---|
| **A** | Gỡ chỗ ghép cứng: `useAutosave` nhận nguồn thay đổi qua tham số thay vì đọc thẳng slice `spatial`. Rồi cả năm màn đăng ký được, và `Ctrl+S` giữ đúng lời hứa A7 ở mọi màn. |
| **B** | Để nguyên chỗ ghép cứng, chỉ nối `rooms` và `thickness` sang `useAutosave` (hai màn ấy có `spatial` nên nối được ngay). Ba màn cài đặt vẫn nằm ngoài `Ctrl+S`, và điều đó được ghi thành nợ. |

**Khuyến nghị: B trước, A khi có người chủ.** B là hai dòng và lấy lại hai màn; A là thay
đổi một hook mà ba màn đang phụ thuộc, nên nó cần một lượt riêng có người duyệt.

**Hệ quả cho kế hoạch, và đây là phần bắt buộc:** **không** viết một ca "Ctrl+S xả sớm"
dùng chung. Ở tám màn nó sẽ **xanh vì không có gì xảy ra** — thứ tệ hơn một ca đỏ. Mỗi mục
phải nói rõ màn của nó nằm ở hàng nào của bảng trên. Xem `plan.md` mục 2.1.

---

## Cần đo trước khi hỏi — chưa thành câu hỏi được

| Việc | Còn thiếu gì |
|---|---|
| **Điều kiện kích `EditorTour`** | Hai worker đo ra hai kết quả. V8: hiện sau cú bấm đầu tiên trên `/3d`. V2 đo lại: bấm · gõ phím · lăn chuột · chờ 11 s đều KHÔNG kích; **chỉ `resize`** kích. `scroll` thật **chưa đo**. Hai phép đo có thể cùng đúng (một cú bấm mở panel ⇒ đổi bố cục ⇒ `resize`) nhưng **chưa ai truy được chuỗi nhân quả**. Hệ quả: fixture `tour.ts` phải **chủ động kích rồi bỏ qua**, không giả định tour đã hiện |
| Store sống sót qua điều hướng nội bộ giữa các màn | V6 tiêm được rồi, nhưng **chưa đo** store còn nguyên sau khi bấm liên kết sang màn khác. Đây là dữ kiện quyết định của Q1 phương án A |
| Hộp xem trước của `FurnitureLibraryPanel` | kéo bị khoá nên **chưa mở được**, nên thứ tự `Escape` của nó **chưa đo** |
| Chiều cao canvas Pascal 190 px | cao hơn `min-h-[12rem]` một chút ⇒ có vẻ đang ở chiều cao tối thiểu. **Chưa đo** với cửa sổ khác |

---

# Hai vai đối nghịch — hai vòng, và chỗ chúng lệch nhau

Hai bản soát chỉ-đọc, động cơ ngược hẳn, mỗi bản hai vòng. Vòng 2 mỗi vai đọc bản của vai
kia và phải nói thẳng chỗ mình **nhường** hoặc **rút**.

| | **VAI A — cắt tối đa** | **VAI B — bịt tối đa** |
|---|---|---|
| Vòng 1 | đếm **173** ca trong kế hoạch, đề nghị cắt **125**, còn **48** | tìm **18** lỗ, đề nghị thêm **13** ca, và **3** ô `không áp dụng` dùng sai |
| Vòng 2 | nhường **6** ca, phản đối **7**, cắt thêm 1 ⇒ **53** | rút **3** ca của mình, thêm 1 ca mới ⇒ **11**; gọi **12** ca A cắt là nguy hiểm |

Cả hai đều tự soát bằng cổng của chính mình. A phải điền được ô *"sau khi cắt, ai còn chứng
minh phần đó"*; B phải trả lời được *"nếu ca ấy đỏ thì người dùng mất gì"*. Chỗ nào không
điền được thì vai ấy tự dừng — và cả hai đều có mục "không cắt được" / "lỗ không tìm ra giá
trị" thật.

---

## Chỗ ĐÃ ngã ngũ bằng bằng chứng — không thành câu hỏi

### Chặng 1: **35 bài sinh từ dữ liệu**, không phải một bài lặp

A đề nghị gộp 35 bài route + 13 bài mở-rồi-`Escape` thành **một** ca lặp. B phản đối bằng
cơ chế Playwright, và B đúng:

1. **Mất khả năng biết route nào vỡ và chạy riêng nó.** Một bài cho một kết quả, một trace,
   và không `--grep` được theo route.
2. **`expect.soft` không cứu được.** Nó tiếp tục qua một `expect` hỏng, **không** tiếp tục
   qua `goto`/`click` quá hạn. Nên vòng lặp chết ở route đầu tiên hỏng và **không đo 32
   route còn lại** — đúng cái mà một lưới an toàn tồn tại để làm.
3. **Không vào được trần 30 s mà kế hoạch cấm nâng.** `playwright.config.ts` không đặt
   `timeout`, nên mặc định 30 s; bộ dò cần **~2 phút** cho 35 màn.
4. **Lợi ích của A có được mà không mất gì:** một vòng `for` **sinh ra 35 lời gọi `test()`**
   (không phải một `test()` có vòng lặp bên trong). Một khuôn mã, một danh sách route, và
   **35 kết quả chạy song song** — `fullyParallel: true` chia chúng ra nhiều worker.

⇒ **Kế hoạch lấy hình dạng này.** A được điều nó muốn (một khuôn, không 35 tệp chép tay);
B được điều nó muốn (35 kết quả độc lập). Đây không phải thoả hiệp — đây là A sai về cơ chế.

Với **13 bài mở-rồi-`Escape`** của màn không route: A đúng rằng 12/13 đã có ca nhóm hoặc
bài đơn vị trùng. Kế hoạch giữ **một** bài sinh-từ-dữ liệu cho nhóm ấy, và mỗi mục nhóm chỉ
thêm ca khi nó chứng minh **thứ tự giữa các lớp** — thứ bài đơn vị không chạm tới.

### `Ctrl+S` không chung cho cả vỏ

B đo, điều phối viên kiểm chứng, A nhận. Xem `plan.md` mục 2.1. Ba màn dùng
`createAutosave` thì `Ctrl+S` xả được; bốn màn dùng `useSaveIndicator` thì không. Một ca
"Ctrl+S xả sớm" dùng chung sẽ **xanh vì không có gì xảy ra** ở bốn màn — tệ hơn một ca đỏ.

### Ba lỗ B gọi là nghiêm trọng nhất, A nhường cả ba

- `projectSettings` **mất chỉnh sửa khi rời màn trong 800 ms**;
- `Ctrl+S` **không xả** được chính màn ấy;
- **xoá cả một dự án** xong không có dòng xác nhận nào.

A nhường vì nó **không điền được** ô "ai còn chứng minh": cả ba nằm giữa hai lớp
(router × hook, provider × container) mà jsdom không chạm tới.

---

## Chỗ hai vai VẪN lệch — thành câu hỏi cho bạn

### QA/B-1 — Bốn ca ghi nhận khiếm khuyết sẽ ĐỎ ngay từ lúc sinh ra. Đưa vào bộ chạy không?

Bốn ca: `settings` (sửa rồi rời màn / `Ctrl+S`), `settings` xoá-không-xác-nhận,
`NotificationCenter` A8, `dashboard` A8. Cả bốn đã đo ra hiện trạng **trái** A7/A8.

| | Phương án |
|---|---|
| **A** | Không đưa vào bộ chạy. Ghi vào mục PHÁT HIỆN của `plan.md`. Bộ test **không có ca đỏ thường trực** — theo A, "một ca đỏ thường trực làm giảm tin cậy của mọi ca xanh". Con số ca thực chạy: **49**. |
| **B** | Đưa vào. Theo B, ba lỗ nghiêm trọng nhất **không có ca nào chứng minh** nếu bỏ chúng, và một bất biến không ai kiểm là một bất biến sẽ mất. Con số: **53**. |

**A tự nói ra cái giá của phương án A**, nguyên văn: *"khi đó ba lỗ nghiêm trọng nhất không
có ca nào chứng minh, và tôi nói thẳng đó là cái giá."*

**Khuyến nghị: B, với một điều kiện.** Đưa vào bộ, nhưng **không** để chúng đỏ trong CI ở
chặng đầu: đánh dấu `test.fixme` **kèm lý do và điều kiện mở lại** (kế hoạch cấm
`test.skip` *không* có hai thứ đó — có thì được). Ca tồn tại, đọc được, và nó tự bật lên
xanh đúng lúc ai đó chữa. Đó là thứ một mục PHÁT HIỆN trong tài liệu không làm được.

### QA/B-2 — `RoomAreaPanel`: panel chỉ đọc, hay panel ghi?

A cắt `RA-1` và `RA-2` ("panel chỉ đọc"). B đọc mã và nói nó **sửa được tên phòng**
(`RoomAreaPanel.rows.tsx:152-156`, `useRoomAreaPanel.ts:353,433,462`), nên hai ô
`A7`/`A8` đang ghi `không áp dụng` phải là `chưa phủ`, và cần một ca A8.

A vòng 2 **phản đối** `B-RA-RENAME`, B vòng 2 **không rút** nó. Hai vai đứng nguyên.

| | Phương án |
|---|---|
| **A** | Giữ `không áp dụng`. Đổi tên phòng đã có ca ở `projectRooms` (`V7-ROOMS-03`); panel chỉ là một cửa thứ hai vào cùng việc. |
| **B** | Đổi thành `chưa phủ` + một ca A8 cho panel. Hai cửa vào cùng một việc là **hai** chỗ có thể vỡ, và cửa thứ hai chưa ai đi. |

**Vòng 2 đổi câu trả lời, và A là bên đổi nó.** A tự đi kiểm rồi báo lại — điều phối viên
xác minh và đúng: `RoomAreaPanel.test.tsx:223` ghi thẳng *"cửa sổ đủ rộng để lượt tự lưu
800 ms của A7 … chạy xong"*, và `:262` chạy một lượt đổi tên bị tầng lệnh từ chối. Nên ô
`A7` của panel **không** phải `chưa phủ` — nó là **`đơn vị`**.

Nhưng chỉ ở **nhánh lỗi**. Hai dòng ấy phủ "đổi tên rỗng bị từ chối"; **nhánh thành công**
(đổi tên xong, tự lưu nói "đã lưu") thì hai dòng ấy không nói tới, và tôi **chưa đo**.

⇒ **Khuyến nghị chốt:**

| Ô | Giá trị đúng |
|---|---|
| `RoomAreaPanel·A7` | **`đơn vị`** — không phải `không áp dụng` (A sai ở vòng 1), không phải `chưa phủ` (B sai ở vòng 1) |
| `RoomAreaPanel·A8` | **`chưa phủ`** — panel ghi thật, và không dòng nào trong bài đơn vị nói tới toast hoàn tác của panel |
| `HistoryPanel·A7` | **`chưa phủ`** — `useHistoryPanel.ts:13,262-276`: nhảy lịch sử là undo/redo trên kho, không phải chỉ đọc |

Và **không** thêm ca riêng: thêm **một khẳng định** vào `V7-ROOMS-03` rằng cùng việc ấy
làm được từ panel. Rẻ hơn một ca mới, và nó lấp đúng ô `A8`.

Đáng ghi lại vì sao chỗ này cần hai vòng: vòng 1 **cả hai vai đều sai**, mỗi vai sai về
phía động cơ của mình — A gọi panel là "chỉ đọc" để cắt, B gọi ô là `chưa phủ` để thêm ca.
Chỉ khi mỗi vai phải đọc bản của vai kia thì mới có người đi mở tệp test ra.

### QA/B-3 — Bảy ca "vai `viewer` từng màn": một ca dùng chung, hay bảy ca?

A cắt bảy ca `forbidden` theo màn, coi chúng là cùng một điều. B gọi đó là nhóm **nguy
hiểm nhất** trong 125 ca A cắt.

| | Phương án |
|---|---|
| **A** | Một ca `forbidden` dùng chung cho vỏ (đăng nhập `viewer@`, khẳng định nhánh chỉ-xem), cộng các ca riêng chỉ ở màn có **cơ chế chặn khác** (`adminUsers` chặn phía client, `/export` chặn ở cổng). |
| **B** | Bảy ca. Mỗi màn tự khai một câu giải thích vai khác nhau, và một câu sai ở một màn thì sáu màn kia không nói ra được. |

**Khuyến nghị: giữa hai bên, nghiêng về A — và đây là chỗ đáng bạn quyết.** `forbidden` là
một trong bảy trạng thái A11, nên nó không phải chỗ tiết kiệm. Nhưng bảy ca khác nhau ở
đúng **một chuỗi chữ** thì đó là việc của một ca sinh-từ-dữ liệu (cùng khuôn với Chặng 1):
một bảng `[màn, chuỗi mong đợi]`, bảy `test()` sinh ra. Lúc ấy A được số ca thấp trên giấy
và B được bảy kết quả độc lập — cùng lối đã giải xong Chặng 1.

---

## Điều cả hai vai đồng ý, và đáng ghi

1. **Kế hoạch có quá nhiều ca ở Chặng 1 và quá ít ca ở chỗ hai lớp gặp nhau.** A muốn cắt
   chặng 1; B muốn thêm ca cho `GlobalShortcutHelp × canvas`, `provider × container`,
   `router × hook`. Hai động cơ ngược nhau chỉ về **cùng một** chỗ: giá trị nằm ở mối nối,
   không ở bề mặt.
2. **`W-3`** (toast tường lộ mã máy `W-000001WALL`) nên là `test.fixme` có điều kiện, không
   phải ca đỏ thường trực. A đề nghị, B đồng ý.
3. **Ca bảo mật không cắt.** A tự đặt `V1-LOGIN-02` (`?next=//evil` rơi về `/`) vào mục
   không-cắt-được, và ghi rõ `safeDestination` **không có bài đơn vị nào**.
4. **Ba chỗ cả hai vai đều ghi "chưa đo"**: `B-SET-NAV` bằng cú bấm liên kết thật (không
   phải `popstate`), `B-HELP-2` (`?` × vùng chọn), `B-PI-A7`. B tự **rút** `B-HELP-2` vì
   chính nó dựng trên suy đoán — đúng cổng của chính B.

---

## Con số cuối, và nó phụ thuộc ba câu trên

| Nếu bạn chọn | Số ca |
|---|---|
| A ở QA/B-1 (không ca đỏ), A ở QA/B-2, A ở QA/B-3 | **~49** |
| B ở QA/B-1 (`test.fixme`), khuyến nghị ở QA/B-2 và QA/B-3 | **~53–56** |
| B ở cả ba | **~64** |

So với **173** ca mà bản lắp ghép đầu tiên chứa. Phần lớn chỗ cắt được đến từ đúng một
quyết định: **Chặng 1 sinh từ dữ liệu thay vì 48 mục viết tay** — và quyết định ấy không
mất bằng chứng nào.


---

# Phụ lục — câu hỏi theo từng nhóm, do worker lớp 2 nêu

Các câu ở trên là câu **cấp kế hoạch**. Phần dưới đây là câu **cấp nhóm** — hẹp hơn, và chỉ
đọc được cùng mục tương ứng trong `plan.md`. Chỗ nào trùng với một câu ở trên thì worker đã
ghi số Q tương ứng.


### Nhóm V1

Mỗi câu kèm số đã đo. Không câu nào có dữ kiện quyết định còn "chưa đo".

**Q1 — Chuẩn nhãn A6: "Đăng nhập" (hoa đầu câu) hay "đăng nhập" (viết thường hoàn toàn)?**
Số đo: login 6 nhãn và onboarding 6 nhãn hoa đầu câu; accessDenied/notFound/mobileViewer 100 % viết thường (ví dụ "bạn chưa có quyền truy cập"). `CLAUDE.md` A6 nói "viết thường, kiểu câu"; `LUAT_MAN_HINH.md` không có câu nào về viết thường (grep = 0).
- **A:** Chuẩn là *hoa chữ đầu câu tiếng Việt thông thường* ("Đăng nhập"); ba màn viết thường là sai ⇒ ca A6 phải chấp nhận hoa chữ đầu, và ba màn kia thành phát hiện.
- **B:** Chuẩn là *viết thường hoàn toàn* ⇒ login/onboarding vi phạm; ca A6 đỏ ở hai màn này (12 nhãn) và ghi thành nợ.
- **Khuyến nghị: B** — A6 trong `CLAUDE.md` viết thẳng "viết thường", ngoại lệ liệt kê cụ thể (mã trục, mã lỗi, tên phím) không có "chữ đầu câu"; ba trên năm màn đã tuân theo. Nhưng đây là quyết định của người duyệt: ca A6 cho login/onboarding **không lập** cho tới khi có đáp án, nên không tạo ca đỏ ngầm.

**Q2 — `mobileViewer` `empty`: khẳng định hành vi hôm nay, hay đánh dấu chờ?**
Số đo: thân 96 ký tự; canvas 300×150; 0 request lấy hình học; hai lượt (mở thẳng / điều hướng client từ màn rooms) đều `empty`; 86 bài đơn vị xanh.
- **A:** Lập V1-MOBILE-01/02/03 khẳng định *không trắng + tên dự án thật + câu rỗng + Esc vô hại*, **không** khẳng định kích thước canvas hay "luôn rỗng". Ca xanh hôm nay và **vẫn xanh khi sản phẩm sửa** (nếu sửa thì `empty` không còn hiện với dự án có hình — ca 01 sẽ đỏ đúng chỗ, báo hiệu cần thêm ca `success`).
- **B:** Chỉ ghi ca thành `test.fail` kèm lý do "route không nạp hình học" + điều kiện mở lại "route truyền nguồn hình học".
- **Khuyến nghị: A** — B biến khoảng trống thành ca "đỏ chủ ý" rồi treo; A giữ được thứ có giá trị (không màn trắng, dây mock API). Chưa cần đo thêm để hỏi câu này. *(Riêng câu "có thử cửa `import('/src/store/index.ts')` để dựng `success` cho mobileViewer không" — dữ kiện quyết định là "cửa đó có nạp được `spatial` cho route `/m/…` sau điều hướng client không", **chưa đo với màn này** ⇒ tôi **không hỏi**; cần đo trước ở chặng 0. Q1 của điều phối đã đo cửa đó cho bảy màn QC.)*

**Q3 — `accessDenied`: giữ ba ca e2e nhỏ hay bỏ vì không ai điều hướng tới?**
Số đo: 0 nơi gọi `ROUTES.accessDenied` ngoài test; 7 bài đơn vị; hai nút → `/` và `/login` (đo mở URL trực tiếp).
- **A:** Giữ V1-ACCESSDENIED-01/02/03 — nhắm vào *dây router thật* (`state.from` → `safeDestination` quay về đúng chỗ) mà đơn vị không chạm.
- **B:** Bỏ cả mục, ghi một dòng "không có luồng tự nhiên, chờ sản phẩm nối".
- **Khuyến nghị: A** — chi phí thấp (ba ca, không cần fixture), và V1-ACCESSDENIED-03 là ca duy nhất chứng minh `state.from` thắng `?next=`. Nếu người dùng chọn B, `login` mất ca V1-LOGIN-03 (đã gộp vào đây).

**Cần đo trước khi hỏi (không hỏi được lúc này):**
- Escape trên `accessDenied`/`notFound`: chưa đo.
- Ca "chưa đăng nhập bị đá về `/login?next=…`": cách dựng trên mock chưa đo (CẦN TỪ V-shell).
- `quay lại` (`navigate(-1)`) khi không có lịch sử: chưa đo.
- Mock có sinh lỗi đăng nhập (`error`/khoá đếm ngược) hay không: chưa đo.

---


### Nhóm V2

Mỗi câu kèm số đã đo. Không câu nào có dữ kiện quyết định còn "chưa đo". (`ConnectionStates` đã là Q10b; không lặp.)

### QV2-1 — Tour hiện theo `resize`: ca e2e kích nó, hay chờ sản phẩm hiện ngay?
**Đã đo:** 0 thẻ sau 4 s và 11 s; bấm, phím `Shift`, lăn chuột đều không kích; `setViewportSize` 1 px kích (walls → `bước 1 trên 4`, viewer → `bước 1 trên 1`; ExportPanel không hiện).
| | Phương án |
|---|---|
| **A** | Ca e2e dùng `setViewportSize` để **kích** tour, và tên ca ghi thẳng điều đó. Xanh hôm nay. |
| **B** | Ca e2e đòi tour **hiện ngay lúc tải**. Đỏ hôm nay; đòi sửa sản phẩm. |
**Khuyến nghị: A**, kèm phát hiện 1. Người dùng thật cuộn/đổi cỡ là có thật; kiểm tra "tour tự hiện" đòi một sự kiện mà sản phẩm hôm nay cần.

### QV2-2 — `Escape` ở `/thong-bao` khi vào thẳng đưa trình duyệt ra ngoài: khẳng định hành vi này, hay đòi "không rời app"?
**Đã đo:** vào thẳng + `Escape` ⇒ `about:blank` (thân 0 ký tự); đến từ `/projects/project-1/3d` + `Escape` ⇒ về `/projects/project-1/3d`.
| | Phương án |
|---|---|
| **A** | Ca kiểm **đường "đến từ màn khác"** (Esc quay về đúng chỗ) — xanh; ghi "vào thẳng thì rời app" thành phát hiện 3. |
| **B** | Ca kiểm **vào thẳng + Esc không rời app**. Đỏ hôm nay; đòi sửa sản phẩm. |
**Khuyến nghị: A** cho lượt này. Nhưng đây là một thay đổi sản phẩm đáng cân nhắc (liên kết chia sẻ/tải lại tới `/thong-bao` là đường thật).

### QV2-3 — `Đánh dấu tất cả đã đọc` không có toast/hoàn tác: A8 áp dụng hay không?
**Đã đo:** 0 toast, 0 `role="alert"`, 0 nút hoàn tác; nút thành `disabled`; status thành `không có thông báo nào` (phát hiện 4).
| | Phương án |
|---|---|
| **A** | Coi đây là **nợ A8** (`chưa phủ`) và phát hiện; không viết ca e2e cho toast. |
| **B** | Coi "đánh dấu đã đọc" **ngoài phạm vi** A8 (không phải thay đổi dữ liệu đáng hoàn tác); ghi `không áp dụng` kèm lý do. |
**Khuyến nghị: A.** `CLAUDE.md` A8 nói "mọi thay đổi hoàn tác được"; nếu nó chỉ áp dụng cho dữ liệu dự án thì đó là quyết định của người, không phải của tôi. Bảng coverage hiện ghi `chưa phủ` theo A.

### QV2-4 — Ca "không lỗi console" cho `/thong-bao`: cho phép 404 luồng SSE, hay loại màn này?
**Đã đo:** đúng 2 lần `404 /api/streams/notifications`, không lỗi nào khác (`errors` của bộ dò: 1 dòng).
| | Phương án |
|---|---|
| **A** | Ca quét console **cho phép** đúng URL ấy (danh sách trắng một dòng, có ghi chú "mock không có SSE"). |
| **B** | Loại `/thong-bao` khỏi ca quét console. |
**Khuyến nghị: A** — giữ ca bắt lỗi mới ở màn này, và danh sách trắng có tên để bị bỏ khi mock được bổ sung.

**Số câu hỏi A/B: 4.**

---


### Nhóm V3

Mỗi câu kèm số đo, hai phương án A/B, khuyến nghị. Câu nào cần đo thêm thì nằm ở "cần đo trước" cuối mục.

**Q1 — Danh sách dashboard là 3 dự án viết cứng: ghi nợ, hay đặt ca đỏ có chủ đích?**
Số đo (V3, đọc lại nguồn ở đo lớp 2): 3 dự án viết cứng (`projectsGateway.ts:57,100-101`); tạo dự án xong lưới vẫn **"3 dự án"** trước và sau `reload`; xoá xong `reload` thì thẻ trở lại; 3 mã dashboard ≠ mã mock API (`project-1`).
- **A.** Ghi nợ (trường 13 của mục dashboard), **không** ca "tạo → thấy trong danh sách". Ô coverage-map ghi lý do; mở lại khi `fetchList` nối API.
- **B.** Đặt một ca đỏ có chủ đích khẳng định "tạo xong thì thẻ mới xuất hiện", kèm `test.fixme` có lý do "danh sách là bộ mẫu viết cứng" và điều kiện mở lại "khi `fetchProjectList` đọc từ `api.projects.list`".
- **Khuyến nghị: A.** Bộ e2e có ca đỏ thường trực làm giảm tin cậy của mọi ca xanh; mục 0.1 đã có `file:dòng` đủ cho người duyệt. Nhưng để không mất dấu, giữ **một dòng trong `questions.md`** (đây) và ô `chưa phủ` nếu người duyệt chọn A.

**Q2 — `ShareDialog` chỉ mở được qua cửa nạp-kho và luôn `error`: lập một ca mở/Esc/Tab, hay để `chưa phủ` hoàn toàn?**
Số đo (V3 + đo lớp 2): `ExportPanel` `empty` trên mock, **0 nút** cho tới khi tiêm **cả `setSpatial` lẫn `setFloors`**; khi mở, hộp thoại vào `error` ("thao tác chia sẻ đã bị huỷ"); `page.route(/share-links/)` thấy **0 yêu cầu** ⇒ không dựng được nhánh dữ liệu nào; Esc đóng đúng nó và Tab 30 lần không rời hộp thoại (V3 đo, sau khi tiêm).
- **A.** Lập **một** ca V3-SHARE-1 (mở qua cửa → Esc → Tab-không-rò), ghi thẳng trong tên ca rằng nó tiêm kho và chỉ chứng minh A12, không chứng minh chia sẻ.
- **B.** Không ca nào; ShareDialog chỉ là một mục kế hoạch + ô `chưa phủ` kèm điều kiện mở cổng (khớp `questions.md` Q10 phương án A).
- **Khuyến nghị: B nếu Q1 của `questions.md` chọn B; A nếu nó chọn A/ngoại lệ hẹp.** Hai câu cùng một quyết định (cửa). Bằng chứng để chọn: 1 ca duy nhất có giá trị A12 thật, nhưng nó **không** chạm điều nghiệp vụ (chia sẻ), nên "xanh" dễ bị đọc là "chia sẻ chạy được".

**CẦN ĐO TRƯỚC KHI HỎI (chưa thành câu hỏi được):**
| Việc | Còn thiếu gì |
|---|---|
| Đổi tên/nhân bản ở dashboard có toast + `Hoàn tác` trên trình duyệt thật không | V3 không đo (chỉ đọc `useProjectDashboard.ts:383,395`). Cần một lượt đo trước khi lập ca A8 dashboard |
| Toast "Đã xoá dự án." ở settings sống được bao lâu sau điều hướng | V3 chỉ chờ 1,5 s; cần đo nhiều mốc trước khi kết luận F4 |
| `aria-disabled` của mục "Xoá" với viewer (F6) | chưa đo |
| Cơ chế vì sao `page.route` không thấy `share-links` (mock `fetchImpl`?) | nguyên nhân chưa xác minh |
| `error`/`collapsed` của settings và `error` của CreateProjectModal | V3 nói cách dựng trên mock "chưa đo"; không lập ca cho tới khi đo |

**CẦN TỪ nhóm khác:**
- **CẦN TỪ V12 (ExportPanel):** V12 có khẳng định cách nào (không cửa dev) để `/projects/:id/export` thoát `empty`? Đo lớp 2 của tôi xác nhận cần `setSpatial` **và** `setFloors`; V12 nên ghi nửa còn lại. Và `EditorTour` mount ở ExportPanel — có hiện khi mở panel không?
- **CẦN TỪ V-shell/Tabs (nếu có):** `src/components/ui/Tabs` có roving-tabindex do component hay do màn (V3-SET-3)?
- **CẦN TỪ V1 (`WelcomeScreen`):** bước tạo dự án hoàn chỉnh ở onboarding (toast ở `Toast.Provider` riêng) — V3 chưa đo; V1 đã đo `WelcomeScreen` nhưng không tới bước tạo.
- **CẦN TỪ điều phối:** `smoke.spec.ts` xanh/đỏ — tôi không chạy `pnpm e2e` ("chưa chạy"); ghi nhận: cổng tổng báo 18/18 xanh (HOP-DONG mục 0).


### Nhóm V4

Ba câu, mỗi câu có số đã đo. Không câu nào dựa vào dữ kiện đang ghi "chưa đo".

### Q1 — Tệp mẫu cho `projectUpload`: sinh tại chỗ hay commit tệp thật?
**Số đo [V4 mục 2]:** repo có **0** tệp bản vẽ `.png/.jpg/.pdf/.dwg`; `validateUploadFile` chỉ xét đuôi + kích thước, riêng PDF đọc `%PDF-` + đếm `/Type /Page`; PDF 3 trang dựng tại chỗ dài **121 B** → màn hiện "3 trang", combobox "Chọn trang" (đã chạy thật); tên tệp quyết định ghép tầng (`tang-2`, `tang-3`, `tang-ham` ghép đúng, `ban-ve.png` không); đo 6 tệp một lượt: ghép đúng.
- **A.** Sinh tại chỗ bằng `Buffer` trong spec. Ưu: không nhị phân trong git, tên tệp tự quyết. Nhược: không phải ảnh hợp lệ — nếu sau này màn giải mã ảnh thì hỏng.
- **B.** Commit một PNG/PDF thật vào `e2e/fixtures/`. Ưu: gần thực tế. Nhược: nhị phân trong git, và hiện **không** có chỗ nào dùng nội dung.
- **Khuyến nghị: A.** Hiện không đường nào đọc nội dung ảnh; B trả giá lưu trữ cho một lợi ích chưa tồn tại.

### Q2 — Ca "Tiếp tục xử lý" khi ô xác nhận chưa tích: khẳng định gì?
**Số đo [V4]:** chọn Tầng 1 (mức Kém) → dòng chặn hiện → bấm nút khi ô **chưa tích** → URL đổi sang `/projects/project-1/pipeline` (1/1 lần đo). Mã: `onContinue` không kiểm `canContinue` (`useInputQualityGate.ts:1126` [✓]) và tài liệu ghi nút "luôn bấm được" (`InputQualityGateFooter.tsx:4-9` [✓]); ca đơn vị tên "chặn cho tới khi tích ô" (`:410` [V4]).
- **A.** Viết ca khẳng định **ý định** ("chưa tích thì không sang `/pipeline`"). Nó **đỏ ngay** ⇒ phát hiện chính thức; nếu giữ trong bộ thì phải là `test.fixme` kèm lý do + điều kiện mở lại.
- **B.** Chỉ khẳng định phần đã chắc: dòng chặn hiện khi chưa tích; sau khi **tích** ô thì "Tiếp tục xử lý" sang `/pipeline`. **Không** khẳng định điều gì về bấm khi chưa tích, cho tới khi người chốt ý định của nút.
- **Khuyến nghị: B.** A ghim một ý định mà chính mã và tài liệu của màn nói ngược lại; người quyết định (không phải test) nên chốt trước.

### Q3 — Chuỗi upload → xử lý: e2e khẳng định gì ở màn đích?
**Số đo [V4]:** tải đủ 4 tầng → "Bắt đầu xử lý" → `/projects/project-1/pipeline` → "Chưa có bước nào để theo dõi … Đã xong **0/0** tầng" (1/1 lần đo; cả hai rào của mục 0a là mã, đã đọc).
- **A.** Ca chỉ khẳng định URL đích và màn không trắng (`navigation` "Xử lý" + nút chạy nền có mặt); **không** khẳng định chữ `0/0`.
- **B.** Ghim hiện trạng: khẳng định "Chưa có bước nào để theo dõi" / "Đã xong 0/0 tầng".
- **Khuyến nghị: A.** B biến khiếm khuyết P2 thành hành vi được bảo vệ và sẽ đỏ đúng lúc sản phẩm được sửa.

---


### Nhóm V5

Mỗi câu kèm số đã đo; không câu nào có dữ kiện quyết định còn "chưa đo".

### Q-V5-1 — `projectPipelineGraph`: giữ hai ca phiên-vai, hay bỏ hẳn?
**Đã đo:** nội dung 525 ký tự là chữ tĩnh; 0 nút; 0 canvas; `engineer` và `viewer` cùng ra câu `Chế độ chi tiết kỹ thuật chỉ mở cho vai quản trị…`; chỉ `admin` ra `empty`; 21 bài đơn vị dày; năm cổng đọc `unsupported`.
| | Phương án |
|---|---|
| **A** | Giữ **một mục ngắn, hai ca** (`forbidden` theo phiên, `empty` cho admin) — đây là thứ chỉ phiên thật chứng minh. |
| **B** | **Bỏ** mục, dựa vào ca "mở được cả 35 màn không trắng" của lưới an toàn (chặng 1). Đỡ 2 lượt đăng nhập. |
**Khuyến nghị: A.** Cổng vai là thứ e2e duy nhất làm thêm được ở đây, và chi phí hai ca nhỏ. Nhưng nếu cần cắt phạm vi, đây là mục rẻ nhất để cắt.

### Q-V5-2 — `projectCadConfirm`: tiêu điểm đầu ở `Đóng hộp thoại`, không phải nút chính — khẳng định hiện trạng hay đòi sửa?
**Đã đo:** hộp thoại mở ⇒ tiêu điểm vào nút `Đóng hộp thoại`; `Escape` đóng ⇒ tiêu điểm về heading `Phát hiện tệp CAD`; mã thừa nhận "Nút chính KHÔNG tự nhận tiêu điểm" (`CadBranchConfirmDialog.tsx`, đầu tệp).
| | Phương án |
|---|---|
| **A** | Ca khẳng định **hiện trạng** (tiêu điểm đầu ở `Đóng hộp thoại`; đóng thì về heading). Xanh hôm nay. |
| **B** | Ca đòi tiêu điểm đầu vào **nút chính**. Đỏ hôm nay; đòi sửa sản phẩm. |
**Khuyến nghị: A** cho lượt này, ghi nhận như đã thừa nhận trong mã. Nếu muốn B, đó là quyết định sản phẩm.

### Q-V5-3 — Tên phím ở `projectScale`: `ESCAPE` (HOA) và `Esc` cùng màn — khẳng định cả hai, hay đòi một kiểu?
**Đã đo:** dòng nhắc `ESCAPE huỷ đoạn đang kéo · R đo lại · ENTER xác nhận · ARROWLEFT nhích…`; ô phím `Esc`, `Shift`, `R`, `Enter`. A6 cho phép chữ hoa ở **tên phím**.
| | Phương án |
|---|---|
| **A** | Ca A6 **chấp nhận cả hai** (ngoại lệ tên phím), ghi phát hiện 6. Xanh. |
| **B** | Ca đòi một kiểu duy nhất. Đỏ hôm nay; đòi sửa sản phẩm. |
**Khuyến nghị: A.** Không vi phạm A6 theo chữ; B chỉ là nhất quán thẩm mỹ.

---


### Nhóm V6

Ba câu; câu nào cũng có số đã đo. Không hỏi câu nào mà dữ kiện quyết định còn "chưa đo".

### Q1 — Có viết ca luồng cho bốn màn QC-a bằng cửa nạp-kho (dev) không?
**Số đo:** trước tiêm skeleton 61 · 16 · 16 · 24; sau tiêm 0 · 0 · 0 · 0 ([V6] mục 0, cả bốn có số). Cổng đọc chỉ đọc lại kho (`wallLayerReviewGateway.ts:326-328`, `:357`). Không có đường đọc `spatial.layer` ở mock (`__mocks__/client.ts:1210-1219` [V6]) ⇒ `page.route` không thay được. Bài đơn vị của bốn màn: 61 · 42 · 35 · 27 = 165. Cửa `import('/src/store/index.ts')` **chỉ có ở máy chủ dev**.
- **A.** Dùng cửa nạp-kho làm fixture chặng 0 (`seedQcGraph`, tiêm SAU `goto`, đúng mã tầng); mọi tệp spec của bốn màn mở đầu bằng dòng "bài nạp-kho — không chứng minh tải từ máy chủ". Giá: phụ thuộc dev server; chỉ có ~4 ca có ý nghĩa (W-1, W-2, D-1, G-1) cộng 2–3 ca chờ đo.
- **B.** Không viết ca luồng nào cho bốn màn cho tới khi có cửa chính thức (đường đọc `spatial.layer` vào `ApiClient`+mock, hoặc `*Route` nhận `gateway` từ chỗ tiêm được, hoặc `window.__appfrontStore` chỉ-dev — [V6 mục 0]). Bốn màn chỉ giữ ô coverage-map hiện tại (đơn vị).
- **Khuyến nghị: A**, nhưng **giữ ở bốn ca** và không mở rộng. Lý do: W-1 đã đo trọn vẹn (xoá → 47 → `Ctrl+Z` → 48) — bỏ nó là bỏ chứng cứ duy nhất của nhóm rằng sổ phím toàn ứng dụng hoạt động trên màn QC thật. B đúng về nguyên tắc nhưng để nhóm trắng khỏi e2e vô thời hạn.

### Q2 — A6: chữ hoa đầu câu có phải vi phạm không? (quyết định ca quét chữ)
**Số đo:** trong nhóm này — tường: `Duyệt lớp tường`, `Cây lớp`, `Thanh trạng thái`, **`Ẩn lớp Tường`** (hoa giữa câu); kích thước: `Bản vẽ lớp kích thước OCR`, `Kích thước đọc được`; trục: `Căn chỉnh tự động`; đối tượng viết thường (`lớp đối tượng`, `cây lớp`) [V6 F7]. Ngoài nhóm (đo V1/V3 cùng đợt): dashboard `Dự án của tôi`, `Dự án mới`, login `Đăng nhập`, `Thư điện tử`; còn cài đặt dự án viết thường (`tên dự án`, `cài đặt dự án`). Quy tắc: `CLAUDE.md` A6 — "viết thường, kiểu câu. Ngoại lệ chữ hoa: mã trục, mã lỗi, tên phím".
- **A.** Đọc nghiêm: chữ đầu cũng viết thường ⇒ ca quét đỏ trên hàng chục nhãn ở nhiều màn (không chỉ nhóm này).
- **B.** Đọc "kiểu câu" = hoa chữ đầu câu được; ca chỉ bắt chữ hoa **giữa câu** (như `Ẩn lớp Tường`) và mã máy lọt lên giao diện (P2).
- **Khuyến nghị: B** cho e2e, vì A biến nợ toàn ứng dụng thành hàng chục ca đỏ ở một nhóm (cùng tinh thần "cấm biến nợ A6 thành 16 ca đỏ"). Đề nghị người dùng chốt câu chữ của A6 ở `CLAUDE.md` trước khi ca quét được viết.

### Q3 — Ca "nói thật về tự lưu" của tường: ghim hiện trạng hay bỏ tới khi có endpoint?
**Số đo:** sau xoá, thanh trạng thái đọc "Có thay đổi chưa lưu" ở 0 s **và vẫn ở 1,3 s** ([V6 F3]); `persistWallLayer` NOT FOUND (`wallLayerReviewGateway.ts:39` [✓]); nút chứa chữ "lưu": 0/35 màn (HOP-DONG mục 2). Sau chuỗi thử lại 5/15/45 s hiện gì: **chưa đo** — nhưng không quyết định câu này (ca W-2 chỉ khẳng định KHÔNG có chữ `/Đã lưu/`).
- **A.** Viết W-2: khẳng định màn **không** nói "Đã lưu" khi chưa lưu (đúng chữ `vi.json:68` là bonus, không bắt buộc). Mở lại/đổi khi có endpoint. Ca không pin chữ "Có thay đổi chưa lưu" cứng, để đổi câu chữ không làm đỏ.
- **B.** Không viết ca A7 cho tường; để A7 tường là `chưa phủ` cho tới khi có endpoint.
- **Khuyến nghị: A** — ca này bảo vệ đúng thứ nguy hiểm nhất (nói dối "đã lưu") và không đỏ khi sản phẩm sửa đúng hướng (khi có endpoint, chữ `Đã lưu lúc …` sẽ hiện và ca phải được đổi thành khẳng định 800 ms — cần người duyệt xác nhận lúc đó, không tự đổi).

---


### Nhóm V7

Không câu nào có dữ kiện quyết định còn "chưa đo". Cửa nạp-kho (Q1 của `questions.md`) đã hỏi ở nơi khác — **không lặp**.

**Q1 — Ca A15 của phòng: khẳng định *giá trị* `248,60 m²` hay chỉ *định dạng* `\d+,\d{2} m²`?**
Số đo: rooms hiện `248,60 m²` (12 × 17,00 + 18,40 + 26,20). `CLAUDE.md` A14 ghi khai 248,60 nhưng đo hình học 238,00 và "chưa chốt cái nào là chuẩn"; bộ mẫu rooms là bộ riêng, `R-014 = 26,20` (A14 nói 27,60 khai / 17,00 đo); tầng đơn vị đã khẳng định 248,60 (`RoomLabelReview.test.tsx:245`).
- **A:** ca chỉ khẳng định *dấu phẩy ở vị trí thập phân* (`^\d{1,3}(\.\d{3})*,\d{2} m²$`) và quét không có `\d\.\d{2}\b`; **không** ghim 248,60.
- **B:** ghim `248,60 m² · 14 phòng` (bộ mẫu riêng của màn).
- **Khuyến nghị: A.** Đơn vị đã ghim giá trị; ghim nó ở e2e nữa nghĩa là đổi con số A14 chưa chốt thành hai bài đỏ cùng lúc khi người dùng chốt 238,00.

**Q2 — `Ctrl+Z` khi tiêu điểm trong ô "Tên phòng": khẳng định hành vi đo được hay hành vi mong muốn?**
Số đo: sau `Enter`, tiêu điểm ở `INPUT`, `Ctrl+Z` **không** đổi tên (giữ "Phòng thử e2e"); sau `blur()` `Ctrl+Z` trả "phòng khách chung". A12: "bàn phím là đường hạng nhất".
- **A:** ca khẳng định như đo ("trong ô nhập `Ctrl+Z` không hoàn tác; ngoài ô nhập thì có"), tên bài nói thẳng điều đó. Xanh hôm nay.
- **B:** ca khẳng định `Ctrl+Z` hoàn tác cả trong ô nhập. Đỏ hôm nay, đòi sản phẩm sửa.
- **Khuyến nghị: A.** Có thể cố ý (giữ hoàn tác nội bộ của ô văn bản, như mọi ứng dụng); biến nó thành bài đỏ là quyết định sản phẩm, không phải hệ quả phụ của bài kiểm. Nếu bạn muốn B, đó là một thay đổi sản phẩm cần chủ.

**Q3 — Floors "loading mãi": có ghim hiện trạng bằng một ca không?**
Số đo: mở thẳng `/projects/project-1/floors` → **17 skeleton, 0 hàng tầng, 0 chữ "0 tầng"** (`useFloorManager.ts:570`); hai câu nợ `role="status"` vẫn hiện.
- **A:** ca V7-FLOORS-01 khẳng định *có hai câu nợ, có `region 'quản lý tầng'`* và **thêm** "không có hàng tầng nào sau chờ" (ghim loading mãi) — đỏ khi sản phẩm sửa, là tín hiệu để thêm ca `success`.
- **B:** chỉ khẳng định hai câu nợ + region, **không** đụng số skeleton/hàng.
- **Khuyến nghị: B.** Ghim "không có hàng" biến một lỗi sản phẩm thành bài xanh cần bị gỡ khi sửa; hai câu nợ là thứ có giá trị lâu dài. F-R2 đã ghi hiện trạng ở PHÁT HIỆN.

**Cần đo trước khi hỏi (không hỏi được lúc này):**
- Luồng "Áp dụng" của thickness không đổi độ dày (nguyên nhân): chưa đo.
- Gộp/tách phòng (V7-ROOMS-05): `Huỷ`/`Gộp hai phòng` làm gì trên trình duyệt; `Tách phòng` có mở được ở bộ mẫu không (`splitPointMm` null ở đơn vị): chưa đo.
- Ghi thật của floors (thêm/xoá/nhân bản/đổi thứ tự) và toast: chưa đo.
- Esc ở rooms/floors, `viewer` cả ba, `Ctrl+S` có chạm `createAutosave` của rooms/thickness: chưa đo.
- Thickness với `L1` khi có dữ liệu; URL của lỗi console 404 ở rooms: chưa đo.

---


### Nhóm V8

Mỗi câu kèm số đã đo, hai phương án A/B, khuyến nghị. Câu nào cần đo thêm ghi ở cuối câu.

**Q1 — Ca Esc-xếp-lớp khẳng định thứ tự nào? (A12, trả lời "câu 3 của nhóm")**
Số đo (V8, 8 hàng S1–S8, mỗi hàng một context sạch): giữa `sidePanel` và `canvas` thứ tự do **phạm vi** quyết, không do thời điểm mở (S1 và S2 cùng kết quả dù mở ngược nhau: bảng phụ → thoát chế độ sửa → bỏ chọn); cùng phạm vi thì **LIFO** theo thời điểm bật (S7/S8). Lớp phủ sửa hình học **nhìn thấy nằm trên cùng** nhưng Esc1 đóng **bảng phụ ở cột phải**.
- **A.** Khẳng định thứ tự PHẠM VI như đã đo, ghi rõ trong tên ca. Xanh hôm nay.
- **B.** Khẳng định thứ tự THẤY ĐƯỢC (lớp phủ trên cùng đóng trước). Đỏ hôm nay; đòi sửa sản phẩm.
- **Khuyến nghị: A.** `viewerShellShortcuts.ts:28-34` và `Viewer3DPanels.tsx:32-37` ghi đây là chủ ý; B là đòi đổi luật A12 ("lớp trên cùng" = phạm vi cao nhất).

**Q2 — Panel đọc kho (PropertyInspector, RoomAreaPanel) chỉ ra `loading`: e2e chấp nhận hay dùng cửa nạp-kho?**
Số đo: `RoomAreaPanel` `aria-busy=1` sau 15 s, `PropertyInspector` "Đang tải…" sau 8 s (V8). **Đo lớp 2 (một lần, `RoomAreaPanel`):** `import('/src/store/index.ts')` + `setSpatial(normalizeSpatial(VIEWER_FIXTURE_GRAPH))` ⇒ 0 `aria-busy`, panel hiện `248,60 m² · 14 phòng · theo tầng 80,00/70,00/60,00…`. Cần chuẩn hoá; đồ thị thô làm nút bật biến mất. `PropertyInspector` với cửa ấy: **chưa đo** — cần đo trước nếu chọn A.
- **A.** Dùng cửa nạp-kho (dev-only, chạm nội bộ) để có `success` cho RoomAreaPanel (và PropertyInspector sau khi đo); ghi rõ trong tên ca đây là bài "tích hợp bằng nạp kho", không chứng minh tải từ máy chủ.
- **B.** Chỉ kiểm `loading` + không trắng (RA-1, PI-1e); `success` để tầng đơn vị.
- **Khuyến nghị: A cho RoomAreaPanel** (đã đo, cho A15 thật), **B tạm cho PropertyInspector** cho tới khi đo với đồ thị này. Cần đo trước: PropertyInspector với `VIEWER_FIXTURE_GRAPH` đã chuẩn hoá — chọn phòng `R-011` rồi đọc panel.

**Q3 — Kéo-thả thư viện khoá với admin và câu giải thích nói sai: ghi nợ hay có ca đỏ có chủ đích?**
Số đo (V8, đo `admin@example.com`): câu khoá "…vai chỉ xem…" hiện; mỗi thẻ "Chỉ xem được, không kéo vào bản vẽ." — **1 nguyên nhân mã** (`useFurnitureLibraryPanel.ts:302`, `FurnitureLibraryPanel.container.tsx:118`, `Viewer3DPanels.tsx:269-273`).
- **A.** Ghi nợ (F2), không ca — ca "admin kéo được" sẽ đỏ đến khi ai đó nối `onUploadModel`.
- **B.** Một ca đỏ có chủ đích khẳng định "admin kéo được", kèm `test.fixme` có điều kiện mở lại ("khi `Viewer3DPanels` truyền `onUploadModel`").
- **Khuyến nghị: A.** Ca đỏ thường trực làm giảm tin cậy của bộ e2e; F2 đã có `file:dòng` để người duyệt xử lý.

**Q4 — Tour trên `projectViewer`: nhiễu cần dọn hay bề mặt kiểm riêng?**
Số đo (V8, 9 tác nhân, mỗi cái một context sạch): 0 lớp phủ sau idle/di chuột/gõ/cuộn; **4 mảnh `.bg-bg-overlay`** sau bấm canvas, đổi cỡ cửa sổ, hoặc mở Lịch sử/Diện tích/Thư viện; Playwright báo `subtree intercepts pointer events` lặp 26 lần đến hết 30 s.
- **A.** Là nhiễu: fixture "bỏ qua tour" (BO-SUNG 7.7 đã chốt "cần") bấm nút `bỏ qua` nếu thấy, mọi ca 3D dùng.
- **B.** Là một bề mặt kiểm riêng (V2) chạy **trước** mọi ca 3D, và fixture của nhóm 3D chỉ dựa vào kết quả V2.
- **Khuyến nghị: cả hai, tách vai** — fixture (A) cho 6 mục của nhóm này; ca tour thật (B) sống ở V2. Nhóm V8 không tự kiểm tour.

**Q5 — Ca A15 ghim con số nào: 248,60 hay 238,00? (A14)**
Số đo: vỏ 3D `4 tầng · 14 phòng · 248,60 m²` (đo lớp 2); RoomAreaPanel `248,60` (đo lớp 2, sau tiêm); `RoomLabelReview` `248,60` (V7); `createSampleBuilding()` đo hình học bằng `totalArea()` = **238,00** (CLAUDE.md, A14). Hai con số đến từ hai nguồn khác nhau; **CLAUDE.md nói chưa chốt cái nào là chuẩn**.
- **A.** Ghim `248,60` — khớp mọi màn ở e2e (cả ba màn đo đều dùng bộ mẫu riêng cho ra số này).
- **B.** Ghim `238,00` — số đo hình học thật; đỏ ở mọi màn hôm nay.
- **Khuyến nghị: A cho e2e**, kèm ghi chú "số này là của bộ mẫu riêng của màn (F9), không phải kết luận A14"; việc chốt A14 là của người duyệt.

**CẦN TỪ nhóm khác:**
- **CẦN TỪ V-Exploded/Measure (`projectExploded`/`projectMeasure`):** view `ViewerShell` ở đó có mang tour và `inspectorSections` không? (V8 CẦN TỪ, tôi không đo.)
- **CẦN TỪ V2 (`EditorTour`):** có màn chủ nào ngoài `projectViewer` cũng có tour hiện trễ do "neo/phím xuất hiện" (`useEditorTour.ts:480-483`)?
- **CẦN TỪ điều phối:** `viewer3d.spec.ts` (7 bài) xanh hay đỏ trên nhánh này — tôi không chạy `pnpm e2e` ("chưa chạy"); ghi nhận: cổng tổng báo 18/18 xanh (HOP-DONG mục 0), không tách theo tệp.


### Nhóm V9

Đánh số nối tiếp `questions.md` là việc của điều phối; ở đây dùng `Q-V9-n`. Câu nào phụ thuộc Q1 có sẵn ghi rõ.

### Q-V9-1 — Bốn nhãn quảng cáo phím không có phím (R/H/C/V)
**Đã đo.** Trên `measure` và `exploded`, ray công cụ có 6 nút; sổ đăng ký trong trang có 18 mục (exploded) / 21 mục (measure) (`canvas`: `1-4`, `0`, `O`, `Shift+H`, `Alt+H`, `F`, `E`, `M`, `/`…). Bốn nút có phím ghi trong `aria-label` (`R`, `H`, `C`, `V`) **không có mục nào**; bấm `r`,`h`,`c`,`v` — `aria-pressed` không đổi. Chỉ `M` và `Alt+H` là thật.

| | Phương án |
|---|---|
| **A** | Ghi **một** ca đỏ có chủ đích: "mọi nhãn có phím trong ngoặc phải có mục đăng ký tương ứng" (quét sổ đăng ký so với nhãn ray). Xanh khi sản phẩm nối R/H/C/V; đỏ hôm nay, kèm nợ. Đây là ca A12 *thật* duy nhất chứng minh được lỗi này. |
| **B** | Chỉ kiểm `M` (và `Alt+H` khi có chọn); ghi bốn nhãn còn lại vào PHÁT HIỆN, không ca nào đỏ. |

**Khuyến nghị: A**, nhưng **một** ca gộp chứ không bốn (cùng nguyên tắc "đừng biến nợ thành 16 ca đỏ" của Pascal). Đỏ ở đây = người dùng bàn phím bấm `R` thấy không gì xảy ra dù nhãn hứa.

### Q-V9-2 — Nút "thoát chế độ đo (phím Esc)" chỉ bỏ nháp
**Đã đo (V9 + lớp 2, lần này có nháp thật sau bơm):** `m` → bấm một điểm ⇒ nút `ghim phép đo (phím Enter)` xuất hiện; `Escape` ⇒ nút ấy biến mất, ray **vẫn** `đo (M)`. Bấm nút `thoát chế độ đo (phím Esc)` cho cùng kết quả.

| | Phương án |
|---|---|
| **A** | Ca khẳng định hành vi **hiện tại** (Esc = bỏ nháp, giữ công cụ), tên ca nói thẳng "Esc bỏ nháp chứ không thoát công cụ". Xanh hôm nay. |
| **B** | Ca khẳng định nhãn nói gì làm nấy: Esc **thoát** công cụ. Đỏ hôm nay, đòi sửa sản phẩm. |

**Khuyến nghị: A.** Sửa nhãn hay hành vi là việc sản phẩm, không phải của một ca kiểm. Nhưng phải là quyết định của người, không phải hệ quả của một ca. *(Câu này chỉ trả lời được vì lớp 2 đã đo nháp; lớp 1 ghi "chưa đo" nên đã không hỏi được.)*

### Q-V9-3 — Cửa bơm kho cho `exploded`/`measure`: dùng hay chỉ kiểm `empty`
Nối **Q1** của `questions.md` (V6 đã hỏi cho bảy màn QC). **Đã đo:** bơm `VIEWER_FIXTURE_SPATIAL` làm canvas `300×150 → 960×362` (`exploded`), `→ 960×460` (`measure`), thanh trạng thái `0 tầng · 0 phòng · 0,00 m²` → `4 tầng · 14 phòng · 248,60 m²`, không `pageerror`. Không bơm: `exploded` chỉ kiểm được vỏ + `empty`; `measure` chỉ vỏ + `error`.

| | Phương án |
|---|---|
| **A** | Dùng cửa bơm (một fixture `seedSpatial` dùng chung V6/V9). Mở khoá ca `[bơm]` X-2, X-3, X-4, M-3. Chỉ chạy ở dev. |
| **B** | Không bơm. V9 chỉ còn X-1, M-1, M-2, O-1, O-2 và các ca `forbidden`. |

**Khuyến nghị: A**, cùng câu trả lời với Q1 (nếu Q1 chọn B thì V9 cũng B, không hỏi lại). Điều mất khi B: "cảnh dựng thật" và "phím `E`/`Space` chạy thật" của tách tầng không còn ca nào.

### Cần đo trước khi hỏi (chưa thành câu được)
| Việc | Còn thiếu gì |
|---|---|
| Ghim/xoá/hoàn tác phép đo (A8) | cần `page.route` cho `ENDPOINTS.measurements.*` (`src/api/endpoints.ts:116`) *và* cảnh dựng; ghim thật POST mock ra sao: **chưa đo** |
| Mũi tên đổi radio ở `overlay` (O-3) | chưa thử `ArrowRight` sau `Tab`; quyết định ô A12 của `projectOverlay` |
| `disabled` thật của điều khiển overlay ở vai viewer | mới đo chữ `bạn không có quyền sửa, các điều khiển đang tắt.` |
| Overlay có ảnh quét | cần mock `quality.assess` trả ảnh; điều phối có muốn dựng không |
| `Alt+H` trên `measure` | cần có đối tượng chọn |
| Nguồn 404 console lượt đầu của `exploded` | không tái hiện |


### Nhóm V10

Hai câu, mỗi câu có số đã đo. Dữ kiện quyết định của cả hai đã đo (không câu nào dựa vào "chưa đo").

### Q1 — Bốn số Pascal lệch A14: bộ mẫu nào là chuẩn cho màn Pascal (và vỏ 3D)?
**Số đo:**

| | Pascal in ra (đo) | A14 (`sampleBuilding.ts`) |
|---|---|---|
| tầng | 4 | 4 ✓ |
| tường | **16** | **48** ✗ |
| ô mở | **0** | **16** ✗ (9 cửa + 7 cửa sổ) |
| phòng | 14 | 14 ✓ |

Nguồn: `VIEWER_FIXTURE_GRAPH` (`viewerShellFixture.ts:304`): 4 tầng × 4 tường bao = 16 (`:286-288`), `openings: []` (`:308`), `furniture: []`; cùng 4 tầng · 14 phòng · 248,60 m² (`:1-3` [V10]). Bộ này được **dùng chung** bởi `Viewer3D` và `PascalViewer` (`viewerShellGateway.ts:308-314`). Docblock của fixture nói lý do: "Vỏ không soát tường… Thêm tường ngăn vào đây là dựng dữ liệu mà không màn nào của vỏ đọc". Bộ đổi dữ liệu không làm mất số (P2).
- **A.** Coi `VIEWER_FIXTURE_GRAPH` là chuẩn của **màn vỏ/Pascal**; A14 là chuẩn của bộ mẫu miền (`domain`). e2e khẳng định `tầng 4` · `phòng 14` (khớp cả hai) và, nếu cần khẳng định `tường`/`ô mở`, dùng **một hằng** dẫn `file:dòng` `viewerShellFixture.ts:286-288,308`.
- **B.** Coi A14 là chuẩn cho mọi màn: màn Pascal (và vỏ 3D) phải đọc `createSampleBuilding()` (48 tường · 16 ô mở). e2e khẳng định 48/16, **đỏ ngay** cho tới khi màn được đổi (không sửa mã để xanh); các ca cửa/cửa sổ/đồ đạc mới có bề mặt để kiểm.
- **Khuyến nghị: A** cho kế hoạch e2e hiện tại — nó không đòi sửa sản phẩm và không ghim con số vào một quyết định chưa có; **nhưng** người duyệt cần biết hệ quả: dưới A, màn Pascal **không bao giờ** được e2e kiểm cửa/cửa sổ/đồ đạc. Nếu người duyệt muốn e2e phủ chúng, chọn B (việc của người, không phải của lớp này). [V10] đề nghị ghi vào `questions.md` và không tự chọn bên — tôi giữ nguyên.
- Cần từ V8: xem "CẦN TỪ" bên dưới (bộ dùng chung nên đổi ở một chỗ ảnh hưởng hai màn).

### Q2 — Ca CSP đặt ở đâu?
**Số đo [V10]:** `pnpm e2e`/dev **không gửi header CSP** (`content-security-policy` = `null` mọi lượt đo; grep `Content-Security-Policy`/`csp` trong `vite.config.ts`, `index.html`, `playwright.config.ts`: không có) ⇒ `page.on('console')` không thể thấy CSP. Cách khả thi đã chạy: `page.route` chèn header CSP + `addInitScript` nghe `securitypolicyviolation` ⇒ ra **1 vi phạm** `script-src | eval` (bốn vi phạm gốc của T4.1 hôm nay: 1 còn — #1 `eval`; 3 `connect-src` Iconify: 0). Chính sách thật (`B0-08.md:119`) **không có trong repo**; dev server cần `'unsafe-inline'` (React Refresh) nên chính sách tự dựng **khác** chính sách thật; job `e2e:preview` với CSP nguyên văn là T9.6 và **chưa làm** (`IMPLEMENTATION_STATUS.md:444`). Vi phạm host ngoài (`editor.pascal.app`, `cdn.jsdelivr.net`) **đã** được bắt mà không cần CSP (`pascal-viewer.spec.ts` bài 2, `findOffMachineRequests`).
- **A.** Viết ca CSP trên dev bằng `page.route` chèn một chính sách **chép thành hằng** (chỉ chỉ thị `script-src 'self' 'wasm-unsafe-eval'` và các `connect-src` cần, kèm `'unsafe-inline'` vì dev); khẳng định **0** vi phạm. Nó **đỏ ngay** (1 `eval`, P1) ⇒ phát hiện chính thức; nếu giữ trong bộ thì phải là `test.fixme` kèm lý do + điều kiện mở lại ("`__zod_globalConfig.jitless` được đặt lại hoặc zod thôi dò `eval`"). Rủi ro: hằng chép tay lệch chính sách thật.
- **B.** Không viết ca CSP ở e2e dev; chờ job `e2e:preview` (T9.6) có chính sách nguyên văn trên bản dựng. Ghi P1 là phát hiện mở.
- **Khuyến nghị: B**, với điều kiện người dùng biết P1 còn mở. Lý do: A kiểm một chính sách **không phải của sản phẩm** (có `'unsafe-inline'`, tự dựng), nên xanh/đỏ của nó không nói gì chắc về sản phẩm thật; ca đáng giá phải chạy trên bản dựng với chính sách nguyên văn. Nếu người dùng muốn có tín hiệu sớm về `eval`, chọn A nhưng chỉ khẳng định chỉ thị `script-src`/`eval` (đo không phụ thuộc `'unsafe-inline'` [V10]).

---


### Nhóm V11

Đánh số `Q-V11-n`; điều phối đặt số nối tiếp `questions.md`. Cả hai đều dữ kiện đã đo, không câu nào phụ thuộc "chưa đo".

### Q-V11-1 — Thêm một ca hàng rào H-1 vào `pascal-viewer.spec.ts`, hay không thêm gì?
**Đã đo:** trong `[data-testid="pascal-canvas"]` (cờ bật, sau khi cảnh dựng): `<canvas>` = **1**, `button` = **0**, `[role=tab]` = **0**, `[role=dialog|alertdialog]` = **0**, `input/select/textarea/a[href]` = **0**, `innerText` = **0** ký tự; canvas **1406×190**. `grep -rn "pascal-app/editor"` trong `src`: **0 dòng**. Bài `cờ bật` đã khẳng định sẵn `canvas count = 1` (`e2e/pascal-viewer.spec.ts:332`).

| | Phương án |
|---|---|
| **A** | Thêm 3-4 khẳng định `toHaveCount(0)` (button/tab/dialog[/nhập liệu]) ngay dưới dòng `:332`. Không bài mới, không lượt đăng nhập mới. Xanh hôm nay; đỏ khi ai gắn `Editor` **vào trong hộp**. |
| **B** | Không thêm gì. Kế hoạch V11 chỉ còn một câu "chưa có nơi gọi"; bề mặt editor hiện ra thì không ai biết cho tới khi có người gặp. |

**Khuyến nghị: A.** Chi phí bằng 0 giây, một tệp đã tồn tại, và nó là cách duy nhất một ranh giới "chưa hiện" trở thành *quan sát được*. Giới hạn nói ở trường 13 (chỉ thấy editor **trong** hộp). Đỏ ở A = có người gắn editor mà chưa cập nhật kế hoạch — đó là lúc cần biết, không phải lỗi.

### Q-V11-2 — Trong coverage-map, 16 bề mặt editor ghi `không áp dụng` hay `chưa phủ`?
**Đã đo:** như Q-V11-1 (0 điều khiển editor trên màn; 0 tệp nhập `editor` trong `src`; 251 tệp `.js` đã dựng, 8/9 chuỗi chữ của 6 nhóm: 0 tệp — V11). Bảng có 7 ô × 1 hàng.

| | Phương án |
|---|---|
| **A** | `không áp dụng` ×7 kèm lý do "bề mặt không được dựng" (như hàng trên). Bản đồ không đỏ giả; H-1 (nếu chọn Q-V11-1 A) là chỗ báo khi bề mặt hiện. |
| **B** | `chưa phủ` ×7. Bản đồ đỏ 7 ô, nhắc "phạm vi A (xem + sửa) đã hoãn" mỗi lần đọc. |

**Khuyến nghị: A.** `chưa phủ` nghĩa "có bề mặt, không ai chứng minh"; ở đây *không có bề mặt*. Ghi đỏ cho thứ không tồn tại dạy người đọc bỏ qua màu đỏ (cùng lập luận Q12 của `questions.md`). Nhưng nếu người dùng muốn bản đồ nhắc về phạm vi A hoãn, chọn B — quyết định của họ, không phải của tôi.


### Nhóm V12

### Q-V12-A — `projectRuleSettings` nói cùng lúc `23/25 luật đang bật` và `chưa có bộ luật để cài đặt` (= `questions.md` Q7)
**Đã đo + đã đọc mã.** `23/25` từ sổ luật của domain (`createDefaultRuleRegistry()`, `useRuleSettings.ts:352`; đơn vị `:115`: sổ có 25 luật, 23 bật mặc định) — **không phụ thuộc** `state.spatial`. `chưa có bộ luật để cài đặt` hiện khi `status==='empty'` ⇔ `graph===null` (`useRuleSettings.ts:616-618`) — **`empty` nghĩa "chưa có bản vẽ đã dựng", không phải "không có luật"**. Sau bơm kho hai câu nhất quán (25 luật). Cả hai đo lớp 1 và lớp 2 (`viewer` cũng thế).
| | Phương án |
|---|---|
| **A** | Lỗi chữ sản phẩm: câu `empty` phải nói đúng ("chưa có bản vẽ để soi luật trên…"). Ca RS-1 khẳng định câu **đúng** sau khi chữa. |
| **B** | Giữ chữ; ca RS-1 khẳng định *cả hai câu cùng hiện* như hiện trạng có chủ ý. |
**Khuyến nghị: A.** Đọc mã cho thấy đây không phải "hai nguồn hợp lệ": tiêu đề nói "chưa có bộ luật" và mô tả nói "chưa có luật … nào được nạp" — cả hai là **sai sự thật** với sổ 25 luật có sẵn. B khoá một câu sai vào kiểm thử. (Khác `questions.md` Q7 chỉ ở chỗ ở đây mã đã đọc nên chọn được bên.)

### Q-V12-B — `projectVersions` cần `floorId` mà route không mang (= `questions.md` Q6)
**Đã đo.** `/projects/project-1/versions` ⇒ `Không xác định được bản vẽ`, thân 140 ký tự, 0 nút, 0 heading. Điều kiện: `activeFloorId===null` (`VersionHistory.container.tsx:183-187`); `store.floors` **0 nơi nạp** (`projectSlice.ts:33-34`). Kể cả bơm `activeFloorId`, màn ra `không tải được lịch sử phiên bản` / `chưa có nguồn dữ liệu phiên bản nào được nối vào màn này` (`versionHistoryGateway.ts:129-130`).
| | Phương án |
|---|---|
| **A** | Route thêm `:floorId` — `/projects/:projectId/floors/:floorId/versions`. |
| **B** | Màn tự chọn tầng khi URL không nói (hiện danh sách tầng). |
**Khuyến nghị: A** — *khác* khuyến nghị B của `questions.md` Q6, vì một số đo mới: bộ chọn tầng của B cần **danh sách tầng**, mà `store.floors` không có nơi nạp nào (F1) ⇒ B sẽ hiện danh sách rỗng, không cứu được màn. A cho `page.goto` mở đúng tầng và không phụ thuộc kho. Nhưng **dù chọn gì, (2) chặn**: chưa nguồn phiên bản. Kế hoạch lượt này: chỉ VE-1, không ca luồng chính.
*Điều phải làm sáng tỏ nếu chọn B (chưa đo):* `OverlayComparison.selectFloor` (`useOverlayComparison.ts:881`) có phải nơi duy nhất nạp `activeFloorId` không — nếu có đường khác, lập luận trên yếu đi.

### Q-V12-C — Panel mời người dùng không đóng bằng `Esc`: ca e2e mô tả hiện trạng, hay `test.fixme`?
**Đã đo.** Bấm `Mời người dùng` ⇒ khối inline `email người được mời | … | Gửi lời mời | Huỷ` (không `role="dialog"`); `Escape` ⇒ khối **vẫn còn** (V12). `UserManagement*.tsx` không có `useShortcut`/`Escape` (V12 grep). Trong cùng màn: hộp thoại xoá đóng bằng `Esc` (V12 đo), panel `Model` đóng bằng `Esc` (đo lớp 2).
| | Phương án |
|---|---|
| **A** | UM-4 là `test.fixme` với lý do "panel mời không đăng ký Esc" và điều kiện mở lại "khi panel đóng được bằng Esc hoặc khi người duyệt xác nhận đó là chủ ý". |
| **B** | UM-4 khẳng định *hiện trạng* ("Esc không đóng panel mời") như ca bình thường. |
**Khuyến nghị: A.** B khiến kiểm thử bảo vệ một hành vi trái A12; khi ai đó sửa panel cho đóng được bằng Esc, ca B sẽ đỏ và bị coi là hồi quy. Không hạ ngưỡng, không `test.skip` trần: A kèm lý do và điều kiện mở lại theo yêu cầu.

### Q-V12-D — A8 ở `RuleSettings` và `account`: route không có toast hoàn tác
**Đã đo.** `projectRuleSettings`: bật/tắt luật ⇒ không toast (`[role=alert]` rỗng), `Ctrl+Z` không hoàn tác cấu hình luật (chỉ hoàn tác `spatial`); `account`: sửa `họ tên` + đổi chủ đề ⇒ không toast, `Ctrl+Z` không hoàn tác (họ tên giữ `Nguyễn Văn Thử`). Trong khi `adminUsers` vô hiệu hoá có toast `Hoàn tác` chạy thật (đo lớp 2). Hook `RuleSettings` có vé (`useRuleSettings.ts:434-463`).
| | Phương án |
|---|---|
| **A** | Coi là khoảng trống sản phẩm (F3): ô A8 của hai màn ghi `chưa phủ`; không viết ca "khẳng định không có toast". |
| **B** | Viết ca khẳng định hiện trạng "không có toast" để khoá lại đến khi được nối. |
**Khuyến nghị: A.** Ca B chứng minh một điều thiếu và sẽ đỏ đúng lúc sản phẩm được cải thiện. Đã có trong coverage-map: `projectRuleSettings` A8 = `chưa phủ`; `account` A8 = `đơn vị` (chỉ vé đăng xuất phiên, `SessionsSection.test.tsx:237-342`) — *lưu ý:* ô `account` A8 `đơn vị` **chỉ đúng cho đăng xuất phiên**, không cho sửa hồ sơ/giao diện.

### CẦN ĐO TRƯỚC KHI HỎI (chưa thành câu hỏi được)
| Việc | Còn thiếu gì |
|---|---|
| Tệp `.glb` có tới máy không (F5) | `download` không nổ trong 8 s/5 s. Cần đo: (1) có sự kiện `download` nếu tạm bỏ `revokeObjectURL` (chỉ trong scratch, **không sửa repo** — mô phỏng bằng `page.route`/bản chép); (2) `context` `acceptDownloads` tường minh. Đến khi có kết quả, EX-3 không được nói "đã tải". |
| `role="alert"` của nhánh `forbidden` `adminUsers` | BO-SUNG 2.2 ghi có; ghi chú lớp 1 và probe không xác nhận. Cần đo: `page.getByRole('alert')` trên `/admin/users` với `engineer`. |
| Focus trả về nút gọi sau `Esc` đóng hộp thoại xoá tài khoản (AC-2) | Chưa đo `document.activeElement` sau khi đóng. |
| Đăng xuất một phiên (`account`) trên trình duyệt thật | Chưa bấm `Đăng xuất khỏi …`; đơn vị đã phủ vé, e2e chưa biết hành vi thật. |
| `Tải hoá đơn … dạng PDF` (`billing`) | Đo lớp 2: không `download`, không toast, không status trong 2,5 s; chưa đọc `gateway.downloadInvoice`. |
| Điều kiện kích `EditorTour` | Mục cuối `questions.md`; V12 chỉ thêm `resize` kích được trên `/export` sau bơm. |

---
