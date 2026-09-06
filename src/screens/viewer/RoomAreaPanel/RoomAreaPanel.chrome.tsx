/**
 * Các mảnh giao diện của panel 344 — file anh em của `RoomAreaPanel.tsx`.
 *
 * VIEW THUẦN (R-60), tách ra theo mục D của CLAUDE.md: `RoomAreaPanel.tsx` vượt
 * trần 400 dòng có nội dung của R-22, nên đầu panel, ô tổng, dải điều khiển,
 * thanh xếp chồng, khung xương và lời nhắc "một phần" chuyển sang đây, CÙNG thư
 * mục màn, và `RoomAreaPanel.tsx` giữ lại đúng bảy nhánh trạng thái.
 *
 * Chuỗi tĩnh của khung panel sống ở đây (phần thuộc về một hàng thì ở
 * `RoomAreaPanel.rows.tsx`); cả hai nhóm có bản sao trong
 * `RoomAreaPanel.vi.fragment.json` để worker lớp 3 gộp vào `src/i18n/vi.json`
 * (R-67) — màn này không tự sửa `vi.json`.
 *
 * Không mảnh nào ở đây tự định dạng một con số hay tự chọn một mã màu: chuỗi
 * tới qua props (A15), màu tới qua token (A1).
 */

import { Copy, Download, LayoutGrid } from 'lucide-react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import { useCountUp } from '@/hooks/useCountUp';
import { cn } from '@/lib/utils';

import type {
  RoomAreaBand,
  RoomAreaGrouping,
  RoomAreaLevelOption,
  RoomAreaPanelProps,
  RoomAreaSort,
  RoomAreaTone,
  RoomAreaTotals,
} from './roomAreaTypes';

/* -------------------------------------------------------------------------- */
/* Chuỗi tĩnh của panel. Bản sao nằm ở `RoomAreaPanel.vi.fragment.json`.        */
/* -------------------------------------------------------------------------- */

export const REGION_LABEL = 'Bảng diện tích phòng';
const LEVEL_SELECT_LABEL = 'Chọn tầng';
const TABLE_MODE_LABEL = 'mở chế độ bảng toàn trang';
const GROUPING_LABEL = 'Cách nhóm danh sách';
const GROUPING_BY_LEVEL = 'theo tầng';
const GROUPING_BY_USAGE = 'theo công năng';
const SORT_LABEL = 'Sắp xếp';
const SORT_BY_AREA = 'theo diện tích';
const SORT_BY_NAME = 'theo tên';
const SORT_BY_USAGE = 'theo loại';
const BANDS_LABEL = 'Phân bố diện tích theo loại phòng';
const COPY_AS_TEXT_LABEL = 'sao chép bảng';
const OPEN_EXPORT_LABEL = 'xuất bảng';
const LOADING_LABEL = 'Đang tính diện tích…';
export const EMPTY_TITLE = 'Chưa khép được vòng phòng nào';
export const EMPTY_DESCRIPTION =
  'Diện tích chỉ đo được khi các đoạn tường khép kín thành một vòng. Bản vẽ này còn khe hở giữa các đoạn tường nên chưa có phòng nào tính ra được số.';
export const EMPTY_ACTION_LABEL = 'Kiểm tra khe hở tường';
export const ERROR_TITLE = 'Không tính được diện tích';
export const RETRY_LABEL = 'Đo lại';
export const FORBIDDEN_TITLE = 'Không xem được diện tích';
export const FORBIDDEN_DESCRIPTION =
  'Vai của bạn trong dự án này chỉ xem được mô hình, chưa xem được bảng diện tích phòng.';
const PARTIAL_TITLE = 'Bảng mới có một phần';
const PARTIAL_MISSING_LEVELS_PREFIX = 'Các tầng sau chưa có diện tích: ';
const PARTIAL_UNNAMED_NOTE =
  ' Một số phòng chưa đặt tên; gõ thẳng vào ô tên trong dòng để đặt, bảng tự lưu.';
export const COLLAPSED_CAPTION = 'Năm phòng lớn nhất';
const LEVEL_WITHOUT_AREA_SUFFIX = ' (chưa có diện tích)';
const MISSING_LEVEL_SEPARATOR = ', ';

/**
 * Giá trị khi chưa tầng nào được chọn.
 *
 * `LegacySelectProps.value` khai `string` chứ không `string | undefined`, và
 * `exactOptionalPropertyTypes` của repo không cho truyền `undefined` vào đó. Một
 * chuỗi rỗng không khớp `id` tầng nào nên `Select` rơi về phần giữ chỗ của nó —
 * đúng thứ cần hiện khi `activeLevelId` là `null`.
 */
