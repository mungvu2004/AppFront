import type { ParametricDescriptor } from '@pascal-app/core'
import type { LinesetNode } from './schema'
import { vi } from '../i18n/vi'

export const linesetParametrics: ParametricDescriptor<LinesetNode> = {
  groups: [
    {
      label: vi.common.lines,
      fields: [
        {
          key: 'suctionDiameter',
          kind: 'number',
          unit: 'in',
          min: 0.25,
          max: 1.5,
          step: 0.125,
        },
        {
          key: 'liquidDiameter',
          kind: 'number',
          unit: 'in',
          min: 0.125,
          max: 0.75,
          step: 0.125,
        },
      ],
    },
    {
      label: vi.common.insulation,
      fields: [
        {
          key: 'insulated',
          kind: 'boolean',
        },
      ],
    },
  ],
}
