/**
 * Cổng của S-34 `HistoryPanel` — mọi lời gọi ra khỏi panel đi qua đây, đúng
 * khuôn `propertyInspectorGateway.ts` và `axisGridManagerGateway.ts`.
 *
 * Panel lịch sử không đọc mạng và không tự giữ ngăn xếp nào. Nó cần đúng bốn
 * thứ từ bên ngoài, và bốn thứ ấy là bốn nhóm phương thức của
 * {@link HistoryPanelGateway}:
 *
 * 1. **Ngăn xếp lịch sử đang chạy** — một `HistoryStack` của S-06, do nơi ráp
 *    truyền vào. Mặc định `createHistoryStack()`, đúng tiền lệ
 *    `createAxisGridDispatchDeps` (`axisGridManagerGateway.ts:931`):
 *    `options.history ?? createHistoryStack()`.
 * 2. **Quyền** — `can('edit', 'layer', { roles })`. Vai `undefined` là "CHƯA
 *    BIẾT", không phải "biết là không có quyền"; hai thứ ấy A11 phân biệt rõ và
 *    {@link createHistoryPanelGateway} giữ nguyên sự phân biệt bằng cách phơi
 *    `rolesKnown` riêng với `canJump`.
 * 3. **Danh tính người đang dùng** — chỉ CHÍNH người đang đăng nhập. Xem bản kê
 *    nợ dưới đây, mục #2.
 * 4. **Ba lời gọi ra 3D** — bóng ma trạng thái trước (`previewEntity`), khuôn
 *    camera (`frameEntities`, chính là R-07), và chọn đối tượng.
 *
 * ## Đường ghi — `commit` chỉ xuất hiện ở file này (A10)
 *
 * Nhảy về một bước là `history.undo()`/`history.redo()` gọi lặp, và mỗi lượt
 * trả về một `HistoryTransition` mà NGƯỜI GỌI phải áp: `undo()` chỉ dời bản ghi
 * giữa hai ngăn xếp, nó không đụng vào đồ thị. Phép áp ấy là
 * {@link HistoryPanelGateway.applyTransition}, và nó đi qua `commit(patches,
 * label)` — không một dòng nào trong hook hay view gọi `set()` hoặc `commit`.
 *
 * Bóng ma trạng thái trước đi qua `previewEdit` của `src/store/commit.ts` — theo
 * chính docblock của hàm ấy, đó là "đường hợp lệ DUY NHẤT cho tầng màn hình",
 * vì `local/no-draft-write-outside-commands` khoá `stageDraftOperation` ngoài
 * `src/store`. `useViewer3D` đọc bản nháp ấy và đẩy xuống
 * `ViewerSceneHandle.preview`, nên panel không cần (và không được) tự cầm tay
 * cầm cảnh để vẽ bóng ma.
 *
 * ## Bản kê nợ — thứ KHÔNG tìm thấy, và vì sao không bịa
 *
 * 1. **`jumpTo`/`goToStep`/`seek` — NOT FOUND.** `src/lib/commands/history.ts`
 *    có đúng chín phương thức và không phương thức nào nhảy thẳng tới bước N.
 *    Nên {@link HistoryPanelGateway.jumpBy} gọi lặp `undo()`/`redo()`. Đây
 *    KHÔNG phải "tự quản lý ngăn xếp hoàn tác": không một mảng bước nào được
 *    giữ ở đây, panel chỉ bấm nút của ngăn xếp có sẵn nhiều lần.
 * 2. **Tra người dùng khác theo id — NOT FOUND.** `AuthUser` không có
 *    `avatarUrl`, `queryKeys` không có `user.byId`, và `avatarUrl` chỉ tồn tại
 *    trong luồng `AccountSettings` của CHÍNH người đang đăng nhập. Nên
 *    {@link HistoryPanelGateway.currentActorId} phơi đúng một danh tính, và mọi
 *    `actorId` khác nó thành `HISTORY_ANONYMOUS_ACTOR_LABEL` ở tầng model. Một
 *    cái tên bịa ra còn tệ hơn một nhãn thành thật.
 * 3. **Lịch sử đã lưu trữ — NOT FOUND.** `QueryDomain` khai đúng mười hai miền
 *    và không miền nào là `'history'`; `src/store/historySlice.ts` chỉ giữ
 *    commit GẦN NHẤT. Không có kho nào ở phía sau để "Tải thêm" đi tới, nên
 *    `supports.loadArchivedSteps` là `false` và
 *    {@link HistoryPanelGateway.loadArchivedSteps} trả về một LÝ DO chứ không
 *    trả một mảng rỗng giả vờ đã tải xong. Hệ quả ở tầng model: `partialReason`
 *    chỉ bao giờ là `'at-step-limit'`, không bao giờ là `'archived'`.
 * 4. **API "bóng ma" hai lớp trên `ViewerSceneHandle` — NOT FOUND.**
 *    `ViewerScenePreview` mang MỘT trạng thái thay thế mesh thật, không phải hai
 *    lớp chồng nhau. Bóng ma ở đây vì thế là "mesh thật bị thay tạm bằng ảnh
 *    chụp `before`", đúng thứ `previewEdit` làm được, và nó bị dọn ngay khi
 *    chuột rời mục.
 */

