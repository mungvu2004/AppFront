/**
 * Cổng năng lực — và đường ghi — của tấm trượt chi tiết vi phạm (S-34).
 *
 * ## Vì sao hai năng lực là `false`
 *
 * Đây KHÔNG phải chỗ tạm, không phải mã chờ nối dây. Hai năng lực dưới đây thiếu
 * ở TẦNG LOGIC CỦA REPO HÔM NAY, và người duyệt đã chốt trình bày sự thật đó thay
 * vì bịa ra một lớp giả ở tầng màn hình (phán quyết G1 và G3, 2026-09-07):
 *
 * 1. **`canDismiss: false` — không có trạng thái bỏ qua vi phạm.** Không có
 *    trường `dismissed`, `waived`, `dismissedBy` hay `dismissReason` ở bất kỳ
 *    slice nào của `src/store`, cũng không có ở `src/domain` và `src/api`; grep
 *    có ranh giới từ trên cả ba thư mục trả về không kết quả nào. Không có nơi
 *    nào ghi lý do bỏ qua và người bỏ qua. Câu này chép nguyên văn phán quyết đã
 *    đứng sẵn ở màn anh em, `../RuleReport/ruleReportGateway.ts:18-21`.
 * 2. **`canCompareMeasure: false` — không đặt cạnh nhau được số đo và ngưỡng.**
 *    `Violation` (`@/domain/rules/registry`, `registry.ts:134-141`) mở rộng
 *    `RuleFinding` (`registry.ts:124-132`) và cả hai cộng lại chỉ có sáu trường:
 *    `entityId`, `message`, `suggestion`, `ruleCode`, `severity`, `levelId`.
 *    Ngưỡng thì CÓ — chúng là hằng số của từng luật — nhưng nửa kia, con số THẬT
 *    ĐO ĐƯỢC trên đối tượng, không được mang ra khỏi `check()`. Dựng lại nó ở
 *    tầng màn hình là đúng thứ R-61 sinh ra để chặn, và `violation.message` do
 *    domain soạn đã chứa cả hai con số dưới dạng chữ.
 *
 * ## Năm năng lực còn lại là `true`, và vì sao
 *
 * | Năng lực | Bằng chứng |
 * |---|---|
 * | `canDeleteObject` | `createDeleteFurnitureCommand` — `@/lib/commands/business/openingCommands`, `openingCommands.ts:1065` |
 * | `canRenameRoom` | `createRenameRoomCommand` — `@/lib/commands/business/roomFloorCommands`, `roomFloorCommands.ts:209` |
 * | `canPreview2d` | `toBuildFloorInput` (`toBuildFloorInput.ts:244`) + `resolveWallShapes` (`@/domain/walls/joints`, `joints.ts:700`) |
 * | `canPreview3d` | `mountViewerScene` (`@/screens/viewer/Viewer3D`, `viewer3dScene.ts:211`) + `ViewerSceneHandle.frameEntities` / `.preview` (`viewer3dTypes.ts:276`) |
 * | `canShowConfidence` | `ReviewMetadata.confidence` ∈ [0,1] trên từng thực thể — `@/domain/spatial/types`, `types.ts:61-65` |
 *
 * Hệ quả cho tầng view: năng lực nào `false` thì phần giao diện của nó **bị gỡ
 * khỏi DOM**, đúng y cách trạng thái 6 (không có quyền) gỡ mọi hành động sửa —
 * không render nút bị vô hiệu hoá, không render ô trống, không render ghi chú
 * "sắp có".
 *
 * **Khi tầng logic có trạng thái bỏ qua thì chỉ đổi một chữ ở đây, không phải
 * sửa view.** `dismissReason` / `onDismissReasonChange` / `dismissReasonError`
 * vẫn nằm nguyên trong `./types`, chờ đúng chữ `false` ấy.
 *
 * ## Đường ghi cũng ở đây, không ở hook
 *
 * `commit()` chỉ được xuất hiện trong ruột của `SpatialPort.applyPatches` mà
 * pipeline `dispatch` gọi ở bước `apply` — không bao giờ trong view và không bao
 * giờ dưới tay một nút bấm (A10). Khuôn chép từ
 * `@/screens/qc/ObjectLayerReview/objectLayerReviewGateway.ts:1076-1146`.
 */

