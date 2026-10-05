/**
 * Client registry model (N23, N24, N25, N27) — F-11.
 *
 * Thân phản hồi giả là **dữ liệu dây** viết literal; `.parse` của schema F-00b chỉ để
 * khẳng định chính thân giả ấy hợp lệ (R12), không dùng để dựng nó.
 */

import { describe, expect, it, vi } from 'vitest';

import type { HttpClient, HttpError, HttpRequestOptions, Result } from '@/lib/http';

import { createAdminMlClient, createAppAdminMlClient } from '../adminMlClient';
import type { ApiResult } from '../client';
import { ENDPOINTS } from '../endpoints';
import {
  ModelFamilyPageSchema,
  ModelFamilySchema,
  ModelVersionPageSchema,
  ModelVersionSchema,
  SetActiveModelVersionSchema,
} from '../schemas/adminMl';
import { MOCK_MODEL_FAMILIES, MOCK_MODEL_VERSION_IDS, MOCK_MODEL_VERSIONS } from '../__mocks__/adminMlClient';

const WALL_VERSION_ID = 'mdl_01JA6M0RG00000000000000W01';

const WIRE_WALL_VERSION = {
  checksumSha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  createdAt: '2026-09-01T08:00:00.000Z',
  creatorId: 'usr_01JA6M0RG00000000000000A01',
  datasetVersionId: 'dsv_01JA6M0RG00000000000000S01',
  evaluationStatus: 'completed',
  family: 'wallSegmentation',
  id: WALL_VERSION_ID,
  label: 'Huấn luyện lượt 1',
  metrics: { iou: 0.812 },
  trainingJobId: 'job_01JA6M0RG00000000000000J01',
  weightsFormat: 'onnx',
};

const WIRE_FAMILY_PAGE = {
  items: [
    { activeVersionId: WALL_VERSION_ID, family: 'wallSegmentation', revision: 4 },
    { family: 'openingAndFurnitureDetection', revision: 0 },
    { family: 'dimensionReading', revision: 2 },
  ],
};

const WIRE_VERSION_PAGE = {
  items: [WIRE_WALL_VERSION],
  nextCursor: 'trang-2',
};

const WIRE_FAMILY_AFTER_REVERT = { family: 'wallSegmentation', revision: 5 };

interface HttpCall {
  readonly method: string;
  readonly path: string;
  readonly options: HttpRequestOptions<unknown> | undefined;
}

const httpError: HttpError = {
  code: 'VERSION_CONFLICT',
  kind: 'http',
  raw: { code: 'VERSION_CONFLICT', remoteChanges: [] },
  requestId: 'req-admin-ml-1',
  retryable: false,
  status: 409,
};

/** `HttpClient` giả ghi lại từng lượt gọi; `reply` quyết định thân trả về. */
function createHttpMock(reply: (call: HttpCall) => Result<unknown, HttpError>): {
  calls: HttpCall[];
  http: HttpClient;
} {
  const calls: HttpCall[] = [];
  const send =
    (method: string) =>
    async <T>(path: string, options?: HttpRequestOptions<unknown>): Promise<Result<T, HttpError>> => {
      const call = { method, options, path };
      calls.push(call);

      return reply(call) as Result<T, HttpError>;
    };

  const http: HttpClient = {
    delete: send('DELETE'),
    events: { emit: () => undefined, on: () => () => undefined },
    get: send('GET'),
    getRecentRequests: () => [],
    patch: send('PATCH'),
    post: send('POST'),
    put: send('PUT'),
  };

  return { calls, http };
}

describe('thân giả là dữ liệu dây hợp lệ (R12)', () => {
  it('khớp schema F-00b', () => {
    expect(() => ModelFamilyPageSchema.parse(WIRE_FAMILY_PAGE)).not.toThrow();
    expect(() => ModelVersionPageSchema.parse(WIRE_VERSION_PAGE)).not.toThrow();
    expect(() => ModelFamilySchema.parse(WIRE_FAMILY_AFTER_REVERT)).not.toThrow();
  });

  it('bộ mẫu của mock cũng hợp lệ: ba họ, sáu bản', () => {
    expect(MOCK_MODEL_FAMILIES).toHaveLength(3);
    expect(MOCK_MODEL_VERSIONS).toHaveLength(6);
    expect(() => ModelFamilyPageSchema.parse({ items: MOCK_MODEL_FAMILIES })).not.toThrow();

    for (const version of MOCK_MODEL_VERSIONS) {
      expect(() => ModelVersionSchema.parse(version), version.id).not.toThrow();
    }
  });
});

