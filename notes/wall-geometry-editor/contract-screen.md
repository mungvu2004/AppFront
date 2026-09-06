# Hợp đồng KIỂU của màn `WallGeometryEditor` (S-19 / T4)

> Đây là **mối nối** giữa T5 (view thuần + story + `index.ts`) và T6 (hook +
> container + gateway), hai người chạy song song ở hai worktree và không nhìn
> thấy mã của nhau. Mọi khối mã trong tài liệu này **chép thẳng vào `src/` được**,
> không phải sửa: `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`
> đều bật (`tsconfig.json`), nên mọi trường tuỳ chọn ở đây viết đủ `?: T | undefined`.

---

## 0. Khuôn được chép, và ba chỗ cố ý lệch

**Khuôn chính: `src/screens/viewer/PropertyInspector/`.** Đó là màn gần nhất về
mọi mặt — cũng nằm trong `src/screens/viewer`, cũng là một tấm phủ trên khung
Viewer3D, cũng có bảng dòng sửa được tại chỗ, cũng phải chịu bảy trạng thái có
hình dạng dữ liệu khác hẳn nhau. Bốn quyết định được chép nguyên:

| Chép từ | Là gì |
|---|---|
| `propertyInspectorTypes.ts:1-40` | Một file `.ts` thuần giữ toàn bộ kiểu dùng chung; view nhập nó bằng `import type` |
| `propertyInspectorTypes.ts:389-460` | Bảy trạng thái là **discriminated union lồng**, không phải một cờ `state: string` cộng một mớ trường `\| null` |
| `propertyInspectorTypes.ts:497-503` | `UseXResult = XProps` — hook trả **đúng** props của view |
| `propertyInspectorGateway.ts:558-568, 694-728` | Gateway có `supports: Record<Capability, boolean>` + một kiểu `Result` có nhánh từ chối mang **câu tiếng Việt** |

Khuôn phụ đã đọc và lấy từng mảnh:

- `viewerShellTypes.ts:59-82` — lý lẽ cho một bảng số đo bố cục đặt tên
  (`VIEWER_LAYOUT`): bề rộng một cột không nằm trong danh sách R-71 cấm, và gom
  vào một chỗ thì chín màn dùng chung đúng một bộ số. `WALL_GEOMETRY_EDITOR_LAYOUT`
  ở mục 3.1 đứng trên đúng lý lẽ đó.
- `viewer3dTypes.ts:44-66` — `canvasRef` **không** do hook cấp mà do container
  cấp, vì nó chỉ tồn tại sau khi view gắn. Màn này có đúng một trường như thế
  (`overlayRef`, mục 3.9).
- `viewerShellTypes.ts:225-277` — `ViewerSceneFrame` / `ViewerSceneActions`: hình
  dạng dữ liệu vỏ 3D đã dùng để nói chuyện với một màn nội dung.
- `propertyInspectorScenarios.ts:1-30` — bảy kịch bản mang **props**, không dựng
  container, vì view thuần phải test được chỉ từ props.
- `lib/testing/sevenStateScenarios.ts:26-48` — bảng chữ `SEVEN_STATES` mà mục 6
  phải khớp từng ký tự.
- `lib/viewmodel/types.ts:66-69` — `ViewStatusCode`, bốn mã, ba màu trạng thái
  của A4 cộng `neutral`.

### Ba chỗ cố ý lệch khỏi khuôn `PropertyInspector`, kèm lý do

1. **Tên kiểu trả về của hook là `UseWallGeometryEditorResult`, không phải
   `UseWallGeometryEditor`** như đặc tả T4 gọi. Hai màn anh em trong cùng thư mục
   đặt tên là `UsePropertyInspectorResult` và `UseFurnitureLibraryPanelResult`;
   một cái tên thứ ba cho cùng một vai sẽ là chỗ để người đọc sau tưởng nó khác.
   Đặc tả nói về **vai**, không phải về chuỗi ký tự.

2. **Chuỗi tiếng Việt nằm ở `wallGeometryEditorTypes.ts`, không nằm ở file
   hook.** `PropertyInspector` để `PROPERTY_INSPECTOR_TEXT` trong
   `usePropertyInspector.ts`, và `propertyInspectorScenarios.ts` nhập ngược lên
   hook để lấy chữ. Ở đây làm thế là **hỏng cả việc**: story và kịch bản là của
   T5, hook là của T6, hai người ở hai worktree — một mũi tên nhập từ file của T5
   sang file của T6 nghĩa là T5 không dựng nổi story cho tới khi T6 đẩy mã lên.
   `WALL_GEOMETRY_EDITOR_TEXT` vì thế ở trong file kiểu, nơi **cả hai** đọc được
   mà không ai phải chờ ai.

3. **Trạng thái `collapsed` KHÔNG mở rộng `WallGeometryEditorContent`.**
   `FurnitureLibraryPanel` cho `collapsed` mang đủ nội dung; ở đây "thu gọn" theo
   đặc tả là **khoá sửa trên di động, chỉ xem** — mang theo sáu nút công cụ, tay
   nắm kéo được và bảng đỉnh sửa được là mang theo đúng thứ trạng thái ấy tồn tại
   để chặn. Nó chỉ mang một câu và một đường thoát.

### Ba sự thật của repo mà hợp đồng này đứng lên trên

Đã tự mở file kiểm chứng, không dẫn tên nào chưa kiểm:

- **`Wall` là một `Segment`, tức đúng HAI đầu mút** — `src/domain/spatial/types.ts:123-132`
  (`centreline: Segment`) và `:31-34` (`Segment { start: Point; end: Point }`).
  Đặc tả màn thì nói "thêm đỉnh · xoá đỉnh", tức một đường gấp khúc N đỉnh. Hợp
  đồng này **không giả định bên nào thắng**: bảng đỉnh và danh sách tay nắm đều
  là **mảng**, nên hai đỉnh hôm nay và N đỉnh sau này là cùng một kiểu. Không một
  trường nào ở mục 3 tên là `start`/`end`.
- **`Wall` không có trường nào giữ hình học gốc** — `types.ts:123-132` cộng
  `ReviewMetadata` (`:61-65`, chỉ có `confidence`/`source`/`reviewed`). Đây là
  chỗ để mở #1, mục 7.
- **Một phiên kéo sinh đúng một bước hoàn tác đã có sẵn cơ chế** —
  `src/store/commit.ts:179` (`previewEdit`) đề nghị một hình **tạm** không vào
  lịch sử hoàn tác và không đi tự lưu, `:201` (`discardPreview`) bỏ nó, và
  `commit.ts:131` cho biết `commit` **tự dọn** bản nháp trước khi trả về. Mục 5
  khai đúng ba cửa đó bằng ngôn ngữ nghiệp vụ.

### Thang chuyển động — một con số của đặc tả không có trong thang

`MOTION_DURATIONS_MS` (`src/lib/motion/tokens.ts:62-67`) có **bốn** giá trị:
`instant` 120 · `fast` 180 · `standard` 260 · `slow` 340. Đặc tả màn đòi "nối hai
tường trong **240ms**" — 240 không có trong thang, và R-71 cấm viết con số ấy vào
màn. Ánh xạ đã chốt ở mục 3.1 (`WALL_GEOMETRY_MOTION`): nối tường dùng
`standard` (260), huỷ kéo dùng `fast` (đúng 180 đặc tả đòi), tay nắm lắng xuống
sau khi bắt điểm dùng `instant`, vết cắt hé ra dùng `fast`. **View không bao giờ
viết một con số mili-giây;** nó cầm một *tên ô* và gọi `durationMs()` /
`cssDurationMs()` của `lib/motion/tokens.ts:103,107`.

---

## 1. Sáu file của R-59, ai viết file nào

| File | Vai | Chủ |
|---|---|---|
| `wallGeometryEditorTypes.ts` | **Mục 3, 4, 6 của tài liệu này** + `WALL_GEOMETRY_EDITOR_TEXT` | **T5** |
| `WallGeometryEditor.tsx` | View thuần (R-60) | T5 |
| `WallGeometryEditor.stories.tsx` | Bảy story (R-63) | T5 |
| `index.ts` | Cửa nhập ổn định | T5 |
| `wallGeometryEditorScenarios.ts` | Bảy kịch bản dựng sẵn (mục 6.3) | **T5** |
| `useWallGeometryEditor.ts` | Hook (R-61, R-64) | T6 |
| `WallGeometryEditor.container.tsx` | Container + `ScreenErrorBoundary` (R-62, R-73) | T6 |
| `wallGeometryEditorGateway.ts` | **Mục 5** — nơi DUY NHẤT chạm `commit`/`dispatch`/`previewEdit` (A10) | T6 |
| `WallGeometryEditor.test.tsx` | Bài kiểm (R-63, R-72) | T7 |
| `src/i18n/vi.json` | Khoá từ điển soát (R-67) — **danh sách ở mục 8** | T7 |

### `wallGeometryEditorTypes.ts` thuộc về **T5**. Lý do.

Bốn lý do, xếp theo sức nặng:

1. **T5 là phía không compile nổi nếu thiếu file này.** View là một hàm từ props
   ra markup; không có kiểu props thì T5 không có gì để bắt đầu. T6 thì có: hook
   viết được phần đọc dữ liệu và phần gọi lệnh trước, rồi mới ráp ra `state`.
   Đưa file cho T6 nghĩa là T5 ngồi chờ.
2. **Lệch kiểu báo về đúng phía sửa được.** Nếu T6 trả một hình dạng khác hợp
   đồng, `tsc` kêu ở **file của T6** (hàm hook không gán được vào
   `UseWallGeometryEditorResult`). Đó là phía biết vì sao mình lệch. Chiều ngược
   lại — T5 sở hữu hook-result — sẽ báo lỗi ở view, phía không có thẩm quyền sửa.
3. **File kiểu phải sạch tầng dữ liệu.** Nó là thứ view nhập. T5 là người duy
   nhất bị `local/no-data-layer-in-view` soi từng dòng, nên T5 là người ít có khả
   năng lỡ tay kéo `@/store` vào đó nhất.
4. **`index.ts` cũng là của T5, và `index.ts` xuất lại toàn bộ kiểu.** Cùng một
   chủ cho hai file luôn thay đổi cùng nhau thì không có xung đột hợp nhất trên
   danh sách export.

**Ràng buộc đi kèm, bắt buộc:** T6 **chỉ nhập** `wallGeometryEditorTypes.ts`,
không sửa. Cần một trường không có trong tài liệu này thì **dừng và hỏi điều phối
viên** (R-69) — tài liệu này là bản có thẩm quyền, không phải file kia.

### Nếu view vượt trần 400 dòng của R-22

Màn này chắc chắn vượt: một dải trên, một thanh sáu nút, một lớp phủ tay nắm,
một chuỗi kích thước, một bảng đỉnh, một chip, và bảy nhánh trạng thái. Đề xuất
sẵn bốn **file anh em trong cùng thư mục màn** (mục D của `CLAUDE.md` — *không*
thêm gì vào `src/components/`, đúng điều cấm "không tạo component mới"):

| File anh em | Nội dung | Chủ |
|---|---|---|
| `WallGeometryEditorBand.tsx` | Dải chế độ sửa cao 36 + nút "Xong" | T5 |
| `WallGeometryEditorToolbar.tsx` | Thanh viên thuốc bo 999, sáu nút + tooltip | T5 |
| `WallGeometryEditorOverlay.tsx` | Tay nắm, đường bắt điểm + nhãn, chuỗi kích thước sống, tô sáng cạnh | T5 |
| `WallGeometryVertexTable.tsx` | Bảng đỉnh, ô sửa tại chỗ | T5 |

Cả bốn chỉ đi ra ngoài qua `index.ts`; nơi gọi vẫn viết
`@/screens/viewer/WallGeometryEditor` và không phải biết màn gồm mấy file.

