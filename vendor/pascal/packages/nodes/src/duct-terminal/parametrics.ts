import type { ParametricDescriptor } from '@pascal-app/core'
import type { DuctTerminalNode } from './schema'
import { vi } from '../i18n/vi'

export const ductTerminalParametrics: ParametricDescriptor<DuctTerminalNode> = {
  groups: [
    {
      label: vi.common.terminal,
      fields: [
        {
          key: 'terminalType',
          kind: 'enum',
          options: ['supply-register', 'diffuser', 'return-grille'],
        },
        {
          key: 'mount',
          kind: 'enum',
          options: ['floor', 'ceiling', 'wall'],
          display: 'segmented',
        },
      ],
    },
    {
      label: vi.common.face,
      fields: [
        { key: 'width', kind: 'number', unit: 'm', min: 0.1, max: 1000, step: 0.05 },
        { key: 'depth', kind: 'number', unit: 'm', min: 0.05, max: 1000, step: 0.05 },
      ],
    },
    {
      label: vi.common.collar,
      fields: [
        {
          key: 'collarShape',
          kind: 'enum',
          options: ['round', 'rect', 'oval'],
          display: 'segmented',
        },
        {
          key: 'collarDiameter',
          kind: 'number',
          unit: 'in',
          min: 4,
          max: 20,
          step: 1,
          visibleIf: (n) => n.collarShape === 'round',
        },
        {
          key: 'collarWidth',
          kind: 'number',
          unit: 'in',
          min: 4,
          max: 20,
          step: 1,
          visibleIf: (n) => n.collarShape !== 'round',
        },
        {
          key: 'collarHeight',
          kind: 'number',
          unit: 'in',
          min: 3,
          max: 20,
          step: 1,
          visibleIf: (n) => n.collarShape !== 'round',
        },
      ],
    },
    {
      label: vi.common.placement,
      fields: [{ key: 'position', kind: 'vec3' }],
    },
  ],
}
