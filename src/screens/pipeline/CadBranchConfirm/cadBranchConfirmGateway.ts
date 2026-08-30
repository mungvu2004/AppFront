/**
 * Cổng dữ liệu của màn "Phát hiện tệp CAD" — mọi lời gọi ra khỏi màn đi qua đây.
 *
 * Cùng khuôn `scaleCalibrationGateway.ts` và `pipelineGraphGateway.ts`: một
 * `interface` cho hình dạng, một factory nhận `ApiClient` để test cắm
 * `createMockApiClient()` vào đúng phép ánh xạ bản sản phẩm dùng (R-70), và một
 * factory thứ hai dựng client thật cho container.
 *
 * ## Phần NỐI ĐƯỢC THẬT — đúng một lượt đọc
 *
 * `client.floors.list()` (`ENDPOINTS.floors.list`) trả về mọi tầng của dự án,
 * mỗi tầng mang `name` và mảng `drawings`, mỗi bản vẽ mang `name` và `url`. Đó
 * là đủ để {@link CadBranchConfirmGateway.readFloorAvailability} nói thật hai
 * trong ba trường của `CadFloorAvailability`: `floorId` và `floorName`.
 *
 * Trường thứ ba đi kèm một giả định có tên:
 *
 * **Giả định C-CAD-1 — đuôi tệp phản ánh định dạng thật.** `hasCadFile` suy ra
 * bằng `readExtension()` của `src/lib/upload/validate.ts` so với
 * {@link CAD_FILE_EXTENSION}: một bản vẽ tên `mat-bang-tang-1.dwg` LÀ một tệp
 * CAD. Giả định đúng chừng nào tên tệp (hoặc đường dẫn `url`) còn giữ đuôi thật
 * của thứ đã tải lên — đúng giả định `validateUploadFile` đã dựa vào để gắn
 * nhánh `cad` cho `.dwg` (`validate.ts:142`). Phép tách đuôi tệp gọi lại hàm
 * chung, không viết lại (R-70). Không có bản vẽ `.dwg` nào thì `hasCadFile` là
 * `false` — đó là một câu ĐÚNG về dữ liệu có thật, không phải một con số bịa.
 *
 * ## Phần KHÔNG CÓ — và vì sao vẫn khai
 *
 * Ba việc màn cần mà tầng dữ liệu chưa có đường nào để làm. Đã soát
 * `src/api/endpoints.ts` (chỉ có `auth`, `drawings`, `featureFlags`, `floors`,
 * `projects`, `quality`, `spatial`), `src/api/schemas/**` và
 * `src/lib/realtime/**`: không hàm nào đọc nội dung `.dwg`, không schema nào
 * mang hình dạng kết quả đọc CAD, và không khái niệm "nhánh CAD / nhánh AI" nào
 * ở tầng dữ liệu. Mỗi việc vẫn nằm trong {@link CadBranchConfirmGateway} với
 * một kết quả `supported: false` nói rõ endpoint nào còn thiếu
 * ({@link CAD_MISSING_ENDPOINTS}), thay vì bị bỏ trắng hay trả một giá trị bịa
 * (`0`, mảng rỗng, chuỗi rỗng) giả làm dữ liệu thật: một cổng im lặng thì màn
 * không phân biệt được "chưa có dữ liệu" với "không có đường lấy dữ liệu".
 *
 * Hệ quả nói thẳng: trong bản sản phẩm hôm nay không lượt đọc CAD nào về, nên
 * màn đứng ở trạng thái `empty` — đúng nghĩa "tệp không có lớp đặt tên" mà bảng
 * bảy trạng thái của `types.ts` đã khai. Test và story cắm
 * {@link createMockCadBranchConfirmGateway} để dựng đủ bảy trạng thái.
 *
 * ## Ghi nhớ lựa chọn — MẤT KHI TẢI LẠI TRANG
 *
 * Đặc tả gọi O-02 là "ghi nhớ lựa chọn cho dự án này". Sự thật hôm nay: không
 * endpoint nào nhận nó và không có kho lưu theo dự án nào ở tầng dưới, nên
 * {@link CadBranchConfirmGateway.rememberChoice} giữ lượt ghi trong một `Map` ở
 * mức module — đúng khuôn `persistedScales` của `scaleCalibrationGateway.ts`.
 * Nó trả `ok` THẬT vì nó thật sự đã giữ giá trị, và nó giữ đúng bằng một phiên
 * trình duyệt: **lựa chọn ghi nhớ mất khi tải lại trang.** Không có gì được hứa
 * hơn thế — {@link CAD_REMEMBER_SESSION_NOTICE} là câu tiếng Việt để giao diện
 * nói ra điều đó ngay cạnh ô đánh dấu, và
 * {@link CadBranchConfirmGateway.isRememberedChoiceSessionOnly} là cờ máy đọc
 * mang cùng nội dung.
 */

