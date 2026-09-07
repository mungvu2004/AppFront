/**
 * Toàn bộ logic của tấm trượt chi tiết vi phạm (S-34).
 *
 * Hook này **nối lại** bộ máy đã có, không dựng thêm một mảnh nghiệp vụ nào (R-61):
 *
 * - **Vi phạm và căn cứ luật** — `Violation` đến từ màn cha (S-33) qua props; `Rule`
 *   tra bằng `registry.get(ruleCode)`. `title` là NGUYÊN VĂN `violation.message`,
 *   `ruleSentence` là NGUYÊN VĂN `rule.name`, nhãn nhóm và nhãn mức lấy từ
 *   `RULE_GROUP_LABELS` / `RULE_SEVERITY_LABELS`. Màn không soạn một câu căn cứ nào
 *   và không chạy lại phép kiểm để "tự tính" vi phạm.
 * - **Cách sửa** — `createDeleteFurnitureCommand` và `createRenameRoomCommand` của
 *   S-07, gọi qua `./violationDetailGateway`. Không có ánh xạ `ruleCode -> Command`
 *   nào trong repo, nên hai hàng lựa chọn được suy từ LOẠI của đối tượng gây lỗi
 *   chứ không từ mã luật.
 * - **Lời từ chối** — nguyên văn `result.error.reasons` của domain. Hook không soạn
 *   một câu báo lỗi nghiệp vụ nào; ngoại lệ duy nhất được ghi ở
 *   {@link NO_DRAWING_MESSAGE}, và nó nói về tình trạng của MÀN chứ không về luật.
 * - **Chạy lại đúng luật vừa sửa** — `runRules(graph, { registry, changes })` rồi
 *   `evaluatedRuleCodes(result)`, đúng chuỗi đã chốt ở hợp đồng.
 * - **Số** — `formatNumber` của `@/lib/format/number` (A15: dấu phẩy thập phân) chạy
 *   Ở ĐÂY. View chỉ in chuỗi ra.
 *
 * ## Trạng thái máy chủ: `useMutation`, không `useState` (R-64)
 *
 * Lượt sửa đi qua `useMutation`: "đang chạy", "hỏng" và "xong" đều đọc thẳng từ nó.
 * `useShareLinks` tự viết `isLoading`/`error` bằng tay — đó là ngoại lệ đi trước,
 * không phải khuôn để chép.
 *
 * Cố ý KHÔNG dùng `createOptimisticMutation` của `@/lib/mutations`: nó bọc mọi lỗi
 * bằng `toAppError`, và `AppError` chỉ mang `messageKey` chứ không mang câu chữ.
 * Đi đường ấy là ĐÁNH MẤT câu từ chối tiếng Việt mà domain vừa soạn — đúng thứ
 * "cấm tự soạn câu báo lỗi" tồn tại để giữ. Lượt ghi ở màn này cũng không có gì để
 * "lạc quan": `runTransaction` đã áp thay đổi vào kho TRƯỚC khi mutation kết thúc.
 *
 * ## Hai ngăn xếp hoàn tác, không phải một
 *
 * Vé hoàn tác tám giây (D-05) đi qua `HistoryStack` riêng của tấm trượt.
 * `Ctrl+Z` toàn cục đọc ngăn xếp `temporal` của zundo, đã đăng ký một lần ở
 * `routes/router.tsx` — màn này **không đăng ký lại** và không cố đồng bộ hai bên.
 *
 * ## Khối hình: 2D tĩnh, 3D nhập động
 *
 * `figure2d` dựng bằng `resolveWallShapes` của `@/domain/walls/joints`; view chỉ in
 * `viewBox` và `points`. `figureRef` giữ một `import()` **động** tới
 * `@/screens/viewer/Viewer3D` — bắt buộc động, vì ngân sách `routeChunk` là 280 KiB
 * còn màn kia một mình đã 264,8 KiB. `figureUnavailable` bật khi không dựng được
 * ngữ cảnh: phần chữ đứng một mình, không có khung vỡ nào được hiện.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createDefaultRuleRegistry } from '@/domain/rules/defaults';
import {
  RULE_GROUP_LABELS,
  RULE_SEVERITY_LABELS,
  type RuleCode,
  type RuleGroup,
  type RuleRegistry,
  type RuleSeverity,
  type Violation,
} from '@/domain/rules/registry';
import { evaluatedRuleCodes, runRules } from '@/domain/rules/runner';
import { readKindFromId, type EntityKind } from '@/domain/spatial/ids';
import {
  isEntityOfKind,
  idsOnLevel,
  type NormalizedSpatial,
  type SpatialEntity,
} from '@/domain/spatial/normalize';
import { toBuildFloorInput } from '@/domain/spatial/toBuildFloorInput';
import type { EntityId, Level, LevelId, Point, Wall } from '@/domain/spatial/types';
import { millimetres, millimetresToMetres } from '@/domain/units/types';
import { resolveWallShapes } from '@/domain/walls/joints';
import { toSolidWall } from '@/lib/commands/business/shared';
import { createColoringMode, type PaintSubject } from '@/lib/coloring/modes';
import { UNPAINTED_TOKEN, type ColorTokenName } from '@/lib/coloring/scales';
import { formatNumber } from '@/lib/format/number';
import { confidenceLevel } from '@/lib/format/semantic';
import { MOTION_DURATIONS_MS } from '@/lib/motion/tokens';
import { applyInvalidation } from '@/lib/query/invalidation';
import { appNotificationBus } from '@/hooks/useNotifications';
import type { NotificationBus } from '@/lib/mutations/notificationBus';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { createUndoTicket } from '@/lib/mutations/undoTicket';
import { DEFAULT_CAMERA_RIG, restingHeading } from '@/lib/three/present';
import type { BuildFloorInput } from '@/lib/three/build/floor';
import type { ViewerSceneFrame } from '@/screens/viewer/ViewerShell/viewerShellTypes';
import type { ViewerSceneHandle } from '@/screens/viewer/Viewer3D';
import { useStore } from '@/store';

import {
  asFurnitureId,
  asRoomId,
  buildDeleteFurnitureCommand,
  buildRenameRoomCommand,
  commandContextOf,
  createViolationDetailDispatchDeps,
  createViolationDetailGateway,
  proposedRoomNameOf,
  runViolationTransaction,
  type ViolationDetailGateway,
  type ViolationDetailGatewaySeed,
} from './violationDetailGateway';
import type {
  ViolationAction,
  ViolationActionKind,
  ViolationCause,
  ViolationDetailState,
  ViolationDetailViewProps,
  ViolationFigureMode,
  ViolationObject,
} from './types';

/* -------------------------------------------------------------------------- */
/* Chữ ký công khai.                                                           */
/* -------------------------------------------------------------------------- */

