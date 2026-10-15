import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { ROUTE_PATTERNS } from './paths';
import { ExplodedViewRedirect } from './viewerRedirects';

/** In địa chỉ đích ra DOM để khẳng định cả query lẫn hash. */
function Landing() {
  const { pathname, search, hash } = useLocation();

  return <p data-testid="landing">{`${pathname}${search}${hash}`}</p>;
}

describe('ExplodedViewRedirect', () => {
  it('24-A-003: giữ query và hash, thêm view=exploded', () => {
    render(
      <MemoryRouter initialEntries={['/projects/p1/3d/exploded?tool=measure#x']}>
        <Routes>
          <Route path={ROUTE_PATTERNS.projectExploded} element={<ExplodedViewRedirect />} />
          <Route path={ROUTE_PATTERNS.projectViewer} element={<Landing />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('landing').textContent).toBe(
      '/projects/p1/3d?tool=measure&view=exploded#x',
    );
  });
});
