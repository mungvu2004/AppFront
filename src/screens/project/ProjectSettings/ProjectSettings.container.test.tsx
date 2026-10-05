import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ROUTE_PATTERNS } from '@/routes/paths';

import { ProjectSettingsRoute } from './ProjectSettings.container';

const mounts: string[] = [];

vi.mock('./projectSettingsGateway', () => ({ createAppProjectSettingsGateway: () => ({}) }));
vi.mock('./ProjectSettings', () => ({ ProjectSettingsView: () => null }));
vi.mock('./useProjectSettings', async () => {
  const { useEffect } = await import('react');
  return {
    useProjectSettings: ({ projectId }: { projectId: string }) => {
      useEffect(() => {
        mounts.push(projectId);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only on purpose: this counts mounts
      }, []);
      return {};
    },
  };
});

afterEach(() => {
  cleanup();
  mounts.length = 0;
});

describe('ProjectSettingsRoute', () => {
  it('remounts the settings hook when the project id in the URL changes', () => {
    render(
      <MemoryRouter initialEntries={['/projects/a/settings']}>
        <Link to="/projects/b/settings">go b</Link>
        <Routes>
          <Route path={ROUTE_PATTERNS.projectSettings} element={<ProjectSettingsRoute />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(mounts).toEqual(['a']);

    fireEvent.click(screen.getByText('go b'));

    expect(mounts).toEqual(['a', 'b']);
  });
});