import type { ApiClient, ApiResult } from '@/api/client';
import { createAppApiClient } from '@/api/appClient';
import { createMockApiClient } from '@/api/__mocks__/client';
import type { AppError } from '@/lib/errors';
import { describeError, toAppError } from '@/lib/errors';
import type { AcceptedUploadExtension } from '@/lib/upload/validate';
import type { WallThickness } from '@/types/spatial';
import { readExtension } from '@/lib/upload/validate';

import type {
  CadBranchChoice,
  CadDrawingUnit,
  CadFloorAvailability,
  CadLayer,
  CadLayerRole,
  CadOriginMode,
  CadPreviewEntity,
  UnsupportedEntityKind,
} from './types';

/* -------------------------------------------------------------------------- */
/* Khả năng — cờ đồng bộ, đọc được TRƯỚC khi gọi.                              */
/* -------------------------------------------------------------------------- */

/** Tên máy đọc của từng việc màn cần. Mỗi tên có một dòng trong bản kê dưới đây. */
export const CAD_CAPABILITIES = [
  'inspectCadFile',
  'readFloorAvailability',
  'setProcessingBranch',
  'rememberChoice',
  'saveLayerMapping',
] as const;

export type CadCapability = (typeof CAD_CAPABILITIES)[number];

/** Những việc bản cài đặt thật CHƯA làm được. Danh sách này chỉ được ngắn đi. */
export const CAD_MISSING_CAPABILITIES = [
  'inspectCadFile',
  'setProcessingBranch',
  'saveLayerMapping',
] as const;

export type CadMissingCapability = (typeof CAD_MISSING_CAPABILITIES)[number];

/**
 * Cái còn thiếu, viết ra bằng tên thật để lần sau ai bổ sung tầng dữ liệu biết
 * phải thêm gì. Không câu nào ở đây là lời hứa; chúng là bản mô tả hiện trạng.
 */
export const CAD_MISSING_ENDPOINTS: Readonly<Record<CadMissingCapability, string>> = {
  inspectCadFile:
    'GET .../floors/:floorId/drawings/:uploadId/cad-inspection — chưa có; không hàm nào trong src/api đọc nội dung .dwg, và không schema nào trong src/api/schemas/** mang hình dạng kết quả đọc CAD (lớp, thực thể, phiên bản định dạng)',
  setProcessingBranch:
    'PUT .../floors/:floorId/processing-branch — chưa có; không khái niệm nhánh CAD / nhánh AI nào tồn tại ở src/api/endpoints.ts, src/api/schemas/** hay src/lib/realtime/**',
  saveLayerMapping:
    'PUT .../floors/:floorId/drawings/:uploadId/layer-mapping — chưa có; không endpoint nào nhận ánh xạ lớp CAD sang vai trò',
};

/** Một việc chưa có đường làm, kèm endpoint còn thiếu. */
export interface CadUnsupported {
  readonly supported: false;
  readonly capability: CadMissingCapability;
  /** Câu nói ra cái còn thiếu, lấy nguyên văn từ {@link CAD_MISSING_ENDPOINTS}. */
  readonly missing: string;
}

/** Một việc làm được, kèm kết quả. */
export interface CadSupported<TValue> {
  readonly supported: true;
  readonly value: TValue;
}

export type CadCapabilityResult<TValue> = CadSupported<TValue> | CadUnsupported;

/** Dựng câu trả lời "chưa có đường làm việc này". */
export function unsupported(capability: CadMissingCapability): CadUnsupported {
  return { supported: false, capability, missing: CAD_MISSING_ENDPOINTS[capability] };
}

/* -------------------------------------------------------------------------- */
/* Giả định C-CAD-1 — đuôi tệp CAD.                                            */
/* -------------------------------------------------------------------------- */

/**
 * Đuôi tệp duy nhất `src/lib/upload` xếp vào nhánh `cad` (`validate.ts:142`).
 *
 * Gắn kiểu {@link AcceptedUploadExtension} để danh sách trắng của tầng tải lên
 * là thứ quyết định giá trị này, không phải một chuỗi viết tay ở đây.
 */
export const CAD_FILE_EXTENSION: AcceptedUploadExtension = '.dwg';

/** Câu giao diện phải nói ra cạnh ô "ghi nhớ lựa chọn" — xem ghi chú đầu file. */
export const CAD_REMEMBER_SESSION_NOTICE =
  'lựa chọn này chỉ được nhớ trong phiên làm việc, tải lại trang là mất';

/* -------------------------------------------------------------------------- */
/* Hình dạng dữ liệu thô.                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Một lớp CAD như cổng đọc được: chưa có vai trò.
 *
 * Vai trò là quyết định của người dùng, không phải của tệp — hook gán mặc định
 * `ignore` cho mọi lớp chưa gán, đúng `CadLayer` của `types.ts`.
 */
