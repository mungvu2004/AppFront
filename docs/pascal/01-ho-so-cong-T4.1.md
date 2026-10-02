# T4.1 — Hồ sơ cổng quyết định

Đợt G3, 2026-09-26. Nguồn: sổ tay bản 2.1 (T1.0 → T4.1), kế hoạch ghép Pascal bản 2.
**Luật E.10: mục nào chưa chạy thì ghi "chưa chạy" kèm lý do. Không con số nào trong hồ sơ này
được ước lượng.**

> **Câu "Mỗi con số có tệp thô trong `F:/pascal-work/G3/raw/`" — bản đầu của hồ sơ này viết vậy, và
> nó KHÔNG đúng.** Một lượt soát riêng (X4) đã đối chiếu **từng** con số. Sự thật:
> - phần lớn số hợp lệ nhưng **nằm ở vòng khác**: `G0/raw`, `G1/raw`, `G2/raw` — hợp lệ, chỉ là hồ sơ
>   không trỏ tới. Trong đó có **lucide 8,2 KiB**, một trong ba câu của T4.2
>   (`G1/raw/a-8-tong-analyze.txt:17,20,29,30`);
> - **hai con số không có tệp thô ở BẤT KỲ vòng nào**, và đã sửa — xem hai khung "SỬA" ở §1 và §2;
> - bảy chỗ là **số đo thật nhưng chưa ai cất tệp thô** (byte của hai ảnh mục g; vị trí ký tự 99/1233;
>   `git diff --stat`; số dòng `tong-b.mjs`; phép grep 0 chunk chứa `findNonVietnamese`);
> - sáu chỗ là **đọc mã** — hợp lệ không cần tệp thô, nhưng thiếu `tệp:dòng`.
>
> Đọc hồ sơ này thì đừng tin câu tổng quát nào về nguồn; tin dòng "Thô:" của từng mục.

Hồ sơ này **không** đưa ra quyết định. Nó bày số để T4.2 quyết.

---

## 0. Trạng thái từng việc

| Mã | Việc | Trạng thái |
|---|---|---|
| T1.0 | luật đợt + dọn cây | **ĐẠT** |
| T1.1 | commit giấy tờ | **ĐẠT một phần** — 4 đáp án Q1–Q4 chép đủ; hai câu G2 để trống đúng luật, xem §6 |
| T1.2 | rebase React 19 + đo lại `size` | **ĐẠT một phần** — rebase xong, có số; `size` **3/4**, `verify` chưa 7/7. Xem §2 |
| T1.3 | rebase nhánh three | **ĐẠT** — 2 commit, `size` **4/4**; nhưng **màn 3D còn dư đúng 0,8 KiB**. Xem §10 |
| T1.4 | hình dạng CSS cuối | **ĐẠT** — xem §3 |
| T1.5 | clone lên `af984b4` | **ĐẠT** — xem §4 |
| T2.1 | hai dòng CDP | **ĐẠT** |
| T2.2 | ép cùng cỡ canvas + cùng server | **ĐẠT phần cơ chế**; lộ ra một chỗ hỏng lớn hơn, xem §4 |
| T2.3 | b — 5 cặp xen kẽ | **ĐẠT — 10/10 lượt hợp lệ, 5/5 cặp giữ.** p95 **không chạm** 33,3 ms; **tỉ số trung vị CHẠM** ngưỡng 1,2 lần. Xem §5c |
| T2.4 | c — card tích hợp | **đã đo — trùng điều kiện với b.** Nhãn cũ *"chưa chạy — chuỗi GPU không đổi"* và câu *"khoá registry đã hoàn lại"* **mô tả việc không xảy ra** — `reg add` hỏng, xem §8f. Phán quyết "không cần chạy c" **không đổi** |
| T2.5 | giây, bản chưa cắt | **ĐẠT** — 13,828 s / 14,264 s, tỉ số **1,032** |
| T2.6 | `JSON.stringify` của mục i | **đã đo ba lần, số nhất quán, chưa lượt nào hợp lệ hoá được** — xem §8g. Nhãn "chưa chạy" cũ sai: 19/09 và hai lượt 26/09 đều cho số |
| T2.7 | mục g — CSS đụng ảnh chuẩn | **ĐẠT — 0 điểm khác**, kèm một đối chứng. Xem §5e |
| T2.8 | gộp báo cáo | **ĐẠT** — `M-T2.8-bang-so.txt` |
| T3.1–T3.4 | ba nhát cắt + bản gộp | **ĐẠT** — xem §5 |
| T3.5 | giây, bản đã cắt | **ĐẠT** — 13,759 s / 14,482 s, tỉ số **1,053**; và cảnh **vẫn dựng được** sau C2 |
| T3.6 | quy đổi sang AppFront, hai đơn vị | **ĐẠT** — xem §5d |
| T3.7 | spike vách ngăn | **ĐẠT** — `mount()` chạy thật, hai gốc React sống chung; 4 vi phạm CSP; phép thử 404 không đo được trên `vite preview`. Xem §7 |

---

## 1. Chín mục của G1 — mục nào đã có số

Sổ tay đòi **8/9 mục có số**, mục **e** vẫn là *sàn* và chỉ đo lại được ở T7.2, sau cổng.

| Mục | Trước đợt G3 | Sau đợt G3 | Chạm "Dừng nếu"? |
|---|---|---|---|
| **a** dung lượng | có số, nhưng chỉ theo **một** đơn vị | **có số theo CẢ HAI đơn vị**, và cả bản chưa cắt lẫn đã cắt — xem §5 | **CHẠM cả ba trần** |
| **b** độ mượt | *chưa chạy* — máy không xuống 10 % CPU | **CÓ SỐ cho cả hai bên**, 10/10 lượt hợp lệ. p95 Pascal 18,20 / 24,90 ms; màn cũ 17,80 / 21,50. Tỉ số trung vị 2,571 (cách 1) và 7,750 (cách 2). Xem §5c | **p95 KHÔNG chạm**; **tỉ số 1,2 lần CHẠM** ở 5/5 cặp |
| **c** card tích hợp | *chưa chạy* — cùng lý do | **đã đo — trùng điều kiện với b.** Chrome trên máy này **chỉ thấy Intel UHD** kể cả khi xin `high-performance` (`plan-probe-webgpu.txt`, `plan-probe-gpu.txt`; `G1/ke-hoach.md:854` L31 đã biết trước), nên lượt c không thể khác lượt b. **Hai câu của bản trước — "đã đặt `GpuPreference=1`" và "khoá registry đã hoàn lại" — tả việc KHÔNG xảy ra:** `reg add` thoát `ERROR: Invalid syntax` (`M-T2.4-c.txt:8-9`), khoá chưa bao giờ được đặt. Lý do sửa, **phán quyết giữ nguyên** — chi tiết đầy đủ ở **§8f** | — |
| **d** Playwright trên Linux | **ĐẠT** — SwiftShader vẽ được WebGL2 | không đo lại; không có gì đổi | không |
| **e** CSP | **đo một phần**: 6 vi phạm, cả 6 có cách tắt; cảnh chết lúc t = 2 804 ms **trước khi** Draco/KTX2/GLB/manifold chạy → 6 là **sàn** | **vẫn là sàn.** Đợt này không đo lại mục e: nó chỉ đo lại được trên **cảnh còn sống**, mà việc sửa cảnh là **T7.1**, nằm sau cổng. Đúng như sổ tay T4.1 dự liệu | chưa kết luận được |
| **f** TypeScript | **ĐẠT** — 0 lỗi ở cả 5.5.3 và 5.9.3 | không đo lại | không |
| **g** CSS đụng hình | *chưa chạy* — thiếu 3 tệp công cụ | **ĐẠT — tỉ lệ điểm khác = 0.** Tiêm cả 246 876 byte CSS ở hình dạng cuối vào màn 3D của AppFront: hai ảnh trùng **byte**. Kèm một đối chứng: bản **chỉ scope, không đổi tên** cũng ra 0 | **không** |
| **h** phím tắt | **ĐẠT 25/25 ô** | không đo lại | không dùng để dừng |
| **i** thay đổi ma | **một phần**: 1 commit `local` khi mở, `changedNodeIds` rỗng. ~~biên 193 ms~~ **— SỬA: con số 193 ms KHÔNG có tệp thô ở bất kỳ vòng nào** (grep cả `G0/G1/G2/G3 raw/`: 0 hit). Đã gỡ; cách lọc commit ma là **bất biến**, không phải một biên thời gian | **vẫn một phần.** Phần `JSON.stringify` nay là **"đã đo ba lần, số nhất quán, chưa lượt nào hợp lệ hoá được"** — không phải "chưa chạy"; xem **§8g** | không dùng để dừng |

**Một câu về mục e, vì nó là mục dễ hiểu nhầm nhất:** con số "6 vi phạm CSP" **không phải tổng**.
Cảnh Pascal bị gỡ lúc t = 2 804 ms, **trước khi** Draco, KTX2, GLB và manifold kịp chạy — nên 6
là số vi phạm đếm được trên một cảnh đã chết, tức **sàn**. Hai nhát cắt của đợt này có đụng vào
hai trong bốn nguồn chưa đếm (bỏ transcoder KTX2 gỡ luôn một lượt gọi ra `cdn.jsdelivr.net`; bỏ
manifold gỡ hai lượt `new Function`), nhưng **không** được trừ vào con số 6 — chúng nằm ở phần
chưa bao giờ được đếm.

---

## 2. Dung lượng nền: React 19 trên base mới

Thô: `A-T1.2-build-size.txt` (nhánh), `A-T1.2-size-master.txt` (master).
Đơn vị: KiB gzip, đo bằng `zlib.gzipSync` mức mặc định — đúng cách cổng đo.

| Cổng | master `af984b4` | nhánh React 19 | Chênh | Trần |
|---|---|---|---|---|
| **màn hình đầu tiên** | 163,5 — dư 11,5 | **178,1 — VƯỢT 3,1** | **+14,6** | 175 |
| chunk JS lớn nhất | 163,5 — dư 6,5 | **139,0** — dư 31,0 | −24,5 | 170 |
| chi phí thêm cho một màn (màn 3D) | 264,2 — dư 15,8 | 264,5 — dư 15,5 | +0,3 | 280 |
| tổng CSS | 10,9 — dư 1,1 | 10,9 — dư 1,1 | 0 | 12 |

- Master xanh cả 4 cổng (mã thoát 0) → 3,1 KiB vượt là **do React 19**, không do master trôi.
- `manualChunks` làm đúng việc: chunk lớn nhất 163,5 → 139,0. Nhưng nó **không** giúp cổng "màn
  hình đầu tiên", vì cổng đó cộng cả chunk vào lẫn mọi chunk nhập tĩnh.
- Con số cũ "màn đầu còn dư **1,0** KiB" hết hạn — **SỬA: bản đầu ghi 0,6; tệp thô
  `G2/raw/r19-6d-size.txt:27` ghi `174,0 KiB / 175 KiB (còn dư 1,0 KiB)`. Con số 0,6 không khớp tệp
  thô nào.** Master đi thêm **+3,7 KiB** kể từ base `7b98fce`,
  ăn hết phần dư.

**Hệ quả cho kế hoạch:** T5.1 ("PR làm nhẹ màn đầu") đổi từ *nên làm* sang **chặn đường** —
React 19 không hợp nhất được cho tới khi màn đầu nhẹ đi ≥ **3,1 KiB** (≥ 8,1 KiB nếu vẫn muốn
5 KiB dư thật). T5.1 phải đi **trước** T5.2.

---

## 3. CSS của Pascal — hình dạng thật sự deploy được

Thô: `F-T1.4-sinh-css.txt`, `F-T1.4-chan-doan-L52A.txt`

| Tệp | KiB gzip (như cổng) |
|---|---|
| bản dựng thô (`pascal.raw.css`, 157 117 byte) | **22,2** |
| + đổi tên `--tw-` → `--pascal-tw-` (1 163 chỗ) | 22,4 |
| **+ bỏ `@layer` + tiền tố `.pascal-root` = hình dạng cuối** | **24,4** |
| *(bản HỎNG của L52, chỉ để đối chứng)* | *60,6 — là rác, đừng dùng* |

- Đổi tên cả loạt gần như **miễn phí**: +0,2 KiB.
- Cô lập tốn **+2,2 KiB**, gần hết do plugin cascade-layers mô phỏng thứ tự `@layer` bằng mẹo
  độ đặc hiệu `:not(#\#)`.
- **Con số mang tới cổng cho CSS: 24,4 KiB.** Trần đã chốt ở G0: **1,1 KiB**.

