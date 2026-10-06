/**
 * NO-357 qua đường thật của màn: `startAppSession()` (như `SessionBootstrap` gọi lúc
 * tải trang) hỏng ở bước cấu hình, rồi màn nhận lời mời đọc phiên qua `useSession`.
 * Chỗ giả duy nhất: lượt dựng bộ trả lời gia hạn của bộ mẫu ném, như mất mạng giữa
 * lúc tải chunk.
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as MockClientNamespace from '@/api/__mocks__/client';

import viMessages from '@/i18n/vi.json';
import { __resetAuthForTests, getSession } from '@/lib/auth';
import { __resetLastKnownUserForTests } from '@/lib/auth/bootstrap';
import { __resetAppSessionForTests, startAppSession } from '@/routes/sessionSetup';

import { __resetFragmentTokenForTests } from '../fragmentToken';
import { InvitationAcceptRoute } from './InvitationAccept.container';

let transportBroken = false;

vi.mock('@/api/__mocks__/client', async (importOriginal) => {
  const actual = await importOriginal<typeof MockClientNamespace>();

  return {
    ...actual,
    createMockAuthTransport: (...args: Parameters<typeof actual.createMockAuthTransport>) => {
      if (transportBroken) {
        throw new Error('không nạp được bộ trả lời phiên');
      }

      return actual.createMockAuthTransport(...args);
    },
  };
});

const AUTH = viMessages.auth;

beforeEach(() => {
  transportBroken = false;
  __resetAppSessionForTests();
  __resetLastKnownUserForTests();
  __resetAuthForTests();
  __resetFragmentTokenForTests();
  window.history.replaceState(null, '', '/login/invitation#token=abc');
  vi.stubEnv('VITE_USE_MOCK_API', 'true');
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('InvitationAcceptRoute — lượt mở phiên hỏng ở bước cấu hình (NO-357)', () => {
  it('không khoá nút mãi: nói vì sao, cho thử lại, và thử lại thì mở được phiên', async () => {
    transportBroken = true;
    await expect(startAppSession()).rejects.toThrow();

    render(
      <MemoryRouter initialEntries={['/login/invitation']}>
        <InvitationAcceptRoute />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: AUTH.actions.acceptInvitation })).toBeEnabled();
    expect(screen.getByRole('alert')).toHaveTextContent(viMessages.errors.network.description);

    transportBroken = false;
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: viMessages.common.retry }));
    });

    expect(screen.getByLabelText(AUTH.fields.fullName)).toHaveFocus();
    await waitFor(() => {
      expect(getSession().status).not.toBe('unknown');
    });
    expect(screen.queryByRole('button', { name: viMessages.common.retry })).toBeNull();
    expect(screen.getByLabelText(AUTH.fields.fullName)).toHaveFocus();
  });
});
