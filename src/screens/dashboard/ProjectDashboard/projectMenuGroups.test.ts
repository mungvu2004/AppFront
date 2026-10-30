import { describe, expect, it, vi } from 'vitest';

import { projectMenuGroups } from './projectMenuGroups';
import type { ProjectCardModel } from './useProjectDashboard';

describe('projectMenuGroups', () => {
  it('có mục "Chia sẻ" dẫn tới màn Xuất, nơi tạo liên kết (U49)', () => {
    const openProjectPage = vi.fn();
    const actions = {
      openProject: vi.fn(),
      openProjectViewer: vi.fn(),
      openProjectPage,
      startRename: vi.fn(),
      requestDelete: vi.fn(),
      duplicateProject: vi.fn(),
    };
    const groups = projectMenuGroups({ id: 'p1' } as ProjectCardModel, actions, true, false, false);
    const share = groups[0]?.items.find((item) => item.id === 'share');
    expect(share?.label).toBe('Chia sẻ');
    share?.action();
    expect(openProjectPage).toHaveBeenCalledWith('p1', 'export');
  });
});
