/**
 * The links a project already has, in each of the states that list can be in.
 *
 * Split out of `ShareScreen.tsx` under invariant R-22. Four of invariant A11's
 * seven states are decided right here — loading, error, empty, and the loaded
 * list — which is why the branches read as one flat sequence of early returns
 * rather than nested ternaries: a reader checking A11 should be able to count
 * them without unwinding anything.
 *
 * `unreadableNotice` is the fifth: rows the server sent but this client could
 * not parse. The list still renders what it understood and says so above,
 * because dropping them silently would report a short list as a complete one.
 */

import { Code2, Copy, Link2, Lock, Trash2 } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import type { ShareLinkRow, ShareLinksActions, ShareLinksModel } from '@/hooks/useShareLinks';

const SKELETON_ROW_KEYS = ['first', 'second', 'third'] as const;

/* -------------------------------------------------------------------------- */
/* One link in the list.                                                       */
/* -------------------------------------------------------------------------- */

interface ShareRowProps {
  readonly row: ShareLinkRow;
  readonly isCopied: boolean;
  readonly onCopyUrl: (id: string) => void;
  readonly onCopyEmbedCode: (id: string) => void;
  readonly onAskRevoke: (id: string) => void;
}

function ShareRow({ row, isCopied, onCopyUrl, onCopyEmbedCode, onAskRevoke }: ShareRowProps) {
  return (
    <li className="flex flex-col gap-2 rounded-[8px] border border-border-default bg-bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary truncate">{row.title}</span>
            <Badge variant={row.tone}>{row.statusLabel}</Badge>
            {row.passwordProtected ? (
              <span
                className="inline-flex items-center gap-1 text-xs text-text-secondary"
                title="Liên kết này cần mật khẩu"
              >
                <Lock aria-hidden="true" className="h-3 w-3" />
                có mật khẩu
              </span>
            ) : null}
          </div>
          <span className="text-xs text-text-secondary">
            {row.permissionLabel} · {row.expiryText}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            icon={<Copy aria-hidden="true" className="h-4 w-4" />}
            aria-label={`Chép liên kết ${row.title}`}
            size="sm"
            isActive={isCopied}
            onClick={() => {
              onCopyUrl(row.id);
            }}
          />
          <IconButton
            icon={<Code2 aria-hidden="true" className="h-4 w-4" />}
            aria-label={`Chép mã nhúng ${row.title}`}
            size="sm"
            onClick={() => {
              onCopyEmbedCode(row.id);
            }}
          />
          {row.canRevoke ? (
            <IconButton
              icon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
              aria-label={`Thu hồi ${row.title}`}
              size="sm"
              onClick={() => {
                onAskRevoke(row.id);
              }}
            />
          ) : null}
        </div>
      </div>

      <p className="truncate rounded-[6px] bg-bg-sunken px-2 py-1 font-mono text-xs text-text-secondary">
        {row.url}
      </p>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* The list.                                                                   */
/* -------------------------------------------------------------------------- */

export type ShareListProps = Pick<
  ShareLinksModel,
  'rows' | 'isLoading' | 'errorMessage' | 'unreadableNotice' | 'copiedId' | 'canCreate'
> &
  Pick<ShareLinksActions, 'reload' | 'copyUrl' | 'copyEmbedCode' | 'askRevoke'>;

export function ShareList({
  rows,
  isLoading,
  errorMessage,
  unreadableNotice,
  copiedId,
  canCreate,
  reload,
  copyUrl,
  copyEmbedCode,
  askRevoke,
}: ShareListProps) {
  if (isLoading) {
    return (
      <div aria-busy="true" aria-label="đang tải liên kết" className="flex flex-col gap-2">
        {SKELETON_ROW_KEYS.map((key) => (
          <Skeleton key={key} preset="table-row" />
        ))}
      </div>
    );
  }

  if (errorMessage !== null) {
    return (
      <InlineAlert
        level="violation"
        title="Không tải được danh sách liên kết"
        message={errorMessage}
        action={{ label: 'Thử lại', onClick: reload, variant: 'secondary' }}
      />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Link2 aria-hidden="true" className="h-6 w-6" />}
        title="Chưa có liên kết nào"
        description={
          canCreate
            ? 'Dự án này chưa được chia sẻ ra ngoài. Tạo một liên kết ở trên khi cần.'
            : 'Dự án này chưa được chia sẻ ra ngoài.'
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {unreadableNotice !== null ? (
        <InlineAlert
          level="attention"
          title="Danh sách chưa đầy đủ"
          message={unreadableNotice}
          action={{ label: 'Tải lại', onClick: reload, variant: 'secondary' }}
        />
      ) : null}

      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <ShareRow
            key={row.id}
            row={row}
            isCopied={copiedId === row.id}
            onCopyUrl={copyUrl}
            onCopyEmbedCode={copyEmbedCode}
            onAskRevoke={askRevoke}
          />
        ))}
      </ul>
    </div>
  );
}
