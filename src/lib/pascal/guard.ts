/**
 * Cổng lọc "thay đổi ma" — thứ đứng giữa Pascal và đồng hồ tự lưu.
 *
 * ## Vì sao cổng này tồn tại
 *
 * Đợt đo trước thấy Pascal phát ra một lượt ghi **ngay sau khi nạp cảnh**, mang
 * `origin: 'local'` — tức trông y hệt một thao tác của người dùng — trong khi
 * người dùng chưa chạm vào gì. Nối thẳng lượt ghi ấy vào `dispatch` là nối vào
 * đồng hồ tự lưu 800 ms của A7, và một bản vẽ vừa mở đã bị ghi đè bằng phiên
 * bản Pascal vừa dựng lại. Không có nút lưu để người dùng dừng tay (A7), nên
 * cổng này là chỗ duy nhất chặn được.
 *
 * ## Vì sao KHÔNG chặn bằng mốc giờ
 *
 * Biên đo được giữa lượt nạp và lượt ghi ma là **193 ms**. Lấy nó làm luật là
 * lấy tốc độ của một cái máy làm hợp đồng: máy chậm hơn thì cửa sổ ấy trượt và
 * lượt ghi ma lọt qua, máy nhanh hơn thì thao tác thật đầu tiên của người dùng
 * bị nuốt. Bốn luật dưới đây đều là **bất biến về trạng thái**, không có con
 * số thời gian nào.
 *
 * | Mã | Luật |
 * |---|---|
 * | `PASCAL_BEFORE_LOAD` | Chưa xác nhận nạp xong lần đầu thì không lượt ghi nào được qua |
 * | `PASCAL_WHILE_LOADING` | Đang nạp thì không lượt ghi nào được qua |
 * | `PASCAL_EMPTY_COMMIT` | Lượt ghi không nêu được node nào đã đổi thì không có gì để ghi |
 * | `PASCAL_MASS_DELETE` | Xoá từ một phần năm số đối tượng của một tầng trở lên |
 *
 * `PASCAL_MASS_DELETE` **không** nói "đây là thay đổi ma". Nó nói "việc này
 * lớn quá để đi im lặng": A9 đòi hành động không hoàn tác được phải hỏi trước,
 * nên màn hình bắt mã này rồi mở hộp thoại, chứ không nuốt lượt ghi.
 */

import type { PascalNode, PascalNodeId, PascalScene } from './types';

/** Ngưỡng xoá hàng loạt: một phần năm số đối tượng của một tầng. */
export const MASS_DELETE_RATIO = 0.2;

/** Vì sao một lượt ghi bị chặn. Mã lỗi viết hoa — ngoại lệ chữ hoa của A6. */
export type GateRejectionCode =
  | 'PASCAL_BEFORE_LOAD'
  | 'PASCAL_WHILE_LOADING'
  | 'PASCAL_EMPTY_COMMIT'
  | 'PASCAL_MASS_DELETE';

/** Một lượt ghi Pascal báo lên, đúng phần cổng này cần đọc. */
export interface PascalCommit {
  /** Pascal tự khai: `local` là do thao tác trong cảnh, `load` là do nạp. */
  readonly origin: string;
  /** Node đã đổi. Rỗng nghĩa là không có gì để ghi. */
  readonly changedNodeIds: readonly PascalNodeId[];
  /** Node bị xoá; luôn là tập con của `changedNodeIds` khi Pascal khai đủ. */
  readonly removedNodeIds?: readonly PascalNodeId[];
}

/** Lượt ghi được qua, hoặc bị chặn kèm mã và một câu tiếng Việt. */
export type GateVerdict =
  | { readonly admitted: true }
  | { readonly admitted: false; readonly code: GateRejectionCode; readonly reason: string };

/** Cổng cho một phiên gắn Pascal. Một màn hình dựng đúng một cái. */
export interface ChangeGate {
  /** Bắt đầu đẩy một cảnh sang Pascal. */
  beginLoad: () => void;
  /** Pascal xác nhận đã nạp xong; từ đây lượt ghi mới được xét. */
  acknowledgeLoad: () => void;
  /** Đã qua lần nạp đầu tiên chưa — để màn hình biết mình đang ở đâu. */
  hasLoaded: () => boolean;
  /** Xét một lượt ghi trên cảnh **hiện có**, tức cảnh trước khi ghi. */
  admit: (commit: PascalCommit, scene: PascalScene) => GateVerdict;
}

