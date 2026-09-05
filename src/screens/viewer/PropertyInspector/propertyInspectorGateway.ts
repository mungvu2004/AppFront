/**
 * Cổng dữ liệu và tầng lệnh của `PropertyInspector` — mọi lời gọi ra khỏi panel
 * đi qua đây, đúng khuôn `wallLayerReviewGateway.ts` và
 * `dimensionOcrReviewGateway.ts` của các màn QC anh em.
 *
 * ## Đường ghi — `dispatch` chạy qua `commit` (S-07 + S-05 + A10)
 *
 * Mọi ô nhập của panel TẠO LỆNH rồi điều phối qua `dispatch` (năm bước
 * `validate → apply → history → rules → sync`), và `SpatialPort.applyPatches`
 * của `dispatch` được cài bằng `commit(patches, label)` của `src/store/commit.ts`.
 * `commit` chỉ xuất hiện trong file này, không bao giờ trong hook hay view; không
 * một dòng nào gọi `set()` hay `_applyPatches()` (A10, `local/no-direct-set`).
 *
 * ## Ba lệnh dựng bằng nguyên thuỷ công khai, và vì sao được phép
 *
 * `src/lib/commands/business` KHÔNG có lệnh đổi `swing` của một ô mở đã tồn tại
 * (hợp đồng T2 mục C8 #1) và KHÔNG có lệnh nào đặt cờ duyệt. Điều phối viên đã
 * phán quyết từng mục một trước khi file này được viết:
 *
 * - **Đổi chiều mở** — được dựng bằng `createCommand` + `changeForUpdate`, chép
 *   đúng khuôn `buildOverrideDimensionCommand`
 *   (`screens/qc/DimensionOcrReview/dimensionOcrReviewGateway.ts:780-783`). Lý do
 *   đã ghi trong phán quyết: `swing` là một trường enum trên thực thể, đổi nó
 *   không phải phép tính hình học nên R-61 không cấm. Lệnh mang tên riêng
 *   {@link OPENING_SWING_COMMAND_TYPE}, không mượn tên của họ lệnh khác.
 * - **Duyệt** — {@link buildApproveCommand} là đường DUY NHẤT đặt `reviewed: true`,
 *   và nó luôn đặt kèm `source: 'human'` CỨNG trong thân hàm. Không tham số nào
 *   cho phép nơi gọi truyền `source`, nên đầu ra AI không có đường nào bật được
 *   cờ xanh "đã xác minh" (A5). Kỷ luật này chép nguyên từ
 *   `buildApproveDimensionCommand` (cùng file trên, dòng 790).
 * - **Bộ đếm duyệt** — {@link approvedCountOf} đếm từ chính đồ thị, không có một
 *   biến đếm nào được nuôi tay: `src/store` không có bộ đếm duyệt nào (đã tìm),
 *   và một con số suy ra không bao giờ lệch khỏi dữ liệu. Khuôn:
 *   `reviewCounterOf` (cùng file trên, dòng 727).
 *
 * ## Hai việc tầng logic CHƯA CÓ ĐƯỜNG — nói ra, không vá
 *
 * 1. **Chiều cao tường và kích thước bao nội thất không ghi được.**
 *    `WALL_COMMAND_TYPES` không có lệnh đổi `heightMm`; họ `furniture.*` chỉ có
 *    `add`/`move`/`rotate`/`delete`, `movedFurniture` chỉ DỊCH hộp bao chứ không
 *    ghi lại kích thước. Panel để hai dòng đó CHỈ ĐỌC. Phán quyết ghi rõ lý do:
 *    chưa ai quyết định chuyện gì xảy ra với ô mở khi tường thấp xuống dưới đỉnh
 *    ô mở, hay với `FURNITURE-CLASH` khi nội thất phình ra — ghi thẳng
 *    `{...wall, heightMm}` là tự quyết định hai điều đó, đúng thứ "không tính lại
 *    hình học" cấm.
 * 2. **`copyAsTemplate` chưa tồn tại ở bất cứ tầng nào.** Không lệnh, không
 *    `queryKey`, không endpoint trong `src/lib`, `src/domain`, `src/store`,
 *    `src/api`. Cổng khai `supports.copyAsTemplate = false` ĐỒNG BỘ và trả về một
 *    lý do tiếng Việt, đúng khuôn `persistWallLayer` của
 *    `wallLayerReviewGateway.ts:250-256,362` — nút có thật và nói thật, không phải
 *    một callback rỗng.
 *
 * `openingsOfRoom` giờ đã được export từ `src/domain/spatial/roomOpenings.ts` —
 * {@link roomOpeningCountsOf} dưới đây gọi thẳng nó thay vì nuôi một bản sao.
 */

