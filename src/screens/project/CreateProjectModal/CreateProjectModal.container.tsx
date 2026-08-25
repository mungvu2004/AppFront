/**
 * "Tạo dự án mới", wired to the real API client and the query cache.
 *
 * The thinnest layer over {@link CreateProjectModal}, the same shape as
 * `src/screens/auth/AuthScreen/AuthScreen.container.tsx`: it builds the
 * gateway the hook is injected with, wraps the dialog in a
 * {@link ScreenErrorBoundary} so a crash never takes the page with it (A11),
 * and hands `isOpen`/`onDismiss`/`onCreated`/`onToast` straight through from
 * whoever mounts it — this container does not decide when the dialog opens.
 *
 * ## Why `onToast` is a prop here too, not `useToast()`
 *
 * `Toast.Provider` is mounted inside `ProjectDashboard`
 * (`src/screens/dashboard/ProjectDashboard/ProjectDashboard.tsx`), not here.
 * Calling `useToast()` from this file would throw the moment this dialog is
 * mounted anywhere that provider is not already an ancestor. The caller that
 * eventually renders `<CreateProjectModalContainer>` inside `ProjectDashboard`
 * passes its own `addToast` through; this file never assumes one exists.
 *
 * ## Why not `createOptimisticMutation`
 *
 * This dialog closes the moment a project is created, so there is nothing left
 * on screen for `applyOptimistic`/`rollback` to touch — both would be no-ops.
 * The helper also demands an `entityId` before one exists (a project has no id
 * until the server assigns one) and all six of its config keys, and it needs a
 * `QueryClient` passed into the *hook*, which `useCreateProjectModal.ts` is
 * built specifically not to depend on. A plain gateway call plus
 * `applyInvalidation` on success (D-03) is the honest shape for a create.
 */

import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { createAppApiClient } from '@/api/appClient';
import type { ApiClient, Floor } from '@/api/client';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ScreenErrorBoundary, type ScreenErrorFallback } from '@/components/feedback/ScreenErrorBoundary';
import { createUuid } from '@/lib/http/ids';
import { applyInvalidation } from '@/lib/query/invalidation';
import type { ProjectRole } from '@/types/project';

import { CreateProjectModal } from './CreateProjectModal';
import type { CreateProjectGateway, CreateProjectRequest } from './useCreateProjectModal';

/** Names this screen to the error boundary, and to anything reading its report. */
const SCREEN_ID = 'create-project';

/**
 * `CreateProjectRequest` → `ProjectWriteBody`.
 *
 * `ProjectWriteBody` offers `name, address, code, status, floors, members,
 * progress, currentVersion` and `toProjectWirePayload` picks only those keys —
 * `buildingType` and `notes` have no wire field yet. They stay on the model
 * (collected in the form, carried on the request) so the day the API grows a
 * field for either, this is the one function that changes.
 */
function toProjectWriteBody(request: CreateProjectRequest) {
  const floors: Floor[] = request.floors.map((floor, index) => ({
    id: createUuid(),
    name: floor.name,
    elevationMm: floor.floorElevationMm,
    heightMm: floor.clearHeightMm,
    order: index,
    drawings: [],
  }));

  return {
    name: request.name,
    status: 'draft' as const, // A5: automation never sets 'approved' — that marker is a person's alone.
    floors,
    // TODO(api): buildingType and notes have no wire field yet — dropped here, not sent.
    ...(request.address !== '' ? { address: request.address } : {}),
    ...(request.code !== '' ? { code: request.code } : {}),
  };
}

/**
 * Exported so a test can wire this exact mapping to `createMockApiClient()`
 * (`src/api/__mocks__/client.ts`) instead of hand-rolling a second, competing
 * idea of what a gateway reply looks like — R-70.
 */
/* eslint-disable-next-line react-refresh/only-export-components -- named export
   sits beside the container it serves (mục D) rather than in a seventh file for
   one pure function; nothing here is a component, so Fast Refresh is unaffected. */
export function createProjectGateway(client: ApiClient, invalidate: () => void): CreateProjectGateway {
  return {
    create: async (request) => {
      const result = await client.projects.create({
        body: toProjectWriteBody(request),
        idempotencyKey: createUuid(),
      });

      if (!result.ok) {
        return result;
      }

      invalidate();

      return { ok: true, data: { id: result.data.id } };
    },
    remove: async (projectId) => {
      const result = await client.projects.delete({ projectId });

      // `projects.delete` answers with the deleted `Project`, not `void`; the
      // undo ticket this backs (A8) only ever needs to know it worked.
      if (!result.ok) {
        return result;
      }

      return { ok: true, data: undefined };
    },
  };
}

function useCreateProjectGateway(): CreateProjectGateway {
  const queryClient = useQueryClient();
  const client = useMemo(() => createAppApiClient(), []);

  return useMemo(
    () => createProjectGateway(client, () => applyInvalidation(queryClient, 'createProject', {})),
    [client, queryClient],
  );
}

/**
 * Thứ người dùng thấy thay cho hộp thoại đã sập.
 *
 * Cùng khuôn với `AuthScreen.container.tsx`'s `AuthCrashFallback`: chữ lấy
 * thẳng từ `report.description`, nút "thử lại" chỉ hiện khi lỗi thuộc loại
 * đáng thử lại.
 */
function CreateProjectCrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay">
      <div className="w-[480px] max-w-full rounded-[16px] bg-bg-surface p-6 shadow-modal">
        <EmptyState
          icon={<div className="h-8 w-8 rounded-full bg-state-violation-tint" aria-hidden="true" />}
          title={report.description.title}
          description={report.description.description}
          {...(report.retryable
            ? { action: { label: report.description.primaryButtonLabel, onClick: retry } }
            : {})}
        />
      </div>
    </div>
  );
}

export interface CreateProjectModalContainerProps {
  readonly isOpen: boolean;
  readonly onDismiss: () => void;
  readonly onCreated?: (projectId: string) => void;
  /** Invariant A8's undoable toast. Injected by whoever already mounts `Toast.Provider`. */
  readonly onToast?: (toast: { readonly message: string; readonly onUndo?: () => void }) => void;
  readonly role?: ProjectRole;
  /** Overrides the viewport probe — for a story or a test that wants a fixed answer. */
  readonly forceCompact?: boolean;
}

/** `<CreateProjectModalContainer>` — the real dialog, wired. */
export function CreateProjectModalContainer(props: CreateProjectModalContainerProps) {
  const gateway = useCreateProjectGateway();

  return (
    <ScreenErrorBoundary
      screenId={SCREEN_ID}
      renderFallback={({ report, retry }) => <CreateProjectCrashFallback report={report} retry={retry} />}
    >
      <CreateProjectModal
        gateway={gateway}
        isOpen={props.isOpen}
        onDismiss={props.onDismiss}
        {...(props.onCreated !== undefined ? { onCreated: props.onCreated } : {})}
        {...(props.onToast !== undefined ? { onToast: props.onToast } : {})}
        {...(props.role !== undefined ? { role: props.role } : {})}
        {...(props.forceCompact !== undefined ? { forceCompact: props.forceCompact } : {})}
      />
    </ScreenErrorBoundary>
  );
}
