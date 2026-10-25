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
 * ## Cụm thu phóng điều khiển ảnh thật
 *
 * Mức phóng là trạng thái khung nhìn (như tay nắm đang giữ), giữ bằng
 * `useZoomCluster` và trao cho `ZoomCluster` dạng có chủ. Ảnh và ba lớp phủ cùng
 * nằm trong một lớp rộng `zoom%` khung, nên tỉ lệ 0..1 vẫn đúng chỗ và `ratioAt`
 * đo chính lớp đó. Bề rộng chứ không `scale()`: Chrome không cập nhật vùng cuộn
 * khi chỉ transform đổi (đo: phóng 150% mà chỉ cuộn được 110%). Khung cuộn ngang
 * khi phóng, chiều dọc đi theo trang; "Vừa khung" = 100% vì ảnh vốn vừa khung.
 * Khi chọn góc cụm ẩn (BUG-292) nên ảnh về 100%, không kẹt ở mức không còn nút chỉnh.
 */

import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import { clsx } from 'clsx';

import { ZoomCluster } from '@/components/canvas/ZoomCluster';
import { Button } from '@/components/ui/Button';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useZoomCluster } from '@/hooks/useZoomCluster';
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
const COMPARISON_LABEL = 'So sánh trước và sau khi nắn';
const CANCEL_CORNERS_LABEL = 'Huỷ chọn góc';
const COMPARISON_HINT = 'Phần bên trái đường chia là ảnh đã nắn, bên phải là ảnh gốc.';
const COMPARISON_UNIT = '%';
const ZOOMED_FRAME_LABEL = 'Bản vẽ đang phóng, cuộn để xem phần còn lại';

/** Khung ảnh không bao giờ rộng quá con số đặc tả đặt ra. */
const FRAME_CLASSES =
  'relative w-full max-w-[640px] overflow-hidden rounded-2xl border border-border-default bg-bg-sunken';

const ZOOMED_FRAME_CLASSES =
  'overflow-auto focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent';

/**
 * Khung đang phóng giữ phím mũi tên cho việc cuộn của trình duyệt: chặn lan lên `window` để
 * phím tắt đổi tầng (`shortcutRegistry`) không `preventDefault` mất lượt cuộn — cùng cách
 * `focusTrap` giữ Esc của nó (BUG-540). Không `preventDefault` ở đây: cuộn chính là việc cần.
 */
function keepArrowsForScroll(event: KeyboardEvent<HTMLDivElement>): void {
  if (event.key.startsWith('Arrow')) {
    event.stopPropagation();
  }
}

/* -------------------------------------------------------------------------- */
/* Panel.                                                                      */
/* -------------------------------------------------------------------------- */

export function InputQualityGateImagePanel({ actions, image }: InputQualityImagePanelProps) {
  const reducedMotion = useReducedMotion();
  const frameRef = useRef<HTMLDivElement | null>(null);

  /** Tay nắm đang bị con trỏ giữ. Trạng thái con trỏ, không phải dữ liệu màn. */
  const [draggingCornerId, setDraggingCornerId] = useState<string | null>(null);

  const { onCancelCorners, onChangeReveal, onDragCorner, onHoverRegion } = actions;

  const zoom = useZoomCluster();
  const zoomPercent = image.corners === null ? zoom.zoomLevel : PERCENT_SCALE;
  const isZoomed = zoomPercent !== PERCENT_SCALE;

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
      <div className={FRAME_CLASSES}>
        {/* Phóng thì khung cuộn được — bằng chuột lẫn phím mũi tên khi khung đang được chọn (A12). */}
        <div
          aria-label={isZoomed ? ZOOMED_FRAME_LABEL : undefined}
          className={clsx(isZoomed && ZOOMED_FRAME_CLASSES)}
          onKeyDown={isZoomed ? keepArrowsForScroll : undefined}
          role={isZoomed ? 'group' : undefined}
          tabIndex={isZoomed ? 0 : undefined}
        >
          <div
            className="relative"
            data-testid="quality-image-content"
            ref={frameRef}
            style={{ width: `${zoomPercent}%` }}
          >
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
          </div>
        </div>

      </div>

      {/* Cụm thu phóng nằm DƯỚI khung, không đè khung tên góc dưới phải bản vẽ (G3-36); đang chọn
          góc thì ẩn, nhường chỗ cho tay nắm (BUG-292). */}
      {image.corners === null ? (
        <div className="flex max-w-[640px] justify-end">
          <ZoomCluster
            className="relative p-0"
            onFitToScreen={zoom.resetZoom}
            onResetZoom={zoom.resetZoom}
            onZoomIn={zoom.zoomIn}
            onZoomOut={zoom.zoomOut}
            zoomLevel={zoomPercent}
          />
        </div>
      ) : null}

      {image.corners === null ? null : (
        <div className="flex max-w-[640px] flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] leading-[18px] text-text-secondary">{CORNER_HINT}</p>
          <Button onClick={onCancelCorners} size="sm" variant="ghost">
            {CANCEL_CORNERS_LABEL}
          </Button>
        </div>
      )}

      {isComparing ? (
        <div className="flex max-w-[640px] flex-col gap-1">
          {/* Thanh kéo thay ô số: so trước/sau là việc kéo, không phải gõ số (G3-35). */}
          <label className="flex items-center gap-3 text-[13px] text-text-secondary">
            <span className="shrink-0">{COMPARISON_LABEL}</span>
            <input
              className="min-w-0 flex-1 accent-accent"
              max={PERCENT_SCALE}
              min={0}
              onChange={(event) => {
                onChangeReveal(clampRatio(Number(event.target.value) / PERCENT_SCALE));
              }}
              type="range"
              value={Math.round(comparison.revealRatio * PERCENT_SCALE)}
            />
            <span className="w-10 shrink-0 text-right tabular-nums">
              {Math.round(comparison.revealRatio * PERCENT_SCALE)}
              {COMPARISON_UNIT}
            </span>
          </label>
          <p className="text-[13px] leading-[18px] text-text-muted">{COMPARISON_HINT}</p>
        </div>
      ) : null}
    </section>
  );
}
