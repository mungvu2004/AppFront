import type { ParametricDescriptor } from '@pascal-app/core'
import type { LiquidLineNode } from './schema'
import { vi } from '../i18n/vi'

export const liquidLineParametrics: ParametricDescriptor<LiquidLineNode> = {
  groups: [
    {
      label: vi.common.line,
      fields: [
        {
          key: 'diameter',
          kind: 'number',
          unit: 'in',
          min: 0.125,
          max: 0.75,
          step: 0.125,
        },
      ],
    },
  ],
}
