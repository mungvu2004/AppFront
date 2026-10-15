/** QA-06b F4 — SCR-32 bug app: Select hẹp, "Xem thêm", ô tích, nhãn, caption/copy trực quan, focus. */
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/lib/testing/render';

import { VersionHistory } from './VersionHistory';
import { VersionLabelDialog } from './VersionLabelDialog';
import { buildVersionHistoryProps, SAMPLE_ROWS } from './versionHistoryFixtures';
import { buildVersionRows, writeErrorNotice } from './versionHistoryModel';
import { buildVisualModel, unavailableReasonOf } from './versionHistoryScene';

afterEach(cleanup);

const purgedRow = { ...SAMPLE_ROWS[1]!, id: 'purged-1', label: 'v99', isMetadataOnly: true };

describe('F4', () => {
  it('32-C-056: Select hẹp không liệt kê bản hết nội dung; không có nút Phục hồi cho nó', () => {
    const rows = [...SAMPLE_ROWS, purgedRow];
    const props = buildVersionHistoryProps('success', {
      isNarrow: true,
      rows,
      compare: { ...buildVersionHistoryProps('success').model.compare, rightVersionId: 'purged-1' },
    });
    renderWithProviders(<VersionHistory {...props} />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Phiên bản' }));
    expect(screen.queryByText(/v99/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Phục hồi phiên bản này' })).toBeNull();
  });

  it('32-A-044: bố cục hẹp có "Xem thêm phiên bản"', () => {
    const loadMoreVersions = vi.fn();
    const props = buildVersionHistoryProps('success', { isNarrow: true, canLoadMoreVersions: true }, { loadMoreVersions });
    renderWithProviders(<VersionHistory {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Xem thêm phiên bản' }));
    expect(loadMoreVersions).toHaveBeenCalledTimes(1);
  });

  it('32-B-025: bản còn nội dung nhưng chưa nạp vẫn tích được; bản hết nội dung thì không', () => {
    const history = [0, 1].map((i) => ({
      kind: i === 0 ? ('full' as const) : ('metadata' as const),
      version: { id: `v${String(i)}`, sequence: i, createdAt: '2026-01-01T00:00:00Z', note: null, creatorId: 'u', creatorName: 'U' },
    }));
    const built = buildVersionRows({
      currentRevision: 1,
      history: history as never,
      leftVersionId: null,
      now: new Date('2026-01-02T00:00:00Z'),
      purgedIds: new Set(),
      rightVersionId: null,
      summaries: new Map(),
    } as never);
    expect(built[1]?.row.isPickable).toBe(true);
    const purged = buildVersionRows({
      currentRevision: 1, history: history as never, leftVersionId: null, now: new Date('2026-01-02T00:00:00Z'),
      purgedIds: new Set(['v1']), rightVersionId: null, summaries: new Map(),
    } as never);
    expect(purged[1]?.row.isPickable).toBe(false);
  });

  it('32-C-043: ký tự cấm không bị báo "dài tối đa 60"', () => {
    const err = { code: 'VALIDATION' };
    expect(writeErrorNotice('label', err, 'abc\u202E').message).toMatch(/ký tự không cho phép/);
    expect(writeErrorNotice('label', err, 'x'.repeat(61)).message).toBe('Nhãn dài tối đa 60 ký tự.');
  });

  it('32-B-019: copy không dựng được nêu đúng bản đã chọn', () => {
    const scene = { scene: null, failed: true };
    expect(unavailableReasonOf(true, {} as never, scene, 'v1')).toBe('Phiên bản v1 chưa dựng được thành cảnh, nên tab này để trống');
    expect(unavailableReasonOf(true, {} as never, scene)).toMatch(/^Mô hình hiện tại/);
    expect(typeof buildVisualModel).toBe('function');
  });

  it('32-E-010: hộp gắn nhãn đặt focus đầu vào ô "Nhãn"', async () => {
    renderWithProviders(<VersionLabelDialog isOpen versionLabel="v2" initialValue="" onSubmit={() => undefined} onClose={() => undefined} />);
    const input = await screen.findByRole('textbox', { name: 'Nhãn' });
    await vi.waitFor(() => expect(document.activeElement).toBe(input));
  });
});
