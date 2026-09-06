# T1b — hợp đồng tầng dữ liệu của thư viện model (D-01, D-02, D-03)

Mọi chữ ký dưới đây **dán từ file thật sau khi cổng kiểm chạy xanh**, kèm `đường-dẫn:dòng`.
Task viết hook của `FurnitureLibraryPanel` dựng theo đúng file này — sai một tên trường là hook
không biên dịch.

Cổng kiểm tại thời điểm chốt: `pnpm typecheck` sạch · `pnpm lint` 0 lỗi · `pnpm test` 4875/4875
passed (245 file) · `pnpm coverage` exit 0, `src/api/schemas/library.ts` 100%.

---

## 0. Cái đã có sẵn mà task này chỉ NỐI VÀO, không dựng lại

| Thứ | Ở đâu | Trạng thái trước T1b |
|---|---|---|
| `queryKeys.library.list()` / `.detail(libraryItemId)` | `src/lib/query/queryKeys.ts:76-81` | đã có, **mồ côi** — không ai tiêu thụ |
| Miền `library` xếp bậc `'static'` (staleTime 300.000 ms) | `src/lib/query/cachePolicy.ts:79` (`TIER_BY_DOMAIN`) | đã có |
| `prefetchOnHover(queryClient, queryKey, fetcher, delayMs = 200)` | `src/lib/query/prefetch.ts:17` | đã có |
| `SCENE_BUDGET.maxTriangles = 900_000` + `checkBudget(reading, profile)` | `src/lib/three/perf/budget.ts:92`, `:219` | đã có |
| `FurnitureKind` | `src/domain/spatial/types.ts:155-163` | đã có |

**Hook KHÔNG được** khai lại khoá truy vấn, KHÔNG đặt `staleTime`, KHÔNG bịa ngưỡng model nặng.

---

## 1. Kiểu và hằng — `src/api/schemas/library.ts`

Nhập từ `@/api/client` (mọi kiểu) hoặc `@/api/contracts` (kiểu + hằng chạy được).
`src/api/schemas/library.ts` là nguồn; `contracts.ts:50-61` và `client.ts:41-44` là cửa ra.

### 1.1 Tám nhóm loại đồ — `:74`

```ts
export const LIBRARY_GROUPS = [
  'table',
  'chair',
  'bed',
  'sofa',
  'storage',
  'sanitary',
  'kitchen',
  'technical',
] as const;                                                    // library.ts:74-83

export type LibraryGroup = (typeof LIBRARY_GROUPS)[number];    // library.ts:85
```

Nhãn tiếng Việt của từng chip **không nằm ở tầng API** (`src/api` giữ hình dạng, tầng đọc giữ câu
chữ — lệ đã ghi cho `SignInSchema`, `src/api/schemas/index.ts`). Hook/màn tự đặt, theo bảng này,
viết thường kiểu câu (A6):

| `LibraryGroup` | chip |
|---|---|
| `table` | bàn |
| `chair` | ghế |
| `bed` | giường |
| `sofa` | sofa |
| `storage` | tủ kệ |
| `sanitary` | thiết bị vệ sinh |
| `kitchen` | bếp |
| `technical` | thiết bị kỹ thuật |

### 1.2 Nguồn — `:93`

```ts
export const LIBRARY_SOURCES = ['catalogue', 'mine'] as const;   // library.ts:93
export type LibrarySource = (typeof LIBRARY_SOURCES)[number];    // library.ts:95
```

### 1.3 Nhóm → loại nội thất — `:106`

```ts
export const FURNITURE_KIND_BY_LIBRARY_GROUP = {
  bed: 'bed',
  chair: 'chair',
  kitchen: 'kitchenCabinet',
  sanitary: 'sanitaryFixture',
  sofa: 'chair',
  storage: 'wardrobe',
  table: 'table',
  technical: 'other',
} as const satisfies Record<LibraryGroup, FurnitureKind>;        // library.ts:106-115
```

Hook **không cần gọi bảng này**: `LibraryItem.furnitureKind` đã là kết quả của nó (mục 1.4).
Bảng xuất ra để lệnh S-07 và bài kiểm đối chiếu được.

### 1.4 Một mục thư viện — `:124`

