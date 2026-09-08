/**
 * Tab "Trực quan" của S-33 — hình học và khung nhìn, không có React.
 *
 * Tách khỏi `useVersionHistory.ts` vì R-22. Nội dung ở đây trả lời đúng một câu hỏi:
 * **dựng được cảnh 3D không, và dựng bằng gì.**
 *
 * Nhắc lại quyết định đã duyệt ở docblock đầu `types.ts`, vì đây là nơi nó thành mã:
 * tab này dựng mô hình **HIỆN TẠI**, không dựng lại một phiên bản CŨ. `VersionSnapshot`
 * (`versioning/diff.ts:11`) là `Record<EntityKind, Record<string, EntityRecord>>` và
 * không có bộ đổi nào từ nó sang `NormalizedSpatial` — viết bộ đổi ấy là thêm logic
 * miền, mà R-68 cấm chạm `src/domain` và R-69 cấm tự chế. Nên cảnh lấy đồ thị hiện
 * tại, còn `VisualDiffModel.caption` nói thẳng điều đó ra cho người đọc.
 */

import { isEntityOfKind, type NormalizedSpatial } from '@/domain/spatial/normalize';
import { toBuildFloorInput } from '@/domain/spatial/toBuildFloorInput';
import { millimetres, millimetresToMetres, RADIANS_PER_TURN } from '@/domain/units/types';
import { formatNumber } from '@/lib/format/number';
import type { BuildFloorInput } from '@/lib/three/build/floor';
import type { VersionDiff } from '@/lib/versioning/diff';
import type { ViewerSceneFrame } from '@/screens/viewer/ViewerShell/viewerShellTypes';

import type { VersionHistoryCapabilities, VisualDiffModel } from './types';
import { changedEntityIdsOf } from './versionHistoryModel';

/* -------------------------------------------------------------------------- */
/* 1 — Câu nói ra khi không dựng được                                         */
/* -------------------------------------------------------------------------- */

/** Nơi ráp không cấp đường dựng cảnh nào. */
export const NO_SCENE_REASON = 'màn này chưa nối được vào bộ dựng cảnh 3D';

/** Chưa có đồ thị không gian trong kho — chưa tầng nào để dựng. */
export const NO_MODEL_REASON = 'chưa có mô hình không gian nào được nạp, nên chưa dựng được cảnh';

/** Có đồ thị nhưng nó không thành hình được. */
export const BROKEN_MODEL_REASON =
  'mô hình hiện tại chưa dựng được thành cảnh, nên tab này để trống';

/* -------------------------------------------------------------------------- */
/* 2 — Đồ thị thành đầu vào dựng sàn                                          */
/* -------------------------------------------------------------------------- */

const EMPTY_LEVELS: readonly BuildFloorInput[] = Object.freeze([]);

export interface SceneConversion {
  readonly levels: readonly BuildFloorInput[];
  /** Đồ thị có nhưng không thành hình được — khác hẳn với "chưa có đồ thị nào". */
  readonly failed: boolean;
}

/** Chưa có gì để dựng, và cũng chưa có gì hỏng. */
export const NO_SCENE: SceneConversion = Object.freeze({ levels: EMPTY_LEVELS, failed: false });

/**
 * Đồ thị không gian thành đầu vào dựng sàn, một mục cho mỗi tầng.
 *
 * Khuôn chép từ `useViewer3D.ts:402-425`. `toBuildFloorInput` NÉM khi đồ thị hỏng chỉ
 * mục hoặc mang số đo không hữu hạn: đó là một mô hình không dựng được, không phải sự
 * cố kỹ thuật để hiện mã lỗi — nó thành một câu giải thích trên tab.
 *
 * Mã tầng lấy qua `isEntityOfKind('level', …)` chứ không ép kiểu: `byKind.level` khai
 * kiểu là `EntityId[]`, và `toBuildFloorInput` đòi đúng `LevelId`.
 */
export function convertScene(graph: NormalizedSpatial | null): SceneConversion {
  if (graph === null) {
    return NO_SCENE;
  }

  try {
    const levels: BuildFloorInput[] = [];

    for (const id of graph.byKind.level) {
      const entity = graph.byId[id];

      if (entity === undefined || !isEntityOfKind('level', entity)) {
        continue;
      }

      const input = toBuildFloorInput(graph, entity.id);

      if (input !== null) {
        levels.push(input);
      }
    }

    return { levels, failed: false };
  } catch {
    return { levels: EMPTY_LEVELS, failed: true };
  }
}

