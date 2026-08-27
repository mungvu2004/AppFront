# T2 — chữ ký tầng dữ liệu cho màn `/billing`

> Khảo sát mã, không viết mã sản phẩm. Mọi khẳng định dưới đây có bằng chứng
> bằng lệnh hoặc đường dẫn:số dòng. Nguồn: `src/lib/query`, `src/lib/mutations`,
> `src/lib/errors`, `src/lib/auth`, `src/lib/coloring`, và các màn đã xong.

---

## 0. Bằng chứng: không có nhánh billing/invoice/quota

```
$ rg -n "billing|invoice|quota" src/lib/query src/api/endpoints.ts
(không khớp dòng nào)
```

Quét rộng hơn cả repo (trừ file test) cũng chỉ khớp ở `src/routes/paths.ts:44,83`
(hằng số route `/billing`) và `src/routes/router.tsx:86` (placeholder) — đúng như
Q6 đã chốt: không endpoint, không `queryKeys.billing`, không kiểu domain nào tồn
tại. Xác nhận nợ **T-09** trong hợp đồng là thật, không phải giả định.

---

## 1. Trạng thái máy chủ — `src/lib/query/*`

### 1.1 `queryKeys` — `src/lib/query/queryKeys.ts`

- `QueryKeyFactory<TArgs, TKey, TRoot>` — kiểu factory, dòng 18-24.
- `createQueryKeyFactory(root, createKey)` — dòng 36-46. Đóng băng khoá bằng
  `Object.freeze` (`freezeKey`, dòng 34) và gắn `root: () => root` để invalidation
  dò được khoá gốc của một domain.
- `queryKeys` — đối tượng export, dòng 64-115. **10 domain đã khai**: `drawing`,
  `floor`, `library`, `progress`, `project`, `room`, `space`, `user`, `version`,
  `violation`. **Không có `billing`.**

### 1.2 `cachePolicy` — `src/lib/query/cachePolicy.ts`

- `CACHE_POLICY_TIERS` — dòng 6: `'default' | 'static' | 'aiProgress' | 'spatialDraft'`.
- `CACHE_POLICY` — nguồn duy nhất cho mọi con số thời gian, dòng 25-71
  (`default.staleTime` 30 000 ms, `default.gcTime` 600 000 ms, `retry.query` 1,
  `retry.mutation` 0).
- `TIER_BY_DOMAIN` — dòng 77-84, ánh xạ domain → tier. **Không có `billing`** nên
  domain này sẽ rơi vào tier mặc định `'default'` (30 giây) nếu có mặt trong
  `queryKeys` — nhưng nó không có mặt (xem 1.1), nên tier này **không áp dụng**
  cho một khoá cục bộ khai ngoài `queryKeys`.
- `resolveCachePolicyTier(queryKey)` / `resolveCachePolicy(queryKey)` — dòng
  105-126. Chỉ được `queryClient.setQueryDefaults` gọi qua
  `listCachePolicyDefaults()` (dòng 93-100); một khoá cục bộ (mục 1.5) không đi
  qua đường này, nên `useQuery` cho màn `/billing` sẽ dùng **`staleTime`/`gcTime`
  mặc định của `createQueryClient`** (dòng 39,42 của `queryClient.ts`) trừ khi tự
  truyền `staleTime` ngay trong lời gọi `useQuery` — và R-71 cấm hằng số viết tay
  trong màn, nên **không tự truyền một con số mili-giây mới**: dùng mặc định.

### 1.3 `invalidation` — `src/lib/query/invalidation.ts`

- `WRITE_OPERATIONS` — dòng 5-14: `createProject`, `editFloor`, `editWall`,
  `moveFurniture`, `editDimension`, `changeAxis`, `rerunRules`, `restoreVersion`.
  **Không có thao tác nào tên `changePlan`/`upgradePlan`.**
