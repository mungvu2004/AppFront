import type { ViewStatusCode } from '@/lib/viewmodel/types';

import type { WallRowViewModel } from './types';

/**
 * V-06: tam giác chỉ khi thật cần (tin cậy thấp hoặc độ dày ngoài chuẩn). Tường AI
 * chưa duyệt mà không có lý do nào → chấm trung tính, để cảnh báo còn hiếm.
 */
export function displayStatusCode(
  row: Pick<WallRowViewModel, 'statusCode' | 'isLowConfidence' | 'isNonStandardThickness'>,
): ViewStatusCode {
  if (row.statusCode === 'attention' && !row.isLowConfidence && !row.isNonStandardThickness) {
    return 'neutral';
  }
  return row.statusCode;
}