export type CadRawLayer = Omit<CadLayer, 'role'>;

/**
 * Kết quả một lượt đọc tệp CAD.
 *
 * `isFormatSupported === false` là trạng thái `error` của A11 trên màn này: tệp
 * hỏng hoặc phiên bản mới hơn mức đọc được. `fileFormatVersion` LUÔN có mặt kể
 * cả trong lượt đọc hỏng — câu lỗi phải nêu được số phiên bản.
 */
export interface CadInspectionSnapshot {
  readonly uploadId: string;
  /** Số phiên bản định dạng tệp — mã máy đọc, giữ nguyên dạng (A6). */
  readonly fileFormatVersion: string;
  /** `false` khi tệp hỏng hoặc phiên bản vượt mức hỗ trợ. */
  readonly isFormatSupported: boolean;
  readonly hasNamedLayers: boolean;
  readonly hasMissingUnitDeclaration: boolean;
  readonly detectedUnit: CadDrawingUnit | null;
  readonly layers: readonly CadRawLayer[];
  /**
   * Các mức độ dày tường đọc được trong tệp, tính bằng mi-li-mét.
   *
   * Bảng màu của dự án có đúng ba mức dày (`wall-110`, `wall-220`, `wall-330`
   * trong `tailwind.config.ts:66-69`) cộng một token `wall-idle` cho mức không
   * nằm trong ba mức đó — nên chú giải của canvas xem trước tô được mà không
   * cần một họ màu thứ tư, thứ A4 tồn tại để chặn.
   */
  readonly wallThicknessesMm: readonly number[];
  /**
   * Hình học vẽ được của tệp: từng thực thể, kèm lớp chứa nó và độ dày tường.
   *
   * `id` do CỔNG đặt và ổn định giữa hai lượt đọc cùng một tệp — canvas và bảng
   * lớp đối chiếu `hoveredEntityId` bằng chính chuỗi này, nên một id sinh ngẫu
   * nhiên hay theo đồng hồ là một liên kết nổi bật hai chiều chết. View KHÔNG
   * BAO GIỜ tự sinh id thực thể (R-69).
   */
  readonly entities: readonly CadPreviewEntity[];
  /** Từng loại thực thể không hỗ trợ kèm số lượng — không bao giờ gộp. */
  readonly unsupportedEntities: readonly UnsupportedEntityKind[];
}

/** Một lớp và vai trò người dùng đã gán cho nó. */
export interface CadLayerAssignment {
  readonly layerId: string;
  readonly role: CadLayerRole;
}

/** Một thất bại, đã thành câu người đọc được. */
export interface CadFailure {
  readonly title: string;
  readonly sentence: string;
  /** Mã máy đọc của `APP_ERROR_KIND_CONFIG` — ví dụ `VALIDATION`. */
  readonly technicalCode: string;
  readonly kind: AppError['kind'];
  readonly isRetryable: boolean;
}

export interface ReadFloorAvailabilityInput {
  readonly projectId: string;
  readonly signal?: AbortSignal;
}

export interface InspectCadFileInput {
  readonly projectId: string;
  readonly floorId: string;
  readonly signal?: AbortSignal;
}

export interface SetProcessingBranchInput {
  readonly projectId: string;
  readonly floorId: string;
  readonly branch: CadBranchChoice;
}

export interface RememberChoiceInput {
  readonly projectId: string;
  /** `null` xoá lượt ghi nhớ — người dùng bỏ đánh dấu ô. */
  readonly choice: CadBranchChoice | null;
}

export interface SaveLayerMappingInput {
  readonly projectId: string;
  readonly floorId: string;
  readonly assignments: readonly CadLayerAssignment[];
  readonly unit: CadDrawingUnit;
  readonly origin: CadOriginMode;
}

/* -------------------------------------------------------------------------- */
/* Cổng.                                                                        */
/* -------------------------------------------------------------------------- */

