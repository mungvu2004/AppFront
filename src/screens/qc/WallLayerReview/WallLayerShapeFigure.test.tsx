import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WallHatchDefs, WallShapeFigure } from './WallLayerShapeFigure';
import { ATTENTION_DOT_RADIUS_PX, type WallLayerCanvasShape } from './wallLayerHatch';

const SHAPE = {
  id: 'W-001',
  outline: [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 200 },
    { x: 0, y: 200 },
  ],
  statusCode: 'detected',
  codeLabel: 'W-001',
  thicknessMm: 200,
  centrelinePx: { start: { x: 0, y: 100 }, end: { x: 4000, y: 100 } },
  boundsPx: { x: 0, y: 0, width: 4000, height: 200 },
  attentionDotPx: { x: 2000, y: 100 },
  isLowConfidence: true,
  isReviewed: false,
} as unknown as WallLayerCanvasShape;

/* Tầng chưa hiệu chỉnh vừa khung ở hệ số ~0,05: 1 px màn = 20 px bản vẽ (review-1 #3). */
describe('[BUG-403] gạch chéo và chấm chú ý giữ cỡ px màn ở mọi mức phóng', () => {
  it('mẫu gạch chéo và bán kính chấm nhân với unitPx', () => {
    const { container } = render(
      <svg>
        <WallHatchDefs unitPx={20} />
        <WallShapeFigure
          isHovered={false}
          isInteractive={false}
          isSelected={false}
          onHover={vi.fn()}
          onOpenMenu={vi.fn()}
          onSelect={vi.fn()}
          onToggleSelect={vi.fn()}
          shape={SHAPE}
          showCentrelines={false}
          unitPx={20}
        />
      </svg>,
    );

    expect(container.querySelector('pattern')?.getAttribute('patternTransform')).toBe('rotate(45) scale(20)');
    expect(container.querySelector('circle')?.getAttribute('r')).toBe(String(ATTENTION_DOT_RADIUS_PX * 20));
  });
});

/* FL-16-05 [16-A-042]: đường tim nằm đúng giữa đa giác nên chặn con trỏ ở tâm; bấm vào nó vẫn phải chọn/tách tường. */
describe('[16-A-042] bấm vào đường tim tường vẫn tới tường', () => {
  it('bấm đường tim gọi onSelect với id tường', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <svg>
        <WallShapeFigure
          isHovered={false}
          isInteractive
          isSelected={false}
          onHover={vi.fn()}
          onOpenMenu={vi.fn()}
          onSelect={onSelect}
          onToggleSelect={vi.fn()}
          shape={SHAPE}
          showCentrelines
          unitPx={1}
        />
      </svg>,
    );

    const line = container.querySelector('line');
    expect(line).not.toBeNull();
    fireEvent.click(line!);
    expect(onSelect).toHaveBeenCalledWith('W-001');
  });
});