- `invalidationMap` — dòng 44-90, kiểu đóng `InvalidationMap` (dòng 34-38): mỗi
  `WriteOperation` bắt buộc phải có một hàm trả về `readonly QueryKey[]`, và kiểu
  `WriteOperation` là union đóng lấy từ `WRITE_OPERATIONS` — **không thể thêm
  `changePlan` vào bảng này mà không sửa `src/lib/query/invalidation.ts`**, và đó
  là file trong `src/lib/**`, bị cấm sửa (mục [KHÔNG ĐƯỢC SỬA FILE NÀO]).
- `applyInvalidation(queryClient, operation, params)` — dòng 96-106.
- **Kết luận:** màn billing không dùng `applyInvalidation`/`invalidationMap`.
  Sau `confirmChangePlan` thành công, chỗ gọi tự invalidate khoá cục bộ của
  chính nó bằng `queryClient.invalidateQueries({ queryKey: <khoá cục bộ> })` —
  đúng khuôn `useProjectDashboard.ts` tự quản lý cache của nó qua
  `queryClient.setQueryData` (dòng 339) chứ không đụng `invalidationMap`.

### 1.4 `prefetch` — `src/lib/query/prefetch.ts`

- `prefetchOnHover(queryClient, queryKey, fetcher, delayMs = 200)` — dòng 15-49.
  Không bắt buộc dùng cho màn billing (hợp đồng không nhắc prefetch); ghi lại vì
  hợp đồng có thể cần sau này cho thẻ gói.

### 1.5 Khuôn "khai khoá query cục bộ mà không sửa `src/lib`"

Hai màn đã xong chứng minh **hai lối đi khác nhau**, chọn theo việc domain đã có
trong `queryKeys` hay chưa:

- **Domain đã có sẵn** (`project`) → dùng thẳng `queryKeys.project.list()`.
  Bằng chứng: `src/screens/dashboard/ProjectDashboard/useProjectDashboard.ts:221`
  và `src/screens/onboarding/WelcomeScreen/useWelcomeScreen.ts:230` cùng gọi
  `useQuery({ queryKey: queryKeys.project.list(), queryFn })`.
