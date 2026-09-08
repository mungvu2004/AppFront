/**
 * Mục 2 — tạo liên kết chia sẻ, và danh sách liên kết đang hoạt động.
 *
 * `Select` quyền truy cập chỉ hai mức (chỉ xem · góp ý) — `shareLink.ts` không biết gì
 * hơn `SharePermission`, nên "phạm vi ba mức" của đặc tả gốc không có ở đây (chú thích
 * đầu `types.ts`, khoản 2). Mật khẩu chỉ có ô nhập TRƯỚC khi tạo; sau khi lưu,
 * `ShareLink` không mang mật khẩu dạng rõ nữa nên hàng liên kết chỉ hiện dấu hiệu
 * "có mật khẩu" từ `row.passwordProtected` — không có đường nào để hiện lại được.
 *
 * Danh mục quyền/hạn dùng đến từ `model.form.permissionOptions`/`expiryChoices`, không
 * hardcode ở đây: nếu view tự khai danh mục thì id sẽ lệch với hook vào lúc không ai để ý.
 */

import { Check, Copy } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Toggle } from '@/components/ui/Toggle';

import type { ShareDialogActions, ShareLinkFormModel, ShareLinkRowModel } from './types';

export interface ShareDialogLinkProps {
  readonly form: ShareLinkFormModel;
  readonly rows: readonly ShareLinkRowModel[];
  readonly canCreateLink: boolean;
  readonly noPermissionReason: string | null;
  readonly staleLinkNotice: string | null;
  readonly copiedTargetId: string | null;
  readonly actions: Pick<
    ShareDialogActions,
    | 'setPermission'
    | 'setExpiryChoice'
    | 'setPasswordEnabled'
    | 'setPassword'
    | 'setIncludeViewpoint'
    | 'createLink'
    | 'revokeLink'
    | 'copyLink'
  >;
}

function FieldError({ message }: { readonly message: string | undefined }) {
  if (message === undefined) {
    return null;
  }

  return (
    <p role="alert" className="text-xs text-state-violation-text">
      {message}
    </p>
  );
}

interface LinkRowProps {
  readonly row: ShareLinkRowModel;
  readonly isCopied: boolean;
  readonly onCopy: () => void;
  readonly onRevoke: () => void;
}

function LinkRow({ row, isCopied, onCopy, onRevoke }: LinkRowProps) {
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border-default p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={row.tone}>{row.statusLabel}</Badge>
        <Badge variant="neutral">{row.permissionLabel}</Badge>
        {row.passwordProtected && <Badge variant="neutral">có mật khẩu</Badge>}
        <span className="ml-auto text-xs text-text-secondary">{row.expiryText}</span>
      </div>

      <div className="flex items-center gap-2">
        <p className="flex-1 truncate rounded-lg border border-border-default bg-bg-surface px-3 py-2 font-mono text-xs text-text-primary">
          {row.url}
        </p>
        <IconButton
          aria-label={isCopied ? 'đã sao chép liên kết' : 'sao chép liên kết'}
          icon={isCopied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          onClick={onCopy}
        />
      </div>

      {row.canRevoke && (
        <Button variant="ghost" size="sm" onClick={onRevoke} className="self-start">
          thu hồi
        </Button>
      )}
    </li>
  );
}

export function ShareDialogLink({
  form,
  rows,
  canCreateLink,
  noPermissionReason,
  staleLinkNotice,
  copiedTargetId,
  actions,
}: ShareDialogLinkProps) {
  const permissionSelectOptions = form.permissionOptions.map((option) => ({
    label: option.label,
    value: option.id,
  }));
  const expirySelectOptions = form.expiryChoices.map((option) => ({ label: option.label, value: option.id }));

  const handlePermissionChange = (value: string) => {
    const option = form.permissionOptions.find((candidate) => candidate.id === value);
    if (option) {
      actions.setPermission(option.id);
    }
  };

  return (
    <section aria-label="liên kết chia sẻ" className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-text-secondary">liên kết chia sẻ</h3>

      {!canCreateLink ? (
        <p className="text-xs text-text-secondary">{noPermissionReason}</p>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-border-default p-3">
          <div className="flex flex-col gap-1">
            <Select
              label="quyền truy cập"
              options={permissionSelectOptions}
              value={form.permission}
              onChange={handlePermissionChange}
            />
            <FieldError message={form.problems.permission} />
          </div>

          <div className="flex flex-col gap-1">
            <Select
              label="hạn dùng"
              options={expirySelectOptions}
              value={form.expiryChoiceId}
              onChange={actions.setExpiryChoice}
            />
            <FieldError message={form.problems.expiresAt} />
          </div>

          <div className="flex flex-col gap-2">
            <Toggle
              label="yêu cầu mật khẩu"
              description="người xem phải nhập đúng mật khẩu trước khi mở liên kết."
              checked={form.passwordEnabled}
              onChange={actions.setPasswordEnabled}
            />
            {form.passwordEnabled && (
              <Input
                type="password"
                label="mật khẩu"
                value={form.password}
                error={form.problems.password}
                onChange={(event) => {
                  actions.setPassword(event.target.value);
                }}
              />
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Toggle
              label="kèm góc nhìn hiện tại"
              description="liên kết mở đúng vị trí đang xem, thay vì góc nhìn mặc định của tầng."
              checked={form.includeViewpoint}
              onChange={actions.setIncludeViewpoint}
            />
            <FieldError message={form.problems.viewpoint} />
          </div>

          <Button
            variant="primary"
            disabled={!form.canSubmit}
            onClick={actions.createLink}
            className="self-start"
          >
            tạo liên kết
          </Button>
        </div>
      )}

      {staleLinkNotice !== null && <p className="text-xs text-state-attention-text">{staleLinkNotice}</p>}

      {rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <LinkRow
              key={row.id}
              row={row}
              isCopied={copiedTargetId === row.id}
              onCopy={() => {
                actions.copyLink(row.id);
              }}
              onRevoke={() => {
                actions.revokeLink(row.id);
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