> **22,2 ở đây và 22,3 ở §5d là HAI TỆP, không phải một đại lượng đo hai lần.** 22,2 là
> `pascal.raw.css` — **157 117 byte** thô, bản đã đối chiếu sha với `dist-a/assets/EditorScreen-2zAP9OLh.css`
> của lượt dựng **18/09**, và nó là điểm xuất phát của chuỗi đổi tên T1.4
> (`F-T1.4-sinh-css.txt`, khối *"kich thuoc do DUNG cach cong do"*). 22,3 là
> `assets/EditorScreen-tEo8_zPk.css` của **bản dựng spike 26/09** — **22 800 byte** gzip, và đó
> là con số cổng thật đọc (`X_c`, `F-T3-so-goc.txt` · `F-T3-so-c2.txt`). Hai tệp lệch nhau vài
> chục byte nén; **đừng gộp hai dòng lại**. Con số mang tới cổng vẫn là **24,4** (`max(X_c, X_c')`).

Nghiệm thu hình dạng cuối: `@layer` **0** · `:root` **0** · `:host` **4** · `.pascal-root`
**1 706** · `--tw-` **0** · `--pascal-tw-` **1 163** · sourcemap **0**.

> **Một câu cho cả hai con số `:host`, vì hai con số đúng cùng lúc.** `F-T1.4-sinh-css.txt` đếm
> `:host` **hai lần, ở hai bước khác nhau**. Ở bước *chỉ đổi tên* (`:29-35`) có **6** lần, và
> tệp thô mổ từng lần: **2** là selector thật (`@layer theme{:root,:host{…}` và `html,:host{…}`),
> **4** lần còn lại là tên lớp Tailwind đã escape (`.\[editor\:host-panels\]`,
> `.\[editor\:host-tree-children\]`). Ở **hình dạng cuối** (`:55-58`, sau khi bỏ `@layer` và
> thêm tiền tố `.pascal-root`) còn **4** — đúng 4 tên lớp escape đó, **0** selector; tệp thô in
> lại cả bốn ở `:81-85`. Nên **6 = 2 selector + 4 tên lớp** (bước giữa) và **4 = 4 tên lớp**
> (hình dạng cuối) là **cùng một phép đếm ở hai thời điểm**, không phải hai con số đá nhau.
> Sổ tay bản 2.2 ghi "2 selector, 4 lần còn lại là tên lớp" — đó là câu tả **bước giữa**;
> con số mang tới cổng là con số của hình dạng cuối: **4, không selector nào**.

---

## 4. Công bằng phép đo — chỗ hỏng lớn nhất của đợt này

Thô: `M-T2-khoi-thu.txt`, `M-T2.2-chan-doan-cu.txt`, `M-T2.2-chan-doan-cu-2.txt`

**Màn cũ, dựng bằng `pnpm build` rồi phục vụ bằng `vite preview`, vẽ đúng 0 khung hình.**
`resolveUseMockApi` (`src/api/appClient.ts:64`) chặn hai lớp với `import.meta.env.DEV` đứng
trước, nên bản production **cố ý** không mang mock client. App gọi thật `/api/projects/P-01`,
preview trả **404**, màn đứng ở trạng thái rỗng *"Mô hình 3D sẽ xuất hiện sau khi bạn duyệt lớp
tường"* — *0 tầng · 0 phòng · 0,00 m²*.

Nếu không bắt được chỗ này, đợt đo sẽ sinh ra một bảng tỉ số trông chỉn chu trong khi một bên
vẽ 0 khung, và con số ấy đi thẳng vào cổng.

Đã sửa bốn chỗ, tất cả theo hướng **đối xứng** chứ không theo hướng "cho qua":

1. cùng host `127.0.0.1` và cùng cờ cho cả hai máy chủ preview;
2. ép cùng **số điểm canvas** bằng viewport (ép bằng CSS không ăn — `setSize` của three đặt bộ
   đệm vẽ riêng), **và đích là cỡ NATIVE của màn cũ** (`960x382` = **366 720 — đây là ĐÍCH bộ đo
   đặt, không phải số đo**; số đo là **366 240** = 960 × 381,5, khớp `canvas.box.height` = 381,5,
   đọc ở `epCo.lichSu[0].dt` của `giay-truoc-cu-2.json` và `b-cu-1.json`) để chỉ Pascal phải
   co lại. Bản đầu dùng đích 470 400 nên phải phình viewport màn cũ lên — chính lượt phình đó làm
   màn cũ ngừng phản ứng với cú kéo, mất ba lượt đo mới truy ra (xem §5c). Đo được: Pascal
   986 400 → 359 964 điểm, màn cũ giữ nguyên 366 240, lệch 1,7 %;
3. mốc "cảnh hiện" của màn cũ nay đòi ba điều kiện khớp đúng điều kiện Pascal đang dùng;
4. bản dựng riêng cho màn cũ (`vite.e2e.config.ts` trong cây clone) — production đủ mọi mặt,
   chỉ lật `import.meta.env.DEV` thành `true`. **Bản này chỉ dùng đo giây và độ mượt, tuyệt đối
   không dùng đo dung lượng** (lật `DEV` cũng kéo `DEV_ONLY_ROUTES` vào gói).

---

## 5. Ba nhát cắt

Thô: `F-T3-so-{goc,c2,c2c3}.txt`. Đơn vị: KiB gzip, `zlib.gzipSync` mức mặc định.
Bản `goc` là **đối chứng**, dựng qua cùng công cụ với `CAT` rỗng; nó tái lập đúng số cũ
(X_a 1 563,9 so với 1 563,8 đã biết), nên phần chênh dưới đây là chênh do nhát cắt, không do
công cụ.

| Nhát cắt | X_a (chunk màn) | `.wasm` | `.js` | **tổng-thư-mục** |
|---|---|---|---|---|
| **gốc** | 1 563,9 | 591,4 | 2 668,5 | **8 693,0** |
| **C2** — bỏ transcoder KTX2 + bỏ manifold | 1 539,4 | **148,5** | 2 616,7 | **8 198,1** |
| **C2 + C3** — thêm: chỉ đăng ký 7 loại node | 1 539,4 | 148,5 | 2 616,5 | **8 198,0** |
| **+ C4** — drei tối thiểu | *không làm* | | | |

| | X_a | `.wasm` | tổng-thư-mục | **Cái mất đi** |
|---|---|---|---|---|
| **C2** | −24,5 | **−442,9** | **−494,9** | Mọi texture `.ktx2` không nạp được (bảng vật liệu Pascal, texture nướng trong GLB). Mọi phép toán khối — đường in/xuất của editor. Hình học tường, ô mở, phòng không đụng hai đường này |
| **C3** | **0,0** | 0,0 | **−0,1** | site, ceiling, slab, roof, họ HVAC — **không đổi lấy một KiB nào** |
| **C4** | *≤ 6,7 (trần trên)* | 0 | *≤ 6,7* | không đáng làm |

**Ba câu phải đọc cùng bảng này:**

1. **C2 là nhát cắt duy nhất có số.** Nó gỡ **74,9 %** khối `.wasm` (442,9 / 591,4) nhưng chỉ
   **5,7 %** tổng-thư-mục.
2. **C3 như sổ tay tả không phải một nhát cắt dung lượng.** `bootstrap.ts` lọc lúc **đăng ký**,
   còn `builtinPlugin` là một module nhập sẵn mọi định nghĩa — rollup vẫn giữ cả mảng. Muốn có
   số thì phải **không xuất** chúng từ `@pascal-app/nodes`, tức việc của T6.4 trên fork.
3. **Ba nhát cắt không chạm tới 65,8 % khối lượng.** 8 198,0 KiB còn lại gồm `.webp` 3 054,5 ·
   `.js` 2 616,5 · `.glb` 1 834,7 · `.mp3` 509,0. Bảng vật liệu, thư viện đồ đạc và âm thanh
   của Pascal là **5 398,2 KiB** — chỗ cắt lớn nhất còn lại, và nó thuộc Bước 6–7 trên fork.

**Hai chỗ suýt cho ra số sai, ghi lại để không ai lặp lại:**

- **`manifold-3d` vào qua một worker.** `print-shell-compiler-manifold-worker.ts:56` gọi
  `new Worker(new URL(…))`; vite dựng worker bằng một lượt rollup riêng, đọc `worker.plugins`
  chứ không đọc `plugins`. Lượt cắt đầu vì thế vẫn để lại nguyên `manifold.wasm` 201,0 KiB.
  **T6.4 phải cắt ở cả hai lượt dựng.**
- **`emptyOutDir` không dọn một `outDir` nằm ngoài thư mục gốc, và không cảnh báo.** Lượt dựng
  thứ hai xếp chồng lên lượt thứ nhất: 463 tệp JS thay vì 235, và tổng-thư-mục đọc ra
  **10 852,1** thay vì 8 198,1 — **sai 29 % trong im lặng**. Cổng thứ năm quét đệ quy nên nó
  **sẽ** đếm rác của lượt cũ; T9.1 phải dọn đích của chính nó.

**Một chỗ kế hoạch ghi sai.** Kế hoạch bản 2 (mục 3.d) và sổ tay T3.1 ghi *"`manifold` chỉ phục
vụ `nodes/hvac-equipment/geometry` và đường in/xuất của editor"*. Nửa đầu sai:
`hvac-equipment/geometry.js` không nhập `manifold-3d` lần nào — chữ "manifold" ở đó là tên một
chi tiết vật lý (*burner manifold*), dựng bằng `new Mesh(new CylinderGeometry(…))`. Kết luận
không đổi (bỏ manifold an toàn), nhưng phạm vi hẹp hơn kế hoạch tưởng.

### C4 — drei: đã trả lời trước khi dựng

Pascal chỉ dùng **4** thứ của drei: `Html` (21 chỗ), `useGLTF`, `useAnimations`, `Clone`.
Bản đã tách vendor cho thấy drei nặng **6,7 KiB gzip** — rollup đã rung cây xong.
So sánh: `pdfkit` 382,2 · `@react-three/fiber` 45,5 · `three-stdlib` 26,9 · `lucide-react` 8,2.

**Không đáng thay** — 6,7 KiB trên 1 563,8 KiB là 0,4 %, và bỏ drei **không** gỡ được R3F
(`@react-three/fiber` là thứ Pascal dùng trực tiếp). Câu "không dùng react-three-fiber" ở
`CLAUDE.md` dòng 5 vẫn phải sửa (T8.2), dù có drei hay không.

### `.wasm` — nhát cắt C2 gỡ được 74,9 %

Thô: `F-T3.1-wasm-truoc-cat.txt`

| Tệp | KiB gzip | C2 có gỡ không |
|---|---|---|
| `basis_transcoder.wasm` (KTX2) | **241,8** | **gỡ** |
| `manifold.wasm` | **201,0** | **gỡ** |
| `draco_decoder.wasm` ×2 | 86,6 + 62,0 = 148,6 | giữ |
| **tổng** | **591,4** | gỡ **442,8** (74,9 %) |

Ghi kèm: hai bản Draco trong cùng một `dist` là trùng lặp; AppFront vốn đã tự host Draco ở
`public/draco/`.

---

## 5b. Hai bảng GIÂY

Hồ sơ: **Slow 4G + CPU ×4** (ba con số nguyên văn của Chrome DevTools, ghi thẳng vào mã), 3 lượt
× 2 màn. Mốc: "cảnh hiện" — hai bên đo cùng một thứ, xem §4.

> **Hai bảng dưới đây KHÔNG phải bảng đã cân cỡ canvas.** Mốc `kq.hien` đo ở **bước 2** của bộ
> đo, còn vòng ép cỡ chạy ở **bước 3b** — nên mốc "cảnh hiện" được đo ở cỡ canvas **native** của
> mỗi bên: màn cũ **366 240** điểm, Pascal **986 400** điểm (Pascal vẽ khung đầu với **2,7 lần**
> số điểm). Tệp thô nói thẳng: `giay-truoc-cu-2.json` và `giay-truoc-mau-2.json` ghi
> `epCo.lichSu[0].dt` = 366 240 và 986 400 ở vòng 0, còn `hien.trang` = 13 827,5 và 14 264 ms —
> tức mốc giây có trước khi vòng ép cỡ đổi được gì.
> Cột **"điểm canvas 467 338 so với 465 864, lệch 0,3 %, ép cỡ = đạt"** trong hai tệp thô
> `M-T2.5-bang-giay-truoc.txt` / `M-T3.5-bang-giay-sau.txt` là số của **giai đoạn kéo**, và nó
> **không** nói gì về mốc giây. Bản trước của mục này để câu "ép cùng cỡ canvas, lệch 0,3 %"
> ngay ở dòng đầu; ai dừng ở đó sẽ trích sai. Chiều của sai lệch là **bất lợi cho Pascal**, nên
> kết luận "Pascal mở gần bằng màn cũ" vẫn đứng — chỉ là lý do vững hơn.

### Trước cắt

| cảnh | lượt 1 | lượt 2 | lượt 3 | **trung vị** | tỉ số |
|---|---|---|---|---|---|
| màn cũ | 14,286 | 13,828 | 13,523 | **13,828 s** | 1,000 |
| Pascal nhà mẫu | 14,848 | 14,264 | 14,216 | **14,264 s** | **1,032** |

