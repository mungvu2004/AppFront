/**
 * 24-A-013 — bố cục v1 của editor Pascal phải có điều khiển chế độ tầng nhìn thấy được,
 * để rời tách tầng mà không phải sửa URL. Dựng thẳng `CameraActions` của vendor (gói thật).
 */

import { useViewer } from '@pascal-app/viewer';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CameraActions } from '../../../../vendor/pascal/packages/editor/src/components/ui/action-menu/camera-actions';
import { TooltipProvider } from '../../../../vendor/pascal/packages/editor/src/components/ui/primitives/tooltip';

afterEach(() => {
  useViewer.getState().setLevelMode('stacked');
});

describe('điều khiển chế độ tầng (24-A-013)', () => {
  it('có nút "Chế độ tầng" bật/tắt tách tầng', () => {
    useViewer.getState().setLevelMode('exploded');
    render(
      <TooltipProvider>
        <CameraActions />
      </TooltipProvider>,
    );

    const control = screen.getByRole('button', { name: /chế độ tầng: tách tầng/iu });
    expect(control).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(control);

    expect(useViewer.getState().levelMode).toBe('stacked');
    expect(screen.getByRole('button', { name: /chế độ tầng: xếp tầng/iu })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