```ts
export const LibraryItemSchema = z
  .object({
    depthMm: positiveIntegerSchema,
    fileSizeBytes: positiveIntegerSchema,
    group: wireLibraryGroupSchema,
    heightMm: positiveIntegerSchema,
    id: idSchema,
    modelUrl: z.string().url(),
    name: z.string().min(1),
    previewUrl: z.string().url().optional(),
    source: wireLibrarySourceSchema,
    triangleCount: positiveIntegerSchema,
    widthMm: positiveIntegerSchema,
  })
  .strict()
  .transform(/* … */);                                           // library.ts:124-152

export type LibraryItem = z.infer<typeof LibraryItemSchema>;     // library.ts:154
export type LibraryItemWire = z.input<typeof LibraryItemSchema>; // library.ts:155
```

**Hình dạng ĐÃ GIẢI MÃ (`LibraryItem`) — đây là thứ hook nhận:**

```ts
{
  depthMm: number;              // mm, số nguyên dương, SỐ THÔ
  fileSizeBytes: number;        // byte, số nguyên dương, SỐ THÔ
  furnitureKind: FurnitureKind; // SUY RA từ group, không có trên dây
  group: LibraryGroup;
  heightMm: number;             // mm
  id: string;
  modelUrl: string;             // URL tuyệt đối tới .glb
  name: string;                 // tiếng Việt có dấu, viết thường kiểu câu
  previewUrl?: string;          // VẮNG TRƯỜNG khi chưa có ảnh xem trước
  source: LibrarySource;
  triangleCount: number;        // số tam giác, số nguyên dương
  widthMm: number;              // mm
}
```

Ba điều hook phải biết:

1. **`furnitureKind` có sẵn.** Đặt một mục vào cảnh thì lấy thẳng `item.furnitureKind` làm
   `Furniture.kind`. Nó không đi trên dây — gửi kèm nó là lỗi hợp đồng (`.strict()`).
2. **`previewUrl` VẮNG MẶT, không phải chuỗi rỗng.** Kiểm bằng `item.previewUrl === undefined`.
   Đây là cái cho trạng thái `'partial'` của A11 nội dung thật.
3. **Mọi số là số thô.** `"1.200 × 600 × 750 mm"` và caption dung lượng dựng ở **viewmodel/hook**
   qua `@/lib/format/number` — A15 cấm định dạng ở view, và tầng API cũng không làm hộ.

### 1.5 Mười chip lọc — `:168`

```ts
export const LIBRARY_FILTER_IDS = ['all', ...LIBRARY_GROUPS, 'mine'] as const;  // library.ts:168
export type LibraryFilterId = (typeof LIBRARY_FILTER_IDS)[number];              // library.ts:170

export function matchesLibraryFilter(
  item: Pick<LibraryItem, 'group' | 'source'>,
  filterId: LibraryFilterId,
): boolean;                                                                     // library.ts:187-190
```

`LIBRARY_FILTER_IDS` có **đúng mười phần tử, đúng thứ tự chip trên màn**:
`['all', 'table', 'chair', 'bed', 'sofa', 'storage', 'sanitary', 'kitchen', 'technical', 'mine']`.
Hàng chip dựng bằng cách duyệt mảng này — **đừng liệt kê lại**.
Nhãn của `'all'` là "tất cả", của `'mine'` là "của tôi".

Ba nhánh của `matchesLibraryFilter`:

| `filterId` | khớp khi |
|---|---|
| `'all'` | luôn luôn — kể cả mục `source: 'mine'` |
| `'mine'` | `item.source === 'mine'`, **bất kể** `group` |
| tám id còn lại | `item.group === filterId`, **bất kể** `source` |

Vì sao `'mine'` không phải một `LibraryGroup`: quyền sở hữu **trực giao** với loại đồ. Một chiếc
ghế người dùng tự tải lên vừa là `group: 'chair'` vừa là `source: 'mine'`, nên chip `ghế` PHẢI
tìm thấy nó và chip `của tôi` cũng PHẢI tìm thấy nó. Nhét `'mine'` vào `group` là mất loại của nó.
Đây là quyết định của điều phối viên (phương án A), không phải suy diễn.

**Hook lọc bằng đúng hàm này, không viết lại phép so sánh.** Ô tìm kiếm lọc chồng lên trên:

```ts
const visible = items.filter(
  (item) => matchesLibraryFilter(item, activeFilterId) && matchesSearchText(item.name, query),
);
```

---

## 2. Đường dẫn — `src/api/endpoints.ts`

```ts
const LIBRARY_ROOT = '/library';                                          // endpoints.ts:5

library: {
  detail: (libraryItemId: string): string => `${LIBRARY_ROOT}/${libraryItemId}`,  // endpoints.ts:67
  list: LIBRARY_ROOT,                                                             // endpoints.ts:68
},
```

