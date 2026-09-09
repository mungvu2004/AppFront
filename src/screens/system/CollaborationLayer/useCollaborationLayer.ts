/**
 * Tầng logic của lớp phủ cộng tác.
 *
 * | Việc | Đi qua |
 * |---|---|
 * | Bốn cờ năng lực | {@link createCollaborationGateway} — không suy ngược, không đoán |
 * | Trạng thái 4 (mất kết nối) | `createNetworkMonitor` (`@/lib/offline/networkMonitor`) |
 * | Phân loại xung đột | `resolveConflict` (`@/lib/versioning/conflict`) |
 * | Câu cho hai phía xung đột | `CollaborationGateway.toConflictVm` |
 * | Ngưỡng "đồng bộ chậm" | `CACHE_POLICY.branches.spatialDraft` (`@/lib/query/cachePolicy`) |
 * | Khuôn camera vào một ghim | `frameObjects` (`@/lib/three/camera/frameObjects`, R-07) |
 * | Bạn là ai | `getSession` / `subscribeToSession` (`@/lib/auth`) |
 * | Tầng đang xem, đang chọn gì | `useStore` |
 *
 * ## Màn KHÔNG tự đồng bộ và KHÔNG tự giải quyết xung đột
 *
 * Hai lệnh cấm tuyệt đối của đặc tả, và cả hai đóng bằng cấu trúc chứ không
 * bằng lời hứa:
 *
 * - Không có `new EventSource`, không có `fetch`, không có chuỗi đường dẫn ở
 *   đây hay ở cổng. Dữ liệu từ xa **đi vào bằng tham số**
 *   ({@link UseCollaborationLayerOptions.pendingSync}) từ tầng đã có sẵn đường
 *   dây, và hook chỉ phân loại rồi trình bày.
 * - `resolveConflict` là bên phân loại; hook không tự chọn bên nào thắng.
 *   `onResolveConflict` chỉ **chuyển lựa chọn của con người ra ngoài** rồi đóng
 *   panel. Không có giá trị mặc định, không có hẹn giờ tự chọn.
 *
 * ## KHÔNG GHI ĐÈ IM LẶNG — cơ chế, không phải lời hứa
 *
 * Đây là bất biến khó nhất của lớp này: **phần người dùng đang sửa không bao
 * giờ bị dữ liệu về ghi đè**. Cách nó được ép:
 *
 * 1. Mọi thay đổi cục bộ đang chờ sinh ra một khoá `thực thể + thuộc tính`
 *    ({@link editingFieldKeyOf}). Tập khoá ấy là định nghĩa của "đang sửa".
 * 2. Thay đổi từ xa bị **chia đôi** theo tập ấy. Nhánh không đụng tới ô nào
 *    đang sửa đi ra ngoài qua
 *    {@link UseCollaborationLayerOptions.onApplyRemoteChanges}. Nhánh còn lại
 *    KHÔNG có đường nào tới lời gọi đó — nó chỉ tới được panel xung đột.
 * 3. Nên một giá trị từ xa muốn thắng một ô đang sửa thì phải đi qua đúng một
 *    cửa: con người bấm chọn trên panel. Không có nhánh thứ hai, và điều đó đọc
 *    được từ chính mã: `onApplyRemoteChanges` chỉ bao giờ nhận
 *    `safeRemoteChanges`, thứ được lọc bằng phép loại trừ chứ không bằng một
 *    lượt kiểm có thể quên.
 *
 * ## R-64: không `useState` cho trạng thái máy chủ
 *
 * Hook này KHÔNG gọi `useQuery`, và đó là câu trả lời trung thực chứ không phải
 * một lỗ hổng: bốn năng lực đều tắt, nên không có lượt đọc máy chủ nào để dựng
 * bộ nhớ đệm cho. Cái R-64 cấm — nuôi `isLoading`/`error` bằng tay như
 * `hooks/useShareLinks.ts` — cũng không có ở đây: không state nào tên như vậy
 * tồn tại. Ngày nhóm endpoint hiện diện ra đời, lượt đọc ấy vào bằng `useQuery`
 * cộng một nhánh của `queryKeys`, không bằng một `useState` mới.
 */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { Object3D } from 'three';

