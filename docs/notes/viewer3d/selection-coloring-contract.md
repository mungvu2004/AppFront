# Hợp đồng T3 — chọn, tô màu và telemetry cho Viewer3D

Task khảo sát R-09/S-10/S-11/P-06/P-07/O-01. Không sửa mã nguồn, chỉ đọc và ghi lại
những gì THẬT SỰ tồn tại trong `src/lib/selection/**`, `src/lib/coloring/**`,
`src/lib/telemetry/**`. Không đoán — chỗ nào không thấy ghi `NOT FOUND`.

---

## 1. `src/lib/selection/selectionOps.ts`

Đại số chọn: một phép chọn là **tập id**, không phải tập thực thể. Mọi phép toán là
hàm thuần `(selection, …, context) -> selection`; phép không đổi gì trả lại đúng
mảng đầu vào (để tránh re-render vô ích).

| Tên | Dòng | Chữ ký | Mô tả |
|---|---|---|---|
| `SelectableKind` | `selectionOps.ts:42` | `type SelectableKind = Exclude<EntityKind, 'level'>` | Kind có thể pick trên canvas; loại trừ `level` vì level là container, không có footprint. |
| `LayerState` | `selectionOps.ts:45-48` | `interface LayerState { readonly visible: boolean; readonly locked: boolean }` | Một layer có đang vẽ và có cho pick hay không. |
| `DEFAULT_LAYER_STATE` | `selectionOps.ts:51` | `const DEFAULT_LAYER_STATE: LayerState = { locked: false, visible: true }` | Trạng thái ngầm định cho layer không được liệt kê: hiện và không khoá. |
| `LayerStates` | `selectionOps.ts:54` | `type LayerStates = Partial<Readonly<Record<SelectableKind, LayerState>>>` | Bảng trạng thái layer theo kind; thiếu khoá coi như `DEFAULT_LAYER_STATE`. |
| `SelectionContext` | `selectionOps.ts:57-63` | `interface SelectionContext { readonly spatial: NormalizedSpatial; readonly activeLevelId: LevelId; readonly layers: LayerStates }` | Mọi thứ một phép toán cần để biết cái gì được pick lúc này. |
| `Selection` | `selectionOps.ts:66` | `type Selection = readonly EntityId[]` | Id đã chọn, theo thứ tự chọn — đúng hình dạng store giữ. |
| `SelectionCombine` | `selectionOps.ts:69` | `type SelectionCombine = 'replace' \| 'add' \| 'subtract'` | Batch id mới gộp vào selection cũ theo cách nào. |
| `EMPTY_SELECTION` *(nội bộ, không export)* | `selectionOps.ts:71` | `const EMPTY_SELECTION: Selection = Object.freeze([])` | Hằng mảng rỗng đóng băng, dùng làm kết quả khi chọn về rỗng. |
| `readLayerState` | `selectionOps.ts:78-79` | `(layers: LayerStates, kind: SelectableKind) => LayerState` | Đọc trạng thái một layer, fallback về hiện + không khoá. |
| `selectableKindOf` | `selectionOps.ts:82-86` | `(id: EntityId) => SelectableKind \| null` | Kind pickable của một id; `null` nếu là level hoặc id sai dạng. |
| `isSelectable` | `selectionOps.ts:95-115` | `(id: EntityId, context: SelectionContext) => boolean` | Id này có được VÀO selection không — 4 điều kiện: đúng dạng + pickable kind, drawing có giữ nó, đúng tầng đang xem (qua host wall với opening), layer hiện + không khoá. |
| `selectableIds` | `selectionOps.ts:118-119` | `(context: SelectionContext) => EntityId[]` | Mọi id có thể pick lúc này, theo thứ tự tầng. |
| `keepIfUnchanged` *(nội bộ)* | `selectionOps.ts:132-135` | `(previous: Selection, next: Selection) => Selection` | Trả `previous` khi `next` giữ đúng id, đúng thứ tự — chặn re-render thừa. |
| `dedupe` *(nội bộ)* | `selectionOps.ts:138` | `(ids: readonly EntityId[]) => EntityId[]` | Bỏ trùng, giữ thứ tự xuất hiện đầu tiên. |
| `isSelected` | `selectionOps.ts:145` | `(selection: Selection, id: EntityId) => boolean` | Id đã có trong selection chưa. |
| `selectSingle` | `selectionOps.ts:155-159` | `(selection: Selection, id: EntityId, context: SelectionContext) => Selection` | Pick thường: selection thành đúng một id đó; pick trúng vật không hợp lệ → xoá sạch selection (không giữ lại cái cũ). |
| `toggleSelection` | `selectionOps.ts:167-177` | `(selection: Selection, id: EntityId, context: SelectionContext) => Selection` | Ctrl-pick: có thì bỏ, chưa có thì thêm. **Bỏ không xét `isSelectable`** — xem CẠM BẪY. |
| `selectAllOfKind` | `selectionOps.ts:186-194` | `(selection: Selection, kind: SelectableKind, context: SelectionContext) => Selection` | Chọn mọi vật hợp lệ của một kind trên tầng đang xem, theo thứ tự index theo kind (không phải thứ tự tầng). |
| `invertSelection` | `selectionOps.ts:203-210` | `(selection: Selection, context: SelectionContext) => Selection` | Đảo chọn: lấy mọi id hợp lệ của tầng, trừ đi những id đang được chọn. |
| `clearSelection` | `selectionOps.ts:213-214` | `(selection: Selection) => Selection` | Bỏ chọn hết. |
| `combineSelection` | `selectionOps.ts:224-245` | `(selection: Selection, ids: readonly EntityId[], mode: SelectionCombine, context: SelectionContext) => Selection` | Gộp một batch id mới (vd. kết quả marquee) vào selection cũ theo `mode`. `replace`/`add` lọc qua `isSelectable`; `subtract` **không lọc gì cả** — xem CẠM BẪY. |

---

## 2. `src/lib/selection/marquee.ts`

Quét khung chọn nhiều kiểu CAD: kéo trái→phải là "window" (chỉ bắt vật nằm TRỌN
trong khung), kéo phải→trái là "crossing" (bắt mọi vật khung CHẠM tới). Mỗi vật
được test theo **footprint thật** (không phải bounding box).

### Hàm công khai

