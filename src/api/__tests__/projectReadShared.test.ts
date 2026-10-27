import { describe, expect, it, vi } from 'vitest';

import { readProjectDetail, readProjectShared } from '@/api/floorLayerGraph';

describe('readProjectShared (PERF-03 P11a)', () => {
  it('header và màn Tầng đọc cùng lúc chỉ ra dây một lần; lượt sau vẫn đọc mới', async () => {
    const read = vi.fn(async () => ({ ok: true as const, data: { name: 'Căn A' } }));
    const projects = { read } as unknown as Parameters<typeof readProjectShared>[0];

    const [detail, named] = await Promise.all([
      readProjectDetail(projects, { projectId: 'p-dup' }),
      readProjectShared(projects, 'p-dup'),
    ]);

    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith({ projectId: 'p-dup' });
    expect(detail).toEqual({ name: 'Căn A' });
    expect(named).toEqual({ ok: true, data: { name: 'Căn A' } });

    await readProjectShared(projects, 'p-dup');
    expect(read).toHaveBeenCalledTimes(2);
  });
});
