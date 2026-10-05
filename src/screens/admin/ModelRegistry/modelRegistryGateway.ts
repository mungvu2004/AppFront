/**
 * Cổng thuần của màn registry model: quyền, bốn lượt gọi, toast.
 *
 * Bốn lượt gọi bọc `AdminMlClient` (`src/api/adminMlClient.ts`) và NÉM lỗi ra — đó là cách
 * `useQuery`/`useMutation` thấy thất bại. Lỗi đi nguyên hình `HttpError` để
 * `modelRegistryErrors.ts` đọc `code` bằng `readWireError`.
 *
 * Toast đi qua `notificationBus` (A8): container tiêm bus của phiên (`appNotificationBus`),
 * bài kiểm và story tiêm bus riêng.
 */

import type {
  ActivateModelVersionInput,
  AdminMlClient,
  ListModelVersionsInput,
  ModelVersionList,
} from '@/api/adminMlClient';
import type { ApiResult } from '@/api/client';
import type { ModelFamily, ModelVersion } from '@/api/schemas/adminMl';
import type { NotificationBus, NotificationInput } from '@/lib/mutations/notificationBus';
import { createUndoTicket, type CreateUndoTicketOptions, type UndoTicket } from '@/lib/mutations/undoTicket';

/** Chỉ quản trị viên hệ thống; không lùi về vai dự án (F-11 khối [9]). */
export function canManageModels(roles: readonly string[]): boolean {
  return roles.includes('admin');
}

export interface ModelRegistryGateway {
  listFamilies(signal?: AbortSignal): Promise<readonly ModelFamily[]>;
  listVersions(input: ListModelVersionsInput): Promise<ModelVersionList>;
  readVersion(modelVersionId: string, signal?: AbortSignal): Promise<ModelVersion>;
  activateVersion(input: ActivateModelVersionInput): Promise<ModelFamily>;
  /** Vé hoàn tác của A8, cùng đồng hồ với cổng. */
  createUndoTicket(options: CreateUndoTicketOptions): UndoTicket;
  notify(input: NotificationInput): void;
  now(): number;
}

export interface CreateModelRegistryGatewayOptions {
  readonly client: AdminMlClient;
  readonly notifications: NotificationBus;
  readonly now?: () => number;
}

async function unwrap<T>(pending: Promise<ApiResult<T>>): Promise<T> {
  const result = await pending;

  if (!result.ok) {
    throw result.error;
  }

  return result.data;
}

export function createModelRegistryGateway({
  client,
  notifications,
  now = Date.now,
}: CreateModelRegistryGatewayOptions): ModelRegistryGateway {
  return {
    listFamilies: (signal) => unwrap(client.listFamilies(signal)),
    listVersions: (input) => unwrap(client.listVersions(input)),
    readVersion: (modelVersionId, signal) => unwrap(client.readVersion(modelVersionId, signal)),
    activateVersion: (input) => unwrap(client.activateVersion(input)),
    createUndoTicket: (options) => createUndoTicket({ now, ...options }),
    notify: (input) => {
      notifications.publish(input);
    },
    now,
  };
}