import type { EntityId } from '@/domain/spatial/types';
import type { SpatialEntity } from '@/domain/spatial/normalize';
import { can } from '@/lib/auth/permissions';
import type { HistoryStack, HistoryTransition } from '@/lib/commands/history';
import { createHistoryStack } from '@/lib/commands/history';
import { useStore } from '@/store';
import { commit, discardPreview, previewEdit } from '@/store/commit';
import type { ProjectRole } from '@/types/project';

/* -------------------------------------------------------------------------- */
/* Khả năng.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Sáu việc panel cần từ bên ngoài, và không việc nào khác.
 *
 * Mỗi khoá là MỘT việc, trả lời ĐỒNG BỘ qua {@link HistoryPanelGateway.supports}
 * — view phải biết trước lượt vẽ đầu tiên, chứ không phải sau một lượt gọi hỏng.
 */
export type HistoryPanelCapability =
  | 'readHistory'
  | 'jumpToStep'
  | 'previewBeforeState'
  | 'frameEntities'
  | 'selectEntity'
  | 'loadArchivedSteps';

/** Kết quả của một khả năng có thể chưa có đường. */
export type HistoryPanelCapabilityResult<TValue> =
  | { readonly ok: true; readonly data: TValue }
  | { readonly ok: false; readonly reason: string };

/**
 * Câu nói ra khi người dùng bấm "Tải thêm" mà không có kho nào để tải.
 *
 * Nói rõ đây là một khả năng CÒN THIẾU của hệ thống, không phải một lỗi của bản
 * vẽ và cũng không phải một lượt tải hỏng — hai câu chuyện khác nhau, và trộn
 * chúng là cách nhanh nhất để người dùng bấm "Thử lại" mãi mãi.
 */
export const NO_ARCHIVED_HISTORY_REASON =
  'Chưa có kho lịch sử cũ nào để tải thêm. Bản vẽ của bạn không có lỗi nào ở đây.';

/** Câu nói ra khi một lượt nhảy dừng giữa chừng vì ngăn xếp ngắn hơn dự tính. */
export const JUMP_INTERRUPTED_REASON =
  'Không lùi hết được tới bước đã chọn. Lịch sử vừa đổi, mời bạn chọn lại.';

/* -------------------------------------------------------------------------- */
/* Cửa ra 3D.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Ba lời gọi panel gửi sang mô hình 3D.
 *
 * Tách thành một cổng con để bài kiểm cắm được một bản đếm lượt gọi mà không
 * phải dựng cả `ViewerSceneHandle` sáu phương thức, và để nơi ráp thấy rõ panel
 * KHÔNG tự lắp cảnh: nó chỉ dùng ba việc này.
 */
export interface HistoryScenePort {
  /**
   * Vẽ đè ảnh chụp `before` của một đối tượng, làm bóng ma trạng thái trước.
   *
   * Đi qua `previewEdit`, nên nó không vào lịch sử hoàn tác và không tự lưu ra
   * máy chủ — ba lời hứa của một bản nháp, do chính `src/store/commit.ts` giữ.
   */
  readonly previewEntity: (entityId: EntityId, before: SpatialEntity) => void;
  /** Bỏ bóng ma. An toàn gọi khi không có bóng ma nào. */
  readonly discardPreview: () => void;
  /** R-07 — khuôn camera vào những đối tượng mang các mã này. */
  readonly frameEntities: (entityIds: readonly EntityId[]) => boolean;
  /** Chọn thật một đối tượng; cảnh tô sáng nó qua lượt `update` kế tiếp. */
  readonly selectEntity: (entityId: EntityId) => void;
}

/** Tay cầm cảnh nơi ráp truyền xuống. Đúng phần `ViewerSceneHandle` panel dùng. */
export interface HistorySceneHandle {
  readonly frameEntities: (entityIds: readonly string[]) => boolean;
}

/* -------------------------------------------------------------------------- */
/* Cổng.                                                                       */
/* -------------------------------------------------------------------------- */

