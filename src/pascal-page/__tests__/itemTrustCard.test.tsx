import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { create } from 'zustand';

import { ItemTrustCard, itemTrustLabelOf } from '../ItemTrustCard';
import type { SwapModelStores } from '../SwapModelCard';

const origin = (confidence: number, reviewed: boolean) => ({ appfront: { confidence, reviewed, source: 'ai' } });

describe('itemTrustLabelOf (D7)', () => {
  it('says "máy chưa chắc" with a Vietnamese decimal comma below 0,70', () => {
    expect(itemTrustLabelOf(origin(0.42, false))).toEqual({ text: 'Máy chưa chắc (0,42) — chưa ai duyệt', tone: 'attention' });
  });

  it('keeps the verified tone for a reviewed piece only (A5)', () => {
    expect(itemTrustLabelOf(origin(0.42, true))).toEqual({ text: 'Bạn đã duyệt', tone: 'verified' });
    expect(itemTrustLabelOf(origin(0.9, false))).toBeNull();
  });

  it('flags pieces the machine added that are not on the drawing', () => {
    expect(itemTrustLabelOf({ generated: 'dressing' })?.text).toBe('Máy tự thêm — không có trên bản vẽ');
    expect(itemTrustLabelOf(undefined)).toBeNull();
  });

  it('renders the label of the single selected item', () => {
    const useViewer = create(() => ({ selection: { selectedIds: ['item_a'] as readonly string[] } }));
    const useScene = create(() => ({ nodes: { item_a: { id: 'item_a', type: 'item', metadata: origin(0.42, false) } } }));
    const stores = { useViewer, useScene } as unknown as SwapModelStores;

    render(<ItemTrustCard stores={stores} />);

    // Huy hiệu ngắn; câu đầy đủ ở chú thích và tên đọc được.
    const badge = screen.getByRole('status');
    expect(badge.textContent).toBe('Chưa duyệt');
    expect(badge.getAttribute('title')).toBe('Máy chưa chắc (0,42) — chưa ai duyệt');
    expect(badge.getAttribute('aria-label')).toBe('Máy chưa chắc (0,42) — chưa ai duyệt');
  });
});
