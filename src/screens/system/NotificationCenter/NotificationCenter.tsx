/**
 * Trung tâm thông báo — tấm trượt 400px neo vào chuông (W2, nửa vẽ của mục D).
 *
 * VIEW THUẦN (R-60): mọi thứ tới qua {@link NotificationCenterProps}, không
 * `@/api`/`@/store`/`@/domain`/`@/lib/http`. `useState` ở đây chỉ phục vụ một
 * hiệu ứng trình bày (tấm mờ dần trước khi đóng) — bảy trạng thái A11 đọc
 * thẳng từ `screenState`, không tự viết `isLoading`/`error` (R-64).
 *
 * Bốn điểm dễ đoán sai: Drawer đã lo phần dưới 1024px cùng Esc/bẫy tiêu điểm
 * nên không có `keydown` hay media query thứ hai ở đây. Hậu tố alpha Tailwind
 * biên dịch ra rỗng — nháy `bg-selected` dùng một lớp `aria-hidden` riêng, mờ
 * bằng `opacity` của framer-motion, không `bg-selected/20`. Chưa đọc luôn là
 * một chấm (`UNREAD_DOT_SIZE_PX`), ẩn hiện bằng `opacity` chứ không unmount,
 * không bao giờ là nền hàng. So le dùng chỉ số vị trí PHẲNG chứ không phải
 * "còn chưa đọc": đánh dấu tất cả đã đọc bật mọi `isRead` cùng lúc nên lọc
 * theo chưa đọc lúc đó sẽ mất hết độ trễ so le.
 *
 * Chuông (R-73) xuất từ chính file này vì `AppShell.tsx` bị R-68 khoá, không
 * nhận component mới. Nghiêng một lần mỗi khi `bellNudgeToken` đổi, theo dõi
 * bằng so sánh với giá trị trước — không `animation: infinite`.
 */

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, MessageSquare, Settings, Sparkles, UserPlus } from 'lucide-react';

import { motion, useAnimation } from '@/components/motion';
import { Drawer } from '@/components/overlay/Drawer';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { durationMs, durationSeconds } from '@/lib/motion';
import { cn } from '@/lib/utils';

import {
  BELL_NUDGE_DEGREES,
  NOTIFICATION_FILTERS,
  NOTIFICATION_FILTER_LABELS,
  UNREAD_DOT_SIZE_PX,
  UNREAD_DOT_STAGGER_MS,
  type NotificationDayGroup,
  type NotificationItemVm,
  type NotificationKind,
} from './notificationModel';
import type { NotificationCenterProps } from './useNotificationCenter';

/* -------------------------------------------------------------------------- */
/* Chữ tĩnh của màn — không tới từ props vì đây là bản dịch cố định của UI.    */
/* -------------------------------------------------------------------------- */

const TITLE_LABEL = 'Thông báo';
const MARK_ALL_READ_LABEL = 'Đánh dấu tất cả đã đọc';
const MARK_READ_LABEL = 'Đánh dấu đã đọc';
const SETTINGS_LABEL = 'Mở cài đặt thông báo';
const FILTER_ARIA_LABEL = 'Lọc thông báo';
const VIEW_ALL_LABEL = 'Xem tất cả';
const RETRY_LABEL = 'Thử lại';
const BELL_ARIA_LABEL = 'Thông báo';
const UNREAD_SR_HINT = 'chưa đọc';

const EMPTY_TITLE = 'Không có thông báo mới';
const EMPTY_DESCRIPTION = 'Chúng tôi sẽ báo khi AI xử lý xong hoặc có người nhắc đến bạn.';
const PARTIAL_NOTICE = 'Có thể chưa cập nhật';
const FORBIDDEN_NOTICE = 'Bạn chỉ thấy thông báo của những dự án được chia sẻ với bạn.';
const ERROR_TITLE = 'Không tải được thông báo';
const ERROR_FALLBACK_MESSAGE = 'Kiểm tra kết nối rồi thử lại.';

const FILTER_OPTIONS = NOTIFICATION_FILTERS.map((value) => ({
  value,
  label: NOTIFICATION_FILTER_LABELS[value],
}));

