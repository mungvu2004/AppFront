import { QcCompareSplit } from '../shared/QcCompareSplit';

import { WallLayerCanvas } from './WallLayerCanvas';
import { WallDrawingBackground } from './WallLayerCanvasParts';
import type { WallLayerCanvasViewProps } from './wallLayerHatch';

/**
 * Canvas Tường trong khung "So sánh hai bên": nửa trái là ảnh bản vẽ rõ nét ở đúng pixel khung mà hook
 * tính cho canvas phải (`surfaceRectPx`), nên kéo/phóng một nơi là cả hai cùng đi.
 */
export function WallLayerCompareCanvas({
  canPick,
  ...canvas
}: WallLayerCanvasViewProps & { readonly canPick: boolean }) {
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
      onZoom={(direction) => (direction > 0 ? canvas.onZoomIn() : canvas.onZoomOut())}
    >
      <WallLayerCanvas {...canvas} />
    </QcCompareSplit>
  );
}
