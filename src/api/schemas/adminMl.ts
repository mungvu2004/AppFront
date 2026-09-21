import { z } from 'zod';

import { CursorPageSchema, VersionedWriteSchema, isoInstantSchema } from './common';

/**
 * N23–N37 — quản trị ML: registry model, dataset, job huấn luyện.
 *
 * Chưa màn nào đọc các schema này. Chúng được dựng tối thiểu cho đúng hai màn
 * sẽ có — F-11 (`/admin/training/models`) và F-12 (`/admin/training/jobs`) —
 * và cho cổng H1 của BE, nơi mẫu golden của 15 đường phải giải mã được bằng
 * chính file này. Đặc tả trường ở HOP-DONG-MOI §8.
 *
 * ## Không đi qua `./index.ts`
 *
 * F-11 và F-12 nhập thẳng `@/api/schemas/adminMl`, và client của hai màn ấy
 * nạp lazy. Một dòng `export *` ở `./index.ts` sẽ kéo cả file này vào chunk
 * dùng chung cho mọi người dùng, trong khi chỉ người quản trị cần nó.
 *
 * ## Luật "khi và chỉ khi" nằm trong zod
 *
 * Mỗi trạng thái kéo theo một tập trường có mặt: bản `completed` có `metrics`,
 * phiên bản dataset `ready` có `splitCounts`, job `succeeded` có
 * `resultModelVersionId`. Kiểm chúng ở đây (HOP-DONG-MOI §0.2 A) để một
 * response lệch trạng thái bị chặn ngay ở biên giới. Đó là bảo đảm **lúc
 * chạy**, không phải lúc biên dịch: `z.infer` vẫn để mọi trường ấy tuỳ chọn —
 * không có union theo trạng thái — nên TypeScript vẫn buộc F-11/F-12 kiểm
 * `!== undefined` trước khi đọc. `path` của mọi luật ⇔ là trường ở **vế phải**
 * như §8 viết — với luật theo trạng thái, đó là chính trường trạng thái.
 *
 * ## `family` nằm trên đường chứ không trong thân của N24
 *
 * `versionId: null` ("quay về đường cổ điển") chỉ hợp lệ cho `wallSegmentation`,
 * nhưng thân không mang họ nên zod không kiểm được luật ấy. BE trả 422
 * `MODEL_VERSION_FAMILY_MISMATCH`; F-11 chỉ gửi `null` cho họ tường.
 */

/* -------------------------------------------------------------------------- */
/* Hằng.                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Ba họ model của ống xử lý. Bản sao id ba bước của `PIPELINE_STAGES`
 * (`lib/realtime/pipeline.ts:50-52`), khai tại chỗ vì cùng lý do đã ghi ở
 * docblock đầu `./errors.ts`: file đó nhập `vi.json` và `throw` lúc nạp.
 * `adminMl.test.ts` so hai danh sách.
 */
export const ML_MODEL_FAMILIES = [
  'wallSegmentation',
  'openingAndFurnitureDetection',
  'dimensionReading',
] as const;

type MlModelFamily = (typeof ML_MODEL_FAMILIES)[number];

/**
 * Họ huấn luyện tại chỗ được (N33). `dimensionReading` thì không: bản của họ
 * này là bản gốc seed sẵn hoặc bản tải lên qua N26.
 */
export const TRAINABLE_MODEL_FAMILIES = [
  'wallSegmentation',
  'openingAndFurnitureDetection',
] as const satisfies readonly MlModelFamily[];

export const TRAINING_BASE_MODELS = {
  wallSegmentation: ['mitB0', 'mitB1'],
  openingAndFurnitureDetection: ['yolov8n', 'yolov8s'],
} as const satisfies Record<(typeof TRAINABLE_MODEL_FAMILIES)[number], readonly string[]>;

export const MODEL_WEIGHTS_FORMATS = ['safetensors', 'onnx'] as const;

export const MODEL_EVALUATION_STATUSES = ['pending', 'running', 'completed', 'failed'] as const;

export const DATASET_VERSION_STATUSES = ['building', 'ready', 'failed'] as const;

export const DATASET_VERSION_SOURCES = ['approvedFloors', 'cubicasa5k'] as const;

export const TRAINING_JOB_STATUSES = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelling',
  'cancelled',
] as const;

