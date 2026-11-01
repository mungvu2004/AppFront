import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { expectAccessible } from '@/lib/testing/expectAccessible';

import { FloorUploadSheetRegions } from './FloorUploadSheetRegions';
import type { FloorUploadSheetRegionsModel } from './types';

const MODEL: FloorUploadSheetRegionsModel = {
  title: 'Chia tờ theo tầng',
  hint: 'Chọn một tầng rồi kéo trên ảnh để khoanh vùng của tầng đó.',
  closeLabel: 'Đóng',
  previewUrl: 'blob:sheet',
  selectedFloorId: 'L1',
  confirmLabel: 'Tải lên 1 tầng',
  canConfirm: true,
  floors: [
    { floorId: 'L1', name: 'Tầng 1', rect: { xRatio: 0, yRatio: 0, widthRatio: 0.5, heightRatio: 1 }, note: null },
    { floorId: 'L2', name: 'Tầng 2', rect: null, note: 'Chưa khoanh' },
  ],
};

const actions = () => ({
  onSelectSheetFloor: vi.fn(),
  onSetSheetRegion: vi.fn(),
  onConfirmSheetRegions: vi.fn(),
  onCloseSheetRegions: vi.fn(),
});

describe('FloorUploadSheetRegions', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<FloorUploadSheetRegions actions={actions()} model={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('labels each rect with its floor and is accessible', () => {
    const { container } = render(<FloorUploadSheetRegions actions={actions()} model={MODEL} />);
    expect(screen.getByTestId('floor-upload-sheet-rect-L1')).toHaveTextContent('Tầng 1');
    expect(screen.queryByTestId('floor-upload-sheet-rect-L2')).toBeNull();
    expectAccessible(container);
  });

  it('drag on the image draws the selected floor rect', () => {
    const handlers = actions();
    render(<FloorUploadSheetRegions actions={handlers} model={{ ...MODEL, selectedFloorId: 'L2' }} />);
    const frame = screen.getByTestId('floor-upload-sheet-frame');
    frame.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect;

    fireEvent.pointerDown(frame, { clientX: 100, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(frame, { clientX: 200, clientY: 100, pointerId: 1 });

    expect(handlers.onSetSheetRegion).toHaveBeenCalledWith('L2', {
      xRatio: 0.5,
      yRatio: 0,
      widthRatio: 0.5,
      heightRatio: 1,
    });
  });

  it('arrow keys nudge, Esc closes, confirm and floor pick fire', () => {
    const handlers = actions();
    render(<FloorUploadSheetRegions actions={handlers} model={MODEL} />);
    const frame = screen.getByTestId('floor-upload-sheet-frame');

    fireEvent.keyDown(frame, { key: 'ArrowRight' });
    expect(handlers.onSetSheetRegion).toHaveBeenCalledWith('L1', expect.objectContaining({ xRatio: 0.01 }));

    fireEvent.keyDown(frame, { key: 'Escape' });
    expect(handlers.onCloseSheetRegions).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Tải lên 1 tầng' }));
    expect(handlers.onConfirmSheetRegions).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('radio', { name: /Tầng 2/u }));
    expect(handlers.onSelectSheetFloor).toHaveBeenCalledWith('L2');
  });

  it('confirm is disabled without a valid rect', () => {
    render(<FloorUploadSheetRegions actions={actions()} model={{ ...MODEL, canConfirm: false }} />);
    expect(screen.getByRole('button', { name: 'Tải lên 1 tầng' })).toBeDisabled();
  });
});
