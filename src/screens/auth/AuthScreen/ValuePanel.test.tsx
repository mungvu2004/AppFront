/**
 * RV5#15: chữ chờ "Đang dựng mô hình căn hộ…" gỡ theo cờ "đã vẽ", không dựa vào canvas che nó.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ValuePanel } from './ValuePanel';

vi.mock('./houseScene', () => ({
  mountHouseScene: () => ({ ready: Promise.resolve(), dispose: () => undefined }),
}));

afterEach(() => {
  cleanup();
});

describe('ValuePanel — chữ chờ của mô hình', () => {
  it('hiện lúc đầu và gỡ khi mô hình đã sẵn sàng', async () => {
    render(<ValuePanel />);

    expect(screen.getByText('Đang dựng mô hình căn hộ…')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Đang dựng mô hình căn hộ…')).toBeNull());
  });
});
