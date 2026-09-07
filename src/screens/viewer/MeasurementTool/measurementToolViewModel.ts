/**
 * Phần THUẦN của màn đo: từ những cú chấm ra một phép đo, và từ một phép đo ra
 * những con số màn hình.
 *
 * Tách khỏi `useMeasurementTool.ts` vì hai lý do, không phải vì độ dài:
 *
 * 1. `renderScene` được gọi TRONG lượt vẽ của `ViewerViewport`, tức sau khi hook
 *    đã trả về — nên phép dựng props không được là một hook, và một phép thuần
 *    thì bài kiểm gọi được không cần dựng cây React. Cùng lý do
 *    `explodedViewPropsOf` tách khỏi `useExplodedView`.
 * 2. R-22 giữ mỗi file dưới 400 dòng, và một hook đã ôm cả bắn tia, phím tắt,
 *    truy vấn và bảy trạng thái thì không còn chỗ cho phần số học.
 *
 * KHÔNG một phép đo nào được tính ở đây. Bốn hàm của `src/domain/measure` làm
 * hết, một hàm cho mỗi chế độ, và file này chỉ chọn đúng hàm rồi đưa kết quả đi
 * (R-61). Không một phép quy đổi đơn vị nào ở đây: mét → milimét đi qua
 * `metresToMillimetres` của `src/domain/units`, milimét → đơn vị hiển thị đi qua
 * `formatLength`/`formatArea` trong `measurementToolGateway.ts`.
 */

import { Vector3, type Camera, type Object3D } from 'three';

import {
  elevationOf,
  measureDistance,
  measureHeight,
  measurePointToPlane,
  measurePolygonArea,
  squareMillimetres,
  type MeasurePoint,
  type Measurement,
} from '@/domain/measure/measure';
import { metres, metresToMillimetres } from '@/domain/units/types';
import type { LayerStates } from '@/lib/selection/selectionOps';
import type { MergeResult } from '@/lib/three/build/merge';
import { scenePoint } from '@/lib/three/build/scene';
import type { ViewportSize } from '@/lib/three/interaction/raycast';
import type { ViewerScreenState } from '@/screens/viewer/ViewerShell/viewerShellTypes';

import type {
  MeasureMode,
  MeasurementScreenState,
  PinnedMeasurement,
  ScreenPoint,
} from './measurementToolTypes';

/* -------------------------------------------------------------------------- */
/* Cảnh 3D, tiêm từ ngoài.                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Cảnh mà màn đo bắn tia vào và chiếu điểm qua.
 *
 * Màn đo KHÔNG dựng canvas và KHÔNG dựng cảnh: `MeasurementToolProps` không có
 * `canvasRef`, và `MeasurementTool.tsx` là một lớp phủ `pointer-events-none`.
 * Cảnh do module cảnh của màn dựng và do container truyền xuống, nên chi phí
 * kích thước gói của `src/lib/three/build` nằm ở đó chứ không ở hook — cổng
 * `routeChunk` chỉ còn 0,3 KiB và một lượt nhập tĩnh ở đây sẽ vỡ nó.
 *
 * Vắng cảnh thì không chấm được điểm và `screenPoints` là `null`; danh sách,
 * đổi đơn vị, ẩn hiện, xoá và hoàn tác vẫn chạy đủ.
 */
export interface MeasurementScene {
  readonly camera: Camera;
  /** Cây con để bắn tia — chồng tầng đã dựng, không phải cả `Scene`. */
  readonly root: Object3D;
  /** Kích thước canvas, đọc lúc bắn tia để một lượt đổi cỡ không phải nối lại dây. */
  readonly viewport: () => ViewportSize;
  readonly merge?: () => MergeResult | null;
  readonly layers?: () => LayerStates;
}

/** Chiếu một điểm thế giới xuống pixel khung nhìn; `null` khi ngoài khung nhìn. */
export type ScreenProjector = (point: MeasurePoint) => ScreenPoint | null;

/* -------------------------------------------------------------------------- */
/* Đổi toạ độ.                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Điểm bắn tia (thế giới, MÉT) thành `MeasurePoint` của domain (MILIMÉT).
 *
 * Hai chuyện đổi ở đây, và cả hai đều đã có chủ:
 *
 * - **Đơn vị.** Cảnh đo bằng mét (`RayIntersection.distance` nói rõ), domain đo
 *   bằng milimét. `metresToMillimetres` là phép đổi chính thức; con số 1000
 *   không xuất hiện, và không được xuất hiện — sai một chữ số ở đây thì bài
 *   nghiệm thu 4250 mm lệch một nghìn lần.
 * - **Trục.** `src/lib/three/build/scene.ts` khai đúng MỘT lần rằng
 *   `plan.x → scene.x`, `plan.y → scene.z`, cao độ → `scene.y`. Đây là chiều
 *   ngược của phép ấy, và {@link projectorFor} là chiều xuôi qua chính
 *   `scenePoint` của file đó — nên hai chiều không thể lệch nhau về sau.
 */
