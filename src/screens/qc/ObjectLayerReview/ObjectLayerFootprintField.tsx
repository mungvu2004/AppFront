/**
 * Rộng × sâu của nội thất đứng tự do (B3): hai ô số (mm) gọi `furniture.resize`, nút "Xoay 90°"
 * gọi `furniture.rotate`. Ghi khi rời ô hoặc Enter; số không hợp lệ thì trả về số cũ, lệnh
 * vẫn là nơi phán quyết (lý do từ chối tới qua toast của hook).
 */

import { RotateCw } from 'lucide-react';
import { useEffect, useState, type KeyboardEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { FieldRow } from '@/components/ui/FieldRow';

const FOOTPRINT_LABEL = 'Rộng × Sâu (mm)';
const WIDTH_INPUT_LABEL = 'Chiều rộng (mm)';
const DEPTH_INPUT_LABEL = 'Chiều sâu (mm)';
const ROTATE_LABEL = 'Xoay 90°';

export interface ObjectLayerFootprintFieldProps {
  readonly objectId: string;
  readonly widthMm: number;
  readonly depthMm: number;
  readonly onResize: (
    objectId: string,
    size: { readonly widthMm: number; readonly depthMm: number },
  ) => void;
  readonly onRotate: (objectId: string) => void;
}

const INPUT_CLASSES =
  'h-9 w-[84px] rounded-md border border-border-default bg-bg-surface px-2 font-mono text-[14px] text-text-primary tabular-nums outline-hidden focus-visible:ring-2 focus-visible:ring-accent';

export function ObjectLayerFootprintField({
  objectId,
  widthMm,
  depthMm,
  onResize,
  onRotate,
}: ObjectLayerFootprintFieldProps) {
  const [width, setWidth] = useState(String(widthMm));
  const [depth, setDepth] = useState(String(depthMm));

  /* Số mới từ đồ thị (hoàn tác, đối tượng khác) thay chữ đang gõ. */
  useEffect(() => setWidth(String(widthMm)), [widthMm, objectId]);
  useEffect(() => setDepth(String(depthMm)), [depthMm, objectId]);

  const commit = () => {
    const nextWidth = Number(width);
    const nextDepth = Number(depth);

    if (!(nextWidth > 0) || !(nextDepth > 0)) {
      setWidth(String(widthMm));
      setDepth(String(depthMm));

      return;
    }

    if (nextWidth !== widthMm || nextDepth !== depthMm) {
      onResize(objectId, { widthMm: nextWidth, depthMm: nextDepth });
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    /* Enter ghi số, không lọt xuống phím tắt "nhận gợi ý" của canvas. */
    if (event.key === 'Enter') {
      event.stopPropagation();
      commit();
    }
  };

  return (
    /* Xếp chồng: cột giá trị 344px không đủ chỗ cho hai ô số và nút xoay trên một hàng. */
    <FieldRow isStacked label={FOOTPRINT_LABEL}>
      <div className="flex flex-col items-start gap-2">
        <div className="flex items-center gap-1.5">
          <input
            aria-label={WIDTH_INPUT_LABEL}
            className={INPUT_CLASSES}
            inputMode="numeric"
            min={1}
            onBlur={commit}
            onChange={(event) => setWidth(event.target.value)}
            onKeyDown={onKeyDown}
            type="number"
            value={width}
          />
          <span aria-hidden="true" className="text-text-muted">
            ×
          </span>
          <input
            aria-label={DEPTH_INPUT_LABEL}
            className={INPUT_CLASSES}
            inputMode="numeric"
            min={1}
            onBlur={commit}
            onChange={(event) => setDepth(event.target.value)}
            onKeyDown={onKeyDown}
            type="number"
            value={depth}
          />
        </div>
        <Button
          iconBefore={<RotateCw aria-hidden="true" className="h-4 w-4" />}
          onClick={() => onRotate(objectId)}
          size="sm"
          variant="secondary"
        >
          {ROTATE_LABEL}
        </Button>
      </div>
    </FieldRow>
  );
}
