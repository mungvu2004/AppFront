import { z } from 'zod';

import { isoInstantSchema } from './common';

/**
 * #28–#29 — mẫu thuộc tính: một bộ giá trị đặt sẵn, áp được lên nhiều đối tượng
 * cùng loại.
 *
 * ## `discriminatedUnion` chứ không phải một object có `fields` lỏng
 *
 * Bốn loại đối tượng có bốn bộ trường hoàn toàn khác nhau: một bức tường có độ
 * dày, một ô mở có chiều cao bệ, một phòng chỉ có công năng. Khai `fields` là
 * một object chung với mười trường tuỳ chọn thì `{objectKind: 'room',
 * fields: {thicknessMm: 220}}` là hợp lệ — và nó vô nghĩa.
 *
 * `z.discriminatedUnion('objectKind', …)` biến `objectKind` thành cái khoá mở
 * đúng một nhánh. `zod` đọc khoá ấy trước, chọn nhánh, rồi mới kiểm — nên thông
 * báo lỗi cũng nói về đúng loại người dùng đang làm việc, thay vì bốn lời than
 * phiền song song.
 *
 * ## `.transform()` đặt **sau** union, không phải trong từng nhánh
 *
 * Đặt trong nhánh thì mỗi nhánh thành `ZodEffects`, và `discriminatedUnion` chỉ
 * nhận `ZodObject` — nó cần đọc được `shape` để biết giá trị nào mở nhánh nào.
 * Đặt sau union thì bốn nhánh vẫn là object, và phép dựng lại object chạy một
 * lần cho nhánh nào trúng.
 *
 * Phép dựng lại ấy là `{ ...template }` chứ không phải bảy dòng gán tay: trải
 * một union thì TypeScript phân phối qua từng nhánh, nên kiểu trả về vẫn là
 * union bốn nhánh — liệt kê tay sẽ làm nó sập thành một object có `objectKind`
 * và `fields` rời nhau, đúng cái lỏng mà union tồn tại để chặn.
 *
 * ## Mọi trường trong `fields` đều tuỳ chọn, và đó là ý nghĩa của "mẫu"
 *
 * Một mẫu nói "áp những gì tôi có", không "áp tất cả". Mẫu "tường ngăn 100" chỉ
 * đặt `kind` và `thicknessMm`, để chiều cao của mỗi bức tường giữ nguyên.
 */

/** Bốn loại đối tượng có mẫu. Khớp `PropertyTemplateObjectKind` của `../client.ts:341`. */
export const PROPERTY_TEMPLATE_OBJECT_KINDS = ['wall', 'opening', 'room', 'furniture'] as const;

/** Dài nhất một tên mẫu: đủ cho "tường ngăn 100 có cách âm", ngắn hơn một câu. */
const MAX_TEMPLATE_NAME_LENGTH = 120;

/** Năm trường mọi nhánh đều có. Trải vào từng `z.object()` để `.strict()` thấy đủ khoá. */
const templateBaseShape = {
  createdAt: isoInstantSchema,
  id: z.string().regex(/^tpl_[0-9A-HJKMNP-TV-Z]{26}$/),
  name: z.string().min(1).max(MAX_TEMPLATE_NAME_LENGTH),
  projectId: z.string().regex(/^prj_[0-9A-HJKMNP-TV-Z]{26}$/),
  /**
   * Một mẫu thuộc về **dự án** nó sinh ra trong đó.
   *
   * Chỉ một giá trị, nhưng là một trường chứ không phải một điều ngầm hiểu:
   * `'user'` hay `'organization'` về sau sẽ là một **giá trị mới** ở đây, không
   * phải một lượt migrate dữ liệu (`../client.ts:362-374`).
   */
  scope: z.literal('project'),
} as const;

const wallTemplateSchema = z
  .object({
    ...templateBaseShape,
    fields: z
      .object({
        heightMm: z.number().int().positive().optional(),
        kind: z.enum(['loadBearing', 'partition', 'envelope']).optional(),
        thicknessMm: z.number().int().positive().optional(),
      })
      .strict(),
    objectKind: z.literal('wall'),
  })
  .strict();

const openingTemplateSchema = z
  .object({
    ...templateBaseShape,
    fields: z
      .object({
        heightMm: z.number().int().positive().optional(),
        sillHeightMm: z.number().int().nonnegative().optional(),
        swing: z.enum(['left', 'right', 'double', 'sliding', 'fixed']).optional(),
        widthMm: z.number().int().positive().optional(),
      })
      .strict(),
    objectKind: z.literal('opening'),
  })
  .strict();

const roomTemplateSchema = z
  .object({
    ...templateBaseShape,
    /** Không có `name`: mỗi phòng cần tên riêng, nên tên không phải thứ áp hàng loạt. */
    fields: z
      .object({
        usage: z
          .enum([
            'livingRoom',
            'bedroom',
            'kitchen',
            'bathroom',
            'corridor',
            'stairwell',
            'utility',
            'other',
          ])
          .optional(),
      })
      .strict(),
    objectKind: z.literal('room'),
  })
  .strict();

const furnitureTemplateSchema = z
  .object({
    ...templateBaseShape,
    /** Không có `boundingBox`: hộp bao gắn với một chỗ đặt cụ thể, không với một mẫu. */
    fields: z
      .object({
        kind: z
          .enum([
            'table',
            'chair',
            'bed',
            'wardrobe',
            'kitchenCabinet',
            'sanitaryFixture',
            'stair',
            'other',
          ])
          .optional(),
        rotationDeg: z.number().min(0).lt(360).optional(),
      })
      .strict(),
    objectKind: z.literal('furniture'),
  })
  .strict();

/** Một mẫu đã lưu, như `GET` trả về. */
export const PropertyTemplateSchema = z
  .discriminatedUnion('objectKind', [
    wallTemplateSchema,
    openingTemplateSchema,
    roomTemplateSchema,
    furnitureTemplateSchema,
  ])
  .transform((wireTemplate) => ({ ...wireTemplate }));

export type PropertyTemplateBody = z.infer<typeof PropertyTemplateSchema>;

/**
 * Thứ `POST` gửi lên: ba trường, không năm.
 *
 * `id`, `projectId` và `createdAt` do máy chủ đặt, nên gửi chúng lên là gửi một
 * ý kiến về thứ mình không sở hữu. Bốn nhánh dựng bằng `.pick()` trên chính bốn
 * nhánh ở trên chứ không khai lại, nên thêm một trường vào `fields` của tường
 * chỉ phải sửa một chỗ.
 */
export const PropertyTemplateDraftSchema = z.discriminatedUnion('objectKind', [
  wallTemplateSchema.pick({ fields: true, name: true, objectKind: true }),
  openingTemplateSchema.pick({ fields: true, name: true, objectKind: true }),
  roomTemplateSchema.pick({ fields: true, name: true, objectKind: true }),
  furnitureTemplateSchema.pick({ fields: true, name: true, objectKind: true }),
]);

export type PropertyTemplateDraftBody = z.infer<typeof PropertyTemplateDraftSchema>;
