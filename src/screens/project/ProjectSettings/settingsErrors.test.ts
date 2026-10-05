import { describe, expect, it } from 'vitest';

import type { ApiError } from '@/api/client';
import viMessages from '@/i18n/vi.json';
import { toAppError } from '@/lib/errors';

import {
  describeSaveFailure,
  isTransientSettingsError,
  partialSaveSentence,
  problemKeyOfError,
  readSettingsError,
  rejectionOf,
  SETTINGS_SENTENCES,
} from './settingsErrors';
import { httpError, networkError, timeoutError, versionConflict } from './settingsTestKit';

const settings = viMessages.project.settings;

describe('readSettingsError', () => {
  it('đọc status, mã, ô và tài nguyên từ HttpError', () => {
    const info = readSettingsError(httpError(422, 'VALIDATION', { field: 'body.notes', resource: 'project' }));

    expect(info).toMatchObject({ status: 422, code: 'VALIDATION', field: 'body.notes', resource: 'project' });
  });

  it('đọc Retry-After', () => {
    expect(readSettingsError(httpError(429, 'RATE_LIMITED', {}, { retryAfterSeconds: 7 })).retryAfterSeconds).toBe(7);
  });

  it('AppError: suy status từ kind, đọc ô và tài nguyên từ params', () => {
    const appError: ApiError = {
      kind: 'validation',
      code: 'VALIDATION',
      messageKey: 'errors.validation.description',
      params: { field: 'email', resource: 'member' },
      requestId: 'req-x',
      retryable: false,
      severity: 'lỗi',
      recovery: 'không',
    };

    expect(readSettingsError(appError)).toMatchObject({ status: 422, field: 'email', resource: 'member' });
    expect(readSettingsError({ ...appError, kind: 'conflict', params: {} }).status).toBe(409);
    expect(readSettingsError({ ...appError, kind: 'unknown', params: {} }).status).toBeUndefined();
  });
});

describe('phân loại', () => {
  it('rejectionOf: 409, 422, 428 là lời từ chối; mạng và 403 thì không', () => {
    expect(rejectionOf(versionConflict())).toBe('conflict');
    expect(rejectionOf(httpError(422, 'VALIDATION'))).toBe('validation');
    expect(rejectionOf(httpError(428, 'PRECONDITION_REQUIRED'))).toBe('precondition');
    expect(rejectionOf(httpError(403, 'FORBIDDEN'))).toBeNull();
    expect(rejectionOf(networkError())).toBeNull();
  });

  it('isTransientSettingsError: mạng và timeout là tạm, 409 và 422 là vĩnh viễn', () => {
    expect(isTransientSettingsError(networkError())).toBe(true);
    expect(isTransientSettingsError(timeoutError())).toBe(true);
    expect(isTransientSettingsError(versionConflict())).toBe(false);
    expect(isTransientSettingsError(httpError(422, 'VALIDATION'))).toBe(false);
  });

  it('problemKeyOfError: ô của #26 và N6, trường không có ô riêng thì null', () => {
    const keyOf = (field: string) => problemKeyOfError(httpError(422, 'VALIDATION', { field }));

    expect(keyOf('name')).toBe('name');
    expect(keyOf('body.defaultScaleMmPerPx')).toBe('scaleMmPerPx');
    expect(keyOf('body.snapToleranceMm')).toBe('snapToleranceMm');
    expect(keyOf('body.lengthUnit')).toBeNull();
    expect(problemKeyOfError(httpError(422, 'VALIDATION'))).toBeNull();
  });
});

describe('câu chữ', () => {
  it('khớp từ điển vi.json', () => {
    expect(SETTINGS_SENTENCES.conflict).toBe(settings.load.conflictMessage);
    expect(SETTINGS_SENTENCES.fieldRejected).toBe(settings.load.fieldRejected);
    expect(SETTINGS_SENTENCES.emptyBlocked).toBe(settings.problems.emptyBlocked);
    expect(SETTINGS_SENTENCES.snapNotInteger).toBe(settings.problems.snapNotInteger);
  });

  it('partialSaveSentence: nói phần nào đã lưu, phần nào chưa', () => {
    expect(partialSaveSentence(['general'], ['units'])).toBe('Đã lưu thông tin chung, chưa lưu đơn vị đo.');
    expect(partialSaveSentence(['units'], ['general'])).toBe('Đã lưu đơn vị đo, chưa lưu thông tin chung.');
    expect(partialSaveSentence([], ['units'])).toBe('Chưa lưu được đơn vị đo.');
    expect(partialSaveSentence([], ['general', 'units'])).toBe('Chưa lưu được thông tin chung và đơn vị đo.');
  });

  it('describeSaveFailure dùng câu dự phòng chung, không in mã lạ', () => {
    const text = describeSaveFailure(httpError(418, 'TEAPOT_BREWING'));

    expect(text).toBe(describeSaveFailure(toAppError(httpError(418, 'TEAPOT_BREWING'))));
    expect(text).not.toContain('TEAPOT');
  });
});
