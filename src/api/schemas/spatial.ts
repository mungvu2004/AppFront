import { z } from 'zod';

import type {
  BoundingBox,
  Furniture,
  Opening,
  Point,
  ReviewMetadata,
  Room,
  Segment,
  Wall,
} from '@/domain/spatial/types';

/**
 * Hợp đồng dây của lớp không gian một tầng — tường, ô mở, phòng, đồ đạc.
 *
 * ## Vì sao file này tồn tại, sau khi `client.ts` từng lập luận ngược lại
 *
 * Khối chú thích của `SpatialLayer` trong `../client.ts` nêu lý do KHÔNG dựng
 * schema: hình dạng miền đã phẳng và an toàn với JSON, nên "một bản sao thứ hai
 * của cùng danh sách trường chỉ tạo thêm một chỗ để hai bên trôi ra xa nhau".
 * Lập luận ấy đúng về **kiểu**, và sai về **thời điểm**.
 *
 * `readonly Wall[]` là một lời hứa của trình biên dịch về dữ liệu chỉ tồn tại
 * lúc chạy. Nguồn của dữ liệu ấy là ba mô hình AI — SegFormer, YOLO,
 * PaddleOCR — và đầu ra của chúng là **xác suất**, không phải hợp đồng. Một
 * tầng dò sót, một chuỗi OCR đọc `4800` thành `48OO`, một độ dày tường bằng 0:
 * cả ba đều là phản hồi HTTP hợp lệ và đều làm vỡ màn. R-08 nói dữ liệu ngoài
 * đi qua `zod` chính vì lý do đó.
 *
 * Nỗi lo "hai bên trôi ra xa nhau" thì xử lý bằng kiểu, không bằng cách bỏ
 * kiểm: mỗi schema dưới đây **khai kiểu trả về là chính interface của miền**.
 * Thêm một trường bắt buộc vào `Wall` mà quên sửa `WallSchema` thì
 * `pnpm typecheck` đỏ ngay tại dòng khai báo, chứ không đợi tới lúc chạy. Đó là
 * điều một bản sao viết tay không có.
 *
 * ## Ranh giới với `domain/spatial/integrity.ts` — hai việc khác nhau
 *
 * File này hỏi **"JSON này có đúng hình dạng không"**: khoá nào có mặt, kiểu
 * gì, nằm trong khoảng nào. Nó chạy trên payload thô, từng đối tượng một, và
 * không biết gì về các đối tượng khác.
 *
 * `checkIntegrity` (D-13) hỏi **"các mã có trỏ đúng vào nhau không"**: một cửa
 * gắn lên bức tường chưa từng được gửi, một phòng có đường bao rỗng. Nó cần cả
 * đồ thị đã chuẩn hoá mới trả lời được.
 *
 * Hai câu hỏi đó không thay được cho nhau, và **không** câu nào nên lấn sang
 * câu kia: nhét phép kiểm tham chiếu chéo vào `zod` thì một cửa mồ côi làm hỏng
 * cả lượt giải mã thay vì hiện thành một dòng cảnh báo đọc được.
 *
 * ## Vì sao mã thực thể ở đây chỉ là "chuỗi không rỗng"
 *
 * `domain/spatial/ids.ts` có sẵn `isIdOfKind`, và dùng nó ở đây trông rất hợp
 * lý cho tới lúc đối chiếu với dữ liệu thật. `isIdOfKind` mô tả **bộ sinh mã
 * của chính chúng ta** — tiền tố một chữ, rồi ít nhất mười ký tự base36 in hoa.
 * Nó từ chối:
 *
 * - `M-001` … `M-034`, bộ mã mà `screens/qc/DimensionOcrReview/dimensionOcrFixture.ts`
 *   đang dùng;
 * - `w1`, `d1`, `win1`, `r1`, `f1`, `v0` — mã trong **chính hợp đồng Spatial
 *   JSON** của đặc tả nghiên cứu (Phần IV), vốn không có tiền tố nào.
 *
 * Một máy chủ tự sinh mã theo lệ của nó là chuyện bình thường; ép nó theo lệ
 * của bộ sinh nội bộ là nhầm "mã do ta tạo" với "mã hợp lệ". Nên biên giới chỉ
 * đòi **chuỗi không rỗng**, và việc quy đổi mã của hợp đồng ngoài sang không
 * gian mã của miền là việc của tầng chuyển đổi, không phải của schema.
 *
 * Nhãn kiểu (`WallId` = `` `W-${string}` ``) vì thế được **gán** ở đây, đúng
 * vai trò mà `millimetres()` của `domain/units/types.ts` giữ cho số: biên giới
 * là nơi duy nhất một giá trị chưa có nhãn được nhận nhãn, và nó phải nhìn
 * thấy được.
 *
 * ## Không câu chữ nào trong file này
 *
 * Cùng lệ với `./index.ts`: schema giữ **hình dạng**, `src/i18n/vi.json` giữ
 * câu người đọc. Một `.refine()` hỏng cho ra mã `custom`, và `./decode.ts` dịch
 * nó thành "Trường '…' không đúng hợp đồng."
 *
 * ## Ba phép kiểm không suy ra được từ kiểu
 *
 * Kiểu nói `thicknessMm` là `number`. Nó không nói `0` là vô nghĩa, không nói
 * một bức tường dài 0 mm là rác, và **không** nói điều quan trọng nhất:
 *
 * - **A5 — máy không được tự nhận đã duyệt.** `reviewed: true` chỉ đánh dấu
 *   việc người duyệt. Mã trong repo đã theo lệ ấy: nơi đặt `reviewed: true`
 *   luôn đặt kèm `source: 'human'`
 *   (`screens/qc/DimensionOcrReview/dimensionOcrReviewGateway.ts:28,796`). Ở
 *   đây lệ ấy thành **luật của biên giới**: payload nói
 *   `{ source: 'ai', reviewed: true }` bị từ chối, chứ không lặng lẽ tô xanh
 *   một đối tượng chưa ai nhìn.
 * - **Đoạn thẳng phải có chiều dài.** `start` trùng `end` là một bức tường
 *   không tồn tại; đùn khối từ nó cho ra một tấm dày 0.
 * - **Hộp bao phải đúng chiều.** `max` nhỏ hơn `min` ở bất kỳ trục nào là hộp
 *   lộn trong ra ngoài.
 *
 * ## Phạm vi: đúng bốn thực thể đang đi trên dây
 *
 * `Axis`, `Dimension`, `Level` và `Note` **chưa** có schema ở đây, vì chưa nhóm
 * API nào chở chúng — `spatial.readFloor` chỉ trả siêu dữ liệu tầng
 * (`FloorSchema`). Dựng sẵn schema cho một mặt dây chưa tồn tại đúng là thứ
 * R-69 cấm. Khi một nhóm API chở chúng, chúng vào đây theo cùng khuôn này.
 */

