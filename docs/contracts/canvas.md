# Hợp đồng canvas — T4 (khảo sát lớp 1)

> Toàn bộ trích dẫn dưới đây chép **nguyên văn** từ mã nguồn thật, không bịa. Đường dẫn
> tương đối tới gốc worktree `wlr-canvas-contract`. `docs/architecture.md`,
> `docs/domain-contracts.md`, `docs/components-canvas.md` (docs cũ) **không** được dùng
> làm nguồn — xem cảnh báo trong `CLAUDE.md`.

---

## 0. CẬP NHẬT SAU ESCALATION — hợp đồng L1 thật của màn đã tồn tại

Sau khi gửi `escalation` về ba kiểu `Wall`, điều phối viên xác nhận và trỏ tới
`src/lib/commands/business/shared.ts:307` (`toSolidWall`) — đã đọc, xác minh nguyên văn
(mục A.5 dưới đây). Trong lúc xác minh, phát hiện thêm một việc **quan trọng hơn cả câu
hỏi ban đầu**: đã có sẵn **hợp đồng props lớp 1 (L1) thật của chính màn này** —
`WallLayerReview` (đúng nghĩa "WLR" trong tên nhánh `wlr-canvas-contract`) — tại:

```
src/screens/qc/WallLayerReview/types.ts
```

**Cảnh báo về nguồn**: file này hiện **CHƯA có trong worktree/nhánh của tôi**
(`mungvu2004/wlr-canvas-contract`). Nó tồn tại trong **worktree song song**
`C:/Users/mxuan/orca/workspaces/AppFront/wlr-scaffold` (nhánh
`mungvu2004/wlr-scaffold`), hiện **CHƯA COMMIT** (`git status` ở đó báo
`?? src/screens/qc/`). Tôi chỉ đọc được nó vì hai worktree chia sẻ cùng máy — không
được coi đây là "đã có trong repo" cho tới khi nhánh đó commit và được merge vào nhánh
đang dùng. Nội dung trích dưới đây là **đọc thật, không suy đoán**, nhưng worker lớp 2
**phải tự kiểm tra lại file này còn ở đúng vị trí và nội dung khi họ bắt đầu việc**,
vì nó có thể đổi trước khi merge.

File tự mô tả mình là "NỀN MÓNG (lớp L1): API công khai DUY NHẤT giữa người viết hook
(`useWallLayerReview.ts`), người viết view canvas (`WallLayerReviewCanvas.tsx`) và người
viết view panel (`WallLayerReviewPanel.tsx` + `WallLayerReview.tsx`)" và tự khoá:
*"File này ĐÓNG BĂNG kể từ lúc lớp L1 xong... thấy thiếu một trường, sai một kiểu, hay
cần thêm một prop thì phải `orca orchestration ask` hỏi điều phối viên trước — không tự
thêm, không tự sửa"* (dòng 398-404). Vì vậy **hợp đồng props dưới đây thắng mọi suy luận
tổng quát ở mục A–H bên dưới** khi hai bên khác nhau — mục A–H vẫn đúng như một khảo sát
kỹ thuật về CÁCH các hàm/thư viện hoạt động (đã xác minh, không đổi), nhưng CÁCH DÙNG
CỤ THỂ cho màn `WallLayerReview` phải theo đúng file `types.ts` này.

### 0.1 — Props canvas thật, chép nguyên

```ts
// src/screens/qc/WallLayerReview/types.ts:160-163
export const WALL_THICKNESS_CHOICES = [100, 220, 300] as const;
export type WallThicknessChoice = (typeof WALL_THICKNESS_CHOICES)[number];

// types.ts:280-286
export interface WallShapeViewModel {
  readonly id: WallId;
  /** Đa giác đóng, ngược kim đồng hồ, ít nhất bốn đỉnh — xem `resolveWallShapes`. */
  readonly outline: readonly Point[];
  /** Cùng ý nghĩa với `WallRowViewModel.statusCode` — canvas và panel tô cùng một tường thống nhất một màu. */
  readonly statusCode: ViewStatusCode;
}

// types.ts:289-307
export interface WallLayerCanvasProps {
  readonly shapes: readonly WallShapeViewModel[];
  readonly selectedWallId: WallId | null;
  readonly hoveredWallId: WallId | null;
  /** Cờ hiện tim tường — đường centreline mảnh vẽ chồng lên đa giác. */
  readonly showCentrelines: boolean;
  /** Tỷ lệ mm/px của tầng — nhãn gắn từ `Level.scaleMillimetresPerPixel`. */
  readonly millimetresPerPixel: MillimetresPerPixel;
  /** Nguồn ảnh nền. `null` khi chưa có / đang tải — canvas vẽ khung xám chờ, không phải màn trắng. */
  readonly backgroundImageUrl: string | null;
  /** Mô tả ảnh nền cho trình đọc màn hình (R-72). */
  readonly backgroundImageAlt: string;
  /** `false` ở trạng thái `forbidden`: canvas xem/phóng to được, chọn/kéo thì không. */
  readonly isInteractive: boolean;
  readonly onSelect: (wallId: WallId | null) => void;
  readonly onHover: (wallId: WallId | null) => void;
}
```

`Point` ở đây là kiểu **trần** của `src/domain/spatial/types.ts` (`{x,y}: number`),
không phải `PointMm` gắn nhãn của `domain/units` — nhất quán với ghi chú đầu file
`types.ts:43-54`: đồ thị spatial dùng `Millimetres = number` trần xuyên suốt.

**Đây trả lời dứt khoát câu hỏi trung tâm của mục A**: view canvas (`WallLayerReviewCanvas.tsx`)
**KHÔNG tự gọi `resolveWallShapes`**. Nó nhận thẳng `shapes: WallShapeViewModel[]` —
outline đã được **hook** (`useWallLayerReview.ts`, một worker khác, không phải worker
đọc hợp đồng này) tính sẵn bằng `resolveWallShapes`, rồi trả nguyên mảng điểm, không ánh
xạ lại (đúng nguyên văn comment `types.ts:271-278`). Việc DUY NHẤT của canvas view với
`outline` là: đổi từng điểm mm → px (nhân với `millimetresPerPixel`, mục B) rồi vẽ SVG
`<polygon>`. Toàn bộ mục A.1–A.4 bên dưới do đó mô tả **việc của hook**, không phải việc
của view — nếu worker lớp 2 đang viết `WallLayerReviewCanvas.tsx` (view), đọc mục 0 này
là đủ; nếu đang viết `useWallLayerReview.ts` (hook), đọc thêm mục A đầy đủ.

### 0.2 — Màu tô tường KHÔNG phải theo độ dày — là theo `ViewStatusCode`

`ViewStatusCode` (`src/lib/viewmodel/types.ts:65-68`):
```ts
export const VIEW_STATUS_CODES = ['verified', 'attention', 'violation', 'neutral'] as const;
export type ViewStatusCode = (typeof VIEW_STATUS_CODES)[number];
```
Đây là **bốn mã trung lập** (không phải tên token) mà theo đúng comment nguồn của chính
file đó (dòng 15-19): *"Which token a code maps to is the view's decision"* — view tự
quyết ánh xạ code → token, thường qua đúng vựng `Badge`'s bốn `variant` (mục F.3, cùng
bốn giá trị `verified/attention/violation/neutral`). `WallShapeViewModel.statusCode`
dùng đúng type này, và comment ở `types.ts:220-222` (cho `WallRowViewModel`, cùng logic)
nói rõ: `'verified'` CHỈ khi đã duyệt (A5), `'attention'` khi tin cậy thấp HOẶC độ dày
không chuẩn mà **chưa** duyệt, `'neutral'` còn lại, **không bao giờ `'violation'` ở màn
này**.

**Hệ quả quan trọng — sửa lại kết luận cũ ở mục C/D/E/F bên dưới**: đa giác tường trên
canvas `WallLayerReview` tô màu theo **trạng thái duyệt** (verified/attention/neutral),
KHÔNG theo **độ dày**. Độ dày được truyền đạt bằng hai kênh khác, không dùng màu:
1. **Bề rộng hình học thật** của `outline` (đúng mục E.2 bên dưới — vẫn đúng nguyên
   văn, không đổi).
2. **Nhãn chữ** `WallRowViewModel.thicknessLabel` / `WallInspectorViewModel.thicknessMm`
   ở panel, và chính điều khiển ba lựa chọn `WALL_THICKNESS_CHOICES`.

