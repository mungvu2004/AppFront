import type { ParametricDescriptor } from '@pascal-app/core'
import type { BlockNode } from './schema'
import { vi } from '../i18n/vi'

export const blockParametrics: ParametricDescriptor<BlockNode> = {
  groups: [
    {
      label: vi.common.position,
      fields: [{ key: 'position', kind: 'vec3' }],
    },
  ],
  customPanel: () => import('./panel'),
}