import { readEntity } from '@/domain/spatial/applyPatch';
import type { NormalizedSpatial, SpatialEntity } from '@/domain/spatial/normalize';
import { isEntityOfKind } from '@/domain/spatial/normalize';
import { countOpeningsByKind, openingsOfRoom } from '@/domain/spatial/roomOpenings';
import type {
  Furniture,
  Opening,
  Room,
  SwingDirection,
  Wall,
  WallId,
} from '@/domain/spatial/types';
import type { Violation } from '@/domain/rules/registry';
import { changeForUpdate, createCommand } from '@/lib/commands/createCommand';
import type { Command } from '@/lib/commands/types';
import type { DispatchDeps, DispatchResult, SpatialPort } from '@/lib/commands/dispatch';
import { createIncrementalRuleRunner, dispatch } from '@/lib/commands/dispatch';
import type { HistoryStack, SelectionSnapshot } from '@/lib/commands/history';
import { createHistoryStack, NO_SELECTION } from '@/lib/commands/history';
import { MERGE_WINDOW_MS } from '@/lib/commands/mergeCommands';
import { commit } from '@/store/commit';

import type { ObjectKind } from './propertyInspectorTypes';
import { OBJECT_KIND_LABELS } from './propertyInspectorTypes';

/* -------------------------------------------------------------------------- */
/* Bốn loại đối tượng panel thanh tra được.                                    */
/* -------------------------------------------------------------------------- */

/** Bốn thực thể ứng với bốn `ObjectKind` — không gồm `level`/`axis`/`dimension`. */
export type InspectableEntity = Wall | Opening | Room | Furniture;

/**
 * Loại của một thực thể theo từ vựng của panel, hoặc `null` khi panel không
 * thanh tra loại đó (trục, cao độ tầng, chuỗi kích thước).
 *
 * Dùng `isEntityOfKind` của domain — tiền tố id là dấu hiệu runtime DUY NHẤT
 * đáng tin, các thực thể không chung một trường phân biệt nào.
 */
export function objectKindOf(entity: SpatialEntity): ObjectKind | null {
  if (isEntityOfKind('wall', entity)) {
    return 'wall';
  }

  if (isEntityOfKind('opening', entity)) {
    return 'opening';
  }

  if (isEntityOfKind('room', entity)) {
    return 'room';
  }

  if (isEntityOfKind('furniture', entity)) {
    return 'furniture';
  }

  return null;
}

/** Thực thể panel thanh tra được, hoặc `null` — hẹp `SpatialEntity` xuống bốn loại. */
export function toInspectableEntity(entity: SpatialEntity): InspectableEntity | null {
  if (isEntityOfKind('wall', entity)) {
    return entity;
  }

  if (isEntityOfKind('opening', entity)) {
    return entity;
  }

  if (isEntityOfKind('room', entity)) {
    return entity;
  }

  if (isEntityOfKind('furniture', entity)) {
    return entity;
  }

  return null;
}

/** Đọc một đối tượng theo id (D-12); `null` khi id không có hoặc không thuộc bốn loại. */
export function readInspectableEntity(
  graph: NormalizedSpatial | null,
  id: string,
): InspectableEntity | null {
  if (graph === null) {
    return null;
  }

  const entity = graph.byId[id];

  return entity === undefined ? null : toInspectableEntity(entity);
}

