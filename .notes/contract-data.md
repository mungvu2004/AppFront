# T5 — Data-layer contract for the drawings/floors upload screen

Read-only survey. Every symbol below was read from the actual file at the stated path/line;
anything not found is marked `NOT FOUND` explicitly rather than guessed.

---

## (a) The drawings API — `src/api/client.ts`

### `ApiResult<T>` and how success/failure is told apart

```ts
export type ApiError = HttpError | AppError;                // :29
export type ApiResult<T> = Result<T, ApiError>;              // :30
```

`Result<T, E>` (from `src/lib/http/types.ts:3-11`) is a plain discriminated union:

```ts
export type Result<T, E> =
  | { ok: true; data: T }
  | { ok: false; error: E };
```

A caller checks `.ok`. There is no thrown exception path for expected failures — `if (!result.ok) { … result.error … }`. `HttpError` (`src/lib/http/types.ts:17-24`) carries `kind: 'network'|'timeout'|'aborted'|'auth'|'http'|'parse'`, `status?`, `code?`, `requestId`, `retryable`, `raw`. `AppError` is defined in `src/lib/errors` (not read in full here — only imported type in client.ts:1) and is what `decode()`/`safeParseList()` (`src/api/schemas/decode.ts`) return on a schema-validation failure (`kind: 'validation'`, `code: 'CONTRACT_VALIDATION'`).

### `RequestOptions` / `WriteRequestOptions` (:32-38)

```ts
export interface RequestOptions {
  signal?: AbortSignal;
}
export interface WriteRequestOptions extends RequestOptions {
  idempotencyKey?: string;
}
```

### The four drawing input types (:90-119)

```ts
export interface InitDrawingUploadInput extends WriteRequestOptions {
  body: {
    fileName: string;
    floorId: string;
    mimeType: string;
    projectId: string;
    sizeBytes: number;
  };
}

export interface SendDrawingChunkInput extends WriteRequestOptions {
  body: {
    chunk: string;       // base64/string chunk payload, no chunk-size limit is enforced client-side
    chunkIndex: number;
  };
  projectId: string;
  uploadId: string;
}

export interface CompleteDrawingUploadInput extends WriteRequestOptions {
  body: {
    uploadId: string;
  };
  projectId: string;
}

export interface ReadDrawingProgressInput extends RequestOptions {
  projectId: string;
  uploadId: string;
}
```

Note: `SendDrawingChunkInput`/`CompleteDrawingUploadInput` carry `projectId`/`uploadId` **outside** `body`, but `body.uploadId` is duplicated inside `CompleteDrawingUploadInput.body` too. `InitDrawingUploadInput` carries `projectId`/`floorId` **inside** `body`, not as sibling fields. Match these shapes exactly — they are not uniform.

There is no client-side chunking, no parallelism, and no size-limit constant anywhere in `src/api/client.ts` or `src/lib/http` for drawing uploads — confirms the screen-spec prohibition ("khong tu chia khuc, khong tu dem song song, khong tu viet gioi han dung luong") describes the current reality, not a rule to newly add.

### `DrawingsApi` interface (:170-175)

```ts
export interface DrawingsApi {
  complete(input: CompleteDrawingUploadInput): Promise<ApiResult<Progress>>;
  initUpload(input: InitDrawingUploadInput): Promise<ApiResult<Progress>>;
  progress(input: ReadDrawingProgressInput): Promise<ApiResult<Progress>>;
  sendChunk(input: SendDrawingChunkInput): Promise<ApiResult<Progress>>;
}
```

All four calls resolve to `Progress` (see (b)), never to `Drawing` directly — the uploaded `Drawing` only shows up later, inside `Floor.drawings[]`, once the caller re-reads the floor/project.

### `FloorsApi` (:163-168) — needed to list floors

```ts
export interface FloorsApi {
  create(input: CreateFloorInput): Promise<ApiResult<Floor>>;
  delete(input: DeleteFloorInput): Promise<ApiResult<Floor>>;
  list(options?: RequestOptions): Promise<ApiResult<Floor[]>>;
  reorder(input: ReorderFloorsInput): Promise<ApiResult<Floor[]>>;
}
```

**Load-bearing gap: `floors.list()` takes NO `projectId`.** `ENDPOINTS.floors.list` (`src/api/endpoints.ts:45`) is the flat path `/floors` — it returns every floor the server holds, across every project, not just the open one. There is no client-side per-project scoping mechanism (no header, no context, checked `src/lib/http` — nothing matching `projectId`/`withProject`). The one real caller in the codebase, `src/screens/project/ProjectSettings/projectSettingsGateway.ts:279-296`, documents and works around exactly this:

