/**
 * Lưu và xoá phép đo đã ghim, kèm dự án làm hồ sơ — LG-3.
 *
 * Số đo là lớp phủ theo phiên của màn đo (`MeasurementTool`), tách khỏi hình
 * học: hai mutation ở đây chỉ chạm `ENDPOINTS.measurements`, không đụng
 * `spatial.layer` hay bất cứ đường ghi mô hình nào khác.
 *
 * Cả hai dùng lại `createOptimisticMutation` đã có (R-64) — không tự viết
 * `isLoading`/`error`. `deleteMeasurement` trả về một `UndoTicket`
 * (`createUndoTicket`, D-05) thay vì `void`, đúng bất biến A8: mọi thay đổi
 * hoàn tác được, kèm toast hoàn tác, và cửa sổ hoàn tác là `UNDO_WINDOW_MS`
 * có sẵn — không có con số 8000 nào viết tay ở đây (R-71).
 *
 * ## Vì sao nhận `HttpClient` thay vì `ApiClient`
 *
 * `src/api/client.ts` (nơi `ApiClient`/`createApiClient` sống) không nằm
 * trong phạm vi file LG-3 được sửa. Hai hàm dưới đây gọi thẳng `HttpClient`
 * (`src/lib/http`) — nơi DUY NHẤT mọi truy cập mạng phải đi qua
 * (`local/no-fetch-outside-http`) — và nhận nó qua tham số, cùng khuôn
 * `libraryQueries.ts` nhận `Pick<LibraryApi, …>`: test dựng một `HttpClient`
 * giả, không cần server thật.
 */

import type { QueryClient, UseMutationOptions } from '@tanstack/react-query';

import { ENDPOINTS } from '@/api/endpoints';
import type { AppError } from '@/lib/errors';
import type { HttpClient } from '@/lib/http';
import type { MeasurementRecord } from '@/types/measurement';

import { createOptimisticMutation } from './createOptimisticMutation';
import { applyInvalidation } from '../query/invalidation';
import { measurementKeys } from '../query/queryKeys';
import { createUndoTicket, type UndoTicket } from './undoTicket';

/** Phụ thuộc chung của cả hai mutation: cổng mạng và bộ nhớ đệm truy vấn. */
export interface MeasurementMutationDeps {
  readonly http: HttpClient;
  readonly queryClient: QueryClient;
  /** Đồng hồ tiêm được (R-29), cho vé hoàn tác của `deleteMeasurement`. */
  readonly now?: () => number;
}

export interface SaveMeasurementVariables {
  readonly projectId: string;
  readonly measurement: MeasurementRecord;
}

export interface DeleteMeasurementVariables {
  readonly projectId: string;
  /** Bản ghi ĐẦY ĐỦ đang xoá — cần lại nguyên vẹn nếu người dùng bấm hoàn tác. */
  readonly measurement: MeasurementRecord;
}

const upsertMeasurement = (
  list: readonly MeasurementRecord[],
  measurement: MeasurementRecord,
): readonly MeasurementRecord[] => {
  const index = list.findIndex((entry) => entry.id === measurement.id);

  if (index === -1) {
    return [...list, measurement];
  }

  return list.map((entry, position) => (position === index ? measurement : entry));
};

const removeMeasurement = (
  list: readonly MeasurementRecord[],
  measurementId: MeasurementRecord['id'],
): readonly MeasurementRecord[] => list.filter((entry) => entry.id !== measurementId);

/**
 * Gửi một bản ghi lên máy chủ. Dùng chung bởi lượt lưu thường và lượt phục
 * hồi khi hoàn tác xoá.
 *
 * Ném NGUYÊN `result.error` (một `HttpError`), không tự bọc bằng
 * `toAppError`: khi hàm này chạy như `callServer` của `saveMeasurement`,
 * `runOptimisticLifecycle` (`createOptimisticMutation.ts`) đã gọi
 * `toAppError` đúng MỘT lần quanh mọi lỗi `callServer` ném ra. Bọc trước ở
 * đây thì `toAppError` chạy lần hai trên một `AppError` chứ không phải một
 * `HttpError` — hình dạng không còn khớp `isHttpError` (thiếu trường `raw`),
 * nên `kind` gốc (`'network'`, `'notFound'`…) rơi về `'unknown'` một cách âm
 * thầm.
 */
