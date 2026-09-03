/**
 * Bảng chi tiết 48 đoạn của màn "Chuẩn hoá độ dày tường" (2.3 của brief T7).
 * Cột: mã · độ dày đo được · độ dày chuẩn hoá (`SegmentedControl` trong ô) ·
 * sai lệch (chấm cần chú ý khi vượt dung sai) · độ tin cậy · tầng · trạng
 * thái, cộng cột chọn hàng theo lô ở đầu bảng.
 *
 * VIEW THUẦN — nhận đúng `ThicknessSegmentTableProps` (T4 khai, MỞ RỘNG theo
 * quyết định điều phối viên — xem ghi chú tại khai báo trong `thicknessTypes.ts`
 * và `worker_done` của T7). Mọi thay đổi chỉ đi ra qua các `on...`; view không
 * tự áp gì, không tự đặt hẹn giờ tắt nháy (`flashingWallIds` do hook giữ).
 *
 * ## Vì sao `tabIndex={undefined}` trên mọi `Table.Row`
 *
 * Bẫy R-72 (`docs/notes/thickness/ui.md` mục 1): `Table.Row` luôn mang
 * `tabindex="-1"` mặc định cộng `outline-none`, chỉ vẽ vòng tiêu điểm khi
 * `focused` được đặt tay — nếu không, `expectAccessible` báo lỗi `focus-ring`
 * cho MỌI hàng vì bộ chọn "phần tử nhận được tiêu điểm" khớp bất kỳ thứ gì
 * mang thuộc tính `tabindex`, kể cả `-1`. Hàng ở bảng này không cần tự nhận
 * tiêu điểm — ô chọn, `SegmentedControl`, và các điều khiển khác bên trong đã
 * tự có vòng tiêu điểm riêng — nên xoá hẳn thuộc tính đó là đúng ngữ nghĩa.
 *
 * ## Đổi độ dày theo lô cần chọn nhóm trước khi áp
 *
 * `TableActionBar.onChangeThickness` không mang tham số, nhưng
 * `onApplySelectedGroup(group)` cần biết áp NHÓM NÀO. Bấm "Đổi độ dày" chỉ mở
 * một bảng chọn nhóm cục bộ (state thuần của view, đúng khuôn
 * `FloorTable.tsx` — `duplicatingFloorId`/`copyFurniture`); bấm "Áp dụng"
 * trong đó mới thật sự gọi `onApplySelectedGroup`. Không dựng component mới —
 * chỉ ghép `SegmentedControl` + `Button` đã có sẵn.
 */

import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfidenceMeter } from '@/components/ui/ConfidenceMeter';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Table } from '@/components/ui/Table';
import { TableActionBar } from '@/components/ui/TableActionBar';
import { cn } from '@/lib/utils';
import type { ViewStatusCode } from '@/lib/viewmodel/types';

import {
  THICKNESS_GROUP_DISPLAY_ORDER,
  THICKNESS_GROUP_LABELS,
  type ThicknessGroup,
  type ThicknessSegmentTableProps,
  type ThicknessSortKey,
} from './thicknessTypes';

const HEADER_CODE = 'Mã';
const HEADER_MEASURED = 'Độ dày đo được';
const HEADER_NORMALIZED = 'Độ dày chuẩn hoá';
const HEADER_DEVIATION = 'Sai lệch';
const HEADER_CONFIDENCE = 'Độ tin cậy';
const HEADER_FLOOR = 'Tầng';
const HEADER_STATUS = 'Trạng thái';
const EMPTY_MESSAGE = 'Chưa có đoạn tường nào để chuẩn hoá.';
const ENTITY_NAME = 'tường';
const COLUMN_COUNT = 8;
const CHOOSE_GROUP_LABEL = 'Chọn nhóm áp cho các đoạn đã chọn';
const CANCEL_LABEL = 'Huỷ';
const APPLY_LABEL = 'Áp dụng';

/** Nhãn tiếng Việt của `ViewStatusCode` — tái dùng mã, chỉ thêm chữ hiển thị (A4/A6). */
const STATUS_LABELS: Readonly<Record<ViewStatusCode, string>> = {
  verified: 'đã duyệt',
  attention: 'cần chú ý',
  violation: 'vi phạm',
  neutral: 'trung tính',
};

/** Hướng sắp cố định theo cột — `deviation` để trường hợp tệ nhất nổi lên đầu. */
const SORT_DIRECTION: Readonly<Record<ThicknessSortKey, 'asc' | 'desc'>> = {
  deviation: 'desc',
  measured: 'asc',
  confidence: 'asc',
  floor: 'asc',
};

/**
 * `SegmentedControl<T extends string>` chỉ nhận `value` kiểu chuỗi, nhưng
 * `ThicknessGroup` (= `WallThickness`) là `110 | 220 | 330 | 'CONCRETE_COLUMN'`
 * — ba số cộng một chuỗi. Hai bảng tra dưới đây là ranh giới chuyển đổi DUY
 * NHẤT giữa hai kiểu đó; `noUncheckedIndexedAccess` không đòi `| undefined`
 * ở đây vì cả hai phía đều được index bằng ĐÚNG union khoá của chính nó
 * (không phải `string` chung chung).
 */
type ThicknessGroupKey = '110' | '220' | '330' | 'CONCRETE_COLUMN';

const GROUP_KEY_OF: Readonly<Record<ThicknessGroup, ThicknessGroupKey>> = {
  110: '110',
  220: '220',
  330: '330',
  CONCRETE_COLUMN: 'CONCRETE_COLUMN',
};

const GROUP_OF_KEY: Readonly<Record<ThicknessGroupKey, ThicknessGroup>> = {
  '110': 110,
  '220': 220,
  '330': 330,
  CONCRETE_COLUMN: 'CONCRETE_COLUMN',
};

