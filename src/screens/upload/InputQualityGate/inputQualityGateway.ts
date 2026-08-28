/**
 * Nguồn dữ liệu của màn Cổng chất lượng đầu vào — mọi lời gọi ra khỏi màn đi
 * qua đây.
 *
 * Cùng khuôn `floorUploadGateway.ts`: một `interface` cho hình dạng, một
 * factory nhận `ApiClient` để test cắm `createMockApiClient()` vào đúng phép
 * ánh xạ mà bản sản phẩm dùng (R-70), và một factory thứ hai dựng client thật
 * cho container.
 *
 * ## Vì sao vẫn phải đọc danh sách tầng
 *
 * `ENDPOINTS.quality.assess` cần một `floorId` để gọi, còn route của màn
 * (`ROUTE_PATTERNS.projectQuality`) chỉ mang `:id` của dự án. Nên màn cần đúng
 * một tầng làm mồi cho lượt đọc đầu tiên, và tầng đó lấy từ danh sách tầng của
 * dự án. Lượt đọc chất lượng trả về **mọi** tầng, nên sau lượt đầu thì danh
 * sách tầng để đổi qua lại đã nằm sẵn trong chính câu trả lời — không có lượt
 * gọi thứ ba nào.
 *
 * `client.floors.list()` **không nhận mã dự án** (`ENDPOINTS.floors.list` là
 * một đường dẫn phẳng), nên nó trả mọi tầng của mọi dự án.
 * `floorUploadGateway.ts` đã gặp đúng chỗ này và giải bằng `projects.read`;
 * file này chép nguyên cách đó.
 *
 * ## Bốn việc file này KHÔNG làm
 *
 * 1. **Không phân loại số đo.** Ba mức là việc của `src/domain/quality`; ở đây
 *    chỉ có hình dạng dữ liệu đi qua.
 * 2. **Không ghép đường dẫn.** `ENDPOINTS.quality.*` là nơi duy nhất biết URL,
 *    và `local/no-fetch-outside-http` chặn mọi lối đi vòng.
 * 3. **Không viết câu tiếng Việt cho lỗi mạng.** Câu lấy nguyên từ
 *    `describeError(toAppError(...)).description` (L-03).
 * 4. **Không giữ trạng thái màn.** Hook giữ; file này chỉ là cái seam.
 */

import { createAppApiClient } from '@/api/appClient';
import type {
  ApiClient,
  ApiResult,
  DrawingCornersInput,
  Floor,
  ImageQualityAssessment,
} from '@/api/client';
import { describeError, toAppError } from '@/lib/errors';
import type { AppError } from '@/lib/errors';
import { createUndoTicket, UNDO_WINDOW_MS } from '@/lib/mutations/undoTicket';
import type { UndoTicket } from '@/lib/mutations/undoTicket';

/* -------------------------------------------------------------------------- */
/* Kiểu.                                                                       */
/* -------------------------------------------------------------------------- */

export interface ReadProjectFloorsInput {
  readonly projectId: string;
  readonly signal?: AbortSignal;
}

export interface ReadQualityInput {
  readonly floorId: string;
  readonly projectId: string;
  readonly signal?: AbortSignal;
}

export interface StraightenInput {
  readonly floorId: string;
  readonly projectId: string;
}

export interface SetCornersInput {
  readonly body: DrawingCornersInput;
  readonly floorId: string;
  readonly projectId: string;
}

/** Một thất bại, đã thành câu người đọc được. */
export interface InputQualityFailure {
  /** Câu tiếng Việt, lấy nguyên từ `describeError` — không viết lại. */
  readonly sentence: string;
  /** Loại lỗi của L-03, để nơi gọi biết đây là lỗi mạng hay lỗi hợp đồng. */
  readonly kind: AppError['kind'];
  /** Thử lại có nghĩa hay không. */
  readonly isRetryable: boolean;
}

export interface CreateQualityUndoTicketInput {
  readonly description: string;
  readonly undo: () => void;
  readonly now?: () => number;
}

/**
 * Cái seam.
 *
 * Mỗi phương thức là một việc màn cần từ thế giới bên ngoài, và không có việc
 * nào khác. Hook không nhập `src/api` trực tiếp.
 */
export interface InputQualityGateway {
  /** Danh sách tầng của một dự án — đọc qua `projects.read`, xem đầu file. */
  readonly readFloors: (input: ReadProjectFloorsInput) => Promise<ApiResult<readonly Floor[]>>;
  /** Kết quả đo của MỌI tầng, cộng mã tầng mà lượt đọc này nói về. */
  readonly assess: (input: ReadQualityInput) => Promise<ApiResult<ImageQualityAssessment>>;
  /** Nắn ảnh về phương ngang; trả về chính kết quả đo đã chạy lại. */
  readonly straighten: (input: StraightenInput) => Promise<ApiResult<ImageQualityAssessment>>;
  /** Gửi bốn góc khung bản vẽ; trả về chính kết quả đo đã chạy lại. */
  readonly setCorners: (input: SetCornersInput) => Promise<ApiResult<ImageQualityAssessment>>;
  /** Một câu cho lỗi đến từ `src/api`. */
  readonly describeApiFailure: (error: unknown) => InputQualityFailure;
  /** Vé hoàn tác 8 giây cho một lượt ghi (A8). */
  readonly createWriteTicket: (input: CreateQualityUndoTicketInput) => UndoTicket;
}

/** Cửa sổ hoàn tác, tái xuất để hook và test không viết lại con số (R-71). */
export { UNDO_WINDOW_MS };

/* -------------------------------------------------------------------------- */
/* Cửa vào.                                                                    */
/* -------------------------------------------------------------------------- */

export function createInputQualityGateway(client: ApiClient): InputQualityGateway {
  return {
    readFloors: async ({ projectId, signal }) => {
      const result = await client.projects.read({
        projectId,
        ...(signal !== undefined ? { signal } : {}),
      });

      if (!result.ok) {
        return result;
      }

      return { ok: true, data: result.data.floors };
    },

    assess: ({ floorId, projectId, signal }) =>
      client.quality.assess({
        floorId,
        projectId,
        ...(signal !== undefined ? { signal } : {}),
      }),

    straighten: ({ floorId, projectId }) => client.quality.straighten({ floorId, projectId }),

    setCorners: ({ body, floorId, projectId }) =>
      client.quality.setCorners({ body, floorId, projectId }),

    describeApiFailure: (error) => {
      const appError = toAppError(error);

      return {
        sentence: describeError(appError).description,
        kind: appError.kind,
        isRetryable: appError.retryable,
      };
    },

    createWriteTicket: ({ description, now, undo }) =>
      createUndoTicket({
        description,
        undo,
        ...(now !== undefined ? { now } : {}),
      }),
  };
}

/** Cổng dựng trên client thật của ứng dụng — thứ container gọi. */
export function createAppInputQualityGateway(): InputQualityGateway {
  return createInputQualityGateway(createAppApiClient());
}
