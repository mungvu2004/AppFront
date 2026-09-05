# U8 — Báo cáo nghiệm thu tích hợp

Nhánh `mungvu2004/fix-u8-integrate`, commit `81543cf`, nền `master` = `c4e8bb8`.
Mọi con số dưới đây là **đầu ra thật của lệnh đã chạy**, không phải chép lại từ báo cáo của
worker khác. Mục nào không chứng minh được bằng máy thì nói thẳng là không, kèm lý do (R-58).

---

## 1. Bảng số đối chiếu — `master` (nền) vs nhánh này

| Cổng | master `c4e8bb8` | nhánh `81543cf` | Chênh |
|---|---|---|---|
| `pnpm typecheck` | 0 lỗi (exit 0) | 0 lỗi (exit 0) | — |
| `pnpm lint` | 0 lỗi / 0 cảnh báo (exit 0) | 0 lỗi / 0 cảnh báo (exit 0) | — |
| `pnpm test` | 228 tệp · 4.691 bài · 0 failed · 0 skipped | 243 tệp · 4.836 bài · 0 failed · 0 skipped | +15 tệp · +145 bài |
| `pnpm coverage` | exit 0 | exit 0 | — |
| `pnpm cycles` | 0 vòng | 0 vòng | — |
| `pnpm length` | — | 228 tệp · 36 vượt 250 · **0 vượt 400** · đạt | — |

`pnpm verify` **không** được dùng để kết luận đạt/không đạt, đúng như đề bài yêu cầu. Sáu bước
trên chạy rời từng cái; bước 6 (kích thước gói) đo riêng ở mục 2.

## 2. Kích thước gói — chi phí thật của 12 thay đổi

Cùng một lệnh (`pnpm build && pnpm size`), chạy trên hai cây làm việc song song.

| Cổng kích thước | master `c4e8bb8` | nhánh này | Chênh | Trần |
|---|---|---|---|---|
| màn hình đầu tiên (chunk vào + nhập tĩnh) | 128,7 KiB | **130,4 KiB** | **+1,7 KiB** | 175 KiB |
| chunk JS lớn nhất | 137,3 KiB | 137,3 KiB | 0 | 170 KiB |
| chi phí thêm cho một màn (`viewer/Viewer3D`) | 265,1 KiB | **276,1 KiB** | **+11,0 KiB** | 280 KiB |
| tổng CSS | 9,8 KiB | 9,8 KiB | 0 | 12 KiB |
| tổng JS mọi chunk (cảnh báo, không phải cổng) | 764,9 KiB | **773,8 KiB** | **+8,9 KiB** | 800 KiB |
| số tệp trong `dist` | 127 | 128 | +1 | — |

**Cả bốn cổng vẫn đạt**, nhưng một con số đáng để người duyệt biết trước khi gộp: ngân sách
`viewer/Viewer3D` từ chỗ **còn dư 14,9 KiB** xuống **còn dư 3,9 KiB**. Phần lớn +11,0 KiB đó là
lớp xem trước 3D của U7 (`lib/three/preview`) đi cùng màn xem mô hình. Màn tiếp theo thêm bất cứ
thứ gì nặng vào `Viewer3D` sẽ chạm trần.

Một hiệu ứng ngược chiều đáng ghi: chunk `useReducedMotion` **giảm** 59,1 → 39,6 KiB, vì
`GlobalShortcutHelp` của U6 được tải muộn nên `framer-motion` bị chia lại giữa các chunk.

---

## 3. N1–N9 — kết quả nghiệm thu, kèm số thật

Mọi dòng dưới đây là `console.log` thật của `PropertyInspector.test.tsx` khi chạy.

### N1 — đổi độ dày `W-WALL0000140` từ 220 sang 330

- **N1.1 — 3D đổi NGAY TRONG LÚC KÉO: ĐẠT.** 10 bước kéo trên `D-DOOR0000000` (900 → 500 → 400 mm):
  số thao tác nháp đọc được ở mỗi bước = 1, số lượt ghi vào mô hình trong lúc kéo = 0, số bước
  hoàn tác mở ra trong lúc kéo = 0; sau khi giá trị đứng yên hết 400 ms: mô hình = 400 mm, thao
  tác nháp còn lại = 0, bước hoàn tác mở thêm = 1. Đo trên chính `selectDraftPreviewGraph` mà
  `useViewer3D` đọc.
- **N1.2 — lượt ghi vào mô hình:** 220 mm → 330 mm; nhãn lượt ghi = "Đổi độ dày tường
  W-WALL0000140 từ 220 mm sang 330 mm." Mọi nơi đã được dọn (nháp còn lại = 0).
