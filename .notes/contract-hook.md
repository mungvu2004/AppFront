# Contract — nửa logic của `FloorUploadScreen` (Layer 2)

Người viết view (`FloorUploadScreen.tsx`), container, stories và `index.ts` chỉ cần đọc
**file này**. Không cần mở `useFloorUploadScreen.ts`.

Ba file đã có trong `src/screens/upload/FloorUploadScreen/`:

| File | Vai |
|---|---|
| `types.ts` | Hợp đồng props. View nhập **duy nhất** từ đây. |
| `floorUploadGateway.ts` | Seam dữ liệu (`src/api` + `src/lib/upload` + mạng + hàng đợi ngoại tuyến). |
| `useFloorUploadScreen.ts` | Hook. Nhận gateway, trả đúng `FloorUploadScreenViewProps`. |
| `useFloorUploadScreen.test.ts` | 20 test cho hook, chạy xanh. |

Trạng thái cổng lúc bàn giao: `pnpm typecheck` **0 lỗi** · `pnpm lint` **0 lỗi, 0 cảnh báo**
· `pnpm test` **187/187 file, 3 837/3 837 test** (20 trong đó là của hook này).

---

## 1. View nhập gì

```ts
import type {
  FloorUploadScreenViewProps,   // ← props của FloorUploadScreenView
  FloorUploadRowModel,
  FloorUploadTrayItemModel,
  FloorUploadBlockReason,
  FloorUploadInlineError,
  FloorUploadStatus,
} from './types';
```

`FloorUploadScreenViewProps = FloorUploadModel & FloorUploadActions`. Không có prop nào
khác, và view **không** nhập `src/api`, `src/store`, `src/domain`, `src/lib/http`
(`local/no-data-layer-in-view` sẽ đỏ).

`types.ts` chỉ nhập **kiểu**: `SelectOption` (`@/components/ui/Select`), `SevenState`
(`@/lib/testing/sevenStateScenarios`), `ViewStatusCode` (`@/lib/viewmodel/types`). Cả ba
đều là type-only nên không kéo gì vào bundle của view.

---

## 2. `FloorUploadModel` — mọi thứ view vẽ

```ts
interface FloorUploadModel {
  state: SevenState;              // 'empty'|'loading'|'partial'|'error'|'success'|'forbidden'|'collapsed'
  projectId: string;
  canEdit: boolean;
  isReadOnly: boolean;            // === !canEdit
  isCollapsed: boolean;
  isOffline: boolean;
  isDragActive: boolean;          // luôn false khi isReadOnly
  errorMessage: string | null;    // CHỈ lỗi ĐỌC danh sách tầng; ⟺ state === 'error'
  offlineNotice: string | null;   offlineNoticeKey: string;
  readOnlyNotice: string | null;  readOnlyNoticeKey: string;
  emptyMessage: string;           emptyMessageKey: string;
  dropZone: FloorUploadDropZoneModel;
  floors: readonly FloorUploadRowModel[];
  tray: FloorUploadTrayModel;
  footer: FloorUploadFooterModel;
  blockNotice: FloorUploadBlockNotice | null;
}
```

**Bậc thang `state`** (giá trị đầu tiên khớp):
`collapsed → forbidden → loading → error → empty → partial → success`.

`collapsed` và `forbidden` là **lớp phủ**: `floors` vẫn đầy đủ, chỉ mất quyền sửa và đổi
cách xếp. `state === 'error'` **không bao giờ** do lỗi của một tệp — lỗi tệp ở lại trong
`row.error`.

### `FloorUploadDropZoneModel`

```ts
{ title, titleKey, selectFileLabel, formatsLine, acceptAttribute, isEnabled }
```

`formatsLine` đã có danh sách định dạng và trần dung lượng (lấy từ hằng của
`src/lib/upload`). `acceptAttribute` = `".png,.jpg,.pdf,.dwg"` — đưa thẳng vào
`<input type="file" accept={...}>`. `isEnabled === false` ⇒ **không vẽ** vùng kéo thả.

---

## 3. `FloorUploadRowModel` — một thẻ tầng

```ts
{
  floorId, name,
  elevationLabel,           // "3,90 m" | "—"
  ceilingElevationLabel,    // trần của chính tầng này (ceilingElevationMm)
  storeyHeightLabel,        // "3,60 m"
  file: FloorUploadFileModel | null,
  status: 'waiting'|'uploading'|'attached'|'error',
  statusVariant: 'verified'|'attention'|'violation'|'neutral',   // → <Badge variant={...}>
  statusLabel, statusLabelKey,
  isAutoMatched, autoMatchHint,          // hint !== null ⟺ isAutoMatched
  percent,                               // 0..100 số nguyên → width thanh 2px
  percentLabel,                          // "45%"
  progressAriaLabel,                     // câu cho trình đọc màn hình, đã ghép
  error: FloorUploadInlineError | null,
  reassignOptions: readonly SelectOption[],   // rỗng khi chỉ đọc
  canCancelUpload, canRetryUpload, canRemoveFile,
  removeLabel: string | null,            // aria-label nút xoá
  revealDelayMs, revealDurationMs,       // chuyển động, xem mục 7
}
```