/* -------------------------------------------------------------------------- */
/* Mảnh dùng lại.                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Mọi toạ độ và kích thước hình học là **số nguyên milimét** — quy ước viết
 * ngay đầu `domain/spatial/types.ts`. Một giá trị thập phân ở đây nghĩa là ai
 * đó đã quy đổi đơn vị ngoài `domain/units`, và đó là lớp lỗi mà kiểu có nhãn
 * của mô-đun ấy tồn tại để chặn (R-44).
 */
const millimetresSchema = z.number().int();
const positiveMillimetresSchema = millimetresSchema.positive();
const nonNegativeMillimetresSchema = millimetresSchema.nonnegative();

/** Diện tích lưu bằng mét vuông, không bao giờ âm. */
const squareMetresSchema = z.number().nonnegative();

/** Góc trong `[0, 360)` — `domain/spatial/types.ts`, kiểu `Degrees`. */
const degreesSchema = z.number().min(0).lt(360);

/** Độ tin cậy của mô hình AI, trong `[0, 1]`. */
const confidenceSchema = z.number().min(0).max(1);

/**
 * Mã thực thể trên dây: chuỗi không rỗng, nhận nhãn kiểu tại biên giới.
 *
 * Lý do không gọi `isIdOfKind` nằm ở khối chú thích đầu file. Phép gán nhãn là
 * cố ý và là chỗ **duy nhất** trong file này có `as`.
 */
const entityId = <TId extends string>(): z.ZodType<TId, z.ZodTypeDef, unknown> =>
  z
    .string()
    .min(1)
    .transform((value) => value as TId);

const wallIdSchema = entityId<Wall['id']>();
const openingIdSchema = entityId<Opening['id']>();
const roomIdSchema = entityId<Room['id']>();
const furnitureIdSchema = entityId<Furniture['id']>();
const levelIdSchema = entityId<Wall['levelId']>();

const pointSchema: z.ZodType<Point, z.ZodTypeDef, unknown> = z
  .object({
    x: millimetresSchema,
    y: millimetresSchema,
  })
  .strict();

/** Một đoạn thẳng thật sự có chiều dài — xem khối chú thích đầu file. */
const segmentSchema: z.ZodType<Segment, z.ZodTypeDef, unknown> = z
  .object({
    end: pointSchema,
    start: pointSchema,
  })
  .strict()
  .refine((segment) => segment.start.x !== segment.end.x || segment.start.y !== segment.end.y);

/** Hộp bao đúng chiều: `max` không nhỏ hơn `min` trên cả hai trục. */
const boundingBoxSchema: z.ZodType<BoundingBox, z.ZodTypeDef, unknown> = z
  .object({
    max: pointSchema,
    min: pointSchema,
  })
  .strict()
  .refine((box) => box.max.x >= box.min.x && box.max.y >= box.min.y);

/**
 * Ba trường soát duyệt mà mọi thực thể trong đồ thị đều mang.
 *
 * Không phải một schema độc lập: nó được trộn vào từng `z.object()` bên dưới
 * bằng phép trải, vì `.strict()` phải nhìn thấy trọn bộ khoá của một đối tượng
 * thì mới từ chối được khoá lạ.
 */
const reviewMetadataShape = {
  confidence: confidenceSchema,
  reviewed: z.boolean(),
  source: z.enum(['ai', 'human']),
} as const;