const ADMITTED: GateVerdict = { admitted: true };

const reject = (code: GateRejectionCode, reason: string): GateVerdict => ({
  admitted: false,
  code,
  reason,
});

const childIdsOf = (node: PascalNode): readonly PascalNodeId[] =>
  'children' in node ? node.children : [];

/**
 * Mọi node nằm dưới một node, kể cả cháu chắt, **không** kể chính nó.
 *
 * Đếm cả cháu là cố ý: một cửa đi là con của tường, và xoá nguyên một tường
 * mang theo mọi ô mở trên nó. Đếm thiếu chúng là đánh giá thấp sức tàn phá của
 * một lượt xoá.
 */
const descendantsOf = (scene: PascalScene, rootId: PascalNodeId): Set<PascalNodeId> => {
  const found = new Set<PascalNodeId>();
  const queue = [...childIdsOf(scene.nodes[rootId] ?? { children: [] } as unknown as PascalNode)];

  while (queue.length > 0) {
    const nodeId = queue.pop();

    if (nodeId === undefined || found.has(nodeId)) {
      continue;
    }

    found.add(nodeId);

    const node = scene.nodes[nodeId];

    if (node !== undefined) {
      queue.push(...childIdsOf(node));
    }
  }

  return found;
};

/** Mọi tầng của cảnh, kèm tập node nằm dưới nó. */
const levelSubtreesOf = (scene: PascalScene): ReadonlyMap<PascalNodeId, Set<PascalNodeId>> => {
  const subtrees = new Map<PascalNodeId, Set<PascalNodeId>>();

  for (const node of Object.values(scene.nodes)) {
    if (node.type === 'level') {
      subtrees.set(node.id, descendantsOf(scene, node.id));
    }
  }

  return subtrees;
};

/**
 * Tầng đầu tiên mà lượt xoá này cắt vào từ một phần năm số đối tượng trở lên.
 *
 * Trả `null` khi không tầng nào chạm ngưỡng — kể cả khi lượt xoá rỗng.
 */
const levelCutTooDeep = (
  scene: PascalScene,
  removedNodeIds: readonly PascalNodeId[],
): { levelId: PascalNodeId; removed: number; total: number } | null => {
  if (removedNodeIds.length === 0) {
    return null;
  }

  const removed = new Set(removedNodeIds);

  for (const [levelId, subtree] of levelSubtreesOf(scene)) {
    if (subtree.size === 0) {
      continue;
    }

    let hit = 0;

    for (const nodeId of removed) {
      if (subtree.has(nodeId)) {
        hit += 1;
      }
    }

    if (hit > 0 && hit / subtree.size >= MASS_DELETE_RATIO) {
      return { levelId, removed: hit, total: subtree.size };
    }
  }

  return null;
};

/**
 * Dựng một cổng mới, ở trạng thái "chưa nạp lần nào".
 *
 * Trạng thái nằm trong closure chứ không phải trong store: cổng thuộc về một
 * lượt gắn Pascal, sống và chết cùng nó, và không màn nào khác đọc nó.
 */
export const createChangeGate = (): ChangeGate => {
  let loading = false;
  let loaded = false;

  return {
    beginLoad: (): void => {
      loading = true;
    },

    acknowledgeLoad: (): void => {
      loading = false;
      loaded = true;
    },

    hasLoaded: (): boolean => loaded,

    admit: (commit: PascalCommit, scene: PascalScene): GateVerdict => {
      if (!loaded) {
        return reject(
          'PASCAL_BEFORE_LOAD',
          'Bỏ qua một thay đổi đến trước khi bản vẽ được nạp xong lần đầu.',
        );
      }

      if (loading) {
        return reject('PASCAL_WHILE_LOADING', 'Bỏ qua một thay đổi đến trong lúc đang nạp lại bản vẽ.');
      }

      if (commit.changedNodeIds.length === 0) {
        return reject('PASCAL_EMPTY_COMMIT', 'Bỏ qua một thay đổi không nêu được đối tượng nào.');
      }

      const cut = levelCutTooDeep(scene, commit.removedNodeIds ?? []);

      if (cut !== null) {
        return reject(
          'PASCAL_MASS_DELETE',
          `Thay đổi này xoá ${String(cut.removed)} trong ${String(cut.total)} đối tượng của một tầng nên phải được xác nhận trước.`,
        );
      }

      return ADMITTED;
    },
  };
};
