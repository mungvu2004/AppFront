import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSampleBuilding, sampleLevelId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import type { Millimetres, SpatialGraph } from '@/domain/spatial/types';
import { useStore } from '@/store';

import { SCALE_ALL_MISSING_TITLE, SCALE_HIDDEN_NOTE, ScaleBanner, ScaleEmptyNotice } from '../scaleBanner';
import { scaleStatusOf } from '../useScaleStatus';

const PROVISIONAL_TEXT = 'chưa hiệu chỉnh tỷ lệ';
const MISSING_TEXT = 'không đo được tỷ lệ, kích thước 3D sai';

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

/** Mọi tường mỏng 20 mm — trung vị < 50 mm, tỷ lệ máy đo gần như chắc sai. */
const thinWalls = (graph: SpatialGraph): SpatialGraph => ({
  ...graph,
  walls: graph.walls.map((wall) => ({ ...wall, thicknessMm: 20 as Millimetres })),
});

interface ReadResult {
  scaleStatus?: 'unresolved';
  scaleSource?: 'pipeline' | 'project_default';
  level?: { scaleMillimetresPerPixel?: number };
}

/** N16 của tầng có tỷ lệ máy đo, chưa xác nhận (wire luôn kèm mm/px khi `unresolved`). */
const MEASURED: ReadResult = { scaleStatus: 'unresolved', scaleSource: 'pipeline', level: { scaleMillimetresPerPixel: 10 } };

const mount = (graph: SpatialGraph, readScale: (floorId: string) => Promise<ReadResult>) => {
  /* eslint-disable-next-line local/no-direct-set -- giả lập kho vừa nạp, như bridge.test.ts */
  useStore.setState({ spatial: normalizeSpatial(graph) });
  render(
    <>
      <ScaleBanner projectId="p1" readScale={readScale} />
      <ScaleEmptyNotice projectId="p1" readScale={readScale} />
    </>,
  );
};

afterEach(() => {
  /* eslint-disable-next-line local/no-direct-set -- đưa kho về rỗng giữa các bài */
  useStore.setState({ spatial: null });
});

describe('scaleStatusOf — cùng luật với QC (Codex P1)', () => {
  const statusOf = (graph: SpatialGraph, read: (floorId: string) => Promise<ReadResult>) => {
    /* eslint-disable-next-line local/no-direct-set -- giả lập kho vừa nạp, như bridge.test.ts */
    useStore.setState({ spatial: normalizeSpatial(graph) });
    return scaleStatusOf('p1', read);
  };

  it('nhà nhỏ < 3 m mà người đã đặt tỷ lệ thì vẫn dựng, không cảnh báo', async () => {
    expect(await statusOf(shrunk(createSampleBuilding()), async () => ({}))).toEqual({ status: 'resolved' });
  });

  it('tỷ lệ máy đo ra tường mỏng < 50 mm thì tầng ấy bị giấu như tầng không đo được', async () => {
    const status = await statusOf(thinWalls(createSampleBuilding()), async (floorId) =>
      floorId === sampleLevelId(1) ? MEASURED : {},
    );
    expect(status).toMatchObject({ status: 'unresolved', floorId: sampleLevelId(1), missingIds: [sampleLevelId(1)], provisional: [] });
  });

  it('tỷ lệ máy đo, hình hợp lý: chỉ nhắc, không giấu', async () => {
    const status = await statusOf(createSampleBuilding(), async (floorId) => (floorId === sampleLevelId(1) ? MEASURED : {}));
    expect(status).toMatchObject({ status: 'unresolved', missingIds: [], provisional: ['Level 1'] });
  });
});

