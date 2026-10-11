/**
 * Một dòng thông báo của trung tâm thông báo — tách khỏi `NotificationCenter.tsx` để
 * file ấy dưới ngưỡng độ dài. VIEW THUẦN: mọi thứ tới qua props.
 */

import { AlertTriangle, MessageSquare, Sparkles, UserPlus } from 'lucide-react';

import { motion } from '@/components/motion';
import { Button } from '@/components/ui/Button';
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
}

export function NotificationRow({
  item,
  flatIndex,
  isArrived,
  onItemAction,
  onMarkRead,
  onInlineAction,
}: NotificationRowProps) {
  const Icon = KIND_ICON[item.kind];
  const dotDelaySeconds = (flatIndex * UNREAD_DOT_STAGGER_MS) / MS_IN_ONE_SECOND;

  return (
    <motion.li
      className="group relative flex min-h-[64px] items-start gap-3 rounded-md px-2 py-3"
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

      <span className="relative mt-2 flex w-[6px] shrink-0 items-center justify-center">
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
        <button
          type="button"
          onClick={() => onItemAction(item)}
          className="rounded text-left text-[15px] leading-[20px] text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface"
        >
          {!item.isRead && <span className="sr-only">{`${UNREAD_SR_HINT}. `}</span>}
          {item.sentence}{' '}
          <span className="text-accent underline underline-offset-2">{item.target.label}</span>
        </button>

        {item.excerpt !== undefined && (
          <p className="line-clamp-2 rounded bg-bg-sunken px-2 py-1.5 text-[13px] leading-[18px] text-text-secondary">
            {item.excerpt}
          </p>
        )}

        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-[13px] leading-[18px] text-text-muted">{item.relativeTime}</span>
          {item.inlineAction !== undefined && (
            <Button
              variant="secondary"
              size="sm"
              disabled={item.inlineAction.disabled === true}
              onClick={() => onInlineAction(item)}
            >
              {item.inlineAction.label}
            </Button>
          )}
          {item.statusNote !== undefined && (
            <span className="text-[13px] font-medium leading-[18px] text-text-secondary">
              {item.statusNote}
            </span>
          )}
        </div>
      </div>

      {!item.isRead && (
        <span
          className={cn(
            'shrink-0 opacity-0 transition-opacity duration-fast',
            'group-hover:opacity-100 group-focus-within:opacity-100',
          )}
        >
          <Button variant="ghost" size="sm" onClick={() => onMarkRead(item.id)}>
            {MARK_READ_LABEL}
          </Button>
        </span>
      )}
    </motion.li>
  );
}