/** A5: đầu ra của máy không bao giờ được tự nhận là đã có người duyệt. */
const humanOnlyReview = (entity: ReviewMetadata): boolean => !(entity.source === 'ai' && entity.reviewed);

/* -------------------------------------------------------------------------- */
/* Bốn thực thể của lớp không gian.                                            */
/* -------------------------------------------------------------------------- */

export const WallSchema: z.ZodType<Wall, z.ZodTypeDef, unknown> = z
  .object({
    ...reviewMetadataShape,
    centreline: segmentSchema,
    heightMm: positiveMillimetresSchema,
    id: wallIdSchema,
    kind: z.enum(['loadBearing', 'partition', 'envelope']),
    levelId: levelIdSchema,
    openingIds: z.array(openingIdSchema),
    thicknessMm: positiveMillimetresSchema,
  })
  .strict()
  .refine(humanOnlyReview);

export const OpeningSchema: z.ZodType<Opening, z.ZodTypeDef, unknown> = z
  .object({
    ...reviewMetadataShape,
    heightMm: positiveMillimetresSchema,
    id: openingIdSchema,
    kind: z.enum(['door', 'window']),
    offsetMm: nonNegativeMillimetresSchema,
    sillHeightMm: nonNegativeMillimetresSchema,
    swing: z.enum(['left', 'right', 'double', 'sliding', 'fixed']),
    wallId: wallIdSchema,
    widthMm: positiveMillimetresSchema,
  })
  .strict()
  .refine(humanOnlyReview);

export const RoomSchema: z.ZodType<Room, z.ZodTypeDef, unknown> = z
  .object({
    ...reviewMetadataShape,
    areaM2: squareMetresSchema,
    id: roomIdSchema,
    levelId: levelIdSchema,
    name: z.string().min(1),
    /** Đường bao khép kín; điểm đầu không lặp lại ở cuối, nên ba điểm là ít nhất. */
    outline: z.array(pointSchema).min(3),
    usage: z.enum([
      'livingRoom',
      'bedroom',
      'kitchen',
      'bathroom',
      'corridor',
      'stairwell',
      'utility',
      'other',
    ]),
    wallIds: z.array(wallIdSchema),
  })
  .strict()
  .refine(humanOnlyReview);

/**
 * `roomId` vắng mặt là vắng **khoá**, không phải khoá mang `undefined`.
 *
 * `tsconfig.json` bật `exactOptionalPropertyTypes`, nên `{ roomId: undefined }`
 * không gán được vào `Furniture`. Đó là lý do mọi schema trong thư mục này dựng
 * lại đối tượng trong `.transform()` thay vì trả thẳng kết quả phân tích.
 */
export const FurnitureSchema: z.ZodType<Furniture, z.ZodTypeDef, unknown> = z
  .object({
    ...reviewMetadataShape,
    boundingBox: boundingBoxSchema,
    centre: pointSchema,
    id: furnitureIdSchema,
    kind: z.enum([
      'table',
      'chair',
      'bed',
      'wardrobe',
      'kitchenCabinet',
      'sanitaryFixture',
      'stair',
      'other',
    ]),
    levelId: levelIdSchema,
    roomId: roomIdSchema.optional(),
    rotationDeg: degreesSchema,
  })
  .strict()
  .refine(humanOnlyReview)
  .transform((wireFurniture) => ({
    boundingBox: wireFurniture.boundingBox,
    centre: wireFurniture.centre,
    confidence: wireFurniture.confidence,
    id: wireFurniture.id,
    kind: wireFurniture.kind,
    levelId: wireFurniture.levelId,
    reviewed: wireFurniture.reviewed,
    ...(wireFurniture.roomId !== undefined ? { roomId: wireFurniture.roomId } : {}),
    rotationDeg: wireFurniture.rotationDeg,
    source: wireFurniture.source,
  }));

/* -------------------------------------------------------------------------- */
/* Cả lớp không gian của một tầng.                                             */
/* -------------------------------------------------------------------------- */

/** Bốn danh sách thực thể của một tầng, đúng hình dạng `SpatialLayer`. */
export interface SpatialLayerShape {
  furniture: readonly Furniture[];
  openings: readonly Opening[];
  rooms: readonly Room[];
  walls: readonly Wall[];
}

/**
 * Bốn danh sách mà `spatial.writeLayer` gửi đi và nhận về.
 *
 * Kiểu khai tại chỗ thay vì nhập `SpatialLayer` từ `../client.ts`: schema nhập
 * ngược từ chính file gọi nó là một vòng nhập, mà `pnpm cycles` chạy
 * `import/no-cycle` ở độ sâu không giới hạn và là bước thứ ba của `pnpm verify`.
 * Hai hình dạng trùng nhau về cấu trúc, nên `client.ts` dùng được schema này mà
 * không phải đổi một chữ ký công khai nào.
 */
export const SpatialLayerSchema: z.ZodType<SpatialLayerShape, z.ZodTypeDef, unknown> = z
  .object({
    furniture: z.array(FurnitureSchema),
    openings: z.array(OpeningSchema),
    rooms: z.array(RoomSchema),
    walls: z.array(WallSchema),
  })
  .strict();