Vì vậy **nghiệm thu mục E ("ba độ dày phân biệt được khi che hết chữ và chuyển đen
trắng") phải đọc lại đúng nghĩa**: với MÀN `WallLayerReview` cụ thể, "che hết chữ" bỏ đi
kênh 2, nên phép kiểm chỉ còn đúng kênh 1 (bề rộng hình học — E.2) — **màu
`--wall-110/220/330` tính ở mục E.1 không áp dụng cho `WallLayerReviewCanvas`**, vì màn
này không dùng thang màu đó cho tường; nó vẫn là dữ liệu ĐÚNG và hữu ích cho bất kỳ màn
canvas nào khác thật sự tô theo độ dày qua `materialMap` (ví dụ theo đúng khuôn
`CanvasIntegration.stories.tsx`/`CadLayerPreviewCanvas.tsx`), chỉ là **không phải màn
này**.

### 0.3 — BẪY THẬT: `materialMap.wallStrokeToken` KHÔNG NHẬN được ba giá trị của
`WALL_THICKNESS_CHOICES`

Đây là một phát hiện cụ thể, không phải suy đoán — đáng báo động vì nó là một lỗi kiểu
sẽ chặn build nếu ai đó ghép nhầm hai module lại với nhau:

```ts
// src/types/spatial.ts
export type WallThickness = 110 | 220 | 330 | 'CONCRETE_COLUMN';

// src/screens/qc/WallLayerReview/types.ts:160
export const WALL_THICKNESS_CHOICES = [100, 220, 300] as const;
```
Hai bộ giá trị **CHỈ TRÙNG NHAU ở 220**. `materialMap.wallStrokeToken(thickness: WallThickness)`
switch cứng `110 | 220 | 330`; gọi nó với `100` hay `300` (hai giá trị thật của
`WALL_THICKNESS_CHOICES`) **không qua được typecheck** — TypeScript từ chối vì `100`/`300`
không thuộc `WallThickness`. Đây chính xác là lý do điều phối viên xác nhận: "110/220/330
sẽ luôn bị bộ lọc 'độ dày không chuẩn' đánh dấu" — hai bộ hằng số được đặt ra ở hai thời
điểm khác nhau cho hai mục đích khác nhau (`WallThickness`: demo cũ theo `types/spatial.ts`;
`WALL_THICKNESS_CHOICES`: chuẩn thật theo `STANDARD_THICKNESSES_MM` của
`domain/walls/cleanup.ts`) và KHÔNG được đồng bộ lại.

**Kết luận**: `WallLayerReviewCanvas.tsx` (và bất kỳ nơi nào dùng `WALL_THICKNESS_CHOICES`)
**không được gọi `materialMap.wallStrokeToken`/`wallFillToken`** để tô theo độ dày — hai
API đó thuộc về một mô hình dữ liệu độ dày cũ (110/220/330, `types/spatial.ts`), không
phải mô hình chuẩn hiện dùng (100/220/300, `domain/walls/cleanup.ts`). Màu tô tường của
màn này đến từ `statusCode` (mục 0.2), không phải từ độ dày.

### 0.4 — Adapter đồ thị → hình học: `toSolidWall`, đã có sẵn, không viết mới

Xác minh nguyên văn tại `src/lib/commands/business/shared.ts`:
```ts
// shared.ts:37-49 (import, xác nhận GraphWall = domain/spatial Wall, SolidWall = domain/walls Wall)
import type {
  FurnitureKind, Level, LevelId, Opening as GraphOpening, Point,
  Wall as GraphWall, WallId, WallKind,
} from '@/domain/spatial/types';
import { centrelineLength, type Wall as SolidWall, type WallKind as SolidWallKind } from '@/domain/walls/types';

// shared.ts:273-276
export const toPointMm = (point: Point): PointMm => ({
  x: millimetres(point.x),
  y: millimetres(point.y),
});

// shared.ts:291-295
const SOLID_WALL_KIND: Readonly<Record<WallKind, SolidWallKind>> = {
  loadBearing: 'loadBearing',
  partition: 'partition',
  envelope: 'glazed',
};

// shared.ts:307-317
export const toSolidWall = (wall: GraphWall, level: Level): SolidWall => ({
  id: wall.id,
  kind: SOLID_WALL_KIND[wall.kind],
  centreline: {
    start: toPointMm(wall.centreline.start),
    end: toPointMm(wall.centreline.end),
  },
  thicknessMm: millimetres(wall.thicknessMm),
  baseElevationMm: millimetres(level.elevationMm),
  topElevationMm: millimetres(level.elevationMm + wall.heightMm),
});

// shared.ts:320-326
export const withCentrelineOf = (wall: GraphWall, geometry: SolidWall): GraphWall => ({
  ...wall,
  centreline: {
    start: toPoint(geometry.centreline.start),
    end: toPoint(geometry.centreline.end),
  },
});
```
Xác nhận đúng như điều phối viên chỉ ra: đây là đường chính thức để đổi `Wall` của đồ thị
spatial (kiểu (2), mục NOT FOUND #1 cũ) sang `Wall` của `domain/walls` (kiểu (1), thứ
`resolveWallShapes` cần). Đường gọi đúng cho **hook** (không phải view):
```ts
const solids = graphWalls.map((w) => toSolidWall(w, level));
const { shapes } = resolveWallShapes(solids /* , threshold? */);
```
**Không viết adapter mới, không sửa `src/domain`** — `toSolidWall`/`withCentrelineOf`
đã đủ và đã được bảy lệnh nghiệp vụ tường của `wallCommands.ts` dùng, đi cùng một đường
với chúng.

---

## A. Đường đi của đa giác tường — CÂU HỎI TRUNG TÂM

> Mục A–A.4 dưới đây là khảo sát kỹ thuật về `resolveWallShapes` tự nó — vẫn đúng
> nguyên văn, không đổi. Nhưng theo mục 0.1, **việc gọi hàm này là việc của hook
> (`useWallLayerReview.ts`), không phải của view canvas**. Đọc mục này nếu đang viết
> hook; nếu đang viết view, mục 0.1 đã đủ.

### A.1 — Chép nguyên `src/domain/walls/joints.ts`

```ts
// src/domain/walls/joints.ts:63
export const DEFAULT_JOINT_THRESHOLD_MM: Millimetres = millimetres(50);

// src/domain/walls/joints.ts:78-81
export interface WallEndRef {
  readonly wallId: WallId;
  readonly end: WallEnd;
}

// src/domain/walls/joints.ts:84-87
export interface JointMember extends WallEndRef {
  /** Direction the wall leaves the node in, within `[0, 360)`. */
  readonly bearingDeg: Degrees;
}

// src/domain/walls/joints.ts:90-99
export interface Joint {
  readonly id: JointId;
  readonly kind: JointKind;
  /** Centre of the ends that were welded together. */
  readonly position: PointMm;
  /** Members counter-clockwise by bearing, so the order is repeatable. */
  readonly members: readonly JointMember[];
  /** The wall that owns the middle of the node; the others stop at its faces. */
  readonly primaryWallId: WallId;
}

// src/domain/walls/joints.ts:104-109
export interface UnresolvedJoint {
  readonly position: PointMm;
  readonly members: readonly WallEndRef[];
  readonly reason: UnresolvedJointReason;
}

// src/domain/walls/joints.ts:117-127
export interface WallShape {
  readonly wallId: WallId;
  /**
   * Closed outline counter-clockwise, at least four vertices, the first not
   * repeated at the end.
   */
  readonly outline: readonly PointMm[];
  readonly startJointId: JointId | null;
  readonly endJointId: JointId | null;
}

// src/domain/walls/joints.ts:129-134
export interface ResolveWallShapesResult {
  readonly shapes: readonly WallShape[];
  readonly joints: readonly Joint[];
  readonly unresolved: readonly UnresolvedJoint[];
}

// src/domain/walls/joints.ts:677-685
export function resolveJoints(
  walls: readonly Wall[],
  thresholdMm: Millimetres = DEFAULT_JOINT_THRESHOLD_MM,
): ResolveJointsResult {
  const { geometries, unresolved } = resolveGeometry(walls, thresholdMm);
  const joints = geometries.map((geometry) => geometry.joint).sort(compareJoints);

  return { joints, unresolved };
}

// src/domain/walls/joints.ts:700-746
export function resolveWallShapes(
  walls: readonly Wall[],
  thresholdMm: Millimetres = DEFAULT_JOINT_THRESHOLD_MM,
): ResolveWallShapesResult {
  const { geometries, unresolved } = resolveGeometry(walls, thresholdMm);

  const geometryByEnd = new Map<string, { geometry: JointGeometry; memberIndex: number }>();
  for (const geometry of geometries) {
    geometry.members.forEach((member, memberIndex) => {
      geometryByEnd.set(endKey(member.wall.id, member.end), { geometry, memberIndex });
    });
  }

  const shapes = walls.map((wall): WallShape => {
    const halfThicknessMm = millimetres(wall.thicknessMm / 2);
    const forward = unitDirection(wall.centreline.start, wall.centreline.end);
    const backward = { x: -forward.x, y: -forward.y };

    const atStart = geometryByEnd.get(endKey(wall.id, 'start'));
    const atEnd = geometryByEnd.get(endKey(wall.id, 'end'));

    const startCap =
      atStart === undefined
        ? freeCap(wall.centreline.start, forward, halfThicknessMm)
        : capWalk(atStart.geometry, atStart.memberIndex);
    const endCap =
      atEnd === undefined
        ? freeCap(wall.centreline.end, backward, halfThicknessMm)
        : capWalk(atEnd.geometry, atEnd.memberIndex);

    return {
      wallId: wall.id,
      outline: buildOutline(startCap, endCap),
      startJointId: atStart?.geometry.joint.id ?? null,
      endJointId: atEnd?.geometry.joint.id ?? null,
    };
  });

  return {
    shapes,
    joints: geometries.map((geometry) => geometry.joint).sort(compareJoints),
    unresolved,
  };
}
```

`UnresolvedJointReason` (`joints.ts:102`): `'tooManyEnds' | 'selfJoin'`. `JointKind` (`joints.ts:72`):
`'corner' | 'tee' | 'cross'`.

### A.2 — Trả lời câu hỏi trung tâm

**`resolveWallShapes` nhận vào gì?**
`walls: readonly Wall[]` — kiểu `Wall` là bản **`src/domain/walls/types.ts`**
(`joints.ts:53`, `import ... type Wall ... from './types'`), **KHÔNG PHẢI** bản
`src/domain/spatial/types.ts`. Hai bản này khác nhau về hình dạng — xem cảnh báo lớn ở
mục "NOT FOUND" bên dưới, đây là điểm dễ nhầm nhất của cả hợp đồng này.

`src/domain/walls/types.ts:61-70`:
```ts
export interface Wall {
  readonly id: WallId;
  readonly kind: WallKind;                 // 'loadBearing' | 'partition' | 'railing' | 'glazed'
  readonly centreline: WallCentreline;      // { start: PointMm; end: PointMm }
  readonly thicknessMm: Millimetres;        // số liên tục, 60–600 mm (types.ts:43,46)
  readonly baseElevationMm: Millimetres;
  readonly topElevationMm: Millimetres;
}
```

**Nó trả về gì?** `ResolveWallShapesResult { shapes, joints, unresolved }`. Mỗi
`WallShape.outline` là **`readonly PointMm[]`** — một đa giác ĐÃ ĐÓNG, ngược chiều kim
đồng hồ, đỉnh đầu không lặp lại ở cuối, tối thiểu 4 đỉnh (`joints.ts:120-124,690-692`).
Đơn vị: **milimét** (`PointMm` từ `src/domain/units/compare.ts`, dùng xuyên suốt
`domain/walls`). Đây là toạ độ thế giới thực (world-space mm), chưa quy đổi sang pixel —
việc đó là của mục B.

**Đa giác đã tính sẵn nút giao chưa?** RỒI. `resolveWallShapes` tự gọi
`resolveGeometry` → hàn các đầu tường gần nhau thành `Joint` (ngưỡng mặc định 50 mm,
`DEFAULT_JOINT_THRESHOLD_MM`), rồi cắt outline của từng tường tại đúng góc đã hàn
(`capWalk`, `joints.ts:565-578`) — không hở, không chồng, đúng bất biến ghi ở đầu file
(`joints.ts:14-19`). Tường không gặp tường nào khác thì lấy đầu vuông
(`freeCap`, `joints.ts:581-584`).

### A.3 — Kết luận bắt buộc

**Worker canvas chỉ cần gọi `resolveWallShapes(walls)` một lần** (với mảng tường của
tầng đang xem), lấy `result.shapes[i].outline` và vẽ thẳng mảng điểm đó (sau khi đổi
mm→px theo mục B). **KHÔNG được** tự tính offset theo `thicknessMm`, tự tính giao điểm
hai tường, tự tính pháp tuyến, hay tự "vá" góc tường bằng bất kỳ phép hình học nào trong
màn — tất cả việc đó `resolveWallShapes` đã làm xong và trả về sẵn.

### A.4 — Cái thiếu (ĐÃ GIẢI QUYẾT — xem mục 0)

Bản khảo sát ban đầu của mục này ghi nhận `resolveWallShapes` nhận `Wall` của
`domain/walls/types.ts` mà không có hàm chuyển đổi nào từ hai kiểu `Wall` còn lại
(`domain/spatial/types.ts`, `types/spatial.ts`), và rằng nó "chưa từng được gọi trong
sản phẩm thật" (đúng — grep `resolveWallShapes|WallShape` toàn `src/` chỉ ra 2 file:
chính `joints.ts` và test của nó). Đã gửi `escalation` hỏi điều phối viên; câu trả lời
và xác minh nguyên văn nằm ở **mục 0.4** — adapter `toSolidWall`
(`src/lib/commands/business/shared.ts:307`) đã có sẵn, không cần viết mới. Quan sát
"chưa từng được gọi ngoài test của chính nó" vẫn đúng và vẫn đáng lưu ý cho người viết
hook: `useWallLayerReview.ts` sẽ là **nơi gọi `resolveWallShapes` đầu tiên trong sản
phẩm thật**, đi qua `toSolidWall` trước.

