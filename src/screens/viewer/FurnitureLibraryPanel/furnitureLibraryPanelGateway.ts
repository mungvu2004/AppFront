/**
 * Cổng dữ liệu, lệnh và định dạng của `FurnitureLibraryPanel` — phần THUẦN của
 * panel thư viện nội thất bên trái `Viewer3D`.
 *
 * Cùng khuôn `propertyInspectorGateway.ts` bên cạnh: mọi thứ kiểm được mà không
 * dựng một cây React sống ở đây, `useFurnitureLibraryPanel.ts` chỉ còn việc nối
 * dây và giữ trạng thái.
 *
 * ## R-61 — file này NỐI LẠI logic đã có, không chứa công thức tự chế
 *
 * - **Lọc** đi qua `matchesLibraryFilter` (`src/api/schemas/library.ts`) — panel
 *   không viết lại phép so sánh hai trục `group`/`source`.
 * - **Bỏ dấu khi tìm** đi qua `foldForSearch` của `Viewer3D` — cùng màn cha, đã
 *   có test, và một bản chép thứ hai sẽ là hai định nghĩa cho cùng một câu hỏi.
 * - **Định dạng số** đi qua `formatNumber`/`formatLength`/`formatFileSize`
 *   (`src/lib/format`) và `formatCount` (`src/lib/commands/business/shared`).
 *   Không `toFixed`, không `toLocaleString`, không quy đổi đơn vị viết tay (A15).
 * - **Hình học** đi qua `boxAround` (`src/lib/input/dragDrop`) — panel không tự
 *   tính một khung bao nào.
 * - **Kiểm đặt được hay không** đi qua `validateAddFurniture` (R-08) — panel
 *   tuyệt đối không tự kiểm va chạm.
 * - **Ngân sách hiệu năng** đi qua `checkBudget` + `SCENE_BUDGET`
 *   (`src/lib/three/perf/budget.ts`) — không có ngưỡng một-model nào được bịa ra.
 *   Xem {@link isHeavyLibraryItem}: cảnh nền tính bằng KHÔNG vì panel không có
 *   đường lấy số đo cảnh thật, nên `false` ở đó có thể là âm tính giả.
 * - **Ghi** đi qua `dispatch`/`runTransaction` với `SpatialPort.applyPatches` cài
 *   bằng `commit` (A10). `commit` chỉ xuất hiện trong file này, không ở hook.
 */

import { matchesLibraryFilter } from '@/api/contracts';
import type { LibraryFilterId, LibraryItem } from '@/api/client';
import { createId, isIdOfKind } from '@/domain/spatial/ids';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import type { Furniture, FurnitureId, LevelId } from '@/domain/spatial/types';
import {
  createAddFurnitureCommand,
  createDeleteFurnitureCommand,
  validateAddFurniture,
  type AddFurnitureInput,
} from '@/lib/commands/business/openingCommands';
import { entitiesOfKind, formatCount, FURNITURE_KIND_LABELS } from '@/lib/commands/business/shared';
import type { CommandContext } from '@/lib/commands/business/shared';
import {
  createIncrementalRuleRunner,
  type DispatchDeps,
  type DispatchResult,
  type SpatialPort,
} from '@/lib/commands/dispatch';
import {
  createHistoryStack,
  NO_SELECTION,
  type HistoryStack,
  type SelectionSnapshot,
} from '@/lib/commands/history';
import { MERGE_WINDOW_MS } from '@/lib/commands/mergeCommands';
import { runTransaction } from '@/lib/commands/transaction';
import type { Command } from '@/lib/commands/types';
import { formatFileSize } from '@/lib/format/bytes';
import { formatLength } from '@/lib/format/measure';
import { formatNumber } from '@/lib/format/number';
import { boxAround, type DragLibraryItem } from '@/lib/input/dragDrop';
import { checkBudget, detectDeviceProfile, SCENE_BUDGET } from '@/lib/three/perf/budget';
import { foldForSearch } from '@/screens/viewer/Viewer3D';
import { commit } from '@/store/commit';

