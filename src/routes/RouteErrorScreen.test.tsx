import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { expectVietnamese } from '@/lib/testing/expectVietnamese';

import { CHUNK_LOAD_DESCRIPTION, CHUNK_LOAD_TITLE, RELOAD_PAGE_LABEL, RouteErrorScreen } from './RouteErrorScreen';

/** Dựng một route ném `error` khi vẽ, có `RouteErrorScreen` làm `errorElement` như route gốc thật. */
function renderThrowing(error: unknown) {
  const Boom = (): never => {
    throw error;
  };
  const router = createMemoryRouter([{ path: '/', element: <Boom />, errorElement: <RouteErrorScreen /> }]);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  return render(<RouterProvider router={router} />);
}

describe('RouteErrorScreen (BUG-106)', () => {
  it('chunk tải muộn hỏng → màn tiếng Việt và nút tải lại, không phải "Unexpected Application Error!"', () => {
    const view = renderThrowing(
      new TypeError('Failed to fetch dynamically imported module: http://localhost:18080/assets/index-BqQP3dac.js'),
    );

    expect(screen.getByRole('heading', { level: 1, name: CHUNK_LOAD_TITLE })).toBeInTheDocument();
    expect(screen.getByText(CHUNK_LOAD_DESCRIPTION)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: RELOAD_PAGE_LABEL })).toBeInTheDocument();
    expect(screen.queryByText(/Unexpected Application Error/u)).toBeNull();
    expectVietnamese(view.container);
  });

  it('lỗi khác → tiêu đề và mô tả của describeError, vẫn có nút tải lại', () => {
    renderThrowing(new Error('boom'));

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).not.toBe(CHUNK_LOAD_TITLE);
    expect(heading.textContent?.length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: RELOAD_PAGE_LABEL })).toBeInTheDocument();
  });
});