---

## B. Đổi toạ độ mm sang pixel

### B.0 — `Level.scaleMillimetresPerPixel`

`src/domain/spatial/types.ts:104-117`:
```ts
export interface Level extends ReviewMetadata {
  id: LevelId;
  name: string;
  order: number;
  elevationMm: Millimetres;
  heightMm: Millimetres;
  areaM2?: SquareMetres;
  /**
   * Tỷ lệ bản vẽ của tầng này, mm trên mỗi pixel.
   * Không bắt buộc vì tầng chưa hiệu chỉnh thì chưa có.
   */
  scaleMillimetresPerPixel?: MillimetresPerPixel;
}
```

`MillimetresPerPixel` khai ở `src/domain/units/types.ts:52`:
```ts
/** A drawing scale: how many millimetres one pixel of the image is worth. */
export type MillimetresPerPixel = Quantity<'mm/px'>;
```
(`Quantity<'mm/px'>` — số có gắn nhãn đơn vị bằng phantom type, xoá ở runtime;
`types.ts:23-31`.) Được re-export lại ở `src/domain/units/scale.ts:24`.

**Khi `scaleMillimetresPerPixel` là `undefined` (tầng chưa hiệu chỉnh):** màn KHÔNG
được tự bịa một tỉ lệ mặc định để vẽ tường thật (100/220/300 mm...) ra pixel — làm vậy
là vẽ sai kích thước. Màn phải rơi vào một trong bảy trạng thái chuẩn (A11) — cụ thể là
trạng thái yêu cầu hiệu chỉnh tỉ lệ trước (xem `screens/pipeline/ScaleCalibration/`,
màn đã có sẵn cho việc này) — hoặc, nếu chỉ cần xem bản vẽ chưa hiệu chỉnh, vẽ theo một
tỉ lệ "màn hình" tạm (ví dụ 1 px = 1 mm, chỉ để layout không vỡ) và nói rõ ràng trong
giao diện rằng tỉ lệ chưa được xác nhận. **Việc chọn nhánh nào là quyết định của
điều phối viên / đặc tả màn S-xx cụ thể, không phải quyết định tự do của worker canvas**
— ghi ở đây làm rào chắn, không phải hướng dẫn tự chọn.

### B.1 — Tiện ích đổi mm↔px đã có trong repo

**`src/domain/units/scale.ts`** — nguồn thật, thuần, có test (`__tests__/scale.test.ts`):

```ts
// scale.ts:94-101
export interface Scale {
  readonly millimetresPerPixel: MillimetresPerPixel;
  /** Convert a distance measured on the image into a real length. */
  readonly pixelsToMillimetres: (value: Pixels) => Millimetres;
  /** Convert a real length into a distance on the image. */
  readonly millimetresToPixels: (value: Millimetres) => Pixels;
}

// scale.ts:137-146
export function scaleFromRatio(ratio: MillimetresPerPixel): Scale {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    throw new RangeError(`Scale must be a positive ratio: ${String(ratio)}`);
  }
  return {
    millimetresPerPixel: ratio,
    pixelsToMillimetres: (value: Pixels): Millimetres => millimetres(value * ratio),
    millimetresToPixels: (value: Millimetres): Pixels => pixels(value / ratio),
  };
}
```

Cách dùng đúng cho canvas: `const scale = scaleFromRatio(level.scaleMillimetresPerPixel)`
rồi gọi `scale.millimetresToPixels(pointMm)` cho từng toạ độ — đây là **phép nhân
thuần tuý** (`value / ratio`), không phải hình học, được phép gọi trong màn.

**`src/hooks/useGridLayer.ts:40-41`** — quy ước ĐANG DÙNG THẬT trong component
(`GridLayer.tsx`), gộp thêm hệ số zoom của viewport:
```ts
const mmToPx = (mm: number): number =>
  scaleRatioMmPerPx > 0 ? (mm / scaleRatioMmPerPx) * zoom : 0;
```
Đây là hook (`src/hooks/**`), không phải `src/lib`, và nhận số thô (`number`), không
phải `Millimetres`/`MillimetresPerPixel` có nhãn. Ghi rõ để worker canvas không nhầm nó
với `domain/units/scale.ts`: **hai chỗ này có cùng công thức cốt lõi (`mm / tỉ lệ`) nhưng
`useGridLayer` còn nhân thêm `zoom`** — zoom là hệ số phóng to/thu nhỏ của viewport,
tách biệt khỏi tỉ lệ bản vẽ.

**`src/hooks/useCanvasViewport.ts`** — quản lý pan/zoom của canvas
(`ViewportState { x, y, zoom }`, đơn vị px màn hình, không biết gì về mm). Có
`pan(dx, dy)`, `zoomTo(zoomLevel, centerX?, centerY?)`, `fitToContent(bounds, w, h, padding?)`,
`flyToBounds(bounds, w, h, options?)` (bay có hoạt ảnh, tôn trọng `prefers-reduced-motion`).
**Đây là state pan/zoom cục bộ của một canvas**, KHÁC với `store/viewSlice.ts`'s
`{ zoom, viewCenter }` (state toàn cục, lưu localStorage, `viewCenter` tính bằng mm).
Hai cơ chế này hiện KHÔNG được nối với nhau ở đâu trong repo — nếu màn thật cần cả pan/
zoom cục bộ (mượt, theo khung `useCanvasViewport`) lẫn "nhớ vị trí xem" xuyên phiên
(theo `viewSlice`), đây là một quyết định thiết kế màn cụ thể, không phải điều mục B
này tự giải quyết được.

### B.2 — `src/lib/scale.ts` đã bị xoá — xác minh

```
$ ls src/lib/scale.ts
ls: cannot access 'src/lib/scale.ts': No such file or directory
```
Xác nhận: **KHÔNG dùng** `docs/domain-contracts.md` mô tả file này — tài liệu đó lỗi
thời (đúng như cảnh báo của CLAUDE.md).

### B.3 — Kết luận

Có tiện ích đổi mm↔px thật, đã test, thuần (`domain/units/scale.ts`), nên **KHÔNG cần
hỏi điều phối viên** phần này — không phải NOT FOUND. Worker canvas dùng
`scaleFromRatio(level.scaleMillimetresPerPixel).millimetresToPixels(...)` cho phép đổi
đơn vị, và tự cộng thêm phép biến đổi viewport (pan/zoom) ở lớp trên, theo đúng khuôn
`useGridLayer`/`useCanvasViewport` đã có — đây vẫn là "phép nhân thuần tuý + cộng trừ
tịnh tiến", không phải hình học bị cấm bởi A.

### B.4 — "12 mm/px" ở thanh trạng thái lấy từ đâu

`StatusBar.tsx` (`src/components/shell/StatusBar.tsx:13`) nhận `scaleDensity: string`
làm **prop có sẵn chuỗi đã định dạng** (không tự tính) — ví dụ `"12 mm/px"`.
`AppShell.tsx` (bọc `StatusBar`) hiện đặt **giá trị mặc định cứng**:
```ts
// src/components/shell/AppShell.tsx:148-149
scaleRatio = '1:100',
scaleDensity = '12 mm/px',
```
Đây CHỈ LÀ placeholder demo — "12 mm/px" **không** lấy từ store hay từ
`Level.scaleMillimetresPerPixel` ở đâu cả hiện nay. Màn thật phải tự tính chuỗi này
bằng `formatScaleDensity(level.scaleMillimetresPerPixel)`
(`src/lib/format/measure.ts:178-186`, xem chữ ký bên dưới) rồi truyền vào
`AppShell`/`StatusBar` qua prop `scaleDensity` — không sửa `AppShell` để nó tự đọc
store (vi phạm mục D: view không tính, và vi phạm ranh giới import
`src/components` không được đọc `src/store` trực tiếp theo kiểu đó ở tầng này).

```ts
// src/lib/format/measure.ts:178-186
export function formatScaleDensity(
  millimetresPerPixel: MaybeNumber,
  options: NumberFormatOptions = {},
): string {
  if (!isFormattable(millimetresPerPixel)) {
    return MISSING_VALUE;
  }
  return `${formatNumber(millimetresPerPixel, options)}${MILLIMETRES_PER_PIXEL_SUFFIX}`;
}
```
`formatDrawingScaleRatio(millimetresPerPixel, shortEdgePx)` (`measure.ts:209-226`) là
hàm tương ứng cho chuỗi `"1:100"` (`scaleRatio`).

---

## C. Component canvas có sẵn — props nguyên văn

**Cảnh báo chung**: đặc tả nói "chép nguyên `export interface XProps`" nhưng thực tế
**KHÔNG một props interface nào trong `src/components/canvas/` được đánh dấu
`export`** — tất cả là `interface FooProps` nội bộ file (module-private). Ghi đúng sự
thật này thay vì bịa từ khoá `export`. Muốn dùng type đó từ ngoài file phải tự suy ra
qua `React.ComponentProps<typeof Foo>` hoặc export lại — hiện chưa ai làm vậy.

### `WallThicknessLegend.tsx`

```ts
// src/components/canvas/WallThicknessLegend.tsx:17-24
interface WallThicknessLegendProps {
  isVisible?: boolean;
  /** Trạng thái 7 chiều */
  state?: 'empty' | 'loading' | 'partial' | 'error' | 'success' | 'no-permission' | 'collapsed';
  /** Cấp nào đang có dữ liệu (để hiển thị partial) */
  availableLevels?: WallThickness[];
  className?: string;
}
```
Việc: chú giải 4 mức độ dày (110/220/330/`CONCRETE_COLUMN`), đọc màu qua
`wallStrokeToken` của `materialMap.ts`, có nút bấm để lọc theo độ dày
(`useWallThicknessLegend`). **Đặc tả nói "LUÔN hiện khi lớp Tường bật, góc trái dưới"**
— khớp với vị trí CSS thật `absolute bottom-16 left-4` (dòng 47,63,84,101,120); việc
"luôn hiện khi lớp Tường bật" là logic mà **màn** phải tự lái qua prop `isVisible`
(component tự nó không đọc `hiddenLayers` của `viewSlice`).

