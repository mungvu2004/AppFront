/**
 * Hook "suy nghĩ" của màn "Phát hiện tệp CAD" — toàn bộ logic hai giai đoạn,
 * bảy trạng thái và mọi phép định dạng số của màn nằm ở đây (mục D, A15).
 *
 * View chỉ nhận `model` + `actions` và vẽ. Nó không chạm store, không chạm
 * mạng, và **không bao giờ tự đọc tệp CAD** — mọi lượt đọc đi qua
 * `cadBranchConfirmGateway.ts`.
 *
 * ## Hai giai đoạn, một route, không lồng hộp thoại
 *
 * `stage === 'branchDialog'`: hộp thoại 560 chốt nhánh đang mở. Chọn **CAD** →
 * hộp thoại ĐÓNG (`dialog.isOpen === false`) và `stage` thành `'layerMapping'`,
 * panel ánh xạ mở ra bên dưới trong cùng route. Chọn **AI** → hộp thoại đóng và
 * màn hoà tan sang phần cài đặt AI bằng `onNavigate(ROUTES.project.pipeline(...))`.
 * Không lúc nào có hai hộp thoại chồng nhau: giai đoạn 2 không mở hộp thoại nào.
 *
 * ## Nhánh AI luôn còn đường về
 *
 * `onChooseBranch('ai')` KHÔNG có điều kiện nào chặn — ở mọi trạng thái, kể cả
 * `error` và `forbidden`, kể cả sau khi hộp thoại đã đóng. Ở trạng thái `error`
 * thì nó là lựa chọn DUY NHẤT còn bấm được
 * (`dialog.isCadChoiceDisabled === true`), và
 * `dialog.cadChoiceDisabledReason` nêu rõ số phiên bản tệp.
 *
 * ## Tiêu điểm và phím Esc — ai làm gì
 *
 * `Modal.Root` (`src/components/overlay/Modal.tsx:56-80`) ĐÃ tự làm ba việc:
 * `createFocusTrap` bẫy Tab trong hộp thoại, trả tiêu điểm về đúng nút đã mở
 * khi `release()` (`src/lib/input/focusTrap.ts:16-17`), và đăng ký
 * `Escape` ở phạm vi `dialog` qua `useShortcut`. Hook này **không bẫy lần hai
 * và không đăng ký `Escape` ở phạm vi `dialog`**: hai binding cùng một tổ hợp
 * trong cùng một phạm vi là đúng thứ trọng tài phím tắt báo trùng
 * (`shortcutRegistry.ts:380`).
 *
 * Lớp trên cùng của giai đoạn 2 không phải hộp thoại mà là khối gấp "Tuỳ chọn
 * nhập". A12 vẫn phải giữ lời hứa "Esc đóng lớp trên cùng", nên hook đăng ký
 * đúng MỘT binding `Escape` ở phạm vi `sidePanel`, chỉ bật khi khối đó đang mở
 * — đi qua `useShortcut`/`shortcutRegistry` (R-54), không `addEventListener`.
 *
 * ## Trạng thái máy chủ đi qua react-query (R-64)
 *
 * Không `useState` nào ở đây giữ `isLoading` hay `error` — đó là việc của
 * `useQuery`/`useMutation` (`useShareLinks.ts` là ngoại lệ đi trước, không phải
 * khuôn để chép). `useState` chỉ giữ trạng thái của riêng giao diện: giai đoạn
 * đang mở, vai trò người dùng vừa gán, lớp đang rê chuột qua, khối gấp.
 *
 * Khoá đệm là khoá bản vẽ của tầng CỘNG một hậu tố riêng của màn:
 * {@link CAD_INSPECTION_QUERY_SCOPE}. `queryKeys` không có miền `cad` và
 * KHÔNG được thêm vào (R-68 cấm sửa `src/lib/**`), nên khoá dựng bằng cách nối
 * thêm vào khoá đã có — vừa không đụng hàng với `useScaleCalibration` (dùng
 * đúng `queryKeys.drawing.byFloor(floorId)` cho một hình dạng dữ liệu khác),
 * vừa giữ được ngữ nghĩa "vô hiệu hoá theo tiền tố".
 */

import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useShortcut } from '@/hooks/useShortcut';
import { AUTH_ROLES, can } from '@/lib/auth/permissions';
import { formatNumber } from '@/lib/format/number';
import { queryKeys } from '@/lib/query/queryKeys';
import { ROUTES } from '@/routes/paths';
import type { ProjectRole } from '@/types/project';
import type { WallThickness } from '@/types/spatial';

import type {
  CadBranchConfirmGateway,
  CadInspectionSnapshot,
  CadLayerAssignment,
} from './cadBranchConfirmGateway';
import {
  CAD_REMEMBER_SESSION_NOTICE,
  createAppCadBranchConfirmGateway,
} from './cadBranchConfirmGateway';
import type {
  CadBranchChoice,
  CadBranchComparisonCell,
  CadBranchConfirmStage,
  CadBranchConfirmState,
  CadDrawingUnit,
  CadFloorAvailability,
  CadLayer,
  CadLayerRole,
  CadMappingSummary,
  CadOriginMode,
  CadPreviewEntity,
  CadPreviewExtent,
  CadSelectOption,
  CadWallThicknessLegendEntry,
  UnsupportedEntityKind,
  UseCadBranchConfirmOptions,
  UseCadBranchConfirmResult,
} from './types';

