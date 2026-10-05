/**
 * Dải tỉ lệ tạm (F-04x-2) — dùng chung cho bốn màn QC. View thuần: câu và lối
 * ra đến từ `useProvisionalScaleNotice`. Canvas vẫn vẽ bằng tỉ lệ tạm.
 */

import { InlineAlert } from '@/components/feedback/InlineAlert';

import type { ProvisionalScaleNotice } from './provisionalScaleNotice';

export interface ProvisionalScaleBannerProps {
  readonly notice: ProvisionalScaleNotice | null;
}

export function ProvisionalScaleBanner({ notice }: ProvisionalScaleBannerProps) {
  if (notice === null) {
    return null;
  }

  return (
    <InlineAlert
      action={{ label: 'Hiệu chỉnh tỉ lệ', onClick: notice.onCalibrate }}
      level="attention"
      message={notice.message}
    />
  );
}
