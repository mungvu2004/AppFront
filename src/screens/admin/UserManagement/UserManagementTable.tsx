/**
 * Bảng người dùng: bảy cột — ảnh đại diện + họ tên · email · vai · số dự án · lần hoạt động
 * cuối · trạng thái · hành động. `isCollapsed === true` đổi bảng thành thẻ xếp chồng, không
 * phải bảng thu nhỏ (Đ-7 trạng thái 7).
 *
 * `Table.Row`/`Table.Cell` hard-code `h-10` (40px); 48px của đặc tả đạt được bằng cách
 * truyền `className="h-12"` cho CẢ HAI — `twMerge` bên trong hai component đó ghi đè `h-10`.
 *
 * `row.justChanged` nháy nền 340 ms — `duration-340` là tên hạng mục Tailwind ứng với
 * `MOTION_DURATIONS_MS.slow` (`src/lib/motion/tokens.ts`), không phải một số viết tay; đặc
 * tả gốc ghi 400 ms nhưng 400 không có trên thang năm giá trị (Đ-9). Tiền lệ nguyên văn:
 * `screens/qc/WallLayerReview/WallLayerList.tsx`.
 *
 * Vai và trạng thái không bao giờ đứng một mình bằng màu (đặc tả cấm tuyệt đối): `Badge`
 * dùng `variant="neutral"` cho cả hai, chữ đọc được luôn đi kèm dấu chấm màu.
 */
import { SearchX } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Table } from '@/components/ui/Table';
import { Tooltip } from '@/components/ui/Tooltip';
import { initialsOf } from '@/lib/format/initials';
import { cn } from '@/lib/utils';
import type { ProjectRole } from '@/types/project';

import type { RoleOption, UserManagementActions, UserManagementTableProps, UserRowModel } from './types';

const HEADER_USER = 'Họ tên';
const HEADER_EMAIL = 'Email';
const HEADER_ROLE = 'Vai';
const HEADER_PROJECTS = 'Số dự án';
const HEADER_LAST_ACTIVE = 'Lần hoạt động cuối';
const HEADER_STATUS = 'Trạng thái';
const HEADER_ACTIONS = 'Hành động';
const NO_MATCH_TITLE = 'Không tìm thấy người dùng';
const NO_MATCH_DESCRIPTION = 'Không ai khớp với từ khoá hoặc bộ lọc đang chọn.';
const CLEAR_SEARCH_LABEL = 'Xoá tìm kiếm';
const INVITE_EXPIRED_LABEL = 'Lời mời đã hết hạn';
const RESEND_INVITE_LABEL = 'Gửi lại';
const DISABLE_LABEL = 'Vô hiệu hoá';
const ENABLE_LABEL = 'Bật lại';
const REMOVE_LABEL = 'Xoá';
const COLUMN_COUNT = 7;
const ROW_HEIGHT = 'h-12';
const FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface';

const roleSelectLabel = (name: string): string => `Vai của ${name}`;

/**
 * `exactOptionalPropertyTypes` phân biệt "không truyền prop" với "truyền `undefined`".
 * `row.avatarUrl` là `string | undefined`; spread có điều kiện thay vì truyền thẳng để
 * tránh lỗi TS2375 trên `AvatarProps.src?: string`.
 */
function avatarSrcProp(avatarUrl: string | undefined): { src: string } | Record<string, never> {
  return avatarUrl === undefined ? {} : { src: avatarUrl };
}

interface RoleCellProps {
  readonly actions: UserManagementActions;
  readonly roleOptions: readonly RoleOption[];
  readonly row: UserRowModel;
}

