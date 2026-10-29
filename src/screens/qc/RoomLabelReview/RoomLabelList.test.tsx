/**
 * L23: dòng chưa duyệt của danh sách Phòng mang số hàng đợi 1..N đúng thứ tự dòng (= ghim trên bản vẽ);
 * dòng đã duyệt không số; tắt cờ L23 thì không dòng nào có số.
 */

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { QC_LAYOUT_STORAGE_KEY } from '../shared/qcLayout';
import { RoomLabelList } from './RoomLabelList';
import type { RoomLabelStatus, RoomLabelViewModel } from './roomLabelTypes';

const room = (id: string, status: RoomLabelStatus) =>
  ({ id, codeLabel: `#${id}`, name: id, hasName: true, areaText: '16,00 m²', status }) as unknown as RoomLabelViewModel;

const ROOMS = [room('R-1', 'suggested'), room('R-2', 'confirmed'), room('R-3', 'unnamed'), room('R-4', 'suggested')];

const queueNumbers = () =>
  screen.getAllByRole('option').map((row) => within(row).queryByLabelText(/trong hàng đợi$/)?.textContent ?? null);

const renderList = () =>
  render(<RoomLabelList isViewerRole={false} onHover={vi.fn()} onSelect={vi.fn()} rooms={ROOMS} selectedRoomId={null} />);

afterEach(() => {
  cleanup();
  localStorage.removeItem(QC_LAYOUT_STORAGE_KEY);
});

describe('RoomLabelList — số hàng đợi L23', () => {
  it('L23: dòng chưa duyệt đánh 1..N theo thứ tự dòng, dòng đã duyệt không số', () => {
    localStorage.setItem(QC_LAYOUT_STORAGE_KEY, 'l23');
    renderList();

    expect(queueNumbers()).toEqual(['1', '2', '3', null]);
  });

  it('bố cục cũ: không dòng nào có số', () => {
    renderList();

    expect(queueNumbers()).toEqual([null, null, null, null]);
  });
});
