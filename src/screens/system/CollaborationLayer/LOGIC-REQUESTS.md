# Lớp phủ cộng tác — bản kê logic còn thiếu (R-69)

Bản kê này liệt kê **đúng** những module phải có trước khi bật một cờ trong
`COLLABORATION_CAPABILITIES` (`collaborationGateway.ts`). Mỗi mục ghi tên file,
tên hàm, hình dạng dữ liệu và nhóm endpoint cần thêm.

Đặc tả gốc xếp S-11 (`src/store/syncChannel.ts`) và D-01/D-04 (bình luận) vào mục
"logic đã có — chỉ gọi lại". Khảo sát bốn worker lớp một xác nhận **cả hai đều
không tồn tại**: không state, không endpoint, không schema, không query, không
mutation. Đây là lý do lớp phủ dựng bốn cờ năng lực thay vì stub — R-69 cấm stub,
và R-65 cấm viết thẳng một chuỗi đường dẫn trong `src/screens/**`, nên hôm nay
không có đường hợp pháp nào để lớp này lấy dữ liệu thời gian thực.

Cái **đã có và đang được gọi thật**: `src/lib/versioning/conflict.ts` và
`mergeStrategies.ts`. Panel xung đột chạy được ngay hôm nay.

---

## 1. S-11 — hiện diện và khoá (`presence`, `locks`, `requestAccess`)

### 1.1 Nhóm endpoint — `src/api/endpoints.ts`

Thêm một nhóm `presence`, phạm vi theo tầng vì hiện diện là "ai đang xem tầng
này", không phải "ai đang mở dự án này":

| Khoá | Đường dẫn | Việc |
|---|---|---|
| `stream(projectId, floorId)` | `…/floors/{floorId}/presence/stream` | SSE: người vào, người ra, con trỏ di chuyển, khoá đổi chủ |
| `list(projectId, floorId)` | `…/floors/{floorId}/presence` | Ảnh chụp lúc mới vào, để không phải chờ sự kiện đầu tiên |
| `heartbeat(projectId, floorId)` | `…/floors/{floorId}/presence/heartbeat` | Báo còn sống kèm tầng và lựa chọn hiện tại |

Và một nhóm `locks` đi cùng:

| Khoá | Đường dẫn | Việc |
|---|---|---|
| `list(projectId, floorId)` | `…/floors/{floorId}/locks` | Ai đang giữ đối tượng nào |
| `requestAccess(projectId, floorId)` | `…/floors/{floorId}/locks/request` | Xin chủ khoá nhường quyền sửa |

`stream` phải nằm cùng khuôn `ENDPOINTS.notifications.stream` — tức đi thẳng qua
`createEventChannel`, không qua `HttpClient`.

### 1.2 Schema — `src/api/schemas/presence.ts` (file mới)

```ts
export const PresenceSchema: z.ZodType<PresenceWire>;
export interface PresenceWire {
  userId: string;
  name: string;
  avatarUrl?: string;
  floorId: string;
  selectedIds: string[];
  cursor: { x: number; y: number } | null;
  seenAt: string; // ISO 8601
}

export const LockSchema: z.ZodType<LockWire>;
export interface LockWire {
  objectId: string;
  holderId: string;
  heldSince: string; // ISO 8601
}
```

Thiếu `PresenceSchema` thì `createEventChannel` rơi về `ProgressSchema` mặc định
và **loại sạch** mọi gói tin hiện diện — im lặng, không lỗi. Đây là cái bẫy mà
`notificationCenterGateway.ts` đã ghi lại một lần rồi.

### 1.3 Khoá bộ nhớ đệm — `src/lib/query/queryKeys.ts`

```ts
presence: {
  byFloor: (floorId: string) => ['presence', 'byFloor', floorId] as const,
},
lock: {
  byFloor: (floorId: string) => ['lock', 'byFloor', floorId] as const,
},
```

Cộng một mục trong `TIER_BY_DOMAIN` của `cachePolicy.ts`: cả hai thuộc tầng
`spatialDraft` — chúng đổi với đúng nhịp mà dữ liệu không gian đang sửa đổi.

