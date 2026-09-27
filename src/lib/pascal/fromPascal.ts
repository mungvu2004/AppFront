/**
 * Một lượt thay đổi trong Pascal thành **một lệnh** của AppFront.
 *
 * Đây là chỗ duy nhất mã Pascal chạm được vào bản vẽ, và nó cố ý đi qua đúng
 * con đường mọi công cụ khác đi: `createCommand` với ảnh chụp đầy đủ hai phía,
 * nên `Ctrl+Z` hoàn tác một lượt sửa trong Pascal y như hoàn tác một lượt kéo
 * tường (A8, A10). Không có đường tắt nào ghi thẳng vào store.
 *
 * ## Ba thứ file này từ chối làm
 *
 * - **Không ghi khi không có gì đổi.** Nạp một bản vẽ vào Pascal rồi đọc ngược
 *   ra phải cho **0** lệnh. Đó là phép so từng trường ở cuối file, và nó là
 *   hàng rào cuối cùng trước đồng hồ tự lưu.
 * - **Không tự đặt dấu xác minh.** Ảnh chụp "sau" lấy từ `toSpatialGraph`, và
 *   hàm đó chỉ trả dấu xác minh về cho node do chính AppFront viết ra (A5).
 * - **Không đoán loại.** Node Pascal thuộc loại AppFront không có thì lượt
 *   thay đổi bị từ chối kèm mã, chứ không bị lặng lẽ bỏ.
 *
 * Cổng lọc thay đổi ma (`guard.ts`) chạy **trước** file này. Hai thứ tách nhau
 * vì chúng trả lời hai câu khác nhau: cổng hỏi "lượt ghi này có thật không",
 * còn đây hỏi "lượt ghi thật ấy đổi những gì".
 */

import { readKindFromId, type EntityKind, type IdByKind } from '@/domain/spatial/ids';
import {
  isEntityOfKind,
  type EntityByKind,
  type NormalizedSpatial,
  type SpatialEntity,
} from '@/domain/spatial/normalize';
import {
  buildCommand,
  formatCount,
  type CommandContext,
  type CommandRefusal,
} from '@/lib/commands/business/shared';
import { changeForAdd, changeForRemove, changeForUpdate } from '@/lib/commands/createCommand';
import type { Command, EntityChange, EntityChangeOfKind } from '@/lib/commands/types';
import { err, ok, type Result } from '@/lib/http/types';

import { sameValue } from './diff';
import type { PascalCommit } from './guard';
import { appFrontIdOf, bodyOfPascalId } from './ids';
import { toSpatialGraph, type PascalIdBook } from './toSpatial';
import type { PascalNodeType, PascalScene } from './types';

/** Vì sao một lượt thay đổi của Pascal không thành lệnh được. */
export type PascalRefusalCode = 'PASCAL_NO_CHANGE' | 'PASCAL_UNKNOWN_NODE';

/**
 * Lời từ chối, mang thêm một mã máy đọc được.
 *
 * Mở rộng `CommandRefusal` chứ không dựng một hình dạng thứ hai: mọi nơi đang
 * nhận lời từ chối của tầng lệnh nhận được cái này mà không phải sửa gì.
 */
export interface PascalRefusal extends CommandRefusal {
  readonly code: PascalRefusalCode;
}

/** Lệnh dựng được, hoặc lý do không dựng được. */
export type PascalEditResult = Result<Command, PascalRefusal>;

/** Tên lệnh cho mọi thay đổi đến từ màn Pascal. */
export const PASCAL_COMMAND_TYPE = 'pascal.edit';

/** Mọi thứ cần để dựng một lệnh từ một lượt thay đổi. */
export interface PascalEditInput {
  /** Bản vẽ **trước** thay đổi; ảnh chụp "trước" lấy từ đây. */
  readonly graph: NormalizedSpatial;
  /** Cảnh Pascal **sau** thay đổi. */
  readonly scene: PascalScene;
  /** Node nào Pascal khai là đã đổi. */
  readonly commit: PascalCommit;
  readonly actorId: string;
  /** Sổ id của phiên, để đối tượng mới giữ nguyên id qua nhiều lượt sửa. */
  readonly idBook?: PascalIdBook;
  /** Chỉ dùng cho bài kiểm và lượt chạy lại. */
  readonly id?: CommandContext['id'];
  /** Chỉ dùng cho bài kiểm và lượt chạy lại. */
  readonly timestamp?: string;
}

