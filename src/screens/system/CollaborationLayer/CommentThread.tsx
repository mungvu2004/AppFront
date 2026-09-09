/**
 * Ghim bình luận trên bản vẽ, bóng 320 khi bấm ghim, danh sách ở panel phải.
 *
 * VIEW THUẦN (R-60): mọi thứ tới qua {@link CommentThreadProps}. `useState` ở
 * đây giữ đúng hai chuyện trình bày — ghim nào đang mở bóng, danh sách có mở
 * không — chứ không phải trạng thái tải tự viết (R-64).
 *
 * **Bóng 320 tự dựng.** `src/components/overlay/Popover.tsx` không tồn tại (đã
 * grep, 0 kết quả) và lượt này bị cấm thêm component vào `src/components`.
 * `Modal.Root` phủ kín màn và bẫy tiêu điểm, `Drawer.Root` dán cạnh màn hình —
 * không cái nào là "bóng nổi cạnh một điểm neo". Nên bóng đặt theo chính toạ độ
 * `at` của ghim: cùng hệ toạ độ nên không phải đo `getBoundingClientRect`.
 *
 * **Ba thứ đặc tả đòi mà file này cố ý không dựng:** ô nhập, nhắc tên bằng `@`,
 * nút đánh dấu đã xử lý. Bình luận không có tầng logic nào trong repo (không
 * endpoint, schema, query hay model) nên hợp đồng chỉ đưa xuống đây
 * `CommentPinVm` và đúng một callback, `onFrameComment`: không nội dung, không
 * tác giả, không mảng trả lời, không `onSubmitComment`. Vẽ chúng ra thì chúng
 * là affordance chết, mà `types.ts` đã chốt — thứ không có logic đỡ phía sau
 * thì không để lại dấu vết nào trên màn — và R-69 cấm mã tạm. Nên chúng rời
 * khỏi DOM: không `disabled`, không ẩn bằng CSS, không tooltip "sắp có". Mục
 * "thiếu logic" của báo cáo lượt này liệt kê những gì D-01/D-04 phải cấp để
 * bật lại phần đã cắt.
 *
 * **Ba cổng trạng thái.** `capabilities.comments === false` → cả lớp này rời
 * khỏi DOM. `canWrite === false` (trạng thái 6) → không còn affordance ghi nào
 * để gỡ, nên trạng thái đó nói thành lời bằng một chú thích thường trực.
 * `isCollapsed === true` (trạng thái 7) → **ghim giữ nguyên**; thứ duy nhất bị
 * ẩn là con trỏ người khác, mà con trỏ thuộc `PresenceOverlay`. Ở đây
 * `isCollapsed` chỉ đổi cách xếp phần đầu danh sách cho vừa khung hẹp.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { Check, MessageSquare, X } from 'lucide-react';

import { AnimatePresence, motion } from '@/components/motion';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { useShortcut } from '@/hooks/useShortcut';
import { durationSeconds, MOTION_EASINGS } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Z_INDEX } from '@/lib/zIndex';

import type { CollaborationCapabilities, CommentPinVm } from './types';

/* --- Chữ tĩnh — bản dịch cố định của giao diện, không tới từ props. --- */

const PINS_LAYER_LABEL = 'Ghim bình luận trên bản vẽ';
const LIST_LABEL = 'Danh sách bình luận';
const OPEN_LIST_LABEL = 'Mở danh sách bình luận';
const CLOSE_LIST_LABEL = 'Đóng danh sách bình luận';
const CLOSE_POPOVER_LABEL = 'Đóng bóng bình luận';
const FRAME_LABEL = 'Đưa vào khung hình';
const RESOLVED_LABEL = 'Đã xử lý';
const UNRESOLVED_LABEL = 'Chưa xử lý';
const NO_REPLY_LABEL = 'Chưa có trả lời';
const REPLY_SUFFIX_LABEL = 'trả lời';
const OBJECT_LABEL = 'Đối tượng';
const EMPTY_LIST_MESSAGE = 'Chưa có bình luận nào trên bản vẽ này.';
const READ_ONLY_NOTICE = 'Bạn chỉ xem được bình luận, không viết được ở dự án này.';
const ESC_DESCRIPTION = 'đóng bóng bình luận, rồi tới danh sách bình luận';

/* --- Số đo và hai khe chuyển động. --- */