**Nó nhận dữ liệu chú giải thế nào?** Không nhận danh sách màu từ ngoài — nó tự đọc
hằng số `WALL_THICKNESS_LEVELS` (`src/hooks/useWallThicknessLegend.ts:6`:
`[110, 220, 330, 'CONCRETE_COLUMN']`) làm danh sách đầy đủ, và bản đồ nhãn cứng
`LABEL_MAP` nội bộ file (dòng 10-15: `'110' → '110 mm'`, …,
`CONCRETE_COLUMN → 'Cột BTCT'`). Ở trạng thái `partial` nó lọc còn `availableLevels`
(prop) để chỉ hiện các mức đang có dữ liệu. Màu từng ô lấy trực tiếp từ
`wallStrokeToken(thickness)`.

### `ZoomCluster.tsx`

```ts
// src/components/canvas/ZoomCluster.tsx:6-9
interface ZoomClusterProps {
  isVisible?: boolean;
  className?: string;
}
```
Việc: cụm nút zoom nổi góc phải dưới (`absolute bottom-4 right-4`, dòng 34); logic zoom
đến từ hook `useZoomCluster()` (không nhận qua props) — trả `zoomIn, zoomOut, resetZoom,
fitToScreen, zoomLabel`.

### `MiniMap.tsx`

```ts
// src/components/canvas/MiniMap.tsx:5-10
interface MiniMapProps {
  isVisible?: boolean;
  /** Nội dung bản vẽ thu nhỏ (SVG hoặc canvas) */
  children?: React.ReactNode;
  className?: string;
}
```
Việc: bản đồ nhỏ góc phải trên (`absolute top-4 right-4`, dòng 36), khung 160×120 cố định
(dòng 58), khung nhìn vẽ bằng `%` từ hook `useMiniMap()` (`viewport.x/y/width/height` là
phần trăm, không phải px). `children` là nơi màn tự nhét bản vẽ thu nhỏ vào (SVG hoặc
canvas — component không áp đặt).

### `SelectionHalo.tsx`

```ts
// src/components/canvas/SelectionHalo.tsx:6-19
interface SelectionHaloProps {
  /** Vị trí và kích thước trong canvas (px) */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Trạng thái hiển thị */
  isVisible: boolean;
  /** Biến thể: selected (1,5px + fill) hay hover (1px, không fill) */
  variant?: SelectionVariant;
  /** Đã qua 120ms animation enter */
  hasEntered?: boolean;
  className?: string;
}
```
Việc: tô sáng đối tượng đang chọn/trỏ. **Nhận toạ độ x/y/width/height bằng PIXEL, đã quy
đổi sẵn** — component không biết gì về mm. `variant` từ `useSelectionHalo`. Màu qua
`selectionBorderToken()`/`selectionFillToken()` (đều trả `var(--accent...)`).

### `MeasurementLabel.tsx`

```ts
// src/components/canvas/MeasurementLabel.tsx:9-18
interface MeasurementLabelProps {
  state: ReturnType<typeof useMeasurementLabel>['state'];
  startPoint: Point | null;
  currentPoint: Point | null;
  midPoint: Point | null;
  distanceFormatted: string;
  /** Khi true, component ẩn (bị chồng) */
  isHidden?: boolean;
  className?: string;
}
```
Việc: nhãn đo cho công cụ M. `Point` ở đây là kiểu của `useMeasurementLabel`
(**px màn hình**, không phải `PointMm`). `distanceFormatted` là chuỗi ĐÃ định dạng —
component không tự `.toFixed()` giá trị khoảng cách (đúng A15); nó tự vẽ tick mark
bằng lượng giác thuần trên toạ độ px đã có sẵn (dòng 47-55), không đụng vào mm.

### `ContextMenu.tsx`

Không interface `Props` nào ở top-level được export; export duy nhất là component
`ContextMenu` (namespace object) và hai type `ContextMenuGroup`,
`ContextMenuItemType as ContextMenuItemData` (dòng 251).

```ts
// src/components/canvas/ContextMenu.tsx:226-231 (props của ContextMenu mặc định)
interface ContextMenuDefaultProps {
  isVisible: boolean;
  position: { x: number; y: number };
  groups: ContextMenuGroup[];
  onClose: () => void;
}
```
Việc: menu chuột phải. `groups: ContextMenuGroup[]` — mỗi group là danh sách
`ContextMenuItem` (từ `useContextMenu`, có `id, label, kbd?, isDestructive?, isDisabled?,
action`). Đặc tả "Duyệt / Đổi độ dày / Tách đoạn / Xoá" phải được **màn** dựng thành
đúng bốn `ContextMenuItem` này (component không hard-code bốn mục đó — nó chỉ render
`groups` được đưa vào). `role="menu"`/`role="menuitem"` có sẵn, điều hướng bàn phím
(mũi tên, Home/End, Escape) đã cài trong `ContextMenuRoot` (dòng 47-84) — khớp A12
("Esc đóng lớp trên cùng": dòng 74-77 gọi `onClose?.()` khi Escape).

### `GridLayer.tsx`

```ts
// src/components/canvas/GridLayer.tsx:6-22
interface GridLayerProps {
  /** Chiều rộng canvas (px) */
  width: number;
  /** Chiều cao canvas (px) */
  height: number;
  /** Pan offset X (px) */
  offsetX?: number;
  /** Pan offset Y (px) */
  offsetY?: number;
  /** Zoom level hiện tại (1.0 = 100%) */
  zoom?: number;
  /** Tỉ lệ mm/px */
  scaleRatioMmPerPx?: number;
  /** Tuỳ chỉnh bước lưới */
  config?: Partial<GridConfig>;
  className?: string;
}
```
Việc: lưới nền kỹ thuật, vẽ bằng SVG `<pattern>` (xem mục H). Tự comment ngay trong
file: *"Không tính toán hình học inline; gọi `useGridLayer`"* (dòng 29) — bằng chứng
sống cho quy tắc "màn không tính hình học".

### `TransformGizmo.tsx`

```ts
// src/components/canvas/TransformGizmo.tsx:8-14
interface TransformGizmoProps {
  isVisible?: boolean;
  /** Vị trí tâm gizmo (px) */
  cx?: number;
  cy?: number;
  className?: string;
}
```
Tay kéo 3 trục dùng cho chế độ 3D/di chuyển đối tượng; màu trục lấy từ
`axisStrokeToken('x'|'y'|'z')` (thang xám ấm, không đỏ/xanh bão hoà).
**Bẫy phát hiện được**: gốc gizmo gắn `aria-label="Transform gizmo"` **bằng tiếng Anh**
(`TransformGizmo.tsx:84`) — vi phạm A6. Đây là lỗi có sẵn trong code, **đừng chép theo**;
worker canvas dùng nhãn tiếng Việt cho mọi thứ mới.

### `materialMap.ts` — nguồn màu duy nhất

Toàn bộ export (đọc kỹ, không rút gọn — đây là API mà mọi canvas phải gọi qua):

```ts
// src/components/canvas/materialMap.ts
export function wallStrokeToken(thickness: WallThickness): string {
  switch (thickness) {
    case 110: return 'var(--wall-110)';
    case 220: return 'var(--wall-220)';
    case 330: return 'var(--wall-330)';
    case 'CONCRETE_COLUMN': return 'var(--text-primary)';
    default: return 'var(--wall-idle)';
  }
}
export function wallFillToken(thickness: WallThickness): string; // = wallStrokeToken
export function roomFillToken(): string;        // 'var(--bg-sunken)'
export function roomStrokeToken(): string;      // 'var(--border-default)'
export function doorStrokeToken(): string;      // 'var(--accent)'
export function doorFillToken(): string;        // 'var(--accent-wash)'
export function windowStrokeToken(): string;    // 'var(--text-secondary)'
export function furnitureStrokeToken(): string; // 'var(--text-muted)'
export function furnitureFillToken(): string;   // 'var(--bg-sunken)'
export function dimensionStrokeToken(): string; // 'var(--accent)'
export function dimensionTextToken(): string;   // 'var(--text-primary)'
export function gridMinorToken(): string;       // 'var(--canvas-2d-grid)'
export function gridMajorToken(): string;       // 'var(--border-default)'
export function axisStrokeToken(axis: 'x' | 'y' | 'z'): string;
  // x → 'var(--wall-330)', y → 'var(--wall-220)', z → 'var(--wall-110)'
export function selectionBorderToken(): string; // 'var(--accent)'
export function selectionFillToken(): string;   // 'var(--accent-wash)'
export function isLowConfidence(confidence: MaybeNumber): boolean;
  // true khi confidenceLevel(confidence) === 'needsReview' — xem mục E/F
```

**Có ánh xạ loại tường/độ dày sang token màu không?** CÓ — `wallStrokeToken` chính là
ánh xạ đó, nhưng nó ánh xạ theo **ĐỘ DÀY** (`WallThickness`), không theo **loại tường**
(`WallKind: loadBearing/partition/railing/glazed` của domain). Không có hàm nào trong
`materialMap.ts` nhận `WallKind` — nếu màn cần tô theo loại tường (chịu lực khác vách
ngăn), không có sẵn, phải hỏi.

> **Cập nhật (mục 0.3)**: `WallThickness` của hàm này (110/220/330) KHÔNG khớp
> `WALL_THICKNESS_CHOICES` (100/220/300) mà màn `WallLayerReview` thật sự dùng — gọi
> `wallStrokeToken(100)` hay `wallStrokeToken(300)` không qua được typecheck. Đừng dùng
> hàm này cho màn đó; xem mục 0.2 cho nguồn màu đúng (`ViewStatusCode`).

`WallThickness` — kiểu tham số của `wallStrokeToken` — không nằm trong
`domain/spatial/types.ts` hay `domain/walls/types.ts` nào cả, mà ở:
```ts
// src/types/spatial.ts
export type WallThickness = 110 | 220 | 330 | 'CONCRETE_COLUMN';
```
Xem mục "NOT FOUND" — đây là kiểu Wall thứ ba trong repo, và là kiểu materialMap thực
sự dùng.

### `CanvasIntegration.stories.tsx` — ví dụ sống ghép các mảnh lại