/** Mỗi họ đo bằng đúng một số: IoU cho tường, mAP@50 cho ô mở, CER cho kích thước. */
const METRIC_KEY_BY_FAMILY = {
  wallSegmentation: 'iou',
  openingAndFurnitureDetection: 'map50',
  dimensionReading: 'cer',
} as const satisfies Record<MlModelFamily, 'iou' | 'map50' | 'cer'>;

/* -------------------------------------------------------------------------- */
/* Mảnh lá.                                                                    */
/* -------------------------------------------------------------------------- */

const modelVersionIdSchema = z.string().regex(/^mdl_[0-9A-HJKMNP-TV-Z]{26}$/);
const datasetIdSchema = z.string().regex(/^dst_[0-9A-HJKMNP-TV-Z]{26}$/);
const datasetVersionIdSchema = z.string().regex(/^dsv_[0-9A-HJKMNP-TV-Z]{26}$/);
const trainingJobIdSchema = z.string().regex(/^job_[0-9A-HJKMNP-TV-Z]{26}$/);
const projectIdSchema = z.string().regex(/^prj_[0-9A-HJKMNP-TV-Z]{26}$/);

/** Người tạo, hoặc chính hệ thống — bản gốc seed sẵn không có ai bấm tạo (§0.1). */
const actorIdSchema = z.string().regex(/^(usr_[0-9A-HJKMNP-TV-Z]{26}|system:pipeline)$/);

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const failureCodeSchema = z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/);
const nameSchema = z.string().min(1).max(80);
const unitIntervalSchema = z.number().min(0).max(1);
const countSchema = z.number().int().nonnegative();
const epochsSchema = z.number().int().min(1).max(300);

const familySchema = z.enum(ML_MODEL_FAMILIES);
const trainableFamilySchema = z.enum(TRAINABLE_MODEL_FAMILIES);
const baseModelSchema = z.enum([
  ...TRAINING_BASE_MODELS.wallSegmentation,
  ...TRAINING_BASE_MODELS.openingAndFurnitureDetection,
]);

function baseModelMatchesFamily(job: {
  baseModel: z.infer<typeof baseModelSchema>;
  family: z.infer<typeof trainableFamilySchema>;
}): boolean {
  const allowed: readonly string[] = TRAINING_BASE_MODELS[job.family];
  return allowed.includes(job.baseModel);
}

/* -------------------------------------------------------------------------- */
/* Registry — N23–N27.                                                         */
/* -------------------------------------------------------------------------- */

export const ModelMetricsSchema = z
  .object({
    cer: z.number().finite().nonnegative().optional(),
    iou: unitIntervalSchema.optional(),
    map50: unitIntervalSchema.optional(),
  })
  .strict()
  .transform((wireMetrics) => ({
    ...(wireMetrics.cer !== undefined ? { cer: wireMetrics.cer } : {}),
    ...(wireMetrics.iou !== undefined ? { iou: wireMetrics.iou } : {}),
    ...(wireMetrics.map50 !== undefined ? { map50: wireMetrics.map50 } : {}),
  }));

export type ModelMetrics = z.infer<typeof ModelMetricsSchema>;

/** Một họ và bản đang kích hoạt. Vắng `activeVersionId` = họ tường đang chạy đường cổ điển. */
export const ModelFamilySchema = z
  .object({
    activeVersionId: modelVersionIdSchema.optional(),
    family: familySchema,
    revision: z.number().int().nonnegative(),
  })
  .strict()
  .transform((wireFamily) => ({
    ...(wireFamily.activeVersionId !== undefined
      ? { activeVersionId: wireFamily.activeVersionId }
      : {}),
    family: wireFamily.family,
    revision: wireFamily.revision,
  }));

export type ModelFamily = z.infer<typeof ModelFamilySchema>;

/** N23. Đủ 3 họ là H1 ngữ cảnh, không zod. */
export const ModelFamilyPageSchema = CursorPageSchema(ModelFamilySchema);

export type ModelFamilyPage = z.infer<typeof ModelFamilyPageSchema>;

/**
 * N24 — kích hoạt một bản, hoặc `null` để quay về đường cổ điển.
 *
 * `versionId` **bắt buộc**: `null` là một lựa chọn có chủ đích, không phải
 * "không gửi". 409 dùng `VersionConflictBodySchema` với `remoteChanges: []`.
 */
export const SetActiveModelVersionSchema = VersionedWriteSchema(
  z.object({ versionId: modelVersionIdSchema.nullable() }).strict(),
);

export type SetActiveModelVersion = z.infer<typeof SetActiveModelVersionSchema>;

