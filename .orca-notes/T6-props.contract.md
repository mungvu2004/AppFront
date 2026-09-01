# T6 — Hợp đồng props MỞ RỘNG của canvas, panel trái và danh sách

> Điều phối viên đã **DUYỆT** cách mở rộng này (trả lời cho câu hỏi của T6).
> `src/screens/qc/ObjectLayerReview/objectLayerTypes.ts` là hợp đồng **đóng băng**
> của T4 và **không worker nào ở lớp này được sửa nó**. Ba interface dưới đây
> `extends` ba interface của T4, **thuần cộng thêm**, không đổi và không xoá một
> trường nào — đúng tiền lệ đã duyệt của màn anh em
> (`wallLayerHatch.ts`, `WallLayerCanvasViewProps extends WallLayerCanvasProps`).
>
> **Nguồn duy nhất của ba interface này là**
> `src/screens/qc/ObjectLayerReview/objectLayerSymbols.ts`. File này chỉ chép lại
> để T5 (phía sản xuất) và T8 (phía ghép màn) khỏi phải đọc cả module.

---

## Vì sao phải mở rộng — bốn lỗ hổng thật

| # | Thiếu ở đâu | Vì sao view không tự bù được |
|---|---|---|
| 1 | `ObjectLayerCanvasProps` không có **toạ độ vẽ** của một đối tượng | Một `AttachedReviewObject` chỉ mang `hostWallId` + `relativePosition` (0..1). Suy tâm ra từ `wallOutlines` là tìm tim tường rồi nội suy dọc nó — **hình học**, đúng thứ "màn không tự tính vị trí gắn" cấm. M-08 đã có sẵn `placeOnWall(wall, relativePosition)` (`src/domain/openings/attach.ts:312`) và **chỉ hook gọi được**, vì chỉ hook mới cầm `Wall` thật. |
| 2 | Canvas không có **trạng thái đang kéo** và hai số đo tới hai đầu tường | `MeasurementLabel` nhận `distanceFormatted` là **chuỗi**; A15 và `local/no-raw-number` đặt việc định dạng ở viewmodel. |
| 3 | Canvas không có callback nào để dựng **mục ContextMenu** | Hợp đồng gốc chỉ có `onSelect`/`onHover`. Một menu dựng từ hai callback đó không làm được gì. |
| 4 | `ObjectLayerLeftPanelProps` thiếu `furnitureAttentionNotice`; `ObjectLayerListProps` thiếu `onAttachToNearestWall` | Trạng thái 3b và hành động của badge cần chú ý là hai thứ đặc tả đòi, và view **không được tự tìm tường gần nhất** (CẤM TUYỆT ĐỐI). |

---

## Kiểu phụ

```ts
/** Một điểm trên ảnh bản vẽ, đơn vị pixel. */
export interface ObjectPointPx {
  readonly x: number;
  readonly y: number;
}

/** Một hình chữ nhật trên ảnh bản vẽ, đơn vị pixel. */
export interface ObjectRectPx {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
```

### `ObjectPlacementViewModel` — HOOK dựng, view chỉ đọc

```ts
export interface ObjectPlacementViewModel {
  readonly id: string;
  readonly layer: ObjectLayerId;
  readonly subtype: ObjectSubtype;
  readonly swing: SwingDirection;
  /** Tâm ký hiệu. `placeOnWall(wall, relativePosition)` của M-08; với một
   *  `OrphanReviewObject` thì là `tracedCentre`. */
  readonly centrePx: ObjectPointPx;
  /** Góc tường chủ, ĐỘ. 0 = tường nằm ngang, chiều dương cùng chiều `rotate()` của SVG. */
  readonly angleDeg: number;
  /** Bề rộng ký hiệu dọc tường, px. */
  readonly widthPx: number;
  /** Bề sâu ký hiệu vào phòng, px. Với một ô mở đây là BỀ DÀY TƯỜNG CHỦ, không
   *  phải `heightMm` (2.200 mm là chiều cao đứng, không phải bề sâu mặt bằng). */
  readonly depthPx: number;
  /** Hộp bao ĐÃ XOAY, px — `SelectionHalo` và bốn tay cầm 6px đọc thẳng. */
  readonly boundsPx: ObjectRectPx;
  /** Ví dụ `"#D-007"`. Ghép chuỗi ở view là định dạng, A15 cấm. */
  readonly codeLabel: string;
  readonly isOrphan: boolean;
}
```

### `ObjectDragMeasurement` — hai chuỗi ĐÃ ĐỊNH DẠNG