Tóm tắt cách ghép (`src/components/canvas/CanvasIntegration.stories.tsx`): một `<div>`
bọc ngoài (`relative overflow-hidden bg-canvas-2d`) bắt sự kiện chuột (wheel để zoom,
mousedown/move/up để pan, tự quản lý `zoom/panX/panY` bằng `useState` cục bộ của
story — **không** qua `useCanvasViewport` hay `viewSlice`); bên trong xếp lớp theo thứ
tự: `<GridLayer>` (nền, nhận `scaleRatioMmPerPx` cứng `1` — một sự đơn giản hoá của
story, không phải giá trị thật), rồi một `<svg>` để vẽ tường bằng `<g transform=...>` +
`<line>` mỗi tường, rồi các overlay nổi `<WallThicknessLegend>`, `<ZoomCluster>`,
`<MiniMap>` xếp sau cùng (để chúng nổi trên cùng, dùng z-index/absolute riêng của từng
component).

Đoạn JSX cốt lõi (rút gọn, giữ nguyên logic):
```tsx
// src/components/canvas/CanvasIntegration.stories.tsx:60-124
const svgTransform = `translate(${panX} ${panY}) scale(${zoom / scaleRatio})`;

<div
  className="relative overflow-hidden bg-canvas-2d select-none"
  style={{ width: canvasW, height: canvasH }}
  onWheel={handleWheel}
  onMouseDown={handleMouseDown}
  onMouseMove={handleMouseMove}
  onMouseUp={handleMouseUp}
>
  <GridLayer width={canvasW} height={canvasH} zoom={zoom} offsetX={panX} offsetY={panY} scaleRatioMmPerPx={1} />
  <svg className="absolute inset-0 pointer-events-none" aria-label={`Bản vẽ tầng 1 — ${walls.length} tường`}>
    <g transform={svgTransform}>
      {walls.map((wall) => {
        const strokeColor = wallStrokeToken(wall.thickness_mm);
        const strokeW = wall.thickness_mm === 'CONCRETE_COLUMN' ? 330 : Number(wall.thickness_mm);
        const lowConf = isLowConfidence(wall.confidence);
        return (
          <g key={wall.id}>
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={strokeColor} strokeWidth={strokeW} opacity={lowConf ? 0.55 : 1} />
            {lowConf && <line /* nét đứt mờ 0.06 chồng lên, thay cho gạch chéo thật */ strokeDasharray="60 40" opacity={0.06} />}
          </g>
        );
      })}
    </g>
  </svg>
  <WallThicknessLegend state="success" />
  <ZoomCluster />
  <MiniMap />
</div>
```

**Cảnh báo quan trọng về ví dụ này**: story vẽ tường bằng MỘT ĐƯỜNG THẲNG
(`<line>`) có `strokeWidth = độ dày`, KHÔNG dùng `resolveWallShapes` — nó lấy dữ liệu
từ `MOCK_SPATIAL_PROJECT` (kiểu `types/spatial.ts`, tường có `from`/`to` là id đỉnh, độ
dày rời rạc), không phải từ `domain/walls`. Đây là cách vẽ **đơn giản hoá cho demo**,
không phải khuôn mẫu "đúng" theo mục A của hợp đồng này — nó không hàn góc tường (không
giao điểm), chỉ overlay một nét đứt mờ thay cho gạch chéo thật (không phải
`repeating-linear-gradient`). Worker canvas **phải theo kết luận mục A** (vẽ polygon từ
`resolveWallShapes`), không lặp lại cách vẽ line-with-strokeWidth của story này.

---

## D. Tô màu (P-06) và chú giải (P-07) — `src/lib/coloring/`

### `modes.ts` — chép nguyên các export cần thiết

```ts
// modes.ts:85-98
export interface PaintSubject {
  readonly id: string;
  readonly levelId: LevelId | null;
  readonly review: ReviewMetadata;
  readonly usage: RoomUsage | null;
  readonly areaM2: SquareMetres | null;
  readonly worstSeverity: RuleSeverity | null;
}

// modes.ts:106-118
export interface ColoringContext {
  readonly subjects: readonly PaintSubject[];
  readonly levelIds?: readonly LevelId[];
}

// modes.ts:125-136
export const COLORING_MODE_IDS = [
  'default',
  'roomUsage',
  'area',
  'aiConfidence',
  'reviewState',
  'violationSeverity',
  'level',
] as const;
export type ColoringModeId = (typeof COLORING_MODE_IDS)[number];

// modes.ts:139-143
export interface ColoringBand {
  readonly token: ColorTokenName;
  readonly label: string;
}

// modes.ts:146-165
export interface ColoringMode {
  readonly id: ColoringModeId;
  readonly label: string;
  readonly bands: readonly ColoringBand[];
  readonly breaks: readonly number[];
  readonly paint: (subject: PaintSubject) => ColorTokenName;
}

// modes.ts:168-176
export const COLORING_MODE_LABELS: Readonly<Record<ColoringModeId, string>> = {
  default: 'mặc định',
  roomUsage: 'theo công năng phòng',
  area: 'theo diện tích',
  aiConfidence: 'theo độ tin cậy AI',
  reviewState: 'theo trạng thái kiểm tra',
  violationSeverity: 'theo mức vi phạm',
  level: 'theo tầng',
};

// modes.ts:547-564
export function createColoringMode(id: ColoringModeId, context: ColoringContext): ColoringMode {
  switch (id) {
    case 'default': return createDefaultMode();
    case 'roomUsage': return createRoomUsageMode();
    case 'area': return createAreaMode(context.subjects);
    case 'aiConfidence': return createAiConfidenceMode(context.subjects);
    case 'reviewState': return createReviewStateMode();
    case 'violationSeverity': return createViolationSeverityMode();
    case 'level': return createLevelMode(context.subjects, context.levelIds);
  }
}

// modes.ts:567-569
export function createColoringModes(context: ColoringContext): readonly ColoringMode[] {
  return COLORING_MODE_IDS.map((id) => createColoringMode(id, context));
}
```

### `scales.ts` — chép nguyên

```ts
// scales.ts:62-129 (danh sách rút gọn — đầy đủ 62 token, xem file thật)
export const COLOR_TOKEN_NAMES = [
  '--accent', '--accent-hover', '--accent-active', '--accent-wash',
  '--bg-app', '--bg-surface', '--bg-sunken', '--bg-hover', '--bg-overlay', '--bg-selected', '--bg-flash',
  '--border-default', '--text-primary', '--text-secondary', '--text-muted',
  '--danger-tint', '--danger-border',
  '--state-verified', '--state-verified-text', '--state-verified-tint',
  '--state-attention', '--state-attention-text', '--state-attention-tint',
  '--state-violation', '--state-violation-text', '--state-violation-tint',
  '--wall-110', '--wall-220', '--wall-330', '--wall-idle',
  '--canvas-2d', '--canvas-2d-grid', '--canvas-3d', '--canvas-3d-ground', '--canvas-3d-horizon',
  /* + 14 token --scene-* (bối cảnh 3D màn đăng nhập), 7 token --white/--black/--shadow-color-* */
] as const;
export type ColorTokenName = (typeof COLOR_TOKEN_NAMES)[number];

// scales.ts:138-140
export function isColorTokenName(value: string): value is ColorTokenName {
  return (COLOR_TOKEN_NAMES as readonly string[]).includes(value);
}

// scales.ts:152
export const MAX_SCALE_STEPS = 5;

// scales.ts:162-168
export const SEQUENTIAL_RAMP = [
  '--bg-sunken', '--wall-idle', '--wall-110', '--wall-220', '--wall-330',
] as const satisfies readonly ColorTokenName[];

// scales.ts:179
export const UNPAINTED_TOKEN: ColorTokenName = '--border-default';

// scales.ts:192-208
export interface QuantileScale {
  readonly breaks: readonly number[];
  readonly bandCount: number;
  readonly tokens: readonly ColorTokenName[];
  readonly bandOf: (value: number) => number;
  readonly tokenOf: (value: number) => ColorTokenName;
}

// scales.ts:255-270
export function quantileBreaks(values: readonly number[], bandCount: number): number[] { /* … */ }

// scales.ts:278-288
export function bandIndexOf(value: number, breaks: readonly number[]): number { /* … */ }

// scales.ts:308-332
export function createQuantileScale(
  values: readonly number[],
  options: QuantileScaleOptions = {},
): QuantileScale { /* … */ }

// scales.ts:345-349
export function createLookupScale<Key extends string>(
  table: Readonly<Record<Key, ColorTokenName>>,
): (key: Key | null | undefined) => ColorTokenName {
  return (key) => (key === null || key === undefined ? UNPAINTED_TOKEN : table[key]);
}
```

### `legend.ts` — chép nguyên

```ts
// legend.ts:441-488
export function generateLegend(
  mode: ColoringMode,
  subjects: readonly PaintSubject[],
  palette: Palette = {},
): Legend { /* … */ }

// legend.ts:376-392
export interface Legend {
  readonly modeId: ColoringModeId;
  readonly label: string;
  readonly items: readonly LegendItem[];
  readonly unpaintedCount: number;
  readonly unpaintedToken: ColorTokenName;
  readonly surfaceToken: ColorTokenName;
}

// legend.ts:355-373
export interface LegendItem {
  readonly token: ColorTokenName;
  readonly label: string;
  readonly range: string;
  readonly count: number;
  readonly labelPlacement: LabelPlacement;
  readonly labelBackgroundToken: ColorTokenName;
  readonly labelTextToken: ColorTokenName;
}

// legend.ts:78
export type Palette = Readonly<Partial<Record<ColorTokenName, string>>>;

// legend.ts:146-159
export function parsePalette(cssText: string): Palette { /* … */ }

// legend.ts:292,295-301,310-348
export type LabelPlacement = 'onSwatch' | 'besideSwatch';
export interface LabelTreatment {
  readonly placement: LabelPlacement;
  readonly backgroundToken: ColorTokenName;
  readonly textToken: ColorTokenName;
  readonly ratio: number;
}
export function resolveLabelTreatment(swatchToken: ColorTokenName, palette: Palette): LabelTreatment { /* … */ }

// legend.ts:501,504,507,516-519
export const DIMMED_OPACITY = 0.12;
export const FOCUSED_OPACITY = 1;
export type Emphasis = 'focused' | 'dimmed';
export interface Appearance {
  readonly token: ColorTokenName;
  readonly opacity: number;
}

// legend.ts:540-542
export function applyEmphasis(token: ColorTokenName, emphasis: Emphasis): Appearance {
  return { token, opacity: emphasis === 'dimmed' ? DIMMED_OPACITY : FOCUSED_OPACITY };
}

// legend.ts:550-558
export function applyEmphasisTo(
  mode: ColoringMode,
  subjects: readonly PaintSubject[],
  isRelevant: (subject: PaintSubject) => boolean,
): Appearance[] { /* … */ }

// legend.ts:179-185
export function relativeLuminance(color: ParsedColor): number {
  return 0.2126 * linearise(color.red) + 0.7152 * linearise(color.green) + 0.0722 * linearise(color.blue);
}

// legend.ts:197-209
export function contrastRatio(first: string, second: string): number { /* … */ }

// legend.ts:234-245
export function checkContrast(
  backgroundToken: ColorTokenName,
  textToken: ColorTokenName,
  palette: Palette,
  threshold: number = CONTRAST_MINIMUM_BODY,
): ContrastCheck { /* … */ }
```