- **N1.3 — MỘT cú Ctrl+Z THẬT** (`fireEvent.keyDown(document.body, {key:'z', ctrlKey:true})` đi
  qua đúng binding của `UndoShortcuts`): 330 → **220 mm**; ngăn xếp hoàn tác 2 → 1.
- **N1.4 — hai lượt ghi cách nhau 200 ms trong cửa sổ gộp 400 ms ⇒ 1 bước hoàn tác;**
  220 → 110 → (một cú Ctrl+Z) → **220 mm**.

### N2 — số TRƯỜNG THUỘC TÍNH khi chọn một bức tường

- 9 **dòng** hiện ra trước khối gập: Độ dày · Chiều dài · Chiều cao · Loại tường · Tường nội thất
  · Số ô mở · WALL-DANGLING-END · WALL-DANGLING-END · Xem quy tắc.
- Trong đó **5/5 là trường thuộc tính** của `DEFAULT_WALL_FIELD_IDS`. 4 dòng còn lại là 1 dòng
  quan hệ ("Số ô mở"), 2 dòng vi phạm và 1 lối sang màn luật — đúng cách đếm người dùng đã chốt.
- Ba loại còn lại, đếm theo cùng luật: ô mở 4 (+1 liên kết), phòng 3 (+2 dòng đếm quan hệ),
  nội thất 4 (+1 liên kết). **Không loại nào vượt 5.**

### N3 — đổi qua lại tường ↔ phòng 10 lần

- Số dòng mỗi lượt: 9, 9, 9, 9, 9, 9, 9, 9, 9, 9 — tường = 9, phòng = 9, **số lần số dòng đổi
  giữa hai lượt liên tiếp = 0**.
- Bề rộng nhãn quan sát được 40% (hằng số hợp đồng 40%); chiều cao dòng 36px (hợp đồng 36px).
- **CHƯA CHỨNG MINH ĐƯỢC bằng phép đo pixel:** `offsetTop` của chân panel qua 10 lượt là
  0, 0, 0, …, 0 — jsdom không có bộ dựng bố cục nên mọi `getBoundingClientRect()` trả 0. Con số
  ấy KHÔNG phải bằng chứng. Bằng chứng thay thế, đo bằng cấu trúc: chân panel nằm trong khối
  `shrink-0` ở **10/10** lượt, và số vùng `flex-1 + overflow-y-auto` (vùng DUY NHẤT co giãn và
  cuộn) = 1 mỗi lượt.

### N4 — chọn 3 tường lệch độ dày

`W-WALL0000140, W-WALL0000150, W-WALL0000160` dày 110 / 220 / 330 mm ⇒ ô "Độ dày" render ra
**"—"**, không phải 220.

### N5 — bốn bộ khẳng định dùng chung

`expectSevenStates` = **7/7** (rỗng · đang tải · một phần · lỗi · thành công · không có quyền ·
thu gọn) · `expectAccessible` = 7/7 trạng thái · `expectVietnamese` = 7/7 trạng thái ·
`expectNoRawColor` = **0** mã màu thô trong cả thư mục màn.

### N6 — chiều cao tường (MỚI)

- **Đổi được:** `W-WALL0000000` (mang `D-DOOR0000000`, đỉnh cửa 2.200 mm): 3.600 → **3.000 mm**.
- **Bị TỪ CHỐI:** thử 2.000 mm ⇒ mô hình vẫn 3.000 mm, và lý do tiếng Việt hiện **ngay tại dòng**:
  > "Hạ tường W-WALL0000000 xuống 2.000 mm sẽ cắt qua cửa đi D-DOOR0000000 có đỉnh ở 2.200 mm;
  > còn thiếu 200 mm."

### N7 — kích thước bao nội thất (MỚI)

- **Đổi được:** `F-FURN0000000` bề rộng bao 800 → **8.000 mm**, tâm giữ nguyên.
- **FURNITURE-CLASH cảnh báo:** nhóm "Kiểm tra" có dòng `FURNITURE-CLASH`; câu cảnh báo
  TRƯỚC = "Đồ đạc F-FURN0000000 chồng lên tường W-WALL0000000, chỗ lấn sâu nhất 110 mm.";
  SAU = "Đồ đạc F-FURN0000000 chồng lên tường W-WALL0000000, W-WALL0000040 **và đồ đạc
  F-FURN0000040**, chỗ lấn sâu nhất 400 mm."
