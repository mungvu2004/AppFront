/**
 * Ba lớp phủ của khung xem bản vẽ, và hình học chung mà chúng với
 * `InputQualityGateImagePanel` cùng dùng.
 *
 * Tách khỏi panel vì R-22, không vì kiến trúc: một file 451 dòng không hỏng lúc
 * chạy, nó hỏng lúc đọc. Đường nhập của màn không đổi — chỉ
 * `InputQualityGateImagePanel.tsx` gọi tới đây, và nó vẫn là thứ duy nhất
 * `InputQualityGate.tsx` biết.
 *
 * Cùng luật với panel: view thuần, không `src/api`, không `src/store`, không
 * `src/domain`, không `src/lib/http` (R-60). Mọi toạ độ là tỉ lệ 0..1 của khung
 * ảnh đã render, nên chú thích nằm đúng chỗ ở mọi bề rộng.
 */

import { clsx } from 'clsx';

import { applyEmphasis } from '@/lib/coloring/legend';
import type { ColorTokenName } from '@/lib/coloring/scales';

import { clampRatio, PERCENT_SCALE, percentOf } from './InputQualityGateImageGeometry';
import type {
  InputQualityCorner,
  InputQualityRegion,
  InputQualitySkewLine,
  QualityLevel,
} from './types';

/* -------------------------------------------------------------------------- */
/* Chuỗi người đọc. Tiếng Việt có dấu, viết thường kiểu câu (A6).              */
/* -------------------------------------------------------------------------- */

const REGION_GROUP_LABEL = 'Vùng có vấn đề trên bản vẽ';
const CORNER_GROUP_LABEL = 'Bốn góc bản vẽ, kéo để chỉnh khung';
const CORNER_LABEL_PREFIX = 'Góc ';
const CORNER_LABEL_JOIN = ' bên ';
const CORNER_TOP = 'trên';
const CORNER_BOTTOM = 'dưới';
const CORNER_LEFT = 'trái';
const CORNER_RIGHT = 'phải';

/* -------------------------------------------------------------------------- */
/* Hình học. Tất cả là tỉ lệ 0..1 hoặc phần trăm của chính khung ảnh.          */
/* -------------------------------------------------------------------------- */

/** Nửa khung — ranh giới quyết định một tay nắm nằm bên nào khi tự gọi tên. */
const HALF_RATIO = 0.5;

/** Một nhịp phím mũi tên dịch tay nắm bao nhiêu phần khung. */
const CORNER_KEYBOARD_STEP_RATIO = 0.01;

/** Cạnh tay nắm góc, px — đặc tả gọi tên đúng con số này. */
const CORNER_HANDLE_SIZE_PX = 10;

/**
 * Tên một tay nắm, đọc ra từ chỗ nó đang đứng.
 *
 * `InputQualityCorner` chỉ mang `id` — một định danh tiếng Anh (mục B) mà trình
 * đọc màn hình không được nghe. Vị trí thì luôn có, và nó còn đúng cả sau khi
 * người dùng kéo tay nắm đi chỗ khác, nên tên gọi lấy từ đó.
 */
function cornerLabel(corner: InputQualityCorner): string {
  const vertical = corner.yRatio < HALF_RATIO ? CORNER_TOP : CORNER_BOTTOM;
  const horizontal = corner.xRatio < HALF_RATIO ? CORNER_LEFT : CORNER_RIGHT;

  return `${CORNER_LABEL_PREFIX}${vertical}${CORNER_LABEL_JOIN}${horizontal}`;
}

