/**
 * Registry model giả cho `VITE_USE_MOCK_API` — F-11.
 *
 * Bộ hạt giống (HOP-DONG-MOI §8, BE tới W12): họ tường chưa kích hoạt bản nào và chưa có
 * bản nào (đường cổ điển); họ cửa và đồ đạc kích hoạt bản gốc đã đánh giá, có `map50`; họ
 * kích thước kích hoạt bản gốc còn chờ đánh giá. Tổng sáu bản. `modelRegistryScenarios.ts`
 * dựng bảy trạng thái từ chính dữ liệu này, không chép lại.
 *
 * Chỉ chạy dưới `import.meta.env.DEV`; `vite.config.ts` đánh dấu `src/api/__mocks__/`
 * không tác dụng phụ nên bản dựng sản phẩm bỏ hẳn file này.
 */

import type { ModelFamily, ModelVersion } from '@/api/schemas/adminMl';
import type { HttpError, Result } from '@/lib/http';

import type { AdminMlClient } from '../adminMlClient';

const SYSTEM_PIPELINE = 'system:pipeline';
const ADMIN_USER_ID = 'usr_01JA6M0RG00000000000000A01';
const SEED_CREATED_AT = '2026-08-01T00:00:00.000Z';

export const MOCK_MODEL_VERSION_IDS = {
  doorSeed: 'mdl_01JA6M0RG00000000000000D01',
  doorTrained: 'mdl_01JA6M0RG00000000000000D02',
  doorRunning: 'mdl_01JA6M0RG00000000000000D03',
  dimensionSeed: 'mdl_01JA6M0RG00000000000000M01',
  dimensionUploaded: 'mdl_01JA6M0RG00000000000000M02',
  dimensionFailed: 'mdl_01JA6M0RG00000000000000M03',
} as const;

const checksum = (digit: string): string => digit.repeat(64);

/** Ba họ, đúng thứ tự `PIPELINE_STAGES`. */
export const MOCK_MODEL_FAMILIES: readonly ModelFamily[] = [
  { family: 'wallSegmentation', revision: 0 },
  {
    activeVersionId: MOCK_MODEL_VERSION_IDS.doorSeed,
    family: 'openingAndFurnitureDetection',
    revision: 3,
  },
  {
    activeVersionId: MOCK_MODEL_VERSION_IDS.dimensionSeed,
    family: 'dimensionReading',
    revision: 1,
  },
];

/** Sáu bản, mới nhất trước trong mỗi họ. */
export const MOCK_MODEL_VERSIONS: readonly ModelVersion[] = [
  {
    checksumSha256: checksum('c'),
    createdAt: '2026-09-30T09:12:00.000Z',
    creatorId: ADMIN_USER_ID,
    datasetVersionId: 'dsv_01JA6M0RG00000000000000S02',
    evaluationStatus: 'running',
    family: 'openingAndFurnitureDetection',
    id: MOCK_MODEL_VERSION_IDS.doorRunning,
    label: 'Huấn luyện lượt 4',
    trainingJobId: 'job_01JA6M0RG00000000000000J04',
    weightsFormat: 'onnx',
  },
  {
    checksumSha256: checksum('b'),
    createdAt: '2026-09-20T03:40:00.000Z',
    creatorId: ADMIN_USER_ID,
    datasetVersionId: 'dsv_01JA6M0RG00000000000000S01',
    evaluationStatus: 'completed',
    family: 'openingAndFurnitureDetection',
    id: MOCK_MODEL_VERSION_IDS.doorTrained,
    label: 'Huấn luyện lượt 3',
    metrics: { map50: 0.684 },
    trainingJobId: 'job_01JA6M0RG00000000000000J03',
    weightsFormat: 'onnx',
  },
  {
    checksumSha256: checksum('a'),
    createdAt: SEED_CREATED_AT,
    creatorId: SYSTEM_PIPELINE,
    evaluationStatus: 'completed',
    family: 'openingAndFurnitureDetection',
    id: MOCK_MODEL_VERSION_IDS.doorSeed,
    label: 'Gốc',
    metrics: { map50: 0.612 },
    weightsFormat: 'onnx',
  },
  {
    checksumSha256: checksum('f'),
    createdAt: '2026-09-25T07:05:00.000Z',
    creatorId: ADMIN_USER_ID,
    evaluationStatus: 'failed',
    family: 'dimensionReading',
    id: MOCK_MODEL_VERSION_IDS.dimensionFailed,
    label: 'Đọc số thử nghiệm',
    weightsFormat: 'safetensors',
  },
  {
    checksumSha256: checksum('e'),
    createdAt: '2026-09-12T02:30:00.000Z',
    creatorId: ADMIN_USER_ID,
    evaluationStatus: 'completed',
    family: 'dimensionReading',
    id: MOCK_MODEL_VERSION_IDS.dimensionUploaded,
    label: 'Đọc số tải lên',
    metrics: { cer: 0.083 },
    weightsFormat: 'onnx',
  },
  {
    checksumSha256: checksum('d'),
    createdAt: SEED_CREATED_AT,
    creatorId: SYSTEM_PIPELINE,
    evaluationStatus: 'pending',
    family: 'dimensionReading',
    id: MOCK_MODEL_VERSION_IDS.dimensionSeed,
    label: 'Gốc',
    weightsFormat: 'onnx',
  },
];

