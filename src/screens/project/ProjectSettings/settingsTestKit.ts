/**
 * Bộ dựng dùng chung cho các bài kiểm của màn cài đặt dự án (F-07).
 *
 * Một `ApiClient` giả chỉ thay ba nhóm mà màn này gọi — `projects`, `projectSettings`,
 * `members` — còn lại lấy từ `createMockApiClient()`. Mỗi hàm là `vi.fn` để bài kiểm
 * đếm lượt gọi và đổi hành vi từng lượt; lỗi dựng đúng hình `HttpError` của dây.
 */

import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { vi } from 'vitest';

import { createMockApiClient } from '@/api/__mocks__/client';
import type { ApiClient, Project, User } from '@/api/client';
import { ProjectSettingsSchema, type ProjectSettings, type ProjectSettingsBody } from '@/api/schemas/projectSettings';
import type { HttpError } from '@/lib/http';
import { createTestQueryClient } from '@/lib/testing/render';

export const PROJECT_ID = 'prj_01HZX3K9M2Q4R6T8V0W1Y3A5C7';

/** Cài đặt mẫu của dây, `revision: 3` như mock; hợp lệ theo schema (khẳng định ở đây). */
export function wireSettings(overrides: Partial<ProjectSettings> = {}): ProjectSettings {
  const wire: ProjectSettings = {
    buildingType: 'residential',
    confidenceThreshold: 0.8,
    defaultScaleMmPerPx: 1,
    lengthUnit: 'mm',
    revision: 3,
    snapToleranceMm: 20,
    ...overrides,
  };

  ProjectSettingsSchema.parse(wire);

  return wire;
}

/** Câu trả lời của N6 từ thân đã gửi: `notes` vắng thì giữ vắng (`exactOptionalPropertyTypes`). */
export function settingsFromBody(
  body: ProjectSettingsBody,
  revision: number,
  overrides: Partial<ProjectSettings> = {},
): ProjectSettings {
  const { notes, ...rest } = body;

  return { ...rest, ...(notes !== undefined ? { notes } : {}), revision, ...overrides };
}

export const ADMIN_USER: User = { email: 'admin@example.com', id: 'usr_admin', name: 'Admin', role: 'admin' };
export const ENGINEER_USER: User = {
  email: 'engineer@example.com',
  id: 'usr_engineer',
  name: 'Engineer',
  role: 'engineer',
};
export const NEWCOMER_USER: User = {
  email: 'newcomer@example.com',
  id: 'usr_newcomer',
  name: 'Newcomer',
  role: 'viewer',
};

export function httpError(
  status: number,
  code: string,
  raw: Record<string, unknown> = {},
  extra: { retryAfterSeconds?: number } = {},
): HttpError {
  return { kind: 'http', status, code, requestId: `req-${code.toLowerCase()}`, retryable: false, raw, ...extra };
}

export const networkError = (): HttpError => ({
  kind: 'network',
  requestId: 'req-network',
  retryable: true,
  raw: {},
});

export const timeoutError = (): HttpError => ({
  kind: 'timeout',
  requestId: 'req-timeout',
  retryable: true,
  raw: {},
});

export const versionConflict = (): HttpError => httpError(409, 'VERSION_CONFLICT', { remoteChanges: [] });

export interface FakeServerOptions {
  readonly members?: readonly User[];
  readonly settings?: ProjectSettings;
  readonly code?: string;
}

/** Dựng dự án mẫu từ mock rồi đặt lại id, thành viên, mã. */
async function buildProject(options: FakeServerOptions, base: ApiClient): Promise<Project> {
  const result = await base.projects.read({ projectId: PROJECT_ID });

  if (!result.ok) {
    throw new Error('mock phải đọc được dự án mẫu');
  }

  return {
    ...result.data,
    id: PROJECT_ID,
    code: options.code ?? 'DA-01',
    members: [...(options.members ?? [ADMIN_USER, ENGINEER_USER])],
  };
}

/** Máy chủ giả: `client` cộng các `vi.fn` để bài kiểm soi. */
export async function createFakeServer(options: FakeServerOptions = {}) {
  const base = createMockApiClient();
  const project = await buildProject(options, base);
  const settings = options.settings ?? wireSettings();

  const projectsRead = vi.fn<ApiClient['projects']['read']>(async () => ({ ok: true, data: project }));
  const projectsUpdate = vi.fn<ApiClient['projects']['update']>(async ({ body }) => ({
    ok: true,
    data: { ...project, ...body },
  }));
  const settingsRead = vi.fn<ApiClient['projectSettings']['read']>(async () => ({ ok: true, data: settings }));
  const settingsReplace = vi.fn<ApiClient['projectSettings']['replace']>(async ({ baseVersion, body }) => ({
    ok: true,
    data: settingsFromBody(body, baseVersion + 1),
  }));
  const membersAdd = vi.fn<ApiClient['members']['add']>(async () => ({ ok: true, data: NEWCOMER_USER }));
  const membersRemove = vi.fn<ApiClient['members']['remove']>(async ({ userId }) => ({
    ok: true,
    data: { ...NEWCOMER_USER, id: userId },
  }));

  const client: ApiClient = {
    ...base,
    projects: { ...base.projects, read: projectsRead, update: projectsUpdate },
    projectSettings: { read: settingsRead, replace: settingsReplace },
    members: { add: membersAdd, remove: membersRemove },
  };

  return {
    client,
    project,
    projectsRead,
    projectsUpdate,
    settingsRead,
    settingsReplace,
    membersAdd,
    membersRemove,
  };
}

export type FakeServer = Awaited<ReturnType<typeof createFakeServer>>;

/** Bọc `renderHook` bằng một `QueryClient` của bài kiểm; trả cả client để soi vô hiệu hoá. */
export function createHookWrapper(): {
  readonly queryClient: QueryClient;
  readonly wrapper: ({ children }: { children: ReactNode }) => ReactNode;
} {
  const queryClient = createTestQueryClient();

  return {
    queryClient,
    wrapper: ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

/** jsdom không có `matchMedia`; cách xếp rộng là mặc định của mọi bài kiểm hook. */
export function installMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
