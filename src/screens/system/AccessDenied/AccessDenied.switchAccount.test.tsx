/**
 * FL-11U-08 / 11U-A-402 + 11U-A-305: "Đăng nhập bằng tài khoản khác" ends the session, so `/login` must carry BOTH
 * the way back (`state.from`) and the session-ended notice (`state.notice`). Before the fix the `finally`
 * navigation replaced the gate's notice with `{ from }` alone: tab A showed no notice (RR2).
 */
import { act } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/lib/testing/render';

import { useAccessDenied } from './useAccessDenied';
import type { AccessDeniedVm } from './accessDeniedModel';

vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  signOut: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/hooks/useSession', () => ({
  useSession: () => ({ status: 'authenticated', user: { id: 'u-1', name: 'Kỹ sư', email: 'ky.su@vidu.vn' }, roles: [] }),
}));

let vm: AccessDeniedVm | null = null;
let loginState: unknown = null;

function Denied() {
  vm = useAccessDenied();

  return null;
}

function Login() {
  loginState = useLocation().state;

  return null;
}

describe('[11U-A-402][11U-A-305] đổi tài khoản từ màn không có quyền', () => {
  it('đưa về /login kèm from VÀ thông báo phiên đã kết thúc', async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={['/khong-co-quyen']}>
        <Routes>
          <Route path="/khong-co-quyen" element={<Denied />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>,
    );

    await act(async () => {
      vm?.switchAccount.onActivate();
    });

    expect(loginState).toEqual({ from: '/khong-co-quyen', notice: 'sessionEnded' });
  });
});
