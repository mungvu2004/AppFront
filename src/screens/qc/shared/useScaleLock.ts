import { SCALE_LOCK_REASON } from './floorReviewGateModel';
import { useFloorReview } from './useFloorReview';

export interface ScaleLock {
  readonly locked: boolean;
  /** Câu nói vì sao khoá (cùng câu với thanh bước và cổng); `null` khi không khoá. */
  readonly reason: string | null;
}

/**
 * Khoá thao tác dựa vào số đo khi tầng chưa có tỷ lệ đúng: máy không đo được, hoặc đo ra hình vô lý
 * (cùng nguồn `useFloorReview` với thanh bước và cổng). Chưa đọc được tỷ lệ thì không khoá.
 */
export function useScaleLock(projectId: string, floorId: string): ScaleLock {
  const { scale } = useFloorReview(projectId, floorId);
  return scale === 'missing' ? { locked: true, reason: SCALE_LOCK_REASON } : { locked: false, reason: null };
}