import { getSession, subscribeToSession } from '@/lib/auth';
import type { SessionSnapshot } from '@/lib/auth';
import { formatNumber } from '@/lib/format/number';
import type { NetworkMonitor, NetworkMonitorStatus } from '@/lib/offline/networkMonitor';
import { createNetworkMonitor } from '@/lib/offline/networkMonitor';
import { CACHE_POLICY } from '@/lib/query/cachePolicy';
import type { FrameOptions } from '@/lib/three/camera/frameObjects';
import { frameObjects } from '@/lib/three/camera/frameObjects';
import type { Viewpoint } from '@/lib/three/camera/modes';
import { resolveConflict } from '@/lib/versioning/conflict';
import type { ResolveConflictInput } from '@/lib/versioning/conflict';
import type {
  FieldChange,
  FieldConflict,
  RemoteFieldChange,
} from '@/lib/versioning/mergeStrategies';
import { useStore } from '@/store';

import { createCollaborationGateway, initialsOf, readSelfName } from './collaborationGateway';
import type {
  CollaborationGateway,
  CollaborationLayerProps,
  CollaborationSyncState,
  CollaboratorVm,
  CommentPinVm,
  ConflictChoice,
  ConflictVm,
  LockVm,
} from './types';

/* -------------------------------------------------------------------------- */
/* 1 — Chữ dùng chung                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Mọi chuỗi người đọc mà tầng logic dựng ra — một chỗ, để bộ kiểm soát được và
 * để chúng không nằm rải trong thân hàm.
 *
 * Tất cả viết thường, kiểu câu (A6). Ngoại lệ chữ hoa duy nhất là mã đối tượng
 * do dữ liệu mang tới (`W-014`), và mã ấy đi thẳng chứ không qua bảng này.
 */
export const COLLABORATION_TEXT = Object.freeze({
  /** Nhãn tầng khi chưa có tầng nào được mở. */
  noFloor: 'chưa chọn tầng',
  /** Đứng trước tên tầng của dữ liệu. */
  floorPrefix: 'tầng',
  /** Đứng trước mã đối tượng, hoặc trước con số đã định dạng. */
  selectionPrefix: 'đang chọn',
  /** Đứng sau con số khi đang chọn nhiều hơn một. */
  selectionSuffix: 'đối tượng',
});

/* -------------------------------------------------------------------------- */
/* 2 — Hằng và mảng rỗng dùng chung                                            */
/* -------------------------------------------------------------------------- */

/**
 * Ngưỡng để một lượt đồng bộ bị coi là chậm (trạng thái 3).
 *
 * Không phải một con số gõ tay (R-71): `CACHE_POLICY.branches.spatialDraft` là
 * chính con số mà `src/lib/query` đã chọn cho dữ liệu không gian đang sửa, với
 * lý do ghi ngay tại đó — người dùng sửa thẳng trên canvas và cần thay đổi của
 * đồng đội gần như ngay lập tức. Ngưỡng "đồng bộ chậm" hỏi đúng câu hỏi ấy, nên
 * nó phải đọc cùng một con số chứ không nuôi một con số thứ hai lệch dần.
 */
const STALE_SYNC_THRESHOLD_MS = CACHE_POLICY.branches.spatialDraft;

/** Ba danh sách rỗng, đóng băng và dùng lại, để danh tính tham chiếu ổn định qua các lượt render. */
const NO_COLLABORATORS: readonly CollaboratorVm[] = Object.freeze([]);
const NO_LOCKS: readonly LockVm[] = Object.freeze([]);
const NO_COMMENTS: readonly CommentPinVm[] = Object.freeze([]);
const NO_REMOTE_CHANGES: readonly RemoteFieldChange[] = Object.freeze([]);

