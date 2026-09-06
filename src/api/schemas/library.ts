import { z } from 'zod';

import type { FurnitureKind } from '@/domain/spatial/types';

/**
 * Hợp đồng dây của thư viện model — lỗ hổng tầng logic D-01/D-02/D-03.
 *
 * Cùng khuôn với `./index.ts` và `./quality.ts`: mỗi schema là một
 * `z.object().strict()` kèm `.transform()`, `Xxx` là hình dạng đã giải mã và
 * `XxxWire` là hình dạng đi trên dây. Tách ra file riêng vì đây là nhóm THỨ HAI
 * mượn một kiểu của `src/domain` — `FurnitureKind` — và `./quality.ts` đã đặt lệ
 * rằng ranh giới đó phải nhìn thấy được ở đầu một file thay vì lẫn vào giữa
 * `index.ts`.
 *
 * ## Nhóm (`group`) và nguồn (`source`) là HAI trục, không phải một
 *
 * Panel thư viện có mười chip lọc: `Tất cả`, tám nhóm loại đồ, và `Của tôi`.
 * Nhét `Của tôi` thành một giá trị thứ chín của `group` thì một chiếc ghế do
 * người dùng tự tải lên mất luôn thông tin nó là ghế — nó chỉ còn là "của tôi",
 * và chip `Ghế` không tìm thấy nó nữa. Nên `group` giữ đúng tám loại, `source`
 * giữ trục quyền sở hữu, và {@link matchesLibraryFilter} là NƠI DUY NHẤT hợp
 * hai trục đó lại thành mười chip. Hook của màn gọi hàm ấy chứ không tự viết
 * lại phép lọc, đúng lý do `classifyMetric` sống trong `src/domain/quality` chứ
 * không trong màn chất lượng ảnh.
 *
 * ## Loại nội thất suy ra từ nhóm, không đi trên dây
 *
 * Đặt một model vào cảnh sinh ra một `Furniture` (`src/domain/spatial/types`),
 * và `Furniture.kind` phải là một `FurnitureKind` — lệnh S-07 đọc nó. Trường
 * `furnitureKind` của một mục thư viện KHÔNG phải một trường riêng trên dây:
 * nó suy ra từ `group` qua {@link FURNITURE_KIND_BY_LIBRARY_GROUP} trong
 * `.transform()`. Hai trường độc lập cho cùng một sự thật là hai thứ trôi ra xa
 * nhau — một máy chủ gửi `group: 'chair'` kèm `furnitureKind: 'bed'` thì không
 * tầng nào ở đây nói được cái nào đúng.
 *
 * ## Kích thước và độ nặng là SỐ THÔ
 *
 * `widthMm`/`depthMm`/`heightMm` là số nguyên mm, `fileSizeBytes` là byte,
 * `triangleCount` là số tam giác. Không định dạng gì ở đây: A15 nói việc dựng
 * chuỗi "1.200 × 600 × 750 mm" xảy ra ở viewmodel, không ở tầng dữ liệu và cũng
 * không ở view.
 *
 * `triangleCount` có mặt để màn CẢNH BÁO ĐƯỢC trước khi cho kéo một model nặng,
 * mà không phải bịa một ngưỡng: hook cộng nó vào số đo cảnh hiện tại rồi gọi
 * `checkBudget()` (`src/lib/three/perf/budget.ts`), nơi `SCENE_BUDGET.maxTriangles`
 * đã là nguồn duy nhất của giới hạn ấy (R-71).
 *
 * ## Vắng ảnh xem trước là vắng trường
 *
 * `previewUrl` optional, cùng lý lẽ với `measurement` trong `./quality.ts`: một
 * model đã tải lên nhưng chưa dựng xong ảnh xem trước là chuyện có thật, và đó
 * chính là cái cho trạng thái `'partial'` của A11 có nội dung để nói. Chuỗi
 * rỗng làm giá trị canh gác thì màn không phân biệt được "chưa có ảnh" với "có
 * ảnh nhưng đường dẫn hỏng".
 */

const idSchema = z.string().min(1);

/** Số nguyên dương — dùng cho mm, byte và số tam giác. */
const positiveIntegerSchema = z.number().int().positive();

/* -------------------------------------------------------------------------- */
/* Tám nhóm loại đồ, và trục quyền sở hữu.                                     */
/* -------------------------------------------------------------------------- */

/**
 * Tám nhóm loại đồ, theo đúng tám chip loại của panel thư viện.
 *
 * Định danh bằng tiếng Anh (mục B/E.11); câu chữ tiếng Việt của từng chip là
 * việc của tầng trình bày, đúng ranh giới `SignInSchema` đã ghi trong
 * `./index.ts`: `src/api` giữ hình dạng, tầng đọc nó giữ câu chữ. Thứ tự ở đây
 * là thứ tự chip trên màn.
 */
export const LIBRARY_GROUPS = [
  'table',
  'chair',
  'bed',
  'sofa',
  'storage',
  'sanitary',
  'kitchen',
  'technical',
] as const;

