/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';

import type { HttpError } from '@/lib/http/types';
import { ROUTES } from '@/routes/paths';

import { BACK_TO_FLOORS_LABEL, floorLayerReadFailureOf, RETRY_READ_LABEL } from './floorLayerReadFailure';

const wire = (status: number, code: string, resource?: string): HttpError => ({
  code,
  kind: 'http',
  raw: { code, ...(resource === undefined ? {} : { resource }) },
  requestId: 'r',
  retryable: status >= 500,
  status,
});

describe('floorLayerReadFailureOf (BUG-326)', () => {
  it('không lỗi, hoặc đã có tài liệu, thì không thay màn', () => {
    const refetch = vi.fn();

    expect(floorLayerReadFailureOf({ data: undefined, error: null, refetch }, 'p1', vi.fn())).toBeNull();
    expect(floorLayerReadFailureOf({ data: {}, error: wire(500, 'INTERNAL'), refetch }, 'p1', vi.fn())).toBeNull();
  });

  it('404 tầng → một lối về Quản lý tầng', () => {
    const onNavigate = vi.fn();
    const failure = floorLayerReadFailureOf(
      { data: undefined, error: wire(404, 'NOT_FOUND', 'floor'), refetch: vi.fn() },
      'p1',
      onNavigate,
    );

    expect(failure?.actionLabel).toBe(BACK_TO_FLOORS_LABEL);
    failure?.onAction();
    expect(onNavigate).toHaveBeenCalledWith(ROUTES.project.floors('p1'));
  });

  it('404 dự án → về danh sách dự án', () => {
    const onNavigate = vi.fn();
    const failure = floorLayerReadFailureOf(
      { data: undefined, error: wire(404, 'NOT_FOUND', 'project'), refetch: vi.fn() },
      'p1',
      onNavigate,
    );

    failure?.onAction();
    expect(onNavigate).toHaveBeenCalledWith(ROUTES.dashboard);
  });

  it('500 → "Thử lại" đọc lại, không điều hướng', () => {
    const refetch = vi.fn();
    const onNavigate = vi.fn();
    const failure = floorLayerReadFailureOf({ data: undefined, error: wire(500, 'INTERNAL'), refetch }, 'p1', onNavigate);

    expect(failure?.actionLabel).toBe(RETRY_READ_LABEL);
    failure?.onAction();
    expect(refetch).toHaveBeenCalledOnce();
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