import type { FurnitureCategoryId, ReplaceAllPreviewItem } from './furnitureLibraryPanelTypes';

/* -------------------------------------------------------------------------- */
/* Chữ của panel — mọi câu tiếng Việt do HOOK sinh ra nằm ở đây (R-67).        */
/* -------------------------------------------------------------------------- */

/**
 * Chữ của hook, chép đúng theo `vi.hook.fragment.json` cạnh file này.
 *
 * `vi.json` là TỪ ĐIỂN KIỂM TRA của `expectVietnamese`, không phải bảng dịch lúc
 * chạy (CLAUDE.md), nên nơi thật sự tạo ra chuỗi là file này. Xuất khẩu để bài
 * kiểm của panel đối chiếu ĐÚNG chuỗi này thay vì gõ lại một bản thứ hai (R-70).
 */
export const FURNITURE_LIBRARY_PANEL_TEXT = {
  thumbnailAlt: 'Ảnh xem trước của',
  thumbnailAltMissing: 'Chưa có ảnh xem trước của',
  replaceAllLabel: 'Thay thế tất cả —',
  replaceAllArrow: 'hiện tại →',
  sourceMine: 'Của tôi',
  sourceCatalogue: 'Danh mục',
  heavyModel: 'Model này nặng hơn phần ngân sách hiệu năng của cảnh.',
  readFailed: 'Không đọc được lớp không gian của tầng này.',
} as const;

/** Bí danh ngắn, dùng khắp phần còn lại của file. */
const TEXT = FURNITURE_LIBRARY_PANEL_TEXT;

/** Người thực hiện của mọi lệnh panel phát ra — cùng khuôn `PropertyInspector`. */
export const FURNITURE_LIBRARY_PANEL_ACTOR_ID = 'furniture-library-editor';

/* -------------------------------------------------------------------------- */
/* Chip → trục lọc thật của tầng API.                                          */
/* -------------------------------------------------------------------------- */

/**
 * Mười chip của hợp đồng T4 ↔ mười id lọc của `src/api/schemas/library.ts`.
 *
 * Hai bảng đặt tên khác nhau ở đúng hai chỗ (`cabinet`↔`storage`,
 * `equipment`↔`technical`). Đây là phép ĐỔI TÊN thuần, không phải một phép lọc
 * thứ hai: câu trả lời "mục này có khớp chip không" vẫn do `matchesLibraryFilter`
 * đưa ra, một mình.
 */
export const LIBRARY_FILTER_BY_CATEGORY: Readonly<Record<FurnitureCategoryId, LibraryFilterId>> = {
  all: 'all',
  table: 'table',
  chair: 'chair',
  bed: 'bed',
  sofa: 'sofa',
  cabinet: 'storage',
  sanitary: 'sanitary',
  kitchen: 'kitchen',
  equipment: 'technical',
  mine: 'mine',
};

/** Ô tìm: bỏ dấu ở CẢ HAI phía, đúng cách ô tìm đối tượng của `Viewer3D` làm. */
export function matchesSearchText(name: string, query: string): boolean {
  const needle = foldForSearch(query).trim();

  return needle === '' || foldForSearch(name).includes(needle);
}

/** Mục nào còn lại sau chip và ô tìm. */
export function visibleLibraryItems(
  items: readonly LibraryItem[],
  categoryId: FurnitureCategoryId,
  searchQuery: string,
): readonly LibraryItem[] {
  const filterId = LIBRARY_FILTER_BY_CATEGORY[categoryId];

  return items.filter(
    (item) => matchesLibraryFilter(item, filterId) && matchesSearchText(item.name, searchQuery),
  );
}

/* -------------------------------------------------------------------------- */
/* Định dạng (A15/P-01) — xảy ra ở đây, không ở view.                          */
/* -------------------------------------------------------------------------- */

