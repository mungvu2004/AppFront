/**
 * Panel nhật ký của màn Xử lý — cột phải, tab "Nhật ký" (V6).
 *
 * View thuần của mục D: mọi thứ vào bằng {@link ProcessingLogPanelProps},
 * không `src/api`, không `src/store`, không `src/domain`, không `src/lib/http`
 * (R-60). Panel không tự gọi `navigator.clipboard` — nút sao chép chỉ bắn
 * `onCopyLog`, việc sao chép thật thuộc hook (nhiệm vụ H7).
 *
 * `role="log"` trên vùng cuộn mang sẵn ngữ nghĩa `aria-live="polite"` của ARIA
 * — đúng thứ mục 2(b) đòi: có vùng thông báo dòng mới cho trình đọc màn hình,
 * nhưng không đọc liên tục gây nhiễu. Khai thêm `aria-live="polite"` tường minh
 * để không phụ thuộc một mình vào ngữ nghĩa ngầm định của role.
 */

import { useEffect, useRef } from 'react';
import { Copy, Inbox, Lock } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { IconButton } from '@/components/ui/IconButton';

import type { ProcessingLogPanelProps } from './types';

/* -------------------------------------------------------------------------- */
/* Chuỗi người đọc. Tiếng Việt có dấu, viết thường kiểu câu (A6).              */
/* -------------------------------------------------------------------------- */

const PANEL_LABEL = 'Nhật ký xử lý';
const LOCK_AUTO_SCROLL_LABEL = 'Khoá cuộn tự động';
const COPY_LOG_LABEL = 'Sao chép nhật ký';
const EMPTY_TITLE = 'Chưa có dòng nhật ký nào';
const EMPTY_DESCRIPTION = 'Nhật ký xử lý sẽ xuất hiện tại đây khi hệ thống bắt đầu ghi lại.';

/**
 * Ngưỡng hiển thị của màn, không phải thời lượng (nên không thuộc `src/lib/motion`).
 * Nhật ký có thể chảy liên tục trong một lượt xử lý dài; giữ nguyên toàn bộ dòng
 * trong DOM sẽ phình vô hạn, nên chỉ 200 dòng gần nhất được vẽ ra.
 */
const MAX_VISIBLE_LOG_LINES = 200;

/* -------------------------------------------------------------------------- */
/* Panel.                                                                      */
/* -------------------------------------------------------------------------- */

export function ProcessingLogPanel({
  isAutoScrollLocked,
  logLines,
  onCopyLog,
  onToggleAutoScroll,
}: ProcessingLogPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const visibleLines = logLines.slice(-MAX_VISIBLE_LOG_LINES);

  useEffect(() => {
    if (isAutoScrollLocked) {
      return;
    }

    const node = scrollRef.current;

    if (node === null) {
      return;
    }

    node.scrollTop = node.scrollHeight;
  }, [visibleLines, isAutoScrollLocked]);

  return (
    <div aria-label={PANEL_LABEL} className="flex flex-col gap-2">
      <div className="flex items-center justify-end gap-2">
        <IconButton
          aria-label={LOCK_AUTO_SCROLL_LABEL}
          aria-pressed={isAutoScrollLocked}
          icon={<Lock aria-hidden="true" className="h-4 w-4" />}
          isActive={isAutoScrollLocked}
          onClick={onToggleAutoScroll}
          size="sm"
        />
        <IconButton
          aria-label={COPY_LOG_LABEL}
          icon={<Copy aria-hidden="true" className="h-4 w-4" />}
          onClick={onCopyLog}
          size="sm"
        />
      </div>

      {visibleLines.length === 0 ? (
        <EmptyState description={EMPTY_DESCRIPTION} icon={<Inbox aria-hidden="true" />} title={EMPTY_TITLE} />
      ) : (
        <div
          aria-live="polite"
          className="max-h-[420px] overflow-y-auto rounded-[8px] border border-border-default bg-bg-sunken p-2 font-mono text-[13px] text-text-primary"
          ref={scrollRef}
          role="log"
          tabIndex={0}
        >
          <ul className="flex flex-col gap-0.5">
            {visibleLines.map((line) => (
              <li className="flex gap-2" key={line.id}>
                <span className="shrink-0 text-text-muted">{line.timeLabel}</span>
                <span className="whitespace-pre-wrap break-words">{line.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
