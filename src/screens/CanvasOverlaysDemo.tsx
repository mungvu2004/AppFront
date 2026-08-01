import React, { useRef, useState } from 'react';
import { WallThicknessLegend } from '../components/canvas/WallThicknessLegend';
import { ZoomCluster } from '../components/canvas/ZoomCluster';
import { MiniMap } from '../components/canvas/MiniMap';
import { MeasurementLabel } from '../components/canvas/MeasurementLabel';
import { useMeasurementLabel } from '../hooks/useMeasurementLabel';
import { TransformGizmo } from '../components/canvas/TransformGizmo';
import { SelectionHalo } from '../components/canvas/SelectionHalo';
import { useSelectionHalo } from '../hooks/useSelectionHalo';
import { ContextMenu } from '../components/canvas/ContextMenu';
import { useContextMenu } from '../hooks/useContextMenu';
import { Button } from '../components/ui/Button';

export function CanvasOverlaysDemo() {
  const [is3D, setIs3D] = useState(false);

  // Measurement hooks
  const {
    state: measState,
    startPoint,
    currentPoint,
    midPoint,
    distanceFormatted,
    startMeasurement,
    updateMeasurement,
    commitMeasurement,
    resetMeasurement,
  } = useMeasurementLabel();

  // Halo hook — new API: select/hover/deselect + variant
  const { isVisible: haloVisible, variant: haloVariant, hasEntered, select, deselect } =
    useSelectionHalo();

  // Context menu hook — new API: groups
  const { isVisible: ctxVisible, position: ctxPos, groups: ctxGroups, openMenuFlat, closeMenu } =
    useContextMenu();

  const canvasRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (measState === 'idle') {
        startMeasurement(x, y);
      } else if (measState === 'committed') {
        resetMeasurement();
        startMeasurement(x, y);
      } else {
        commitMeasurement();
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (measState === 'measuring') {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        updateMeasurement(e.clientX - rect.left, e.clientY - rect.top);
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    openMenuFlat(e.clientX, e.clientY, [
      { id: 'edit',    label: 'Chỉnh sửa thuộc tính', kbd: '⌘E',  action: () => console.log('edit') },
      { id: 'isolate', label: 'Cô lập',                kbd: 'I',   action: () => console.log('isolate') },
      { id: 'delete',  label: 'Xoá phần tử',           kbd: '⌫',  isDestructive: true, action: () => console.log('delete') },
    ]);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-bg-app">
      <div className="flex-none p-4 border-b border-border-default flex items-center justify-between">
        <h1 className="text-xl font-medium">Canvas Overlays Demo</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setIs3D(!is3D)}>
            Chế độ {is3D ? '2D' : '3D'}
          </Button>
          <Button variant="secondary" onClick={() => (haloVisible ? deselect() : select())}>
            Bật/tắt Selection Halo
          </Button>
        </div>
      </div>

      <div className="flex-1 relative p-8">
        <div
          ref={canvasRef}
          className="relative w-full h-full rounded shadow-panel overflow-hidden cursor-crosshair select-none"
          style={{
            backgroundColor: is3D ? 'var(--canvas-3d)' : 'var(--canvas-2d)',
            backgroundImage: is3D
              ? 'none'
              : 'linear-gradient(to right, var(--canvas-2d-grid) 1px, transparent 1px), linear-gradient(to bottom, var(--canvas-2d-grid) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onContextMenu={handleContextMenu}
        >
          {/* Mock 3D Ground/Horizon */}
          {is3D && (
            <div className="absolute inset-0 pointer-events-none flex flex-col">
              <div className="flex-1" />
              <div className="flex-1 bg-canvas-3d-ground border-t border-canvas-3d-horizon" />
            </div>
          )}

          {/* Overlays */}
          <WallThicknessLegend state="success" />
          <ZoomCluster />
          <MiniMap />

          {is3D && <TransformGizmo cx={200} cy={200} />}

          <MeasurementLabel
            state={measState}
            startPoint={startPoint}
            currentPoint={currentPoint}
            midPoint={midPoint}
            distanceFormatted={distanceFormatted}
          />

          <SelectionHalo
            isVisible={haloVisible}
            variant={haloVariant}
            hasEntered={hasEntered}
            width={200}
            height={150}
            x={200}
            y={200}
          />

          <ContextMenu
            isVisible={ctxVisible}
            position={ctxPos}
            groups={ctxGroups}
            onClose={closeMenu}
          />
        </div>
      </div>
    </div>
  );
}
