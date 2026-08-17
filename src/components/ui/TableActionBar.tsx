import React from 'react';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Layers, SlidersHorizontal } from 'lucide-react';
import { Button } from './Button';
import { durationSeconds } from '../../lib/motion';
import { useShortcut } from '../../hooks/useShortcut';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TableActionBarProps {
  /** Number of currently selected rows */
  selectedCount: number;
  /** Entity name in Vietnamese (accusative), e.g. "tường", "phòng" */
  entityName?: string;
  onApprove?: () => void;
  onReject?: () => void;
  onChangeThickness?: () => void;
  onDeselect?: () => void;
  /** Whether approval action is loading */
  isApproving?: boolean;
  /** Whether rejection action is loading */
  isRejecting?: boolean;
}

// ─── View ─────────────────────────────────────────────────────────────────────

export function TableActionBar({
  selectedCount,
  entityName = 'mục',
  onApprove,
  onReject,
  onChangeThickness,
  onDeselect,
  isApproving,
  isRejecting,
}: TableActionBarProps) {
  // Accessibility: Esc bỏ chọn, qua trọng tài phím tắt — scope 'sidePanel'
  // nên tự động nhường khi có dialog mở phía trên.
  useShortcut(
    {
      id: 'tableActionBar.deselect',
      combo: 'Escape',
      scope: 'sidePanel',
      preventDefault: false,
      onTrigger: () => onDeselect?.(),
    },
    { enabled: selectedCount > 0 && onDeselect !== undefined },
  );

  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          role="toolbar"
          aria-label={`Thanh hành động: đã chọn ${selectedCount} ${entityName}`}
          initial={{ y: 48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 48, opacity: 0 }}
          transition={{ duration: durationSeconds('fast'), ease: 'easeOut' }}
          className={twMerge(
            'absolute bottom-0 left-0 right-0 z-30',
            'flex items-center gap-3 px-4 h-14',
            'bg-bg-surface shadow-overlay border-t border-border-default'
          )}
        >
          {/* Selection count */}
          <span className="text-[13px] text-text-secondary shrink-0 mr-1">
            Đã chọn{' '}
            <strong className="text-text-primary font-semibold">{selectedCount}</strong>{' '}
            {entityName}
          </span>

          <div className="w-px h-5 bg-border-default shrink-0" aria-hidden="true" />

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {onApprove && (
              <Button
                size="sm"
                variant="secondary"
                iconBefore={<Check size={15} />}
                loading={isApproving ?? false}
                onClick={onApprove}
                id="table-action-approve"
              >
                Duyệt
              </Button>
            )}
            {onReject && (
              <Button
                size="sm"
                variant="danger"
                iconBefore={<X size={15} />}
                loading={isRejecting ?? false}
                onClick={onReject}
                id="table-action-reject"
              >
                Từ chối
              </Button>
            )}
            {onChangeThickness && (
              <Button
                size="sm"
                variant="secondary"
                iconBefore={<SlidersHorizontal size={15} />}
                onClick={onChangeThickness}
                id="table-action-thickness"
              >
                Đổi độ dày
              </Button>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Deselect */}
          {onDeselect && (
            <button
              type="button"
              onClick={onDeselect}
              aria-label="Bỏ chọn tất cả"
              id="table-action-deselect"
              className="inline-flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-text-primary transition-colors duration-120 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded outline-none px-2 py-1"
            >
              <Layers size={14} />
              Bỏ chọn
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