- **Domain chưa có** (`account`) → khai một hằng số khoá **ngay trong file hook
  của màn**, dạng mảng chữ nghĩa `as const`, KHÔNG đụng `queryKeys.ts`. Bằng
  chứng nguyên văn, `src/screens/account/AccountSettings/useAccountSettings.ts:72-79`:

  ```ts
  /**
   * Khoá bộ đệm của lượt đọc cài đặt tài khoản.
   *
   * Dựng tại chỗ chứ không lấy từ `queryKeys`: bảng đó chỉ có `user.current` và
   * `user.list`, không có mục nào cho cài đặt, và `src/lib/**` là thư mục màn này
   * không được sửa. Cùng lối đi mà `projectSettingsQueryKey` đã mở.
   */
  export const accountSettingsQueryKey = ['account', 'settings'] as const;
  ```

  rồi dùng thẳng trong `useQuery` (dòng 165-168):

  ```ts
  const settingsQuery = useQuery({
    queryKey: accountSettingsQueryKey,
    queryFn: () => gateway.read(),
  });
  ```

**Áp dụng cho T5 (`useBillingScreen.ts`):** vì `billing` không có trong
`queryKeys` (mục 1.1), khai đúng khuôn thứ hai — ví dụ
`export const billingQueryKey = (period: BillingPeriod) => ['billing', period] as const;`
— ngay trong `useBillingScreen.ts`, không sửa `src/lib/query/queryKeys.ts`.
`staleTime`/`gcTime` để mặc định (mục 1.2), không truyền tay.

---

## 2. Mutation — `src/lib/mutations/*`

- `createOptimisticMutation(queryClient, config)` —
  `src/lib/mutations/createOptimisticMutation.ts:67-75`. `OptimisticMutationConfig`
  (dòng 8-21) đòi `applyOptimistic` (áp ngay), `rollback` (gỡ khi hỏng),
  `affectedKeys` (khoá snapshot/khôi phục). Đây là khuôn cho A8: **áp dụng ngay,
  hoàn tác được** bằng snapshot cache — đúng cho việc sửa trực tiếp (tường, kích
  thước…), nơi hoàn tác nghĩa là "cache trở lại như cũ".
- `undoTicket.ts` — `UNDO_WINDOW_MS = 8000` (dòng 18), `createUndoTicket` (dòng
  45-77): vé hoàn tác 8 giây, dùng cho toast hoàn tác của A8.
- `coalesce.ts` / `flushPolicy.ts` — `COALESCE_WINDOW_MS = 400` (coalesce.ts:1),
  `createFlushPolicy` (flushPolicy.ts:25-83): gộp nhiều lệnh liên tiếp cùng loại
  thành một trước khi gửi lên máy chủ — dành cho thao tác vẽ liên tục (kéo
  tường), không phải một cú bấm rời rạc.
- `entityQueue.ts` — `runExclusive(entityId, task)` (dòng 10-27): xếp hàng các
  mutation cùng một thực thể để chúng không chạy chồng nhau.
- `notificationBus.ts` — `createNotificationBus` (dòng 79-189): hàng đợi toast,
  gom nhóm theo `type` trong `groupWindowMs`, tự gỡ khi vé hoàn tác hết hạn.

### Phán quyết — "nâng gói" KHÔNG hợp với bộ máy A8 ở trên

**Hành động "nâng gói" (`confirmChangePlan`) đi theo A9, không đi theo A8.**

Lý do, theo đúng bằng chứng:

1. Hợp đồng (`CONTRACT.md` mục 2, `BillingConfirmSummary` + `onChangePlanRequest`
   / `onConfirmDismiss` / `onConfirmAccept`) đã tự đặt một **hộp thoại xác nhận
   trước khi gửi lệnh** — đúng câu A9 yêu cầu: "hành động mà A8 không hoàn tác
   được thì phải hỏi trước bằng hộp thoại". Việc của T2 chỉ là xác nhận bộ máy
   phía dưới không nên là bộ máy A8.
2. `createOptimisticMutation` giả định `rollback` có thể đưa trạng thái **cục bộ**
   về y như cũ (huỷ một phép sửa hình học, một nhãn, một vị trí đồ vật). Một
   khoản tiền đã trừ qua cổng thanh toán thật không phải trạng thái cục bộ có thể
   `rollback()` — không có "undo" nào huỷ được một giao dịch đã xác nhận phía máy
   chủ. Dùng khuôn này ở đây là giả vờ hành động hoàn tác được trong khi nó không
   hề, đúng thứ A9 tồn tại để chặn.
3. `undoTicket`/`notificationBus` (toast hoàn tác 8 giây) đúng cho A8: sửa xong,
   hiện toast, còn kịp bấm hoàn tác. "Nâng gói" đã hỏi trước bằng hộp thoại rồi —
   hỏi trước **và** cho hoàn tác sau là hai cơ chế cho hai lớp hành động khác
   nhau của cùng một hợp đồng (A8 với A9), không cộng dồn cho cùng một hành động.
4. `coalesce`/`flushPolicy`/`entityQueue` giải quyết bài toán gõ/kéo liên tục
   (nhiều lệnh nhỏ dồn thành một chuyến lên server) — "nâng gói" là đúng một cú
   bấm sau khi đã xác nhận, không có gì để gộp.

**Kết luận cho T5:** `onConfirmAccept` gọi thẳng một `useMutation` bọc
`billingGateway.confirmChangePlan(planId, period)` (kiểu `Promise<void>`, mục
2.1 hợp đồng), **không** qua `createOptimisticMutation`, **không** phát
`undoTicket`/`notificationBus`. Thành công thì `queryClient.invalidateQueries({
queryKey: billingQueryKey(period) })` (khoá cục bộ ở mục 1.5) để tải lại
`BillingSnapshot` thật từ gateway — đây là "hoàn tác" duy nhất có ý nghĩa: đọc
lại sự thật, không lùi một bản nháp.

---

## 3. Lỗi (L-03) — `src/lib/errors/*`

- `toAppError(error): AppError` — `src/lib/errors/toAppError.ts:302-332`. Đưa
  mọi lỗi (HttpError, ZodError, WebGL, worker, không rõ hình dạng) về một
  `AppError`.
- `AppError` — `src/lib/errors/kinds.ts:27-36`: `{ kind, code, messageKey,
  params, requestId, retryable, severity, recovery }`.
- `AppErrorKind` / `APP_ERROR_KINDS` — kinds.ts:1-17 (13 loại: `network`,
  `timeout`, `unauthenticated`, `forbidden`, `notFound`, `conflict`,
  `validation`, `rateLimited`, `upload`, `processing`, `geometry`, `export`,
  `unknown`).
- `APP_ERROR_KIND_CONFIG` — kinds.ts:49-180: bảng đầy đủ theo `kind`, mỗi mục có
  `code` cố định (ví dụ `'NETWORK'`, `'FORBIDDEN'`, `'VALIDATION'`…).
- `AppErrorSeverity` — kinds.ts:19 (`'cảnh báo' | 'lỗi' | 'nghiêm trọng'`).
- `AppErrorRecovery` — kinds.ts:21 (`'thử lại' | 'tải lại' | 'liên hệ quản trị' |
  'không'`).
- `describeError(error): ErrorDescription` — `describeError.ts:48-57`. Trả về
  `{ title, description, primaryButtonLabel, secondaryButtonLabel }` —
  `ErrorDescription` (dòng 5-10) **không có trường `code`**.
- `reportError(error, context)` — `report.ts:61-70`, phát sự kiện telemetry, đã
  lọc PII theo `SENSITIVE_CONTEXT_KEY_RE` (dòng 18).

### Trả lời chính xác: "mã ngắn" lấy từ trường nào

**`AppError.code`** (kinds.ts:29), tính bởi `resolveCode(kind, sourceCode)` —
`toAppError.ts:220-221` — trả `sourceCode` nếu có (ví dụ `HttpError.code` từ máy
chủ), hoặc `APP_ERROR_KIND_CONFIG[kind].code` mặc định. **Không phải** một
trường của `ErrorDescription`/`describeError()` — hàm đó chủ động không mang
`code` ra ngoài.

**Áp dụng cho `BillingErrorNotice`** (hợp đồng mục 2: `{ message, code,
retryLabel, onRetry }`): `message` lấy từ `describeError(appError).description`;
`code` lấy **riêng, trực tiếp** từ `appError.code` (không đi qua
`describeError`); `retryLabel` là chuỗi tĩnh `'Thử lại'` (mục 5 hợp đồng), không
phải từ `describeError` (hàm đó trả `primaryButtonLabel` đọc từ
`common.retry`/`common.reload`/`common.contact_admin`/`common.close` tuỳ
`recovery`, không phải chữ cố định "Thử lại" — nếu hợp đồng muốn đúng nhãn nút
tĩnh thì hook tự đặt chuỗi, không gọi `describeError` cho nhãn nút này).

**FOUND — không phải NOT FOUND.**

---

## 4. Quyền (trạng thái 6) — `src/lib/auth/*`, `src/types/project.ts`, `src/hooks/useSession.ts`

- `AUTH_ROLES` — `src/lib/auth/permissions.ts:3`: `['admin', 'engineer',
  'viewer'] as const satisfies readonly ProjectRole[]`.
- `PermissionKey` — permissions.ts:17-25: đúng 8 khoá:
  `project.create`, `project.settings.edit`, `floor.upload`, `layer.edit`,
  `model.export`, `share.create`, `library.manage`, `user.manage`.
  **Không có khoá nào cho `billing`/`plan`/`quota`.**
- `permissionMatrix` — permissions.ts:78-119: `Record<PermissionKey,
  Record<ProjectRole, boolean>>`, đóng theo đúng 8 khoá trên; `PermissionMatrix`
  là kiểu đóng (dòng 32) nên **không thể thêm khoá `billing.plan.change` mà
  không sửa `src/lib/auth/permissions.ts`** — file trong `src/lib/**`, bị cấm
  sửa.
- `can(action, resource, ctx)` — permissions.ts:127-141: tra `permissionMatrix`
  theo `` `${resource}.${action}` ``; không khớp khoá thì trả `false` thẳng
  (dòng 134-136) — **không** ném lỗi, nhưng cũng không có khoá nào cho billing
  để tra.
- `ProjectRole` — `src/types/project.ts:1`: `'admin' | 'engineer' | 'viewer'`.
- `useSession()` — `src/hooks/useSession.ts:1-5`:
  `useSyncExternalStore(subscribeToSession, getSession, getSession)`, trả về
  `SessionSnapshot`.
- `SessionSnapshot` — `src/lib/auth/types.ts:20-24`: `{ status: SessionStatus,
  user: AuthUser | null, roles: ProjectRole[] }`.
- `getSession` / `subscribeToSession` — `src/lib/auth/session.ts:296,298`.

### Trả lời chính xác: biểu thức hook phải dùng

**Ma trận quyền không có khoá nào hợp cho billing → NOT FOUND.** `can('manage',
'project')` hay bất cứ tổ hợp `PermissionResource`/`PermissionAction` nào cũng
không khớp một `PermissionKey` thật (mục danh sách trên), nên `can()` sẽ luôn
trả `false` — không dùng được để phân biệt "admin đổi được gói" khỏi "không đổi
được gói".

**Đề xuất KHÔNG sửa `src/lib`:** đọc thẳng `roles` từ `useSession()`, đúng khuôn
đã chạy ở `src/screens/onboarding/WelcomeScreen/useWelcomeScreen.ts:270`:

```ts
const isViewer = session.roles[0] === 'viewer';
```

Biểu thức cho billing (câu hỏi "vai này có được đổi gói không"):

```ts
const canChangePlan = session.roles.includes('admin');
```

dùng trực tiếp cho `BillingCurrentPlan.canChangePlan` (hợp đồng mục 2) và cho
điều kiện đưa `screenState` về `'forbidden'` (mục 4 hợp đồng: "Chỉ quản trị viên
có thể thay đổi gói" — chỉ vai `admin` mới đổi được, nên điều kiện forbidden là
`!canChangePlan`). Không gọi `can()`, không thêm khoá vào `permissionMatrix`.

---

## 5. P-07 THANG MÀU NGƯỠNG — phán quyết Q8 (T2 chốt)

Đọc `src/lib/coloring/scales.ts` và `src/lib/coloring/legend.ts`.

### Vì sao `SEQUENTIAL_RAMP` / `createQuantileScale` KHÔNG hợp

- `createQuantileScale` (scales.ts:308-332) cắt một **dải số liên tục** của
  nhiều đối tượng thành tối đa 5 dải theo phân vị (`quantileBreaks`,
  scales.ts:255-270) — đúng bài toán "hạng của N phòng theo diện tích", không
  phải bài toán "một thanh hạn mức có đúng 2 trạng thái cố định
  (`normal`/`attention`)".
- `SEQUENTIAL_RAMP` (scales.ts:162-168) chủ ý **chỉ dùng 5 tông trung tính**, và
  chính docstring của file nói rõ lý do, nguyên văn (scales.ts:44-47):

  > "Invariant A2 allows one accent and A4 allows three state colours; a
  > quantitative ramp is neither, so it is built from neutrals and leaves the
  > accent free to keep meaning "selected" and the state colours free to keep
  > meaning verified, attention and violation."

  Nói cách khác: **`SEQUENTIAL_RAMP` cố tình không được phép mang màu trạng
  thái** (`--state-attention-*`). Dùng nó cho ngưỡng hạn mức là dùng sai công cụ
  — nó tồn tại để KHÔNG đụng vào đúng bộ màu mà P-07 cần.
- `bandIndexOf` (scales.ts:278-288) chỉ là hàm phụ trợ tính chỉ số dải từ
  `breaks`, không tự nó là một "thang màu".

### Hàm đúng: `createLookupScale` — một thang phân loại, không phải thang phân vị

`createLookupScale<Key>(table)` — scales.ts:338-349:

```ts
/**
 * A scale over a fixed set of cases rather than a range of numbers.
 * ...
 */
