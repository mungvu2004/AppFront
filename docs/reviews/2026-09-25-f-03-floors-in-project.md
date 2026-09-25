# F-03 — soát gộp độc lập · `feature/f-03-floors-in-project` @ `217f0fc` → `master` @ `0ff40bf`

**Ngày:** 2026-09-25 · **Người soát:** worker soát gộp độc lập (lượt 1) · **Phạm vi:** 22 file,
gộp từ bốn nhánh việc `-contract` · `-ids` · `-floors` · `-upload`.

## PHÁN QUYẾT: REQUEST CHANGES

Cổng xanh sạch, cả chín bất biến của F-03 đều giữ, năm món các worker tự khai đều đúng như khai.
Ba món phải vá trước khi gộp — tổng cộng khoảng mười dòng, không món nào đòi thiết kế lại:

1. một vi phạm A6 **mới do chính nhánh này tạo ra** (câu từ chối đổi tên nay lên màn, viết hoa và
   in mã tầng thô);
2. vé hoàn tác bấm vào **im lặng hoàn toàn** trong đúng cái tình huống mà mục "Lệch" tự khai —
   lời tự khai nói nó ra câu, thực tế nó không ra gì;
3. ba khoá `vi.json` mà khối [5] và khối [10] đòi, chưa có.

Không món nào làm hỏng hợp đồng BE, làm sai dữ liệu, hay chặn được lượt gộp quá một vòng sửa.

---

## 1. Bảy bước `pnpm verify` — tôi tự chạy, mã thoát thật

Chạy một lượt duy nhất trên worktree `f-03-review` @ `217f0fc`, `EXIT=0`.

| # | bước | kết quả |
|---|---|---|
| 1 | typecheck | **đạt** |
| 2 | lint (`--max-warnings 0`) | **đạt** |
| 3 | import vòng | **đạt** |
| 4 | test + độ phủ | **đạt** |
| 5 | build | **đạt** |
| 6 | kích thước gói | **đạt** |
| 7 | độ dài file | **đạt** (343 file · 59 vượt 250 · **0 vượt 400**) |

Không bước nào "chưa chạy" (E.10).

## 2. Số của tôi đặt cạnh số của việc gộp

| đo | việc gộp khai | tôi đo | lệch |
|---|---|---|---|
| Test Files | 341 | **341 passed (341)** | — |
| Tests | 7183 qua / 0 hỏng | **7183 passed (7183)** | — |
| entry / màn đầu | 163,0 → 163,4 KiB (trần 175) | **163,4** (dư 11,6) | — |
| chunk JS lớn nhất | 163,0 → 163,4 (trần 170) | **163,4** (dư **6,6**) | — |
| routeChunk `_index` | 264,2 → 264,2 (trần 280) | **264,2** (dư 15,8) | — |
| tổng CSS | 10,9 → 10,9 (trần 12) | **10,9** (dư 1,1) | — |
| *(cảnh báo)* tổng JS | 1065,2 → 1067,8 (mốc 800) | **1067,8** (quá 267,8) | — |
| độ phủ `domain/text/humanText.ts` | 100/100/100/100 | **100/100/100/100** | — |
| độ phủ `domain/spatial/ids.ts` | 100/100/100/100 | **100/100/100/100** | — |
| độ phủ `src/lib/upload` | 96,18/93,42/98,41/96,18 | **96,18/93,42/98,41/96,18** | — |

**Không một con số nào lệch.** Việc gộp báo trung thực.

Ghi chú biên: chunk JS lớn nhất còn dư **6,6 KiB** trên trần 170 (ghi chú hợp đồng §9.1 dự đoán
7,0). Đợt sau (F-07 / F-10 / F-11) phải nhìn chỗ này trước khi nhìn mã.

## 3. Chín bất biến của F-03 — soát từng cái

