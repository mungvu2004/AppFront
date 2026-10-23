import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';

import { PendingShell } from './SessionBootstrap';

/** Sau chừng này mà màn vẫn chưa lên (chunk hoặc API treo/đang thử lại) thì hiện lối thoát. */
export const SLOW_PENDING_MS = 15_000;

/**
 * Vỏ chờ của route lười, kèm nút "Tải lại trang" khi chờ quá lâu để không treo mãi
 * ở "Đang tải màn hình…". Hết hạn chờ thì nút nằm cạnh vỏ chờ, không thay nó.
 */
export function SlowPendingShell({ label }: { label: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_PENDING_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <PendingShell label={label} />
      {slow && (
        <div
          role="alert"
          className="fixed inset-x-0 bottom-10 mx-auto flex w-fit max-w-md flex-col items-center gap-2 rounded-lg border border-border-control bg-bg-surface p-4 text-center"
        >
          <p className="text-body text-text-primary">Màn hình này tải lâu hơn bình thường.</p>
          <Button variant="secondary" onClick={() => globalThis.location.reload()}>
            Tải lại trang
          </Button>
        </div>
      )}
    </>
  );
}
