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
 * so the list refetches on its own and the new project appears. The toast's
 * "Hoàn tác" deletes it through the same gateway, which invalidates the same
 * key (`deleteProject`), so the card leaves the same way (BUG-112). The hook builds
 * its own N1 gateway from `createAppApiClient()`; nothing here wires data.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ScreenErrorBoundary, type ScreenErrorFallback } from '@/components/feedback/ScreenErrorBoundary';
import { Toast, useToast } from '@/components/feedback/Toast';
import { useSession } from '@/hooks/useSession';
import { ROUTES } from '@/routes/paths';
import { CreateProjectModalContainer } from '@/screens/project/CreateProjectModal';

import { ProjectDashboardConnected } from './ProjectDashboard';

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

function DashboardWithCreateModal() {
  const session = useSession();
  const role = session.roles[0];
  const { addToast } = useToast();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <ProjectDashboardConnected
        {...(role !== undefined ? { role } : {})}
        onCreateProject={() => setCreateOpen(true)}
      />
      <CreateProjectModalContainer
        isOpen={isCreateOpen}
        onDismiss={() => setCreateOpen(false)}
        onToast={addToast}
        // Tạo xong thì vào luôn bước Tải bản vẽ: thẻ mới chưa có tường nên nằm cuối danh sách.
        onCreated={(projectId) => navigate(ROUTES.project.upload(projectId))}
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