/** Bề ngang ghim (đặc tả chốt 20) và bề ngang bóng (đặc tả chốt 320). */
const PIN_SIZE_PX = 20;
const POPOVER_WIDTH_PX = 320;
const LIST_WIDTH_PX = 320;

/** Bóng nở từ cạnh phải ghim, chừa một quãng để không đè lên chính ghim. */
const POPOVER_OFFSET_PX = 16;

/* Bóng và danh sách là "thứ nhỏ hiện đúng chỗ đang nhìn": vào ở khe `fast`
   (180ms) đường cong `enter`, biến mất là mờ dần ở `exit`. */
const ENTER_TRANSITION = {
  duration: durationSeconds('fast'),
  ease: MOTION_EASINGS.enter.points,
} as const;

const EXIT_TRANSITION = {
  duration: durationSeconds('fast'),
  ease: MOTION_EASINGS.exit.points,
} as const;

const ROW_FOCUS_STYLES =
  'outline-none transition-colors duration-120 hover:bg-bg-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface';

/* --- Chuỗi dựng từ dữ liệu. --- */

/** "3 trả lời" hoặc "Chưa có trả lời". `replyCount` là số nguyên đếm được chứ
    không phải số đo — không định dạng, không quy đổi, nên A15 không bị đụng. */
function replyLabelOf(replyCount: number): string {
  return replyCount === 0 ? NO_REPLY_LABEL : `${replyCount} ${REPLY_SUFFIX_LABEL}`;
}

function statusLabelOf(isResolved: boolean): string {
  return isResolved ? RESOLVED_LABEL : UNRESOLVED_LABEL;
}

/* --- Một ghim. --- */

interface CommentPinProps {
  readonly comment: CommentPinVm;
  readonly isOpen: boolean;
  readonly onToggle: (commentId: string) => void;
}

/** Ghim 20px neo vào đúng toạ độ của nó. Đã xử lý khác chưa xử lý bằng HÌNH
    (dấu tích so với số trả lời) chứ không bằng màu trạng thái: A5 giữ xanh "đã
    xác minh" cho riêng việc người duyệt, mà đóng một bình luận không phải duyệt. */
function CommentPin({ comment, isOpen, onToggle }: CommentPinProps) {
  return (
    <button
      type="button"
      aria-label={`${statusLabelOf(comment.isResolved)}. ${replyLabelOf(comment.replyCount)}.`}
      aria-expanded={isOpen}
      onClick={() => {
        onToggle(comment.id);
      }}
      className={cn(
        'pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center',
        'rounded-full border border-border-default bg-bg-surface font-mono text-[13px] leading-none',
        'text-text-primary shadow-float',
        ROW_FOCUS_STYLES,
        isOpen && 'bg-bg-selected',
        comment.isResolved && 'text-text-muted',
      )}
      style={{ left: comment.at.x, top: comment.at.y, width: PIN_SIZE_PX, height: PIN_SIZE_PX }}
    >
      {comment.isResolved ? (
        <Check aria-hidden="true" size={12} strokeWidth={2} />
      ) : (
        <span aria-hidden="true">{comment.replyCount}</span>
      )}
    </button>
  );
}

/* --- Bóng 320. --- */

interface CommentPopoverProps {
  readonly comment: CommentPinVm;
  readonly canWrite: boolean;
  readonly onClose: () => void;
  readonly onFrameComment: (commentId: string) => void;
}

