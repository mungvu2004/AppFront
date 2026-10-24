import { useCallback, useRef, useState } from 'react';

import { WifiOff, X } from 'lucide-react';

import { Button } from '@/components/ui/Button';

/** Phần tử Tab dừng được — để tìm chỗ đầu tiên của màn con khi tiêu điểm không có chỗ về. */
const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Chỗ tiêu điểm về khi gỡ dải mà không biết nó từ đâu tới: `main` nhận tiêu điểm của màn con
 * nếu có, không thì phần tử Tab dừng được đầu tiên của trang ngoài dải (nợ QA-01 #20, review QA-01c #1).
 */
function pageFocusTarget(strip: HTMLElement | null): HTMLElement | null {
  const main = document.querySelector<HTMLElement>('main[tabindex]');
  if (main !== null) return main;

  return (
    Array.from(document.querySelectorAll<HTMLElement>(TABBABLE)).find(
      // Bỏ phần tử ẩn/`inert`/tabIndex âm: focus() vào đó không ăn, tiêu điểm lại rơi về `body`.
      (element) =>
        strip?.contains(element) !== true &&
        element.tabIndex >= 0 &&
        element.closest('[hidden], [inert], [aria-hidden="true"]') === null,
    ) ?? null
  );
}

/**
 * Dải mất kết nối giữa phiên, đứng trên màn con vốn có `main` của mình — nên nó là một
 * `region` có tên chứ không bọc `main` (FIX-381, axe `region`).
 *
 * Phủ lên trên (`fixed`), không nằm trong luồng trang: nằm trong luồng thì cả màn tụt
 * xuống và hiện thanh cuộn, đúng lúc màn con có thể đang giữ phần sửa chưa lưu (BUG-019).
 *
 * Ở giữa mép DƯỚI, một dòng gọn: mép trên là chỗ của thanh trên mọi màn (chuông, avatar,
 * "Dự án mới", ô tìm dự án, `SegmentedControl` và `MeasurementTool` của viewer) — dải cũ
 * ở đó che chúng ở 375–1100 px. Mép dưới cũng có người ở (toast góc phải, cụm thu phóng
 * và chú giải viewer ở hai góc, thanh tầng của `ExplodedView`, tấm đáy di động của vài
 * màn), nên dải có nút "Ẩn": không gì bị che mãi. Ẩn chỉ trong lượt mất kết nối này —
 * dải tắt rồi bật lại là trạng thái mới, nó hiện lại.
 *
 * Câu không hứa "đang tự thử lại": lượt gia hạn dừng hẳn sau
 * `REFRESH_MAX_TRANSIENT_ATTEMPTS` lần (`lib/auth/refresh.ts`), nên chỉ nói điều luôn đúng. Cũng
 * không nói "thay đổi chưa lưu": dải đứng trên mọi màn, kể cả màn chẳng có gì để lưu, và cổng không
 * có cờ "đang có dữ liệu chưa lưu" nào đọc được mà không kéo store vào chunk vào (BUG-093).
 */
export function ConnectionStrip({ onRetry }: { onRetry: () => void }) {
  const [dismissed, setDismissed] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  /** Chỗ tiêu điểm đứng trước khi vào dải — nút "Ẩn" gỡ cả dải, nên trả tiêu điểm về đó. */
  const cameFrom = useRef<HTMLElement | null>(null);

  const dismiss = useCallback(() => {
    // Không có chỗ đến (Tab thẳng vào dải từ thanh trình duyệt) thì về màn con, không để rơi về `body`.
    const target = cameFrom.current?.isConnected === true ? cameFrom.current : pageFocusTarget(stripRef.current);

    setDismissed(true);
    target?.focus();
  }, []);

  if (dismissed) {
    return null;
  }

  return (
    <div
      ref={stripRef}
      role="region"
      aria-label="Trạng thái kết nối"
      onFocus={(event) => {
        // Đi giữa hai nút trong dải thì giữ chỗ đến cũ; vào từ ngoài thì ghi lại — kể cả "không từ đâu"
        // (`relatedTarget` rỗng), để một chỗ đến cũ từ lượt trước không bị dùng lại.
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
        cameFrom.current = event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null;
      }}
      className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-2 rounded-lg border border-state-attention bg-state-attention-tint py-1 pl-3 pr-1 shadow-float"
    >
      <WifiOff aria-hidden="true" className="shrink-0 text-state-attention" size={16} />
      <p role="alert" className="min-w-0 flex-1 text-[13px] leading-[18px] text-state-attention-text">
        Mất kết nối máy chủ. Kiểm tra mạng rồi bấm Thử lại.
      </p>
      <Button type="button" size="sm" variant="secondary" onClick={onRetry} className="shrink-0">
        Thử lại
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        iconOnly
        icon={<X aria-hidden="true" size={16} />}
        aria-label="Ẩn thông báo kết nối"
        onClick={dismiss}
      />
    </div>
  );
}
