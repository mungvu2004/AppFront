/**
 * Cổng cấu hình bộ luật (F-10): N21/N22 qua `ApiClient`, ném nguyên `HttpError`,
 * gửi lại thân đã mất câu trả lời, và câu của từng mã lỗi.
 *
 * Thân phản hồi giả là dữ liệu DÂY (literal); `ProjectRuleConfigSchema.parse`
 * chỉ để khẳng định thân hợp lệ.
 */

import { describe, expect, it, vi } from 'vitest';

import { createMockApiClient } from '@/api/__mocks__/client';
import type { ApiClient } from '@/api/client';
import { ProjectRuleConfigSchema, type ProjectRuleConfig } from '@/api/schemas/ruleConfig';
import type { RuleConfig } from '@/domain/rules/config';
import type { HttpError } from '@/lib/http';

import { createRuleSettingsGateway, describeRuleConfigSaveError } from './ruleSettingsGateway';

const wire = (revision: number, overrides: ProjectRuleConfig['overrides'] = {}): ProjectRuleConfig => ({
  overrides,
  revision,
});

const httpError = (status: number, code: string, raw: Record<string, unknown> = {}): HttpError => ({
  code,
  kind: 'http',
  raw,
  requestId: 'req-test',
  retryable: false,
  status,
});

const lostError = (kind: 'network' | 'timeout'): HttpError => ({
  kind,
  raw: null,
  requestId: 'req-lost',
  retryable: true,
});

type RuleConfigApi = ApiClient['ruleConfig'];

/** Bộ mẫu trong bộ nhớ, nhóm `ruleConfig` thay bằng bản giả của bài. */
const clientWith = (ruleConfig: Partial<RuleConfigApi>): ApiClient => {
  const base = createMockApiClient();

  return { ...base, ruleConfig: { ...base.ruleConfig, ...ruleConfig } };
};

const configOf = (overrides: RuleConfig['overrides']): RuleConfig => ({ overrides, version: 9 });

describe('read (N21)', () => {
  it('trả đúng revision và cấu hình', async () => {
    const body = wire(4, { 'WALL-THICKNESS': { enabled: false } });
    expect(ProjectRuleConfigSchema.parse(body)).toEqual(body);
    const read = vi.fn<RuleConfigApi['read']>().mockResolvedValue({ ok: true, data: body });
    const gateway = createRuleSettingsGateway({ client: clientWith({ read }) });

    const loaded = await gateway.read({ projectId: 'P-1' });

    expect(read).toHaveBeenCalledWith({ projectId: 'P-1' });
    expect(loaded.revision).toBe(4);
    expect(loaded.config.overrides).toEqual({ 'WALL-THICKNESS': { enabled: false } });
    expect(gateway.lastRevision('P-1')).toBe(4);
    expect(gateway.lastRevision('P-2')).toBeUndefined();
  });

  it('lỗi ném CHÍNH object HttpError', async () => {
    const error = httpError(403, 'FORBIDDEN');
    const gateway = createRuleSettingsGateway({
      client: clientWith({ read: vi.fn().mockResolvedValue({ ok: false, error }) }),
    });

    await expect(gateway.read({ projectId: 'P-1' })).rejects.toBe(error);
  });
});

