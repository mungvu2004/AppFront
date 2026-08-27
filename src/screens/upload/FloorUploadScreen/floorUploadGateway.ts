/**
 * Nguồn dữ liệu của màn tải bản vẽ — mọi lời gọi ra khỏi màn đi qua đây.
 *
 * Cùng khuôn `projectSettingsGateway.ts` và `accountSettingsGateway.ts`: một
 * `interface` cho hình dạng, một factory nhận `ApiClient` để test cắm
 * `createMockApiClient()` vào đúng phép ánh xạ mà bản sản phẩm dùng (R-70), và
 * một factory thứ hai dựng client thật cho container.
 *
 * ## Vì sao đọc tầng qua `projects.read`, không qua `floors.list`
 *
 * `client.floors.list()` **không nhận mã dự án** — `ENDPOINTS.floors.list` là
 * một đường dẫn phẳng không mang mã dự án, nên tự nó trả mọi tầng máy chủ đang
 * giữ, của mọi dự án. `projectSettingsGateway.ts:279-296` đã gặp đúng chỗ này và giải bằng
 * cách đọc `projects.read({ projectId }).data.floors`. Màn này chép cách đó:
 * danh sách tầng của một dự án là một trường của chính dự án đó.
 *
 * ## Bốn việc file này KHÔNG làm
 *
 * 1. **Không tự chia khúc, không tự đếm song song, không tự viết trần dung
 *    lượng.** `sliceIntoChunks`, `createUploadScheduler` và
 *    `MAX_UPLOAD_FILE_SIZE_BYTES` đã có nhà ở `src/lib/upload`; ở đây chỉ gọi
 *    `createUploadTask` và `runUploadQueue`.
 * 2. **Không bóp tần suất báo tiến độ.** `createUploadTask` đã bóp xuống
 *    `PROGRESS_EMITS_PER_SECOND` (4/giây) — thêm một lớp nữa là tạo bản thứ hai
 *    sẽ lệch.
 * 3. **Không viết câu tiếng Việt cho lỗi mạng.** Câu lấy nguyên từ
 *    `describeError(toAppError(...)).description` (L-03).
 * 4. **Không giữ trạng thái màn.** Hook giữ; file này chỉ là cái seam.
 */

import { createAppApiClient } from '@/api/appClient';
import type { ApiClient, ApiResult, Floor } from '@/api/client';
import { describeError, toAppError } from '@/lib/errors';
import type { AppError } from '@/lib/errors';
import { createUuid } from '@/lib/http/ids';
import { createUndoTicket, UNDO_WINDOW_MS } from '@/lib/mutations/undoTicket';
import type { UndoTicket } from '@/lib/mutations/undoTicket';
import { createNetworkMonitor } from '@/lib/offline/networkMonitor';
import type { NetworkMonitor } from '@/lib/offline/networkMonitor';
import { addPendingCommand } from '@/lib/offline/queueStore';
import {
  createUploadTask,
  guessFloorFromFileName,
  isTerminalUploadError,
  validateUploadFile,
} from '@/lib/upload';
import type {
  FloorGuess,
  UploadCandidate,
  UploadFailure,
  UploadFile,
  UploadTask,
  UploadTaskState,
  UploadValidation,
} from '@/lib/upload';

/* -------------------------------------------------------------------------- */
/* Kiểu.                                                                       */
/* -------------------------------------------------------------------------- */

export interface ReadProjectFloorsInput {
  readonly projectId: string;
}

export interface CreateFloorUploadInput {
  readonly file: UploadFile;
  readonly floorId: string;
  readonly projectId: string;
  readonly onProgress: (state: UploadTaskState) => void;
  readonly id?: string;
}

/**
 * Một lượt tải bị hoãn vì mất mạng.
 *
 * `command` là dữ liệu thuần — hàng đợi ngoại tuyến giữ nó qua IndexedDB, nên
 * nó không được mang `File`, `AbortSignal` hay bất cứ thứ gì không tuần tự hoá
 * được. Tệp thật nằm lại trong bộ nhớ của màn; hàng đợi chỉ ghi **ý định**.
 */
export interface EnqueueOfflineUploadInput {
  readonly projectId: string;
  readonly floorId: string;
  readonly fileName: string;
  readonly sizeBytes: number;
}

/** Một thất bại, đã thành câu người đọc được. */
export interface FloorUploadFailure {
  /** Câu tiếng Việt, lấy nguyên từ `describeError` — không viết lại. */
  readonly sentence: string;
  /** Loại lỗi của L-03, để nơi gọi biết đây là 413/422 hay lỗi mạng. */
  readonly kind: AppError['kind'];
  /** Thử lại có nghĩa hay không. `false` với 413 và 422. */
  readonly isRetryable: boolean;
}

export interface CreateRemovalTicketInput {
  readonly description: string;
  readonly undo: () => void;
  readonly now?: () => number;
}

/**
 * Cái seam.
 *
 * Mỗi phương thức là một việc màn cần từ thế giới bên ngoài, và không có việc
 * nào khác. Hook không nhập `src/api` hay `src/lib/upload` trực tiếp.
 */