> **Một ghi chú, không phải một quyết định:** R-66 đòi màn mới đăng ký trong
> `src/routes.tsx`. Màn này là một **chế độ bên trong Viewer3D**, không phải một
> đường dẫn. Phân công ở trên (không đổi được) không giao `routes.tsx` cho ai.
> Nếu điều phối viên muốn R-66 được thoả, chỗ hợp lý nhất là T7 — người đã sở hữu
> `vi.json`, file kia cũng nằm ngoài thư mục màn.

---

## 2. Quyết định quan trọng nhất: view lấy props từ hook bằng cách nào

**Hook trả về ĐÚNG props của view, trừ một trường duy nhất container cấp.**

```tsx
// WallGeometryEditor.container.tsx — T6
<WallGeometryEditor {...useWallGeometryEditor(options)} overlayRef={setOverlayElement} />
```

Ba lựa chọn đã cân, và vì sao chọn cái này:

- *Hook trả các mảnh rồi container ghép* — bị loại. Container khi đó là chỗ thứ
  ba có logic, và nó là file **không** ai kiểm bằng story bảy trạng thái. Mảnh
  nào ghép sai thì không có bài kiểm nào bắt được.
- *Hook trả `{ model: WallGeometryEditorProps }`* — bị loại. Thêm một tầng bọc
  chỉ để phải viết `{...result.model}`, và hai màn anh em trong cùng thư mục
  không làm thế.
- *Hook trả thẳng props* — **chọn**. `UseWallGeometryEditorResult` được khai bằng
  `Omit<WallGeometryEditorProps, 'overlayRef'>`, nên nó **không thể trôi** khỏi
  props: T5 thêm một trường vào props thì hàm hook của T6 lập tức không gán được
  nữa, và `tsc` chỉ đúng vào dòng đó.

`overlayRef` là ngoại lệ duy nhất, và nó là ngoại lệ có tiền lệ: `Viewer3DProps.canvasRef`
(`viewer3dTypes.ts:44-66`) đứng ngoài phần hook cấp vì phần tử DOM chỉ tồn tại
**sau** khi view gắn. Ở đây cũng thế — hook cần hình chữ nhật của lớp phủ để đổi
toạ độ con trỏ sang toạ độ khung nhìn, và nó chỉ có sau lượt gắn đầu tiên.

---

## 3. (A) `WallGeometryEditorProps` — props của view thuần

Toàn bộ mục 3 là nội dung của `wallGeometryEditorTypes.ts`, theo đúng thứ tự
viết vào file.

### 3.0 Đầu file

```ts
/**
 * Hợp đồng kiểu của `WallGeometryEditor` — mọi thứ view, hook, gateway và bài
 * kiểm dùng chung, viết ra một lần ở đây.
 *
 * File `.ts` thuần: không JSX, không logic, không import `@/api`, `@/store`,
 * `@/domain` hay `@/lib/http` — cùng khuôn `propertyInspectorTypes.ts` và
 * `viewerShellTypes.ts` bên cạnh. Màn này không cần biết `Wall` của domain là
 * hình gì: mọi con số người dùng ĐỌC đã thành CHUỖI ở tầng viewmodel trước khi
 * tới đây (A15), và mọi con số người dùng KHÔNG đọc — toạ độ tay nắm — đã là
 * pixel khung nhìn do hook chiếu sẵn. View không chiếu, không quy đổi, không
 * tính giao điểm.
 *
 * Hai chỗ trong file này được khai để CHỊU ĐƯỢC THAY ĐỔI, xem
 * `notes/wall-geometry-editor/contract-screen.md` mục 7:
 * {@link WallGeometryEditorContent.comparisonChip} nhận `null` như một câu trả
 * lời hợp lệ, và {@link WallGeometrySnapModel.kinds} là một DANH SÁCH chứ không
 * phải bốn trường cứng.
 */

import type { MotionDurationName } from '@/lib/motion/tokens';
import type { ViewStatusCode } from '@/lib/viewmodel/types';
```

> Hai `import type` này an toàn với R-60: `local/no-data-layer-in-view` chỉ chặn
> `@/api`, `@/store`, `@/domain`, `@/lib/http`, và bỏ qua vị trí chỉ-kiểu
> (`eslint-rules/no-data-layer-in-view.js:31-35`). `@/lib/motion` và
> `@/lib/viewmodel` không nằm trong bốn tầng ấy.

### 3.1 Bố cục và chuyển động

```ts
/**
 * Số đo của màn, bằng pixel giao diện.
 *
 * Bố cục, không phải hằng số nghiệp vụ — cùng lý lẽ `VIEWER_LAYOUT`
 * (`viewerShellTypes.ts:59-66`): R-71 cấm chép lại mã lỗi, thời gian chờ, ngưỡng
 * số và thời lượng chuyển động; bề rộng một tay nắm không nằm trong danh sách
 * đó và không có nguồn nào khác trong repo để đọc ra.
 */
export const WALL_GEOMETRY_EDITOR_LAYOUT = Object.freeze({
  /** Dải chế độ sửa trên cùng canvas. */
  editBandHeightPx: 36,
  /** Bo góc thanh công cụ nổi — viên thuốc. */
  toolbarRadiusPx: 999,
  /** Tay nắm đỉnh: vòng tròn trắng, viền `--accent` (A1/A2 — token, không mã màu). */
  vertexHandlePx: 8,
  /** Cùng tay nắm ấy khi con trỏ trỏ vào. */
  vertexHandleHoverPx: 12,
  /** Bề dày viền tay nắm đỉnh. */
  vertexHandleStrokePx: 2,
  /** Tay nắm cạnh: ô vuông. */
  edgeHandlePx: 6,
  /** Đường bắt điểm: nét đứt mảnh. */
  snapGuideStrokePx: 1,
  /**
   * Bán kính bắt điểm của đặc tả.
   *
   * HOOK đọc con số này để hỏi cổng (mục 5, `findSnapCandidates`); VIEW không
   * bao giờ đọc nó, vì view không quyết định cái gì bắt vào cái gì.
   */
  snapRadiusPx: 8,
  /** Hai nửa hé ra chừng này khi tách tường, để người dùng THẤY vết cắt. */
  splitRevealGapPx: 2,
});

/** Bốn lúc màn này chuyển động. */
export type WallGeometryMotionSlot =
  | 'cancelDrag'
  | 'joinWalls'
  | 'splitReveal'
  | 'snapSettle';

/**
 * Ô nào của thang chuyển động cho việc nào — TÊN ô, không phải con số.
 *
 * Đặc tả đòi "nối hai tường trong 240ms". `MOTION_DURATIONS_MS`
 * (`lib/motion/tokens.ts:62-67`) không có 240 và R-71 cấm viết nó vào màn, nên
 * việc ấy chạy ở `standard` (260 ms) — ô dành cho "thứ có diện tích riêng của
 * nó". Huỷ kéo giữa chừng chạy ở `fast`, đúng 180 ms đặc tả đòi.
 */
export const WALL_GEOMETRY_MOTION: Readonly<Record<WallGeometryMotionSlot, MotionDurationName>> =
  Object.freeze({
    cancelDrag: 'fast',
    joinWalls: 'standard',
    splitReveal: 'fast',
    snapSettle: 'instant',
  });
```

### 3.2 Toạ độ

```ts
/**
 * Một điểm trong khung nhìn, bằng pixel.
 *
 * Đây là đơn vị DUY NHẤT view biết. Toạ độ mô hình (milimét) không đi qua props:
 * chiếu từ mô hình sang pixel là việc của cảnh 3D và của hook, còn view chỉ đặt
 * một vòng tròn vào chỗ được bảo. Đặt tên `xPx`/`yPx` chứ không `x`/`y` để một
 * chỗ gọi lỡ truyền milimét vào là lỗi biên dịch chứ không phải một tay nắm
 * lệch ba mét.
 */
export interface WallGeometryPointPx {
  readonly xPx: number;
  readonly yPx: number;
}
```

### 3.3 Dải chế độ sửa

```ts
/** Dải cao `editBandHeightPx` trên cùng canvas. */
export interface WallGeometryEditBand {
  /**
   * Đã ghép sẵn: "Đang sửa: #W-014". Mã tường viết hoa là ngoại lệ chữ hoa của
   * A6; phần còn lại viết thường kiểu câu.
   */
  readonly label: string;
  /** Nhãn nút thoát chế độ sửa. */
  readonly doneLabel: string;
  readonly onDone: () => void;
}
```

### 3.4 Thanh công cụ sửa

```ts
/** Sáu công cụ của thanh nổi, đúng thứ tự trái sang phải. */
export const WALL_GEOMETRY_TOOL_IDS = [
  'moveVertex',
  'addVertex',
  'removeVertex',
  'splitWall',
  'joinWalls',
  'resetHeight',
] as const;

export type WallGeometryToolId = (typeof WALL_GEOMETRY_TOOL_IDS)[number];

/**
 * Biểu tượng của một nút — mã đóng, không phải một chuỗi tự do.
 *
 * Khai riêng khỏi {@link WallGeometryToolId} (dù hôm nay sáu mã trùng tên sáu
 * công cụ) vì bảng biểu tượng của view khoá theo BIỂU TƯỢNG: hai công cụ dùng
 * chung một hình về sau sẽ không phải đổi kiểu của bảng. Cùng lý lẽ `ViewIconCode`
 * (`lib/viewmodel/types.ts:78`): bảng là một `Record` đầy đủ, nên thiếu một mã
 * là lỗi biên dịch chứ không phải một ô vuông trắng.
 */
export type WallGeometryToolIconCode =
  | 'moveVertex'
  | 'addVertex'
  | 'removeVertex'
  | 'splitWall'
  | 'joinWalls'
  | 'resetHeight';

/** Một nút trên thanh công cụ, đã đủ chữ để vẽ. */
export interface WallGeometryToolButton {
  readonly id: WallGeometryToolId;
  /** Nhãn tiếng Việt, viết thường kiểu câu (A6). */
  readonly label: string;
  readonly iconCode: WallGeometryToolIconCode;
  /** Phím tắt in trên gợi ý, ví dụ "V". Chữ hoa là ngoại lệ A6 cho tên phím. */
  readonly keyLabel: string;
  /** Gợi ý đầy đủ, nhãn và phím đã ghép — view không tự nối chuỗi. */
  readonly tooltip: string;
  /** Bấm được không. `false` là làm mờ, KHÁC với bị gỡ khỏi thanh — xem `toolbar.buttons`. */
  readonly isEnabled: boolean;
  /** Đang là công cụ hiện hành. */
  readonly isActive: boolean;
  readonly onSelect: () => void;
}

export interface WallGeometryToolbar {
  /**
   * Các nút hiện trên thanh.
   *
   * Ở trạng thái `forbidden` mảng này RỖNG: đặc tả nói công cụ sửa "bị gỡ khỏi
   * thanh", không phải làm mờ. Một nút mờ vẫn là một lời hứa; một thanh không có
   * nút là một câu trả lời.
   */
  readonly buttons: readonly WallGeometryToolButton[];
  /**
   * Câu gợi ý hiện THAY CHO các nút — trạng thái `empty` dùng nó, và chỉ nó.
   * `null` khi thanh đang có nút để hiện.
   */
  readonly hint: string | null;
}
```

### 3.5 Chuỗi kích thước sống

```ts
/** Một đoạn của chuỗi kích thước chạy dọc bức tường đang sửa. */
export interface WallGeometryDimensionSegment {
  readonly id: string;
  /**
   * Số đo ĐÃ định dạng ở viewmodel (A15) — "4.250,00 mm", dấu thập phân là dấu
   * phẩy. View không gọi `toFixed`, không nối đơn vị (`local/no-raw-number`).
   */
  readonly lengthLabel: string;
  /** Giữa đoạn, pixel khung nhìn — chỗ đặt chữ. */
  readonly midpointPx: WallGeometryPointPx;
  /**
   * Số của đoạn này đang đổi trong lượt kéo hiện tại — view cho nó chạy số.
   * Đoạn của các tường phụ thuộc cũng bật cờ này khi chiều dài chúng đổi theo.
   */
  readonly isLive: boolean;
}

export interface WallGeometryDimensionChain {
  readonly segments: readonly WallGeometryDimensionSegment[];
  /** Tổng chiều dài đã định dạng; `null` khi chuỗi rỗng. */
  readonly totalLabel: string | null;
}
```