export interface CadBranchConfirmGateway {
  /** Việc nào có đường làm hôm nay. Màn đọc cờ này chứ không đoán. */
  readonly supports: Readonly<Record<CadCapability, boolean>>;
  /**
   * Tầng nào của dự án có tệp CAD. Nối thật qua `client.floors.list()` —
   * `hasCadFile` mang giả định C-CAD-1, xem ghi chú đầu file.
   */
  readonly readFloorAvailability: (
    input: ReadFloorAvailabilityInput,
  ) => Promise<ApiResult<readonly CadFloorAvailability[]>>;
  /** Đọc nội dung tệp CAD. Màn KHÔNG BAO GIỜ tự đọc tệp. */
  readonly inspectCadFile: (
    input: InspectCadFileInput,
  ) => Promise<CadCapabilityResult<CadInspectionSnapshot>>;
  /** Đặt nhánh xử lý của một tầng: CAD hay AI. */
  readonly setProcessingBranch: (
    input: SetProcessingBranchInput,
  ) => Promise<CadCapabilityResult<undefined>>;
  /** Giữ lựa chọn theo dự án. Xem "Ghi nhớ lựa chọn" ở đầu file. */
  readonly rememberChoice: (input: RememberChoiceInput) => Promise<ApiResult<void>>;
  /** Lựa chọn đã ghi nhớ của dự án, đọc đồng bộ. `null` khi chưa ghi lần nào. */
  readonly readRememberedChoice: (projectId: string) => CadBranchChoice | null;
  /**
   * `true` khi lượt ghi nhớ chỉ sống bằng một phiên trình duyệt. Giao diện đọc
   * cờ này để nói ra {@link CAD_REMEMBER_SESSION_NOTICE} thay vì hứa nhiều hơn.
   */
  readonly isRememberedChoiceSessionOnly: boolean;
  /** Lưu ánh xạ lớp sang vai trò, kèm tuỳ chọn nhập. */
  readonly saveLayerMapping: (
    input: SaveLayerMappingInput,
  ) => Promise<CadCapabilityResult<undefined>>;
  /** Một lỗi bất kỳ thành câu — câu chữ lấy từ `@/lib/errors`, không viết lại. */
  readonly describeApiFailure: (error: unknown) => CadFailure;
  readonly now: () => number;
}

/* -------------------------------------------------------------------------- */
/* Chuyển đổi.                                                                  */
/* -------------------------------------------------------------------------- */

/** Câu lỗi dựng thẳng từ bảng lỗi dùng chung — không câu nào viết lại ở đây. */
function toFailure(error: unknown): CadFailure {
  const appError = toAppError(error);
  const described = describeError(appError);

  return {
    title: described.title,
    sentence: described.description,
    technicalCode: appError.code,
    kind: appError.kind,
    isRetryable: appError.retryable,
  };
}

/** Giả định C-CAD-1: một tên tệp (hay đường dẫn) đuôi `.dwg` là một tệp CAD. */
function looksLikeCadFile(name: string): boolean {
  return readExtension(name) === CAD_FILE_EXTENSION;
}

/* -------------------------------------------------------------------------- */
/* Lượt ghi giữ trong phiên.                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Lựa chọn đã ghi nhớ, khoá theo `projectId`.
 *
 * Cùng khuôn `persistedScales` của `scaleCalibrationGateway.ts:250`: một bản đồ
 * ở mức module, sống đúng bằng phiên trình duyệt. Không endpoint thì đây là thứ
 * trung thực nhất một lượt "đã ghi nhớ" có thể là.
 */
const persistedBranchChoices = new Map<string, CadBranchChoice>();

/** Lựa chọn đã ghi nhớ trong phiên của một dự án, nếu có. Test và story dùng. */
export function readPersistedBranchChoice(projectId: string): CadBranchChoice | undefined {
  return persistedBranchChoices.get(projectId);
}

/** Xoá mọi lượt ghi nhớ trong phiên. Test gọi giữa hai lượt kiểm. */
export function clearPersistedBranchChoices(): void {
  persistedBranchChoices.clear();
}

/* -------------------------------------------------------------------------- */
/* Factory.                                                                     */
/* -------------------------------------------------------------------------- */

export interface CreateCadBranchConfirmGatewayOptions {
  /** Đồng hồ tiêm được. */
  readonly now?: () => number;
}

export function createCadBranchConfirmGateway(
  client: ApiClient,
  options: CreateCadBranchConfirmGatewayOptions = {},
): CadBranchConfirmGateway {
  const now = options.now ?? ((): number => Date.now());

  return {
    // Hai việc làm được hôm nay. Ba việc còn lại `false` cho tới khi có
    // endpoint — xem `CAD_MISSING_ENDPOINTS`.
    supports: {
      inspectCadFile: false,
      readFloorAvailability: true,
      setProcessingBranch: false,
      rememberChoice: true,
      saveLayerMapping: false,
    },

    readFloorAvailability: async ({ signal }) => {
      const result = await client.floors.list(signal !== undefined ? { signal } : {});

      if (!result.ok) {
        return result;
      }

      return {
        ok: true,
        data: result.data.map((floor) => ({
          floorId: floor.id,
          floorName: floor.name,
          // Giả định C-CAD-1. `name` là tên tệp người dùng thấy, `url` là
          // đường dẫn thật — một trong hai mang đuôi `.dwg` là đủ.
          hasCadFile: floor.drawings.some(
            (drawing) => looksLikeCadFile(drawing.name) || looksLikeCadFile(drawing.url),
          ),
        })),
      };
    },

    inspectCadFile: () => Promise.resolve(unsupported('inspectCadFile')),
    setProcessingBranch: () => Promise.resolve(unsupported('setProcessingBranch')),
    saveLayerMapping: () => Promise.resolve(unsupported('saveLayerMapping')),

    rememberChoice: async ({ choice, projectId }) => {
      if (choice === null) {
        persistedBranchChoices.delete(projectId);
      } else {
        persistedBranchChoices.set(projectId, choice);
      }

      return { ok: true, data: undefined };
    },

    readRememberedChoice: (projectId) => persistedBranchChoices.get(projectId) ?? null,

    isRememberedChoiceSessionOnly: true,

    describeApiFailure: (error) => toFailure(error),

    now,
  };
}

