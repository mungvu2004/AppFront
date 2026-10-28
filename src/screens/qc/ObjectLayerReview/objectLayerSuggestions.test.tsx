/**
 * B3 — thêm món bị sót và gợi ý của máy trên màn Lớp đối tượng: kéo để vẽ (bấm vẫn là
 * 600 × 600 mm), ô rộng × sâu và "Xoay 90°", gợi ý nét đứt nhận/bỏ (từng món và cả loạt),
 * và gợi ý chưa nhận không vào cảnh 3D.
 */

import { createElement, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetMockLayerState } from '@/api/__mocks__/client';
import { FurnitureSchema } from '@/api/schemas/spatial';
import { denormalizeSpatial, normalizeSpatial, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type { Furniture, FurnitureId } from '@/domain/spatial/types';
import { __resetFloorLayerSavers } from '@/hooks/useAutosave';
import { boxAround } from '@/lib/input/dragDrop';
import { createShortcutRegistry, type ShortcutRegistry } from '@/lib/input/shortcutRegistry';
import { toPascalScene } from '@/lib/pascal/toPascal';
import { createTestQueryClient } from '@/lib/testing/render';
import { resetSelectorCaches } from '@/store/selectors';
import { useStore } from '@/store';

import { ObjectLayerCanvas } from './ObjectLayerCanvas';
import { ObjectLayerFootprintField } from './ObjectLayerFootprintField';
import {
  createMockObjectLayerReviewGateway,
  drawnFurnitureInputOf,
  evenMillimetres,
  OBJECT_LAYER_SAMPLE_GRAPH,
  OBJECT_LAYER_SAMPLE_LEVEL,
  scaleOfLevel,
  toPixelPoint,
} from './objectLayerReviewGateway';
import type { ObjectLayerReviewModel } from './objectLayerTypes';
import { useObjectLayerReview } from './useObjectLayerReview';

beforeEach(() => {
  __resetFloorLayerSavers();
  __resetMockLayerState();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  const store = useStore.getState();
  store.setSpatial(null, null);
  store.clearSelection();
  store.setHovered(null);
  resetSelectorCaches();
  vi.restoreAllMocks();
});

/* -------------------------------------------------------------------------- */
/* Bộ mẫu: đồ thị mẫu cộng hai gợi ý của máy.                                  */
/* -------------------------------------------------------------------------- */

const SUGGESTED_IDS = ['F-000091SUGG', 'F-000092SUGG'] as const satisfies readonly FurnitureId[];

const suggestion = (id: FurnitureId, x: number): Furniture => ({
  id,
  levelId: OBJECT_LAYER_SAMPLE_LEVEL.id,
  kind: 'bed',
  centre: { x, y: 4000 },
  boundingBox: boxAround({ x, y: 4000 }, 1600, 2000),
  rotationDeg: 0,
  confidence: 0.4,
  source: 'ai',
  reviewed: false,
  suggested: true,
});

function graphWithSuggestions(): NormalizedSpatial {
  const raw = denormalizeSpatial(OBJECT_LAYER_SAMPLE_GRAPH);

  return normalizeSpatial({
    ...raw,
    furniture: [...raw.furniture, suggestion(SUGGESTED_IDS[0], 13000), suggestion(SUGGESTED_IDS[1], 16000)],
  });
}

interface Mounted {
  readonly result: { current: ObjectLayerReviewModel };
  readonly registry: ShortcutRegistry;
  readonly unmount: () => void;
}

async function mountSettled(graph?: NormalizedSpatial): Promise<Mounted> {
  const registry = createShortcutRegistry();
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }): ReactNode =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  const rendered = renderHook(
    () =>
      useObjectLayerReview({
        projectId: 'project-1',
        floorId: OBJECT_LAYER_SAMPLE_LEVEL.id,
        roles: ['engineer'],
        gateway: createMockObjectLayerReviewGateway(graph === undefined ? {} : { graph }),
        registry,
      }),
    { wrapper },
  );

  await waitFor(() => {
    expect(rendered.result.current.state).not.toBe('loading');
  });

  return { result: rendered.result, registry, unmount: rendered.unmount };
}