export function toMeasurePoint(world: Vector3): MeasurePoint {
  return {
    x: metresToMillimetres(metres(world.x)),
    y: metresToMillimetres(metres(world.z)),
    z: metresToMillimetres(metres(world.y)),
  };
}

/** Nửa bề rộng của không gian thiết bị chuẩn hoá: từ -1 đến 1. */
const NDC_SPAN = 2;

/** Gốc của không gian ấy so với mép trái/trên: -1. */
const NDC_ORIGIN = 1;

/** Ngoài đoạn này theo trục sâu là sau lưng camera hoặc quá mặt phẳng xa. */
const NDC_NEAR = -1;
const NDC_FAR = 1;

/**
 * Phép chiếu thế giới → NDC → pixel của một cảnh.
 *
 * Đây là lý do `ScreenPoint` tồn tại: view thuần không được biết camera (R-60),
 * nên nếu hook không chiếu thì không ai chiếu được. `Vector3.project` của
 * three.js làm phần phối cảnh; hai dòng còn lại là phép đặt NDC lên khung nhìn,
 * đúng nghịch đảo của `toNormalizedDevice` trong `raycast.ts`.
 *
 * Một vector dùng lại cho mọi lượt chiếu: hàm này chạy cho từng điểm của từng
 * phép đo mỗi khung hình, và ba mươi lượt cấp phát một giây rơi đúng vào lúc
 * camera đang bay.
 */
export function projectorFor(scene: MeasurementScene): ScreenProjector {
  const scratch = new Vector3();

  return (point) => {
    const viewport = scene.viewport();

    // Một canvas không có bề rộng thì không có không gian cắt nào để chiếu vào.
    if (viewport.width <= 0 || viewport.height <= 0) {
      return null;
    }

    const projected = scratch
      .copy(scenePoint(point, elevationOf(point)))
      .project(scene.camera);

    if (
      !Number.isFinite(projected.x) ||
      !Number.isFinite(projected.y) ||
      projected.z < NDC_NEAR ||
      projected.z > NDC_FAR
    ) {
      return null;
    }

    return {
      x: ((projected.x + NDC_ORIGIN) / NDC_SPAN) * viewport.width,
      y: ((NDC_ORIGIN - projected.y) / NDC_SPAN) * viewport.height,
    };
  };
}

/**
 * Chiếu cả một chuỗi điểm; `null` khi có bất kỳ điểm nào không chiếu được.
 *
 * Cả chuỗi hoặc không gì: một đường đo vẽ bằng nửa số điểm là một đường đo chỉ
 * sang chỗ khác, và đó tệ hơn việc không vẽ nó.
 */
export function projectAll(
  points: readonly MeasurePoint[],
  project: ScreenProjector | null,
): readonly ScreenPoint[] | null {
  if (project === null) {
    return null;
  }

  const screenPoints: ScreenPoint[] = [];

  for (const point of points) {
    const projected = project(point);

    if (projected === null) {
      return null;
    }

    screenPoints.push(projected);
  }

  return screenPoints;
}

/* -------------------------------------------------------------------------- */
/* Một cú chấm.                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Một điểm người dùng đã chấm, kèm pháp tuyến bề mặt tại chỗ chấm.
 *
 * Pháp tuyến đi cùng điểm chứ không nằm rời ra, vì chỉ chế độ "vuông góc với bề
 * mặt" cần nó và nó phải là pháp tuyến của ĐÚNG cú chấm thứ hai — một pháp
 * tuyến giữ riêng ở đâu đó sẽ sống sót qua một lượt Esc và trả lời cho một mặt
 * phẳng không còn ai chọn.
 */
export interface MeasurePick {
  readonly point: MeasurePoint;
  /** Không gian thế giới, đã chuẩn hoá. `null` khi tia không trả pháp tuyến nào. */
  readonly normal: Vector3 | null;
}

/* -------------------------------------------------------------------------- */
/* Bốn chế độ, bốn hàm domain.                                                 */
/* -------------------------------------------------------------------------- */