function CommentPopover({ comment, canWrite, onClose, onFrameComment }: CommentPopoverProps) {
  const titleId = useId();

  return (
    <motion.div
      role="group"
      aria-labelledby={titleId}
      className="pointer-events-auto absolute flex flex-col gap-3 rounded-lg border border-border-default bg-bg-surface p-3 shadow-overlay"
      style={{
        left: comment.at.x + POPOVER_OFFSET_PX,
        top: comment.at.y,
        width: POPOVER_WIDTH_PX,
        zIndex: Z_INDEX.dropdown,
      }}
      initial={{ opacity: 0, y: -PIN_SIZE_PX }}
      animate={{ opacity: 1, y: 0, transition: ENTER_TRANSITION }}
      exit={{ opacity: 0, transition: EXIT_TRANSITION }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 id={titleId} className="text-[15px] font-medium leading-[20px] text-text-primary">
          {OBJECT_LABEL} <code className="font-mono">{comment.objectId}</code>
        </h3>
        <IconButton
          icon={<X size={16} />}
          aria-label={CLOSE_POPOVER_LABEL}
          size="sm"
          tooltip={false}
          onClick={onClose}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral">{statusLabelOf(comment.isResolved)}</Badge>
        <span className="text-[13px] leading-[18px] text-text-secondary">
          {replyLabelOf(comment.replyCount)}
        </span>
      </div>

      {/* Trạng thái 6 nói thành lời: không có ô nhập bị khoá ở đây để gỡ. */}
      {!canWrite && (
        <p className="text-[13px] leading-[18px] text-text-muted">{READ_ONLY_NOTICE}</p>
      )}

      <Button
        variant="secondary"
        size="sm"
        fullWidth
        onClick={() => {
          onFrameComment(comment.id);
        }}
      >
        {FRAME_LABEL}
      </Button>
    </motion.div>
  );
}

/* --- Danh sách ở panel phải. --- */

interface CommentListProps {
  readonly comments: readonly CommentPinVm[];
  readonly canWrite: boolean;
  readonly isCollapsed: boolean;
  readonly onClose: () => void;
  readonly onFrameComment: (commentId: string) => void;
}

function CommentList({ comments, canWrite, isCollapsed, onClose, onFrameComment }: CommentListProps) {
  const titleId = useId();

  return (
    <motion.aside
      role="region"
      aria-labelledby={titleId}
      className="pointer-events-auto fixed bottom-0 right-0 top-0 flex flex-col gap-3 overflow-y-auto border-l border-border-default bg-bg-surface p-4 shadow-panel"
      style={{ width: LIST_WIDTH_PX, zIndex: Z_INDEX.panel }}
      initial={{ opacity: 0, x: POPOVER_OFFSET_PX }}
      animate={{ opacity: 1, x: 0, transition: ENTER_TRANSITION }}
      exit={{ opacity: 0, transition: EXIT_TRANSITION }}
    >
      {/* Trạng thái 7 chỉ đổi cách xếp phần đầu cho vừa khung hẹp — đúng khuôn
          `NotificationCenter.tsx`. Không mục nào bị ẩn, không ghim nào bị gỡ. */}
      <div
        className={cn(
          'flex gap-2',
          isCollapsed ? 'flex-col items-stretch' : 'items-center justify-between',
        )}
      >
        <h2 id={titleId} className="text-[15px] font-semibold leading-[20px] text-text-primary">
          {LIST_LABEL}
        </h2>
        <IconButton
          icon={<X size={16} />}
          aria-label={CLOSE_LIST_LABEL}
          size="sm"
          tooltip={false}
          onClick={onClose}
        />
      </div>

      {!canWrite && (
        <p className="text-[13px] leading-[18px] text-text-muted">{READ_ONLY_NOTICE}</p>
      )}

      {comments.length === 0 ? (
        <p className="text-[13px] leading-[18px] text-text-secondary">{EMPTY_LIST_MESSAGE}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {comments.map((comment) => (
            <li key={comment.id}>
              {/* Bấm một dòng là đưa vào khung hình; phần camera R-07 do hook lo. */}
              <button
                type="button"
                onClick={() => {
                  onFrameComment(comment.id);
                }}
                className={cn(
                  'flex w-full flex-col gap-1 rounded-md px-2 py-2 text-left',
                  ROW_FOCUS_STYLES,
                )}
              >
                <span className="text-[15px] leading-[20px] text-text-primary">
                  {OBJECT_LABEL} <code className="font-mono">{comment.objectId}</code>
                </span>
                <span className="text-[13px] leading-[18px] text-text-muted">
                  {statusLabelOf(comment.isResolved)}
                  {' · '}
                  {replyLabelOf(comment.replyCount)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </motion.aside>
  );
}

/* --- Lớp bình luận. --- */

export interface CommentThreadProps {
  /** `comments === false` thì cả lớp này rời khỏi DOM. */
  readonly capabilities: CollaborationCapabilities;
  readonly comments: readonly CommentPinVm[];
  /** `false` = trạng thái 6: xem bình luận, không viết. */
  readonly canWrite: boolean;
  /** Trạng thái 7. Ghim GIỮ NGUYÊN — xem phần đầu file. */
  readonly isCollapsed: boolean;
  readonly onFrameComment: (commentId: string) => void;
}

export function CommentThread({
  capabilities,
  comments,
  canWrite,
  isCollapsed,
  onFrameComment,
}: CommentThreadProps) {
  const [openCommentId, setOpenCommentId] = useState<string | null>(null);
  const [isListOpen, setIsListOpen] = useState(false);
  const pinLayerRef = useRef<HTMLDivElement | null>(null);

  const hasComments = capabilities.comments;
  const openComment = comments.find((comment) => comment.id === openCommentId) ?? null;

  /* Ghim biến mất khỏi props thì bóng đang mở phải đóng theo, không treo lại id. */
  useEffect(() => {
    if (openCommentId !== null && openComment === null) {
      setOpenCommentId(null);
    }
  }, [openCommentId, openComment]);

  /* Bấm ra ngoài thì đóng bóng — cùng khuôn `hooks/useSelect.ts:90-106`. Ghim và
     bóng cùng nằm trong `pinLayerRef` nên không bị đóng oan; bấm lại chính ghim
     đang mở là đóng, việc đó do `togglePin` lo. */
  useEffect(() => {
    if (openCommentId === null) {
      return undefined;
    }

    const closeOnOutside = (event: MouseEvent): void => {
      const layer = pinLayerRef.current;

      if (layer !== null && !layer.contains(event.target as Node)) {
        setOpenCommentId(null);
      }
    };

    document.addEventListener('mousedown', closeOnOutside);

    return (): void => {
      document.removeEventListener('mousedown', closeOnOutside);
    };
  }, [openCommentId]);

  /*
    A12: Esc đóng lớp trên cùng — bóng trước, rồi tới danh sách. Đúng MỘT đăng
    ký cho cả hai, vì hai đăng ký cùng phím trong cùng tầng sẽ bị registry báo
    trùng. Tầng `canvas` chứ không phải `dialog`: không lớp nào ở đây khoá bàn
    phím sau lưng nó, và tấm xung đột đăng ký Esc ở `sidePanel` — ưu tiên cao
    hơn — nên khi nó mở thì Esc thuộc về nó trước, đúng nghĩa "lớp trên cùng".
  */
  useShortcut(
    {
      id: 'canvas.collaborationComments.close',
      combo: 'Escape',
      scope: 'canvas',
      description: ESC_DESCRIPTION,
      onTrigger: (): void => {
        if (openCommentId !== null) {
          setOpenCommentId(null);
          return;
        }

        setIsListOpen(false);
      },
    },
    { enabled: hasComments && (openCommentId !== null || isListOpen) },
  );

  const togglePin = (commentId: string): void => {
    setOpenCommentId((current) => (current === commentId ? null : commentId));
  };

  if (!hasComments) {
    return null;
  }

  return (
    <>
      <div
        ref={pinLayerRef}
        role="group"
        aria-label={PINS_LAYER_LABEL}
        className="pointer-events-none absolute inset-0"
        style={{ zIndex: Z_INDEX.canvasOverlay }}
      >
        {comments.map((comment) => (
          <CommentPin
            key={comment.id}
            comment={comment}
            isOpen={comment.id === openCommentId}
            onToggle={togglePin}
          />
        ))}

        <AnimatePresence>
          {openComment !== null && (
            <CommentPopover
              key={openComment.id}
              comment={openComment}
              canWrite={canWrite}
              onClose={() => {
                setOpenCommentId(null);
              }}
              onFrameComment={(commentId) => {
                onFrameComment(commentId);
                setOpenCommentId(null);
              }}
            />
          )}
        </AnimatePresence>
      </div>

      <div
        className="pointer-events-auto absolute right-4 top-4"
        style={{ zIndex: Z_INDEX.canvasOverlay }}
      >
        <Button
          variant="secondary"
          size="sm"
          iconBefore={<MessageSquare size={16} />}
          aria-expanded={isListOpen}
          onClick={() => {
            setIsListOpen((current) => !current);
          }}
        >
          {isListOpen ? CLOSE_LIST_LABEL : OPEN_LIST_LABEL}
        </Button>
      </div>

      <AnimatePresence>
        {isListOpen && (
          <CommentList
            key="comment-list"
            comments={comments}
            canWrite={canWrite}
            isCollapsed={isCollapsed}
            onClose={() => {
              setIsListOpen(false);
            }}
            onFrameComment={onFrameComment}
          />
        )}
      </AnimatePresence>
    </>
  );
}
