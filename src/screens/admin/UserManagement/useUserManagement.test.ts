/**
 * FIX-098/NO-099 — nhãn tiếng Việt của `ACTIVITY_KIND_LABELS` phải phủ đủ 27 `kind` mà
 * `ActivityKind` (`apps/api/access/kinds.py:21-47`) phát ra, không chỉ 11 mã cũ và phần lớn
 * không khớp mã BE nào (`'wall.edit'`, `'room.edit'`…).
 *
 * Danh sách 27 mã dưới đây CHÉP TĨNH từ `apps/api/access/kinds.py:21-47` (R-35: không đối
 * chiếu bằng cách nhập chính file Python, vì đây là bài kiểm TypeScript và mã Python không
 * nạp được ở đây) — đúng khuôn "kind chép tĩnh vào test kèm nguồn kinds.py:<dòng>" của T5.
 */
import { describe, expect, it } from 'vitest';

import { hasDiacritics } from '@/lib/testing/expectVietnamese';

import { ACTIVITY_KIND_LABELS } from './useUserManagement';

/** `apps/api/access/kinds.py:21-47`, đúng thứ tự khai báo. */
const BE_ACTIVITY_KINDS: readonly string[] = [
  'floor.upload',
  'floor.upload_complete',
  'floor.create',
  'floor.delete',
  'floor.edit',
  'floor.reorder',
  'project.create',
  'project.update',
  'project.delete',
  'project.settings_update',
  'member.add',
  'member.remove',
  'version.restore',
  'version.label',
  'rules.config_update',
  'user.role_change',
  'user.disable',
  'user.enable',
  'user.delete',
  'user.invite',
  'user.invite_resend',
  'model.activate',
  'model.upload',
  'dataset.create',
  'dataset.build',
  'training.create',
  'training.cancel',
];

describe('ACTIVITY_KIND_LABELS — FIX-098/NO-099', () => {
  it('đủ đúng 27 kind của kinds.py, không thiếu không thừa', () => {
    expect(BE_ACTIVITY_KINDS).toHaveLength(27);
    expect(Object.keys(ACTIVITY_KIND_LABELS).sort()).toEqual([...BE_ACTIVITY_KINDS].sort());
  });

  it.each(BE_ACTIVITY_KINDS)('mã "%s" có nhãn', (kind) => {
    expect(ACTIVITY_KIND_LABELS[kind]).toBeDefined();
  });

  it('mọi nhãn là tiếng Việt có dấu, viết thường kiểu câu (A6)', () => {
    Object.values(ACTIVITY_KIND_LABELS).forEach((label) => {
      expect(hasDiacritics(label)).toBe(true);
      expect(label).toBe(label.toLowerCase());
    });
  });

  it('mã BE cũ không có trong hợp đồng bị gỡ khỏi bảng (không còn "wall.edit")', () => {
    expect(ACTIVITY_KIND_LABELS['wall.edit']).toBeUndefined();
  });
});