/** Cổng thật cho container — `.container.tsx` gọi đúng hàm này. */
export function createAppCadBranchConfirmGateway(): CadBranchConfirmGateway {
  return createCadBranchConfirmGateway(createAppApiClient());
}

/* -------------------------------------------------------------------------- */
/* Bộ mẫu — chỗ story và test cắm vào để kiểm nhánh "có hỗ trợ".               */
/* -------------------------------------------------------------------------- */

/**
 * Chín lớp CAD của bộ mẫu, tên theo quy ước lớp AIA mà bản vẽ kiến trúc dùng.
 *
 * Đây là dữ liệu MẪU, và nó nằm ở đây chứ không ở bản thật vì đúng một lý do:
 * bản thật không có nguồn nào để lấy nó ({@link CAD_MISSING_ENDPOINTS}). Story
 * và test dựng giao diện trên bộ này để nhánh "đã đọc được tệp" vẫn được kiểm
 * (R-73), còn bản sản phẩm vẫn nói ra sự thật là chưa nối được.
 *
 * Bốn lớp `A-WALL`, `A-DOOR`, `A-GLAZ`, `A-GRID` cộng lại đúng **312** thực
 * thể — con số của ví dụ "Đã ánh xạ 4/9 lớp · 312 đối tượng sẽ được nhập" trong
 * ghi chú đầu `types.ts`, nên {@link CAD_SAMPLE_LAYERS_MAPPED} dựng lại được
 * đúng dòng tóm tắt đó mà không phải bịa một bảng thứ hai (R-70).
 *
 * `sourceColor` dùng TÊN MÀU CAD chứ không mã hex: `local/no-raw-color` cấm
 * hex/rgb/hsl trong mọi tệp dưới `src/screens` (`no-raw-color.js:12-14`), và
 * `types.ts` đã cho phép "tên màu CAD" ở trường này.
 */
export const CAD_SAMPLE_LAYERS: readonly CadRawLayer[] = [
  { id: 'cad-layer-a-wall', name: 'A-WALL', entityCount: 128, sourceColor: 'white' },
  { id: 'cad-layer-a-wall-prtn', name: 'A-WALL-PRTN', entityCount: 96, sourceColor: 'silver' },
  { id: 'cad-layer-a-door', name: 'A-DOOR', entityCount: 46, sourceColor: 'cyan' },
  { id: 'cad-layer-a-glaz', name: 'A-GLAZ', entityCount: 34, sourceColor: 'blue' },
  { id: 'cad-layer-a-dims', name: 'A-DIMS', entityCount: 212, sourceColor: 'green' },
  { id: 'cad-layer-a-grid', name: 'A-GRID', entityCount: 104, sourceColor: 'magenta' },
  { id: 'cad-layer-a-furn', name: 'A-FURN', entityCount: 318, sourceColor: 'yellow' },
  { id: 'cad-layer-a-anno-text', name: 'A-ANNO-TEXT', entityCount: 176, sourceColor: 'red' },
  { id: 'cad-layer-defpoints', name: 'DEFPOINTS', entityCount: 12, sourceColor: 'gray' },
];

/** Vai trò của bộ mẫu "đã ánh xạ": đúng bốn lớp, cộng lại đúng 312 thực thể. */
const CAD_SAMPLE_ROLES: Readonly<Record<string, CadLayerRole>> = {
  'cad-layer-a-wall': 'wall',
  'cad-layer-a-door': 'door',
  'cad-layer-a-glaz': 'window',
  'cad-layer-a-grid': 'grid',
};

/**
 * Cùng chín lớp, đúng bốn lớp đã gán vai trò — bộ mẫu của trạng thái đã làm
 * việc. Năm lớp còn lại giữ `ignore`, đúng mặc định của `types.ts`.
 */
export const CAD_SAMPLE_LAYERS_MAPPED: readonly CadLayer[] = CAD_SAMPLE_LAYERS.map((layer) => ({
  ...layer,
  role: CAD_SAMPLE_ROLES[layer.id] ?? 'ignore',
}));

