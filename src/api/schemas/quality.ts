import { z } from 'zod';

import type { ImageQualityLevel } from '@/domain/quality';

/**
 * Hợp đồng dây của phép đo chất lượng ảnh đầu vào — T-04.
 *
 * Cùng khuôn với `./index.ts`: mỗi schema là một `z.object().strict()` kèm
 * `.transform()`, `Xxx` là hình dạng đã giải mã và `XxxWire` là hình dạng đi
 * trên dây. Tách ra file riêng chứ không nối thêm vào `index.ts` vì đây là
 * nhóm duy nhất trong `src/api/schemas` mượn một kiểu của `src/domain` —
 * `ImageQualityLevel` — và ranh giới đó đáng nhìn thấy ở đầu một file.
 *
 * ## Vì sao mức nghiêm trọng lấy từ `src/domain/quality`, không khai lại ở đây
 *
 * Ba mức `'good' | 'attention' | 'poor'` là một quyết định nghiệp vụ, và nó đã
 * có đúng một chủ: `src/domain/quality/thresholds.ts`, nơi bốn ngưỡng được suy
 * ra từ hậu quả vật lý. Nếu file này khai lại chuỗi ba giá trị đó thì có hai
 * nguồn cho cùng một sự thật và không cái nào biết cái kia đổi. Bảng
 * `qualityLevelByWire` bên dưới là identity — cùng lý do và cùng hình dạng với
 * `progressStatusByWire` trong `./index.ts`: nó tồn tại để một giá trị lạ trên
 * dây dừng lại ở tầng này, không đi tiếp vào miền.
 *
 * ## Mọi toạ độ ở đây là TỈ LỆ 0..1, không phải pixel
 *
 * Đặc tả: "Mọi phát hiện phải neo vào đúng vùng ảnh nó nói tới". Vùng đi theo
 * tỉ lệ của khung ảnh chứ không theo pixel, nên nó vẫn đúng chỗ sau khi ảnh
 * được co giãn responsive, và view không phải nhân chia lại tỉ lệ (R-60). Bốn
 * góc khung bản vẽ cũng vậy.
 *
 * ## Vắng phép đo được biểu diễn bằng vắng trường, không bằng số 0
 *
 * Một tầng đã tải ảnh nhưng chưa đo xong thì `isMeasured` là `false` và ba
 * trường `measurement` / `expectedConfidence` / `frame` vắng mặt. Không dùng
 * `0` hay `null` làm "chưa đo": `0` là một số đo hợp lệ (ảnh thẳng tuyệt đối
 * có `skewDeg` bằng 0), nên lấy nó làm giá trị canh gác thì màn không phân biệt
 * được "đã đo, rất tốt" với "chưa đo".
 */

const idSchema = z.string().min(1);

/** Tỉ lệ theo khung ảnh: 0 là mép trái/trên, 1 là mép phải/dưới. */
const ratioSchema = z.number().min(0).max(1);

/** Thang điểm chuẩn hoá 0..1 — dùng cho tương phản, nhiễu, độ tin cậy. */
const scoreSchema = z.number().min(0).max(1);

const positivePixelSchema = z.number().int().positive();

const qualityLevelByWire = {
  attention: 'attention',
  good: 'good',
  poor: 'poor',
} as const satisfies Record<ImageQualityLevel, ImageQualityLevel>;

const wireQualityLevelSchema = z.enum(['good', 'attention', 'poor']);

/* -------------------------------------------------------------------------- */
/* Vùng ảnh và điểm neo.                                                       */
/* -------------------------------------------------------------------------- */

/** Một điểm trên khung ảnh, theo tỉ lệ 0..1 của chiều rộng và chiều cao. */
export const QualityPointSchema = z
  .object({
    xRatio: ratioSchema,
    yRatio: ratioSchema,
  })
  .strict()
  .transform((wirePoint) => ({
    xRatio: wirePoint.xRatio,
    yRatio: wirePoint.yRatio,
  }));

export type QualityPoint = z.infer<typeof QualityPointSchema>;
export type QualityPointWire = z.input<typeof QualityPointSchema>;

/**
 * Hình chữ nhật một phát hiện neo vào, theo tỉ lệ 0..1.
 *
 * `widthRatio`/`heightRatio` không bị chặn để `x + width <= 1`: một vùng chờm
 * ra mép là chuyện có thật khi ảnh bị cắt, và từ chối cả bản ghi vì nó thì màn
 * mất luôn phát hiện thay vì vẽ một khung chờm mép.
 */
