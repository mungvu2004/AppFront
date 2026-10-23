import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { INK_STROKE_WIDTH, InkPlan, type InkPlanVariant } from './InkPlan';

describe('InkPlan — một họ nét mực cho 404 / 403 / rỗng (V-14)', () => {
  it.each<InkPlanVariant>(['missing-wall', 'closed-door', 'empty-room'])('%s: nét mảnh không phóng theo cỡ, trang trí, chỉ token chữ', (variant) => {
    const { container } = render(<InkPlan variant={variant} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('stroke-width')).toBe(String(INK_STROKE_WIDTH));
    const paths = Array.from(container.querySelectorAll('path'));
    expect(paths.length).toBeGreaterThan(1);
    for (const path of paths) {
      expect(path.getAttribute('vector-effect')).toBe('non-scaling-stroke');
      expect(path.getAttribute('class')).toMatch(/stroke-text-(muted|secondary)/);
    }
  });
});