```ts
export interface ObjectDragMeasurement {
  readonly objectId: string;
  /** `MeasurementState` của `@/hooks/useMeasurementLabel`: 'idle' | 'measuring' | 'committed'. */
  readonly state: MeasurementState;
  readonly wallStartPx: ObjectPointPx;
  readonly wallEndPx: ObjectPointPx;
  readonly objectPx: ObjectPointPx;
  /** Điểm treo nhãn của hai đoạn — trung điểm là một phép tính, view không tính. */
  readonly midToStartPx: ObjectPointPx;
  readonly midToEndPx: ObjectPointPx;
  /** Ví dụ `"1.240 mm"`. */
  readonly distanceToStartLabel: string;
  /** Ví dụ `"860 mm"`. */
  readonly distanceToEndLabel: string;
}
```

---

## Ba interface mở rộng — chữ ký nguyên văn

```ts
export interface ObjectLayerCanvasViewProps extends ObjectLayerCanvasProps {
  /** 21 đối tượng đã đặt chỗ sẵn, cùng thứ tự với `objects`. */
  readonly placements: readonly ObjectPlacementViewModel[];
  /** `null` khi không ai đang kéo Slider vị trí. */
  readonly dragMeasurement: ObjectDragMeasurement | null;
  readonly onApprove?: ((objectId: string) => void) | undefined;
  readonly onDelete?: ((objectId: string) => void) | undefined;
  readonly onChangeSubtype?: ((objectId: string, subtype: ObjectSubtype) => void) | undefined;
  readonly onAttachToNearestWall?: ((objectId: string) => void) | undefined;
}

export interface ObjectLayerLeftPanelViewProps extends ObjectLayerLeftPanelProps {
  readonly furnitureAttentionNotice: string | null;
}

export interface ObjectLayerListViewProps extends ObjectLayerListProps {
  readonly onAttachToNearestWall: (objectId: string) => void;
}
```

Bốn callback của canvas là **tuỳ chọn**: ở trạng thái `forbidden` (vai Người
xem) không có hành động nào để mà mở menu, và vắng cả bốn thì bấm chuột phải
không mở gì — chứ không mở một menu rỗng.

---

## Ba ràng buộc T5 phải giữ khi cài đặt phía sản xuất

1. **`placements` phải cùng hệ toạ độ với `wallOutlines`.** Canvas vẽ `<svg>`
   **không `viewBox`**: một đơn vị SVG là một pixel của khung vẽ, và
   `SelectionHalo` (vốn là một `<div>` định vị tuyệt đối) nằm chồng lên đúng chỗ
   nhờ điều đó. Nên `HostWallOutlineViewModel.outline` cũng phải tới nơi **đã ở
   pixel bản vẽ**, không phải milimét — view không được quy đổi
   (`local/no-raw-number`).
2. **`placements.length` phải bằng `objects.length`.** Chú giải của canvas hiện
   `placements.length` làm tổng số đối tượng, và nghiệm thu đòi con số đó bằng
   21 giống ở cây lớp và ở danh sách. Đối tượng chưa gắn tường **cũng có** một
   phần tử (`isOrphan: true`, `centrePx` = `tracedCentre`) — CẤM TUYỆT ĐỐI
   không xoá nó.
3. **Không lệch tên trường.** Nếu T5 phải đổi một tên, đổi ở
   `objectLayerSymbols.ts` (T6 sở hữu) và báo lại, đừng khai một hình dạng thứ
   hai ở gateway.

---

## T8 ghép màn thế nào

```tsx
<ObjectLayerCanvas
  {...model /* phần ObjectLayerCanvasProps */}
  dragMeasurement={model.dragMeasurement}
  placements={model.placements}
  onApprove={model.onApprove}
  onAttachToNearestWall={model.onAttachToNearestWall}
  onChangeSubtype={model.onChangeSubtype}
  onDelete={model.onDelete}
/>

<ObjectLayerLeftPanel
  {...model /* phần ObjectLayerLeftPanelProps */}
  furnitureAttentionNotice={model.furnitureAttentionNotice}
/>

<ObjectLayerList
  {...model /* phần ObjectLayerListProps */}
  onAttachToNearestWall={model.onAttachToNearestWall}
/>
```

`ObjectLayerReviewModel` đã có sẵn `furnitureAttentionNotice`,
`onAttachToNearestWall`, `onApprove`, `onDelete`, `onChangeSubtype` — ba thứ T5
cần **thêm** vào kiểu trả về của hook là `placements`, `dragMeasurement`, và
`rows` (`ObjectListRowViewModel[]`, hợp đồng T4 đã khai).
