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
 * F-03 đã lồng `floors.list` theo dự án, nhưng màn vẫn đọc qua `projects.read`
 * như `floorUploadGateway.ts` để hai màn dùng chung một đường đọc.
 *
 * ## Khoá idempotency của hai lượt ghi
 *
 * Mỗi thân một khoá. Cổng giữ khoá theo `thao tác + floorId + thân`: gửi lại
 * đúng thân đó sau lỗi mạng, timeout hay 5xx thì dùng lại khoá (máy chủ trả
 * lại đúng phản hồi, không xếp thêm lượt pipeline); thân đổi, sau thành công
 * hoặc sau lỗi 4xx thì sinh khoá mới (BE-00 §7 lưu phản hồi dưới 500 theo khoá).
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
import { isTransientWireError, readWireError } from '@/lib/errors/wireError';
import { createUuid } from '@/lib/http/ids';

import { describeWriteError } from './inputQualityWriteErrors';
import type { WriteFailureSentence } from './inputQualityWriteErrors';

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
  /** Một câu cho lỗi của lượt ghi, kèm cờ có nên đọc lại kết quả đo. */
  readonly describeWriteFailure: (error: unknown) => WriteFailureSentence;
}


/* -------------------------------------------------------------------------- */
/* Cửa vào.                                                                    */
/* -------------------------------------------------------------------------- */

export interface InputQualityGatewayOptions {
  /** Nguồn khoá idempotency — test tiêm để đoán được khoá. */
  readonly createKey?: () => string;
}

export function createInputQualityGateway(
  client: ApiClient,
  options: InputQualityGatewayOptions = {},
): InputQualityGateway {
  const createKey = options.createKey ?? createUuid;
  // Khoá đang nắm theo `thao tác + floorId + thân`. Một thao tác chỉ có một khoá
  // sống ở mỗi tầng: thân đổi thì khoá cũ bị thay luôn.
  const heldKeys = new Map<string, { body: string; key: string }>();

  const keyFor = (slot: string, body: unknown): string => {
    const serialized = JSON.stringify(body);
    const held = heldKeys.get(slot);

    if (held !== undefined && held.body === serialized) {
      return held.key;
    }

    const key = createKey();
    heldKeys.set(slot, { body: serialized, key });
    return key;
  };

  /** Khoá chỉ được giữ lại khi lỗi cho phép gửi lại cùng thân (mạng, timeout, 5xx). */
  const settle = async <T>(
    slot: string,
    send: () => Promise<ApiResult<T>>,
  ): Promise<ApiResult<T>> => {
    const result = await send();

    // Mạng, timeout và mọi 5xx: máy chủ không lưu phản hồi dưới khoá (BE-00 §7), nên giữ khoá.
    const keepKey =
      !result.ok &&
      (isTransientWireError(result.error) || (readWireError(result.error)?.status ?? 0) >= 500);

    if (!keepKey) {
      heldKeys.delete(slot);
    }

    return result;
  };

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

    straighten: ({ floorId, projectId }) => {
      const slot = `straighten:${floorId}`;
      const idempotencyKey = keyFor(slot, {});

      return settle(slot, () => client.quality.straighten({ floorId, idempotencyKey, projectId }));
    },

    setCorners: ({ body, floorId, projectId }) => {
      const slot = `corners:${floorId}`;
      const idempotencyKey = keyFor(slot, body);

      return settle(slot, () =>
        client.quality.setCorners({ body, floorId, idempotencyKey, projectId }),
      );
    },

    describeApiFailure: (error) => {
      const appError = toAppError(error);

      return {
        sentence: describeError(appError).description,
        kind: appError.kind,
        isRetryable: appError.retryable,
      };
    },

    describeWriteFailure: (error) =>
      describeWriteError(error, describeError(toAppError(error)).description),
  };
}

/** Cổng dựng trên client thật của ứng dụng — thứ container gọi. */
export function createAppInputQualityGateway(): InputQualityGateway {
  return createInputQualityGateway(createAppApiClient());
}
