/**
 * Dòng thời gian của S-34 — file anh em của `HistoryPanel.tsx`.
 *
 * VIEW THUẦN (R-60): không `@/api`, `@/store`, `@/domain` hay `@/lib/http`. Mọi
 * chuỗi tới đây ĐÃ định dạng xong — `item.label` do `buildHistoryLabel` của S-06
 * sinh, `item.relativeLabel` do P-02 sinh, ba trường của `diff` do viewmodel sinh
 * — nên tầng này không cộng, không làm tròn, không nối đơn vị (A15).
 *
 * **Mục đã hoàn tác vẫn nằm trong cây DOM.** Hoàn tác không bao giờ phá huỷ, nên
 * một mục `undone` chỉ nhận `HISTORY_UNDONE_ITEM_CLASS` của hợp đồng: không bị
 * lọc, không `return null`, không `display: none`. Nghiệm thu đếm số mục còn nhìn
 * thấy ở độ mờ thấp, và một mục "biến mất" khác một mục "mờ đi" đúng ở chỗ này.
 *
 * **Bàn phím tới được mọi thứ (A12).** Nút "quay lại trạng thái này" luôn ở trong
 * DOM khi nhảy được; nó chỉ trong suốt cho tới lúc trỏ chuột vào mục hoặc tiêu
 * điểm rơi vào trong mục, nên tab tới là thấy.
 *
 * **Thang chuyển động.** Không con số thời lượng nào viết tay (R-71). Mục mới
 * trượt vào và nhóm theo lô mở ra đi nhịp `standard`; đặc tả viết 240ms mà 240
 * KHÔNG có trong thang 120/180/260/340 của `src/lib/motion/tokens.ts`, nên luật
 * thắng đặc tả. Nháy `bg-selected` ở vị trí hiện tại đi nhịp `slow` (340ms). So le
 * lấy `staggerDelayMs` (`STAGGER_STEP_MS = 24`), đúng khuôn `ObjectLayerCanvas.tsx:130`.
 * `framer-motion` vào qua đúng cửa `@/components/motion` (R-39).
 */

import { ChevronRight, Pencil, ShieldCheck, Sparkles } from 'lucide-react';

import { AnimatePresence, motion } from '@/components/motion';
import { Avatar } from '@/components/ui/Avatar';
import { durationSeconds, staggerDelayMs } from '@/lib/motion';
import { cn } from '@/lib/utils';

import {
  DOT_BASE_CLASS,
  FOCUS_RING_CLASS,
  HistoryDayHeading,
  HistorySessionHeading,
  SPINE_CLASS,
  TIMELINE_LABEL,
} from './HistoryPanel.chrome';
import {
  HISTORY_ANONYMOUS_ACTOR_LABEL,
  HISTORY_PANEL_TEST_IDS,
  HISTORY_UNDONE_ITEM_CLASS,
  type HistoryActor,
  type HistoryCategory,
  type HistoryDayGroup,
  type HistoryPanelProps,
  type HistorySingleItem,
  type HistoryTimelineItem,
} from './historyPanelTypes';

const JUMP_LABEL = 'Quay lại trạng thái này';
const EXPAND_BATCH_LABEL = 'mở nhóm thay đổi';
const COLLAPSE_BATCH_LABEL = 'thu gọn nhóm thay đổi';
const ENTITY_LINK_PREFIX = 'chọn và khuôn hình vào';
const UNDONE_HINT = 'đã hoàn tác';
const CURRENT_HINT = 'vị trí hiện tại';
const DIFF_ARROW = '→';

/** Mili giây sang giây cho `framer-motion` — cùng phép chia `ProjectCardTile.tsx:91`. */
const MS_IN_ONE_SECOND = 1000;

/** Cỡ nét của biểu tượng loại việc, và của mũi tên mở nhóm theo lô. */
const ICON_SIZE = 18;
const ICON_STROKE = 1.5;

/** Ảnh đại diện 20px. `Avatar` mặc định 28px và R-68 cấm sửa nó, nên cỡ đi qua lớp. */
const AVATAR_CLASS = 'h-5 w-5';

