/**
 * A1 P1: cột minh hoạ là mặt bằng nét mực tĩnh (không còn canvas 3D trên khung tối) và vẫn hiện dưới `lg`.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ValuePanel } from './ValuePanel';

afterEach(() => {
  cleanup();
});

describe('ValuePanel — mặt bằng nét mực', () => {
  it('vẽ bằng SVG, không canvas, và không ẩn dưới lg', () => {
    const { container } = render(<ValuePanel />);

    expect(container.querySelector('canvas')).toBeNull();
    expect(container.querySelector('svg.auth-art')).not.toBeNull();
    expect(container.querySelector('section')?.className).not.toMatch(/(^| )hidden( |$)/u);
    expect(screen.getByText('Soát bản vẽ mặt bằng trước khi sai sót kịp ra công trường.')).toBeTruthy();
  });
});
