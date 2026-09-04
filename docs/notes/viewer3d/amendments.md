# Bổ sung hợp đồng sau L1 — ĐỌC CÙNG NĂM FILE HỢP ĐỒNG KIA

Ba file hợp đồng L1 viết trước khi hai lỗ hổng dưới đây được vá. Chỗ nào chúng ghi
`NOT FOUND` cho ba mục này thì **file này thắng**.

## 1. Chuyển Spatial JSON sang đầu vào của R-01 — ĐÃ CÓ

`data-gateway-contract.md` mục C ghi `NOT FOUND`. Nay đã có, người dùng đã duyệt việc
thêm vào tầng domain:

```ts
// src/domain/spatial/toBuildFloorInput.ts:244
export function toBuildFloorInput(
  spatial: NormalizedSpatial,
  levelId: LevelId,
): BuildFloorInput | null
```

- Trả `null` khi đồ thị không có tầng mang id đó.
- Ném `Error` khi chỉ mục tầng trỏ vào entity không tồn tại, hoặc opening gọi tên tường
  không nằm trên tầng.
- Ném `RangeError` khi một số đo không hữu hạn, hoặc opening nằm trên tường dài bằng 0.
- `openings` luôn có mặt (kể cả rỗng). `slabThicknessMm` cố tình không đặt — độ dày là
  quyết định của builder (`SLAB_THICKNESS_MM`).
- Độ phủ: 100% cả bốn chỉ số, 28 test.

**Gọi nó một lần cho mỗi tầng.** Đừng tự viết lại phép chuyển nào, đừng tự bọc
`millimetres()` ở tầng màn — hàm này đã làm.

Ba quyết định nghiệp vụ đã chốt theo tiền lệ có sẵn, không phải phát minh mới:
`baseElevationMm = level.elevationMm`, `topElevationMm = level.elevationMm + wall.heightMm`
(`lib/commands/business/shared.ts:314-316`); `kind: 'envelope'` → `'glazed'` theo bảng
`SOLID_WALL_KIND` (`shared.ts:291-295`); `offsetMm` (mép trái) → `relativePosition` (tâm)
qua `relativePositionOf` (`shared.ts:335-336`).

## 2. Ghi fps trung bình (O-01) — ĐÃ CÓ

`data-gateway-contract.md` ghi `O-01 NOT FOUND`. Nay `src/lib/telemetry/events.ts` có
sự kiện `'scene.frame-rate'`:

```ts
{ name: 'scene.frame-rate', averageFps, durationMs, triangleCount }
// kiểu: SceneFrameRateEvent (events.ts:443)
```

`durationMs` bắt buộc để một giá trị trung bình lấy trong khoảnh khắc không bị đọc nhầm
thành trung bình cả phiên. Gửi **một** sự kiện lúc rời màn, không gửi theo chu kỳ.

## 3. Kéo được mặt phẳng cắt — ĐÃ CÓ

`shell-props-contract.md` mục C ghi `NOT FOUND` (vị trí cắt khoá cứng, không setter).
Nay `ViewerSceneActions` có thêm:

```ts
// viewerShellTypes.ts:276 — TUỲ CHỌN, tương thích ngược
setSectionPosition?(position: number): void;
```

Gọi từ khe cảnh: `actions.setSectionPosition?.(value)` — `actions` là **tham số thứ hai**
của `renderScene(frame, actions)`, luôn được truyền thật ở runtime
(`ViewerViewport.tsx:123`), bất kể chữ ký một tham số mà `ViewerShellContainerProps` khai.
Giá trị ngoài `[0, 1]` được vỏ tự kẹp qua `clampSectionPosition` — màn không cần kẹp lại.

## 4. 240ms KHÔNG tồn tại

Đặc tả màn ghi "240ms" hai lần. Thang chuyển động thật có đúng năm giá trị
(`src/lib/motion/tokens.ts:62-67` + `AMBIENT_LOOP_MS`): **120 · 180 · 260 · 340 · 700**.
Dùng slot `standard` = **260ms**. Cả V5 (view) và V7 (vỏ) đều đã chốt 260ms, nên mọi màn
khớp nhau. Viết số 240 vào mã sẽ bị `local/no-raw-duration` chặn ở mức `error`.
