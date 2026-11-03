/**
 * Mảnh con của `WallLayerCanvas` (tách cho trần 400 dòng): ảnh nền, nét xem trước,
 * bản đồ nhỏ (menu + toạ độ con trỏ ở `wallLayerCanvasActions.ts`).
 * Cùng luật view thuần của canvas: không một phép hình học nào, toạ độ do trình duyệt đổi.
 */

import { useState } from 'react';

import { wallConfidenceToken } from '@/components/canvas/materialMap';
import { MiniMap } from '@/components/canvas/MiniMap';

import { backgroundFrameRect } from '../shared/canvasFit';

import type { WallLayerCanvasViewProps, WallLayerRectPx } from './wallLayerHatch';
import { BACKGROUND_IMAGE_OPACITY, toSvgPoints } from './wallLayerHatch';
import type { WallDrawSnapKind } from './wallDrawSnap';

type Props = WallLayerCanvasViewProps;

const MINIMAP_LABEL = 'Mặt bằng thu nhỏ';
/** `zoomPercent` lúc "vừa khung": 100% là cả mặt bằng nằm trong khung. */
const FIT_ZOOM_PERCENT = 100;

/**
 * Ảnh nền bản vẽ (mờ) ở pixel KHUNG do hook tính (BUG-403); chưa có ảnh thì một ô trũng.
 * J-10: ảnh đặt theo độ phân giải THẬT của ảnh (lưới pixel của tường), đo khi ảnh tải xong.
 */
export function WallDrawingBackground({
  backgroundImageAlt,
  backgroundImageUrl,
  surface,
  surfaceRectPx,
}: Pick<Props, 'backgroundImageAlt' | 'backgroundImageUrl' | 'surfaceRectPx'> & {
  readonly surface: WallLayerRectPx | null;
}) {
  const [loadedImage, setLoadedImage] = useState<{
    readonly url: string | null;
    readonly width: number;
    readonly height: number;
  } | null>(null);

  if (surfaceRectPx === null) {
    return null;
  }

  const imageNaturalPx = loadedImage !== null && loadedImage.url === backgroundImageUrl ? loadedImage : null;
  const rect = surface === null ? surfaceRectPx : backgroundFrameRect(surface, surfaceRectPx, imageNaturalPx);
  const box = { height: rect.height, left: rect.x, top: rect.y, width: rect.width };

  return backgroundImageUrl === null ? (
    <div
      aria-hidden="true"
      className="absolute bg-bg-sunken"
      style={{ height: surfaceRectPx.height, left: surfaceRectPx.x, top: surfaceRectPx.y, width: surfaceRectPx.width }}
    />
  ) : (
    <img
      alt={backgroundImageAlt}
      // J-10: preflight `img { max-width: 100% }` bóp ảnh về bề rộng khung khi phóng to → nền lệch tường.
      className="pointer-events-none absolute block max-w-none select-none"
      draggable={false}
      onLoad={(event) => {
        const { naturalHeight, naturalWidth } = event.currentTarget;
        setLoadedImage({ url: backgroundImageUrl, width: naturalWidth, height: naturalHeight });
      }}
      src={backgroundImageUrl}
      style={{ ...box, opacity: BACKGROUND_IMAGE_OPACITY }}
    />
  );
}

/** G4a-23: nét xem trước của Vẽ tường / dấu cắt của Tách đoạn — accent, nét đứt; vòng nam châm khi bắt vào tường. */
export function WallDraftGuide({
  draftGuidePx,
  unitPx,
}: {
  /* `snapKind` do hook gắn thêm (`wallDrawSnap.ts`); kiểu gốc ở `wallLayerHatch.ts` chưa khai. */
  readonly draftGuidePx: NonNullable<Props['draftGuidePx']> & { readonly snapKind?: WallDrawSnapKind | null };
  readonly unitPx: number;
}) {
  const { fromPx, toPx, snapKind = null } = draftGuidePx;

  if (fromPx === null && snapKind === null) {
    return (
      <circle
        cx={toPx.x}
        cy={toPx.y}
        data-testid="wall-draft-guide"
        fill="none"
        pointerEvents="none"
        r={6 * unitPx}
        stroke="var(--accent)"
        strokeDasharray={`${3 * unitPx} ${2 * unitPx}`}
        strokeWidth={2 * unitPx}
      />
    );
  }

  return (
    <g data-testid="wall-draft-guide" pointerEvents="none">
      {fromPx === null ? null : (
        <line
          stroke="var(--accent)"
          strokeDasharray={`${6 * unitPx} ${4 * unitPx}`}
          strokeWidth={2 * unitPx}
          x1={fromPx.x}
          x2={toPx.x}
          y1={fromPx.y}
          y2={toPx.y}
        />
      )}
      {snapKind === null ? null : (
        <circle
          cx={toPx.x}
          cy={toPx.y}
          data-snap-kind={snapKind}
          data-testid="wall-draft-snap"
          fill="none"
          r={(snapKind === 'wallVertex' ? 7 : 5) * unitPx}
          stroke="var(--accent)"
          strokeWidth={2.5 * unitPx}
        />
      )}
    </g>
  );
}

/**
 * Bản đồ nhỏ. Ở "vừa khung" (100%) cả mặt bằng đã nằm trong khung: không có gì để chỉ, chỉ
 * đè góc trên phải bản vẽ (khung tên). Phóng to qua 100% thì hiện.
 */
export function WallLayerMiniMap({
  miniMapViewport,
  onMiniMapViewportChange,
  shapes,
  surface,
  zoomPercent,
}: Pick<Props, 'miniMapViewport' | 'onMiniMapViewportChange' | 'shapes' | 'zoomPercent'> & {
  readonly surface: WallLayerRectPx | null;
}) {
  return (
    <MiniMap
      /* Bản đồ nhỏ góc trên trái, dưới nút "Từng việc / Tổng thể". */
      className="top-[60px] right-auto left-3"
      isVisible={surface !== null && zoomPercent > FIT_ZOOM_PERCENT}
      onViewportChange={onMiniMapViewportChange}
      viewport={miniMapViewport}
    >
      {surface === null ? null : (
        <svg
          aria-label={MINIMAP_LABEL}
          className="h-full w-full"
          role="img"
          viewBox={`${surface.x} ${surface.y} ${surface.width} ${surface.height}`}
        >
          {shapes.map((shape) => (
            <polygon fill={wallConfidenceToken(shape.confidenceTier)} key={shape.id} points={toSvgPoints(shape.outline)} />
          ))}
        </svg>
      )}
    </MiniMap>
  );
}