### 3.6 Bảng đỉnh

```ts
/** Trạng thái sửa của MỘT ô toạ độ. */
export type WallGeometryCellStatus = 'idle' | 'editing' | 'invalid';

/**
 * Một ô toạ độ sửa được ngay trong bảng.
 *
 * Hai chuỗi chứ không một: `displayValue` là số đã định dạng để ĐỌC (A15),
 * `draftValue` là đúng những ký tự người dùng đang gõ. Gộp làm một thì hoặc là
 * view phải tự bỏ dấu phân nhóm khi vào chế độ gõ — một phép quy đổi trong view,
 * đúng thứ `local/no-raw-number` chặn — hoặc là người dùng gõ "1.2" và thấy nó
 * bị định dạng lại giữa chừng.
 */
export interface WallGeometryVertexCell {
  readonly displayValue: string;
  readonly draftValue: string;
  readonly status: WallGeometryCellStatus;
  /**
   * Câu giải thích khi `status === 'invalid'`; `null` ở hai trạng thái kia.
   * Hình học không hợp lệ KHÔNG BAO GIỜ bị từ chối im lặng — đây là chỗ câu ấy
   * hiện ra tại đúng ô gây lỗi.
   */
  readonly message: string | null;
  readonly onDraftChange: (nextValue: string) => void;
  /** Enter, hoặc rời ô. */
  readonly onCommit: () => void;
  /** Esc trong ô — trả về `displayValue`, không đụng tới hình học. */
  readonly onCancel: () => void;
}

/** Một hàng của bảng đỉnh. */
export interface WallGeometryVertexRow {
  readonly id: string;
  /** Mã đỉnh, chữ đều — "V-03". Chữ hoa là ngoại lệ A6 cho mã. */
  readonly code: string;
  readonly x: WallGeometryVertexCell;
  readonly y: WallGeometryVertexCell;
  readonly isSelected: boolean;
  /** Chỉ đọc — vai chỉ xem, hoặc đỉnh thuộc tường khác trong lượt chọn nhiều. */
  readonly isLocked: boolean;
  readonly onSelect: () => void;
}

/** Nhãn ba cột. Ở đây chứ không viết thẳng trong JSX vì bài kiểm của T7 đối chiếu chúng. */
export interface WallGeometryVertexTableColumns {
  readonly code: string;
  readonly x: string;
  readonly y: string;
}

export interface WallGeometryVertexTable {
  readonly columns: WallGeometryVertexTableColumns;
  /**
   * Số hàng là DỮ LIỆU, không phải hai.
   *
   * Hôm nay một `Wall` của domain là một `Segment` hai đầu mút
   * (`domain/spatial/types.ts:123-132`); đặc tả màn thì nói tới thêm và xoá đỉnh.
   * Một mảng đúng ở cả hai thế giới, hai trường `start`/`end` thì không.
   */
  readonly rows: readonly WallGeometryVertexRow[];
  /** Câu hiện khi `rows` rỗng; `null` khi có hàng. */
  readonly emptyMessage: string | null;
}
```

### 3.7 Tay nắm, bắt điểm, tô sáng

```ts
export type WallGeometryHandleKind = 'vertex' | 'edge';

/** Bốn hướng của đường bàn phím (A12 — bàn phím là đường đi hạng nhất). */
export type WallGeometryNudgeDirection = 'left' | 'right' | 'up' | 'down';

/** Một tay nắm trên lớp phủ: vòng tròn của một đỉnh, hoặc ô vuông của một cạnh. */
export interface WallGeometryHandle {
  readonly id: string;
  readonly kind: WallGeometryHandleKind;
  readonly atPx: WallGeometryPointPx;
  readonly isHovered: boolean;
  readonly isDragging: boolean;
  readonly isEnabled: boolean;
  /** Tiếng Việt, cho `aria-label` — `expectVietnamese` soát cả nhãn trợ năng (R-72). */
  readonly ariaLabel: string;
  readonly onPointerDown: (atPx: WallGeometryPointPx) => void;
  readonly onPointerEnter: () => void;
  readonly onPointerLeave: () => void;
  /**
   * Đường bàn phím của A12: mũi tên dời tay nắm.
   *
   * `isCoarse` là "người dùng đang giữ Shift"; BƯỚC DỜI bao nhiêu milimét là
   * việc của hook, không phải của view — R-71 cấm màn tự đặt ngưỡng số.
   */
  readonly onNudge: (direction: WallGeometryNudgeDirection, isCoarse: boolean) => void;
}

/**
 * Mã một loại bắt điểm.
 *
 * `string`, KHÔNG phải một union bốn nhánh — đây là chỗ để mở #2 (mục 7). Số
 * loại có thể là 4 hoặc 3, và view không bao giờ rẽ nhánh theo mã này: nó chỉ
 * vẽ `label`.
 */
export type SnapKindId = string;

/**
 * Những mã đang tồn tại, để hook và bài kiểm gọi tên chúng mà không gõ chuỗi.
 *
 * Không phải một union kiểu, mà là DỮ LIỆU. Xoá `aiTrace` khỏi bảng này là một
 * dòng, và không một trường nào ở mục 3 hay mục 4 phải đổi theo.
 */
export const KNOWN_SNAP_KIND_IDS = {
  axis: 'axis',
  otherVertex: 'otherVertex',
  perpendicular: 'perpendicular',
  aiTrace: 'aiTrace',
} as const;

/** Một loại bắt điểm, như nó hiện ra trên màn. */
export interface WallGeometrySnapKind {
  readonly id: SnapKindId;
  /**
   * Tên loại bắt điểm, HIỆN TRÊN MÀN — "vuông góc", "đỉnh khác", "trục B".
   * Điều cấm tuyệt đối: mỗi loại phải được GỌI TÊN, không chỉ cảm nhận được.
   */
  readonly label: string;
  readonly isEnabled: boolean;
  /** Tắt/bật riêng loại này; `null` khi loại này không tắt riêng được. */
  readonly onToggle: (() => void) | null;
}

/** Một đường bắt điểm đang hiện: nét đứt 1px `--accent` kèm nhãn chữ đều. */
export interface WallGeometrySnapGuide {
  readonly id: string;
  readonly kindId: SnapKindId;
  /** Nhãn gọi tên loại bắt điểm này, đặt cạnh đường. */
  readonly label: string;
  readonly fromPx: WallGeometryPointPx;
  readonly toPx: WallGeometryPointPx;
  readonly labelAtPx: WallGeometryPointPx;
}

export interface WallGeometrySnapModel {
  /**
   * BA hoặc BỐN phần tử — chỗ để mở #2. Danh sách, không phải bốn trường cứng.
   * View lặp qua nó; nó không hỏi "có `aiTrace` không".
   */
  readonly kinds: readonly WallGeometrySnapKind[];
  /** Đường đang hiện lúc này; rỗng khi không bắt vào gì. */
  readonly activeGuides: readonly WallGeometrySnapGuide[];
  /** Người dùng đang giữ Alt — bắt điểm tắt tạm. */
  readonly isSuppressed: boolean;
  /** Người dùng đang giữ Shift — khoá trục. */
  readonly isAxisLocked: boolean;
  /** Câu nói ra hai trạng thái trên cho trình đọc màn hình; `null` khi không giữ phím nào. */
  readonly modifierNotice: string | null;
}

/**
 * Sắc thái của một dấu hiệu trên màn này.
 *
 * `Exclude<…, 'verified'>` chứ không phải chép lại ba chuỗi: A5 nói xanh "đã xác
 * minh" CHỈ đánh dấu việc người duyệt, và trên màn này không có việc duyệt nào.
 * Loại nó ở tầng kiểu nghĩa là đầu ra của bộ so hình học không có đường nào bật
 * được cờ xanh, kể cả khi ai đó muốn.
 */
export type WallGeometryTone = Exclude<ViewStatusCode, 'verified'>;

/** Lớp tô sáng cạnh gây lỗi. */
export interface WallGeometryEdgeHighlight {
  readonly edgeId: string;
  readonly fromPx: WallGeometryPointPx;
  readonly toPx: WallGeometryPointPx;
  readonly tone: WallGeometryTone;
  /** Tiếng Việt, cho trình đọc màn hình — cạnh tô sáng không được chỉ nói bằng màu (A2). */
  readonly ariaLabel: string;
}

/**
 * Chip đối chiếu ở góc: "Lệch so với bản vẽ gốc: 12 mm".
 *
 * Chỗ để mở #1 nằm ở NƠI GỌI kiểu này, không ở đây — xem
 * {@link WallGeometryEditorContent.comparisonChip}.
 */
export interface WallGeometryComparisonChip {
  /** Câu đã ghép và đã định dạng (A15). */
  readonly label: string;
  /** Chuyển sang `attention` khi vượt ngưỡng; ngưỡng là việc của hook (R-71). */
  readonly tone: WallGeometryTone;
}
```

### 3.8 Phiên kéo

```ts
/**
 * Một phiên kéo đang diễn ra. `null` khi tay đang rời.
 *
 * Ba callback nằm ở ĐÂY chứ không ở tay nắm, và đó là điều cấm tuyệt đối "một
 * phiên kéo chỉ sinh MỘT bước hoàn tác" được viết thành kiểu: con trỏ rời khỏi
 * tay nắm ngay khi bắt đầu kéo, nên `pointermove` phải gắn vào cả lớp phủ. Một
 * phiên kéo có đúng một `onPointerUp` và đúng một `onCancel`, nên không có cách
 * nào để hai lượt ghi cùng chạy ra từ một lần kéo.
 */
export interface WallGeometryDragSession {
  readonly handleId: string;
  readonly onPointerMove: (atPx: WallGeometryPointPx) => void;
  readonly onPointerUp: (atPx: WallGeometryPointPx) => void;
  /** Esc giữa lúc kéo. Sau lời gọi này `drag` thành `null` và `returningHandleId` bật lên. */
  readonly onCancel: () => void;
}
```

### 3.9 Nội dung chung và props

```ts
/**
 * Thứ bốn trạng thái `partial` / `error` / `success` / `forbidden` cùng có —
 * bốn trạng thái duy nhất có một bức tường đang mở ra để sửa.
 */
export interface WallGeometryEditorContent {
  readonly band: WallGeometryEditBand;
  readonly toolbar: WallGeometryToolbar;
  readonly dimensionChain: WallGeometryDimensionChain;
  readonly vertexTable: WallGeometryVertexTable;
  /**
   * Chip đối chiếu, hoặc `null` khi KHÔNG CÓ vết vẽ gốc để so.
   *
   * Chỗ để mở #1 (mục 7). `| null` bắt buộc chứ không phải `?:` tuỳ chọn: một
   * trường tuỳ chọn để người ta quên truyền, còn một trường `| null` bắt T5 vẽ
   * nhánh vắng mặt và bắt T6 nói ra rằng mình không có gì để so. Vắng mặt là
   * MỘT CÂU TRẢ LỜI, không phải một chỗ trống phải lấp bằng dữ liệu bịa.
   */
  readonly comparisonChip: WallGeometryComparisonChip | null;
  readonly handles: readonly WallGeometryHandle[];
  readonly snap: WallGeometrySnapModel;
  /** Rỗng khi không cạnh nào bị tô sáng. */
  readonly edgeHighlights: readonly WallGeometryEdgeHighlight[];
  readonly drag: WallGeometryDragSession | null;
  /**
   * Tay nắm vừa bị huỷ kéo, để view cho nó về chỗ cũ bằng
   * `WALL_GEOMETRY_MOTION.cancelDrag`; `null` khi không có.
   *
   * Cùng khuôn `PropertyInspectorProps.recentlyCommittedRowId`
   * (`propertyInspectorTypes.ts:483`): tín hiệu do hook sinh, hiệu ứng do view
   * chạy, và THỜI LƯỢNG không đi kèm — nó đã ở `WALL_GEOMETRY_MOTION`, và một
   * con số thứ hai chạy dọc props chỉ là một chỗ nữa để hai bên trôi khỏi nhau.
   */
  readonly returningHandleId: string | null;
}

/**
 * Toàn bộ props của `WallGeometryEditor.tsx`.
 *
 * Đúng HAI trường. Mọi dữ liệu và callback của cả bảy trạng thái đã nằm trong
 * chính `state`; view đọc `state.kind` rồi vẽ đúng nhánh.
 */
export interface WallGeometryEditorProps {
  readonly state: WallGeometryEditorState;
  /**
   * Callback ref nhận lớp phủ sau khi view gắn, để CONTAINER đưa nó vào hook.
   *
   * Hook không cấp trường này — phần tử DOM chỉ tồn tại sau lượt gắn đầu tiên,
   * nên nó không nằm trong {@link UseWallGeometryEditorResult}. Cùng cách
   * `Viewer3DProps.canvasRef` (`viewer3dTypes.ts:44-66`).
   */
  readonly overlayRef?: ((element: HTMLDivElement | null) => void) | undefined;
}
```