/**
 * Một bản trọng số trong registry.
 *
 * `trainingJobId` và `datasetVersionId` đi đôi: bản huấn luyện tại chỗ có cả
 * hai, bản tải lên qua N26 hay bản gốc seed sẵn không có cái nào.
 */
export const ModelVersionSchema = z
  .object({
    checksumSha256: sha256Schema,
    createdAt: isoInstantSchema,
    creatorId: actorIdSchema,
    datasetVersionId: datasetVersionIdSchema.optional(),
    evaluationStatus: z.enum(MODEL_EVALUATION_STATUSES),
    family: familySchema,
    id: modelVersionIdSchema,
    label: nameSchema,
    metrics: ModelMetricsSchema.optional(),
    trainingJobId: trainingJobIdSchema.optional(),
    weightsFormat: z.enum(MODEL_WEIGHTS_FORMATS),
  })
  .strict()
  .refine(
    (version) => (version.metrics !== undefined) === (version.evaluationStatus === 'completed'),
    { path: ['evaluationStatus'] },
  )
  .refine(
    (version) => {
      if (version.metrics === undefined) return true;
      const keys = Object.keys(version.metrics);
      return keys.length === 1 && keys[0] === METRIC_KEY_BY_FAMILY[version.family];
    },
    { path: ['metrics'] },
  )
  .refine(
    (version) => (version.trainingJobId !== undefined) === (version.datasetVersionId !== undefined),
    { path: ['datasetVersionId'] },
  )
  .transform((wireVersion) => ({
    checksumSha256: wireVersion.checksumSha256,
    createdAt: wireVersion.createdAt,
    creatorId: wireVersion.creatorId,
    ...(wireVersion.datasetVersionId !== undefined
      ? { datasetVersionId: wireVersion.datasetVersionId }
      : {}),
    evaluationStatus: wireVersion.evaluationStatus,
    family: wireVersion.family,
    id: wireVersion.id,
    label: wireVersion.label,
    ...(wireVersion.metrics !== undefined ? { metrics: wireVersion.metrics } : {}),
    ...(wireVersion.trainingJobId !== undefined
      ? { trainingJobId: wireVersion.trainingJobId }
      : {}),
    weightsFormat: wireVersion.weightsFormat,
  }));

export type ModelVersion = z.infer<typeof ModelVersionSchema>;

/** N25, mới nhất trước. */
export const ModelVersionPageSchema = CursorPageSchema(ModelVersionSchema);

export type ModelVersionPage = z.infer<typeof ModelVersionPageSchema>;

/** N26 — phần `metadata` của multipart. Chỉ CLI/API gửi; F-11 không có giao diện tải lên. */
export const CreateModelVersionMetadataSchema = z
  .object({
    checksumSha256: sha256Schema,
    family: familySchema,
    label: nameSchema,
    weightsFormat: z.enum(MODEL_WEIGHTS_FORMATS),
  })
  .strict();

export type CreateModelVersionMetadata = z.infer<typeof CreateModelVersionMetadataSchema>;

/* -------------------------------------------------------------------------- */
/* Dataset — N28–N31.                                                          */
/* -------------------------------------------------------------------------- */

/** `family` gồm cả 3 họ — khác job, chỉ 2 họ huấn luyện được. */
export const DatasetSchema = z
  .object({
    createdAt: isoInstantSchema,
    family: familySchema,
    id: datasetIdSchema,
    name: nameSchema,
  })
  .strict()
  .transform((wireDataset) => ({
    createdAt: wireDataset.createdAt,
    family: wireDataset.family,
    id: wireDataset.id,
    name: wireDataset.name,
  }));

export type Dataset = z.infer<typeof DatasetSchema>;

/** N28. */
export const DatasetPageSchema = CursorPageSchema(DatasetSchema);

export type DatasetPage = z.infer<typeof DatasetPageSchema>;

/** N29 — chỉ CLI gửi. */
export const CreateDatasetSchema = z
  .object({
    family: familySchema,
    name: nameSchema,
  })
  .strict();

export type CreateDataset = z.infer<typeof CreateDatasetSchema>;

/**
 * Một lần dựng dataset.
 *
 * `splitCounts` và `manifestSha256` chỉ có khi đã dựng xong (`ready`);
 * `failureCode` chỉ có khi dựng hỏng. Mỗi trường là một luật ⇔ riêng, để một
 * bản `building` lỡ mang `manifestSha256` mà thiếu `splitCounts` vẫn bị bắt.
 */
