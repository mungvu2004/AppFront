/**
 * Bảng chi tiết 48 đoạn của màn "Chuẩn hoá độ dày tường" (2.3 của brief T7).
 * Cột: mã · độ dày đo được · độ dày chuẩn hoá (`Select` trong ô) ·
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
 * `tabindex="-1"` mặc định cộng `outline-hidden`, chỉ vẽ vòng tiêu điểm khi
 * `focused` được đặt tay — nếu không, `expectAccessible` báo lỗi `focus-ring`
 * cho MỌI hàng vì bộ chọn "phần tử nhận được tiêu điểm" khớp bất kỳ thứ gì
 * mang thuộc tính `tabindex`, kể cả `-1`. Hàng ở bảng này không cần tự nhận
 * tiêu điểm — ô chọn, `SegmentedControl`, và các điều khiển khác bên trong đã
 * tự có vòng tiêu điểm riêng — nên xoá hẳn thuộc tính đó là đúng ngữ nghĩa.
 *
 * ## Ô "độ dày chuẩn hoá" là một `Select` ghi thật (BUG-585, BUG-405)
 *
 * Bốn nút `SegmentedControl` trên mỗi hàng (~400 px × 48 hàng) trông như sửa ngay nhưng chỉ ghi đè
 * cục bộ, và đẩy bảng tới ~1.040 px: cắt cột phải ở 768, 30 nút ra ngoài màn ở 375. Một `Select`
 * ~124 px chọn nhóm là MỘT lượt ghi kèm toast hoàn tác, như SCR-16. Chỉ ba nhóm có giá trị mm —
 * "Cột BTCT" không có lệnh áp nên không được mời chọn (BUG-593); hàng đang là cột hiện chữ đó.
 * Vai người xem (`isReadOnly`) chỉ thấy chữ, không ô chọn hàng, không dải hành động (BUG-601).
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

import { useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfidenceMeter } from '@/components/ui/ConfidenceMeter';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
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
  verified: 'Đã duyệt',
  attention: 'Cần chú ý',
  violation: 'Vi phạm',
  neutral: 'Trung tính',
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

/**
 * Nhãn lựa chọn: "Cột BTCT" thay cho chữ đầy đủ — cùng cách `ThicknessField`/chú giải độ dày gọi
 * nó. Bốn ô chữ đầy đủ rộng ~390 px, đẩy bảng tới ~1.040 px và cắt cột phải ở 1024 (BUG-405).
 */
const OPTION_LABELS: Readonly<Record<ThicknessGroup, string>> = {
  ...THICKNESS_GROUP_LABELS,
  CONCRETE_COLUMN: 'Cột BTCT',
};

/* Chỉ nhóm có giá trị mm: "Cột BTCT" không có lệnh áp, chọn nó thì "Áp dụng" im lặng (BUG-593). */
const GROUP_OPTIONS = THICKNESS_GROUP_DISPLAY_ORDER.filter((group) => group !== 'CONCRETE_COLUMN').map(
  (group) => ({
    label: OPTION_LABELS[group],
    value: GROUP_KEY_OF[group],
  }),
);

/** Nhóm mặc định của bảng chọn nhóm theo lô trước khi người dùng tự chọn. */
const DEFAULT_GROUP_KEY: ThicknessGroupKey = '110';