/** Số điểm tối thiểu mỗi chế độ cần trước khi có gì để đọc. */
export const REQUIRED_POINTS: Readonly<Record<MeasureMode, number>> = {
  pointToPoint: 2,
  perpendicular: 2,
  height: 2,
  floorArea: 3,
};

/**
 * Kết quả một lượt đo.
 *
 * `noSurface` là một câu trả lời, không phải một lỗi kỹ thuật: tia trúng một
 * lưới gộp không mang thuộc tính pháp tuyến, nên không có mặt phẳng nào để đo
 * tới. Đó là trạng thái 4 của A11, và tuyệt đối không phải chỗ để đoán một pháp
 * tuyến — đoán ở đây là in một con số mà bản vẽ không hề chứa.
 */
export type MeasureAttempt =
  | { readonly kind: 'pending' }
  | { readonly kind: 'measured'; readonly measurement: Measurement }
  | { readonly kind: 'noSurface' };

const PENDING: MeasureAttempt = Object.freeze({ kind: 'pending' });
const NO_SURFACE: MeasureAttempt = Object.freeze({ kind: 'noSurface' });

const measured = (measurement: Measurement | null): MeasureAttempt =>
  measurement === null ? PENDING : { kind: 'measured', measurement };

/**
 * Một lượt đo, bằng ĐÚNG một hàm domain cho mỗi chế độ.
 *
 * | Chế độ | Hàm |
 * |---|---|
 * | `pointToPoint` | `measureDistance` |
 * | `perpendicular` | `measurePointToPlane` — pháp tuyến lấy từ `EntityHit.normal` |
 * | `height` | `measureHeight` |
 * | `floorArea` | `measurePolygonArea` |
 *
 * Không hàm nào khác, và không một phép cộng trừ nào ở đây thay cho chúng.
 */
export function attemptMeasure(
  mode: MeasureMode,
  picks: readonly MeasurePick[],
): MeasureAttempt {
  if (picks.length < REQUIRED_POINTS[mode]) {
    return PENDING;
  }

  const first = picks[0];
  const second = picks[1];

  if (mode === 'floorArea') {
    return measured(measurePolygonArea(picks.map((pick) => pick.point)));
  }

  if (first === undefined || second === undefined) {
    return PENDING;
  }

  if (mode === 'height') {
    return measured(measureHeight(first.point, second.point));
  }

  if (mode === 'pointToPoint') {
    return measured(measureDistance(first.point, second.point));
  }

  // Cú chấm thứ hai đặt tên cho mặt phẳng: điểm của nó là một điểm trên mặt, và
  // pháp tuyến của nó là hướng của mặt. Thiếu pháp tuyến thì không có mặt nào.
  if (second.normal === null) {
    return NO_SURFACE;
  }

  return measured(measurePointToPlane(first.point, second.point, second.normal));
}

/**
 * Giá trị thô của một phép đo — milimét, hoặc milimét vuông cho một diện tích.
 *
 * Trường này không bao giờ in thẳng; nó chỉ để so sánh và sắp xếp, nên nó mang
 * đúng thứ nguyên của chính phép đo thay vì bị ép về milimét.
 */
export function rawValueOf(measurement: Measurement): PinnedMeasurement['rawValueMm'] {
  switch (measurement.kind) {
    case 'distance':
    case 'perpendicular':
      return measurement.lengthMm;
    case 'height':
      return measurement.heightMm;
    case 'area':
      return squareMillimetres(measurement.areaMm2);
    case 'chain':
      return measurement.totalMm;
    case 'angle':
      // Không chế độ nào của màn sinh ra một phép đo góc; nhánh này chỉ tồn tại
      // để `switch` là toàn phần và để một chế độ thứ năm không lọt qua im lặng.
      return measurement.armsMm[0];
  }
}

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái: của MÀN sang của VỎ.                                        */
/* -------------------------------------------------------------------------- */

/**
 * Bảy trạng thái riêng của màn đo, đặt lên bảy trạng thái của vỏ.
 *
 * Hai bảng không trùng tên nhau ở hai chỗ, và cả hai đều có lý: "đang đo" là
 * lượt chờ của màn này nên nó ngồi vào ô `loading` của vỏ, còn "xong" là
 * `success`. Vỏ vẽ chrome theo bảng của nó; view của màn đọc bảng của màn.
 */
export const VIEWER_STATE_BY_MEASUREMENT: Readonly<
  Record<MeasurementScreenState, ViewerScreenState>
> = {
  empty: 'empty',
  measuring: 'loading',
  partial: 'partial',
  error: 'error',
  ready: 'success',
  forbidden: 'forbidden',
  collapsed: 'collapsed',
};
