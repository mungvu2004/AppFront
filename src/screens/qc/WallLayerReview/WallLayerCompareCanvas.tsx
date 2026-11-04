import { QcCompareSplit } from '../shared/QcCompareSplit';
import { useQcCompare } from '../shared/qcCompare';

import { WallLayerCanvas } from './WallLayerCanvas';
import { WallDrawingBackground } from './WallLayerCanvasParts';
import type { WallLayerCanvasViewProps } from './wallLayerHatch';

/**
 * Canvas Tường trong khung "So sánh hai bên": nửa trái là ảnh bản vẽ rõ nét ở đúng pixel khung mà hook
 * tính cho canvas phải (`surfaceRectPx`), nên kéo/phóng một nơi là cả hai cùng đi.
 * Lúc so sánh, thẻ của tường do khung vẽ ở cả hai nửa (`tag`), canvas phải không tự vẽ thẻ riêng nữa.
 */
export function WallLayerCompareCanvas({
  canPick,
  ...canvas
}: WallLayerCanvasViewProps & { readonly canPick: boolean }) {
  const isComparing = useQcCompare();
  const surface =
    canvas.drawingSizePx === null
      ? canvas.contentBoundsPx
      : { x: 0, y: 0, width: canvas.drawingSizePx.width, height: canvas.drawingSizePx.height };

  return (
    <QcCompareSplit
      canPick={canPick && canvas.isInteractive}
      drawing={
        <WallDrawingBackground
          backgroundImageAlt={canvas.backgroundImageAlt}
          backgroundImageUrl={canvas.backgroundImageUrl}
          opacity={1}
          surface={surface}
          surfaceRectPx={canvas.surfaceRectPx}
        />
      }
      haloRect={canvas.selectedWallId === null ? null : canvas.haloRectPx}
      onPanBy={canvas.onPanBy}
      tag={
        canvas.wallTag == null || canvas.haloRectPx === null || !canvas.isWallLayerVisible
          ? null
          : { anchorPx: canvas.wallTag.anchorPx, rect: canvas.haloRectPx, text: canvas.wallTag.text, tier: canvas.wallTag.tier }
      }
      onZoom={(direction) => (direction > 0 ? canvas.onZoomIn() : canvas.onZoomOut())}
    >
      <WallLayerCanvas {...canvas} wallTag={isComparing ? null : (canvas.wallTag ?? null)} />
    </QcCompareSplit>
  );
}
