/**
 * Dải tỷ lệ tạm (F-04x-2) — dùng chung cho bốn màn QC. View thuần: câu và lối
 * ra đến từ `useProvisionalScaleNotice`. Canvas vẫn vẽ bằng tỷ lệ tạm.
 *
 * Gọn một dòng (G4a-01) và ẩn được: bấm X thì tầng đó không hiện lại trong phiên
 * (sessionStorage, khoá theo tầng). Không có `onCalibrate` (người xem) thì không có nút (G2-22).
 */

import { useState } from 'react';

import { InlineAlert } from '@/components/feedback/InlineAlert';

import type { ProvisionalScaleNotice } from './provisionalScaleNotice';

export interface ProvisionalScaleBannerProps {
  readonly notice: ProvisionalScaleNotice | null;
}

const DISMISS_PREFIX = 'provisional-scale-dismissed:';

function readDismissed(key: string): boolean {
  try {
    return sessionStorage.getItem(DISMISS_PREFIX + key) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(key: string): void {
  try {
    sessionStorage.setItem(DISMISS_PREFIX + key, '1');
  } catch {
    /* Không lưu được thì chỉ ẩn trong lần mở này. */
  }
}

export function ProvisionalScaleBanner({ notice }: ProvisionalScaleBannerProps) {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());

  if (notice === null || dismissed.has(notice.dismissKey) || readDismissed(notice.dismissKey)) {
    return null;
  }

  const { dismissKey, onCalibrate } = notice;

  return (
    <InlineAlert
      {...(onCalibrate === undefined ? {} : { action: { label: 'Đặt tỷ lệ', onClick: onCalibrate } })}
      className="items-center gap-y-1 px-3 py-1.5 [&_p]:leading-snug"
      level="attention"
      message={notice.message}
      onDismiss={() => {
        writeDismissed(dismissKey);
        setDismissed((prev) => new Set(prev).add(dismissKey));
      }}
    />
  );
}
