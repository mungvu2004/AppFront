/**
 * Cổng dữ liệu và tầng lệnh của màn S-12 "Duyệt lớp tường" — mọi lời gọi ra
 * khỏi màn đi qua đây.
 *
 * Cùng khuôn `pipelineFailureGateway.ts` và `billingGateway.ts`: một danh sách
 * khả năng, một bản kê nợ endpoint, một `interface` cho hình dạng, một factory
 * dựng cổng thật và một factory dựng cổng có dữ liệu cho test và story (R-73).
 *
 * ## Đường ghi — `dispatch` chạy qua `commit`
 *
 * Quyết định đã chốt của điều phối viên (Q1): lệnh nghiệp vụ S-07 đi qua
 * `dispatch` (S-05, năm bước `validate → apply → history → rules → sync`), và
 * `SpatialPort.applyPatches` của `dispatch` được cài bằng `commit(patches,
 * label)` của `src/store/commit.ts`. Nhờ vậy màn có đủ:
 *
 * - rule chạy lại sau mỗi lệnh (`createIncrementalRuleRunner`),
 * - ngăn xếp hoàn tác 100 bước của S-06 (`createHistoryStack`,
 *   `MAX_HISTORY_STEPS`), chứ không phải ngăn xếp zundo,
 * - đồng bộ S-11 (`SyncPort.enqueue` đánh dấu bản vẽ bẩn cho tự lưu),
 * - và **không phạm A10**: không dòng nào gọi `set()` hay `_applyPatches()`.
 *
 * ## Lệnh duyệt `wall.approve` — dựng bằng nguyên thuỷ công khai
 *
 * `WALL_COMMAND_TYPES` (`wallCommands.ts:98-106`) chỉ có bảy lệnh và **không có
 * lệnh duyệt**. Điều phối viên đã duyệt cách dựng bằng `createCommand` +
 * `changeForUpdate` (hợp đồng lô-gic mục C.2), hợp lệ vì `CommandType` là
 * `string` mở và `validateCommands` chỉ kiểm `command.type` khác rỗng, không so
 * với một bảng cho phép (mục C.3). Lệnh tự hoàn tác được vì `changeForUpdate`
 * mang ĐỦ ảnh chụp `before`/`after`, và `invertCommand` chỉ hoán đổi hai ảnh đó
 * (mục C.5) — không cần thêm một dòng nào cho `Ctrl+Z`.
 *
 * **A5 ép ngay ở kiểu dựng lệnh:** {@link buildApproveWallCommand} là đường DUY
 * NHẤT đặt `reviewed: true`, và nó luôn đặt kèm `source: 'human'`. Không có
 * tham số nào cho phép người gọi truyền `source`, nên không tồn tại đường để
 * đầu ra AI bật cờ xanh "đã xác minh".
 *
 * ## Hai việc chưa có đường
 *
 * - `persistWallLayer` — **NOT FOUND**. `ENDPOINTS.spatial.floor` có thật,
 *   nhưng `PatchSpatialFloorInput.body` là `Partial<FloorWriteBody>`
 *   (`src/api/client.ts:87-92,144-148`) và `FloorWriteBody` chỉ mang
 *   `name`/`order`/`elevationMm`/`heightMm`/`drawings` — không có chỗ nào cho
 *   mảng tường. Cổng thật trả nhánh `supported: false` có kiểu, và tự lưu nói
 *   ra sự thật đó bằng chính nhãn của nó thay vì bịa một lượt lưu đã xong.
 * - `readWallGraph` — đồ thị tường sống trong `src/store` (nơi `commit` ghi
 *   vào), không có endpoint nào trả về nó. Cổng đọc nó qua một cửa tiêm được,
 *   mặc định là chính store; ảnh nền thì đọc thật qua `spatial.readFloor`.
 */

