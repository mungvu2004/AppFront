import type { ParametricDescriptor, RoofNode } from '@pascal-app/core'
import { vi } from '../i18n/vi'

export const roofParametrics: ParametricDescriptor<RoofNode> = {
  groups: [
    {
      label: vi.common.position,
      fields: [
        { key: 'position', kind: 'vec3' },
        {
          key: 'rotation',
          kind: 'number',
          label: vi.common.rotationRad,
          min: -Math.PI,
          max: Math.PI,
          step: Math.PI / 36,
        },
      ],
    },
  ],
  customPanel: () => import('./panel'),
}
