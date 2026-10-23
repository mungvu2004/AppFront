/**
 * Một dòng thông báo của trung tâm thông báo — tách khỏi `NotificationCenter.tsx` để
 * file ấy dưới ngưỡng độ dài. VIEW THUẦN: mọi thứ tới qua props.
 */

import { AlertTriangle, Check, MessageSquare, Sparkles, UserPlus } from 'lucide-react';

import { motion } from '@/components/motion';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { durationSeconds } from '@/lib/motion';
import { cn } from '@/lib/utils';

import {
  UNREAD_DOT_SIZE_PX,
  UNREAD_DOT_STAGGER_MS,
  type NotificationItemVm,
  type NotificationKind,
} from './notificationModel';

const MARK_READ_LABEL = 'Đánh dấu đã đọc';
const UNREAD_SR_HINT = 'chưa đọc';
const ICON_SIZE = 20;
const ICON_STROKE = 1.5;
/** Mili giây sang giây cho framer-motion — cùng phép chia `HistoryPanel.rows.tsx:62`. */
const MS_IN_ONE_SECOND = 1000;

/**
 * The note replaces the accept button once the server says yes; the button it replaces held focus, so focus
 * would fall to <body>. Take it only when it is orphaned, never from another control.
 */
function takeOrphanedFocus(note: HTMLSpanElement | null): void {
  if (note !== null && (document.activeElement === null || document.activeElement === document.body)) {
    note.focus({ preventScroll: true });
  }
}

/** Bốn loại, bốn hình — bảng đóng: loại thứ năm sẽ hỏng ở bước typecheck. */
const KIND_ICON: Readonly<Record<NotificationKind, typeof Sparkles>> = {
  aiCompleted: Sparkles,
  violationFound: AlertTriangle,
  projectInvite: UserPlus,
  commentMention: MessageSquare,
};

/* -------------------------------------------------------------------------- */
/* Một mục.                                                                    */
/* -------------------------------------------------------------------------- */

export interface NotificationRowProps {
  readonly item: NotificationItemVm;
  readonly flatIndex: number;
  readonly isArrived: boolean;
  readonly onItemAction: (item: NotificationItemVm) => void;
  readonly onMarkRead: (id: string) => void;
  readonly onInlineAction: (item: NotificationItemVm) => void;
  /** Trang `/thong-bao`: tên dự án xuống dòng; tấm trượt 400 px vẫn cắt "…". */
  readonly wrapProjectName?: boolean;
}

export function NotificationRow({
  item,
  flatIndex,
  isArrived,
  onItemAction,
  onMarkRead,
  onInlineAction,
  wrapProjectName = false,
}: NotificationRowProps) {
  const Icon = KIND_ICON[item.kind];
  const dotDelaySeconds = (flatIndex * UNREAD_DOT_STAGGER_MS) / MS_IN_ONE_SECOND;

  return (
    <motion.li
      className="group relative flex min-h-16 items-start gap-3 rounded-md px-2 py-3"
      initial={isArrived ? { opacity: 0, y: -12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: durationSeconds('standard') }}
    >
      {isArrived && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-md bg-selected"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: durationSeconds('standard') }}
        />
      )}

      <span className="relative mt-2 flex w-1.5 shrink-0 items-center justify-center">
        <motion.span
          aria-hidden="true"
          className="rounded-full bg-accent"
          style={{ width: UNREAD_DOT_SIZE_PX, height: UNREAD_DOT_SIZE_PX }}
          initial={false}
          animate={{ opacity: item.isRead ? 0 : 1 }}
          transition={{ duration: durationSeconds('fast'), delay: dotDelaySeconds }}
        />
      </span>

      <Icon
        aria-hidden="true"
        size={ICON_SIZE}
        strokeWidth={ICON_STROKE}
        className="relative mt-0.5 shrink-0 text-text-secondary"
      />

      <div className="relative flex min-w-0 flex-1 flex-col gap-1">
        {/* min-h-6: a one-line sentence was a 20 px tall target, under the 24 px of WCAG 2.5.8; below 640 px a text
            target is 44 px like every other button there, the sentence one was 24/40 (BUG-236, run-17). `flex` + one
            inner span keeps the text at the top of the taller box instead of centred under the icon. */}
        <button
          type="button"
          onClick={() => onItemAction(item)}
          className="flex min-h-6 rounded-sm text-left text-[15px] leading-5 text-text-primary outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface max-sm:min-h-11"
        >
          <span>
            {!item.isRead && <span className="sr-only">{`${UNREAD_SR_HINT}. `}</span>}
            {item.sentence}{' '}
            <span className="text-accent underline underline-offset-2">{item.target.label}</span>
          </span>
        </button>

        {item.excerpt !== undefined && (
          // Kẹp dòng ở lớp trong: `line-clamp` cắt ở mép padding, nên kẹp trên khung có padding để lộ nửa dòng 3 (BUG-203).
          <p className="rounded-sm bg-bg-sunken px-2 py-1.5 text-[13px] leading-[18px] text-text-secondary">
            <span className="line-clamp-2">{item.excerpt}</span>
          </p>
        )}

        {/* Giờ + nút hành động xuống dòng TRONG nhóm của chúng; nút đánh dấu đứng ngoài nhóm, luôn ở mép phải hàng
            giờ. Cả ba từng chung một hàng `flex-wrap`: ở tờ 375 px giờ + "Xem kết quả" + nút 44 px không vừa, nút
            đánh dấu rơi một mình xuống dòng riêng, hàng cao thêm một dải trống (BUG-203, run-16). */}
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="whitespace-nowrap text-[13px] leading-[18px] text-text-muted">{item.relativeTime}</span>
            {item.target.projectName.length > 0 && (
              <span className={cn('min-w-0 max-w-full text-[13px] leading-[18px] text-text-muted', wrapProjectName ? 'wrap-anywhere' : 'truncate')}>{`· ${item.target.projectName}`}</span>
            )}
            {item.inlineAction !== undefined && (
              // While the accept is in flight the button is `aria-disabled`, not `disabled`: a disabled button
              // drops keyboard focus to <body> inside the sheet (WCAG 2.4.3, review QA-02 P2-5).
              <Button
                variant="secondary"
                size="sm"
                aria-disabled={item.inlineAction.disabled === true || undefined}
                onClick={() => {
                  if (item.inlineAction?.disabled !== true) onInlineAction(item);
                }}
              >
                {item.inlineAction.label}
              </Button>
            )}
            {item.statusNote !== undefined && (
              <span ref={takeOrphanedFocus} tabIndex={-1} className="text-[13px] font-medium leading-[18px] text-text-secondary outline-hidden">
                {item.statusNote}
              </span>
            )}
          </div>
          {/* Nút ẩn từng là một cột chữ bên phải: opacity-0 vẫn giữ chỗ, câu bị bóp còn ~100 px (BUG-203).
              Nay là nút biểu tượng ở hàng giờ, nên câu dùng hết bề ngang. Chỉ ẩn-chờ-rê-chuột từ 640 px; hẹp
              hơn, hoặc màn không có hover, thì luôn hiện — không có nút vô hình bấm trúng. */}
          {!item.isRead && (
            <span
              className={cn(
                'ml-auto shrink-0 transition-opacity duration-fast',
              )}
            >
              <IconButton
                icon={<Check size={18} aria-hidden="true" />}
                aria-label={MARK_READ_LABEL}
                size="sm"
                onClick={() => onMarkRead(item.id)}
              />
            </span>
          )}
        </div>
      </div>
    </motion.li>
  );
}