/* -------------------------------------------------------------------------- */
/* 3 — Khoá "đang sửa"                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Khoá nhận dạng đúng một ô đang sửa: một thực thể cộng một thuộc tính.
 *
 * Ngăn cách bằng một khoảng trắng thì `#W-1` + `4_mm` và `#W-14` + `_mm` vẫn ra
 * hai khoá khác nhau, vì mã thực thể không chứa khoảng trắng. Một dấu gạch nối
 * ở đây sẽ là lỗi trùng khoá im lặng, và im lặng đúng ở chỗ nguy hiểm nhất: nó
 * khiến một ô đang sửa bị xem là không ai đụng tới.
 */
export function editingFieldKeyOf(change: Pick<FieldChange, 'entityId' | 'field'>): string {
  return `${change.entityId} ${change.field}`;
}

/* -------------------------------------------------------------------------- */
/* 4 — Trạng thái đồng bộ                                                      */
/* -------------------------------------------------------------------------- */

/** Thứ {@link deriveSyncState} cần biết để chọn một trong năm giá trị. */
export interface SyncStateInput {
  /** Kết quả kiểm mạng gần nhất; `null` khi chưa lượt kiểm nào xong. */
  readonly network: NetworkMonitorStatus | null;
  /** Có năng lực nào cần một đường dây sống hay không. */
  readonly hasLiveWire: boolean;
  /** Lượt đồng bộ gần nhất, epoch ms; `null` khi chưa có lượt nào. */
  readonly lastSyncedAtMs: number | null;
  /** Bây giờ, epoch ms. */
  readonly nowMs: number;
}

/**
 * Năm giá trị của `CollaborationSyncState`, theo đúng thứ tự ưu tiên.
 *
 * 1. **Mất kết nối thắng tất cả.** Đây là trạng thái 4 và nguồn sự thật của nó
 *    là `createNetworkMonitor`, không phải một suy đoán từ năng lực. Mất mạng
 *    thì việc có đường dây cộng tác hay không cũng không đổi được sự thật ấy —
 *    và đúng như A11 nói, người dùng **vẫn sửa tiếp tại chỗ**.
 * 2. **Không có đường dây sống ⇒ `lam-viec-rieng`.** Với bốn cờ năng lực đang
 *    tắt, đây là giá trị nghỉ của lớp này. KHÔNG phải lỗi: bạn đang sửa một
 *    mình, mọi thao tác vẫn ghi được, và caption thường trực nói ra đúng chừng
 *    ấy thay vì vẽ một vòng xoay chờ một thứ sẽ không bao giờ tới.
 * 3. Có dây nhưng chưa lượt đồng bộ nào xong ⇒ `dang-noi` (trạng thái 2,
 *    caption nhẹ, **không vòng xoay**).
 * 4. Lượt gần nhất đã cũ hơn {@link STALE_SYNC_THRESHOLD_MS} ⇒ `dong-bo-cham`.
 * 5. Còn lại ⇒ `da-noi`.
 */
export function deriveSyncState(input: SyncStateInput): CollaborationSyncState {
  if (input.network !== null && !input.network.online) {
    return 'mat-ket-noi';
  }

  if (!input.hasLiveWire) {
    return 'lam-viec-rieng';
  }

  if (input.lastSyncedAtMs === null) {
    return 'dang-noi';
  }

  return input.nowMs - input.lastSyncedAtMs > STALE_SYNC_THRESHOLD_MS ? 'dong-bo-cham' : 'da-noi';
}