Toàn cục, **không** lồng dưới `/projects/:projectId` — một chiếc ghế trong danh mục là cùng một
chiếc ghế ở mọi dự án, và `queryKeys.library.list()` cũng không nhận `projectId`.
Hook **không nhập `ENDPOINTS`**; nó chỉ gọi `ApiClient`.

---

## 3. Client — `src/api/client.ts`

```ts
export interface ReadLibraryItemInput extends RequestOptions {
  libraryItemId: string;
}                                                                    // client.ts:221-223

export interface LibraryApi {
  list(options?: RequestOptions): Promise<ApiResult<LibraryItem[]>>;
  read(input: ReadLibraryItemInput): Promise<ApiResult<LibraryItem>>;
}                                                                    // client.ts:399-402

export interface ApiClient {
  // …
  library: LibraryApi;                                               // client.ts:442
  // …
}
```

`RequestOptions` là `{ signal?: AbortSignal }` (`client.ts:57-59`).
`ApiResult<T> = Result<T, HttpError | AppError>` (`client.ts:54-55`) — union phân biệt bằng `.ok`,
**không ném ngoại lệ**.

**Chỉ đọc — không có `create`/`update`/`delete`.** Đường tải model lên chưa tồn tại ở bất cứ tầng
nào; hook không được giả định có. Hệ quả đã kiểm: `src/lib/query/invalidation.ts`
**không cần và không có** mục `library` nào — không thao tác ghi nào làm danh mục cũ đi, nên một
mục ở đó sẽ là một khai báo không bao giờ chạy.

`library.list` giải mã bằng `safeParseList` (`client.ts:597-598`): một mục hỏng bị bỏ qua kèm cảnh
báo, cả panel không rỗng theo. `library.read` giải mã bằng `decode` (`client.ts:599-604`) — một mục
hỏng là `ApiError` với `code: 'CONTRACT_VALIDATION'`.

---

## 4. Tầng truy vấn — `src/lib/query/libraryQueries.ts` (file mới)

```ts
export type LibraryListQueryKey = QueryKeyOf<typeof queryKeys.library.list>;     // :62
export type LibraryDetailQueryKey = QueryKeyOf<typeof queryKeys.library.detail>; // :63

export interface LibraryQueryOptions<TData, TKey extends readonly unknown[]> {
  queryFn: QueryFunction<TData, TKey>;
  queryKey: TKey;
}                                                                                // :66-69

export function libraryListQueryOptions(
  libraryApi: Pick<LibraryApi, 'list'>,
): LibraryQueryOptions<LibraryItem[], LibraryListQueryKey>;                       // :82-84

export function libraryDetailQueryOptions(
  libraryApi: Pick<LibraryApi, 'read'>,
  libraryItemId: string,
): LibraryQueryOptions<LibraryItem, LibraryDetailQueryKey>;                       // :98-101

export function prefetchLibraryItemOnHover(
  queryClient: QueryClient,
  libraryApi: Pick<LibraryApi, 'read'>,
  libraryItemId: string,
): PrefetchOnHoverHandlers;                                                       // :120-124
```

`PrefetchOnHoverHandlers` là `{ onPointerEnter: () => void; onPointerLeave: () => void }`
(`src/lib/query/prefetch.ts:5-8`).

**Không có `staleTime` trong các object trả về, và đừng thêm.** `createQueryClient` đã gọi
`setQueryDefaults(['library'], { staleTime: 300_000, gcTime: 600_000 })` cho mọi khoá bắt đầu bằng
`'library'` (`queryClient.ts:58-60` đọc `listCachePolicyDefaults()`). Viết lại con số ấy ở hook là
dựng nguồn sự thật thứ hai — R-71.

**Cổng lỗi:** `queryFn` ném **nguyên** `result.error` (không bọc `new Error`), để
`normalizeQueryError` → `toAppError` nhận ra `HttpError` (`src/lib/errors/toAppError.ts:120,310`) và
giữ `kind`/`requestId`/`retryable` cho luật thử lại `shouldRetry`.

### Ví dụ gọi hoàn chỉnh (khuôn cho hook của màn)

