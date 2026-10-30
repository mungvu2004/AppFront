export const SHARE_LINK_GONE_MESSAGE = 'Liên kết không còn hiệu lực';

export function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 404;
}

/**
 * U59: 404 của máy chủ có thể kèm `reason: "revoked" | "expired"` (thân lỗi, `raw`). Có thì nói đúng
 * lý do; vắng (token lạ, hoặc máy chủ cũ) thì giữ câu gộp.
 */
export function shareGoneReason(error: unknown): string {
  const raw = typeof error === 'object' && error !== null && 'raw' in error ? error.raw : null;
  const reason = typeof raw === 'object' && raw !== null && 'reason' in raw ? raw.reason : null;
  if (reason === 'revoked') {
    return 'Người chia sẻ đã thu hồi liên kết này. Hãy xin họ một liên kết mới nếu vẫn cần xem.';
  }
  if (reason === 'expired') {
    return 'Liên kết đã hết hạn. Hãy xin người chia sẻ một liên kết mới.';
  }
  return 'Liên kết đã hết hạn, đã bị thu hồi hoặc không đúng. Hãy xin người chia sẻ một liên kết mới.';
}
