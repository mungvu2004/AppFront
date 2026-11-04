// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ObjectLayerLeftPanel } from './ObjectLayerLeftPanel';
import { ObjectLayerList } from './ObjectLayerList';
import type { ObjectListRowViewModel } from './objectLayerTypes';

const row = (id: string, codeLabel: string, patch: Partial<ObjectListRowViewModel> = {}): ObjectListRowViewModel =>
  ({
    id,
    layer: 'door',
    subtype: 'singleDoor',
    typeLabel: 'Cửa đơn',
    codeLabel,
    sizeLabel: '900 × 2.200 mm',
    hostWallLabel: '#W-001',
    confidence: 0.9,
    statusCode: 'neutral',
    isReviewed: false,
    isLowConfidence: false,
    isOrphan: false,
    ...patch,
  }) as unknown as ObjectListRowViewModel;

afterEach(cleanup);

describe('ObjectLayerList ô "Tìm mã" (BUG-592)', () => {
  it('lọc dòng theo mã, không phân biệt hoa thường và bỏ dấu #', () => {
    const noop = () => undefined;
    const list = (codeQuery: string) => (
      <ObjectLayerList
        codeQuery={codeQuery}
        collapsedGroups={{ door: false, window: false, furniture: false }}
        onAttachToNearestWall={noop}
        onHover={noop}
        onSelect={noop}
        onToggleGroupCollapsed={noop}
        rows={[row('a', '#D-001'), row('b', '#D-007')]}
        selectedObjectId={null}
      />
    );

    const { rerender } = render(list(''));

    expect(screen.getAllByRole('option')).toHaveLength(2);
    rerender(list('#d-007'));
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: /D-007/ })).toBeTruthy();
  });

  it('thanh đầu cột: kính lúp mở ô tìm, gõ báo lên, Esc xoá và đóng', () => {
    const onCodeQueryChange = vi.fn();
    const props = {
      availableSubtypes: new Set(),
      counts: {},
      subtypeFilters: new Set(),
      furnitureAttentionNotice: null,
      isLowConfidenceOnly: false,
      listLayerFilter: null,
      onFilterLayer: () => undefined,
      onToggleLowConfidenceOnly: null,
    } as unknown as ComponentProps<typeof ObjectLayerLeftPanel>;
    const panel = (codeQuery: string) => <ObjectLayerLeftPanel {...props} codeQuery={codeQuery} onCodeQueryChange={onCodeQueryChange} />;

    const { rerender } = render(panel(''));

    expect(screen.queryByRole('searchbox', { name: 'Tìm mã' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tìm mã' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm mã' }), { target: { value: 'd-007' } });
    expect(onCodeQueryChange).toHaveBeenLastCalledWith('d-007');

    rerender(panel('d-007'));
    fireEvent.keyDown(screen.getByRole('searchbox', { name: 'Tìm mã' }), { key: 'Escape' });
    expect(onCodeQueryChange).toHaveBeenLastCalledWith('');
    rerender(panel(''));
    expect(screen.queryByRole('searchbox', { name: 'Tìm mã' })).toBeNull();
  });
});

describe('ObjectLayerList dòng đối tượng (K07)', () => {
  it('dòng chưa gắn tường: nút "Gắn tường" gọi hành động mà không chọn dòng; Enter trên nút cũng không chọn dòng', () => {
    const onAttach = vi.fn();
    const onSelect = vi.fn();

    render(
      <ObjectLayerList
        collapsedGroups={{ door: false, window: false, furniture: false }}
        onAttachToNearestWall={onAttach}
        onHover={() => undefined}
        onSelect={onSelect}
        onToggleGroupCollapsed={() => undefined}
        rows={[row('d', '#D-009', { hostWallLabel: null, isOrphan: true, statusCode: 'attention' })]}
        selectedObjectId={null}
      />,
    );

    const attach = screen.getByRole('button', { name: 'Gắn vào tường gần nhất' });

    fireEvent.click(attach);
    fireEvent.keyDown(attach, { key: 'Enter' });
    expect(onAttach).toHaveBeenCalledWith('d');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('một hàng: tên loại đồ và mã; kích thước và "Không gắn tường" ở gợi ý; lý do bằng chữ, không in số tin cậy', () => {
    const noop = () => undefined;

    render(
      <ObjectLayerList
        collapsedGroups={{ door: false, window: false, furniture: false }}
        onAttachToNearestWall={noop}
        onHover={noop}
        onSelect={noop}
        onToggleGroupCollapsed={noop}
        rows={[
          row('f', '#F-008', {
            layer: 'furniture',
            subtype: 'otherFurniture',
            typeLabel: 'Tủ bếp',
            hostWallLabel: null,
            confidence: 0.26 as never,
            statusCode: 'attention',
            isLowConfidence: true,
          }),
        ]}
        selectedObjectId={null}
      />,
    );

    const option = screen.getByRole('option', { name: '#F-008 Tủ bếp — Máy chưa chắc' });

    expect(option.textContent).toContain('Tủ bếp');
    /* Chi tiết không chiếm chỗ trên dòng: gợi ý khi rê chuột, và panel phải khi chọn. */
    expect(option).toHaveAttribute('title', '900 × 2.200 mm · Không gắn tường');
    expect(option.textContent).not.toContain('900 × 2.200 mm');
    expect(screen.getByTestId('object-free-standing')).toHaveAttribute('title', 'Không gắn tường');
    expect(option.textContent).not.toContain('0,26');
  });
});