```ts
// Bước đọc quyết định tập tầng hợp lệ. `floors.list()` không nhận mã dự
// án, nên tự nó trả về mọi tầng máy chủ đang giữ; lọc theo `project.floors`
// là thứ giữ cho lượt xoá không chạm tầng của dự án khác.
const projectResult = await client.projects.read({ projectId });
const allowedIds = new Set(projectResult.data.floors.map((floor) => floor.id));
const listResult = await client.floors.list();
const targets = listResult.data.filter((floor) => allowedIds.has(floor.id));
```

**For this screen: to list "the floors of one project", call `client.projects.read({ projectId })` and read `.data.floors` (already `Floor[]`, per (b)) — do not call `client.floors.list()` and filter by hand unless you specifically need the create/delete/reorder actions, which are floor-scoped, not project-scoped, by design.** `queryKeys.floor.list(projectId)` (see (c)) is keyed by `projectId` regardless of which underlying call fills it — the query key does not have to mirror the API's own scoping.

### `ProjectsApi` (:137-143)

```ts
export interface ProjectsApi {
  create(input: CreateProjectInput): Promise<ApiResult<Project>>;
  delete(input: DeleteProjectInput): Promise<ApiResult<Project>>;
  list(options?: RequestOptions): Promise<ApiResult<Project[]>>;
  read(input: ReadProjectInput): Promise<ApiResult<Project>>;
  update(input: UpdateProjectInput): Promise<ApiResult<Project>>;
}
```
`ReadProjectInput extends RequestOptions { projectId: string }` (:57-59).

### How the client is obtained — factory, no context, no module singleton

`src/api/appClient.ts` exports `createAppApiClient(): ApiClient` (:70-74) — a plain factory, called fresh by whoever needs it:

```ts
export function createAppApiClient(): ApiClient {
  return resolveUseMockApi()
    ? createMockApiClient()
    : createApiClient(createHttpClient({ baseUrl: resolveApiBaseUrl() }));
}
```

There is **no React context** and **no exported module-level singleton** (`createApiClient` itself, exported at `client.ts:286`, is the raw constructor taking an `HttpClient`; nothing calls it once and exports the result). Real call sites each call `createAppApiClient()` themselves, once, and hold the reference:
- `src/screens/project/ProjectSettings/projectSettingsGateway.ts:335` — `return createProjectSettingsGateway(createAppApiClient());` (module-level factory function, gateway closes over the client)
- `src/screens/project/CreateProjectModal/CreateProjectModal.container.tsx:117` — `const client = useMemo(() => createAppApiClient(), []);` (memoized once per container instance)
- `src/screens/auth/AuthScreen/AuthScreen.container.tsx:174` — `const client = createAppApiClient();`

`resolveUseMockApi()` gates on `import.meta.env.DEV && VITE_USE_MOCK_API === 'true'`; fails closed to the real client otherwise.

### `src/api/__mocks__/client.ts` — what the mock provides

`createMockApiClient(): ApiClient` builds one in-memory `project` + `floors` array (seeded from `SAMPLE_BUILDING`/`MOCK_SPATIAL_PROJECT` fixtures) plus an `uploads: Map<string, Progress>` keyed by `` `${projectId}::${uploadId}` ``. Drawings group behavior (:152-174):
- `initUpload({ body })` — creates a `Progress` keyed by `` `${body.projectId}-${body.floorId}` `` (note: keyed by **floorId**, not a server-issued upload id — the mock does not generate one), `step: 'Initialize upload'`, default `progressPercent: 50` overridden by `makeProgress` defaults... actually explicit override only sets `step`; percent stays the `makeProgress` default (50). Stores it, returns `ok(progress)`.
- `sendChunk({ body, projectId, uploadId })` — looks up existing entry, clones it, sets `step: 'Send chunk'`, bumps `progressPercent` by `25 + body.chunkIndex` capped at 99.
- `complete({ body, projectId })` — writes a fresh `Progress` with `progressPercent: 100, status: 'completed'`, keyed by `body.uploadId`.
- `progress({ projectId, uploadId })` — reads the map, falling back to `progressPercent: 0` if absent.

The mock never actually appends the new `Drawing` into `floors[].drawings` — completing an upload through the mock updates only the `uploads` progress map, not the floor's drawing list. **A screen driven purely by the mock will not see its own uploaded drawing appear in a subsequent `floors.list`/`projects.read` unless the mock is extended** — worth flagging to whoever wires the screen against the mock for tests/demo.

Two exported names: `mockApiClient` (a ready instance) and `createApiClientMock` (= `createMockApiClient`, an alias).

---

## (b) Schemas and types — `src/api/schemas/index.ts`

