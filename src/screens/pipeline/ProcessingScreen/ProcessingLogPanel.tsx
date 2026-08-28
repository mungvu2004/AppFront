/**
 * STUB — panel nhật ký của màn Xử lý. Nhiệm vụ V6 thay ruột file này; chữ ký
 * giữ nguyên từ `ProcessingLogPanelProps` (`types.ts`).
 */

import { Button } from '@/components/ui/Button';

import type { ProcessingLogPanelProps } from './types';

export function ProcessingLogPanel({
  isAutoScrollLocked,
  logLines,
  onCopyLog,
  onToggleAutoScroll,
}: ProcessingLogPanelProps) {
  return (
    <div aria-label="Nhật ký xử lý" role="log">
      <div className="flex items-center justify-end gap-2">
        <Button aria-pressed={isAutoScrollLocked} onClick={onToggleAutoScroll} size="sm" variant="secondary">
          Khoá cuộn tự động
        </Button>
        <Button onClick={onCopyLog} size="sm" variant="secondary">
          Sao chép nhật ký
        </Button>
      </div>
      <ul>
        {logLines.map((line) => (
          <li key={line.id}>
            <span>{line.timeLabel}</span> <span>{line.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
