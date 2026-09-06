# T1 — Khảo sát hợp đồng tầng dữ liệu cho FurnitureLibraryPanel

Chỉ đọc mã, không sửa gì ngoài file này. Mọi chữ ký dán nguyên văn kèm đường-dẫn:dòng.

---

## (a) D-01 — truy vấn thư viện model → **NOT FOUND tại master @7bba5cc**

**Được cấp bởi T1b (fl-api-library), xem `contract-data-api.md`.** Task này (T1) CHỈ
xác nhận NOT FOUND, KHÔNG tự thiết kế tên endpoint/kiểu dữ liệu — điều phối viên đã
tách hẳn một task riêng (T1b) sở hữu `ENDPOINTS.library`, `LibraryItem` + schema,
`src/api/client.ts`/`__mocks__/client.ts`, và hook truy vấn trong `src/lib/query`. Khi
dựng `FurnitureLibraryPanel`, đọc `contract-data-api.md` để lấy chữ ký thật, KHÔNG dùng
gì đoán trong bản nháp trước đó của file này.

**Kết luận dứt khoát tại thời điểm khảo sát: KHÔNG có endpoint, không có hàm fetch,
không có kiểu dữ liệu nào cho "mục thư viện model .glb" trong repo hiện tại.**

Có ba mảnh liên quan tới chữ `library`, nhưng cả ba chỉ là **khoá cache đã đăng ký
trước, không có gì phía sau nó**:

1. `src/lib/query/queryKeys.ts:63-64,76-82` — có factory:
   ```ts
   library: {
     detail: createQueryKeyFactory(libraryDetailRoot, (libraryItemId: string) => [
       ...libraryDetailRoot, libraryItemId,
     ] as const),
     list: createQueryKeyFactory(libraryListRoot, () => libraryListRoot),
   },
   ```
   `queryKeys.library.list()` → `['library', 'list']`, `queryKeys.library.detail(id)` →
   `['library', 'detail', id]`. Đây CHỈ là khoá, không có `queryFn` đi kèm ở đâu cả.

2. `src/lib/query/cachePolicy.ts:79` — domain `library` đã map sang tier `'static'`
   (staleTime 300 000 ms, xem mục (b)), nhưng đây cũng chỉ là cấu hình chờ sẵn.

3. Grep xác nhận không có nơi nào TIÊU THỤ khoá này:
   ```
   grep -rn "queryKeys.library" src --include=*.ts --include=*.tsx
   → RỖNG
   ```

**Grep đã chạy trên `src/api/endpoints.ts`:**
```
grep -n "furniture|library|catalog|model" src/api/endpoints.ts
→ RỖNG
```
Đọc toàn bộ `src/api/endpoints.ts:1-120`: object `ENDPOINTS` chỉ có `auth`, `drawings`,
`featureFlags`, `floors`, `projects`, `propertyTemplates`, `quality`, `spatial`,
`telemetry`. Không có `library`/`furniture`/`catalog`/`model`.

**Grep trên `src/api/contracts.ts`** (kiểu dữ liệu re-export từ schemas):
```
grep -n -i "library|furniture|catalog|model|glb" src/api/contracts.ts
→ RỖNG
```
Không có `LibraryItem`, không có kiểu nào mang `id/name/widthMm/depthMm/heightMm/
fileSizeBytes/group/glbUrl`.

**Grep trên `src/api/schemas/**`:**
```
grep -rn -i "library|furniture|catalog|glb" src/api/schemas
→ RỖNG
```
Thư mục chỉ có `decode.ts`, `index.ts`, `quality.ts`, `__tests__`.

**Lưu ý dễ nhầm — `Furniture` domain type KHÔNG PHẢI mục thư viện:**
`src/api/client.ts:4` import `Furniture` từ `@/domain/spatial/types`. Đọc
`src/domain/spatial/types.ts:166-174`:
```ts
export interface Furniture extends ReviewMetadata {
  id: FurnitureId;
  levelId: LevelId;
  roomId?: RoomId;
  kind: FurnitureKind;
  centre: Point;
  boundingBox: BoundingBox;
  rotationDeg: Degrees;
}
```
Đây là **nội thất đã ĐẶT trên một tầng cụ thể** (một phần đồ thị không gian, đọc qua
`spatial.layer` — `ENDPOINTS.spatial.layer`, `src/api/endpoints.ts:102-103`), khác hoàn
toàn khái niệm "một mục trong thư viện model .glb kéo-thả được" mà
`FurnitureLibraryPanel` cần. Không được dùng nhầm `Furniture`/`FurnitureKind` làm kiểu
dữ liệu thư viện.

