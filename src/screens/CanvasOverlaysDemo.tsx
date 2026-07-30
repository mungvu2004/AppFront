import React, { useRef, useState } from 'react';
import { WallThicknessLegend } from '../components/canvas/WallThicknessLegend';
import { ZoomCluster } from '../components/canvas/ZoomCluster';
import { MiniMap } from '../components/canvas/MiniMap';
import { MeasurementLabel } from '../components/canvas/MeasurementLabel';
import { useMeasurementLabel } from '../components/canvas/useMeasurementLabel';
import { TransformGizmo } from '../components/canvas/TransformGizmo';
import { SelectionHalo } from '../components/canvas/SelectionHalo';
import { useSelectionHalo } from '../components/canvas/useSelectionHalo';
import { ContextMenu } from '../components/canvas/ContextMenu';
import { useContextMenu } from '../components/canvas/useContextMenu';
import { Button } from '../components/ui/Button';

export function CanvasOverlaysDemo() {
  const [is3D, setIs3D] = useState(false);
  
  // Measurement hooks
  const {
    state: measState,
    startPoint,
    currentPoint,
    distance,
    startMeasurement,
    updateMeasurement,
    commitMeasurement,
    resetMeasurement,
  } = useMeasurementLabel();

  // Halo hook
  const { isSelected, isPulsing, selectObject, deselectObject } = useSelectionHalo();

  // Context menu hook
  const { isVisible: ctxVisible, position: ctxPos, items: ctxItems, openMenu, closeMenu } = useContextMenu();

  const canvasRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return; // Right click handled by context menu
    
    // For demo: click to measure
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
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      openMenu(e.clientX - rect.left, e.clientY - rect.top, [
        { id: 'edit', label: 'Edit Properties', action: () => console.log('edit') },
        { id: 'isolate', label: 'Isolate', action: () => console.log('isolate') },
        { id: 'delete', label: 'Delete Element', isDestructive: true, action: () => console.log('delete') },
      ]);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-bg-app">
      <div className="flex-none p-4 border-b border-border-default flex items-center justify-between">
        <h1 className="text-xl font-medium">Canvas Overlays Demo</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setIs3D(!is3D)}>
            Toggle {is3D ? '2D' : '3D'} Mode
          </Button>
          <Button variant="secondary" onClick={() => (isSelected ? deselectObject() : selectObject())}>
            Toggle Selection Halo
          </Button>
          <Button variant="secondary" onClick={() => selectObject(true)}>
            Trigger Violation Pulse
          </Button>
        </div>
      </div>

      <div className="flex-1 relative p-8">
        {/* The "Canvas" area */}
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
          {/* Mock 3D Ground/Horizon if needed */}
          {is3D && (
            <div className="absolute inset-0 pointer-events-none flex flex-col">
              <div className="flex-1" />
              <div className="flex-1 bg-[var(--canvas-3d-ground)] border-t border-[var(--canvas-3d-horizon)]" />
            </div>
          )}

          {/* Overlays */}
          <WallThicknessLegend />
          <ZoomCluster />
          <MiniMap />
          
          {is3D && <TransformGizmo />}

          <MeasurementLabel 
            state={measState}
            startPoint={startPoint}
            currentPoint={currentPoint}
            distance={distance}
          />

          <SelectionHalo 
            isSelected={isSelected}
            isPulsing={isPulsing}
            width={200}
            height={150}
            x={200}
            y={200}
            isViolation={isPulsing}
          />

          <ContextMenu 
            isVisible={ctxVisible}
            position={ctxPos}
            items={ctxItems}
            onClose={closeMenu}
          />
        </div>
      </div>
    </div>
  );
}
