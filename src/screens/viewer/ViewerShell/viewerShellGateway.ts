/**
 * Cổng dữ liệu của VỎ CHUNG chín màn 3D — mọi lời gọi ra khỏi vỏ đi qua đây.
 *
 * Cùng khuôn `wallLayerReviewGateway.ts`, `roomLabelReviewGateway.ts` và
 * `thicknessStandardizationGateway.ts`: một bản kê khả năng, một `interface`
 * cho hình dạng, một factory dựng cổng thật và một factory dựng cổng có dữ
 * liệu cho story và bài kiểm (R-73). Khuôn được CHÉP LẠI chứ không nhập chéo
 * từ thư mục màn khác (R-68).
 *
 * ## Hai nguồn, và vì sao chúng khác nhau
 *
 * - **Tên dự án** là trạng thái máy chủ. {@link ViewerShellGateway.readProjectName}
 *   chỉ là hàm đọc; `useViewerShell.ts` bọc nó trong `useQuery` với khoá
 *   `queryKeys.project.detail(projectId)` của `@/lib/query`, nên `isLoading` và
 *   `error` là của react-query chứ không phải hai `useState` viết tay (R-64).
 * - **Tầng, phòng, diện tích** đọc từ ĐỒ THỊ KHÔNG GIAN trong kho
 *   (`state.spatial`). Đây là tiền lệ mà `wallLayerReviewGateway.ts` đã chốt
 *   ("mặc định là chính store"), và nó đúng ở đây vì không endpoint nào trả về
 *   ba con số ấy: `FloorSchema` không mang phòng.
 *
 *   {@link shellDataOf} cộng `Room.areaM2` — con số `src/domain` đã tính từ
 *   `outline` khi chuẩn hoá — chứ không tự tính lại diện tích đa giác. Tính lại
 *   ở đây là dựng bản thứ hai của một phép đo đã có test đạt ngưỡng 90% (R-61).
 *
 * ## Một việc chưa có đường: đếm phòng của CẢ TOÀ NHÀ
 *
 * `SpatialSlice.spatial` giữ đồ thị của **những tầng đã nạp**, và `FloorSchema`
 * (`src/api/schemas/index.ts:141`) KHÔNG mang phòng — nó chỉ có
 * `areaM2`/`elevationMm`/`heightMm`/`name`/`order`. Nên khi kho mới nạp một
 * tầng, thanh trạng thái nói đúng số phòng của những tầng đang có chứ không
 * bịa con số của cả toà. {@link VIEWER_MISSING_CAPABILITIES} khai thẳng khoảng
 * trống ấy và {@link ViewerShellData.isPartial} nói ra nó, thay vì hiện một
 * tổng số mà không lượt đọc nào chứng minh được (E.10). Không ai được bịa một
 * endpoint để lấp chỗ đó.
 */