import type { ApiClient } from '@/api/client';
import { mockApiClient } from '@/api/__mocks__/client';
import { createId } from '@/domain/spatial/ids';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import type { Level, Point, Wall, WallId } from '@/domain/spatial/types';
import { measureDistance, type Measurement } from '@/domain/measure/measure';
import { mergeWalls, splitWall } from '@/domain/walls/edit';
import { resolveWallShapes } from '@/domain/walls/joints';
import { centrelineLength, type Wall as SolidWall } from '@/domain/walls/types';
import { millimetresPerPixel, pixels, scaleFromRatio, type Scale } from '@/domain/units/scale';
import { millimetres } from '@/domain/units/types';
import { isLowConfidence as hasLowConfidenceHatch } from '@/components/canvas/materialMap';
import type { MeasurementState } from '@/hooks/useMeasurementLabel';
import { WALL_COMMAND_TYPES } from '@/lib/commands/business/wallCommands';
import {
  createDeleteWallCommand,
  createDrawWallCommand,
  createChangeWallThicknessCommand,
  createMergeWallsCommand,
  createSplitWallCommand,
  type ChangeWallThicknessInput,
  type DeleteWallInput,
  type DrawWallInput,
  type MergeWallsInput,
  type SplitWallInput,
} from '@/lib/commands/business/wallCommands';
import {
  formatElevationM,
  formatPoint,
  toPointMm,
  toSolidWall,
  WALL_KIND_LABELS,
  type CommandContext,
  type CommandResult,
} from '@/lib/commands/business/shared';
import { changeForUpdate, createCommand } from '@/lib/commands/createCommand';
import type { Command } from '@/lib/commands/types';
import type { ToolOutcome } from '@/lib/tools/toolMachine';
import {
  createIncrementalRuleRunner,
  dispatch,
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
import { formatLength, formatScaleDensity } from '@/lib/format/measure';
import { formatNumber } from '@/lib/format/number';
import { confidenceLevel } from '@/lib/format/semantic';
import { createUndoTicket, UNDO_WINDOW_MS, type UndoTicket } from '@/lib/mutations/undoTicket';
import { toWallViewModel } from '@/lib/viewmodel/toViewModel';
import type { ViewStatusCode } from '@/lib/viewmodel/types';
import { commit } from '@/store/commit';
import { useStore } from '@/store';

import {
  WALL_THICKNESS_CHOICES,
  type WallInspectorViewModel,
  type WallRowViewModel,
  type WallShapeViewModel,
  type WallThicknessChoice,
} from './types';
import {
  WALL_LAYER_FIXTURE_LEVEL,
  WALL_LAYER_FIXTURE_WALLS,
} from './wallLayerReviewFixture';
import type {
  WallLayerCanvasShape,
  WallLayerMeasurementPx,
  WallLayerPointerReading,
  WallLayerRectPx,
  WallLayerSizePx,
  WallLayerViewportRectPercent,
} from './wallLayerHatch';

/* -------------------------------------------------------------------------- */
/* Khả năng — những gì màn hỏi thế giới bên ngoài.                             */
/* -------------------------------------------------------------------------- */

/** Tên máy đọc của từng việc màn cần. Mỗi việc chưa làm được có một dòng nợ. */
export const WALL_LAYER_CAPABILITIES = [
  'readBackground',
  'readWallGraph',
  'writeWallGraph',
  'persistWallLayer',
] as const;

export type WallLayerCapability = (typeof WALL_LAYER_CAPABILITIES)[number];

/** Việc trong danh sách trên mà bản cài đặt THẬT chưa làm được. Chỉ được ngắn đi. */
export const WALL_LAYER_MISSING_CAPABILITIES = ['persistWallLayer'] as const;

export type WallLayerMissingCapability = (typeof WALL_LAYER_MISSING_CAPABILITIES)[number];

/** Endpoint còn thiếu của từng khả năng, viết nguyên văn cho người nối dây sau. */
export const WALL_LAYER_MISSING_ENDPOINTS: Readonly<
  Record<WallLayerMissingCapability, string>
> = {
  persistWallLayer:
    'ENDPOINTS.spatial.floor chấp nhận một đồ thị không gian trong thân yêu cầu — chưa có; PatchSpatialFloorInput.body là Partial<FloorWriteBody> (src/api/client.ts:87-92,144-148), chỉ mang name/order/elevationMm/heightMm/drawings, không có chỗ cho mảng tường',
};

/** Một khả năng chưa tồn tại. `supported: false` là câu trả lời thật, không phải lỗi. */
export interface WallLayerUnsupported {
  readonly supported: false;
  readonly capability: WallLayerMissingCapability;
  /** Lấy nguyên từ {@link WALL_LAYER_MISSING_ENDPOINTS}. */
  readonly missing: string;
}

export interface WallLayerSupported<TValue> {
  readonly supported: true;
  readonly value: TValue;
}

export type WallLayerCapabilityResult<TValue> =
  | WallLayerSupported<TValue>
  | WallLayerUnsupported;

/** Dựng nhánh "chưa có đường làm việc này" — một chỗ duy nhất ghép tên với nợ. */
export function unsupported(capability: WallLayerMissingCapability): WallLayerUnsupported {
  return {
    supported: false,
    capability,
    missing: WALL_LAYER_MISSING_ENDPOINTS[capability],
  };
}

/* -------------------------------------------------------------------------- */
/* Dữ liệu thô.                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Ảnh nền của lớp tường — bản vẽ gốc đã tải lên, đọc qua `spatial.readFloor`.
 *
 * Đây là dữ liệu MÁY CHỦ duy nhất của màn, nên nó là thứ duy nhất đi qua
 * `useQuery` (R-64). Tường thì sống trong store, xem {@link WallLayerGraphPort}.
 */
export interface WallLayerBackground {
  /** `null` khi tầng chưa có bản vẽ nào — canvas vẽ khung xám chờ, không phải màn trắng. */
  readonly imageUrl: string | null;
  /** Mô tả ảnh cho trình đọc màn hình (R-72). */
  readonly imageAlt: string;
  /** Bề ngang bản vẽ, milimét công trình. `null` khi chưa có bản vẽ nào. */
  readonly widthMm: number | null;
  /** Chiều cao bản vẽ, milimét công trình. `null` khi chưa có bản vẽ nào. */
  readonly heightMm: number | null;
}

/** Cửa đọc đồ thị đang sửa. Mặc định là store; test cắm một đồ thị cố định. */
export interface WallLayerGraphPort {
  readonly read: () => NormalizedSpatial | null;
}

/*
 * Vì sao có `readWallLayer` bên cạnh `graph.read`.
 *
 * `graph.read` là lượt đọc ĐỒNG BỘ của đồ thị đang sửa (kho), và nó không hỏng
 * được: nó trả `null` khi kho còn trống. Trạng thái 4 của A11 nói về một thứ
 * khác hẳn — LỚP TƯỜNG của tầng không tải được — và trước lượt sửa này màn
 * không có đường nào diễn tả điều đó, nên nó mượn tạm cờ hỏng của ẢNH NỀN. Hệ
 * quả đo được: đúng lúc hỏng thì `backgroundImageUrl` thành `null` và kỹ sư mất
 * luôn ảnh gốc để đối chiếu — trái đúng điều `wallLayerReviewScenarios.ts` gọi
 * là bắt buộc ("canvas không được trắng dù danh sách trắng").
 *
 * `readWallLayer` là lượt đọc bất đồng bộ của chính lớp tường, dưới khoá
 * `queryKeys.space.byFloor` — đúng khoá mà `invalidationMap.editWall` đã dọn
 * sau mỗi lượt ghi. Cổng thật trả lại đúng đồ thị `graph.read()` cho ra (không
 * bịa một endpoint nào, xem `WALL_LAYER_MISSING_ENDPOINTS`); cổng giả có cờ
 * `failReadWallLayer` để bảy kịch bản ép được trạng thái 4 mà KHÔNG phải phá
 * ảnh nền.
 */

export interface ReadBackgroundInput {
  readonly projectId: string;
  readonly floorId: string;
  readonly signal?: AbortSignal;
}

export interface PersistWallLayerInput {
  readonly projectId: string;
  readonly floorId: string;
  readonly graph: NormalizedSpatial;
}

/* -------------------------------------------------------------------------- */
/* Cái seam.                                                                   */
/* -------------------------------------------------------------------------- */

/** Mỗi phương thức là một việc màn cần từ bên ngoài, và không có việc nào khác. */
export interface WallLayerReviewGateway {
  /** Khả năng nào cổng này làm được, trả lời ĐỒNG BỘ — màn phải biết trước lượt vẽ đầu. */
  readonly supports: Readonly<Record<WallLayerCapability, boolean>>;
  /** Ảnh nền của tầng. Lỗi ở ĐÂY chỉ làm mất ảnh nền, không phải hỏng lớp tường. */
  readonly readBackground: (input: ReadBackgroundInput) => Promise<WallLayerBackground>;
  /** Lớp tường của tầng. Lỗi ở đây là trạng thái `error` — ảnh gốc VẪN xem được. */
  readonly readWallLayer: (input: ReadBackgroundInput) => Promise<NormalizedSpatial | null>;
  /** Đồ thị đang sửa — nơi `commit` vừa ghi vào. */
  readonly graph: WallLayerGraphPort;
  /** NOT FOUND — `persistWallLayer`. Tự lưu nói ra sự thật này, không bịa một lượt lưu. */
  readonly persistWallLayer: (
    input: PersistWallLayerInput,
  ) => Promise<WallLayerCapabilityResult<void>>;
  /** Mã tường mới. Cùng cửa với `ToolContext.nextId` của `toolMachine`. */
  readonly nextWallId: () => WallId;
  /** Ai đang thao tác — đi vào `Command.actorId` và nhật ký hoạt động. */
  readonly actorId: string;
  /** Mốc giờ hiện tại. Tiêm được để test không phụ thuộc đồng hồ thật. */
  readonly now: () => number;
}

/* -------------------------------------------------------------------------- */
/* Cửa vào — cổng thật.                                                        */
/* -------------------------------------------------------------------------- */

/** Mô tả ảnh nền cho trình đọc màn hình, ghép từ tên tầng đã có. */
export const backgroundImageAlt = (floorName: string): string =>
  `Bản vẽ gốc của ${floorName}, dùng làm nền để đối chiếu lớp tường.`;

/* -------------------------------------------------------------------------- */
/* Nhãn mã tường — mã máy dài, nhãn người đọc ngắn.                            */
/* -------------------------------------------------------------------------- */

/** Số chữ số phần đếm trong thân mã — `COUNTER_LENGTH` của `src/domain/spatial/ids.ts:41`. */
const ID_COUNTER_LENGTH = 6;

/** Bề rộng nhãn người đọc: "#W-014", không phải "#W-14". */
const DISPLAY_CODE_DIGITS = 3;

/**
 * Nhãn người đọc của một mã tường: `W-000014WALL` → `W-014`.
 *
 * Mã máy phải dài (thân ≥ 10 ký tự, xem đầu `wallLayerReviewFixture.ts`) để
 * tầng lệnh nhận; nhãn thanh tra thì đặc tả đòi đúng "#W-014". `types.ts:220`
 * đã tách sẵn `codeLabel` khỏi `id` cho đúng việc này, nên hai thứ đi riêng
 * chứ không phải chọn một.
 *
 * Đọc ngược sáu chữ số đếm mà `createId` sinh ra, nên nó đúng cho cả tường của
 * bộ mẫu lẫn tường người dùng vừa vẽ — không có bảng tra nào phải giữ đồng bộ.
 * Thuần cắt chuỗi: không một lời gọi hàm hình học hay số học nào.
 */
export function wallDisplayCode(id: string): string {
  const counter = id.slice(2).slice(0, ID_COUNTER_LENGTH).replace(/^0+/u, '');

  return `${id.slice(0, 1)}-${(counter === '' ? '0' : counter).padStart(DISPLAY_CODE_DIGITS, '0')}`;
}

export interface CreateWallLayerReviewGatewayOptions {
  /** Client tiêm được. Vắng mặt thì cổng dùng client giả dùng chung của repo. */
  readonly apiClient?: ApiClient;
  /** Cửa đọc đồ thị. Vắng mặt thì cổng đọc thẳng store. */
  readonly graph?: WallLayerGraphPort;
  readonly actorId?: string;
  readonly now?: () => number;
  readonly nextWallId?: () => WallId;
}

/**
 * Người thực hiện mặc định khi nơi gọi chưa truyền ai.
 *
 * Một chuỗi ĐẶT TÊN chứ không phải chuỗi rỗng: `validateCommands` từ chối lệnh
 * thiếu `actorId`, nên một mặc định rỗng sẽ làm mọi lệnh hỏng ở bước `validate`
 * thay vì hỏng ở chỗ người nối dây quên truyền.
 */
export const WALL_LAYER_DEFAULT_ACTOR_ID = 'wall-layer-reviewer';

/** Cổng thật — thứ container lớp 3 gọi. */
export function createWallLayerReviewGateway(
  options: CreateWallLayerReviewGatewayOptions = {},
): WallLayerReviewGateway {
  const apiClient = options.apiClient ?? mockApiClient;
  const graph: WallLayerGraphPort = options.graph ?? {
    read: () => useStore.getState().spatial,
  };

  return {
    supports: {
      readBackground: true,
      readWallGraph: true,
      writeWallGraph: true,
      persistWallLayer: false,
    },

    readBackground: async ({ floorId, projectId, signal }) => {
      const result = await apiClient.spatial.readFloor(
        signal === undefined ? { floorId, projectId } : { floorId, projectId, signal },
      );

      if (!result.ok) {
        throw result.error;
      }

      const drawing = result.data.drawings[0];

      return {
        imageUrl: drawing?.url ?? null,
        imageAlt: backgroundImageAlt(result.data.name),
        widthMm: drawing?.widthMm ?? null,
        heightMm: drawing?.heightMm ?? null,
      };
    },

    readWallLayer: () => Promise.resolve(graph.read()),

    graph,

    persistWallLayer: () => Promise.resolve(unsupported('persistWallLayer')),

    nextWallId: options.nextWallId ?? ((): WallId => createId('wall')),
    actorId: options.actorId ?? WALL_LAYER_DEFAULT_ACTOR_ID,
    now: options.now ?? ((): number => Date.now()),
  };
}

/* -------------------------------------------------------------------------- */
/* Bộ mẫu — chỗ story và test cắm vào (R-73).                                  */
/* -------------------------------------------------------------------------- */

/** Ảnh nền của bộ mẫu. Không phải đường dẫn thật, nên không phạm R-65. */
export const WALL_LAYER_SAMPLE_IMAGE = 'sample-floor-plan.png';

/**
 * Khổ bản vẽ mẫu — bao trọn lưới 12.500 × 8.800 mm của bộ mẫu, có lề.
 *
 * Hai con số này là DỮ LIỆU của bộ mẫu (khổ tờ bản vẽ), không phải ngưỡng hay
 * thời lượng, nên chúng thuộc về bảng dữ liệu này chứ không phải một hằng rải
 * trong thân hàm — cùng khuôn `BILLING_MOCK_DATA` của `billingGateway.ts`.
 */
export const WALL_LAYER_SAMPLE_DRAWING_WIDTH_MM = 13000;
export const WALL_LAYER_SAMPLE_DRAWING_HEIGHT_MM = 9300;

/** Cách bài kiểm ép một cảnh cụ thể, không sửa mã. */
export interface WallLayerGatewaySeed {
  /** Đồ thị cổng trả về. Vắng mặt thì cổng đọc store thật. */
  readonly graph?: NormalizedSpatial | null;
  /** `true` thì `readBackground` ném — ảnh nền mất, lớp tường thì không. */
  readonly failReadBackground?: boolean;
  /** `true` thì `readWallLayer` ném — đúng cảnh `error` của bảy kịch bản. */
  readonly failReadWallLayer?: boolean;
  /** `true` thì ảnh nền chưa có — canvas vẽ khung xám chờ. */
  readonly withoutImage?: boolean;
  /** `true` thì `persistWallLayer` chạy thật (bộ mẫu có đường lưu), cho nhãn "Đã lưu lúc…". */
  readonly canPersist?: boolean;
  readonly actorId?: string;
  readonly now?: () => number;
  readonly nextWallId?: () => WallId;
}

/** Cổng có dữ liệu — dùng chung giữa test và story, không bịa bảng dữ liệu thứ hai (R-70). */
export function createMockWallLayerReviewGateway(
  seed: WallLayerGatewaySeed = {},
): WallLayerReviewGateway {
  const canPersist = seed.canPersist ?? true;
  let counter = 0;

  return {
    supports: {
      readBackground: true,
      readWallGraph: true,
      writeWallGraph: true,
      persistWallLayer: canPersist,
    },

    readBackground: () => {
      if (seed.failReadBackground === true) {
        return Promise.reject(new Error('Không tải được bản vẽ gốc của tầng.'));
      }

      const hasImage = seed.withoutImage !== true;

      return Promise.resolve({
        imageUrl: hasImage ? WALL_LAYER_SAMPLE_IMAGE : null,
        imageAlt: backgroundImageAlt(WALL_LAYER_FIXTURE_LEVEL.name),
        widthMm: hasImage ? WALL_LAYER_SAMPLE_DRAWING_WIDTH_MM : null,
        heightMm: hasImage ? WALL_LAYER_SAMPLE_DRAWING_HEIGHT_MM : null,
      });
    },

    readWallLayer: () => {
      if (seed.failReadWallLayer === true) {
        return Promise.reject(new Error('Không tải được lớp tường của tầng.'));
      }

      return Promise.resolve(seed.graph ?? useStore.getState().spatial);
    },

    graph: { read: () => seed.graph ?? useStore.getState().spatial },

    persistWallLayer: () =>
      Promise.resolve(canPersist ? { supported: true, value: undefined } : unsupported('persistWallLayer')),

    /*
     * Mã tường mới của bộ mẫu — cùng khuôn `createId`, KHÔNG phải "W-M1".
     *
     * Thân mã phải dài ít nhất 10 ký tự `[0-9A-Z]` hoặc `dispatch.ts:285` từ
     * chối lệnh vẽ tường ngay ở bước kiểm (xem đầu `wallLayerReviewFixture.ts`).
     * Vẫn tất định: số đếm chạy trong phạm vi một cổng giả, đuôi là hằng.
     */
    nextWallId:
      seed.nextWallId ??
      ((): WallId => {
        counter += 1;

        return `W-${formatNumber(counter, { grouping: false, fractionDigits: 0 }).padStart(
          ID_COUNTER_LENGTH,
          '0',
        )}MOCK` as WallId;
      }),
    actorId: seed.actorId ?? WALL_LAYER_DEFAULT_ACTOR_ID,
    now: seed.now ?? ((): number => Date.now()),
  };
}

/** Bộ mẫu đầy đủ, đúng 48 tường / 12 đã duyệt — xem `wallLayerReviewFixture.ts`. */
export const WALL_LAYER_SAMPLE_WALLS = WALL_LAYER_FIXTURE_WALLS;

/* -------------------------------------------------------------------------- */
/* Tầng lệnh — bảy lệnh S-07 gọi lại, một lệnh duyệt dựng bằng nguyên thuỷ.     */
/* -------------------------------------------------------------------------- */

/**
 * Loại của lệnh duyệt.
 *
 * Không nằm trong `WALL_COMMAND_TYPES` vì lệnh này không tồn tại ở S-07; hằng
 * đặt tên ở đây là chỗ DUY NHẤT chuỗi đó được viết, nên nhật ký hoạt động, đo
 * đạc và bài kiểm cùng đọc một nguồn (R-71).
 */
export const WALL_APPROVE_COMMAND_TYPE = 'wall.approve';

/** Câu mô tả trên nút hoàn tác và nhật ký hoạt động — `validateCommands` đòi nó khác rỗng. */
export const approveDescription = (wallId: WallId): string => `Duyệt tường ${wallId}.`;

/**
 * Lệnh duyệt một tường.
 *
 * A5: đây là đường DUY NHẤT đặt `reviewed: true`, và nó luôn đặt kèm
 * `source: 'human'` — không có tham số nào cho phép nơi gọi truyền `source`,
 * nên đầu ra AI không có đường nào bật được cờ xanh "đã xác minh".
 *
 * Ảnh chụp `before`/`after` là ĐẦY ĐỦ (`changeForUpdate` giữ nguyên hai bản
 * ghi, không phải diff từng trường), nên `invertCommand` hoàn tác được lệnh này
 * mà không cần biết nó nghĩa là gì.
 */
export function buildApproveWallCommand(before: Wall, actorId: string): Command {
  const after: Wall = { ...before, reviewed: true, source: 'human' };

  return createCommand({
    type: WALL_APPROVE_COMMAND_TYPE,
    actorId,
    description: approveDescription(before.id),
    changes: [changeForUpdate('wall', before, after)],
  });
}

/** Ngữ cảnh mà bảy hàm dựng lệnh của S-07 đọc. */
export const commandContextOf = (
  graph: NormalizedSpatial,
  actorId: string,
): CommandContext => ({ graph, actorId });

/** Đổi độ dày — gọi lại S-07, không dựng lại. */
export const buildChangeThicknessCommand = (
  input: ChangeWallThicknessInput,
  context: CommandContext,
): CommandResult => createChangeWallThicknessCommand(input, context);

/** Tách đoạn — gọi lại S-07. Điểm cắt được chính hình học rơi xuống tim tường. */
export const buildSplitWallCommand = (
  input: SplitWallInput,
  context: CommandContext,
): CommandResult => createSplitWallCommand(input, context);

/** Nối đoạn — gọi lại S-07. Hành động theo VÙNG CHỌN, không phải một chế độ công cụ. */
export const buildMergeWallsCommand = (
  input: MergeWallsInput,
  context: CommandContext,
): CommandResult => createMergeWallsCommand(input, context);

/** Xoá — gọi lại S-07. Xoá kéo theo ô mở và tham chiếu, trong CÙNG một lệnh. */
export const buildDeleteWallCommand = (
  input: DeleteWallInput,
  context: CommandContext,
): CommandResult => createDeleteWallCommand(input, context);

/** Vẽ tường — gọi lại S-07, cho lượt kết thúc một cử chỉ của công cụ `drawWall`. */
export const buildDrawWallCommand = (
  input: DrawWallInput,
  context: CommandContext,
): CommandResult => createDrawWallCommand(input, context);

/**
 * Một kết quả của máy công cụ thành một lệnh, hoặc `null` khi nó không phải
 * việc của lớp tường.
 *
 * `ToolCommandRequest` là "con đường duy nhất từ thanh công cụ tới dữ liệu"
 * (`toolMachine.ts:213`): nó chỉ nêu TÊN của hàm dựng lệnh và đầu vào, còn việc
 * gọi hàm nào là của tầng này. Hai loại lớp tường nhận là `wall.draw` (kết thúc
 * một cử chỉ vẽ) và `wall.split` (kết thúc một cử chỉ cắt); ô mở và đồ đạc
 * thuộc lớp khác nên rơi vào `null` chứ không bị dựng nhầm ở đây.
 */
export function toolOutcomeToCommand(
  outcome: ToolOutcome,
  context: CommandContext,
): Command | null {
  if (outcome.kind !== 'command') {
    return null;
  }

  if (outcome.request.type === WALL_COMMAND_TYPES.draw) {
    const built = buildDrawWallCommand(outcome.request.input, context);

    return built.ok ? built.data : null;
  }

  if (outcome.request.type === WALL_COMMAND_TYPES.split) {
    const built = buildSplitWallCommand(outcome.request.input, context);

    return built.ok ? built.data : null;
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Đường ghi — `dispatch` chạy qua `commit`.                                   */
/* -------------------------------------------------------------------------- */

/**
 * Cổng ghi của `dispatch`, cài bằng `commit`.
 *
 * `commit` nhận `SpatialPatch[]` và một nhãn tiếng Việt, đúng hai thứ
 * `applyPatches` có trong tay. Nhãn lấy từ chính `label` của lượt dispatch, nên
 * nút hoàn tác và nhật ký hoạt động đọc cùng một câu.
 */
export function createCommitSpatialPort(
  graph: WallLayerGraphPort,
  labelOf: () => string,
): SpatialPort {
  return {
    read: () => graph.read(),
    applyPatches: (patches) => {
      commit(patches, labelOf());
    },
  };
}

/** Bộ phụ thuộc năm bước của `dispatch`, gắn với ngăn xếp hoàn tác 100 bước của S-06. */
export interface WallLayerDispatchDeps {
  readonly deps: DispatchDeps;
  readonly history: HistoryStack;
  /** Nhãn của lượt dispatch đang chạy — `SpatialPort` đọc nó để đặt tên cho `commit`. */
  readonly setLabel: (label: string) => void;
}

export interface CreateWallLayerDispatchOptions {
  readonly graph: WallLayerGraphPort;
  /** Vùng chọn TRƯỚC lượt ghi; `stack.undo()` khôi phục lại đúng nó. */
  readonly selectionBefore: () => SelectionSnapshot;
  readonly selectionAfter: () => SelectionSnapshot;
  /** Bước `sync` — đánh dấu bản vẽ bẩn cho tự lưu (S-11). */
  readonly onSynced: () => void;
  readonly history?: HistoryStack;
}

/**
 * Dựng `DispatchDeps` đầy đủ năm cổng.
 *
 * `history` là ngăn xếp thật của `src/lib/commands/history.ts` (mặc định
 * `MAX_HISTORY_STEPS` = 100 bước), không phải `temporal` của zundo: `Ctrl+Z`
 * của màn này phải hoàn tác đúng những lệnh màn đã chạy, kèm cả vùng chọn
 * trước đó.
 */
export function createWallLayerDispatchDeps(
  options: CreateWallLayerDispatchOptions,
): WallLayerDispatchDeps {
  const history = options.history ?? createHistoryStack();
  let label = '';

  const deps: DispatchDeps = {
    spatial: createCommitSpatialPort(options.graph, () => label),
    history: {
      push: (entry) => {
        history.push({
          entry,
          selectionBefore: options.selectionBefore(),
          selectionAfter: options.selectionAfter(),
        });
      },
      drop: (entryId) => {
        history.drop(entryId);
      },
    },
    rules: createIncrementalRuleRunner(),
    sync: {
      enqueue: () => {
        options.onSynced();
      },
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

/** Chạy một lệnh qua đủ năm bước. Nhãn của lượt là mô tả của chính lệnh. */
export async function runWallCommand(
  command: Command,
  bundle: WallLayerDispatchDeps,
): Promise<DispatchResult> {
  bundle.setLabel(command.description);

  return dispatch(command, bundle.deps);
}

/** Vùng chọn rỗng, cho lượt ghi không có gì được chọn trước đó. */
export const NO_WALL_SELECTION: SelectionSnapshot = NO_SELECTION;

/* -------------------------------------------------------------------------- */
/* Vé hoàn tác (D-05) — xoá là tức thì, không hộp thoại.                       */
/* -------------------------------------------------------------------------- */

/** Câu trên toast hoàn tác sau khi xoá. */
export const deleteToastDescription = (wallId: WallId): string =>
  `Đã xoá tường ${wallId}.`;

export interface CreateWallUndoTicketOptions {
  readonly wallId: WallId;
  readonly undo: () => void;
  readonly now: () => number;
}

/**
 * Vé hoàn tác của một lượt xoá.
 *
 * `UNDO_WINDOW_MS` (8000 ms, A8) tới từ `src/lib/mutations/undoTicket.ts` — con
 * số không được viết lại ở màn (R-71), và `createUndoTicket` dùng nó làm mặc
 * định nên ở đây thậm chí không có tham số nào mang nó.
 */
export function createWallUndoTicket(options: CreateWallUndoTicketOptions): UndoTicket {
  return createUndoTicket({
    description: deleteToastDescription(options.wallId),
    now: options.now,
    undo: options.undo,
  });
}

/** Cửa sổ hoàn tác, xuất lại để hook và bài kiểm đọc đúng một nguồn. */
export { UNDO_WINDOW_MS };

/* -------------------------------------------------------------------------- */
/* Hình học — GỌI LẠI, không tự tính.                                          */
/* -------------------------------------------------------------------------- */

/** Đổi một tường đồ thị sang vựng hình học của `src/domain/walls`. */
export const toGeometryWall = (wall: Wall, level: Level): SolidWall =>
  toSolidWall(wall, level);

/**
 * Đa giác của mọi tường trên tầng, qua `resolveWallShapes` — nguồn DUY NHẤT của
 * hình tường để vẽ.
 *
 * `resolveWallShapes` ném `RangeError` khi một tường không dùng được (dày ngoài
 * 60–600 mm, dài 0, đỉnh trên không cao hơn đỉnh dưới) và `Error` khi hai tường
 * trùng mã. Một bản vẽ hỏng không được làm trắng màn (A11), nên lỗi đó thành
 * "không có hình nào để vẽ" và danh sách bên phải vẫn đọc được.
 */
export function toWallShapes(
  walls: readonly Wall[],
  level: Level,
  statusOf: (wall: Wall) => ViewStatusCode,
): readonly WallShapeViewModel[] {
  if (walls.length === 0) {
    return [];
  }

  let outlineById: ReadonlyMap<WallId, readonly Point[]>;

  try {
    const resolved = resolveWallShapes(walls.map((wall) => toGeometryWall(wall, level)));

    outlineById = new Map(resolved.shapes.map((shape) => [shape.wallId, shape.outline]));
  } catch {
    return [];
  }

  const shapes: WallShapeViewModel[] = [];

  for (const wall of walls) {
    const outline = outlineById.get(wall.id);

    if (outline !== undefined) {
      shapes.push({ id: wall.id, outline, statusCode: statusOf(wall) });
    }
  }

  return shapes;
}

/** Kết quả tách một tường, để hook biết lệnh tách có chạy được không trước khi gọi. */
export const canSplitWallAt = (wall: Wall, level: Level, at: Point, secondId: WallId): boolean =>
  splitWall(toGeometryWall(wall, level), toPointMm(at), secondId).ok;

/** Kết quả nối hai tường, cùng lý do như trên. */
export const canMergeWalls = (first: Wall, second: Wall, level: Level): boolean =>
  mergeWalls(toGeometryWall(first, level), toGeometryWall(second, level)).ok;

/* -------------------------------------------------------------------------- */
/* Quy đổi mm → px cho lớp canvas.                                             */
/* -------------------------------------------------------------------------- */

/*
 * Hợp đồng mở rộng của lớp canvas (`wallLayerHatch.ts#WallLayerCanvasViewProps`,
 * nhánh `mungvu2004/wlr-view-canvas`) nói rõ: MỌI toạ độ nó nhận đã là PIXEL
 * của ảnh bản vẽ, vì `<svg viewBox>` của nó lấy đúng khổ ảnh tính bằng pixel.
 * Quy đổi vì thế thuộc về hook, không thuộc về view (A15/R-60) — và nó không
 * phải một công thức tự chế: `scaleFromRatio(ratio).millimetresToPixels` của
 * `src/domain/units/scale.ts` là hàm duy nhất làm việc đó trong repo (R-61).
 */

/*
 * Bốn kiểu px NAY LẤY TỪ `wallLayerHatch.ts`, không khai lại.
 *
 * Chúng từng được chép thành hai bản vì hai worker viết song song trên hai
 * nhánh chưa gộp: bản này và bản của lớp canvas. Sau lượt gộp, hai bản chỉ còn
 * là hai chỗ để lệch nhau, nên bản gốc thắng — `wallLayerHatch.ts` là nơi hợp
 * đồng canvas được khai, và mọi nơi khác đọc nó.
 */
export type {
  WallLayerCanvasShape,
  WallLayerPointerReading,
  WallLayerRectPx,
  WallLayerSizePx,
  WallLayerViewportPx,
  WallLayerViewportRectPercent,
} from './wallLayerHatch';

/** Bộ quy đổi của một tầng. Tầng chưa hiệu chỉnh thì một pixel là một milimét. */
export const scaleOfLevel = (level: Level | null): Scale =>
  scaleFromRatio(level?.scaleMillimetresPerPixel ?? millimetresPerPixel(1));

/** Một điểm milimét của đồ thị, đọc trên ảnh bản vẽ. */
export const toPixelPoint = (point: Point, scale: Scale): Point => ({
  x: scale.millimetresToPixels(millimetres(point.x)),
  y: scale.millimetresToPixels(millimetres(point.y)),
});

/** Chiều ngược lại: một điểm trên ảnh bản vẽ, đọc ra milimét công trình. */
export const toMillimetrePoint = (point: Point, scale: Scale): Point => ({
  x: scale.pixelsToMillimetres(pixels(point.x)),
  y: scale.pixelsToMillimetres(pixels(point.y)),
});

/* -------------------------------------------------------------------------- */
/* Thanh trạng thái: toạ độ con trỏ.                                           */
/* -------------------------------------------------------------------------- */

/** Chưa có lượt đọc nào — dấu thiếu, KHÔNG phải "0; 0" (một số đo không ai đo). */
export const CURSOR_IDLE_LABEL = 'chưa rê chuột lên bản vẽ';

/**
 * Một lượt đọc con trỏ → chuỗi toạ độ đã định dạng của thanh trạng thái.
 *
 * Toạ độ vào ĐÃ là pixel bản vẽ (trình duyệt đổi giúp, xem
 * {@link WallLayerPointerReading}), nên ở đây chỉ còn đúng một việc: pixel →
 * milimét bằng hàm của `src/domain/units/scale.ts`, rồi định dạng bằng
 * `formatPoint` — cùng hàm mà thanh tra dùng cho toạ độ đầu/cuối, nên hai chỗ
 * không thể lệch cách viết số (R-61).
 */
export function cursorLabelOf(reading: WallLayerPointerReading | null, scale: Scale): string {
  if (reading === null) {
    return CURSOR_IDLE_LABEL;
  }

  return formatPoint(toMillimetrePoint({ x: reading.xPx, y: reading.yPx }, scale));
}

/* -------------------------------------------------------------------------- */
/* Khung nhìn: mức phóng, "vừa khung", bản đồ nhỏ.                             */
/* -------------------------------------------------------------------------- */

/**
 * Giới hạn mức phóng — cùng hai đầu mà `viewSlice.setZoom` đã kẹp.
 *
 * Đọc lại ở đây để phép "vừa khung" không đề nghị một mức mà kho sẽ lặng lẽ kẹp
 * lại, khiến nhãn phần trăm nói một đằng còn khung nhìn một nẻo.
 */
export const MIN_WALL_LAYER_ZOOM = 0.1;
export const MAX_WALL_LAYER_ZOOM = 10;

/** Mỗi lượt bấm +/− đổi mức phóng một phần tư. */
export const ZOOM_STEP = 0.25;

/** Mức phóng gốc — nút phần trăm bấm được để về đây. */
export const DEFAULT_ZOOM = 1;

/**
 * Kẹp mức phóng vào hai đầu, KHÔNG gọi đối tượng toán học toàn cục.
 *
 * Thư mục màn phải qua được phép soát "không hàm hình học nào trong màn" (bản
 * nghiệm thu mục 7.3), nên hai phép so sánh viết thẳng thay cho hai hàm nhỏ
 * nhất/lớn nhất dựng sẵn. Kết quả giống hệt.
 */
export function clampZoom(zoom: number): number {
  if (zoom < MIN_WALL_LAYER_ZOOM) {
    return MIN_WALL_LAYER_ZOOM;
  }

  return zoom > MAX_WALL_LAYER_ZOOM ? MAX_WALL_LAYER_ZOOM : zoom;
}

/** Mức phóng → phần trăm nguyên cho `ZoomCluster` (A15: view không tự nhân trăm). */
export const zoomPercentOf = (zoom: number): number =>
  Number(formatNumber(zoom * ZOOM_PERCENT_PER_UNIT, { grouping: false, fractionDigits: 0 }));

/** Một lần phóng là một trăm phần trăm. */
const ZOOM_PERCENT_PER_UNIT = 100;

/**
 * Mức phóng để một vùng vừa khít khung, cộng lề thở.
 *
 * Cần CẢ khổ khung (chỉ view biết, báo lên bằng `onFrameResize`) lẫn khổ vùng
 * muốn phủ. Thiếu một trong hai thì trả `null` và nơi gọi giữ nguyên mức phóng —
 * đoán một con số ở đây là đúng thứ R-69 cấm.
 */
export function fitZoomFor(
  frame: WallLayerSizePx | null,
  bounds: WallLayerRectPx | null,
): number | null {
  if (frame === null || bounds === null) {
    return null;
  }

  if (frame.width === 0 || frame.height === 0 || bounds.width === 0 || bounds.height === 0) {
    return null;
  }

  const byWidth = (frame.width * FIT_MARGIN_RATIO) / bounds.width;
  const byHeight = (frame.height * FIT_MARGIN_RATIO) / bounds.height;

  return clampZoom(byWidth < byHeight ? byWidth : byHeight);
}

/** Chừa 10% lề quanh vùng phủ, để đường viền ngoài cùng không dính mép khung. */
const FIT_MARGIN_RATIO = 0.9;

/** Thang vùng nhìn của `useMiniMap`: x/y/rộng/cao đều kẹp trong 0..100. */
const MINIMAP_VIEWPORT_SPAN = 100;

/** Tâm của một hộp, đơn vị pixel bản vẽ. */
export const centreOfBounds = (bounds: WallLayerRectPx): Point => ({
  x: bounds.x + bounds.width / HALF,
  y: bounds.y + bounds.height / HALF,
});

const HALF = 2;

/**
 * Vùng nhìn của bản đồ nhỏ (phần trăm khổ bản vẽ) → tâm nhìn tính bằng milimét.
 *
 * `useMiniMap` làm việc bằng phần trăm 0..100 trên khổ bản đồ; khổ bản đồ là khổ
 * bản vẽ thu nhỏ, nên cùng một phần trăm đọc thẳng được trên khổ bản vẽ.
 */
export function miniMapCentreMm(
  rect: WallLayerViewportRectPercent,
  drawingSizePx: WallLayerSizePx,
  scale: Scale,
): Point {
  /*
   * Phép chia dưới đây KHÔNG phải quy đổi đơn vị đo, nên nó không thuộc về
   * `src/domain` như `local/no-raw-number` vốn đòi: `MINIMAP_VIEWPORT_SPAN` là
   * THANG mà `useMiniMap` tự kẹp vùng nhìn vào (`useMiniMap.ts:49-50` kẹp x/y
   * trong 0..100), nên đây là đọc một PHẦN của thang ấy ra, cùng loại với việc
   * đọc một phần trăm tiến độ. Phép quy đổi đơn vị thật — pixel sang milimét —
   * nằm ở dòng cuối, và nó đi qua `scale.pixelsToMillimetres` của
   * `src/domain/units/scale.ts`, đúng chỗ luật chỉ tới.
   */
  const centrePx: Point = {
    x: ((rect.x + rect.width / HALF) / MINIMAP_VIEWPORT_SPAN) * drawingSizePx.width,
    y: ((rect.y + rect.height / HALF) / MINIMAP_VIEWPORT_SPAN) * drawingSizePx.height,
  };

  return toMillimetrePoint(centrePx, scale);
}

/**
 * Hộp bao của một chuỗi điểm.
 *
 * Không gọi lại được: `src/domain` có `BoundingBox` và `boxAround`/`marqueeBox`
 * (hai điểm), nhưng KHÔNG có hàm nào gấp một đa giác N đỉnh thành hộp bao —
 * `rg "boundsOf|BoundingBox" src/domain src/lib` chỉ ra hai hàm hai-điểm đó và
 * `boundsOfIds` của lớp ba chiều (`Box3` của three.js). Đây là một phép GẤP
 * bằng so sánh, không phải một công thức hình học có sẵn ở nơi khác, và nó
 * không gọi tới đối tượng toán học toàn cục.
 */
export function boundsOfPoints(points: readonly Point[]): WallLayerRectPx | null {
  const first = points[0];

  if (first === undefined) {
    return null;
  }

  let left = first.x;
  let right = first.x;
  let top = first.y;
  let bottom = first.y;

  for (const point of points) {
    left = point.x < left ? point.x : left;
    right = point.x > right ? point.x : right;
    top = point.y < top ? point.y : top;
    bottom = point.y > bottom ? point.y : bottom;
  }

  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Hộp bao của nhiều hộp bao — vùng bản đồ nhỏ phải vẽ. */
export function unionOfBounds(
  boxes: readonly WallLayerRectPx[],
): WallLayerRectPx | null {
  const corners: Point[] = [];

  for (const box of boxes) {
    corners.push({ x: box.x, y: box.y });
    corners.push({ x: box.x + box.width, y: box.y + box.height });
  }

  return boundsOfPoints(corners);
}

/**
 * Hình tường cho lớp canvas: đa giác, tim tường và hộp bao, tất cả bằng pixel.
 *
 * Đa giác vẫn tới từ `resolveWallShapes` (nguồn duy nhất), chỉ được đọc lại
 * bằng đơn vị mà `<svg viewBox>` của canvas dùng.
 */
export function toCanvasShapes(
  walls: readonly Wall[],
  level: Level,
  statusOf: (wall: Wall) => ViewStatusCode,
): readonly WallLayerCanvasShape[] {
  const scale = scaleOfLevel(level);
  const outlines = new Map(toWallShapes(walls, level, statusOf).map((shape) => [shape.id, shape]));
  const shapes: WallLayerCanvasShape[] = [];

  for (const wall of walls) {
    const shape = outlines.get(wall.id);

    if (shape === undefined) {
      continue;
    }

    const outline = shape.outline.map((point) => toPixelPoint(point, scale));
    const bounds = boundsOfPoints(outline);

    if (bounds === null) {
      continue;
    }

    shapes.push({
      id: wall.id,
      outline,
      statusCode: shape.statusCode,
      codeLabel: `#${wallDisplayCode(wall.id)}`,
      thicknessMm: wall.thicknessMm,
      centrelinePx: {
        start: toPixelPoint(wall.centreline.start, scale),
        end: toPixelPoint(wall.centreline.end, scale),
      },
      boundsPx: bounds,
      /*
       * Tâm chấm cần chú ý, tính Ở ĐÂY chứ không ở view.
       *
       * `WallLayerShapeFigure.tsx` từng viết `boundsPx.x + boundsPx.width / 2`
       * ngay trong thuộc tính `cx` — một phép hình học trong màn, đúng thứ câu
       * "không một phép hình học nào ở đây" của `WallLayerCanvas.tsx` cấm.
       * `centreOfBounds` đã tồn tại và hook đã dùng nó cho "vừa khung", nên
       * chấm và khung nhìn nay đọc chung một phép.
       */
      attentionDotPx: centreOfBounds(bounds),
      isLowConfidence: hasLowConfidenceHatch(wall.confidence),
    });
  }

  return shapes;
}

/** Khổ ảnh bản vẽ tính bằng pixel. `null` khi chưa có bản vẽ nào. */
export function drawingSizeOf(
  background: WallLayerBackground | undefined,
  level: Level | null,
): WallLayerSizePx | null {
  if (background === undefined || background.widthMm === null || background.heightMm === null) {
    return null;
  }

  const scale = scaleOfLevel(level);

  return {
    width: scale.millimetresToPixels(millimetres(background.widthMm)),
    height: scale.millimetresToPixels(millimetres(background.heightMm)),
  };
}

/**
 * Ba băng độ dày CÓ THẬT trên tầng.
 *
 * Không dùng `generateLegend` của P-07: `Legend` của nó là bảng đếm theo TOKEN
 * MÀU của một `ColoringMode` (`src/lib/coloring/legend.ts:441`), còn thứ lớp
 * canvas hỏi là ba băng độ dày — hai khái niệm khác nhau, và dựng một
 * `ColoringMode` giả chỉ để lọc ba con số là đi vòng cho xa hơn.
 */
export const legendLevelsOf = (walls: readonly Wall[]): readonly WallThicknessChoice[] =>
  WALL_THICKNESS_CHOICES.filter((choice) => walls.some((wall) => wall.thicknessMm === choice));

/** Nhãn của khung canvas — "Mặt bằng Tầng 1 — 48 tường". */
export const canvasLabelOf = (level: Level | null, total: number): string =>
  `Mặt bằng ${level?.name ?? 'chưa xác định'} — ${formatNumber(total, { fractionDigits: 0 })} tường`;

/* -------------------------------------------------------------------------- */
/* Định dạng — A15, mọi con số thành chuỗi TRƯỚC khi rời khỏi hook.            */
/* -------------------------------------------------------------------------- */

/** Số chữ số thập phân của một chiều dài tim tường — "4.250,00 mm". */
const LENGTH_FRACTION_DIGITS = 2;

/** Độ dày, luôn ở milimét để một cột số thẳng hàng — "220 mm". */
export const formatThickness = (thicknessMm: number): string =>
  formatLength(thicknessMm, { unit: 'mm' });

/** Chiều dài tim tường — "4.250,00 mm", dấu phẩy thập phân (A15). */
export const formatCentrelineLength = (wall: Wall, level: Level): string =>
  formatLength(centrelineLength(toGeometryWall(wall, level)), {
    unit: 'mm',
    fractionDigits: LENGTH_FRACTION_DIGITS,
  });

/** Tỷ lệ của tầng — "12 mm/px". Tầng chưa hiệu chỉnh thì trả dấu thiếu, không phải "undefined". */
export const formatScaleLabel = (level: Level | null): string =>
  formatScaleDensity(level?.scaleMillimetresPerPixel);

/** Bộ đếm duyệt thành câu — "12/48 tường đã duyệt". */
export const reviewProgressLabel = (reviewedText: string, total: number): string =>
  `${reviewedText}/${formatNumber(total, { fractionDigits: 0 })} tường đã duyệt`;

/* -------------------------------------------------------------------------- */
/* Công cụ đo — số đo do `src/domain/measure` tính, màn chỉ đọc lại.           */
/* -------------------------------------------------------------------------- */

/**
 * Hai điểm milimét của bản vẽ → nhãn đo bằng pixel mà `MeasurementLabel` nhận.
 *
 * KHÔNG một phép hình học nào viết mới ở đây:
 * - khoảng cách là `measureDistance` của `src/domain/measure/measure.ts`, đúng
 *   hàm mà `MEASURE_TOOL` (`src/lib/tools/tools.ts`) gọi ở bước `complete`, nên
 *   nhãn trên canvas và số máy công cụ phát ra không thể lệch nhau;
 * - quy đổi mm → px là `scale.millimetresToPixels` qua {@link toPixelPoint};
 * - điểm giữa là {@link centreOfBounds} của hộp bao hai đầu ({@link boundsOfPoints}),
 *   hai hàm đã có sẵn và đã được hook dùng cho "vừa khung".
 */
export function toMeasurementPx(
  startMm: Point,
  endMm: Point,
  scale: Scale,
  state: MeasurementState,
): WallLayerMeasurementPx {
  const startPx = toPixelPoint(startMm, scale);
  const currentPx = toPixelPoint(endMm, scale);
  const bounds = boundsOfPoints([startPx, currentPx]);
  const distance = measureDistance(toPointMm(startMm), toPointMm(endMm));

  return {
    state,
    startPx,
    currentPx,
    midPx: bounds === null ? null : centreOfBounds(bounds),
    distanceLabel: formatLength(distance.lengthMm, {
      unit: 'mm',
      fractionDigits: LENGTH_FRACTION_DIGITS,
    }),
  };
}

/**
 * Kết quả `kind: 'measurement'` của máy công cụ → nhãn đo đã chốt.
 *
 * Chỉ `distance` có nghĩa ở màn này: `MEASURE_TOOL` là công cụ đo duy nhất màn
 * bật, và bốn loại đo còn lại của `src/domain/measure` (chuỗi, góc, diện tích,
 * cao độ) không có tool nào phát ra chúng ở đây. Loại khác trả `null` chứ không
 * bị vẽ nhầm thành một khoảng cách.
 */
export function measurementOutcomeToPx(
  measurement: Measurement,
  scale: Scale,
): WallLayerMeasurementPx | null {
  if (measurement.kind !== 'distance') {
    return null;
  }

  const [from, to] = measurement.points;

  return toMeasurementPx({ x: from.x, y: from.y }, { x: to.x, y: to.y }, scale, 'committed');
}

/* -------------------------------------------------------------------------- */
/* Viewmodel của một tường.                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Độ dày này có nằm trong ba băng hệ thiết kế sơn được không.
 *
 * Ba băng đến từ {@link WALL_THICKNESS_CHOICES} của `types.ts` — hợp đồng đã
 * đóng băng của màn, không phải một danh sách viết tay ở đây (R-71).
 * `STANDARD_THICKNESSES_MM` của `src/domain/walls/cleanup.ts` là một danh sách
 * KHÁC (độ dày xây được: 100/150/200/220/300/400) và `types.ts` nói rõ bộ lọc
 * của màn này KHÔNG dùng nó — xem chú thích {@link WALL_THICKNESS_CHOICES}.
 */
export const isStandardThickness = (thicknessMm: number): boolean =>
  WALL_THICKNESS_CHOICES.some((choice) => choice === thicknessMm);

/**
 * Tường này có dưới ngưỡng "cần chú ý" không — băng `needsReview`, tức **dưới
 * 0,70**.
 *
 * Ngưỡng KHÔNG được viết ở màn: `CONFIDENCE_SUGGESTED_THRESHOLD` của
 * `@/lib/format/semantic` là chỗ duy nhất con số đó tồn tại, và `confidenceLevel`
 * là hàm duy nhất phân loại.
 *
 * ## Vì sao KHÔNG phải `!== 'certain'`
 *
 * Bản trước hỏi "khác `certain`", tức gom cả băng `suggested` (0,70 ≤ x < 0,90)
 * vào diện gạch chéo. Hệ quả đo được: canvas và danh sách nói hai chuyện khác
 * nhau về cùng một tường — canvas gạch chéo theo `materialMap.isLowConfidence`,
 * vốn đã là `needsReview` (< 0,70), còn danh sách và bộ lọc "Chỉ hiện độ tin cậy
 * thấp" thì gạch theo < 0,90. Một tường 0,80 bị gạch trong danh sách và không
 * gạch trên bản vẽ.
 *
 * Đặc tả đòi 0,75. Con số đó KHÔNG tồn tại ở đâu trong repo và R-71 cấm viết
 * thẳng nó vào màn; `needsReview` là băng có sẵn gần nó nhất. Người duyệt đã
 * chốt 0,70 — quyết định ghi ở đây vì đây là chỗ nó có hiệu lực.
 *
 * Một nguồn phân loại duy nhất: `WallRowViewModel.isLowConfidence`, bộ lọc
 * "Chỉ hiện độ tin cậy thấp" và gạch chéo của canvas nay đọc chung một câu trả
 * lời.
 */
export const isLowConfidence = (wall: Wall): boolean =>
  confidenceLevel(wall.confidence) === 'needsReview';

/**
 * Trạng thái màu của một tường.
 *
 * Nền là `toWallViewModel(wall).statusCode` (A5: `verified` chỉ tới từ
 * `reviewed`, không bao giờ từ điểm số của AI). Thêm đúng một điều màn này biết
 * mà viewmodel chung không biết: một tường chưa duyệt có độ dày ngoài ba băng
 * cũng là thứ người duyệt đang đi tìm, nên nó lên `attention`.
 */
export function wallStatusCode(wall: Wall): ViewStatusCode {
  const base = toWallViewModel(wall).statusCode;

  if (base === 'neutral' && !wall.reviewed && !isStandardThickness(wall.thicknessMm)) {
    return 'attention';
  }

  return base;
}

/** Một dòng của danh sách 48 tường. */
export function toWallRow(wall: Wall): WallRowViewModel {
  return {
    id: wall.id,
    codeLabel: `#${wallDisplayCode(wall.id)}`,
    thicknessMm: wall.thicknessMm,
    thicknessLabel: formatThickness(wall.thicknessMm),
    confidence: wall.confidence,
    statusCode: wallStatusCode(wall),
    isReviewed: wall.reviewed,
    isLowConfidence: isLowConfidence(wall),
    isNonStandardThickness: !isStandardThickness(wall.thicknessMm),
  };
}

/** Thanh tra tường đang chọn. Mọi con số đã thành chuỗi ở đây, không ở view (A15). */
export function toWallInspector(wall: Wall, level: Level): WallInspectorViewModel {
  return {
    id: wall.id,
    codeLabel: `#${wallDisplayCode(wall.id)}`,
    thicknessMm: wall.thicknessMm,
    lengthLabel: formatCentrelineLength(wall, level),
    /*
     * Chiều cao ở CÙNG cột milimét với chiều dài.
     *
     * `formatLength` tự đổi sang mét từ 1 m trở lên (`src/lib/format/measure.ts`),
     * nên `formatLength(3000)` ra "3,00 m" — một đơn vị khác hẳn dòng ngay trên
     * nó. Đặc tả đòi hai dòng đọc được cạnh nhau, nên đơn vị nói thẳng ra, và
     * số chữ số thập phân dùng lại đúng hằng của chiều dài (R-71).
     */
    heightLabel: formatLength(wall.heightMm, {
      unit: 'mm',
      fractionDigits: LENGTH_FRACTION_DIGITS,
    }),
    confidence: wall.confidence,
    kindLabel: WALL_KIND_LABELS[wall.kind],
    advanced: {
      elevationOffsetLabel: formatElevationM(level.elevationMm),
      startPointLabel: formatPoint(wall.centreline.start),
      endPointLabel: formatPoint(wall.centreline.end),
    },
  };
}

/** Ba lựa chọn độ dày, xuất lại để hook cấp thẳng cho view (R-60). */
export const WALL_LAYER_THICKNESS_CHOICES: readonly WallThicknessChoice[] =
  WALL_THICKNESS_CHOICES;
