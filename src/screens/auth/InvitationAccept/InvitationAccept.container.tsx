/**
 * `/login/invitation`, nối với router, nhóm `auth` của client trần và phiên.
 *
 * `bootstrapSession` của cổng là HÀM `bootstrapAfterNewCookie` (không gọi ở đây): lượt
 * mở phiên lúc tải trang còn bay thì single-flight trả đúng kết quả của nó.
 * Hai cờ phiên đọc từ `useSession`: `isSessionPending` = `unknown` mà máy chủ chưa
 * được báo là không tới được (route công khai không có dải của `SessionGate`, nên nếu
 * máy chủ đứt thì nút phải mở khoá để lượt gửi hỏng mạng rơi vào `error`).
 * `isSessionUnavailable` là nửa kia: máy chủ đứt (hay lượt cấu hình phiên hỏng —
 * `startAppSession` bật cùng cờ, NO-357) thì màn tự nói và cho thử lại.
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { createAppApiClient } from '@/api/appClient';
import { useSession } from '@/hooks/useSession';
import { bootstrapAfterNewCookie, retryAppSession } from '@/routes/sessionSetup';

import { RecoveryRoute } from '../RecoveryRoute';
import { InvitationAccept } from './InvitationAccept';
import type { InvitationAcceptPort } from './useInvitationAccept';

const SCREEN_ID = 'invitationAccept';

function InvitationAcceptRouteContent() {
  const navigate = useNavigate();
  const session = useSession();

  const isSignedIn = session.status === 'authenticated';
  const isSessionPending = session.status === 'unknown' && session.serverUnreachable !== true;
  const isSessionUnavailable = session.status === 'unknown' && session.serverUnreachable === true;

  const port = useMemo<InvitationAcceptPort>(() => {
    const client = createAppApiClient();

    return {
      accept: async (input, signal) =>
        client.auth.acceptInvitation({ body: input, ...(signal !== undefined ? { signal } : {}) }),
      bootstrapSession: bootstrapAfterNewCookie,
      navigate: (to, options) => {
        void navigate(to, options);
      },
      isSignedIn,
      isSessionPending,
      isSessionUnavailable,
      retrySession: retryAppSession,
    };
  }, [isSessionPending, isSessionUnavailable, isSignedIn, navigate]);

  return <InvitationAccept port={port} />;
}

/** Cái router gắn vào. */
export function InvitationAcceptRoute() {
  return (
    <RecoveryRoute screenId={SCREEN_ID}>
      <InvitationAcceptRouteContent />
    </RecoveryRoute>
  );
}