import { normalizeSpatial, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type { Level, LevelId, Room, Wall } from '@/domain/spatial/types';
import type { PointMm } from '@/domain/units/compare';
import { totalArea } from '@/domain/rooms/area';
import { squareMetres, type SquareMetres } from '@/domain/units/types';
import type { ApiClient } from '@/api/client';
import { mockApiClient } from '@/api/__mocks__/client';
import type { ProjectRole } from '@/types/project';

import { toPointMm, VIEWER_FIXTURE_GRAPH } from './viewerShellFixture';

/* -------------------------------------------------------------------------- */
/* Bản kê khả năng.                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Những việc vỏ CẦN mà tầng dữ liệu chưa có đường.
 *
 * Ghi ra để người đọc sau không phải dò lại, và để không ai lấp bằng một
 * endpoint tự chế (R-69). Mỗi dòng là một tên hàm còn thiếu cộng lý do.
 */
export const VIEWER_MISSING_CAPABILITIES: readonly string[] = Object.freeze([
  'readBuildingRoomTotals — FloorSchema không mang phòng, và spatial.readFloor trả về đúng FloorSchema đó; số phòng của cả toà nhà vì thế chỉ đếm được trên những tầng kho đã nạp.',
]);

/* -------------------------------------------------------------------------- */
/* Hình dạng dữ liệu vỏ đọc.                                                   */
/* -------------------------------------------------------------------------- */

/** Một tầng, rút gọn về đúng những gì vỏ vẽ. */
export interface ViewerStorey {
  readonly id: LevelId;
  readonly name: string;
  readonly order: number;
  readonly elevationMm: number;
  readonly heightMm: number;
}

/** Tất cả những gì vỏ cần để dựng viewmodel. */
export interface ViewerShellData {
  readonly storeys: readonly ViewerStorey[];
  readonly roomCount: number;
  readonly totalAreaM2: SquareMetres;
  /**
   * Đồ thị mới nạp một phần: có tầng nhưng chưa có phòng của mọi tầng.
   *
   * Đây là nguồn thật của trạng thái `partial` trong bảy trạng thái A11 —
   * xem "Một việc chưa có đường" ở đầu file.
   */
  readonly isPartial: boolean;
}

/** Cổng của vỏ. Hai lượt đọc, không lượt ghi nào — vỏ không sửa mô hình. */
export interface ViewerShellGateway {
  /** Tên dự án cho breadcrumb. `null` khi chưa có, không bao giờ ném. */
  readonly readProjectName: (projectId: string) => Promise<string | null>;
  /** Tầng, phòng, diện tích của mô hình đang xem. */
  readonly readShellData: () => ViewerShellData;
}

/* -------------------------------------------------------------------------- */
/* Đọc từ đồ thị không gian.                                                   */
/* -------------------------------------------------------------------------- */

const EMPTY_STOREYS: readonly ViewerStorey[] = Object.freeze([]);

/** Đồ thị rỗng — không tầng, không phòng. Dùng khi kho chưa nạp gì. */
export const EMPTY_SHELL_DATA: ViewerShellData = Object.freeze({
  storeys: EMPTY_STOREYS,
  roomCount: 0,
  totalAreaM2: squareMetres(0),
  isPartial: false,
});

/** Những tầng của một đồ thị, đã sắp từ dưới lên. */
export function storeysOf(spatial: NormalizedSpatial | null): readonly ViewerStorey[] {
  if (spatial === null) {
    return EMPTY_STOREYS;
  }

  const storeys: ViewerStorey[] = [];

  for (const id of spatial.byKind.level) {
    const entity = spatial.byId[id];

    if (entity !== undefined && 'order' in entity && 'elevationMm' in entity) {
      const storey = entity as Level;
      storeys.push({
        id: storey.id,
        name: storey.name,
        order: storey.order,
        elevationMm: storey.elevationMm,
        heightMm: storey.heightMm,
      });
    }
  }

  return storeys.sort((left, right) => left.order - right.order);
}

/** Những tầng CÓ ít nhất một phòng trong đồ thị. */
function storeysWithRooms(spatial: NormalizedSpatial): ReadonlySet<string> {
  const seen = new Set<string>();

  for (const id of spatial.byKind.room) {
    const entity = spatial.byId[id];

    if (entity !== undefined && 'levelId' in entity) {
      seen.add((entity as Room).levelId);
    }
  }

  return seen;
}

/**
 * Đọc cả ba con số của thanh trạng thái từ một đồ thị.
 *
 * Diện tích đi qua `totalArea` của `src/domain/rooms/area.ts` — ĐÚNG hàm mà
 * `selectTotalAreaM2` gọi. Nó cộng milimét vuông rồi làm tròn MỘT lần ở cuối,
 * cố ý khác với việc cộng những con số `areaM2` đã làm tròn sẵn; hai cách cho
 * hai tổng khác nhau, và nếu vỏ chọn cách thứ hai thì thanh trạng thái sẽ cãi
 * nhau với mọi chỗ khác trong sản phẩm.
 */
export function shellDataOf(spatial: NormalizedSpatial | null): ViewerShellData {
  if (spatial === null) {
    return EMPTY_SHELL_DATA;
  }

  const storeys = storeysOf(spatial);
  const roomIds = spatial.byKind.room;
  const withRooms = storeysWithRooms(spatial);

  const outlines: (readonly PointMm[])[] = [];

  for (const id of roomIds) {
    const entity = spatial.byId[id];

    if (entity !== undefined && 'outline' in entity) {
      outlines.push((entity as Room).outline.map(toPointMm));
    }
  }

  return {
    storeys,
    roomCount: roomIds.length,
    totalAreaM2: totalArea(outlines),
    isPartial: storeys.length > 0 && withRooms.size < storeys.length,
  };
}

/* -------------------------------------------------------------------------- */
/* Hộp bao mặt bằng.                                                           */
/* -------------------------------------------------------------------------- */

/** Hình chiếu bằng của mô hình, milimét, theo toạ độ bản vẽ (`x`, `y`). */
export interface ViewerFootprintMm {
  readonly minXMm: number;
  readonly minYMm: number;
  readonly maxXMm: number;
  readonly maxYMm: number;
}

/** Mặt bằng rỗng — dùng khi chưa có phòng và chưa có tường nào. */
export const EMPTY_FOOTPRINT: ViewerFootprintMm = Object.freeze({
  minXMm: 0,
  minYMm: 0,
  maxXMm: 0,
  maxYMm: 0,
});

/**
 * Hình chiếu bằng của cả mô hình, đọc từ `outline` của phòng và tim tường.
 *
 * Đây là hộp bao của DỮ LIỆU, không phải của lưới đã dựng: `boundsOfIds`
 * (`camera/frameObjects.ts`) mới đọc `Object3D`, và vỏ không giữ cảnh nào để
 * đọc. Hai nguồn không mâu thuẫn — tường dày ra hai bên tim một nửa độ dày,
 * nên hộp này hẹp hơn hộp lưới đúng nửa bức tường, và `frameViewpoint` vốn đã
 * chừa mười lăm phần trăm khung hình.
 */
export function footprintOf(spatial: NormalizedSpatial | null): ViewerFootprintMm {
  if (spatial === null) {
    return EMPTY_FOOTPRINT;
  }

  let minXMm = Number.POSITIVE_INFINITY;
  let minYMm = Number.POSITIVE_INFINITY;
  let maxXMm = Number.NEGATIVE_INFINITY;
  let maxYMm = Number.NEGATIVE_INFINITY;

  const widen = (xMm: number, yMm: number): void => {
    minXMm = Math.min(minXMm, xMm);
    minYMm = Math.min(minYMm, yMm);
    maxXMm = Math.max(maxXMm, xMm);
    maxYMm = Math.max(maxYMm, yMm);
  };

  for (const id of spatial.byKind.room) {
    const entity = spatial.byId[id];

    if (entity !== undefined && 'outline' in entity) {
      for (const corner of (entity as Room).outline) {
        widen(corner.x, corner.y);
      }
    }
  }

  for (const id of spatial.byKind.wall) {
    const entity = spatial.byId[id];

    if (entity !== undefined && 'centreline' in entity) {
      const { centreline } = entity as Wall;
      widen(centreline.start.x, centreline.start.y);
      widen(centreline.end.x, centreline.end.y);
    }
  }

  if (!Number.isFinite(minXMm)) {
    return EMPTY_FOOTPRINT;
  }

  return { minXMm, minYMm, maxXMm, maxYMm };
}

/* -------------------------------------------------------------------------- */
/* Cổng thật.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Cổng nối vào máy chủ và vào kho.
 *
 * `readShellData` nhận đồ thị qua tham số chứ không tự đọc kho: một cổng đọc
 * kho bên trong sẽ không kiểm được nếu không dựng cả `zustand`, và hook là nơi
 * đã có `useStore` sẵn.
 */
export function createViewerShellGateway(
  readSpatial: () => NormalizedSpatial | null,
  apiClient: ApiClient = mockApiClient,
): ViewerShellGateway {
  return {
    readProjectName: async (projectId: string): Promise<string | null> => {
      const result = await apiClient.projects.read({ projectId });

      return result.ok ? result.data.name : null;
    },
    readShellData: (): ViewerShellData => shellDataOf(readSpatial()),
  };
}

/* -------------------------------------------------------------------------- */
/* Cổng có dữ liệu — story và bài kiểm.                                        */
/* -------------------------------------------------------------------------- */

/** Đồ thị của bộ mẫu, chuẩn hoá đúng một lần. */
export const VIEWER_FIXTURE_SPATIAL: NormalizedSpatial = normalizeSpatial(VIEWER_FIXTURE_GRAPH);

/** Đồ thị "một phần": đủ bốn tầng, nhưng mới có phòng của tầng dưới cùng. */
export const VIEWER_PARTIAL_SPATIAL: NormalizedSpatial = normalizeSpatial({
  ...VIEWER_FIXTURE_GRAPH,
  rooms: VIEWER_FIXTURE_GRAPH.rooms.filter((room) => room.levelId === 'L-01'),
});

/** Đồ thị rỗng: toà nhà chưa dựng được tầng nào. */
export const VIEWER_EMPTY_SPATIAL: NormalizedSpatial = normalizeSpatial({
  ...VIEWER_FIXTURE_GRAPH,
  levels: [],
  walls: [],
  rooms: [],
});

/** Cổng giả cho story và bài kiểm — cùng bộ mẫu, không bảng dữ liệu thứ hai. */
export function createViewerShellFixtureGateway(
  spatial: NormalizedSpatial | null = VIEWER_FIXTURE_SPATIAL,
  projectName: string | null = VIEWER_FIXTURE_GRAPH.building.name,
): ViewerShellGateway {
  return {
    readProjectName: (): Promise<string | null> => Promise.resolve(projectName),
    readShellData: (): ViewerShellData => shellDataOf(spatial),
  };
}

/** Vai nào được dùng công cụ sửa trên ray. Xem `useViewerShell.ts`. */
export const EDITING_ROLES: readonly ProjectRole[] = Object.freeze(['admin', 'engineer']);
