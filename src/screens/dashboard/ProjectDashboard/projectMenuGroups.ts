import type { ContextMenuGroup } from '@/hooks/useContextMenu';

import type { ProjectCardModel, ProjectDashboardActions } from './useProjectDashboard';

/**
 * The right-click / "..." menu of one project. "Nhân bản" is built only when
 * `canDuplicate` (it has no backend contract, R4): not drawn rather than drawn dead (A2).
 * Rename shares `canDelete` — both need `project.settings.edit`.
 */
export function projectMenuGroups(
  project: ProjectCardModel,
  actions: Pick<ProjectDashboardActions, 'openProject' | 'startRename' | 'requestDelete' | 'duplicateProject'>,
  canEdit: boolean,
  canDuplicate: boolean,
): ContextMenuGroup[] {
  return [
    {
      id: 'project-actions',
      items: [
        { id: 'open', label: 'Mở', action: () => actions.openProject(project.id, 'card') },
        ...(canDuplicate
          ? [{ id: 'duplicate', label: 'Nhân bản', action: () => actions.duplicateProject(project.id) }]
          : []),
        { id: 'rename', label: 'Đổi tên', isDisabled: !canEdit, action: () => actions.startRename(project.id) },
        { id: 'delete', label: 'Xoá', isDestructive: true, isDisabled: !canEdit, action: () => actions.requestDelete(project.id) },
      ],
    },
  ];
}
