import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import { PIPELINE_STAGES } from '@/lib/realtime/pipeline';

import {
  BuildDatasetVersionSchema,
  CreateDatasetSchema,
  CreateModelVersionMetadataSchema,
  CreateTrainingJobSchema,
  DATASET_VERSION_SOURCES,
  DATASET_VERSION_STATUSES,
  DatasetPageSchema,
  DatasetSchema,
  DatasetVersionPageSchema,
  DatasetVersionSchema,
  ML_MODEL_FAMILIES,
  MODEL_EVALUATION_STATUSES,
  MODEL_WEIGHTS_FORMATS,
  ModelFamilyPageSchema,
  ModelFamilySchema,
  ModelMetricsSchema,
  ModelVersionPageSchema,
  ModelVersionSchema,
  SetActiveModelVersionSchema,
  TRAINABLE_MODEL_FAMILIES,
  TRAINING_BASE_MODELS,
  TRAINING_JOB_STATUSES,
  TrainingJobPageSchema,
  TrainingJobSchema,
  TrainingLogLineSchema,
  TrainingLogPageSchema,
  TrainingMetricPageSchema,
  TrainingMetricPointSchema,
} from '../../schemas/adminMl';

/**
 * N23–N37 — quản trị ML (HOP-DONG-MOI §8).
 *
 * Mỗi refine được thử bằng một mẫu **chỉ** vi phạm đúng điều kiện ấy, và phép
 * kiểm đòi đúng **một** issue ở đúng `path` — nên một luật khác lỡ bắn theo
 * cũng làm đỏ test, không chỉ luật đang thử bị im.
 */

const ULID = '01J9ZQK7X4N2M8P6R3T5V7W9Y1';
const MDL = `mdl_${ULID}`;
const DST = `dst_${ULID}`;
const DSV = `dsv_${ULID}`;
const JOB = `job_${ULID}`;
const PRJ = `prj_${ULID}`;
const USR = `usr_${ULID}`;
const SHA = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
const CREATED = '2026-09-21T03:00:00.000Z';
const STARTED = '2026-09-21T03:10:00.000Z';
const ENDED = '2026-09-21T04:00:00.000Z';

function issuePaths(schema: z.ZodTypeAny, input: unknown): (string | number)[][] {
  const result = schema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path);
}

/** Bản sao của `source` thiếu đúng một khoá — để thử luật "có mặt khi và chỉ khi". */
function without(source: object, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(source).filter(([name]) => name !== key));
}

/**
 * Hai dạng "không có" của một trường: vắng hẳn khoá, và khoá mang `undefined`.
 * zod 3 bỏ khoá vắng nhưng GIỮ khoá mang `undefined`, nên luật kiểm sự có mặt
 * phải qua cả hai.
 */
function missing(source: object, key: string): [string, Record<string, unknown>][] {
  return [
    ['vắng khoá', without(source, key)],
    ['khoá mang undefined', { ...source, [key]: undefined }],
  ];
}

/** Bỏ riêng từng khoá bắt buộc thì hỏng đúng ở khoá đó. */
function itRequiresKeys(schema: z.ZodTypeAny, sample: object, keys: string[]): void {
  it.each(keys)('từ chối thiếu khoá bắt buộc %s', (key) => {
    expect(issuePaths(schema, without(sample, key))).toStrictEqual([[key]]);
  });
}

function accepts(schema: z.ZodTypeAny, input: unknown): boolean {
  return schema.safeParse(input).success;
}

