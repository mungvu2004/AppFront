/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';

import { NO_PROJECT_REASON, NOT_IN_DRAWING_REASON, savePascalNodeAsTemplate } from '../template';

const spatial = normalizeSpatial(createSampleBuilding());
const wall = Object.values(spatial.byId).find((entity) => entity.id.startsWith('W-'));
if (wall === undefined) throw new Error('Bộ mẫu thiếu tường.');

const apiWith = (result: unknown) => ({ propertyTemplates: { create: vi.fn().mockResolvedValue(result), list: vi.fn() } });

describe('savePascalNodeAsTemplate (#25)', () => {
  it('gửi đúng bộ trường của tường lên máy chủ và báo đã lưu', async () => {
    const api = apiWith({ ok: true, data: {} });
    const result = await savePascalNodeAsTemplate({ nodeId: `wall_${wall.id}`, spatial, projectId: 'p1', api: api as never });

    expect(result.ok).toBe(true);
    expect(result.message).toBe(`Đã lưu khuôn mẫu "Khuôn tường ${wall.id}" cho dự án này.`);
    expect(api.propertyTemplates.create).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'p1', body: expect.objectContaining({ objectKind: 'wall' }) }),
    );
  });

  it('máy chủ từ chối thì nói ra, không có dự án hay node lạ thì không gọi', async () => {
    const failing = apiWith({ ok: false, error: { kind: 'server' } });
    expect((await savePascalNodeAsTemplate({ nodeId: `wall_${wall.id}`, spatial, projectId: 'p1', api: failing as never })).message).toMatch(/server/);

    const api = apiWith({ ok: true, data: {} });
    expect((await savePascalNodeAsTemplate({ nodeId: `wall_${wall.id}`, spatial, projectId: null, api: api as never })).message).toBe(NO_PROJECT_REASON);
    expect((await savePascalNodeAsTemplate({ nodeId: 'item_moi', spatial, projectId: 'p1', api: api as never })).message).toBe(NOT_IN_DRAWING_REASON);
    expect(api.propertyTemplates.create).not.toHaveBeenCalled();
  });
});
