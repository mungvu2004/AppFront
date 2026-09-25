import { describe, expect, it } from 'vitest';

import { USER_MANAGEMENT_TEXT, activityKindLabel } from './useUserManagement';

const KINDS = [
  'floor.upload', 'floor.upload_complete', 'floor.create', 'floor.delete', 'floor.edit', 'floor.reorder',
  'project.create', 'project.update', 'project.delete', 'project.settings_update',
  'member.add', 'member.remove', 'version.restore', 'version.label', 'rules.config_update',
  'user.role_change', 'user.disable', 'user.enable', 'user.delete', 'user.invite', 'user.invite_resend',
  'model.activate', 'model.upload', 'dataset.create', 'dataset.build', 'training.create', 'training.cancel',
];

describe('activityKindLabel', () => {
  it('có đủ 27 mã', () => {
    expect(new Set(KINDS).size).toBe(27);
  });
  it.each(KINDS)('%s có nhãn riêng, không trùng mã', (kind) => {
    const label = activityKindLabel(kind);
    expect(label).not.toBe(USER_MANAGEMENT_TEXT.activityFallback);
    expect(label).not.toBe(kind);
  });
  it('mã lạ → dự phòng', () => {
    expect(activityKindLabel('wall.edit')).toBe(USER_MANAGEMENT_TEXT.activityFallback);
  });
});
