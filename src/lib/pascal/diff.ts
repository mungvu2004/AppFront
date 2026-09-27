/**
 * Phần chênh giữa hai cảnh Pascal — thứ đẩy sang `applyDiff` của `mount()`.
 *
 * Ba lúc cần nó, và cả ba đều là "bản vẽ đổi mà **không** do Pascal đổi":
 * hoàn tác một lệnh (A8), máy chủ trả về dữ liệu mới, và một màn khác sửa cùng
 * dự án. Ba lúc ấy không được nạp lại cả cảnh: nạp lại là mất lựa chọn đang
 * chọn, mất góc nhìn, và — theo `guard.ts` — mở thêm một cửa cho lượt ghi ma.
 *
 * Phép so là **so giá trị**, không so tham chiếu: `toPascalScene` dựng node
 * mới mỗi lượt, nên so tham chiếu sẽ báo cả nghìn node đều đổi.
 *
 * Thứ tự trong `upsert` được xếp theo **độ sâu trong cây**: khu đất trước
 * công trình, công trình trước tầng, tầng trước tường, tường trước ô mở. Một
 * đứa con tới trước cha nó là một node treo lơ lửng trong cảnh cho tới khi cha
 * nó tới — và nếu lượt áp bị chặn giữa đường thì nó treo mãi.
 */

import type { PascalNode, PascalNodeId, PascalNodeType, PascalScene } from './types';

/**
 * So hai giá trị JSON, không quan tâm thứ tự khoá.
 *
 * Dữ liệu ở hai đầu là JSON thuần, và bản đến từ máy chủ có thể xếp khoá khác
 * bản vừa dựng trong bộ nhớ. So bằng `JSON.stringify` sẽ báo khác nhau ở hai
 * bản y hệt — và với `diff` thì đó là cả một cảnh bị đẩy lại mỗi lượt.
 */
export const sameValue = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => sameValue(item, right[index]))
    );
  }

  if (typeof left !== 'object' || typeof right !== 'object' || left === null || right === null) {
    return false;
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => sameValue(Reflect.get(left, key), Reflect.get(right, key)))
  );
};

/** Phần chênh cần áp để cảnh cũ thành cảnh mới. */
export interface PascalSceneDiff {
  /** Node phải thêm hoặc ghi lại, đã xếp theo độ sâu trong cây. */
  readonly upsert: readonly PascalNode[];
  /** Node phải xoá. */
  readonly remove: readonly PascalNodeId[];
  /** Danh sách gốc mới, chỉ có mặt khi nó thật sự đổi. */
  readonly rootNodeIds?: readonly PascalNodeId[];
}

/** Độ sâu của từng loại node trong cây; số nhỏ đi trước. */
const DEPTH_OF_TYPE: Readonly<Record<PascalNodeType, number>> = {
  site: 0,
  building: 1,
  level: 2,
  wall: 3,
  zone: 3,
  item: 3,
  door: 4,
  window: 4,
};

/** Phần chênh rỗng — không có gì để áp. */
export const isEmptyDiff = (diff: PascalSceneDiff): boolean =>
  diff.upsert.length === 0 && diff.remove.length === 0 && diff.rootNodeIds === undefined;

/**
 * Tính phần chênh từ cảnh `previous` sang cảnh `next`.
 *
 * Hai cảnh y hệt cho một phần chênh rỗng — đó là điều kiện để lượt nạp lại
 * không sinh ra thay đổi nào, và là thứ bài kiểm "0 thay đổi tự sinh" đo.
 */
export const diffScenes = (previous: PascalScene, next: PascalScene): PascalSceneDiff => {
  const upsert: PascalNode[] = [];
  const remove: PascalNodeId[] = [];

  for (const [nodeId, node] of Object.entries(next.nodes)) {
    const before = previous.nodes[nodeId];

    if (before === undefined || !sameValue(before, node)) {
      upsert.push(node);
    }
  }

  for (const nodeId of Object.keys(previous.nodes)) {
    if (next.nodes[nodeId] === undefined) {
      remove.push(nodeId);
    }
  }

  upsert.sort((left, right) => DEPTH_OF_TYPE[left.type] - DEPTH_OF_TYPE[right.type]);

  return {
    upsert,
    remove,
    ...(sameValue(previous.rootNodeIds, next.rootNodeIds) ? {} : { rootNodeIds: next.rootNodeIds }),
  };
};