/**
 * Milimét viết tròn, đúng độ chính xác `formatLength(v, { unit: 'mm' })` dùng.
 *
 * Cùng hằng số cục bộ mà `usePropertyInspector.ts` khai vì cùng lý do: đây là độ
 * chính xác của MỘT dòng chữ, không phải một hằng số nghiệp vụ có nguồn khác.
 */
const MILLIMETRE_FRACTION_DIGITS = 0;

/**
 * `"1.200 × 600 × 750 mm"` — hậu tố đơn vị viết đúng một lần, ở cuối.
 *
 * `src/lib/format` KHÔNG có hàm ghép ba chiều (contract-data.md mục (e) đã xác
 * nhận NOT FOUND), nên panel ghép chuỗi — nhưng từng con số vẫn do `formatNumber`
 * và `formatLength` viết ra, không có phép làm tròn nào ở đây.
 */
export function dimensionsLabelOf(item: LibraryItem): string {
  const width = formatNumber(item.widthMm, { fractionDigits: MILLIMETRE_FRACTION_DIGITS });
  const depth = formatNumber(item.depthMm, { fractionDigits: MILLIMETRE_FRACTION_DIGITS });

  return `${width} × ${depth} × ${formatLength(item.heightMm, { unit: 'mm' })}`;
}

/** `"4,2 MB"` — `formatFileSize` đã có sẵn, panel không tự chia 1024. */
export function fileSizeCaptionOf(item: LibraryItem): string {
  return formatFileSize(item.fileSizeBytes);
}

/** Câu `alt` tiếng Việt của ảnh xem trước — `expectVietnamese` soát cả `alt`. */
export function thumbnailAltTextOf(item: LibraryItem): string {
  const lead = item.previewUrl === undefined ? TEXT.thumbnailAltMissing : TEXT.thumbnailAlt;

  return `${lead} ${item.name}`;
}

/* -------------------------------------------------------------------------- */
/* R-04 — "model nặng" suy từ SCENE_BUDGET, không từ một ngưỡng tự nghĩ ra.     */
/* -------------------------------------------------------------------------- */

/**
 * Model này có nặng hơn ngân sách hiệu năng của cảnh không (R-04).
 *
 * ## GIỚI HẠN ĐÃ BIẾT — đọc trước khi tin con số này
 *
 * **Cảnh nền được tính bằng KHÔNG.** Panel không có đường nào lấy số đo cảnh
 * thật: `ViewerSceneHandle.frameRate()` không lộ `drawCalls`
 * (`viewer3dTypes.ts:197-201`), `src/store` không giữ một `SceneReading` nào, và
 * hợp đồng cứng `UseFurnitureLibraryPanelOptions` /
 * `FurnitureLibraryPanelContainerProps` không có trường nào mang một số đo vào
 * đây. Nên phép cộng của phán quyết điều phối viên ("thêm model này có đẩy CẢ
 * CẢNH vượt ngân sách không") chạy với cảnh nền rỗng, và câu nó thật sự phát
 * biểu hẹp hơn: *riêng model này đã vượt trần tam giác của cả cảnh*.
 *
 * Hệ quả, cả hai chiều:
 *
 * - Mọi `true` là một cảnh báo THẬT, đo bằng hằng thật (`SCENE_BUDGET`,
 *   `budget.ts:92-98`): một model vượt trần khi đứng một mình thì vượt trần với
 *   mọi cảnh nền.
 * - Mọi `false` có thể là **ÂM TÍNH GIẢ**: một cảnh đã gần chạm trần cộng thêm
 *   một model vừa phải vẫn vượt ngân sách, và panel KHÔNG nói được điều đó. Lấp
 *   chỗ này cần một đường đưa `SceneReading` của `Viewer3D` xuống panel — tức
 *   một thay đổi ở `furnitureLibraryPanelTypes.ts`, ngoài phạm vi của hook.
 *
 * Không có ngưỡng một-model nào được bịa ra ở đây, và cũng không có: repo không
 * có `maxTrianglesPerModel` (contract-three.md mục (b) đã grep và xác nhận).
 */