function RoleCell({ actions, roleOptions, row }: RoleCellProps) {
  if (row.roleChangeBlockedReason !== null) {
    return <span className="text-[13px] text-text-secondary">{row.roleChangeBlockedReason}</span>;
  }

  const options = roleOptions.map((option) => ({ label: option.label, value: option.role as string }));

  return (
    <Select.Root
      className="w-[160px]"
      onChange={(value) => actions.onChangeRole(row.id, value as ProjectRole)}
      options={options}
      value={row.role}
    >
      <Select.Label className="sr-only">{roleSelectLabel(row.name)}</Select.Label>
      <Select.Trigger options={options} />
      <Select.Content>
        {options.map((option) => (
          <Select.Item key={option.value} value={option.value}>
            {option.label}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );
}

interface StatusCellProps {
  readonly actions: UserManagementActions;
  readonly row: UserRowModel;
}

function StatusCell({ actions, row }: StatusCellProps) {
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge variant="neutral">{row.statusLabel}</Badge>
      {row.inviteExpired && (
        <div className="flex items-center gap-1.5 text-[13px] text-state-attention-text">
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-state-attention" />
          <span>{INVITE_EXPIRED_LABEL}</span>
        </div>
      )}
      {row.inviteExpired && row.canResendInvite && (
        <button
          className={cn('text-left text-[13px] font-medium text-accent hover:underline', FOCUS_RING)}
          onClick={() => actions.onResendInvite(row.id)}
          type="button"
        >
          {RESEND_INVITE_LABEL}
        </button>
      )}
    </div>
  );
}

interface RowActionsProps {
  readonly actions: UserManagementActions;
  readonly row: UserRowModel;
}

function RowActions({ actions, row }: RowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-2">
      {row.status === 'disabled' ? (
        <Button onClick={() => actions.onEnableUser(row.id)} size="sm" variant="ghost">
          {ENABLE_LABEL}
        </Button>
      ) : row.disableBlockedReason !== null ? (
        <span className="text-[13px] text-text-secondary">{row.disableBlockedReason}</span>
      ) : (
        <Button onClick={() => actions.onDisableUser(row.id)} size="sm" variant="ghost">
          {DISABLE_LABEL}
        </Button>
      )}

      {row.removeBlockedReason !== null ? (
        <span className="text-[13px] text-text-secondary">{row.removeBlockedReason}</span>
      ) : (
        <Button onClick={() => actions.onOpenRemove(row.id)} size="sm" variant="ghost">
          {REMOVE_LABEL}
        </Button>
      )}
    </div>
  );
}

/** Tìm không thấy ai: cùng một khối ở mọi khổ, có lối thoát (BUG-082). */
function NoMatchState({ onClearSearch }: { readonly onClearSearch: () => void }) {
  return (
    <EmptyState
      action={{ label: CLEAR_SEARCH_LABEL, onClick: onClearSearch, variant: 'secondary' }}
      description={NO_MATCH_DESCRIPTION}
      icon={<SearchX aria-hidden="true" />}
      title={NO_MATCH_TITLE}
    />
  );
}

interface UserListProps {
  readonly actions: UserManagementActions;
  readonly roleOptions: readonly RoleOption[];
  readonly rows: readonly UserRowModel[];
}

/** Dưới 1024: bảng thành một cột thẻ xếp chồng. */
function UserManagementCardList({ actions, roleOptions, rows }: UserListProps) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li
          className={cn(
            'flex flex-col gap-3 rounded-[8px] border border-border-default p-3',
            row.justChanged && 'bg-bg-flash duration-340',
          )}
          key={row.id}
        >
          <div className="flex items-center gap-3">
            <Avatar alt={row.name} initials={initialsOf(row.name, row.email)} size="default" {...avatarSrcProp(row.avatarUrl)} />
            <button
              className={cn('min-w-0 flex-1 text-left', FOCUS_RING)}
              onClick={() => actions.onSelectUser(row.id)}
              type="button"
            >
              <p className="truncate font-medium text-text-primary">{row.name}</p>
              <p className="truncate text-[13px] text-text-secondary">{row.email}</p>
            </button>
            <StatusCell actions={actions} row={row} />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
            <div className="flex flex-col gap-1">
              <dt className="text-text-secondary">{HEADER_ROLE}</dt>
              <dd>
                <RoleCell actions={actions} roleOptions={roleOptions} row={row} />
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-text-secondary">{HEADER_PROJECTS}</dt>
              <dd className="font-mono tabular-nums">{row.projectCountLabel}</dd>
            </div>
            <div className="col-span-2 flex justify-between gap-2">
              <dt className="text-text-secondary">{HEADER_LAST_ACTIVE}</dt>
              <dd>
                <Tooltip label={row.lastActiveExactLabel}>
                  <span>{row.lastActiveLabel}</span>
                </Tooltip>
              </dd>
            </div>
          </dl>
          <RowActions actions={actions} row={row} />
        </li>
      ))}
    </ul>
  );
}