async function run(action: () => void): Promise<void> {
  await act(async () => {
    action();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function pressKey(registry: ShortcutRegistry, key: string): Promise<void> {
  await act(async () => {
    registry.handleKeyDown({ key, ctrlKey: false }, null);
    await Promise.resolve();
  });
}

const storedFurniture = (id: string): Furniture | undefined =>
  useStore.getState().spatial?.byId[id] as Furniture | undefined;

const newFurniture = (before: ReadonlySet<string>): Furniture | undefined =>
  Object.values(useStore.getState().spatial?.byId ?? {}).find(
    (entity): entity is Furniture => 'boundingBox' in entity && !before.has(entity.id),
  );

const furnitureIds = (): ReadonlySet<string> =>
  new Set(Object.values(useStore.getState().spatial?.byId ?? {}).flatMap((entity) => ('boundingBox' in entity ? [entity.id] : [])));

const sizeOf = (item: Furniture) => ({
  width: Math.round(item.boundingBox.max.x - item.boundingBox.min.x),
  depth: Math.round(item.boundingBox.max.y - item.boundingBox.min.y),
});

/* -------------------------------------------------------------------------- */
/* Vẽ: bấm và kéo.                                                             */
/* -------------------------------------------------------------------------- */

describe('vẽ nội thất bị sót (B3)', () => {
  it('kéo cho đúng hộp hai góc; bấm vẫn là 600 × 600 mm', () => {
    const level = OBJECT_LAYER_SAMPLE_LEVEL;
    const dragged = drawnFurnitureInputOf(level, { x: 1000, y: 3000 }, { x: 2600, y: 1000 });

    expect(dragged.boundingBox).toEqual({ min: { x: 1000, y: 1000 }, max: { x: 2600, y: 3000 } });
    expect(dragged.centre).toEqual({ x: 1800, y: 2000 });
    /* Điểm bấm mm lẻ: tâm và hộp vẫn là mm nguyên, hộp đối xứng quanh tâm. */
    const odd = drawnFurnitureInputOf(level, { x: 1000.4, y: 999.6 }, { x: 2001.3, y: 1500.2 });

    expect(odd.centre).toEqual({ x: 1501, y: 1250 });
    expect(odd.boundingBox).toEqual({ min: { x: 1001, y: 1000 }, max: { x: 2001, y: 1500 } });
    expect(evenMillimetres(2101)).toBe(2102);
    expect(drawnFurnitureInputOf(level, { x: 1000, y: 2000 }).boundingBox).toEqual({
      min: { x: 700, y: 1700 },
      max: { x: 1300, y: 2300 },
    });
  });

  it('kéo trên hook: món mới phủ hộp kéo, được chọn và ô loại được đòi focus', async () => {
    const mounted = await mountSettled();
    const scale = scaleOfLevel(OBJECT_LAYER_SAMPLE_LEVEL);
    const before = furnitureIds();

    await run(() => mounted.result.current.onStartDraw('furniture'));
    await run(() =>
      mounted.result.current.onPlaceAt(
        toPixelPoint({ x: 13000, y: 3000 }, scale),
        toPixelPoint({ x: 14800, y: 5000 }, scale),
      ),
    );

    await waitFor(() => {
      expect(newFurniture(before)).toBeDefined();
    });

    const added = newFurniture(before) as Furniture;

    expect(sizeOf(added)).toEqual({ width: 1800, depth: 2000 });
    await waitFor(() => {
      expect(mounted.result.current.inspector?.footprintMm).toEqual({ widthMm: 1800, depthMm: 2000 });
    });
    expect(mounted.result.current.focusKindToken).toBe(1);
    expect(mounted.result.current.drawLayer).toBeNull();

    mounted.unmount();
  });

  it('ô rộng × sâu gọi furniture.resize, "Xoay 90°" gọi furniture.rotate', async () => {
    const mounted = await mountSettled(graphWithSuggestions());
    const id = mounted.result.current.objects.find((object) => object.entityId === SUGGESTED_IDS[0])?.id as string;

    await run(() => mounted.result.current.onResize?.(id, { widthMm: 1800, depthMm: 2100 }));
    await waitFor(() => {
      expect(sizeOf(storedFurniture(SUGGESTED_IDS[0]) as Furniture)).toEqual({ width: 1800, depth: 2100 });
    });

    await run(() => mounted.result.current.onRotate?.(id));
    await waitFor(() => {
      expect(storedFurniture(SUGGESTED_IDS[0])?.rotationDeg).toBe(90);
    });

    mounted.unmount();
  });
});

/* -------------------------------------------------------------------------- */
/* Gợi ý: hiện, nhận, bỏ, cả loạt.                                              */
/* -------------------------------------------------------------------------- */

describe('gợi ý của máy (B3)', () => {
  it('gợi ý hiện nét đứt + nhãn; Enter nhận (bỏ cờ, đặt duyệt), Del bỏ', async () => {
    const mounted = await mountSettled(graphWithSuggestions());
    const idOf = (entityId: string) =>
      mounted.result.current.objects.find((object) => object.entityId === entityId)?.id as string;
    const first = idOf(SUGGESTED_IDS[0]);

    expect(mounted.result.current.suggestionCount).toBe(2);
    expect(mounted.result.current.placements.find((placement) => placement.id === first)?.isSuggested).toBe(true);
    expect(mounted.result.current.rows.find((row) => row.id === first)?.isSuggested).toBe(true);

    await run(() => mounted.result.current.onSelect(first));
    expect(mounted.result.current.inspector?.isSuggested).toBe(true);
    await pressKey(mounted.registry, 'Enter');
    await waitFor(() => {
      expect(storedFurniture(SUGGESTED_IDS[0])?.reviewed).toBe(true);
    });
    expect(storedFurniture(SUGGESTED_IDS[0])?.suggested).toBeUndefined();
    expect(mounted.result.current.suggestionCount).toBe(1);

    await run(() => mounted.result.current.onSelect(idOf(SUGGESTED_IDS[1])));
    await pressKey(mounted.registry, 'Delete');
    await waitFor(() => {
      expect(storedFurniture(SUGGESTED_IDS[1])).toBeUndefined();
    });
    expect(mounted.result.current.suggestionCount).toBe(0);

    mounted.unmount();
  });

  it('"Nhận tất cả gợi ý" nhận cả hai trong một bước hoàn tác', async () => {
    const mounted = await mountSettled(graphWithSuggestions());

    await run(() => mounted.result.current.onAcceptAllSuggestions?.());
    await waitFor(() => {
      expect(SUGGESTED_IDS.map((id) => storedFurniture(id)?.reviewed)).toEqual([true, true]);
    });
    expect(SUGGESTED_IDS.map((id) => storedFurniture(id)?.suggested)).toEqual([undefined, undefined]);

    await run(() => mounted.result.current.onUndo());
    await waitFor(() => {
      expect(SUGGESTED_IDS.map((id) => storedFurniture(id)?.suggested)).toEqual([true, true]);
    });

    mounted.unmount();
  });

  it('"Bỏ tất cả gợi ý" xoá cả hai, món thường còn nguyên, hoàn tác trả lại', async () => {
    const mounted = await mountSettled(graphWithSuggestions());
    const others = mounted.result.current.objects.length - SUGGESTED_IDS.length;

    await run(() => mounted.result.current.onRejectAllSuggestions?.());
    await waitFor(() => {
      expect(SUGGESTED_IDS.map((id) => storedFurniture(id))).toEqual([undefined, undefined]);
    });
    expect(mounted.result.current.objects).toHaveLength(others);

    await run(() => mounted.result.current.onUndo());
    await waitFor(() => {
      expect(mounted.result.current.suggestionCount).toBe(2);
    });

    mounted.unmount();
  });

  it('gợi ý chưa nhận không vào cảnh 3D; nhận rồi thì vào', () => {
    const graph = denormalizeSpatial(graphWithSuggestions());
    const pending = toPascalScene(graph);
    const accepted = toPascalScene({
      ...graph,
      furniture: graph.furniture.map((item) => ({ ...item, suggested: false, source: 'human', reviewed: true })),
    });
    const sceneText = (scene: unknown) => JSON.stringify(scene);

    expect(pending.skipped.filter((entry) => SUGGESTED_IDS.includes(entry.id as never))).toHaveLength(2);
    expect(accepted.skipped.some((entry) => SUGGESTED_IDS.includes(entry.id as never))).toBe(false);
    expect(sceneText(accepted.scene).length).toBeGreaterThan(sceneText(pending.scene).length);
  });

  it('dây: cờ suggested đọc được, vắng là vắng khoá', () => {
    const wire = { ...suggestion(SUGGESTED_IDS[0], 13000) };
    const plain: Partial<Furniture> = { ...wire };

    delete plain.suggested;

    expect(FurnitureSchema.parse(wire).suggested).toBe(true);
    expect('suggested' in FurnitureSchema.parse(plain)).toBe(false);
    expect('suggested' in FurnitureSchema.parse({ ...plain, suggested: false })).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* View: canvas kéo/bấm, ô số.                                                  */
/* -------------------------------------------------------------------------- */

const VIEW_BOX = { x: 0, y: 0, width: 400, height: 400 };

function renderCanvas(onPlaceAt: (point: { x: number; y: number }, corner?: { x: number; y: number }) => void) {
  render(
    <ObjectLayerCanvas
      backgroundImageAlt=""
      backgroundImageUrl={null}
      dragMeasurement={null}
      drawLayer="furniture"
      haloRectPx={null}
      highlightedWallId={null}
      hoveredObjectId={null}
      isInteractive
      layerVisibility={{ door: true, window: true, furniture: true }}
      millimetresPerPixel={OBJECT_LAYER_SAMPLE_LEVEL.scaleMillimetresPerPixel as never}
      objects={[]}
      onFrameResize={vi.fn()}
      onHover={vi.fn()}
      onPlaceAt={onPlaceAt}
      onSelect={vi.fn()}
      placements={[]}
      selectedObjectId={null}
      surfaceRectPx={null}
      unitPx={1}
      viewBoxPx={VIEW_BOX}
      wallOutlines={[]}
    />,
  );

  const surface = screen.getByTestId('object-draw-surface') as unknown as SVGRectElement;

  /* jsdom không bố trí: `<svg>` 400 × 400 px ở góc trên trái, khớp đúng viewBox. */
  vi.spyOn(surface.ownerSVGElement as SVGSVGElement, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 400,
    height: 400,
  } as DOMRect);

  return surface;
}

describe('canvas vẽ (B3)', () => {
  it('kéo dưới 5 px là một cú bấm: chỉ một điểm', () => {
    const onPlaceAt = vi.fn();
    const surface = renderCanvas(onPlaceAt);

    fireEvent.mouseDown(surface, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(surface, { clientX: 103, clientY: 102 });
    fireEvent.mouseUp(surface, { clientX: 103, clientY: 102 });

    expect(onPlaceAt).toHaveBeenCalledTimes(1);
    expect(onPlaceAt).toHaveBeenCalledWith({ x: 100, y: 100 });
  });

  it('kéo xa hơn 5 px: hai góc, có hộp xem trước trong lúc kéo', () => {
    const onPlaceAt = vi.fn();
    const surface = renderCanvas(onPlaceAt);

    fireEvent.mouseDown(surface, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(surface, { clientX: 180, clientY: 160 });
    expect(screen.getByTestId('object-draw-preview').getAttribute('width')).toBe('80');
    fireEvent.mouseUp(surface, { clientX: 180, clientY: 160 });

    expect(onPlaceAt).toHaveBeenCalledWith({ x: 100, y: 100 }, { x: 180, y: 160 });
    expect(screen.queryByTestId('object-draw-preview')).toBeNull();
  });

  it('ô số: Enter ghi rộng × sâu mới, số không hợp lệ trả về số cũ', () => {
    const onResize = vi.fn();
    const onRotate = vi.fn();

    render(<ObjectLayerFootprintField depthMm={600} objectId="F-001" onResize={onResize} onRotate={onRotate} widthMm={600} />);

    const width = screen.getByLabelText('Chiều rộng (mm)');

    fireEvent.change(width, { target: { value: '1800' } });
    fireEvent.keyDown(width, { key: 'Enter' });
    expect(onResize).toHaveBeenCalledWith('F-001', { widthMm: 1800, depthMm: 600 });

    fireEvent.change(width, { target: { value: '0' } });
    fireEvent.blur(width);
    expect(onResize).toHaveBeenCalledTimes(1);
    expect((width as HTMLInputElement).value).toBe('600');

    fireEvent.click(screen.getByRole('button', { name: /Xoay 90°/u }));
    expect(onRotate).toHaveBeenCalledWith('F-001');
  });
});
