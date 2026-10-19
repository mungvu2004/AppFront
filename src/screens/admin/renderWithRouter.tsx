/**
 * Chỉ cho bộ kiểm của màn quản trị: `renderWithProviders` bọc thêm `MemoryRouter`, vì đường dẫn
 * trang và liên kết liên quan nay là `<Link>` của router (RV5#17: `<a href>` tải lại cả trang).
 */

import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';

import {
  renderWithProviders as renderWithStore,
  type ProvidedRenderResult,
  type RenderWithProvidersOptions,
} from '@/lib/testing/render';

export function renderWithProviders(ui: ReactElement, options?: RenderWithProvidersOptions): ProvidedRenderResult {
  const result = renderWithStore(<MemoryRouter>{ui}</MemoryRouter>, options);

  return { ...result, rerender: (next) => result.rerender(<MemoryRouter>{next}</MemoryRouter>) };
}