### Trả lời: tô tường theo ĐỘ DÀY dùng mode nào?

> **Cập nhật (mục 0.2)**: với màn `WallLayerReview` cụ thể, câu hỏi này hoá ra không áp
> dụng — đa giác tường ở màn đó tô theo `ViewStatusCode` (trạng thái duyệt), không theo
> độ dày. Phần dưới đây vẫn đúng như một khảo sát chung của `src/lib/coloring` cho MÀN
> KHÁC có nhu cầu tô theo độ dày thật.

**NOT FOUND.** `COLORING_MODE_IDS` chỉ có bảy giá trị:
`default, roomUsage, area, aiConfidence, reviewState, violationSeverity, level`
(`modes.ts:125-133`) — **không có mode nào theo độ dày tường**. Bảy mode này tô theo
*câu hỏi nghiệp vụ* (P-06 ở tầng `src/lib/coloring`), còn "tô theo độ dày" là một nhu
cầu hiển thị *vật liệu* nằm ở tầng khác: **`materialMap.wallStrokeToken(thickness)`**
(mục C) đã làm đúng việc này rồi, độc lập với `src/lib/coloring`. Hai hệ thống tô màu
này KHÔNG hợp nhất — canvas 2D tô tường theo độ dày qua `materialMap`, còn khi người
dùng chọn một `ColoringModeId` khác (ví dụ `aiConfidence`) thì `mode.paint(subject)` từ
`src/lib/coloring` mới là nguồn màu. Worker canvas cần biết: **hai nguồn tô này không
bao giờ chồng nhau trên cùng một đối tượng cùng lúc** — hoặc màn ở chế độ "xem theo độ
dày" (mặc định, dùng `materialMap`), hoặc ở một `colorMode` khác (dùng
`src/lib/coloring`), không trộn.

`createLookupScale` **CÓ dùng được** để ánh xạ ba độ dày sang ba token, chữ ký:
```ts
export function createLookupScale<Key extends string>(
  table: Readonly<Record<Key, ColorTokenName>>,
): (key: Key | null | undefined) => ColorTokenName
```
Ví dụ gọi được: `createLookupScale<110 | 220 | 330>({ 110: '--wall-110', 220: '--wall-220', 330: '--wall-330' })`
— nhưng đây chỉ là một cách viết khác của đúng bảng mà `wallStrokeToken` đã cứng sẵn;
không có lý do dùng `createLookupScale` thay vì gọi thẳng `wallStrokeToken` (đã có, đã
test, đã xử lý case `CONCRETE_COLUMN` và mặc định `idle`).

### Trả lời: `aiConfidence` tô theo `subject.review.confidence`?

**Xác nhận đúng.**
```ts
// modes.ts:416-429
function createAiConfidenceMode(subjects: readonly PaintSubject[]): ColoringMode {
  const scale = createQuantileScale(
    readingsOf(subjects, (subject) => subject.review.confidence),
    { direction: 'descending' },
  );

  return {
    id: 'aiConfidence',
    label: COLORING_MODE_LABELS.aiConfidence,
    bands: rangeBands(scale, (value) => formatPercent(value, { fractionDigits: 0 })),
    breaks: scale.breaks,
    paint: (subject) => scale.tokenOf(subject.review.confidence),
  };
}
```
`direction: 'descending'` — mức tin cậy **thấp nhất** nhận token đậm nhất (mục đích: cái
cần kiểm tra phải nổi nhất, `modes.ts:406-414`). Không bậc nào của mode này là
`--state-verified` (A5 — xanh xác minh chỉ do người duyệt gán qua `reviewState` mode).

### Dựng `PaintSubject` từ một `Wall` của đồ thị spatial

`domain/spatial/types.ts`'s `Wall extends ReviewMetadata` mang `confidence`, `source`,
`reviewed` **trực tiếp trên chính nó** (không lồng trong `.review`), nên phải bọc lại:

