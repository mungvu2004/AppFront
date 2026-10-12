import type { ParametricDescriptor, StairSegmentNode } from '@pascal-app/core'
import { vi } from '../i18n/vi'

export const stairSegmentParametrics: ParametricDescriptor<StairSegmentNode> = {
  groups: [
    {
      label: vi.common.type,
      fields: [
        {
          key: 'segmentType',
          kind: 'enum',
          options: ['stair', 'landing'],
          display: 'segmented',
        },
        {
          key: 'attachmentSide',
          kind: 'enum',
          label: vi.common.attachment,
          options: ['front', 'left', 'right'],
          display: 'segmented',
        },
      ],
    },
    {
      label: vi.common.dimensions,
      fields: [
        { key: 'width', kind: 'number', unit: 'm', min: 0.5, max: 1000, step: 0.1 },
        { key: 'length', kind: 'number', unit: 'm', min: 0.5, max: 1000, step: 0.1 },
        {
          key: 'height',
          kind: 'number',
          unit: 'm',
          min: 0.5,
          max: 1000,
          step: 0.1,
          visibleIf: (node) => node.segmentType === 'stair',
        },
        {
          key: 'stepCount',
          kind: 'number',
          label: vi.common.steps,
          min: 2,
          max: 30,
          step: 1,
          visibleIf: (node) => node.segmentType === 'stair',
        },
      ],
    },
    {
      label: vi.common.structure,
      fields: [
        { key: 'fillToFloor', kind: 'boolean', label: vi.common.fillToFloor },
        {
          key: 'thickness',
          kind: 'number',
          unit: 'm',
          min: 0.05,
          max: 1000,
          step: 0.05,
          visibleIf: (node) => !node.fillToFloor,
        },
      ],
    },
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
  derive: (_next, patch, previous) => {
    if (!(patch.segmentType && patch.segmentType !== previous?.segmentType)) return {}
    return patch.segmentType === 'landing'
      ? { height: 0, length: 1, stepCount: 0 }
      : { height: 2.5, length: 3, stepCount: 10 }
  },
  customPanel: () => import('./panel'),
}