describe('ScaleBanner', () => {
  it('tầng unresolved → dải cảnh báo + lối hiệu chỉnh tỷ lệ của tầng đó', async () => {
    const readScale = vi.fn(async () => MEASURED);
    mount(createSampleBuilding(), readScale);
    const banner = await screen.findByRole('status');
    expect(banner.textContent).toContain(`4 tầng ${PROVISIONAL_TEXT}`);
    expect(banner.textContent).toContain('Level 0, Level 1, Level 2, Level 3');
    expect(screen.getByRole('link', { name: 'Đặt tỷ lệ' }).getAttribute('href')).toBe(
      `/projects/p1/floors/${sampleLevelId(0)}/scale`,
    );
    expect(readScale).toHaveBeenCalledWith(sampleLevelId(0));
  });

  it('nêu tên tầng không đo được tỷ lệ trước, lối sửa dẫn tới tầng đó (UX-R1 K44)', async () => {
    mount(createSampleBuilding(), async (floorId) => {
      if (floorId === sampleLevelId(2)) return { scaleStatus: 'unresolved', scaleSource: 'project_default' };
      return floorId === sampleLevelId(1) ? MEASURED : {};
    });
    const banner = await screen.findByRole('status');
    // textContent còn chữ của liên kết "Đặt tỷ lệ" phía sau câu.
    expect(banner.textContent).toContain(
      `1 tầng ${MISSING_TEXT}: Level 2. 1 tầng ${PROVISIONAL_TEXT}, kích thước 3D có thể sai: Level 1.`,
    );
    expect(screen.getByRole('link', { name: 'Đặt tỷ lệ' }).getAttribute('href')).toBe(
      `/projects/p1/floors/${sampleLevelId(2)}/scale`,
    );
  });

  it('đã hiệu chỉnh và kích thước hợp lý → không hiện', async () => {
    const readScale = vi.fn(async () => ({}));
    mount(createSampleBuilding(), readScale);
    await waitFor(() => expect(readScale).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('tỷ lệ máy đo ra nhà < 3 m → báo sai hẳn', async () => {
    mount(shrunk(createSampleBuilding()), async () => MEASURED);
    expect((await screen.findByRole('status')).textContent).toContain(MISSING_TEXT);
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
    expect(screen.getByRole('link', { name: 'Đặt tỷ lệ' }).getAttribute('href')).toBe(
      `/projects/p1/floors/${sampleLevelId(2)}/scale`,
    );
    warn.mockRestore();
  });

  it('một tầng đọc lỗi, nhà < 3 m → vẫn nhắc "có thể sai" nhưng không giấu tầng', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mount(shrunk(createSampleBuilding()), async (floorId) => {
      if (floorId === sampleLevelId(1)) throw new Error('500');
      return {};
    });
    const text = (await screen.findByRole('status')).textContent;
    expect(text).toContain(`1 tầng ${PROVISIONAL_TEXT}`);
    expect(text).not.toContain(MISSING_TEXT);
    warn.mockRestore();
  });

  it('Codex P1 — có tầng không đo được tỷ lệ: dải nói tầng ấy chưa dựng; dải và thẻ giữa màn đọc N16 một lượt', async () => {
    const readScale = vi.fn(async (floorId: string): Promise<ReadResult> =>
      floorId === sampleLevelId(2) ? { scaleStatus: 'unresolved', scaleSource: 'project_default' } : {},
    );
    mount(createSampleBuilding(), readScale);
    expect((await screen.findByRole('status')).textContent).toContain(SCALE_HIDDEN_NOTE);
    expect(screen.queryByRole('heading', { name: SCALE_ALL_MISSING_TITLE })).toBeNull();
    expect(readScale).toHaveBeenCalledTimes(4);
  });

  it('Codex P1 — mọi tầng không đo được tỷ lệ: thẻ giữa màn nói cảnh trống vì sao + lối Đặt tỷ lệ', async () => {
    mount(createSampleBuilding(), async () => ({ scaleStatus: 'unresolved', scaleSource: 'project_default' }));
    expect(await screen.findByRole('heading', { name: SCALE_ALL_MISSING_TITLE })).toBeTruthy();
    expect(screen.getByRole('status').textContent).not.toContain(SCALE_HIDDEN_NOTE);
    const links = screen.getAllByRole('link', { name: 'Đặt tỷ lệ' });
    expect(links).toHaveLength(2);
    expect(links.every((link) => link.getAttribute('href') === `/projects/p1/floors/${sampleLevelId(0)}/scale`)).toBe(true);
  });
});