const LOADING_ROW_COUNT = 5;
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

/** Vị trí phẳng của mỗi mục qua mọi nhóm ngày — nguồn của độ trễ so le. */
function flatIndexOf(groups: readonly NotificationDayGroup[]): ReadonlyMap<string, number> {
  const indices = new Map<string, number>();
  for (const group of groups) {
    for (const item of group.items) {
      indices.set(item.id, indices.size);
    }
  }
  return indices;
}

/* -------------------------------------------------------------------------- */
/* Một mục.                                                                    */
/* -------------------------------------------------------------------------- */

interface NotificationRowProps {
  readonly item: NotificationItemVm;
  readonly flatIndex: number;
  readonly isArrived: boolean;
  readonly onItemAction: (item: NotificationItemVm) => void;
  readonly onMarkRead: (id: string) => void;
  readonly onInlineAction: (item: NotificationItemVm) => void;
}

function NotificationRow({
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

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] leading-[18px] text-text-muted">{item.relativeTime}</span>
          {item.inlineAction !== undefined && (
            <Button variant="ghost" size="sm" onClick={() => onInlineAction(item)}>
              {item.inlineAction.label}
            </Button>
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

/* -------------------------------------------------------------------------- */
/* Màn.                                                                        */
/* -------------------------------------------------------------------------- */

export function NotificationCenter(props: NotificationCenterProps) {
  const {
    screenState, isOpen, isCollapsed, onClose, filter, onFilterChange, groups, unreadBadge,
    liveMessage, onMarkAllRead, onMarkRead, onItemClick, onInlineAction, onViewAll,
    onOpenSettings, errorMessage, onRetry, arrivedIds, scrollRef,
  } = props;

  /* Hoà tan 180ms rồi mới `onClose` — trình bày thuần, không phải R-64. */
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) setIsClosing(false);
  }, [isOpen]);

  const closeAfterFade = () => {
    setIsClosing(true);
    setTimeout(onClose, durationMs('fast'));
  };

  const handleItemAction = (item: NotificationItemVm) => {
    onItemClick(item);
    closeAfterFade();
  };

  const handleInlineAction = (item: NotificationItemVm) => {
    onInlineAction(item);
    if (item.inlineAction?.kind === 'navigate') {
      closeAfterFade();
    }
  };

  const indices = flatIndexOf(groups);
  const isMarkAllDisabled = unreadBadge === '' || screenState === 'loading' || screenState === 'error';

  let body: React.ReactNode;

  if (screenState === 'loading') {
    body = Array.from({ length: LOADING_ROW_COUNT }, (_u, i) => <Skeleton key={i} preset="table-row" />);
  } else if (screenState === 'error') {
    body = (
      <InlineAlert
        level="violation"
        title={ERROR_TITLE}
        message={errorMessage ?? ERROR_FALLBACK_MESSAGE}
        action={{ label: RETRY_LABEL, onClick: onRetry, variant: 'secondary' }}
      />
    );
  } else if (screenState === 'empty') {
    body = <EmptyState icon={<Bell />} title={EMPTY_TITLE} description={EMPTY_DESCRIPTION} />;
  } else {
    body = (
      <>
        {screenState === 'partial' && <InlineAlert level="attention" message={PARTIAL_NOTICE} />}
        {screenState === 'forbidden' && (
          <p className="px-1 text-[13px] text-text-secondary">{FORBIDDEN_NOTICE}</p>
        )}
        {groups.map((group) => (
          <section key={group.key} aria-label={group.heading}>
            <h4 className="px-1 pb-1 pt-3 text-[13px] font-medium text-text-muted first:pt-0">
              {group.heading}
            </h4>
            <ul className="flex flex-col">
              {group.items.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  flatIndex={indices.get(item.id) ?? 0}
                  isArrived={arrivedIds.includes(item.id)}
                  onItemAction={handleItemAction}
                  onMarkRead={onMarkRead}
                  onInlineAction={handleInlineAction}
                />
              ))}
            </ul>
          </section>
        ))}
      </>
    );
  }

  return (
    <Drawer.Root isOpen={isOpen} onClose={onClose}>
      <Drawer.Header>
        {/*
          Trạng thái 7 ("thu gọn"): khung hẹp thì tiêu đề và nhóm nút xếp dọc
          thay vì chen nhau trên một hàng. Bề ngang của chính tấm trượt là việc
          của `Drawer` (nó tự đo bằng `useMediaQuery`), không phải của màn này.
        */}
        <div
          className={cn(
            'flex gap-3',
            isCollapsed ? 'flex-col items-stretch' : 'items-center justify-between',
          )}
        >
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold text-text-primary">{TITLE_LABEL}</h3>
            {unreadBadge !== '' && (
              <span className="font-mono text-[13px] tabular-nums text-text-secondary">
                {unreadBadge}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onMarkAllRead} disabled={isMarkAllDisabled}>
              {MARK_ALL_READ_LABEL}
            </Button>
            <IconButton
              icon={<Settings size={18} />}
              aria-label={SETTINGS_LABEL}
              size="sm"
              onClick={onOpenSettings}
            />
          </div>
        </div>
        <div className="mt-3">
          <SegmentedControl
            aria-label={FILTER_ARIA_LABEL}
            options={FILTER_OPTIONS}
            value={filter}
            onChange={onFilterChange}
          />
        </div>
      </Drawer.Header>

      <Drawer.Body ref={scrollRef}>
        {/* A7/A11: số chưa đọc đổi thì trình đọc màn hình nghe được, không phải đi dò lại. */}
        <p className="sr-only" role="status" aria-live="polite">
          {liveMessage}
        </p>

        <div
          className={cn(
            'flex flex-col gap-1 transition-opacity duration-fast',
            isClosing ? 'opacity-0' : 'opacity-100',
          )}
        >
          {body}
        </div>
      </Drawer.Body>

      <div className="shrink-0 border-t border-border-default px-8 py-4">
        <Button variant="ghost" size="sm" fullWidth onClick={onViewAll}>
          {VIEW_ALL_LABEL}
        </Button>
      </div>
    </Drawer.Root>
  );
}

