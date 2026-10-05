/**
 * B-V3-07 — trên route thật, hộp thoại chia sẻ phải có chỗ phát toast.
 *
 * Tệp riêng vì nó thay `ShareDialogContainer` bằng một bản ghi prop (`vi.mock`);
 * `ExportPanel.container.test.tsx` cần hộp thoại thật.
 *
 * Hộp thoại chỉ được gắn khi `SHARE_LINKS_SUPPORTED` (v2, F-06); bài này lật hằng
 * thành `true` để giữ ý của nó cho ngày v2 bật lại.
 */
import { cleanup, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ShareLinkModule from '@/lib/export/shareLink';
import { renderWithProviders } from '@/lib/testing/render';
import { ROUTES, ROUTE_PATTERNS } from '@/routes/paths';

import { ExportPanelRoute } from './ExportPanel.container';

const seenOnToast: unknown[] = [];

vi.mock('@/lib/export/shareLink', async (importOriginal) => ({
  ...(await importOriginal<typeof ShareLinkModule>()),
  SHARE_LINKS_SUPPORTED: true,
}));

vi.mock('@/screens/export/ShareDialog', () => ({
  ShareDialogContainer: (props: { readonly onToast?: unknown }) => {
    seenOnToast.push(props.onToast);
    return <p>hộp thoại chia sẻ giả</p>;
  },
}));

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK_API', 'true');
  seenOnToast.length = 0;
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('ExportPanelRoute', () => {
  it('trao cho hộp thoại chia sẻ một onToast thật (không câm A8 của "đổi quyền")', async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={[ROUTES.project.export('project-1')]}>
        <Routes>
          <Route path={ROUTE_PATTERNS.projectExport} element={<ExportPanelRoute />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText('hộp thoại chia sẻ giả');
    expect(seenOnToast.at(-1)).toEqual(expect.any(Function));
  });
});