async function postMeasurementToServer(
  http: HttpClient,
  projectId: string,
  measurement: MeasurementRecord,
): Promise<MeasurementRecord> {
  const result = await http.post<MeasurementRecord, MeasurementRecord>(ENDPOINTS.measurements.create(projectId), {
    body: measurement,
  });

  if (!result.ok) {
    throw result.error;
  }

  return result.data;
}

/**
 * Tạo hoặc ghi đè một phép đo đã ghim.
 *
 * Cập nhật lạc quan trước (thêm/thay vào danh sách trong bộ nhớ đệm), gửi
 * lên máy chủ, rồi làm mất hiệu lực đúng khoá `measurementKeys.all` qua
 * `applyInvalidation` — không tự gọi `invalidateQueries` tay.
 */
export function saveMeasurement(
  deps: MeasurementMutationDeps,
): UseMutationOptions<MeasurementRecord, AppError, SaveMeasurementVariables> {
  const { http, queryClient } = deps;

  return createOptimisticMutation(queryClient, {
    affectedKeys: ({ projectId }) => [measurementKeys.all(projectId)],
    afterSuccess: (_result, { projectId }) => {
      applyInvalidation(queryClient, 'saveMeasurement', { projectId });
    },
    applyOptimistic: ({ projectId, measurement }) => {
      queryClient.setQueryData<readonly MeasurementRecord[]>(measurementKeys.all(projectId), (current) =>
        upsertMeasurement(current ?? [], measurement),
      );
    },
    callServer: ({ projectId, measurement }) => postMeasurementToServer(http, projectId, measurement),
    entityId: ({ measurement }) => measurement.id,
    rollback: () => undefined,
  });
}

/**
 * Xoá một phép đo đã ghim, trả về một vé hoàn tác (A8, D-05).
 *
 * Cập nhật lạc quan trước (bỏ khỏi danh sách trong bộ nhớ đệm), gọi máy chủ
 * xoá, rồi mới dựng vé: `undo()` của vé gửi lại NGUYÊN bản ghi vừa xoá qua
 * `postMeasurementToServer` để phục hồi trên máy chủ, và luôn làm mất hiệu
 * lực khoá dù lượt phục hồi đó thành công hay không — để màn phản ánh đúng
 * trạng thái thật của máy chủ thay vì một lần hoàn tác coi như đã xong.
 */
export function deleteMeasurement(
  deps: MeasurementMutationDeps,
): UseMutationOptions<UndoTicket, AppError, DeleteMeasurementVariables> {
  const { http, now, queryClient } = deps;

  return createOptimisticMutation(queryClient, {
    affectedKeys: ({ projectId }) => [measurementKeys.all(projectId)],
    afterSuccess: (_ticket, { projectId }) => {
      applyInvalidation(queryClient, 'deleteMeasurement', { projectId });
    },
    applyOptimistic: ({ projectId, measurement }) => {
      queryClient.setQueryData<readonly MeasurementRecord[]>(measurementKeys.all(projectId), (current) =>
        removeMeasurement(current ?? [], measurement.id),
      );
    },
    callServer: async ({ projectId, measurement }) => {
      const result = await http.delete<void>(ENDPOINTS.measurements.remove(projectId, measurement.id));

      if (!result.ok) {
        /* Ném nguyên, cùng lý do `postMeasurementToServer` phía trên. */
        throw result.error;
      }

      return createUndoTicket({
        description: `Hoàn tác xoá "${measurement.name}"`,
        ...(now !== undefined ? { now } : {}),
        undo: () => {
          void postMeasurementToServer(http, projectId, measurement)
            .then((restored) => {
              queryClient.setQueryData<readonly MeasurementRecord[]>(measurementKeys.all(projectId), (current) =>
                upsertMeasurement(current ?? [], restored),
              );
            })
            .catch(() => undefined)
            .finally(() => {
              applyInvalidation(queryClient, 'saveMeasurement', { projectId });
            });
        },
      });
    },
    entityId: ({ measurement }) => measurement.id,
    rollback: () => undefined,
  });
}
