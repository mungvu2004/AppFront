/**
 * Bố cục L23 (đợt 5): lý do máy nghi một cửa / món nội thất chưa duyệt, đọc từ cờ sẵn có của hàng
 * (`isLowConfidence`, `isOrphan`). Một thứ tự cho danh sách, thẻ hỏi (k trong N) và phím J.
 */
export type ObjectReviewReason = 'uncertain' | 'orphan';

export const OBJECT_REASON_TITLE: Readonly<Record<ObjectReviewReason, string>> = {
  uncertain: 'Máy chưa chắc loại',
  orphan: 'Chưa gắn vào tường',
};

interface ReasonFlags {
  readonly isReviewed: boolean;
  readonly isLowConfidence: boolean;
  readonly isOrphan: boolean;
}

export const objectReasonOf = (row: ReasonFlags): ObjectReviewReason | null =>
  row.isReviewed ? null : row.isLowConfidence ? 'uncertain' : row.isOrphan ? 'orphan' : null;

/** Hạng trong hàng đợi: chưa chắc → chưa gắn → không lý do → đã duyệt. */
export const objectReasonRank = (row: ReasonFlags): number => {
  if (row.isReviewed) return 3;
  const reason = objectReasonOf(row);
  return reason === 'uncertain' ? 0 : reason === 'orphan' ? 1 : 2;
};