### 3.10 Chuỗi tiếng Việt dùng chung

Đây là chỗ lệch có chủ đích #2 của mục 0 thành mã. Bảng này là **nguồn duy nhất**
của mọi chuỗi màn hiện ra; mục 8 liệt kê đúng những chuỗi này dưới dạng khoá
`vi.json` cho `expectVietnamese` soát (R-67). T5 dựng story từ nó, T6 dựng
`state` từ nó, và không ai phải nhập file của ai.

```ts
/**
 * Mọi chuỗi màn này hiện ra, viết một lần.
 *
 * Trong `wallGeometryEditorTypes.ts` chứ không trong hook: story và kịch bản là
 * của T5, hook là của T6, hai người ở hai worktree. `PropertyInspector` để
 * `PROPERTY_INSPECTOR_TEXT` trong hook và `propertyInspectorScenarios.ts` nhập
 * ngược lên hook để lấy chữ — ở đây làm thế là T5 không dựng nổi story cho tới
 * khi T6 đẩy mã lên.
 *
 * Chỗ nào có chỗ trống thì là HÀM, không phải chuỗi có `{{…}}`: `vi.json` không
 * phải bảng dịch lúc chạy, nên không có bộ nội suy nào để chạy các dấu ngoặc ấy.
 */
export const WALL_GEOMETRY_EDITOR_TEXT = Object.freeze({
  regionLabel: 'Sửa hình học tường',

  band: {
    editing: (wallCode: string): string => `Đang sửa: ${wallCode}`,
    done: 'Xong',
  },

  /** Nhãn và phím tắt của sáu công cụ, khoá theo `WallGeometryToolId`. */
  tools: {
    moveVertex: { label: 'Di chuyển đỉnh', key: 'V' },
    addVertex: { label: 'Thêm đỉnh', key: 'A' },
    removeVertex: { label: 'Xoá đỉnh', key: 'X' },
    splitWall: { label: 'Tách tường', key: 'T' },
    joinWalls: { label: 'Nối tường', key: 'N' },
    resetHeight: { label: 'Đặt lại chiều cao', key: 'H' },
    tooltip: (label: string, key: string): string => `${label} · phím ${key}`,
  },

  dimensionChain: {
    regionLabel: 'Chuỗi kích thước của tường đang sửa',
    total: (length: string): string => `Tổng chiều dài: ${length}`,
  },

  vertexTable: {
    title: 'Bảng đỉnh',
    columnCode: 'Đỉnh',
    columnX: 'Toạ độ x',
    columnY: 'Toạ độ y',
    empty: 'Chưa có đỉnh nào để sửa.',
    cellInvalid: 'Giá trị chưa hợp lệ nên toạ độ đã trở về số cũ.',
  },

  comparison: {
    deviation: (deviation: string): string => `Lệch so với bản vẽ gốc: ${deviation}`,
  },

  /**
   * Nhãn của các loại bắt điểm — CHỖ ĐỂ MỞ #2.
   *
   * `aiTrace` có mặt ở đây không có nghĩa là loại thứ tư tồn tại: hook chỉ đưa
   * nhãn nào nó thật sự dựng được vào `WallGeometrySnapModel.kinds`. Bốn khoá
   * này là một TỪ ĐIỂN, không phải một danh sách bắt buộc phải dùng hết.
   */
  snap: {
    axis: (axisCode: string): string => `Trục ${axisCode}`,
    otherVertex: 'Đỉnh khác',
    perpendicular: 'Vuông góc',
    aiTrace: 'Vết vẽ gốc',
    axisLocked: 'Đang khoá trục theo phím Shift',
    suppressed: 'Đang tắt bắt điểm theo phím Alt',
  },

  handles: {
    vertex: (vertexCode: string): string => `Đỉnh ${vertexCode}`,
    edge: (edgeCode: string): string => `Cạnh ${edgeCode}`,
    nudgeHint: 'Dùng phím mũi tên để dời đỉnh, giữ Shift để dời bước lớn.',
    offendingEdge: (edgeCode: string): string => `Cạnh ${edgeCode} đang gây lỗi hình học`,
  },

  states: {
    empty: {
      message: 'Chưa chọn tường nào để sửa.',
      hint: 'Chọn một bức tường trong khung nhìn, hoặc nhấn Tab để duyệt qua các tường.',
    },
    loading: { message: 'Đang tính lại hình học…' },
    partial: {
      heightOnly: 'Đang chọn nhiều tường nên chỉ đổi được chiều cao.',
      gapSize: (gap: string): string => `Khe hở: ${gap}`,
      closeGap: 'Đóng khe hở',
    },
    error: {
      selfIntersecting:
        'Đa giác tự cắt nên hình mới bị từ chối. Toạ độ đã trở về giá trị trước đó.',
      dismiss: 'Đã hiểu',
    },
    forbidden: {
      viewerRole: 'Bạn không có quyền sửa hình học nên các công cụ sửa đã được gỡ khỏi thanh.',
      sectionOrthographic:
        'Đang ở chế độ trực giao lát cắt nên hình học chưa sửa được. Thoát lát cắt rồi thử lại.',
    },
    collapsed: {
      summary: (wallCode: string): string => `Tường ${wallCode}`,
      notice: 'Trên màn hình nhỏ, hình học chỉ xem được chứ không sửa được.',
      exit: 'Thoát chế độ sửa',
    },
  },

  /** Câu nói ra khi một lượt ghi bị từ chối — không bao giờ từ chối im lặng. */
  refusal: {
    vertexFloor: 'Một bức tường cần ít nhất hai đỉnh nên đỉnh này chưa xoá được.',
    joinNeedsTwoEnds: 'Nối tường cần đúng hai đầu mút đang chọn.',
    splitOffWall: 'Điểm tách nằm ngoài bức tường nên chưa tách được.',
    heightBelowOpening:
      'Chiều cao mới thấp hơn đỉnh một ô mở trên tường này nên chưa đặt được.',
    noSaveTarget:
      'Chưa mở dự án và tầng nào nên chưa có nơi để lưu. Bản vẽ của bạn không có lỗi nào ở đây.',
    serverRejected: (kind: string): string =>
      `Máy chủ chưa nhận được hình học mới (${kind}). Thay đổi vẫn còn trên máy này.`,
  },

  /** Phần mô tả việc vừa làm của toast hoàn tác (A8). Nhãn nút lấy từ `common.undo`. */
  undo: {
    vertexMoved: (vertexCode: string): string => `Đã dời đỉnh ${vertexCode}`,
    vertexAdded: 'Đã thêm một đỉnh',
    vertexRemoved: 'Đã xoá một đỉnh',
    wallSplit: (wallCode: string): string => `Đã tách tường ${wallCode}`,
    wallsJoined: 'Đã nối hai tường',
    heightChanged: 'Đã đổi chiều cao tường',
    gapClosed: 'Đã đóng khe hở',
  },
});
```

**Kiểm lại phủ sóng của (A) so với đặc tả bố cục:** dải chế độ sửa (3.3) ·
sáu nút với id, nhãn, biểu tượng, phím tắt, bật/tắt (3.4) · chuỗi kích thước
sống (3.5) · bảng đỉnh với mã đỉnh, x, y đã định dạng và trạng thái sửa của ô
(3.6) · chip đối chiếu (3.7) · tay nắm đỉnh và tay nắm cạnh (3.7) · đường bắt
điểm kèm nhãn của nó (3.7) · lớp tô sáng cạnh gây lỗi (3.7) · bảy trạng thái
(mục 6).

---

## 4. (B) `UseWallGeometryEditorResult` — kiểu trả về của hook

Vẫn là nội dung của `wallGeometryEditorTypes.ts`, phần cuối file.

```ts
/**
 * Đúng những gì `useWallGeometryEditor` trả về.
 *
 * Bằng props của view TRỪ `overlayRef` (xem lý do ở
 * {@link WallGeometryEditorProps.overlayRef}), nên
 * `<WallGeometryEditor {...useWallGeometryEditor(options)} overlayRef={ref} />`
 * là một dòng đúng kiểu, không dư trường nào và không thiếu trường nào.
 *
 * Khai bằng `Omit` chứ không gõ lại `{ state: … }`: T5 thêm một trường vào props
 * thì hàm của T6 lập tức không gán được nữa, và `tsc` chỉ đúng vào dòng ấy. Đó
 * là toàn bộ lý do mối nối này tồn tại.
 */
export type UseWallGeometryEditorResult = Omit<WallGeometryEditorProps, 'overlayRef'>;

/** Tuỳ chọn container truyền vào `useWallGeometryEditor`. */
export interface UseWallGeometryEditorOptions {
  /** Bức tường đang sửa. `null` khi chưa chọn gì — hook trả `kind: 'empty'`. */
  readonly wallId: string | null;
  /**
   * Mọi tường đang chọn. Nhiều hơn một phần tử ⇒ hook trả `kind: 'partial'` với
   * `isHeightOnly: true`.
   */
  readonly selectedWallIds: readonly string[];
  /** Vai hiện tại có sửa được không — `false` buộc hook trả `kind: 'forbidden'`. */
  readonly canEdit: boolean;
  /**
   * Camera đang ở phép chiếu trực giao của lát cắt.
   *
   * Điều cấm tuyệt đối: "không cho sửa khi đang ở chế độ trực giao lát cắt".
   * `true` ⇒ hook trả `kind: 'forbidden'` với câu giải thích riêng của tình
   * huống này, không phải câu của vai chỉ xem.
   */
  readonly isSectionOrthographic: boolean;
  /** Khung nhìn đang thu gọn (di động) ⇒ hook trả `kind: 'collapsed'`. */
  readonly isCollapsed: boolean;
  /** Lớp phủ, để đổi toạ độ con trỏ sang toạ độ khung nhìn. `null` trước lượt gắn đầu. */
  readonly overlayElement: HTMLElement | null;
  /** Người dùng bấm "Xong", hoặc Esc ở lớp ngoài cùng (A12) — thoát chế độ sửa. */
  readonly onExitEditMode: () => void;
  /**
   * Hình học vừa đổi thật. Nơi gọi (Viewer3D, mặt bằng 2D) dựng lại theo.
   *
   * Hook KHÔNG tự gọi vào Viewer3D: `Viewer3D` là màn đã xong, nằm trong danh
   * sách cấm sửa. Đây là sợi dây để nó cắm vào sau, không phải một lời gọi
   * ngược.
   */
  readonly onGeometryChanged: (wallId: string) => void;
}

/**
 * Props của `WallGeometryEditorContainer` — thứ MỘT MÀN KHÁC truyền vào để mở
 * màn này mà không phải viết thêm một dòng logic nào (R-73).
 *
 * Đặc tả nói "giữ nguyên khung Viewer3D", nhưng `Viewer3D` là màn đã xong và
 * bị cấm sửa. Nên danh sách này được chọn theo đúng câu hỏi: *Viewer3D cần biết
 * những gì để gắn thẻ này vào, và không cần biết gì thêm?* Câu trả lời là bốn
 * thứ nó đã cầm sẵn — tường đang chọn, lượt chọn hiện tại, camera có đang ở lát
 * cắt trực giao không, và làm gì khi người dùng bấm "Xong".
 *
 * KHÔNG có `canEdit`: container tự đọc vai người xem, đúng khuôn
 * `PropertyInspectorContainerProps` (`propertyInspectorTypes.ts:539-545`). Màn
 * gọi nó không cần biết chuyện phân quyền.
 */
export interface WallGeometryEditorContainerProps {
  readonly wallId: string | null;
  readonly selectedWallIds: readonly string[];
  readonly onExitEditMode: () => void;
  readonly onGeometryChanged?: ((wallId: string) => void) | undefined;
  readonly isSectionOrthographic?: boolean | undefined;
  readonly isCollapsed?: boolean | undefined;

  /** Chỗ tiêm của story và bài kiểm — R-73 đòi bản giả cắm được vào. */
  readonly forceState?: WallGeometryEditorStateKind | undefined;
}
```

