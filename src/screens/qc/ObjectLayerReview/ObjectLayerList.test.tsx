// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

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

    render(
      <ObjectLayerList
        collapsedGroups={{ door: false, window: false, furniture: false }}
        onAttachToNearestWall={noop}
        onHover={noop}
        onSelect={noop}
        onToggleGroupCollapsed={noop}
        rows={[row('a', '#D-001'), row('b', '#D-007')]}
        selectedObjectId={null}
      />,
    );

    expect(screen.getAllByRole('option')).toHaveLength(2);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm mã' }), { target: { value: '#d-007' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: /D-007/ })).toBeTruthy();
  });
});

describe('ObjectLayerList dòng đối tượng (K07)', () => {
  it('ghi tên loại đồ, "Không gắn tường" và "Máy chưa chắc" bằng chữ, không in số tin cậy', () => {
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
    expect(option.textContent).toContain('Không gắn tường');
    /* "Không gắn tường" là chấm nhỏ có tooltip, không còn chữ chiếm chỗ trên dòng. */
    expect(screen.getByTestId('object-free-standing')).toHaveAttribute('title', 'Không gắn tường');
    expect(option.textContent).toContain('Máy chưa chắc');
    expect(option.textContent).not.toContain('0,26');
  });
});