const NO_ACTIVE_LEVEL_VALUE = '';

/** Bao nhiêu hàng khung xương vẽ trong lúc chờ — sức chứa của panel, không phải ngưỡng. */
const SKELETON_ROW_COUNT = 6;

/** Sức chứa hàng của tấm trượt đáy ở trạng thái thu gọn. */
export const COLLAPSED_ROW_CAPACITY = 5;

/**
 * Khớp `AREA_DECIMALS` của `src/domain/rooms/area.ts:48` — view không nhập được
 * `src/domain` (R-60) nên con số đứng ở đây, đúng tiền lệ `MM_FRACTION_DIGITS`
 * của `AxisGridOriginPanel.tsx:51`. Nó chỉ nạp cho `useCountUp`, thứ tự gọi
 * `formatNumber` ở mọi khung hình — view vẫn không định dạng số nào.
 */
const AREA_FRACTION_DIGITS = 2;

/** Ba tông, ba token. Không quá ba màu dữ liệu trên thanh xếp chồng (PQ-9). */
const BAND_TONE_CLASS: Readonly<Record<RoomAreaTone, string>> = {
  'wall-strong': 'bg-wall-330',
  'wall-mid': 'bg-wall-220',
  neutral: 'bg-wall-idle',
};

const GROUPING_OPTIONS: readonly { readonly label: string; readonly value: RoomAreaGrouping }[] = [
  { label: GROUPING_BY_LEVEL, value: 'level' },
  { label: GROUPING_BY_USAGE, value: 'usage' },
];

const SORT_OPTIONS: readonly { readonly label: string; readonly value: RoomAreaSort }[] = [
  { label: SORT_BY_AREA, value: 'area' },
  { label: SORT_BY_NAME, value: 'name' },
  { label: SORT_BY_USAGE, value: 'usage' },
];

export const PANEL_CLASS =
  'flex h-full min-h-0 w-[344px] flex-col overflow-hidden rounded-xl bg-bg-surface shadow-panel';

/* -------------------------------------------------------------------------- */
/* Các mảnh của panel.                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Ô tổng: con số chữ đều cỡ lớn, đơn vị đứng riêng cạnh nó, caption ở dưới.
 *
 * `useCountUp` chạy số khi đổi tầng — `@/hooks/useCountUp` là lớp bọc React của
 * động cơ thuần `@/lib/motion/useCountUp`, và nó tự gọi `formatNumber` ở từng
 * khung hình nên view không hề định dạng. Khung hình lúc NGHỈ lấy thẳng
 * `totals.totalText` để chuỗi cuối cùng trùng khít cái hook đã tính, không phải
 * một bản làm tròn thứ hai.
 *
 * Tách thành hàm riêng vì `useCountUp` là một hook: nó không được gọi trong một
 * nhánh `switch`.
 */
export function RoomAreaTotalsBlock({ totals }: { totals: RoomAreaTotals }) {
  const running = useCountUp(totals.totalM2, {
    format: { fractionDigits: AREA_FRACTION_DIGITS },
  });

  return (
    <div className="px-4 pb-3">
      <p className="flex items-baseline gap-1.5">
        <span className="font-mono text-[24px] font-semibold leading-none tabular-nums text-text-primary">
          {running.done ? totals.totalText : running.text}
        </span>
        <span className="text-[14px] leading-none text-text-secondary">{totals.unitLabel}</span>
      </p>
      <p className="mt-1.5 text-[13px] leading-[18px] text-text-muted">{totals.caption}</p>
    </div>
  );
}

