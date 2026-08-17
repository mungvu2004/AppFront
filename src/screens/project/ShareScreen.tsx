/**
 * The screen where a drawing leaves the team, and where it is called back.
 *
 * The rendering half of invariant D's split: {@link ShareScreenView} takes plain
 * props and returns markup. It holds no state, calls no gateway, formats no
 * date and computes no countdown — every string it prints arrived already
 * written by `useShareLinks`, which is why there is not a single `toLocaleString`
 * or unit conversion below for `local/no-raw-number` to catch.
 *
 * Two decisions worth defending, because both look like extra work:
 *
 * - **The revoke asks first, and the create does not.** Invariant A9 allows a
 *   blocking modal for exactly three things — creating, deleting, publishing —
 *   and revoking is the delete. It gets the modal because it is the one action
 *   on this screen invariant A8's undo cannot cover: a link that has been opened
 *   by somebody outside the team cannot be un-issued by a toast. Creating a link
 *   is the reverse — instantly undoable, by revoking it — so it happens inline
 *   and offers the undo afterwards.
 * - **The "không có quyền" state removes the form and keeps the list.** An
 *   account that cannot create shares still needs to see who already has one;
 *   hiding the list would turn a permission into an information gap. The server
 *   is the boundary either way — `can()` here only decides what is worth
 *   offering.
 *
 * All seven of invariant A11's states are rendered from
 * {@link ShareScreenViewProps.state} plus the list props, and
 * `ShareScreen.test.tsx` renders every one of them through `expectSevenStates`.
 *
 * ## Field names
 *
 * The brief names this `manHinhChiaSe`. Invariants B and E.11 of `CLAUDE.md`
 * forbid Vietnamese identifiers, so it is {@link ShareScreen}. Every string a
 * person reads stays Vietnamese, lower case and sentence style, as invariant A6
 * requires.
 */

import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Link2,
  Lock,
  Trash2,
} from 'lucide-react';

import { Modal } from '@/components/overlay/Modal';
import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FieldRow } from '@/components/ui/FieldRow';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import { Toggle } from '@/components/ui/Toggle';
import {
  SHARE_EXPIRY_CHOICES,
  SHARE_EXPIRY_LABELS,
  useShareLinks,
  type ShareExpiryChoice,
  type ShareLinkRow,
  type ShareLinksActions,
  type ShareLinksModel,
  type UseShareLinksOptions,
} from '@/hooks/useShareLinks';
import { SHARE_PERMISSION_LABELS, type SharePermission } from '@/lib/export/shareLink';

/* -------------------------------------------------------------------------- */
/* Wording.                                                                    */
/* -------------------------------------------------------------------------- */

const SKELETON_ROW_KEYS = ['first', 'second', 'third'] as const;

const PERMISSION_OPTIONS: readonly { readonly label: string; readonly value: SharePermission }[] = [
  { label: SHARE_PERMISSION_LABELS.view, value: 'view' },
  { label: SHARE_PERMISSION_LABELS.comment, value: 'comment' },
];

const EXPIRY_OPTIONS = SHARE_EXPIRY_CHOICES.map((choice) => ({
  label: SHARE_EXPIRY_LABELS[choice],
  value: choice,
}));

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
/* The form.                                                                   */
/* -------------------------------------------------------------------------- */

type ShareFormProps = Pick<
  ShareLinksModel,
  'form' | 'formProblems' | 'canSubmit' | 'isCreating' | 'viewpointAvailable'
> &
  Pick<
    ShareLinksActions,
    | 'setPermission'
    | 'setExpiryChoice'
    | 'setPasswordEnabled'
    | 'setPassword'
    | 'setIncludeViewpoint'
    | 'setToolbar'
    | 'create'
  >;