describe('createAdminMlClient — method, đường, query, thân', () => {
  it('N23: GET model-families, trả đủ ba họ đã giải mã', async () => {
    const { calls, http } = createHttpMock(() => ({ data: WIRE_FAMILY_PAGE, ok: true }));
    const result = await createAdminMlClient(http).listFamilies();

    expect(calls).toEqual([{ method: 'GET', options: {}, path: ENDPOINTS.adminMl.families }]);
    expect(ENDPOINTS.adminMl.families).toBe('/admin/ml/model-families');
    expect(result).toEqual({ data: ModelFamilyPageSchema.parse(WIRE_FAMILY_PAGE).items, ok: true });
  });

  it('N25: GET model-versions với family, cursor, limit đi bằng query', async () => {
    const { calls, http } = createHttpMock(() => ({ data: WIRE_VERSION_PAGE, ok: true }));
    const result = await createAdminMlClient(http).listVersions({
      cursor: 'trang-1',
      family: 'wallSegmentation',
      limit: 50,
    });

    expect(calls[0]?.method).toBe('GET');
    expect(calls[0]?.path).toBe('/admin/ml/model-versions');
    expect(calls[0]?.options?.query).toEqual({ cursor: 'trang-1', family: 'wallSegmentation', limit: 50 });
    expect(result).toEqual({
      data: { items: [ModelVersionSchema.parse(WIRE_WALL_VERSION)], nextCursor: 'trang-2' },
      ok: true,
    });
  });

  it('N25: trang đầu không gửi cursor; một bản hỏng bị bỏ, không làm rỗng cả trang', async () => {
    const broken = { ...WIRE_WALL_VERSION, id: 'mdl_khong-hop-le' };
    const page = { items: [WIRE_WALL_VERSION, WIRE_WALL_VERSION, WIRE_WALL_VERSION, WIRE_WALL_VERSION, WIRE_WALL_VERSION, broken] };
    const { calls, http } = createHttpMock(() => ({ data: page, ok: true }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const result = await createAdminMlClient(http).listVersions({ family: 'wallSegmentation' });

    expect(calls[0]?.options?.query).toEqual({ family: 'wallSegmentation' });
    expect(result.ok && result.data.items).toHaveLength(5);
    expect(result.ok && 'nextCursor' in result.data).toBe(false);
    warn.mockRestore();
  });

  it('N27: GET model-versions/{id}', async () => {
    const { calls, http } = createHttpMock(() => ({ data: WIRE_WALL_VERSION, ok: true }));
    const result = await createAdminMlClient(http).readVersion(WALL_VERSION_ID);

    expect(calls[0]?.path).toBe(`/admin/ml/model-versions/${WALL_VERSION_ID}`);
    expect(result).toEqual({ data: ModelVersionSchema.parse(WIRE_WALL_VERSION), ok: true });
  });

  it('N24: PUT model-families/{family}/active với {baseVersion, body: {versionId}}', async () => {
    const { calls, http } = createHttpMock(() => ({
      data: { activeVersionId: WALL_VERSION_ID, family: 'wallSegmentation', revision: 5 },
      ok: true,
    }));
    await createAdminMlClient(http).activateVersion({
      baseVersion: 4,
      family: 'wallSegmentation',
      versionId: WALL_VERSION_ID,
    });

    expect(calls[0]?.method).toBe('PUT');
    expect(calls[0]?.path).toBe('/admin/ml/model-families/wallSegmentation/active');
    expect(calls[0]?.options?.body).toEqual({ baseVersion: 4, body: { versionId: WALL_VERSION_ID } });
    expect(() => SetActiveModelVersionSchema.parse(calls[0]?.options?.body)).not.toThrow();
  });

  it('N24: quay về đường cổ điển gửi versionId null, không bỏ khoá', async () => {
    const { calls, http } = createHttpMock(() => ({ data: WIRE_FAMILY_AFTER_REVERT, ok: true }));
    const result = await createAdminMlClient(http).activateVersion({
      baseVersion: 4,
      family: 'wallSegmentation',
      versionId: null,
    });

    expect(calls[0]?.options?.body).toEqual({ baseVersion: 4, body: { versionId: null } });
    expect(result).toEqual({ data: { family: 'wallSegmentation', revision: 5 }, ok: true });
  });

  it('thân sai hợp đồng thành lỗi contract, không lọt qua', async () => {
    const { http } = createHttpMock(() => ({ data: { items: [{ family: 'roof', revision: 0 }] }, ok: true }));
    const result = await createAdminMlClient(http).listFamilies();

    expect(result.ok).toBe(false);
  });

  it('lỗi dây đi nguyên, không bọc lại', async () => {
    const { http } = createHttpMock(() => ({ error: httpError, ok: false }));
    const client = createAdminMlClient(http);

    expect(await client.activateVersion({ baseVersion: 1, family: 'dimensionReading', versionId: null })).toEqual({
      error: httpError,
      ok: false,
    });
    expect(await client.listFamilies()).toEqual({ error: httpError, ok: false });
    expect(await client.listVersions({ family: 'dimensionReading' })).toEqual({ error: httpError, ok: false });
    expect(await client.readVersion(WALL_VERSION_ID)).toEqual({ error: httpError, ok: false });
  });
});

describe('createAppAdminMlClient — nhánh mock', () => {
  it('useMock = true: trả bộ mẫu, không ra mạng', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const client = createAppAdminMlClient(true);
    const families = await client.listFamilies();

    expect(families).toEqual({ data: MOCK_MODEL_FAMILIES, ok: true });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('useMock = false: client thật, đủ bốn phương thức', () => {
    const client = createAppAdminMlClient(false);

    expect(Object.keys(client).sort()).toEqual(['activateVersion', 'listFamilies', 'listVersions', 'readVersion']);
  });

  it('mock áp đúng luật N24: chưa đánh giá, sai định dạng, sai họ, null ngoài họ tường, 409, kích hoạt lại giữ revision', async () => {
    const client = createAppAdminMlClient(true);
    const codeOf = (result: ApiResult<unknown>): string | undefined => (result.ok ? undefined : result.error.code);

    expect(
      codeOf(await client.activateVersion({ baseVersion: 1, family: 'dimensionReading', versionId: MOCK_MODEL_VERSION_IDS.dimensionSeed })),
    ).toBe('MODEL_VERSION_NOT_EVALUATED');
    expect(
      codeOf(await client.activateVersion({ baseVersion: 1, family: 'dimensionReading', versionId: MOCK_MODEL_VERSION_IDS.dimensionFailed })),
    ).toBe('MODEL_FORMAT_UNSUPPORTED');
    expect(
      codeOf(await client.activateVersion({ baseVersion: 1, family: 'dimensionReading', versionId: MOCK_MODEL_VERSION_IDS.doorSeed })),
    ).toBe('MODEL_VERSION_FAMILY_MISMATCH');
    expect(codeOf(await client.activateVersion({ baseVersion: 1, family: 'dimensionReading', versionId: null }))).toBe(
      'MODEL_VERSION_FAMILY_MISMATCH',
    );
    expect(
      codeOf(await client.activateVersion({ baseVersion: 0, family: 'dimensionReading', versionId: MOCK_MODEL_VERSION_IDS.dimensionUploaded })),
    ).toBe('VERSION_CONFLICT');
    expect(
      await client.activateVersion({ baseVersion: 3, family: 'openingAndFurnitureDetection', versionId: MOCK_MODEL_VERSION_IDS.doorSeed }),
    ).toEqual({ data: { activeVersionId: MOCK_MODEL_VERSION_IDS.doorSeed, family: 'openingAndFurnitureDetection', revision: 3 }, ok: true });
    expect(
      await client.activateVersion({ baseVersion: 1, family: 'dimensionReading', versionId: MOCK_MODEL_VERSION_IDS.dimensionUploaded }),
    ).toEqual({ data: { activeVersionId: MOCK_MODEL_VERSION_IDS.dimensionUploaded, family: 'dimensionReading', revision: 2 }, ok: true });
    expect(codeOf(await client.readVersion('mdl_01JA6M0RG00000000000000Z99'))).toBe('NOT_FOUND');
    expect(await client.activateVersion({ baseVersion: 0, family: 'wallSegmentation', versionId: null })).toEqual({
      data: { family: 'wallSegmentation', revision: 0 },
      ok: true,
    });
  });
});