> **`gateway` KHÔNG có trong hai kiểu trên, và đó là chủ ý.** File kiểu là của
> T5; cổng là của T6. Một trường `gateway` ở đây bắt file của T5 nhập file của
> T6 và dựng một vòng nhập giữa hai worktree — đúng thứ `pnpm cycles` chặn.
> Repo cũng làm y như vậy: `viewerShellTypes.ts` không nhắc tới
> `ViewerShellGateway` một lần nào, và `Viewer3DContainerProps` — kiểu duy nhất
> có trường `gateway` — nằm trong `Viewer3D.container.tsx:151`, không nằm trong
> `viewer3dTypes.ts`. Chỗ tiêm cổng được khai ở mục 5.5, bằng một interface
> giao vào hai kiểu này.

### 4.1 Mọi hàm xử lý sự kiện view cần, và chúng nằm ở đâu

Không có một "bảng callback" phẳng: mỗi callback sống cạnh thứ nó thao tác, nên
một trạng thái không có thứ đó thì cũng không có callback của nó để gọi nhầm.

| Việc người dùng làm | Ở đâu trong (A) |
|---|---|
| Bắt đầu kéo một tay nắm | `content.handles[].onPointerDown` |
| Đang kéo | `content.drag.onPointerMove` |
| Thả tay | `content.drag.onPointerUp` |
| Esc giữa lúc kéo | `content.drag.onCancel` |
| Trỏ vào / rời khỏi một tay nắm | `content.handles[].onPointerEnter` / `.onPointerLeave` |
| Dời tay nắm bằng bàn phím (A12) | `content.handles[].onNudge` |
| Gõ vào một ô toạ độ | `vertexTable.rows[].x.onDraftChange` / `.y.onDraftChange` |
| Xác nhận ô toạ độ | `…onCommit` |
| Bỏ ô toạ độ | `…onCancel` |
| Chọn một hàng đỉnh | `vertexTable.rows[].onSelect` |
| Bấm một trong sáu nút công cụ | `toolbar.buttons[].onSelect` |
| Bật/tắt một loại bắt điểm | `snap.kinds[].onToggle` |
| Bấm "Xong" | `band.onDone` |
| Bấm "Đóng khe hở" | `state.gap.onCloseGap` (chỉ nhánh `partial`) |
| Bỏ thông báo lỗi | `state.onDismissError` (chỉ nhánh `error`) |
| Thoát chế độ xem-thu-gọn | `state.onExit` (chỉ nhánh `collapsed`) |

### 4.2 Mọi trạng thái view cần đọc

`state.kind` · `band.label` · `toolbar.buttons[].isEnabled` / `.isActive` ·
`toolbar.hint` · `dimensionChain.segments[].isLive` · `vertexTable.rows[].x.status`
/ `.isSelected` / `.isLocked` · `comparisonChip` (có hay `null`) và `.tone` ·
`handles[].isHovered` / `.isDragging` / `.isEnabled` · `snap.kinds[].isEnabled` ·
`snap.activeGuides` · `snap.isSuppressed` / `.isAxisLocked` · `snap.modifierNotice` ·
`edgeHighlights` · `drag` (có hay `null`) · `returningHandleId`. Ngoài danh sách
này view không đọc gì khác, và không giữ `useState` nào của riêng nó ngoài trạng
thái thuần trình bày (ví dụ ô nào đang có focus).

### 4.3 Ba việc hook phải làm mà (A) và (C) đã dựng sẵn chỗ

- **R-64 — cờ tải và cờ hỏng đến từ `src/lib/query`, không phải `useState` tự
  viết.** Nguồn là `gateway.readWallGeometry` (mục 5), đúng cách
  `PropertyInspectorGateway.readSpatialLayer` được dùng
  (`propertyInspectorGateway.ts:698-707`). `hooks/useShareLinks.ts` tự viết
  `isLoading`/`error` bằng tay; đó là ngoại lệ đi trước, **không phải khuôn để
  chép** (`CLAUDE.md`, mục "Trạng thái hiện tại").
- **Kéo liên tục KHÔNG hiện toast; chỉ thao tác rời rạc mới hiện.** Chỗ phân biệt
  nằm ở mục 5: `previewVertexMove` không sinh toast nào vì nó không sinh bước
  hoàn tác nào, còn bảy phương thức `Promise` kia mỗi cái là một thao tác rời
  rạc và đi kèm một toast hoàn tác (A8). View không dựng toast — nó không có
  trường nào để làm việc đó.
- **Esc phân lớp (A12).** Đang kéo ⇒ `drag.onCancel`. Đang gõ một ô ⇒ `cell.onCancel`.
  Không có lớp nào bên trên ⇒ `onExitEditMode`. Thứ tự này là việc của hook; view
  chỉ có ba callback rời và không tự quyết cái nào chạy trước.

---

## 5. (C) `WallGeometryEditorGateway` — cổng ra tầng dữ liệu và tầng lệnh

Nội dung của `wallGeometryEditorGateway.ts`, do **T6** viết. Đây là nơi **duy
nhất** được chạm `commit` / `dispatch` / `previewEdit` (A10, `local/no-direct-set`).

> **Ngôn ngữ ở đây là ngôn ngữ NGHIỆP VỤ của màn, không phải tên hàm của
> `src/lib`.** Hợp đồng của `src/lib/commands` và `src/domain` đang được hai
> worker khác khảo sát song song, và tôi không có nó. Mọi chữ ký dưới đây nói
> "kéo một đỉnh xong", "tách tường tại một điểm" — nên phần ruột thay đổi được
> mà không đụng tới (A) hay (B). Ba tên tôi có dẫn — `previewEdit`,
> `discardPreview`, `commit` — là ba tên tôi **đã tự mở `src/store/commit.ts`
> đọc** (dòng 98, 179, 201); ngoài ba cái đó tài liệu này không nêu tên hàm nào
> của `src/lib` hay `src/domain`.

### 5.1 Đơn vị và kết quả

```ts
import type { SnapKindId } from './wallGeometryEditorTypes';

/**
 * Một điểm trên mặt bằng, milimét — đơn vị của MÔ HÌNH, không phải của màn hình.
 *
 * Khai ở đây thay vì nhập `Point` của `@/domain/spatial/types` (đã kiểm: nó là
 * `{ x: Millimetres; y: Millimetres }`, `types.ts:25-28`) vì cổng này là chỗ
 * DUY NHẤT được phép biết hình dạng thật của domain, và phần ruột của nó phải
 * đổi được. Tên trường có hậu tố `Mm` để một chỗ gọi lỡ truyền pixel là lỗi
 * biên dịch chứ không phải một bức tường sai tỉ lệ.
 */
export interface WallGeometryPointMm {
  readonly xMm: number;
  readonly yMm: number;
}

/**
 * Vì sao một lượt ghi bị từ chối.
 *
 * Điều cấm tuyệt đối: "hình học không hợp lệ phải được GIẢI THÍCH, không bao
 * giờ bị từ chối im lặng". `explanation` vì thế bắt buộc và không rỗng, còn
 * `offendingEdgeIds` là những cạnh view tô sáng — số nhiều vì một đa giác tự
 * cắt thì có ÍT NHẤT HAI cạnh dính líu, và chỉ tô một cạnh là kể nửa câu
 * chuyện. Rỗng khi lời từ chối không chỉ vào cạnh nào (ví dụ chưa mở dự án).
 */
export interface WallGeometryRefusal {
  readonly explanation: string;
  readonly offendingEdgeIds: readonly string[];
}

/** Kết quả một việc cổng làm. Cùng khuôn `PropertyInspectorCapabilityResult`. */
export type WallGeometryEditorResult<TValue> =
  | { readonly ok: true; readonly data: TValue }
  | { readonly ok: false; readonly refusal: WallGeometryRefusal };
```

### 5.2 Hình học đọc ra

```ts
/** Một đỉnh, như tầng dưới đưa lên. */
export interface WallGeometryVertexSnapshot {
  readonly id: string;
  readonly atMm: WallGeometryPointMm;
}

/**
 * Hình học của bức tường đang sửa.
 *
 * `vertices` là MẢNG, không phải `start`/`end`: xem 3.6. `gapMm` khác `null` là
 * nguồn của nhánh `partial` "vòng hở".
 */
export interface WallGeometrySnapshot {
  readonly wallId: string;
  readonly vertices: readonly WallGeometryVertexSnapshot[];
  readonly heightMm: number;
  /** Khe hở của vòng, milimét; `null` khi vòng khép kín. */
  readonly gapMm: number | null;
}

/**
 * Vết vẽ gốc của AI — chỗ để mở #1, mục 7.
 *
 * Kiểu này TỒN TẠI ngay cả khi tầng dưới chưa có đường tới nó; thứ để mở là
 * việc `readOriginalTrace` được phép trả `null`, và `supports.readOriginalTrace`
 * được phép là `false`.
 */
export interface WallGeometryOriginalTrace {
  readonly wallId: string;
  readonly vertices: readonly WallGeometryVertexSnapshot[];
  /** Lệch lớn nhất giữa hình hiện tại và vết gốc, milimét — nguồn của chip đối chiếu. */
  readonly maxDeviationMm: number;
}
```

### 5.3 Bắt điểm

```ts
/** Một câu hỏi bắt điểm, hỏi lúc con trỏ đang ở đâu đó. */
export interface WallGeometrySnapQuery {
  readonly wallId: string;
  readonly vertexId: string;
  readonly atMm: WallGeometryPointMm;
  /**
   * Bán kính bắt điểm tính bằng PIXEL màn hình — đặc tả nói "trong 8px", và 8px
   * ở xa hay ở gần là hai khoảng cách thật khác nhau.
   * `WALL_GEOMETRY_EDITOR_LAYOUT.snapRadiusPx` là chỗ con số ấy sống.
   */
  readonly radiusPx: number;
  /**
   * Tỉ lệ hiện tại, để CỔNG đổi bán kính pixel sang milimét. Phép đổi nằm sau
   * cổng chứ không trong hook: R-61 cấm màn tự viết quy đổi đơn vị.
   */
  readonly millimetresPerPixel: number;
}

/**
 * Một chỗ bắt được.
 *
 * `kindId` là `SnapKindId` của mục 3.7 — `string`, không phải union bốn nhánh.
 * Cổng trả về BAO NHIÊU loại là việc của cổng; hook chỉ xếp chúng thành
 * `WallGeometrySnapModel.kinds`.
 */
export interface WallGeometrySnapCandidate {
  readonly kindId: SnapKindId;
  /** Tên loại này, tiếng Việt, để hiện lên màn. */
  readonly label: string;
  /** Chỗ tay nắm sẽ lắng xuống. */
  readonly atMm: WallGeometryPointMm;
  /** Đầu kia của đường dẫn nét đứt — mỗi loại bắt điểm có ĐƯỜNG DẪN RIÊNG. */
  readonly fromMm: WallGeometryPointMm;
}
```

### 5.4 Đầu vào của bảy việc nghiệp vụ

