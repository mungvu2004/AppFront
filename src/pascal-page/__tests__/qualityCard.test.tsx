/**
 * Thẻ "Chất lượng" (`../QualityCard`): chọn mức gọi setTierMode (store + localStorage),
 * Tự động hiện mức đang dùng.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { QualityCard, qualityLabel } from '../QualityCard';
import { useRealism } from '../realism/store';

describe('QualityCard', () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => useRealism.setState({ tierMode: 'auto', tier: 'low' }));
  });

  it('nhãn: Tự động kèm mức đang dùng, mức tay chỉ tên mức', () => {
    expect(qualityLabel('auto', 'low')).toBe('Tự động · Thấp');
    expect(qualityLabel('high', 'high')).toBe('Cao');
  });

  it('bốn lựa chọn, Tự động · Thấp đang dùng; chọn Cao → tier high, nhớ, đóng menu', () => {
    const { container } = render(<QualityCard />);
    const list = screen.getByRole('list', { name: 'Danh sách mức chất lượng' });
    const buttons = [...list.querySelectorAll('button')];
    expect(buttons.map((b) => b.textContent)).toEqual(['Tự động · Thấp', 'Thấp', 'Vừa', 'Cao']);
    expect(list.querySelector('[aria-current="true"]')?.textContent).toBe('Tự động · Thấp');
    expect(screen.getByLabelText(/Chất lượng: Tự động · Thấp/)).not.toBeNull();

    const details = container.querySelector('details')!;
    details.setAttribute('open', '');
    fireEvent.click(buttons[3]!);
    expect(useRealism.getState()).toMatchObject({ tierMode: 'high', tier: 'high' });
    expect(localStorage.getItem('pascal.realism.tierMode')).toBe('high');
    expect(details.hasAttribute('open')).toBe(false);
    expect(list.querySelector('[aria-current="true"]')?.textContent).toBe('Cao');
  });
});