/** Mỗi phương thức là một việc panel cần từ bên ngoài, và không có việc nào khác. */
export interface HistoryPanelGateway {
  /** Khả năng nào cổng này làm được, trả lời ĐỒNG BỘ. */
  readonly supports: Readonly<Record<HistoryPanelCapability, boolean>>;
  /** Ngăn xếp lịch sử đang chạy của S-06. Panel ĐỌC nó, không thay nó. */
  readonly history: HistoryStack;
  /**
   * Người dùng đã biết vai chưa.
   *
   * `false` nghĩa là phiên đăng nhập còn ở `status === 'unknown'` — panel đang
   * TẢI, không phải đang bị từ chối. Trộn hai thứ này là cách A11 bị phá.
   */
  readonly rolesKnown: boolean;
  /** Vai hiện tại có được nhảy trạng thái không — `can('edit', 'layer', …)`. */
  readonly canJump: boolean;
  /** Ai đang thao tác. Mọi `actorId` khác chuỗi này là "người dùng khác". */
  readonly currentActorId: string;
  /**
   * Lùi hoặc tiến đúng chừng này bước, và ÁP từng bước một.
   *
   * Số dương là tiến (`redo`), số âm là lùi (`undo`). Trả về những lượt chuyển
   * đã áp được, theo thứ tự áp — ngắn hơn `Math.abs(steps)` nghĩa là ngăn xếp
   * hết trước, và {@link JUMP_INTERRUPTED_REASON} là câu nói ra khi đó.
   */
  readonly jumpBy: (steps: number) => readonly HistoryTransition[];
  /** Áp MỘT lượt chuyển: patch vào đồ thị qua `commit`, rồi khôi phục vùng chọn. */
  readonly applyTransition: (transition: HistoryTransition) => void;
  /** Ảnh chụp hiện tại của một đối tượng, để so với ảnh chụp `before` của lệnh. */
  readonly readEntity: (entityId: EntityId) => SpatialEntity | null;
  /** Ba lời gọi ra 3D. */
  readonly scene: HistoryScenePort;
  /** NOT FOUND — không miền `history` nào trong `queryKeys`. Xem bản kê nợ #3. */
  readonly loadArchivedSteps: () => Promise<HistoryPanelCapabilityResult<number>>;
}

/**
 * Ai thao tác khi nơi ráp chưa truyền ai.
 *
 * Một chuỗi ĐẶT TÊN chứ không phải chuỗi rỗng, cùng lý do
 * `ROOM_AREA_DEFAULT_ACTOR_ID` nêu: một mặc định rỗng chỉ dời chỗ hỏng ra xa
 * chỗ người nối dây quên truyền.
 */
export const HISTORY_PANEL_DEFAULT_ACTOR_ID = 'history-panel-reader';

export interface CreateHistoryPanelGatewayOptions {
  /**
   * Ngăn xếp lịch sử của phiên làm việc.
   *
   * Vắng mặt thì cổng dựng một ngăn xếp rỗng của riêng nó — đúng tiền lệ
   * `createAxisGridDispatchDeps`. Một panel cầm ngăn xếp rỗng hiện trạng thái
   * `empty` thành thật, chứ không hiện lịch sử của một màn khác.
   */
  readonly history?: HistoryStack;
  /**
   * Vai của người dùng trên dự án. Vắng mặt là "CHƯA BIẾT vai", không phải
   * "biết là không có quyền".
   */
  readonly roles?: readonly ProjectRole[];
  readonly actorId?: string;
  /** Tay cầm cảnh 3D. Vắng mặt thì camera đứng yên; mọi thứ khác vẫn chạy. */
  readonly scene?: HistorySceneHandle | null;
}

/* -------------------------------------------------------------------------- */
/* Cổng thật.                                                                  */
/* -------------------------------------------------------------------------- */

/** Nhãn của lượt `commit` mà một lượt chuyển sinh ra — câu của chính bước ấy. */
const transitionLabel = (transition: HistoryTransition): string => transition.step.label;

/**
 * Cổng thật — đọc kho, nhảy bằng ngăn xếp S-06, ghi qua `commit`.
 *
 * Không một lượt gọi mạng nào: lịch sử hoàn toàn cục bộ, và bản kê nợ #3 nói rõ
 * vì sao thứ duy nhất còn thiếu (`loadArchivedSteps`) trả về một lý do.
 */