export interface UseViolationDetailOptions {
  /**
   * Danh sách vi phạm của màn cha, đã sắp sẵn.
   *
   * Tấm trượt KHÔNG tự chạy bộ luật để dựng lại danh sách này: S-33 vừa chạy nó
   * qua `queryKeys.violation.byProject`, và chạy lần hai là hai sự thật khác nhau
   * trên cùng một màn hình.
   */
  readonly violations: readonly Violation[];
  /** Vi phạm được mở đầu tiên. `J`/`K` đi tiếp từ đây. */
  readonly initialIndex: number;
  readonly projectId: string;
  /** Tầng đang mở ở vỏ — khoá mất-hiệu-lực của `rerunRules` cần nó. */
  readonly floorId: string;
  readonly onClose: () => void;
  /** Trạng thái 6: container truyền xuống quyền của người dùng. */
  readonly canEdit?: boolean;
  /** Trạng thái 7: vỏ ứng dụng báo đang thu gọn. */
  readonly isCompact?: boolean;
  /**
   * Ép cảnh cho bài kiểm; xem `./violationDetailGateway`.
   *
   * Phải ỔN ĐỊNH giữa các lượt render — cổng và cả ngăn xếp hoàn tác của tấm
   * trượt được dựng theo nó, nên một đối tượng viết thẳng trong JSX sẽ dựng lại
   * ngăn xếp mỗi lượt render và làm vé hoàn tác không còn gì để lùi.
   */
  readonly seed?: ViolationDetailGatewaySeed;
  readonly notifications?: NotificationBus;
}

/* -------------------------------------------------------------------------- */
/* Hằng và giá trị rỗng dùng chung.                                            */
/* -------------------------------------------------------------------------- */

const EMPTY_OBJECTS: readonly ViolationObject[] = Object.freeze([]);
const EMPTY_CAUSES: readonly ViolationCause[] = Object.freeze([]);
const EMPTY_ACTIONS: readonly ViolationAction[] = Object.freeze([]);
const NO_SUBJECTS: readonly PaintSubject[] = Object.freeze([]);
const NO_ENTITY_IDS: readonly string[] = Object.freeze([]);

/**
 * Câu duy nhất hook tự soạn, và nó KHÔNG nói thay domain.
 *
 * "Chưa mở bản vẽ nào" là tình trạng của màn hình, không phải một phán quyết về
 * luật hay một lời từ chối lệnh: `createDeleteFurnitureCommand` chỉ được gọi khi
 * đã có đồ thị, nên domain không có câu nào cho trường hợp này để mà mượn.
 */
const NO_DRAWING_MESSAGE = 'chưa mở bản vẽ nào nên không áp được cách sửa.';

/** Khi tiền tố của mã không nằm trong bảng — nói "đối tượng", không đoán bừa một loại. */
const UNKNOWN_KIND_LABEL = 'đối tượng';

/** Nhãn tiếng Việt của từng loại bộ phận, cho khối "Phát hiện". */
const ENTITY_KIND_LABELS: Readonly<Record<EntityKind, string>> = {
  level: 'tầng',
  wall: 'tường',
  opening: 'ô mở',
  furniture: 'đồ đạc',
  room: 'phòng',
  axis: 'trục',
  dimension: 'kích thước ghi',
};

/* -------------------------------------------------------------------------- */
/* Khối 6 — nguyên nhân có thể (phán quyết G2).                                */
/* -------------------------------------------------------------------------- */

/**
 * Một giả thuyết cho mỗi NHÓM LUẬT, nói về bước dựng mô hình đã sinh ra kết quả này.
 *
 * Giọng trung tính: câu nói về bước dò và về bản vẽ gốc, không về người nào. Mỗi
 * câu chỉ được dùng khi `rule.group` đọc được — không có nhóm thì không có câu.
 */
const CAUSE_BY_GROUP: Readonly<Record<RuleGroup, string>> = {
  geometry:
    'hình học dựng lại từ bản vẽ có thể lệch nhẹ ở bước dò tường, nên số đo tính ra không khớp ngưỡng.',
  circulation:
    'đường lưu thông được suy ra từ vị trí các ô mở, nên một ô mở đặt lệch ở bước dò làm lối đi tính ra khác thực tế.',
  area: 'ranh phòng được khép lại từ những đoạn tường dò được, nên một đoạn còn hở làm diện tích tính ra khác dự kiến.',
  annotation:
    'nhãn và ghi chú được gắn ở bước đọc chữ trên bản vẽ, nên một nhãn thiếu hoặc gắn nhầm phòng là khả năng thường gặp.',
  levels:
    'cao độ tầng lấy từ bảng cao độ của bản vẽ, nên một dòng đọc thiếu làm tầng này lệch so với các tầng còn lại.',
};

/** Một giả thuyết cho mỗi LOẠI BỘ PHẬN, nói về cách bước dò dựng ra chính nó. */
const CAUSE_BY_KIND: Readonly<Record<EntityKind, string>> = {
  level: 'tầng này được tách ra từ các trang bản vẽ, nên một trang xếp nhầm thứ tự cũng đủ làm cao độ lệch.',
  wall: 'tường này có thể được dò gộp hoặc tách khác với nét vẽ gốc, nên hai đầu của nó chưa chắc nằm đúng chỗ.',
  opening: 'ô mở này được gắn vào tường gần nhất ở bước gắn tường, nên nó có thể đang thuộc về một tường bên cạnh.',
  furniture: 'đồ đạc này được nhận ra từ một ký hiệu trên bản vẽ, và vài ký hiệu trông rất giống nhau.',
  room: 'phòng này được khép ranh rồi mới gắn nhãn, nên tên và ranh giới của nó chưa chắc khớp bản vẽ gốc.',
  axis: 'trục này được dò từ nét mảnh kéo dài, nên một đường gióng cũng có thể được đọc thành trục.',
  dimension:
    'kích thước ghi này được đọc từ chuỗi chữ trên bản vẽ, nên giá trị đọc được chưa chắc khớp với hình.',
};