| Tên | Dòng | Chữ ký | Mô tả |
|---|---|---|---|
| `MarqueeMode` | `marquee.ts:56` | `type MarqueeMode = 'window' \| 'crossing'` | Luật CAD nào đang áp dụng cho một lần kéo. |
| `Marquee` | `marquee.ts:59-62` | `interface Marquee { readonly start: Point; readonly end: Point }` | Một lần kéo, từ góc bắt đầu tới góc con trỏ hiện tại. |
| `marqueeMode` | `marquee.ts:97-98` | `(marquee: Marquee) => MarqueeMode` | Đọc luật từ hướng kéo: `end.x >= start.x` → `window`; kéo dọc thuần (không lệch ngang) cũng tính là `window` (luật chặt hơn được chọn mặc định). |
| `marqueeBox` | `marquee.ts:101-104` | `(marquee: Marquee) => BoundingBox` | Khung kéo dạng box đã sắp góc (`min`/`max`). |
| `marqueeHits` | `marquee.ts:407-440` | `(marquee: Marquee, context: SelectionContext) => EntityId[]` | Id bị bắt bởi một lần kéo, theo thứ tự tầng giữ chúng. Chỉ duyệt tầng đang xem; `isSelectable` lọc layer ẩn/khoá trước khi test hình học. |
| `applyMarquee` | `marquee.ts:448-453` | `(selection: Selection, marquee: Marquee, combine: SelectionCombine, context: SelectionContext) => Selection` | Kết quả sau khi thả kéo — gọi thẳng `combineSelection(selection, marqueeHits(...), combine, context)`. |

### Hàm nội bộ (không export, hỗ trợ tính footprint/giao cắt)

| Tên | Dòng | Việc |
|---|---|---|
| `rectangleAlong` | `marquee.ts:110-120` | Bốn góc hình chữ nhật dọc theo một đoạn, lệch ngang `acrossX/Y`. |
| `directionOf` | `marquee.ts:123-129` | Vector đơn vị dọc một `Segment`; `null` nếu đoạn dài 0. |
| `wallFootprint` | `marquee.ts:132-150` | Hình chữ nhật độ dày tường quét dọc tim tường. |
| `openingFootprint` | `marquee.ts:160-189` | Đoạn tường một ô mở chiếm; `null` nếu tường chủ thiếu. |
| `cornersOf` | `marquee.ts:191-196` | Bốn góc của một `BoundingBox`. |
| `furnitureFootprint` | `marquee.ts:199-222` | Hộp nội thất xoay quanh tâm theo `rotationDeg`. |
| `runFootprint` | `marquee.ts:224-227` | Footprint hở (không khép kín) cho một đoạn thẳng (trục, kích thước). |
| `footprintOf` | `marquee.ts:234-263` | Footprint của một entity theo kind; `null` cho level. |
| `isPointInBox` | `marquee.ts:269-273` | Điểm có nằm trong box không, có nới `TOUCH_TOLERANCE_MM`. |
| `doesSegmentMeetBox` | `marquee.ts:285-324` | Đoạn thẳng có giao với box không (Liang–Barsky clipping). |
| `edgesOf` | `marquee.ts:327-342` | Danh sách cạnh của một footprint; hình khép kín có thêm cạnh nối về điểm đầu. |
| `isPointInOutline` | `marquee.ts:345-368` | Ray casting: outline có bao điểm này không. |
| `isFootprintEnclosed` | `marquee.ts:371-372` | Luật window: mọi góc footprint nằm trong box. |
| `doesFootprintMeetBox` | `marquee.ts:383-395` | Luật crossing: footprint và box có chung phần nào (cạnh chạm, điểm đơn nằm trong, hoặc box bị outline khép kín nuốt trọn). |

### Hằng số

| Tên | Dòng | Giá trị | Việc |
|---|---|---|---|
| `TOUCH_TOLERANCE_MM` *(nội bộ)* | `marquee.ts:84` | `0.001` | Sai số cho phép khi test điểm sát biên khung kéo (mm). |

---

## 3. `src/lib/selection/syncChannel.ts`

Đường ống MỘT CHIỀU đưa thay đổi chọn từ store ra ba đích: canvas 2D, scene 3D, side
list. Không đích nào có thể publish ngược lại — chỉ `push` (thuộc store bridge) mới
khởi động một sự kiện; `reportVisible` không bao giờ publish. **Đồng bộ giữa
`canvas2d`, `scene3d`, `list`** (xem `SYNC_TARGETS` ở `revealPolicy.ts`).

| Tên | Dòng | Chữ ký | Mô tả |
|---|---|---|---|
| `SelectionEvent` | `syncChannel.ts:51-62` | `interface SelectionEvent { readonly target: SyncTarget; readonly selection: Selection; readonly detail: SelectionDetail; readonly reveal: RevealRequest \| null; readonly coalesced: number }` | Gói tin một đích nhận được khi selection ổn định sau một frame. |
| `SelectionListener` | `syncChannel.ts:64` | `type SelectionListener = (event: SelectionEvent) => void` | Kiểu hàm nghe sự kiện. |
| `FrameHandle` | `syncChannel.ts:66` | `type FrameHandle = number` | Handle của một lần lên lịch frame (để cancel). |
| `FrameScheduler` | `syncChannel.ts:74-77` | `interface FrameScheduler { schedule(run: () => void): FrameHandle; cancel(handle: FrameHandle): void }` | Cổng hoãn việc tới cuối frame — inject được để test dùng clock tự quay tay thay vì `requestAnimationFrame`. |
| `defaultFrameScheduler` | `syncChannel.ts:86-105` | `const defaultFrameScheduler: FrameScheduler` | Bản triển khai thật: dùng `requestAnimationFrame` nếu có, fallback `setTimeout(…, 0)`. |
| `CreateSelectionChannelOptions` | `syncChannel.ts:107-109` | `interface CreateSelectionChannelOptions { scheduler?: FrameScheduler }` | Tham số tạo channel — cho phép thay scheduler khi test. |
| `SelectionChannel` | `syncChannel.ts:111-122` | `interface SelectionChannel { subscribe; reportVisible; push; flush; dispose }` | Hình dạng channel — xem bảng phương thức bên dưới. |
| `VisibleState` *(nội bộ)* | `syncChannel.ts:125` | `type VisibleState = { -readonly [K in SyncTarget]?: readonly EntityId[] }` | Bản sao có-thể-ghi của `VisibleByTarget`, giữ trong channel. |
| `createSelectionChannel` | `syncChannel.ts:131-228` | `(options?: CreateSelectionChannelOptions) => SelectionChannel` | Hàm tạo channel — điểm vào duy nhất của module. |

### Mọi phương thức của `SelectionChannel`

