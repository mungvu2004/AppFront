/**
 * Ba dải trên đầu panel thư viện: ô tìm, hàng chip nhóm, và mục "Đã phát hiện".
 *
 * Cả ba đều là view thuần lấy hết chữ từ props (R-60, A15) — không tra bảng
 * nhãn, không đếm, không định dạng. `FURNITURE_CATEGORY_LABELS` nằm trong hợp
 * đồng kiểu, nhưng hook mới là bên đọc nó: chip tới đây đã có sẵn `label`.
 *
 * ## Vì sao chip không phải `SegmentedControl` hay `Tabs`
 *
 * Mục 4 của `.notes/furniture-library/contract-ui.md` đã chốt: hàng chip cuộn
 * ngang, chọn được một nhóm, và nó KHÔNG phải một `tablist` — dựng bằng
 * `SegmentedControl`/`Tabs` sẽ kéo theo ngữ nghĩa roving focus của một
 * `role="tablist"`, mà `expectAccessible` xử đúng như thế: mọi mục bên trong
 * phải chuyển tiêu điểm bằng phím mũi tên chứ không phải bằng Tab. Chip ở đây
 * là nút thuần mang `aria-pressed`, nằm trong `role="group"` — nhóm không phải
 * container roving, nên Tab đi qua từng chip đúng như A12 hứa.
 *
 * ## "Thay thế tất cả" là hành động CHÌM
 *
 * A2: màu nhấn dành riêng cho thứ tương tác được, và một thao tác hàng loạt
 * không hoàn tác được thì không được mời gọi. Nên nút ở đây là `variant="ghost"`
 * cỡ `sm`, và bấm nó KHÔNG áp gì cả — nó chỉ mở hộp xem trước
 * (`replaceAllPreview`), đúng luật "xem trước rồi mới áp" (A9).
 */
import { Search } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

import { FURNITURE_CARD_FOCUS_RING } from './FurnitureLibraryPanelCard';
import type {
  DetectedFurnitureGroup,
  FurnitureCategoryChip,
} from './furnitureLibraryPanelTypes';

const SEARCH_LABEL = 'Tìm mô hình nội thất';
const SEARCH_PLACEHOLDER = 'Tìm mô hình nội thất…';
const CATEGORY_GROUP_LABEL = 'Nhóm nội thất';
const DETECTED_HEADING = 'Đã phát hiện';
const REPLACE_ALL_LABEL = 'Thay thế tất cả';

const CHIP_CLASS =
  'shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[13px] leading-[18px] ' +
  'transition-colors duration-instant motion-reduce:transition-none ' +
  FURNITURE_CARD_FOCUS_RING;

const CHIP_ACTIVE_CLASS = 'bg-bg-selected text-text-primary font-medium';
const CHIP_IDLE_CLASS = 'bg-bg-sunken text-text-secondary hover:bg-bg-hover';

export interface FurnitureLibrarySearchBoxProps {
  readonly value: string;
  readonly onChange: (nextValue: string) => void;
}

export function FurnitureLibrarySearchBox({
  value,
  onChange,
}: FurnitureLibrarySearchBoxProps): ReactNode {
  return (
    <Input
      type="search"
      value={value}
      onChange={(event): void => onChange(event.target.value)}
      aria-label={SEARCH_LABEL}
      placeholder={SEARCH_PLACEHOLDER}
      prefix={<Search className="h-4 w-4" aria-hidden="true" />}
    />
  );
}

export interface FurnitureCategoryChipRowProps {
  readonly chips: readonly FurnitureCategoryChip[];
}

export function FurnitureCategoryChipRow({ chips }: FurnitureCategoryChipRowProps): ReactNode {
  return (
    <div role="group" aria-label={CATEGORY_GROUP_LABEL} className="flex gap-2 overflow-x-auto pb-1">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          aria-pressed={chip.isActive}
          onClick={chip.onSelect}
          className={`${CHIP_CLASS} ${chip.isActive ? CHIP_ACTIVE_CLASS : CHIP_IDLE_CLASS}`}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}

export interface FurnitureDetectedGroupsProps {
  /** `null` khi tầng này chưa phát hiện lớp nào — khi đó dải không vẽ gì. */
  readonly groups: readonly DetectedFurnitureGroup[] | null;
}

export function FurnitureDetectedGroups({ groups }: FurnitureDetectedGroupsProps): ReactNode {
  if (groups === null || groups.length === 0) {
    return null;
  }

  return (
    <section aria-label={DETECTED_HEADING} className="flex flex-col gap-1">
      <h3 className="text-[13px] font-medium leading-[18px] text-text-secondary">
        {DETECTED_HEADING}
      </h3>
      <ul className="flex flex-col gap-1">
        {groups.map((group) => (
          <li
            key={group.id}
            className="flex items-center justify-between gap-2 rounded-lg bg-bg-sunken px-2 py-1"
          >
            <span className="truncate text-[13px] leading-[18px] text-text-primary">
              {group.label}
            </span>
            <Button variant="ghost" size="sm" onClick={group.onReplaceAll} className="shrink-0">
              {REPLACE_ALL_LABEL}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
