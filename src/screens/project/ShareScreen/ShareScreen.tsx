/**
 * The screen where a drawing leaves the team, and where it is called back.
 *
 * The rendering half of invariant D's split: {@link ShareScreenView} takes plain
 * props and returns markup. It holds no state, calls no gateway, formats no
 * date and computes no countdown — every string it prints arrived already
 * written by `useShareLinks`, which is why there is not a single `toLocaleString`
 * or unit conversion below for `local/no-raw-number` to catch.
 *
 * ## Why this file is three files
 *
 * The screen crossed invariant R-22's 400-line ceiling, so the two pieces that
 * nothing else reaches into moved out: `ShareForm.tsx` issues a link,
 * `ShareList.tsx` shows the links that exist. Both take the same props object
 * this file receives, so the split changed no data flow — what is left here is
 * the frame, the collapse, and the one modal.
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

import { AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Modal } from '@/components/overlay/Modal';
import { Button } from '@/components/ui/Button';
import {
  useShareLinks,
  type ShareLinksActions,
  type ShareLinksModel,
  type UseShareLinksOptions,
} from '@/hooks/useShareLinks';

import { ShareForm } from './ShareForm';
import { ShareList } from './ShareList';

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
