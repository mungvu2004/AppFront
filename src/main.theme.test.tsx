/**
 * BUG-P07-006 / catalog-C2 33R-A-024 — chủ đề đã lưu phải áp ở GỐC ứng dụng.
 *
 * Dựng đúng `src/main.tsx` (không mount màn `/tai-khoan`), với router thay bằng một route rỗng:
 * `<html class="dark">` phải có chỉ vì `app-theme-mode=dark`, trên bất kỳ route nào.
 */

import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./routes', async () => {
  const { createMemoryRouter } = await import('react-router-dom');

  return { router: createMemoryRouter([{ path: '/', element: null }]) };
});
vi.mock('./components/shell/ServerFeatureFlagSync', () => ({ ServerFeatureFlagSync: () => null }));

afterEach(() => {
  document.documentElement.classList.remove('dark');
  window.localStorage.clear();
});

describe('[33R-A-024] chủ đề đã lưu áp ở gốc app khi tải đầy đủ một route', () => {
  it('app-theme-mode=dark thì <html> mang lớp dark mà không cần mở /tai-khoan', async () => {
    window.localStorage.setItem('app-theme-mode', 'dark');
    document.body.innerHTML = '<div id="root"></div>';

    await import('./main');

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
    expect(window.localStorage.getItem('app-theme-mode')).toBe('dark');
  });
});