function ShareForm({
  form,
  formProblems,
  canSubmit,
  isCreating,
  viewpointAvailable,
  setPermission,
  setExpiryChoice,
  setPasswordEnabled,
  setPassword,
  setIncludeViewpoint,
  setToolbar,
  create,
}: ShareFormProps) {
  return (
    <section
      aria-labelledby="share-create-heading"
      className="flex flex-col rounded-[12px] border border-border-default bg-bg-surface"
    >
      <h3
        id="share-create-heading"
        className="border-b border-border-default px-4 py-3 text-sm font-medium text-text-primary"
      >
        tạo liên kết mới
      </h3>

      <div className="flex flex-col">
        <FieldRow label="quyền">
          <SegmentedControl
            options={[...PERMISSION_OPTIONS]}
            value={form.permission}
            onChange={setPermission}
          />
        </FieldRow>

        <FieldRow label="hạn dùng">
          <Select
            options={[...EXPIRY_OPTIONS]}
            value={form.expiryChoice}
            onChange={(value) => {
              setExpiryChoice(value as ShareExpiryChoice);
            }}
          />
        </FieldRow>

        <FieldRow label="mật khẩu">
          <div className="flex w-full flex-col gap-2">
            <Toggle
              checked={form.passwordEnabled}
              onChange={setPasswordEnabled}
              label="cần mật khẩu để mở"
            />
            {form.passwordEnabled ? (
              <Input
                type="password"
                value={form.password}
                autoComplete="new-password"
                aria-label="mật khẩu của liên kết"
                placeholder="ít nhất sáu ký tự"
                error={formProblems.password}
                hint="Mật khẩu chỉ được gửi tới máy chủ, không nằm trong đường dẫn."
                onChange={(event) => {
                  setPassword(event.target.value);
                }}
              />
            ) : null}
          </div>
        </FieldRow>

        <FieldRow label="góc nhìn">
          <Toggle
            checked={form.includeViewpoint && viewpointAvailable}
            disabled={!viewpointAvailable}
            onChange={setIncludeViewpoint}
            label="mở đúng góc nhìn hiện tại"
            description={
              viewpointAvailable
                ? 'Người nhận thấy đúng tầng, đúng hướng nhìn và đúng cách tô màu.'
                : 'Chưa có góc nhìn nào để gắn; hãy mở bản vẽ trước.'
            }
          />
        </FieldRow>

        <FieldRow label="thanh công cụ" isLast>
          <Toggle
            checked={form.toolbar}
            onChange={setToolbar}
            label="hiện thanh công cụ cho người nhận"
          />
        </FieldRow>
      </div>

      {formProblems.expiresAt !== undefined ? (
        <div className="px-4 pb-3">
          <InlineAlert level="attention" message={formProblems.expiresAt} />
        </div>
      ) : null}

      <div className="flex justify-end border-t border-border-default px-4 py-3">
        <Button
          variant="primary"
          disabled={!canSubmit}
          loading={isCreating}
          iconBefore={<Link2 aria-hidden="true" className="h-4 w-4" />}
          onClick={create}
        >
          Tạo liên kết
        </Button>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* The list, in each of the states it can be in.                               */
/* -------------------------------------------------------------------------- */

type ShareListProps = Pick<
  ShareLinksModel,
  'rows' | 'isLoading' | 'errorMessage' | 'unreadableNotice' | 'copiedId' | 'canCreate'
> &
  Pick<ShareLinksActions, 'reload' | 'copyUrl' | 'copyEmbedCode' | 'askRevoke'>;

function ShareList({
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

/* -------------------------------------------------------------------------- */
/* The screen.                                                                 */
/* -------------------------------------------------------------------------- */

export interface ShareScreenViewProps extends ShareLinksModel, ShareLinksActions {
  /** The project being shared, for the heading. */
  readonly projectName: string;
}

/**
 * The share screen, as a function of its props.
 *
 * Rendered directly by tests and stories, one call per state, which is what
 * makes invariant A11 checkable without a network or a store.
 */
export function ShareScreenView(props: ShareScreenViewProps) {
  const { projectName, state, canCreate, isCollapsed, revoking, isRevoking } = props;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-bg-app p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-text-primary">Chia sẻ dự án</h2>
          <p className="text-sm text-text-secondary">{projectName}</p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          aria-expanded={!isCollapsed}
          aria-controls="share-body"
          iconBefore={
            isCollapsed ? (
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            ) : (
              <ChevronDown aria-hidden="true" className="h-4 w-4" />
            )
          }
          onClick={() => {
            props.setCollapsed(!isCollapsed);
          }}
        >
          {isCollapsed ? 'mở rộng' : 'thu gọn'}
        </Button>
      </header>

      {isCollapsed ? (
        <p id="share-body" className="text-sm text-text-secondary">
          Phần chia sẻ đang thu gọn. {props.rows.length > 0 ? 'Dự án đang có liên kết chia sẻ.' : 'Dự án chưa có liên kết nào.'}
        </p>
      ) : (
        <div id="share-body" className="flex flex-col gap-4">
          {canCreate ? (
            <ShareForm {...props} />
          ) : (
            <InlineAlert
              level="attention"
              title="Không có quyền tạo liên kết"
              message="Vai trò hiện tại chỉ được xem. Nhờ quản trị dự án cấp quyền chia sẻ nếu cần gửi bản vẽ ra ngoài."
            />
          )}

          <section aria-labelledby="share-list-heading" className="flex flex-col gap-3">
            <h3 id="share-list-heading" className="text-sm font-medium text-text-primary">
              liên kết đang có
            </h3>
            <ShareList {...props} />
          </section>
        </div>
      )}

      {/* Invariant A9: a modal for a delete, because this delete has no undo. */}
      <Modal.Root
        isOpen={revoking !== null}
        onClose={props.cancelRevoke}
        width={480}
        titleId="share-revoke-title"
      >
        <Modal.Header>
          <span id="share-revoke-title">Thu hồi liên kết?</span>
        </Modal.Header>
        <Modal.Body>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-text-primary">
              {revoking === null
                ? ''
                : `"${revoking.title}" sẽ ngừng hoạt động ngay. Người đang giữ liên kết sẽ không mở được nữa.`}
            </p>
            <p className="flex items-start gap-2 text-sm text-text-secondary">
              <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              Không hoàn tác được. Nếu cần chia sẻ lại, hãy tạo một liên kết mới.
            </p>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={props.cancelRevoke}>
            Để nguyên
          </Button>
          <Button variant="danger" loading={isRevoking} onClick={props.confirmRevoke}>
            Thu hồi
          </Button>
        </Modal.Footer>
      </Modal.Root>

      {/* The headline state, announced rather than drawn: a screen reader hears
          which of the seven the screen is in without a visual badge that would
          be developer furniture on a product screen (list B). */}
      <span className="sr-only" role="status">
        {state}
      </span>
    </div>
  );
}

export interface ShareScreenProps extends UseShareLinksOptions {
  readonly projectName: string;
}

/** The screen, wired to its hook. */
export function ShareScreen({ projectName, ...options }: ShareScreenProps) {
  const { model, actions } = useShareLinks(options);

  return <ShareScreenView projectName={projectName} {...model} {...actions} />;
}
