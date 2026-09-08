/**
 * Cặp phiên bản đang được so, và dải tab của vùng so sánh. Không có React.
 *
 * Tách khỏi `useVersionHistory.ts` vì R-22. Mọi thứ ở đây là hàm thuần trên một cặp mã
 * phiên bản: chọn cặp mặc định, giữ đúng chiều cũ-mới, bật/tắt một bản trong cặp.
 *
 * Chiều của cặp là điều quan trọng nhất trong file này. `gateway.diff(left, right)` gọi
 * thẳng `diffVersions(previous, next)`, nên **bên trái phải là bản CŨ**; đảo hai bên
 * thì "thêm" đọc thành "xoá" và cả màn nói ngược.
 */

import type { VersionHistoryEntry } from '@/lib/versioning/restore';

import type { VersionHistoryOption } from './types';

/* -------------------------------------------------------------------------- */
/* 1 — Dải tab                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Ba tab, đúng thứ tự đặc tả đòi: câu tiếng thường đứng TRƯỚC JSON thô.
 *
 * "JSON" giữ chữ hoa vì nó là một tên riêng viết tắt — đúng ngoại lệ của A6, cùng loại
 * với mã trục và tên phím.
 */
export const COMPARE_TABS: readonly VersionHistoryOption[] = Object.freeze([
  { id: 'changes', label: 'thay đổi' },
  { id: 'json', label: 'JSON' },
  { id: 'visual', label: 'trực quan' },
]);

/** Trạng thái 1: chỉ có một phiên bản. Một câu dạy việc, không phải một lỗi. */
export const TEACHING_SENTENCE =
  'mới có một phiên bản nên chưa có gì để so sánh — mỗi lần bạn sửa bản vẽ, hệ thống tự lưu thêm một phiên bản vào đây';

/** Lượt so lọt qua được khi chưa đủ hai bản thì phải nói ra, không im lặng trả rỗng. */
export const NO_COMPARE_PAIR_REASON = 'chưa chọn đủ hai phiên bản để so sánh';

/* -------------------------------------------------------------------------- */
/* 2 — Cặp                                                                    */
/* -------------------------------------------------------------------------- */

export interface VersionPair {
  /** Bản CŨ hơn. */
  readonly left: string | null;
  /** Bản MỚI hơn. */
  readonly right: string | null;
}

/** Chưa chọn gì. */
export const NO_PAIR: VersionPair = Object.freeze({ left: null, right: null });

/**
 * Cặp mặc định: hai bản ĐẦY ĐỦ mới nhất, bản cũ hơn ở bên trái.
 *
 * Bỏ qua mục chỉ còn siêu dữ liệu: `gateway.diff` ném `SNAPSHOT_MISSING_REASON` khi
 * chạm vào chúng, nên mở màn ra bằng một cặp không so được là mở ra bằng một lỗi.
 */
export function defaultPairOf(history: readonly VersionHistoryEntry[]): VersionPair {
  const full = history.filter((entry) => entry.kind === 'full');
  const newer = full[0];
  const older = full[1];

  if (newer === undefined || older === undefined) {
    return NO_PAIR;
  }

  return { left: older.version.id, right: newer.version.id };
}

/** Xếp lại một cặp theo `sequence` để bản cũ luôn ở bên trái. */
export function orderPair(
  pair: VersionPair,
  history: readonly VersionHistoryEntry[],
): VersionPair {
  if (pair.left === null || pair.right === null) {
    return pair;
  }

  const sequenceOf = (id: string): number =>
    history.find((entry) => entry.version.id === id)?.version.sequence ?? 0;

  return sequenceOf(pair.left) <= sequenceOf(pair.right)
    ? pair
    : { left: pair.right, right: pair.left };
}

/**
 * Bật/tắt một phiên bản trong cặp đang so.
 *
 * Đã chọn đủ hai bản thì lượt bấm thứ ba KHÔNG làm gì — `isPickable` của hàng đã tắt ô
 * tích trước đó, và một lượt bấm lọt qua được không được phép lặng lẽ thay bản khác ra.
 */
export function togglePick(pair: VersionPair, versionId: string): VersionPair {
  if (pair.left === versionId) {
    return { ...pair, left: null };
  }
  if (pair.right === versionId) {
    return { ...pair, right: null };
  }
  if (pair.left === null) {
    return { ...pair, left: versionId };
  }
  if (pair.right === null) {
    return { ...pair, right: versionId };
  }

  return pair;
}