const ok = <T>(data: T): Result<T, never> => ({ data, ok: true });

/** Lỗi dây cùng hình `HttpError` thật, để màn rẽ nhánh đúng như với máy chủ. */
const wireError = (status: number, code: string, resource?: string): Result<never, HttpError> => ({
  error: {
    code,
    kind: 'http',
    raw: { code, ...(resource !== undefined ? { resource } : {}) },
    requestId: 'mock-admin-ml',
    retryable: false,
    status,
  },
  ok: false,
});

/** Mỗi client giả giữ bản sao riêng, nên hai story không giẫm lên nhau. */
export function createMockAdminMlClient(): AdminMlClient {
  let families = MOCK_MODEL_FAMILIES.map((family) => ({ ...family }));
  const versions = MOCK_MODEL_VERSIONS.map((version) => ({ ...version }));

  return {
    listFamilies: async () => ok(families.map((family) => ({ ...family }))),

    listVersions: async ({ family }) =>
      ok({ items: versions.filter((version) => version.family === family) }),

    readVersion: async (modelVersionId) => {
      const version = versions.find((candidate) => candidate.id === modelVersionId);

      return version === undefined ? wireError(404, 'NOT_FOUND', 'modelVersion') : ok({ ...version });
    },

    activateVersion: async ({ baseVersion, family, versionId }) => {
      const current = families.find((candidate) => candidate.family === family);

      if (current === undefined) {
        return wireError(404, 'NOT_FOUND', 'modelFamily');
      }

      if (versionId === null) {
        if (family !== 'wallSegmentation') {
          return wireError(422, 'MODEL_VERSION_FAMILY_MISMATCH');
        }
      } else {
        const version = versions.find((candidate) => candidate.id === versionId);

        if (version === undefined) return wireError(404, 'NOT_FOUND', 'modelVersion');
        if (version.family !== family) return wireError(422, 'MODEL_VERSION_FAMILY_MISMATCH');
        if (version.weightsFormat !== 'onnx') return wireError(422, 'MODEL_FORMAT_UNSUPPORTED');
        if (version.evaluationStatus !== 'completed') return wireError(422, 'MODEL_VERSION_NOT_EVALUATED');
      }

      if (baseVersion !== current.revision) {
        return wireError(409, 'VERSION_CONFLICT');
      }

      if ((current.activeVersionId ?? null) === versionId) {
        return ok({ ...current });
      }

      const next: ModelFamily = {
        ...(versionId === null ? {} : { activeVersionId: versionId }),
        family: current.family,
        revision: current.revision + 1,
      };

      families = families.map((candidate) => (candidate.family === family ? next : candidate));

      return ok({ ...next });
    },
  };
}