| Phương thức | Dòng khai báo interface | Dòng cài đặt | Chữ ký | Mô tả |
|---|---|---|---|---|
| `subscribe` | `syncChannel.ts:113` | `syncChannel.ts:209-218` | `(target: SyncTarget, listener: SelectionListener) => () => void` | Đăng ký nghe một trong ba đích; hàm trả về để huỷ đăng ký. |
| `reportVisible` | `syncChannel.ts:115` | `syncChannel.ts:203-207` | `(target: SyncTarget, ids: readonly EntityId[]) => void` | Đích báo lại đang thấy những id nào. **Không bao giờ publish** — đây là lời gọi vào duy nhất một consumer được làm, và cho nó publish sẽ khép thành vòng lặp. |
| `push` | `syncChannel.ts:117` | `syncChannel.ts:194-201` | `(selection: Selection) => void` | Đẩy một thay đổi chọn vào; chỉ store bridge được gọi. Lên lịch flush cuối frame nếu chưa có frame nào đang chờ. |
| `flush` | `syncChannel.ts:119` | `syncChannel.ts:157-192` | `() => void` | Publish ngay thứ đang chờ, không đợi hết frame. Xoá pending TRƯỚC khi chạy listener (để listener push lại giữa chừng không tái nhập frame này); snapshot danh sách listener trước khi loop. |
| `dispose` | `syncChannel.ts:121` | `syncChannel.ts:220-225` | `() => void` | Huỷ mọi listener và frame đang chờ. |

---

## 4. `src/lib/selection/revealPolicy.ts`

Hai câu hỏi thuần (không subscriber, không timer, không vẽ): consumer nên DỰNG bao
nhiêu (rows hay tally), và AI phải cuộn để thấy vật vừa chọn.

| Tên | Dòng | Chữ ký | Mô tả |
|---|---|---|---|
| `SyncTarget` | `revealPolicy.ts:31` | `type SyncTarget = 'canvas2d' \| 'scene3d' \| 'list'` | Ba nơi một selection được hiển thị. **Đủ 3 giá trị, đúng thứ tự khai báo.** |
| `SYNC_TARGETS` | `revealPolicy.ts:34-38` | `const SYNC_TARGETS: readonly SyncTarget[] = ['canvas2d', 'scene3d', 'list']` | Mọi đích, theo thứ tự sự kiện được phát đi. |
| `SUMMARY_THRESHOLD` | `revealPolicy.ts:46` | `const SUMMARY_THRESHOLD = 500` | Chọn quá số này thì consumer được bảo tóm tắt (đếm theo kind) thay vì build từng dòng. Là ngân sách dựng hình, không phải luật của bản vẽ. |
| `KindCounts` | `revealPolicy.ts:49` | `type KindCounts = Readonly<Record<SelectableKind, number>>` | Số lượng đã chọn theo từng kind. |
| `SelectionDetail` | `revealPolicy.ts:59-61` | `type SelectionDetail = { readonly mode: 'full' } \| { readonly mode: 'summary'; readonly countsByKind: KindCounts }` | Consumer nên dựng bao nhiêu từ selection nhận được. |
| `RevealRequest` | `revealPolicy.ts:64-67` | `interface RevealRequest { readonly target: SyncTarget; readonly id: EntityId }` | Một yêu cầu đưa một vật vào tầm nhìn ở một đích. |
| `VisibleByTarget` | `revealPolicy.ts:75` | `type VisibleByTarget = Partial<Readonly<Record<SyncTarget, readonly EntityId[]>>>` | Mỗi đích cuối cùng báo lại đang thấy gì. Đích chưa báo gì coi như đang không thấy gì (hướng đoán an toàn). |
| `emptyCounts` *(nội bộ)* | `revealPolicy.ts:81-88` | `() => Record<SelectableKind, number>` | Bảng đếm khởi tạo 0 cho cả 6 kind. |
| `countByKind` | `revealPolicy.ts:97-109` | `(selection: Selection) => KindCounts` | Đếm selection theo kind, đọc từ tiền tố id — không đụng bản vẽ. |
| `describeSelection` | `revealPolicy.ts:112-115` | `(selection: Selection) => SelectionDetail` | Quyết định trả rows hay tally, dựa vào `SUMMARY_THRESHOLD`. |
| `revealAnchor` | `revealPolicy.ts:128-129` | `(selection: Selection) => EntityId \| null` | Vật một reveal nhắm tới: id **cuối cùng** trong mảng selection (vật vừa pick thêm gần nhất — theo giả định thứ tự chọn). |
| `planReveals` | `revealPolicy.ts:144-158` | `(selection: Selection, detail: SelectionDetail, visible: VisibleByTarget) => RevealRequest[]` | Đích nào phải cuộn để thấy anchor. Selection tóm tắt (`mode: 'summary'`) thì không yêu cầu ai cuộn cả. |

---

## 5. `src/lib/coloring/modes.ts`

Bảy cách tô mô hình. Một mode là hàm thuần từ đối tượng ra **tên token**, không bao
giờ ra màu thật. Mode được DỰNG LẠI mỗi khi tập object trong view đổi (để cắt lại
quantile cho `area`/`aiConfidence`).

| Tên | Dòng | Chữ ký | Mô tả |
|---|---|---|---|
| `COLORING_MODE_IDS` | `modes.ts:125-133` | `const COLORING_MODE_IDS = ['default', 'roomUsage', 'area', 'aiConfidence', 'reviewState', 'violationSeverity', 'level'] as const` | **Đủ bảy, đúng thứ tự** mode picker liệt kê. |
| `ColoringModeId` | `modes.ts:136` | `type ColoringModeId = (typeof COLORING_MODE_IDS)[number]` | Một trong bảy id trên. |
| `PaintSubject` | `modes.ts:85-98` | `interface PaintSubject { readonly id: string; readonly levelId: LevelId \| null; readonly review: ReviewMetadata; readonly usage: RoomUsage \| null; readonly areaM2: SquareMetres \| null; readonly worstSeverity: RuleSeverity \| null }` | Một vật có thể tô — hình dạng phẳng dùng chung cho tường/phòng/ô mở. Field nào cũng bắt buộc, `null` khi không áp dụng (không dùng optional). |
| `ColoringContext` | `modes.ts:106-118` | `interface ColoringContext { readonly subjects: readonly PaintSubject[]; readonly levelIds?: readonly LevelId[] }` | View một mode được dựng theo. `levelIds` optional — thiếu thì suy ra từ `subjects`. |
| `ColoringBand` | `modes.ts:139-143` | `interface ColoringBand { readonly token: ColorTokenName; readonly label: string }` | Một bậc của legend. |
| `ColoringMode` | `modes.ts:146-165` | `interface ColoringMode { readonly id: ColoringModeId; readonly label: string; readonly bands: readonly ColoringBand[]; readonly breaks: readonly number[]; readonly paint: (subject: PaintSubject) => ColorTokenName }` | Một mode đã dựng xong theo một view. `paint` là hàm tô — cho object nào cũng ra đúng một token, mọi lần. |
| `COLORING_MODE_LABELS` | `modes.ts:168-176` | `const COLORING_MODE_LABELS: Readonly<Record<ColoringModeId, string>>` | Tên tiếng Việt mode picker gọi từng mode (vd. `roomUsage` → `'theo công năng phòng'`). |
| `createColoringMode` | `modes.ts:547-564` | `(id: ColoringModeId, context: ColoringContext) => ColoringMode` | Dựng một mode theo view — **cửa vào duy nhất**. |
| `createColoringModes` | `modes.ts:567-569` | `(context: ColoringContext) => readonly ColoringMode[]` | Dựng đủ bảy mode theo một view, đúng thứ tự picker. |