```ts
/** Kéo một đỉnh tới một chỗ. Dùng cho cả lượt xem trước lẫn lượt ghi thật. */
export interface WallGeometryMoveVertexInput {
  readonly wallId: string;
  readonly vertexId: string;
  readonly toMm: WallGeometryPointMm;
}

/** Thêm một đỉnh vào giữa một cạnh. */
export interface WallGeometryInsertVertexInput {
  readonly wallId: string;
  readonly edgeId: string;
  readonly atMm: WallGeometryPointMm;
}

/** Xoá một đỉnh. */
export interface WallGeometryRemoveVertexInput {
  readonly wallId: string;
  readonly vertexId: string;
}

/** Tách một bức tường tại một điểm trên nó. */
export interface WallGeometrySplitWallInput {
  readonly wallId: string;
  readonly atMm: WallGeometryPointMm;
}

/** Nối hai bức tường ở hai đầu mút. Đúng HAI, và kiểu nói ra điều đó. */
export interface WallGeometryJoinWallsInput {
  readonly wallIds: readonly [string, string];
}

/** Đặt lại chiều cao. Nhận MỘT DANH SÁCH vì `partial` cho đổi chiều cao của nhiều tường. */
export interface WallGeometryChangeHeightInput {
  readonly wallIds: readonly string[];
  readonly heightMm: number;
}

/** Đóng khe hở của một vòng hở. */
export interface WallGeometryCloseGapInput {
  readonly wallId: string;
}
```

### 5.5 Khả năng và cổng

```ts
/** Việc màn này cần từ bên ngoài. Mỗi khoá là một khả năng, không có khả năng nào khác. */
export type WallGeometryEditorCapability =
  | 'readWallGeometry'
  | 'readOriginalTrace'
  | 'findSnapCandidates'
  | 'moveVertex'
  | 'insertVertex'
  | 'removeVertex'
  | 'splitWall'
  | 'joinWalls'
  | 'changeHeight'
  | 'closeGap';

/** Mỗi phương thức là một việc màn cần từ bên ngoài, và không có việc nào khác. */
export interface WallGeometryEditorGateway {
  /**
   * Khả năng nào cổng này làm được, trả lời ĐỒNG BỘ — hook phải biết trước lượt
   * vẽ đầu, vì `supports.<tool>` quyết định nút nào có mặt trên thanh.
   */
  readonly supports: Readonly<Record<WallGeometryEditorCapability, boolean>>;

  /** Ai đang thao tác — đi vào lệnh và nhật ký hoạt động. */
  readonly actorId: string;

  /**
   * Hình học của bức tường đang sửa, BẤT ĐỒNG BỘ.
   *
   * Nguồn DUY NHẤT của cờ tải và cờ hỏng của màn (R-64) — hook cắm nó vào
   * `src/lib/query` chứ không nuôi `useState`. Cùng vai
   * `PropertyInspectorGateway.readSpatialLayer` (`propertyInspectorGateway.ts:707`).
   */
  readonly readWallGeometry: (wallId: string) => Promise<WallGeometrySnapshot | null>;

  /**
   * Vết vẽ gốc của AI — CHỖ ĐỂ MỞ #1.
   *
   * `null` là một câu trả lời HỢP LỆ, không phải một lỗi: nó nghĩa là bức tường
   * này không có vết gốc nào lưu lại. `supports.readOriginalTrace === false` là
   * lời khai mạnh hơn: tầng dưới không có đường tới nó cho BẤT KỲ bức tường
   * nào. Hook xử lý cả hai theo đúng một cách — không có chip đối chiếu, và
   * danh sách loại bắt điểm còn ba.
   */
  readonly readOriginalTrace: (wallId: string) => Promise<WallGeometryOriginalTrace | null>;

  /**
   * Những chỗ bắt được quanh con trỏ, ĐỒNG BỘ — nó chạy mỗi khung hình của một
   * phiên kéo 60fps, nên một `Promise` ở đây là một khung hình bị trễ.
   *
   * Danh sách trả về có BAO NHIÊU loại là việc của cổng: ba, hay bốn. Không
   * một dòng nào của (A) hay (B) hỏi con số ấy.
   */
  readonly findSnapCandidates: (
    query: WallGeometrySnapQuery,
  ) => readonly WallGeometrySnapCandidate[];

  /**
   * ĐANG kéo: đề nghị một hình TẠM để cả 3D lẫn mặt bằng 2D đổi theo, mà mô
   * hình đã lưu không bị đụng tới. Gọi mỗi khung hình.
   *
   * Không trả gì và không bất đồng bộ: đây là lượt ghi tạm, và
   * `src/store/commit.ts:179` (`previewEdit`) đã bảo đảm ba điều — không vào
   * lịch sử hoàn tác, không đi tự lưu, và một đối tượng có nhiều nhất MỘT thao
   * tác nháp nên hàng chục lượt gọi trong một phiên kéo không cộng dồn thành
   * hàng chục thao tác.
   */
  readonly previewVertexMove: (input: WallGeometryMoveVertexInput) => void;

  /**
   * Esc giữa lúc kéo: bỏ hình tạm, không để lại gì trong lịch sử.
   * (`src/store/commit.ts:201`.)
   */
  readonly discardVertexPreview: () => void;

  /**
   * THẢ TAY: kéo một đỉnh xong.
   *
   * Đây là chỗ điều cấm tuyệt đối "một phiên kéo chỉ được sinh MỘT bước hoàn
   * tác" được giữ: hàng chục lượt `previewVertexMove` không sinh bước nào, và
   * đúng một lượt gọi hàm này sinh đúng một bước. `commit` tự dọn bản nháp
   * trước khi trả về (`src/store/commit.ts:131`), nên không có đường nào để
   * một hình tạm sống sót qua lượt ghi thật.
   */
  readonly commitVertexMove: (
    input: WallGeometryMoveVertexInput,
  ) => Promise<WallGeometryEditorResult<WallGeometrySnapshot>>;

  /** Thêm một đỉnh. */
  readonly insertVertex: (
    input: WallGeometryInsertVertexInput,
  ) => Promise<WallGeometryEditorResult<WallGeometrySnapshot>>;

  /** Xoá một đỉnh. */
  readonly removeVertex: (
    input: WallGeometryRemoveVertexInput,
  ) => Promise<WallGeometryEditorResult<WallGeometrySnapshot>>;

  /** Tách tường tại một điểm. Trả về mã HAI bức tường mới. */
  readonly splitWall: (
    input: WallGeometrySplitWallInput,
  ) => Promise<WallGeometryEditorResult<readonly [string, string]>>;

  /** Nối hai tường. Trả về mã bức tường sau khi nối. */
  readonly joinWalls: (
    input: WallGeometryJoinWallsInput,
  ) => Promise<WallGeometryEditorResult<string>>;

  /** Đặt lại chiều cao một hoặc nhiều tường. */
  readonly changeHeight: (
    input: WallGeometryChangeHeightInput,
  ) => Promise<WallGeometryEditorResult<readonly WallGeometrySnapshot[]>>;

  /** Đóng khe hở của một vòng hở — nút của nhánh `partial`. */
  readonly closeGap: (
    input: WallGeometryCloseGapInput,
  ) => Promise<WallGeometryEditorResult<WallGeometrySnapshot>>;
}

/**
 * Chỗ tiêm cổng, khai ở ĐÂY chứ không ở file kiểu.
 *
 * File kiểu là của T5 và không được nhập file này (mục 4, ghi chú sau
 * `WallGeometryEditorContainerProps`). Nên hai chữ ký thật của T6 là phép giao:
 *
 *   useWallGeometryEditor(
 *     options: UseWallGeometryEditorOptions & WallGeometryEditorGatewayInjection,
 *   ): UseWallGeometryEditorResult
 *
 *   WallGeometryEditorContainerProps & WallGeometryEditorGatewayInjection
 *
 * Story của T5 dựng thẳng view từ kịch bản nên không cần cổng; bài kiểm của T7
 * dựng container và tiêm bản giả qua đúng trường này (R-73).
 */
export interface WallGeometryEditorGatewayInjection {
  /** Cổng ra tầng lệnh. Vắng mặt thì hook tự dựng cổng thật. */
  readonly gateway?: WallGeometryEditorGateway | undefined;
}

/** Ai thao tác khi nơi gọi không nói. */
export const WALL_GEOMETRY_EDITOR_ACTOR_ID = 'wall-geometry-editor';

export interface CreateWallGeometryEditorGatewayOptions {
  readonly actorId?: string | undefined;
}

/** Cổng thật — đọc kho, ghi qua tầng lệnh, nơi DUY NHẤT chạm `commit`/`previewEdit` (A10). */
export declare function createWallGeometryEditorGateway(
  options?: CreateWallGeometryEditorGatewayOptions,
): WallGeometryEditorGateway;
```

> `declare function` ở dòng cuối chỉ là cách tài liệu này khai **chữ ký**; T6
> viết thân hàm và bỏ `declare`.

### 5.6 Vì sao gateway trông như thế này

- **`supports` có mặt trước lượt vẽ đầu**, nên một khả năng chưa có đường không
  biến thành một nút bấm vào thì không có gì xảy ra. `supports.splitWall === false`
  ⇒ nút "Tách tường" **không có trên thanh** — cùng cách `forbidden` gỡ nút, chứ
  không phải làm mờ.
- **Ba cửa của phiên kéo (`previewVertexMove` / `discardVertexPreview` /
  `commitVertexMove`) là ba phương thức riêng**, không phải một hàm có cờ
  `isFinal`. Một cờ boolean thì một lỗi đánh máy biến hàng trăm khung hình kéo
  thành hàng trăm bước hoàn tác; ba phương thức thì không.
- **Không phương thức nào nhận một `Wall`.** Chúng nhận mã và toạ độ milimét.
  Hình dạng thật của `Wall` đổi thì chỉ thân cổng đổi.
- **`findSnapCandidates` đồng bộ, mọi thứ khác bất đồng bộ.** Ranh giới đúng
  bằng ranh giới "chạy trong vòng vẽ 60fps hay không".

---

## 6. (D) Bảy trạng thái

Tên bảy nhánh lấy **nguyên** từ `SEVEN_STATES`
(`src/lib/testing/sevenStateScenarios.ts:26-34`): `empty` · `loading` · `partial`
· `error` · `success` · `forbidden` · `collapsed`. Bài kiểm của T7 đối chiếu hai
bảng bằng `expectSevenStates`.

### 6.1 Bảy interface