### Sau cắt (C2 + C3)

| cảnh | lượt 1 | lượt 2 | lượt 3 | **trung vị** | tỉ số |
|---|---|---|---|---|---|
| màn cũ | 13,496 | 13,759 | 13,950 | **13,759 s** | 1,000 |
| Pascal nhà mẫu | 14,598 | 14,188 | 14,482 | **14,482 s** | **1,053** |

### Hai bảng cạnh nhau — và cái chúng nói

| | màn cũ | Pascal | tỉ số |
|---|---|---|---|
| trước cắt | 13,828 s | 14,264 s | **1,032** |
| sau cắt | 13,759 s | 14,482 s | **1,053** |

**Nhát cắt không đổi được một giây nào.** Chênh 0,218 s nằm trong nhiễu của chính phép đo (dải
ba lượt mỗi bên là 0,33–0,41 s) và đi **ngược** hướng. **−494,9 KiB tổng-thư-mục không chuyển
thành giây** — vì hai tệp `.wasm` mà C2 gỡ không nằm trên đường tới mốc "thấy mô hình":
transcoder chỉ cần khi có texture `.ktx2` phải giải, manifold chỉ cần khi in/xuất.

**Và phép xác nhận mà T3.1 thật sự cần:** ba lượt trên bản đã cắt đều dựng được cảnh — 23 724 ·
24 393 · 24 588 lệnh vẽ, **0 lỗi**, **0 vi phạm CSP**. Bỏ KTX2 và bỏ manifold không làm hỏng cảnh.

### Bốn câu phải đi kèm, không được trích tỉ số mà bỏ chúng

1. **Đây là số của dự án thử.** Bên Pascal là một app tối giản chỉ chứa editor (bao đóng khởi
   động **59,3 KiB**); bên màn cũ là clone AppFront đầy đủ (**163,5 KiB**, 47 màn). Ghép thật
   thì màn Pascal gánh **cả hai** — nên 1,032 là **sàn**.
2. **"Cảnh hiện" là một định nghĩa, không phải "tải xong".** Texture, đồ đạc, âm thanh của
   Pascal có thể còn đang tải sau mốc này.
3. **Không mâu thuẫn với chuyện dung lượng gấp 5,6 lần trần.** Dưới Slow 4G + CPU ×4, phần lớn
   thời gian của cả hai bên là **CPU dựng cảnh**, không phải byte trên dây. Dung lượng vẫn là
   rủi ro số một — nó chạm cả ba trần — nhưng nó **không biểu hiện thành giây** ở phép đo này.
   Nếu T4.2 chốt trần dựa vào "mở màn nhanh là được" thì đang chốt sai đại lượng.
4. **Bóp có tác dụng thật:** cùng cảnh, không bóp thì màn cũ **813,60 ms** và Pascal
   **1 620,30 ms** (trung vị 3 lượt đầu của **vòng cuối**, `raw/b-cu-{1,2,3}.json` ·
   `raw/b-mau-{1,2,3}.json`, trường `hien.trang`) — bóp làm chậm đi **17,0×** và **8,8×**
   (13 827,5 / 813,60 và 14 264 / 1 620,30).
   *Bản trước ghi 763 ms và 1 604 ms (18,1× và 8,9×). Hai số ấy có thật, nhưng chúng là
   **lượt 1 của vòng ĐÃ CẤT** — `raw/cu-luot1/b-cu-1.json` và `raw/cu-luot1/b-mau-1.json` —
   không phải trung vị, và vòng ấy là vòng mà cả 5 lượt màn cũ bị xếp "đo lỗi" (xem §5c). Dùng
   vòng cuối.*
5. **Hai bảng giây KHÔNG phải bảng đã cân cỡ canvas** — điều này nay đã nằm ở **đầu §5b**, không
   còn là một lời đính chính ở cuối. Nhắc lại con số để khỏi phải cuộn lên: màn cũ **366 240**
   điểm, Pascal **986 400** điểm, tức **2,7 lần**. Nó làm tỉ số 1,032 / 1,053 **bất lợi cho
   Pascal**, không có lợi.

## 5c. Độ mượt (mục b) — **có số đủ cho cả hai bên**, và một điều kiện dừng bị chạm

Thô: `M-T2.3-cuoi.txt`, `M-T2.3-lech-cap-cuoi.txt`, `M-T2.3-tong-b-cuoi.txt`

**10/10 lượt hợp lệ** · **5/5 cặp giữ được** (lệch tải CPU tối đa **4,7** điểm %, ngưỡng 10) · cỡ
canvas lệch 1,7 %.

> **4,7 là con số của LƯỢT CUỐI, và là con số duy nhất còn hiệu lực.** Nó đọc từ
> `M-T2.3-lech-cap-cuoi.txt` (lệch từng cặp: 4,7 · 3,8 · 2,5 · 3,2 · 2,6). Nếu bạn đọc bản cũ
> của mục này và thấy **8,0 điểm %** đi cùng cũng câu "giữ 5/5 cặp" thì đó là con số của **lượt
> đã bỏ** — lượt trước khi bộ đo được sửa, nơi cả 5 lượt của màn cũ bị xếp "đo lỗi";
> nó ở `M-T2.3-lech-cap.txt` (2,6 · 7,1 · 1,8 · 3,6 · **8,0**) và nay chỉ còn nằm ở tiểu mục
> "Vì sao ba lượt trước không ra số" dưới đây, đúng chỗ của nó. Hai con số không mâu thuẫn:
> chúng là **hai lượt đo khác nhau**, và chỉ lượt cuối cấp số cho §5c.

| Cách đo | màn cũ p50 | màn cũ p95 | Pascal p50 | Pascal p95 | p95 > 33,3? |
|---|---|---|---|---|---|
| 1 — mọi khoảng rAF | 2,80 | **17,80** | 7,20 | **18,20** | **không** |
| 2 — khoảng giữa hai khung CÓ VẼ | 2,80 | **21,50** | 21,70 | **24,90** | **không** |
| 3 — cpu của khung có vẽ | 0,50 | 1,10 | 2,60 | 4,70 | không |

| Điều kiện dừng | Kết quả |
|---|---|
| **p95 ≤ 33,3 ms** | **ĐẠT** — xấu nhất của Pascal 24,90 ms (~40 fps ở phân vị 95) |
| **trung vị ≤ 1,2 lần màn cũ** | **CHẠM** — p50 cách 1 = **2,571** · cách 2 = **7,750** · cách 3 = 5,200 · thời gian mở = 2,901 |

**Ba điều phải nói cùng con số 2,571 / 7,750:**

1. **Cả hai bên chạy vsync TẮT** (`--disable-gpu-vsync --disable-frame-rate-limit`), nên đây là
   nhịp **tối đa máy làm được**, không phải nhịp người dùng thấy.
2. **Số khung vẽ trong cùng 10 giây:** màn cũ **1 281–1 694**, Pascal **501–503** → ~150 fps so
   với ~50 fps. Tỉ số lớn vì **mốc so sánh cao bất thường**, không phải vì Pascal giật.
3. **Nhưng điều kiện dừng vẫn bị chạm**, ở 5/5 cặp và cả bốn cách đo. Hồ sơ này **không** diễn
   giải nó thành "đạt". Đây là chỗ duy nhất trong cả đợt chạm một điều kiện dừng **bằng số đo hợp
   lệ ở cả hai bên** — và là câu T4.2 phải đọc kỹ nhất.

Muốn biết nhịp người dùng thật sự thấy (vsync bật, trần 60 fps) thì phải đo lại với `CO=0`; bộ đo
có sẵn chế độ đó, đợt này **chưa chạy** nó cho b.

### Vì sao ba lượt trước không ra số — và nó là lỗi của bộ đo, không của ứng dụng

Thô: `M-T2.3-chan-doan-chup.json`, `M-T2.3-chan-doan-chup-vp.json`

Một lượt dò chụp **cùng khoảnh khắc giữa cú kéo** bằng ba cách độc lập:

| | viewport | `locator.screenshot` | `page.screenshot({clip})` | CDP `captureScreenshot` |
|---|---|---|---|---|
| không đổi viewport | 1440×900 | **0,0714** | **0,0718** | **0,0204** |
| **có `setViewportSize(1632×1020)`** | 1632×1020 | **0** | **0** | **0** |

Ba đường chụp cùng cho 0, ảnh trùng **byte** (CDP 63 958/63 958) → trang thật sự không vẽ lại.
**Thủ phạm là chính vòng "ép cùng cỡ canvas" của T2.2:** đích cũ `840x560` (470 400 điểm) lớn hơn
cỡ native của màn cũ nên buộc phải phình viewport nó lên, và lượt phình đó làm màn cũ ngừng phản
ứng với cú kéo. Sửa bằng cách lấy **cỡ native của màn cũ** làm đích (`960x382` = 366 720 — **đích**;
màn cũ **đo được 366 240**, lệch 0,13 %) → màn cũ thoát vòng ở vòng 0, **không đổi viewport lần
nào**; chỉ Pascal co lại. Cả ba
triệu chứng (điểm kéo bị che, cảnh không xoay, ảnh trùng byte) tan cùng lúc.

Thô: `M-T2.3-tong-b.txt`, `M-T2.3-lech-cap.txt` — **cả hai là tệp của LƯỢT ĐÃ BỎ**, giữ lại vì
nó là tệp thô của phần chẩn đoán này, **không** phải nguồn số của §5c.

**Ở LƯỢT ĐÃ BỎ đó, luật tải CPU của T2.3 vẫn giữ được 5/5 cặp** (lệch tối đa **8,0** điểm %,
ngưỡng 10), dù tải nền máy trôi từ 10,8 % lên 21,6 % trong 10 phút — xen kẽ theo lượt làm đúng
việc của nó. **8,0 là con số của lượt này, không phải của lượt cuối**; lượt cuối cho tối đa
**4,7** (`M-T2.3-lech-cap-cuoi.txt`), và đó là con số §5c trích. Hai con số cùng đi với câu
"giữ 5/5 cặp" vì luật giữ cặp đạt ở **cả hai** lượt — nhưng chúng là hai phép đo khác nhau.

**Pascal, trung vị 3 lượt hợp lệ:**

| cách đo | p50 | p95 | p95 > 33,3 ms? |
|---|---|---|---|
| 1 — mọi khoảng rAF | 7,30 | **18,20** | **không** |
| 2 — khoảng giữa hai khung CÓ VẼ | 21,70 | **24,60** | **không** |
| 3 — cpu của khung có vẽ | 2,50 | 4,60 | không |

**Màn cũ: cả 5 lượt bị `tong-b.mjs` xếp "đo lỗi"** — điểm bắt đầu kéo bị một `div` che, và ảnh
giữa lượt kéo giống hệt ảnh trước lượt kéo (`r.dau` = 0,000): cú kéo không ăn. Màn cũ có panel
thông tin, lớp phủ cộng tác và thanh công cụ đè lên khung nhìn; Pascal chiếm cả trang nên không
gặp. Đã sửa (quét lưới tìm điểm thật sự là canvas, thu biên độ cho cả hai đầu đường kéo nằm
trong canvas) và **đang đo lại**. **Tỉ số 1,2 lần chưa trả lời được** cho tới lượt đo lại.

## 5d. Ba con số dung lượng, **báo cả hai đơn vị** (T3.6)

Hai đơn vị đo hai thứ khác nhau, và chỉ một trong hai là thứ cổng thứ năm sẽ đọc:

| Đơn vị | Là gì | Ai dùng |
|---|---|---|
| **theo closure** (`X_a`) | chi phí thêm khi bước vào một màn, **đã trừ** bao đóng khởi động | bốn cổng hiện có |
| **tổng-thư-mục** | cộng gzip **mọi** tệp, đệ quy, kể cả `.wasm`, `.webp`, `.glb`, `.mp3` | **cổng thứ năm** |

**Vì sao "quy đổi theo closure" nay là một con số không có kiến trúc nào tương ứng.** Cách quy
đổi mà kế hoạch mô tả — trừ bao đóng khởi động thật của AppFront thay vì của dự án thử — chỉ
đúng khi màn Pascal **dùng chung** gói với app. **Q2 = B đã bỏ kịch bản đó**: vách ngăn là một
lượt dựng riêng, và kế hoạch ghi thẳng cái giá — *"React và three chắc chắn trùng bản, vì import
map nội tuyến bị CSP chặn."* Không có bao đóng nào để trừ.

| Đại lượng | Bản chưa cắt | **Bản đã cắt (C2)** | Trần G0 hiện có |
|---|---|---|---|
| **JS** | 2 668,5 | **2 616,7** | *(chưa có trần theo đơn vị này)* |
| **CSS** | 22,3 · *hình dạng cô lập cuối:* **24,4** | 22,3 · **24,4** | 1,1 |
| **`.wasm`** | 591,4 | **148,5** | *(chưa được đo ở cổng nào)* |
| *tổng cả thư mục* | 8 693,0 | **8 198,1** | — |
| *X_a, để so với số cũ* | 1 563,9 | 1 539,4 | 280 |

