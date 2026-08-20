import React, { useState, useCallback } from 'react';
import { cn } from '../../lib/utils';
import type { RootState } from '../../store';
import { useStore } from '../../store';
import { useAutosave } from '../../hooks/useAutosave';
import { useCommitFlash } from '../../hooks/useCommitFlash';
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
      text = 'Có thay đổi chờ đồng bộ';
      iconColor = 'text-accent';
      break;
    case 'saving':
      Icon = CloudUpload;
      text = 'Đang lưu...';
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

// ─── Connected Component ──────────────────────────────────────────────────────

export interface ConnectedSaveIndicatorProps extends Omit<SaveIndicatorProps, 'saveState' | 'label' | 'flash'> {
  onSave: (data: RootState['spatial']) => Promise<void>;
}

export function ConnectedSaveIndicator({ onSave, ...props }: ConnectedSaveIndicatorProps) {
  const [isPending, setIsPending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const spatial = useStore(state => state.spatial);
  // Flash triggers when a commit happens in the store
  const flash = useCommitFlash();

  // Nhận ra thay đổi chưa lưu bằng cách so với giá trị trước NGAY TRONG lúc
  // render, không qua effect (R-27). Effect sẽ đẩy "đang chờ lưu" sang lượt
  // render sau, tức có một khung hình mà mô hình đã đổi còn chỉ báo vẫn nói
  // "đã lưu" — đúng loại nguồn sự thật thứ hai bị lệch mà R-27 nói tới.
  const [prevSpatial, setPrevSpatial] = useState(spatial);

  if (spatial !== prevSpatial) {
    setPrevSpatial(spatial);
    setIsPending(true);
  }

  const handleSave = useCallback(async (data: RootState['spatial']) => {
    setIsSaving(true);
    try {
      await onSave(data);
    } finally {
      setIsSaving(false);
      setIsPending(false);
    }
  }, [onSave]);

  const saveLabel = useAutosave(handleSave);

  let state: SaveState = 'idle';
  if (isSaving) state = 'saving';
  else if (isPending) state = 'pending';
  else if (saveLabel === 'Lưu thất bại') state = 'error';
  else if (saveLabel) state = 'saved';

  return (
    <SaveIndicator
      saveState={state}
      {...(state === 'saved' || state === 'error' ? { label: saveLabel ?? null } : {})}
      flash={flash}
      {...props}
    />
  );
}