(`src/api/contracts.ts` re-exports these same schemas/types 1:1 and adds `Floor/DrawingWirePayload` builders — see below. `client.ts` imports from `./contracts`, not directly from `./schemas`.)

### `DrawingSchema` / `Drawing` (:115-140)

```ts
export const DrawingSchema = z.object({
  heightMm: positiveMmIntegerSchema,   // z.number().int().positive()
  id: idSchema,                        // z.string().min(1)
  name: z.string().min(1),
  scale: z.number().positive().optional(),
  uploadedAt: isoDateTimeSchema,       // z.string().datetime({ offset: true })
  uploaderId: idSchema,
  url: z.string().url(),
  widthMm: positiveMmIntegerSchema,
}).strict().transform(...);

export type Drawing = z.infer<typeof DrawingSchema>;
export type DrawingWire = z.input<typeof DrawingSchema>;
```
Fields: `heightMm` (number, required), `id` (string, required), `name` (string, required), `scale` (number, **optional**), `uploadedAt` (ISO datetime string, required), `uploaderId` (string, required), `url` (string URL, required), `widthMm` (number, required). No `mimeType`, no `sizeBytes`, no `floorId` on the decoded `Drawing` — those only exist in the upload *input* types (a).

### `FloorSchema` / `Floor` (:141-163)

```ts
export const FloorSchema = z.object({
  areaM2: z.number().nonnegative().optional(),
  drawings: z.array(DrawingSchema),
  elevationMm: mmIntegerSchema,        // z.number().int()
  heightMm: positiveMmIntegerSchema,
  id: idSchema,
  name: z.string().min(1),
  order: z.number().int(),
}).strict().transform(...);

export type Floor = z.infer<typeof FloorSchema>;
export type FloorWire = z.input<typeof FloorSchema>;
```
Fields: `areaM2` (number, **optional**), `drawings` (`Drawing[]`, required — always an array, never optional/undefined), `elevationMm` (integer, required, can be negative — basement), `heightMm` (positive integer, required), `id` (string, required), `name` (string, required), `order` (integer, required). **This is spec code T-04's Floor. Do not invent a parallel floor type in the screen or hook — use this one, decoded, everywhere.**

### `ProgressSchema` / `Progress` (:165-188)