const GROUP_OPTIONS = THICKNESS_GROUP_DISPLAY_ORDER.map((group) => ({
  label: THICKNESS_GROUP_LABELS[group],
  value: GROUP_KEY_OF[group],
}));

/** Nhóm mặc định của bảng chọn nhóm theo lô trước khi người dùng tự chọn. */
const DEFAULT_GROUP_KEY: ThicknessGroupKey = '110';

const segmentedControlLabel = (code: string): string => `Độ dày chuẩn hoá của đoạn ${code}`;

const chooseGroupPrompt = (count: number): string => `Chọn nhóm áp cho ${count} tường đã chọn:`;

export function ThicknessSegmentTable({
  rows,
  sortKey,
  onChangeSortKey,
  hoveredWallId,
  onHoverRow,
  selectedWallIds,
  onToggleRowSelected,
  onToggleAllSelected,
  onClearSelection,
  onChangeNormalizedGroup,
  onApplySelectedGroup,
  flashingWallIds,
}: ThicknessSegmentTableProps) {
  const [isPickingGroup, setIsPickingGroup] = useState(false);
  const [pendingGroupKey, setPendingGroupKey] = useState<ThicknessGroupKey>(DEFAULT_GROUP_KEY);

  const selected = new Set(selectedWallIds);
  const flashing = new Set(flashingWallIds);
  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && !allSelected;

  const handleSort = (key: string): void => onChangeSortKey(key as ThicknessSortKey);

  const closeGroupPicker = (): void => setIsPickingGroup(false);

  const handleDeselect = (): void => {
    closeGroupPicker();
    onClearSelection();
  };

  const handleApplyGroup = (): void => {
    onApplySelectedGroup(GROUP_OF_KEY[pendingGroupKey]);
    closeGroupPicker();
  };

  return (
    <div className="relative h-full">
      <Table.Root
        onSort={handleSort}
        sortDir={SORT_DIRECTION[sortKey]}
        sortKey={sortKey}
      >
        <Table.Header>
          <Table.Row tabIndex={undefined}>
            <Table.CheckboxHead checked={allSelected} indeterminate={someSelected} onChange={onToggleAllSelected} />
            <Table.Head>{HEADER_CODE}</Table.Head>
            <Table.Head sortKey="measured">{HEADER_MEASURED}</Table.Head>
            <Table.Head>{HEADER_NORMALIZED}</Table.Head>
            <Table.Head sortKey="deviation">{HEADER_DEVIATION}</Table.Head>
            <Table.Head sortKey="confidence">{HEADER_CONFIDENCE}</Table.Head>
            <Table.Head sortKey="floor">{HEADER_FLOOR}</Table.Head>
            <Table.Head>{HEADER_STATUS}</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.length === 0 ? (
            <Table.Empty colSpan={COLUMN_COUNT} message={EMPTY_MESSAGE} />
          ) : (
            rows.map((row) => (
              <Table.Row
                className={cn(row.wallId === hoveredWallId && 'bg-bg-hover')}
                isFlash={flashing.has(row.wallId)}
                key={row.wallId}
                onMouseEnter={() => onHoverRow(row.wallId)}
                onMouseLeave={() => onHoverRow(null)}
                selected={selected.has(row.wallId)}
                tabIndex={undefined}
              >
                <Table.CheckboxCell
                  checked={selected.has(row.wallId)}
                  onChange={(checked) => onToggleRowSelected(row.wallId, checked)}
                  rowId={row.wallId}
                />
                <Table.Cell className="font-mono tabular-nums">{row.code}</Table.Cell>
                <Table.Cell className="font-mono tabular-nums">{row.measuredLabel}</Table.Cell>
                <Table.Cell>
                  <SegmentedControl
                    aria-label={segmentedControlLabel(row.code)}
                    onChange={(key) => onChangeNormalizedGroup(row.wallId, GROUP_OF_KEY[key])}
                    options={GROUP_OPTIONS}
                    value={GROUP_KEY_OF[row.normalizedGroup]}
                  />
                </Table.Cell>
                <Table.Cell>
                  <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                    {row.exceedsTolerance && (
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-state-attention"
                      />
                    )}
                    {row.deviationLabel}
                  </span>
                </Table.Cell>
                <Table.Cell>
                  <ConfidenceMeter value={row.confidence} />
                </Table.Cell>
                <Table.Cell>{row.floorName}</Table.Cell>
                <Table.Cell>
                  <Badge variant={row.status}>{STATUS_LABELS[row.status]}</Badge>
                </Table.Cell>
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table.Root>

      {isPickingGroup && selected.size > 0 && (
        <div
          className="absolute bottom-14 left-0 right-0 z-30 flex items-center gap-3 border-t border-border-default bg-bg-surface px-4 py-3"
          role="group"
          aria-label={CHOOSE_GROUP_LABEL}
        >
          <span className="text-[13px] text-text-secondary">{chooseGroupPrompt(selected.size)}</span>
          <SegmentedControl
            aria-label={CHOOSE_GROUP_LABEL}
            onChange={setPendingGroupKey}
            options={GROUP_OPTIONS}
            value={pendingGroupKey}
          />
          <div className="flex-1" />
          <Button onClick={closeGroupPicker} size="sm" variant="ghost">
            {CANCEL_LABEL}
          </Button>
          <Button onClick={handleApplyGroup} size="sm" variant="primary">
            {APPLY_LABEL}
          </Button>
        </div>
      )}

      <TableActionBar
        entityName={ENTITY_NAME}
        onChangeThickness={() => setIsPickingGroup(true)}
        onDeselect={handleDeselect}
        selectedCount={selected.size}
      />
    </div>
  );
}