export function isHeavyLibraryItem(item: LibraryItem): boolean {
  const warnings = checkBudget(
    {
      drawCalls: 0,
      graphicsMemoryMb: 0,
      materials: 0,
      triangles: item.triangleCount,
    },
    detectDeviceProfile(),
  );

  return warnings.length > 0;
}

/** Trần tam giác của cả cảnh — xuất khẩu để bài kiểm đối chiếu nguồn thật. */
export const LIBRARY_TRIANGLE_CAP = SCENE_BUDGET.maxTriangles;

/* -------------------------------------------------------------------------- */
/* "Đã phát hiện" — nhóm đồ đạc CÓ THẬT trên tầng đang mở.                     */
/* -------------------------------------------------------------------------- */

/** Đồ đạc của đúng một tầng, đọc qua `entitiesOfKind` chứ không từ state thô. */
export function floorFurniture(
  graph: NormalizedSpatial | null,
  floorId: string,
): readonly Furniture[] {
  if (graph === null) {
    return [];
  }

  return entitiesOfKind(graph, 'furniture').filter((piece) => piece.levelId === floorId);
}

/** Một lớp đã phát hiện: loại đồ, và các món thuộc về nó. */
export interface DetectedFurnitureCount {
  readonly kind: Furniture['kind'];
  readonly pieces: readonly Furniture[];
}

/**
 * Nhóm theo `kind` và đếm.
 *
 * `src/store` KHÔNG có selector nào làm sẵn việc này (contract-interaction.md
 * mục (f) ghi NOT FOUND kèm lệnh grep), và gom nhóm là phép GHÉP chứ không phải
 * công thức nghiệp vụ — nên nó được phép sống trong phạm vi của panel.
 */
export function detectedFurnitureCounts(
  pieces: readonly Furniture[],
): readonly DetectedFurnitureCount[] {
  const byKind = new Map<Furniture['kind'], Furniture[]>();

  for (const piece of pieces) {
    const bucket = byKind.get(piece.kind);

    if (bucket === undefined) {
      byKind.set(piece.kind, [piece]);
    } else {
      bucket.push(piece);
    }
  }

  return [...byKind.entries()].map(([kind, group]) => ({ kind, pieces: group }));
}

/** `"sofa (4)"` — đếm đã ghép vào chuỗi ở tầng hook, không ở view. */
export function detectedGroupLabel(group: DetectedFurnitureCount): string {
  return `${FURNITURE_KIND_LABELS[group.kind]} (${formatCount(group.pieces.length)})`;
}

/** `"Thay thế tất cả — sofa (4)"` — tiêu đề hộp xem trước. */
export function replaceAllDialogLabel(group: DetectedFurnitureCount): string {
  return `${TEXT.replaceAllLabel} ${detectedGroupLabel(group)}`;
}

/** `"ghế F-000001 hiện tại → Ghế sofa góc (Của tôi)"`. */
export function replaceAllPreviewItems(
  group: DetectedFurnitureCount,
  target: LibraryItem,
): readonly ReplaceAllPreviewItem[] {
  const source = target.source === 'mine' ? TEXT.sourceMine : TEXT.sourceCatalogue;

  return group.pieces.map((piece) => ({
    id: piece.id,
    description:
      `${FURNITURE_KIND_LABELS[piece.kind]} ${piece.id} ${TEXT.replaceAllArrow} ` +
      `${target.name} (${source})`,
  }));
}

/* -------------------------------------------------------------------------- */
/* Kéo thả — panel chỉ CHUẨN BỊ dữ liệu cho `reduceDragDrop`.                  */
/* -------------------------------------------------------------------------- */