**Ba con số trên đã GỒM React và three trùng bản.** Không được trừ chúng đi rồi báo một con số
nhỏ hơn — đó là báo theo một kiến trúc không tồn tại.

**Dòng CSS 22,3 là `X_c` — gzip của `assets/EditorScreen-tEo8_zPk.css` trong bản dựng spike
26/09, 22 800 byte** (`F-T3-so-goc.txt` · `F-T3-so-c2.txt`, dòng `X_c`). Nó **không** cùng tệp với
con số **22,2** ở §3, là `pascal.raw.css` 157 117 byte của lượt dựng 18/09
(`F-T1.4-sinh-css.txt`). Hai dòng, hai tệp — xem khung ở cuối §3.

## 5e. Mục g — CSS Pascal có đổi hình của AppFront không

| Bản CSS tiêm vào màn 3D của AppFront | `--tw-` còn | **tỉ lệ điểm khác** |
|---|---|---|
| **hình dạng cuối** (đổi tên + bỏ `@layer` + tiền tố) | 0 | **0** |
| *đối chứng:* chỉ scope, **không** đổi tên | 1 163 | **0** |

Hai ảnh trùng **byte** (58 178 B) ở lượt chính; mô hình đã dựng xong trước khi chụp.

**Và câu thứ hai quan trọng hơn con số:** phép đo này **không** chứng minh lượt đổi tên
`--tw-` → `--pascal-tw-` là cần thiết. Ai đọc "g = 0" rồi kết luận bỏ được T7.5 là đọc sai. Lý
do giữ lượt đổi tên là lý do **không đo được bằng một ảnh của màn hôm nay**: 89 `@property` là
khai **phạm vi tài liệu**, và ba tên `--tw-gradient-from/via/to` nằm ngoài tập rủi ro chỉ vì
AppFront **hiện chưa** dùng gradient nào. PR đầu tiên thêm một gradient sẽ rơi về
`initial-value: #0000` và gradient biến mất **im lặng**.

## 6. Ba câu của T4.2, và hai câu G2 còn treo

**T4.2 phải chốt ba câu:**

1. **Phạm vi** — A (xem + sửa, 54–74 ngày công) · B (chỉ xem, 38–49) · D (dừng).
2. **Ba con số trần cho cổng thứ năm** — KiB JS, KiB CSS, KiB `.wasm`. Trích **theo đơn vị
   tổng-thư-mục**, và ghi rõ nó **đã gồm** phần React + three trùng bản.
3. **lucide 8,2 KiB** — để hai bản, hay nâng AppFront lên lucide 1.x.
   Thô cho câu này: **`F-X4-doi-chieu-icon.txt`** — đối chiếu **từng tên**, không phải một tổng.
   Pascal khai `^1.7.0`, **bản cài thật 1.17.0**; AppFront khai **0.414.0**.
   **29** tên đi qua đường Iconify (`lucide:xxx`): 1.17.0 có **29/29**, 0.414.0 có **28/29** —
   thiếu `RulerDimensionLine`. **20 trong 29 tên ấy ở `editor/src`, 9 tên còn lại ở
   `@pascal-app/nodes/dist`** (khai trong `definition.js` của từng loại node) — ai chỉ quét
   `editor/src` sẽ ra **20** và sẽ tưởng `RulerDimensionLine` là tên bịa
   (`F-X4-doi-chieu-icon.txt:20-24`; nó ở `nodes/dist/construction-dimension/definition.js:76`). Nhưng bộ icon **đầy đủ** mà một fork phải cấp là **137** tên (cộng
   cả tên nhập trực tiếp từ `lucide-react`), và ở bộ đó 0.414.0 thiếu **hai** tên:
   `RulerDimensionLine` **và** `Drone`. Con số 29 không sai, nó chỉ hẹp hơn câu hỏi.
   Ghi chú cho người đọc bản cũ: câu "đối chiếu 29 tên" ở `F-W3-dem-icon.txt:82` từng tự đánh dấu
   là **chưa có tệp thô** (E.10). Nay đã có, và nó **xác nhận** con số 29 chứ không bác.

**Hai câu G2 chưa có nguyên lời người dùng** (`F:/pascal-work/hoi/T1.1-hai-dap-an-G2.md`):
`G2-R19-size` và `G2-THREE (c)`. Mã trên nhánh đã làm theo A từ trước theo khuyến nghị của kế
hoạch; ô "nguyên lời" trong `00-quyet-dinh.md` để **trống**, không ghi thành quyết định của
người dùng.

---

## 7. Spike vách ngăn (T3.7) — cơ chế Q2 = B có chạy được không

Thô: `F-T3.7-danh-sach-kiem.txt`, `F-T3.7-vach-ngan.json`, `F-T3.7-dung-luong-vach-ngan.txt`

### Danh sách kiểm — cả năm ô có câu trả lời

| Ô | Câu hỏi | Trả lời |
|---|---|---|
| `publicDir: false` có đúng không? | | **ĐÚNG.** Thư mục ra có **đúng 8 tệp**, không bản chép nào của `public/**` — mà `public/` có **400 tệp / 7 799 KiB thô**. Thiếu dòng đó là đếm 7,8 MB tài sản của app thành "dung lượng Pascal" |
| Vite có cằn nhằn khi `outDir` nằm trong `publicDir`? | | **Không một dòng.** Mã thoát 0 |
| `emptyOutDir` dọn có đúng không? | | **ĐÚNG** khi `outDir` nằm **trong** thư mục gốc — dựng hai lượt liền, số tệp không đổi. `public/assets/pascal/` nằm trong gốc, nên T9.1 dùng được. (Trái ngược `dist-c2` của Bước 3, nơi `outDir` nằm ngoài gốc và vite lặng lẽ không dọn — sai 29 %) |
| Lượt chính chạy **sau** có chép sang `dist`? | | **Có**, đủ 8 tệp kèm `pascal-mount.js` |
| Bốn cổng cũ có đếm nhầm thư mục Pascal? | | **Không, theo cấu tạo.** `dist/assets` có đúng 1 mục là thư mục (`pascal`); `readAssets` không đệ quy và lọc theo đuôi `.js`/`.css`, thư mục thì không có đuôi |

### `mount()` — **chạy thật**, không phải bản vẽ

Hai gốc React sống chung: khoá nội bộ React trên node gốc của **mỗi** gốc là `[1, 1]`, cả hai cây
đều có nội dung, `.pascal-root` có mặt, canvas Pascal mount được, `onFatal` **không** nổ, 0 lỗi
trang. Bốn hàm trả về đều gọi được; `cancelTopLayer()` trả **boolean** từ **một** lời gọi;
`dispatch` nhận đúng hai lệnh có nhãn tiếng Việt.

### Hai chỗ hỏng, và cả hai đều là tin có giá

**1. CSP: 4 vi phạm trên một cảnh ĐANG SỐNG.**

| Vi phạm | Chỉ thị | Là gì |
|---|---|---|
| `eval` | `script-src` | **thông tin mới** — `eval`, không phải `new Function`, nên `'wasm-unsafe-eval'` không phủ |
| `api.iconify.design` · `api.unisvg.com` · `api.simplesvg.com` | `connect-src` | Iconify gọi ba CDN ngoài — xác nhận đúng món "Iconify ngoại tuyến" của T7.3 |

Mục e trước đây đếm 6 vi phạm trên một cảnh **đã chết lúc t = 2 804 ms**; ở đây cảnh **mount
thành công và sống** dưới CSP. Nhưng đây là bản `mount()` tối giản, nên **không** kết luận được
rằng T7.1 đã tự khỏi.

**2. Phép thử "tệp thiếu trả 404 sạch" KHÔNG đo được trên `vite preview`.**

`GET /assets/pascal/khong-co-tep-nay.js` → **200**, `content-type: text/html`, 467 byte HTML.
`vite preview` luôn rơi về `index.html`; nó là SPA fallback, không phải máy chủ sản phẩm. Cấu
hình thật (`B0-08.md:118`, `try_files $uri =404`) mới trả 404 sạch, và spike không chạy nginx.

Cái **có** đo được, và là tin tốt: `nosniff` được phục vụ, nên trình duyệt **từ chối chạy** một
tệp HTML nhận vào chỗ `<script type="module">` — hỏng sẽ hỏng **ồn ào**, không phải màn trắng.
**Món mang sang T9.1:** phép thử 404 phải chạy trên nginx thật (hoặc Docker B0-08).

### Dung lượng vách ngăn — con số cổng thứ năm sẽ đọc

| Thành phần | KiB gzip |
|---|---|
| mã của vách ngăn (8 tệp: `pascal-mount.js` 1 314,8 · `pdfkit` 382,2 · `basis_transcoder.wasm` 241,8 · `manifold.wasm` 201,0 · …) | **2 170,4** |
| … **sau** khi áp nhát cắt C2 | **≈ 1 727,6** |
| tài sản Pascal phải chuyển vào cùng thư mục (224 `.webp` + 145 `.glb` + 24 `.mp3`) | **+ 5 398,2** |
| **vách ngăn đầy đủ, sau C2** | **≈ 7 125,8** |

`publicDir: false` giữ cho vách ngăn nhỏ, nhưng nó cũng có nghĩa là **400 tệp tài sản của Pascal
không nằm trong đó**. Luật số 6 của T9.1 nói *"không tài sản Pascal nào dưới `public/` ngoài thư
mục đó"* — nên trong bản thật chúng phải vào cùng thư mục, và cổng thứ năm sẽ đếm chúng.

---

## 8. Nghiệm thu đợt — đạt gì, không đạt gì

| Điều kiện "Xong khi" | Trạng thái |
|---|---|
| `git status --porcelain` của `F:/AppFront` rỗng | **ĐẠT** |
| Nhánh `pascal-b2-react19` rebase lên `af984b4` | **ĐẠT** — 3 commit |
| `pnpm verify` 7/7 | **KHÔNG ĐẠT trên nhánh React 19** — dừng ở bước 4. **Nhưng nguyên nhân đã tìm ra và sửa được, và 7/7 đã ĐẠT trên một cây khác.** Xem §8b ngay dưới |
| `pnpm size` 4/4 | **KHÔNG ĐẠT tại thời điểm T4.1 — 3/4** (màn đầu 178,1 / 175). **Đã giải quyết sau đó:** nhát cắt `vi.json` cho **4/4**, màn đầu **137,4 / 175**. Xem §8c |
| 8/9 mục G1 có số, mục e là sàn | **8/9 có số — ĐẠT.** Mục **e** là sàn đúng như sổ tay dự liệu (chỉ đo lại được ở T7.2, sau cổng). Mục **b** nay có số đủ cho cả hai bên. Mục **c** nay đọc là **"đã đo — trùng điều kiện với b"**, không phải "chưa chạy": Chrome trên máy này chỉ thấy Intel UHD nên lượt c không thể khác lượt b — xem §8f. Vẫn là **một kết quả**, không phải một lỗ hổng |
| Bảng ba nhát cắt kèm số và cái mất đi | **ĐẠT** |
| Hai bảng giây (trước cắt và sau cắt) | **ĐẠT** |
| Ba con số dung lượng, báo cả hai đơn vị | **ĐẠT** |
| Dừng lại, trình hồ sơ, chờ T4.2 | **ĐẠT** — hồ sơ này; **T4.2 không làm** |

---

## 8b. `pnpm verify` — nguyên nhân thật, và **7/7 đã đo được**

Câu tôi viết ở bản trước của §8 — *"hạn 5 000 ms của vitest gặp máy tải nền"* — đúng về triệu
chứng và **sai về chỗ sửa**. Tôi đã kèm câu *"không hạ ngưỡng: `vitest.config.ts` nằm trong danh
sách cấm"*, mà **`vitest.config.ts` không khai `testTimeout`**: 5 000 ms là mặc định của vitest
2.0.3. Nên "không đụng tệp cấm" và "sửa được" chưa bao giờ loại trừ nhau.

**Chỗ tiêu hết 5 000 ms không phải phép kiểm.** 5 trong 6 lượt hết hạn **không có `waitFor` nào**
trong thân bài; `expectSevenStates` là hàm đồng bộ. Thứ duy nhất được `await` là một lượt
`import(/* @vite-ignore */)`, và `@vite-ignore` làm Vite bỏ phân tích import → cả cây module của
màn mới được resolve/transform/nạp **bên trong bài kiểm đầu tiên gọi tới**, và bài đó đếm luôn
lượt biên dịch vào hạn của nó. Cột `collect` của lượt verify: **450,82 s**.

Giàn giáo `@vite-ignore` ấy đã hết việc — docblock của nó nói nó tồn tại vì tệp anh em chưa tồn
tại, nay cả 5 thư mục đã đủ tệp và **không tệp nào dùng `vi.mock`**.

### Đã sửa, và đây là số

