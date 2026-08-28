/**
 * Cột trái của Cổng chất lượng đầu vào — khung xem bản vẽ, và mọi chú thích đè
 * lên đúng vùng ảnh nó nói tới.
 *
 * View thuần của mục D: mọi thứ vào bằng {@link InputQualityImagePanelProps},
 * không `src/api`, không `src/store`, không `src/domain`, không `src/lib/http`
 * (R-60). Trạng thái duy nhất giữ ở đây là **con trỏ đang giữ tay nắm nào** —
 * một sự kiện chuột chưa kết thúc, không phải dữ liệu nghiệp vụ; góc thật đi ra
 * ngay bằng `actions.onDragCorner` và quay lại qua `image.corners`.
 *
 * Ba lớp phủ — vùng, hình, tay nắm — nằm ở
 * `InputQualityGateImageOverlays.tsx`: R-22 chặn ở 400 dòng và một file duy
 * nhất đã vượt. Đường nhập của màn không đổi vì `InputQualityGate.tsx` chỉ biết
 * tới file này.
 *
 * ## Vì sao mọi thứ tính bằng tỉ lệ
 *
 * `xRatio`/`yRatio`/`widthRatio`/`heightRatio` là 0..1 của khung ảnh đã render
 * (`types.ts`), nên khung co giãn bao nhiêu thì chú thích vẫn nằm đúng chỗ.
 * Chiều ngược lại — con trỏ ở đâu thì tương ứng tỉ lệ nào — là phép chia toạ độ
 * cho kích thước khung: đường ống giao diện, không phải quy đổi đơn vị, nên nó
 * ở đây chứ không ở `src/domain`. Không một con số nào bị làm tròn hay định
 * dạng trên đường đi (A15).
 *
 * ## Vì sao không có thanh trượt
 *
 * `src/components/ui/Slider.tsx:149-155` vẽ vòng focus từ React state
 * (`isFocused`) chứ không từ biến thể `focus-visible:`, nên nó trượt
 * `expectAccessible` và A12 đi cùng. Tỉ lệ lộ ảnh của thanh so sánh trước/sau
 * đi qua {@link NumericField} — gõ số được, mũi tên lên/xuống được, vòng focus
 * kế thừa `focus-within:ring-2` của `Input`.
 *
 * ## Vì sao cụm thu phóng không nhận callback
 *
 * `ZoomCluster` giữ mức phóng bên trong `useZoomCluster` và không mở ra ngoài
 * (`ZoomCluster.tsx:6-9` chỉ có `isVisible` và `className`). Nó là cụm hiển thị
 * đặt ở góc phải dưới khung, không phải nguồn thu phóng của ảnh — panel này
 * không bịa thêm prop cho nó.
 */

import { useCallback, useRef, useState } from 'react';
import { clsx } from 'clsx';

import { ZoomCluster } from '@/components/canvas/ZoomCluster';
import { NumericField } from '@/components/ui/NumericField';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cssDurationMs } from '@/lib/motion';

import { clampRatio, PERCENT_SCALE, percentOf } from './InputQualityGateImageGeometry';
import {
  CornerHandleLayer,
  ImageGeometryLayer,
  ImageRegionLayer,
} from './InputQualityGateImageOverlays';
import type { InputQualityImagePanelProps } from './types';

/* -------------------------------------------------------------------------- */
/* Chuỗi người đọc. Tiếng Việt có dấu, viết thường kiểu câu (A6).              */
/* -------------------------------------------------------------------------- */

const PANEL_LABEL = 'Khung xem bản vẽ';
const CORNER_HINT = 'Kéo bằng chuột, hoặc dùng phím mũi tên khi tay nắm đang được chọn.';
const COMPARISON_LABEL = 'Tỉ lệ lộ ảnh sau khi nắn';
const COMPARISON_HINT = 'Phần bên trái đường chia là ảnh đã nắn, bên phải là ảnh gốc.';
const COMPARISON_UNIT = '%';
const SKEW_LABEL_PREFIX = 'Độ nghiêng đo được so với phương ngang: ';

/** Khung ảnh không bao giờ rộng quá con số đặc tả đặt ra. */
const FRAME_CLASSES =
  'relative w-full max-w-[640px] overflow-hidden rounded-[16px] border border-border-default bg-bg-sunken';

/* -------------------------------------------------------------------------- */
/* Panel.                                                                      */
/* -------------------------------------------------------------------------- */

