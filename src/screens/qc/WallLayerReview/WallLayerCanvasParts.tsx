/**
 * Mảnh con của `WallLayerCanvas` (tách cho trần 400 dòng): ảnh nền, nét xem trước,
 * chú giải độ dày, bản đồ nhỏ (menu + toạ độ con trỏ ở `wallLayerCanvasActions.ts`).
 * Cùng luật view thuần của canvas: không một phép hình học nào, toạ độ do trình duyệt đổi.
 */

import { useMemo, useState } from 'react';

import { MiniMap } from '@/components/canvas/MiniMap';
import { WallThicknessLegend } from '@/components/canvas/WallThicknessLegend';

import { backgroundFrameRect } from '../shared/canvasFit';

import type { WallLayerCanvasViewProps, WallLayerRectPx } from './wallLayerHatch';
import { BACKGROUND_IMAGE_OPACITY, countWallBands, toSvgPoints, wallThicknessFillToken, WALL_THICKNESS_GROUP_LABELS } from './wallLayerHatch';

type Props = WallLayerCanvasViewProps;

const MINIMAP_LABEL = 'Mặt bằng thu nhỏ';
const UNBANDED_LEGEND_LABEL = 'Không chuẩn';
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

/** G4a-23: nét xem trước của Vẽ tường / dấu cắt của Tách đoạn — accent, nét đứt. */
export function WallDraftGuide({
  draftGuidePx,
  unitPx,
}: {
  readonly draftGuidePx: NonNullable<Props['draftGuidePx']>;
  readonly unitPx: number;
}) {
  return draftGuidePx.fromPx === null ? (
    <circle
      cx={draftGuidePx.toPx.x}
      cy={draftGuidePx.toPx.y}
      data-testid="wall-draft-guide"
      fill="none"
      pointerEvents="none"
      r={6 * unitPx}
      stroke="var(--accent)"
      strokeDasharray={`${3 * unitPx} ${2 * unitPx}`}
      strokeWidth={2 * unitPx}
    />
  ) : (
    <line
      data-testid="wall-draft-guide"
      pointerEvents="none"
      stroke="var(--accent)"
      strokeDasharray={`${6 * unitPx} ${4 * unitPx}`}
      strokeWidth={2 * unitPx}
      x1={draftGuidePx.fromPx.x}
      x2={draftGuidePx.toPx.x}
      y1={draftGuidePx.fromPx.y}
      y2={draftGuidePx.toPx.y}
    />
  );
}

/** A3: chú giải liệt kê đúng các nhóm có trên tầng, kèm số đếm — nhóm theo `wallThicknessBandOf`. */
export function WallLayerLegend({
  isWallLayerVisible,
  legendLevels,
  shapes,
  state,
}: Pick<Props, 'isWallLayerVisible' | 'legendLevels' | 'shapes' | 'state'>) {
  const bandCounts = useMemo(() => countWallBands(shapes.map((shape) => shape.thicknessMm)), [shapes]);

  return (
    <WallThicknessLegend
      activeFilter={legendLevels.activeFilter}
      availableLevels={[...bandCounts.bands.keys()]}
      className="whitespace-nowrap"
      labels={WALL_THICKNESS_GROUP_LABELS}
      counts={Object.fromEntries([...bandCounts.bands].map(([band, count]) => [String(band), count]))}
      isVisible={isWallLayerVisible}
      onFilterChange={legendLevels.onFilterChange}
      otherCount={bandCounts.unbanded > 0 ? bandCounts.unbanded : undefined}
      otherLabel={bandCounts.unbanded > 0 ? UNBANDED_LEGEND_LABEL : undefined}
      state={state === 'loading' || state === 'error' || state === 'empty' ? state : 'partial'}
    />
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
            <polygon fill={wallThicknessFillToken(shape.thicknessMm)} key={shape.id} points={toSvgPoints(shape.outline)} />
          ))}
        </svg>
      )}
    </MiniMap>
  );
}
