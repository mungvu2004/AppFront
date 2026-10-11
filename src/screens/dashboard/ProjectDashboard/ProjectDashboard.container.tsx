/**
 * `/`, wired to the router: the dashboard plus the "tạo dự án mới" dialog its
 * own button and `N` shortcut open (R-73 — the gap this rule was written
 * against: `ProjectDashboard` already took `onCreateProject` as a prop, and
 * `CreateProjectModal.container.tsx` was already a fully-wired, ready-to-mount
 * container; nothing sat between them to pass the one callback across).
 *
 * ## One `Toast.Provider`, not two
 *
 * `ProjectDashboard` (the standalone export) wraps its own `Toast.Provider`,
 * for stories, tests and the demo picker. Reusing it here — nesting a second
 * provider around the create dialog — would draw two independent fixed
 * bottom-right stacks: a rename's undo toast in one, a create's undo toast in
 * the other, overlapping in the same corner. So this file renders
 * `ProjectDashboardConnected` directly (the piece `ProjectDashboard.tsx`
 * exports one level below its own provider) under a single provider shared
 * with `CreateProjectModalContainer`.
 *
 * ## What "creating" refreshes
 *
 * `CreateProjectModal.container.tsx`'s gateway calls
 * `applyInvalidation(queryClient, 'createProject', {})`, which invalidates
 * `queryKeys.project.summaries()` — the key `useProjectDashboard` reads (N1) —
 * so the list refetches on its own and the new project appears. The hook builds
 * its own N1 gateway from `createAppApiClient()`; nothing here wires data.
 */

import { useRef, useState } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ScreenErrorBoundary, type ScreenErrorFallback } from '@/components/feedback/ScreenErrorBoundary';
import { Toast, useToast } from '@/components/feedback/Toast';
import { useSession } from '@/hooks/useSession';
import { initialsOf } from '@/lib/format/initials';
import { queryKeys } from '@/lib/query/queryKeys';
import { CreateProjectModalContainer } from '@/screens/project/CreateProjectModal';
import { NotificationBellContainer } from '@/screens/system/NotificationCenter';

import { ProjectDashboardConnected } from './ProjectDashboard';
import type { DashboardProjectList } from './projectsGateway';

/** Names this screen to the error boundary, and to anything reading its report. */
const SCREEN_ID = 'dashboard';

/** Cùng khuôn với `AuthScreen.container.tsx`'s `AuthCrashFallback` — R-62. */
function DashboardCrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <main className="absolute inset-0 flex items-center justify-center bg-bg-app">
      <EmptyState
        icon={<div className="h-8 w-8 rounded-full bg-state-violation-tint" aria-hidden="true" />}
        title={report.description.title}
        description={report.description.description}
        {...(report.retryable
          ? { action: { label: report.description.primaryButtonLabel, onClick: retry } }
          : {})}
      />
    </main>
  );
}

interface CreateToast {
  readonly message: string;
  readonly onUndo?: () => void;
}

/** Takes a project the create toast's undo just deleted off the list N1 holds. */
function forgetProject(queryClient: QueryClient, projectId: string): void {
  // A read the create's own invalidation started would land after this and bring the card back.
  void queryClient.cancelQueries({ queryKey: queryKeys.project.summaries() });
  queryClient.setQueryData<DashboardProjectList>(queryKeys.project.summaries(), (previous) =>
    previous === undefined ? previous : { ...previous, projects: previous.projects.filter((entry) => entry.id !== projectId) },
  );
}

function DashboardWithCreateModal() {
  const session = useSession();
  const role = session.roles[0];
  // Tên rỗng (máy chủ trả `name: ''`) rơi về email ngay trong `initialsOf` (BUG-031).
  const accountInitials = initialsOf(session.user?.name ?? '', session.user?.email ?? '');
  const { addToast } = useToast();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();
  // The dialog calls `onToast` and then `onCreated` for one create: the slot ties that toast to its id.
  const pendingCreate = useRef<{ id: string | null } | null>(null);

  // BUG-112: the create toast's undo deletes the project (#27) but nothing took the card off the list.
  // ponytail: the gateway's `remove` in CreateProjectModal.container.tsx (cụm B) could invalidate instead; then drop this.
  const onCreateToast = (toast: CreateToast): void => {
    const undo = toast.onUndo;
    if (undo === undefined) {
      addToast(toast);
      return;
    }
    const created: { id: string | null } = { id: null };
    pendingCreate.current = created;
    addToast({
      ...toast,
      onUndo: () => {
        undo();
        if (created.id !== null) forgetProject(queryClient, created.id);
      },
    });
  };

  return (
    <>
      <ProjectDashboardConnected
        {...(role !== undefined ? { role } : {})}
        onCreateProject={() => setCreateOpen(true)}
        notificationBell={<NotificationBellContainer />}
        accountInitials={accountInitials}
      />
      <CreateProjectModalContainer
        isOpen={isCreateOpen}
        onDismiss={() => setCreateOpen(false)}
        onToast={onCreateToast}
        onCreated={(id) => {
          if (pendingCreate.current !== null) pendingCreate.current.id = id;
          pendingCreate.current = null;
        }}
        {...(role !== undefined ? { role } : {})}
      />
    </>
  );
}

/** `/` — the real dashboard route (`src/routes/router.tsx`). */
export function ProjectDashboardRoute() {
  return (
    <ScreenErrorBoundary
      screenId={SCREEN_ID}
      renderFallback={({ report, retry }) => <DashboardCrashFallback report={report} retry={retry} />}
    >
      <Toast.Provider>
        <DashboardWithCreateModal />
      </Toast.Provider>
    </ScreenErrorBoundary>
  );
}
