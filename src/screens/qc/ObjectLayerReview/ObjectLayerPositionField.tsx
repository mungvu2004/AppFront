/**
 * Dòng "Vị trí trên tường" của thanh tra SCR-17 — tách khỏi `ObjectLayerInspector.tsx`
 * để file đó dưới trần 400 dòng (R-22).
 *
 * Hai số ở hai đầu là khoảng cách tới ĐẦU và CUỐI tường; một dòng chú thích nói
 * ra điều đó thay vì để người đọc đoán (BUG-640). Vai người xem chỉ thấy chữ.
 */

import { FieldRow } from '@/components/ui/FieldRow';
import { Slider } from '@/components/ui/Slider';

import type { ObjectInspectorViewModel, ObjectLayerInspectorProps } from './objectLayerTypes';

const POSITION_LABEL = 'Vị trí trên tường';
const POSITION_START_CAPTION = 'Cách đầu tường';
const POSITION_END_CAPTION = 'Cách cuối tường';

export function ObjectLayerPositionField({
  inspector,
  isViewerRole,
  onDragPosition,
}: {
  readonly inspector: ObjectInspectorViewModel;
  readonly isViewerRole: boolean;
  readonly onDragPosition: ObjectLayerInspectorProps['onDragPosition'];
}) {
  const { relativePosition, distanceToStartLabel, distanceToEndLabel } = inspector;

  if (relativePosition === null || distanceToStartLabel === null || distanceToEndLabel === null) {
    return null;
  }

  return (
    <FieldRow label={POSITION_LABEL}>
      <div className="flex flex-col gap-1">
        {isViewerRole ? (
          <div className="flex h-9 items-center justify-between font-mono text-[13px] tabular-nums text-text-secondary">
            <span>{distanceToStartLabel}</span>
            <span>{distanceToEndLabel}</span>
          </div>
        ) : (
          <div className="flex h-9 items-center rounded-lg focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2">
            <Slider
              aria-label={POSITION_LABEL}
              endLabels={[distanceToStartLabel, distanceToEndLabel]}
              max={1}
              min={0}
              onChange={(value) => onDragPosition(inspector.id, value)}
              step={0.01}
              value={relativePosition}
            />
          </div>
        )}
        <p className="flex justify-between text-[12px] text-text-muted">
          <span>{POSITION_START_CAPTION}</span>
          <span>{POSITION_END_CAPTION}</span>
        </p>
      </div>
    </FieldRow>
  );
}
