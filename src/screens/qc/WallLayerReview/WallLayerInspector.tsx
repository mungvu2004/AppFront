/**
 * Panel phải (344px) — thanh tra đối tượng đang chọn, `WallLayerReview`.
 *
 * View THUẦN (R-60): nhận nguyên `WallLayerViewProps` (đúng khuôn
 * `ScaleCalibrationPanel`) và chỉ hiển thị. Độ dày là `SegmentedControl` ba
 * lựa chọn — CẤM TUYỆT ĐỐI ô nhập số tự do, và vì thế **không** dùng
 * `ThicknessField` (`docs/contracts/ui.md` mục H3 cảnh báo nó cho phép BTCT/tự
 * do). Mọi chuỗi số (`lengthLabel`, `heightLabel`, `advanced.*`) đã định dạng
 * sẵn ở hook (A15) — file này không tự làm tròn, không tự đổi ngôn ngữ hiển thị số.
 *
 * Vai Người xem (`isViewerRole`): điều khiển độ dày **bỏ viền** (không nền,
 * không pill) thay vì làm xám — {@link ReadOnlyThickness}. Nút duyệt/bỏ qua
 * thay bằng đúng một câu giải thích (`viewerRoleNotice`), không khoá mờ.
 *
 * `isReviewed` của đối tượng đang chọn không có trong `WallInspectorViewModel`
 * — tra trong `panel.rows` theo `id` (một phép tìm kiếm đơn giản trên props đã
 * có, cùng loại logic view thuần với `isCollapsed = props.state === 'collapsed'`
 * của `PipelineFailure.tsx`), để khoá nút "Duyệt đoạn này" khi đã duyệt rồi.
 */

import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';

import { wallStrokeToken } from '@/components/canvas/materialMap';
import { AnimatePresence, motion } from '@/components/motion';
import { Button } from '@/components/ui/Button';
import { ConfidenceMeter } from '@/components/ui/ConfidenceMeter';
import { FieldRow } from '@/components/ui/FieldRow';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { durationSeconds } from '@/lib/motion';
import { cn } from '@/lib/utils';

import type { WallLayerViewProps, WallThicknessChoice } from './types';

export interface WallLayerInspectorProps {
  readonly panel: WallLayerViewProps;
}

const PANEL_TITLE = 'Đoạn tường';
const ADVANCED_TITLE = 'Thông số nâng cao';
const LENGTH_LABEL = 'chiều dài';
const HEIGHT_LABEL = 'chiều cao';
const CONFIDENCE_LABEL = 'độ tin cậy';
const MATERIAL_LABEL = 'vật liệu';
const ELEVATION_OFFSET_LABEL = 'lệch Z';
const START_POINT_LABEL = 'toạ độ đầu';
const END_POINT_LABEL = 'toạ độ cuối';
const THICKNESS_ARIA_LABEL = 'Độ dày tường';
const APPROVE_LABEL = 'Duyệt đoạn này';
const SKIP_LABEL = 'Bỏ qua';
const EMPTY_MESSAGE = 'Chọn một đoạn tường trên bản vẽ hoặc trong danh sách để xem chi tiết.';

interface ReadOnlyThicknessProps {
  readonly choices: readonly WallThicknessChoice[];
  readonly value: number;
}

function ReadOnlyThickness({ choices, value }: ReadOnlyThicknessProps) {
  return (
    <div aria-label={THICKNESS_ARIA_LABEL} className="flex items-center gap-3" role="group">
      {choices.map((choice) => (
        <span className="flex items-center gap-1.5" key={choice}>
          <span
            aria-hidden="true"
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: wallStrokeToken(choice) }}
          />
          <span
            className={cn(
              'text-[13px]',
              choice === value ? 'font-semibold text-text-primary' : 'text-text-muted',
            )}
          >
            {choice} mm
          </span>
        </span>
      ))}
    </div>
  );
}