| # | bất biến | phán quyết | bằng chứng |
|---|---|---|---|
| 1 | thân #10/#34 không mang `projectId`; #10 có `id` client sinh | **ĐẠT** | `client.ts:799` gửi `{ ...toFloorWirePayload(body), id: body.id }` tới `ENDPOINTS.floors.create(projectId)`; `toFloorWirePayload` (`contracts.ts:183-190`) chỉ trải sáu khoá tầng, không có `projectId`. `client.test.ts:281` khẳng định `'projectId' in createBody === false`. #34 (`client.ts:950-958`) cũng qua đúng hàm đó |
| 2 | không `resolveConflict`, không dải "tải lại", không in mã lỗi | **ĐẠT** | `git diff` không thêm dòng nào chứa `resolveConflict`. Bảng `FLOOR_ERROR_SENTENCE_BY_CODE` (`useFloorManager.ts:199-204`) rẽ theo `code` rồi trả câu thuần; `floorErrorSentence` không bao giờ nối mã vào chuỗi. Chuỗi "tải lại" duy nhất là "hãy xuất sang PDF rồi **tải lại**" của nhánh CAD — nghĩa "tải tệp lên lại", không phải dải nạp lại trang |
| 3 | hoàn tác gọi máy chủ thật; ghi hỏng thì lùi cục bộ, không tầng ma | **ĐẠT** | `inverseRequestsOf` (`useFloorManager.ts:854-892`) dựng #11/#10/#34/#13 thật; `applyUndo:943` gửi chúng. Lùi ở `executeStep:832-845` và `applyUndo:947-955`, cả hai qua `deps.spatial.revertPatches?.(…)` (guard tuỳ chọn đúng kiểu `dispatch.ts:143`). Test `#11 hỏng thì lùi cục bộ…` (`useFloorManager.test.ts:1140`) khẳng định đồ thị về nguyên trạng, `historyStepCount() === 0`, `pastStates` chỉ +1 |
| 4 | 570 000 ms là hằng có tên; `removedAt` chỉ là mốc thời gian | **ĐẠT** | `FLOOR_RESTORE_WINDOW_MS = 570_000` (`useFloorManager.ts:196`), test ghim `toBe(570 * 1000)`. `removedAtRef` (`:690`) là `Map<string, number>` — chỉ mốc, `createRequest:715` xoá mốc khi khôi phục xong. Không một `Level` nào được giữ trong Map |
| 5 | không `set()` store trong hook; ghi đồ thị chỉ qua lệnh + `history` | **ĐẠT** | Mọi `.set(` trong hook là `Map.prototype.set`. `local/no-direct-set` và `local/no-draft-write-outside-commands` đều xanh ở bước 2 |
| 6 | `Math.random` không còn là nguồn chính; lấy mẫu loại bỏ byte ≥ 252 | **ĐẠT — tính lại và đúng** | `ids.ts:74-93`. `BYTE_LIMIT = 252 = 7 × 36`, nên byte 0…251 phủ đều 36 ký hiệu qua `% 36`; loại byte 252…255 là **đúng cách loại bỏ**, không lệch phân phối. `Math.random` chỉ còn là đường lùi khi vắng `crypto` |
| 7 | không `as unknown as` / `@ts-ignore` / `@ts-expect-error` / `export *`; không hạ ngưỡng, không xoá hay `skip` test | **ĐẠT** | Quét toàn diff: 0 kết quả cho bốn cấu trúc cấm. `vitest.config.ts` không nằm trong 22 file. Test cũ **tăng**, không dòng `.skip` nào thêm |
| 8 | không sửa view `.tsx`; không thêm component dùng chung | **ĐẠT** | `.tsx` duy nhất trong diff là `FloorUploadScreen.stories.tsx` — story, và khối [7] của prompt **đòi** đổi nó sang `PICKER_UPLOAD_EXTENSIONS` |
| 9 | không đụng khối [12] | **ĐẠT** | 22 file không chạm `src/lib/http/**`, `src/lib/errors/**`, `src/store/**`, `src/lib/commands/**`, `src/lib/query/**`, `src/lib/upload/index.ts`, `vitest.config.ts`, `eslint-rules/**`, `package.json`, `scripts/**`. `projectSettingsGateway.ts` chỉ đổi trong `deleteAllFloors`; `cadBranchConfirmGateway.ts` chỉ đổi trong `readFloorAvailability`. `git grep "floors.list("` — mọi lời gọi **mã** còn lại đều mang `projectId` (khối [11] mục 5 đạt; chú thích xem P2-2) |

### Bất biến `CLAUDE.md`

- **A6** — **MỘT VI PHẠM MỚI**, xem P1-1. Mọi câu do F-03 *viết mới* đều tiếng Việt có dấu, viết
  thường kiểu câu, không mã kỹ thuật.
- **A8** — đạt cho xoá / nhân bản / sắp xếp (vé 8 s). **Nợ** cho thêm / đổi tên / đổi cao độ / đổi
  chiều cao — xem §4 món 3.
- **A10** — đạt (bất biến 5 ở trên).
- **A11** — `FloorManager.test.tsx` không nằm trong diff và vẫn xanh; `readFloorList` ném lỗi để
  `useQuery` đặt `isError` (`floorManagerGateway.ts:1258`), tức #12 404 `resource:"project"` vào
  đúng trạng thái `error`, không màn trắng.
- **A15** — `metreText` / `metreDraftText` / `countText` vẫn nằm ở hook, không ở view;
  `local/no-raw-number` xanh.
- **Mục B** — không một thời lượng thô nào thêm; `local/no-raw-duration` xanh. `UNDO_WINDOW_MS`
  vẫn là mặc định của `createUndoTicket`, con số 8000 không xuất hiện ở màn.
- **Mục D** — view không đổi; toàn bộ logic mới nằm trong hook và gateway.
- **Bảy luật ESLint nội bộ** — xanh ở bước 2, sổ nợ `project.js:158-174` không dài thêm.

## 4. Năm món các worker tự khai — xác nhận

### Món 1 (Lệch) — vé 8 s phát trước request · **XÁC NHẬN, và lời tự khai NÓI NHẸ HƠN thực tế**

Đúng: `executeStep` gọi `plan.onApplied?.(stepId)` ở `useFloorManager.ts:822`, **trước**
`await sendInOrder(plan.requests)` ở `:825`.

**Đây là cái giá đúng, và không có cách rẻ hơn.** Lý do: khối [8] mục 3 của chính prompt đòi một
test *"bấm vé khi #11 còn bay → POST khôi phục sau khi #11 xong"*. Vé chỉ tồn tại trong lúc #11
đang bay nếu nó được phát trước khi request trả về. Dời `onApplied` xuống sau `sendInOrder` sẽ xoá
sổ kịch bản mà prompt bắt phải có.

