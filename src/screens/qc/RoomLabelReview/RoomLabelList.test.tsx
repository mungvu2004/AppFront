/**
 * Dòng chưa duyệt của danh sách Phòng mang số hàng đợi 1..N đúng thứ tự dòng (= ghim trên bản vẽ);
 * dòng đã duyệt không số; nhóm "Chưa duyệt" tách theo lý do.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RoomLabelList } from './RoomLabelList';
import type { RoomLabelStatus, RoomLabelViewModel } from './roomLabelTypes';

const room = (id: string, status: RoomLabelStatus) =>
  ({ id, codeLabel: `#${id}`, name: id, hasName: true, areaText: '16,00 m²', status }) as unknown as RoomLabelViewModel;

const ROOMS = [room('R-1', 'suggested'), room('R-2', 'confirmed'), room('R-3', 'unnamed'), room('R-4', 'suggested')];

const queueNumbers = () =>
  screen.getAllByRole('option').map((row) => row.querySelector('[data-queue-number]')?.textContent ?? null);

const renderList = () =>
  render(<RoomLabelList isViewerRole={false} onHover={vi.fn()} onSelect={vi.fn()} rooms={ROOMS} selectedRoomId={null} />);

afterEach(cleanup);

describe('RoomLabelList — số hàng đợi', () => {
  it('dòng chưa duyệt đánh 1..N theo thứ tự dòng, dòng đã duyệt không số', () => {
    renderList();

    expect(queueNumbers()).toEqual(['1', '2', '3', null]);
  });

  it('nhóm theo lý do: chưa có tên trước, máy đề xuất sau, đã duyệt cuối', () => {
    renderList();

    expect(screen.getAllByRole('option').map((row) => row.textContent?.match(/#R-\d/)?.[0])).toEqual(['#R-3', '#R-1', '#R-4', '#R-2']);
  });
});