```ts
/** 1. Rỗng — chưa chọn tường nào. Thanh công cụ hiện MỘT CÂU GỢI Ý thay cho sáu nút. */
export interface WallGeometryEditorEmptyState {
  readonly kind: 'empty';
  readonly message: string;
  /** Câu nhắc phím — "Tab" viết hoa là ngoại lệ A6 cho tên phím. */
  readonly hint: string;
}

/** 2. Đang tải — đang tính lại hình học. Không có gì khác để mang. */
export interface WallGeometryEditorLoadingState {
  readonly kind: 'loading';
  readonly message: string;
}

/** Khe hở của một vòng hở, và nút đóng nó. */
export interface WallGeometryGap {
  /** Kích thước khe hở ĐÃ định dạng, chữ đều (A15) — "12,00 mm". */
  readonly sizeLabel: string;
  readonly closeLabel: string;
  readonly onCloseGap: () => void;
}

/**
 * 3. Một phần — HAI tình huống, và một trạng thái mang được cả hai cùng lúc:
 * chọn nhiều tường (chỉ cho đổi chiều cao), và/hoặc tường có vòng hở.
 *
 * Hai trường độc lập chứ không phải một union hai nhánh: ba bức tường đang chọn
 * mà một trong ba có vòng hở là một tình huống thật, và một union sẽ bắt hook
 * chọn kể một nửa.
 */
export interface WallGeometryEditorPartialState extends WallGeometryEditorContent {
  readonly kind: 'partial';
  /** Chỉ đổi được chiều cao — năm nút kia đã bị gỡ khỏi `toolbar.buttons`. */
  readonly isHeightOnly: boolean;
  /** Vòng hở; `null` khi mọi vòng đều khép. */
  readonly gap: WallGeometryGap | null;
  /** Một câu nói vì sao màn đang bị giới hạn. */
  readonly notice: string;
}

/**
 * 4. Lỗi — hình mới bị từ chối (đa giác tự cắt).
 *
 * Giá trị đã TỰ TRẢ VỀ số cũ trước khi tới view: `vertexTable` và `handles` ở
 * đây mô tả hình HỢP LỆ, không phải hình bị từ chối. `edgeHighlights` mang các
 * cạnh gây lỗi để tô sáng; `offendingEdgeIds` lặp lại mã của chúng để view cuộn
 * / focus mà không phải dò cả cây.
 */
export interface WallGeometryEditorErrorState extends WallGeometryEditorContent {
  readonly kind: 'error';
  /** Vì sao bị từ chối. Không bao giờ rỗng — không có từ chối im lặng. */
  readonly explanation: string;
  readonly offendingEdgeIds: readonly string[];
  readonly onDismissError: () => void;
}

/** 5. Xong — một bức tường, sửa được, không có gì bị chặn. */
export interface WallGeometryEditorSuccessState extends WallGeometryEditorContent {
  readonly kind: 'success';
}

/**
 * 6. Không có quyền — công cụ sửa KHÔNG BẬT ĐƯỢC, bị gỡ khỏi thanh
 * (`toolbar.buttons` rỗng), mọi hàng đỉnh `isLocked`, mọi tay nắm
 * `isEnabled: false`.
 *
 * Hai đường vào đây, và `notice` nói ra đường nào: vai chỉ xem, hoặc camera
 * đang ở chế độ trực giao lát cắt (điều cấm tuyệt đối #3). Hai câu khác nhau,
 * vì người dùng làm được hai việc khác nhau để thoát ra.
 */
export interface WallGeometryEditorForbiddenState extends WallGeometryEditorContent {
  readonly kind: 'forbidden';
  readonly notice: string;
}

/**
 * 7. Thu gọn — khoá sửa trên di động, chỉ xem.
 *
 * KHÔNG mở rộng `WallGeometryEditorContent` (lệch có chủ đích #3, mục 0): mang
 * theo sáu nút, tay nắm kéo được và bảng đỉnh sửa được là mang theo đúng thứ
 * trạng thái này tồn tại để chặn.
 */
export interface WallGeometryEditorCollapsedState {
  readonly kind: 'collapsed';
  /** Nhãn tóm tắt, ví dụ "Tường W-014". */
  readonly summaryLabel: string;
  readonly notice: string;
  readonly onExit: () => void;
}

/** Bảy trạng thái, đúng một trong bảy interface trên. */
export type WallGeometryEditorState =
  | WallGeometryEditorEmptyState
  | WallGeometryEditorLoadingState
  | WallGeometryEditorPartialState
  | WallGeometryEditorErrorState
  | WallGeometryEditorSuccessState
  | WallGeometryEditorForbiddenState
  | WallGeometryEditorCollapsedState;

/**
 * Suy ra từ chính bảy interface trên, không gõ lại bảy chuỗi — không có cách nào
 * để bảng này trôi khỏi `WallGeometryEditorState`. PHẢI khớp đúng bảy chuỗi của
 * `SEVEN_STATES` (`src/lib/testing/sevenStateScenarios.ts:26-34`).
 */
export type WallGeometryEditorStateKind = WallGeometryEditorState['kind'];
```

### 6.2 Vì sao union lồng, không phải một cờ chuỗi

Chép nguyên lý lẽ của `propertyInspectorTypes.ts:20-38`, và ở màn này nó còn
đúng hơn: `empty` không có bức tường nào để có tay nắm, `loading` không có gì
ngoài một câu, `collapsed` cố ý không có công cụ. Gộp bảy vào một interface
phẳng với các trường `| null` sẽ cho phép một trạng thái `empty` vẫn "có" một
mảng `handles` rỗng nhưng hợp lệ về kiểu — sai mà trình biên dịch không bắt
được. Ở đây thì `state.handles` trên nhánh `empty` là **lỗi biên dịch**.

### 6.3 `wallGeometryEditorScenarios.ts` — bảy kịch bản mẫu (T5)

Theo khuôn `propertyInspectorScenarios.ts`: bảy kịch bản mang **props**, không
dựng container, vì view thuần phải test được chỉ từ props.

```ts
import { CLEAN_BUILDING_SCENARIO } from '@/lib/testing/fixtures';
import { SEVEN_STATE_LABELS, type SevenState } from '@/lib/testing/sevenStateScenarios';

import {
  KNOWN_SNAP_KIND_IDS,
  WALL_GEOMETRY_EDITOR_TEXT,
  type WallGeometryEditorContent,
  type WallGeometryEditorState,
} from './wallGeometryEditorTypes';

const TEXT = WALL_GEOMETRY_EDITOR_TEXT;

const noop = (): void => {
  /* Kịch bản là dữ liệu tĩnh: callback có mặt để view gắn được, không để chạy. */
};

/** Bảy kịch bản, đúng thứ tự và đúng tên của `SEVEN_STATES`. */
export declare const WALL_GEOMETRY_EDITOR_SCENARIOS: Readonly<
  Record<SevenState, WallGeometryEditorState>
>;

/** Bảy trạng thái theo thứ tự, cho vòng lặp của story và của bài kiểm. */
export const WALL_GEOMETRY_EDITOR_STATE_NAMES: readonly SevenState[] = Object.freeze([
  'empty',
  'loading',
  'partial',
  'error',
  'success',
  'forbidden',
  'collapsed',
]);

/** Nhãn tiếng Việt của một trạng thái, cho thông điệp hỏng người đọc được. */
export const stateLabel = (state: SevenState): string => SEVEN_STATE_LABELS[state];
```

**Ba luật T5 phải giữ khi dựng bảy kịch bản** (R-70 — không làm vừa lòng bài kiểm):

1. **Bức tường lấy từ bộ mẫu chuẩn A14** (`CLEAN_BUILDING_SCENARIO`), không gõ
   tay một bức tường tưởng tượng. Mã tường, độ dày, toạ độ đỉnh đều là số thật
   của bộ mẫu.
2. **Chuỗi lấy từ `WALL_GEOMETRY_EDITOR_TEXT`**, không chép lại. Một bài kiểm
   chép lại chữ của mã nguồn chỉ chứng minh hai bản chép giống nhau.
3. **Kịch bản `success` phải có `comparisonChip: null` ở ÍT NHẤT một biến thể.**
   Đó là cách chỗ để mở #1 được kiểm thật chứ không chỉ được viết ra. Nếu T7
   thấy đủ chỗ, thêm một story thứ tám `successWithoutOriginalTrace` — nó không
   phá `expectSevenStates` vì hàm ấy khoá theo `scenario.state`, không theo số
   lượng story.

---

## 7. Hai chỗ để mở, và mở bằng cách nào

Điều phối viên đã tìm ra hai lỗ hổng trong đặc tả; một worker khác đang xác minh
chúng ngay lúc này và quyết định cuối chưa có. Hợp đồng này khai sao cho **cả hai
hướng đều dùng được mà không phải sửa (A) hay (B)**.

### Chỗ để mở #1 — "vết vẽ gốc của AI"

**Sự thật đã kiểm:** `Wall` không có trường nào giữ hình học gốc
(`src/domain/spatial/types.ts:123-132` + `ReviewMetadata` ở `:61-65`).
`src/lib/versioning` có `VersionSnapshot` / `diffVersions`
(`versioning/diff.ts:11,106`) và một lịch sử phiên bản
(`versioning/restore.ts:11-20`) — nghĩa là **có thể** dựng được một "hình trước
đây", nhưng không có gì bảo đảm bản trước đây là bản AI vẽ ra chứ không phải bản
người dùng sửa lần trước. Tôi không phán quyết chuyện đó; tôi chỉ khai sao cho
hai kết cục đều chạy.

**Mở bằng ba chỗ, cả ba đã có trong hợp đồng:**

| Chỗ | Vắng mặt trông như thế nào |
|---|---|
| `WallGeometryEditorContent.comparisonChip: WallGeometryComparisonChip \| null` | `null` ⇒ chip không vẽ. Không phải một chip rỗng, không phải chữ "—" |
| `WallGeometrySnapModel.kinds: readonly WallGeometrySnapKind[]` | Mảng ba phần tử thay vì bốn. Không trường nào tên `aiTrace` |
| `WallGeometryEditorGateway.supports.readOriginalTrace: boolean` | `false` ⇒ hook biết trước lượt vẽ đầu, không phải chờ một `Promise` trả `null` |

**Vì sao `| null` bắt buộc chứ không phải `?:` tuỳ chọn.** `exactOptionalPropertyTypes`
đang bật, nên `?:` nghĩa là "được phép không có trường này". Một trường được
phép vắng là một trường T6 có thể **quên**, và T5 sẽ không biết mình phải vẽ
nhánh nào. Một trường `| null` bắt buộc thì T6 phải viết ra `comparisonChip: null`
— một câu khai rõ ràng — và T5 buộc phải xử lý nó.

**Vì sao T5 không được bịa dữ liệu để lấp.** Đây chính là bẫy: T5 dựng story,
thấy một trường bắt buộc, và gõ "Lệch so với bản vẽ gốc: 12 mm" vào. Story đẹp,
và chỗ để mở đã đóng lại mà không ai biết. Luật 3 của mục 6.3 tồn tại để chặn
đúng chuyện đó.

### Chỗ để mở #2 — nhãn loại bắt điểm

**Đặc tả đòi bốn loại:** đường trục · đỉnh khác · phương vuông góc với đoạn
trước · vết vẽ gốc của AI. Loại thứ tư phụ thuộc chỗ để mở #1, nên số loại là
**3 hoặc 4**.

**Mở bằng cách khai danh sách là DỮ LIỆU:**

- `SnapKindId = string`, **không** phải `'axis' | 'otherVertex' | 'perpendicular' | 'aiTrace'`.
  Một union bốn nhánh thì xoá một nhánh là một thay đổi phá vỡ ở mọi chỗ rẽ
  nhánh; một `string` thì không có chỗ rẽ nhánh nào để phá.
- `KNOWN_SNAP_KIND_IDS` là một **hằng số `as const`**, không phải một kiểu. Hook
  và bài kiểm gọi `KNOWN_SNAP_KIND_IDS.perpendicular` để khỏi gõ chuỗi; xoá khoá
  `aiTrace` là **một dòng**, và không một trường nào của (A) hay (B) đổi theo.
- **View không bao giờ rẽ nhánh theo `kindId`.** Nó lặp qua `snap.kinds` và vẽ
  `label`; nó lặp qua `snap.activeGuides` và vẽ một đường nét đứt cộng `label`.
  Đó là cách điều cấm tuyệt đối "mỗi loại bắt điểm phải được GỌI TÊN trên màn
  hình" được giữ mà không cần biết có mấy loại.
- **Số loại không xuất hiện ở đâu như một hằng số.** Không có `SNAP_KIND_COUNT`,
  không có `Record<SnapKindId, …>` nào bắt buộc phải đủ bốn khoá.

**Điều T7 phải giữ khi viết bài kiểm:** đừng khẳng định `snap.kinds` có bốn phần
tử. Khẳng định rằng **mỗi** phần tử có một `label` không rỗng và bằng tiếng Việt
có dấu, và rằng **mỗi** `activeGuide` có một `label`. Đó là điều đặc tả thật sự
đòi.

---

## 8. Khoá i18n (R-67) — **T7 viết vào `src/i18n/vi.json`, tôi chỉ liệt kê**

Namespace: `wallGeometryEditor` (cùng cách `propertyInspector`,
`furnitureLibraryPanel`, `viewer3d`, `viewerShell` đã có trong file). Chuỗi vẫn
viết **thẳng bằng tiếng Việt trong JSX**; `vi.json` là **từ điển để
`expectVietnamese` soát** chữ mất dấu và tiếng Anh sót lại. Nhãn giao diện viết
thường kiểu câu (A6); chữ hoa chỉ cho mã tường / mã đỉnh / mã trục và tên phím.