### 1.4 Phép ghi — `src/lib/query/invalidation.ts`

Thêm `'requestEditAccess'` vào `WRITE_OPERATIONS`, với `FloorScopedParams`, làm
mới `lock.byFloor(floorId)`. Không có mục này thì lượt xin quyền thành công
nhưng danh sách khoá trên màn vẫn cũ, và người dùng bấm lại lần hai.

### 1.5 Cổng cần thêm gì — `collaborationGateway.ts`

Hợp đồng `CollaborationGateway` (`types.ts`) hiện có đúng hai thành viên. Khi
1.1–1.4 xong, hợp đồng cần thêm ba phép, và đây là **thay đổi hợp đồng** nên nó
đi qua cổng duyệt chứ không sửa tại chỗ:

```ts
listPresence(floorId: string): Promise<readonly CollaboratorVm[]>;
subscribePresence(floorId: string, listener: (people: readonly CollaboratorVm[]) => void): () => void;
listLocks(floorId: string): Promise<readonly LockVm[]>;
requestEditAccess(floorId: string, objectId: string): Promise<void>;
```

`CollaboratorVm.initials` và `LockVm.heldSinceLabel` dựng ở cổng, không ở view
(A15) — `initialsOf` và `formatTimestamp` đã sẵn trong `collaborationGateway.ts`.

### 1.6 Hook cần đổi gì — `useCollaborationLayer.ts`

- `collaborators` và `locks` chuyển từ hằng rỗng sang `useQuery` với khoá ở 1.3.
  **Không** `useState` cho `isLoading`/`error` (R-64).
- `syncState`: khi `presence` bật, `hasLiveWire` thành `true` và `lastSyncedAtMs`
  do `subscribePresence` cập nhật. Bốn nhánh còn lại của `deriveSyncState` đã
  viết sẵn cho đúng ngày đó và không phải sửa.
- `onRequestEditAccess` chuyển từ hàm rỗng của container sang một `useMutation`
  gọi `applyInvalidation(queryClient, 'requestEditAccess', { projectId, floorId })`.

---

## 2. D-01/D-04 — bình luận (`comments`)

### 2.1 Nhóm endpoint — `src/api/endpoints.ts`

| Khoá | Đường dẫn | Việc |
|---|---|---|
| `list(projectId, floorId)` | `…/floors/{floorId}/comments` | Mọi ghim của tầng |
| `create(projectId, floorId)` | `…/floors/{floorId}/comments` | Đặt một ghim mới |
| `reply(projectId, commentId)` | `…/comments/{commentId}/replies` | Trả lời trong chuỗi |
| `resolve(projectId, commentId)` | `…/comments/{commentId}/resolve` | Đánh dấu đã giải quyết |

### 2.2 Schema — `src/api/schemas/comments.ts` (file mới)

```ts
export interface CommentWire {
  id: string;
  objectId: string;
  at: { x: number; y: number };
  authorId: string;
  body: string;
  createdAt: string; // ISO 8601
  isResolved: boolean;
  replies: CommentReplyWire[];
  mentions: string[]; // userId được nhắc tên
}

export interface CommentReplyWire {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
}
```

`mentions` là mảng `userId`, **không** phải chuỗi đã ghép: nhắc tên cần tra sang
tên hiển thị bằng cùng danh sách thành viên mà `readActorName` đang dùng, và một
chuỗi đã ghép sẵn ở máy chủ sẽ khoá luôn cách hiển thị.

### 2.3 Khoá bộ nhớ đệm và phép ghi

```ts
comment: {
  byFloor: (floorId: string) => ['comment', 'byFloor', floorId] as const,
},
```

Cộng ba mục `WRITE_OPERATIONS`: `'createComment'`, `'replyComment'`,
`'resolveComment'`, cả ba làm mới `comment.byFloor(floorId)`.

### 2.4 Loại thông báo đã có sẵn — đừng dựng lại