/**
 * Thực thể tệp mẫu mang mà bước nhập hình học không dựng lại được.
 *
 * Từng loại một, kèm số lượng — cấm gộp thành "một số lỗi" (ghi chú đầu
 * `types.ts`).
 */
export const CAD_SAMPLE_UNSUPPORTED_ENTITIES: readonly UnsupportedEntityKind[] = [
  { id: 'cad-unsupported-3dsolid', kind: '3DSOLID', count: 7 },
  { id: 'cad-unsupported-spline', kind: 'SPLINE', count: 23 },
  { id: 'cad-unsupported-proxy', kind: 'ACAD_PROXY_ENTITY', count: 4 },
];

/**
 * Hình học của bộ mẫu — một mặt bằng 12,0 × 9,0 m, toạ độ MI-LI-MÉT tuyệt đối.
 *
 * Ba điều kiện của bộ này, theo thứ tự quan trọng:
 *
 * 1. **`id` ổn định.** Mọi id là chuỗi viết thẳng, không sinh ngẫu nhiên và
 *    không lấy từ đồng hồ: `hoveredEntityId` của hook phải khớp được với `id`
 *    canvas đang vẽ qua nhiều lượt render, và hai lượt đọc cùng một tệp phải
 *    cho cùng một tập id.
 * 2. **`layerId` trỏ đúng chín lớp của {@link CAD_SAMPLE_LAYERS}.** Canvas tra
 *    lớp theo id để biết vai trò, và vai trò quyết định màu nét; một id lạc là
 *    một nét tô màu "bỏ qua" mà không ai giải thích được vì sao.
 * 3. **Độ dày chỉ đi cùng thực thể của lớp tường.** Sáu vai trò còn lại lấy màu
 *    từ hàm không tham số của `materialMap`, nên `thicknessMm` của chúng là
 *    `null` — không phải `0`, thứ sẽ giả làm một mức dày có thật.
 *
 * Ba mức dày cùng có mặt (330 tường bao, 220 tường chịu lực trong, 110 tường
 * ngăn) nên chú giải độ dày tường nói ra đúng ba mức bảng màu đặt tên.
 *
 * Trục và đường kích thước chạy ra ngoài mép nhà — đó là lý do khung bao rộng
 * hơn hình chữ nhật tường bao, và là thứ khiến phép tính khung bao ở hook có
 * việc thật để làm.
 */