/* -------------------------------------------------------------------------- */
/* Chuỗi tiếng Việt của màn.                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Mọi câu người đọc của màn, một chỗ.
 *
 * Cùng cách `ScaleCalibration` gộp chuỗi vào hằng `COPY` ngay trong hook thay
 * vì tách một file text riêng — màn này ngắn hơn `PipelineGraph`, chưa cần tách.
 * Nhãn viết thường kiểu câu (A6); ngoại lệ chữ hoa là tên lớp CAD, tên loại
 * thực thể và số phiên bản định dạng — mã máy đọc, giữ nguyên dạng.
 */
const COPY = {
  emptyNotice:
    'tệp CAD không có lớp nào được đặt tên. hệ thống sẽ ánh xạ theo loại hình học thay cho tên lớp.',
  forbiddenNotice:
    'bạn không có quyền chỉnh sửa lớp của dự án này, nên không chốt được nhánh xử lý. liên hệ quản trị viên để được cấp quyền.',
  successNotice: 'đã nhập xong hình học từ tệp CAD.',
  workingNotice: 'chọn vai trò cho từng lớp, xem trước cập nhật ngay khi bạn đổi.',
  unitWarning:
    'tệp không khai báo đơn vị bản vẽ. hãy kiểm tra lại đơn vị ở khối "tuỳ chọn nhập" trước khi nhập hình học.',
  rememberSessionOnly: CAD_REMEMBER_SESSION_NOTICE,
  /**
   * Nhãn chú giải của mức dày duy nhất KHÔNG đo bằng mi-li-mét.
   *
   * `WallThickness` có bốn giá trị, ba số và một tên (`src/types/spatial.ts:14`).
   * Ba giá trị số thành "110 mm"; giá trị thứ tư không có số nào để in, nên nó
   * được gọi tên — A6, viết thường kiểu câu.
   */
  concreteColumnThickness: 'cột bê tông',
} as const;

/** Câu lỗi của tệp không đọc được — LUÔN nêu số phiên bản (L-03). */
const unsupportedFormatMessage = (fileFormatVersion: string): string =>
  `không đọc được tệp CAD này: bản vẽ lưu ở phiên bản định dạng ${fileFormatVersion}, mới hơn mức hệ thống đọc được. hãy xuất lại tệp ở phiên bản cũ hơn, hoặc dùng nhánh AI.`;

/** Câu của trạng thái `partial` khi có tầng không kèm tệp CAD. */
const floorsWithoutCadMessage = (floorNames: readonly string[]): string =>
  `${floorNames.join(', ')} không có tệp CAD kèm theo, những tầng đó sẽ đi nhánh AI.`;

/** Câu của trạng thái `partial` khi tệp mang thực thể không dựng lại được. */
const unsupportedEntitiesMessage = (kinds: readonly UnsupportedEntityKind[]): string =>
  `không dựng lại được ${kinds
    .map((entity) => `${entity.kind} (${formatNumber(entity.count)})`)
    .join(', ')}.`;

/** Gợi ý nhẹ: một lớp nhiều thực thể còn để "bỏ qua". KHÔNG chặn nút nhập. */
const busyIgnoredLayersMessage = (layers: readonly CadLayer[]): string =>
  `${layers
    .map((layer) => `${layer.name} (${formatNumber(layer.entityCount)} thực thể)`)
    .join(', ')} vẫn đang để "bỏ qua" — kiểm tra lại nếu đó không phải ý bạn.`;

/** Nhãn tiếng Việt của bảy vai trò. Định danh tiếng Anh, nhãn tiếng Việt (E.11). */
const ROLE_LABELS: Readonly<Record<CadLayerRole, string>> = {
  wall: 'tường',
  door: 'cửa đi',
  window: 'cửa sổ',
  dimension: 'kích thước',
  grid: 'trục',
  furniture: 'nội thất',
  ignore: 'bỏ qua',
};

/** Thứ tự bảy vai trò trong Select — "bỏ qua" đứng cuối vì nó là mặc định. */
const ROLE_ORDER: readonly CadLayerRole[] = [
  'wall',
  'door',
  'window',
  'dimension',
  'grid',
  'furniture',
  'ignore',
];

const UNIT_LABELS: Readonly<Record<CadDrawingUnit, string>> = {
  mm: 'mi-li-mét (mm)',
  cm: 'xen-ti-mét (cm)',
  m: 'mét (m)',
  inch: 'inch (in)',
};

const UNIT_ORDER: readonly CadDrawingUnit[] = ['mm', 'cm', 'm', 'inch'];