`NOTIFICATION_KINDS` của T-09 đã có `'commentMention'`, và
`resolveNotificationTo` đã có đích cho nó. Đó là một thông báo **về** bình luận;
nó không phải bình luận, và nó không cấp được nội dung ghim nào. Khi 2.1–2.3
xong, hai thứ nối vào nhau ở chỗ `target.to` của thông báo dẫn tới đúng ghim —
không phải ở chỗ lớp phủ đọc danh sách thông báo để dựng ghim.

### 2.5 Hook cần đổi gì

- `comments` chuyển từ hằng rỗng sang `useQuery`.
- `onFrameComment` **không phải sửa một dòng nào**: nó đã tra ghim theo `id`,
  gọi `frameObjects` (R-07) và bỏ qua khi không vật nào mang mã ấy.

### 2.6 Bốn thứ ở tầng giao diện đã bị gỡ, và cần gì để bật lại

> Nguồn: báo cáo `worker_done` của L2-C, chuyển qua điều phối viên và chép
> nguyên văn vào đây ở lớp gộp (mục 8 của đặc tả lớp gộp). Không phải văn bản
> do lớp gộp tự viết.

Bốn thứ dưới đây từng nằm trong đặc tả của `CommentThread.tsx` nhưng đã được gỡ
khỏi DOM vì không có tầng logic nào đỡ phía sau — không phải vì chúng không cần.
Khi 2.1–2.5 xong, bật lại bằng cách bổ sung vào `CollaborationLayerProps`:

| Đã gỡ | Cần thêm vào hợp đồng |
|---|---|
| Chuỗi trả lời có nội dung | `CommentThreadVm` — nội dung, tác giả, thời điểm, mảng trả lời |
| Ô nhập + nút gửi | `onSubmitComment(commentId: string, body: string): void` |
| Nút đánh dấu đã xử lý | `onResolveComment(commentId: string): void` |
| Nhắc tên bằng `@` | `mentionCandidates: readonly { id: string; name: string }[]` |

Cho tới lúc đó, `CommentThread` chỉ dựng ghim, trạng thái đã xử lý, số trả lời,
và bấm ghim để khuôn camera — đúng những gì `CommentPinVm` đỡ được.

---

## 3. Ba thứ KHÔNG cần thêm

Ghi ra để lượt sau không dựng lại lần nữa.

1. **Kênh thời gian thực.** `src/lib/realtime/eventChannel.ts` có thật, có thử
   lại lùi theo cấp số nhân, có nối lại, và `notificationCenterGateway.ts` đang
   dùng nó thật. Cái thiếu là một **URL** và một **schema**, không phải một kênh.
2. **Phân loại xung đột.** `resolveConflict` và `mergeStrategies` có đủ ba mức
   (`autoMerged`, `fieldMerged`, `requiresUserChoice`) và có test. Lớp phủ gọi,
   không tự xử.
3. **Giám sát mạng.** `createNetworkMonitor` (`@/lib/offline/networkMonitor`) là
   nguồn sự thật của trạng thái 4 và đã được nối trong `useCollaborationLayer`.

---

## 4. Một thứ nữa mà nơi ráp phải cấp

`CollaborationSceneTarget` (`useCollaborationLayer.ts`) cần ba thứ từ cảnh 3D
đang chạy: gốc cây lưới, `FrameOptions` của camera hiện tại, và một `goTo`.
`screens/viewer/Viewer3D` đã có `CameraDirector` và cây lưới, nhưng
`ViewerSceneHandle` hiện **không xuất gốc cây ra ngoài** — nó chỉ có
`frameEntities`. Nơi ráp lớp phủ vào `Viewer3D` sẽ phải chọn một trong hai: xuất
thêm gốc cây, hoặc đổi `CollaborationSceneTarget` thành một lời gọi
`frameEntities` duy nhất. Cả hai đều là thay đổi ngoài phạm vi bốn file của lớp
logic này, nên nó nằm ở đây chứ không nằm trong một `TODO`.