/* -------------------------------------------------------------------------- */
/* 5 — Cảnh 3D                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Thứ hook cần để khuôn camera vào một ghim bình luận (R-07).
 *
 * Ba trường, không hơn, và không trường nào là camera của riêng lớp phủ:
 * `frameObjects` đọc hộp bao của **lưới đã dựng** (`boundsOfIds` là hàm duy
 * nhất đi bộ trên một `Object3D`), còn góc nhìn và tỷ lệ khung hình thì thuộc
 * về camera đang chạy của nơi ráp. Lớp phủ tự bịa một góc nhìn sẽ giật camera
 * của người dùng sang một hướng họ không chọn.
 */
export interface CollaborationSceneTarget {
  /** Gốc cây lưới đã dựng. */
  readonly root: Object3D;
  /** Góc nhìn, tỷ lệ khung hình và lề của camera ĐANG chạy. */
  readonly frameOptions: FrameOptions;
  /** Đưa camera tới điểm nhìn đã tính. */
  readonly goTo: (viewpoint: Viewpoint) => void;
}

/* -------------------------------------------------------------------------- */
/* 6 — Tham số của hook                                                        */
/* -------------------------------------------------------------------------- */

export interface UseCollaborationLayerOptions {
  /** Cổng. Bỏ trống ⇒ cổng thật của ứng dụng. */
  readonly gateway?: CollaborationGateway;
  /** Đồng hồ. Tiêm được để bộ kiểm không phụ thuộc giờ máy. */
  readonly now?: () => number;
  /**
   * Bộ giám sát mạng. Bỏ trống ⇒ hook tự dựng một cái và tự dọn lúc rời màn.
   *
   * Tiêm được vì bản mặc định gọi mạng thật theo chu kỳ: một bài kiểm muốn dựng
   * trạng thái 4 phải nói được "lúc này coi như mất mạng" mà không phải rút dây.
   */
  readonly networkMonitor?: NetworkMonitor;
  /** Ảnh chụp phiên đăng nhập. Tiêm được để bộ kiểm dựng nhóm ảnh mà không đăng nhập thật. */
  readonly readSession?: () => SessionSnapshot;
  /** Đăng ký nghe phiên đăng nhập đổi. Đi cùng {@link readSession}. */
  readonly subscribeSession?: (listener: () => void) => () => void;
  /**
   * Lượt ghi đang chờ máy chủ nhận — nguồn DUY NHẤT của xung đột.
   *
   * Chính là `ResolveConflictInput` của `@/lib/versioning/conflict`, không phải
   * một hình dạng thứ hai gõ lại: nơi đã cầm phiên bản gốc, phiên bản máy chủ
   * và hai danh sách thay đổi thì truyền thẳng cái nó có. `null` ⇒ không có
   * lượt ghi nào đang chờ, nên không có xung đột và panel không dựng.
   */
  readonly pendingSync?: ResolveConflictInput | null;
  /**
   * Lúc người dùng sửa ô đang tranh chấp, dạng ISO 8601.
   *
   * `FieldConflict` không mang mốc này cho phía mình (xem `types.ts`), nên nó
   * phải vào từ đây. Bỏ trống ⇒ lấy đồng hồ của hook lúc dựng panel: một mốc
   * xấp xỉ vẫn thật hơn một ô trống, và hợp đồng cấm để trống.
   */
  readonly localChangedAtIso?: string;
  /** Lượt đồng bộ gần nhất, epoch ms. `null` hoặc bỏ trống ⇒ chưa có lượt nào. */
  readonly lastSyncedAtMs?: number | null;
  /** Cảnh 3D để khuôn camera vào một ghim. Bỏ trống ⇒ `onFrameComment` không động vào camera. */
  readonly scene?: CollaborationSceneTarget | null;
  /** Trạng thái 6: xem bình luận, không viết. Mặc định `true`. */
  readonly canWrite?: boolean;
  /** Trạng thái 7: ẩn con trỏ người khác, giữ ghim bình luận. Mặc định `false`. */
  readonly isCollapsed?: boolean;
  /**
   * Nhận những thay đổi từ xa **an toàn để ghi đè**.
   *
   * Đọc kỹ chữ "an toàn": hàm này chỉ bao giờ nhận những ô mà người dùng KHÔNG
   * đang sửa. Nhánh còn lại không có đường nào tới đây — xem mục "KHÔNG GHI ĐÈ
   * IM LẶNG" ở đầu file.
   */
  readonly onApplyRemoteChanges?: (changes: readonly RemoteFieldChange[]) => void;
  /**
   * Lựa chọn của con người trên panel xung đột, chuyển ra ngoài.
   *
   * Hook không tự áp dụng lựa chọn: áp dụng nghĩa là ghi vào dữ liệu không
   * gian, và A10 nói lượt ghi ấy đi qua `commit(patch, label)` của tầng lệnh,
   * không qua một lớp phủ.
   */
  readonly onConflictChoice?: (choice: ConflictChoice, conflict: FieldConflict) => void;
}

