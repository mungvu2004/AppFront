/**
 * Hàng ba mức sẵn góc trên trái. Ở trạng thái thu gọn — khi vỏ gỡ ray tầng cùng
 * thanh "Độ tách" của nó — hàng ấy gộp với một thanh trượt độ tách thành một cụm
 * trôi nằm ngang (xem ghi chú ở dạng thường bên dưới, BUG-381).
 *
 * ## Vì sao thang không dùng `Slider` dùng chung
 *
 * Đặc tả xin `Slider` của `@/components/ui/Slider`, nhưng `Slider.tsx` tính
 * giá trị hoàn toàn từ `e.clientX` so với `getBoundingClientRect()` của chính
 * nó (dòng 38, 67-73) — không có chế độ dọc nào. Xoay nó bằng CSS
 * `rotate(-90deg)` để trông dọc sẽ làm hỏng phép kéo: sau khi xoay,
 * `getBoundingClientRect()` trả về hộp bao MỚI (32×240 thay vì 240×32), và
 * kéo chuột dọc theo thanh gần như không đổi `clientX` — giá trị bị kẹt.
 *
 * Repo đã gặp đúng nhu cầu này ở `ViewerStoreyRail.tsx` (thanh "Độ tách" của
 * chính vỏ `ViewerShell`) và giải quyết bằng `<input type="range">` gốc với
 * `writingMode: 'vertical-lr'` — trình duyệt tự lo hướng kéo cho input gốc,
 * custom slider thì không. Điều phối viên đã chốt đi theo đúng tiền lệ đó
 * (hỏi qua `orca orchestration ask`, 07-09-2026): dùng input gốc ở đây, giữ
 * `SegmentedControl` cho hàng ba mức sẵn như đặc tả xin.
 *
 * Thanh dọc ấy nay đã gỡ (BUG-381, xem dạng thường bên dưới); thanh còn lại của
 * dạng thu gọn giữ input gốc để cùng bước và cùng khoảng với thanh của vỏ.
 */
import type { ChangeEvent } from 'react';

import { cn } from '@/lib/utils';
import { SegmentedControl, type SegmentedControlOption } from '@/components/ui/SegmentedControl';
import { MAX_SEPARATION, MIN_SEPARATION } from '@/screens/viewer/ViewerShell/viewerStoreyStack';

import type { ExplodePresetId, ExplodePresetViewModel } from './explodedViewTypes';

/** Bước kéo — mịn để mô hình giãn liền tay, không phải một ngưỡng nghiệp vụ. */
const SEPARATION_STEP = 0.01;

/** Giá trị đứng ngoài mọi mức sẵn, dùng khi người dùng đang kéo tự do. */
const NONE_PRESET = '__none__' as const;
type PresetValue = ExplodePresetId | typeof NONE_PRESET;

/*
 * Bề dày 24 px (`w-6` dọc, `h-6` ngang) là VÙNG BẤM, không phải bề dày vệt vẽ:
 * input gốc vẽ rãnh mảnh giữa hộp của nó bất kể hộp dày bao nhiêu. Bản trước
 * dùng `w-1.5`/`h-1.5` nên cả hộp — tức cả chỗ bấm được — chỉ 6 px (đo 6×164,
 * BUG-381). 24 px là sàn mục tiêu chạm WCAG 2.2 AA, cùng bề `w-6` mà thanh
 * "Độ tách" của `ViewerStoreyRail` đang dùng.
 */
const RANGE_INPUT_CLASSNAME = cn(
  'cursor-pointer accent-accent',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface',
);

export interface ExplodedViewRailProps {
  readonly separation: number;
  readonly onSeparationChange: (value: number) => void;
  readonly minLabel: string;
  readonly maxLabel: string;
  readonly presets: readonly ExplodePresetViewModel[];
  readonly activePresetId: ExplodePresetId | null;
  readonly onPresetSelect: (id: ExplodePresetId) => void;
  readonly isCollapsed: boolean;
}

export function ExplodedViewRail({
  separation,
  onSeparationChange,
  minLabel,
  maxLabel,
  presets,
  activePresetId,
  onPresetSelect,
  isCollapsed,
}: ExplodedViewRailProps) {
  const options: SegmentedControlOption<PresetValue>[] = presets.map((preset) => ({
    value: preset.id,
    label: preset.label,
  }));

  const handlePresetChange = (value: PresetValue): void => {
    if (value !== NONE_PRESET) {
      onPresetSelect(value);
    }
  };

  const handleSeparationInput = (event: ChangeEvent<HTMLInputElement>): void => {
    onSeparationChange(Number(event.target.value));
  };

  const presetRow = (
    <SegmentedControl
      aria-label="Mức tách sẵn"
      onChange={handlePresetChange}
      options={options}
      value={activePresetId ?? NONE_PRESET}
    />
  );

  if (isCollapsed) {
    return (
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-bg-surface px-4 py-2 shadow-float">
        {presetRow}
        <span className="text-[11px] leading-none text-text-muted">{minLabel}</span>
        <input
          aria-label="Độ tách các tầng"
          className={cn(RANGE_INPUT_CLASSNAME, 'h-6 w-32')}
          max={MAX_SEPARATION}
          min={MIN_SEPARATION}
          onChange={handleSeparationInput}
          step={SEPARATION_STEP}
          type="range"
          value={separation}
        />
        <span className="text-[11px] leading-none text-text-muted">{maxLabel}</span>
      </div>
    );
  }

  /*
   * Dạng thường: CHỈ hàng ba mức sẵn, góc trên trái. Thanh trượt độ tách của dạng
   * này là thanh "Độ tách" trên ray tầng của `ViewerShell` — vỏ chung giữ nó cho
   * cả chín màn 3D, và màn này không dựng lại thứ vỏ đã có (R-64). Bản trước dựng
   * thêm một thanh dọc 240 px kèm nhãn hai đầu ngay trong khung nhìn: hai điều
   * khiển cho cùng một giá trị, và nhãn của nó thành thước chiều cao thứ hai cạnh
   * thang cao độ của vỏ (BUG-381). Dạng thu gọn ở trên vẫn giữ thanh trượt riêng
   * vì khi ấy vỏ gỡ cả ray tầng — đó là điều khiển tách duy nhất còn lại.
   */
  return <div className="absolute left-3 top-3">{presetRow}</div>;
}