### Bảy hàm dựng (nội bộ, không export — vào qua `createColoringMode`)

| Tên | Dòng | Việc |
|---|---|---|
| `createDefaultMode` | `modes.ts:358-366` | Mode `default`: tô mọi thứ một token trung tính (`--wall-idle`), không breaks. |
| `createRoomUsageMode` | `modes.ts:369-381` | Mode `roomUsage`: theo nhóm công năng phòng (5 nhóm từ 8 `RoomUsage`); vật không phải phòng → `UNPAINTED_TOKEN`. |
| `createAreaMode` | `modes.ts:389-403` | Mode `area`: cắt quantile TĂNG DẦN theo `areaM2` của `subjects` — phòng lớn nhất ăn bậc đậm nhất. |
| `createAiConfidenceMode` | `modes.ts:416-429` | Mode `aiConfidence`: cắt quantile GIẢM DẦN theo `review.confidence` — phần *kém tin cậy nhất* ăn bậc đậm nhất. Không bậc nào là màu trạng thái. |
| `createReviewStateMode` | `modes.ts:432-451` | Mode `reviewState`: 3 bậc (`approved`/`drawnByPerson`/`fromModel`) từ `review.reviewed` + `review.source`. **Mode DUY NHẤT được phát `--state-verified`.** |
| `createViolationSeverityMode` | `modes.ts:454-469` | Mode `violationSeverity`: theo `worstSeverity` (3 mức + "không vi phạm" = trung tính, không phải xanh verified). |
| `createLevelMode` | `modes.ts:492-527` | Mode `level`: theo vị trí trong stack tầng (không theo mật độ vật trên tầng); stack dài gấp vào tối đa 5 bậc. |
| `inferLevelStack` | `modes.ts:472-482` | `(subjects) => LevelId[]` — suy stack tầng từ `subjects` khi `ColoringContext.levelIds` không được truyền, sắp theo `localeCompare`. |

### Bảng nội bộ và hằng phụ trợ (không export)

| Tên | Dòng | Việc |
|---|---|---|
| `UsageGroup` (type) | `modes.ts:196` | 5 nhóm công năng: `living \| sleeping \| service \| circulation \| other`. |
| `USAGE_GROUPS` | `modes.ts:198-207` | Ánh xạ đủ cả 8 `RoomUsage` → 1 trong 5 nhóm (Record đầy đủ — thêm usage mới mà quên gán sẽ hỏng build). |
| `USAGE_GROUP_ORDER` | `modes.ts:210-216` | Thứ tự 5 nhóm trong legend. |
| `USAGE_GROUP_TOKENS` | `modes.ts:218-224` | Token cho từng nhóm công năng. |
| `USAGE_GROUP_LABELS` | `modes.ts:226-232` | Nhãn tiếng Việt từng nhóm. |
| `ReviewStage` (type) | `modes.ts:242` | `'approved' \| 'drawnByPerson' \| 'fromModel'`. |
| `REVIEW_STAGE_ORDER` / `_TOKENS` / `_LABELS` | `modes.ts:244-256` | Thứ tự, token, nhãn ba giai đoạn kiểm tra. |
| `SEVERITY_TOKENS` | `modes.ts:266-270` | Token theo `RuleSeverity` — `suggestion` dùng bản nhạt của màu attention. |
| `SEVERITY_LABELS` | `modes.ts:280-284` | Nhãn 3 mức vi phạm — bản sao có chủ đích của `RULE_SEVERITY_LABELS` (`@/domain/rules/registry`), test đối chiếu để không lệch. |
| `SEVERITY_ORDER` | `modes.ts:287` | `['critical', 'warning', 'suggestion']`. |
| `NO_VIOLATION_TOKEN` / `_LABEL` | `modes.ts:290-291` | Token/nhãn cho vật không vi phạm — cố tình KHÔNG phải xanh verified. |
| `UNTINTED_TOKEN` | `modes.ts:294` | Token mode `default` dùng cho mọi vật. |
| `rangeLabel` | `modes.ts:301-319` | `(breaks, index, bandCount, write) => string` — chữ mô tả một bậc quantity (vd. `"đến 12,50 m²"`). |
| `rangeBands` | `modes.ts:322-333` | `(scale, write) => ColoringBand[]` — một dòng legend mỗi bậc của quantity scale. |
| `readingsOf` | `modes.ts:336-351` | `(subjects, read) => number[]` — trị số hữu hạn để cắt quantile (bỏ `null`/`NaN`). |

---

## 6. `src/lib/coloring/legend.ts`

Chú giải tự sinh: mọi field đều DẪN XUẤT (không gõ tay) — bands từ mode, range từ
quantile cuts của mode, count từ chạy `mode.paint` trên object trong view. Song song
đó là bài toán tương phản: 3/5 token của `SEQUENTIAL_RAMP` (`--wall-220`,
`--state-verified`, `--state-violation`) không đạt 4,5:1 với BẤT KỲ text token nào
trong bảng màu → nhãn phải chuyển ra cạnh swatch thay vì viết đè lên.