Chú ý một chỗ lập luận sai trong lời tự khai: `runExclusive` đã lo phần *xếp hàng* rồi — vé bấm sớm
vẫn chờ đúng lượt kể cả khi phát muộn — nên lý do "để vé bấm lúc #11 còn bay vẫn xếp đúng hàng" mà
worker ghi không phải lý do thật. Lý do thật gọn hơn: **để vé kịp tồn tại**.

Cái phải sửa **không** phải chỗ phát vé, mà là cái xảy ra khi bấm vé chết — xem **P1-2**.

### Món 2 (Nợ) — #34 hỏng sau khi #13/#34 trước đã thành công thì không lùi · **XÁC NHẬN**

`sendInOrder` (`useFloorManager.ts:400-412`) dừng ở lỗi đầu và trả `index`; cả `executeStep:827` lẫn
`applyUndo:945` chỉ lùi khi `failure.index === 0`. Với `onReorderFloors` (`:1360-1364`) request là
`[#13, ...patchRequestsOf(...)]` — một lượt sắp xếp 4 tầng phát 1 + 4 = 5 request, nên có bốn vị trí
mà máy chủ giữ nửa vời. Lượt đổi chiều cao (`:1216-1223`) cũng vậy: `createChangeFloorHeightCommands`
trả hai lệnh và `patchRequestsOf` phát một #34 cho **mỗi** tầng bị dời.

Prompt 4.3 mục 5 dòng cuối cho phép, nên đây là nợ hợp lệ, không phải lỗi.

