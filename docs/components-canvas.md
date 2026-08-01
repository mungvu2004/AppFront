# Canvas Components

Nhóm component dùng trên canvas QC 2D và trình xem 3D. Giao diện phải **tĩnh**, màu chỉ mang thông tin — không gradient, không neon, không glow.

---

## materialMap.ts

**Nguồn thật duy nhất** cho mọi màu sắc canvas. Mọi component muốn lấy màu phải gọi hàm từ file này.

```ts
import { wallStrokeToken, doorStrokeToken, axisStrokeToken, isLowConfidence } from './materialMap';

// Màu tường theo độ dày
wallStrokeToken(110)              // → 'var(--wall-110)'
wallStrokeToken(220)              // → 'var(--wall-220)'
wallStrokeToken(330)              // → 'var(--wall-330)'
wallStrokeToken('CONCRETE_COLUMN') // → 'var(--text-primary)'

// Trục gizmo — thang xám ấm, không màu bão hòa
axisStrokeToken('x') // → 'var(--wall-330)'
axisStrokeToken('y') // → 'var(--wall-220)'
axisStrokeToken('z') // → 'var(--wall-110)'

// Confidence
isLowConfidence(0.74) // → true  → thêm gạch chéo 45° 6%
isLowConfidence(0.75) // → false
```

### API đầy đủ

| Hàm | Trả về | Dùng cho |
|-----|--------|---------|
| `wallStrokeToken(thickness)` | CSS var | Stroke tường |
| `wallFillToken(thickness)` | CSS var | Fill tường (opacity thấp) |
| `roomFillToken()` | CSS var | Nền phòng (opacity 5%) |
| `roomStrokeToken()` | CSS var | Viền phòng |
| `doorStrokeToken()` | CSS var | Cửa đi |
| `doorFillToken()` | CSS var | Fill cửa |
| `windowStrokeToken()` | CSS var | Cửa sổ |
| `furnitureStrokeToken()` | CSS var | Nội thất |
| `furnitureFillToken()` | CSS var | Nền nội thất |
| `dimensionStrokeToken()` | CSS var | Đường kích thước |
| `dimensionTextToken()` | CSS var | Chữ kích thước |
| `gridMinorToken()` | CSS var | Lưới nhỏ |
| `gridMajorToken()` | CSS var | Lưới lớn |
| `axisStrokeToken(axis)` | CSS var | Trục X/Y/Z |
| `selectionBorderToken()` | CSS var | Viền chọn |
| `selectionFillToken()` | CSS var | Nền chọn |
| `isLowConfidence(conf)` | boolean | confidence < 0.75 |

---

## GridLayer

Lưới kỹ thuật 2D. Dùng SVG `<pattern>` — không tính hình học trong component.

```tsx
<GridLayer
  width={1440}
  height={900}
  zoom={1}           // 1.0 = 100%
  offsetX={panX}     // px, để đồng bộ lưới với pan
  offsetY={panY}
  scaleRatioMmPerPx={12}
/>
```

| Prop | Kiểu | Mặc định | Mô tả |
|------|------|----------|-------|
| `width` | `number` | — | Chiều rộng canvas (px) |
| `height` | `number` | — | Chiều cao canvas (px) |
| `zoom` | `number` | `1` | Zoom level |
| `offsetX` | `number` | `0` | Pan offset X (px) |
| `offsetY` | `number` | `0` | Pan offset Y (px) |
| `scaleRatioMmPerPx` | `number` | `12` | mm/px từ ProjectMetadata |
| `config` | `Partial<GridConfig>` | — | Override bước lưới |

**Ẩn lưới nhỏ:** tự động khi `zoom < 0.4` (40%).

---

## WallThicknessLegend

Chú giải 4 cấp độ dày tường. Hỗ trợ 7 trạng thái.

```tsx
<WallThicknessLegend
  state="success"
  availableLevels={[110, 220, 330, 'CONCRETE_COLUMN']}
/>
```

| Prop | Kiểu | Mặc định | Mô tả |
|------|------|----------|-------|
| `state` | `'empty' \| 'loading' \| 'partial' \| 'error' \| 'success' \| 'no-permission' \| 'collapsed'` | `'success'` | Trạng thái hiển thị |
| `availableLevels` | `WallThickness[]` | tất cả | Cấp hiển thị khi `partial` |

**Ô màu:** tối đa 16×16 px, màu từ `wallStrokeToken()`.  
**Bấm để lọc:** toggle — bấm lại để xoá lọc.

---

## ZoomCluster

Nút zoom nổi góc dưới phải canvas.

```tsx
<ZoomCluster />
```

- Nền `bg-surface`, bóng `shadow-float`, bo `12px`
- Mờ 60% khi không hover → 100% khi hover
- Số phần trăm `font-mono` — bấm để về 100%
- Nút `−` / `+` bước 10%, Nút `⊠` vừa khung

---

## MiniMap

Bản đồ thu nhỏ 160×120.

```tsx
<MiniMap>
  {/* Nội dung thu nhỏ tuỳ chọn */}
</MiniMap>
```