Nhánh `mungvu2004/pascal-t-verify`, **off `af984b4`**, **9 tệp test, +167/−15 dòng**,
**0 dòng mã sản phẩm · 0 tệp cấu hình · 0 ngưỡng bị hạ · 0 khẳng định bị bỏ**:

| # | Cây | Tải CPU | Kết quả |
|---|---|---|---|
| — | `af984b4`, 8 tệp nghi vấn | không đo | **5 tệp hỏng**, 6/116 test hỏng |
| — | nhánh React 19 chưa sửa, 8 tệp | 24,2 % | 1 tệp hỏng, 115/116 |
| — | nhánh đã sửa, 8 tệp | 24,6 % | **8/8 đạt · 116/116** |
| 1 | **`verify` đầy đủ**, 8 tệp đã sửa | 18,1 % | **1 tệp hỏng / 341** — `Viewer3DPanels.test.tsx:161`, **cùng khuôn `LAZY_WAIT`** |
| 2 | `verify` đầy đủ, **9 tệp** | **25,9 %** | **7/7 · mã thoát 0** |
| 3 | `verify` đầy đủ, 9 tệp, **sau rebase lên `217977f`** | **30,7 %** | **1 test hỏng / 7 189** — `PropertyInspector.test.tsx:1154`, **KHUÔN KHÁC** (xem dưới) |
| 4 | `verify` đầy đủ, **10 tệp** | **30,0 %** | **7/7 · mã thoát 0** |

Thô: `A-TV-8tep-sau-sua.txt` · `A-TV-verify-day-du.txt` · `A-TV-verify-lan2.txt` ·
`A-TV-verify-sau-rebase.txt` · `A-TV-verify-lan4.txt` · `A-TV-n8-5luot.txt`.

### Lượt 3 — và câu tôi phải rút lại

Sau lượt 2 tôi báo "`verify` 7/7 **đạt**". Lượt 3, trên cùng nhánh đã rebase, **hỏng ở tải 30,7 %**.
Nên câu đúng là: **7/7 đã đạt, chưa chứng minh là đạt ổn định** — tôi đã báo nó như một kết luận
vững hơn số liệu.

Nhưng chỗ hỏng là **loại khác**, và **không** thuộc 9 tệp tôi sửa:
`PropertyInspector.test.tsx:1154` là bài **A12** ("Esc đóng lớp trên cùng"), và nó **không hết hạn**
— nó hỏng ở một khẳng định boolean.

Bài ấy gõ `?` mở bảng phím tắt, gõ `Esc`, rồi đếm binding phạm vi `dialog` trong sổ đăng ký. Lượt
**mở** có `findByRole(..., { timeout: ASYNC_TIMEOUT_MS })` để chờ. Lượt **đóng** đọc sổ **đồng bộ**,
ngay sau `act`.

Và đây là chỗ đáng kể: docblock của chính `ASYNC_TIMEOUT_MS` (`:1038-1039`) tự khai nó là *"Trần chờ
rộng rãi cho chunk tải muộn **VÀ cho hoạt cảnh thoát của bảng**"* — tức tác giả **đã tính** tới lượt
chờ khi đóng, nhưng **lượt chờ đó chưa bao giờ được viết**. Hằng số tồn tại cho một phép chờ không có
trong mã. Bảng đóng qua `AnimatePresence` chạy trên `requestAnimationFrame` **thật**, nên khi máy có
tải nó rơi ra ngoài nhịp flush của `act`.

**Sửa:** viết đúng lượt chờ mà docblock hứa — `waitFor` quanh phép đếm sổ, dùng chính
`ASYNC_TIMEOUT_MS` đã có. Nó **không nới một khẳng định nào**: vẫn đòi sổ về **0**, tức bảng thật sự
đóng; chỉ thôi đòi điều đó xảy ra trong **cùng một nhịp flush**, mà A12 chưa bao giờ hứa nhịp.

Thành **10 tệp test, off `217977f`**. Vẫn **0** dòng mã sản phẩm · **0** tệp cấu hình · **0** ngưỡng
bị hạ · **0** khẳng định bị bỏ.

### Đọc con số này cho đúng — ba giới hạn

1. **Cây đạt 7/7 là master + 10 tệp test, tức React 18.3.1** — không phải nhánh React 19. Nên ô
   "kích thước gói **đạt**" ở đó là 4/4 của **master**, không phủ định 178,1 / 175 của nhánh React 19
   (mà §8c nay đã giải quyết riêng).
1b. **Lượt `verify` đầy đủ đạt ở 25,9 % và 30,0 %; lượt hỏng ở 30,7 %.** 30,0 < 30,7, nên bảng bốn
   lượt ở trên **một mình nó chưa** chứng minh được ở mức tải đã làm vỡ. Bằng chứng riêng cho bài đã
   vỡ, chặt hơn vì nhắm đúng bài đó — `A-TV-n8-5luot.txt`, 5 lượt liên tiếp trên cây đã sửa:

| Lượt | Tải CPU | Kết quả |
|---|---|---|
| 1 | 30,0 % | đạt |
| 2 | **31,5 %** | đạt |
| 3 | **37,9 %** | đạt |
| 4 | 30,3 % | đạt |
| 5 | **31,0 %** | đạt |
| | | **5/5, 0 hỏng** |

   **Bốn trong năm lượt ở trên mức 30,7 % đã làm nó vỡ**, kể cả một lượt **37,9 %** — cao hơn 7,2
   điểm %. Cộng với lượt `verify` đầy đủ 7/7 ở 30,0 %, đó là bằng chứng đủ cho **bài này**. Nó **không**
   khai rằng mọi bài "đỏ khi máy có tải" đã hết — chỉ khai rằng **hai khuôn** đã tìm ra nguyên nhân và
   đã sửa đúng nguyên nhân. Bài thứ ba lộ ra ở tải cao hơn nữa thì cách xử vẫn thế: tìm **thời điểm đo
   sai**, không nới trần.
2. **Kết luận đúng là:** cổng `verify` **đọc được** trên máy này, và 7/7 đạt được **mà không đụng
   một ngưỡng nào**. Câu "máy này không chạy được `verify` 7/7" mà tôi viết ở bản trước **là sai**.
3. Muốn nhánh React 19 đạt 7/7 thì **chép 9 tệp này sang** — khi đó nó sẽ dừng ở bước **6**
   (kích thước gói, 178,1 / 175), không còn dừng ở bước 4. Đó là chỗ §5/Câu 5 nói tới.

Gộp nhánh này vào master là **Câu 1** của `hoi/T4.1-sau-dieu-tra.md` — cần một câu của người dùng,
vì đợt này bị cấm push · mở PR · gộp.

---

## 8c. `pnpm size` — **4/4, đã đo**, và nhát cắt giúp cả cổng thứ ba

Thi công ở nhánh `mungvu2004/pascal-t51-vijson`, commit `89d19e9`, off `a922118` (nhánh React 19).
**7 tệp, +37/−22 dòng.** `src/i18n/vi.json` **không đổi một byte**. Tải CPU nền 35,9 %.
Thô: `A-W1-vijson-size.txt`.

| Cổng | Trước cắt | Sau cắt | Trần | Dư |
|---|---|---|---|---|
| **màn hình đầu tiên** | 178,1 **HỎNG** | **137,4 ĐẠT** | 175 | **+37,6** |
| chi phí thêm cho một màn | **264,5** ĐẠT | **264,6 ĐẠT** | 280 | +15,4 |
| chunk JS lớn nhất | — | 139,0 ĐẠT | 170 | +31,0 |
| tổng CSS | — | 10,9 ĐẠT | 12 | +1,1 |

> **Một con số ở bảng này từng SAI, và nó sai theo hướng có lợi cho nhát cắt.** Bản đầu ghi cổng route
> **279,2 → 264,6, "tốt lên 14,6"**. Sai: **279,2 là của nhánh three 0.186**, không phải nhánh này.
> Hai số của hai cây, trình bày như một cặp trước/sau. Số đúng của **cùng một cây**:
> **264,5 → 264,6**, tức **nhích xấu 0,1 KiB**. Đã đính chính lên PR #6.
> Thô: master **264,2** (`A-T1.2-size-master.txt`) · trước cắt **264,5** (`A-T1.2-build-size.txt`) ·
> sau cắt **264,6** (`A-W1-vijson-size.txt`) · three **279,2** (`A-T1.3-three.txt`).

`typecheck` 0 lỗi · `lint` 0 problem · `SIZE EXIT=0`.

Chunk vào: **377,9 → 236,1 KiB thô**, **119,8 → 79,1 KiB gzip**. Con số 79,1 **khớp đúng** giá trị
tôi ước ở §10b bằng cách ghép literal nhỏ hơn vào chunk đã dựng — hai phép đo độc lập, cùng một số.

**Nhát cắt KHÔNG mua được gì cho cổng route — và lý do đáng hiểu.** `baselineFor` lấy mốc trừ của
một route bằng **bao đóng tĩnh của chunk vào**. Nhát cắt làm chunk vào nhỏ đi **26,1 KiB**, nên mốc trừ
nhỏ đi đúng 26,1; và vì 47 khoá `vi.json` cũng nằm trong **bao đóng riêng** của chunk route, **cả hai
cột cùng tụt**. Hiệu số giữ nguyên.

Đo độc lập trên **cả 59 đích** bằng `tools/bang-route.mjs` (nhập bốn hàm cổng đã xuất, tự gọi lại cổng
thật để đối chiếu — khớp **0,0 KiB** trên cả hai cây): `mốc trừ` giảm **25,8–26,2 KiB ở MỌI dòng**,
`bao đóng riêng` giảm đúng chừng đó, nên `chi phí thêm` chỉ lệch **+0,0 … +0,5 KiB**; tổng Δ cả 59 dòng
là **+11,4 KiB** rải đều. Thứ tự, tên route và `#mod` **y nguyên** — không route nào đổi hạng.

Nói gọn: nhát cắt **thật sự** đưa 47 khoá ra khỏi gói, nhưng cổng route đo một **hiệu số**, và một
lượng bị trừ ở **cả** số bị trừ lẫn số trừ thì hiệu không đổi. Bảng "ngược dấu" ở §10b vẫn đúng về cơ
chế; điều nó chưa nói là trường hợp **cả hai cột cùng tụt**.

### Hai phép đối chứng — vì "cổng xanh" một mình không đủ

"Cổng xanh" không phân biệt được **cắt ăn** với **cắt hụt mà may**. Hai chuỗi dưới đây không tồn tại
trong bất kỳ `.ts`/`.tsx` nào của `src/`, nên hit duy nhất chỉ có thể đến từ `vi.json`:

| Chuỗi | Thuộc | Phải ra | Đo được |
|---|---|---|---|
| `Chiều cao thông thuỷ áp dụng từ {{min}} đến {{max}} mét.` | khoá **bỏ** (`project.*`) | 0 tệp `dist` | **0** |
| `Đã lưu {{minutes}} phút trước` | khoá **giữ** (`autosave.*`) | ≥ 1 tệp `dist` | **1** |

### Hai chỗ phải ghi lại, không nằm trong kế hoạch

**Nhát cắt phụ thuộc Vite 5.** `json.stringify` mặc định `false` ở Vite 5 nên `dataToEsm` sinh named
export. Ở **Vite 6+** mặc định thành `'auto'`: tệp > 10 KB bị đổi sang `JSON.parse("…")` và named
export **mất hẳn** → bảy dòng nhập này hỏng lúc dựng. Hỏng ồn ào, không âm thầm — nhưng lần nâng Vite
phải biết trước.

**Hai binding phải đổi tên, không nhập trần được.** `useSaveIndicator` đã có tham số tên `autosave`
(`:75`), và `pipeline.ts` đã có `PIPELINE_STAGES`/`getPipelineStages`. Nhập trần sẽ đụng `no-shadow`,
mà `--max-warnings 0`.

**Còn nguyên một cảnh báo, không phải cổng:** tổng JS mọi chunk **1 043,7 / 800 KiB**, quá 243,7.
Nó **không chặn** lượt chạy. Lời khuyên in kèm nó ("cắt `vi.json` theo nhóm khoá") nay đã làm xong.
Món thứ hai — *"đưa fixture/mock ra khỏi gói sản phẩm"* — **nay cũng đã thi công và đã đo, và phép đo
nói KHÔNG nên gộp**: commit `1d7dccd` (11 tệp, **+259/−75**) cho cổng route **264,2 → 263,0**
(−1,2 KiB) nhưng **tổng JS 1 068,0 → 1 068,2 (+0,2 — XẤU ĐI)**, vì "đưa ra khỏi gói" **không phải**
"dời sang chunk nạp muộn": chunk nạp muộn vẫn ở trong gói, và thêm một ranh giới chunk thì tốn thêm.
Kèm **một thay đổi hành vi thật ở chế độ dev** (tên dự án trên breadcrumb hai màn đến từ mock API
thay vì `'Nhà phố mẫu'`, và **không tự sửa** sau khi chunk về). Thô: `A-X3-fixture.txt`; mốc trừ
`A-T1.2-size-master.txt`.