/** Năm phép kiểm mà mọi trang danh sách đều phải qua, với một mục đạt và một mục hỏng. */
function describePage(name: string, schema: z.ZodTypeAny, item: object, badItem: object): void {
  describe(name, () => {
    it('nhận trang đầy đủ', () => {
      expect(schema.parse({ items: [item], nextCursor: 'eyJzIjoxfQ' })).toStrictEqual({
        items: [{ ...item }],
        nextCursor: 'eyJzIjoxfQ',
      });
    });

    it('nhận trang tối thiểu, không có nextCursor', () => {
      expect(schema.parse({ items: [] })).toStrictEqual({ items: [] });
    });

    it('từ chối thiếu items', () => {
      expect(issuePaths(schema, {})).toStrictEqual([['items']]);
    });

    it('từ chối khoá lạ và null ở nextCursor', () => {
      expect(accepts(schema, { items: [], total: 0 })).toBe(false);
      expect(accepts(schema, { items: [], nextCursor: null })).toBe(false);
    });

    it('áp schema của mục cho từng phần tử', () => {
      expect(accepts(schema, { items: [badItem] })).toBe(false);
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Hằng.                                                                       */
/* -------------------------------------------------------------------------- */

describe('hằng — khớp HOP-DONG-MOI §8', () => {
  it('ML_MODEL_FAMILIES là id của ba bước model trong PIPELINE_STAGES, cùng thứ tự', () => {
    const families: readonly string[] = ML_MODEL_FAMILIES;
    const stageIds = PIPELINE_STAGES.map((stage) => stage.id).filter((id) => families.includes(id));
    expect(stageIds).toStrictEqual([...ML_MODEL_FAMILIES]);
    expect([...ML_MODEL_FAMILIES]).toStrictEqual([
      'wallSegmentation',
      'openingAndFurnitureDetection',
      'dimensionReading',
    ]);
  });

  it('TRAINABLE_MODEL_FAMILIES là hai họ đầu', () => {
    expect([...TRAINABLE_MODEL_FAMILIES]).toStrictEqual(ML_MODEL_FAMILIES.slice(0, 2));
    expect([...TRAINABLE_MODEL_FAMILIES]).toStrictEqual([
      'wallSegmentation',
      'openingAndFurnitureDetection',
    ]);
  });

  it('TRAINING_BASE_MODELS theo họ', () => {
    expect(TRAINING_BASE_MODELS).toStrictEqual({
      wallSegmentation: ['mitB0', 'mitB1'],
      openingAndFurnitureDetection: ['yolov8n', 'yolov8s'],
    });
  });

  it.each([
    ['MODEL_WEIGHTS_FORMATS', MODEL_WEIGHTS_FORMATS, ['safetensors', 'onnx']],
    [
      'MODEL_EVALUATION_STATUSES',
      MODEL_EVALUATION_STATUSES,
      ['pending', 'running', 'completed', 'failed'],
    ],
    ['DATASET_VERSION_STATUSES', DATASET_VERSION_STATUSES, ['building', 'ready', 'failed']],
    ['DATASET_VERSION_SOURCES', DATASET_VERSION_SOURCES, ['approvedFloors', 'cubicasa5k']],
    [
      'TRAINING_JOB_STATUSES',
      TRAINING_JOB_STATUSES,
      ['queued', 'running', 'succeeded', 'failed', 'cancelling', 'cancelled'],
    ],
  ])('%s', (_name, actual, expected) => {
    expect([...actual]).toStrictEqual(expected);
  });
});

/* -------------------------------------------------------------------------- */
/* Registry.                                                                   */
/* -------------------------------------------------------------------------- */

describe('ModelMetricsSchema', () => {
  const full = { cer: 0.08, iou: 0.81, map50: 0.66 };

  it('nhận mẫu đầy đủ', () => {
    expect(ModelMetricsSchema.parse(full)).toStrictEqual(full);
  });

  it('nhận mẫu tối thiểu (rỗng)', () => {
    expect(ModelMetricsSchema.parse({})).toStrictEqual({});
  });

  it('bỏ khoá mang undefined khỏi đầu ra', () => {
    expect(
      ModelMetricsSchema.parse({ cer: undefined, iou: undefined, map50: undefined }),
    ).toStrictEqual({});
  });

  it('từ chối khoá lạ', () => {
    expect(accepts(ModelMetricsSchema, { f1: 0.7 })).toBe(false);
  });

  it.each(['cer', 'iou', 'map50'])('từ chối null ở %s', (key) => {
    expect(accepts(ModelMetricsSchema, { [key]: null })).toBe(false);
  });

  it.each([
    ['iou > 1', { iou: 1.01 }],
    ['iou < 0', { iou: -0.01 }],
    ['map50 > 1', { map50: 1.5 }],
    ['map50 < 0', { map50: -0.1 }],
    ['cer < 0', { cer: -0.1 }],
    ['cer vô hạn', { cer: Number.POSITIVE_INFINITY }],
  ])('từ chối %s', (_label, body) => {
    expect(accepts(ModelMetricsSchema, body)).toBe(false);
  });

  it('nhận biên [0,1] của iou và cer lớn hơn 1', () => {
    expect(accepts(ModelMetricsSchema, { iou: 0 })).toBe(true);
    expect(accepts(ModelMetricsSchema, { iou: 1 })).toBe(true);
    expect(accepts(ModelMetricsSchema, { cer: 3 })).toBe(true);
  });
});

const fullFamily = { activeVersionId: MDL, family: 'openingAndFurnitureDetection', revision: 4 };
const minimalFamily = { family: 'wallSegmentation', revision: 0 };

describe('ModelFamilySchema', () => {
  it('nhận mẫu đầy đủ', () => {
    expect(ModelFamilySchema.parse(fullFamily)).toStrictEqual(fullFamily);
  });

  it('nhận mẫu tối thiểu, không có activeVersionId', () => {
    expect(ModelFamilySchema.parse(minimalFamily)).toStrictEqual(minimalFamily);
  });

  it('bỏ khoá mang undefined khỏi đầu ra', () => {
    expect(ModelFamilySchema.parse({ ...minimalFamily, activeVersionId: undefined })).toStrictEqual(
      minimalFamily,
    );
  });

  itRequiresKeys(ModelFamilySchema, fullFamily, ['family', 'revision']);

  it('từ chối khoá lạ và null ở activeVersionId', () => {
    expect(accepts(ModelFamilySchema, { ...minimalFamily, label: 'tường' })).toBe(false);
    expect(accepts(ModelFamilySchema, { ...minimalFamily, activeVersionId: null })).toBe(false);
  });

  it.each([
    ['họ ngoài tập', { ...minimalFamily, family: 'preprocess' }],
    ['id sai tiền tố', { ...minimalFamily, activeVersionId: DSV }],
    ['revision âm', { ...minimalFamily, revision: -1 }],
    ['revision thập phân', { ...minimalFamily, revision: 1.5 }],
  ])('từ chối %s', (_label, body) => {
    expect(accepts(ModelFamilySchema, body)).toBe(false);
  });
});

describePage('ModelFamilyPageSchema', ModelFamilyPageSchema, fullFamily, {
  ...minimalFamily,
  revision: -1,
});

describe('SetActiveModelVersionSchema', () => {
  it('nhận versionId: null', () => {
    const body = { baseVersion: 0, body: { versionId: null } };
    expect(SetActiveModelVersionSchema.parse(body)).toStrictEqual(body);
  });

  it('nhận versionId là mdl_ + ULID', () => {
    const body = { baseVersion: 3, body: { versionId: MDL } };
    expect(SetActiveModelVersionSchema.parse(body)).toStrictEqual(body);
  });

  itRequiresKeys(SetActiveModelVersionSchema, { baseVersion: 3, body: { versionId: MDL } }, [
    'baseVersion',
    'body',
  ]);

  it.each([
    ['thân vắng versionId', { baseVersion: 0, body: {} }],
    ['versionId rỗng', { baseVersion: 0, body: { versionId: '' } }],
    ['id tiền tố dsv_', { baseVersion: 0, body: { versionId: DSV } }],
    ['baseVersion âm', { baseVersion: -1, body: { versionId: MDL } }],
    [
      'khoá lạ family trong thân',
      { baseVersion: 0, body: { family: 'wallSegmentation', versionId: null } },
    ],
    ['khoá lạ ở vỏ', { baseVersion: 0, body: { versionId: MDL }, force: true }],
  ])('từ chối %s', (_label, body) => {
    expect(accepts(SetActiveModelVersionSchema, body)).toBe(false);
  });
});

/** Bản huấn luyện tại chỗ, đã đánh giá. */
const fullModelVersion = {
  checksumSha256: SHA,
  createdAt: CREATED,
  creatorId: USR,
  datasetVersionId: DSV,
  evaluationStatus: 'completed',
  family: 'wallSegmentation',
  id: MDL,
  label: 'mitB1 · đợt 3',
  metrics: { iou: 0.81 },
  trainingJobId: JOB,
  weightsFormat: 'onnx',
};

/** Bản gốc seed sẵn, chưa đánh giá. */
const minimalModelVersion = {
  checksumSha256: SHA,
  createdAt: CREATED,
  creatorId: 'system:pipeline',
  evaluationStatus: 'pending',
  family: 'openingAndFurnitureDetection',
  id: MDL,
  label: 'gốc',
  weightsFormat: 'onnx',
};

describe('ModelVersionSchema', () => {
  it('nhận mẫu đầy đủ', () => {
    expect(ModelVersionSchema.parse(fullModelVersion)).toStrictEqual(fullModelVersion);
  });

  it('nhận mẫu tối thiểu, không có metrics, trainingJobId, datasetVersionId', () => {
    expect(ModelVersionSchema.parse(minimalModelVersion)).toStrictEqual(minimalModelVersion);
  });

  it('bỏ khoá mang undefined khỏi đầu ra', () => {
    expect(
      ModelVersionSchema.parse({
        ...minimalModelVersion,
        datasetVersionId: undefined,
        metrics: undefined,
        trainingJobId: undefined,
      }),
    ).toStrictEqual(minimalModelVersion);
  });

  itRequiresKeys(ModelVersionSchema, minimalModelVersion, [
    'checksumSha256',
    'createdAt',
    'creatorId',
    'evaluationStatus',
    'family',
    'id',
    'label',
    'weightsFormat',
  ]);

  it('từ chối khoá lạ', () => {
    expect(accepts(ModelVersionSchema, { ...minimalModelVersion, isActive: true })).toBe(false);
  });

  it.each(['datasetVersionId', 'metrics', 'trainingJobId'])('từ chối null ở %s', (key) => {
    expect(accepts(ModelVersionSchema, { ...fullModelVersion, [key]: null })).toBe(false);
  });

  it.each([
    ['evaluationStatus ngoài tập', { evaluationStatus: 'done' }],
    ['weightsFormat ngoài tập', { weightsFormat: 'pt' }],
    ['họ ngoài tập', { family: 'qualityCheck' }],
    ['id sai tiền tố', { id: DSV }],
    ['checksum chữ hoa', { checksumSha256: SHA.toUpperCase() }],
    ['checksum 63 ký tự', { checksumSha256: SHA.slice(1) }],
    ['nhãn rỗng', { label: '' }],
    ['nhãn 81 ký tự', { label: 'a'.repeat(81) }],
    ['creatorId không phải usr_ lẫn system:pipeline', { creatorId: 'user-1' }],
    ['createdAt lệch múi giờ', { createdAt: '2026-09-21T10:00:00.000+07:00' }],
  ])('từ chối %s', (_label, patch) => {
    expect(accepts(ModelVersionSchema, { ...minimalModelVersion, ...patch })).toBe(false);
  });

  it('từ chối trainingJobId sai tiền tố', () => {
    expect(
      issuePaths(ModelVersionSchema, { ...fullModelVersion, trainingJobId: MDL }),
    ).toStrictEqual([['trainingJobId']]);
  });

  it('từ chối datasetVersionId sai tiền tố', () => {
    expect(
      issuePaths(ModelVersionSchema, { ...fullModelVersion, datasetVersionId: DST }),
    ).toStrictEqual([['datasetVersionId']]);
  });

  it('nhận nhãn đúng 80 ký tự', () => {
    expect(accepts(ModelVersionSchema, { ...minimalModelVersion, label: 'a'.repeat(80) })).toBe(
      true,
    );
  });

  describe('refine: metrics ⇔ completed', () => {
    it.each(['pending', 'running', 'failed'])('nhận %s không metrics', (evaluationStatus) => {
      expect(accepts(ModelVersionSchema, { ...minimalModelVersion, evaluationStatus })).toBe(true);
    });

    it.each(missing(fullModelVersion, 'metrics'))(
      'completed thiếu metrics (%s) → path evaluationStatus',
      (_form, body) => {
        expect(issuePaths(ModelVersionSchema, body)).toStrictEqual([['evaluationStatus']]);
      },
    );

    it('pending có metrics → path evaluationStatus', () => {
      expect(
        issuePaths(ModelVersionSchema, { ...minimalModelVersion, metrics: { map50: 0.6 } }),
      ).toStrictEqual([['evaluationStatus']]);
    });
  });

  describe('refine: metrics chứa đúng khoá của họ', () => {
    it.each([
      ['wallSegmentation', { iou: 0.8 }],
      ['openingAndFurnitureDetection', { map50: 0.6 }],
      ['dimensionReading', { cer: 0.08 }],
    ])('nhận %s với %o', (family, metrics) => {
      expect(accepts(ModelVersionSchema, { ...fullModelVersion, family, metrics })).toBe(true);
    });

    it.each([
      ['khoá của họ khác', { map50: 0.6 }],
      ['thừa một khoá', { cer: 0.1, iou: 0.8 }],
      ['rỗng', {}],
      ['chỉ có khoá của họ nhưng mang undefined', { iou: undefined }],
    ])('họ tường với metrics %s → path metrics', (_label, metrics) => {
      expect(issuePaths(ModelVersionSchema, { ...fullModelVersion, metrics })).toStrictEqual([
        ['metrics'],
      ]);
    });

    it('khoá thừa mang undefined bị bỏ trước khi đếm', () => {
      expect(
        ModelVersionSchema.parse({ ...fullModelVersion, metrics: { iou: 0.5, map50: undefined } }),
      ).toStrictEqual({ ...fullModelVersion, metrics: { iou: 0.5 } });
    });
  });

  describe('refine: trainingJobId ⇔ datasetVersionId', () => {
    it.each(missing(fullModelVersion, 'datasetVersionId'))(
      'chỉ có trainingJobId (%s) → path datasetVersionId',
      (_form, body) => {
        expect(issuePaths(ModelVersionSchema, body)).toStrictEqual([['datasetVersionId']]);
      },
    );

    it.each(missing(fullModelVersion, 'trainingJobId'))(
      'chỉ có datasetVersionId (%s) → path datasetVersionId',
      (_form, body) => {
        expect(issuePaths(ModelVersionSchema, body)).toStrictEqual([['datasetVersionId']]);
      },
    );
  });
});

describePage('ModelVersionPageSchema', ModelVersionPageSchema, fullModelVersion, {
  ...minimalModelVersion,
  evaluationStatus: 'completed',
});

describe('CreateModelVersionMetadataSchema', () => {
  const body = {
    checksumSha256: SHA,
    family: 'dimensionReading',
    label: 'crnn v2',
    weightsFormat: 'safetensors',
  };

  it('nhận thân', () => {
    expect(CreateModelVersionMetadataSchema.parse(body)).toStrictEqual(body);
  });

  itRequiresKeys(CreateModelVersionMetadataSchema, body, [
    'checksumSha256',
    'family',
    'label',
    'weightsFormat',
  ]);

  it.each(['checksumSha256', 'family', 'label', 'weightsFormat'])('từ chối null ở %s', (key) => {
    expect(accepts(CreateModelVersionMetadataSchema, { ...body, [key]: null })).toBe(false);
  });

  it.each([
    ['khoá lạ', { trainingJobId: JOB }],
    ['weightsFormat ngoài tập', { weightsFormat: 'pt' }],
    ['họ ngoài tập', { family: 'preprocess' }],
    ['checksum sai mẫu', { checksumSha256: 'sha256:abc' }],
    ['nhãn 81 ký tự', { label: 'a'.repeat(81) }],
  ])('từ chối %s', (_label, patch) => {
    expect(accepts(CreateModelVersionMetadataSchema, { ...body, ...patch })).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Dataset.                                                                    */
/* -------------------------------------------------------------------------- */

const dataset = {
  createdAt: CREATED,
  family: 'dimensionReading',
  id: DST,
  name: 'bản vẽ đã duyệt',
};

describe('DatasetSchema', () => {
  it('nhận mẫu', () => {
    expect(DatasetSchema.parse(dataset)).toStrictEqual(dataset);
  });

  itRequiresKeys(DatasetSchema, dataset, ['createdAt', 'family', 'id', 'name']);

  it.each(['createdAt', 'family', 'id', 'name'])('từ chối null ở %s', (key) => {
    expect(accepts(DatasetSchema, { ...dataset, [key]: null })).toBe(false);
  });

  it.each([
    ['khoá lạ', { versionCount: 3 }],
    ['họ ngoài tập', { family: 'preprocess' }],
    ['id sai tiền tố', { id: DSV }],
    ['tên rỗng', { name: '' }],
    ['tên 81 ký tự', { name: 'a'.repeat(81) }],
  ])('từ chối %s', (_label, patch) => {
    expect(accepts(DatasetSchema, { ...dataset, ...patch })).toBe(false);
  });
});

describePage('DatasetPageSchema', DatasetPageSchema, dataset, { ...dataset, id: DSV });

describe('CreateDatasetSchema', () => {
  const body = { family: 'wallSegmentation', name: 'tường 2026' };

  it('nhận thân', () => {
    expect(CreateDatasetSchema.parse(body)).toStrictEqual(body);
  });

  itRequiresKeys(CreateDatasetSchema, body, ['family', 'name']);

  it.each([
    ['khoá lạ', { id: DST }],
    ['null ở name', { name: null }],
    ['họ ngoài tập', { family: 'spatialDataBuild' }],
    ['tên 81 ký tự', { name: 'a'.repeat(81) }],
  ])('từ chối %s', (_label, patch) => {
    expect(accepts(CreateDatasetSchema, { ...body, ...patch })).toBe(false);
  });
});

const readyDatasetVersion = {
  createdAt: CREATED,
  datasetId: DST,
  id: DSV,
  manifestSha256: SHA,
  sequence: 3,
  source: 'approvedFloors',
  splitCounts: { test: 12, train: 96, validation: 12 },
  status: 'ready',
};

const buildingDatasetVersion = {
  createdAt: CREATED,
  datasetId: DST,
  id: DSV,
  sequence: 1,
  source: 'cubicasa5k',
  status: 'building',
};

const failedDatasetVersion = {
  ...buildingDatasetVersion,
  failureCode: 'DATASET_EMPTY',
  status: 'failed',
};

describe('DatasetVersionSchema', () => {
  it('nhận mẫu đầy đủ (ready)', () => {
    expect(DatasetVersionSchema.parse(readyDatasetVersion)).toStrictEqual(readyDatasetVersion);
  });

  it('nhận mẫu tối thiểu (building), không có trường tuỳ chọn nào', () => {
    expect(DatasetVersionSchema.parse(buildingDatasetVersion)).toStrictEqual(
      buildingDatasetVersion,
    );
  });

  it('bỏ khoá mang undefined khỏi đầu ra', () => {
    expect(
      DatasetVersionSchema.parse({
        ...buildingDatasetVersion,
        failureCode: undefined,
        manifestSha256: undefined,
        splitCounts: undefined,
      }),
    ).toStrictEqual(buildingDatasetVersion);
  });

  itRequiresKeys(DatasetVersionSchema, buildingDatasetVersion, [
    'createdAt',
    'datasetId',
    'id',
    'sequence',
    'source',
    'status',
  ]);

  it('nhận bản failed kèm failureCode', () => {
    expect(DatasetVersionSchema.parse(failedDatasetVersion)).toStrictEqual(failedDatasetVersion);
  });

  it('từ chối khoá lạ, cả ở splitCounts', () => {
    expect(accepts(DatasetVersionSchema, { ...buildingDatasetVersion, projectIds: [PRJ] })).toBe(
      false,
    );
    expect(
      accepts(DatasetVersionSchema, {
        ...readyDatasetVersion,
        splitCounts: { ...readyDatasetVersion.splitCounts, holdout: 1 },
      }),
    ).toBe(false);
  });

  it.each([
    ['manifestSha256', readyDatasetVersion],
    ['splitCounts', readyDatasetVersion],
    ['failureCode', failedDatasetVersion],
  ])('từ chối null ở %s', (key, base) => {
    expect(accepts(DatasetVersionSchema, { ...base, [key]: null })).toBe(false);
  });

  it.each([
    ['status ngoài tập', { status: 'queued' }],
    ['source ngoài tập', { source: 'upload' }],
    ['id sai tiền tố', { id: DST }],
    ['datasetId sai tiền tố', { datasetId: DSV }],
    ['sequence 0', { sequence: 0 }],
    ['manifest sai mẫu', { manifestSha256: SHA.slice(2) }],
    ['splitCounts âm', { splitCounts: { test: -1, train: 96, validation: 12 } }],
    ['splitCounts thập phân', { splitCounts: { test: 1.5, train: 96, validation: 12 } }],
  ])('từ chối %s', (_label, patch) => {
    expect(accepts(DatasetVersionSchema, { ...readyDatasetVersion, ...patch })).toBe(false);
  });

  it.each(['test', 'train', 'validation'])('từ chối splitCounts thiếu khoá %s', (key) => {
    expect(
      issuePaths(DatasetVersionSchema, {
        ...readyDatasetVersion,
        splitCounts: without(readyDatasetVersion.splitCounts, key),
      }),
    ).toStrictEqual([['splitCounts', key]]);
  });

  it.each([
    ['chữ thường', 'dataset_empty'],
    ['quá ngắn', 'AB'],
  ])('từ chối failureCode %s', (_label, failureCode) => {
    expect(accepts(DatasetVersionSchema, { ...failedDatasetVersion, failureCode })).toBe(false);
  });

  describe('refine: splitCounts ⇔ ready', () => {
    it.each(missing(readyDatasetVersion, 'splitCounts'))(
      'ready thiếu splitCounts (%s) → path status',
      (_form, body) => {
        expect(issuePaths(DatasetVersionSchema, body)).toStrictEqual([['status']]);
      },
    );

    it('building có splitCounts → path status', () => {
      expect(
        issuePaths(DatasetVersionSchema, {
          ...buildingDatasetVersion,
          splitCounts: readyDatasetVersion.splitCounts,
        }),
      ).toStrictEqual([['status']]);
    });
  });

  describe('refine: manifestSha256 ⇔ ready', () => {
    it.each(missing(readyDatasetVersion, 'manifestSha256'))(
      'ready thiếu manifestSha256 (%s) → path status',
      (_form, body) => {
        expect(issuePaths(DatasetVersionSchema, body)).toStrictEqual([['status']]);
      },
    );

    it('building có manifestSha256 → path status', () => {
      expect(
        issuePaths(DatasetVersionSchema, { ...buildingDatasetVersion, manifestSha256: SHA }),
      ).toStrictEqual([['status']]);
    });
  });

  describe('refine: failureCode ⇔ failed', () => {
    it.each(missing(failedDatasetVersion, 'failureCode'))(
      'failed thiếu failureCode (%s) → path status',
      (_form, body) => {
        expect(issuePaths(DatasetVersionSchema, body)).toStrictEqual([['status']]);
      },
    );

    it('building có failureCode → path status', () => {
      expect(
        issuePaths(DatasetVersionSchema, {
          ...buildingDatasetVersion,
          failureCode: 'DATASET_EMPTY',
        }),
      ).toStrictEqual([['status']]);
    });
  });
});

describePage('DatasetVersionPageSchema', DatasetVersionPageSchema, readyDatasetVersion, {
  ...buildingDatasetVersion,
  sequence: 0,
});

describe('BuildDatasetVersionSchema', () => {
  it('nhận mẫu đầy đủ', () => {
    expect(BuildDatasetVersionSchema.parse({ projectIds: [PRJ] })).toStrictEqual({
      projectIds: [PRJ],
    });
  });

  it('nhận mẫu tối thiểu', () => {
    expect(BuildDatasetVersionSchema.parse({})).toStrictEqual({});
  });

  it.each([
    ['khoá lạ', { source: 'approvedFloors' }],
    ['null ở projectIds', { projectIds: null }],
    ['mảng rỗng', { projectIds: [] }],
    ['id sai tiền tố', { projectIds: ['project-1'] }],
  ])('từ chối %s', (_label, body) => {
    expect(accepts(BuildDatasetVersionSchema, body)).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Job huấn luyện.                                                             */
/* -------------------------------------------------------------------------- */

const queuedJob = {
  baseModel: 'mitB0',
  createdAt: CREATED,
  creatorId: USR,
  datasetVersionId: DSV,
  epochs: 50,
  family: 'wallSegmentation',
  id: JOB,
  status: 'queued',
};

const runningJob = { ...queuedJob, currentEpoch: 12, startedAt: STARTED, status: 'running' };

const succeededJob = {
  ...queuedJob,
  baseModel: 'yolov8s',
  currentEpoch: 50,
  endedAt: ENDED,
  family: 'openingAndFurnitureDetection',
  resultModelVersionId: MDL,
  startedAt: STARTED,
  status: 'succeeded',
};

const failedJob = {
  ...runningJob,
  currentEpoch: 7,
  endedAt: ENDED,
  failureCode: 'TRAINING_OUT_OF_MEMORY',
  status: 'failed',
};

const cancellingJob = { ...runningJob, currentEpoch: 3, status: 'cancelling' };

const cancelledJob = { ...runningJob, endedAt: ENDED, status: 'cancelled' };

const cancelledFromQueuedJob = { ...queuedJob, endedAt: STARTED, status: 'cancelled' };

describe('TrainingJobSchema', () => {
  it('nhận mẫu đầy đủ (succeeded: mọi trường tuỳ chọn trừ failureCode)', () => {
    expect(TrainingJobSchema.parse(succeededJob)).toStrictEqual(succeededJob);
  });

  it('nhận mẫu tối thiểu (queued), không có trường tuỳ chọn nào', () => {
    expect(TrainingJobSchema.parse(queuedJob)).toStrictEqual(queuedJob);
  });

  it('bỏ khoá mang undefined khỏi đầu ra', () => {
    expect(
      TrainingJobSchema.parse({
        ...queuedJob,
        currentEpoch: undefined,
        endedAt: undefined,
        failureCode: undefined,
        resultModelVersionId: undefined,
        startedAt: undefined,
      }),
    ).toStrictEqual(queuedJob);
  });

  itRequiresKeys(TrainingJobSchema, queuedJob, [
    'baseModel',
    'createdAt',
    'creatorId',
    'datasetVersionId',
    'epochs',
    'family',
    'id',
    'status',
  ]);

  it.each([
    ['running', runningJob],
    ['failed sau khi chạy', failedJob],
    [
      'failed ngay từ queued, chưa có startedAt',
      { ...queuedJob, endedAt: STARTED, failureCode: 'WORKER_UNAVAILABLE', status: 'failed' },
    ],
    ['cancelling', cancellingJob],
    ['cancelling ngay từ queued', { ...queuedJob, status: 'cancelling' }],
    ['cancelled sau khi chạy', cancelledJob],
    ['cancelled ngay từ queued, chưa có startedAt', cancelledFromQueuedJob],
  ])('nhận trạng thái %s', (_label, job) => {
    expect(TrainingJobSchema.parse(job)).toStrictEqual(job);
  });

  it('từ chối khoá lạ', () => {
    expect(accepts(TrainingJobSchema, { ...queuedJob, progressPercent: 0 })).toBe(false);
  });

  it.each([
    ['currentEpoch', runningJob],
    ['endedAt', cancelledFromQueuedJob],
    ['failureCode', failedJob],
    ['resultModelVersionId', succeededJob],
    ['startedAt', runningJob],
  ])('từ chối null ở %s', (key, base) => {
    expect(accepts(TrainingJobSchema, { ...base, [key]: null })).toBe(false);
  });

  it.each([
    ['họ không huấn luyện được', { family: 'dimensionReading' }],
    ['baseModel ngoài tập', { baseModel: 'resnet50' }],
    ['status ngoài tập', { status: 'paused' }],
    ['id sai tiền tố', { id: MDL }],
    ['datasetVersionId sai tiền tố', { datasetVersionId: DST }],
    ['epochs 0', { epochs: 0 }],
    ['epochs 301', { epochs: 301 }],
    ['epochs thập phân', { epochs: 1.5 }],
    ['creatorId sai mẫu', { creatorId: 'usr_1' }],
  ])('từ chối %s', (_label, patch) => {
    expect(accepts(TrainingJobSchema, { ...queuedJob, ...patch })).toBe(false);
  });

  it.each([
    ['currentEpoch âm', { ...runningJob, currentEpoch: -1 }],
    ['resultModelVersionId sai tiền tố', { ...succeededJob, resultModelVersionId: JOB }],
    ['failureCode chữ thường', { ...failedJob, failureCode: 'oom' }],
  ])('từ chối %s', (_label, job) => {
    expect(accepts(TrainingJobSchema, job)).toBe(false);
  });

  it('nhận biên epochs 1 và 300', () => {
    expect(accepts(TrainingJobSchema, { ...queuedJob, epochs: 1 })).toBe(true);
    expect(accepts(TrainingJobSchema, { ...queuedJob, epochs: 300 })).toBe(true);
  });

  describe('refine: baseModel thuộc họ', () => {
    it('họ tường với yolov8n → path baseModel', () => {
      expect(issuePaths(TrainingJobSchema, { ...queuedJob, baseModel: 'yolov8n' })).toStrictEqual([
        ['baseModel'],
      ]);
    });
  });

  describe('refine: currentEpoch ≤ epochs', () => {
    it('nhận currentEpoch 0 và bằng epochs', () => {
      expect(accepts(TrainingJobSchema, { ...runningJob, currentEpoch: 0 })).toBe(true);
      expect(accepts(TrainingJobSchema, { ...runningJob, currentEpoch: 50 })).toBe(true);
    });

    it('currentEpoch vượt epochs → path currentEpoch', () => {
      expect(issuePaths(TrainingJobSchema, { ...runningJob, currentEpoch: 51 })).toStrictEqual([
        ['currentEpoch'],
      ]);
    });
  });

  describe('refine: resultModelVersionId ⇔ succeeded', () => {
    it.each(missing(succeededJob, 'resultModelVersionId'))(
      'succeeded thiếu resultModelVersionId (%s) → path status',
      (_form, body) => {
        expect(issuePaths(TrainingJobSchema, body)).toStrictEqual([['status']]);
      },
    );

    it('running có resultModelVersionId → path status', () => {
      expect(
        issuePaths(TrainingJobSchema, { ...runningJob, resultModelVersionId: MDL }),
      ).toStrictEqual([['status']]);
    });
  });

  describe('refine: failureCode ⇔ failed', () => {
    it.each(missing(failedJob, 'failureCode'))(
      'failed thiếu failureCode (%s) → path status',
      (_form, body) => {
        expect(issuePaths(TrainingJobSchema, body)).toStrictEqual([['status']]);
      },
    );

    it('cancelled có failureCode → path status', () => {
      expect(
        issuePaths(TrainingJobSchema, {
          ...runningJob,
          endedAt: ENDED,
          failureCode: 'TRAINING_OUT_OF_MEMORY',
          status: 'cancelled',
        }),
      ).toStrictEqual([['status']]);
    });
  });

  describe('refine: endedAt ⇔ succeeded | failed | cancelled', () => {
    it.each(missing(succeededJob, 'endedAt'))(
      'succeeded thiếu endedAt (%s) → path status',
      (_form, body) => {
        expect(issuePaths(TrainingJobSchema, body)).toStrictEqual([['status']]);
      },
    );

    it.each(missing(cancelledJob, 'endedAt'))(
      'cancelled thiếu endedAt (%s) → path status',
      (_form, body) => {
        expect(issuePaths(TrainingJobSchema, body)).toStrictEqual([['status']]);
      },
    );

    it.each([
      ['running', runningJob],
      ['cancelling', cancellingJob],
    ])('%s có endedAt → path status', (_label, job) => {
      expect(issuePaths(TrainingJobSchema, { ...job, endedAt: ENDED })).toStrictEqual([['status']]);
    });
  });

  describe('refine: queued ⇒ vắng startedAt', () => {
    it('queued có startedAt → path startedAt', () => {
      expect(issuePaths(TrainingJobSchema, { ...queuedJob, startedAt: STARTED })).toStrictEqual([
        ['startedAt'],
      ]);
    });
  });

  describe('refine: running | succeeded ⇒ có startedAt', () => {
    it.each(missing(runningJob, 'startedAt'))(
      'running thiếu startedAt (%s) → path startedAt',
      (_form, body) => {
        expect(issuePaths(TrainingJobSchema, body)).toStrictEqual([['startedAt']]);
      },
    );

    it.each(missing(succeededJob, 'startedAt'))(
      'succeeded thiếu startedAt (%s) → path startedAt',
      (_form, body) => {
        expect(issuePaths(TrainingJobSchema, body)).toStrictEqual([['startedAt']]);
      },
    );
  });

  describe('refine: endedAt ≥ startedAt', () => {
    it('nhận endedAt bằng startedAt', () => {
      expect(accepts(TrainingJobSchema, { ...succeededJob, endedAt: STARTED })).toBe(true);
    });

    it('endedAt trước startedAt → path endedAt', () => {
      expect(issuePaths(TrainingJobSchema, { ...succeededJob, endedAt: CREATED })).toStrictEqual([
        ['endedAt'],
      ]);
    });
  });
});

describePage('TrainingJobPageSchema', TrainingJobPageSchema, succeededJob, {
  ...queuedJob,
  startedAt: STARTED,
});

describe('CreateTrainingJobSchema', () => {
  const body = {
    baseModel: 'yolov8n',
    datasetVersionId: DSV,
    epochs: 100,
    family: 'openingAndFurnitureDetection',
  };

  it('nhận thân', () => {
    expect(CreateTrainingJobSchema.parse(body)).toStrictEqual(body);
  });

  itRequiresKeys(CreateTrainingJobSchema, body, [
    'baseModel',
    'datasetVersionId',
    'epochs',
    'family',
  ]);

  it.each(['baseModel', 'datasetVersionId', 'epochs', 'family'])('từ chối null ở %s', (key) => {
    expect(accepts(CreateTrainingJobSchema, { ...body, [key]: null })).toBe(false);
  });

  it.each([
    ['khoá lạ', { status: 'queued' }],
    ['họ không huấn luyện được', { family: 'dimensionReading' }],
    ['baseModel ngoài tập', { baseModel: 'yolov5s' }],
    ['datasetVersionId sai tiền tố', { datasetVersionId: DST }],
    ['epochs 0', { epochs: 0 }],
    ['epochs 301', { epochs: 301 }],
  ])('từ chối %s', (_label, patch) => {
    expect(accepts(CreateTrainingJobSchema, { ...body, ...patch })).toBe(false);
  });

  it('refine: yolov8n cho họ tường → path baseModel', () => {
    expect(
      issuePaths(CreateTrainingJobSchema, { ...body, family: 'wallSegmentation' }),
    ).toStrictEqual([['baseModel']]);
  });

  it('refine: mitB1 cho họ tường đạt', () => {
    expect(
      accepts(CreateTrainingJobSchema, { ...body, baseModel: 'mitB1', family: 'wallSegmentation' }),
    ).toBe(true);
  });
});

const fullMetricPoint = {
  epoch: 3,
  iou: 0.72,
  loss: 0.41,
  map50: 0.55,
  recordedAt: STARTED,
  split: 'validation',
  step: 1200,
};

const minimalMetricPoint = { epoch: 1, loss: 1.9, recordedAt: STARTED, split: 'train', step: 0 };

describe('TrainingMetricPointSchema', () => {
  it('nhận mẫu đầy đủ', () => {
    expect(TrainingMetricPointSchema.parse(fullMetricPoint)).toStrictEqual(fullMetricPoint);
  });

  it('nhận mẫu tối thiểu, không có iou, map50', () => {
    expect(TrainingMetricPointSchema.parse(minimalMetricPoint)).toStrictEqual(minimalMetricPoint);
  });

  it('bỏ khoá mang undefined khỏi đầu ra', () => {
    expect(
      TrainingMetricPointSchema.parse({ ...minimalMetricPoint, iou: undefined, map50: undefined }),
    ).toStrictEqual(minimalMetricPoint);
  });

  itRequiresKeys(TrainingMetricPointSchema, minimalMetricPoint, [
    'epoch',
    'recordedAt',
    'split',
    'step',
  ]);

  it('từ chối khoá lạ', () => {
    expect(accepts(TrainingMetricPointSchema, { ...minimalMetricPoint, cer: 0.1 })).toBe(false);
  });

  it.each(['iou', 'loss', 'map50'])('từ chối null ở %s', (key) => {
    expect(accepts(TrainingMetricPointSchema, { ...fullMetricPoint, [key]: null })).toBe(false);
  });

  it.each([
    ['split test', { split: 'test' }],
    ['step âm', { step: -1 }],
    ['step thập phân', { step: 1.5 }],
    ['epoch 0', { epoch: 0 }],
    ['loss âm', { loss: -0.1 }],
    ['loss vô hạn', { loss: Number.POSITIVE_INFINITY }],
    ['iou > 1', { iou: 1.2 }],
    ['map50 < 0', { map50: -0.1 }],
    ['recordedAt thiếu mili giây', { recordedAt: '2026-09-21T03:10:00Z' }],
  ])('từ chối %s', (_label, patch) => {
    expect(accepts(TrainingMetricPointSchema, { ...fullMetricPoint, ...patch })).toBe(false);
  });

  describe('refine: ≥ 1 số đo', () => {
    it.each([
      ['chỉ loss', { loss: 0.4 }],
      ['chỉ iou', { iou: 0.7 }],
      ['chỉ map50', { map50: 0.5 }],
    ])('nhận %s', (_label, measure) => {
      const base = without(minimalMetricPoint, 'loss');
      expect(accepts(TrainingMetricPointSchema, { ...base, ...measure })).toBe(true);
    });

    it.each([
      ['vắng cả ba khoá', without(minimalMetricPoint, 'loss')],
      [
        'cả ba khoá mang undefined',
        { ...minimalMetricPoint, iou: undefined, loss: undefined, map50: undefined },
      ],
    ])('không số đo nào (%s) → path []', (_form, body) => {
      expect(issuePaths(TrainingMetricPointSchema, body)).toStrictEqual([[]]);
    });
  });
});

describePage('TrainingMetricPageSchema', TrainingMetricPageSchema, fullMetricPoint, {
  ...minimalMetricPoint,
  epoch: 0,
});

const logLine = { at: STARTED, level: 'warning', message: 'epoch 3: loss tăng', seq: 0 };

describe('TrainingLogLineSchema', () => {
  it('nhận mẫu', () => {
    expect(TrainingLogLineSchema.parse(logLine)).toStrictEqual(logLine);
  });

  itRequiresKeys(TrainingLogLineSchema, logLine, ['at', 'level', 'message', 'seq']);

  it.each(['at', 'level', 'message', 'seq'])('từ chối null ở %s', (key) => {
    expect(accepts(TrainingLogLineSchema, { ...logLine, [key]: null })).toBe(false);
  });

  it.each([
    ['khoá lạ', { stack: 'Traceback…' }],
    ['level ngoài tập', { level: 'debug' }],
    ['message rỗng', { message: '' }],
    ['message 2001 ký tự', { message: 'a'.repeat(2001) }],
    ['seq âm', { seq: -1 }],
  ])('từ chối %s', (_label, patch) => {
    expect(accepts(TrainingLogLineSchema, { ...logLine, ...patch })).toBe(false);
  });

  it('nhận message đúng 2000 ký tự', () => {
    expect(accepts(TrainingLogLineSchema, { ...logLine, message: 'a'.repeat(2000) })).toBe(true);
  });
});

describePage('TrainingLogPageSchema', TrainingLogPageSchema, logLine, { ...logLine, seq: -1 });
