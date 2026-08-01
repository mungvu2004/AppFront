import type { Meta, StoryObj } from '@storybook/react';
import React, { useState, useCallback } from 'react';
import { GridLayer } from './GridLayer';
import { WallThicknessLegend } from './WallThicknessLegend';
import { ZoomCluster } from './ZoomCluster';
import { MiniMap } from './MiniMap';
import { wallStrokeToken, isLowConfidence } from './materialMap';
import { MOCK_SPATIAL_PROJECT } from '../../mocks/spatial';

const meta: Meta = {
  title: 'Canvas / Integration',
  parameters: {
    layout: 'fullscreen',
  },
};
export default meta;

function Canvas48WallsDemo() {
  const geometry = MOCK_SPATIAL_PROJECT.geometry['L1']!;
  const walls = Object.values(geometry.walls);
  const vertices = geometry.vertices;
  const scaleRatio = MOCK_SPATIAL_PROJECT.project_metadata.scale_ratio_mm_per_px;

  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(60);
  const [panY, setPanY] = useState(40);
  const [isPanning, setIsPanning] = useState(false);
  const lastPan = React.useRef<{ x: number; y: number } | null>(null);

  const canvasW = 1440;
  const canvasH = 800;

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom((z) => Math.max(0.1, Math.min(8, z * factor)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 1 && e.button !== 0) return;
    setIsPanning(true);
    lastPan.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning || !lastPan.current) return;
      setPanX((p) => p + e.clientX - lastPan.current!.x);
      setPanY((p) => p + e.clientY - lastPan.current!.y);
      lastPan.current = { x: e.clientX, y: e.clientY };
    },
    [isPanning]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    lastPan.current = null;
  }, []);

  const svgTransform = `translate(${panX} ${panY}) scale(${zoom / scaleRatio})`;

  return (
    <div
      className="relative overflow-hidden bg-canvas-2d select-none"
      style={{ width: canvasW, height: canvasH, cursor: isPanning ? 'grabbing' : 'default' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <GridLayer
        width={canvasW}
        height={canvasH}
        zoom={zoom}
        offsetX={panX}
        offsetY={panY}
        scaleRatioMmPerPx={1}
      />
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ width: canvasW, height: canvasH, overflow: 'visible' }}
        aria-label={`Bản vẽ tầng 1 — ${walls.length} tường`}
      >
        <g transform={svgTransform}>
          {walls.map((wall) => {
            const p1 = vertices[wall.from];
            const p2 = vertices[wall.to];
            if (!p1 || !p2) return null;

            const strokeColor = wallStrokeToken(wall.thickness_mm);
            const strokeW = wall.thickness_mm === 'CONCRETE_COLUMN' ? 330 : Number(wall.thickness_mm);
            const lowConf = isLowConfidence(wall.confidence);

            return (
              <g key={wall.id}>
                <line
                  x1={p1.x} y1={p1.y}
                  x2={p2.x} y2={p2.y}
                  stroke={strokeColor}
                  strokeWidth={strokeW}
                  strokeLinecap="square"
                  opacity={lowConf ? 0.55 : 1}
                />
                {lowConf && (
                  <line
                    x1={p1.x} y1={p1.y}
                    x2={p2.x} y2={p2.y}
                    stroke={strokeColor}
                    strokeWidth={strokeW}
                    strokeLinecap="square"
                    strokeDasharray="60 40"
                    opacity={0.06}
                  />
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <WallThicknessLegend state="success" />
      <ZoomCluster />
      <MiniMap />
    </div>
  );
}

export const Canvas48Walls: StoryObj = {
  name: '48 tường (performance)',
  parameters: {
    docs: { description: { story: 'Pan bằng chuột trái, zoom bằng scroll. Mục tiêu ≥ 45 fps.' } },
  },
  render: () => <Canvas48WallsDemo />,
};