export const DatasetVersionSchema = z
  .object({
    createdAt: isoInstantSchema,
    datasetId: datasetIdSchema,
    failureCode: failureCodeSchema.optional(),
    id: datasetVersionIdSchema,
    manifestSha256: sha256Schema.optional(),
    sequence: z.number().int().positive(),
    source: z.enum(DATASET_VERSION_SOURCES),
    splitCounts: z
      .object({ test: countSchema, train: countSchema, validation: countSchema })
      .strict()
      .optional(),
    status: z.enum(DATASET_VERSION_STATUSES),
  })
  .strict()
  .refine((version) => (version.splitCounts !== undefined) === (version.status === 'ready'), {
    path: ['status'],
  })
  .refine((version) => (version.manifestSha256 !== undefined) === (version.status === 'ready'), {
    path: ['status'],
  })
  .refine((version) => (version.failureCode !== undefined) === (version.status === 'failed'), {
    path: ['status'],
  })
  .transform((wireVersion) => ({
    createdAt: wireVersion.createdAt,
    datasetId: wireVersion.datasetId,
    ...(wireVersion.failureCode !== undefined ? { failureCode: wireVersion.failureCode } : {}),
    id: wireVersion.id,
    ...(wireVersion.manifestSha256 !== undefined
      ? { manifestSha256: wireVersion.manifestSha256 }
      : {}),
    sequence: wireVersion.sequence,
    source: wireVersion.source,
    ...(wireVersion.splitCounts !== undefined ? { splitCounts: wireVersion.splitCounts } : {}),
    status: wireVersion.status,
  }));

export type DatasetVersion = z.infer<typeof DatasetVersionSchema>;

/** N30, `sequence` giảm dần. */
export const DatasetVersionPageSchema = CursorPageSchema(DatasetVersionSchema);

export type DatasetVersionPage = z.infer<typeof DatasetVersionPageSchema>;

/** N31. `projectIds` nếu gửi thì có ít nhất một dự án. */
export const BuildDatasetVersionSchema = z
  .object({
    projectIds: z.array(projectIdSchema).min(1).optional(),
  })
  .strict();

export type BuildDatasetVersion = z.infer<typeof BuildDatasetVersionSchema>;

/* -------------------------------------------------------------------------- */
/* Job huấn luyện — N32–N37.                                                   */
/* -------------------------------------------------------------------------- */

/** Trạng thái đã kết thúc: có `endedAt`. `cancelling` chưa kết thúc. */
const ENDED_JOB_STATUSES: readonly string[] = ['succeeded', 'failed', 'cancelled'];

/**
 * Một job huấn luyện.
 *
 * `startedAt` không có luật ⇔: job `failed` hoặc `cancelled` ngay từ `queued`
 * thì chưa từng bắt đầu, nên chỉ `queued` bắt buộc vắng và chỉ
 * `running | succeeded` bắt buộc có. `endedAt ≥ startedAt` so chuỗi — đúng vì
 * `isoInstantSchema` ép cùng một dạng `.sssZ`.
 */
export const TrainingJobSchema = z
  .object({
    baseModel: baseModelSchema,
    createdAt: isoInstantSchema,
    creatorId: actorIdSchema,
    currentEpoch: countSchema.optional(),
    datasetVersionId: datasetVersionIdSchema,
    endedAt: isoInstantSchema.optional(),
    epochs: epochsSchema,
    failureCode: failureCodeSchema.optional(),
    family: trainableFamilySchema,
    id: trainingJobIdSchema,
    resultModelVersionId: modelVersionIdSchema.optional(),
    startedAt: isoInstantSchema.optional(),
    status: z.enum(TRAINING_JOB_STATUSES),
  })
  .strict()
  .refine(baseModelMatchesFamily, { path: ['baseModel'] })
  .refine((job) => job.currentEpoch === undefined || job.currentEpoch <= job.epochs, {
    path: ['currentEpoch'],
  })
  .refine((job) => (job.resultModelVersionId !== undefined) === (job.status === 'succeeded'), {
    path: ['status'],
  })
  .refine((job) => (job.failureCode !== undefined) === (job.status === 'failed'), {
    path: ['status'],
  })
  .refine((job) => (job.endedAt !== undefined) === ENDED_JOB_STATUSES.includes(job.status), {
    path: ['status'],
  })
  .refine((job) => job.status !== 'queued' || job.startedAt === undefined, {
    path: ['startedAt'],
  })
  .refine(
    (job) =>
      (job.status !== 'running' && job.status !== 'succeeded') || job.startedAt !== undefined,
    { path: ['startedAt'] },
  )
  .refine(
    (job) =>
      job.endedAt === undefined || job.startedAt === undefined || job.endedAt >= job.startedAt,
    { path: ['endedAt'] },
  )
  .transform((wireJob) => ({
    baseModel: wireJob.baseModel,
    createdAt: wireJob.createdAt,
    creatorId: wireJob.creatorId,
    ...(wireJob.currentEpoch !== undefined ? { currentEpoch: wireJob.currentEpoch } : {}),
    datasetVersionId: wireJob.datasetVersionId,
    ...(wireJob.endedAt !== undefined ? { endedAt: wireJob.endedAt } : {}),
    epochs: wireJob.epochs,
    ...(wireJob.failureCode !== undefined ? { failureCode: wireJob.failureCode } : {}),
    family: wireJob.family,
    id: wireJob.id,
    ...(wireJob.resultModelVersionId !== undefined
      ? { resultModelVersionId: wireJob.resultModelVersionId }
      : {}),
    ...(wireJob.startedAt !== undefined ? { startedAt: wireJob.startedAt } : {}),
    status: wireJob.status,
  }));