| Tên | Dòng | Chữ ký | Mô tả |
|---|---|---|---|
| `Palette` | `legend.ts:78` | `type Palette = Readonly<Partial<Record<ColorTokenName, string>>>` | Token → giá trị màu thật, đọc từ stylesheet. Partial để một trang chưa nạp theme xong vẫn kiểm được phần đã có. |
| `ParsedColor` | `legend.ts:81-86` | `interface ParsedColor { readonly red: number; readonly green: number; readonly blue: number; readonly alpha: number }` | Màu đã tách kênh. |
| `parseColor` | `legend.ts:94-104` | `(value: string) => ParsedColor \| null` | Đọc `#abc`, `#aabbcc`, `rgb()`, `rgba()`; dạng khác trả `null`. |
| `parsePalette` | `legend.ts:146-159` | `(cssText: string) => Palette` | Dựng `Palette` từ text CSS thật — khai báo nào không thuộc `ColorTokenName` bị bỏ qua. |
| `CONTRAST_MINIMUM_BODY` | `legend.ts:166` | `const CONTRAST_MINIMUM_BODY = 4.5` | Ngưỡng WCAG 2.2 cho chữ thường. |
| `CONTRAST_MINIMUM_LARGE` | `legend.ts:169` | `const CONTRAST_MINIMUM_LARGE = 3` | Ngưỡng WCAG 2.2 cho chữ lớn / phần không phải chữ. |
| `relativeLuminance` | `legend.ts:179-185` | `(color: ParsedColor) => number` | Độ sáng tương đối theo WCAG 2.2. |
| `contrastRatio` | `legend.ts:197-209` | `(first: string, second: string) => number` | Tỉ lệ tương phản 1–21 giữa hai màu; ném lỗi nếu không đọc được màu. Đối xứng — đổi thứ tự tham số không đổi kết quả. |
| `ContrastCheck` | `legend.ts:212-220` | `interface ContrastCheck { readonly backgroundToken; readonly textToken; readonly ratio: number; readonly threshold: number; readonly passes: boolean }` | Kết quả soát một cặp nền/chữ. |
| `checkContrast` | `legend.ts:234-245` | `(backgroundToken: ColorTokenName, textToken: ColorTokenName, palette: Palette, threshold = CONTRAST_MINIMUM_BODY) => ContrastCheck` | Cặp nền/chữ này có đọc được không. **Ném lỗi** nếu token thiếu trong palette hoặc token trong suốt một phần. |
| `LEGEND_SURFACE_TOKEN` | `legend.ts:273` | `const LEGEND_SURFACE_TOKEN: ColorTokenName = '--bg-surface'` | Nền panel legend, và nền dự phòng khi nhãn không thể nằm trên swatch. |
| `LEGEND_TEXT_TOKEN` | `legend.ts:276` | `const LEGEND_TEXT_TOKEN: ColorTokenName = '--text-primary'` | Token chữ dùng trên `LEGEND_SURFACE_TOKEN`. |
| `LabelPlacement` | `legend.ts:292` | `type LabelPlacement = 'onSwatch' \| 'besideSwatch'` | Nhãn nằm trong swatch hay cạnh nó. |
| `LabelTreatment` | `legend.ts:295-301` | `interface LabelTreatment { readonly placement: LabelPlacement; readonly backgroundToken: ColorTokenName; readonly textToken: ColorTokenName; readonly ratio: number }` | Cách viết nhãn cho một swatch để đạt 4,5:1, hoặc phán quyết "không có cách nào". |
| `resolveLabelTreatment` | `legend.ts:310-348` | `(swatchToken: ColorTokenName, palette: Palette) => LabelTreatment` | Chọn text token đạt tỉ lệ cao nhất trên swatch; không đạt thì đẩy nhãn ra `LEGEND_SURFACE_TOKEN`/`LEGEND_TEXT_TOKEN`. |
| `LegendItem` | `legend.ts:355-373` | `interface LegendItem { readonly token; readonly label: string; readonly range: string; readonly count: number; readonly labelPlacement; readonly labelBackgroundToken; readonly labelTextToken }` | Một dòng legend. |
| `Legend` | `legend.ts:376-392` | `interface Legend { readonly modeId: ColoringModeId; readonly label: string; readonly items: readonly LegendItem[]; readonly unpaintedCount: number; readonly unpaintedToken: ColorTokenName; readonly surfaceToken: ColorTokenName }` | Một legend hoàn chỉnh, sẵn sàng render. |
| `generateLegend` | `legend.ts:441-488` | `(mode: ColoringMode, subjects: readonly PaintSubject[], palette: Palette = {}) => Legend` | Sinh legend cho một mode trên view — mọi field dẫn xuất từ `mode.bands` + `mode.paint`. Bậc không có object trong view vẫn giữ lại (không xoá dòng rỗng). |
| `DIMMED_OPACITY` | `legend.ts:501` | `const DIMMED_OPACITY = 0.12` | Độ mờ vật KHÔNG thuộc câu hỏi hiện tại. |
| `FOCUSED_OPACITY` | `legend.ts:504` | `const FOCUSED_OPACITY = 1` | Độ mờ vật thuộc câu hỏi hiện tại. |
| `Emphasis` | `legend.ts:507` | `type Emphasis = 'focused' \| 'dimmed'` | Vật có thuộc câu hỏi đang hỏi hay không. |
| `Appearance` | `legend.ts:516-519` | `interface Appearance { readonly token: ColorTokenName; readonly opacity: number }` | Cách vẽ một vật: token nào, mờ bao nhiêu. Chỉ hai field — không có token overlay/tint thay thế. |
| `applyEmphasis` | `legend.ts:540-542` | `(token: ColorTokenName, emphasis: Emphasis) => Appearance` | Làm mờ một vật ngoài câu hỏi — TOKEN GIỮ NGUYÊN, chỉ opacity đổi. |
| `applyEmphasisTo` | `legend.ts:550-558` | `(mode: ColoringMode, subjects: readonly PaintSubject[], isRelevant: (subject: PaintSubject) => boolean) => Appearance[]` | `Appearance` cho mọi object trong view, vật ngoài câu hỏi bị làm mờ. |

### Nội bộ không export

| Tên | Dòng | Việc |
|---|---|---|
| `HEX_SHORT_LENGTH` / `HEX_LONG_LENGTH` / `HEX_RADIX` / `CHANNEL_MAX` | `legend.ts:88-91` | Hằng số phụ cho `parseHex`. |
| `parseHex` | `legend.ts:106-120` | Đọc `#abc`/`#aabbcc`. |
| `parseFunctional` | `legend.ts:122-138` | Đọc `rgb()`/`rgba()`. |
| `requireOpaque` | `legend.ts:247-266` | Lấy giá trị màu opaque của một token từ palette, ném lỗi nếu thiếu/không đọc được/trong suốt. |
| `TEXT_TOKEN_CANDIDATES` | `legend.ts:285-289` | 3 token chữ ứng viên cho `resolveLabelTreatment` thử: `--text-primary`, `--text-secondary`, `--bg-surface`. |
| `QUANTITY_MODE_IDS` | `legend.ts:395-398` | Set 2 mode có bands cắt từ số lượng: `area`, `aiConfidence`. |
| `QUANTITY_BAND_LABELS` | `legend.ts:407-410` | Tên 5 bậc cho `area` (`nhỏ nhất`…`lớn nhất`) và `aiConfidence` (`thấp nhất`…`cao nhất`). |
| `quantityBandLabel` | `legend.ts:413-417` | `(modeId, index, bandCount) => string` — tên một bậc, fallback `"bậc N"` khi scale ngắn hơn 5. |

