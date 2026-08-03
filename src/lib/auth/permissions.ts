import type { ProjectRole } from '@/types/project';

export const AUTH_ROLES = ['admin', 'engineer', 'viewer'] as const satisfies readonly ProjectRole[];

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
    admin: adminPermissions['floor.upload'],
    engineer: engineerPermissions['floor.upload'],
    viewer: viewerPermissions['floor.upload'],
  },
  'layer.edit': {
    admin: adminPermissions['layer.edit'],
    engineer: engineerPermissions['layer.edit'],
    viewer: viewerPermissions['layer.edit'],
  },
  'library.manage': {
    admin: adminPermissions['library.manage'],
    engineer: engineerPermissions['library.manage'],
    viewer: viewerPermissions['library.manage'],
  },
  'model.export': {
    admin: adminPermissions['model.export'],
    engineer: engineerPermissions['model.export'],
    viewer: viewerPermissions['model.export'],
  },
  'project.create': {
    admin: adminPermissions['project.create'],
    engineer: engineerPermissions['project.create'],
    viewer: viewerPermissions['project.create'],
  },
  'project.settings.edit': {
    admin: adminPermissions['project.settings.edit'],
    engineer: engineerPermissions['project.settings.edit'],
    viewer: viewerPermissions['project.settings.edit'],
  },
  'share.create': {
    admin: adminPermissions['share.create'],
    engineer: engineerPermissions['share.create'],
    viewer: viewerPermissions['share.create'],
  },
  'user.manage': {
    admin: adminPermissions['user.manage'],
    engineer: engineerPermissions['user.manage'],
    viewer: viewerPermissions['user.manage'],
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