- Nói thẳng: bộ mẫu chuẩn vốn đã có đồ đạc chạm mép tường nên luật này đã cảnh báo TỪ TRƯỚC lượt
  sửa. Thứ lượt sửa thêm vào — và là thứ bài kiểm khẳng định — là tên `F-FURN0000040` trong chính
  câu cảnh báo đó.

### N8 — bốn phím, gõ phím THẬT (MỚI)

Bốn cú `fireEvent.keyDown(document.body, …)` đi qua `appShortcutRegistry` dùng chung:

| Phím | Kết quả đo được |
|---|---|
| `?` | bảng phím tắt mở = **true** |
| `Escape` | số binding phạm vi `dialog` 2 → **0**, tức bảng đóng = true |
| `Ctrl+F` | số lần ô tìm đối tượng được mở = **1** |
| `Ctrl+S` | số lượt gửi lớp không gian mới = **1** |

Và **A7 vẫn giữ**: số nút Lưu trong panel = **0** (nút "Lưu làm khuôn mẫu" ở đầu panel là việc
khác, được tra bằng tên chính xác nên không lọt vào phép đếm này).

Ghi chú trung thực về phép đo Escape: nó đo **sổ đăng ký phím tắt**, không đo nút DOM. Nút DOM
biến mất muộn hơn, sau hoạt cảnh thoát của `AnimatePresence`, và hoạt cảnh ấy chạy trên
`requestAnimationFrame` thật — vòng lặp khung hình của framer-motion không sống lại sau khi một
bài trước đó trong cùng tệp dùng `vi.useFakeTimers()`. Bám vào nút DOM là bám vào thứ tự chạy của
cả tệp; bám vào sổ đăng ký là bám vào chính cơ chế A12.

### N9 — tự lưu gọi endpoint thật (MỚI)

- Sau một lượt ghi và hết cửa sổ im lặng của A7: **1 lượt gọi `spatial.writeLayer`**; thân yêu
  cầu mang **12 tường · 4 ô mở · 4 phòng · 6 nội thất** của tầng `L-LEVEL000000`.
- Chỉ báo ở chân panel: **"Đã lưu lúc 03:12"** — không còn nín.
- Kèm theo (N9b): nút "khuôn" ⇒ **1 lượt gọi `propertyTemplates.create`**; loại đối tượng
  `"wall"`, tên `"Khuôn tường W-WALL0000140"`, 3 trường mang theo; panel nói ra
  "Đã lưu khuôn mẫu "Khuôn tường W-WALL0000140" cho dự án này."

---

## 4. Danh sách tự kiểm G7 — nguyên văn

```
SCREEN=src/screens/viewer/PropertyInspector

$ ls $SCREEN
index.ts · PropertyInspector.container.tsx · PropertyInspector.stories.tsx
PropertyInspector.test.tsx · PropertyInspector.tsx · PropertyInspectorFooter.tsx
propertyInspectorGateway.ts · PropertyInspectorGroups.tsx · PropertyInspectorHeader.tsx
PropertyInspectorRow.tsx · propertyInspectorScenarios.ts · propertyInspectorTypes.ts
usePropertyInspector.ts

$ rg "from '@/(api|store|domain|lib/http)" $SCREEN --glob '*.tsx' \
     --glob '!*.container.tsx' --glob '!*.test.tsx' --glob '!*.stories.tsx'
(RỖNG)                                                                    ✔ như yêu cầu

$ rg "<ScreenErrorBoundary" $SCREEN
PropertyInspector.container.tsx:    <ScreenErrorBoundary                   ✔ CÓ

$ rg "expectSevenStates" $SCREEN
7 khớp (propertyInspectorTypes.ts, PropertyInspector.test.tsx)             ✔ CÓ

$ rg "useState.*([Ll]oading|error)" $SCREEN
(RỖNG)                                                                    ✔ như yêu cầu

$ rg "['\"](/|https?://)" $SCREEN
(RỖNG)                                                                    ✔ như yêu cầu

$ rg "TODO|FIXME|stub" src/
KHÔNG RỖNG — xem ghi chú bên dưới                                         ✖ đọc kỹ

$ rg "\.(skip|only)\(" src/
(RỖNG)                                                                    ✔ như yêu cầu

$ rg "setTimeout\([^,]*, *[0-9]|duration: *[0-9]" $SCREEN
(RỖNG)                                                                    ✔ như yêu cầu

$ ls $SCREEN/*.container.tsx
src/screens/viewer/PropertyInspector/PropertyInspector.container.tsx      ✔ CÓ

$ pnpm cycles
Import vòng: không có.                                                    ✔ 0 vòng
```