---

## 7. `src/lib/coloring/scales.ts`

Bảng token các mode dùng, và toán cắt quantile.

| Tên | Dòng | Chữ ký | Mô tả |
|---|---|---|---|
| `COLOR_TOKEN_NAMES` | `scales.ts:62-129` | `const COLOR_TOKEN_NAMES = [...] as const` | MỌI token màu khai trong `src/styles/globals.css`, viết lại tay (test đối chiếu hai chiều với stylesheet thật). Gồm cả nhóm `--scene-*` (chỉ dùng cho màn đăng nhập, không mode tô màu nào được cầm) và `--shadow-color-*`. |
| `ColorTokenName` | `scales.ts:135` | `type ColorTokenName = (typeof COLOR_TOKEN_NAMES)[number]` | Tên một token — không bao giờ là class, hex, `rgb()`/`hsl()`. |
| `isColorTokenName` | `scales.ts:138-140` | `(value: string) => value is ColorTokenName` | Chuỗi có phải một token đã khai không. |
| `MAX_SCALE_STEPS` | `scales.ts:152` | `const MAX_SCALE_STEPS = 5` | Trần số bậc của MỌI scale. |
| `SEQUENTIAL_RAMP` | `scales.ts:162-168` | `const SEQUENTIAL_RAMP = ['--bg-sunken', '--wall-idle', '--wall-110', '--wall-220', '--wall-330'] as const satisfies readonly ColorTokenName[]` | 5 token trung tính, sáng→tối, cùng họ warm-neutral — dùng cho mọi scale định lượng. |
| `UNPAINTED_TOKEN` | `scales.ts:179` | `const UNPAINTED_TOKEN: ColorTokenName = '--border-default'` | Token cho vật KHÔNG CÓ trị số đọc được — cố tình nằm NGOÀI `SEQUENTIAL_RAMP`, không lẫn với "giá trị nhỏ nhất". |
| `ScaleDirection` | `scales.ts:189` | `type ScaleDirection = 'ascending' \| 'descending'` | Đầu nào của dữ liệu ăn bậc đậm nhất. |
| `QuantileScale` | `scales.ts:192-208` | `interface QuantileScale { readonly breaks: readonly number[]; readonly bandCount: number; readonly tokens: readonly ColorTokenName[]; readonly bandOf: (value: number) => number; readonly tokenOf: (value: number) => ColorTokenName }` | Một scale định lượng đã cắt sẵn theo một tập trị số cụ thể. |
| `QuantileScaleOptions` | `scales.ts:210-217` | `interface QuantileScaleOptions { readonly bandCount?: number; readonly direction?: ScaleDirection; readonly ramp?: readonly ColorTokenName[] }` | Tham số tạo `QuantileScale`. |
| `quantileOf` *(nội bộ)* | `scales.ts:226-237` | `(sorted: readonly number[], fraction: number) => number` | Một quantile của danh sách đã sort, nội suy tuyến tính (kiểu `numpy.quantile`/R type 7). |
| `quantileBreaks` | `scales.ts:255-270` | `(values: readonly number[], bandCount: number) => number[]` | Điểm cắt để chia trị số thành `bandCount` bậc đều dân số. Trị không hữu hạn bị loại bỏ (không kéo lệch biên). |
| `bandIndexOf` | `scales.ts:278-288` | `(value: number, breaks: readonly number[]) => number` | Bậc của một trị số theo biên tăng dần — **trị nằm đúng biên thuộc bậc THẤP HƠN** (`(…, break]`). |
| `clampBandCount` *(nội bộ)* | `scales.ts:290-296` | `(bandCount: number) => number` | Ép `bandCount` về `[1, MAX_SCALE_STEPS]`, số không hữu hạn → `1`. |
| `createQuantileScale` | `scales.ts:308-332` | `(values: readonly number[], options: QuantileScaleOptions = {}) => QuantileScale` | Cắt một tập trị số thành scale + token mỗi bậc. Thuần: cùng input luôn ra cùng scale, không ghi đè mảng đầu vào. |
| `createLookupScale` | `scales.ts:345-349` | `<Key extends string>(table: Readonly<Record<Key, ColorTokenName>>) => (key: Key \| null \| undefined) => ColorTokenName` | Scale phân loại (không phải định lượng) — bảng PHẢI là `Record` đầy đủ, thêm case mới quên gán sẽ hỏng build. |

---

## (a) O-01 "ghi fps trung bình" CÓ TỒN TẠI KHÔNG?

### Kết quả lệnh thật

```
$ rg -in "fps|frameRate|frame_rate" src/lib/telemetry/
(không có kết quả — 0 dòng khớp)
```

**`O-01 NOT FOUND` — `src/lib/telemetry/events.ts` không có sự kiện fps nào.**

Mọi tên sự kiện thật có, lấy từ `TELEMETRY_EVENT_NAMES` (`events.ts:369-380`, khớp
với `TELEMETRY_EVENT_SCHEMA` ở `events.ts:340-351`) — đúng 10 sự kiện, không có sự
kiện thứ 11 nào tên fps:

1. `drawing.upload` (`events.ts:158-165`)
2. `ai.started` (`events.ts:177-181`)
3. `ai.finished` (`events.ts:190-202`)
4. `wall.edit` (`events.ts:224-232`)
5. `rules.run` (`events.ts:235-245`)
6. `export.file` (`events.ts:252-260`)
7. `screen.error` (`events.ts:270-276`)
8. `app.first-frame` (`events.ts:284-289`)
9. `scene.build` (`events.ts:297-304`)
10. `project.open` (`events.ts:323-327`)

Bốn chỉ số trải nghiệm module này tính (`EXPERIENCE_INDICATORS`, `events.ts:448-453`)
là `timeToFirstFrame`, `sceneBuild`, `editLatency`, `errorRate` — **không có
`fps`/`frameRate` nào trong danh sách này**, kể cả dưới tên khác.

### fps CÓ được đo ở đâu đó trong repo, chỉ không phải ở telemetry

`rg -in "fps" --glob '!node_modules'` (toàn repo) khớp ở các chỗ khác, đáng chú ý:

