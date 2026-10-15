/** QA-06 BUG-717 / BUG-715: [30-G-008] telemetry of the export gateway; [30-C-023] .glb of the seedExportProject shape. */
import { describe, expect, it, vi } from 'vitest';

import { createTelemetrySender, type TelemetryTransport } from '@/lib/telemetry/sender';

import { createExportPanelGateway } from './exportPanelGateway';

const SIZE_BYTES = 20_480;
const DURATION_MS = 1_200;

function senderWith(enabled: boolean) {
  const send = vi.fn(() => Promise.resolve());
  const transport: TelemetryTransport = { send, sendOnClose: () => true };
  const telemetry = createTelemetrySender({ transport, sessionId: 'sess-30-g-008', enabled });
  const gateway = createExportPanelGateway({ deliver: vi.fn(), telemetry });
  return { send, telemetry, gateway };
}

describe('[30-G-008] export telemetry (BUG-717, moved down from the stack)', () => {
  it('[30-G-008] flag on: a .glb export sends one export.file event with format, outcome, size', () => {
    const { send, telemetry, gateway } = senderWith(true);
    gateway.track({ formatId: 'glb', outcome: 'success', durationMs: DURATION_MS, sizeBytes: SIZE_BYTES, pageCount: 0 });
    telemetry.flush();
    expect(send).toHaveBeenCalledTimes(1);
    const batch = (send.mock.calls[0] as unknown as [{ events: { event: Record<string, unknown> }[] }])[0];
    expect(batch.events).toHaveLength(1);
    expect(batch.events[0]?.event).toMatchObject({ name: 'export.file', format: 'glb', outcome: 'success', sizeKb: 20, pageCount: 0 });
  });

  it('[30-G-008] flag off: nothing is sent', () => {
    const { send, telemetry, gateway } = senderWith(false);
    gateway.track({ formatId: 'glb', outcome: 'success', durationMs: DURATION_MS, sizeBytes: SIZE_BYTES, pageCount: 0 });
    telemetry.flush();
    expect(telemetry.enabled).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('[30-G-008] Spatial JSON has no telemetry format: no event even with the flag on', () => {
    const { send, telemetry, gateway } = senderWith(true);
    gateway.track({ formatId: 'spatial-json', outcome: 'success', durationMs: DURATION_MS, sizeBytes: SIZE_BYTES, pageCount: 0 });
    telemetry.flush();
    expect(send).not.toHaveBeenCalled();
  });
});

describe('[30-C-023] .glb of the seedExportProject floor (BUG-715: a 40 mm wall used to fail the whole export)', () => {
  it('[30-C-023] a floor with a 40 mm wall still exports, the wall at the minimum thickness', async () => {
    const { createSampleBuilding } = await import('@/domain/spatial/__fixtures__/sampleBuilding');
    const { normalizeSpatial } = await import('@/domain/spatial/normalize');
    const { exportToGlb, DEFAULT_EXPORT_OPTIONS } = await import('@/lib/export/glb.worker');
    const { toExportFloors } = await import('./exportPanelGateway');
    const qcLayer = (levelId: string): Record<string, unknown[]> => {
      // Copy of qa/tests/support/layerSeed.ts qcLayer (layerSeed cannot load under jsdom: node:crypto + playwright).
      const ai = { confidence: 0.9, reviewed: false, source: 'ai' };
      let n = 0;
      const wall = (a: number[], b: number[], extra: Record<string, unknown> = {}) => ({ ...ai, centreline: { start: { x: a[0], y: a[1] }, end: { x: b[0], y: b[1] } }, heightMm: 3000, id: `W-QC${String(n++).padStart(10, '0')}`, kind: 'loadBearing', levelId, openingIds: [], thicknessMm: 220, ...extra });
      const walls = [wall([0, 0], [4000, 0]), wall([4000, 0], [8000, 0]), wall([0, 6000], [4000, 6000]), wall([4000, 6000], [8000, 6000]), wall([0, 0], [0, 3000]), wall([0, 3000], [0, 6000]), wall([8000, 0], [8000, 3000]), wall([8000, 3000], [8000, 6000]), wall([1000, 2000], [7000, 2000], { kind: 'partition', thicknessMm: 200 }), wall([1000, 4000], [7000, 4000], { kind: 'partition', thicknessMm: 200 })];
      const room = (id: string, y0: number, y1: number) => ({ ...ai, areaM2: 16, id, levelId, name: 'R', outline: [{ x: 0, y: y0 }, { x: 8000, y: y0 }, { x: 8000, y: y1 }, { x: 0, y: y1 }], usage: 'kitchen', wallIds: [] });
      return {
        walls,
        openings: [{ ...ai, heightMm: 2100, id: 'D-QC0000000001', kind: 'door', offsetMm: 1000, sillHeightMm: 0, swing: 'left', wallId: (walls[4] as { id: string }).id, widthMm: 900 }, { ...ai, heightMm: 1200, id: 'D-QC0000000002', kind: 'window', offsetMm: 1000, sillHeightMm: 900, swing: 'fixed', wallId: (walls[6] as { id: string }).id, widthMm: 1200 }],
        rooms: [room('R-QC0000000001', 0, 2000), room('R-QC0000000002', 4000, 6000)],
        furniture: [{ ...ai, boundingBox: { min: { x: 1600, y: 700 }, max: { x: 2400, y: 1300 } }, centre: { x: 2000, y: 1000 }, id: 'F-QC0000000001', kind: 'table', levelId, roomId: 'R-QC0000000001', rotationDeg: 0 }],
      };
    };
    const sample = createSampleBuilding();
    const level = sample.levels[0]!;
    const layer = qcLayer(level.id);
    const thin = { confidence: 0.9, reviewed: false, source: 'ai', centreline: { start: { x: 1000, y: 1000 }, end: { x: 3000, y: 1000 } }, heightMm: 3000, id: 'W-THIN00000000000000', kind: 'partition', levelId: level.id, openingIds: [], thicknessMm: 40 };
    const graph = { building: sample.building, levels: [level], walls: [...layer.walls!, thin], openings: layer.openings!, furniture: layer.furniture!, rooms: layer.rooms!, axes: [], dimensions: [], notes: [] };
    const g2 = normalizeSpatial(graph as unknown as typeof sample);
    const floors = await toExportFloors(g2, [level]);
    expect(Math.min(...floors.flatMap((floor) => floor.walls.map((wall) => wall.thicknessMm)))).toBe(60);
    const hooks = { onProgress: () => undefined, shouldCancel: () => false, yieldToQueue: () => Promise.resolve() };
    const glb = await exportToGlb({ projectName: 'p', projectVersion: 'v', exportedAt: '2026-01-01T00:00:00.000Z', floors, options: DEFAULT_EXPORT_OPTIONS }, hooks);
    expect(glb.byteLength).toBeGreaterThan(0);
  });
});