/** Khi mã luật không nằm trong sổ đăng ký đang dùng — một sự thật, không một lời trách. */
const CAUSE_RULE_UNKNOWN =
  'mã luật của phát hiện này không có trong sổ kiểm tra đang dùng, nên phần mô tả chi tiết của nó chưa đọc được.';

/** Khi mã đối tượng không theo bảng tiền tố của đồ thị. */
const CAUSE_KIND_UNKNOWN =
  'mã đối tượng không theo bảng tiền tố của bản vẽ, nên loại bộ phận của nó chưa tra được.';

/**
 * Dựng danh sách nguyên nhân có thể — LUÔN ít nhất hai.
 *
 * Mỗi giả thuyết bắt rễ vào một tín hiệu THẬT đọc được, không có câu nào bịa:
 *
 * 1. **độ tin cậy** — chỉ khi thực thể mang `ReviewMetadata.confidence` và
 *    `confidenceLevel` xếp nó dưới mức "chắc chắn". Ngưỡng là ngưỡng của repo
 *    (`@/lib/format/semantic`), không phải một con số viết tay ở đây (R-71). Con số
 *    hiện ra đã định dạng sẵn bằng `formatNumber` (A15).
 * 2. **nhóm luật** — `rule.group`, hoặc câu về "mã luật không có trong sổ" khi sổ
 *    đăng ký không biết mã ấy.
 * 3. **loại bộ phận** — tiền tố của `entityId`, hoặc câu về tiền tố lạ.
 *
 * Ô 2 và ô 3 luôn cho ra đúng một câu mỗi ô, nên số giả thuyết KHÔNG BAO GIỜ dưới
 * hai — kể cả khi thực thể không nằm trong đồ thị và mã luật không tra được.
 */
export const causesOf = (
  group: RuleGroup | null,
  kind: EntityKind | null,
  confidence: number | null,
): readonly ViolationCause[] => {
  const causes: ViolationCause[] = [];

  if (confidence !== null && confidenceLevel(confidence) !== 'certain') {
    causes.push({
      id: 'confidence',
      text: `nhận diện tự động có thể sai — độ tin cậy chỉ ${formatNumber(confidence, {
        fractionDigits: 2,
      })}.`,
    });
  }

  causes.push({
    id: 'group',
    text: group === null ? CAUSE_RULE_UNKNOWN : CAUSE_BY_GROUP[group],
  });

  causes.push({
    id: 'kind',
    text: kind === null ? CAUSE_KIND_UNKNOWN : CAUSE_BY_KIND[kind],
  });

  return causes;
};

/* -------------------------------------------------------------------------- */
/* Khối 4 — phát hiện.                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Những mã đối tượng mà chính thực thể KHAI ra là có liên quan.
 *
 * Đây là đọc trường, không phải suy diễn hình học: một ô mở khai `wallId` của nó,
 * một tường khai `openingIds`, một phòng khai `wallIds`, một món đồ khai `roomId`,
 * một kích thước ghi khai `referenceIds`. Không có mã nào được thêm vào ngoài
 * những gì đồ thị đã viết ra.
 */
const relatedIdsOf = (entity: SpatialEntity): readonly string[] => {
  if (isEntityOfKind('opening', entity)) {
    return [entity.wallId];
  }

  if (isEntityOfKind('wall', entity)) {
    return entity.openingIds;
  }

  if (isEntityOfKind('room', entity)) {
    return entity.wallIds;
  }

  if (isEntityOfKind('furniture', entity)) {
    return entity.roomId === undefined ? NO_ENTITY_IDS : [entity.roomId];
  }

  if (isEntityOfKind('dimension', entity)) {
    return entity.referenceIds;
  }

  return NO_ENTITY_IDS;
};

/** Độ tin cậy của một mã, hoặc `null` khi mã không có trong đồ thị. */
const confidenceOf = (graph: NormalizedSpatial | null, entityId: string): number | null => {
  const entity = graph?.byId[entityId];

  return entity === undefined ? null : entity.confidence;
};

/** Một dòng của khối "Phát hiện", số đã định dạng sẵn (A15). */
const objectOf = (
  graph: NormalizedSpatial | null,
  entityId: string,
  isSubject: boolean,
): ViolationObject => {
  const kind = readKindFromId(entityId);
  const confidence = confidenceOf(graph, entityId);

  return {
    entityId,
    kindLabel: kind === null ? UNKNOWN_KIND_LABEL : ENTITY_KIND_LABELS[kind],
    confidenceLabel: confidence === null ? null : formatNumber(confidence, { fractionDigits: 2 }),
    isSubject,
  };
};

/* -------------------------------------------------------------------------- */
/* Khối 5 — mặt bằng 2D.                                                       */
/* -------------------------------------------------------------------------- */

/** Đúng hình dạng `figure2d` của `./types`, đặt tên lại cho đọc được ở đây. */
interface Figure2d {
  readonly viewBox: string;
  readonly shapes: readonly {
    readonly id: string;
    readonly points: string;
    readonly isSubject: boolean;
    readonly isDimmed: boolean;
  }[];
}

/** Hộp bao của một chùm điểm, tính bằng milimét. */
interface FigureBounds {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
}

const boundsOfPoints = (points: readonly Point[]): FigureBounds | null => {
  if (points.length === 0) {
    return null;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return null;
  }

  return { minX, minY, width: maxX - minX, height: maxY - minY };
};

/** Thực thể tầng, hoặc `null` khi mã không trỏ tới một tầng nào. */
const levelEntityOf = (graph: NormalizedSpatial, levelId: LevelId): Level | null => {
  const entity = graph.byId[levelId];

  return entity !== undefined && isEntityOfKind('level', entity) ? entity : null;
};

/** Những bức tường nằm trên một tầng, đọc thẳng từ chỉ mục theo tầng của đồ thị. */
const wallsOnLevel = (graph: NormalizedSpatial, levelId: LevelId): readonly Wall[] => {
  const walls: Wall[] = [];

  for (const id of idsOnLevel(graph, levelId)) {
    const entity = graph.byId[id];

    if (entity !== undefined && isEntityOfKind('wall', entity)) {
      walls.push(entity);
    }
  }

  return walls;
};