/* -------------------------------------------------------------------------- */
/* Quan hệ — ghép dữ liệu trên các trường id đã có, không một phép hình học.    */
/* -------------------------------------------------------------------------- */

/** Số cửa đi và số cửa sổ của một phòng. */
export interface RoomOpeningCounts {
  readonly doorCount: number;
  readonly windowCount: number;
}

/**
 * Đếm cửa đi / cửa sổ của một phòng, qua tiện ích dùng chung
 * `openingsOfRoom`/`countOpeningsByKind` của `src/domain/spatial/roomOpenings.ts`.
 *
 * `Room` không có `doorCount`/`windowCount`/`openingIds` (hợp đồng T1 mục M7 #5),
 * nên hai con số này chỉ có thể ghép ra. Việc của hàm này chỉ còn là giải
 * `room.wallIds`/`wall.openingIds` thành hai mảng phẳng từ `NormalizedSpatial`
 * — phép đếm và phép duyệt hình học thật sự nằm trong tiện ích domain.
 *
 * **Một ô mở nằm trên tường dùng chung giữa hai phòng được đếm cho CẢ HAI phòng.**
 * Đó là hành vi đúng của `openingsOfRoom`: cái cửa ấy đúng là cửa của cả hai
 * phòng. Ghi ra đây để người đọc sau không tưởng là lỗi trùng.
 */
export function roomOpeningCountsOf(graph: NormalizedSpatial, room: Room): RoomOpeningCounts {
  const walls: Wall[] = [];
  const openingIds = new Set<Opening['id']>();

  for (const wallId of room.wallIds) {
    const wall = readEntity(graph, 'wall', wallId);

    if (wall === null) {
      continue;
    }

    walls.push(wall);

    for (const openingId of wall.openingIds) {
      openingIds.add(openingId);
    }
  }

  const openings: Opening[] = [];

  for (const openingId of openingIds) {
    const opening = readEntity(graph, 'opening', openingId);

    if (opening !== null) {
      openings.push(opening);
    }
  }

  return countOpeningsByKind(openingsOfRoom(room, walls, openings));
}

/**
 * Phòng chứa một đối tượng, hoặc `null`.
 *
 * Nội thất mang thẳng `roomId`. Tường thì không: phòng mới là bên giữ danh sách
 * `wallIds`, nên chiều tra ngược là duyệt các phòng của đồ thị — vẫn chỉ đọc id.
 */
