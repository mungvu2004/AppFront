/** UX-R3 — hồi quy cho U01 (PDF là hộp thoại in), U05 (chỉ thiếu tỷ lệ), U36 (tầng chưa có bản vẽ). */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import type { Level } from '@/domain/spatial/types';
import { ROUTES } from '@/routes/paths';

import { ExportPanel } from './ExportPanel';
import { buildExportPanelProps, buildSampleExportedFile, DEFAULT_FLOORS } from './exportPanelFixtures';
import { buildPreflightRows, floorStateOf } from './exportPanelGateway';
import { unreviewedConfirmMessage } from './useExportPanel';

afterEach(cleanup);

const PROJECT_ID = 'P-1';
const unapproved = { id: 'L-1', name: 'Tầng trệt', reviewed: false } as unknown as Level;
const emptyFloor = { id: 'L-2', name: 'Tầng 1', reviewed: false } as unknown as Level;
/** Một tường đã duyệt trên L-1, L-2 không có gì. */
const graph = {
  byId: { 'W-1': { id: 'W-1', reviewed: true } },
  byLevel: { 'L-1': ['W-1'] },
} as unknown as NormalizedSpatial;

describe('U05 — tầng chỉ còn thiếu tỷ lệ', () => {
  it('floorStateOf phân biệt chưa có bản vẽ / chỉ thiếu tỷ lệ / chưa duyệt', () => {
    expect(floorStateOf(graph, emptyFloor)).toBe('empty');
    expect(floorStateOf(graph, unapproved)).toBe('scaleOnly');
    expect(floorStateOf(graph, { ...unapproved, scaleMillimetresPerPixel: 12 } as unknown as Level)).toBe('stepOnly');
    expect(floorStateOf(null, unapproved)).toBe('pending');
  });

  it('dòng duyệt nói rõ chỉ thiếu tỷ lệ và dẫn tới Đặt tỷ lệ', () => {
    const row = buildPreflightRows({ projectId: PROJECT_ID, graph, levels: [unapproved], violations: [] }).find(
      (entry) => entry.id === 'approval',
    );

    expect(row?.label).toBe('Đã duyệt hết đối tượng, chỉ còn thiếu xác nhận tỷ lệ: Tầng trệt.');
    expect(row?.fixHref).toBe(ROUTES.project.scale(PROJECT_ID, 'L-1'));
  });
});

describe('U36 — Phạm vi và chip trạng thái', () => {
  it('tầng chưa có bản vẽ ghi "Chưa có bản vẽ" và không tích được', () => {
    const [first, ...rest] = DEFAULT_FLOORS;
    const floors = first === undefined ? rest : [{ ...first, state: 'empty' as const }, ...rest];
    render(<ExportPanel {...buildExportPanelProps('success', { floors })} />);

    expect(screen.getByText('Chưa có bản vẽ')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: first?.name ?? '' })).toBeDisabled();
  });

  it('còn tầng chưa duyệt: chip nói việc cần làm trước, không mở đầu bằng "Xuất được"', () => {
    const preflight = buildPreflightRows({ projectId: PROJECT_ID, graph: null, levels: [unapproved], violations: [] });
    render(<ExportPanel {...buildExportPanelProps('success', { preflight })} />);

    expect(screen.getByText(/^Chưa duyệt xong · nên làm/u)).toBeTruthy();
    expect(screen.queryByText(/^Xuất được/u)).toBeNull();
  });
});

describe('U01 — PDF mở hộp thoại in, không tải tệp', () => {
  it('hàng PDF nói hộp thoại in đã mở, nút là "Mở lại hộp thoại in"', () => {
    const file = buildSampleExportedFile({ id: 'P1', fileName: 'ho-so.pdf', formatId: 'pdf' });
    render(<ExportPanel {...buildExportPanelProps('success', { exportedFiles: [file] })} />);

    expect(screen.getByText('Đã mở hộp thoại in. Chọn “Lưu thành PDF” để lưu tệp.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mở lại hộp thoại in ho-so.pdf' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Tải về lại/u })).toBeNull();
  });
});

describe('U36 (R4) — bấm Xuất khi còn tầng chưa duyệt thì hỏi lại', () => {
  it('câu hỏi nêu tên tầng', () => {
    expect(unreviewedConfirmMessage(['Tầng 1', 'Tầng 2'])).toBe('Tầng 1, Tầng 2 chưa duyệt xong. Vẫn xuất?');
  });

  it('hiện hai lựa chọn Xuất vẫn / Duyệt trước, bấm gọi đúng hành động', () => {
    const onConfirmExport = vi.fn();
    const onReviewFirst = vi.fn();
    render(
      <ExportPanel
        {...buildExportPanelProps('success', {
          unreviewedConfirm: 'Tầng 1 chưa duyệt xong. Vẫn xuất?',
          onConfirmExport,
          onReviewFirst,
        })}
      />,
    );

    expect(screen.getByRole('alertdialog').textContent).toContain('Tầng 1 chưa duyệt xong. Vẫn xuất?');
    fireEvent.click(screen.getByRole('button', { name: 'Xuất vẫn' }));
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt trước' }));
    expect(onConfirmExport).toHaveBeenCalledTimes(1);
    expect(onReviewFirst).toHaveBeenCalledTimes(1);
  });
});

describe('U51 (R4) — hàng tệp khôi phục sau khi tải lại trang', () => {
  it('không có nút "Tải về lại", nói rõ phải xuất lại', () => {
    const file = { ...buildSampleExportedFile({ fileName: 'cu.glb' }), isRestored: true };
    render(<ExportPanel {...buildExportPanelProps('success', { exportedFiles: [file] })} />);

    expect(screen.getByText('Tệp cũ, xuất lại để tải về')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Tải về lại/u })).toBeNull();
    expect(screen.queryByText('Chỉ trong phiên này, mất khi làm mới trang.')).toBeNull();
  });
});
