/**
 * The half of the share screen that issues a new link.
 *
 * Split out of `ShareScreen.tsx` under invariant R-22: the screen had grown past
 * the 400-line ceiling, and the form was the largest piece that nothing else on
 * the screen reaches into. It stays a view in the sense of invariant D — every
 * prop arrives already computed by `useShareLinks`, so there is no state, no
 * gateway call and no number formatting here.
 *
 * **Creating does not ask first, on purpose.** Invariant A9 reserves the
 * blocking modal for actions invariant A8's undo cannot cover. A new link is
 * instantly undoable — revoke it — so the button acts and offers the undo
 * afterwards. The modal lives with the revoke, in `ShareScreen.tsx`.
 */

import { Link2 } from 'lucide-react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Button } from '@/components/ui/Button';
import { FieldRow } from '@/components/ui/FieldRow';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import { Toggle } from '@/components/ui/Toggle';
import {
  SHARE_EXPIRY_CHOICES,
  SHARE_EXPIRY_LABELS,
  type ShareExpiryChoice,
  type ShareLinksActions,
  type ShareLinksModel,
} from '@/hooks/useShareLinks';
import { SHARE_PERMISSION_LABELS, type SharePermission } from '@/lib/export/shareLink';

/* -------------------------------------------------------------------------- */
/* Wording.                                                                    */
/* -------------------------------------------------------------------------- */

const PERMISSION_OPTIONS: readonly { readonly label: string; readonly value: SharePermission }[] = [
  { label: SHARE_PERMISSION_LABELS.view, value: 'view' },
  { label: SHARE_PERMISSION_LABELS.comment, value: 'comment' },
];

const EXPIRY_OPTIONS = SHARE_EXPIRY_CHOICES.map((choice) => ({
  label: SHARE_EXPIRY_LABELS[choice],
  value: choice,
}));

export type ShareFormProps = Pick<
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

export function ShareForm({
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