- Viền hairline (`border-border-default`)
- Khung nhìn: `border-accent` 1px
- Mờ 60% khi không hover
- **Click-to-jump**: bấm vào bất kỳ điểm nào để nhảy vùng
- **Drag**: kéo khung nhìn

---

## MeasurementLabel

Nhãn kích thước mono 13px trên canvas.

```tsx
// Dùng cùng hook
const { state, startPoint, currentPoint, midPoint, distanceFormatted,
        startMeasurement, updateMeasurement, commitMeasurement } = useMeasurementLabel();

<MeasurementLabel
  state={state}
  startPoint={startPoint}
  currentPoint={currentPoint}
  midPoint={midPoint}
  distanceFormatted={distanceFormatted}
  isHidden={false}
/>
```

- Nền `bg-surface` **92% opacity**, bo **6px**
- Đường dấu hai đầu: tick marks vuông góc (8px) tại điểm đầu/cuối
- Đường đo dashed, màu từ `dimensionStrokeToken()`
- Số đo dùng `formatMm()` → dấu thập phân phẩy, đơn vị mm
- `isHidden=true` để tự ẩn khi chồng nhau

---

## SelectionHalo

Viền chọn trên phần tử canvas.

```tsx
<SelectionHalo
  x={80} y={80}
  width={200} height={120}
  isVisible={isVisible}
  variant="selected"    // hoặc 'hover'
  hasEntered={hasEntered}
/>
```

| Variant | Mô tả |
|---------|-------|
| `selected` | Viền accent **1,5px** + fill `accent-wash` 12% |
| `hover` | Viền accent **1px**, không fill |

- Xuất hiện với animation **120ms** `ease-out`
- Màu từ `selectionBorderToken()` và `selectionFillToken()`

---

## TransformGizmo

Tay kéo 3 trục X/Y/Z.

```tsx
<TransformGizmo
  cx={200}  // px — tâm gizmo trong canvas
  cy={150}
/>
```

- Handle: **8×8 bo-6**, nền `bg-surface`, viền accent khi active
- Trục X/Y/Z: thang xám ấm (`--wall-330 / --wall-220 / --wall-110`)
- Nhãn trục `font-mono`
- Số **delta mm** hiện khi đang kéo — dùng `formatMm()`
- `onPointerMove` tracking thực (screen delta × scaleRatio)

---

## ContextMenu

Menu ngữ cảnh mở tại chuột.

```tsx
const { isVisible, position, groups, openMenu, closeMenu } = useContextMenu();

// Mở:
openMenu(e.clientX, e.clientY, [
  {
    id: 'group1',
    items: [
      { id: 'copy', label: 'Sao chép', kbd: '⌘C', action: () => {} },
    ],
  },
]);

// Render:
<ContextMenu
  isVisible={isVisible}
  position={position}
  groups={groups}
  onClose={closeMenu}
/>
```

| Spec | Giá trị |
|------|---------|
| Rộng | 220px |
| Chiều cao dòng | 32px |
| Nhóm phân cách | `Separator` hairline |
| Phím tắt | `Kbd` bên phải |
| Animation | `animate-dropdown-open` 120ms |

---

## Quy tắc màu canvas

| Loại phần tử | Token màu |
|---|---|
| Tường 110 mm | `--wall-110` |
| Tường 220 mm | `--wall-220` |
| Tường 330 mm | `--wall-330` |
| Cột BTCT | `--text-primary` |
| Cửa đi | `--accent` |
| Cửa sổ | `--text-secondary` |
| Nội thất | `--text-muted` |
| Kích thước | `--accent` |
| Trục X | `--wall-330` (xám ấm đậm) |
| Trục Y | `--wall-220` (xám ấm trung) |
| Trục Z | `--wall-110` (xám ấm nhạt) |
| Nền phòng | `--bg-sunken` opacity 5% |
| Lưới nhỏ | `--canvas-2d-grid` |
| Lưới lớn | `--border-default` |

> **Confidence < 0,75:** thêm gạch chéo 45° opacity 6%.

---

## Definition of Done — Checklist

| # | Điều kiện | Trạng thái |
|---|-----------|-----------|
| 1 | Không có hex/rgb/hsl trong `src/components/canvas` (trừ materialMap.ts) | ✓ |
| 2 | 7 trạng thái đều có story | ✓ WallThicknessLegend |
| 3 | Bàn phím 100%, focus ring đúng, Esc đóng lớp trên | ✓ ContextMenu, ZoomCluster |
| 4 | Tương phản ≥ 4,5:1 (token text-primary trên bg-surface) | ✓ |
| 5 | Animation chỉ dùng 5 mốc: 120/180/260/340/700ms | ✓ |
| 6 | Không gradient, không neon, không IN HOA nhãn UI | ✓ |
| 7 | Dùng đúng bộ dữ liệu mẫu chuẩn (48 tường mock) | ✓ Canvas48Walls |
| 8 | Story `Canvas48Walls` ở 1440px — mục tiêu ≥ 45fps | Cần đo |
| 9 | CI: lint, typecheck, unit, build | Cần chạy |