export const CAD_SAMPLE_ENTITIES: readonly CadPreviewEntity[] = [
  /* -- Tường bao: một đa tuyến khép, dày nhất. ----------------------------- */
  {
    id: 'cad-entity-wall-envelope',
    layerId: 'cad-layer-a-wall',
    points: [
      [0, 0],
      [12000, 0],
      [12000, 9000],
      [0, 9000],
      [0, 0],
    ],
    thicknessMm: 330,
  },

  /* -- Tường chịu lực bên trong: đoạn thẳng. ------------------------------- */
  {
    id: 'cad-entity-wall-spine',
    layerId: 'cad-layer-a-wall',
    points: [
      [0, 5400],
      [12000, 5400],
    ],
    thicknessMm: 220,
  },
  {
    id: 'cad-entity-wall-cross',
    layerId: 'cad-layer-a-wall',
    points: [
      [7200, 0],
      [7200, 5400],
    ],
    thicknessMm: 220,
  },

  /* -- Tường ngăn: mỏng nhất. ---------------------------------------------- */
  {
    id: 'cad-entity-wall-prtn-bedroom',
    layerId: 'cad-layer-a-wall-prtn',
    points: [
      [3600, 5400],
      [3600, 9000],
    ],
    thicknessMm: 110,
  },
  {
    id: 'cad-entity-wall-prtn-bath',
    layerId: 'cad-layer-a-wall-prtn',
    points: [
      [3600, 7200],
      [12000, 7200],
    ],
    thicknessMm: 110,
  },

  /* -- Cửa đi: đoạn ngắn NẰM TRÊN một tường ở trên. ------------------------- */
  {
    id: 'cad-entity-door-entry',
    layerId: 'cad-layer-a-door',
    points: [
      [5400, 0],
      [6300, 0],
    ],
    thicknessMm: null,
  },
  {
    id: 'cad-entity-door-bedroom',
    layerId: 'cad-layer-a-door',
    points: [
      [3600, 6000],
      [3600, 6900],
    ],
    thicknessMm: null,
  },
  {
    id: 'cad-entity-door-service',
    layerId: 'cad-layer-a-door',
    points: [
      [8400, 5400],
      [9300, 5400],
    ],
    thicknessMm: null,
  },

  /* -- Cửa sổ: đoạn ngắn trên tường bao. ------------------------------------ */
  {
    id: 'cad-entity-window-south',
    layerId: 'cad-layer-a-glaz',
    points: [
      [1800, 0],
      [3600, 0],
    ],
    thicknessMm: null,
  },
  {
    id: 'cad-entity-window-north',
    layerId: 'cad-layer-a-glaz',
    points: [
      [1800, 9000],
      [3600, 9000],
    ],
    thicknessMm: null,
  },
  {
    id: 'cad-entity-window-east',
    layerId: 'cad-layer-a-glaz',
    points: [
      [12000, 2400],
      [12000, 4200],
    ],
    thicknessMm: null,
  },

  /* -- Trục: đường dài xuyên qua cả mặt bằng, thò ra hai đầu. ---------------- */
  {
    id: 'cad-entity-grid-1',
    layerId: 'cad-layer-a-grid',
    points: [
      [-1200, 0],
      [13200, 0],
    ],
    thicknessMm: null,
  },
  {
    id: 'cad-entity-grid-2',
    layerId: 'cad-layer-a-grid',
    points: [
      [-1200, 5400],
      [13200, 5400],
    ],
    thicknessMm: null,
  },
  {
    id: 'cad-entity-grid-a',
    layerId: 'cad-layer-a-grid',
    points: [
      [0, -1200],
      [0, 10200],
    ],
    thicknessMm: null,
  },
  {
    id: 'cad-entity-grid-b',
    layerId: 'cad-layer-a-grid',
    points: [
      [7200, -1200],
      [7200, 10200],
    ],
    thicknessMm: null,
  },

  /* -- Kích thước: đoạn có hai đầu, chạy song song mép nhà. ------------------ */
  {
    id: 'cad-entity-dim-south',
    layerId: 'cad-layer-a-dims',
    points: [
      [0, -600],
      [12000, -600],
    ],
    thicknessMm: null,
  },
  {
    id: 'cad-entity-dim-west',
    layerId: 'cad-layer-a-dims',
    points: [
      [-600, 0],
      [-600, 9000],
    ],
    thicknessMm: null,
  },

  /* -- Nội thất: hình chữ nhật khép. ---------------------------------------- */
  {
    id: 'cad-entity-furn-sofa',
    layerId: 'cad-layer-a-furn',
    points: [
      [900, 900],
      [3300, 900],
      [3300, 2100],
      [900, 2100],
      [900, 900],
    ],
    thicknessMm: null,
  },
  {
    id: 'cad-entity-furn-table',
    layerId: 'cad-layer-a-furn',
    points: [
      [8400, 1200],
      [10800, 1200],
      [10800, 2400],
      [8400, 2400],
      [8400, 1200],
    ],
    thicknessMm: null,
  },
  {
    id: 'cad-entity-furn-bed',
    layerId: 'cad-layer-a-furn',
    points: [
      [600, 6000],
      [2400, 6000],
      [2400, 8100],
      [600, 8100],
      [600, 6000],
    ],
    thicknessMm: null,
  },

  /* -- Ghi chú và điểm dựng: hai lớp còn để "bỏ qua". ----------------------- */
  {
    id: 'cad-entity-anno-living-room',
    layerId: 'cad-layer-a-anno-text',
    points: [
      [1200, 4500],
      [2400, 4500],
    ],
    thicknessMm: null,
  },
  {
    id: 'cad-entity-defpoint-origin',
    layerId: 'cad-layer-defpoints',
    points: [
      [-150, -150],
      [150, 150],
    ],
    thicknessMm: null,
  },
];

/**
 * Ba mức độ dày tường của bộ mẫu — đúng ba mức bảng màu của dự án đặt tên
 * (`wall-110`, `wall-220`, `wall-330`).
 *
 * ĐỌC RA TỪ {@link CAD_SAMPLE_ENTITIES}, không viết tay lần thứ hai: chú giải
 * độ dày tường phải nói đúng cái canvas đang vẽ, và hai danh sách viết tay song
 * song là đúng chỗ chúng lệch nhau vào lúc không ai để ý.
 */
export const CAD_SAMPLE_WALL_THICKNESSES_MM: readonly number[] = [
  ...new Set(
    CAD_SAMPLE_ENTITIES.map((entity) => entity.thicknessMm).filter(
      (thicknessMm): thicknessMm is Extract<WallThickness, number> =>
        typeof thicknessMm === 'number',
    ),
  ),
].sort((left, right) => left - right);

/** Số phiên bản định dạng của tệp mẫu — mã máy đọc, giữ nguyên dạng (A6). */
export const CAD_SAMPLE_FILE_FORMAT_VERSION = 'AC1032';