const ORIGIN_LABELS: Readonly<Record<CadOriginMode, string>> = {
  'keep-cad': 'giữ gốc toạ độ của tệp CAD',
  'grid-a1': 'đặt gốc ở giao trục A1',
};

const ORIGIN_ORDER: readonly CadOriginMode[] = ['keep-cad', 'grid-a1'];

/**
 * Bảng so sánh ba dòng của hộp thoại giai đoạn 1.
 *
 * Giá trị là câu mô tả định tính, không phải số đo: không endpoint nào trả về
 * số liệu so sánh hai nhánh (`pipelineGraphGateway.ts` đã ghi nhận cùng khoảng
 * trống này), nên màn nói ra điều nó biết chắc và không bịa một con số.
 */
const COMPARISON_ROWS: readonly CadBranchComparisonCell[] = [
  {
    rowId: 'accuracy',
    rowLabel: 'độ chính xác',
    cadValueLabel: 'đúng theo đường nét của bản vẽ gốc',
    aiValueLabel: 'suy ra từ ảnh, cần người duyệt lại',
  },
  {
    rowId: 'qcEffort',
    rowLabel: 'công việc kiểm tra',
    cadValueLabel: 'gán vai trò cho từng lớp một lần',
    aiValueLabel: 'soát lại tường, phòng và ô mở sau khi máy dựng',
  },
  {
    rowId: 'time',
    rowLabel: 'thời gian',
    cadValueLabel: 'nhập hình học xong ngay sau khi gán lớp',
    aiValueLabel: 'chờ máy chạy hết các bước xử lý',
  },
];

/**
 * Từ nước ngoài và mã máy đọc mà `expectVietnamese` phải bỏ qua khi soát view.
 *
 * Xuất ở đây để test của view (worker L2-C) không phải viết lại danh sách lần
 * thứ hai — cùng vai trò `ALLOWED_WORDS` của `ScaleCalibration.test.tsx`.
 */
export const CAD_ALLOWED_WORDS: readonly string[] = ['CAD', 'inch', 'in', 'mm', 'cm', 'm'];

/* -------------------------------------------------------------------------- */
/* Hằng số của màn.                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Hậu tố khoá đệm của lượt đọc tệp CAD — xem ghi chú đầu file.
 *
 * Nối vào `queryKeys.drawing.byFloor(floorId)` chứ không thay nó: cùng tầng dữ
 * liệu ("bản vẽ của tầng này"), khác câu hỏi ("đọc được gì bên trong tệp CAD").
 */
export const CAD_INSPECTION_QUERY_SCOPE = 'cadInspection';

/** Vai trò mặc định của một lớp chưa được gán — `types.ts` khai đúng giá trị này. */
const DEFAULT_LAYER_ROLE: CadLayerRole = 'ignore';

/** Đơn vị dùng khi tệp không khai báo và người dùng chưa chọn gì. */
const DEFAULT_DRAWING_UNIT: CadDrawingUnit = 'mm';

/** Cách đặt gốc toạ độ mặc định: giữ nguyên gốc của tệp, không dịch chuyển gì. */
const DEFAULT_ORIGIN_MODE: CadOriginMode = 'keep-cad';

/** Vai trò mặc định khi không có vai trò nào đi kèm phiên đăng nhập. */
const DEFAULT_ROLES: readonly ProjectRole[] = ['engineer'];

/**
 * Từ mức này trở lên, một lớp còn để "bỏ qua" đáng được nhắc.
 *
 * Chọn theo bộ mẫu chín lớp: bốn lớp hình học của bộ mẫu nằm dưới mức này, ba
 * lớp ghi chú và nội thất nằm trên — nên gợi ý bắt đúng thứ đáng nhắc mà không
 * kêu ở mọi lớp. Nó là NGƯỠNG GỢI Ý, không phải điều kiện của nút: xem
 * `canImportGeometry` bên dưới, nó không đọc số này.
 */
const BUSY_LAYER_MINIMUM_ENTITY_COUNT = 150;

/**
 * Token bảng màu của từng giá trị `WallThickness`.
 *
 * Khoá LÀ bốn giá trị của kiểu (`src/types/spatial.ts:14`) và giá trị LÀ tên
 * token (`wall-110`, `wall-220`, `wall-330` — `tailwind.config.ts:66-69`), nên
 * đây không phải hằng số viết tay mà là bản kê những gì bảng màu có. Bảng này
 * nói đúng cái `wallStrokeToken` của `materialMap` tô lên canvas cho cùng một
 * mức — chú giải và nét vẽ không được lệch nhau.
 *
 * Không mức nào sinh ra một họ màu thứ tư: `CONCRETE_COLUMN` mượn `text-primary`
 * đúng như `materialMap.wallStrokeToken` làm, đúng A4.
 */
const WALL_THICKNESS_TOKENS: Readonly<Record<WallThickness, string>> = {
  110: 'wall-110',
  220: 'wall-220',
  330: 'wall-330',
  CONCRETE_COLUMN: 'text-primary',
};