export function createLookupScale<Key extends string>(
  table: Readonly<Record<Key, ColorTokenName>>,
): (key: Key | null | undefined) => ColorTokenName
```

`QuotaTone = 'normal' | 'attention'` (hợp đồng mục 2) là đúng hình dạng
`createLookupScale` muốn: **một tập hợp cố định các trường hợp**, không phải một
dải số cần cắt phân vị. Đây là hàm có thật, đúng việc.

### Token nào là "nhạt" cho nhánh `attention`

`COLOR_TOKEN_NAMES` có ba biến thể của nhánh attention (scales.ts:83-85):
`--state-attention`, `--state-attention-text`, `--state-attention-tint`. Đọc giá
trị thật ở `src/styles/globals.css`:

| Token | Sáng (light) | Tối (dark) |
|---|---|---|
| `--state-attention` (dòng 109/169) | `#be9b4f` | `#d4b46a` |
| `--state-attention-text` (dòng 110/170) | `#7a5f16` | `#e3cb92` |
| `--state-attention-tint` (dòng 111/171) | `#fcf6e6` | `#2c2617` |

`--state-attention-tint` là biến thể **nhạt** (nền gần trắng ở theme sáng, nền
gần đen-ám-vàng rất tối ở theme tối) — đúng nghĩa đen "thang màu nhạt" mà P-07
đòi. `--state-attention` là tông giữa (dùng cho fill mạnh/icon), `-text` là biến
thể cho chữ. Dùng `-tint` cho phần fill của thanh hạn mức khi `tone ===
'attention'` tránh luôn bẫy tương phản mà `legend.ts:17-21` đã cảnh báo (tông
giữa `--state-attention` không đạt 4,5:1 cho chữ trên nó).