export const QualityRegionSchema = z
  .object({
    heightRatio: ratioSchema,
    widthRatio: ratioSchema,
    xRatio: ratioSchema,
    yRatio: ratioSchema,
  })
  .strict()
  .transform((wireRegion) => ({
    heightRatio: wireRegion.heightRatio,
    widthRatio: wireRegion.widthRatio,
    xRatio: wireRegion.xRatio,
    yRatio: wireRegion.yRatio,
  }));

export type QualityRegion = z.infer<typeof QualityRegionSchema>;
export type QualityRegionWire = z.input<typeof QualityRegionSchema>;

/* -------------------------------------------------------------------------- */
/* Bốn số đo của một tấm ảnh.                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Bốn số đo thô, chưa phân loại.
 *
 * Chúng đi qua dây ở dạng số, và mức ba bậc của chúng được suy ra bởi
 * `classifyMetric` trong `src/domain/quality` — không phải bởi server và cũng
 * không phải bởi màn. Độ phân giải giữ cả hai cạnh chứ không chỉ cạnh ngắn: màn
 * hiển thị "1.240 x 900 px", và cạnh ngắn thì tính ra được, còn hai cạnh thì
 * không dựng lại được từ một số.
 */
export const ImageQualityMeasurementSchema = z
  .object({
    contrastScore: scoreSchema,
    heightPx: positivePixelSchema,
    noiseScore: scoreSchema,
    skewDeg: z.number(),
    widthPx: positivePixelSchema,
  })
  .strict()
  .transform((wireMeasurement) => ({
    contrastScore: wireMeasurement.contrastScore,
    heightPx: wireMeasurement.heightPx,
    noiseScore: wireMeasurement.noiseScore,
    skewDeg: wireMeasurement.skewDeg,
    widthPx: wireMeasurement.widthPx,
  }));

export type ImageQualityMeasurement = z.infer<typeof ImageQualityMeasurementSchema>;
export type ImageQualityMeasurementWire = z.input<typeof ImageQualityMeasurementSchema>;

/* -------------------------------------------------------------------------- */
/* Khung bản vẽ.                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Khung bản vẽ tìm được hay không, và bốn góc của nó nếu có.
 *
 * `corners` đúng bốn phần tử hoặc vắng mặt — `z.tuple` chứ không `z.array`, để
 * "ba góc" là lỗi hợp đồng ở đây thay vì một sự cố ở chỗ vẽ. Thứ tự bốn góc là
 * theo chiều kim đồng hồ từ góc trên bên trái.
 *
 * `isFound === false` cộng `corners` vắng mặt chính là phát hiện "không tìm
 * thấy khung bản vẽ" mà đặc tả nêu: màn mời người dùng tự chọn bốn góc, và bốn
 * góc đó gửi lên qua `ENDPOINTS.quality.corners`.
 */
export const DrawingFrameSchema = z
  .object({
    corners: z.tuple([QualityPointSchema, QualityPointSchema, QualityPointSchema, QualityPointSchema]).optional(),
    isFound: z.boolean(),
  })
  .strict()
  .transform((wireFrame) => ({
    ...(wireFrame.corners !== undefined ? { corners: wireFrame.corners } : {}),
    isFound: wireFrame.isFound,
  }));

export type DrawingFrame = z.infer<typeof DrawingFrameSchema>;
export type DrawingFrameWire = z.input<typeof DrawingFrameSchema>;

/* -------------------------------------------------------------------------- */
/* Một phát hiện.                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Một điều đáng nói về tấm ảnh, luôn kèm vùng nó nói tới.
 *
 * `region` là bắt buộc, không optional: đặc tả cấm một phát hiện lơ lửng không
 * chỉ vào đâu. `code` là mã máy đọc (`'FRAME_NOT_FOUND'`) — câu tiếng Việt giải
 * thích hậu quả KHÔNG nằm ở đây mà ở tầng trình bày, đúng lý lẽ đã ghi cho
 * `SignInSchema` trong `./index.ts`: `src/api` giữ hình dạng, `src/i18n` giữ
 * câu chữ. Mã đứng một mình trên dây là bình thường; mã đứng một mình trên màn
 * mới là thứ [CẤM TUYỆT ĐỐI] cấm, và đó là việc của tầng đọc file này.
 */
