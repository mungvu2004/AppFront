import type { RoomLabelStatus } from './roomLabelTypes';

/**
 * Bố cục L23 (đợt 6): phòng chưa duyệt chia theo lý do — chưa có tên trước, tên máy đề xuất sau.
 * Một thứ tự cho danh sách, thẻ hỏi (k trong N) và nút "Duyệt tiếp".
 */
export const ROOM_REASON_TITLE: Readonly<Record<Exclude<RoomLabelStatus, 'confirmed'>, string>> = {
  unnamed: 'Chưa có tên',
  suggested: 'Tên do máy đề xuất, cần xác nhận',
};

const RANK: Readonly<Record<RoomLabelStatus, number>> = { unnamed: 0, suggested: 1, confirmed: 2 };

/** Xếp ổn định: chưa có tên → máy đề xuất → đã duyệt. */
export const byRoomReason = <T extends { readonly status: RoomLabelStatus }>(rows: readonly T[]): readonly T[] =>
  [...rows].sort((a, b) => RANK[a.status] - RANK[b.status]);