/** Phím mũi tên nào dịch tay nắm đi đâu. `null` cho mọi phím khác. */
function nudgeOf(key: string): { readonly dx: number; readonly dy: number } | null {
  switch (key) {
    case 'ArrowLeft':
      return { dx: -CORNER_KEYBOARD_STEP_RATIO, dy: 0 };
    case 'ArrowRight':
      return { dx: CORNER_KEYBOARD_STEP_RATIO, dy: 0 };
    case 'ArrowUp':
      return { dx: 0, dy: -CORNER_KEYBOARD_STEP_RATIO };
    case 'ArrowDown':
      return { dx: 0, dy: CORNER_KEYBOARD_STEP_RATIO };
    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Màu. Chỉ token, không một mã màu thô nào (A1).                              */
/* -------------------------------------------------------------------------- */

/**
 * Viền của một vùng, theo mức của chính vùng đó.
 *
 * `'good'` không có viền cảnh báo: một vùng không có vấn đề thì không có gì để
 * khoanh, và tô nó bằng một màu trạng thái nữa là đúng thứ A4 tồn tại để chặn.
 * Xanh `--state-verified` không xuất hiện ở đây vì không ai duyệt phép đo này
 * cả (A5) — nó là kết quả máy đo.
 */
const REGION_BORDER_CLASSES: Readonly<Record<QualityLevel, string>> = {
  good: 'border-border-default',
  attention: 'border-state-attention',
  poor: 'border-state-violation',
};

/** Nền rất nhạt cùng mức, để vùng đọc được cả khi ảnh nền tối. */
const REGION_TINT_CLASSES: Readonly<Record<QualityLevel, string>> = {
  good: 'bg-transparent',
  attention: 'bg-state-attention-tint',
  poor: 'bg-state-violation-tint',
};

/** Token `applyEmphasis` cầm cho mỗi mức — nó giữ nguyên token, chỉ đổi độ mờ. */
const REGION_EMPHASIS_TOKENS: Readonly<Record<QualityLevel, ColorTokenName>> = {
  good: '--border-default',
  attention: '--state-attention',
  poor: '--state-violation',
};

/* -------------------------------------------------------------------------- */
/* Lớp vùng — mỗi phát hiện neo vào đúng ô nó nói tới.                         */
/* -------------------------------------------------------------------------- */

export interface ImageRegionLayerProps {
  readonly regions: readonly InputQualityRegion[];
  readonly highlightedRegionId: string | null;
  /** Đã là một chuỗi CSS lấy từ thang chuyển động — panel tính, lớp này chỉ đặt. */
  readonly highlightDuration: string;
  readonly onHoverRegion: (regionId: string | null) => void;
}

/**
 * Mọi vùng là một nút: rê chuột vào thì tô sáng, mà chạm tới bằng Tab cũng vậy
 * (A12). Vùng không được trỏ tới mờ về `DIMMED_OPACITY` qua `applyEmphasis` —
 * cùng một token, chỉ khác độ mờ, đúng như `legend.ts` hứa.
 */
export function ImageRegionLayer({
  highlightDuration,
  highlightedRegionId,
  onHoverRegion,
  regions,
}: ImageRegionLayerProps) {
  if (regions.length === 0) {
    return null;
  }

  const hasHighlight = highlightedRegionId !== null;

  return (
    <div aria-label={REGION_GROUP_LABEL} className="absolute inset-0" role="group">
      {regions.map((region) => {
        const isHighlighted = region.id === highlightedRegionId;
        const appearance = applyEmphasis(
          REGION_EMPHASIS_TOKENS[region.level],
          !hasHighlight || isHighlighted ? 'focused' : 'dimmed',
        );

        return (
          <button
            aria-label={region.label}
            className={clsx(
              'absolute rounded-[4px] transition-opacity ease-in-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
              REGION_BORDER_CLASSES[region.level],
              REGION_TINT_CLASSES[region.level],
              isHighlighted ? 'border-2' : 'border',
            )}
            key={region.id}
            onBlur={() => onHoverRegion(null)}
            onFocus={() => onHoverRegion(region.id)}
            onMouseEnter={() => onHoverRegion(region.id)}
            onMouseLeave={() => onHoverRegion(null)}
            style={{
              left: percentOf(region.xRatio),
              top: percentOf(region.yRatio),
              width: percentOf(region.widthRatio),
              height: percentOf(region.heightRatio),
              opacity: appearance.opacity,
              transform:
                region.rotationDeg === undefined ? undefined : `rotate(${region.rotationDeg}deg)`,
              transitionDuration: highlightDuration,
            }}
            type="button"
          />
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Lớp hình — đường nghiêng và tứ giác bốn góc.                                */
/* -------------------------------------------------------------------------- */

export interface ImageGeometryLayerProps {
  readonly skewLine: InputQualitySkewLine | null;
  readonly corners: readonly InputQualityCorner[] | null;
}

/**
 * Một `<svg>` cho cả hai nét, vì cả hai đều là hình chứ không phải hộp.
 *
 * `viewBox` chạy 0..100 và `preserveAspectRatio="none"` để toạ độ vào thẳng
 * bằng phần trăm — cùng một hệ với các vùng ở trên. `vectorEffect` giữ nét đúng
 * một pixel sau khi khung bị kéo giãn không đều.
 */
export function ImageGeometryLayer({ corners, skewLine }: ImageGeometryLayerProps) {
  if (skewLine === null && corners === null) {
    return null;
  }

  const quad =
    corners === null
      ? null
      : corners
          .map((corner) => `${corner.xRatio * PERCENT_SCALE},${corner.yRatio * PERCENT_SCALE}`)
          .join(' ');

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      viewBox={`0 0 ${PERCENT_SCALE} ${PERCENT_SCALE}`}
    >
      {skewLine === null ? null : (
        <line
          className="stroke-accent"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          x1={skewLine.startXRatio * PERCENT_SCALE}
          x2={skewLine.endXRatio * PERCENT_SCALE}
          y1={skewLine.startYRatio * PERCENT_SCALE}
          y2={skewLine.endYRatio * PERCENT_SCALE}
        />
      )}
      {quad === null ? null : (
        <polygon
          className="fill-transparent stroke-accent"
          points={quad}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Lớp tay nắm — chọn bốn góc thủ công.                                        */
/* -------------------------------------------------------------------------- */

/** Con trỏ, đã quy về tỉ lệ của khung ảnh. */
export interface PointerRatio {
  readonly xRatio: number;
  readonly yRatio: number;
}

export interface CornerHandleLayerProps {
  readonly corners: readonly InputQualityCorner[];
  readonly draggingCornerId: string | null;
  readonly onDragCorner: (cornerId: string, xRatio: number, yRatio: number) => void;
  readonly ratioAt: (clientX: number, clientY: number) => PointerRatio | null;
  readonly setDraggingCornerId: (cornerId: string | null) => void;
}

/**
 * Bốn tay nắm 10px, kéo được bằng chuột và bằng phím mũi tên.
 *
 * `setPointerCapture` giữ sự kiện ở lại tay nắm cho tới lúc nhả, nên không cần
 * một `addEventListener` nào lên `window` và không listener nào sống quá vòng
 * đời của nút. Mỗi nhịp — chuột hay bàn phím — gọi thẳng `onDragCorner` với tỉ
 * lệ đã kẹp biên; xem trước tứ giác cập nhật ngay vì `image.corners` quay lại ở
 * lần render kế tiếp.
 */
export function CornerHandleLayer({
  corners,
  draggingCornerId,
  onDragCorner,
  ratioAt,
  setDraggingCornerId,
}: CornerHandleLayerProps) {
  return (
    <div aria-label={CORNER_GROUP_LABEL} className="absolute inset-0" role="group">
      {corners.map((corner) => (
        <button
          aria-label={cornerLabel(corner)}
          className={clsx(
            'absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-bg-surface bg-accent',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
            draggingCornerId === corner.id && 'ring-2 ring-accent',
          )}
          key={corner.id}
          onKeyDown={(event) => {
            const nudge = nudgeOf(event.key);

            if (nudge === null) {
              return;
            }

            event.preventDefault();
            onDragCorner(
              corner.id,
              clampRatio(corner.xRatio + nudge.dx),
              clampRatio(corner.yRatio + nudge.dy),
            );
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setDraggingCornerId(corner.id);
          }}
          onPointerMove={(event) => {
            if (draggingCornerId !== corner.id) {
              return;
            }

            const at = ratioAt(event.clientX, event.clientY);

            if (at !== null) {
              onDragCorner(corner.id, at.xRatio, at.yRatio);
            }
          }}
          onPointerUp={(event) => {
            event.currentTarget.releasePointerCapture(event.pointerId);
            setDraggingCornerId(null);
          }}
          style={{
            left: percentOf(corner.xRatio),
            top: percentOf(corner.yRatio),
            width: CORNER_HANDLE_SIZE_PX,
            height: CORNER_HANDLE_SIZE_PX,
          }}
          type="button"
        />
      ))}
    </div>
  );
}