### Kết luận — (a): tên hàm có thật + cách gọi

```ts
import { createLookupScale } from '@/lib/coloring/scales';
import type { QuotaTone } from './useBillingScreen'; // hoặc nơi QuotaTone khai

const quotaFillToken = createLookupScale<QuotaTone>({
  normal: '--accent',              // đúng token "phần đầy" đã chốt ở CONTRACT.md mục 6
  attention: '--state-attention-tint',
});
```

Chỉ hai nhánh, đúng hai giá trị của `QuotaTone` — **không thêm màu thứ tư**:
A4 chỉ cho phép ba màu trạng thái (`verified`/`attention`/`violation`) và
`verified` không liên quan tới hạn mức (A5: xanh "đã xác minh" chỉ đánh dấu việc
người duyệt, không phải trạng thái dữ liệu billing); `violation` không dùng ở
đây vì hợp đồng chỉ định nghĩa hai mức `normal`/`attention` cho `QuotaTone`, và
Q8 tự nó chỉ hỏi về nhánh "cần chú ý". Nhánh `normal` dùng lại `--accent` —
đúng token "phần đầy" mặc định đã chốt sẵn ở `CONTRACT.md` mục 6, không phải một
token mới bịa ra.

---

## 6. Tiền lệ gateway

### `accountSettingsGateway.ts` (JSDoc dòng 1-32) — khuôn cho gateway KHÔNG có dây thật