/**
 * Thứ hook trả về: đúng `CollaborationLayerProps`, trừ hai handler mà container
 * nối.
 *
 * Hai handler ấy nằm ngoài tầm của hook vì cả hai cần thứ hook không có:
 * `onGoToCollaborator` cần đường điều hướng của nơi ráp (và hôm nay danh sách
 * người luôn chỉ có bạn, vì `presence` tắt), còn `onRequestEditAccess` cần một
 * phép ghi chuyển giao khoá mà `requestAccess === false` đang nói là chưa có.
 */
export type UseCollaborationLayerResult = Omit<
  CollaborationLayerProps,
  'onGoToCollaborator' | 'onRequestEditAccess'
>;

/* -------------------------------------------------------------------------- */
/* 7 — Nhãn của chính bạn                                                      */
/* -------------------------------------------------------------------------- */

/** Nhãn "đang ở tầng nào" — đã dựng ở viewmodel, không phải số tầng thô (A15). */
function buildFloorLabel(floorName: string | null): string {
  return floorName === null
    ? COLLABORATION_TEXT.noFloor
    : `${COLLABORATION_TEXT.floorPrefix} ${floorName}`;
}

/**
 * Nhãn "đang chọn gì"; `null` khi không chọn gì.
 *
 * Một đối tượng thì hiện chính mã của nó — "đang chọn W-014" nói nhiều hơn
 * "đang chọn 1 đối tượng". Nhiều đối tượng thì đếm, và con số đi qua
 * `formatNumber` chứ không qua nối chuỗi thô (A15).
 */
function buildSelectionLabel(selectedIds: readonly string[]): string | null {
  const first = selectedIds[0];
  if (first === undefined) {
    return null;
  }

  if (selectedIds.length === 1) {
    return `${COLLABORATION_TEXT.selectionPrefix} ${first}`;
  }

  const count = formatNumber(selectedIds.length, { fractionDigits: 0 });

  return `${COLLABORATION_TEXT.selectionPrefix} ${count} ${COLLABORATION_TEXT.selectionSuffix}`;
}

/* -------------------------------------------------------------------------- */
/* 8 — Giám sát mạng                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Kết quả kiểm mạng gần nhất, hoặc `null` khi chưa lượt nào xong.
 *
 * `null` là một câu trả lời có nghĩa, không phải giá trị khởi tạo cho có:
 * `NetworkMonitorStatus.online` là `browserOnline && pingOnline`, mà
 * `pingOnline` khởi tạo bằng `false`, nên đọc `getStatus()` ngay lúc gắn sẽ báo
 * "mất kết nối" cho một máy đang nối mạng bình thường. Nên hook chỉ tin những
 * trạng thái do `subscribe` đẩy tới — tức những trạng thái đi sau một lượt kiểm
 * thật, hoặc sau một sự kiện `online`/`offline` của trình duyệt.
 */