---

## 8d. Độ mượt — bộ đo đã sửa, và phán quyết đổi **ý nghĩa**

`tong-b.mjs` 413 → 539 dòng, thêm `wpct` (phân vị cân theo thời lượng), `phanQuyet45`, `bangCap`, và
hai đại lượng mới. Ngưỡng **1,200 không đổi** — chọn ngưỡng là quyết định của người dùng, chưa có.
Thô: `M-W2-tong-b-moi.txt`. `--tu-kiem` đạt với 8 khẳng định mới.

**Quy tắc 4/5 cặp nay có thật trong mã.** Trước đây nó chỉ có trong lời: bộ đo lấy 3 lượt đầu rồi ra
một tỉ số, cặp 4 và 5 bị bỏ im lặng.

| Cặp | w50 theo **thời lượng**: cũ / Pascal / tỉ số | CPU/giây: cũ / Pascal / tỉ số |
|---|---|---|
| 1 | 19,60 / 22,20 / **1,133** | 9,10 / 14,55 / **1,600** |
| 2 | 20,00 / 22,20 / **1,110** | 8,68 / 14,13 / **1,628** |
| 3 | 19,70 / 21,70 / **1,102** | 8,85 / 13,40 / **1,514** |
| 4 | 19,60 / 21,20 / **1,082** | 8,93 / 10,73 / **1,202** |
| 5 | 20,00 / 21,90 / **1,095** | 6,83 / 13,87 / **2,032** |

| Điều kiện | Đại lượng | Cặp vượt | Chạm? |
|---|---|---|---|
| 1 | w50 theo thời lượng | **0 / 5** | **không** |
| 2 | CPU luồng chính mỗi giây | **5 / 5** | **CÓ** |
| — | p50 theo đếm (cách cũ, in để đối chiếu) | 5 / 5 | có |

**Pascal vẫn chạm điều kiện dừng, nhưng vì lý do khác hẳn.** Cách cũ nói "Pascal cho khung chậm hơn
7,75 lần" — đó là đọc lại `maxFps = 50`. Số mới nói: nhịp khung người dùng thật sự thấy gần như bằng
nhau (19,7 → 22,2 ms, **+13 %**), còn cái Pascal tốn thêm là **CPU luồng chính ~1,6 lần** để cho ra
cùng mức mượt đó. Chốt hay không chốt thành **quyết định về chi phí CPU**, không phải về độ mượt.

### Bốn chỗ phải đọc kèm, không được trích tỉ số mà bỏ chúng

1. **Một bằng chứng độc lập cho lập luận "7,750 chỉ là `maxFps`":** `w50` cách 1 (khoảng giữa **mọi**
   lần gọi rAF, không chỉ lần có vẽ) = **1,018**, và màn cũ ra **17,00 ms** — đúng một nhịp 60 Hz.
   Hai bên gọi rAF ở cùng nhịp máy; khác biệt duy nhất là **lần gọi nào thực sự vẽ**.
2. **Cặp 4 sát ngưỡng đến mức đáng lo:** 10,73 / 8,93 = **1,2016** → làm tròn 3 chữ số ra 1,202, vượt.
   Làm tròn **2** chữ số ra 1,20, **không** vượt. Quy tắc 4/5 vẫn vững vì chỉ cần 4 cặp — nhưng nếu
   ai từng nghĩ tới quy tắc **5/5** thì cặp này quyết định tất cả.
3. **Cặp 5 có tỉ số CPU cao nhất (2,032) vì mẫu số kém, không vì Pascal tệ hơn.** `b-cu-5` lệch chuẩn
   ở mọi cột: fps thấp nhất (127,1), `cpuGiay` thấp nhất (6,83 so với 8,68–9,10), và tải máy cao nhất
   (45,3 % / 48,3 %). Máy bận → màn cũ vẽ ít hơn → **tốn ít CPU hơn** → tỉ số phồng lên. Bốn cặp còn
   lại nằm gọn **1,202–1,628**; đó mới là khoảng nên tin.
4. **Một cải chính số của tôi:** tỉ số theo mốc `hien` là **1,992**, không phải 1,990 như tôi ghi
   (trung vị 3 lượt đầu: cũ 813,60 ms, Pascal 1 620,30 ms). Lấy trung vị 5 tỉ số từng cặp ra 1,995;
   trung vị cả 5 lượt mỗi bên ra 2,088. Xê dịch so với mốc `tMo` là **45,6 %**, không phải 46 %.
   Không đổi kết luận nào.

---

## 8e. CSP — **4 vi phạm → 0** trên trang spike, chỉ sửa hai tệp phía AppFront

> **Sửa 2026-10-03 — số đúng hôm nay là 1, không 0.** Con số 0 dưới đây đo trên trang spike
> `vach-ngan.html`. Màn thật `/projects/:id/3d/pascal` không có tệp `src/vach-ngan.tsx`, và không chỗ
> nào trong `src`/`vite.pascal.config.ts` đặt `jitless` — nên vi phạm `script-src | eval |
> …/assets/pascal/pascalMount-*.js` vẫn còn (1 vi phạm dưới CSP tự dựng; cảnh vẫn dựng). Alias Iconify
> (`vite.pascal.config.ts`) thì còn hiệu lực: ba vi phạm `connect-src` không tái hiện. Chi tiết:
> `docs/notes/e2e/fragments/W08.md` B-V10-05.

Thô: `F-W3-csp-sau-va.txt` · `F-W3-vach-ngan-sau-va.json`.
(Spec **ghi đè** `F-T3.7-vach-ngan.json` mỗi lượt, nên bản "sau vá" đã cất tên riêng.)

| Phép kiểm | Trước | Sau |
|---|---|---|
| `viPhamCsp` — khẳng định duy nhất của spec (`t37-vach-ngan.spec.ts:106`) | **4** | **`[]`** |
| host Iconify trong gói Pascal | 3 | **0** |
| `PW EXIT` | — | **0**, 1 passed (8,3 s) |

**Hợp đồng không thụt lùi** — đây là phần quan trọng bằng con số 0: `hopDong.co: true`, đủ bốn giá
trị trả về đúng kiểu (`applyDiff` · `cancelTopLayer` → `boolean` · `setFloor` · `dispose`),
`khoaReact: [1, 1]` (hai React root cùng sống), `soCanvas: 1`, `pascalCoRootClass: true`,
`trangThaiChuNha: "đã gắn gói Pascal"`, `loiNang: []`, `loiTrang: []`.

### Hai tệp, và vì sao chỗ đặt mới là phần khó

**`src/vach-ngan.tsx:30`** — `window.__zod_globalConfig = { jitless: true }` ở **thân module**, còn
thẻ script Pascal dựng trong `useEffect` (`:71`). Thân module chạy trước mọi `useEffect`; đo trên mã
đã transform: cờ ở ký tự **99**, `createElement("script")` ở **1233**.

Và cờ khoá **cả hai** `new Function` của zod, không chỉ phép dò: `util.js:150`
(`if (globalConfig.jitless) return false;` — `new F("")` không tới) và `schemas.js:1085`
(`const jit = !globalConfig.jitless; const fastEnabled = jit && allowsEval.value;` — `&&` đoản mạch
nên getter `allowsEval.value` **không bao giờ được đọc**, kéo theo `doc.compile()` không chạy).
Đã kiểm terser giữ nguyên cả hai chốt: `if(ty.jitless)return!1` và `const a=!ty.jitless,l=a&&xg.value`.
`pure_getters: true` (`vite.config.ts:29`) **không** hoist getter ra trước `&&`.

> **`import type` ở `vach-ngan.tsx:5` là load-bearing, không phải sở thích.** Đổi nó thành import
> thường là cả đồ hình Pascal (kể cả zod 4) thành import tĩnh, được hoist lên **trước** thân module,
> và cờ đến muộn **một cách im lặng**. Đây là chỗ duy nhất được phép làm hỏng nhát vá này.

**`vite.pascal.config.ts:29-32`** — alias `@iconify/react` → `@iconify/react/offline`. Bản offline:
**23 265** byte (bản đầy 51 312), `grep -c -E "fetch|XMLHttpRequest|api\.iconify\.design"` ra **0**,
export `{ Icon, InlineIcon, addCollection, addIcon }`. Trải `goc.resolve` để không mất `next/image`,
`next/link`, `@appfront`, `dedupe`. Grep `@iconify/react/` (nhập sâu) trên mã Pascal ra **0** — quan
trọng, vì alias dạng object của Vite khớp theo **tiền tố**.

### Không sinh vi phạm thứ năm

Không có `<script>` nội tuyến. Cờ nằm trong module đã bundle, phục vụ từ `'self'` qua
`<script type="module" src>` (`vach-ngan.html:18`) — đúng thứ `script-src 'self'` cho phép. CSP
(`B0-08.md:119`) **không** có `'unsafe-inline'`, nên đường thẻ inline sẽ là vi phạm mới.

### `jitless` có làm zod sai kết quả không — **không**, và đây là lập luận đọc từ mã

- `jitless` có đúng **ba** chỗ đọc trong cả zod 4.5.4, và chỉ `$ZodObjectJIT` dùng nó.
- Nó chỉ chọn giữa `fastpass()` và `superParse()`, mà `superParse` (`schemas.js:991`) **chính là**
  `inst._zod.parse` gốc của `$ZodObject`. `fastpass` là bản sinh mã đặc tả hoá của cùng vòng lặp đó.
- Bằng chứng zod tự coi hai đường là tương đương: `schemas.js:1102` đã có sẵn cửa thoát **theo từng
  lần parse** (`ctx.jitless !== true`). Một đường mà thư viện cho người gọi tự tắt từng lượt thì
  không phải đường cho kết quả khác.
- **Lý lẽ quyết định:** dưới CSP thật, phép dò **đã** trả `false`, nên `fastEnabled` **đã** là
  `false` — spike **đã** chạy đúng đường chậm đó ở lượt đo 4 vi phạm. Bật `jitless` không đổi đường
  nào chạy, nó chỉ bỏ phép dò. Delta hành vi so với số đã đo là **không**.
- Giá là **tốc độ parse object**, không phải đúng/sai — và con số đó **chưa đo**.

### Nghi can pdfkit — **đã loại, bằng chính con số 0**

`pdfkit.standalone` có 2 lời gọi `Function(...)` (không `new`) từ `function-bind` và
`is-generator-function`. Trước đây không biết chunk đó có được nạp trong lượt đo hay không.
`viPhamCsp: []` trả lời: hoặc nó không nạp, hoặc đoạn đó không chạy. Không còn nghi can nào cho phép
đo này. (Nếu một lượt sau lộ ra **đúng 2** vi phạm dạng `eval` thì đó là chỗ tìm lại.)

### Một báo động giả phải ghi lại

`grep -o "new Function(" public/assets/pascal/pascal-mount*.js | wc -l` **vẫn ra 2** sau khi vá — đã
đo. `jitless` là cờ **lúc chạy**, không phải hằng lúc dựng, nên terser không xoá được mã đã thành mã
chết. Đừng đọc con số 2 đó là thất bại; chỉ phán quyết của Playwright nói được.

### Chỗ chưa che, biết trước

`index.html` (lối vào `EditorScreen`) **không** được che: `src/EditorScreen.tsx:5` nhập
`@pascal-app/editor` **tĩnh**, nên cờ đặt ở thân module sẽ đến muộn vì import hoisting. Không ảnh
hưởng lượt đo này — `playwright.t37.config.ts:14` chỉ mở `/vach-ngan.html` — nhưng nếu sau này đo
qua `index.html` thì phải làm khác.

---

## 8f. Mục c và mục i — **hai nhãn trong hồ sơ này mô tả việc KHÔNG xảy ra**

Đây là phần nặng nhất của lượt soát. Cả hai mục đang được ghi sai **loại kết luận**, và với mục c thì
hồ sơ còn khẳng định hai việc **chưa bao giờ diễn ra**.

### Mục c — `chay-c.sh` hỏng **ba chỗ, im lặng**

Hồ sơ này (§0, §1, §8) và sổ tay ghi: *"Đã đặt `GpuPreference=1`"*, *"Khoá registry đã hoàn lại"*,
*"chưa chạy — chuỗi GPU không đổi"*. Đọc `M-T2.4-c.txt` thì ba câu ấy không đứng được:

1. **`reg add` HỎNG** — `M-T2.4-c.txt:8-9`: `ERROR: Invalid syntax.` Git Bash/MSYS2 băm các đối số
   `/v /t /d /f` thành đường dẫn. **Khoá chưa bao giờ được đặt.** Nên lượt khô đo đúng trạng thái
   **mặc định**, y như b — "giống nhau" là tất nhiên, không phải phát hiện.