- **Hình dạng interface** (dòng 37-42): `{ read: () => Promise<T>, save: (draft:
  T) => Promise<void> }` — chỉ đúng những hàm màn cần, không hơn.
- **Vì sao trả `Promise`** — JSDoc dòng 47-53, nguyên văn: `useQuery` phải có
  một lượt "đang tải" thật để trạng thái 2 của A11 không phải là thứ chỉ tồn tại
  trong story. Xác nhận thêm ở `CONTRACT.md:223-224`: "Mọi hàm trả `Promise` —
  `useQuery` phải có một lượt 'đang tải' thật, nếu không trạng thái 2 của A11
  chỉ tồn tại trong story."
- **Hàm reset cho test** — dòng 65-68: `resetAccountSettingsStore(): void`,
  JSDoc ghi rõ "Dành cho test; sản phẩm không gọi." Đúng khuôn đặt tên
  `reset<TênMàn>Store`.
- **Cách ghi nợ** — khối JSDoc đầu file (dòng 4-24) giải thích: vì sao là bộ nhớ
  trong (không endpoint thật), khoản nợ có mã (**T-08**), và chỉ rõ khi nối dây
  thật thì **chỉ một file này đổi**, `useAccountSettings` và các khối con không
  đổi dòng nào.

### `projectSettingsGateway.ts` — khuôn cho gateway CÓ MỘT PHẦN dây thật