import { describeUsage } from '@/domain/rooms/classify';
import { isEntityOfKind, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type { FurnitureId, RoomId } from '@/domain/spatial/types';
import {
  createDeleteFurnitureCommand,
  type DeleteFurnitureInput,
} from '@/lib/commands/business/openingCommands';
import {
  createRenameRoomCommand,
  type RenameRoomInput,
} from '@/lib/commands/business/roomFloorCommands';
import type { CommandContext, CommandResult } from '@/lib/commands/business/shared';
import {
  createIncrementalRuleRunner,
  type DispatchDeps,
  type DispatchResult,
  type SpatialPort,
} from '@/lib/commands/dispatch';
import {
  createHistoryStack,
  NO_SELECTION,
  type HistoryStack,
} from '@/lib/commands/history';
import { MERGE_WINDOW_MS } from '@/lib/commands/mergeCommands';
import { runTransaction } from '@/lib/commands/transaction';
import type { Command } from '@/lib/commands/types';
import type { MountViewerScene } from '@/screens/viewer/Viewer3D';
import { applyRollbackPatches, commit } from '@/store/commit';

import type { ViolationDetailCapabilities } from './types';

/* -------------------------------------------------------------------------- */
/* Năng lực.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Hai năng lực còn thiếu ở tầng logic, đóng băng lại để không ai lỡ tay ghi đè
 * một chữ `true` ở giữa đường mà không đi qua cổng này.
 */
export const VIOLATION_DETAIL_MISSING_CAPABILITIES: Readonly<
  Pick<ViolationDetailCapabilities, 'canDismiss' | 'canCompareMeasure'>
> = Object.freeze({
  canDismiss: false,
  canCompareMeasure: false,
});

/**
 * Năm năng lực CÓ THẬT, mỗi cái tựa lên một hàm đã chạy được trong repo hôm nay.
 *
 * Chúng đóng băng vì cùng một lý do như bảng trên: một chữ `true` viết vội ở nơi
 * khác sẽ nói dối về tầng logic theo đúng chiều ngược lại.
 */
export const VIOLATION_DETAIL_PRESENT_CAPABILITIES: Readonly<
  Omit<ViolationDetailCapabilities, 'canEdit' | 'canDismiss' | 'canCompareMeasure'>
> = Object.freeze({
  canDeleteObject: true,
  canRenameRoom: true,
  canPreview2d: true,
  canPreview3d: true,
  canShowConfidence: true,
});

/**
 * Ai đứng tên lượt sửa trong nhật ký lệnh.
 *
 * Một hằng đặt tên ở đúng một chỗ, để `Command.actorId`, nhật ký hoạt động và
 * bài kiểm cùng đọc một nguồn thay vì ba chuỗi rời (R-71).
 */
export const VIOLATION_DETAIL_ACTOR_ID = 'violation-detail';

/** Ép cảnh cho bài kiểm, đúng khuôn `../RuleReport/ruleReportGateway.ts`: tường minh, không biến ẩn. */
export interface ViolationDetailGatewaySeed {
  /**
   * Ghi đè quyền sửa của người dùng. Không truyền thì cổng dùng đúng giá trị
   * container đưa xuống — đây chỉ để bài kiểm dựng trạng thái 6 mà không phải
   * dựng cả một phiên đăng nhập.
   */
  readonly canEdit?: boolean;
  /** Đồng hồ của vé hoàn tác tám giây. `Date.now` khi vắng mặt. */
  readonly now?: () => number;
  /** Người đứng tên lượt sửa; bài kiểm đọc lại nó trong `Command.actorId`. */
  readonly actorId?: string;
  /**
   * Ngăn xếp hoàn tác của tấm trượt.
   *
   * Truyền vào để bài kiểm giữ được cùng một ngăn xếp qua nhiều lượt render.
   * CẢNH BÁO: đây KHÔNG phải ngăn xếp `temporal` mà `Ctrl+Z` toàn cục đọc —
   * xem docstring của {@link createViolationDetailDispatchDeps}.
   */
  readonly history?: HistoryStack;
  /**
   * Ép cảnh 3D cho bài kiểm.
   *
   * Bản thật đến qua `import()` ĐỘNG (ngân sách `routeChunk` 280 KiB, mà
   * `screens/viewer/Viewer3D` một mình đã 264,8 KiB), nên bài kiểm không có
   * chỗ nào chen vào giữa — trừ chỗ này. Chỉ KIỂU được nhập tĩnh ở đây; kiểu
   * bị xoá lúc dựng nên không một byte nào của màn kia đi vào gói này.
   */
  readonly mountScene?: MountViewerScene;
}

export interface ViolationDetailGateway {
  /**
   * Bộ năng lực của một lượt xem chi tiết.
   *
   * `canEdit` là năng lực THẬT duy nhất còn thay đổi được: nó đến từ quyền của
   * người dùng, do container đưa xuống. Bảy chữ còn lại là hằng của repo hôm nay.
   */
  readonly readCapabilities: (canEdit: boolean) => ViolationDetailCapabilities;
  readonly actorId: string;
  readonly now: () => number;
  readonly history: HistoryStack | undefined;
  /** Bản cảnh 3D bài kiểm ép vào; `undefined` là dùng bản thật, nhập động. */
  readonly mountScene: MountViewerScene | undefined;
}

/** Cổng thật của màn. Chữ ký này không đổi khi hai năng lực kia được nối dây. */
export function createViolationDetailGateway(
  seed: ViolationDetailGatewaySeed = {},
): ViolationDetailGateway {
  return {
    readCapabilities: (canEdit) => ({
      ...VIOLATION_DETAIL_MISSING_CAPABILITIES,
      ...VIOLATION_DETAIL_PRESENT_CAPABILITIES,
      canEdit: seed.canEdit ?? canEdit,
    }),
    actorId: seed.actorId ?? VIOLATION_DETAIL_ACTOR_ID,
    now: seed.now ?? Date.now,
    history: seed.history,
    mountScene: seed.mountScene,
  };
}

/* -------------------------------------------------------------------------- */
/* Tầng lệnh — hai lệnh S-07 gọi lại, không lệnh nào tự dựng.                  */
/* -------------------------------------------------------------------------- */

/** Ngữ cảnh mà các hàm dựng lệnh của S-07 đọc. */
export const commandContextOf = (
  graph: NormalizedSpatial,
  actorId: string,
): CommandContext => ({ graph, actorId });

/** Xoá đối tượng bị phát hiện — gọi lại S-07, màn không dựng patch nào. */
export const buildDeleteFurnitureCommand = (
  input: DeleteFurnitureInput,
  context: CommandContext,
): CommandResult => createDeleteFurnitureCommand(input, context);

/** Đổi tên phòng — gọi lại S-07, kể cả bốn lý do từ chối tiếng Việt của nó. */
export const buildRenameRoomCommand = (
  input: RenameRoomInput,
  context: CommandContext,
): CommandResult => createRenameRoomCommand(input, context);

/**
 * Tên đề xuất cho một phòng chưa được đặt tên.
 *
 * Không phải một cái tên tự nghĩ ra: `describeUsage` (`@/domain/rooms/classify`,
 * `classify.ts:161`) đọc bảng `USAGE_LABELS` của domain, và `room.usage` là một
 * trường có sẵn trên đồ thị. Đây đúng là việc mà `suggestion` của luật
 * `ROOM-UNNAMED` bảo phải làm — "Đặt tên phòng theo công năng để bảng thống kê
 * đọc được" (`@/domain/rules/registry`, `registry.ts:620`) — nên nút sửa nhanh
 * chỉ đang bấm hộ đúng câu gợi ý ấy, không thay người dùng quyết định gì thêm.
 *
 * `validateRenameRoom` vẫn chạy bình thường trên tên này: trùng tên trong cùng
 * tầng, hay tên y hệt tên cũ, đều bị từ chối và câu từ chối là câu của domain.
 *
 * @returns `null` khi mã không trỏ tới một phòng nào trong đồ thị — không có tên
 * đề xuất thì KHÔNG có hàng sửa nhanh, chứ không phải một cái tên bịa.
 */
export function proposedRoomNameOf(
  graph: NormalizedSpatial,
  roomId: string,
): string | null {
  const entity = graph.byId[roomId];

  if (entity === undefined || !isEntityOfKind('room', entity)) {
    return null;
  }

  return describeUsage(entity.usage);
}

/** Ép kiểu mã đối tượng thành mã đồ đạc, sau khi tiền tố đã được đọc từ chính mã. */
export const asFurnitureId = (entityId: string): FurnitureId => entityId as FurnitureId;

/** Ép kiểu mã đối tượng thành mã phòng, sau khi tiền tố đã được đọc từ chính mã. */
export const asRoomId = (entityId: string): RoomId => entityId as RoomId;

/* -------------------------------------------------------------------------- */
/* Đường ghi — `runTransaction` chạy qua `commit`.                             */
/* -------------------------------------------------------------------------- */

/** Cửa đọc đồ thị đang sửa. Mặc định là kho; bài kiểm cắm một đồ thị cố định. */
export interface ViolationDetailGraphPort {
  readonly read: () => NormalizedSpatial | null;
}

/**
 * Cổng ghi của `dispatch`, cài bằng `commit`.
 *
 * `commit` nhận `SpatialPatch[]` và một nhãn tiếng Việt, đúng hai thứ
 * `applyPatches` có trong tay. Nhãn lấy từ chính `label` của lượt dispatch, nên
 * nút hoàn tác và nhật ký hoạt động đọc cùng một câu (A10: không `set()`).
 */
export function createCommitSpatialPort(
  graph: ViolationDetailGraphPort,
  labelOf: () => string,
): SpatialPort {
  return {
    read: () => graph.read(),
    applyPatches: (patches) => {
      commit(patches, labelOf());
    },
    // Rollback KHÔNG được mở một bước hoàn tác mới: `commit` thì mở, còn
    // `applyRollbackPatches` thì không. Thiếu dòng này, một lượt dispatch hỏng ở
    // bước sau để lại HAI past-state zundo, và Ctrl+Z kế tiếp áp LẠI thay đổi vừa bị
    // rollback — vi phạm A8. Xem `SpatialPort.revertPatches` (lib/commands/dispatch.ts:145).
    revertPatches: applyRollbackPatches,
  };
}

/** Bộ phụ thuộc năm bước của `dispatch`, gắn với ngăn xếp hoàn tác của tấm trượt. */
export interface ViolationDetailDispatchDeps {
  readonly deps: DispatchDeps;
  readonly history: HistoryStack;
  /** Nhãn của lượt dispatch đang chạy — `SpatialPort` đọc nó để đặt tên cho `commit`. */
  readonly setLabel: (label: string) => void;
}

export interface CreateViolationDetailDispatchOptions {
  readonly graph: ViolationDetailGraphPort;
  /** Bước `sync` — đánh dấu bản vẽ bẩn cho tự lưu (A7). */
  readonly onSynced: () => void;
  readonly history?: HistoryStack | undefined;
}

/**
 * Dựng `DispatchDeps` đủ bốn cổng.
 *
 * **CẢNH BÁO — hai ngăn xếp hoàn tác, không phải một.** `history` trả về ở đây
 * là `HistoryStack` RIÊNG của tấm trượt (`@/lib/commands/history`), và vé hoàn
 * tác tám giây của D-05 đi qua đúng nó. `Ctrl+Z` toàn cục thì đọc ngăn xếp
 * `temporal` của zundo mà `commit()` mở ra (`@/store/commit`, `commit.ts:140`),
 * đăng ký một lần ở `routes/router.tsx`. Hai ngăn xếp ấy KHÔNG phải một; màn này
 * không đăng ký lại `Ctrl+Z` và không cố đồng bộ chúng.
 *
 * Vùng chọn trước/sau đều là `NO_SELECTION`: tấm trượt không sở hữu vùng chọn
 * của bản vẽ, nên nó không có gì trung thực để chụp lại vào bước lịch sử.
 */
export function createViolationDetailDispatchDeps(
  options: CreateViolationDetailDispatchOptions,
): ViolationDetailDispatchDeps {
  const history = options.history ?? createHistoryStack({ mergeWindowMs: MERGE_WINDOW_MS });
  let label = '';

  const deps: DispatchDeps = {
    spatial: createCommitSpatialPort(options.graph, () => label),
    history: {
      push: (entry) => {
        history.push({
          entry,
          selectionBefore: NO_SELECTION,
          selectionAfter: NO_SELECTION,
        });
      },
      drop: (entryId) => {
        history.drop(entryId);
      },
    },
    rules: createIncrementalRuleRunner(),
    sync: {
      enqueue: () => {
        options.onSynced();
      },
    },
  };

  return {
    deps,
    history,
    setLabel: (next) => {
      label = next;
    },
  };
}

/**
 * Chạy một cách sửa như MỘT bước lịch sử — bước 5 của chuỗi mười hai bước.
 *
 * `runTransaction` chạy đủ `validate → apply → history → rules → sync`
 * (`@/lib/commands/dispatch`, `dispatch.ts:4-33`) dưới một khoá độc quyền, nên
 * hai lượt sửa không bao giờ chen vào giữa `apply` và `enqueue` của nhau.
 */
export async function runViolationTransaction(
  commands: readonly Command[],
  bundle: ViolationDetailDispatchDeps,
  label: string,
): Promise<DispatchResult> {
  bundle.setLabel(label);

  return runTransaction(commands, bundle.deps, { label });
}