/**
 * Mặt bằng 2D của tầng đang xét, dựng bằng `resolveWallShapes` của domain.
 *
 * Không một phép tính hình học nào ở đây: mặt cắt thật của mỗi bức tường — kể cả
 * chỗ hai tường ăn vào nhau — là việc của `@/domain/walls/joints`. Phần còn lại
 * chỉ là chuyển toạ độ milimét thành chuỗi `points` và một `viewBox`, tức là dịch
 * sang tiếng của SVG.
 *
 * @returns `null` khi tầng không dựng được — khi ấy khối hình biến khỏi DOM và
 * phần chữ đứng một mình, thay vì hiện một khung vỡ.
 */
const buildFigure2d = (
  graph: NormalizedSpatial | null,
  levelId: LevelId | null,
  subjectEntityId: string,
  dimmedEntityIds: readonly string[] | null,
): Figure2d | null => {
  if (graph === null || levelId === null) {
    return null;
  }

  const level = levelEntityOf(graph, levelId);
  const walls = wallsOnLevel(graph, levelId);

  if (level === null || walls.length === 0) {
    return null;
  }

  let shapes;

  try {
    // `toSolidWall` là bộ đổi của tầng lệnh từ tường trong đồ thị sang tường mà
    // `@/domain/walls` đọc — cùng bộ đổi mà `ThicknessStandardization` dùng để vẽ.
    shapes = resolveWallShapes(walls.map((wall) => toSolidWall(wall, level))).shapes;
  } catch {
    // `resolveWallShapes` ném khi một bức tường không dùng được (dài 0, dày 0,
    // toạ độ không hữu hạn). Đó là một tầng không vẽ được, không phải một sự cố:
    // `figureUnavailable` bật lên và phần chữ đứng một mình.
    return null;
  }

  const bounds = boundsOfPoints(shapes.flatMap((shape) => [...shape.outline]));

  if (bounds === null) {
    return null;
  }

  const dimmed = dimmedEntityIds === null ? null : new Set(dimmedEntityIds);

  return {
    viewBox: `${String(bounds.minX)} ${String(bounds.minY)} ${String(bounds.width)} ${String(bounds.height)}`,
    shapes: shapes.map((shape) => ({
      id: shape.wallId,
      points: shape.outline.map((point) => `${String(point.x)},${String(point.y)}`).join(' '),
      isSubject: shape.wallId === subjectEntityId,
      isDimmed: dimmed !== null && dimmed.has(shape.wallId),
    })),
  };
};

/* -------------------------------------------------------------------------- */
/* Khối 5 — khung hình đầu tiên của cảnh 3D.                                   */
/* -------------------------------------------------------------------------- */

/**
 * Khoảng cách khuôn hình ban đầu, mét.
 *
 * Cùng công thức mà vỏ dùng cho điểm nhìn mặc định (`useViewerShell.ts:386`):
 * cạnh dài nhất nhân hệ số chừa lề của chính bộ máy camera. Không có con số nào
 * viết tay — `DEFAULT_CAMERA_RIG.margin` là nguồn duy nhất (R-71). Ngay sau khi
 * cảnh lắp xong, `frameEntities` khuôn lại camera vào đúng đối tượng vi phạm, nên
 * giá trị này chỉ là điểm xuất phát.
 */
const initialDistanceM = (bounds: FigureBounds | null): number => {
  if (bounds === null) {
    return DEFAULT_CAMERA_RIG.margin;
  }

  const longestMm = millimetres(Math.max(bounds.width, bounds.height));

  return millimetresToMetres(longestMm) * DEFAULT_CAMERA_RIG.margin;
};

/**
 * Khung nhìn đầu tiên của cảnh.
 *
 * `selectedEntityIds` mang đúng đối tượng vi phạm: phán quyết G4 chốt 3D tô đối
 * tượng ấy bằng màu nhấn, và cảnh tự làm việc đó từ vùng chọn — không có một dòng
 * nào của `viewer3dScene.ts` phải đổi.
 */
const initialFrameOf = (
  levelId: LevelId,
  subjectEntityId: string,
  distanceM: number,
  reducedMotion: boolean,
): ViewerSceneFrame => ({
  azimuthRad: restingHeading(DEFAULT_CAMERA_RIG),
  // Góc chúc xuống đo từ +Y, còn rig khai góc ngẩng lên từ mặt phẳng ngang: cùng
  // một phép đổi mà vỏ viết ở `useViewerShell.ts:346`.
  polarRad: Math.PI / 2 - DEFAULT_CAMERA_RIG.elevationRad,
  distanceM,
  isOrthographic: false,
  visibleStoreyIds: [levelId],
  separation: 0,
  sectionPlane: null,
  selectedEntityIds: [subjectEntityId],
  hoveredEntityId: null,
  isolatedEntityIds: null,
  hiddenEntityIds: [],
  reducedMotion,
});

/* -------------------------------------------------------------------------- */
/* Một lượt sửa.                                                               */
/* -------------------------------------------------------------------------- */

/** Những gì một lượt sửa cần biết, chốt lại lúc bấm chứ không đọc lại lúc chạy. */
interface ApplyFixVariables {
  readonly kind: ViolationActionKind;
  readonly entityId: string;
  readonly ruleCode: RuleCode;
}

/** Những gì một lượt sửa trả về — đủ để dựng câu xác nhận và vé hoàn tác. */
interface ApplyFixResult {
  /** Luật vừa chạy lại và KHÔNG còn báo lỗi trên đối tượng này. */
  readonly resolved: boolean;
  /** Câu mô tả lệnh, do S-07 soạn; vé hoàn tác mượn nguyên văn nó. */
  readonly description: string;
}

/**
 * Lỗi của một lượt sửa, mang nguyên văn những câu domain đã soạn.
 *
 * Một lớp riêng vì `Error.message` gộp mọi lý do thành một chuỗi, mà
 * `CommandRefusal.reasons` có thể có nhiều câu và cả bốn câu đều cần tới được
 * người dùng.
 */
class ApplyFixError extends Error {
  readonly reasons: readonly string[];

  constructor(reasons: readonly string[]) {
    super(reasons.join(' '));
    this.name = 'ApplyFixError';
    this.reasons = reasons;
  }
}

/**
 * Một dòng xác nhận điềm đạm, sau khi luật đã chạy lại và không còn báo lỗi.
 *
 * Nói về KẾT QUẢ LƯỢT CHẠY, không về người duyệt: A5 giữ dấu "đã xác minh" cho
 * riêng việc của người, và một lượt máy chạy lại không bao giờ được đặt nó.
 * Tên luật chỉ có mặt khi sổ đăng ký biết mã ấy — không có tên thì câu ngắn đi
 * một vế chứ không để lại một chỗ trống.
 */