export function InputQualityGateImagePanel({ actions, image }: InputQualityImagePanelProps) {
  const reducedMotion = useReducedMotion();
  const frameRef = useRef<HTMLDivElement | null>(null);

  /** Tay nắm đang bị con trỏ giữ. Trạng thái con trỏ, không phải dữ liệu màn. */
  const [draggingCornerId, setDraggingCornerId] = useState<string | null>(null);

  const { onChangeReveal, onDragCorner, onHoverRegion } = actions;

  /** Con trỏ ở đâu trên khung, tính bằng tỉ lệ 0..1 đã kẹp biên. */
  const ratioAt = useCallback((clientX: number, clientY: number) => {
    const frame = frameRef.current;

    if (frame === null) {
      return null;
    }

    const bounds = frame.getBoundingClientRect();

    if (bounds.width === 0 || bounds.height === 0) {
      return null;
    }

    return {
      xRatio: clampRatio((clientX - bounds.left) / bounds.width),
      yRatio: clampRatio((clientY - bounds.top) / bounds.height),
    };
  }, []);

  /** Ảnh về ngay ngắn trong nhịp chậm nhất của thang; dưới reduced motion là một nhát cắt. */
  const straightenDuration = cssDurationMs('slow', { reducedMotion });
  const highlightDuration = cssDurationMs('fast', { reducedMotion });

  const comparison = image.comparison;
  const isComparing = comparison !== null && comparison.isVisible;

  /** Bao nhiêu phần ảnh đã nắn còn bị che, tính từ mép phải. */
  const hiddenPercent = isComparing ? percentOf(1 - comparison.revealRatio) : percentOf(0);

  return (
    <section aria-label={PANEL_LABEL} className="flex h-full flex-col gap-3">
      <div className={FRAME_CLASSES} ref={frameRef}>
        {/* Ảnh gốc — nửa "trước" của thanh so sánh. Chỉ hiện khi đang so sánh. */}
        {isComparing ? (
          <img alt={image.altText} className="block w-full select-none" src={image.src} />
        ) : null}

        {/* Ảnh đã nắn. Khi so sánh thì nó nằm đè lên và bị cắt theo tỉ lệ lộ. */}
        <div
          className={clsx(
            'origin-center transition-transform ease-in-out',
            isComparing && 'absolute inset-0',
          )}
          style={{
            transform: `rotate(${image.rotationDeg}deg)`,
            transitionDuration: straightenDuration,
            clipPath: isComparing ? `inset(0 ${hiddenPercent} 0 0)` : undefined,
          }}
        >
          <img
            alt={isComparing ? '' : image.altText}
            aria-hidden={isComparing ? true : undefined}
            className="block w-full select-none"
            src={image.src}
          />
        </div>

        {/* Đường chia của thanh so sánh — một nét mảnh, không phải một tay cầm. */}
        {isComparing ? (
          <div
            aria-hidden="true"
            className="absolute inset-y-0 w-px bg-accent"
            style={{ left: percentOf(comparison.revealRatio) }}
          />
        ) : null}

        <ImageRegionLayer
          highlightDuration={highlightDuration}
          highlightedRegionId={image.highlightedRegionId}
          onHoverRegion={onHoverRegion}
          regions={image.regions}
        />

        <ImageGeometryLayer corners={image.corners} skewLine={image.skewLine} />

        {image.corners === null ? null : (
          <CornerHandleLayer
            corners={image.corners}
            draggingCornerId={draggingCornerId}
            onDragCorner={onDragCorner}
            ratioAt={ratioAt}
            setDraggingCornerId={setDraggingCornerId}
          />
        )}

        <ZoomCluster />
      </div>

      {image.skewLine === null ? null : (
        <p className="text-[13px] leading-[18px] text-text-secondary">
          {SKEW_LABEL_PREFIX}
          {image.skewLine.angleLabel}
        </p>
      )}

      {image.corners === null ? null : (
        <p className="text-[13px] leading-[18px] text-text-secondary">{CORNER_HINT}</p>
      )}

      {isComparing ? (
        <div className="flex max-w-[640px] flex-col gap-1">
          <NumericField
            label={COMPARISON_LABEL}
            max={PERCENT_SCALE}
            min={0}
            onChange={(next) => {
              onChangeReveal(clampRatio((next ?? 0) / PERCENT_SCALE));
            }}
            unit={COMPARISON_UNIT}
            value={comparison.revealRatio * PERCENT_SCALE}
          />
          <p className="text-[13px] leading-[18px] text-text-muted">{COMPARISON_HINT}</p>
        </div>
      ) : null}
    </section>
  );
}
