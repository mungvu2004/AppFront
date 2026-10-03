import { describe, expect, it } from 'vitest';

import type { HttpError } from '@/lib/http';

import { isProjectNotFound } from './useProjectSpatial';

const http = (status: number, resource?: string): HttpError => ({
  kind: 'http',
  raw: resource === undefined ? undefined : { resource },
  requestId: 'req-test',
  retryable: false,
  status,
});

describe('isProjectNotFound', () => {
  it('chỉ đúng với 404 của tài nguyên `project`', () => {
    expect(isProjectNotFound(http(404, 'project'))).toBe(true);
    expect(isProjectNotFound(http(404, 'floor'))).toBe(false);
    expect(isProjectNotFound(http(404))).toBe(false);
    expect(isProjectNotFound(http(500, 'project'))).toBe(false);
    expect(isProjectNotFound(new Error('missing'))).toBe(false);
  });
});