/** Loại đối tượng AppFront ứng với từng loại node Pascal. */
const KIND_OF_NODE_TYPE: Readonly<Record<PascalNodeType, EntityKind | null>> = {
  site: null,
  building: null,
  level: 'level',
  wall: 'wall',
  door: 'opening',
  window: 'opening',
  zone: 'room',
  item: 'furniture',
};

/** Tên tiếng Việt của từng loại, cho câu mô tả trong nhật ký hoạt động. */
const KIND_LABELS: Readonly<Record<EntityKind, string>> = {
  level: 'tầng',
  wall: 'tường',
  opening: 'ô mở',
  furniture: 'đồ đạc',
  room: 'phòng',
  axis: 'trục định vị',
  dimension: 'kích thước',
};

/**
 * Loại đối tượng của một node đã đổi.
 *
 * Ba câu trả lời, và cả ba đều cần thiết: một loại đối tượng; `'structural'`
 * cho khu đất và công trình, hai node tổng hợp **không** có đối tượng tương
 * ứng và đổi chúng không phải là lỗi; `null` cho node không đọc nổi.
 */
const kindOfNode = (
  nodeId: string,
  scene: PascalScene,
  idBook: PascalIdBook,
): EntityKind | 'structural' | null => {
  const node = scene.nodes[nodeId];

  if (node !== undefined) {
    return KIND_OF_NODE_TYPE[node.type] ?? 'structural';
  }

  // Node đã bị xoá khỏi cảnh: loại đọc từ id, qua sổ id nếu nó do Pascal đẻ.
  const remembered = idBook.get(nodeId);

  return readKindFromId(remembered ?? bodyOfPascalId(nodeId));
};

/** Id AppFront của một node, dù node ấy do AppFront viết ra hay Pascal đẻ. */
const appFrontIdFor = <K extends EntityKind>(
  kind: K,
  nodeId: string,
  idBook: PascalIdBook,
): IdByKind[K] | null => {
  const direct = appFrontIdOf(kind, nodeId);

  if (direct !== null) {
    return direct;
  }

  // Id do `toSpatialGraph` vừa cấp trong chính lượt này; sổ id là chỗ nó ghi lại.
  const remembered = idBook.get(nodeId);

  return remembered !== undefined && readKindFromId(remembered) === kind
    ? (remembered as IdByKind[K])
    : null;
};

/** Thực thể đang có trong bản vẽ, hoặc `undefined`. */
const graphEntity = (graph: NormalizedSpatial, id: string): SpatialEntity | undefined =>
  graph.byId[id];

/**
 * Một thay đổi của một loại cụ thể, nhìn như một thay đổi bất kỳ.
 *
 * `EntityChangeOfKind<K>` và hợp `EntityChange` là **cùng một thứ** khi `K` đã
 * cụ thể, nhưng TypeScript không nối được hai phép truy chỉ số trong khi `K`
 * còn là tham số kiểu. Đây đúng là hạn chế mà `createCommand.ts` đã ghi lại ở
 * `idOfEntity`, và cách chữa cũng vậy: khẳng định lại đúng một lần, ở một chỗ.
 */
const asChange = <K extends EntityKind>(change: EntityChangeOfKind<K>): EntityChange =>
  change as EntityChange;

/**
 * Siêu dữ liệu duyệt của bản CŨ, áp lên bản mới — hàng rào cuối của A5.
 *
 * `toSpatialGraph` đã chặn node Pascal tự đẻ mang dấu xác minh về. Còn một lỗ
 * nhỏ hơn: một đối tượng **cũ** của AppFront đi sang Pascal mang theo
 * `metadata.appfront`, và bên kia tường sửa được túi siêu dữ liệu ấy. Sửa
 * `reviewed` thành `true` là đủ để một bức tường chưa ai duyệt về với dấu xanh.
 *
 * Đường ghi duy nhất vào bản vẽ là lệnh, nên hàng rào đặt ở đây: với một lượt
 * **sửa**, ba trường duyệt luôn lấy từ ảnh chụp "trước". Đây cũng đúng lời
 * `commands/business/shared.ts` đã ghi — "một lượt sửa mang theo siêu dữ liệu
 * nó tìm thấy" — nên Pascal đổi được hình học, không đổi được phán quyết của
 * người duyệt.
 */
const withReviewOfPrevious = <K extends EntityKind>(
  before: EntityByKind[K],
  after: EntityByKind[K],
): EntityByKind[K] => ({
  ...after,
  confidence: before.confidence,
  source: before.source,
  reviewed: before.reviewed,
});

