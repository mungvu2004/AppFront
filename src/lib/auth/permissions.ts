import type { ProjectRole } from '@/types/project';

export const AUTH_ROLES = ['Quản trị', 'Kỹ sư', 'Người xem'] as const satisfies readonly ProjectRole[];

export type PermissionAction = 'create' | 'edit' | 'export' | 'manage' | 'upload';

export type PermissionResource =
  | 'floor'
  | 'layer'
  | 'library'
  | 'model'
  | 'project'
  | 'project.settings'
  | 'share'
  | 'user';

export type PermissionKey =
  | 'project.create'
  | 'project.settings.edit'
  | 'floor.upload'
  | 'layer.edit'
  | 'model.export'
  | 'share.create'
  | 'library.manage'
  | 'user.manage';

export interface PermissionContext {
  roles?: readonly ProjectRole[];
  [key: string]: unknown;
}

export type PermissionMatrix = Record<PermissionKey, Record<ProjectRole, boolean>>;

const permissionEntries = [
  { action: 'create', resource: 'project' },
  { action: 'edit', resource: 'project.settings' },
  { action: 'upload', resource: 'floor' },
  { action: 'edit', resource: 'layer' },
  { action: 'export', resource: 'model' },
  { action: 'create', resource: 'share' },
  { action: 'manage', resource: 'library' },
  { action: 'manage', resource: 'user' },
] as const satisfies readonly { action: PermissionAction; resource: PermissionResource }[];

const adminPermissions: Record<PermissionKey, boolean> = {
  'floor.upload': true,
  'layer.edit': true,
  'library.manage': true,
  'model.export': true,
  'project.create': true,
  'project.settings.edit': true,
  'share.create': true,
  'user.manage': true,
};

const engineerPermissions: Record<PermissionKey, boolean> = {
  'floor.upload': true,
  'layer.edit': true,
  'library.manage': false,
  'model.export': true,
  'project.create': true,
  'project.settings.edit': true,
  'share.create': true,
  'user.manage': false,
};

const viewerPermissions: Record<PermissionKey, boolean> = {
  'floor.upload': false,
  'layer.edit': false,
  'library.manage': false,
  'model.export': false,
  'project.create': false,
  'project.settings.edit': false,
  'share.create': false,
  'user.manage': false,
};

export const permissionMatrix: PermissionMatrix = {
  'floor.upload': {
    'Kỹ sư': engineerPermissions['floor.upload'],
    'Người xem': viewerPermissions['floor.upload'],
    'Quản trị': adminPermissions['floor.upload'],
  },
  'layer.edit': {
    'Kỹ sư': engineerPermissions['layer.edit'],
    'Người xem': viewerPermissions['layer.edit'],
    'Quản trị': adminPermissions['layer.edit'],
  },
  'library.manage': {
    'Kỹ sư': engineerPermissions['library.manage'],
    'Người xem': viewerPermissions['library.manage'],
    'Quản trị': adminPermissions['library.manage'],
  },
  'model.export': {
    'Kỹ sư': engineerPermissions['model.export'],
    'Người xem': viewerPermissions['model.export'],
    'Quản trị': adminPermissions['model.export'],
  },
  'project.create': {
    'Kỹ sư': engineerPermissions['project.create'],
    'Người xem': viewerPermissions['project.create'],
    'Quản trị': adminPermissions['project.create'],
  },
  'project.settings.edit': {
    'Kỹ sư': engineerPermissions['project.settings.edit'],
    'Người xem': viewerPermissions['project.settings.edit'],
    'Quản trị': adminPermissions['project.settings.edit'],
  },
  'share.create': {
    'Kỹ sư': engineerPermissions['share.create'],
    'Người xem': viewerPermissions['share.create'],
    'Quản trị': adminPermissions['share.create'],
  },
  'user.manage': {
    'Kỹ sư': engineerPermissions['user.manage'],
    'Người xem': viewerPermissions['user.manage'],
    'Quản trị': adminPermissions['user.manage'],
  },
};

export const permissionCapabilities = permissionEntries.map(({ action, resource }) => ({
  action,
  key: `${resource}.${action}` as PermissionKey,
  resource,
}));

export const can = (
  action: PermissionAction,
  resource: PermissionResource,
  ctx: PermissionContext = {},
): boolean => {
  const capabilityKey = `${resource}.${action}` as PermissionKey;
  const permissions = permissionMatrix[capabilityKey];
  if (!permissions) {
    return false;
  }

  const roles = ctx.roles ?? [];

  return roles.some((role) => permissions[role] ?? false);
};
