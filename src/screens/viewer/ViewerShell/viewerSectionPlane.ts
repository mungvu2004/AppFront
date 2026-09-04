/**
 * Mặt phẳng cắt của vỏ 3D — công cụ "mặt cắt" trên ray, và góc nhìn "Mặt cắt"
 * trên thanh trên.
 *
 * File `.ts` THUẦN: không JSX, không React, không three.js, không `src/api` /
 * `src/store` / `src/lib/http`. Cùng khuôn `thicknessPreviewGeometry.ts`.
 *
 * ## Vì sao trả về bốn con số chứ không trả về `Plane`
 *
 * Giá trị này đi qua props của một view ({@link ViewerSectionPlaneValue}), và
 * một view không nên phải nhập three.js chỉ để đọc kiểu của chính nó — nhập
 * vào là kéo cả thư viện vào chunk của route mà cổng kích thước gói phải trả
 * tiền. Bốn số theo đúng quy ước `Plane` của three.js (`normal · p + constant
 * = 0`) nên phía dựng cảnh đổi sang `Plane` bằng một dòng, không phải dịch
 * nghĩa.
 *
 * Cái giá phải trả nếu làm ngược lại đã có tiền lệ trong repo: `mount.ts` giữ
 * three.js ở `src/lib/three` và màn `/login` chỉ nhận một `PresentationHandle`.
 *
 * ## Ba trục, và vì sao mặc định là trục đứng
 *
 * Người soát cắt ngang để đọc mặt bằng ở một cao độ, và cắt dọc để đọc mặt
 * cắt. Cắt ngang (`horizontal`) là việc thường xuyên hơn nhiều, nên nó là
 * mặc định: pháp tuyến hướng lên, phần **dưới** mặt phẳng được giữ lại — nhìn
 * từ trên xuống thấy lòng nhà, đúng nghĩa "mặt bằng cắt".
 *
 * ## Vị trí cắt là một TỈ LỆ, không phải một cao độ
 *
 * Cùng lý do `viewerStoreyStack.ts` để độ tách là bội số: nếu thanh trượt nói
 * "cắt ở 4200 mm" thì nó vô nghĩa với một nhà một tầng và với một nhà mười
 * tầng. {@link sectionPlaneFor} nhận `position` trong đoạn [0, 1] và ánh xạ
 * vào hộp bao thật của mô hình, nên đầu thanh trượt luôn là đáy nhà và cuối
 * thanh trượt luôn là nóc nhà, ở mọi dự án.
 */

import type { ViewerSectionPlaneValue } from './viewerShellTypes';

/* -------------------------------------------------------------------------- */
/* Trục cắt.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Ba hướng cắt.
 *
 * `horizontal` cắt ngang (pháp tuyến theo +Y); `longitudinal` và `transverse`
 * là hai mặt cắt đứng vuông góc nhau — tên của bản vẽ kiến trúc, không phải
 * `x`/`z`, vì người đọc bản vẽ gọi chúng như vậy.
 */
export type ViewerSectionAxis = 'horizontal' | 'longitudinal' | 'transverse';

/** Trục cắt mặc định — xem ghi chú đầu file. */
export const DEFAULT_SECTION_AXIS: ViewerSectionAxis = 'horizontal';

/** Vị trí mặc định: đúng giữa hộp bao. */
export const DEFAULT_SECTION_POSITION = 0.5;

/** Hai đầu của thanh trượt vị trí cắt. Không thứ nguyên. */
export const MIN_SECTION_POSITION = 0;
export const MAX_SECTION_POSITION = 1;

/**
 * Pháp tuyến của từng trục, hướng về phía bị **bỏ đi**.
 *
 * Quy ước `Plane` của three.js giữ lại nửa không gian ở phía âm của pháp
 * tuyến, nên `horizontal` có pháp tuyến `+Y`: phần trên bị cắt bỏ và người
 * dùng nhìn xuống lòng nhà.
 */
const AXIS_NORMALS: Readonly<Record<ViewerSectionAxis, readonly [number, number, number]>> =
  Object.freeze({
    horizontal: Object.freeze([0, 1, 0] as const),
    longitudinal: Object.freeze([1, 0, 0] as const),
    transverse: Object.freeze([0, 0, 1] as const),
  });

/* -------------------------------------------------------------------------- */
/* Hộp bao.                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Hộp bao của mô hình, MÉT — cùng đơn vị mọi thứ sau `build/scene.ts`.
 *
 * Cố ý không phải `Box3` của three.js, cùng lý do đầu file.
 */
export interface ViewerBoundsM {
  readonly minX: number;
  readonly minY: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly maxZ: number;
}

/** Ép vị trí cắt về [0, 1]; số hỏng về giữa hộp. */
export function clampSectionPosition(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_SECTION_POSITION;
  }

  return Math.min(MAX_SECTION_POSITION, Math.max(MIN_SECTION_POSITION, value));
}

/** Hai đầu của hộp bao dọc theo một trục, MÉT. */
export function axisRangeM(
  bounds: ViewerBoundsM,
  axis: ViewerSectionAxis,
): readonly [number, number] {
  switch (axis) {
    case 'horizontal':
      return [bounds.minY, bounds.maxY];
    case 'longitudinal':
      return [bounds.minX, bounds.maxX];
    case 'transverse':
      return [bounds.minZ, bounds.maxZ];
  }
}

/**
 * Chỗ mặt phẳng cắt đi qua, MÉT trên trục của nó.
 *
 * Nội suy tuyến tính giữa hai đầu hộp bao — không làm tròn, không `toFixed`:
 * đây là toạ độ cảnh, người dùng không đọc con số này.
 */
export function sectionDistanceM(
  bounds: ViewerBoundsM,
  axis: ViewerSectionAxis,
  position: number,
): number {
  const [low, high] = axisRangeM(bounds, axis);

  return low + (high - low) * clampSectionPosition(position);
}

/* -------------------------------------------------------------------------- */
/* Mặt phẳng.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Mặt phẳng cắt cho một hộp bao, một trục và một vị trí.
 *
 * `constant` là `−(normal · điểm trên mặt phẳng)`, đúng quy ước `Plane` của
 * three.js: điểm nào cho `normal · p + constant` âm thì được giữ lại. Vì pháp
 * tuyến của mỗi trục chỉ có một thành phần khác không, tích vô hướng rút gọn
 * thành đúng khoảng cách trên trục đó.
 */
export function sectionPlaneFor(
  bounds: ViewerBoundsM,
  axis: ViewerSectionAxis,
  position: number,
): ViewerSectionPlaneValue {
  const [normalX, normalY, normalZ] = AXIS_NORMALS[axis];

  return {
    normalX,
    normalY,
    normalZ,
    constant: -sectionDistanceM(bounds, axis, position),
  };
}

/**
 * Điểm này có bị mặt phẳng cắt bỏ đi không? MÉT.
 *
 * Bài kiểm dùng hàm này để khẳng định bằng hình học thay vì bằng bốn con số:
 * "nóc nhà bị cắt, nền nhà thì không" đọc được, còn `constant === -4.2` thì
 * không.
 */
export function isClipped(
  plane: ViewerSectionPlaneValue,
  x: number,
  y: number,
  z: number,
): boolean {
  return plane.normalX * x + plane.normalY * y + plane.normalZ * z + plane.constant > 0;
}