→ **Việc CẦN LÀM TIẾP:** hỏi điều phối viên cách lấp (xem log `ask` ở cuối file này).
KHÔNG tự bịa endpoint/schema.

---

## (b) D-02 — cache

Nguồn: `src/lib/query/cachePolicy.ts`.

- 4 tier: `CACHE_POLICY_TIERS = ['default', 'static', 'aiProgress', 'spatialDraft']`
  (dòng 6).
- Domain `library` → tier `'static'` (dòng 79, trong `TIER_BY_DOMAIN`).
- Tier `'static'`: `staleTime = CACHE_POLICY.branches.static = 300_000` ms (5 phút),
  `gcTime = CACHE_POLICY.default.gcTime = 600_000` ms (10 phút, dùng chung mọi tier —
  dòng 34-37, comment dòng 45-48: *"Static data: component library, user list. 5m vì
  admin đổi các bảng này hàng tuần"*).
- Hàm tra cứu: `resolveCachePolicy(queryKey: QueryKey): ResolvedCachePolicy` (dòng 118)
  và `resolveCachePolicyTier(queryKey: QueryKey): CachePolicyTier` (dòng 105). Không tự
  viết `staleTime: 300000` tay — nếu cần override cục bộ thì gọi
  `resolveCachePolicy(queryKeys.library.list())` hoặc dựa vào default đã đăng ký qua
  `listCachePolicyDefaults()` (dòng 93, được `createQueryClient` gọi tự động —
  `src/lib/query/queryClient.ts:58-60`).

**Kết luận: tier 'static' đã đúng cho danh mục thư viện, không cần thêm gì ở D-02.**

---

## (c) D-03 — nạp trước khi trỏ chuột

`src/lib/query/prefetch.ts:15-49`:
```ts
export interface PrefetchOnHoverHandlers {
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

export function prefetchOnHover<TData>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  fetcher: QueryFunction<TData>,
  delayMs = 200,
): PrefetchOnHoverHandlers
```
Chỉ bắt đầu prefetch sau khi con trỏ đứng yên trên đích `delayMs` (mặc định 200 ms —
**đây không phải một trong năm giá trị `MOTION_DURATIONS_MS`, vì đây không phải thời
lượng chuyển động (motion), mà là độ trễ debounce của một thao tác dữ liệu — R-71 chỉ
áp cho animation timing, không áp cho số này**), và chỉ khi khoá chưa có dữ liệu
(`queryClient.getQueryData(queryKey) === undefined`). Trả về hai handler gắn thẳng vào
`onPointerEnter`/`onPointerLeave` của thẻ card.

**Cách dùng đúng cho một thẻ trong FurnitureLibraryPanel** (khi (a) được lấp): gọi
`prefetchOnHover(queryClient, queryKeys.library.detail(itemId), fetchLibraryItemDetail)`
trong hook của panel, KHÔNG viết `setTimeout` tay.

---

## (d) D-05 — vé hoàn tác / toast hoàn tác

`src/lib/mutations/undoTicket.ts`:
- `export const UNDO_WINDOW_MS = 8000;` (dòng 18) — nguồn DUY NHẤT của "8 giây". Cấm viết
  `8000` tay ở màn (R-71); import hằng này.
- `export function createUndoTicket(options: CreateUndoTicketOptions): UndoTicket`
  (dòng 45), với:
  ```ts
  export interface CreateUndoTicketOptions {
    description: string;
    now?: () => number;
    ttlMs?: number;   // mặc định UNDO_WINDOW_MS
    undo: () => void;
  }
  export interface UndoTicket {
    description: string;
    expiresAt: number;
    getStatus: () => UndoTicketStatus; // 'active' | 'expired' | 'used'
    id: string;
    undo: () => Result<void, UndoTicketError>; // UndoTicketError = 'expired'
  }
  ```

`src/lib/mutations/notificationBus.ts`:
- `export function createNotificationBus(options?: CreateNotificationBusOptions): NotificationBus`
  (dòng 79), với `NotificationBus = { list, publish, subscribe }` (dòng 33-37).
- `publish(input: NotificationInput)` (dòng 9-14: `{ description, title, type,
  undoTicket? }`) tự động gộp các publish cùng `type` trong `groupWindowMs` (mặc định
  5000 ms) thành một toast, và tự dọn khi `undoTicket.expiresAt` tới (dòng 109-120,
  `scheduleRemoval`).

**Khuôn đúng để phát toast hoàn tác 8 giây khi kéo một model vào cảnh:**
```ts
const ticket = createUndoTicket({ description: '...', undo: () => removePlacedModel(id) });
notificationBus.publish({ title: '...', description: ticket.description, type: 'furniture-placed', undoTicket: ticket });
```
KHÔNG tự viết `setTimeout(..., 8000)` — cửa sổ hoàn tác luôn đi qua `createUndoTicket`
(mặc định đã là `UNDO_WINDOW_MS`).

---

## (e) P-01 — định dạng

`src/lib/format/measure.ts`:
- `export function formatLength(valueMm: MaybeNumber, options?: LengthFormatOptions): string`
  (dòng 108). Mặc định TỰ CHỌN đơn vị theo độ lớn (dưới 1000 mm → mm, từ 1 m → mét).
  Muốn ép luôn ra `mm` (đúng khuôn spec "1.200 × 600 × 750 mm") phải truyền
  `{ unit: 'mm' }`: `formatLength(1200, { unit: 'mm' })` → `"1.200 mm"` (dùng dấu CHẤM
  phân nhóm nghìn, dấu PHẨY chỉ xuất hiện khi có phần thập phân — xem `formatNumber`
  bên dưới).
- **KHÔNG có hàm ghép sẵn "rộng × sâu × cao"** — grep xác nhận:
  ```
  grep -n "rộng.*sâu\|×.*×\|BoundingBoxLabel\|formatDimensions\|formatBoundingBox" src/lib/format/*.ts
  → RỖNG
  ```
  → **NOT FOUND cho hàm ghép ba chiều.** Cách đúng theo A15 (định dạng ở
  viewmodel/hook, không ở view): viết một hàm nhỏ **trong hook của
  `FurnitureLibraryPanel`** (không phải trong `src/lib`, vì không được sửa `src/lib/**`)
  gọi ba lần `formatLength(x, { unit: 'mm' })` rồi nối bằng `' × '`, ví dụ:
  `[widthMm, depthMm, heightMm].map((v) => formatLength(v, { unit: 'mm' })).join(' × ')`
  — chú ý kết quả sẽ là `"1.200 mm × 600 mm × 750 mm"` (mỗi số có hậu tố `mm` riêng),
  KHÔNG tự tạo ra `"1.200 × 600 × 750 mm"` (hậu tố dùng một lần ở cuối) trừ khi viết
  logic ghép chuỗi thủ công bỏ hậu tố của hai số đầu — đây là quyết định thiết kế màn,
  không phải hợp đồng dữ liệu, nên để lại cho task dựng màn quyết, không tự chế ở đây.

`src/lib/format/bytes.ts`:
- `export const BYTES_PER_UNIT = 1024;` (dòng 25), `export const BYTE_UNITS = ['B',
  'KB', 'MB', 'GB', 'TB'] as const;` (dòng 28).
- `export function formatFileSize(sizeBytes: MaybeNumber, options?: FileSizeFormatOptions): string`
  (dòng 83). Ví dụ thật từ test (`src/lib/format/__tests__/bytes.test.ts`):
  `formatFileSize(5_242_880)` → `"5,0 MB"`, `formatFileSize(0)` → `"0 B"`,
  `formatFileSize(undefined)` → `"—"` (MISSING_VALUE).
  → **CÓ SẴN hàm dung lượng tệp, dùng thẳng `formatFileSize` cho caption dung lượng.**

`src/lib/format/number.ts`:
- Locale cố định `'vi-VN'` (dòng 33), `MISSING_VALUE = '—'` (dòng 29) — dấu thập phân
  DẤU PHẨY, phân nhóm nghìn DẤU CHẤM, đúng A15.

---

## (f) P-04 — bảy trạng thái màn

`src/lib/testing/sevenStateScenarios.ts`:
- `export const SEVEN_STATES = ['empty', 'loading', 'partial', 'error', 'success',
  'forbidden', 'collapsed'] as const;` (dòng 26-34).
- `export function createSevenStateScenarios(options?: SevenStateScenarioOptions):
  readonly SevenStateScenario[]` (dòng 123-125 vùng khai báo). `SevenStateScenario`
  có `{ state, label, rows, totalCount, isLoading, isCollapsed, canView, error }`
  (dòng 62-76). Mặc định dùng bộ mẫu A14: `totalCount = 48` (dòng 79),
  `partialCount = 14` (dòng 80).

`src/lib/testing/expectSevenStates.ts`:
- `export function expectSevenStates(renderScreen: ScreenRenderer, scenarios: readonly
  SevenStateScenario[]): void` (dòng 122-125), với `ScreenRenderer = (scenario:
  SevenStateScenario) => ScreenRenderResult` (dòng 46) và `ScreenRenderResult = {
  container: HTMLElement, unmount?: () => void }` (dòng 38-43, cố ý khớp shape của
  `render()` từ testing-library). Ném lỗi nếu: thiếu trạng thái, trạng thái lặp, render
  ném lỗi, hoặc container trắng (`isBlank`, dòng 103-105).

**Cách test đủ 7/7 cho `FurnitureLibraryPanel`:**
```ts
expectSevenStates(
  (scenario) => renderWithProviders(<FurnitureLibraryPanel {...scenario} />),
  createSevenStateScenarios(),
);
```
(hàm render đúng tên là `renderWithProviders`, KHÔNG phải `render` — xem sửa lỗi chính
tả trong spec gốc ở mục "Lưu ý" cuối file.)

**R-62 — ScreenErrorBoundary:**
- `src/components/feedback/ScreenErrorBoundary.tsx` là **shell React đã gắn**, class
  component, không build UI riêng (`renderFallback` do màn truyền vào) — dòng 1-40.
  Logic phân loại lỗi nằm ở `src/lib/screen-state/screenErrorBoundary.ts`
  (`createScreenErrorRecorder`, `describeScreenError`, dòng 30 import).
- **Dùng bản ở `src/components/feedback/ScreenErrorBoundary`, KHÔNG tự import trực
  tiếp `src/lib/screen-state/screenErrorBoundary`** trong màn (đúng như R-62 yêu cầu) —
  file lib đó chỉ để `ScreenErrorBoundary.tsx` gọi, và test có thể gọi thẳng nếu cần
  test logic thuần.

---

## (g) R-64 — cấm `useState` cho loading/error; khuôn đúng lấy trạng thái máy chủ

Có 30+ hook màn thật đã dùng đúng khuôn — ví dụ tối giản nhất,
`src/screens/dashboard/ProjectDashboard/useProjectDashboard.ts:218-220`:
```ts
const listQuery = useQuery({
  queryKey: queryKeys.project.list(),
  queryFn: options.fetchList ?? fetchProjectList,
});
```
rồi đọc `listQuery.data`, `listQuery.isLoading`, `listQuery.error` — KHÔNG có
`useState<boolean>(false)` nào cho loading/error ở các hook này. Comment tự tài liệu
hoá ngay trong `useProjectDashboard.ts:11`:
`"D-01/D-02 — useQuery({ queryKey: queryKeys.project.list(), queryFn })"`.

**Khuôn cho FurnitureLibraryPanel (khi (a) được lấp):**
```ts
const libraryQuery = useQuery({
  queryKey: queryKeys.library.list(),
  queryFn: fetchLibraryItems, // hàm thật cần (a)
});
```
rồi build bảy trạng thái từ `libraryQuery.isLoading / .data / .error` — không
`useState` tay. Ví dụ khác cùng khuôn: `useFloorManager.ts:420`, `useWelcomeScreen.ts:229`,
`useAccountSettings.ts:165`.

---

## Sai khác giữa spec task và mã thật (ghi lại để không ai đoán nhầm)

- Spec gọi `src/lib/testing/render.ts` — file thật tên là **`render.tsx`**, hàm export
  là **`renderWithProviders`**, không phải `render`.
- Spec gọi hàm build 7 trạng thái là ngầm định `SEVEN_STATES`/scenarios — tên hàm thật
  là `createSevenStateScenarios`.
- Không có `src/api/schemas/**` nào liên quan tới library/furniture/catalog — thư mục
  chỉ phục vụ auth + quality.

---

## (h) Quyền — `library.manage` (bổ sung theo yêu cầu điều phối viên)

`src/lib/auth/permissions.ts`:
- `PermissionResource` gồm cả `'library'` và `'model'` (dòng 7-15).
- `PermissionKey` có sẵn `'library.manage'` (dòng 24).
- `permissionEntries` khai `{ action: 'manage', resource: 'library' }` (dòng 41).
- Ma trận theo vai trò (`permissionMatrix['library.manage']`, dòng 89-93):
  - `admin: true` (dòng 48)
  - `engineer: false` (dòng 59)
  - `viewer: false` (dòng 70)
- Hàm kiểm tra:
  ```ts
  export const can = (
    action: PermissionAction,
    resource: PermissionResource,
    ctx: PermissionContext = {},
  ): boolean
  ```
  (`src/lib/auth/permissions.ts:127-141`). `PermissionContext = { roles?: readonly
  ProjectRole[] }` (dòng 27-30).

**Cách dùng đúng, đúng khuôn `useProjectDashboard.ts:45,340`
(`import { can } from '@/lib/auth/permissions'; const canCreate = can('create',
'project', { roles: [role] });`):**
```ts
import { can } from '@/lib/auth/permissions';
const canManageLibrary = can('manage', 'library', { roles: [role] });
```

**Kết luận cho màn:** chỉ vai trò `admin` có `library.manage = true`. Nút "Tải lên
model" (nếu panel có) CHỈ hiện/bật khi `canManageLibrary === true`; `engineer` và
`viewer` phải thấy panel ở trạng thái thứ 6 của A11 — **`forbidden`** ("không có
quyền", `src/lib/testing/sevenStateScenarios.ts:32,46` — nhãn `'không có quyền'`) đối
với riêng hành động quản lý (KHÔNG chặn cả việc xem/kéo-thả thư viện, vì spec chỉ nói
tới việc *tải lên* model — xem `permissionEntries` chỉ có `library.manage`, không có
`library.view`, tức xem thư viện là quyền mặc định của mọi vai trò).

---

## Câu hỏi bắt buộc gửi điều phối viên (do (a) = NOT FOUND)

Đã hỏi qua `orca orchestration ask`:

> "D-01 KHÔNG có endpoint/schema nào cho thư viện model .glb (`src/api/endpoints.ts`
> không có `library`/`furniture`/`catalog`; `queryKeys.library.*` chỉ là khoá cache mồ
> côi, không ai tiêu thụ). FurnitureLibraryPanel cần: danh sách mục (id, tên, kích thước
> rộng×sâu×cao mm, dung lượng tệp, nhóm, url .glb) + chi tiết một mục. Ba lựa chọn:
> (1) tạm thời đọc từ file JSON tĩnh trong `public/` qua `fetch` bọc trong
> `src/lib/http` (không được sửa `src/lib/http` — task này không có quyền thêm hàm mới
> ở đó); (2) chặn task dựng màn lại, chờ một task Lớp 1 khác định nghĩa
> `ENDPOINTS.library` + `LibraryItemSchema` trước; (3) dùng dữ liệu cứng
> (mock) ngay trong `.notes` để P-01/P-04 minh hoạ, còn D-01 thật để trống, đánh dấu nợ.
> Chọn hướng nào?"

**Trạng thái câu hỏi: ĐÃ TRẢ LỜI.** Điều phối viên chọn hướng **(2) chặn việc dựng màn,
tách một task Lớp 1 riêng (T1b, `fl-api-library`) chạy song song, sở hữu DUY NHẤT
`ENDPOINTS.library`, `LibraryItem` + schema, `src/api/client.ts`/`__mocks__/client.ts`,
và hook truy vấn trong `src/lib/query` dùng `queryKeys.library.*` sẵn có + tier `static`
của `cachePolicy.ts`. Lý do bác hai hướng còn lại: mock trong hook vi phạm R-69 (không
tự chế logic tầng dữ liệu); JSON tĩnh trong `public/` che giấu một lỗ hổng tầng dữ liệu
đằng sau một asset, trong khi D-01/D-02/D-03 đặc tả rõ là trạng thái máy chủ qua
`src/lib/query` (R-64 cấm điều đó chệch hướng).

**T1 (task này) TUYỆT ĐỐI không đụng `src/api/**` hay `src/lib/query/**` — T1b sở hữu
chúng.** Task dựng màn thật đọc chữ ký từ `contract-data-api.md` (do T1b viết), không
đọc bản nháp NOT FOUND ở trên như một kết luận cuối cùng.
