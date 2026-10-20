import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSampleBuilding, sampleLevelId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { Millimetres, SpatialGraph } from '@/domain/spatial/types';
import { useStore } from '@/store';

import { SCALE_BANNER_TEXT, ScaleBanner } from '../scaleBanner';
import { tinyFootprintLevel } from '../useScaleStatus';

/** Thu mọi tường về 1/1000 — nhà còn chưa tới 3 m, dấu hiệu tỷ lệ sai. */
const shrunk = (graph: SpatialGraph): SpatialGraph => ({
  ...graph,
  walls: graph.walls.map((wall) => ({
    ...wall,
    centreline: {
      start: { x: (wall.centreline.start.x / 1000) as Millimetres, y: (wall.centreline.start.y / 1000) as Millimetres },
      end: { x: (wall.centreline.end.x / 1000) as Millimetres, y: (wall.centreline.end.y / 1000) as Millimetres },
    },
  })),
});

const mount = (graph: SpatialGraph, readScale: (floorId: string) => Promise<{ scaleStatus?: 'unresolved' }>) => {
  /* eslint-disable-next-line local/no-direct-set -- giả lập kho vừa nạp, như bridge.test.ts */
  useStore.setState({ spatial: normalizeSpatial(graph) });
  render(<ScaleBanner projectId="p1" readScale={readScale} />);
};

afterEach(() => {
  /* eslint-disable-next-line local/no-direct-set -- đưa kho về rỗng giữa các bài */
  useStore.setState({ spatial: null });
});

describe('tinyFootprintLevel', () => {
  it('nhà thật không bị nghi, nhà thu 1/1000 bị nghi', () => {
    const graph = createSampleBuilding();
    expect(tinyFootprintLevel(graph.levels, graph.walls)).toBeUndefined();
    const tiny = shrunk(graph);
    expect(tinyFootprintLevel(tiny.levels, tiny.walls)).toBe(sampleLevelId(0));
  });
});

describe('ScaleBanner', () => {
  it('tầng unresolved → dải cảnh báo + lối hiệu chỉnh tỷ lệ của tầng đó', async () => {
    const readScale = vi.fn(async () => ({ scaleStatus: 'unresolved' as const }));
    mount(createSampleBuilding(), readScale);
    const banner = await screen.findByRole('status');
    expect(banner.textContent).toContain(SCALE_BANNER_TEXT);
    expect(screen.getByRole('link', { name: 'Hiệu chỉnh tỷ lệ' }).getAttribute('href')).toBe(
      `/projects/p1/floors/${sampleLevelId(0)}/scale`,
    );
    expect(readScale).toHaveBeenCalledWith(sampleLevelId(0));
  });

  it('đã hiệu chỉnh và kích thước hợp lý → không hiện', async () => {
    const readScale = vi.fn(async () => ({}));
    mount(createSampleBuilding(), readScale);
    await waitFor(() => expect(readScale).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('đã hiệu chỉnh nhưng nhà < 3 m → vẫn cảnh báo', async () => {
    mount(shrunk(createSampleBuilding()), async () => ({}));
    expect((await screen.findByRole('status')).textContent).toContain(SCALE_BANNER_TEXT);
  });

  it('đọc lỗi → không hiện, chỉ log', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mount(createSampleBuilding(), async () => {
      throw new Error('500');
    });
    await waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('status')).toBeNull();
    warn.mockRestore();
  });

  it('một tầng đọc lỗi không giấu tầng unresolved khác', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mount(createSampleBuilding(), async (floorId) => {
      if (floorId === sampleLevelId(0)) throw new Error('500');
      return floorId === sampleLevelId(2) ? { scaleStatus: 'unresolved' } : {};
    });
    await screen.findByRole('status');
    expect(screen.getByRole('link', { name: 'Hiệu chỉnh tỷ lệ' }).getAttribute('href')).toBe(
      `/projects/p1/floors/${sampleLevelId(2)}/scale`,
    );
    warn.mockRestore();
  });

  it('một tầng đọc lỗi, nhà < 3 m → vẫn cảnh báo theo phép đoán', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mount(shrunk(createSampleBuilding()), async (floorId) => {
      if (floorId === sampleLevelId(1)) throw new Error('500');
      return {};
    });
    expect((await screen.findByRole('status')).textContent).toContain(SCALE_BANNER_TEXT);
    warn.mockRestore();
  });
});