**Ghi chú về `rg "TODO|FIXME|stub" src/` — mục DUY NHẤT không rỗng.** Kết quả gồm ~120 dòng, và
mọi dòng thuộc đúng một trong ba loại:

1. **Tên hàm/API có chứa chữ "stub"** — `vi.stubGlobal`, `vi.stubEnv`, `stubGateway`,
   `stubCanvasContext`, `stubMatchMedia`… Đây là API của vitest và tên hàm dựng trong bài kiểm,
   không phải mã bỏ dở.
2. **Văn xuôi tiếng Anh về "wall stub"** (mẩu tường cụt) trong `src/domain/walls/*` và
   `src/domain/rules/__tests__/*` — một thuật ngữ hình học, không phải mã bỏ dở.
3. **Hai mục có sẵn trên `master`, KHÔNG do nhánh này tạo ra và NẰM NGOÀI whitelist sửa đổi:**
   - `src/screens/project/CreateProjectModal/CreateProjectModal.container.tsx:71` —
     `// TODO(api): buildingType and notes have no wire field yet — dropped here, not sent.`
     (đã đối chiếu: có nguyên văn ở `master:c4e8bb8`, dòng 71).
   - `src/i18n/vi.json` — khoá `accountSettings.stub.*` ("Khối hồ sơ đang được dựng."…), cũng có
     sẵn trên `master`.

Nhánh này **không thêm một TODO/FIXME/stub nào**: `git diff master -U0 | grep '^+'` lọc bỏ các
tên API vitest trả về rỗng. Mục #3 là nợ có sẵn của repo, xin để người điều phối quyết định có
mở một nhiệm vụ riêng hay không — nó nằm ngoài phạm vi được sửa của U8.

---

## 5. Đã mở khoá được mấy dòng của panel

**Hai trên ba** — đúng như đề bài chỉ định.

| Dòng | Trước | Sau | Vì sao |
|---|---|---|---|
| `height` (chiều cao tường) | chỉ đọc | **MỞ KHOÁ** — ô nhập mm, gộp được khi kéo, một cú hoàn tác, hiện lý do tại dòng khi bị từ chối | `wall.changeHeight` đã có (U1) |
| `boundingSize` → `boundingWidth` + `boundingDepth` | chỉ đọc, một dòng "800 × 800" | **MỞ KHOÁ** — hai ô nhập mm độc lập | `furniture.resize` đã có (U1), và `ResizeFurnitureInput` nhận `widthMm`/`depthMm` rời nhau |
| `isInterior` | chỉ đọc | **GIỮ CHỈ ĐỌC** | Không phải lỗ hổng: nó suy từ `kind`; một toggle ghi được sẽ ghi đè `kind` và làm mất `loadBearing` không có đường lấy lại. Dòng `wallType` ngay trên là chỗ đổi loại tường một cách nói rõ mình đang làm gì |

Hộp bao tách làm hai dòng chứ không giữ một ô ghép: `ResizeFurnitureInput` nhận hai số đo độc lập
(vắng mặt thì chiều đó giữ nguyên), nên một ô "600 × 400" sẽ phải tự tách chuỗi rồi tự đoán người
dùng vừa đổi chiều nào — phép phân tích cú pháp mà `parseNumber` không làm và R-61 không cho hook
tự chế.

---

## 6. Mười hai lỗ hổng — trạng thái từng cái, đã tự kiểm chứng

