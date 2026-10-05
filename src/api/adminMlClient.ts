/**
 * Client của registry model (N23, N24, N25, N27) — F-11, `/admin/training/models`.
 *
 * Đứng riêng, **không** vào `ApiClient` (`./client.ts`): chỉ thư mục màn
 * `src/screens/admin/ModelRegistry` nhập file này, nên nó và schema `adminMl` nằm trong
 * chunk lười của màn chứ không trong chunk vào mà mọi người dùng đều tải.
 *
 * Mỗi phương thức trả `ApiResult<…>` đã giải mã bằng schema F-00b; lỗi dây (`HttpError`)
 * đi nguyên, không bọc lại, để màn đọc `code` bằng `readWireError`.
 */

import { createAppHttpClient, resolveUseMockApi } from '@/api/appClient';
import { ENDPOINTS } from '@/api/endpoints';
import { createMockAdminMlClient } from '@/api/__mocks__/adminMlClient';
import {
  ModelFamilyPageSchema,
  ModelFamilySchema,
  ModelVersionSchema,
  type ModelFamily,
  type ModelVersion,
  type SetActiveModelVersion,
} from '@/api/schemas/adminMl';
import { CursorEnvelopeSchema } from '@/api/schemas/common';
import { decode, safeParseList } from '@/api/schemas/decode';
import type { HttpClient, HttpError, Result } from '@/lib/http';

import type { ApiResult } from './client';

/** Một trang N25: bản mới nhất trước, `nextCursor` vắng khi đã hết. */
export interface ModelVersionList {
  readonly items: readonly ModelVersion[];
  readonly nextCursor?: string;
}

export interface ListModelVersionsInput {
  readonly family: string;
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
  readonly signal?: AbortSignal | undefined;
}

export interface ActivateModelVersionInput {
  readonly family: string;
  /** `revision` của họ mà người bấm đã thấy. */
  readonly baseVersion: number;
  /** `null` = quay về đường cổ điển; chỉ hợp lệ cho họ tường. */
  readonly versionId: string | null;
}

export interface AdminMlClient {
  listFamilies(signal?: AbortSignal): Promise<ApiResult<readonly ModelFamily[]>>;
  listVersions(input: ListModelVersionsInput): Promise<ApiResult<ModelVersionList>>;
  readVersion(modelVersionId: string, signal?: AbortSignal): Promise<ApiResult<ModelVersion>>;
  activateVersion(input: ActivateModelVersionInput): Promise<ApiResult<ModelFamily>>;
}

const withSignal = (signal: AbortSignal | undefined): { signal?: AbortSignal } =>
  signal === undefined ? {} : { signal };

/** Lỗi dây đi nguyên; thân thành công qua schema. */
function decodeBody<T>(
  result: Result<unknown, HttpError>,
  read: (data: unknown) => ApiResult<T>,
): ApiResult<T> {
  return result.ok ? read(result.data) : result;
}

export function createAdminMlClient(http: HttpClient): AdminMlClient {
  return {
    listFamilies: async (signal) =>
      decodeBody(
        await http.get<unknown>(ENDPOINTS.adminMl.families, withSignal(signal)),
        (data) => {
          const page = decode(ModelFamilyPageSchema, data, 'adminMl.families');

          return page.ok ? { data: page.data.items, ok: true } : page;
        },
      ),

    listVersions: async ({ cursor, family, limit, signal }) =>
      decodeBody(
        await http.get<unknown>(ENDPOINTS.adminMl.versions, {
          query: {
            family,
            ...(cursor !== undefined ? { cursor } : {}),
            ...(limit !== undefined ? { limit } : {}),
          },
          ...withSignal(signal),
        }),
        (data) => {
          // Phong bì kiểm chặt, từng mục qua `safeParseList`: một bản hỏng bị bỏ kèm cảnh
          // báo chứ không làm rỗng cả bảng (`CursorEnvelopeSchema`).
          const page = decode(CursorEnvelopeSchema, data, 'adminMl.versions');

          if (!page.ok) {
            return page;
          }

          const items = safeParseList(ModelVersionSchema, page.data.items, 'adminMl.versions');

          if (!items.ok) {
            return items;
          }

          return {
            data: {
              items: items.data,
              ...(page.data.nextCursor !== undefined ? { nextCursor: page.data.nextCursor } : {}),
            },
            ok: true,
          };
        },
      ),

    readVersion: async (modelVersionId, signal) =>
      decodeBody(
        await http.get<unknown>(ENDPOINTS.adminMl.version(modelVersionId), withSignal(signal)),
        (data) => decode(ModelVersionSchema, data, 'adminMl.version'),
      ),

    activateVersion: async ({ baseVersion, family, versionId }) => {
      const body: SetActiveModelVersion = { baseVersion, body: { versionId } };

      return decodeBody(
        await http.put<unknown, SetActiveModelVersion>(ENDPOINTS.adminMl.familyActive(family), { body }),
        (data) => decode(ModelFamilySchema, data, 'adminMl.familyActive'),
      );
    },
  };
}

/**
 * Client của ứng dụng: bộ mẫu dưới `VITE_USE_MOCK_API`, còn lại client thật trên
 * `createAppHttpClient()` (token, refresh, ghim chủ của F-01a).
 *
 * `import.meta.env.DEV` viết thẳng tại chỗ gọi, cùng lý do `createAppApiClient`: bản dựng
 * thay nó bằng `false` ngay tại chỗ nên nhánh mock bị bỏ khỏi gói sản phẩm.
 */
export function createAppAdminMlClient(useMock: boolean = resolveUseMockApi()): AdminMlClient {
  return import.meta.env.DEV && useMock
    ? createMockAdminMlClient()
    : createAdminMlClient(createAppHttpClient());
}
