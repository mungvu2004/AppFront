/**
 * `/projects/:id/share`, wired to the router and the session.
 *
 * The thinnest layer in the feature, and deliberately so: it reads the project
 * out of the URL and the roles out of the session, and hands both to
 * {@link ShareScreen}. Everything else — loading, validating, formatting,
 * revoking — is below it in `useShareLinks`, which is what lets the screen be
 * tested and storied without a router.
 *
 * When there is no session to share from, this renders a sentence rather than
 * an empty share screen. A screen that offered a "tạo liên kết" button which
 * could only ever fail would be worse than one that says why it cannot.
 */

import { useParams } from 'react-router-dom';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { useSession } from '@/hooks/useSession';
import { SHARE_GATEWAY_UNAVAILABLE, useShareLinkGateway } from '@/hooks/useShareLinkGateway';

import { ShareScreen } from './ShareScreen';

export function ShareRoute() {
  const { id } = useParams<{ id: string }>();
  const session = useSession();
  const gateway = useShareLinkGateway();

  if (id === undefined || id.length === 0) {
    return (
      <div className="p-6">
        <InlineAlert
          level="violation"
          title="Không xác định được dự án"
          message="Đường dẫn thiếu mã dự án, nên không biết phải chia sẻ bản vẽ nào."
        />
      </div>
    );
  }

  if (gateway === null) {
    return (
      <div className="p-6">
        <InlineAlert level="attention" title="Chưa sẵn sàng" message={SHARE_GATEWAY_UNAVAILABLE} />
      </div>
    );
  }

  return (
    <ShareScreen
      projectName={`Dự án ${id}`}
      gateway={gateway}
      projectId={id}
      roles={session.roles}
      copyToClipboard={(text) => navigator.clipboard.writeText(text)}
    />
  );
}
