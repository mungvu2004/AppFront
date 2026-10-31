/** UX-R5 — UX-52 (số việc chỉ đếm dòng còn việc), UX-22 (nói rõ việc còn dở ngay trên nút Xuất). */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import type { Level } from '@/domain/spatial/types';

import { ExportPanel } from './ExportPanel';
import { buildExportPanelProps, formatsSelecting } from './exportPanelFixtures';
import { exportPendingNote } from './exportPanelGateway';
import type { PreflightRow } from './types';

afterEach(cleanup);

const PROJECT_ID = 'P-1';
const scaled = { id: 'L-1', name: 'Tầng 1', reviewed: false, scaleMillimetresPerPixel: 12 } as unknown as Level;
/** Hai tường trên L-1, một chưa duyệt. */
const graph = {
  byId: { 'W-1': { id: 'W-1', reviewed: true }, 'W-2': { id: 'W-2', reviewed: false } },
  byLevel: { 'L-1': ['W-1', 'W-2'] },
} as unknown as NormalizedSpatial;

describe('UX-52 — số việc trước khi xuất', () => {
  it('chỉ đếm dòng còn việc, không đếm dòng đã ổn', () => {
    const preflight: readonly PreflightRow[] = [
      { id: 'approval', label: 'Còn 1 tầng chưa duyệt: Tầng 1.', tone: 'attention', fixHref: '/x' },
      { id: 'violations', label: 'Không còn vi phạm nào.', tone: 'ok', fixHref: null },
      { id: 'unreviewed', label: 'Còn 3 mục chưa duyệt (3 tường).', tone: 'attention', fixHref: '/y' },
    ];
    render(<ExportPanel {...buildExportPanelProps('success', { formats: formatsSelecting('glb'), preflight })} />);

    expect(screen.getByText('Chưa duyệt xong · nên làm 2 việc dưới đây trước khi xuất')).toBeTruthy();
  });
});

describe('UX-22 — câu nhắc trên nút Xuất', () => {
  it('nói số mục chưa duyệt và tỷ lệ tạm', () => {
    expect(
      exportPendingNote({
        projectId: PROJECT_ID,
        graph,
        levels: [scaled],
        violations: [],
        floorMeta: { 'L-1': { scaleStatus: 'unresolved' } },
      }),
    ).toBe('Còn 1 mục chưa duyệt. Tỷ lệ chưa xác nhận - diện tích là số tạm.');
  });

  it('không còn gì thì không nhắc', () => {
    const done = { ...graph, byId: { 'W-1': { id: 'W-1', reviewed: true } }, byLevel: { 'L-1': ['W-1'] } } as unknown as NormalizedSpatial;

    expect(exportPendingNote({ projectId: PROJECT_ID, graph: done, levels: [scaled], violations: [] })).toBeNull();
  });

  it('câu nhắc hiện cạnh nút Xuất, nút vẫn bấm được', () => {
    const props = buildExportPanelProps('success', { formats: formatsSelecting('glb'), pendingNote: 'Còn 28 mục chưa duyệt.' });
    render(<ExportPanel {...props} />);

    expect(screen.getByText('Còn 28 mục chưa duyệt.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Xuất \.glb$/u })).not.toBeDisabled();
  });
});