const resolvedMessageOf = (ruleName: string | null): string =>
  ruleName === null
    ? 'đã sửa xong; lượt chạy lại không còn báo lỗi trên đối tượng này.'
    : `đã sửa xong; luật ${ruleName} chạy lại và không còn báo lỗi trên đối tượng này.`;

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Trả về ĐÚNG bộ props của view, không thừa trường nào.
 *
 * Container chỉ việc:
 * `const props = useViolationDetail({ violations, initialIndex, projectId, floorId, onClose });`
 * `return <ViolationDetail {...props} />;`
 */
export function useViolationDetail(
  options: UseViolationDetailOptions,
): ViolationDetailViewProps {
  const {
    violations,
    initialIndex,
    projectId,
    floorId,
    onClose,
    canEdit = true,
    isCompact = false,
    seed,
    notifications = appNotificationBus,
  } = options;

  const gateway: ViolationDetailGateway = useMemo(
    () => createViolationDetailGateway(seed),
    [seed],
  );
  const capabilities = useMemo(() => gateway.readCapabilities(canEdit), [gateway, canEdit]);

  // Một sổ đăng ký riêng cho lượt xem này, dựng đúng một lần: bộ mặc định đã tự
  // tắt hai luật built-in bị nhóm chức năng thay thế, nên số luật là việc của
  // domain chứ không phải của màn.
  const registry: RuleRegistry = useMemo(() => createDefaultRuleRegistry(), []);

  const queryClient = useQueryClient();
  const graph = useStore((state) => state.spatial);
  const spatialLoading = useStore((state) => state.spatialLoading);
  const setSelection = useStore((state) => state.setSelection);

  const reducedMotion = useReducedMotion();

  /* ---------------------------------------------------------------------- */
  /* Vi phạm đang mở, và điều hướng qua lại.                                  */
  /* ---------------------------------------------------------------------- */

  const [index, setIndex] = useState(initialIndex);

  // Màn cha mở một vi phạm khác trên CÙNG một tấm trượt: đi theo nó. So bằng
  // `initialIndex` chứ không bằng `index`, nên một lượt duyệt `J`/`K` của người
  // dùng không bị kéo ngược về chỗ cũ mỗi lần cha render lại.
  const openedAtRef = useRef(initialIndex);

  useEffect(() => {
    if (openedAtRef.current !== initialIndex) {
      openedAtRef.current = initialIndex;
      setIndex(initialIndex);
    }
  }, [initialIndex]);

  const violation = violations[index] ?? null;
  const rule = violation === null ? null : registry.get(violation.ruleCode);

  const hasPrevious = index > 0;
  const hasNext = index < violations.length - 1;

  /* ---------------------------------------------------------------------- */
  /* Ngữ cảnh hình: tầng của phát hiện này.                                   */
  /* ---------------------------------------------------------------------- */

  /**
   * Tầng để vẽ.
   *
   * `violation.levelId` là tầng luật đã chạy trên — `null` với luật xét cả công
   * trình. Khi ấy tầng của chính đối tượng gây lỗi là câu trả lời trung thực duy
   * nhất còn lại, và nó cũng được đọc từ trường của thực thể chứ không đoán.
   */
  const levelId = useMemo<LevelId | null>(() => {
    if (violation === null) {
      return null;
    }

    if (violation.levelId !== null) {
      return violation.levelId;
    }

    const entity = graph?.byId[violation.entityId];

    if (entity === undefined) {
      return null;
    }

    if (isEntityOfKind('level', entity)) {
      return entity.id;
    }

    return 'levelId' in entity ? entity.levelId : null;
  }, [graph, violation]);

  /* ---------------------------------------------------------------------- */
  /* Xem trước hậu quả khi trỏ vào một hàng lựa chọn.                         */
  /* ---------------------------------------------------------------------- */

  const [hoveredAction, setHoveredAction] = useState<ViolationActionKind | null>(null);

  /* ---------------------------------------------------------------------- */
  /* Khối 7 — hai hàng lựa chọn, không có hàng thứ ba.                        */
  /* ---------------------------------------------------------------------- */

  /**
   * Hàng "đổi tên phòng" chỉ tồn tại khi có một cái tên để đề xuất.
   *
   * Tên lấy từ `describeUsage` của domain, đúng thứ `suggestion` của luật
   * `ROOM-UNNAMED` bảo phải làm. Không có tên thì KHÔNG có hàng — không một cái
   * tên nào được bịa ra để cho đủ nút bấm.
   */
  const proposedRoomName = useMemo<string | null>(() => {
    if (violation === null || graph === null) {
      return null;
    }

    return proposedRoomNameOf(graph, violation.entityId);
  }, [graph, violation]);

  const actions = useMemo<readonly ViolationAction[]>(() => {
    if (violation === null || !capabilities.canEdit) {
      return EMPTY_ACTIONS;
    }

    const kind = readKindFromId(violation.entityId);
    const rows: ViolationAction[] = [];

    if (capabilities.canDeleteObject && kind === 'furniture') {
      rows.push({
        kind: 'deleteObject',
        label: 'xoá đối tượng này',
        description: `gỡ ${ENTITY_KIND_LABELS.furniture} ${violation.entityId} khỏi bản vẽ; hoàn tác được trong tám giây.`,
        affectedEntityIds: [violation.entityId],
      });
    }

    if (capabilities.canRenameRoom && kind === 'room' && proposedRoomName !== null) {
      rows.push({
        kind: 'renameRoom',
        label: 'đặt tên phòng theo công năng',
        description: `đặt tên phòng ${violation.entityId} thành "${proposedRoomName}"; hoàn tác được trong tám giây.`,
        affectedEntityIds: [violation.entityId],
      });
    }

    // Không có hàng "bỏ qua kèm lý do": `canDismiss` là `false`, và một hàng
    // không lưu được ở đâu là một lời hứa suông. Xem `./violationDetailGateway`.
    return rows.length === 0 ? EMPTY_ACTIONS : rows;
  }, [capabilities, proposedRoomName, violation]);

  const previewEntityIds = useMemo<readonly string[] | null>(() => {
    if (hoveredAction === null) {
      return null;
    }

    return actions.find((action) => action.kind === hoveredAction)?.affectedEntityIds ?? null;
  }, [actions, hoveredAction]);

  /* ---------------------------------------------------------------------- */
  /* Đường ghi — dựng một lần, sống cùng tấm trượt.                           */
  /* ---------------------------------------------------------------------- */

  const graphPort = useMemo(() => ({ read: () => useStore.getState().spatial }), []);

  const dispatchBundle = useMemo(
    () =>
      createViolationDetailDispatchDeps({
        graph: graphPort,
        // Bước `sync` là no-op có chủ ý: `useAutosave` đã theo dõi thẳng
        // `state.spatial`, nên không có hàng đợi thứ hai nào phải nuôi (A7).
        onSynced: () => undefined,
        history: gateway.history,
      }),
    [gateway.history, graphPort],
  );

  /** Đã có lệnh nào thực sự áp xuống kho chưa — quyết định `rollback` có được chạm vào lịch sử không. */
  const appliedRef = useRef(false);

  const applyUndo = useCallback((): void => {
    const transition = dispatchBundle.history.undo();

    if (transition === null) {
      return;
    }

    dispatchBundle.deps.spatial.applyPatches(transition.patches);
  }, [dispatchBundle]);

  /* ---------------------------------------------------------------------- */
  /* Lượt sửa — mười hai bước của hợp đồng, không tắt bước nào.               */
  /* ---------------------------------------------------------------------- */

  const applyFix = useCallback(
    async (variables: ApplyFixVariables): Promise<ApplyFixResult> => {
      appliedRef.current = false;

      // 1. đồ thị hiện tại, đọc lúc chạy chứ không phải lúc render.
      const current = useStore.getState().spatial;

      if (current === null) {
        throw new ApplyFixError([NO_DRAWING_MESSAGE]);
      }

      // 2. ngữ cảnh lệnh.
      const context = commandContextOf(current, gateway.actorId);

      // 3. dựng lệnh bằng hàm của S-07 — màn không dựng patch nào.
      const built =
        variables.kind === 'deleteObject'
          ? buildDeleteFurnitureCommand(
              { furnitureId: asFurnitureId(variables.entityId) },
              context,
            )
          : buildRenameRoomCommand(
              {
                roomId: asRoomId(variables.entityId),
                name: proposedRoomNameOf(current, variables.entityId) ?? '',
              },
              context,
            );

      // 4. bị từ chối thì dừng, và lý do là NGUYÊN VĂN của domain.
      if (!built.ok) {
        throw new ApplyFixError(built.error.reasons);
      }

      // 5–11. validate → apply → history → rules → sync, một bước lịch sử.
      const result = await runViolationTransaction(
        [built.data],
        dispatchBundle,
        built.data.description,
      );

      if (!result.ok) {
        throw new ApplyFixError(result.error.reasons);
      }

      appliedRef.current = true;

      // Chạy lại ĐÚNG luật vừa bị đụng tới, rồi hỏi `evaluatedRuleCodes` xem nó có
      // thật sự chạy lượt này không — "không còn trong danh sách" và "không được
      // tính lại" là hai chuyện khác nhau, và chỉ cái đầu mới là đã đạt.
      const after = useStore.getState().spatial;

      if (after === null) {
        return { resolved: false, description: built.data.description };
      }

      const rerun = runRules(after, {
        registry,
        changes: [{ entityId: variables.entityId }],
      });

      const ran = evaluatedRuleCodes(rerun).includes(variables.ruleCode);
      const stillFailing = rerun.violations.some(
        (candidate) =>
          candidate.ruleCode === variables.ruleCode &&
          candidate.entityId === variables.entityId,
      );

      return { resolved: ran && !stillFailing, description: built.data.description };
    },
    [dispatchBundle, gateway.actorId, registry],
  );

  const mutation = useMutation<ApplyFixResult, ApplyFixError, ApplyFixVariables>({
    mutationFn: applyFix,
    onSuccess: (result) => {
      /*
       * A8: mọi thay đổi hoàn tác được, KÈM toast hoàn tác. Cửa sổ tám giây do
       * chính vé mang (`UNDO_WINDOW_MS`), nên không thời lượng nào phải truyền.
       *
       * Vé này lùi ngăn xếp RIÊNG của tấm trượt. `Ctrl+Z` đi đường zundo và vẫn
       * lùi được cùng lượt sửa ấy — hai ngăn xếp, một lượt sửa.
       */
      const ticket = createUndoTicket({
        description: result.description,
        now: gateway.now,
        undo: applyUndo,
      });

      notifications.publish({
        type: 'violation.fix',
        title: ticket.description,
        description: '',
        undoTicket: ticket,
      });
    },
    onError: () => {
      // Lệnh bị từ chối thì chưa có gì được áp, và lùi lịch sử lúc ấy sẽ nuốt mất
      // bước sửa TRƯỚC đó của người dùng. Chỉ lùi khi đúng lượt này đã áp xong.
      if (appliedRef.current) {
        applyUndo();
        appliedRef.current = false;
      }
    },
  });

  const { mutate } = mutation;

  const onAction = useCallback(
    (kind: ViolationActionKind): void => {
      if (violation === null || !capabilities.canEdit) {
        return;
      }

      if (!actions.some((action) => action.kind === kind)) {
        return;
      }

      mutate({
        kind,
        entityId: violation.entityId,
        ruleCode: violation.ruleCode,
      });
    },
    [actions, capabilities.canEdit, mutate, violation],
  );

  /* ---------------------------------------------------------------------- */
  /* Mất hiệu lực khoá đọc, sau khi một lượt sửa đã đạt.                      */
  /* ---------------------------------------------------------------------- */

  const resolved = mutation.data?.resolved === true;

  useEffect(() => {
    if (!resolved) {
      return;
    }

    // Báo cáo luật của màn cha vừa cũ đi. `rerunRules` là thao tác ghi đã khai
    // sẵn trong `invalidationMap` cho đúng khoá `violation.byProject`, nên màn
    // không tự đi bộ trên cache và không tự dựng khoá nào (R-64).
    applyInvalidation(queryClient, 'rerunRules', { floorId, projectId });
  }, [floorId, projectId, queryClient, resolved]);

  /* ---------------------------------------------------------------------- */
  /* Tự sang vi phạm kế tiếp — một nhịp ngắn, huỷ được.                       */
  /* ---------------------------------------------------------------------- */

  const [isAdvancing, setIsAdvancing] = useState(false);

  const onPrevious = useCallback((): void => {
    setIsAdvancing(false);
    setIndex((current) => Math.max(0, current - 1));
  }, []);

  const onNext = useCallback((): void => {
    setIsAdvancing(false);
    setIndex((current) => Math.min(violations.length - 1, current + 1));
  }, [violations.length]);

  const onCancelAdvance = useCallback((): void => {
    setIsAdvancing(false);
  }, []);

  /*
   * Lên dây MỘT lần cho mỗi lượt sửa đã đạt.
   *
   * `mutation.data` còn nguyên sau khi đã sang vi phạm kế tiếp, nên nếu chỉ nhìn
   * `resolved` thì hiệu ứng sẽ lên dây lại ngay và tấm trượt tự chạy hết danh
   * sách. `submittedAt` là dấu thời điểm của đúng lượt gửi vừa rồi, nên nó phân
   * biệt được "vừa xong một lượt" với "vẫn còn nhớ lượt cũ".
   */
  const advancedForRef = useRef<number | null>(null);
  const submittedAt = mutation.submittedAt;

  useEffect(() => {
    if (!resolved || !hasNext || advancedForRef.current === submittedAt) {
      return;
    }

    advancedForRef.current = submittedAt;
    setIsAdvancing(true);
  }, [hasNext, resolved, submittedAt]);

  useEffect(() => {
    if (!isAdvancing) {
      return undefined;
    }

    // Thời lượng lấy từ thang chuyển động, không viết số (R-71). `slow` là nhịp
    // của "màn hình vừa đổi thành cái khác" — đúng việc đang xảy ra ở đây.
    const timer = window.setTimeout(() => {
      setIsAdvancing(false);
      setIndex((current) => Math.min(violations.length - 1, current + 1));
    }, MOTION_DURATIONS_MS.slow);

    return (): void => {
      window.clearTimeout(timer);
    };
  }, [isAdvancing, violations.length]);

  /* ---------------------------------------------------------------------- */
  /* Bàn phím — đăng ký ở view, không ở đây.                                 */
  /* ---------------------------------------------------------------------- */

  /*
   * `J` / `K` / `Escape` đăng ký ở `./ViolationDetail`, ngay cạnh phần DOM mà
   * chúng điều khiển. Đăng ký ở CẢ HAI nơi là hai phím tắt trùng trên cùng
   * một tổ hợp, và `Escape` sẽ gọi `onClose` hai lần.
   *
   * Hook giữ `onNext` / `onPrevious` / `onClose` làm phần logic; view nối chúng
   * vào bàn phím qua sổ phím tắt, không `addEventListener` (R-72). `Ctrl+Z`
   * không thuộc bên nào: nó đã đăng ký một lần, phạm vi `global`, tại
   * `routes/router.tsx`.
   */

  /* ---------------------------------------------------------------------- */
  /* Khối 5 — hai chế độ hình.                                                */
  /* ---------------------------------------------------------------------- */

  // 2D là chế độ mặc định (phán quyết G4): nó mang đúng viền vi phạm mà đặc tả đòi.
  const [figureMode, setFigureMode] = useState<ViolationFigureMode>('2d');

  const onFigureModeChange = useCallback((mode: ViolationFigureMode): void => {
    setFigureMode(mode);
  }, []);

  const subjectEntityId = violation?.entityId ?? '';

  const figure2d = useMemo(
    () => buildFigure2d(graph, levelId, subjectEntityId, previewEntityIds),
    [graph, levelId, previewEntityIds, subjectEntityId],
  );

  /**
   * Token màu của mọi loại bộ phận trong cảnh 3D.
   *
   * Chế độ `default` của P-06 có đúng MỘT bậc, và token đọc từ `bands` của chính
   * chế độ ấy chứ không viết tay một tên biến CSS (A1). Khuôn chép từ
   * `@/screens/viewer/ExplodedView/useExplodedView.ts:592-598`. Đối tượng vi phạm
   * không tô ở đây: nó nằm trong `selectedEntityIds` và cảnh tự tô bằng màu nhấn.
   */
  const untintedToken = useMemo((): ColorTokenName => {
    const mode = createColoringMode('default', { subjects: NO_SUBJECTS });

    return mode.bands[0]?.token ?? UNPAINTED_TOKEN;
  }, []);

  /** Mọi thứ hiệu ứng lắp cảnh cần, đọc qua một ref để nó không lắp lại mỗi lần render. */
  const sceneRef = useRef({ untintedToken, reducedMotion, subjectEntityId, graph, levelId });

  useEffect(() => {
    sceneRef.current = { untintedToken, reducedMotion, subjectEntityId, graph, levelId };
  });

  const handleRef = useRef<ViewerSceneHandle | null>(null);
  /** Khung nhìn cảnh đang chạy — lượt cập nhật vùng chọn mượn lại nó, không dựng mới. */
  const mountedFrameRef = useRef<ViewerSceneFrame | null>(null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  const figureRef = useCallback((next: HTMLCanvasElement | null): void => {
    setCanvas(next);
  }, []);

  const mountScene = gateway.mountScene;

  useEffect(() => {
    const current = sceneRef.current;

    if (canvas === null || current.graph === null || current.levelId === null) {
      return undefined;
    }

    let model: BuildFloorInput | null;

    try {
      model = toBuildFloorInput(current.graph, current.levelId);
    } catch {
      // Tầng có dữ liệu không dựng được. `figureUnavailable` đã bật, nên ở đây
      // chỉ việc không lắp gì cả.
      return undefined;
    }

    if (model === null) {
      return undefined;
    }

    const levels = [model];
    const bounds = boundsOfPoints(wallsOnLevel(current.graph, current.levelId).flatMap((wall) => [
      wall.centreline.start,
      wall.centreline.end,
    ]));

    const frame = initialFrameOf(
      current.levelId,
      current.subjectEntityId,
      initialDistanceM(bounds),
      current.reducedMotion,
    );

    let cancelled = false;

    /*
     * `import()` ĐỘNG, và bắt buộc phải động: ngân sách `routeChunk` là 280 KiB
     * còn `screens/viewer/Viewer3D` một mình đã 264,8 KiB. Nhập tĩnh là kéo cả
     * màn kia vào gói của màn này và vỡ cổng kích thước ngay lượt dựng đầu.
     */
    const mounting =
      mountScene === undefined
        ? import('@/screens/viewer/Viewer3D').then((module) => module.mountViewerScene)
        : Promise.resolve(mountScene);

    void mounting.then((mount) => {
      if (cancelled) {
        return;
      }

      const mounted = mount(canvas, {
        levels,
        frame,
        tokenOfPartKind: () => sceneRef.current.untintedToken,
        canSelect: false,
      });

      if (!mounted.ok) {
        // Không có WebGL là một nhánh hợp lệ, không phải sự cố: khối hình không
        // hiện, phần chữ đứng một mình.
        return;
      }

      handleRef.current = mounted.handle;
      mountedFrameRef.current = frame;

      // R-07 — khuôn camera vào đúng đối tượng vi phạm. Chỉ module cảnh làm được
      // việc này, nên màn gọi lại nó chứ không tự tính hộp bao.
      mounted.handle.frameEntities([sceneRef.current.subjectEntityId]);
    });

    return (): void => {
      cancelled = true;
      handleRef.current?.dispose();
      handleRef.current = null;
      mountedFrameRef.current = null;
    };
  }, [canvas, mountScene]);

  /*
   * Xem trước hậu quả trên cảnh 3D — cùng danh sách mã mà 2D làm mờ.
   *
   * Khung nhìn gửi đi là ĐÚNG khung đã lắp cảnh, chỉ đổi vùng chọn: dựng một
   * khung mới ở đây sẽ giật camera về điểm nhìn mặc định mỗi lần con trỏ đi qua
   * một hàng. Cảnh tô vùng chọn bằng màu nhấn (phán quyết G4), nên đây cũng là
   * đường tô sáng đối tượng sắp bị ảnh hưởng.
   */
  useEffect(() => {
    const frame = mountedFrameRef.current;

    if (frame === null) {
      return;
    }

    handleRef.current?.update({
      ...frame,
      selectedEntityIds: previewEntityIds ?? [subjectEntityId],
    });
  }, [previewEntityIds, subjectEntityId]);

  const onSelectObject = useCallback(
    (entityId: string): void => {
      // R-09 tô sáng đi qua vùng chọn dùng chung, R-07 khuôn camera đi qua tay
      // cầm cảnh. Hai việc, hai đường, không đường nào do màn tự dựng.
      setSelection([entityId as EntityId]);
      handleRef.current?.frameEntities([entityId]);
    },
    [setSelection],
  );

  /* ---------------------------------------------------------------------- */
  /* Khối 4 và khối 6.                                                        */
  /* ---------------------------------------------------------------------- */

  const objects = useMemo<readonly ViolationObject[]>(() => {
    if (violation === null) {
      return EMPTY_OBJECTS;
    }

    const subject = objectOf(graph, violation.entityId, true);
    const entity = graph?.byId[violation.entityId];

    if (entity === undefined) {
      return [subject];
    }

    return [
      subject,
      ...relatedIdsOf(entity).map((relatedId) => objectOf(graph, relatedId, false)),
    ];
  }, [graph, violation]);

  const causes = useMemo<readonly ViolationCause[]>(() => {
    if (violation === null) {
      return EMPTY_CAUSES;
    }

    return causesOf(
      rule?.group ?? null,
      readKindFromId(violation.entityId),
      confidenceOf(graph, violation.entityId),
    );
  }, [graph, rule, violation]);

  /* ---------------------------------------------------------------------- */
  /* Bảy trạng thái (A11 / R-63).                                             */
  /* ---------------------------------------------------------------------- */

  const figureUnavailable = figure2d === null;

  const state = useMemo<ViolationDetailState>(() => {
    // Không có quyền đứng trước tất cả: nút sửa biến khỏi DOM, nhưng căn cứ vẫn
    // đọc được — người xem không mất quyền ĐỌC vì thiếu quyền SỬA.
    if (!capabilities.canEdit) {
      return 'forbidden';
    }

    if (mutation.isError) {
      return 'error';
    }

    if (spatialLoading || mutation.isPending) {
      return 'loading';
    }

    if (violation === null) {
      return 'empty';
    }

    if (isCompact) {
      return 'collapsed';
    }

    // Hai nguồn của "một phần", cả hai đều hợp lệ: không cách sửa nào bật được,
    // HOẶC không dựng được ngữ cảnh hình. Cả hai lần phần chữ đều đứng một mình.
    if (actions.length === 0 || figureUnavailable) {
      return 'partial';
    }

    return 'success';
  }, [
    actions.length,
    capabilities.canEdit,
    figureUnavailable,
    isCompact,
    mutation.isError,
    mutation.isPending,
    spatialLoading,
    violation,
  ]);

  const onActionHover = useCallback((kind: ViolationActionKind | null): void => {
    setHoveredAction(kind);
  }, []);

  const severity: RuleSeverity | null = violation?.severity ?? null;
  const group: RuleGroup | null = rule?.group ?? null;

  return {
    state,
    capabilities,

    groupLabel: group === null ? '' : RULE_GROUP_LABELS[group],
    group,
    title: violation?.message ?? '',
    severity,
    severityLabel: severity === null ? '' : RULE_SEVERITY_LABELS[severity],
    subjectEntityId,

    ruleSentence: rule?.name ?? '',

    // Khối 3 gỡ khỏi DOM: `canCompareMeasure` là `false` vì `Violation` không mang
    // số đo được. Hai trường ở lại trong hợp đồng kiểu, và ở lại là `null`.
    measureLabel: null,
    thresholdLabel: null,

    objects,
    onSelectObject,

    figureMode,
    onFigureModeChange,
    previewEntityIds,
    figure2d,
    figureRef,
    figureUnavailable,

    causes,

    actions,
    onAction,
    onActionHover,

    // Ba trường của lựa chọn "bỏ qua kèm lý do" ở lại trong hợp đồng kiểu, chờ
    // ngày tầng logic có chỗ ghi lý do và người ghi. `canDismiss` là `false`, nên
    // hôm nay chúng không tới được một ô nhập nào.
    dismissReason: '',
    onDismissReasonChange: () => undefined,
    dismissReasonError: null,

    ruleCode: violation?.ruleCode ?? null,
    levelId,

    onPrevious,
    onNext,
    hasPrevious,
    hasNext,
    isAdvancing,
    onCancelAdvance,

    errorMessage: mutation.error?.reasons?.join(' ') ?? null,
    resolvedMessage: resolved ? resolvedMessageOf(rule?.name ?? null) : null,

    onClose,
  };
}
