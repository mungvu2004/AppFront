/**
 * Dải tỷ lệ tạm (F-04x-2) — dùng chung cho bốn màn QC. View thuần: câu và lối
 * ra đến từ `useProvisionalScaleNotice`. Canvas vẫn vẽ bằng tỷ lệ tạm.
 *
 * Gọn một dòng (G4a-01) và ẩn được: bấm X thì tầng đó không hiện lại trong phiên
 * (sessionStorage, khoá theo tầng). Không có `onCalibrate` (người xem) thì không có nút (G2-22).
 * Tầng không đo được tỷ lệ (`level: 'violation'`) thì dải đỏ và không ẩn được (UX-R1 K12), và
 * KHÔNG có nút: cổng tầng (`FloorReviewGate`, có ở mọi màn dùng dải này) đã là nút "Đặt tỷ lệ" —
 * một màn chỉ một nút cho một việc (UX-R2).
 */

import { useState } from 'react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { SCALE_STATE_VIEWS } from '@/lib/viewmodel/provisionalScale';

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

  if (notice === null) {
    return null;
  }

  const { dismissKey, onCalibrate } = notice;
  const missing = notice.level === 'violation';

  if (!missing && (dismissed.has(dismissKey) || readDismissed(dismissKey))) {
    return null;
  }

  return (
    <InlineAlert
      {...(onCalibrate === undefined || missing ? {} : { action: { label: SCALE_STATE_VIEWS.missing.action, onClick: onCalibrate } })}
      className="items-center gap-y-1 px-3 py-1.5 [&_p]:leading-snug"
      level={missing ? 'violation' : 'attention'}
      message={notice.message}
      {...(missing
        ? {}
        : {
            onDismiss: () => {
              writeDismissed(dismissKey);
              setDismissed((prev) => new Set(prev).add(dismissKey));
            },
          })}
    />
  );
}