describe('update (N22)', () => {
  it('gửi baseVersion, bỏ override rỗng và thresholds rỗng', async () => {
    const replace = vi.fn<RuleConfigApi['replace']>().mockResolvedValue({ ok: true, data: wire(5) });
    const gateway = createRuleSettingsGateway({ client: clientWith({ replace }) });

    const saved = await gateway.update({
      projectId: 'P-1',
      baseVersion: 4,
      config: configOf({
        'WALL-THICKNESS': { enabled: false, thresholds: {} },
        'DOOR-WIDTH': {},
        GENERAL: { thresholds: { 'general.jointToleranceMm': 25 } },
      }),
    });

    expect(replace).toHaveBeenCalledWith({
      projectId: 'P-1',
      baseVersion: 4,
      body: {
        overrides: {
          'WALL-THICKNESS': { enabled: false },
          GENERAL: { thresholds: { 'general.jointToleranceMm': 25 } },
        },
      },
    });
    expect(saved.revision).toBe(5);
    expect(gateway.lastRevision('P-1')).toBe(5);
  });

  it('lỗi ném CHÍNH object HttpError', async () => {
    const error = httpError(409, 'VERSION_CONFLICT', { remoteChanges: [] });
    const gateway = createRuleSettingsGateway({
      client: clientWith({ replace: vi.fn().mockResolvedValue({ ok: false, error }) }),
    });

    await expect(gateway.update({ projectId: 'P-1', baseVersion: 0, config: configOf({}) })).rejects.toBe(error);
  });

  it('timeout rồi sửa tiếp: gửi lại thân cũ trước, rồi thân mới trên revision vừa nhận', async () => {
    const replace = vi
      .fn<RuleConfigApi['replace']>()
      .mockResolvedValueOnce({ ok: false, error: lostError('timeout') })
      .mockResolvedValueOnce({ ok: true, data: wire(3) })
      .mockResolvedValueOnce({ ok: true, data: wire(4) });
    const gateway = createRuleSettingsGateway({ client: clientWith({ replace }) });
    const first = configOf({ 'WALL-THICKNESS': { enabled: false } });
    const second = configOf({ 'WALL-THICKNESS': { enabled: true } });

    await expect(gateway.update({ projectId: 'P-1', baseVersion: 2, config: first })).rejects.toMatchObject({
      kind: 'timeout',
    });
    const saved = await gateway.update({ projectId: 'P-1', baseVersion: 2, config: second });

    expect(replace.mock.calls.map(([input]) => [input.baseVersion, input.body])).toEqual([
      [2, { overrides: { 'WALL-THICKNESS': { enabled: false } } }],
      [2, { overrides: { 'WALL-THICKNESS': { enabled: false } } }],
      [3, { overrides: { 'WALL-THICKNESS': { enabled: true } } }],
    ]);
    expect(saved.revision).toBe(4);
  });

  it('thân giữ trùng thân mới: chỉ một lượt gửi lại', async () => {
    const replace = vi
      .fn<RuleConfigApi['replace']>()
      .mockResolvedValueOnce({ ok: false, error: lostError('network') })
      .mockResolvedValueOnce({ ok: true, data: wire(3) });
    const gateway = createRuleSettingsGateway({ client: clientWith({ replace }) });
    const config = configOf({ 'WALL-THICKNESS': { enabled: false } });

    await expect(gateway.update({ projectId: 'P-1', baseVersion: 2, config })).rejects.toMatchObject({
      kind: 'network',
    });
    const saved = await gateway.update({ projectId: 'P-1', baseVersion: 2, config });

    expect(replace).toHaveBeenCalledTimes(2);
    expect(saved.revision).toBe(3);
  });

  it('lỗi vĩnh viễn không giữ thân: lượt sau gửi thẳng thân mới', async () => {
    const replace = vi
      .fn<RuleConfigApi['replace']>()
      .mockResolvedValueOnce({ ok: false, error: httpError(422, 'VALIDATION') })
      .mockResolvedValueOnce({ ok: true, data: wire(1) });
    const gateway = createRuleSettingsGateway({ client: clientWith({ replace }) });

    await expect(
      gateway.update({ projectId: 'P-1', baseVersion: 0, config: configOf({ 'WALL-THICKNESS': { enabled: false } }) }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    await gateway.update({ projectId: 'P-1', baseVersion: 0, config: configOf({}) });

    expect(replace).toHaveBeenCalledTimes(2);
    expect(replace.mock.calls[1]?.[0].body).toEqual({ overrides: {} });
  });
});

describe('readCapabilities', () => {
  it('chỉ đọc kèm câu nói rõ chỉ quản trị viên đổi được', () => {
    const gateway = createRuleSettingsGateway({ client: clientWith({}) });

    expect(gateway.readCapabilities(false).readOnlyReason).toMatch(/^Chỉ quản trị viên/u);
    expect(gateway.readCapabilities(true).readOnlyReason).toBeNull();
  });
});

describe('describeRuleConfigSaveError — một câu riêng cho mỗi mã', () => {
  it.each([
    ['VERSION_CONFLICT', 409, /Tải lại/u],
    ['RULE_CODE_UNKNOWN', 422, /không nhận ra một luật/u],
    ['RULE_THRESHOLD_UNKNOWN', 422, /không nhận ra một ngưỡng/u],
    ['RULE_THRESHOLD_OUT_OF_RANGE', 422, /ngoài khoảng/u],
    ['RULE_GENERAL_NOT_TOGGLEABLE', 422, /Ngưỡng chung/u],
    ['VALIDATION', 422, /không hợp lệ/u],
    ['FORBIDDEN', 403, /vai của bạn không còn quyền đổi bộ luật/iu],
  ])('%s', (code, status, sentence) => {
    const problem = describeRuleConfigSaveError(httpError(status, code));

    expect(problem.message).toMatch(sentence);
    expect(problem.message).not.toContain(code);
    expect(problem.offerReload).toBe(code === 'VERSION_CONFLICT');
  });

  it('field ở body.overrides.GENERAL gắn câu vào thẻ ngưỡng chung', () => {
    expect(
      describeRuleConfigSaveError(
        httpError(422, 'RULE_GENERAL_NOT_TOGGLEABLE', { field: 'body.overrides.GENERAL.severity' }),
      ).onGeneralCard,
    ).toBe(true);
    expect(
      describeRuleConfigSaveError(httpError(422, 'RULE_THRESHOLD_OUT_OF_RANGE', { field: 'body.overrides' }))
        .onGeneralCard,
    ).toBe(false);
  });

  it.each([
    ['428', httpError(428, 'PRECONDITION_REQUIRED')],
    ['404 project', httpError(404, 'NOT_FOUND', { resource: 'project' })],
    ['mã lạ', httpError(400, 'SOMETHING_NEW')],
  ])('%s → câu dự phòng không chứa mã', (_label, error) => {
    const problem = describeRuleConfigSaveError(error);

    expect(problem.message).toBe('Chưa lưu được bộ luật của dự án này.');
    expect(problem.message).not.toContain(error.code ?? '');
    expect(problem.offerReload).toBe(false);
  });

  it('mất kết nối → câu riêng, không hứa tự thử lại (tự lưu có thể đã dừng)', () => {
    expect(describeRuleConfigSaveError(lostError('network')).message).toBe('Mất kết nối nên bộ luật chưa được lưu.');
  });
});
