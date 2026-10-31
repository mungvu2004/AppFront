/** U03 — hộp thoại chia sẻ nói rõ diện tích là số tạm khi còn tầng chưa đặt tỷ lệ. */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import type { Level } from '@/domain/spatial/types';

import { ShareDialog } from './ShareDialog';
import { buildShareDialogProps } from './shareDialogFixtures';
import { hasUnconfirmedScale, SHARE_SCALE_NOTICE } from './shareDialogGateway';

afterEach(cleanup);

const drawn = { id: 'L-1', name: 'Tầng 1' } as unknown as Level;
const scaled = { ...drawn, scaleMillimetresPerPixel: 10 } as unknown as Level;
const empty = { id: 'L-2', name: 'Tầng 2' } as unknown as Level;
const spatial = { byId: { 'W-1': { id: 'W-1' } }, byLevel: { 'L-1': ['W-1'] } } as unknown as NormalizedSpatial;

describe('U03 — tỷ lệ trên trang chia sẻ', () => {
  it('hasUnconfirmedScale: tầng có bản vẽ mà chưa đặt hoặc còn đoán tỷ lệ; bỏ qua tầng trống', () => {
    expect(hasUnconfirmedScale([drawn], {}, spatial)).toBe(true);
    expect(hasUnconfirmedScale([scaled], {}, spatial)).toBe(false);
    expect(hasUnconfirmedScale([scaled], { 'L-1': { scaleStatus: 'unresolved' } }, spatial)).toBe(true);
    expect(hasUnconfirmedScale([scaled, empty], {}, spatial)).toBe(false);
  });

  it('hiện câu nhắc khi có scaleNotice, không hiện khi null', () => {
    const { rerender } = render(<ShareDialog {...buildShareDialogProps('success')} scaleNotice={SHARE_SCALE_NOTICE} />);
    expect(screen.getByText('Chưa đặt tỷ lệ: diện tích trên trang chia sẻ là số tạm.')).toBeTruthy();

    rerender(<ShareDialog {...buildShareDialogProps('success')} scaleNotice={null} />);
    expect(screen.queryByText(SHARE_SCALE_NOTICE)).toBeNull();
  });
});
