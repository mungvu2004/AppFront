/** QA-06b F11 — hồi quy 30-F-006: Badge "Chưa duyệt" không vỡ 2 dòng khi tên tầng dài. */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Badge } from '@/components/ui/Badge';

import { DEFAULT_OPTIONS, FIXED_EXPORT_CAPABILITIES } from './exportPanelFixtures';
import { ExportPanelOptions } from './ExportPanelOptions';

const LONG_NAME = 'Tầng hầm kỹ thuật và khu vực đỗ xe mở rộng phía Đông khối B';

describe('QA-06b F11 — 30-F-006', () => {
  it('Badge luôn một dòng và không co', () => {
    const { container } = render(<Badge variant="attention">Chưa duyệt</Badge>);
    expect(container.firstChild).toHaveClass('whitespace-nowrap', 'shrink-0');
  });

  it('nhãn tên tầng dài có min-w-0 để xuống dòng trong phần còn lại', () => {
    render(
      <ExportPanelOptions
        floors={[{ id: 'f1', name: LONG_NAME, order: 1, isSelected: false, isApproved: false }]}
        options={DEFAULT_OPTIONS}
        capabilities={FIXED_EXPORT_CAPABILITIES}
        selectedFormatId="glb"
        onToggleFloor={vi.fn()}
        onChangeOptions={vi.fn()}
        onToggleOptionsExpanded={vi.fn()}
      />,
    );
    const label = screen.getByText(LONG_NAME);
    expect(label).toHaveClass('min-w-0');
    expect(label.closest('label')).toHaveClass('min-w-0');
  });
});