/** Một mục thư viện, rút về đúng bốn trường mà phiên kéo I-03 đọc. */
export function dragLibraryItemOf(item: LibraryItem): DragLibraryItem {
  return {
    kind: item.furnitureKind,
    widthMm: item.widthMm,
    depthMm: item.depthMm,
    label: item.name,
  };
}

/**
 * Tầng đang mở, đã hẹp kiểu.
 *
 * `floorId` của hợp đồng LÀ mã tầng, nên hàm này tổng: khi chuỗi không đúng dạng
 * thì `validateAddFurniture` là nơi nói ra điều đó bằng một câu tiếng Việt
 * ("Không tìm thấy tầng …"), và câu ấy tới người dùng qua `blockReasons`. Chặn
 * im lặng ở đây sẽ giấu mất lý do (E.10).
 */
export function levelIdOf(floorId: string): LevelId {
  return isIdOfKind('level', floorId) ? floorId : (floorId as LevelId);
}

/** Mã đồ đạc mới cho một phiên kéo — `nextId` của `DragDropDeps`. */
export function mintFurnitureId(): FurnitureId {
  return createId('furniture');
}

/* -------------------------------------------------------------------------- */
/* Đường ghi — `dispatch`/`runTransaction` chạy qua `commit` (S-05/S-07/A10).   */
/* -------------------------------------------------------------------------- */

/** Cửa đọc đồ thị đang sửa. Mặc định là store; test cắm một đồ thị cố định. */
export interface FurnitureLibraryGraphPort {
  readonly read: () => NormalizedSpatial | null;
}

/** Ngữ cảnh lệnh, đúng khuôn `commandContextOf` của `objectLayerReviewGateway`. */
export function commandContextOf(graph: NormalizedSpatial, actorId: string): CommandContext {
  return { graph, actorId };
}

/**
 * Cổng ghi của `dispatch`, cài bằng `commit`.
 *
 * Nhãn lấy từ `description` của lượt dispatch đang chạy, nên nút hoàn tác, nhật
 * ký hoạt động và toast của `useUndoableToast` đọc cùng một câu.
 */
export function createCommitSpatialPort(
  graph: FurnitureLibraryGraphPort,
  labelOf: () => string,
): SpatialPort {
  return {
    read: () => graph.read(),
    applyPatches: (patches) => {
      commit(patches, labelOf());
    },
  };
}

/** Bộ phụ thuộc năm cổng của `dispatch`, cộng nhãn của lượt đang chạy. */
export interface FurnitureLibraryDispatchBundle {
  readonly deps: DispatchDeps;
  readonly history: HistoryStack;
  readonly setLabel: (label: string) => void;
}

export interface CreateFurnitureLibraryDispatchOptions {
  readonly graph: FurnitureLibraryGraphPort;
  readonly selection: () => SelectionSnapshot;
  readonly history?: HistoryStack;
}

/** Dựng `DispatchDeps` đầy đủ năm cổng, cùng cửa sổ gộp của `MERGE_WINDOW_MS`. */
export function createFurnitureLibraryDispatchDeps(
  options: CreateFurnitureLibraryDispatchOptions,
): FurnitureLibraryDispatchBundle {
  const history = options.history ?? createHistoryStack({ mergeWindowMs: MERGE_WINDOW_MS });
  let label = '';

  const deps: DispatchDeps = {
    spatial: createCommitSpatialPort(options.graph, () => label),
    history: {
      push: (entry) => {
        history.push({
          entry,
          selectionBefore: options.selection(),
          selectionAfter: options.selection(),
        });
      },
      drop: (entryId) => {
        history.drop(entryId);
      },
    },
    rules: createIncrementalRuleRunner(),
    sync: {
      /* `useAutosave` đã theo dõi `state.spatial`, nên không có hàng đợi thứ hai
       * ở đây — lượt ghi vào store tự báo rằng bản vẽ đã bẩn (D-07). */
      enqueue: () => undefined,
    },
  };

  return {
    deps,
    history,
    setLabel: (next) => {
      label = next;
    },
  };
}

