/**
 * Tab "Thay đổi" — diff có cấu trúc, gộp theo loại thực thể.
 *
 * Tab này đứng TRƯỚC tab "JSON" và đó là một cấm tuyệt đối của đặc tả, không phải thứ tự
 * tình cờ: mọi thay đổi phải được mô tả bằng tiếng thường trước khi ai đó nhìn thấy JSON thô.
 *
 * Màn KHÔNG tự so dữ liệu và KHÔNG tự ghép câu. `model.groups` đã được hook gộp sẵn, và
 * `row.sentence` ("Tường #W-014: độ dày 110 mm → 220 mm") do `formatChange` sinh — ở đây chỉ
 * còn việc render nó. Tự ghép câu ở tầng view là tự quy đổi đơn vị ở tầng view (R-61,
 * `local/no-raw-number`), và là một bản dịch thứ hai sẽ lệch với bản thứ nhất.
 *
 * Nền hàng đi qua {@link DiffTint}: một lớp `aria-hidden` RIÊNG mang `backgroundColor` +
 * `opacity`, không phải một class Tailwind. Lý do đo được, không phải sở thích — xem docblock
 * của `DIFF_TINT_OPACITY` trong `./types`.
 */

import { useEffect, useRef, type KeyboardEvent } from 'react';
import { FileCheck2 } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { cn } from '@/lib/utils';

import { planEntityIdOf } from './versionHistoryPlan';
import { DIFF_TINT_OPACITY, DIFF_TONE_TOKENS } from './types';
import type { DiffGroupModel, DiffRowModel, DiffTone } from './types';

/* -------------------------------------------------------------------------- */
/* Chuỗi tiếng Việt tĩnh — khớp `compare.vi.json.fragment`.                     */
/* -------------------------------------------------------------------------- */

const NO_CHANGE_TITLE = 'Không có khác biệt';
const NO_CHANGE_BODY = 'Hai phiên bản đang chọn giống nhau ở mọi đối tượng.';
const GROUPS_LABEL = 'Danh sách thay đổi theo loại đối tượng';

/**
 * Nền 8% của một hàng diff.
 *
 * Phần tử RIÊNG, không phải `opacity` đặt lên cả hàng: đặt lên cả hàng thì chữ cũng mờ theo
 * và A13 (tương phản 4,5:1) hỏng ngay. Chép khuôn `ThicknessHistogram.tsx:294-303`.
 *
 * Xuất ra ngoài vì tab "JSON" tô nền bằng đúng cơ chế này; hai bản chép tay của cùng một cơ
 * chế là một bản sẽ lệch.
 */
export function DiffTint({ tone }: { readonly tone: DiffTone }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0"
      style={{ backgroundColor: DIFF_TONE_TOKENS[tone], opacity: DIFF_TINT_OPACITY }}
    />
  );
}

interface RowWiring {
  readonly onHover: (entityId: string | null) => void;
  /** Có thì bấm/Enter/Space ghim hàng (tab "Trực quan"); bấm lại thì bỏ ghim. */
  readonly onPick?: ((entityId: string) => void) | undefined;
  readonly pinnedEntityId?: string | null | undefined;
}

interface DiffRowItemProps extends RowWiring {
  readonly row: DiffRowModel;
}

/**
 * Một hàng diff.
 *
 * Trỏ chuột vào hàng và đưa bàn phím vào hàng làm CÙNG một việc: A12 nói bàn phím là đường đi
 * hạng nhất, nên tô sáng đối tượng ở tab "Trực quan" không được là đặc quyền của con trỏ.
 */
function DiffRowItem({ row, onHover, onPick, pinnedEntityId = null }: DiffRowItemProps) {
  // Mã đầu tường `V-W1-start` và mã tường `W1` là cùng một hình trên mặt bằng.
  const isPinned = pinnedEntityId !== null && planEntityIdOf(pinnedEntityId) === planEntityIdOf(row.entityId);
  const ref = useRef<HTMLLIElement>(null);

  // Ghim từ hình trên mặt bằng ⇒ đưa hàng vào tầm nhìn (hai chiều hình ↔ danh sách).
  useEffect(() => {
    if (isPinned) {
      ref.current?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [isPinned]);

  return (
    <li
      ref={ref}
      tabIndex={0}
      data-entity-id={row.entityId}
      data-pinned={isPinned ? 'true' : undefined}
      aria-current={isPinned ? 'true' : undefined}
      className={cn(
        'relative overflow-hidden rounded-md px-3 py-2',
        'outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
        onPick !== undefined && 'cursor-pointer',
        isPinned && 'ring-2 ring-accent',
      )}
      onPointerEnter={() => onHover(row.entityId)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(row.entityId)}
      onBlur={() => onHover(null)}
      {...(onPick === undefined
        ? {}
        : {
            onClick: () => onPick(row.entityId),
            onKeyDown: (event: KeyboardEvent<HTMLLIElement>) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onPick(row.entityId);
              }
            },
          })}
    >
      <DiffTint tone={row.tone} />
      <p className="relative text-[14px] leading-relaxed text-text-primary">{row.sentence}</p>
    </li>
  );
}

interface DiffGroupSectionProps extends RowWiring {
  readonly group: DiffGroupModel;
}

function DiffGroupSection({ group, ...wiring }: DiffGroupSectionProps) {
  return (
    <section aria-label={`${group.heading} — ${group.countLabel}`}>
      <h4 className="mb-2 flex items-baseline gap-2">
        <span className="text-[14px] font-medium text-text-primary">{group.heading}</span>
        <span className="text-[13px] tabular-nums text-text-secondary">{group.countLabel}</span>
      </h4>
      <ul className="flex flex-col gap-1">
        {group.rows.map((row) => (
          <DiffRowItem key={row.id} row={row} {...wiring} />
        ))}
      </ul>
    </section>
  );
}

export interface VersionDiffGroupsProps {
  readonly groups: readonly DiffGroupModel[];
  /** `actions.hoverDiffRow` — `null` khi con trỏ hoặc tiêu điểm rời hàng. */
  readonly onHoverRow: (entityId: string | null) => void;
  /** `actions.pinDiffRow` — chỉ tab "Trực quan" truyền, nơi ghim làm nổi hình trên mặt bằng. */
  readonly onPickRow?: ((entityId: string) => void) | undefined;
  readonly pinnedEntityId?: string | null | undefined;
}

export function VersionDiffGroups({ groups, onHoverRow, onPickRow, pinnedEntityId }: VersionDiffGroupsProps) {
  if (groups.length === 0) {
    return (
      <EmptyState
        icon={<FileCheck2 className="text-text-tertiary" />}
        title={NO_CHANGE_TITLE}
        description={NO_CHANGE_BODY}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6" aria-label={GROUPS_LABEL} role="group">
      {groups.map((group) => (
        <DiffGroupSection
          key={group.entityType}
          group={group}
          onHover={onHoverRow}
          onPick={onPickRow}
          pinnedEntityId={pinnedEntityId}
        />
      ))}
    </div>
  );
}