const groupSelectLabel = (code: string): string => `Độ dày chuẩn hoá của đoạn ${code}`;

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
  isReadOnly = false,
}: ThicknessSegmentTableProps) {
  const [isPickingGroup, setIsPickingGroup] = useState(false);
  const [pendingGroupKey, setPendingGroupKey] = useState<ThicknessGroupKey>(DEFAULT_GROUP_KEY);
  const pickerRef = useRef<HTMLDivElement>(null);

  /* "Đổi độ dày" rời dải hành động khi bảng chọn mở (BUG-620): focus sang lựa chọn đang bật, không rơi về body. */
  useEffect(() => {
    if (isPickingGroup) {
      pickerRef.current?.querySelector<HTMLElement>('[aria-checked="true"], button')?.focus();
    }
  }, [isPickingGroup]);

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
            {isReadOnly ? null : (
              <Table.CheckboxHead checked={allSelected} indeterminate={someSelected} onChange={onToggleAllSelected} />
            )}
            <Table.Head>{HEADER_CODE}</Table.Head>
            <Table.Head className="whitespace-normal" sortKey="measured">
              {HEADER_MEASURED}
            </Table.Head>
            <Table.Head>{HEADER_NORMALIZED}</Table.Head>
            <Table.Head sortKey="deviation">{HEADER_DEVIATION}</Table.Head>
            <Table.Head sortKey="confidence">{HEADER_CONFIDENCE}</Table.Head>
            <Table.Head sortKey="floor">{HEADER_FLOOR}</Table.Head>
            <Table.Head>{HEADER_STATUS}</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.length === 0 ? (
            <Table.Empty colSpan={isReadOnly ? COLUMN_COUNT - 1 : COLUMN_COUNT} message={EMPTY_MESSAGE} />
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
                {isReadOnly ? null : (
                  <Table.CheckboxCell
                    checked={selected.has(row.wallId)}
                    onChange={(checked) => onToggleRowSelected(row.wallId, checked)}
                    /* `rowId` chỉ dựng nhãn "Chọn dòng …": đọc mã ngắn của tường, không đọc ULID (Impeccable A3). */
                    rowId={`tường ${row.code}`}
                  />
                )}
                <Table.Cell className="font-mono tabular-nums">{row.code}</Table.Cell>
                <Table.Cell className="font-mono tabular-nums">{row.measuredLabel}</Table.Cell>
                <Table.Cell>
                  {isReadOnly ? (
                    OPTION_LABELS[row.normalizedGroup]
                  ) : (
                    <Select.Root
                      className="w-[124px]"
                      onChange={(key) => onChangeNormalizedGroup(row.wallId, GROUP_OF_KEY[key as ThicknessGroupKey])}
                      options={GROUP_OPTIONS}
                      value={row.normalizedGroup === 'CONCRETE_COLUMN' ? undefined : GROUP_KEY_OF[row.normalizedGroup]}
                    >
                      <Select.Label className="sr-only">{groupSelectLabel(row.code)}</Select.Label>
                      <Select.Trigger options={GROUP_OPTIONS} placeholder={OPTION_LABELS[row.normalizedGroup]} />
                      <Select.Content>
                        {GROUP_OPTIONS.map((option, index) => (
                          <Select.Item index={index} key={option.value} value={option.value}>
                            {option.label}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>
                  )}
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
        /* Xuống dòng dưới 640 px: câu một dòng riêng, hai nút chia đều hàng cuối — không nút nào ra ngoài màn (BUG-620). */
        <div
          className="absolute bottom-14 left-0 right-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border-default bg-bg-surface px-4 py-3"
          ref={pickerRef}
          role="group"
          aria-label={CHOOSE_GROUP_LABEL}
        >
          <span className="min-w-0 basis-full text-[13px] text-text-secondary sm:basis-auto">
            {chooseGroupPrompt(selected.size)}
          </span>
          <SegmentedControl
            aria-label={CHOOSE_GROUP_LABEL}
            onChange={setPendingGroupKey}
            options={GROUP_OPTIONS}
            value={pendingGroupKey}
          />
          <div className="flex w-full gap-2 sm:ml-auto sm:w-auto *:flex-1 sm:*:flex-none">
            <Button onClick={closeGroupPicker} size="sm" variant="ghost">
              {CANCEL_LABEL}
            </Button>
            <Button onClick={handleApplyGroup} size="sm" variant="primary">
              {APPLY_LABEL}
            </Button>
          </div>
        </div>
      )}

      {isReadOnly ? null : (
        <TableActionBar
          entityName={ENTITY_NAME}
          /* Bảng chọn đang mở đã là bước "đổi độ dày" — không lặp nút đó ngay bên dưới (BUG-620). */
          {...(isPickingGroup ? {} : { onChangeThickness: () => setIsPickingGroup(true) })}
          onDeselect={handleDeselect}
          selectedCount={selected.size}
        />
      )}
    </div>
  );
}