/** Vùng chọn rỗng, cho lượt ghi không có gì được chọn trước đó. */
export const FURNITURE_LIBRARY_NO_SELECTION = NO_SELECTION;

/**
 * Chạy một loạt lệnh như MỘT bước hoàn tác.
 *
 * `runTransaction` là đường đã có cho việc này: cả loạt được kiểm trước khi bất
 * cứ lệnh nào được áp, và cả loạt đẻ ra đúng một `UndoEntry` — nên "Thay thế tất
 * cả 4 chiếc ghế" hoàn tác bằng một lần `Ctrl+Z`, và `useUndoableToast` hiện
 * đúng một toast `UNDO_WINDOW_MS` cho nó (A8/D-05).
 */
export async function runFurnitureLibraryCommands(
  commands: readonly Command[],
  bundle: FurnitureLibraryDispatchBundle,
  label: string,
): Promise<DispatchResult> {
  bundle.setLabel(label);

  return runTransaction(commands, bundle.deps, { label });
}

/* -------------------------------------------------------------------------- */
/* Hai lệnh panel phát ra, dựng từ nguyên thuỷ công khai của tầng lệnh.        */
/* -------------------------------------------------------------------------- */

/** Lý do không thả được — `validateDrop` của `DragDropDeps`, tức R-08. */
export function dropRefusalsOf(
  input: AddFurnitureInput,
  graph: NormalizedSpatial | null,
  actorId: string,
): readonly string[] {
  if (graph === null) {
    return [TEXT.readFailed];
  }

  return validateAddFurniture(input, commandContextOf(graph, actorId));
}

/**
 * Lệnh S-07 của một phiên kéo đã thả thành công.
 *
 * `FurnitureDropRequest.input` do `reduceDragDrop` dựng ra — tâm, khung bao và
 * góc xoay đều là của phiên kéo, không có con số nào panel tự tính. Ở đây chỉ
 * còn việc đổi nó thành một `Command` qua `createAddFurnitureCommand`, và trả
 * `null` khi tầng lệnh từ chối (lý do đã tới người dùng qua `blockReasons` trước
 * đó, nên không có câu tiếng Việt mới nào được soạn ở đây).
 */
export function addFurnitureCommandOf(
  input: AddFurnitureInput,
  graph: NormalizedSpatial,
  actorId: string,
): Command | null {
  const result = createAddFurnitureCommand(input, commandContextOf(graph, actorId));

  return result.ok ? result.data : null;
}

/**
 * Loạt lệnh thay MỌI món của một nhóm bằng một mục thư viện.
 *
 * Xoá rồi thêm, vì tầng lệnh KHÔNG có lệnh đổi `kind` của một món đã đặt — và
 * dựng một lệnh như thế ở đây sẽ là viết lại tầng lệnh trong màn (R-61). Mỗi món
 * mới giữ nguyên tâm, góc xoay và phòng chứa của món cũ; khung bao lấy kích
 * thước của mục thư viện qua `boxAround`, không tính tay.
 */
export function buildReplaceAllCommands(
  group: DetectedFurnitureCount,
  target: LibraryItem,
  graph: NormalizedSpatial,
  levelId: LevelId,
  actorId: string,
): readonly Command[] {
  const context = commandContextOf(graph, actorId);
  const commands: Command[] = [];

  for (const piece of group.pieces) {
    const removal = createDeleteFurnitureCommand({ furnitureId: piece.id }, context);
    const addition = createAddFurnitureCommand(
      {
        id: mintFurnitureId(),
        levelId,
        kind: target.furnitureKind,
        centre: piece.centre,
        boundingBox: boxAround(piece.centre, target.widthMm, target.depthMm),
        rotationDeg: piece.rotationDeg,
        ...(piece.roomId === undefined ? {} : { roomId: piece.roomId }),
      },
      context,
    );

    if (removal.ok && addition.ok) {
      commands.push(removal.data, addition.data);
    }
  }

  return commands;
}