export type LibraryGroup = (typeof LIBRARY_GROUPS)[number];

/**
 * Model của ai.
 *
 * `'catalogue'` là bộ dựng sẵn đi kèm sản phẩm, `'mine'` là model người đang
 * đăng nhập tự tải lên — và chỉ `'mine'` mới khớp chip `Của tôi`.
 */
export const LIBRARY_SOURCES = ['catalogue', 'mine'] as const;

export type LibrarySource = (typeof LIBRARY_SOURCES)[number];

/**
 * Nhóm nào sinh ra `FurnitureKind` nào khi đặt vào cảnh.
 *
 * Nhiều-thành-một chứ không một-đối-một: `sofa` cũng là chỗ ngồi nên nó đặt
 * xuống thành `'chair'`, và `technical` không có loại riêng trong miền nên nó
 * rơi vào `'other'`. Chiều ngược lại không tồn tại — `'stair'` là một
 * `FurnitureKind` hợp lệ mà không nhóm thư viện nào sinh ra, vì cầu thang không
 * phải thứ kéo từ panel này vào.
 */
export const FURNITURE_KIND_BY_LIBRARY_GROUP = {
  bed: 'bed',
  chair: 'chair',
  kitchen: 'kitchenCabinet',
  sanitary: 'sanitaryFixture',
  sofa: 'chair',
  storage: 'wardrobe',
  table: 'table',
  technical: 'other',
} as const satisfies Record<LibraryGroup, FurnitureKind>;

const wireLibraryGroupSchema = z.enum(LIBRARY_GROUPS);
const wireLibrarySourceSchema = z.enum(LIBRARY_SOURCES);

/* -------------------------------------------------------------------------- */
/* Một mục thư viện.                                                           */
/* -------------------------------------------------------------------------- */

export const LibraryItemSchema = z
  .object({
    depthMm: positiveIntegerSchema,
    fileSizeBytes: positiveIntegerSchema,
    group: wireLibraryGroupSchema,
    heightMm: positiveIntegerSchema,
    id: idSchema,
    modelUrl: z.string().url(),
    name: z.string().min(1),
    previewUrl: z.string().url().optional(),
    source: wireLibrarySourceSchema,
    triangleCount: positiveIntegerSchema,
    widthMm: positiveIntegerSchema,
  })
  .strict()
  .transform((wireItem) => ({
    depthMm: wireItem.depthMm,
    fileSizeBytes: wireItem.fileSizeBytes,
    furnitureKind: FURNITURE_KIND_BY_LIBRARY_GROUP[wireItem.group],
    group: wireItem.group,
    heightMm: wireItem.heightMm,
    id: wireItem.id,
    modelUrl: wireItem.modelUrl,
    name: wireItem.name,
    ...(wireItem.previewUrl !== undefined ? { previewUrl: wireItem.previewUrl } : {}),
    source: wireItem.source,
    triangleCount: wireItem.triangleCount,
    widthMm: wireItem.widthMm,
  }));

export type LibraryItem = z.infer<typeof LibraryItemSchema>;
export type LibraryItemWire = z.input<typeof LibraryItemSchema>;

/* -------------------------------------------------------------------------- */
/* Mười chip lọc.                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Đúng mười chip của panel, theo đúng thứ tự chúng hiện ra.
 *
 * `'all'` mở đầu và `'mine'` khép lại, tám nhóm loại ở giữa. Mảng này là thứ
 * hook duyệt để dựng hàng chip — nó không được tự liệt kê lại, vì một nhóm thêm
 * vào `LIBRARY_GROUPS` phải hiện ra trên màn mà không ai phải nhớ sửa hai chỗ.
 */
export const LIBRARY_FILTER_IDS = ['all', ...LIBRARY_GROUPS, 'mine'] as const;

export type LibraryFilterId = (typeof LIBRARY_FILTER_IDS)[number];

/**
 * Một mục có khớp chip đang chọn không.
 *
 * Ba nhánh, và cả ba đều cố ý:
 *
 * - `'all'` khớp MỌI mục, kể cả mục `'mine'`. Chip đầu tiên là "không lọc gì",
 *   không phải "chỉ bộ dựng sẵn".
 * - `'mine'` khớp khi `source === 'mine'`, BẤT KỂ nhóm. Đây là trục thứ hai:
 *   ghế của tôi vẫn là của tôi.
 * - Tám id còn lại khớp khi `group` trùng, BẤT KỂ nguồn. Ghế của tôi cũng vẫn
 *   là ghế, nên chip `Ghế` phải tìm ra nó.
 *
 * Thuần và không phụ thuộc thứ tự, nên ô tìm kiếm của màn lọc tiếp bên trên nó
 * mà không phải biết gì về hai trục này.
 */
export function matchesLibraryFilter(
  item: Pick<LibraryItem, 'group' | 'source'>,
  filterId: LibraryFilterId,
): boolean {
  if (filterId === 'all') {
    return true;
  }

  if (filterId === 'mine') {
    return item.source === 'mine';
  }

  return item.group === filterId;
}
