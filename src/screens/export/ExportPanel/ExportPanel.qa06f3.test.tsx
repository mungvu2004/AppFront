/** QA-06b F3 — hồi quy cho 30-C-015/028, 30-E-003/012/013/014, 30-B-006, 30-G-008. */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExportPanel } from './ExportPanel';
import { buildExportPanelProps, buildSampleExportedFile, buildSampleProgress, formatsSelecting } from './exportPanelFixtures';

afterEach(cleanup);

describe('QA-06b F3 — màn Xuất', () => {
  it('30-E-003: chỉ thẻ đang chọn nằm trong Tab; mũi tên chuyển và chọn thẻ kế', () => {
    const onSelectFormat = vi.fn();
    render(<ExportPanel {...buildExportPanelProps('success', {}, { onSelectFormat })} />);
    const radios = screen.getAllByRole('radio');

    expect(radios.map((radio) => radio.tabIndex)).toEqual([0, -1, -1, -1]);
    radios[0]?.focus();
    fireEvent.keyDown(radios[0] as HTMLElement, { key: 'ArrowDown' });
    // PDF và ảnh "Chưa hỗ trợ" (aria-disabled) — mũi tên bỏ qua, sang thẻ .json.
    expect(onSelectFormat).toHaveBeenCalledWith('spatial-json');
    expect(document.activeElement).toBe(radios[3]);
  });

  it('30-C-015: .json không có ô chọn tầng (nó xuất cả đồ thị), chỉ có câu giải thích', () => {
    render(<ExportPanel {...buildExportPanelProps('success', { formats: formatsSelecting('spatial-json') })} />);
    expect(screen.getByText(/gồm toàn bộ dự án, không chọn theo tầng/u)).toBeTruthy();
  });

  it('30-E-014: mỗi nút Tải về lại mang tên tệp', () => {
    const files = [buildSampleExportedFile(), buildSampleExportedFile({ id: 'E2', fileName: 'b.json' })];
    render(<ExportPanel {...buildExportPanelProps('success', { exportedFiles: files })} />);
    expect(screen.getByRole('button', { name: `Tải về lại ${files[0]?.fileName}` })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tải về lại b.json' })).toBeTruthy();
  });

  it('30-C-028: "Xuất" bị khoá khi đang tải', () => {
    render(<ExportPanel {...buildExportPanelProps('loading', { floors: buildExportPanelProps('success').floors })} />);
    expect((screen.getByRole('button', { name: 'Xuất' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('30-E-012: có thêm tệp mới thì vùng aria-live đọc "Đã xuất <tên>"', () => {
    const props = buildExportPanelProps('success', { exportedFiles: [] });
    const { rerender } = render(<ExportPanel {...props} />);
    rerender(<ExportPanel {...props} exportedFiles={[buildSampleExportedFile({ fileName: 'x.glb' })]} />);
    expect(screen.getByRole('status').textContent).toBe('Đã xuất x.glb');
  });

  it('30-E-013: footer đổi sang tiến độ thì focus ở trong màn, không rơi về body', () => {
    const props = buildExportPanelProps('success');
    const { rerender } = render(<ExportPanel {...props} />);
    const button = screen.getByRole('button', { name: 'Xuất' });
    button.focus();
    act(() => {
      rerender(<ExportPanel {...props} progress={buildSampleProgress()} />);
    });
    expect(document.activeElement).not.toBe(document.body);
    expect(screen.getByRole('button', { name: 'Huỷ' })).toBe(document.activeElement);
  });

  it('30-B-006: trạng thái rỗng nói việc cần làm, không có liên kết', () => {
    render(<ExportPanel {...buildExportPanelProps('empty')} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText(/Dự án chưa có bản vẽ nào được xử lý xong/)).toBeTruthy();
  });
});
