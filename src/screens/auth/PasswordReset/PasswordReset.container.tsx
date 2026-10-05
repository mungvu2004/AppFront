/**
 * `/login/reset-password`, nối với router và với nhóm `auth` của client trần.
 *
 * Cổng dựng từ `createAppApiClient().auth` — nhóm không gắn token, không refresh —
 * nên lượt đặt lại không bao giờ kéo theo một lượt gia hạn phiên. Hai thứ còn lại
 * của cổng là `signOut` (N9 thu hồi mọi phiên) và `navigate`.
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { createAppApiClient } from '@/api/appClient';
import { signOut } from '@/lib/auth';

import { RecoveryRoute } from '../RecoveryRoute';
import { PasswordReset } from './PasswordReset';
import type { PasswordResetPort } from './usePasswordReset';

const SCREEN_ID = 'passwordReset';

function PasswordResetRouteContent() {
  const navigate = useNavigate();

  const port = useMemo<PasswordResetPort>(() => {
    const client = createAppApiClient();

    return {
      confirm: async (input, signal) =>
        client.auth.confirmPasswordReset({ body: input, ...(signal !== undefined ? { signal } : {}) }),
      endLocalSession: signOut,
      navigate: (to, options) => {
        void navigate(to, options);
      },
    };
  }, [navigate]);

  return <PasswordReset port={port} />;
}

/** Cái router gắn vào. */
export function PasswordResetRoute() {
  return (
    <RecoveryRoute screenId={SCREEN_ID}>
      <PasswordResetRouteContent />
    </RecoveryRoute>
  );
}
