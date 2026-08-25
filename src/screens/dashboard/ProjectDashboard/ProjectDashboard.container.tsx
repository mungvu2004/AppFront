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
 * ## What "creating" refreshes, and what it does not
 *
 * `CreateProjectModal.container.tsx`'s gateway calls
 * `applyInvalidation(queryClient, 'createProject', {})` on success, which
 * invalidates exactly `queryKeys.project.list()` — the key
 * `useProjectDashboard` reads. So the dashboard's list query refetches on its
 * own; nothing here has to ask it to. What that refetch actually returns is a
 * separate, pre-existing gap this file does not touch:
 * `projectsGateway.ts`'s `fetchProjectList` is a static three-project sample
 * ("a server this product does not have yet"), so a freshly created project
 * will not visually appear until that gateway talks to something real.
 */

import { useState } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ScreenErrorBoundary, type ScreenErrorFallback } from '@/components/feedback/ScreenErrorBoundary';
import { Toast, useToast } from '@/components/feedback/Toast';
import { useSession } from '@/hooks/useSession';
import { CreateProjectModalContainer } from '@/screens/project/CreateProjectModal';

import { ProjectDashboardConnected } from './ProjectDashboard';

/** Names this screen to the error boundary, and to anything reading its report. */
const SCREEN_ID = 'dashboard';

/** Cùng khuôn với `AuthScreen.container.tsx`'s `AuthCrashFallback` — R-62. */
function DashboardCrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg-app">
      <EmptyState
        icon={<div className="h-8 w-8 rounded-full bg-state-violation-tint" aria-hidden="true" />}
        title={report.description.title}
        description={report.description.description}
        {...(report.retryable
          ? { action: { label: report.description.primaryButtonLabel, onClick: retry } }
          : {})}
      />
    </div>
  );
}

function DashboardWithCreateModal() {
  const session = useSession();
  const role = session.roles[0];
  const { addToast } = useToast();
  const [isCreateOpen, setCreateOpen] = useState(false);

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