export function WallLayerInspector({ panel }: WallLayerInspectorProps) {
  const [isAdvancedOpen, setAdvancedOpen] = useState(false);
  const advancedId = useId();

  const {
    inspector,
    thicknessChoices,
    isViewerRole,
    viewerRoleNotice,
    onApprove,
    onSkip,
    onChangeThickness,
    rows,
  } = panel;

  const isSelectedReviewed = inspector !== null && (rows.find((row) => row.id === inspector.id)?.isReviewed ?? false);

  return (
    <div className="flex h-full w-[344px] shrink-0 flex-col overflow-hidden rounded-[12px] bg-bg-surface shadow-panel">
      <div className="flex h-14 shrink-0 items-center px-5">
        <h3 className="text-[16px] font-semibold text-text-primary">{PANEL_TITLE}</h3>
      </div>

      {inspector === null ? (
        <p className="px-5 text-[13px] text-text-secondary">{EMPTY_MESSAGE}</p>
      ) : (
        <div className="flex flex-1 flex-col overflow-y-auto pb-5">
          <p className="px-5 pb-4 font-mono text-[16px] text-text-primary">{inspector.codeLabel}</p>

          <div className="px-5 pb-4">
            {isViewerRole ? (
              <ReadOnlyThickness choices={thicknessChoices} value={inspector.thicknessMm} />
            ) : (
              <SegmentedControl
                aria-label={THICKNESS_ARIA_LABEL}
                onChange={(value) => onChangeThickness(inspector.id, Number(value) as WallThicknessChoice)}
                options={thicknessChoices.map((choice) => ({
                  label: `${choice} mm`,
                  swatch: wallStrokeToken(choice),
                  value: String(choice),
                }))}
                value={String(inspector.thicknessMm)}
              />
            )}
          </div>

          <div className="flex flex-col px-5">
            <FieldRow label={LENGTH_LABEL}>
              <span className="flex h-9 items-center font-mono text-[14px] text-text-primary">
                {inspector.lengthLabel}
              </span>
            </FieldRow>
            <FieldRow label={HEIGHT_LABEL}>
              <span className="flex h-9 items-center font-mono text-[14px] text-text-primary">
                {inspector.heightLabel}
              </span>
            </FieldRow>
            <FieldRow label={CONFIDENCE_LABEL}>
              <span className="flex h-9 items-center">
                <ConfidenceMeter value={inspector.confidence} />
              </span>
            </FieldRow>
            <FieldRow isLast label={MATERIAL_LABEL}>
              <span className="flex h-9 items-center text-[14px] text-text-primary">{inspector.kindLabel}</span>
            </FieldRow>
          </div>

          <div className="px-5 pt-2">
            <button
              aria-controls={advancedId}
              aria-expanded={isAdvancedOpen}
              className="flex w-full items-center justify-between py-2 text-[13px] font-medium text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-accent"
              onClick={() => setAdvancedOpen((open) => !open)}
              type="button"
            >
              {ADVANCED_TITLE}
              <ChevronDown
                aria-hidden="true"
                className={cn('h-4 w-4 transition-transform duration-180', isAdvancedOpen && 'rotate-180')}
              />
            </button>

            <AnimatePresence initial={false}>
              {isAdvancedOpen && (
                <motion.div
                  animate={{ height: 'auto', opacity: 1 }}
                  className="overflow-hidden"
                  exit={{ height: 0, opacity: 0 }}
                  id={advancedId}
                  initial={{ height: 0, opacity: 0 }}
                  transition={{ duration: durationSeconds('standard') }}
                >
                  <FieldRow label={ELEVATION_OFFSET_LABEL}>
                    <span className="flex h-9 items-center font-mono text-[14px] text-text-primary">
                      {inspector.advanced.elevationOffsetLabel}
                    </span>
                  </FieldRow>
                  <FieldRow label={START_POINT_LABEL}>
                    <span className="flex h-9 items-center font-mono text-[14px] text-text-primary">
                      {inspector.advanced.startPointLabel}
                    </span>
                  </FieldRow>
                  <FieldRow isLast label={END_POINT_LABEL}>
                    <span className="flex h-9 items-center font-mono text-[14px] text-text-primary">
                      {inspector.advanced.endPointLabel}
                    </span>
                  </FieldRow>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-auto flex flex-col gap-2 px-5 pt-4">
            {isViewerRole ? (
              <p className="text-[13px] text-text-secondary">{viewerRoleNotice}</p>
            ) : (
              <>
                <Button
                  disabled={isSelectedReviewed}
                  fullWidth
                  onClick={() => onApprove(inspector.id)}
                  variant="primary"
                >
                  {APPROVE_LABEL}
                </Button>
                <Button fullWidth onClick={() => onSkip(inspector.id)} variant="ghost">
                  {SKIP_LABEL}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