export function createHistoryPanelGateway(
  options: CreateHistoryPanelGatewayOptions = {},
): HistoryPanelGateway {
  const history = options.history ?? createHistoryStack();
  const roles = options.roles;
  const scene = options.scene;

  const applyTransition = (transition: HistoryTransition): void => {
    commit([...transition.patches], transitionLabel(transition));
    useStore.getState().setSelection([...transition.selection.selectedIds]);
  };

  return {
    supports: {
      readHistory: true,
      jumpToStep: true,
      previewBeforeState: true,
      frameEntities: scene !== undefined && scene !== null,
      selectEntity: true,
      /* NOT FOUND — xem bản kê nợ #3 ở đầu file. */
      loadArchivedSteps: false,
    },
    history,
    rolesKnown: roles !== undefined,
    canJump: can('edit', 'layer', roles === undefined ? {} : { roles }),
    currentActorId: options.actorId ?? HISTORY_PANEL_DEFAULT_ACTOR_ID,
    jumpBy: (steps) => {
      const applied: HistoryTransition[] = [];
      const forward = steps > 0;
      const count = Math.abs(Math.trunc(steps));

      for (let taken = 0; taken < count; taken += 1) {
        const transition = forward ? history.redo() : history.undo();

        if (transition === null) {
          break;
        }

        applyTransition(transition);
        applied.push(transition);
      }

      return applied;
    },
    applyTransition,
    readEntity: (entityId) => useStore.getState().spatial?.byId[entityId] ?? null,
    scene: {
      previewEntity: (entityId, before) => {
        previewEdit(entityId, before);
      },
      discardPreview,
      frameEntities: (entityIds) => scene?.frameEntities([...entityIds]) ?? false,
      selectEntity: (entityId) => {
        useStore.getState().select(entityId);
      },
    },
    loadArchivedSteps: () =>
      Promise.resolve({ ok: false, reason: NO_ARCHIVED_HISTORY_REASON }),
  };
}

/* -------------------------------------------------------------------------- */
/* Cổng có dữ liệu — cho bài kiểm và story.                                    */
/* -------------------------------------------------------------------------- */

export interface CreateFakeHistoryPanelGatewayOptions
  extends CreateHistoryPanelGatewayOptions {
  /** Đồ thị cố định `readEntity` đọc, thay cho kho thật. */
  readonly entities?: Readonly<Record<string, SpatialEntity>>;
  /** Ép `canJump` bất kể vai — cho story trạng thái `forbidden`. */
  readonly canJump?: boolean;
  /** Ghi lại mọi lượt gọi ra 3D, theo thứ tự. */
  readonly sceneCalls?: string[];
}

/**
 * Cổng giả — cùng `interface`, không chạm kho và không chạm 3D.
 *
 * Cùng nguyên tắc `createPropertyInspectorGateway` dùng khi bài kiểm cắm một
 * `graph` cố định: một `interface`, hai bản cài đặt, và bài kiểm không bao giờ
 * phải dựng nửa ứng dụng để xem panel vẽ ra gì. Ngăn xếp truyền vào qua
 * `options.history` là ngăn xếp THẬT của S-06 — bài kiểm đẩy vài bước vào nó
 * rồi đọc lại, nên nó kiểm đúng phép nhảy chứ không kiểm một bản nhái.
 */
export function createFakeHistoryPanelGateway(
  options: CreateFakeHistoryPanelGatewayOptions = {},
): HistoryPanelGateway {
  const history = options.history ?? createHistoryStack();
  const entities = options.entities ?? {};
  const calls = options.sceneCalls ?? [];
  const roles = options.roles;

  const applyTransition = (transition: HistoryTransition): void => {
    calls.push(`applyTransition:${transitionLabel(transition)}`);
  };

  return {
    supports: {
      readHistory: true,
      jumpToStep: true,
      previewBeforeState: true,
      frameEntities: true,
      selectEntity: true,
      loadArchivedSteps: false,
    },
    history,
    rolesKnown: options.canJump !== undefined || roles !== undefined,
    canJump: options.canJump ?? can('edit', 'layer', roles === undefined ? {} : { roles }),
    currentActorId: options.actorId ?? HISTORY_PANEL_DEFAULT_ACTOR_ID,
    jumpBy: (steps) => {
      const applied: HistoryTransition[] = [];
      const forward = steps > 0;
      const count = Math.abs(Math.trunc(steps));

      for (let taken = 0; taken < count; taken += 1) {
        const transition = forward ? history.redo() : history.undo();

        if (transition === null) {
          break;
        }

        applyTransition(transition);
        applied.push(transition);
      }

      return applied;
    },
    applyTransition,
    readEntity: (entityId) => entities[entityId] ?? null,
    scene: {
      previewEntity: (entityId) => {
        calls.push(`preview:${entityId}`);
      },
      discardPreview: () => {
        calls.push('discardPreview');
      },
      frameEntities: (entityIds) => {
        calls.push(`frameEntities:${entityIds.join(',')}`);

        return entityIds.length > 0;
      },
      selectEntity: (entityId) => {
        calls.push(`select:${entityId}`);
      },
    },
    loadArchivedSteps: () =>
      Promise.resolve({ ok: false, reason: NO_ARCHIVED_HISTORY_REASON }),
  };
}