export const ImageQualityFindingSchema = z
  .object({
    code: z.string().min(1),
    id: idSchema,
    region: QualityRegionSchema,
    severity: wireQualityLevelSchema,
  })
  .strict()
  .transform((wireFinding) => ({
    code: wireFinding.code,
    id: wireFinding.id,
    region: wireFinding.region,
    severity: qualityLevelByWire[wireFinding.severity],
  }));

export type ImageQualityFinding = z.infer<typeof ImageQualityFindingSchema>;
export type ImageQualityFindingWire = z.input<typeof ImageQualityFindingSchema>;

/* -------------------------------------------------------------------------- */
/* Một tầng.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Kết quả đo của MỘT tầng.
 *
 * `expectedConfidence` là độ tin cậy dự kiến của bước dò sẽ chạy sau — 0..1,
 * màn in ra "0,82" qua `formatNumber` ở viewmodel (A15), không ở view. Nó là dự
 * báo của máy nên không bao giờ được mang màu "đã xác minh" của A5.
 *
 * `sourceUrl` là ảnh để hiển thị. Nó có mặt kể cả khi `isMeasured` là `false`:
 * tầng đã tải bản vẽ lên rồi, chỉ chưa đo xong, nên vẫn có gì đó để nhìn.
 */
export const FloorImageQualitySchema = z
  .object({
    expectedConfidence: scoreSchema.optional(),
    findings: z.array(ImageQualityFindingSchema),
    floorId: idSchema,
    floorName: z.string().min(1),
    frame: DrawingFrameSchema.optional(),
    isMeasured: z.boolean(),
    measurement: ImageQualityMeasurementSchema.optional(),
    sourceUrl: z.string().url(),
  })
  .strict()
  .transform((wireFloorQuality) => ({
    ...(wireFloorQuality.expectedConfidence !== undefined
      ? { expectedConfidence: wireFloorQuality.expectedConfidence }
      : {}),
    findings: wireFloorQuality.findings,
    floorId: wireFloorQuality.floorId,
    floorName: wireFloorQuality.floorName,
    ...(wireFloorQuality.frame !== undefined ? { frame: wireFloorQuality.frame } : {}),
    isMeasured: wireFloorQuality.isMeasured,
    ...(wireFloorQuality.measurement !== undefined ? { measurement: wireFloorQuality.measurement } : {}),
    sourceUrl: wireFloorQuality.sourceUrl,
  }));

export type FloorImageQuality = z.infer<typeof FloorImageQualitySchema>;
export type FloorImageQualityWire = z.input<typeof FloorImageQualitySchema>;

/* -------------------------------------------------------------------------- */
/* Cả lượt đọc.                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Một lượt đọc chất lượng: tầng đang xem, cộng trạng thái của MỌI tầng.
 *
 * Cả dự án đi cùng một lần chứ không mỗi tầng một lượt gọi, vì màn cần cả hai
 * thứ cùng lúc và chúng không rời nhau được: bảng bên phải liệt kê mọi tầng kèm
 * "đã đo / chưa đo" (đó là cách trạng thái `'partial'` của A11 đếm ra "2/4 tầng
 * đã đo xong"), còn panel ảnh vẽ đúng một tầng. Tách làm hai lượt gọi thì màn
 * có hai nguồn thời gian lệch nhau cho cùng một câu hỏi.
 *
 * `floorId` nói lượt đọc này về tầng nào — nó luôn là `floorId` của một phần tử
 * trong `floors`, và màn tìm bản ghi đang xem bằng cách so khớp nó.
 */
export const ImageQualityAssessmentSchema = z
  .object({
    floorId: idSchema,
    floors: z.array(FloorImageQualitySchema).min(1),
    projectId: idSchema,
  })
  .strict()
  .transform((wireAssessment) => ({
    floorId: wireAssessment.floorId,
    floors: wireAssessment.floors,
    projectId: wireAssessment.projectId,
  }));

export type ImageQualityAssessment = z.infer<typeof ImageQualityAssessmentSchema>;
export type ImageQualityAssessmentWire = z.input<typeof ImageQualityAssessmentSchema>;

/** Bốn góc người dùng tự chọn, gửi lên khi máy không tìm được khung bản vẽ. */
export const DrawingCornersInputSchema = z
  .object({
    corners: z.tuple([QualityPointSchema, QualityPointSchema, QualityPointSchema, QualityPointSchema]),
  })
  .strict();

export type DrawingCornersInput = z.infer<typeof DrawingCornersInputSchema>;