**Hậu quả người dùng có được nói tử tế không? — Có, nhưng chỉ vừa đủ.** Người dùng nhận đúng một
toast "chưa lưu được thay đổi tầng" + câu theo mã (ví dụ `FLOOR_REORDER_MISMATCH` → "danh sách tầng
vừa đổi ở nơi khác, thứ tự chưa được lưu."), và màn **giữ nguyên** thứ tự mới. Câu đó nói đúng rằng
chưa lưu được, nhưng **không** nói rằng máy chủ nay lệch một phần so với thứ tự đang hiện. Người
dùng rời màn rồi quay lại sẽ thấy một thứ tự thứ ba mà không ai báo trước. Đề nghị ghi vào sổ nợ
của đợt sau, **không** chặn F-03.

### Món 3 (Nợ A8) — thêm / đổi tên / đổi cao độ / đổi chiều cao chưa có vé 8 s · **XÁC NHẬN**

`onAddFloor` (`:1248-1268`) hoàn toàn không có `onApplied`. Ba nhánh của `onFloorFieldCommit`
(`:1155`, `:1204`, `:1221`) có `onApplied` nhưng nó là `announceStackIssue`, không phát vé. Chỉ
`onDuplicateFloor:1299`, `onRemoveFloor:1342`, `onReorderFloors:1374` gọi `publishUndoTicket`.

Đúng như trước F-03, và A8 nói mọi thay đổi phải kèm toast hoàn tác — nên đây là nợ thật. Đường
hoàn tác *có* tồn tại (Mod+Z, `:1394-1403`), nên không phải mất hẳn.

### Món 4 (Chưa vá) — ba tiêu đề toast thiếu khoá `vi.json` · **XÁC NHẬN, vẫn chưa vá** → **P1-3**

`grep` trên `src/i18n/vi.json`: `chưa thêm được tầng` = 0, `chưa đổi được tên tầng` = 0,
`chưa hoàn tác được thay đổi tầng` = 0. (Đối chứng: `chưa lưu được thay đổi tầng` = 1 — tiêu đề cũ
đã có khoá.) Ba chuỗi nằm ở `useFloorManager.ts:178-180` (`addRefusedTitle`, `renameRefusedTitle`,
`undoRefusedTitle`).

### Món 5 (Chú thích cũ nói sai) — `floorUploadGateway.ts:11` · **XÁC NHẬN** → **P2-2**

Đúng, và nặng hơn một dòng: cả mục `## Vì sao đọc tầng qua projects.read, không qua floors.list`
(`:9-15`) nay sai từ đầu tới cuối — nó viết `floors.list()` **không nhận mã dự án**, trong khi
chính nhánh này vừa làm nó nhận. Prompt 4.4.3 gạch đầu dòng cuối đòi "sửa chú thích đầu file".

`InputQualityGate/inputQualityGateway.ts:19` sai y hệt nhưng **ngoài phạm vi** (F-05a) — đã kiểm
và **không** tính vào phán quyết này. `cadBranchConfirmGateway.ts:11` tôi cũng đọc: nó viết
"`client.floors.list()` … trả về mọi tầng **của dự án**" — câu này nay **đúng**, không phải sửa.

---

## 5. Danh sách finding

### P1-1 · A6 + "không in mã kỹ thuật": câu từ chối đổi tên nay lên màn, viết hoa và mang mã tầng thô

**Đường:dòng** — `src/screens/qc/FloorManager/floorManagerGateway.ts:858` và `:872`, lộ ra qua
`src/screens/qc/FloorManager/useFloorManager.ts:1152`.

F-03 nối `say(FLOOR_MANAGER_TEXT.renameRefusedTitle, result.error.reasons.join(' '))` vào nhánh
`!result.ok` của `onFloorFieldCommit` (prompt 4.3 mục 2 đòi thế). Trên `master` nhánh đó bị nuốt im
lặng (`useFloorManager.ts:824` bản cũ: `if (result.ok) { … }`, không `else`). Nghĩa là **chính
nhánh này** đưa hai câu sau lên màn lần đầu:

- `:872` — `Tầng "${level.name}" đã mang đúng tên đó nên không có gì thay đổi.` — viết **hoa**
  đầu câu. A6 đòi viết thường kiểu câu. Chạm phải dễ: gõ lại đúng tên cũ rồi blur.
- `:858` — `Không tìm thấy tầng ${input.levelId} trong bản vẽ.` — viết **hoa** đầu câu **và** in
  thẳng mã thực thể (`L-0000000001`) cho người dùng. Khối [9] cấm in mã cho người dùng; A6 chỉ chừa
  ngoại lệ chữ hoa cho mã trục, mã lỗi, tên phím — mã tầng nội bộ không nằm trong đó. Chạm phải khi
  tầng biến mất khỏi đồ thị giữa lúc gõ (debounce 800 ms của `NumericField`) và lúc chốt.

Ba câu F-03 **tự viết** (`RENAME_REFUSAL_BY_REASON`, `floorManagerGateway.ts:821-826`) đều đúng A6 —
lỗi chỉ ở hai câu cũ nay bị phơi ra.

**Cách sửa gọn nhất** (trong `floorManagerGateway.ts`, không đụng view):

```ts
// :858 — bốn chỗ cùng khuôn (:700, :777, :858, :914), sửa hết một lượt
return refuse(FLOOR_COMMAND_TYPES.rename, ['không tìm thấy tầng này trong bản vẽ.']);
// :872
return refuse(FLOOR_COMMAND_TYPES.rename, ['tên tầng không đổi nên không có gì để lưu.']);
```

Rồi thêm hai câu đó vào `floorManager.notices` của `vi.json` cùng lượt với P1-3.

### P1-2 · Vé hoàn tác bấm vào **không nói gì** khi bước đã bị lùi và nó là bước duy nhất

**Đường:dòng** — `src/screens/qc/FloorManager/useFloorManager.ts:911-915`.

Đây là món 1 tự khai, nhưng lời tự khai nói *"bấm ra câu 'không còn là thay đổi gần nhất'"* — điều
đó **chỉ đúng khi trong lịch sử còn bước khác**. Khi bước vừa lùi là bước duy nhất:

```ts
const step = history.undoSteps().at(-1);

if (step === undefined) {
  return false;          // ← im lặng: không toast, không announce
}

if (expectedStepId !== undefined && step.id !== expectedStepId) {
  say(FLOOR_MANAGER_TEXT.undoRefusedTitle, FLOOR_MANAGER_TEXT.undoNotLatest);
  return false;
}
```

Test `#11 hỏng thì lùi cục bộ…` (`useFloorManager.test.ts:1140-1161`) tự khẳng định
`historyStepCount()` về **0** sau lượt lùi — tức chính kịch bản này. Toast vé vẫn còn trên màn
(nó đã phát ở `:822`, trước request), người dùng bấm "Hoàn tác" và **không có gì xảy ra, không ai
nói gì**. Đó là nút chết, trái tinh thần A11 (nói ra trạng thái) và A12 (bàn phím hạng nhất: Mod+Z
đi cùng đường này).

**Cách sửa gọn nhất — bốn dòng, dùng lại câu đã có khoá `vi.json`:**

```ts
if (step === undefined) {
  if (expectedStepId !== undefined) {
    say(FLOOR_MANAGER_TEXT.undoRefusedTitle, FLOOR_MANAGER_TEXT.undoNotLatest);
  }

  return false;
}
```

`expectedStepId !== undefined` giữ cho Mod+Z trên lịch sử rỗng vẫn im lặng như cũ — chỉ vé mới nói.

Kèm một test trong `describe('hoàn tác gọi máy chủ')`: #11 hỏng → bấm vé → `descriptionsOf(…)`
chứa `FLOOR_MANAGER_TEXT.undoNotLatest`.

### P1-3 · Ba khoá `vi.json` khối [5] và [10] đòi, chưa có

**Đường:dòng** — `src/i18n/vi.json`, khối `floorManager.notices` (`:1902-1912`); chuỗi nguồn ở
`src/screens/qc/FloorManager/useFloorManager.ts:178-180`.

Không có hậu quả lúc chạy (`vi.json` là từ điển của `expectVietnamese`, không phải bảng dịch, và
không test nào ghim danh sách khoá — ghi chú hợp đồng §8.1 đã kiểm). Nhưng khối [10] liệt "khoá
`vi.json`" là deliverable, nên đây là hàng chưa giao, không phải ý kiến thẩm mỹ.

**Cách sửa gọn nhất** — thêm ba khoá vào `floorManager.notices`, giữ thứ tự chữ cái sẵn có trong
khối đó:

```json
"addFailedTitle": "chưa thêm được tầng",
"renameFailedTitle": "chưa đổi được tên tầng",
"undoFailedTitle": "chưa hoàn tác được thay đổi tầng",
```

(`addFailedTitle` xếp trước `floorGone`; hai khoá kia xếp sau `nameTooLong`, trước `undoExpired`.)
Nếu làm P1-1 thì thêm hai câu mới của nó cùng lượt.

### P2-1 · `humanText.ts`: regex cấm nhúng **chính** ký tự đảo chiều vào mã nguồn

**Đường:dòng** — `src/domain/text/humanText.ts:19`.

Bốn ký tự cuối trong lớp ký tự là U+202A, U+202E, U+2066, U+2069 viết **nguyên bản**, không escape.
Về logic thì đúng (tôi đã dò từng điểm mã; 11 ca test xanh, độ phủ 100/100/100/100), nhưng đó đúng
là lớp ký tự "trojan source": trình soạn thảo và `git diff` hiển thị dòng này sai thứ tự so với byte
thật, và người sửa sau không nhìn thấy mình đang sửa gì. Trớ trêu: file tồn tại để **chặn** đúng
những ký tự đó.

**Cách sửa gọn nhất** — đổi sang escape, không đổi hành vi một bit nào:

```ts
const FORBIDDEN = /[\u0000-\u001F\u007F-\u009F‪-‮⁦-⁩]/;
```

`humanText.test.ts:27` cũng nhúng nguyên bản ba ký tự trong bảng `it.each` — đổi luôn sang
`'‮'`, `'⁦'`, `'⁩'` cho cùng lý do.

### P2-2 · `floorUploadGateway.ts` chú thích đầu file nay nói ngược sự thật

**Đường:dòng** — `src/screens/upload/FloorUploadScreen/floorUploadGateway.ts:9-15`.

Món 5 tự khai, prompt 4.4.3 đòi sửa, chưa làm. **Cách sửa gọn nhất** — thay cả mục bằng:

```
 * ## Vì sao đọc tầng qua `projects.read`
 *
 * `floors.list({ projectId })` nay nhận mã dự án, nhưng màn này cần cả thông tin
 * dự án trong cùng một lượt đọc, nên vẫn lấy tầng từ `projects.read(…).data.floors`.
```

(Nếu lý do thật khác thì viết lý do thật — thứ không được để lại là câu "**không nhận mã dự án**".)

### P2-3 · `randomSuffix` có thể quay vô hạn với một `crypto` hỏng

**Đường:dòng** — `src/domain/spatial/ids.ts:77-85`.

`while (suffix.length < length)` không có trần. Với `crypto` thật, xác suất một lô 20 byte toàn
≥ 252 là (4/256)^20 ≈ 10⁻²⁴ — không xảy ra. Nhưng một polyfill hỏng hay một stub test trả toàn
`255` sẽ **treo luồng giao diện**, không ném, không log. Đây là hàm chạy mỗi lần dựng một thực thể.

**Cách sửa gọn nhất** — một biến đếm, rơi về đường lùi đã có:

```ts
for (let attempt = 0; attempt < MAX_DRAWS && suffix.length < length; attempt += 1) { … }
// hết vòng mà vẫn thiếu → rơi xuống nhánh Math.random bên dưới
```

Không chặn gộp; ghi để đợt sau nhặt.

### P2-4 · `floorWriteBodyOf` luôn gửi `drawings: []`, và hoàn tác nay cũng gửi nó qua #34

**Đường:dòng** — `src/screens/qc/FloorManager/floorManagerGateway.ts:1205-1216`, dùng ở
`useFloorManager.ts:729` (`patchRequest`) và do đó ở `inverseRequestsOf:868`.

`floorWriteBodyOf` đặt cứng `drawings: []`; `toFloorWirePayload` (`contracts.ts:185`) trải nó vì nó
`!== undefined`. Nếu máy chủ coi khoá của #34 là bản vá thì mỗi lượt hoàn tác đổi tên / cao độ sẽ
**xoá sạch danh sách bản vẽ** của tầng đó.

**Đây là hành vi có sẵn trên `master`** (`persistFloorFields` ở lượt thuận đã gửi đúng thân này từ
trước), F-03 chỉ làm nó chạm thêm đường hoàn tác. **Không** chặn F-03 và **không** nên sửa trong
đợt này (prompt 4.1 cấm sửa `toFloorWirePayload`). Cần một vé riêng và một câu hỏi cho BE: #34 có
coi `drawings: []` là "xoá hết" không? Nếu có thì đó là P0 của đợt sau.

### P2-5 · `pageIndexOf` không chặn trang ngoài khoảng 0…19

**Đường:dòng** — `src/screens/upload/FloorUploadScreen/useFloorUploadScreen.ts:224-232`.

`parseNumber(selectedPage) - 1` không kẹp biên. Trang hôm nay do bộ chọn của view sinh nên luôn
trong khoảng, nhưng `selectedPage` là `string` tự do trong `Attachment`; một `"0"` lọt vào sẽ gửi
`pageIndex: -1` và ăn 422 `field:"pageIndex"`, người dùng thấy câu lỗi chung chung. Một dòng
`page >= 1 && page <= MAX_PDF_PAGE_COUNT` là đủ. Không chặn gộp.

---

## 6. Việc gộp **không** làm sai điều gì sau đây (đã kiểm, ghi để khỏi kiểm lại)

- Lấy mẫu loại bỏ của `ids.ts` **đúng về phân phối** — 252 = 7 × 36; tôi tự tính lại chứ không tin
  chú thích.
- `normalizeHumanText` đúng thứ tự prompt đòi (`trim` → NFC → đếm **điểm mã** → chặn), đếm
  `[...value].length` nên ký tự ngoài BMP tính 1, và có test cho cả 120 lẫn 121.
- `pageIndex: 0` **không** bị nuốt: `uploadTask.ts:429` và `floorUploadGateway.ts:204,214` đều dùng
  `=== undefined` chứ không dùng falsy, và `uploadTask.test.ts` có riêng ca *"keeps page 0 — zero is
  a page, not an absence"*.
- Không có deadlock `runExclusive`: `applyUndo` không bao giờ được gọi từ **trong** một task của
  `executeStep` (`onApplied` chỉ phát vé, không bấm nó).
- `onUndo` giữ nguyên `() => void`, nên `floorManagerTypes.ts:392` không đổi và không view `.tsx`
  nào phải sửa theo — đúng như ghi chú hợp đồng §8.2 dự đoán.
- `PICKER_UPLOAD_EXTENSIONS` nhập từ `@/lib/upload/validate`, **không** qua `src/lib/upload/index.ts`
  (danh sách xuất bị ghim ở `index.test.ts:10`), và `.dwg` kéo thả vẫn đi nhánh `cad`.
- Thứ tự khoá trong `vi.json`: hai khối `notices` mới xếp **đúng chữ cái bên trong**; việc chúng nằm
  cuối `floorManager` / `floorUpload` là theo đúng nếp sẵn có của file (các khối anh em cũng không
  xếp chữ cái với nhau) — không phải vi phạm.

## 7. Điều kiện gộp

Vá **P1-1, P1-2, P1-3** (ước lượng ~10 dòng mã + 1–2 test + 5 khoá JSON), chạy lại `pnpm verify`
một lượt, rồi gộp. Năm món P2 ghi vào sổ nợ của W09, không chặn.

---

# Lượt 2 — soát vòng sửa · `217f0fc..728e183`

**Ngày:** 2026-09-25 · **Phạm vi:** CHỈ diff của vòng sửa (6 file, +45 −11). Lượt 1 đã soát toàn
nhánh và không con số nào lệch, nên lượt này không soát lại.

## PHÁN QUYẾT CUỐI: APPROVE

Ba món P1 **đóng đúng cả ba**. Hai món P2 cũng được vá kèm (P2-1, P2-2) dù chỉ P2-1 nằm trong
yêu cầu. Không tìm thấy hồi quy nào.

| món | trạng thái | ghi chú |
|---|---|---|
| P1-1 A6 + in mã tầng thô | **ĐÓNG** | sửa cả 5 chỗ, nhiều hơn 2 chỗ bắt buộc |
| P1-2 vé hoàn tác im lặng | **ĐÓNG** | tôi tự chứng minh test mới bắt đúng kịch bản |
| P1-3 ba khoá `vi.json` | **ĐÓNG** | thêm 5 khoá, JSON hợp lệ, đúng chữ cái |
| P2-1 regex trojan source | **ĐÓNG** | tập điểm mã y hệt, tôi dò từng điểm |
| P2-2 chú thích `floorUploadGateway` | **ĐÓNG (thêm)** | không nằm trong yêu cầu vòng này |
| P2-3 / P2-4 / P2-5 | còn mở | đúng thoả thuận, ghi sổ nợ W09 |

---

## 1. P1-1 — A6 + không in mã kỹ thuật · **ĐÓNG**

`floorManagerGateway.ts:700, 777, 858, 872, 914`.

Bốn câu `Không tìm thấy tầng ${levelId} trong bản vẽ.` thành `'không tìm thấy tầng này trong bản
vẽ.'` — viết thường, **không còn nội suy mã thực thể**. Câu trùng tên (`:872`) thành `'tên tầng
không đổi nên không có gì để lưu.'`.

Worker sửa **cả năm chỗ**, trong khi chỉ hai chỗ (`:858`, `:872`, đường `createRenameFloorCommand`)
thật sự tới người dùng qua `say()`. Ba chỗ kia (`duplicate:700`, `remove:777`, `changeHeight:914`)
hôm nay bị `executeStep` nuốt vì `build` trả `null`. Sửa thừa ở đây là đúng: nếu mai có ai nối
chúng vào `say()` thì không tái sinh lỗi.

**Kiểm đường `say()` cho kín** — sáu chỗ gọi `say()` trong hook sau vòng sửa
(`useFloorManager.ts:674, 909, 916, 933, 1162, 1245`). Năm chỗ dùng hằng của `FLOOR_MANAGER_TEXT`
(đều đã đúng A6 từ lượt 1). Chỗ thứ sáu, `:1162`, là chỗ duy nhất chuyển tiếp
`result.error.reasons` — và **cả ba nhánh** `refuse` của `createRenameFloorCommand` nay đều viết
thường, không mã: `'không tìm thấy tầng này…'`, `RENAME_REFUSAL_BY_REASON[...]` (ba câu đã đúng từ
lượt 1), `'tên tầng không đổi…'`. Không còn lối rò.

**Nợ đứng ngoài F-03, ghi để khỏi nhầm là hồi quy:** `src/lib/commands/business/roomFloorCommands.ts:566,
627, 712`, `openingCommands.ts:223, 660`, `wallCommands.ts:235` **vẫn** dựng
`Không tìm thấy tầng ${levelId}…` viết hoa kèm mã thô. Chúng nằm trong `src/lib/commands/**` —
khối [12] cấm F-03 chạm — và **không chỗ nào chảy vào đường `say()` mới mở** của FloorManager.
`furnitureLibraryPanelGateway.ts:318` tự ghi rằng câu loại này tới người dùng qua `blockReasons` ở
màn khác. Cần một vé cho chủ tầng đó; **không** chặn F-03.

## 2. P1-2 — vé hoàn tác im lặng · **ĐÓNG**, và tôi tự chứng minh test bắt thật

`useFloorManager.ts:905-911`. Guard đúng y đề xuất lượt 1:

```ts
if (step === undefined) {
  if (expectedStepId !== undefined) {
    say(FLOOR_MANAGER_TEXT.undoRefusedTitle, FLOOR_MANAGER_TEXT.undoNotLatest);
  }

  return false;
}
```

**Mod+Z có thật sự còn im lặng không? — Có.** `onUndo` (`:984`) gọi `void applyUndo()` **không đối
số**, nên `expectedStepId === undefined` và nhánh `say` bị bỏ qua. Vé thì luôn có đối số:
`publishUndoTicket(type, description, stepId)` dựng `undo: () => { void applyUndo(stepId); }`, và
`stepId` lấy từ `history.undoSteps().at(-1)?.id` **sau** khi lệnh đã áp cục bộ, nên nó luôn xác
định. Hai đường tách nhau đúng chỗ. Giá trị trả về vẫn `false` như cũ, không nơi gọi nào đổi nghĩa.

**Test mới có bắt đúng kịch bản, hay chỉ bắt một biến thể dễ hơn?** Tôi không đoán — tôi chép
nguyên `useFloorManager.test.ts` của `728e183` vào worktree soát của tôi (còn đứng ở `217f0fc`,
tức hook **chưa vá**) rồi chạy:

```
× hoàn tác gọi máy chủ > #11 hỏng rồi bấm vé (lịch sử đã rỗng) thì vé nói ra, không im lặng
AssertionError: expected [ '', …(1) ] to include 'thay đổi này không còn là thay đổi gầ…'
Tests  1 failed | 36 passed (37)     EXIT=1
```

Hai điều đọc ra từ đó:

1. **Test bắt đúng cái nó nói.** Nó đỏ trên mã chưa vá, và đỏ vì đúng lý do — mảng mô tả chỉ có
   `''` (mô tả rỗng của chính toast vé, `publishUndoTicket` publish với `description: ''`) chứ
   không có câu `undoNotLatest`. Đó chính xác là "nút chết" lượt 1 mô tả. Không phải biến thể dễ.
2. **36 test anh em vẫn xanh trên mã cũ**, nên file test không mang theo thay đổi nào khác; đúng
   một hành vi được thêm.

Chạy lại trên `728e183`: `useFloorManager.test.ts` **37/37 xanh**.

Test này cũng đi qua `ticket.undo()` thật (`notifications.list()` → `entry.undoTicket`), không gọi
tắt `applyUndo`, nên nó bao luôn cả chặng `createUndoTicket.getStatus() === 'active'`.

## 3. P1-3 — khoá `vi.json` · **ĐÓNG**

`vi.json` khối `floorManager.notices`. Thêm **năm** khoá, không phải ba:

- ba tiêu đề: `addRefusedTitle`, `renameRefusedTitle`, `undoRefusedTitle`;
- hai câu mới của P1-1: `floorNotFoundInDrawing`, `nameUnchanged`.

Kiểm bằng `json.load`: **tệp hợp lệ**, khối `notices` có **15 khoá và đúng thứ tự chữ cái**.

Tên khoá worker chọn (`addRefusedTitle`…) **tốt hơn** tên tôi đề xuất lượt 1 (`addFailedTitle`…):
nó khớp đúng khoá của `FLOOR_MANAGER_TEXT`, nên tra ngược từ mã sang từ điển là một bước. Không có
gì để bắt bẻ.

Hai câu mới đúng A6: viết thường, kiểu câu, không mã kỹ thuật, tiếng Việt có dấu đủ.

## 4. P2-1 — regex `humanText.ts` · **ĐÓNG, tập điểm mã y hệt**

Tôi không đọc chú thích; tôi đổ điểm mã của **dòng cũ** ra:

```
'[', '\u0000-\u001F', '\u007F-\u009F', 0x202a, '-', 0x202e, 0x2066, '-', 0x2069, ']'
```

tức lớp cũ = `U+0000–U+001F` ∪ `U+007F–U+009F` ∪ `U+202A–U+202E` ∪ `U+2066–U+2069`.

Dòng mới: `/[\u0000-\u001F\u007F-\u009F‪-‮⁦-⁩]/`.

**Trùng khít, không thừa không thiếu một điểm mã nào.** Thuần đổi cách viết, không đổi hành vi;
`humanText.test.ts` 11/11 xanh.

(Ghi nhỏ, không phải finding: `humanText.test.ts:27` vẫn nhúng nguyên bản ba ký tự bidi trong bảng
`it.each`. Chúng là **dữ liệu đầu vào** của test chứ không phải định nghĩa luật, nên rủi ro đọc
nhầm thấp hơn hẳn; để lại được.)

## 5. P2-2 — chú thích `floorUploadGateway.ts` · **ĐÓNG (thêm, ngoài yêu cầu)**

Mục `:9-15` viết lại, nay nói đúng: `floors.list({ projectId })` đã lồng dưới dự án, nhưng màn vẫn
đọc tầng qua `projects.read` vì một lượt đọc lấy được cả dự án lẫn tầng. Câu sai
"**không nhận mã dự án**" đã biến mất.

## 6. Hồi quy — soát từng thứ lượt 1 đã xác nhận đạt

| lượt 1 xác nhận | vòng sửa có đụng? | phán quyết |
|---|---|---|
| bảng mã → câu (`FLOOR_ERROR_SENTENCE_BY_CODE`) | không, diff không chạm | **giữ** |
| đường hoàn tác (`inverseRequestsOf`, `sendInOrder`, lùi ở `index === 0`) | chỉ thêm 4 dòng **bên trong** nhánh `step === undefined` | **giữ** — nhánh đó chỉ chạy khi không có gì để hoàn tác, giá trị trả về vẫn `false` |
| `pageIndex` (hook, gateway, `uploadTask`) | `floorUploadGateway.ts` chỉ đổi khối chú thích đầu file | **giữ** |
| A6 ở các câu khác | chỉ hạ chữ hoa, không thêm chuỗi người đọc nào ngoài 2 câu đã kể | **giữ** |
| thân #10/#34 không `projectId`, id client sinh | không chạm `client.ts` / `endpoints.ts` | **giữ** |
| lấy mẫu loại bỏ `ids.ts` | không chạm | **giữ** |
| A10, mục D, bảy luật ESLint | xem kiểm dưới | **giữ** |

**Hai lượt chạy của riêng tôi** (không phải chép số của worker):

- `pnpm exec vitest run src/screens/qc/FloorManager src/domain/text` trên `728e183` →
  **3 file, 67/67 xanh**, `EXIT=0`. Trong đó `useFloorManager.test.ts` 37 test (lượt 1 là 36, +1
  đúng như worker khai), `FloorManager.test.tsx` 19 (A11 bảy trạng thái vẫn xanh),
  `humanText.test.ts` 11.
- `pnpm exec eslint --max-warnings 0` trên đúng năm file `.ts` đã đổi → **`LINT_OK`, `EXIT=0`**.
  Tôi chạy thêm bước này vì việc bỏ nội suy làm mấy mảng `refuse([...])` ngắn lại, và một lượt
  prettier đòi gộp dòng sẽ đủ làm cổng lint đỏ. Không đỏ.

**Không tìm thấy hồi quy nào.**

### Điều tôi **không** kiểm lượt này, và vì sao

Theo chỉ dẫn, tôi **không** chạy lại `pnpm verify` bảy bước. Nên các con số sau là **của worker**,
không phải của tôi, và tôi ghi rõ như vậy (E.10): 341 file · 7184 test qua · 0 hỏng ·
entry 163,5/175 · chunk lớn nhất 163,5/170 · routeChunk 264,2/280 · `EXIT=0`.

Chúng khớp khuôn lượt 1 (7183 + 1 test mới = 7184; gói nhích 163,4 → 163,5 KiB, hợp với 5 khoá
JSON và vài chuỗi ngắn hơn). Hai lượt chạy riêng ở trên bịt hai khoảng trống dễ vỡ nhất của vòng
sửa này (test và lint). Bước `build` / `kích thước gói` / `import vòng` / `độ dài file` tôi
**chưa chạy lượt 2** — chúng dựa trên `EXIT=0` của worker.

**Biên gói vẫn hẹp:** chunk JS lớn nhất 163,5 / trần 170, dư **6,5 KiB**. F-07 / F-10 / F-11 đọc
số này trước khi viết dòng đầu tiên.

## 7. Kết luận

Ba món P1 đóng, hai món P2 đóng thêm, không hồi quy. **APPROVE** — gộp được.

Còn mở, ghi sổ nợ W09 (đều đã thống nhất lượt 1, không món nào chặn):

- **P2-3** `ids.ts:77-85` — vòng lấy mẫu không có trần.
- **P2-4** `floorWriteBodyOf` gửi `drawings: []` qua #34 — **cần hỏi BE** trước khi xử.
- **P2-5** `pageIndexOf` không kẹp biên 0…19.
- **Nợ A8** — thêm / đổi tên / đổi cao độ / đổi chiều cao vẫn chỉ hoàn tác bằng Mod+Z.
- **Nợ #34 nửa vời** — máy chủ lệch một phần sau khi #13 hoặc #34 trước đã thành công; người dùng
  chưa được nói rằng màn và máy chủ nay khác nhau.
- **Nợ ngoài F-03** — câu `Không tìm thấy tầng ${id}…` viết hoa kèm mã thô còn sống trong
  `src/lib/commands/business/**` (sáu chỗ), chảy ra người dùng ở màn khác.
