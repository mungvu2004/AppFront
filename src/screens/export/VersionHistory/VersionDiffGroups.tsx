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

import { FileCheck2 } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { cn } from '@/lib/utils';

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

interface DiffRowItemProps {
  readonly row: DiffRowModel;
  readonly onHover: (entityId: string | null) => void;
}

/**
 * Một hàng diff.
 *
 * Trỏ chuột vào hàng và đưa bàn phím vào hàng làm CÙNG một việc: A12 nói bàn phím là đường đi
 * hạng nhất, nên tô sáng đối tượng ở tab "Trực quan" không được là đặc quyền của con trỏ.
 */
function DiffRowItem({ row, onHover }: DiffRowItemProps) {
  return (
    <li
      tabIndex={0}
      className={cn(
        'relative overflow-hidden rounded-md px-3 py-2',
        'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
      )}
      onPointerEnter={() => onHover(row.entityId)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(row.entityId)}
      onBlur={() => onHover(null)}
    >
      <DiffTint tone={row.tone} />
      <p className="relative text-[14px] leading-relaxed text-text-primary">{row.sentence}</p>
    </li>
  );
}

interface DiffGroupSectionProps {
  readonly group: DiffGroupModel;
  readonly onHover: (entityId: string | null) => void;
}

function DiffGroupSection({ group, onHover }: DiffGroupSectionProps) {
  return (
    <section aria-label={`${group.heading} — ${group.countLabel}`}>
      <h4 className="mb-2 flex items-baseline gap-2">
        <span className="text-[14px] font-medium text-text-primary">{group.heading}</span>
        <span className="text-[13px] tabular-nums text-text-secondary">{group.countLabel}</span>
      </h4>
      <ul className="flex flex-col gap-1">
        {group.rows.map((row) => (
          <DiffRowItem key={row.id} row={row} onHover={onHover} />
        ))}
      </ul>
    </section>
  );
}

export interface VersionDiffGroupsProps {
  readonly groups: readonly DiffGroupModel[];
  /** `actions.hoverDiffRow` — `null` khi con trỏ hoặc tiêu điểm rời hàng. */
  readonly onHoverRow: (entityId: string | null) => void;
}

export function VersionDiffGroups({ groups, onHoverRow }: VersionDiffGroupsProps) {
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
        <DiffGroupSection key={group.entityType} group={group} onHover={onHoverRow} />
      ))}
    </div>
  );
}