- Nhận `ApiClient` qua tham số (dòng 257): `createProjectSettingsGateway(client:
  ApiClient): ProjectSettingsGateway` — để test cắm `createMockApiClient()`
  đúng khuôn sản phẩm dùng (R-70), tách khỏi bản không tham số
  `createAppProjectSettingsGateway()` (dòng 334-336) gọi
  `createAppApiClient()` thật.
- Bảy trường chưa có dây giữ trong `Map` theo `projectId` (dòng 181), hợp nhất
  với ba trường có dây (từ `ApiClient`) ở `toSnapshot` (dòng 208-226) — mẫu
  "một số trường thật, một số trường mock, gộp ở một hàm dịch".
- Debt ghi ở đầu file (dòng 1-30), mã **T-04**, cùng cấu trúc lời hứa "chỉ file
  này đổi khi nối dây".

### Áp dụng cho `billingGateway.ts` (T4)

Vì Q6 đã chốt **không có endpoint/domain nào** cho billing (mục 0), khuôn hợp là
bản **không có dây thật** (`accountSettingsGateway.ts`), không phải bản có
`ApiClient` từng phần: `createBillingGateway(): BillingGateway` (không tham số,
dữ liệu mock có cấu trúc theo đúng kiểu `BillingSnapshot` của `CONTRACT.md` mục
2.1 — "dữ liệu là mock có cấu trúc, không hard-code" theo lệnh của người duyệt),
cộng `resetBillingGatewayStore(): void` cho test, cộng JSDoc đầu file ghi nợ
**T-09** và chỉ rõ file duy nhất phải đổi khi nối dây thật.

---

## 7. Bảy trạng thái từ `useQuery` — khuôn ánh xạ

Đọc `src/screens/onboarding/WelcomeScreen/useWelcomeScreen.ts:268-281`:

```ts
const screenState = useMemo<SevenState>(() => {
  if (isViewer) return 'forbidden';
  if (isCollapsed) return 'collapsed';
  if (listQuery.isPending) return 'loading';
  if (listQuery.isError) return 'error';
  if (!step1Done) return 'empty';
  if (step3Done) return 'success';
  return 'partial';
}, [isViewer, isCollapsed, listQuery.isPending, listQuery.isError, step1Done, step3Done]);
```