```ts
export const ProgressSchema = z.object({
  endedAt: isoDateTimeSchema.optional(),
  error: z.string().min(1).optional(),
  id: idSchema,
  progressPercent: z.number().int().min(0).max(100),
  startedAt: isoDateTimeSchema.optional(),
  status: wireProgressStatusSchema,   // z.enum(['pending','running','completed','failed'])
  step: z.string().min(1),
}).strict().transform(...);

export type Progress = z.infer<typeof ProgressSchema>;
export type ProgressStatus = Progress['status'];  // 'pending'|'running'|'completed'|'failed'
```
Fields: `endedAt` (optional ISO string), `error` (optional string — the message a failed upload/step carries), `id` (string, required), `progressPercent` (integer 0-100, required), `startedAt` (optional ISO string), `status` (enum, required), `step` (string, required — human/log label of current stage, e.g. "Upload drawing"). No `floorId` or `uploadId` field inside `Progress` itself — the caller must remember which upload a given `Progress.id` belongs to (the input types' `uploadId` is the correlation key, not a field of the decoded resource).

### Wire vs decoded, and where decoding happens

- `*Wire` types (`FloorWire`, `DrawingWire`, `ProgressWire` = `z.input<typeof Schema>`) are the raw server JSON shape *before* the schema's `.transform()` runs.
- The plain types (`Floor`, `Drawing`, `Progress` = `z.infer`/`z.output`) are what the rest of the app uses — after decode, enum wire-strings are mapped through `*ByWire` tables (a no-op today since wire and app enum values are identical strings, but the layer of indirection is intentional and future-proof).
- Decoding happens in `src/api/schemas/decode.ts`: `decode(schema, data, source)` for a single object, `safeParseList(schema, data, source, options?)` for arrays (tolerates up to 20% invalid items, warns via `console.warn` by default, drops bad items rather than failing the whole list — unless the invalid ratio is exceeded, in which case the whole result is `{ ok: false }`). Both return `Result<T, AppError>`. `client.ts`'s internal `decodeSingle`/`decodeList` helpers (:216-238) call these after every raw HTTP call succeeds.
- `src/api/contracts.ts` additionally exports **wire payload builders** for outbound writes: `toFloorWirePayload(input: FloorPayload): Partial<FloorWire>`, `toDrawingWirePayload`, `toProgressWirePayload`, `toProjectWirePayload`, `toVersionWirePayload` — these strip `undefined` fields via spread-guards so a partial patch body only sends the fields actually set.

---

## (c) Query keys and cache — `src/lib/query/`

### `queryKeys.ts` — factory signature and the four keys this screen needs

```ts
const createQueryKeyFactory = <
  const TRoot extends QueryBranchRoot,
  const TArgs extends readonly unknown[],
  const TKey extends QueryKey,
>(
  root: TRoot,
  createKey: (...args: TArgs) => TKey,
): QueryKeyFactory<TArgs, TKey, TRoot> =>
  Object.assign((...args: TArgs) => freezeKey(createKey(...args)), { root: () => root });
```
A factory is a callable function that also carries `.root()` (the frozen `[domain, branch]` tuple, used by `cachePolicy.ts` to bucket by domain). One real call site (below) shows the calling convention.

The four exact factories:
```ts
queryKeys.floor.list(projectId: string)      // -> readonly ['floor','list', projectId]
queryKeys.floor.detail(floorId: string)      // -> readonly ['floor','detail', floorId]
queryKeys.drawing.byFloor(floorId: string)   // -> readonly ['drawing','byFloor', floorId]
queryKeys.progress.byFloor(floorId: string)  // -> readonly ['progress','byFloor', floorId]
```
All keys are `Object.freeze`d arrays (`as const` tuples). `progress.byFloor` is keyed by **floorId**, not by uploadId — if the screen tracks multiple concurrent per-file uploads on one floor, per-file progress must live in local/component state (or a different cache shape), not directly as one `useQuery` per upload against this key, unless the hook design intentionally maps `uploadId -> Progress` client-side and stores that map under the one `progress.byFloor(floorId)` key.

### `cachePolicy.ts` — exported names, 2 lines each

- `CACHE_POLICY_TIERS`, `CachePolicyTier` — the four tiers: `'default' | 'static' | 'aiProgress' | 'spatialDraft'`.
- `CACHE_POLICY` — single source of truth for every timing/retry number: `default` `{ gcTime: 600_000, staleTime: 30_000 }`; branch overrides `static: 300_000`, `aiProgress: 0`, `spatialDraft: 10_000` (staleTime only, gcTime always the default 600_000); `retry: { query: 1, mutation: 0 }`.
- `listCachePolicyDefaults()` — returns per-domain `{ queryKey, gcTime, staleTime, tier }[]` for `queryClient.setQueryDefaults`, called once inside `createQueryClient`.
- `resolveCachePolicyTier(queryKey)` / `resolveCachePolicy(queryKey)` — look up a key's tier/policy from its first segment via `TIER_BY_DOMAIN`.
- **`TIER_BY_DOMAIN` maps `drawing -> 'spatialDraft'` (staleTime 10s) and `progress -> 'aiProgress'` (staleTime 0, always refetch). `floor` is NOT in the map, so `floor.list`/`floor.detail` fall back to `'default'` (staleTime 30s, gcTime 10min).** This is already wired into `queryClient`'s defaults — a plain `useQuery({ queryKey: queryKeys.drawing.byFloor(floorId), ... })` inherits 10s staleTime with zero extra code, same pattern the `ProjectDashboard` doc-comment describes for `project`.

### `invalidation.ts` — exported names

- `WRITE_OPERATIONS` / `WriteOperation` — 8 named operations (`createProject`, `editFloor`, `editWall`, `moveFurniture`, `editDimension`, `changeAxis`, `rerunRules`, `restoreVersion`). **There is no `uploadDrawing`/`reassignDrawing`/`deleteDrawing` operation in this map** — the drawings screen's own mutations are not (yet) represented here. `moveFurniture` is the closest existing entry that touches `queryKeys.drawing.byFloor(floorId)`, but it's semantically unrelated (3D furniture placement, not file upload) — do not repurpose it.
- `invalidationMap: InvalidationMap` — pure data, operation → the exact keys it invalidates.
- `applyInvalidation(queryClient, operation, params)` — loops the map's keys and calls `queryClient.invalidateQueries({ queryKey })` for each; never invalidates without a key.

**For the upload/reassign/remove mutations this screen needs, the hook author will either extend `WRITE_OPERATIONS`/`invalidationMap` with new operations, or call `queryClient.invalidateQueries({ queryKey: queryKeys.drawing.byFloor(floorId) })` (and `queryKeys.floor.detail(floorId)` if `areaM2`/other floor fields can change) directly inside `afterSuccess` of the optimistic-mutation config from (d) — both are consistent with the existing pattern; nothing in `src/lib/query` forces going through `invalidationMap`.**

### `queryClient.ts` — exported names

- `normalizeQueryError(error): AppError` — wraps `toAppError`.
- `createQueryClient(overrides?: DefaultOptions): QueryClient` — the one place `new QueryClient()` is called; wires `CACHE_POLICY.retry.*`, a `shouldRetry` that also checks `AppError.retryable`, and `onError` handlers that call `reportError`.
- `queryClient` — the shared app-wide instance (`createQueryClient()` called once at module load).

### `prefetch.ts` — exported names

- `prefetchOnHover<TData>(queryClient, queryKey, fetcher, delayMs = 200): PrefetchOnHoverHandlers` — returns `{ onPointerEnter, onPointerLeave }`; starts a `queryClient.prefetchQuery` only after the pointer dwells `delayMs` and only if the key has no cached data yet; leaving early cancels the pending timer.

### Real existing call site (pattern to copy)

`src/screens/dashboard/ProjectDashboard/useProjectDashboard.ts:220-223`:
```ts
const listQuery = useQuery({
  queryKey: queryKeys.project.list(),
  queryFn: options.fetchList ?? fetchProjectList,
});
```
— `queryFn` is injected as a hook option, defaulting to a gateway function (`./projectsGateway.ts`), exactly so tests can drive all seven states without a real network (see `UseProjectDashboardOptions.fetchList`). `prefetchOnHover` is wired per-row at :311-320. State derivation (`listQuery.isPending`, `listQuery.isError`, `listQuery.error`) feeds the `SevenState` union directly — no hand-rolled `isLoading`/`error` booleans.

**For `queryKeys.floor.list(projectId)`, `queryKeys.drawing.byFloor(floorId)`, `queryKeys.progress.byFloor(floorId)` specifically: NO EXISTING CALL SITE.** They appear only in `invalidation.ts`, its tests, `cachePolicy.test.ts`, `queryKeys.test.ts`, and one `invalidateQueries` call in `useProjectSettings.ts:720` (invalidation only, not a `useQuery` read). This confirms CLAUDE.md's note: the query layer is finished-but-uncalled for floors/drawings/progress, and this screen is the first real reader — plug into `queryKeys`/`cachePolicy`/`queryClient` as-is, do not rebuild them.

---

## (d) Mutations — `src/lib/mutations/`

### `createOptimisticMutation.ts` — full signature

```ts
export interface OptimisticMutationConfig<TVariables, TResult> {
  affectedKeys: (variables: TVariables) => readonly QueryKey[];
  afterSuccess: (result: TResult, variables: TVariables) => void;
  applyOptimistic: (variables: TVariables) => void;
  callServer: (variables: TVariables) => Promise<TResult>;
  entityId: (variables: TVariables) => string;
  rollback: (variables: TVariables) => void;
}

export function createOptimisticMutation<TVariables, TResult>(
  queryClient: QueryClient,
  config: OptimisticMutationConfig<TVariables, TResult>,
): UseMutationOptions<TResult, AppError, TVariables>
```
Returns `UseMutationOptions` — the caller still does `useMutation(createOptimisticMutation(queryClient, config))` themselves; this function does not call `useMutation` internally.

Lifecycle (`runOptimisticLifecycle`, :37-59): `queryClient.cancelQueries` for every `affectedKeys(variables)` → snapshot their current cached data (`getQueryData`) → `applyOptimistic(variables)` (synchronous, immediate UI update) → `await callServer(variables)`. On success: `afterSuccess(result, variables)` runs (this is where a hook would call `queryClient.invalidateQueries` or `setQueryData`) and the result is returned. **On failure: every affected key's cached data is restored via `setQueryData` to the pre-mutation snapshot, `rollback(variables)` runs (for state outside the query cache), and the error is re-thrown as `AppError` via `toAppError`.** Rollback is therefore two-part: query-cache snapshot restore (automatic) + a caller-supplied `rollback` for anything else (e.g. an optimistic entry added to local component state, or an object URL created for a preview).

`entityId(variables)` feeds `runExclusive` from `entityQueue.ts` — mutations sharing an `entityId` never run concurrently; different `entityId`s run in parallel. For this screen, `entityId` would plausibly be the drawing/file id (so two edits to the *same* file serialize, but two different files' uploads still run in parallel) or the floor id if per-floor serialization is what the "reassign a file to another floor" operation needs to stay consistent.

### `coalesce.ts`

`Command<TValue>` / `CoalescedCommand<TValue>` + `coalesce(commands, windowMs = COALESCE_WINDOW_MS = 400)`. Merges consecutive same-`kind`+`targetId` commands within `windowMs` of each other into one, keeping the run's first `previousValue` and last `value`. For: collapsing rapid repeated edits (e.g. a slider being dragged) into one network write instead of one per tick.

### `entityQueue.ts`

`runExclusive<TResult>(entityId: string, task: () => Promise<TResult>): Promise<TResult>`. For: serializing same-entity mutations so overlapping writes to one entity never race; different entities run fully in parallel, no global lock.

### `flushPolicy.ts`

`createFlushPolicy<TValue>({ idleMs?, maxQueueSize? = 20, onFlush, windowMs? }): FlushPolicy<TValue>` with `{ enqueue, flush, changeFloor }`. For: buffering+coalescing a burst of commands and flushing them as one batch — on idle timeout, on hitting `maxQueueSize`, when an incoming command can't join the current run, or when `changeFloor()` is called explicitly (a natural hook for "user switched which floor they're uploading to").

### `notificationBus.ts`

`createNotificationBus({ groupWindowMs? = 5000, maxVisible? = 3, now? }): NotificationBus` with `{ list, publish, subscribe }`. For: a pure (no toast-library, no DOM) notification/toast state store — same-type publishes within `groupWindowMs` collapse into one grouped notification whose single undo ticket undoes every grouped change (`buildGroupedTicket`), oldest evicted once `maxVisible` is exceeded. This is very likely what backs A8's "toast hoàn tác" for a burst of file removals.

### `undoTicket.ts` — one line (T4's territory)

`createUndoTicket({ description, undo, now?, ttlMs? = UNDO_WINDOW_MS = 8000 }): UndoTicket` with `{ id, description, expiresAt, getStatus(), undo(): Result<void,'expired'> }` — covered in full by parallel worker T4, not duplicated here.

---

## (e) Offline — `src/lib/offline/` (spec code T-09)

### `queueStore.ts`

```ts
export interface QueueStore {
  addPendingCommand(input: PendingCommandInput): Promise<Result<PendingCommand, QueueStoreError>>;
  close(): void;
  deletePendingCommand(id: number): Promise<Result<void, QueueStoreError>>;
  isVolatile: boolean;
  listPendingCommands(projectId: string): Promise<Result<PendingCommand[], QueueStoreError>>;
  moveToDeadLetter(id: number, reason: string): Promise<Result<DeadLetterCommand, QueueStoreError>>;
}

export const createQueueStore = (options: QueueStoreOptions = {}): QueueStore
```
`createQueueStore` picks IndexedDB (`createIndexedDbQueueStore`) when `globalThis.indexedDB` (or `options.factory`) exists, else an in-memory fallback (`createMemoryQueueStore`, `isVolatile: true` — commands lost on reload). Module also exports bound top-level functions against one `defaultQueueStore = createQueueStore()`: `addPendingCommand`, `listPendingCommands`, `deletePendingCommand`, `moveToDeadLetter`.

- `PendingCommandInput { command: unknown; createdAt?: number; projectId: string }`
- `PendingCommand { command: unknown; createdAt: number; id: number; isVolatile: boolean; projectId: string; sizeBytes: number }`
- `QueueMetrics { maxPendingBytes; maxPendingCommands; pendingBytes; pendingCommands }` — hard caps: `MAX_PENDING_COMMANDS = 200`, `MAX_PENDING_BYTES = 5 * 1024 * 1024` (5 MiB), enforced in `canAddCommand`.
- `QueueFullError extends QueueMetrics { attemptedBytes; isVolatile; kind: 'queue-full' }` — returned (not thrown) when either cap would be exceeded.
- `QueueStorageError { isVolatile; kind: 'queue-storage'; message; raw? }` — IndexedDB transaction/open failures.
- `Result<T, E>` here is the same `src/lib/http/types.ts` shape: `{ data, ok: true } | { error, ok: false }`.

### `networkMonitor.ts`

```ts
export interface NetworkMonitorStatus { browserOnline: boolean; checkedAt: number; online: boolean; pingOnline: boolean }
export type NetworkStatusListener = (status: NetworkMonitorStatus) => void;
export interface NetworkMonitor {
  checkNow(): Promise<NetworkMonitorStatus>;
  getStatus(): NetworkMonitorStatus;
  start(): void;
  stop(): void;
  subscribe(listener: NetworkStatusListener): () => void;
}
export const createNetworkMonitor = (options: CreateNetworkMonitorOptions = {}): NetworkMonitor
```
`online = browserOnline && pingOnline` — both the browser's own `navigator.onLine` **and** a real HEAD ping to `options.pingUrl` (default `'/'`) must agree; `navigator.onLine` alone is known-unreliable (false positive on captive portals), hence the ping. Ping deliberately bypasses `src/lib/http`'s client (no retries — a retry would misreport true connectivity), polls every `intervalMs` (default 20_000 ms) once `start()` is called, and also listens for the browser's native `online`/`offline` events for the `browserOnline` half. `options.ping: (signal: AbortSignal) => Promise<boolean>` is fully swappable for tests.

### `db.ts`

`OFFLINE_DB_NAME = 'digitwin-offline'`, `OFFLINE_DB_VERSION = 1`, `PENDING_COMMANDS_STORE = 'pendingCommands'`, `DEAD_LETTER_STORE = 'deadLetter'`. `migrate(db, oldVersion)` — creates both object stores + a `projectId` and `createdAt` index on `pendingCommands`, on the `onupgradeneeded` handler. `openOfflineDb(options?): Promise<Result<IDBDatabase, OfflineDbError>>` — the low-level IndexedDB open wrapped in the same `Result` shape.

### `replayer.ts`

```ts
export const createReplayer = (options: CreateReplayerOptions): Replayer
export interface Replayer { getStatus(): SyncStatus; replayNow(): Promise<SyncStatus>; start(): void; stop(): void; subscribe(listener): () => void }
export interface SyncStatus { deadLetterCommands; failedCommands; isOnline; isReplaying; lastSuccessfulSyncAt; pendingCommands }
```
`CreateReplayerOptions` requires `projectId` and `sendCommand: (command, { idempotencyKey, pendingCommand, signal? }) => Promise<Result<unknown, HttpError>>`; optionally takes a `networkMonitor: Pick<NetworkMonitor, 'getStatus'|'subscribe'>` — when supplied, `start()` subscribes to it and calls `replayNow()` automatically whenever `status.online` flips true. Replays are cross-tab-coordinated via `BroadcastChannel` (election so only one open tab actually replays); a command whose failure has a definitive 4xx status (except 408/429) is moved to the dead-letter store rather than retried forever; anything else halts the replay loop for that pass and leaves the rest pending.

### The concrete question: how does a screen learn it is offline?

**There is no ready-made hook or store slice for this. `SyncStatus.isOnline`/`NetworkMonitorStatus.online` is a subscription on a plain object returned by `createNetworkMonitor()`/`createReplayer()` — a screen (or its hook) must construct one of these itself and wire `.subscribe(listener)` into local state (e.g. `useState` + `useEffect`) by hand.** Evidence:
- `grep -r "createNetworkMonitor|NetworkMonitor|createReplayer" src` returns only `networkMonitor.ts`, `replayer.ts`, and `replayer.test.ts` — no hook, no store slice, no screen or component references either symbol.
- `src/hooks/*.ts` has no `useNetworkStatus`, `useOfflineStatus`, `useOnline`, or similar — confirmed by listing every file in `src/hooks/`.
- `src/lib/offline/__tests__/replayer.test.ts` and `queueStore.test.ts` both construct `createQueueStore`/`createReplayer` directly with injected fakes (`vi.stubGlobal('indexedDB', undefined)`, a `MockBroadcastChannel`); neither test exercises any React-facing wrapper, because none exists.

**Consequence for the "Đang làm việc ngoại tuyến" banner:** the hook author must instantiate `createNetworkMonitor()` (or read `.isOnline` off a `Replayer` built for this screen's `projectId`) inside the screen's own hook, `.start()` it on mount, `.subscribe()` into a piece of local state, and `.stop()`/unsubscribe on cleanup — same shape as `useShareLinks.ts`'s already-flagged hand-rolled pattern, except here it's hand-rolling is unavoidable because the underlying primitive genuinely has no React wrapper yet, not a mistake to imitate.

---

## (f) Store and permissions

### Do floors live in the store?

**Not the `Floor` type this screen needs.** `src/store/projectSlice.ts:16` declares:
```ts
export interface ProjectSlice {
  project: Project | null;         // src/types/project.ts — a different, UI-facing Project type
  floors: readonly Level[];        // domain/spatial/types Level — NOT src/api's Floor
  activeFloorId: LevelId | null;
  userRoles: readonly ProjectRole[];
  setProject, setFloors, setActiveFloor, setUserRoles
}
```
`Level`/`LevelId` come from `src/domain/spatial/types` — this is the spatial/canvas editor's per-floor structural state (walls, rooms, elevation for 3D), populated once a floor's spatial data is loaded for wall/room editing. It is **not** the API's `Floor` (with `drawings[]`, `areaM2`, etc.) from (b), and it is not where "the floors of one project" for an upload screen should come from. **This screen's floor list belongs in react-query (`queryKeys.floor.list(projectId)`), not in `projectSlice.floors`.** `src/store/selectors.ts` has no floor-list selector either (only room/violation/selection selectors over `spatial`).

`src/store/spatialSlice.ts` holds `spatial: NormalizedSpatial | null` (the loaded floor's wall/room graph for the canvas) plus `_applyPatches` — irrelevant to a file-upload screen.

### `commit(patch, label)` — A10

`src/store/commit.ts`:
```ts
export function commit(patch: SpatialPatch | readonly SpatialPatch[], label: string): CommitResult
// CommitResult = { undo: () => void; label: string; timestamp: number }
```
This is the **sole** gateway for `SpatialSlice._applyPatches` — it applies the patch(es), stamps `historySlice.setLastCommit(label, timestamp)`, and returns an `undo()` that calls zundo's `useStore.temporal.getState().undo()`. **This is specific to spatial/canvas edits (walls, rooms, dimensions) — it has nothing to do with floor/drawing CRUD.** For this screen, the relevant "never call `set()` directly" boundary is narrower: `projectSlice`'s own actions (`setProject`, `setFloors`, `setActiveFloor`, `setUserRoles`) are ordinary zustand actions a component *may* call directly (they wrap `set()` internally, inside the slice definition, which is allowed — `local/no-direct-set` targets a component/hook calling `useStore.setState(...)` or a raw `set(...)` itself, not calling an exposed slice action). Given (above) that floor/drawing state for this screen should live in react-query rather than the store, the practical answer is: **this screen likely does not need to call any store setter at all** except perhaps `setActiveFloor`/`setProject` if it needs to keep the global "which project/floor is open" context in sync for other screens.

### `src/lib/auth/permissions.ts` — `can()` and the role model

```ts
export const AUTH_ROLES = ['admin', 'engineer', 'viewer'] as const;  // ProjectRole
export type PermissionAction = 'create' | 'edit' | 'export' | 'manage' | 'upload';
export type PermissionResource = 'floor' | 'layer' | 'library' | 'model' | 'project' | 'project.settings' | 'share' | 'user';
export const can = (action: PermissionAction, resource: PermissionResource, ctx: PermissionContext = {}): boolean
// PermissionContext = { roles?: readonly ProjectRole[]; [key: string]: unknown }
```
Exactly one relevant capability exists: **`floor.upload`** — `admin: true, engineer: true, viewer: false` (`adminPermissions`/`engineerPermissions`/`viewerPermissions` tables, :45-76). Call as `can('upload', 'floor', { roles })`, same shape `useProjectDashboard.ts:342` already uses (`can('create', 'project', { roles: [role] })`). **A `viewer` role is exactly the "không có quyền" read-only case the screen spec describes — `can('upload', 'floor', { roles })` returning `false` is the flag that should disable drag-and-drop and the upload affordance**, matching A9's "hành động A8 không hoàn tác được thì phải hỏi trước" pairing is not needed here since this is a pure capability gate, not a destructive confirm.

---

## (g) Navigation target — pipeline screen

`src/routes/paths.ts`:
```ts
export const ROUTE_PATTERNS = {
  ...
  projectPipeline: `${PROJECTS_ROOT}/:id/pipeline`,   // :62 — '/projects/:id/pipeline'
  projectUpload: `${PROJECTS_ROOT}/:id/upload`,        // :67 — '/projects/:id/upload' (this screen's own route)
  ...
} as const;

export const ROUTES = {
  ...
  project: {
    pipeline: (projectId: string): string => `${PROJECTS_ROOT}/${projectId}/pipeline`,  // :97
    upload: (projectId: string): string => `${PROJECTS_ROOT}/${projectId}/upload`,       // :102
    ...
  },
} as const;
```
Real call site — `src/screens/dashboard/ProjectDashboard/useProjectDashboard.ts:186-194`:
```ts
function routeForProject(project: DashboardProject, status: TelemetryPipelineStatus): string {
  switch (status) {
    case 'processing':
      return ROUTES.project.pipeline(project.id);
    ...
  }
}
```
then `navigate(path)` via `useNavigate()` from `react-router-dom` (:41, :201, :361). **Import `ROUTES` from `@/routes/paths` (never `@/routes` — that re-export chain would create an import cycle back into the screen, per the file's own header comment) and call `navigate(ROUTES.project.pipeline(projectId))` — never a literal `` `/projects/${projectId}/pipeline` `` string (R-65).** `src/routes.tsx`/`RouterProvider` are not wired yet per CLAUDE.md, but the constant table itself is real and this is the correct symbol to import regardless.

---

## Symbols checked and NOT FOUND / not applicable

- No `useNetworkStatus`/`useOfflineStatus` hook anywhere in `src/hooks/` (see (e)).
- No `uploadDrawing`/`reassignDrawing`/`removeDrawing` entries in `invalidationMap`/`WRITE_OPERATIONS` (see (c)) — will need to be added or bypassed.
- No React context or module-singleton `ApiClient` export (see (a)) — factory only.
- No floor-list selector in `src/store/selectors.ts`.
- The mock API client does not append uploaded drawings into `floors[].drawings` (see (a)) — flagged, not fixed (read-only survey).