| Khoá | Câu tiếng Việt |
|---|---|
| `regionLabel` | Sửa hình học tường |
| `band.editing` | Đang sửa: {{wallCode}} |
| `band.done` | Xong |
| `tools.moveVertex.label` | Di chuyển đỉnh |
| `tools.moveVertex.key` | V |
| `tools.addVertex.label` | Thêm đỉnh |
| `tools.addVertex.key` | A |
| `tools.removeVertex.label` | Xoá đỉnh |
| `tools.removeVertex.key` | X |
| `tools.splitWall.label` | Tách tường |
| `tools.splitWall.key` | T |
| `tools.joinWalls.label` | Nối tường |
| `tools.joinWalls.key` | N |
| `tools.resetHeight.label` | Đặt lại chiều cao |
| `tools.resetHeight.key` | H |
| `tools.tooltip` | {{label}} · phím {{key}} |
| `dimensionChain.regionLabel` | Chuỗi kích thước của tường đang sửa |
| `dimensionChain.total` | Tổng chiều dài: {{length}} |
| `vertexTable.title` | Bảng đỉnh |
| `vertexTable.columnCode` | Đỉnh |
| `vertexTable.columnX` | Toạ độ x |
| `vertexTable.columnY` | Toạ độ y |
| `vertexTable.empty` | Chưa có đỉnh nào để sửa. |
| `vertexTable.cellInvalid` | Giá trị chưa hợp lệ nên toạ độ đã trở về số cũ. |
| `comparison.deviation` | Lệch so với bản vẽ gốc: {{deviation}} |
| `snap.axis` | Trục {{axisCode}} |
| `snap.otherVertex` | Đỉnh khác |
| `snap.perpendicular` | Vuông góc |
| `snap.aiTrace` | Vết vẽ gốc |
| `snap.axisLocked` | Đang khoá trục theo phím Shift |
| `snap.suppressed` | Đang tắt bắt điểm theo phím Alt |
| `handles.vertex` | Đỉnh {{vertexCode}} |
| `handles.edge` | Cạnh {{edgeCode}} |
| `handles.nudgeHint` | Dùng phím mũi tên để dời đỉnh, giữ Shift để dời bước lớn. |
| `handles.offendingEdge` | Cạnh {{edgeCode}} đang gây lỗi hình học |
| `states.empty.message` | Chưa chọn tường nào để sửa. |
| `states.empty.hint` | Chọn một bức tường trong khung nhìn, hoặc nhấn Tab để duyệt qua các tường. |
| `states.loading.message` | Đang tính lại hình học… |
| `states.partial.heightOnly` | Đang chọn nhiều tường nên chỉ đổi được chiều cao. |
| `states.partial.gapSize` | Khe hở: {{gap}} |
| `states.partial.closeGap` | Đóng khe hở |
| `states.error.selfIntersecting` | Đa giác tự cắt nên hình mới bị từ chối. Toạ độ đã trở về giá trị trước đó. |
| `states.error.dismiss` | Đã hiểu |
| `states.forbidden.viewerRole` | Bạn không có quyền sửa hình học nên các công cụ sửa đã được gỡ khỏi thanh. |
| `states.forbidden.sectionOrthographic` | Đang ở chế độ trực giao lát cắt nên hình học chưa sửa được. Thoát lát cắt rồi thử lại. |
| `states.collapsed.summary` | Tường {{wallCode}} |
| `states.collapsed.notice` | Trên màn hình nhỏ, hình học chỉ xem được chứ không sửa được. |
| `states.collapsed.exit` | Thoát chế độ sửa |
| `refusal.vertexFloor` | Một bức tường cần ít nhất hai đỉnh nên đỉnh này chưa xoá được. |
| `refusal.joinNeedsTwoEnds` | Nối tường cần đúng hai đầu mút đang chọn. |
| `refusal.splitOffWall` | Điểm tách nằm ngoài bức tường nên chưa tách được. |
| `refusal.heightBelowOpening` | Chiều cao mới thấp hơn đỉnh một ô mở trên tường này nên chưa đặt được. |
| `refusal.noSaveTarget` | Chưa mở dự án và tầng nào nên chưa có nơi để lưu. Bản vẽ của bạn không có lỗi nào ở đây. |
| `refusal.serverRejected` | Máy chủ chưa nhận được hình học mới ({{kind}}). Thay đổi vẫn còn trên máy này. |
| `undo.vertexMoved` | Đã dời đỉnh {{vertexCode}} |
| `undo.vertexAdded` | Đã thêm một đỉnh |
| `undo.vertexRemoved` | Đã xoá một đỉnh |
| `undo.wallSplit` | Đã tách tường {{wallCode}} |
| `undo.wallsJoined` | Đã nối hai tường |
| `undo.heightChanged` | Đã đổi chiều cao tường |
| `undo.gapClosed` | Đã đóng khe hở |

**61 khoá.** Ba ghi chú cho T7:

1. **Không thêm khoá cho "không có vết vẽ gốc".** Vắng mặt nghĩa là chip **không
   vẽ**, không phải vẽ một câu nói rằng nó vắng. Một khoá ở đây sẽ là lời mời T5
   vẽ một chip rỗng.
2. **`snap.aiTrace` là khoá CÓ ĐIỀU KIỆN.** Nếu chỗ để mở #1 kết luận là không
   có vết gốc, khoá này không được dùng và T7 bỏ nó khỏi `vi.json`. Bỏ nó không
   đụng tới một dòng mã nào (mục 7, chỗ để mở #2).
3. **Nút hoàn tác dùng lại `common.undo`** đã có sẵn trong `vi.json`; bảy khoá
   `undo.*` ở trên chỉ là phần *mô tả việc vừa làm* của toast, không phải nhãn
   nút. Tương tự, đừng chép lại `common.close` / `common.retry`.

---

## 9. Đối chiếu luật, và ba rủi ro còn lại

| Luật | Chỗ hợp đồng này thoả nó |
|---|---|
| R-59 | Mục 1 — sáu file, cộng ba file anh em và bốn file tách view nếu vượt R-22 |
| R-60 | Mục 3.0 — file kiểu chỉ `import type` từ `@/lib/motion` và `@/lib/viewmodel`; không tầng nào trong bốn tầng bị cấm |
| R-61 | Mục 5 — mọi phép hình học và mọi quy đổi đơn vị ở sau cổng; view và hook không có công thức nào |
| R-62 | T6 bọc container bằng `ScreenErrorBoundary`, chép khuôn `Viewer3DCrashFallback` (`Viewer3D.container.tsx:171-185`) |
| R-63 | Mục 6 — bảy nhánh khớp `SEVEN_STATES`; mục 6.3 — bảy kịch bản |
| R-64 | Mục 4.3 — cờ tải/hỏng từ `gateway.readWallGeometry` qua `src/lib/query`, không `useState` tự viết |
| R-65 | Không một chuỗi nào trong hợp đồng bắt đầu bằng `/` hay `http` |
| R-71 | Mục 3.1 — `WALL_GEOMETRY_MOTION` giữ TÊN ô, không giữ con số; 240 ms của đặc tả ánh xạ về `standard` |
| R-72 | `ariaLabel` bắt buộc ở `WallGeometryHandle` và `WallGeometryEdgeHighlight`; `snap.modifierNotice` nói ra Shift/Alt cho trình đọc màn hình |
| R-73 | Mục 4 — `WallGeometryEditorContainerProps` nhận đủ để Viewer3D gắn thẻ này vào sau mà không viết thêm logic |
| A2 / A4 / A5 | `WallGeometryTone = Exclude<ViewStatusCode, 'verified'>` — ba màu, và không đường nào để hình học bật cờ xanh của người duyệt |
| A6 | Nhãn viết thường kiểu câu; ngoại lệ chữ hoa chỉ ở mã tường, mã đỉnh, mã trục, tên phím — ghi rõ tại từng trường |
| A8 | Bảy khoá `undo.*` ở mục 8; toast là việc của hook, view không có trường để dựng nó |
| A10 | Mục 5 — cổng là nơi duy nhất chạm `commit` / `previewEdit` |
| A12 | `handles[].onNudge`; Esc phân lớp ở mục 4.3 |
| A15 | Mọi số người dùng đọc là `string` đã định dạng: `lengthLabel`, `displayValue`, `sizeLabel`, `comparisonChip.label` |
| Cấm #1 | Không kiểu nào nhận một gizmo hay một phép giao; view chỉ nhận pixel đã chiếu |
| Cấm #2 | Ba cửa phiên kéo ở mục 5.5 |
| Cấm #3 | `UseWallGeometryEditorOptions.isSectionOrthographic` ⇒ `forbidden` |
| Cấm #4 | `WallGeometrySnapKind.label` và `WallGeometrySnapGuide.label` đều bắt buộc |
| Cấm #5 | `WallGeometryRefusal.explanation` bắt buộc; `error.explanation` bắt buộc |
| Cấm #6 | Bốn file tách ở mục 1 nằm **trong thư mục màn**, không thêm gì vào `src/components/` |

### Ba rủi ro tôi không đóng được, và ai đóng

1. **`Wall` là hai đầu mút, đặc tả nói N đỉnh.** Hợp đồng chịu được cả hai (mảng,
   không phải `start`/`end`), nhưng *việc thêm một đỉnh vào một `Segment` nghĩa
   là gì* là câu hỏi của tầng lệnh, không phải của mối nối này. Nếu tầng dưới
   quyết định "thêm đỉnh = tách thành hai tường", thì `supports.insertVertex`
   là `false` và nút "Thêm đỉnh" biến mất — hợp đồng không đổi một dòng.
2. **Ngưỡng "cần chú ý" của chip đối chiếu.** Đặc tả nói "chuyển mức cần chú ý
   khi vượt ngưỡng" mà không nói ngưỡng bao nhiêu. R-71 cấm T6 tự đặt. T6 phải
   **dừng và hỏi** (R-69) nếu không tìm được nguồn trong `src/domain` /
   `src/lib`; hợp đồng chỉ khai `tone`, không khai con số.
3. **Mặt bằng 2D cập nhật đồng thời.** `onGeometryChanged` là sợi dây, nhưng
   *ai* nghe nó thì chưa có màn nào tồn tại để nghe, và `Viewer3D` nằm trong
   danh sách cấm sửa. Đó là R-73 đúng nghĩa: sợi dây có mặt, đủ dài, và không
   cần viết thêm gì khi có người cắm vào.

---

## 10. Hợp đồng này đã được BIÊN DỊCH THẬT, không chỉ được viết ra

Yêu cầu "mã chép thẳng vào `src/` được" là một lời khẳng định, nên nó đã được
đo chứ không được tin. Mọi khối ```` ```ts ```` của tài liệu này được rút ra và
ghép lại thành đúng ba module — `wallGeometryEditorTypes.ts`,
`wallGeometryEditorGateway.ts`, `wallGeometryEditorScenarios.ts` — đặt tạm dưới
`src/screens/viewer/`, rồi chạy hai cổng thật của repo:

- **`tsc --noEmit -p tsconfig.json` → 0 lỗi** ở cả ba file, dưới đúng cấu hình
  của repo (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- **`eslint --ext ts --max-warnings 0` → sạch** ở `…Types.ts` và `…Gateway.ts`.
  Ở `…Scenarios.ts` còn **5 lỗi `no-unused-vars`**, và cả năm là **đúng**: khối
  ở mục 6.3 là bộ khung, `WALL_GEOMETRY_EDITOR_SCENARIOS` ở đó là một
  `declare const` nên chưa có gì tiêu thụ `CLEAN_BUILDING_SCENARIO`,
  `KNOWN_SNAP_KIND_IDS`, `TEXT` hay `noop`. Năm lỗi ấy biến mất ngay khi T5
  dựng bảy kịch bản thật. **T5 đừng gỡ các import đó** — chúng là danh sách
  nguyên liệu bắt buộc của ba luật ở mục 6.3.

Thư mục tạm đã được xoá; không một file nào của hợp đồng này còn nằm trong
`src/`.