/** Một thay đổi của đúng một thực thể, hoặc `null` khi thực thể không đổi. */
const changeBetween = <K extends EntityKind>(
  kind: K,
  before: SpatialEntity | undefined,
  after: SpatialEntity | undefined,
): EntityChange | null => {
  const from = before !== undefined && isEntityOfKind(kind, before) ? before : null;
  const to = after !== undefined && isEntityOfKind(kind, after) ? after : null;

  if (from === null) {
    return to === null ? null : asChange(changeForAdd(kind, to));
  }

  if (to === null) {
    return asChange(changeForRemove(kind, from));
  }

  const settled = withReviewOfPrevious<K>(from, to);

  return sameValue(from, settled) ? null : asChange(changeForUpdate(kind, from, settled));
};

/** Câu mô tả cho nhật ký hoạt động: đếm theo việc, rồi đếm theo loại. */
const describe = (changes: readonly EntityChange[]): string => {
  const countOf = new Map<string, number>();

  for (const change of changes) {
    const verb = change.before === null ? 'thêm' : change.after === null ? 'xoá' : 'sửa';
    const key = `${verb} ${KIND_LABELS[change.kind]}`;

    countOf.set(key, (countOf.get(key) ?? 0) + 1);
  }

  const parts = [...countOf].map(([key, count]) => `${key} ${formatCount(count)}`);

  return `Từ màn Pascal: ${parts.join(', ')}.`;
};

/**
 * Dựng lệnh cho một lượt thay đổi của Pascal.
 *
 * Trả lời từ chối khi lượt ấy không đổi gì (`PASCAL_NO_CHANGE`) hoặc khi nó
 * nhắc tới một node không quy được về loại đối tượng nào của bản vẽ
 * (`PASCAL_UNKNOWN_NODE`). Cả hai đều là lời từ chối **bình thường**, không
 * phải lỗi: lượt nạp đầu tiên gần như luôn rơi vào trường hợp thứ nhất.
 */
export const createPascalEditCommand = (input: PascalEditInput): PascalEditResult => {
  // Luôn có một sổ id, kể cả khi người gọi không giữ sổ nào: đối tượng Pascal
  // vừa vẽ được cấp id **trong** lượt đổi dưới đây, và không có sổ thì lượt
  // này không tìm lại được id vừa cấp — đối tượng mới sẽ lặng lẽ không vào lệnh.
  const idBook: PascalIdBook = input.idBook ?? new Map();
  const { graph: after } = toSpatialGraph(input.scene, idBook);
  const afterById = new Map<string, SpatialEntity>();

  for (const entity of [
    ...after.levels,
    ...after.walls,
    ...after.openings,
    ...after.furniture,
    ...after.rooms,
  ]) {
    afterById.set(entity.id, entity);
  }

  const changes: EntityChange[] = [];
  const unknown: string[] = [];
  const seen = new Set<string>();

  for (const nodeId of input.commit.changedNodeIds) {
    const kind = kindOfNode(nodeId, input.scene, idBook);

    if (kind === null) {
      unknown.push(nodeId);
      continue;
    }

    if (kind === 'structural') {
      continue;
    }

    const entityId = appFrontIdFor(kind, nodeId, idBook);

    if (entityId === null || seen.has(entityId)) {
      continue;
    }

    seen.add(entityId);

    const change = changeBetween(kind, graphEntity(input.graph, entityId), afterById.get(entityId));

    if (change !== null) {
      changes.push(change);
    }
  }

  if (unknown.length > 0) {
    return err({
      type: PASCAL_COMMAND_TYPE,
      code: 'PASCAL_UNKNOWN_NODE',
      reasons: [
        `Pascal báo ${formatCount(unknown.length)} đối tượng không quy được về loại nào của bản vẽ, nên thay đổi này bị từ chối.`,
      ],
    });
  }

  if (changes.length === 0) {
    return err({
      type: PASCAL_COMMAND_TYPE,
      code: 'PASCAL_NO_CHANGE',
      reasons: ['Thay đổi này không làm bản vẽ khác đi nên không có gì để ghi.'],
    });
  }

  const context: CommandContext = {
    graph: input.graph,
    actorId: input.actorId,
    ...(input.id === undefined ? {} : { id: input.id }),
    ...(input.timestamp === undefined ? {} : { timestamp: input.timestamp }),
  };

  return ok(buildCommand(PASCAL_COMMAND_TYPE, describe(changes), changes, context));
};