```ts
const subject: PaintSubject = {
  id: wall.id,
  levelId: wall.levelId,
  review: { confidence: wall.confidence, source: wall.source, reviewed: wall.reviewed },
  usage: null,      // tường không có công năng phòng
  areaM2: null,     // tường không có diện tích
  worstSeverity: worstSeverityOf(violations.filter((v) => v.entityId === wall.id)),
  // worstSeverityOf: src/domain/rules/healthScore.ts:102
  // violations (Violation[], có entityId khớp id tường): src/domain/rules/registry.ts:134-139
};
```
`areaM2: null` và `usage: null` là **bắt buộc theo đúng chữ ký** (`SquareMetres | null`,
`RoomUsage | null`) — tường không đóng một diện tích và không có công năng phòng, đây
là sự thật domain chứ không phải giá trị "thiếu dữ liệu" (đọc kỹ comment `modes.ts:81-83`:
*"a wall has no floor area, and saying so with `areaM2: null` is a fact the mode can
act on"*).

---

## E. BA ĐỘ DÀY PHẢI PHÂN BIỆT ĐƯỢC KHI CHE HẾT CHỮ VÀ CHUYỂN ĐEN TRẮNG

> **Cập nhật (mục 0.2/0.3)**: với màn `WallLayerReview`, kênh màu (E.1, token
> `--wall-110/220/330`) KHÔNG áp dụng — màu đa giác ở màn đó là `ViewStatusCode`, và ba
> giá trị độ dày chuẩn thật là 100/220/300 (không phải 110/220/330). Kênh bề rộng hình
> học (E.2) vẫn đúng nguyên văn và là kênh phân biệt DUY NHẤT còn hoạt động cho màn này
> khi che hết chữ. E.1 vẫn là dữ liệu thật, giữ lại cho màn khác dùng đúng thang màu đó.

### E.1 — Ba token, giá trị thật, độ sáng tính thật

Giá trị hex lấy từ `src/styles/globals.css:180-183`:
```css
--wall-110: #B3ACA1;
--wall-220: #8A8377;
--wall-330: #5C564D;
--wall-idle: #CFCAC1;
```

Chạy đúng công thức `relativeLuminance` của `legend.ts:172-185`
(`linearise(c) = c/255 ≤ 0.03928 ? .../12.92 : ((.../1.055)+0.055)^2.4`,
`L = 0.2126R + 0.7152G + 0.0722B`) trên ba giá trị này:

| Token | Hex | Độ sáng tương đối (WCAG relativeLuminance) |
|---|---|---|
| `--wall-110` (110 mm) | `#B3ACA1` | **0,4166** |
| `--wall-220` (220 mm) | `#8A8377` | **0,2297** |
| `--wall-330` (330 mm) | `#5C564D` | **0,0947** |
| (`--wall-idle`, tham chiếu) | `#CFCAC1` | 0,5936 |

Ba con số 0,4166 / 0,2297 / 0,0947 cách nhau đủ xa và đơn điệu giảm dần theo độ dày
tăng dần — **phân biệt được rõ ràng** khi in đen trắng hay chuyển thang xám (mỗi bước
giảm gần một nửa).

### E.2 — Bề rộng nét vẽ là lớp phân biệt thứ hai (và là lớp chính khi in đen trắng tuyệt đối)

Vì đa giác tường (mục A) được vẽ **tô đầy theo đúng độ dày thật của tường**
(`resolveWallShapes` cắt outline rộng đúng `thicknessMm`), **bản thân bề rộng hình học
của đa giác đã phân biệt được ba loại tường** — một tường 300 mm luôn vẽ ra một dải
rộng gấp ~2,7 lần một tường 110 mm ở cùng tỉ lệ mm/px, bất kể màu gì. Với dữ liệu
100/220/300 mm cụ thể trong nghiệm thu: tỉ lệ bề rộng là 100:220:300 = 1 : 2,2 : 3 —
chênh lệch đủ để mắt thường phân biệt ở bất kỳ tỉ lệ zoom hợp lý nào (không cần đọc số).

**Kết luận bắt buộc**: màu (mục E.1) là lớp phân biệt **thứ nhất** khi màn hình còn màu;
bề rộng nét/vùng tô là lớp phân biệt **độc lập, luôn đúng** kể cả khi màu bị lược bỏ
hoàn toàn (in đen trắng tuyệt đối, không chuyển thang xám mà chỉ còn viền đen/trắng) —
vì bề rộng là hình học thật, không phải một cách biểu diễn của độ sáng. Hai lớp này
KHÔNG được hợp nhất thành một lớp duy nhất — mất bất kỳ lớp nào cũng làm hỏng nghiệm thu
"che hết chữ vẫn phân biệt được".

### E.3 — Cách worker canvas tự kiểm nghiệm thu

1. Dựng ba tường 100 mm, 220 mm, 300 mm trên cùng một canvas ở cùng một tỉ lệ mm/px.
2. Tô mỗi tường bằng `wallStrokeToken`/`wallFillToken` tương ứng (dùng mức 110/220/330
   sẵn có — 100/220/300 làm tròn về ba mức chuẩn của legend, xem "NOT FOUND" nếu 100 mm
   không map tròn vào 110).
3. Chụp canvas, chuyển ảnh sang thang xám (desaturate), che hết mọi nhãn chữ (ẩn toàn
   bộ text) — vẫn phải phân biệt được ba dải bằng mắt nhờ hai lớp E.1 (độ sáng khác
   nhau ≥ 0,09 mỗi bậc) và E.2 (bề rộng khác nhau).
4. Có thể viết test tự động: gọi `relativeLuminance(parseColor(palette['--wall-XXX']))`
   cho ba token, khẳng định `wall330 < wall220 < wall110` và khoảng cách mỗi bậc
   `> 0,05` (biên rộng rãi so với 0,09–0,32 thực đo); riêng phần bề rộng thì khẳng định
   `outline` (mục A) của ba tường có bề rộng hình học tỉ lệ đúng với `thicknessMm`.

---

## F. Gạch chéo cho mục dưới ngưỡng tin cậy

### F.1 — Đã có mẫu gạch chéo trong repo chưa?

**CÓ, một chỗ** — `src/screens/pipeline/ScaleCalibration/ScaleCalibrationCanvas.tsx:365-367`:
```ts
backgroundImage: row.isLowConfidence
  ? 'repeating-linear-gradient(45deg, var(--state-attention) 0 1px, transparent 1px 6px)'
  : undefined,
```
Đây là kỹ thuật CSS `repeating-linear-gradient` ở 45°, dùng **token màu**
(`var(--state-attention)`), đúng tinh thần A1. Tham số ở đây (nét 1px, chu kỳ 6px, không
có opacity riêng — độ mờ đến từ việc line chiếm 1/6 diện tích) **không khớp đặc số của
đặc tả** ("nét 2px, 6% độ mờ") — đây là một ví dụ kỹ thuật để tham khảo cách viết CSS,
không phải component dùng lại nguyên.

**Một chỗ khác có Ý ĐỊNH nhưng CHƯA cài đặt**: `src/components/ui/ConfidenceMeter.tsx:50`
chỉ có comment rỗng `{/* Diagonal stripe for attention state — 6% opacity 45° pattern */}`
— không có code nào bên dưới. Đừng coi đây là ví dụ sống; nó là một việc chưa làm xong
of một component khác, không thuộc phạm vi sửa của worker này (`src/components/ui/**`
không nằm trong file được phép sửa).

`materialMap.isLowConfidence(confidence)` (`materialMap.ts:144-146`) là **hàm cổng
đúng** để quyết định "có gạch chéo hay không" — nó gọi `confidenceLevel` từ
`@/lib/format/semantic` và trả `true` khi mức là `'needsReview'` (ngưỡng < 0,70). Test
hồi quy đã có: `src/components/canvas/materialMap.test.ts` ("hatches only below the
'cần kiểm tra' boundary").

### F.2 — Kết luận cho worker canvas

Không cần ghi NOT FOUND cho *khái niệm* (đã có tiền lệ CSS + hàm cổng đúng), nhưng
**mẫu gạch chéo đúng tham số đặc tả (2px, 6% mờ) chưa tồn tại** và phải được vẽ mới,
trong file riêng của màn (được phép — nằm trong thư mục màn, không phải
`src/lib`/`src/components`). Viết bằng `repeating-linear-gradient` CSS (khớp mẫu
`ScaleCalibrationCanvas`) hoặc canvas `createPattern` nếu vẽ trên `<canvas>` thật — cả
hai đều PHẢI dùng `var(--state-attention)` (token, qua `materialMap` nếu vẽ SVG/DOM),
KHÔNG hex. Gọi `isLowConfidence(wall.review.confidence)` (hoặc tương đương) để quyết
định bật/tắt — không tự đặt lại ngưỡng 0,70.

### F.3 — "Chấm cần chú ý" dùng component nào

`src/components/ui/Badge.tsx` — biến thể chính xác: **`<Badge variant="attention">`**.
```ts
// Badge.tsx:9,18-30,42-47
type BadgeVariant = 'verified' | 'attention' | 'violation' | 'neutral';

const dotStyles: Record<BadgeVariant, string> = {
  verified: 'bg-state-verified',
  attention: 'bg-state-attention',
  violation: 'bg-state-violation',
  neutral:   'bg-text-muted',
};
// mặc định noDot=false → LUÔN vẽ chấm tròn 6×6px (w-1.5 h-1.5 rounded-full) trước nội dung
{!noDot && <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', dotStyles[variant])} aria-hidden="true" />}
```
`<Badge variant="attention">` mặc định (`noDot` không truyền) tự vẽ đúng "chấm cần chú
ý" bằng token `bg-state-attention` — không cần tự vẽ chấm riêng. Lưu ý: `Badge` thuộc
`src/components/ui/**`, **không thuộc file được phép sửa**; canvas chỉ được **dùng**
nó (import), không sửa nó.

---

## G. Ảnh bản vẽ gốc nằm dưới ở 20% độ mờ

### G.1 — Cách lấy ảnh bản vẽ gốc

Query key: `queryKeys.drawing.byFloor(floorId)` (`src/lib/query/queryKeys.ts:54,68`,
domain `'drawing'`, root `['drawing', 'byFloor']`). Schema thật của một `Drawing`
(`src/api/schemas/index.ts:115-139`):
```ts
export const DrawingSchema = z.object({
  heightMm: positiveMmIntegerSchema,
  id: idSchema,
  name: z.string().min(1),
  scale: z.number().positive().optional(),
  uploadedAt: isoDateTimeSchema,
  uploaderId: idSchema,
  url: z.string().url(),
  widthMm: positiveMmIntegerSchema,
}).strict()...
export type Drawing = z.infer<typeof DrawingSchema>;
```
`Drawing.url` là URL ảnh gốc. Một ví dụ gateway thật đọc đúng dữ liệu này —
`ScaleDrawingSnapshot` (`src/screens/pipeline/ScaleCalibration/scaleCalibrationGateway.ts:118-126`):
```ts
export interface ScaleDrawingSnapshot {
  readonly floorId: string;
  readonly floorName: string;
  readonly imageUrl: string | null;
  readonly widthPx: Pixels | null;
  readonly heightPx: Pixels | null;
  readonly isWarped: boolean;
}
```
và cách dùng thật trong `<img>` (`ScaleCalibrationCanvas.tsx:341-348`):
```tsx
{canvas.imageUrl !== null ? (
  <img alt={canvas.altText} className="pointer-events-none block h-full w-full select-none object-contain"
       draggable={false} src={canvas.imageUrl} />
) : null}
```

### G.2 — Khả thi ra sao với Trạng thái 4 (Lỗi)?

**Hai nguồn dữ liệu tách rời**, đúng như đặc tả cần: ảnh gốc nằm ở
`queryKeys.drawing.byFloor(floorId)` (một `useQuery` riêng), còn dữ liệu hình học
(tường/phòng) nằm ở `queryKeys.space.byFloor(floorId)` / `queryKeys.room.byFloor(floorId)`
(`queryKeys.ts:56,58`) — **hai khoá cache độc lập, hai request độc lập**. Bằng chứng
sống: `useScaleCalibration.ts:458-473` gọi `gateway.readFloorDrawing(...)` (ảnh) và
riêng `gateway.readDimensionStrings/...` (dữ liệu suy luận) trong cùng một `queryFn`
nhưng là các lời gọi `Promise.all` tách biệt — nếu tách thành hai `useQuery` riêng (như
canvas thật nên làm), ảnh tải xong và hiện được ngay cả khi truy vấn hình học lỗi. Đây
chính là cách đạt A11 trạng thái 4: `<img src={drawing.imageUrl}>` render độc lập với
khối hiển thị tường/phòng; khối đó lỗi thì chỉ nó rơi vào trạng thái lỗi (thông báo +
nút thử lại), còn `<img>` vẫn đứng nguyên dưới lớp overlay.

Cách đặt độ mờ 20%: đây là style thuần (`opacity: 0.2` qua class Tailwind hoặc token —
**0,2 không phải màu nên không phạm A1**; nhưng nếu có token opacity chuẩn trong dự án
thì ưu tiên dùng, xem "NOT FOUND" — chưa grep thấy hằng số opacity 20% nào được đặt tên
sẵn, đây là số layout thường được chấp nhận viết trực tiếp trong style, không phải
"raw color" hay "raw number nghiệp vụ" mà A15/`no-raw-number` nhắm tới).

---

## H. Vẽ bằng gì

### Kết luận dứt khoát: **SVG**, không phải `<canvas>` 2D, không phải thuần div CSS.

Bằng chứng từ chính bốn nơi đặc tả yêu cầu đọc:

- `GridLayer.tsx:61-118` — gốc là `<svg>` với `<defs><pattern>...</pattern></defs>` rồi
  `<rect fill="url(#...)">`. Không một `<canvas>` nào.
- `SelectionHalo.tsx` — thuần `<div>` với `style` tuyệt đối (outline/background), không
  SVG cũng không canvas — đây là **thành phần overlay UI** (khung chọn), khác với lớp
  vẽ hình học.
- `MiniMap.tsx` — khung ngoài là `<div>`, nhưng để trống `children` cho "nội dung bản vẽ
  thu nhỏ (SVG hoặc canvas)" (comment dòng 7) — bản thân component không áp đặt, nhưng
  mọi nơi thật sự vẽ hình học trong repo (xem dưới) đều chọn SVG.
- `CanvasIntegration.stories.tsx:80-120` — vẽ tường bằng `<svg><g transform=...><line>`.
- `CadLayerPreviewCanvas.tsx` (ví dụ canvas 2D "thật" gần nhất trong một màn hoàn
  chỉnh, `screens/pipeline/CadBranchConfirm/`) — cũng SVG, dùng `<polygon points="...">`
  dựng từ toạ độ mm được `vector-effect="non-scaling-stroke"` giữ nét mảnh khi zoom.

**Không nơi nào trong repo dùng `<canvas>` 2D context (`getContext('2d')`) để vẽ mặt
bằng.** `<canvas>` (thẻ HTML) chỉ xuất hiện cho render 3D qua three.js
(`src/lib/three/present/**`), không liên quan mặt bằng 2D. Worker canvas lớp 2 **phải
dùng SVG** cho lớp vẽ hình học 2D, đúng khuôn đã có — không phát minh cách vẽ mới bằng
`<canvas>` context 2D.

### Ràng buộc khả năng tiếp cận (R-72)

Ví dụ thật, đã qua `expectAccessible`:
```tsx
// src/screens/pipeline/CadBranchConfirm/CadLayerPreviewCanvas.tsx:256-260
<svg
  aria-label={PREVIEW_CANVAS_ARIA_LABEL}
  ...
  role="img"
  ...
>
```
và test tương ứng:
```ts
// src/screens/pipeline/CadBranchConfirm/CadBranchConfirm.test.tsx:301-310
it('đi qua expectAccessible ở trạng thái đầy đủ nhất', () => {
  ...
  expectAccessible(container, { ignoreSelector: '[role="dialog"]' });
});
```
Một ví dụ khác đã đúng khuôn: `CanvasIntegration.stories.tsx:83`
`<svg aria-label={"Bản vẽ tầng 1 — ${walls.length} tường"}>` (thiếu `role="img"` ở đây —
**không chép theo bản story này**, chép theo `CadLayerPreviewCanvas` có cả `role="img"`
lẫn `aria-label`).

**Kết luận**: gốc `<svg>` của canvas vẽ mặt bằng phải có `role="img"` +
`aria-label="<mô tả tiếng Việt, có số liệu>"` (ví dụ: `"Mặt bằng tầng 1 — 12 tường, 4
phòng"`). Overlay tương tác được (nút, item menu, thanh trượt độ dày...) giữ role gốc
của thẻ HTML thật (`button`, `menuitem`...) như `ContextMenu`/`ZoomCluster` đã làm —
không gắn `role="img"` lên toàn bộ canvas nếu bên trong có phần tử tương tác được, vì
`role="img"` biến toàn bộ cây con thành một khối không thể focus — nếu canvas cần vừa
mô tả tổng thể vừa cho tương tác từng tường (click chọn), dùng `role="application"` hay
tách phần tương tác ra khỏi `<svg role="img">` là quyết định thiết kế cụ thể của màn,
không phải kết luận chung mục này khẳng định được — ghi làm câu hỏi mở, không phải luật.

---

## NOT FOUND — cái gì còn thiếu

1. **BA kiểu `Wall` khác nhau tồn tại song song — ĐÃ GIẢI QUYẾT qua escalation, xem mục
   0.** Tóm tắt kết quả (chi tiết + trích dẫn ở mục 0.4):
   - Nguồn dữ liệu tường thật của canvas là `src/domain/spatial/types.ts`'s `Wall`
     (đồ thị spatial — store giữ nó, lệnh S-07 sửa nó, mang review metadata).
   - `src/types/spatial.ts`'s `Wall` (wire cũ, snake_case, dùng bởi `materialMap`/story
     demo) **KHÔNG dùng** cho dữ liệu thật — nó không mang được trạng thái duyệt.
   - Adapter sang `domain/walls/types.ts`'s `Wall` (kiểu `resolveWallShapes` cần) đã có
     sẵn: `toSolidWall(wall, level)` tại `src/lib/commands/business/shared.ts:307`.
     Không viết adapter mới, không sửa `src/domain`.
   - Việc gọi `resolveWallShapes`/`toSolidWall` là của **hook** (`useWallLayerReview.ts`),
     không phải của view canvas — xem mục 0.1. View canvas chỉ nhận
     `WallShapeViewModel[]` đã có `outline` sẵn.

2. **Độ dày chuẩn của điều khiển ba lựa chọn là 100/220/300 mm, KHÔNG phải 110/220/330 mm
   như bản khảo sát ban đầu suy đoán từ `materialMap`/`types/spatial.ts` — ĐÃ SỬA, xem
   mục 0.2–0.3.** Nguồn thật: `WALL_THICKNESS_CHOICES = [100, 220, 300]`
   (`src/screens/qc/WallLayerReview/types.ts:160`, khớp `STANDARD_THICKNESSES_MM` của
   `domain/walls/cleanup.ts:70-72`). `materialMap.wallStrokeToken` dùng bộ giá trị khác
   (110/220/330) và **không nhận được** 100/300 (lỗi kiểu, mục 0.3) — không được gọi hàm
   đó để tô theo độ dày ở màn này.

3. **Màu tô đa giác tường KHÔNG theo độ dày — theo `ViewStatusCode`
   (verified/attention/violation/neutral) — ĐÃ SỬA, xem mục 0.2.** Không có mode tô theo
   độ dày trong `src/lib/coloring` (đúng như bản khảo sát ban đầu ghi nhận), nhưng với
   màn `WallLayerReview` cụ thể, đây không phải lỗ hổng — màn này không cần một mode như
   vậy, vì độ dày truyền đạt qua bề rộng hình học + nhãn chữ, không qua màu.

4. **Không có mẫu gạch chéo đúng tham số đặc tả (2px/6% mờ)** — có tiền lệ kỹ thuật gần
   đúng (`ScaleCalibrationCanvas.tsx:366`) nhưng tham số khác; phải viết mới trong file
   của màn (được phép). Vẫn NOT FOUND, không có gì mới thay đổi kết luận này.

5. **Không tìm thấy hằng số opacity "20%" đặt tên sẵn cho lớp ảnh gốc** dưới các lớp dữ
   liệu — `DIMMED_OPACITY = 0.12` (`legend.ts:501`) là hằng số gần nhất nhưng dùng cho
   mục đích khác. Không nghiêm trọng — 0,2 là số layout viết trực tiếp được trong style.

6. **`useCanvasViewport` (px, cục bộ) và `store/viewSlice` (mm + zoom, toàn cục,
   persist) không được nối với nhau ở đâu cả.** `WallLayerCanvasProps` (mục 0.1) không
   có trường pan/zoom nào cả — bản thân màn `WallLayerReview` có thể không cần state
   pan/zoom cục bộ phức tạp; nếu cần, worker layer 2 tự quyết, không có khuôn sẵn.

7. **File nguồn của mục 0 (`src/screens/qc/WallLayerReview/types.ts`) hiện CHƯA COMMIT**,
   sống trong worktree song song `wlr-scaffold` (nhánh `mungvu2004/wlr-scaffold`). Nội
   dung trích dẫn ở mục 0 là đọc thật tại thời điểm khảo sát (2025-08-31), nhưng có thể
   đổi trước khi merge — worker lớp 2 phải tự đọc lại file đó khi bắt đầu việc, không
   chỉ tin tưởng nguyên văn trích ở đây.

---

## KẾT LUẬN CHO WORKER CANVAS

0. **Đọc mục 0 trước tiên.** Hợp đồng props L1 thật của màn (`src/screens/qc/WallLayerReview/types.ts`,
   hiện chưa commit, ở worktree `wlr-scaffold`) đã tồn tại và thắng mọi suy luận tổng
   quát bên dưới khi hai bên khác nhau. Tự đọc lại file đó khi bắt đầu việc thật —
   nó có thể đổi trước khi merge vào nhánh của bạn.
1. **Nếu bạn viết view (`WallLayerReviewCanvas.tsx`)**: bạn KHÔNG gọi `resolveWallShapes`.
   Bạn nhận `shapes: WallShapeViewModel[]` (đã có `outline: readonly Point[]`, tính sẵn
   bằng mm) và `millimetresPerPixel: MillimetresPerPixel` qua props
   (`WallLayerCanvasProps`, mục 0.1). Việc của bạn: đổi từng điểm mm→px rồi vẽ SVG
   `<polygon>`. Tuyệt đối không tự tính offset/giao điểm/pháp tuyến — việc đó hook đã
   làm xong.
2. **Nếu bạn viết hook (`useWallLayerReview.ts`)**: đường đi là
   `graphWalls.map(w => toSolidWall(w, level))` rồi `resolveWallShapes(solids)`
   (`toSolidWall` tại `src/lib/commands/business/shared.ts:307`, đã có sẵn — không viết
   adapter mới, không sửa `src/domain`). Chi tiết đầy đủ về `resolveWallShapes` ở mục A.
3. Đổi mm→px bằng `scaleFromRatio(level.scaleMillimetresPerPixel).millimetresToPixels(...)`
   (`domain/units/scale.ts`) — phép nhân thuần, được phép. `scaleMillimetresPerPixel`
   là `undefined` thì đừng đoán số 12; xử lý như một trong bảy trạng thái (A11).
4. Chuỗi "12 mm/px" ở `StatusBar` phải do **màn** tự tính bằng `formatScaleDensity`
   (`lib/format/measure.ts`) rồi truyền prop xuống — `AppShell` hiện chỉ có giá trị
   placeholder cứng, đừng coi đó là nguồn thật.
5. Mọi component trong `src/components/canvas/` nhận toạ độ **px đã quy đổi sẵn**
   (`SelectionHalo`, `MeasurementLabel`) — không component nào tự làm việc mm→px. Không
   props interface nào ở đó có từ khoá `export`; nếu cần type ở ngoài phải tự suy ra.
   `WallLayerReviewCanvas.tsx` không nhất thiết phải dùng các component này — nó có
   props riêng, tự quyết (nhưng vẫn không được phát minh cách vẽ mới ngoài SVG, mục 6).
6. Vẽ hình học 2D bằng **SVG** — đúng khuôn `GridLayer`/`CadLayerPreviewCanvas`, không
   dùng `<canvas>` context 2D. Gốc SVG cần `role="img"` + `aria-label` tiếng Việt mô tả
   số liệu (không chép theo `TransformGizmo`'s nhãn tiếng Anh — đó là lỗi có sẵn).
7. **Tô đa giác tường theo `statusCode: ViewStatusCode`** (verified/attention/violation/neutral,
   `WallShapeViewModel.statusCode`, mục 0.2) — KHÔNG theo độ dày. `materialMap.wallStrokeToken`
   dùng bộ giá trị độ dày khác (110/220/330) và **không nhận được** ba giá trị chuẩn thật
   (100/220/300, `WALL_THICKNESS_CHOICES`) — lỗi kiểu nếu gọi, xem mục 0.3. Ánh xạ
   `statusCode → token` do view tự quyết (gợi ý: cùng vựng bốn token mà `Badge`'s
   `variant` dùng — `--state-verified/--state-attention/--state-violation`, và
   `neutral` dùng token trung tính như `--wall-idle`/`--text-primary`).
8. Bề rộng đa giác (tỉ lệ đúng theo `thicknessMm` thật) là kênh phân biệt ba độ dày khi
   che hết chữ (mục E.2 — vẫn đúng, độc lập với việc màu đổi ý nghĩa ở mục 7). Bảng độ
   sáng `--wall-110/220/330` ở mục E.1 (0,4166/0,2297/0,0947) là dữ liệu thật hữu ích cho
   MÀN KHÁC dùng đúng thang màu đó qua `materialMap` (ví dụ `CadLayerPreviewCanvas`),
   không áp dụng cho `WallLayerReviewCanvas`.
9. Gạch chéo mục dưới ngưỡng: cổng quyết định là `materialMap.isLowConfidence(confidence)`
   (đã có, đã test) — dùng cho panel/inspector; với đa giác canvas, `statusCode === 'attention'`
   (đã tính sẵn ở hook theo đúng logic tương tự) là cờ tương ứng. Mẫu vẽ 2px/6% mờ phải
   viết mới bằng `repeating-linear-gradient` dùng `var(--state-attention)`, theo tinh
   thần `ScaleCalibrationCanvas.tsx:366` nhưng đổi đúng tham số. "Chấm cần chú ý" =
   `<Badge variant="attention">` mặc định (không `noDot`).
10. Ảnh gốc: `queryKeys.drawing.byFloor(floorId)` (schema `Drawing.url`) là một truy vấn
    **tách rời** khỏi `queryKeys.space.byFloor`/`room.byFloor` — nhờ vậy trạng thái Lỗi
    (4) vẫn hiện được `<img>` khi truy vấn hình học hỏng. Khớp đúng
    `WallLayerCanvasProps.backgroundImageUrl: string | null` + `backgroundImageAlt`
    (mục 0.1) — hook cấp hai trường này, view chỉ vẽ `<img>`. Opacity 0,2 trực tiếp
    trong style của view.
11. Ba kiểu `Wall` (mục NOT FOUND cũ #1) đã giải quyết qua escalation — xem mục 0 và
    0.4 trước khi viết mã đụng tới dữ liệu tường thật.
