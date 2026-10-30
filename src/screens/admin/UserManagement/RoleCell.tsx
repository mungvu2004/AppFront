import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type { ProjectRole } from '@/types/project';

import type { RoleOption, UserManagementActions, UserRowModel } from './types';

const ROLE_DISABLED_REASON = 'Bật lại tài khoản để đổi vai';
const CONFIRM_ROLE_LABEL = 'Đổi vai';
const CANCEL_ROLE_LABEL = 'Huỷ';
const roleSelectLabel = (name: string): string => `Vai của ${name}`;

interface RoleCellProps {
  readonly actions: UserManagementActions;
  readonly roleOptions: readonly RoleOption[];
  readonly row: UserRowModel;
}

/**
 * U50: chọn vai trong ô chưa đổi ngay — hiện "Đổi vai"/"Huỷ" để xác nhận, tránh lướt chuột đổi nhầm.
 * Hook vẫn đổi lạc quan + toast hoàn tác sau khi xác nhận.
 */
export function RoleCell({ actions, roleOptions, row }: RoleCellProps) {
  const [pendingRole, setPendingRole] = useState<ProjectRole | null>(null);

  if (row.isSelf && row.roleChangeBlockedReason !== null) {
    const own = roleOptions.find((option) => option.role === row.role);
    return <span className="text-[13px] text-text-primary">{own?.label ?? row.role}</span>;
  }
  if (row.roleChangeBlockedReason !== null) {
    return <span className="text-[13px] text-text-secondary">{row.roleChangeBlockedReason}</span>;
  }

  const options = roleOptions.map((option) => ({ label: option.label, value: option.role as string }));

  const isDisabled = row.status === 'disabled';
  const pendingLabel = roleOptions.find((option) => option.role === pendingRole)?.label ?? pendingRole;

  return (
    <div className="flex flex-col gap-1">
      <Select.Root
        className="w-[140px]"
        disabled={isDisabled}
        onChange={(value) => setPendingRole(value === row.role ? null : (value as ProjectRole))}
        options={options}
        value={pendingRole ?? row.role}
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
      {isDisabled && <p className="text-[12px] text-text-secondary">{ROLE_DISABLED_REASON}</p>}
      {pendingRole !== null && (
        <div className="flex items-center gap-1">
          <Button
            aria-label={`${CONFIRM_ROLE_LABEL} của ${row.name} thành ${pendingLabel ?? ''}`}
            onClick={() => {
              setPendingRole(null);
              actions.onChangeRole(row.id, pendingRole);
            }}
            size="sm"
          >
            {CONFIRM_ROLE_LABEL}
          </Button>
          <Button
            aria-label={`${CANCEL_ROLE_LABEL} đổi vai của ${row.name}`}
            onClick={() => setPendingRole(null)}
            size="sm"
            variant="ghost"
          >
            {CANCEL_ROLE_LABEL}
          </Button>
        </div>
      )}
    </div>
  );
}