export function containingRoomIdOf(graph: NormalizedSpatial, entity: InspectableEntity): string | null {
  if (isEntityOfKind('furniture', entity)) {
    return entity.roomId ?? null;
  }

  if (isEntityOfKind('room', entity)) {
    return null;
  }

  const wallId: WallId | null = isEntityOfKind('wall', entity) ? entity.id : entity.wallId;

  for (const roomId of graph.byKind.room) {
    const candidate = graph.byId[roomId];

    if (candidate !== undefined && isEntityOfKind('room', candidate) && candidate.wallIds.includes(wallId)) {
      return candidate.id;
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* M-12 — vi phạm của MỘT đối tượng.                                           */
/* -------------------------------------------------------------------------- */

/** Danh sách rỗng dùng chung — không tạo mảng mới mỗi lần render. */
const NO_VIOLATIONS: readonly Violation[] = Object.freeze([]);

/**
 * Vi phạm gắn với một id, lọc từ mảng `Violation[]` mà `selectViolations` đã
 * tính sẵn.
 *
 * Không selector nào trong repo lọc theo thực thể — chỉ có theo TẦNG
 * (`selectFloorViolations`), xác nhận ở hợp đồng T1 mục M7 #3. Phép lọc này là
 * GHÉP DỮ LIỆU trên kết quả có sẵn, không phải chạy lại luật: bộ luật chạy trong
 * `selectViolations`, panel chỉ đọc.
 *
 * **Khoảng trống đã biết:** registry dùng chung chỉ đăng ký 8 luật gốc, nên các
 * luật hình học / công năng / fit-out (kể cả `FURNITURE-CLASH`) không bao giờ
 * xuất hiện ở đây. Panel GIỮ NGUYÊN điều đó — tự đăng ký thêm luật là tự kiểm
 * luật, điều bị cấm tuyệt đối.
 */
export function violationsOfEntity(
  violations: readonly Violation[],
  entityId: string | null,
): readonly Violation[] {
  if (entityId === null) {
    return NO_VIOLATIONS;
  }

  const matched = violations.filter((violation) => violation.entityId === entityId);

  return matched.length === 0 ? NO_VIOLATIONS : matched;
}

/* -------------------------------------------------------------------------- */
/* Duyệt — bộ đếm suy ra, và lệnh đặt cờ xanh.                                 */
/* -------------------------------------------------------------------------- */

/** Bốn loại panel thanh tra được, đúng thứ tự panel duyệt vòng. */
const INSPECTABLE_KINDS = ['wall', 'opening', 'room', 'furniture'] as const;

/**
 * Số đối tượng đã duyệt trong toàn đồ thị — bộ đếm toàn cục của H8.
 *
 * Đếm từ chính dữ liệu, không nuôi một biến đếm nào: `src/store` không có bộ đếm
 * duyệt, và một con số suy ra không thể lệch khỏi thứ nó đếm. Khuôn:
 * `reviewCounterOf` (`dimensionOcrReviewGateway.ts:727`).
 */
export function approvedCountOf(graph: NormalizedSpatial | null): number {
  if (graph === null) {
    return 0;
  }

  let approved = 0;

  for (const kind of INSPECTABLE_KINDS) {
    for (const id of graph.byKind[kind]) {
      const entity = graph.byId[id];

      if (entity !== undefined && 'reviewed' in entity && entity.reviewed) {
        approved += 1;
      }
    }
  }

  return approved;
}

/**
 * Đối tượng CHƯA DUYỆT kế tiếp CÙNG LOẠI, tính từ đối tượng đang xem.
 *
 * Duyệt vòng: hết danh sách thì quay lại đầu, nên người duyệt không bao giờ rơi
 * vào ngõ cụt ở cuối tầng. `null` khi loại đó không còn gì chưa duyệt.
 */
export function nextUnapprovedIdOf(
  graph: NormalizedSpatial | null,
  kind: ObjectKind,
  currentId: string,
): string | null {
  if (graph === null) {
    return null;
  }

  const ids = graph.byKind[kind];
  const currentIndex = ids.findIndex((id) => id === currentId);
  const start = currentIndex === -1 ? 0 : currentIndex + 1;

  for (let step = 0; step < ids.length; step += 1) {
    const id = ids[(start + step) % ids.length];

    if (id === undefined || id === currentId) {
      continue;
    }

    const entity = graph.byId[id];

    if (entity !== undefined && 'reviewed' in entity && !entity.reviewed) {
      return id;
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Ba lệnh của panel.                                                          */
/* -------------------------------------------------------------------------- */

/** Loại lệnh đổi chiều mở. Viết đúng một chỗ (R-71). */
export const OPENING_SWING_COMMAND_TYPE = 'opening.changeSwing';

/** Loại lệnh duyệt một đối tượng. Cùng lý do đặt tên như trên. */
export const INSPECTOR_APPROVE_COMMAND_TYPE = 'inspector.approve';

/** Câu mô tả đi vào nhật ký hoạt động, nút hoàn tác và nhãn của `commit`. */
export const swingCommandDescription = (openingId: string): string =>
  `Đổi chiều mở ${OBJECT_KIND_LABELS.opening} ${openingId}`;

/** Câu mô tả của lệnh duyệt. */
export const approveCommandDescription = (kind: ObjectKind, entityId: string): string =>
  `Duyệt ${OBJECT_KIND_LABELS[kind]} ${entityId}`;

/**
 * Lệnh đổi chiều mở của một ô mở ĐÃ TỒN TẠI.
 *
 * `ResizeOpeningInput` không mang `swing`, và `AddOpeningInput.swing` chỉ dùng
 * được lúc tạo (hợp đồng T2 mục C8 #1), nên lệnh này dựng bằng nguyên thuỷ công
 * khai. Hợp lệ vì `CommandType` là `string` mở và `validateCommands` chỉ kiểm
 * `type` khác rỗng; tự hoàn tác được vì `changeForUpdate` mang ĐỦ ảnh chụp
 * `before`/`after` và `invertCommand` chỉ hoán đổi hai ảnh đó.
 *
 * KHÔNG chạm `reviewed`, `confidence` hay `source`: đổi một trường dữ liệu không
 * phải là phán quyết của người duyệt (A5).
 */
export function buildChangeSwingCommand(
  before: Opening,
  swing: SwingDirection,
  actorId: string,
): Command {
  return createCommand({
    type: OPENING_SWING_COMMAND_TYPE,
    actorId,
    description: swingCommandDescription(before.id),
    changes: [changeForUpdate('opening', before, { ...before, swing })],
  });
}

/**
 * Lệnh duyệt — đường DUY NHẤT trong panel đặt cờ "đã xác minh" (A5).
 *
 * `source: 'human'` viết cứng trong thân hàm, không tham số nào cho phép nơi gọi
 * truyền nó vào: đầu ra AI không có đường nào bật được cờ xanh. Bốn nhánh viết
 * tường minh thay vì một hàm chung có tham số kiểu, vì `changeForUpdate` cần
 * biết loại thực thể ở mức kiểu chứ không phải lúc chạy.
 */
export function buildApproveCommand(before: InspectableEntity, actorId: string): Command {
  if (isEntityOfKind('wall', before)) {
    return createCommand({
      type: INSPECTOR_APPROVE_COMMAND_TYPE,
      actorId,
      description: approveCommandDescription('wall', before.id),
      changes: [
        changeForUpdate('wall', before, { ...before, reviewed: true, source: 'human' }),
      ],
    });
  }

  if (isEntityOfKind('opening', before)) {
    return createCommand({
      type: INSPECTOR_APPROVE_COMMAND_TYPE,
      actorId,
      description: approveCommandDescription('opening', before.id),
      changes: [
        changeForUpdate('opening', before, { ...before, reviewed: true, source: 'human' }),
      ],
    });
  }

  if (isEntityOfKind('room', before)) {
    return createCommand({
      type: INSPECTOR_APPROVE_COMMAND_TYPE,
      actorId,
      description: approveCommandDescription('room', before.id),
      changes: [
        changeForUpdate('room', before, { ...before, reviewed: true, source: 'human' }),
      ],
    });
  }

  return createCommand({
    type: INSPECTOR_APPROVE_COMMAND_TYPE,
    actorId,
    description: approveCommandDescription('furniture', before.id),
    changes: [
      changeForUpdate('furniture', before, { ...before, reviewed: true, source: 'human' }),
    ],
  });
}

/* -------------------------------------------------------------------------- */
/* Đường ghi — `dispatch` chạy qua `commit`.                                   */
/* -------------------------------------------------------------------------- */

/** Cửa đọc đồ thị đang sửa. Mặc định là store; test cắm một đồ thị cố định. */
export interface PropertyInspectorGraphPort {
  readonly read: () => NormalizedSpatial | null;
}

/**
 * Cổng ghi của `dispatch`, cài bằng `commit`.
 *
 * Nhãn lấy từ chính `description` của lượt dispatch đang chạy, nên nút hoàn tác,
 * nhật ký hoạt động và chỉ báo lưu đọc cùng một câu.
 */
export function createCommitSpatialPort(
  graph: PropertyInspectorGraphPort,
  labelOf: () => string,
): SpatialPort {
  return {
    read: () => graph.read(),
    applyPatches: (patches) => {
      commit(patches, labelOf());
    },
  };
}

/** Bộ phụ thuộc năm cổng của `dispatch`, gắn với ngăn xếp hoàn tác 100 bước của S-06. */
export interface PropertyInspectorDispatchBundle {
  readonly deps: DispatchDeps;
  readonly history: HistoryStack;
  /** Nhãn của lượt dispatch đang chạy — `SpatialPort` đọc nó để đặt tên cho `commit`. */
  readonly setLabel: (label: string) => void;
}

export interface CreatePropertyInspectorDispatchOptions {
  readonly graph: PropertyInspectorGraphPort;
  readonly selectionBefore: () => SelectionSnapshot;
  readonly selectionAfter: () => SelectionSnapshot;
  /** Bước `sync` — đánh dấu bản vẽ bẩn cho tự lưu (D-07). */
  readonly onSynced: () => void;
  readonly history?: HistoryStack;
}

/**
 * Dựng `DispatchDeps` đầy đủ năm cổng.
 *
 * **D-06 nằm ở đây, không ở hook.** Ngăn xếp được dựng với `mergeWindowMs =
 * MERGE_WINDOW_MS` (hằng số của `src/lib/commands/mergeCommands`, gốc là
 * `COALESCE_WINDOW_MS` — panel không viết lại con số, R-71). `HistoryStack.push`
 * tự gọi `canMergeCommands`/`mergeCommands`: hai lượt ghi cùng loại, cùng người,
 * cùng đối tượng, cách nhau dưới cửa sổ đó gộp thành MỘT bước hoàn tác, giữ
 * `before` của lệnh đầu và `after` của lệnh cuối. Đó là lý do một mạch kéo rồi
 * `Ctrl+Z` một lần trả về đúng giá trị trước khi kéo.
 */
export function createPropertyInspectorDispatchDeps(
  options: CreatePropertyInspectorDispatchOptions,
): PropertyInspectorDispatchBundle {
  const history = options.history ?? createHistoryStack({ mergeWindowMs: MERGE_WINDOW_MS });
  let label = '';

  const deps: DispatchDeps = {
    spatial: createCommitSpatialPort(options.graph, () => label),
    history: {
      push: (entry) => {
        history.push({
          entry,
          selectionBefore: options.selectionBefore(),
          selectionAfter: options.selectionAfter(),
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

/** Chạy MỘT lệnh qua đủ năm bước. */
export async function runInspectorCommand(
  command: Command,
  bundle: PropertyInspectorDispatchBundle,
): Promise<DispatchResult> {
  bundle.setLabel(command.description);

  return dispatch(command, bundle.deps);
}

/** Vùng chọn rỗng, cho lượt ghi không có gì được chọn trước đó. */
export const PROPERTY_INSPECTOR_NO_SELECTION: SelectionSnapshot = NO_SELECTION;

/* -------------------------------------------------------------------------- */
/* Cái seam — khả năng, và những gì cổng KHÔNG làm được.                       */
/* -------------------------------------------------------------------------- */

/** Việc panel cần từ bên ngoài. Mỗi khoá là một khả năng, không có khả năng nào khác. */
export type PropertyInspectorCapability =
  | 'readSpatialLayer'
  | 'writeSpatialLayer'
  | 'persistProperties'
  | 'copyAsTemplate';

/** Kết quả của một khả năng có thể chưa có đường. */
export type PropertyInspectorCapabilityResult<TValue> =
  | { readonly ok: true; readonly data: TValue }
  | { readonly ok: false; readonly reason: string };

/**
 * Câu nói ra khi một khả năng chưa tồn tại ở bất cứ tầng nào.
 *
 * Câu chữ nói rõ đây là giới hạn của PHẦN MỀM, không phải vấn đề của bản vẽ:
 * panel hiện nó ở nhóm "Kiểm tra", nơi vốn dành cho vi phạm quy tắc, nên nếu
 * không nói rõ thì người dùng sẽ tưởng mô hình của họ có lỗi.
 */
export const COPY_AS_TEMPLATE_UNSUPPORTED_REASON =
  'Phần mềm chưa lưu được khuôn mẫu thuộc tính. Bản vẽ của bạn không có lỗi nào ở đây.';

/**
 * Câu nói ra khi lượt tự lưu không có đích để gửi tới.
 *
 * `FloorWriteBody` (`src/api/client.ts:87`) không có chỗ cho tường, ô mở, phòng
 * hay nội thất, nên không endpoint nào nhận được lớp không gian vừa sửa — cùng
 * lớp vấn đề với `persistWallLayer` (`wallLayerReviewGateway.ts:256`) và
 * `persistDimensionLayer`. Lượt lưu vì thế NÉM, và chỉ báo nói ra sự thật thay
 * vì hiện "Đã lưu lúc…" cho một thay đổi chưa rời khỏi máy này.
 */
export const PERSIST_PROPERTIES_UNSUPPORTED_REASON =
  'Chưa có đường lưu thuộc tính lên máy chủ, nên thay đổi mới chỉ nằm trên máy này.';

/** Mỗi phương thức là một việc panel cần từ bên ngoài, và không có việc nào khác. */
export interface PropertyInspectorGateway {
  /** Khả năng nào cổng này làm được, trả lời ĐỒNG BỘ — view phải biết trước lượt vẽ đầu. */
  readonly supports: Readonly<Record<PropertyInspectorCapability, boolean>>;
  /**
   * Lớp không gian của tầng, đọc BẤT ĐỒNG BỘ dưới khoá `queryKeys.space.byFloor`.
   *
   * Đây là nguồn của cờ tải và cờ hỏng (R-64) — `graph.read` bên dưới là lượt đọc
   * ĐỒNG BỘ của đồ thị đang sửa và nó không hỏng được (trả `null` khi kho trống),
   * nên nó không diễn tả được trạng thái tải. Cổng thật trả lại đúng đồ thị
   * `graph.read()` cho ra, không bịa một endpoint nào — cùng khuôn `readWallLayer`
   * của `wallLayerReviewGateway.ts:357`.
   */
  readonly readSpatialLayer: () => Promise<NormalizedSpatial | null>;
  /** Đồ thị đang sửa — nơi `commit` vừa ghi vào. */
  readonly graph: PropertyInspectorGraphPort;
  /** NOT FOUND — không endpoint nào nhận lớp không gian vừa sửa. */
  readonly persistProperties: () => PropertyInspectorCapabilityResult<void>;
  /** NOT FOUND — chưa có khái niệm khuôn mẫu thuộc tính ở bất cứ tầng nào. */
  readonly copyAsTemplate: () => PropertyInspectorCapabilityResult<void>;
  /** Ai đang thao tác — đi vào `Command.actorId` và nhật ký hoạt động. */
  readonly actorId: string;
}

/** Ai thao tác khi nơi gọi không nói. */
export const PROPERTY_INSPECTOR_DEFAULT_ACTOR_ID = 'property-inspector-editor';

export interface CreatePropertyInspectorGatewayOptions {
  /** Đồ thị đang sửa. Vắng mặt thì cổng đọc store thật. */
  readonly graph?: PropertyInspectorGraphPort;
  readonly actorId?: string;
}

/** Cổng thật — đọc store, ghi qua `dispatch`, và nói thật về việc chưa làm được. */
export function createPropertyInspectorGateway(
  options: CreatePropertyInspectorGatewayOptions,
): PropertyInspectorGateway {
  const graph = options.graph ?? { read: (): NormalizedSpatial | null => null };

  return {
    supports: {
      readSpatialLayer: true,
      writeSpatialLayer: true,
      persistProperties: false,
      copyAsTemplate: false,
    },
    readSpatialLayer: () => Promise.resolve(graph.read()),
    graph,
    persistProperties: () => ({ ok: false, reason: PERSIST_PROPERTIES_UNSUPPORTED_REASON }),
    copyAsTemplate: () => ({ ok: false, reason: COPY_AS_TEMPLATE_UNSUPPORTED_REASON }),
    actorId: options.actorId ?? PROPERTY_INSPECTOR_DEFAULT_ACTOR_ID,
  };
}