/** Thanh xếp chồng phân bố diện tích theo loại phòng, kèm chú dẫn đọc được. */
export function RoomAreaBandBar({ bands }: { bands: readonly RoomAreaBand[] }) {
  if (bands.length === 0) {
    return null;
  }

  return (
    <div className="px-4 pb-3">
      <p className="mb-1.5 text-[13px] leading-[18px] text-text-secondary">{BANDS_LABEL}</p>
      {/* `flexGrow` nhận thẳng tỷ lệ 0..1; `flexBasis: 0` là điều kiện để bề
          rộng chia đúng theo tỷ lệ mà không cần một phép nhân nào. */}
      <div aria-hidden="true" className="flex h-2 w-full overflow-hidden rounded-full bg-bg-sunken">
        {bands.map((band) => (
          <span
            className={BAND_TONE_CLASS[band.tone]}
            key={band.key}
            style={{ flexGrow: band.ratio, flexBasis: 0 }}
          />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {bands.map((band) => (
          <li className="flex items-center gap-1.5" key={band.key}>
            <span
              aria-hidden="true"
              className={cn('h-2 w-2 shrink-0 rounded-sm', BAND_TONE_CLASS[band.tone])}
            />
            <span className="text-[13px] leading-[18px] text-text-muted">{band.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Đầu panel: bộ chọn tầng và nút sang chế độ bảng toàn trang. */
export function RoomAreaPanelHeader({
  levels,
  activeLevelId,
  onLevelChange,
  onModeChange,
}: Pick<RoomAreaPanelProps, 'levels' | 'activeLevelId' | 'onLevelChange' | 'onModeChange'>) {
  return (
    <div className="flex items-end gap-2 px-4 pb-3 pt-4">
      <div className="min-w-0 flex-1">
        <Select
          label={LEVEL_SELECT_LABEL}
          onChange={(value) => onLevelChange(value as RoomAreaLevelOption['id'])}
          options={levels.map((level) => ({
            label: level.hasArea ? level.name : `${level.name}${LEVEL_WITHOUT_AREA_SUFFIX}`,
            value: level.id,
          }))}
          value={activeLevelId ?? NO_ACTIVE_LEVEL_VALUE}
        />
      </div>
      <IconButton
        aria-label={TABLE_MODE_LABEL}
        icon={<LayoutGrid />}
        onClick={() => onModeChange('table')}
      />
    </div>
  );
}

/** Dải đổi cách nhóm và select sắp xếp. */
export function RoomAreaPanelControls({
  grouping,
  onGroupingChange,
  sort,
  onSortChange,
}: Pick<RoomAreaPanelProps, 'grouping' | 'onGroupingChange' | 'sort' | 'onSortChange'>) {
  return (
    <div className="flex flex-col gap-2 px-4 pb-3">
      <SegmentedControl
        aria-label={GROUPING_LABEL}
        onChange={onGroupingChange}
        options={[...GROUPING_OPTIONS]}
        value={grouping}
      />
      <Select
        label={SORT_LABEL}
        onChange={(value) => onSortChange(value as RoomAreaSort)}
        options={[...SORT_OPTIONS]}
        value={sort}
      />
    </div>
  );
}

/** Chân panel: sao chép dạng văn bản, và sang S-34 để xuất tệp. */
export function RoomAreaPanelFooter({
  onCopyAsText,
  onOpenExport,
}: Pick<RoomAreaPanelProps, 'onCopyAsText' | 'onOpenExport'>) {
  return (
    <div className="flex shrink-0 gap-2 border-t border-border-default px-4 py-3">
      <Button
        fullWidth
        iconBefore={<Copy size={16} />}
        onClick={onCopyAsText}
        size="sm"
        variant="secondary"
      >
        {COPY_AS_TEXT_LABEL}
      </Button>
      <Button
        fullWidth
        iconBefore={<Download size={16} />}
        onClick={onOpenExport}
        size="sm"
        variant="primary"
      >
        {OPEN_EXPORT_LABEL}
      </Button>
    </div>
  );
}

/** Khung xương lúc chờ: các hàng, CỘNG một khung xương cho ô tổng. */
export function RoomAreaPanelSkeleton() {
  return (
    <div aria-busy="true" aria-label={LOADING_LABEL} className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pb-3 pt-4">
        <div className="h-6 w-32 animate-pulse rounded-lg bg-bg-sunken motion-reduce:animate-none" />
        <div className="mt-2 h-4 w-48 animate-pulse rounded bg-bg-sunken motion-reduce:animate-none" />
      </div>
      <div className="flex flex-col gap-1 px-2">
        {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
          <Skeleton key={index} preset="table-row" />
        ))}
      </div>
    </div>
  );
}

/**
 * Lời nhắc của trạng thái "một phần": gọi TÊN các tầng còn thiếu diện tích, và
 * nói ra chuyện còn phòng chưa đặt tên.
 */
export function RoomAreaPartialNotice({
  missingLevelNames,
  hasUnnamedRoom,
}: {
  readonly missingLevelNames: readonly string[];
  readonly hasUnnamedRoom: boolean;
}) {
  if (missingLevelNames.length === 0 && !hasUnnamedRoom) {
    return null;
  }

  const missingSentence =
    missingLevelNames.length === 0
      ? ''
      : `${PARTIAL_MISSING_LEVELS_PREFIX}${missingLevelNames.join(MISSING_LEVEL_SEPARATOR)}.`;

  return (
    <div className="px-4 pb-3">
      <InlineAlert
        level="attention"
        message={`${missingSentence}${hasUnnamedRoom ? PARTIAL_UNNAMED_NOTE : ''}`.trim()}
        title={PARTIAL_TITLE}
      />
    </div>
  );
}

