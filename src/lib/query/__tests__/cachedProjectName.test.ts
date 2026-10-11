/** @vitest-environment node */
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { cachedProjectName } from '../cachedProjectName';
import { queryKeys } from '../queryKeys';

describe('cachedProjectName (BUG-165)', () => {
  it('reads the detail first, then the dashboard card, else null', () => {
    const queryClient = new QueryClient();
    expect(cachedProjectName(queryClient, 'prj-1')).toBeNull();

    queryClient.setQueryData(queryKeys.project.summaries(), {
      projects: [{ id: 'prj-2', name: 'Khác' }, { id: 'prj-1', name: 'Nhà A' }],
      droppedCount: 0,
    });
    expect(cachedProjectName(queryClient, 'prj-1')).toBe('Nhà A');

    queryClient.setQueryData(queryKeys.project.detail('prj-1'), { id: 'prj-1', name: 'Nhà A (mới)' });
    expect(cachedProjectName(queryClient, 'prj-1')).toBe('Nhà A (mới)');
    expect(cachedProjectName(queryClient, 'prj-3')).toBeNull();
  });
});