export type TrainingJob = z.infer<typeof TrainingJobSchema>;

/** N32. */
export const TrainingJobPageSchema = CursorPageSchema(TrainingJobSchema);

export type TrainingJobPage = z.infer<typeof TrainingJobPageSchema>;

/** N33. Cùng luật `baseModel` thuộc họ với bản nhận, để F-12 chặn trước khi BE trả 422. */
export const CreateTrainingJobSchema = z
  .object({
    baseModel: baseModelSchema,
    datasetVersionId: datasetVersionIdSchema,
    epochs: epochsSchema,
    family: trainableFamilySchema,
  })
  .strict()
  .refine(baseModelMatchesFamily, { path: ['baseModel'] });

export type CreateTrainingJob = z.infer<typeof CreateTrainingJobSchema>;

/** Một điểm số đo. Một dòng không mang số đo nào là dòng rỗng, không phải điểm. */
export const TrainingMetricPointSchema = z
  .object({
    epoch: z.number().int().min(1),
    iou: unitIntervalSchema.optional(),
    loss: z.number().finite().nonnegative().optional(),
    map50: unitIntervalSchema.optional(),
    recordedAt: isoInstantSchema,
    split: z.enum(['train', 'validation']),
    step: countSchema,
  })
  .strict()
  .refine(
    (point) => point.loss !== undefined || point.iou !== undefined || point.map50 !== undefined,
    { path: [] },
  )
  .transform((wirePoint) => ({
    epoch: wirePoint.epoch,
    ...(wirePoint.iou !== undefined ? { iou: wirePoint.iou } : {}),
    ...(wirePoint.loss !== undefined ? { loss: wirePoint.loss } : {}),
    ...(wirePoint.map50 !== undefined ? { map50: wirePoint.map50 } : {}),
    recordedAt: wirePoint.recordedAt,
    split: wirePoint.split,
    step: wirePoint.step,
  }));

export type TrainingMetricPoint = z.infer<typeof TrainingMetricPointSchema>;

/**
 * N36, `step` tăng dần. `nextCursor` luôn có khi job chưa kết thúc; nó **chỉ**
 * vắng khi job đã kết thúc quá cửa sổ muộn 600 s **và** đã đọc hết. F-12 không
 * dừng polling chỉ vì trang rỗng.
 */
export const TrainingMetricPageSchema = CursorPageSchema(TrainingMetricPointSchema);

export type TrainingMetricPage = z.infer<typeof TrainingMetricPageSchema>;

/** Một dòng log. `message` dựng từ mẫu câu có tham số ở BE, không chứa ngoại lệ thô. */
export const TrainingLogLineSchema = z
  .object({
    at: isoInstantSchema,
    level: z.enum(['info', 'warning', 'error']),
    message: z.string().min(1).max(2000),
    seq: countSchema,
  })
  .strict()
  .transform((wireLine) => ({
    at: wireLine.at,
    level: wireLine.level,
    message: wireLine.message,
    seq: wireLine.seq,
  }));

export type TrainingLogLine = z.infer<typeof TrainingLogLineSchema>;

/** N37. Cùng luật `nextCursor` với N36. */
export const TrainingLogPageSchema = CursorPageSchema(TrainingLogLineSchema);

export type TrainingLogPage = z.infer<typeof TrainingLogPageSchema>;