| # | Lỗ hổng | Trạng thái | Bằng chứng (một dòng) |
|---|---|---|---|
| 1 | Không lệnh nào ghi `Wall.heightMm` | **ĐÃ VÁ** | `wallCommands.ts:604 createChangeWallHeightCommand`; panel mở khoá dòng; N6 in cả hai chiều |
| 2 | Không `createResizeFurnitureCommand` | **ĐÃ VÁ** | `openingCommands.ts:1004`; panel có hai ô nhập; N7: 800 → 8.000 mm |
| 3 | `openingsOfRoom` không export, đòi `RuleContext` | **ĐÃ VÁ** | `domain/spatial/roomOpenings.ts:146` + `:191 countOpeningsByKind`; cổng gọi thẳng, bản chép hẹp đã xoá |
| 4 | Không có khái niệm khuôn mẫu thuộc tính | **ĐÃ VÁ** | `endpoints.ts:67 propertyTemplates`; cổng gọi `apiClient.propertyTemplates.create` (`:806`); N9b: 1 lượt gọi thật |
| 5 | Không endpoint nhận lớp không gian, tự lưu NÍN | **ĐÃ VÁ** | `client.ts:358 writeLayer`; cổng gọi `apiClient.spatial.writeLayer` (`:788`); N9: 1 lượt gọi, chỉ báo "Đã lưu lúc 03:12" |
| 6 | `defaultRuleRegistry` chỉ 8/25 luật | **ĐÃ VÁ** | `domain/rules/defaults.ts:47 ALL_RULES`; N2 hiện `WALL-DANGLING-END` (luật GEOMETRY, không phải built-in) ngay trên panel; N7 hiện `FURNITURE-CLASH` |
| 7 | Không có flush tự lưu ⇒ Ctrl+S không có gì để gọi | **ĐÃ VÁ** | `hooks/useAutosave.ts:39 flushAutosaves`; `router.tsx:166 SAVE_SHORTCUT` + `:248 useShortcut`; N8: Ctrl+S ⇒ 1 lượt gửi |
| 8 | Không có màn tìm kiếm cho Ctrl+F | **ĐÃ VÁ** | `ObjectSearch.tsx:115 viewer.search.openCtrlF` (phạm vi `canvas`); N8: 1 lần mở |
| 9 | Không có bảng phím tắt cho `?` | **ĐÃ VÁ** | `router.tsx:249 global.shortcutHelp` + `components/shell/GlobalShortcutHelp.tsx`; N8: bảng mở = true |
| 10 | Escape ở tầng vỏ chưa nối | **ĐÃ VÁ** | `router.tsx:250 global.closeTopLayer` → `uiSlice.closeDialog()`; N8: binding `dialog` 2 → 0 |
| 11 | Không có `toFurnitureViewModel` | **ĐÃ VÁ** | `lib/viewmodel/toViewModel.ts:450` + `__tests__/toFurnitureViewModel.test.ts` |
| 12 | Không có kênh xem trước 3D | **ĐÃ VÁ** | `store/commit.ts:179 previewEdit` / `:201 discardPreview`; `selectors.ts:372 selectDraftPreviewGraph`; N1.1 ĐẠT với số thật |

**12/12 ĐÃ VÁ. Không mục nào ở trạng thái VÁ MỘT PHẦN hay CHƯA VÁ.**

---

## 7. Việc U8 tự làm (ngoài phần gộp)

1. **Ctrl+S** — `hooks/useAutosave.ts` giữ một `Set` engine `createAutosave` đang gắn và xuất
   `flushAutosaves()`; `routes/router.tsx` nối `global.save` vào đó. Vỏ **không** dựng bộ tự lưu
   thứ hai: hai engine cùng theo dõi `state.spatial` sẽ gửi hai lượt ghi cho mỗi thay đổi, đúng
   thứ lỗ hổng #7 vừa dọn. Và **không** sinh nút Lưu nào (A7).
2. **Cổng panel gửi thật** — `persistProperties(graph)` qua `SpatialApi.writeLayer`,
   `copyAsTemplate(entity)` qua `propertyTemplates.create`; `supports` hai khoá đó thành `true`.
   `NO_SAVE_TARGET_REASON` thay hai hằng "chưa có đường": nay chỉ còn tình huống chưa mở dự án/tầng,
   là việc của phiên làm việc chứ không phải khả năng còn thiếu.
3. **Một chỗ lệch seam thật, đã vá** — dòng vi phạm ở nhóm "Kiểm tra" mang thêm số thứ tự trong
   `id`. Với đủ 25 luật, `WALL-DANGLING-END` phát nhiều lần trên cùng một đối tượng (một câu cho
   mỗi đầu tường hở), nên `key` của React trùng và React **âm thầm bỏ bớt một dòng** — một vi phạm
   biến mất khỏi màn hình mà không ai báo. N2 nay in ra đủ hai dòng.
4. **i18n** — ba mảnh `*.i18n.fragment.json` còn sót (`S14-T4`, `S15-T4`, `floor-manager`) đã đối
   chiếu vào `src/i18n/vi.json`: **177/177 khoá đã có sẵn**, không khoá cũ nào bị xoá, JSON hợp lệ;
   ba mảnh đã xoá. Thêm hai nhãn mới của nội thất.
5. **Tài liệu** — `docs/contracts/property-inspector/{commands,model,strings}.md` cập nhật theo sự
   thật hiện tại: bảng 12 lỗ hổng ở đầu mỗi tệp, các mục `NOT FOUND` đã có lời giải được gạch đi
   kèm con trỏ tới mã, phần lập luận cũ giữ nguyên làm lịch sử.