```ts
import { useQueryClient, useQuery } from '@tanstack/react-query';

import { createAppApiClient } from '@/api/appClient';
import { matchesLibraryFilter, type LibraryFilterId, type LibraryItem } from '@/api/client';
import { libraryListQueryOptions, prefetchLibraryItemOnHover } from '@/lib/query/libraryQueries';
import { SCENE_BUDGET, checkBudget } from '@/lib/three/perf/budget';

const apiClient = createAppApiClient();

// 1. Danh mục — một lượt, staleTime 5 phút do cachePolicy quyết.
const { data, error, isLoading } = useQuery(libraryListQueryOptions(apiClient.library));

// 2. Lọc — MỘT nơi quyết định, không viết lại phép so sánh.
const visible = (data ?? []).filter((item) => matchesLibraryFilter(item, activeFilterId));

// 3. Nạp trước khi con trỏ chạm thẻ (D-03) — độ trễ lấy mặc định của prefetchOnHover.
const queryClient = useQueryClient();
const hoverHandlers = prefetchLibraryItemOnHover(queryClient, apiClient.library, item.id);
// <li {...hoverHandlers}> …thẻ 128×128… </li>

// 4. Cảnh báo model nặng trước khi cho kéo (R-04) — KHÔNG bịa ngưỡng.
const warnings = checkBudget({
  drawCalls: sceneReading.drawCalls,
  graphicsMemoryMb: sceneReading.graphicsMemoryMb,
  materials: sceneReading.materials,
  triangles: sceneReading.triangles + item.triangleCount,
});
const isTooHeavy = warnings.length > 0;
```

`checkBudget` trả `readonly BudgetWarning[]`, mỗi phần tử đã mang sẵn câu tiếng Việt trong
`.message` (`budget.ts:184-193`, `capWarning`) — màn hiện lại câu đó, không dựng câu mới.

---

## 5. Bộ mẫu — `src/api/__mocks__/client.ts`

`MOCK_LIBRARY_ITEMS` (`:417`), phục vụ qua `library.list` / `library.read` (`:726-735`).
**Mười sáu mục**, dựng để cả bảy trạng thái của A11 có dữ liệu thật:

| Đặc điểm | Số lượng | Dùng cho |
|---|---|---|
| Tổng số mục | 16 | lưới 2 cột có nghĩa (`'ready'`) |
| Nhóm được phủ | cả 8, mỗi nhóm ≥ 2 mục | bấm chip nào cũng còn thứ để vẽ |
| `source: 'mine'` | 3, ở 3 nhóm khác nhau (`table`, `chair`, `technical`) | chứng minh hai trục độc lập |
| Thiếu `previewUrl` | 2 (`library-storage-2`, `library-sanitary-2`) | `'partial'` — 14/16 có ảnh |
| Vượt `SCENE_BUDGET.maxTriangles` | 1 (`library-technical-2`, 1.240.000 tam giác, 24,8 MB) | cảnh báo R-04 |

`library.read` với id lạ **không trượt** — trả một mục thay thế (`makeFallbackLibraryItem`), cùng
khuôn `makeFallbackFloor`. Nhánh lỗi của màn lái qua cổng của nó, không qua mock.

Bật bằng `VITE_USE_MOCK_API=true` ở chế độ dev (`src/api/appClient.ts`, `resolveUseMockApi`).

---

## 6. Cái task này CỐ Ý không làm

- **Không có mục `library` trong `invalidation.ts`.** Lý do ở mục 3 — `LibraryApi` chỉ đọc.
- **Không có nhãn tiếng Việt trong `src/api`.** Bảng chip ở mục 1.1 là tài liệu; màn tự viết chuỗi.
- **Không định dạng số ở bất cứ đâu trong tầng này** (A15).
- **Không tự nạp `.glb`, không kiểm va chạm** — `modelUrl` chỉ là một chuỗi ở tầng này.
- **Không tạo file nào trong `src/screens/`, không đụng `src/i18n/vi.json`.**

---

## 7. File đã sửa/thêm

| File | Việc |
|---|---|
| `src/api/schemas/library.ts` | **mới** — kiểu, schema, hai trục lọc, `matchesLibraryFilter` |
| `src/api/schemas/index.ts` | `export * from './library'` |
| `src/api/contracts.ts` | cửa ra cho 5 kiểu + 5 hằng/hàm (`:49-61`) |
| `src/api/endpoints.ts` | `LIBRARY_ROOT` + nhóm `library` (`:5`, `:66-68`) |
| `src/api/client.ts` | `ReadLibraryItemInput`, `LibraryApi`, cài đặt (`:221`, `:399`, `:442`, `:596`) |
| `src/api/__mocks__/client.ts` | 16 mục mẫu + nhóm `library` |
| `src/lib/query/libraryQueries.ts` | **mới** — hai query options + đường nạp trước |
| `src/api/__tests__/library.test.ts` | **mới** — 27 test |
| `src/lib/query/__tests__/libraryQueries.test.ts` | **mới** — 12 test |