function useNetworkStatus(injected: NetworkMonitor | undefined): NetworkMonitorStatus | null {
  const [status, setStatus] = useState<NetworkMonitorStatus | null>(null);

  useEffect(() => {
    const owned = injected === undefined;
    const monitor = injected ?? createNetworkMonitor();
    const unsubscribe = monitor.subscribe(setStatus);

    // Bộ giám sát tự dựng thì hook cũng tự bật và tự tắt nó. Bộ giám sát tiêm
    // vào thì KHÔNG: vòng đời của nó thuộc về nơi tiêm, và một lớp phủ dừng bộ
    // giám sát dùng chung của cả ứng dụng lúc nó rời màn là một tác dụng phụ
    // không ai đặt hàng.
    if (owned) {
      monitor.start();
    }

    return () => {
      unsubscribe();
      if (owned) {
        monitor.stop();
      }
    };
  }, [injected]);

  return status;
}

/* -------------------------------------------------------------------------- */
/* 9 — Hook                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Lớp phủ cộng tác — tầng logic.
 *
 * Trả về đúng {@link UseCollaborationLayerResult}; view thuần nhận nó nguyên
 * khối cộng hai handler của container.
 */
export function useCollaborationLayer(
  options: UseCollaborationLayerOptions = {},
): UseCollaborationLayerResult {
  const {
    localChangedAtIso,
    onApplyRemoteChanges,
    onConflictChoice,
    pendingSync = null,
    scene = null,
    canWrite = true,
    isCollapsed = false,
    lastSyncedAtMs = null,
  } = options;

  const now = options.now ?? Date.now;
  const injectedGateway = options.gateway;
  const readSession = options.readSession ?? getSession;
  const subscribeSession = options.subscribeSession ?? subscribeToSession;

  /* ---- Cổng ------------------------------------------------------------- */

  const gateway = useMemo(
    () => injectedGateway ?? createCollaborationGateway({ now }),
    [injectedGateway, now],
  );

  const capabilities = gateway.capabilities;

  /* ---- Trạng thái đồng bộ ------------------------------------------------ */

  const network = useNetworkStatus(options.networkMonitor);

  /*
   * "Có đường dây sống" nghĩa là có ít nhất một năng lực cần một dòng sự kiện
   * chạy liên tục. `comments` KHÔNG tính: ghim bình luận là dữ liệu đọc theo
   * lượt, và một màn có bình luận nhưng không có hiện diện vẫn đang "làm việc
   * riêng" theo đúng nghĩa mà caption trạng thái 3 nói ra.
   */
  const hasLiveWire = capabilities.presence || capabilities.locks;

  const syncState = useMemo(
    () => deriveSyncState({ network, hasLiveWire, lastSyncedAtMs, nowMs: now() }),
    [network, hasLiveWire, lastSyncedAtMs, now],
  );

  /* ---- Chính bạn --------------------------------------------------------- */

  /*
   * Phiên đăng nhập đọc qua `useSyncExternalStore`, không qua `useState` cộng
   * một hiệu ứng: `getSession()` trả về đúng một ảnh chụp đã đóng băng và
   * `subscribeToSession` báo mỗi lần ảnh ấy được thay, nên đây là hình dạng mà
   * React có sẵn API cho. Đăng xuất giữa chừng vì thế làm nhóm ảnh rỗng đi ngay,
   * chứ không để lại tên của người vừa rời máy.
   */
  const session = useSyncExternalStore(subscribeSession, readSession, readSession);

  const floors = useStore((state) => state.floors);
  const activeFloorId = useStore((state) => state.activeFloorId);
  const selectedIds = useStore((state) => state.selectedIds);

  const floorLabel = useMemo(() => {
    const active = floors.find((floor) => floor.id === activeFloorId);

    return buildFloorLabel(active?.name ?? null);
  }, [floors, activeFloorId]);

  const selectionLabel = useMemo(() => buildSelectionLabel(selectedIds), [selectedIds]);

  /*
   * Danh sách người đang xem.
   *
   * `presence === false` ⇒ nhóm ảnh chỉ còn bạn, đúng trạng thái 1 mà hợp đồng
   * đã định nghĩa ("rỗng — chỉ mình đang xem"). Đây không phải lỗi và cũng
   * không phải chỗ để bịa: KHÔNG có nhánh nào dựng một người thứ hai từ dữ liệu
   * rỗng, vì đó chính là thứ cờ năng lực sinh ra để chặn.
   *
   * Chưa đăng nhập thì danh sách rỗng hẳn — dựng một ô đại diện cho một người
   * không có danh tính là vẽ ra một người không tồn tại.
   *
   * `cursor` luôn `null` cho chính bạn: con trỏ của bạn đã nằm trên màn rồi, vẽ
   * lại nó thành một vòng hiện diện thứ hai chỉ làm bạn đuổi theo cái bóng của
   * chính mình.
   */
  const collaborators = useMemo<readonly CollaboratorVm[]>(() => {
    const user = session.user;
    if (user === null) {
      return NO_COLLABORATORS;
    }

    const name = readSelfName(session);

    return Object.freeze([
      {
        id: user.id,
        name,
        initials: initialsOf(name),
        floorLabel,
        selectionLabel,
        cursor: null,
        isSelf: true,
      },
    ]);
  }, [session, floorLabel, selectionLabel]);

  /*
   * Khoá và ghim bình luận.
   *
   * Cả hai đều rỗng, và cả hai rỗng VÌ MỘT LÝ DO GỌI ĐƯỢC TÊN chứ không vì chưa
   * ai điền: `locks === false` và `comments === false` nói rằng không có
   * endpoint, không có schema, không có state nào cấp chúng (xem
   * `COLLABORATION_CAPABILITIES` trong `collaborationGateway.ts`). View đọc cờ
   * và bỏ hẳn nhánh ấy khỏi DOM, nên hai mảng này không bao giờ được dùng để vẽ
   * một danh sách trống giả vờ là "chưa có ai khoá gì".
   */
  const locks = NO_LOCKS;
  const comments = NO_COMMENTS;

  /* ---- Xung đột ---------------------------------------------------------- */

  const resolution = useMemo(
    () => (pendingSync === null ? null : resolveConflict(pendingSync)),
    [pendingSync],
  );

  /*
   * CHỈ `requiresUserChoice` mới dựng panel.
   *
   * `autoMerged` và `fieldMerged` là hai mức mà `resolveConflict` đã kết luận
   * xong: không ô nào tranh chấp, hoặc tranh chấp đã gộp được theo thuộc tính.
   * Hỏi con người ở hai mức ấy là hỏi một câu không có nội dung, và đặc tả cấm
   * đúng chuyện đó — panel tồn tại để NHẬN một lựa chọn, không để thông báo.
   */
  const contestedField: FieldConflict | null = useMemo(() => {
    if (resolution === null || resolution.level !== 'requiresUserChoice') {
      return null;
    }

    return resolution.conflictingFields[0] ?? null;
  }, [resolution]);

  /*
   * Khoá của xung đột đang hiện — để nhớ rằng người dùng đã hoãn hoặc đã quyết
   * xong CHÍNH xung đột này, chứ không phải "đã hoãn mọi xung đột".
   */
  const contestedKey = contestedField === null ? null : editingFieldKeyOf(contestedField);

  const [settledKey, setSettledKey] = useState<string | null>(null);

  const conflict = useMemo<ConflictVm | null>(() => {
    if (contestedField === null || contestedKey === settledKey) {
      return null;
    }

    return gateway.toConflictVm(contestedField, localChangedAtIso ?? new Date(now()).toISOString());
  }, [contestedField, contestedKey, settledKey, gateway, localChangedAtIso, now]);

  /* ---- Không ghi đè im lặng ---------------------------------------------- */

  /** Tập ô người dùng đang sửa — định nghĩa của "đừng đụng vào". */
  const editingFieldKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const change of pendingSync?.localChanges ?? []) {
      keys.add(editingFieldKeyOf(change));
    }

    return keys;
  }, [pendingSync]);

  /*
   * Nhánh AN TOÀN: những ô người dùng không đụng tới.
   *
   * Đây là danh sách DUY NHẤT có đường đi tới `onApplyRemoteChanges`. Nhánh còn
   * lại — những ô vừa đang sửa vừa vừa bị người khác đổi — không xuất hiện ở
   * đây, không xuất hiện trong hiệu ứng bên dưới, và chỉ tới được panel xung
   * đột. Đó là toàn bộ cơ chế "không ghi đè im lặng", viết bằng một phép lọc
   * chứ không bằng một lượt kiểm mà ai đó có thể quên gọi.
   */
  const safeRemoteChanges = useMemo<readonly RemoteFieldChange[]>(() => {
    const incoming = pendingSync?.remoteChanges ?? NO_REMOTE_CHANGES;
    if (incoming.length === 0) {
      return NO_REMOTE_CHANGES;
    }

    return incoming.filter((change) => !editingFieldKeys.has(editingFieldKeyOf(change)));
  }, [pendingSync, editingFieldKeys]);

  useEffect(() => {
    if (safeRemoteChanges.length === 0 || onApplyRemoteChanges === undefined) {
      return;
    }

    onApplyRemoteChanges(safeRemoteChanges);
  }, [safeRemoteChanges, onApplyRemoteChanges]);

  /* ---- Ba hành động ------------------------------------------------------ */

  /*
   * Lựa chọn của con người: chuyển ra ngoài rồi đóng panel.
   *
   * Không nhánh nào ở đây ghi vào dữ liệu — A10 nói lượt ghi đi qua
   * `commit(patch, label)` của tầng lệnh. Và không có giá trị mặc định: hàm chỉ
   * chạy khi có người bấm, nên "không ai bấm" giữ nguyên cả hai giá trị.
   */
  const onResolveConflict = useCallback(
    (choice: ConflictChoice) => {
      if (contestedField === null) {
        return;
      }

      onConflictChoice?.(choice, contestedField);
      setSettledKey(contestedKey);
    },
    [contestedField, contestedKey, onConflictChoice],
  );

  /*
   * Hoãn panel — và hoãn ĐÚNG xung đột này.
   *
   * Khoá đã hoãn được nhớ lại, nên một xung đột KHÁC (ô khác, hoặc cùng ô nhưng
   * ở một lượt ghi mới) vẫn dựng panel lên. Hoãn một lần rồi im lặng mãi mãi là
   * cách chắc chắn nhất để một thay đổi của người khác lặng lẽ biến mất.
   */
  const onDeferConflict = useCallback(() => {
    setSettledKey(contestedKey);
  }, [contestedKey]);

  /*
   * Khuôn camera vào ghim bình luận (R-07).
   *
   * `frameObjects` đọc hộp bao của lưới đã dựng và trả `null` khi không vật nào
   * mang mã ấy — một ghim trỏ vào đối tượng đã bị xoá thì để camera yên còn hơn
   * bay tới một hộp rỗng.
   */
  const onFrameComment = useCallback(
    (commentId: string) => {
      if (scene === null) {
        return;
      }

      const pin = comments.find((comment) => comment.id === commentId);
      if (pin === undefined) {
        return;
      }

      const viewpoint = frameObjects(scene.root, [pin.objectId], scene.frameOptions);
      if (viewpoint === null) {
        return;
      }

      scene.goTo(viewpoint);
    },
    [scene, comments],
  );

  return {
    capabilities,
    syncState,
    collaborators,
    locks,
    conflict,
    comments,
    isCollapsed,
    canWrite,
    onResolveConflict,
    onDeferConflict,
    onFrameComment,
  };
}
