import { describe, expect, it } from 'vitest';

import { AUTH_ROLES } from '@/lib/auth/permissions';

import {
  parseTelemetryEvent,
  TELEMETRY_EVENT_NAMES,
  TELEMETRY_EVENT_SCHEMA,
  type TelemetryEventInput,
  type UserRoleChangeEvent,
} from '../events';

/**
 * O-01 — `user.role-change`.
 *
 * Bài kiểm này canh đúng một thứ ngoài hình dạng: sự kiện KHÔNG mang danh tính.
 * Docblock đầu `../events.ts` nói không id người dùng, không nhãn, không thông
 * báo lỗi; đây là chỗ câu ấy được ép chạy.
 */
const validEvent: TelemetryEventInput = {
  name: 'user.role-change',
  fromRole: 'viewer',
  toRole: 'engineer',
  outcome: 'success',
  undo: false,
  durationMs: 240,
};

describe('user.role-change', () => {
  it('có mặt trong danh mục, đúng một lần', () => {
    expect(TELEMETRY_EVENT_NAMES).toContain('user.role-change');
    expect(TELEMETRY_EVENT_NAMES.filter((name) => name === 'user.role-change')).toHaveLength(1);
    expect(new Set(TELEMETRY_EVENT_NAMES).size).toBe(TELEMETRY_EVENT_NAMES.length);
  });

  it('nhận một lượt đổi vai thành công', () => {
    const parsed = TELEMETRY_EVENT_SCHEMA.parse(validEvent) as UserRoleChangeEvent;

    expect(parsed).toEqual({
      name: 'user.role-change',
      fromRole: 'viewer',
      toRole: 'engineer',
      outcome: 'success',
      undo: false,
      durationMs: 240,
    });
  });

  it('nhận cả chín cặp vai, vì thăng và giáng đều là chuyện có thật', () => {
    AUTH_ROLES.forEach((fromRole) => {
      AUTH_ROLES.forEach((toRole) => {
        expect(TELEMETRY_EVENT_SCHEMA.safeParse({ ...validEvent, fromRole, toRole }).success).toBe(true);
      });
    });
  });

  it('từ chối một vai không có trong bộ quyền', () => {
    expect(TELEMETRY_EVENT_SCHEMA.safeParse({ ...validEvent, toRole: 'architect' }).success).toBe(false);
    expect(TELEMETRY_EVENT_SCHEMA.safeParse({ ...validEvent, fromRole: 'qc' }).success).toBe(false);
  });

  it('mang cờ undo, để một lượt thăng bị hoàn tác ngay không lẫn với hai lượt cố ý', () => {
    const undone = TELEMETRY_EVENT_SCHEMA.parse({ ...validEvent, undo: true }) as UserRoleChangeEvent;

    expect(undone.undo).toBe(true);
    expect(TELEMETRY_EVENT_SCHEMA.safeParse({ ...validEvent, undo: 'yes' }).success).toBe(false);
  });

  it('làm tròn durationMs về số nguyên, như mọi khoảng thời gian khác', () => {
    const parsed = TELEMETRY_EVENT_SCHEMA.parse({ ...validEvent, durationMs: 240.6 }) as UserRoleChangeEvent;

    expect(parsed.durationMs).toBe(241);
  });

  it('nhận errorKind khi lượt đổi hỏng, và chỉ nhận mã trong taxonomy', () => {
    const failed = TELEMETRY_EVENT_SCHEMA.parse({
      ...validEvent,
      outcome: 'failure',
      errorKind: 'forbidden',
    }) as UserRoleChangeEvent;

    expect(failed.outcome).toBe('failure');
    expect(failed.errorKind).toBe('forbidden');
    expect(
      TELEMETRY_EVENT_SCHEMA.safeParse({ ...validEvent, errorKind: 'khong-co-loai-nay' }).success,
    ).toBe(false);
  });

  it('KHÔNG mang danh tính: id, địa chỉ và tên bị loại, không được chuyển tiếp', () => {
    const parsed = parseTelemetryEvent({
      ...validEvent,
      userId: 'user-3',
      email: 'viewer@example.com',
      name: 'user.role-change',
      actorName: 'Trần Chi',
    });

    expect(parsed).not.toBeNull();
    expect(parsed === null ? [] : Object.keys(parsed)).toEqual(
      expect.not.arrayContaining(['userId', 'email', 'actorName']),
    );
    expect(JSON.stringify(parsed)).not.toContain('viewer@example.com');
    expect(JSON.stringify(parsed)).not.toContain('Trần Chi');
  });

  it('từ chối một sự kiện thiếu trường bắt buộc', () => {
    const withoutUndo: Record<string, unknown> = { ...validEvent };
    delete withoutUndo.undo;

    const withoutOutcome: Record<string, unknown> = { ...validEvent };
    delete withoutOutcome.outcome;

    expect(TELEMETRY_EVENT_SCHEMA.safeParse(withoutUndo).success).toBe(false);
    expect(TELEMETRY_EVENT_SCHEMA.safeParse(withoutOutcome).success).toBe(false);
  });

  it('parseTelemetryEvent trả null cho một tên không có trong danh mục', () => {
    expect(parseTelemetryEvent({ ...validEvent, name: 'user.role-changed' })).toBeNull();
  });
});