- `src/lib/three/perf/monitor.ts:119` — `PerfSample.frameRate: number`, tính ở
  `monitor.ts:323` (`frames * 1000 / durationMs`), lấy mẫu mỗi
  `SAMPLE_INTERVAL_MS = 500` (`monitor.ts:69`). Đây là engine hạ chất lượng của
  R-04 (`DEGRADE_FRAME_RATE`, `monitor.ts:81`; so sánh ở `monitor.ts:375`).
- `src/screens/viewer/ViewerShell/useViewerShell.ts:842` — đọc `perf.frameRate` để
  hiển thị `"${fps} fps"` lên `ViewerStatusBar`.

Vậy: **fps được đo LIVE cho mục đích hạ chất lượng render và hiển thị trạng thái**,
nhưng **không có đường nào gửi số đó (trung bình hay không) vào
`src/lib/telemetry`**. O-01 mô tả một hành vi (ghi fps trung bình vào telemetry) mà
kho mã hiện tại không có.

### Thêm một sự kiện mới có phải sửa `src/lib/telemetry/**` không?

**Có, bắt buộc phải sửa**, và thư mục đó bị CẤM sửa trong task này:

- Phải thêm một shape mới vào `TELEMETRY_EVENT_SCHEMA` (discriminated union,
  `events.ts:340-351`) — vd. `sceneFrameRateSchema` với `name: z.literal('scene.frame-rate')`.
- Phải thêm tên tương ứng vào `TELEMETRY_EVENT_NAMES` (`events.ts:369-380`) — hai
  danh sách này được test đối chiếu hai chiều (`events.ts:362-367`), lệch một bên
  là fail test.
- `sender.ts` và `flags.ts` (cùng thư mục) tham chiếu `TelemetryEvent`/
  `TELEMETRY_EVENT_SCHEMA` (xác nhận bằng `rg` — 4 file khớp:
  `sender.ts`, `events.ts`, `__tests__/telemetry.test.ts`, và
  `src/lib/errors/report.ts` ở ngoài thư mục dùng lại type) nên một event mới
  thường kéo theo việc soát lại cả `sender.ts`.

Kết luận: **Viewer3D không thể tự thêm "ghi fps trung bình" mà không đụng
`src/lib/telemetry/**`.** Đây là việc phải hỏi/giao cho task khác (có quyền sửa
`src/lib`), không phải việc `Viewer3D` tự chế thêm field vào một sự kiện có sẵn.

---

## (b) Bảy chế độ tô màu ánh xạ sang bốn thứ đặc tả kể thế nào?

Đặc tả P-06 nói "bảy chế độ tô màu theo dữ liệu (**công năng · độ tin cậy · tầng ·
vi phạm**)" — bốn từ khoá. `COLORING_MODE_IDS` (`modes.ts:125-133`) thật có **bảy**
id, đúng thứ tự: `default`, `roomUsage`, `area`, `aiConfidence`, `reviewState`,
`violationSeverity`, `level`.

| Từ khoá đặc tả | Id thật khớp | Ghi chú |
|---|---|---|
| công năng | `roomUsage` | `COLORING_MODE_LABELS.roomUsage = 'theo công năng phòng'` (`modes.ts:170`). |
| độ tin cậy | `aiConfidence` | `'theo độ tin cậy AI'` (`modes.ts:172`), cắt quantile GIẢM DẦN theo `review.confidence`. |
| tầng | `level` | `'theo tầng'` (`modes.ts:175`), theo vị trí trong stack tầng. |
| vi phạm | `violationSeverity` | `'theo mức vi phạm'` (`modes.ts:174`), theo `worstSeverity`. |

**Ba id đặc tả KHÔNG kể tới:**

| Id thật | Nhãn | Vì sao đặc tả không nhắc |
|---|---|---|
| `default` | `'mặc định'` (`modes.ts:169`) | Trạng thái nền — "mô hình trước khi hỏi câu hỏi nào", không phải một câu hỏi dữ liệu. |
| `area` | `'theo diện tích'` (`modes.ts:171`) | Một chỉ số định lượng riêng (diện tích phòng), không nằm trong bốn từ khoá "công năng · độ tin cậy · tầng · vi phạm". |
| `reviewState` | `'theo trạng thái kiểm tra'` (`modes.ts:173`) | Gần "độ tin cậy" về mặt chủ đề (đều liên quan tới quy trình duyệt) nhưng là trục khác hẳn: `aiConfidence` đo con số máy đưa ra, `reviewState` đo một người đã duyệt hay chưa — và là mode DUY NHẤT được phát `--state-verified` (A5). Đặc tả không tách riêng ra như một trong bốn từ khoá. |

Vậy: **4/7 id khớp thẳng bốn từ khoá đặc tả** (`roomUsage`, `aiConfidence`, `level`,
`violationSeverity`); **3/7 id (`default`, `area`, `reviewState`) là phần kho mã có
thêm mà bốn từ khoá đặc tả không kể tới** — không phải lỗi, chỉ là đặc tả tóm tắt
không đủ chi tiết để dự đoán đúng bảy id.

---

## CẠM BẪY

1. **`toggleSelection` bỏ chọn KHÔNG xét `isSelectable`** (`selectionOps.ts:172-174`)
   — một vật đã chọn mà layer của nó bị khoá SAU đó vẫn Ctrl-pick bỏ ra được. Đây
   là chủ đích (không "bẫy" người đã chọn trong selection), nhưng dễ tưởng nhầm là
   bug nếu không đọc docblock.

2. **`combineSelection` mode `'subtract'` KHÔNG lọc qua `isSelectable`**
   (`selectionOps.ts:230-236`) — trừ luôn được phép với bất kỳ id nào, kể cả id
   không hợp lệ. `'replace'`/`'add'` thì có lọc (`selectionOps.ts:239`).

3. **`keepIfUnchanged` so theo NỘI DUNG, không theo reference** — nếu component
   gọi `combineSelection`/`selectSingle`/... rồi tự `[...spread]` kết quả trước khi
   so sánh reference (`===`) để quyết định re-render, sẽ mất tác dụng chống
   re-render thừa mà các hàm này cố tình tạo ra.

4. **`marqueeMode` coi kéo DỌC THUẦN (không lệch ngang) là `'window'`**
   (`marquee.ts:97-98`, vì `end.x >= start.x` đúng khi bằng nhau) — không phải
   `'crossing'`. Đây là luật chặt hơn được chọn có chủ đích khi hướng kéo mơ hồ,
   không phải một nhánh chưa xử lý.

5. **`footprintOf` trả `null` cho `level`** (`marquee.ts:234-263`, không có
   nhánh xử lý level) — một entity kind không có geometry để test marquee thì bị
   bỏ qua hoàn toàn ở `marqueeHits` (`marquee.ts:425-427`), không lỗi, không cảnh
   báo.