Khuôn: **một chuỗi `if` theo đúng một thứ tự ưu tiên cố định**, không phải một
bảng tra hay switch không thứ tự — vì hai điều kiện có thể đúng cùng lúc (ví dụ
vừa `isPending` vừa sẽ `isViewer`) và luật là **quyền thắng mọi thứ khác**
(dòng 268: "`forbidden` thắng mọi thứ còn lại"), rồi mới tới trạng thái hiển thị
cục bộ (`collapsed`), rồi mới tới vòng đời mạng (`isPending` → `isError`), rồi
mới tới suy luận trên dữ liệu đã có (`empty`/`success`/`partial`).

**Áp dụng cho `useBillingScreen.ts`** (7 trạng thái của billing:
`empty | loading | partial | error | ready | forbidden | collapsed`):

```ts
const state = useMemo<BillingScreenState>(() => {
  if (!canChangePlan && /* xem mục 4: điều kiện forbidden của billing */) return 'forbidden';
  if (isCollapsed) return 'collapsed';
  if (billingQuery.isPending) return 'loading';
  if (billingQuery.isError) return 'error';
  if (invoices.length === 0) return 'empty';
  if (degraded.length > 0) return 'partial';
  return 'ready';
}, [/* … */]);
```

Thứ tự chính xác giữa `empty` và `partial` (khối nào đọc trước) là quyết định
của T5 dựa trên hợp đồng mục 4 (dòng 271: "Rỗng ... Ba khối trên vẫn hiện"), T2
chỉ xác nhận **khuôn chuỗi if theo ưu tiên** là đúng lối, không phải khuôn
switch hay bảng tra.

---

## NOT FOUND

| # | Việc | Ghi trong hợp đồng | Kết luận NOT FOUND | Đề xuất |
|---|---|---|---|---|
| 1 | Endpoint/domain billing trong `src/lib/query`, `src/api/endpoints.ts` | Q6 | NOT FOUND (mục 0) | `billingGateway.ts` trong thư mục màn (T4), nợ T-09 — đã chốt sẵn trong `CONTRACT.md` |
| 2 | Khoá `queryKeys.billing.*` | mục 1 | NOT FOUND (mục 1.1) | Khoá cục bộ `billingQueryKey(period)` khai trong `useBillingScreen.ts`, đúng khuôn `accountSettingsQueryKey` (mục 1.5) |
| 3 | Thao tác `changePlan` trong `WRITE_OPERATIONS`/`invalidationMap` | mục 1 | NOT FOUND (mục 1.3) | Không dùng `applyInvalidation`; tự `queryClient.invalidateQueries({ queryKey: billingQueryKey(period) })` sau khi `confirmChangePlan` thành công |
| 4 | Mutation A8 (optimistic/undo) hợp cho "nâng gói" | mục 2 | NOT FOUND — hành động này thuộc A9, không thuộc A8 (mục 2) | `useMutation` trơn bọc `billingGateway.confirmChangePlan`, sau hộp thoại xác nhận đã có sẵn trong hợp đồng |
| 5 | Trường "mã ngắn" trong `ErrorDescription`/`describeError()` | mục 3 | NOT FOUND — `ErrorDescription` không có `code` (mục 3) | Lấy `code` trực tiếp từ `AppError.code` (`toAppError(error).code`), tách khỏi `describeError()` |
| 6 | `PermissionKey`/`permissionMatrix` cho billing/đổi gói | mục 4 | NOT FOUND (mục 4) | Đọc thẳng `useSession().roles.includes('admin')`, đúng khuôn `useWelcomeScreen.ts:270`, không sửa `src/lib/auth` |

**Q8 (P-07, mục 5) KHÔNG nằm trong bảng này.** Đây là mục duy nhất trong 7 mục
của nhiệm vụ có kết luận (a) — hàm thật, có cách gọi (`createLookupScale`,
mục 5) — không phải NOT FOUND. Sáu dòng trên là toàn bộ danh sách NOT FOUND của
T2.