2. **Phép so chuỗi GPU CRASH** — `M-T2.4-c.txt:18,31`:
   `ENOENT: no such file or directory, open 'F:\f\pascal-work\G3\raw\c-kho.json'`
   — bản trước của mục này in sai đường dẫn ấy (hai dấu thoát bị ăn: mất chữ `f` đầu, và
   `\raw` thành một ký tự điều khiển). `chay-c.sh:54-64` nội suy `$R` = `/f/pascal-work/G3/raw`
   (`chay-c.sh:15`) vào một chuỗi JS; Node trên Windows giải `/f/…` theo **ổ hiện tại** là `F:` →
   `F:\f\pascal-work\…`, một đường không tồn tại.
3. **Hệ quả nặng nhất:** vì (2) crash nên `c-gpu-doi.txt` không được ghi, và `chay-c.sh:65`
   `doi=$(cat … || echo khong)` **âm thầm mặc định "khong"** → `:68` luôn vào nhánh "chưa chạy".
   **`chay-c.sh` hiện tại chỉ có thể in ra MỘT kết luận duy nhất, bất kể GPU làm gì.** Tiền đề không
   thể bị bác — nên nó chưa từng là một phép đo.

Và khoá `UserGpuPreferences` đã là `False` từ **trước** đợt (`plan-muc0-may.txt:6`); `reg query` bây
giờ vẫn "not found". "Hoàn lại" đúng ra là **"chưa bao giờ đặt được"**.

### Nhưng kết luận "không cần chạy c" **vẫn đúng** — vì một lý do khác, chắc hơn

Không phải "Chrome giữ GPU cũ" (lý do đang ghi — mong manh, một lần khởi động lại là đổi). Lý do thật,
có tệp thô **từ trước đợt**:

- Máy có **hai** GPU: `Intel(R) UHD Graphics` và `NVIDIA GeForce RTX 4050 Laptop`
  (`plan-muc0-may.txt:3-4`).
- **Chrome chỉ thấy một.** `plan-probe-webgpu.txt`: xin adapter với **`high-performance`** *và*
  **`low-power`** đều trả `intel · gen-12lp`, `isFallback: false`. `plan-probe-gpu.txt`: WebGL là
  Intel UHD ở **cả hai** bộ cờ. Và `b-chung.ts:116` xin adapter **`high-performance`** — vẫn Intel.
- Kế hoạch **đã biết trước**: `G1/ke-hoach.md:854` — *"L31 | Power saving để ép GPU tích hợp | mặc
  định đã là Intel | c có thể 'chưa chạy'"*.

Kiểm độc lập: cả **11** tệp thô (10 lượt b + `c-kho.json`) cho **đúng một** nhóm chuỗi GPU, giống
nhau **từng byte**.

**Nhãn đúng cho mục c không phải "chưa chạy" mà "đã đo — trùng điều kiện với b".**

### Và một hệ quả chưa ai nói ra, quan trọng hơn cả mục c

**Mười lượt b LÀ số của GPU tích hợp. Không ai đo GPU rời.** Với cổng quyết định thì đó là phía **an
toàn** (số đang có là đường chậm, p95 24,90 ms vẫn dưới 33,3) — nhưng phải viết ra, vì đọc "laptop có
RTX 4050" thì người ta sẽ tự cho rằng b chạy trên nó.

### Mục i — **đã đo từ 19/09**, không phải "chưa chạy"

`G1/raw/i-thu-1/i-thu-1.txt` ghi `3 passed (53.9s)`, `ma=0`, `loi-do=[]`. Chạy lại `tong-i.mjs` trên
`i-thu-1/i-preview-big.json`:

| | |
|---|---|
| `L_full` | **1 271 729** ký tự (3 412 node) |
| một lần `JSON.stringify` | **14,40 ms** |
| số lần gọi trong cửa sổ | **80 109**, trong đó **7** lần ≥ 50 % `L_full` |
| **lúc kéo / sau khi nhả** | **0 / 7** |
| p50 · p95 · max | **12,70 · 14,60 · 14,60 ms** |
| `phan-loai` | **không hợp lệ** — *"đo lỗi — máy bận (thiếu tệp tải CPU)"* |

Số có đủ; cái thiếu **chỉ** là hai tệp chứng `-cpu-truoc.txt` / `-cpu-sau.txt`. Đây đúng tiền lệ
`measure-viewer3d.mjs:238-246`: **in đủ số, từ chối tuyên bố "đạt"**. Nên loại đúng là **"đã đo nhưng
không kết luận được"**, không phải "chưa chạy".

**Và số đã trả lời được câu hỏi:** cú kéo **không phải trả tiền `JSON.stringify`** — **0 trong 7** lần
gọi lớn xảy ra trong lúc kéo, cả 7 rơi **sau** khi nhả chuột. Chi phí tự lưu nằm **ngoài** tương tác.

Lượt hợp lệ hoá: `G3/do-i-stringify.sh` → `M-X5-muc-i.txt`.

### Ba chỗ `chay-c.sh` phải sửa nếu có ngày cần chạy c

(a) bọc `MSYS_NO_PATHCONV=1` quanh hai lệnh `reg` (`:27,41`); (b) đổi `$R` trong khối `node -e` sang
dạng `F:/…`; (c) **bỏ `|| echo khong` ở `:65`** để thiếu tệp thành **lỗi**, không thành "không đổi".
Chưa sửa — sửa để mở đường cho một lượt đo không nên có là việc thừa, và công cụ ấy đã có đầu ra đi
vào hồ sơ.

### Một bẫy chưa ghi, tìm ra ở lượt này

`PLAYWRIGHT_JSON_OUTPUT_NAME` mặc định là `hi-ket-qua/pw-ket-qua.json`, **dùng chung giữa mục h và
mục i**. Nó **đã** bị ghi đè một lần: tệp hiện tại (19/09 23:22) chỉ còn 25 bài `h`, báo cáo
Playwright của lượt i lúc 23:04 **đã mất**.

---

## 8g. Mục i — **ba lượt, không lượt nào hợp lệ**, và một phát hiện vững qua cả ba

Đã chạy lại hai lượt hôm nay (`M-X5-muc-i.txt`, `M-X5-muc-i-lan2.txt`) cộng lượt 19/09 đã có. **Không
lượt nào `phan-loai=hợp lệ`**, và ba lượt **hỏng vì hai lý do khác nhau**:

| Lượt | Tải CPU (trước/sau) | `L_full` | 1 lần stringify | p50 · p95 · max | `tuong-doi-vi-tri` | Vì sao không hợp lệ |
|---|---|---|---|---|---|---|
| 19/09 | **thiếu tệp chứng** | 1 271 729 | 14,40 ms | 12,70 · 14,60 · 14,60 | **5** | thiếu hai tệp `-cpu-*.txt` |
| 26/09 lượt 1 | 22,6 / 30,1 | 1 271 729 | 11,20 ms | 12,10 · 19,90 · 19,90 | **0** | *kéo không làm đổi tường nào* |
| 26/09 lượt 2 | 19,2 / 19,7 | 1 271 729 | 11,10 ms | 10,80 · 11,60 · 11,60 | **0** | *kéo không làm đổi tường nào* |

Lượt 19/09 có cú kéo **thật** nhưng thiếu tệp chứng; hai lượt hôm nay có tệp chứng nhưng **cú kéo
không đổi tường nào** — dù `commit-trong-cua-so` vẫn là **3 `local`** ở cả hai. Tức bộ đo vẫn commit,
chỉ là điểm kéo không rơi vào một bức tường. Đó là **lỗi bộ đo**, không phải lỗi sản phẩm, và nó
**tái diễn 2/2** hôm nay trong khi 19/09 thì không — nên có gì đã trượt giữa hai ngày (cảnh `big` sinh
2200 tường, `choCanh` đòi **≥ 2200**, không có dư).

**Hai bài kia của mục i thì `hợp lệ` ở cả hai lượt hôm nay** (`i-preview-empty`, `i-preview-sample`:
1 commit `local` khi mở, đúng như §1 ghi). Chỉ bài `big`/stringify là chưa hợp lệ hoá được.

### Phát hiện **vững qua cả ba lượt** — và nó là câu trả lời của mục i

**`lúc kéo = 0, sau nhả = 7`** ở **cả ba** lượt, không lệch một đơn vị. Số lần gọi trong cửa sổ
79 026 · 79 579 · 80 109 — cùng bậc. Nên:

> **Cú kéo không phải trả tiền `JSON.stringify`.** Cả 7 lần stringify lớn đều rơi **sau** khi nhả
> chuột. Chi phí tự lưu nằm **ngoài** tương tác.

Kết luận ấy **không phụ thuộc** lượt nào được hợp lệ hoá, vì nó là một phép đếm **vị trí**, không phải
một phép đo thời gian. Ba lần đo độc lập cho cùng một con số.

### Nhãn đúng cho mục i

**"Đã đo ba lần, số nhất quán, chưa lượt nào hợp lệ hoá được"** — đúng tiền lệ
`measure-viewer3d.mjs:238-246`: **in đủ số, từ chối tuyên bố "đạt"**. Không phải "chưa chạy" (sai, đã
chạy ba lần) và không phải "đạt" (sai, `tong-i` từ chối cả ba).

Muốn hợp lệ hoá thì phải sửa điểm kéo trong `e2e/i-commit.spec.ts` cho nó chắc chắn rơi vào một bức
tường — **chưa làm**, vì mục i *"không dùng để dừng"* (`ke-hoach…ban-2.md:63`) nên nó không chặn cổng,
và sửa bộ đo giữa lúc đang trích số của nó là đổi thước lúc đang đo.

Thô: `M-X5-muc-i.txt` · `M-X5-muc-i-lan2.txt` · `G1/raw/i-thu-1/i-thu-1.txt`.

---

## 9. Hai điều kiện dừng — trạng thái cuối

Sổ tay Bước 2 ghi ba điều kiện dừng. Sau đợt này:

| Điều kiện dừng | Trạng thái | Số |
|---|---|---|
| **p95 > 33,3 ms** | **KHÔNG chạm** | Pascal xấu nhất **24,90 ms**; màn cũ 21,50 ms |
| **Pascal chậm hơn 1,2 lần màn cũ ở 4/5 cặp** | **CHẠM — ở 5/5 cặp, cả bốn cách đo** | trung vị 2,571 (cách 1) · 7,750 (cách 2) · 5,200 (cách 3) · 2,901 (thời gian mở) |
| **CSS làm đổi hình mà không cô lập được** | **KHÔNG chạm** | tỉ lệ điểm khác = **0** |

Và điều kiện dừng của Bước 3 ("cần CSG mà `manifold` không qua được CSP"): **KHÔNG chạm** —
AppFront không dùng CSG, và ba lượt trên bản đã bỏ manifold đều dựng được cảnh, 0 lỗi, 0 vi phạm CSP.

**Vậy đúng một điều kiện dừng bị chạm, và nó bị chạm bằng số đo hợp lệ ở cả hai bên.**
Hồ sơ này không diễn giải nó thành "đạt" và cũng không diễn giải nó thành "phải dừng" — cả hai đều
là việc của T4.2. Cái hồ sơ có thể làm là bày đủ ngữ cảnh để đọc nó:

- vsync **tắt** ở cả hai bên, nên con số là nhịp **tối đa máy làm được**;
- trong cùng 10 giây kéo, màn cũ vẽ **1 281–1 694** khung, Pascal vẽ **501–503** → ~150 fps so
  với ~50 fps;
- p95 của Pascal là 24,90 ms ≈ **40 fps ở phân vị 95**, tức mượt theo nghĩa người dùng;
- **chưa có** phép đo với vsync bật (`CO=0`), là phép đo gần nhất với cái người dùng thấy.

---

## 10. Việc của các Bước SAU cổng — đã làm được gì, và cái gì chặn cái gì

Người dùng yêu cầu làm tiếp cả các giai đoạn sau. Dưới đây là toàn bộ Bước 5–11 soi qua hai bộ
lọc: **có phụ thuộc quyết định T4.2 không**, và **có chạm luật cấm của đợt không**.

### Đã làm

| Mã | Việc | Kết quả |
|---|---|---|
| **T1.3** | rebase nhánh `three` lên `af984b4` (sổ tay dời xuống sau cổng) | **ĐẠT** — 2 commit, `size` **4/4**. Nhưng **màn 3D còn dư đúng 0,8 KiB** (279,2 / 280); three 0.186 tốn +15,0 KiB |
| **T5.1** | làm nhẹ màn đầu — khảo sát | **có số, chưa thi công — và con số đã ĐỔI, xem §10b.** Chỗ dư không phải ~3–4 KiB mà là **40,7 KiB**, và nó không nằm ở ba cạnh nhập tôi báo trước |

**Hai con số này cùng nói một điều:** hai nhánh nền đều "xanh" nhưng sát trần ở **hai cổng khác
nhau** — React 19 làm **màn đầu** vượt 3,1 KiB, three 0.186 để **màn 3D** còn dư 0,8 KiB. Bước 9
còn phải thêm một route và hai khoá cờ vào đường khởi động, và màn Pascal là một route mới. Gộp
T5.2 rồi T5.3 rồi mới đi tìm chỗ dư là đi tìm thứ không còn.