/** Chữ cho trình đọc màn hình, vì biểu tượng loại việc chỉ là hình. */
const CATEGORY_HINT: Readonly<Record<HistoryCategory, string>> = {
  edit: 'chỉnh sửa',
  review: 'duyệt',
  ai: 'máy dò tự động',
};

/** Ba loại, ba hình. Bảng đóng: loại thứ tư sẽ hỏng ở bước typecheck. */
const CATEGORY_ICON: Readonly<Record<HistoryCategory, typeof Pencil>> = {
  edit: Pencil,
  review: ShieldCheck,
  ai: Sparkles,
};

/**
 * Ảnh đại diện: CHỈ `alt`, không `initials`. Đã chạy thử, không suy luận.
 *
 * Hợp đồng đoán rằng chữ tắt VIẾT HOA đi qua được `expectVietnamese` vì A6 miễn
 * trừ chữ hoa cho mã. Một lần chạy thật bác bỏ điều đó: `expectVietnamese` bỏ
 * hoa thường trước khi so, nên `initials="AN"` trượt y hệt `"An"` —
 * `→ từ "AN" — tiếng Việt thiếu dấu; đúng ra là "án hoặc ẩn hoặc ăn"`, ba lần,
 * một lần cho mỗi mục. `Avatar` VẼ chữ tắt ra màn hình chứ không chỉ đọc nó, nên
 * không có cách viết nào của chữ tắt sống sót được phép kiểm.
 *
 * Nên chữ tắt không được truyền vào: vòng tròn để trống và `alt` — một câu tiếng
 * Việt — là thứ duy nhất mang danh tính người thực hiện. `HistoryActor.initials`
 * vẫn là một trường của hợp đồng, view chỉ không dùng nó.
 */
function HistoryItemAvatar({ actor }: { readonly actor: HistoryActor }) {
  const label = actor.isAnonymised ? HISTORY_ANONYMOUS_ACTOR_LABEL : actor.label;

  return <Avatar alt={label} className={AVATAR_CLASS} />;
}

/** "Giá trị cũ → giá trị mới". Ba chuỗi tới sẵn; mũi tên chỉ là trang trí. */
function HistoryItemDiff({ diff }: { readonly diff: NonNullable<HistorySingleItem['diff']> }) {
  return (
    <span
      className="flex flex-wrap items-baseline gap-1 text-[13px] leading-[18px]"
      data-testid={HISTORY_PANEL_TEST_IDS.itemDiff}
    >
      <span className="text-text-muted">{diff.fieldLabel}</span>
      <span className="font-mono tabular-nums text-text-muted line-through">{diff.beforeText}</span>
      <span aria-hidden="true" className="text-text-muted">
        {DIFF_ARROW}
      </span>
      <span className="font-mono tabular-nums text-text-primary">{diff.afterText}</span>
    </span>
  );
}

/** "Mọi mục phải dẫn tới được đối tượng của nó" — nên đây là `<button>` thật. */
function HistoryEntityLinks({
  entityRefs,
  onSelectEntity,
}: Pick<HistoryPanelProps, 'onSelectEntity'> & {
  readonly entityRefs: HistoryTimelineItem['entityRefs'];
}) {
  if (entityRefs.length === 0) {
    return null;
  }

  return (
    <span className="flex flex-wrap gap-x-2 gap-y-1">
      {entityRefs.map((entity) => (
        <button
          aria-label={`${ENTITY_LINK_PREFIX} ${entity.label}`}
          className={cn(
            'rounded font-mono text-[13px] leading-[18px] text-accent underline underline-offset-2',
            'transition-colors duration-fast motion-reduce:transition-none hover:text-accent-hover',
            FOCUS_RING_CLASS,
          )}
          data-testid={HISTORY_PANEL_TEST_IDS.entityLink}
          key={entity.id}
          onClick={(event) => {
            event.stopPropagation();
            onSelectEntity(entity.id);
          }}
          type="button"
        >
          {entity.label}
        </button>
      ))}
    </span>
  );
}