export interface FloorUploadGateway {
  /** Danh sách tầng của một dự án — đọc qua `projects.read`, xem đầu file. */
  readonly readFloors: (input: ReadProjectFloorsInput) => Promise<ApiResult<readonly Floor[]>>;
  /** Nhận hay từ chối một tệp: dung lượng → định dạng → (chỉ PDF) số trang. */
  readonly validateFile: (file: UploadCandidate) => Promise<UploadValidation>;
  /** Đoán tầng từ một cái tên. Trượt là câu trả lời bình thường, không phải lỗi. */
  readonly guessFloor: (name: string) => FloorGuess;
  /** Một lượt tải: `initUpload` → các khúc → `complete`, kèm huỷ và trạng thái. */
  readonly createUpload: (input: CreateFloorUploadInput) => UploadTask;
  /** Ghi ý định tải vào hàng đợi ngoại tuyến. `false` khi hàng đợi từ chối. */
  readonly enqueueOffline: (input: EnqueueOfflineUploadInput) => Promise<boolean>;
  /**
   * Theo dõi mạng. Bắt đầu ngay, trả hàm dọn dẹp.
   *
   * Không hook nào trong repo bọc `createNetworkMonitor`, và luật R-68 cấm thêm
   * một hook vào `src/lib` trong lượt dựng màn — nên chỗ nối nằm ở đây, một lần.
   */
  readonly watchNetwork: (listener: (isOnline: boolean) => void) => () => void;
  /** Một câu cho lỗi đến từ `src/api`. */
  readonly describeApiFailure: (error: unknown) => FloorUploadFailure;
  /** Một câu cho lỗi đến từ một lượt tải hỏng giữa chừng. */
  readonly describeUploadFailure: (failure: UploadFailure) => FloorUploadFailure;
  /** Vé hoàn tác 8 giây cho một lượt xoá tệp (D-05). */
  readonly createRemovalTicket: (input: CreateRemovalTicketInput) => UndoTicket;
  /** Mã mới cho một tệp vừa nhận. */
  readonly createFileId: () => string;
}

export interface CreateFloorUploadGatewayOptions {
  /** Bộ theo dõi mạng tiêm được — test cắm bản giả để khỏi ping thật. */
  readonly networkMonitor?: NetworkMonitor;
}

/** Cửa sổ hoàn tác, tái xuất để hook và test không viết lại con số (R-71). */
export { UNDO_WINDOW_MS };

/* -------------------------------------------------------------------------- */
/* Chuyển đổi.                                                                 */
/* -------------------------------------------------------------------------- */

function toFailure(error: AppError): FloorUploadFailure {
  return {
    sentence: describeError(error).description,
    kind: error.kind,
    isRetryable: error.retryable,
  };
}

/* -------------------------------------------------------------------------- */
/* Cửa vào.                                                                    */
/* -------------------------------------------------------------------------- */

export function createFloorUploadGateway(
  client: ApiClient,
  options: CreateFloorUploadGatewayOptions = {},
): FloorUploadGateway {
  return {
    readFloors: async ({ projectId }) => {
      const result = await client.projects.read({ projectId });

      if (!result.ok) {
        return result;
      }

      return { ok: true, data: result.data.floors };
    },

    validateFile: (file) => validateUploadFile(file),

    guessFloor: (name) => guessFloorFromFileName(name),

    createUpload: ({ file, floorId, id, onProgress, projectId }) =>
      createUploadTask({
        api: client.drawings,
        file,
        floorId,
        projectId,
        onProgress,
        ...(id !== undefined ? { id } : {}),
      }),

    enqueueOffline: async ({ fileName, floorId, projectId, sizeBytes }) => {
      const result = await addPendingCommand({
        projectId,
        command: { kind: 'uploadDrawing', fileName, floorId, projectId, sizeBytes },
      });

      return result.ok;
    },

    watchNetwork: (listener) => {
      const monitor = options.networkMonitor ?? createNetworkMonitor();
      const unsubscribe = monitor.subscribe((status) => {
        listener(status.online);
      });

      monitor.start();
      listener(monitor.getStatus().online);

      return () => {
        unsubscribe();
        monitor.stop();
      };
    },

    describeApiFailure: (error) => {
      const appError = toAppError(error);

      // `isTerminalUploadError` là cùng phép kiểm mà `uploadTask` dùng cho 413
      // và 422; gọi lại nó ở đây giữ cho hai nơi không lệch nhau về "thử lại
      // có nghĩa hay không".
      return {
        ...toFailure(appError),
        isRetryable: appError.retryable && !isTerminalUploadError(error),
      };
    },

    describeUploadFailure: (failure) => ({
      ...toFailure(failure.error),
      isRetryable: failure.error.retryable && !failure.terminal,
    }),

    createRemovalTicket: ({ description, now, undo }) =>
      createUndoTicket({
        description,
        undo,
        ...(now !== undefined ? { now } : {}),
      }),

    createFileId: () => createUuid(),
  };
}

/** Cổng dựng trên client thật của ứng dụng — thứ container gọi. */
export function createAppFloorUploadGateway(): FloorUploadGateway {
  return createFloorUploadGateway(createAppApiClient());
}
