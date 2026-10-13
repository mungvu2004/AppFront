import type { ParametricDescriptor } from '@pascal-app/core'
import type { DormerNode } from './schema'
import { vi } from '../i18n/vi'

export const dormerParametrics: ParametricDescriptor<DormerNode> = {
  // Bespoke tabbed UI (Dormer / Window / Frame / Grid / Sill) — same
  // pattern as chimney. `groups` stays for the MCP path / fallback
  // consumer, but the inspector mounts the custom panel.
  customPanel: () => import('./panel'),
  groups: [
    {
      label: vi.common.dormer,
      fields: [
        { key: 'width', kind: 'number', unit: 'm', min: 0.5, max: 1000, step: 0.05 },
        { key: 'depth', kind: 'number', unit: 'm', min: 0.5, max: 1000, step: 0.05 },
        { key: 'height', kind: 'number', unit: 'm', min: 0, max: 1000, step: 0.05 },
      ],
    },
    {
      label: vi.common.dormerRoof,
      fields: [
        {
          key: 'roofType',
          kind: 'enum',
          options: ['hip', 'gable', 'shed', 'gambrel', 'dutch', 'mansard', 'flat'],
          display: 'select',
        },
        { key: 'roofHeight', kind: 'number', unit: 'm', min: 0, max: 2, step: 0.05 },
        {
          key: 'shedHighSide',
          kind: 'enum',
          options: ['back', 'front'],
          display: 'segmented',
          visibleIf: (n) => n.roofType === 'shed',
        },
      ],
    },
    {
      label: vi.common.hungWall,
      fields: [
        { key: 'wallSkirtHeight', kind: 'number', unit: 'm', min: 0.2, max: 1000, step: 0.05 },
      ],
    },
  ],
}