export function UserManagementTable({
  actions,
  isCollapsed,
  roleOptions,
  rows,
  selectedUserId,
  skeletonRowCount,
  state,
}: UserManagementTableProps) {
  if (state === 'loading') {
    return (
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>{HEADER_USER}</Table.Head>
            <Table.Head>{HEADER_EMAIL}</Table.Head>
            <Table.Head>{HEADER_ROLE}</Table.Head>
            <Table.Head>{HEADER_PROJECTS}</Table.Head>
            <Table.Head>{HEADER_LAST_ACTIVE}</Table.Head>
            <Table.Head>{HEADER_STATUS}</Table.Head>
            <Table.Head>
              <span className="sr-only">{HEADER_ACTIONS}</span>
            </Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          <Table.Skeleton columns={COLUMN_COUNT} rows={skeletonRowCount} />
        </Table.Body>
      </Table.Root>
    );
  }

  if (rows.length === 0) {
    return <NoMatchState onClearSearch={actions.onClearSearch} />;
  }

  if (isCollapsed) {
    return <UserManagementCardList actions={actions} roleOptions={roleOptions} rows={rows} />;
  }

  return (
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>{HEADER_USER}</Table.Head>
          <Table.Head>{HEADER_EMAIL}</Table.Head>
          <Table.Head>{HEADER_ROLE}</Table.Head>
          <Table.Head>{HEADER_PROJECTS}</Table.Head>
          <Table.Head>{HEADER_LAST_ACTIVE}</Table.Head>
          <Table.Head>{HEADER_STATUS}</Table.Head>
          <Table.Head>
            <span className="sr-only">{HEADER_ACTIONS}</span>
          </Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map((row) => (
          <Table.Row
            className={cn(ROW_HEIGHT, row.justChanged && 'duration-340')}
            isFlash={row.justChanged}
            key={row.id}
            selected={row.id === selectedUserId}
          >
            <Table.Cell className={ROW_HEIGHT}>
              <div className="flex items-center gap-3">
                <Avatar alt={row.name} initials={initialsOf(row.name, row.email)} size="default" {...avatarSrcProp(row.avatarUrl)} />
                <button
                  className={cn('truncate text-left font-medium text-text-primary', FOCUS_RING)}
                  onClick={() => actions.onSelectUser(row.id)}
                  type="button"
                >
                  {row.name}
                </button>
              </div>
            </Table.Cell>
            <Table.Cell className={cn(ROW_HEIGHT, 'text-text-secondary')}>{row.email}</Table.Cell>
            <Table.Cell className={ROW_HEIGHT}>
              <RoleCell actions={actions} roleOptions={roleOptions} row={row} />
            </Table.Cell>
            <Table.Cell className={cn(ROW_HEIGHT, 'font-mono tabular-nums')}>{row.projectCountLabel}</Table.Cell>
            <Table.Cell className={ROW_HEIGHT}>
              <Tooltip label={row.lastActiveExactLabel}>
                <span>{row.lastActiveLabel}</span>
              </Tooltip>
            </Table.Cell>
            <Table.Cell className={ROW_HEIGHT}>
              <StatusCell actions={actions} row={row} />
            </Table.Cell>
            <Table.Cell className={ROW_HEIGHT}>
              <RowActions actions={actions} row={row} />
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}