/** Số phiên bản của tệp mẫu KHÔNG đọc được — bộ mẫu của trạng thái `error`. */
export const CAD_SAMPLE_UNSUPPORTED_FILE_FORMAT_VERSION = 'AC1041';

/** Lượt đọc tệp CAD của bộ mẫu. */
export const CAD_SAMPLE_INSPECTION: CadInspectionSnapshot = {
  uploadId: 'cad-upload-1',
  fileFormatVersion: CAD_SAMPLE_FILE_FORMAT_VERSION,
  isFormatSupported: true,
  hasNamedLayers: true,
  hasMissingUnitDeclaration: true,
  detectedUnit: 'mm',
  layers: CAD_SAMPLE_LAYERS,
  wallThicknessesMm: CAD_SAMPLE_WALL_THICKNESSES_MM,
  entities: CAD_SAMPLE_ENTITIES,
  unsupportedEntities: CAD_SAMPLE_UNSUPPORTED_ENTITIES,
};

/**
 * Bốn tầng của bộ mẫu; tầng 3 không có tệp CAD — đủ để trạng thái `partial`
 * ("một số tầng không có CAD") có gì thật để nói.
 */
export const CAD_SAMPLE_FLOOR_AVAILABILITY: readonly CadFloorAvailability[] = [
  { floorId: 'L1', floorName: 'Tầng 1', hasCadFile: true },
  { floorId: 'L2', floorName: 'Tầng 2', hasCadFile: true },
  { floorId: 'L3', floorName: 'Tầng 3', hasCadFile: false },
  { floorId: 'L4', floorName: 'Tầng 4', hasCadFile: true },
];

export interface CreateMockCadBranchConfirmGatewayOptions
  extends CreateCadBranchConfirmGatewayOptions {
  /** Ép lượt đọc tệp trả về bộ khác — story "tệp không có lớp đặt tên" đổi trường này. */
  readonly inspection?: CadInspectionSnapshot;
  /** Ép danh sách tầng — story "một số tầng không có CAD" đổi trường này. */
  readonly floorAvailability?: readonly CadFloorAvailability[];
  /** Bật hoặc tắt từng khả năng, để kiểm nhánh "chưa nối được". */
  readonly supports?: Partial<Record<CadCapability, boolean>>;
}

/**
 * Cổng giả có đủ dữ liệu — story và test cắm cái này vào để phần giao diện phụ
 * thuộc dữ liệu chưa nối được vẫn kiểm được (R-73).
 *
 * Lượt ghi nhớ vẫn đi qua đúng bản đồ trong phiên của bản thật, nên test kiểm
 * được đúng hành vi bản sản phẩm có — nhớ gọi {@link clearPersistedBranchChoices}
 * giữa hai lượt kiểm.
 */
export function createMockCadBranchConfirmGateway(
  options: CreateMockCadBranchConfirmGatewayOptions = {},
): CadBranchConfirmGateway {
  const base = createCadBranchConfirmGateway(createMockApiClient(), options);
  const inspection = options.inspection ?? CAD_SAMPLE_INSPECTION;
  const floors = options.floorAvailability ?? CAD_SAMPLE_FLOOR_AVAILABILITY;
  const supports: Readonly<Record<CadCapability, boolean>> = {
    inspectCadFile: true,
    readFloorAvailability: true,
    setProcessingBranch: true,
    rememberChoice: true,
    saveLayerMapping: true,
    ...options.supports,
  };

  const guard = <TValue>(
    capability: CadMissingCapability,
    value: TValue,
  ): CadCapabilityResult<TValue> =>
    supports[capability] ? { supported: true, value } : unsupported(capability);

  return {
    ...base,
    supports,
    readFloorAvailability: () => Promise.resolve({ ok: true, data: floors }),
    inspectCadFile: () => Promise.resolve(guard('inspectCadFile', inspection)),
    setProcessingBranch: () => Promise.resolve(guard('setProcessingBranch', undefined)),
    saveLayerMapping: () => Promise.resolve(guard('saveLayerMapping', undefined)),
  };
}

/**
 * Bọc một cổng, thay đúng những việc người gọi đưa vào.
 *
 * Test dựng nhánh "lượt đọc tệp hỏng" hay "chưa nối được" bằng hàm này thay vì
 * viết lại cả cổng — cùng lý lẽ `withScaleCapabilities` của
 * `scaleCalibrationGateway.ts`: chỉ thứ đang kiểm mới bị thay.
 */
export function withCadCapabilities(
  base: CadBranchConfirmGateway,
  overrides: Partial<Omit<CadBranchConfirmGateway, 'supports'>> & {
    readonly supports?: Partial<Record<CadCapability, boolean>>;
  },
): CadBranchConfirmGateway {
  const { supports, ...rest } = overrides;

  return {
    ...base,
    ...rest,
    supports: { ...base.supports, ...supports },
  };
}