/** Vì sao tab "Trực quan" không dựng được cảnh; `null` khi nó dựng được. */
export function unavailableReasonOf(
  canShowCurrentModel3d: boolean,
  graph: NormalizedSpatial | null,
  scene: SceneConversion,
): string | null {
  if (!canShowCurrentModel3d) {
    return NO_SCENE_REASON;
  }
  if (graph === null) {
    return NO_MODEL_REASON;
  }
  if (scene.failed || scene.levels.length === 0) {
    return BROKEN_MODEL_REASON;
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* 3 — Khung nhìn mở đầu                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Vòng quay nghỉ của khung nhìn mở đầu, tính theo vòng.
 *
 * Bốn hằng camera dưới đây lặp lại `DEFAULT_CAMERA_RIG`
 * (`lib/three/present/director.ts:54`) thay vì nhập nó về, và đó là một lượt đánh đổi
 * có cân: `director.ts` nhập `three` ở dòng đầu, nên một `import` từ đây kéo cả `three`
 * vào phần gói TĨNH của tuyến lịch sử phiên bản — mà cổng kích thước gói đo theo TỪNG
 * tuyến, và cảnh 3D của màn này cố ý chỉ được nhập động lúc người dùng mở tab này.
 * Cùng tiền lệ: `ViewerShell/useViewerShell.ts:346` cũng khai `AXONOMETRIC_POLAR_RAD`
 * của riêng nó thay vì dùng chung.
 */
const CAMERA_RESTING_TURN = 0.05;

/** Năm mươi độ, tính theo vòng: đủ dốc để đọc mặt bằng, đủ thấp để tường còn mặt. */
const CAMERA_ELEVATION_TURN = 50 / 360;

/** Khoảng trống chừa quanh mô hình sau khi khuôn hình, theo tỉ lệ bề rộng của nó. */
const CAMERA_MARGIN = 1.03;

/** Khoảng cách tối thiểu, cho một mô hình quá nhỏ để tự quyết định khuôn hình. */
const MIN_CAMERA_DISTANCE_M = 8;

/** Một phần tư vòng — góc chúc đo từ trục +Y, nên nó là mốc trừ đi độ cao camera. */
const QUARTER_TURN_RAD = RADIANS_PER_TURN / 4;

/** Bề rộng lớn nhất của các tầng, tính bằng mét; `null` khi không tầng nào có tường. */
function spanMetresOf(levels: readonly BuildFloorInput[]): number | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const level of levels) {
    for (const wall of level.walls) {
      for (const point of [wall.centreline.start, wall.centreline.end]) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return null;
  }

  return millimetresToMetres(millimetres(Math.max(maxX - minX, maxY - minY)));
}

/**
 * Khung cảnh mở đầu của tab "Trực quan".
 *
 * View mount bằng khung này rồi ghi đè đúng hai trường của mình
 * (`selectedEntityIds`, `hoveredEntityId`), nên hai trường ấy để trống ở đây. Không
 * tầng nào dựng được thì trả `null` và view hiện câu caption thay vì canvas — đó là
 * kết quả hợp lệ, không phải một chỗ còn dang dở.
 */
export function buildSceneFrame(
  levels: readonly BuildFloorInput[],
  reducedMotion: boolean,
): ViewerSceneFrame | null {
  if (levels.length === 0) {
    return null;
  }

  const span = spanMetresOf(levels);
  const framed = span === null ? 0 : span * CAMERA_MARGIN;

  return {
    azimuthRad: CAMERA_RESTING_TURN * RADIANS_PER_TURN,
    polarRad: QUARTER_TURN_RAD - CAMERA_ELEVATION_TURN * RADIANS_PER_TURN,
    distanceM: Math.max(framed, MIN_CAMERA_DISTANCE_M),
    isOrthographic: false,
    visibleStoreyIds: levels.map((level) => level.level.id),
    separation: 0,
    selectedEntityIds: [],
    hoveredEntityId: null,
    sectionPlane: null,
    isolatedEntityIds: null,
    hiddenEntityIds: [],
    reducedMotion,
  };
}

/* -------------------------------------------------------------------------- */
/* 4 — Mô hình của tab                                                        */
/* -------------------------------------------------------------------------- */

export interface VisualModelInput {
  readonly capabilities: VersionHistoryCapabilities;
  readonly graph: NormalizedSpatial | null;
  readonly scene: SceneConversion;
  readonly sceneFrame: ViewerSceneFrame | null;
  readonly diff: VersionDiff | null;
  /** Nhãn của bản CŨ trong cặp đang so — câu caption nêu đích danh nó. */
  readonly leftVersionLabel: string | null;
  readonly hoveredEntityId: string | null;
  readonly isFetchingDiff: boolean;
}

/**
 * Tab "Trực quan" thành mô hình view đọc được.
 *
 * `caption` là trường bắt buộc hiện, không phải một lời chú thích cho đẹp: người đọc
 * không được phép tưởng cảnh trên màn là bản cũ. Nó nói thẳng đây là mô hình HIỆN TẠI,
 * và đếm bao nhiêu đối tượng đang được tô sáng.
 *
 * Mã đối tượng lọc theo đồ thị hiện tại trước khi đếm: một mã có trong bản so nhưng
 * không còn trong đồ thị là đối tượng đã bị xoá, và tô sáng nó là tô vào chỗ trống.
 */
export function buildVisualModel(input: VisualModelInput): VisualDiffModel {
  const { capabilities, graph, scene, sceneFrame, diff, leftVersionLabel } = input;
  const isAvailable = capabilities.canShowCurrentModel3d && sceneFrame !== null;
  const found = diff === null ? [] : changedEntityIdsOf(diff);
  const changedEntityIds =
    graph === null ? found : found.filter((id) => graph.byId[id] !== undefined);
  const marked = `${formatNumber(changedEntityIds.length)} đối tượng đã đổi đang được tô sáng`;

  return {
    isAvailable,
    unavailableReason: unavailableReasonOf(capabilities.canShowCurrentModel3d, graph, scene),
    isBuilding: isAvailable && input.isFetchingDiff,
    caption:
      leftVersionLabel === null
        ? `đây là mô hình hiện tại chứ không phải một bản cũ; ${marked}`
        : `đây là mô hình hiện tại chứ không phải phiên bản ${leftVersionLabel}; ${marked}`,
    sceneLevels: scene.levels,
    sceneFrame,
    changedEntityIds,
    hoveredEntityId: capabilities.canHighlightEntity ? input.hoveredEntityId : null,
  };
}