/** Token của mức dày không nằm trong bản kê trên. */
const WALL_THICKNESS_FALLBACK_TOKEN = 'wall-idle';

/**
 * Khung bao dùng khi chưa có thực thể nào để bao.
 *
 * Bốn số không, KHÔNG phải `NaN` hay `Infinity`: `Math.min()` trên mảng rỗng
 * trả `Infinity`, và một `viewBox` mang `Infinity` là một canvas trắng không ai
 * gỡ được. Bề rộng và bề cao bằng không là câu đúng — chưa có gì để vẽ — và
 * canvas đã đọc đúng nó (`hasDrawableExtent`).
 */
const EMPTY_PREVIEW_EXTENT: CadPreviewExtent = {
  minXMm: 0,
  minYMm: 0,
  maxXMm: 0,
  maxYMm: 0,
};

/** Nhãn chú giải của một mức dày. Ba mức số đo bằng mi-li-mét, mức thứ tư có tên. */
const wallThicknessLabel = (thickness: WallThickness): string =>
  typeof thickness === 'number'
    ? `${formatNumber(thickness)} mm`
    : COPY.concreteColumnThickness;

/**
 * Thứ tự chú giải: mỏng tới dày, mức không đo bằng số đứng cuối.
 *
 * Thứ tự đọc ra từ chính giá trị, không từ thứ tự thực thể xuất hiện trong tệp
 * — chú giải phải đứng yên khi người dùng đổi vai trò một lớp.
 */
const compareWallThickness = (left: WallThickness, right: WallThickness): number => {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }

  return typeof left === 'number' ? -1 : typeof right === 'number' ? 1 : 0;
};

/**
 * Câu máy đọc, tiếng Anh, của một tệp CAD không đọc được.
 *
 * Nó KHÔNG hiện lên màn hình: nó là đầu vào của `toAppError`, thứ quyết định
 * kind lỗi. Chữ `invalid` là thứ xếp lỗi này vào kind `validation` có sẵn
 * (`toAppError.ts:25`) — L-03 không được thêm kind mới vào `APP_ERROR_KINDS`,
 * đó là sửa `src/lib/errors/**` và nằm ngoài R-68. Trường `field` đi vào
 * `params` của `AppError` (`toAppError.ts:92`); câu người đọc là
 * {@link unsupportedFormatMessage}.
 */
const cadFormatError = (fileFormatVersion: string): Error =>
  Object.assign(
    new Error(`invalid DWG file format version ${fileFormatVersion}`),
    { field: 'fileFormatVersion' },
  );

/* -------------------------------------------------------------------------- */
/* Hình dạng bản ghi một lượt đọc.                                              */
/* -------------------------------------------------------------------------- */

/** Một lượt đọc đủ để mở màn: danh sách tầng cộng kết quả đọc tệp CAD. */
interface CadBranchConfirmRecord {
  readonly floors: readonly CadFloorAvailability[];
  /** `null` khi chưa có endpoint đọc CAD — KHÔNG phải "tệp rỗng". */
  readonly inspection: CadInspectionSnapshot | null;
  /** Câu nói ra endpoint còn thiếu, khi `inspection` là `null`. */
  readonly inspectionMissing: string | null;
}

/**
 * Tham số của `useCadBranchConfirm`.
 *
 * MỞ RỘNG `UseCadBranchConfirmOptions` của `types.ts` thay vì sửa file đó —
 * cách hợp lệ duy nhất để thêm tham số, đúng khuôn
 * `UseScaleCalibrationHookOptions` (`useScaleCalibration.ts:398`).
 */
export interface UseCadBranchConfirmHookOptions extends UseCadBranchConfirmOptions {
  /** Cổng dữ liệu. Có mặc định thật bên trong; test và story cắm bản giả vào. */
  readonly gateway?: CadBranchConfirmGateway;
}

/* -------------------------------------------------------------------------- */
/* Hai hàm phụ thuần.                                                           */
/* -------------------------------------------------------------------------- */

/** Chỉ giữ những vai trò bảng phân quyền biết tới — `roles` vào là `string[]`. */
function toProjectRoles(roles: readonly string[] | undefined): readonly ProjectRole[] {
  if (roles === undefined) {
    return DEFAULT_ROLES;
  }

  const known = roles.filter((role): role is ProjectRole =>
    (AUTH_ROLES as readonly string[]).includes(role),
  );

  return known.length === 0 ? DEFAULT_ROLES : known;
}

/** Cổng đã tiêm, hoặc bản thật dựng đúng một lần và chỉ khi cần. */
function useResolvedGateway(injected?: CadBranchConfirmGateway): CadBranchConfirmGateway {
  const [fallback] = useState<CadBranchConfirmGateway | null>(() =>
    injected === undefined ? createAppCadBranchConfirmGateway() : null,
  );

  return injected ?? (fallback as CadBranchConfirmGateway);
}

/* -------------------------------------------------------------------------- */
/* Hook.                                                                        */
/* -------------------------------------------------------------------------- */

