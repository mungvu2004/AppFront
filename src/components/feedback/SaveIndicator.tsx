import React from 'react';
import { cn } from '../../lib/utils';
import { Cloud, CloudUpload, CheckCircle2, AlertCircle } from 'lucide-react';

// ─── Pure UI Component ────────────────────────────────────────────────────────

export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface SaveIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  saveState: SaveState;
  label?: string | null;
  flash?: boolean;
}

export function SaveIndicator({ saveState, label, flash, className, ...props }: SaveIndicatorProps) {
  let Icon = Cloud;
  let text = label;
  let iconColor = 'text-text-muted';

  switch (saveState) {
    case 'pending':
      Icon = CloudUpload;
      // Nhãn của hook thắng ở MỌI trạng thái — chữ cố định chỉ là dự phòng (B-V1-47).
      text = label || 'Có thay đổi chờ đồng bộ';
      iconColor = 'text-accent';
      break;
    case 'saving':
      Icon = CloudUpload;
      text = label || 'Đang lưu…';
      iconColor = 'text-accent animate-pulse';
      break;
    case 'saved':
      Icon = CheckCircle2;
      text = label || 'Đã lưu';
      iconColor = 'text-state-verified';
      break;
    case 'error':
      Icon = AlertCircle;
      text = label || 'Lưu thất bại';
      iconColor = 'text-state-violation';
      break;
    case 'idle':
    default:
      Icon = Cloud;
      text = label || 'Chưa có thay đổi';
      iconColor = 'text-text-muted';
      break;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors duration-260',
        flash ? 'bg-bg-flash text-text-primary' : 'bg-bg-surface text-text-secondary',
        className
      )}
      {...props}
    >
      <Icon className={cn('shrink-0', iconColor)} size={16} strokeWidth={2} />
      <span>{text}</span>
    </div>
  );
}