`FloorUploadFileModel`:
```ts
{ id, name, sizeLabel, pageCountLabel, isCadBranch, summaryLine, pageOptions, selectedPage }
```
`summaryLine` đã ghép `tên · dung lượng · N trang`. `isCadBranch` là tín hiệu hiện chip
"Nhánh CAD" — view **không** đọc đuôi tệp.

**`statusVariant` và A5.** `'verified'` (xanh) chỉ xuất hiện cho tệp **người dùng tự gán**.
Tệp ghép tự động từ tên tệp nhận `'attention'` cùng `autoMatchHint`. Đây là lý do view
không được tự chọn màu theo `status`.

**`file.id` là mã dùng cho MỌI callback theo tệp** (`onReassign`, `onRemoveFile`,
`onCancelUpload`, `onRetryUpload`, `onPickPdfPage`, `onDismissError`) — không phải `floorId`.

---

## 4. Khay chưa gán và chân trang

```ts
FloorUploadTrayModel   { title, titleKey, items, countLabel }
FloorUploadTrayItemModel { id, name, sizeLabel, isCadBranch, summaryLine, error,
                           assignOptions, canRemoveFile, removeLabel }

FloorUploadFooterModel {
  doneCount, totalCount,
  counterLabel,            // "3 / 4 tầng đã có bản vẽ"
  counterLabelKey,
  submitLabel, submitLabelKey,
  canSubmit: boolean,
  blockReasons: readonly FloorUploadBlockReason[],   // rỗng ⟺ canSubmit
  isSubmitting: boolean,
}
```

### Nút chính — luật quan trọng nhất của chân trang

`canSubmit === false` **KHÔNG** có nghĩa là `disabled`. Nút **luôn bấm được**. Bấm lúc
`canSubmit === false` làm `blockNotice` hiện ra:

```ts
FloorUploadBlockNotice {
  title, titleKey,
  reasons: readonly FloorUploadBlockReason[],
  scrollTo: { floorId: string; requestId: number },
}
FloorUploadBlockReason {
  floorId, floorName,
  kind: 'missingFile'|'missingElevation'|'duplicateElevation'|'uploading',
  sentence,     // "Tầng 2 chưa có bản vẽ." — `floor.name` đã là nhãn đầy đủ,
                //  KHÔNG ghép thêm chữ "Tầng" ở đầu câu
}
```

`scrollTo.requestId` **tăng sau mỗi lượt bấm bị chặn**, kể cả khi vẫn là tầng cũ, nên
`useEffect` bám vào nó chạy lại đúng một lần cho mỗi lượt bấm. Khuôn dùng:

```tsx
useEffect(() => {
  if (blockNotice === null) return;
  cardRefs.current.get(blockNotice.scrollTo.floorId)?.scrollIntoView();
}, [blockNotice?.scrollTo.requestId]);
```

Tiêu chí nghiệm thu (d) đòi `scrollIntoView` được gọi **đúng một lần** trên phần tử chứa
tên tầng thiếu — nên gọi nó trên chính thẻ tầng, không trên `window`.

`blockNotice` tự về `null` khi lý do cuối cùng được gỡ; view không phải đóng nó.

---

## 5. `FloorUploadActions` — mọi hàm view gọi

```ts
onFilesDropped(files: readonly File[]): void
onFilesChosen(files: readonly File[]): void
onDragEnter(): void
onDragLeave(): void
onReassign(fileId: string, floorId: string | null): void   // null ⇒ về khay
onPickPdfPage(fileId: string, page: string): void
onCancelUpload(fileId: string): void
onRetryUpload(fileId: string): void
onRemoveFile(fileId: string): void
onSubmit(): void
onDismissError(fileId: string): void
```

Mọi hàm **an toàn khi màn chỉ đọc** — hook bỏ qua chúng, không ném. View không phải bọc
điều kiện quanh từng lời gọi.

`onDragEnter`/`onDragLeave` đếm theo chiều sâu, nên `dragover` trên con không làm tắt
`isDragActive`.

---

## 6. Hook và container