/** `(options) => UseCadBranchConfirmResult` cho `CadBranchConfirm.container.tsx`. */
export function useCadBranchConfirm(
  options: UseCadBranchConfirmHookOptions,
): UseCadBranchConfirmResult {
  const { floorId, projectId } = options;
  const roles = toProjectRoles(options.roles);
  const gateway = useResolvedGateway(options.gateway);
  const prefersReducedMotion = useReducedMotion();

  /* ---------------------------------------------------------------------- */
  /* Trạng thái máy chủ (R-64).                                             */
  /* ---------------------------------------------------------------------- */

  const query = useQuery({
    queryKey: [...queryKeys.drawing.byFloor(floorId), CAD_INSPECTION_QUERY_SCOPE],
    queryFn: async (): Promise<CadBranchConfirmRecord> => {
      const floors = await gateway.readFloorAvailability({ projectId });

      if (!floors.ok) {
        throw floors.error;
      }

      const inspection = await gateway.inspectCadFile({ floorId, projectId });

      return {
        floors: floors.data,
        inspection: inspection.supported ? inspection.value : null,
        inspectionMissing: inspection.supported ? null : inspection.missing,
      };
    },
  });

  const record = query.data ?? null;
  const inspection = record?.inspection ?? null;

  /* ---------------------------------------------------------------------- */
  /* Trạng thái của riêng giao diện.                                        */
  /* ---------------------------------------------------------------------- */

  const [stage, setStage] = useState<CadBranchConfirmStage>('branchDialog');
  const [isDialogOpen, setIsDialogOpen] = useState(true);
  const [resolvedBranch, setResolvedBranch] = useState<CadBranchChoice | null>(null);
  const [isRememberChecked, setIsRememberChecked] = useState(
    () => gateway.readRememberedChoice(projectId) !== null,
  );
  const [roleByLayerId, setRoleByLayerId] = useState<Readonly<Record<string, CadLayerRole>>>({});
  const [hoveredLayerId, setHoveredLayerId] = useState<string | null>(null);
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);
  const [chosenUnit, setChosenUnit] = useState<CadDrawingUnit | null>(null);
  const [origin, setOrigin] = useState<CadOriginMode>(DEFAULT_ORIGIN_MODE);
  const [isImportOptionsExpanded, setIsImportOptionsExpanded] = useState(false);
  const [isCollapsedByUser, setIsCollapsedByUser] = useState(false);

  /* ---------------------------------------------------------------------- */
  /* Lớp CAD và vai trò đã gán.                                             */
  /* ---------------------------------------------------------------------- */

  const layers = useMemo<readonly CadLayer[]>(
    () =>
      (inspection?.layers ?? []).map((layer) => ({
        ...layer,
        // Lớp chưa gán mặc định "bỏ qua" — `types.ts` khai đúng như vậy.
        role: roleByLayerId[layer.id] ?? DEFAULT_LAYER_ROLE,
      })),
    [inspection, roleByLayerId],
  );

  const mappedLayers = useMemo(
    () => layers.filter((layer) => layer.role !== DEFAULT_LAYER_ROLE),
    [layers],
  );

  const objectCount = useMemo(
    () => mappedLayers.reduce((total, layer) => total + layer.entityCount, 0),
    [mappedLayers],
  );

  /**
   * A15 — định dạng số xảy ra Ở ĐÂY, không ở view.
   *
   * `formatNumber` của `@/lib/format/number` là nơi dấu thập phân và dấu phân
   * nhóm được chốt cho cả ứng dụng; view nhận `mappedCountLabel` và
   * `objectCountLabel` đã ghép xong và chỉ hiển thị.
   */
  const summary = useMemo<CadMappingSummary>(
    () => ({
      mappedLayerCount: mappedLayers.length,
      totalLayerCount: layers.length,
      objectCount,
      mappedCountLabel: `Đã ánh xạ ${formatNumber(mappedLayers.length)}/${formatNumber(layers.length)} lớp`,
      objectCountLabel: `${formatNumber(objectCount)} đối tượng sẽ được nhập`,
    }),
    [layers.length, mappedLayers.length, objectCount],
  );

  /* ---------------------------------------------------------------------- */
  /* Hình học xem trước — thực thể và khung bao của chúng.                   */
  /* ---------------------------------------------------------------------- */

  /**
   * Hình học cổng dữ liệu đọc được. Rỗng khi chưa đọc xong tệp — `[]` ở đây
   * nghĩa là "chưa có gì để vẽ", đúng thứ `preview.isLoading` nói ra cùng lúc.
   */
  const entities = useMemo<readonly CadPreviewEntity[]>(
    () => inspection?.entities ?? [],
    [inspection],
  );

  /**
   * Khung bao của mọi điểm, tính Ở ĐÂY chứ không ở canvas.
   *
   * R-61 giữ mọi phép tính ra khỏi view: canvas nhận `viewBox` đã sẵn sàng và
   * chỉ ghép chuỗi. Mảng rỗng trả {@link EMPTY_PREVIEW_EXTENT} thay vì để
   * `Math.min` trả `Infinity`.
   */
  const extentMm = useMemo<CadPreviewExtent>(() => {
    let minXMm = Number.POSITIVE_INFINITY;
    let minYMm = Number.POSITIVE_INFINITY;
    let maxXMm = Number.NEGATIVE_INFINITY;
    let maxYMm = Number.NEGATIVE_INFINITY;
    let pointCount = 0;

    for (const entity of entities) {
      for (const [xMm, yMm] of entity.points) {
        minXMm = Math.min(minXMm, xMm);
        minYMm = Math.min(minYMm, yMm);
        maxXMm = Math.max(maxXMm, xMm);
        maxYMm = Math.max(maxYMm, yMm);
        pointCount += 1;
      }
    }

    // Một thực thể không có điểm nào cũng là "không có gì để bao" — đếm điểm
    // thật, không đếm thực thể.
    return pointCount === 0 ? EMPTY_PREVIEW_EXTENT : { minXMm, minYMm, maxXMm, maxYMm };
  }, [entities]);

  const unsupportedEntityKinds = useMemo<readonly UnsupportedEntityKind[]>(
    // Giữ nguyên TỪNG loại kèm số lượng — không gộp, không tổng hoá.
    () => inspection?.unsupportedEntities ?? [],
    [inspection],
  );

  const floorsWithoutCad = useMemo(
    () => (record?.floors ?? []).filter((floor) => !floor.hasCadFile),
    [record],
  );

  const busyIgnoredLayers = useMemo(
    () =>
      layers.filter(
        (layer) =>
          layer.role === DEFAULT_LAYER_ROLE &&
          layer.entityCount >= BUSY_LAYER_MINIMUM_ENTITY_COUNT,
      ),
    [layers],
  );

  /* ---------------------------------------------------------------------- */
  /* Lượt nhập hình học.                                                    */
  /* ---------------------------------------------------------------------- */

  const canEdit = can('edit', 'layer', { roles });
  const unit = chosenUnit ?? inspection?.detectedUnit ?? DEFAULT_DRAWING_UNIT;

  const importMutation = useMutation({
    mutationFn: async (assignments: readonly CadLayerAssignment[]): Promise<void> => {
      const saved = await gateway.saveLayerMapping({
        assignments,
        floorId,
        origin,
        projectId,
        unit,
      });

      if (!saved.supported) {
        throw new Error(saved.missing);
      }

      const branch = await gateway.setProcessingBranch({ branch: 'cad', floorId, projectId });

      if (!branch.supported) {
        throw new Error(branch.missing);
      }
    },
  });

  /* ---------------------------------------------------------------------- */
  /* Bảy trạng thái.                                                        */
  /* ---------------------------------------------------------------------- */

  const isMappingPanelCollapsed = options.forceMappingPanelCollapsed ?? isCollapsedByUser;
  const isFormatUnsupported = inspection !== null && !inspection.isFormatSupported;

  const state = useMemo<CadBranchConfirmState>(() => {
    if (query.isPending) {
      return 'loading';
    }

    if (query.isError || isFormatUnsupported || importMutation.isError) {
      return 'error';
    }

    if (!canEdit) {
      return 'forbidden';
    }

    if (importMutation.isSuccess) {
      return 'success';
    }

    if (isMappingPanelCollapsed) {
      return 'collapsed';
    }

    if (layers.length === 0) {
      return 'empty';
    }

    // Không có nhánh "mọi thứ vừa vặn" nào trong bảy tên của A11, và cả hai màn
    // anh em (`useScaleCalibration.ts:1284`, `usePipelineGraph.ts`) cũng nghỉ ở
    // `partial`: đó là trạng thái "đã đọc xong, người dùng đang làm dở".
    return 'partial';
  }, [
    canEdit,
    importMutation.isError,
    importMutation.isSuccess,
    isFormatUnsupported,
    isMappingPanelCollapsed,
    layers.length,
    query.isError,
    query.isPending,
  ]);

  /* ---------------------------------------------------------------------- */
  /* Câu lỗi — câu chữ đi qua `@/lib/errors`, không viết lại ở đây.          */
  /* ---------------------------------------------------------------------- */

  const errorFileFormatVersion =
    state === 'error' ? (inspection?.fileFormatVersion ?? null) : null;

  const failure = useMemo(() => {
    if (state !== 'error') {
      return null;
    }

    if (isFormatUnsupported && inspection !== null) {
      // Tệp hỏng không phải lỗi mạng: kind và mã máy đọc lấy từ bảng lỗi dùng
      // chung, còn câu người đọc là câu của màn — nó phải nêu số phiên bản.
      const described = gateway.describeApiFailure(
        cadFormatError(inspection.fileFormatVersion),
      );
      return {
        ...described,
        sentence: unsupportedFormatMessage(inspection.fileFormatVersion),
      };
    }

    if (importMutation.isError) {
      return gateway.describeApiFailure(importMutation.error);
    }

    return gateway.describeApiFailure(query.error);
  }, [
    gateway,
    importMutation.error,
    importMutation.isError,
    inspection,
    isFormatUnsupported,
    query.error,
    state,
  ]);

  /* ---------------------------------------------------------------------- */
  /* Hành động.                                                             */
  /* ---------------------------------------------------------------------- */

  const isCadChoiceDisabled = state === 'error' || state === 'forbidden';

  const onToggleRemember = useCallback(
    (isChecked: boolean) => {
      setIsRememberChecked(isChecked);

      if (!isChecked) {
        void gateway.rememberChoice({ choice: null, projectId });
      }
    },
    [gateway, projectId],
  );

  const onChooseBranch = useCallback(
    (choice: CadBranchChoice) => {
      // Nhánh CAD là nhánh DUY NHẤT có điều kiện. Nhánh AI không bao giờ bị
      // chặn — người dùng luôn phải quay về nhánh AI được.
      if (choice === 'cad' && isCadChoiceDisabled) {
        return;
      }

      setResolvedBranch(choice);
      setIsDialogOpen(false);

      if (isRememberChecked) {
        void gateway.rememberChoice({ choice, projectId });
      }

      if (choice === 'cad') {
        // Hộp thoại ĐÓNG rồi panel ánh xạ mới mở — không lồng hộp thoại.
        setStage('layerMapping');
        return;
      }

      // Nhánh AI hoà tan sang phần cài đặt AI của dự án. Không endpoint nào
      // nhận lệnh đổi nhánh hôm nay, nên lượt gọi trả `supported: false` và màn
      // vẫn đi tiếp bằng đường điều hướng — nó không giả vờ đã ghi được gì.
      void gateway.setProcessingBranch({ branch: 'ai', floorId, projectId });
      setStage('branchDialog');
      options.onNavigate?.(ROUTES.project.pipeline(projectId));
    },
    [floorId, gateway, isCadChoiceDisabled, isRememberChecked, options, projectId],
  );

  const onDismiss = useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  const onAssignRole = useCallback((layerId: string, role: CadLayerRole) => {
    // Cập nhật ngay lập tức: xem trước và dòng tóm tắt đổi theo, không đợi
    // bất kỳ nút gửi nào.
    setRoleByLayerId((current) => ({ ...current, [layerId]: role }));
  }, []);

  const onHoverLayer = useCallback((layerId: string | null) => {
    setHoveredLayerId(layerId);
  }, []);

  const onHoverEntity = useCallback((entityId: string | null) => {
    setHoveredEntityId(entityId);
  }, []);

  const onChangeUnit = useCallback((next: CadDrawingUnit) => {
    setChosenUnit(next);
  }, []);

  const onChangeOrigin = useCallback((next: CadOriginMode) => {
    setOrigin(next);
  }, []);

  const onToggleImportOptions = useCallback((isExpanded: boolean) => {
    setIsImportOptionsExpanded(isExpanded);
  }, []);

  const onToggleMappingPanelCollapsed = useCallback(() => {
    setIsCollapsedByUser((current) => !current);
  }, []);

  const onRetry = useCallback(() => {
    importMutation.reset();
    void query.refetch();
  }, [importMutation, query]);

  const canImportGeometry =
    state !== 'forbidden' &&
    state !== 'error' &&
    mappedLayers.length > 0 &&
    !importMutation.isPending &&
    // Không có endpoint thì không có lượt nhập nào để hứa. Cờ đồng bộ của cổng
    // đọc được TRƯỚC khi gọi, nên nút tắt vì lý do thật chứ không vì một lượt
    // gọi hỏng.
    gateway.supports.saveLayerMapping &&
    gateway.supports.setProcessingBranch;

  const onImportGeometry = useCallback(() => {
    if (!canImportGeometry) {
      return;
    }

    importMutation.mutate(
      mappedLayers.map((layer) => ({ layerId: layer.id, role: layer.role })),
    );
  }, [canImportGeometry, importMutation, mappedLayers]);

  /* ---------------------------------------------------------------------- */
  /* A12 — Esc đóng lớp trên cùng của giai đoạn 2 (xem ghi chú đầu file).    */
  /* ---------------------------------------------------------------------- */

  useShortcut(
    {
      id: 'cadBranchConfirm.collapseImportOptions',
      combo: 'Escape',
      scope: 'sidePanel',
      description: 'đóng khối tuỳ chọn nhập',
      preventDefault: false,
      onTrigger: () => {
        setIsImportOptionsExpanded(false);
      },
    },
    { enabled: stage === 'layerMapping' && isImportOptionsExpanded },
  );

  /* ---------------------------------------------------------------------- */
  /* Viewmodel.                                                             */
  /* ---------------------------------------------------------------------- */

  const roleOptions = useMemo<readonly CadSelectOption<CadLayerRole>[]>(
    () => ROLE_ORDER.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
    [],
  );

  const unitOptions = useMemo<readonly CadSelectOption<CadDrawingUnit>[]>(
    () => UNIT_ORDER.map((value) => ({ value, label: UNIT_LABELS[value] })),
    [],
  );

  const originOptions = useMemo<readonly CadSelectOption<CadOriginMode>[]>(
    () => ORIGIN_ORDER.map((value) => ({ value, label: ORIGIN_LABELS[value] })),
    [],
  );

  /**
   * Chú giải liệt kê ĐÚNG những mức dày có mặt trong `entities` — không hơn.
   *
   * Đọc ra từ chính thứ canvas đang vẽ chứ không từ một danh sách mức song song
   * của tệp: một chú giải kể tên mức không xuất hiện trên hình là chú giải nói
   * dối, và người dùng không có cách nào biết là nó đang nói dối.
   */
  const wallThicknessLegend = useMemo<readonly CadWallThicknessLegendEntry[]>(() => {
    const present = new Set<WallThickness>();

    for (const entity of entities) {
      if (entity.thicknessMm !== null) {
        present.add(entity.thicknessMm);
      }
    }

    return [...present].sort(compareWallThickness).map((thickness) => ({
      id: `cad-wall-thickness-${thickness}`,
      label: wallThicknessLabel(thickness),
      colorToken: WALL_THICKNESS_TOKENS[thickness] ?? WALL_THICKNESS_FALLBACK_TOKEN,
    }));
  }, [entities]);

  const partialNotice = useMemo(() => {
    if (state !== 'partial') {
      return null;
    }

    const sentences: string[] = [];

    if (floorsWithoutCad.length > 0) {
      sentences.push(floorsWithoutCadMessage(floorsWithoutCad.map((floor) => floor.floorName)));
    }

    if (unsupportedEntityKinds.length > 0) {
      sentences.push(unsupportedEntitiesMessage(unsupportedEntityKinds));
    }

    if (busyIgnoredLayers.length > 0) {
      // Gợi ý nhẹ, đứng cùng chỗ với hai câu trên — nó KHÔNG khoá nút nhập.
      sentences.push(busyIgnoredLayersMessage(busyIgnoredLayers));
    }

    return sentences.length === 0 ? COPY.workingNotice : sentences.join(' ');
  }, [busyIgnoredLayers, floorsWithoutCad, state, unsupportedEntityKinds]);

  const isStageTwoOpen = stage === 'layerMapping';

  return {
    model: {
      state,
      stage,
      dialog: {
        isOpen: isDialogOpen,
        comparisonRows: COMPARISON_ROWS,
        floorAvailability: record?.floors ?? [],
        diagnostics: {
          hasMissingUnitDeclaration: inspection?.hasMissingUnitDeclaration ?? false,
          detectedUnit: inspection?.detectedUnit ?? null,
          fileFormatVersion: inspection?.fileFormatVersion ?? '',
          hasNamedLayers: inspection?.hasNamedLayers ?? false,
        },
        unitWarningMessage:
          inspection?.hasMissingUnitDeclaration === true ? COPY.unitWarning : null,
        isRememberChoiceChecked: isRememberChecked,
        isCadChoiceDisabled,
        cadChoiceDisabledReason: isCadChoiceDisabled
          ? (state === 'forbidden'
              ? COPY.forbiddenNotice
              : (failure?.sentence ?? null))
          : null,
      },
      mapping: isStageTwoOpen ? { layers, roleOptions, hoveredLayerId } : null,
      preview: isStageTwoOpen
        ? {
            layers,
            hoveredLayerId,
            hoveredEntityId,
            entities,
            extentMm,
            wallThicknessLegend,
            isLoading: query.isPending,
          }
        : null,
      importOptions: isStageTwoOpen
        ? {
            isExpanded: isImportOptionsExpanded,
            unit,
            detectedUnit: inspection?.detectedUnit ?? null,
            unitOptions,
            origin,
            originOptions,
          }
        : null,
      summary: isStageTwoOpen ? summary : null,
      unsupportedEntityKinds,
      isMappingPanelCollapsed,
      canImportGeometry,
      isImporting: importMutation.isPending,
      prefersReducedMotion,
      errorMessage: failure?.sentence ?? null,
      errorCode: failure?.technicalCode ?? null,
      errorFileFormatVersion,
      emptyNotice: state === 'empty' ? COPY.emptyNotice : null,
      partialNotice,
      forbiddenNotice: state === 'forbidden' ? COPY.forbiddenNotice : null,
      successNotice: state === 'success' ? COPY.successNotice : null,
    },
    actions: {
      onChooseBranch,
      onToggleRemember,
      onDismiss,
      onAssignRole,
      onHoverLayer,
      onHoverEntity,
      onChangeUnit,
      onChangeOrigin,
      onToggleImportOptions,
      onImportGeometry,
      onToggleMappingPanelCollapsed,
      onRetry,
    },
    resolvedBranch,
  };
}

/** Câu màn nói ra khi ô "ghi nhớ lựa chọn" được đánh dấu — xem cổng dữ liệu. */
export const CAD_REMEMBER_NOTICE = COPY.rememberSessionOnly;