6. **`SelectionChannel.reportVisible` không bao giờ publish** — gọi nó không kích
   `flush`, không tính lại `planReveals` ngay. Reveal chỉ được tính lại ở lần
   `push`/`flush` KẾ TIẾP. Một consumer báo "tôi vừa thấy được vật X" sau khi
   frame đã flush xong sẽ không tự động rút lại yêu cầu reveal đã gửi trong frame
   đó.

7. **`revealAnchor` lấy id CUỐI của mảng selection** (`revealPolicy.ts:128-129`)
   với giả định "đó là vật vừa pick thêm gần nhất". Giả định này đúng cho
   `selectSingle`/`toggleSelection`, nhưng với `combineSelection`/`applyMarquee`
   mảng mới được `dedupe([...selection, ...eligible])`
   (`selectionOps.ts:243`) — id "cuối" là id cuối theo thứ tự `idsOnLevel` bắt
   được trong marquee, KHÔNG nhất thiết là vật gần con trỏ nhất lúc thả chuột.

8. **`SUMMARY_THRESHOLD = 500` không cấu hình được** (`revealPolicy.ts:46`) — hằng
   số cứng, không phải tham số của `createSelectionChannel`. Selection > 500 luôn
   vào `detail.mode: 'summary'`; mảng `selection` đầy đủ vẫn đi kèm event
   (`syncChannel.ts:54`) nên một consumer lơ đãng có thể phớt lờ `detail.mode` và
   build 501 dòng dù được bảo đừng.

9. **`ColoringMode` phải được DỰNG LẠI mỗi khi `subjects` đổi** — `breaks` của
   `area`/`aiConfidence` bị đóng băng tại thời điểm gọi `createColoringMode`
   (`modes.ts:389-403`, `416-429`). Giữ một `ColoringMode` cũ rồi lọc view sang
   level khác mà không gọi lại `createColoringMode` sẽ tô SAI theo quantile của
   view cũ.

10. **Chỉ `reviewState` được phát `--state-verified`** — bất kỳ mode nào khác lỡ
    map một trường hợp về token này là vi phạm A5 trực tiếp (test đã pin điều này
    theo docblock `modes.ts:20-26`, nhưng không có rào compile-time ngăn một mode
    MỚI tự thêm sau này).

11. **`checkContrast`/`resolveLabelTreatment`/`requireOpaque` NÉM LỖI** (không trả
    `null`) khi token thiếu trong `Palette` hoặc màu trong suốt một phần
    (`legend.ts:247-266`). `generateLegend(mode, subjects, {})` (palette rỗng) thì
    AN TOÀN — mọi nhãn tự động rơi về `besideSwatch` — nhưng `generateLegend` với
    một `Palette` CÓ token này thiếu token kia (vd. đọc dở từ `getComputedStyle`
    giữa lúc theme đang nạp) sẽ throw ngay khi `resolveLabelTreatment` chạm token
    thiếu.

12. **`UNPAINTED_TOKEN` (`--border-default`) cố tình KHÔNG nằm trong
    `SEQUENTIAL_RAMP`** (`scales.ts:162-179`) — "không có trị số" và "trị số nhỏ
    nhất" là hai sự thật khác nhau; một vật `areaM2: null` không được lẫn với
    phòng nhỏ nhất trong view.

13. **`bandIndexOf`: trị đúng bằng một biên thuộc bậc THẤP HƠN** (`(…, break]`,
    `scales.ts:278-288`) — không phải nửa-khoảng-mở kiểu `[break, …)`. Dễ lệch một
    bậc nếu ai viết lại logic phân bậc ở nơi khác theo trực giác ngược lại.

14. **`createLookupScale`/`USAGE_GROUPS` đòi `Record` ĐẦY ĐỦ** — thêm một case mới
    vào union nguồn (`RoomUsage`, hay `Key` của `createLookupScale`) mà quên gán
    trong bảng sẽ hỏng BUILD (TypeScript), không phải hỏng lúc chạy — đây là chủ
    đích, không phải rào cản.

15. **`SEQUENTIAL_RAMP` đúng 5 phần tử; `createQuantileScale({ ramp })` tuỳ biến
    ngắn hơn 5 thì `bandCount` tối đa cũng bị cắt theo `ramp.length`** (do
    `spent = ramp.slice(0, bandCount)`, `scales.ts:319`) — truyền một ramp tuỳ biến
    ngắn hơn số bậc yêu cầu sẽ ÂM THẦM cho ít bậc hơn xin, không báo lỗi.

16. **O-01 không tồn tại, và `src/lib/telemetry/**` bị cấm sửa trong CẤM TUYỆT
    ĐỐI của task này** — bất kỳ ai lập kế hoạch cho Viewer3D dựa trên giả định
    "chỉ cần gọi telemetry để ghi fps trung bình" sẽ vấp ngay ranh giới file cấm
    sửa. Việc này phải được hỏi/leo thang trước khi code, không phải tự chế một
    lối tắt (ví dụ tự ghi vào `localStorage` hay console) để "coi như xong".

---

## Tổng kết số liệu (bắt buộc theo mục 4 của task)

- **Số hàm/lớp/hằng/kiểu đã lập hợp đồng:** 147 mục (đếm theo dòng bảng —
  selectionOps.ts: 21, marquee.ts: 21 [6 công khai + 14 nội bộ + 1 hằng số],
  syncChannel.ts: 14 [9 mục + 5 phương thức của `SelectionChannel`],
  revealPolicy.ts: 12, modes.ts: 32 [9 công khai + 8 hàm dựng nội bộ +
  15 bảng/hằng nội bộ], legend.ts: 32 [24 công khai + 8 nội bộ], scales.ts: 15).
- **(a) O-01 "ghi fps trung bình" CÓ TỒN TẠI KHÔNG?** **KHÔNG** — `rg` trong
  `src/lib/telemetry/` cho 0 kết quả khớp `fps|frameRate|frame_rate`; 10 sự kiện
  thật có không có sự kiện nào về fps; fps có được đo (`src/lib/three/perf/monitor.ts`)
  nhưng chưa từng chảy tới telemetry, và thêm nó bắt buộc sửa `src/lib/telemetry/**`
  (thư mục cấm sửa).
- **(b) Bảy mode khớp bốn từ khoá đặc tả thế nào?** 4/7 khớp thẳng
  (`roomUsage`→công năng, `aiConfidence`→độ tin cậy, `level`→tầng,
  `violationSeverity`→vi phạm); 3/7 (`default`, `area`, `reviewState`) là mode có
  thật trong kho mã mà bốn từ khoá đặc tả không nhắc tới.