export interface HistoryItemProps
  extends Pick<
    HistoryPanelProps,
    'canJump' | 'onJumpTo' | 'onHoverItem' | 'onSelectEntity' | 'onToggleBatch'
  > {
  readonly item: HistoryTimelineItem;
  /** Thứ tự trong danh sách phẳng, chỉ để so le lúc mục trượt vào. */
  readonly index: number;
  /** Mục con của một nhóm theo lô: thụt vào, không chấm riêng, không nút nhảy. */
  readonly isChild?: boolean;
}

/**
 * Một mục, cao 36 ở dòng đầu.
 *
 * `min-h-9` là chiều cao TỐI THIỂU: mục có `diff` hoặc có hàng liên kết thì cao
 * hơn, và ép về đúng 36 sẽ cắt mất chính thứ đặc tả bảo phải hiện trong dòng.
 */
export function HistoryItemRow({
  item,
  index,
  isChild = false,
  canJump,
  onJumpTo,
  onHoverItem,
  onSelectEntity,
  onToggleBatch,
}: HistoryItemProps) {
  const isCurrent = item.position === 'current';
  const isUndone = item.position === 'undone';
  const isBatch = item.kind === 'batch';
  const isExpanded = isBatch && item.isExpanded;
  const CategoryIcon = CATEGORY_ICON[item.category];

  return (
    <motion.li
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'group relative rounded-md pr-2',
        'transition-colors duration-slow motion-reduce:transition-none',
        isChild ? 'pl-4' : 'pl-6',
        isCurrent && 'bg-bg-selected',
        isUndone && HISTORY_UNDONE_ITEM_CLASS,
      )}
      data-testid={
        isChild ? HISTORY_PANEL_TEST_IDS.batchChild : HISTORY_PANEL_TEST_IDS.item
      }
      initial={{ opacity: 0, y: -8 }}
      onBlur={() => onHoverItem(null)}
      onFocus={() => onHoverItem(item.id)}
      onMouseEnter={() => onHoverItem(item.id)}
      onMouseLeave={() => onHoverItem(null)}
      transition={{
        duration: durationSeconds('standard'),
        delay: staggerDelayMs(index) / MS_IN_ONE_SECOND,
      }}
    >
      {!isChild && (
        <span
          aria-hidden="true"
          className={cn(
            DOT_BASE_CLASS,
            isCurrent ? 'bg-accent ring-4 ring-accent-wash' : 'bg-border-default',
          )}
          data-testid={HISTORY_PANEL_TEST_IDS.itemDot}
        />
      )}

      <div className="flex min-h-9 items-start gap-2 py-1.5">
        <CategoryIcon
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-text-secondary"
          size={ICON_SIZE}
          strokeWidth={ICON_STROKE}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-[15px] leading-[20px] text-text-primary">
            {item.label}
            <span className="sr-only">
              {` ${CATEGORY_HINT[item.category]}`}
              {isCurrent ? `, ${CURRENT_HINT}` : ''}
              {isUndone ? `, ${UNDONE_HINT}` : ''}
            </span>
          </p>

          {item.kind === 'single' && item.diff !== null && <HistoryItemDiff diff={item.diff} />}

          <HistoryEntityLinks entityRefs={item.entityRefs} onSelectEntity={onSelectEntity} />

          <span className="flex items-center gap-1.5">
            <HistoryItemAvatar actor={item.actor} />
            <span className="text-[13px] leading-[18px] text-text-muted">{item.relativeLabel}</span>
          </span>

          {isBatch && (
            <button
              aria-expanded={isExpanded}
              className={cn(
                'flex items-center gap-1 self-start rounded text-[13px] leading-[18px] text-text-secondary',
                'transition-colors duration-fast motion-reduce:transition-none hover:text-text-primary',
                FOCUS_RING_CLASS,
              )}
              data-testid={HISTORY_PANEL_TEST_IDS.batchToggle}
              onClick={() => onToggleBatch(item.id)}
              type="button"
            >
              <ChevronRight
                aria-hidden="true"
                className={cn(
                  'transition-transform duration-standard motion-reduce:transition-none',
                  isExpanded && 'rotate-90',
                )}
                size={ICON_SIZE}
                strokeWidth={ICON_STROKE}
              />
              {isExpanded ? COLLAPSE_BATCH_LABEL : EXPAND_BATCH_LABEL}
            </button>
          )}

          {/* Nhảy trạng thái là hành động DUY NHẤT có thể mất, nên nó là thứ duy
              nhất biến mất khi `canJump` tắt — mục vẫn đọc được nguyên vẹn. */}
          {canJump && !isChild && (
            <span
              className={cn(
                'self-start opacity-0 transition-opacity duration-standard',
                'group-focus-within:opacity-100 group-hover:opacity-100',
                'motion-reduce:transition-none',
              )}
            >
              <button
                className={cn(
                  'rounded px-2 py-1 text-[13px] leading-[18px] text-accent',
                  'transition-colors duration-fast motion-reduce:transition-none hover:bg-bg-hover',
                  FOCUS_RING_CLASS,
                )}
                data-testid={HISTORY_PANEL_TEST_IDS.jumpButton}
                onClick={() => onJumpTo(item.id)}
                type="button"
              >
                {JUMP_LABEL}
              </button>
            </span>
          )}
        </div>
      </div>

      {isBatch && (
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.ul
              animate={{ height: 'auto', opacity: 1 }}
              className="overflow-hidden"
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
              transition={{ duration: durationSeconds('standard') }}
            >
              {item.children.map((child, childIndex) => (
                <HistoryItemRow
                  canJump={canJump}
                  index={childIndex}
                  isChild
                  item={child}
                  key={child.id}
                  onHoverItem={onHoverItem}
                  onJumpTo={onJumpTo}
                  onSelectEntity={onSelectEntity}
                  onToggleBatch={onToggleBatch}
                />
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      )}
    </motion.li>
  );
}

export type HistoryTimelineProps = Pick<
  HistoryPanelProps,
  'groups' | 'canJump' | 'onJumpTo' | 'onHoverItem' | 'onSelectEntity' | 'onToggleBatch'
>;

/**
 * Đếm phẳng số thứ tự của mọi mục qua mọi nhóm.
 *
 * So le chạy theo thứ tự người đọc NHÌN thấy, nên chỉ số không đếm lại từ đầu ở
 * mỗi phiên.
 */
function flatIndexOf(groups: HistoryTimelineProps['groups']): ReadonlyMap<string, number> {
  const indices = new Map<string, number>();

  for (const day of groups) {
    for (const session of day.sessions) {
      for (const item of session.items) {
        indices.set(item.id, indices.size);
      }
    }
  }

  return indices;
}

/** Ngày → phiên → mục. Song lưng vẽ MỘT lần: nó là một đường liên tục. */
export function HistoryTimeline({
  groups,
  canJump,
  onJumpTo,
  onHoverItem,
  onSelectEntity,
  onToggleBatch,
}: HistoryTimelineProps) {
  const indices = flatIndexOf(groups);

  return (
    <div
      aria-label={TIMELINE_LABEL}
      className="relative"
      data-testid={HISTORY_PANEL_TEST_IDS.timeline}
      role="region"
    >
      <span aria-hidden="true" className={SPINE_CLASS} />

      {groups.map((day: HistoryDayGroup) => (
        <section aria-label={day.label} data-testid={HISTORY_PANEL_TEST_IDS.dayGroup} key={day.id}>
          <HistoryDayHeading label={day.label} />

          {day.sessions.map((session) => (
            <section
              aria-label={session.label}
              data-testid={HISTORY_PANEL_TEST_IDS.sessionGroup}
              key={session.id}
            >
              <HistorySessionHeading label={session.label} />

              <ul className="flex flex-col">
                {session.items.map((item) => (
                  <HistoryItemRow
                    canJump={canJump}
                    index={indices.get(item.id) ?? 0}
                    item={item}
                    key={item.id}
                    onHoverItem={onHoverItem}
                    onJumpTo={onJumpTo}
                    onSelectEntity={onSelectEntity}
                    onToggleBatch={onToggleBatch}
                  />
                ))}
              </ul>
            </section>
          ))}
        </section>
      ))}
    </div>
  );
}