```ts
useFloorUploadScreen(options: UseFloorUploadScreenOptions): FloorUploadScreenViewProps

interface UseFloorUploadScreenOptions {
  gateway: FloorUploadGateway;      // BẮT BUỘC
  projectId: string;                // BẮT BUỘC
  roles?: readonly ProjectRole[];   // mặc định ['engineer']
  now?: () => number;               // đồng hồ tiêm được (R-29), vé hoàn tác đọc nó
  forceCollapsed?: boolean;         // ép cách xếp thu gọn, cho story/test
  onToast?: (toast: { message: string; onUndo?: () => void }) => void;
  onNavigate?: (path: string) => void;
}
```

**Container PHẢI truyền `onNavigate` và `onToast`** (R-73). Hook **không** gọi
`useNavigate()` — `renderWithProviders` không bọc Router, và hook phải test được không
cần Router. Đường dẫn đã dựng sẵn bằng hằng `ROUTES.project.pipeline(projectId)` bên
trong hook; container chỉ cần chuyển tiếp:

```tsx
function WiredFloorUpload(props: FloorUploadContainerProps) {
  const gateway = useMemo(() => createAppFloorUploadGateway(), []);
  const navigate = useNavigate();
  const model = useFloorUploadScreen({
    gateway,
    projectId: props.projectId,
    ...(props.roles !== undefined ? { roles: props.roles } : {}),
    onToast: props.onToast,
    onNavigate: props.onNavigate ?? navigate,
  });
  return <FloorUploadScreenView {...model} />;
}
```

`createAppFloorUploadGateway()` và `createFloorUploadGateway(client, { networkMonitor })`
đều xuất từ `./floorUploadGateway`.

`index.ts` nên tái xuất: view, container, route, hook, `createFloorUploadGateway`,
`createAppFloorUploadGateway`, và toàn bộ kiểu của `./types`.

---

## 7. Chuyển động — 240 ms KHÔNG hợp lệ

Đặc tả xin thẻ hiện ra trong **240 ms**. Thang chuyển động có đúng năm giá trị
(120/180/260/340/700) và `local/no-raw-duration` ở mức lỗi.

- **Thay 240 → 260**: `row.revealDurationMs === durationMs('standard') === 260`.
- **Nhịp so le 24 ms hợp lệ nguyên vẹn**: `STAGGER_STEP_MS` của
  `src/lib/motion/stagger.ts` đúng bằng 24. `row.revealDelayMs === staggerDelayMs(index)`
  → 0, 24, 48, 72… và dừng ở `MAX_STAGGERED_ITEMS`.

View **chỉ đọc hai con số này từ props**, không viết số nào của riêng nó.

---

## 8. Bốn điều dễ sai

1. **Lỗi một tệp không bao giờ là lỗi cả trang.** `row.error` / `trayItem.error` hiện
   inline trong thẻ; `state === 'error'` chỉ dành cho lượt đọc danh sách tầng hỏng.
   **Không hộp thoại cho bất kỳ lỗi tệp nào.**
2. **Xoá không có hộp thoại xác nhận.** Xoá xảy ra ngay; đường về là toast hoàn tác qua
   `onToast({ message, onUndo })`, cửa sổ 8 giây do chính vé `createUndoTicket` giữ.
3. **`Tầng 1` của bộ mẫu đã có sẵn một bản vẽ trên máy chủ** (`floor.drawings[0]`), nên
   nó vào màn ở trạng thái `'attached'` mà không có lượt tải nào. Story và test nên tính
   đến điều đó.
4. **Không viết trần dung lượng vào màn.** `grep -rnE '5242880|104857600|100 MB'
   src/screens/upload/FloorUploadScreen` phải **rỗng** — hiện đang rỗng.

---

## 9. Việc còn nợ ở tầng dữ liệu (không phải việc của màn)

- **`invalidationMap` thiếu mục cho upload / reassign / remove-drawing.**
  `WRITE_OPERATIONS` có 8 mục, không mục nào của màn này, và `src/lib/query/**` nằm ngoài
  ba nơi R-68 cho phép sửa. Hook vì vậy gọi thẳng `queryClient.invalidateQueries` với
  khoá dựng từ `queryKeys` (`drawing.byFloor`, `floor.detail`, `floor.list`). Thêm mục
  cho ba thao tác này là một lượt riêng ở tầng dữ liệu.
- **Mock API không gắn bản vẽ vừa tải vào `floors[].drawings`** — hoàn tất một lượt tải
  qua mock chỉ cập nhật bản đồ `uploads`. Màn chạy trên mock sẽ không thấy bản vẽ của
  chính nó xuất hiện sau khi đọc lại.
- **Không hook nào bọc `createNetworkMonitor`** — chỗ nối nằm trong
  `floorUploadGateway.watchNetwork`, một lần, đúng như khảo sát T5 đã ghi.
