import { useSyncExternalStore } from 'react';

import { WifiOff } from 'lucide-react';

import { getPendingEdits, subscribePendingEdits } from '@/lib/autosave/pendingEdits';

const subscribeOnline = (listener: () => void): (() => void) => {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);

  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
};

const isOffline = (): boolean => typeof navigator !== 'undefined' && navigator.onLine === false;

/** Câu của dải: có số thao tác chờ thì nói số, không thì nói thay đổi sẽ tự lưu. */
export function offlineBannerText(pending: number): string {
  return pending > 0 ? `Mất mạng · ${pending} thao tác đang chờ gửi` : 'Mất mạng · Thay đổi sẽ tự lưu khi có mạng lại';
}

/**
 * UX-40: mất mạng là một dải rõ ở mép trên vùng làm việc, kèm số thao tác đang chờ gửi —
 * không chỉ là chữ nhỏ trên thanh trạng thái. `fixed` để màn không tụt xuống (BUG-019).
 */
export function OfflineBanner() {
  const offline = useSyncExternalStore(subscribeOnline, isOffline, () => false);
  const pending = useSyncExternalStore(subscribePendingEdits, getPendingEdits, getPendingEdits);

  if (!offline) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-16 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-2 rounded-lg border border-state-attention bg-state-attention-tint px-3 py-2 shadow-float"
      role="status"
    >
      <WifiOff aria-hidden="true" className="shrink-0 text-state-attention" size={16} />
      <p className="min-w-0 flex-1 text-[14px] font-medium leading-5 text-state-attention-text">{offlineBannerText(pending)}</p>
    </div>
  );
}
