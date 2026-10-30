import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WallId } from '@/domain/spatial/types';

import type { WallLayerViewProps, WallRowViewModel } from './types';
import { WallLayerList } from './WallLayerList';
import type { WallReviewQueue } from './wallReviewQueue';

const row = {
  id: 'W-014' as WallId,
  codeLabel: '#W-014',
  thicknessMm: 16,
  thicknessLabel: '16',
  confidence: 0.5,
  statusCode: 'attention',
  isReviewed: false,
  isLowConfidence: true,
  isNonStandardThickness: true,
} as unknown as WallRowViewModel;

const panelOf = (scaleLock: WallLayerViewProps['scaleLock']) =>
  ({
    rows: [row],
    selectedWallId: null,
    hoveredWallId: null,
    onSelect: vi.fn(),
    onHover: vi.fn(),
    state: 'partial',
    emptyNotice: null,
    errorMessage: null,
    isViewerRole: false,
    reviewCounter: { reviewed: 0, total: 1 },
    scaleLock,
  }) as unknown as WallLayerViewProps;

/* jsdom đo mọi khung 0 px nên ảo hoá không dựng hàng nào: thay bằng bản dựng đủ mọi mục. */
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { readonly count: number }) => ({
    getTotalSize: () => count * 36,
    getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ index, start: index * 36, key: index })),
    scrollToIndex: () => undefined,
  }),
}));

const queue = {
  extras: new Map(),
  bulk: { changeCount: 3, totalCount: 3 },
  lockText: null,
  showConfidence: true,
} as unknown as WallReviewQueue;

afterEach(cleanup);

describe('UX-R2: danh sách tường', () => {
  it('tầng khoá vì thiếu tỷ lệ: không chia theo độ dày, không cột Dày, không nút "Đặt tỷ lệ" thứ ba (K23)', async () => {
    render(
      <WallLayerList
        flashingWallId={null}
        onToggleSelect={vi.fn()}
        panel={panelOf({ reason: 'Đặt tỷ lệ trước', onOpenScale: vi.fn() })}
        queue={queue}
      />,
    );

    expect(await screen.findByText('Chưa duyệt: 1')).toBeInTheDocument();
    expect(screen.queryByText(/Độ dày không chuẩn/u)).toBeNull();
    expect(screen.queryByText('16')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Đặt tỷ lệ' })).toBeNull();
  });

  it('có tỷ lệ: nút "Đưa N tường về chuẩn" mở màn Độ dày', async () => {
    const onOpenBulk = vi.fn();

    render(
      <WallLayerList flashingWallId={null} onOpenBulk={onOpenBulk} onToggleSelect={vi.fn()} panel={panelOf(null)} queue={queue} />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Đưa 3 tường về chuẩn' }));
    expect(onOpenBulk).toHaveBeenCalledTimes(1);
    expect(screen.getByText('16')).toBeInTheDocument();
  });
});

describe('U17 + U37: duyệt hết, một điểm Tab', () => {
  const sureRow = (id: string) =>
    ({ ...row, id: id as WallId, codeLabel: `#${id}`, thicknessMm: 220, isLowConfidence: false, isNonStandardThickness: false, statusCode: 'suggested' }) as unknown as WallRowViewModel;
  const rows = [sureRow('W-001'), sureRow('W-002'), sureRow('W-003')];
  const panel = { ...panelOf(null), rows, selectedWallId: 'W-002' } as unknown as WallLayerViewProps;

  it('nút "Duyệt N đoạn máy chắc chắn" gọi duyệt hàng loạt', async () => {
    const onApproveConfident = vi.fn();

    render(
      <WallLayerList
        flashingWallId={null}
        onToggleSelect={vi.fn()}
        panel={panel}
        queue={{ ...queue, confidentCount: 3, onApproveConfident } as unknown as WallReviewQueue}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Duyệt 3 đoạn máy chắc chắn' }));
    expect(onApproveConfident).toHaveBeenCalledTimes(1);
  });

  it('chỉ hàng đang chọn nhận Tab, các hàng khác tabIndex -1', async () => {
    render(<WallLayerList flashingWallId={null} onToggleSelect={vi.fn()} panel={panel} queue={queue} />);

    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
  });
});