### Chặn bởi luật cấm của đợt — cần đúng một câu của người dùng

| Mã | Việc | Chặn bởi |
|---|---|---|
| T5.2–T5.4 | ba PR nền (React 19 · three · lucide) | **push · mở PR · hợp nhất vào master** |
| T5.5 | PR thêm gói Pascal (4 URL tarball + `pnpm.overrides`) | **thêm dependency** · và là chỗ **HỎI** của sổ tay |
| T5.6 | nâng `APPFRONT_SHA`, `kiem_bo_prompt.py` | sửa `F:/AppBack/backend/**` (chỉ đọc) |
| T6.1 | `gh repo fork pascalorg/editor` | **tạo fork** · **HỎI** |
| T6.2–T6.9 | sửa/dựng/phát hành fork | cần T6.1 |
| T7.1–T7.9 | sửa fork cho chế độ xem | cần T6.x |
| T8.1 | cổng nhập Pascal bằng `overrides` | sửa **`eslint-rules/**`** · **HỎI** |
| T8.2 | sửa bảng luật, ranh giới tầng, câu "không dùng react-three-fiber" | sửa **`CLAUDE.md`** · **HỎI** |
| T8.3–T8.8 | `src/lib/pascal` + bộ đổi dữ liệu | cần T5.5 (gói Pascal đã ghim) |
| T9.1 | PR vách ngăn + cổng thứ năm | **thêm cổng mới** · **HỎI** · và cần trần từ T4.2 |
| T9.2–T9.3 | hai khoá cờ + bộ nạp cờ | **HỎI** (hợp đồng cờ F-00a/B7-01) |
| T9.4–T9.8 | khung nhúng + màn xem | cần T7.9, T8.8, và **F-04a (W10)** |
| T10.x | chế độ sửa | **bỏ hẳn nếu T4.2 = B** · chờ F-04b (W11), F-04c (W12), F-05, F-08 |
| T11.x | chuyển hẳn | chờ **F-14 (W14)** |

### Chặn bởi chính quyết định T4.2

Nếu **T4.2 = D** thì Bước 5–11 bỏ hết. Nếu **= B** thì Bước 10 (16–25 ngày) bỏ. Làm trước bất cứ
việc nào của Bước 6 trở đi mà chưa có câu trả lời là chấp nhận rủi ro bỏ đi toàn bộ.

**Việc duy nhất còn làm được ngay mà không cần gì cả:** thi công T5.1 — nhưng **không phải** ba
cạnh nhập tôi báo trước; xem §10b. Và điều kiện "cần `pnpm verify` 7/7 để tin" **nay đã có**
(§8b), nên chỗ chặn ấy đã gỡ.

---

## 10b. T5.1 — con số cũ của tôi sai, và chỗ dư thật lớn hơn 13 lần

Tôi đã báo *"không có ≥ 5 KiB dư, chỉ ~3–4 KiB"* qua ba cạnh nhập: `lib/coloring/modes` (qua
`viewSlice.ts:2`), `lib/tools/shortcuts` (qua `shortcutRegistry.ts:41-46`), `domain/spatial/ids`
(qua `devtools.ts:20`).

**Hai trong ba cạnh đó phải bị gạch**, vì hai cổng nối nhau **ngược dấu**. `baselineFor`
(`check-bundle-size.mjs:267-281`) lấy mốc trừ của màn 3D bằng đúng `entryClosure`:
`presentWhenLoaded(Viewer3D)` trả về đúng một holder — **chunk vào** — và bao đóng tĩnh của chunk
vào chính là `entryClosure`. Nên `baseline(Viewer3D) = entryClosure`, và:

| Việc làm | Cổng 1 (dư −3,1) | Cổng 2 (dư 0,8) |
|---|---|---|
| module rời chunk vào, màn 3D **không** nhập | tốt | không đổi |
| module rời chunk vào, màn 3D **nhập tĩnh** | tốt | **xấu đi đúng bằng lượng đó** |
| module **nhỏ đi**, vẫn ở chunk vào | tốt | không đổi |

`useViewer3D.ts:69,71,72` nhập `createColoringMode` + `formatArea` + `formatPercent`;
`Viewer3D.container.tsx:169` và `useViewer3D.ts:65` nhập `isIdOfKind`/`isValidId`. Nên hai cạnh
`lib/coloring` và `domain/spatial/ids` **chuyển hoá đơn sang cổng 2**, mà cổng 2 chỉ dư **0,8 KiB**.
**Chunk vào đang bao cấp cổng 2** — docblock ở `check-bundle-size.mjs:259-265` nói đúng điều này,
chỉ chưa ai đọc theo chiều ngược.

### Chỗ dư thật: `src/i18n/vi.json` là **36 % chunk vào**

Bảy tệp sản phẩm nhập nó bằng **default**, mà default export của module JSON là một object literal
duy nhất — không rollup nào chẻ được. Hai đường tĩnh từ `main.tsx`:

```
main.tsx:8 → lib/query/queryClient.ts:3 → lib/errors/index.ts:10 → describeError.ts:1 → vi.json
main.tsx:6 → NotificationHost.tsx:44 → useNotifications.ts:37 → notificationBus.ts:1 → vi.json
```

Trong chunk vào của nhánh (`index-De7FbrCe.js`) nó là **một literal liền khối** `di`, byte
65 779 → 188 449 = **119,8 KiB thô**; hai mép là `@tanstack/react-query` và một hàm `crypto`, nên
vùng cắt không lẫn gì khác. Đo bằng `zlib.gzipSync` — cùng phép nén cổng dùng:

| phương án | KiB gzip chunk vào | tiết kiệm |
|---|---|---|
| hiện nay, 52 khoá | **119,8** | — |
| giữ 5 khoá `common·errors·autosave·pipeline·auth` | **79,1** | **40,7** |
| bỏ hẳn vi.json | 77,0 | 42,8 |

**Cổng 1 cần 3,1 KiB. Nhát cắt cho 40,7 — dư 13 lần.** Và nó **không đụng cổng 2**, vì nó làm
module *nhỏ đi* chứ không dời nó đi đâu. Năm khoá giữ lại là **4,8 / 152,8 KiB = 3,2 %** của
vi.json; 47 khoá bỏ = 148,0 KiB.

### Bảy tệp là một đơn vị không chia được

Một default import còn sót ở bất kỳ đâu **trong gói** là giữ nguyên cả object, nên phải đổi cùng
lúc: `lib/errors/describeError.ts:1` · `lib/mutations/notificationBus.ts:1` ·
`lib/realtime/pipeline.ts:1` · `hooks/useSaveIndicator.ts:6` · `AuthScreen.tsx:40` ·
`ValuePanel.tsx:15` · `useAuthScreen.ts:55`.

### Ba vật cản đã kiểm sạch

- `resolveJsonModule: true` (`tsconfig.json:13`) và `vite.config.ts` **không** khai khối `json` →
  vite giữ mặc định `namedExports: true`. Cấu trúc chunk chứng minh một nửa: `di` là **một** object
  literal chứ không phải `const common=…,errors=…` rồi gom — tức các const có tên đã sinh ra rồi bị
  gập vào default **vì không ai nhập theo tên**.
- `lib/testing/expectVietnamese.ts:81` cũng nhập default vi.json — mối đe doạ thật. Nó **không
  ship**: nơi duy nhất nhập nó là `useStateGallery.ts:41-42`, mà `StateGallery` nằm sau
  `import.meta.env.DEV` (`router.tsx:121-123`), và **0** chunk nào của bản dựng chứa
  `findNonVietnamese` hay `inspectAccessibility`.
- `describeError` đọc theo **đường chuỗi** (`readPath(viMessages, path)`, `:38`) nhưng **kiểu của
  đường ấy đóng kín**: `titleKey: \`errors.${AppErrorKind}.title\`` ·
  `primaryButtonKey: 'common.retry' | 'common.reload' | 'common.contact_admin' | 'common.close'`
  (`kinds.ts:40-46`). Đếm cả tệp: **31** đường `common.*`, **26** đường `errors.*`, **0** khác.
  Nên tập 5 khoá là đủ và `tsc` canh giúp.

### Cái chưa chứng minh được mà không dựng — và một cải chính

40,7 KiB đo bằng cách **ghép literal nhỏ hơn vào chunk đã dựng**. Đúng về lượng nén, nhưng chưa
chứng minh rollup **thật sự** rụng 47 khoá khi bảy tệp đổi sang nhập theo tên. Phép chứng minh là
`pnpm size` trên một nhánh có nhát cắt — **chưa chạy**, vì thi công T5.1 là **Bước 5** và đợt này
dừng ở T4.1.

**Cải chính một phép đo cũ của tôi:** phân rã màn đầu bằng `manualChunks` (`A-T5.1-soi-man-dau.txt`)
in `src-i18n` = 42,3 KiB gzip trong một tổng **540,8** KiB — con số tổng ấy vô hiệu vì ranh giới
chunk cưỡng bức phá tree-shaking xuyên chunk. Nhưng riêng dòng `src-i18n` **trùng** với 42,8 KiB đo
lại bằng cách khác, nên hai phép đo độc lập cùng chỉ một chỗ.

Thô: `A-T5.1-vijson-do.txt`.

---

## 11. Đính chính của bản đính chính (2026-09-27) — §8d đã đo rồi, và tôi đã nói sai

**Bản đầu của mục 11 này nói sai, và sai theo hướng có lợi cho Pascal.** Nó viết rằng phán quyết độ
mượt "phải đọc là *chưa đo được*" và rằng lượt đo lại "**chưa chạy**". Cả hai câu đều sai: **§8d của
chính hồ sơ này đã chạy lượt đo lại**, đã nhận ra `maxFps = 50`, và đã ra một phán quyết đầy đủ hơn.
Tôi viết mục 11 sau khi đọc bảng tóm tắt của sổ tay bản 2.2 mà **không** đọc §8d — đúng cái lỗi
"trích tỉ số mà bỏ bốn chỗ phải đọc kèm" mà §8d đã cảnh báo ngay dưới bảng của nó.

Phán quyết đúng, theo §8d:

| Điều kiện | Đại lượng | Cặp vượt | Chạm? |
|---|---|---|---|
| 1 | w50 nhịp khung, **cân theo thời lượng** | **0 / 5** | **không** |
| 2 | **CPU luồng chính mỗi giây** | **5 / 5** | **CÓ** (1,202–2,032) |

Tức: `maxFps = 50` giải thích được con số 7,750 cũ, và sau khi bỏ méo ấy thì **nhịp khung người dùng
thấy gần như bằng nhau** (19,7 → 22,2 ms, +13 %). Nhưng **Pascal VẪN chạm một điều kiện dừng** — nó
tốn **~1,6 lần CPU luồng chính** để cho ra cùng mức mượt đó. Chốt hay không chốt vì thế là **quyết
định về chi phí CPU**, không phải về độ mượt. Ai đọc mục 11 bản đầu rồi kết luận "không còn điều
kiện dừng nào bị chạm" là đọc phải chữ của tôi, không phải số của phép đo.

### Phần duy nhất của mục 11 bản đầu còn giá trị: cơ chế cái trần

§8d trích `maxFps = 50` ở một dòng (`viewer/index.js:229`). Bốn dòng dưới đây là cơ chế đầy đủ của
nó, và chúng đáng giữ vì lượt đo lại nào cũng phải tắt đúng cái trần này:

| Bằng chứng | Chỗ đọc được |
|---|---|
| `maxFps = 50` là **giá trị mặc định của prop**, không phải hằng số nội bộ | `@pascal-app/viewer/dist/components/viewer/index.js:229` |
| Prop ấy nằm trong **hợp đồng công khai** (`maxFps?: number`) → `mount()` truyền được | `index.d.ts:61` |
| `Viewer` đặt `frameloop: 'never'` rồi tự lái vòng vẽ bằng `FrameLimiter` | `frame-limiter.js` |
| Vòng vẽ **bỏ** mọi khung đến sớm hơn `1000 / fps` | `frame-limiter.js:16-22` (`if (elapsedMs < intervalMs) return null`) |

Ba con số của lượt đo cũ khớp đúng cái trần đó: 10 giây cho **501–503 khung** (= 50,1 fps), p95 của
Pascal **18,20 / 24,90 ms** quanh đúng `1000 / 50 = 20` ms, và p95 **không** chạm ngưỡng 33,3 ms ở
lượt nào.

**Bài học, ghi lại vì nó lặp lần thứ hai trong cùng hồ sơ:** đọc bảng tóm tắt của sổ tay không thay
được đọc mục gốc. Sổ tay bản 2.2 tóm §5c ("độ mượt CHẠM 5/5") và chưa hợp nhất §8d viết sau nó; một
người đọc chỉ bảng tóm tắt sẽ tưởng phán quyết cũ còn nguyên, còn tôi thì tưởng nó chưa ai sửa.
