/**
 * Phiên bản dữ liệu của đồ thị trong kho, dẫn xuất từ `revision` từng tầng (F-04x-2).
 *
 * Đây KHÔNG phải mã phiên bản của máy chủ: khác `ver_…` (một bản ghi lịch sử, N18)
 * và `mdl_…` (một bản model của chuỗi xử lý, N24). Nó chỉ trả lời "kho đang giữ
 * đồ thị ở đúng bộ `revision` nào", nên hai kho cùng bộ `revision` ra cùng chuỗi.
 *
 * Cách tính: sắp `floorId` theo đơn vị mã UTF-16 (`a < b`, không `localeCompare` —
 * thứ tự không được đổi theo ngôn ngữ máy), nối `floorId:revision` bằng `\n`, rồi
 * băm FNV-1a 32 bit hai lượt với hai hạt khác nhau → 16 ký tự hex.
 */

const FNV_PRIME = 0x01000193;
const FIRST_SEED = 0x811c9dc5;
const SECOND_SEED = 0x050c5d1f;

const fnv1a = (text: string, seed: number): string => {
  let hash = seed;

  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), FNV_PRIME);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
};

export interface GraphRevisionEntry {
  readonly revision: number;
}

export function graphVersionOf(meta: Readonly<Record<string, GraphRevisionEntry>>): string {
  const text = Object.keys(meta)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((floorId) => `${floorId}:${String(meta[floorId]?.revision)}`)
    .join('\n');

  return fnv1a(text, FIRST_SEED) + fnv1a(text, SECOND_SEED);
}
