/**
 * Một xung đột THẬT, đi hết chặng: `resolveConflict` → `FieldConflict` → `ConflictVm`.
 *
 * `CollaborationLayer.test.tsx` dựng `ConflictVm` bằng tay để soát phần nhìn. Điều đó
 * đúng cho một view thuần, nhưng nó bỏ trống đúng khúc mà cả màn này chỉ có MỘT thứ
 * chạy thật: D-09. Nếu `toConflictVm` đọc nhầm phía — lấy tác giả của họ gán cho mình,
 * hay để một bên rỗng — thì mọi khẳng định của bài kia vẫn xanh, vì bài kia không bao
 * giờ gọi tới nó.
 *
 * Nên bài này không dựng sẵn `FieldConflict`. Nó dựng hai thay đổi trên **cùng một
 * trường** rồi để `resolveConflict` thật phán quyết, đúng như lúc máy chủ trả 409.
 */

import { describe, expect, it } from 'vitest';

import { resolveConflict } from '@/lib/versioning/conflict';
import type { ResolveConflictInput } from '@/lib/versioning/conflict';
import type { SessionSnapshot } from '@/lib/auth/types';

import { createCollaborationGateway } from './collaborationGateway';

/** 2026-09-09T10:00:00Z — mốc "bây giờ" cố định, để chuỗi không đổi theo máy chạy. */
const NOW_MS = Date.parse('2026-09-09T10:00:00.000Z');

const SESSION: SessionSnapshot = {
  status: 'authenticated',
  user: { id: 'user-toi', name: 'Vũ Mừng' },
} as SessionSnapshot;

/** Hai người sửa cùng `thickness` của cùng bức tường — ca mà D-09 cấm tự gộp. */
const INPUT: ResolveConflictInput = {
  baseVersion: 4,
  localChanges: [{ entityId: 'wall-014', entityType: 'wall', field: 'thickness', value: 220 }],
  remoteChanges: [
    {
      entityId: 'wall-014',
      entityType: 'wall',
      field: 'thickness',
      value: 100,
      changedAt: '2026-09-09T09:30:00.000Z',
      changedBy: 'user-nguyen',
    },
  ],
  serverVersion: 5,
};

describe('xung đột thật đi hết chặng tới panel', () => {
  it('resolveConflict thật xếp ca này vào loại phải để người quyết', () => {
    const resolution = resolveConflict(INPUT);

    expect(resolution.level).toBe('requiresUserChoice');
    expect(resolution.conflictingFields).toHaveLength(1);
    // Chưa ai chọn thì phiên bản KHÔNG được nhích lên — đó là "không ghi đè im lặng".
    expect(resolution.nextBaseVersion).toBe(INPUT.baseVersion);
  });

  it('dựng đủ CẢ HAI giá trị và CẢ HAI tác giả, không bên nào rỗng', () => {
    const conflict = resolveConflict(INPUT).conflictingFields[0];
    // Ném thay vì `expect(...).toBeDefined()`: khẳng định của vitest không thu hẹp
    // kiểu, nên `conflict` vẫn là `FieldConflict | undefined` với trình biên dịch.
    if (!conflict) {
      throw new Error('resolveConflict phải trả về đúng một xung đột cho ca này');
    }

    const gateway = createCollaborationGateway({
      members: [{ id: 'user-nguyen', name: 'Nguyên' }],
      now: () => NOW_MS,
      readSession: () => SESSION,
    });

    const vm = gateway.toConflictVm(conflict, '2026-09-09T09:45:00.000Z');

    // Phía mình: giá trị của mình, tên của mình — KHÔNG phải tên người kia.
    expect(vm.mine.valueLabel).toContain('220');
    expect(vm.mine.authorName).toBe('Vũ Mừng');

    // Phía họ: giá trị của họ, tên tra được từ `changedBy`.
    expect(vm.theirs.valueLabel).toContain('100');
    expect(vm.theirs.authorName).toBe('Nguyên');

    // Hai phía không được lẫn vào nhau.
    expect(vm.mine.authorName).not.toBe(vm.theirs.authorName);
    expect(vm.mine.valueLabel).not.toBe(vm.theirs.valueLabel);

    // Cả hai mốc thời gian đều phải nói được thành câu, không bên nào bỏ trống.
    expect(vm.mine.atLabel.length).toBeGreaterThan(0);
    expect(vm.theirs.atLabel.length).toBeGreaterThan(0);
    expect(vm.theirs.atLabel).not.toBe('—');
  });
});
