// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ObjectLayerList } from './ObjectLayerList';
import type { ObjectListRowViewModel } from './objectLayerTypes';

const row = (id: string, codeLabel: string): ObjectListRowViewModel =>
  ({
    id,
    layer: 'door',
    subtype: 'door-single',
    codeLabel,
    sizeLabel: '900 × 2.200 mm',
    hostWallLabel: '#W-001',
    confidence: 0.9,
    statusCode: 'neutral',
    isReviewed: false,
    isLowConfidence: false,
    isOrphan: false,
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