/* -------------------------------------------------------------------------- */
/* Chuông (R-73) — export riêng vì AppShell.tsx bị khoá, không nhận sửa.       */
/* -------------------------------------------------------------------------- */

export interface NotificationBellProps {
  /** Đã cắt ngưỡng sẵn ("9+"); chuỗi RỖNG nghĩa là không có gì chưa đọc. */
  readonly unreadBadge: string;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
  /** Đổi giá trị → nghiêng đúng một lần. Không tự lặp. */
  readonly bellNudgeToken: number;
}

const BELL_ICON_SIZE = 20;

export function NotificationBell({ unreadBadge, isOpen, onToggle, bellNudgeToken }: NotificationBellProps) {
  const controls = useAnimation();
  const previousTokenRef = useRef(bellNudgeToken);

  useEffect(() => {
    if (previousTokenRef.current === bellNudgeToken) {
      return;
    }
    previousTokenRef.current = bellNudgeToken;
    void controls.start({
      rotate: [0, BELL_NUDGE_DEGREES, 0],
      transition: { duration: durationSeconds('slow') },
    });
  }, [bellNudgeToken, controls]);

  return (
    <motion.button
      type="button"
      animate={controls}
      aria-label={BELL_ARIA_LABEL}
      aria-expanded={isOpen}
      onClick={onToggle}
      className={cn(
        'relative flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary outline-none transition-colors duration-fast',
        'hover:bg-bg-hover hover:text-text-primary',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface',
        isOpen && 'bg-bg-selected text-accent-active',
      )}
    >
      <Bell aria-hidden="true" size={BELL_ICON_SIZE} strokeWidth={1.5} />
      {unreadBadge !== '' && (
        <Badge
          variant="neutral"
          noDot
          className="absolute -right-1 -top-1 h-[16px] px-1 text-[11px] leading-none"
        >
          {unreadBadge}
        </Badge>
      )}
    </motion.button>
  );
}
