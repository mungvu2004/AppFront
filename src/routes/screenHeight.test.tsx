/**
 * QA-06b K1: các màn trong nhóm `ScreenMain` (`<main className="contents">`) không có vỏ nào cấp
 * chiều cao — `h-full` ở gốc màn ra auto, chân dính nằm giữa trang và cột danh sách phiên bản
 * giãn hết chiều cao thay vì cuộn trong cột. Màn có chân dính / cột cuộn riêng tự dựng khung
 * `h-dvh` (khuôn BUG-373/BUG-520). jsdom không tính bố cục: đây chỉ kiểm cấu trúc lớp, ảnh thật ở run-062.
 */
import { cleanup, render, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/lib/testing/render';
import { ROUTES, ROUTE_PATTERNS } from '@/routes/paths';
import { ExportPanelRoute } from '@/screens/export/ExportPanel/ExportPanel.container';
import { VersionHistoryRoute } from '@/screens/export/VersionHistory/VersionHistory.container';
import { VersionList } from '@/screens/export/VersionHistory/VersionList';
import { RuleSettingsRoute } from '@/screens/rules/RuleSettings/RuleSettings.container';

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK_API', 'true');
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

const CASES: ReadonlyArray<readonly [string, string, string, ReactElement]> = [
  ['ExportPanelRoute', ROUTE_PATTERNS.projectExport, ROUTES.project.export('project-1'), <ExportPanelRoute />],
  ['RuleSettingsRoute', ROUTE_PATTERNS.projectRuleSettings, ROUTES.project.ruleSettings('project-1'), <RuleSettingsRoute />],
  ['VersionHistoryRoute', ROUTE_PATTERNS.projectVersions, ROUTES.project.versions('project-1'), <VersionHistoryRoute />],
];

describe('khung chiều cao của màn có chân dính / cột cuộn riêng', () => {
  it.each(CASES)('%s dựng khung h-dvh ngoài cùng', (_name, pattern, url, element) => {
    const { container } = renderWithProviders(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path={pattern} element={element} />
        </Routes>
      </MemoryRouter>,
    );

    expect(container.firstElementChild).toHaveClass('h-dvh');
  });

  it('danh sách phiên bản lấp phần còn lại của cột (chừa chỗ "Xem thêm") và cuộn trong cột', () => {
    render(<VersionList groups={[]} onRetrySnapshot={vi.fn()} />);

    const nav = document.querySelector('nav[aria-label="Danh sách phiên bản"]');
    expect(nav).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto');
    expect(nav).not.toHaveClass('h-full');
  });
});

describe('QA-06b F10 #2 — chân dính của VersionHistory mang data-sticky-footer (Toast nâng lên)', () => {
  it('thanh phục hồi có thuộc tính', async () => {
    const { container } = renderWithProviders(
      <MemoryRouter initialEntries={[ROUTES.project.versions('project-1')]}>
        <Routes>
          <Route path={ROUTE_PATTERNS.projectVersions} element={<VersionHistoryRoute />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(container.querySelector('[data-sticky-footer]')).not.toBeNull();
    });
  });
});
