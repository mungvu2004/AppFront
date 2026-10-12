import type { ParametricDescriptor, StairNode } from '@pascal-app/core'
import { vi } from '../i18n/vi'

export const stairParametrics: ParametricDescriptor<StairNode> = {
  groups: [
    {
      label: vi.common.type,
      fields: [
        {
          key: 'stairType',
          kind: 'enum',
          options: ['straight', 'curved', 'spiral'],
          display: 'segmented',
        },
      ],
    },
    {
      label: vi.common.opening,
      fields: [
        { key: 'fromLevelId', kind: 'ref', label: vi.common.fromLevel, refKind: 'level' },
        { key: 'toLevelId', kind: 'ref', label: vi.common.toLevel, refKind: 'level' },
        {
          key: 'slabOpeningMode',
          kind: 'enum',
          label: vi.common.autoCutout,
          options: ['none', 'destination'],
          display: 'segmented',
        },
        {
          key: 'openingOffset',
          kind: 'number',
          label: vi.common.openingOffset,
          unit: 'm',
          min: 0,
          max: 0.5,
          step: 0.01,
          visibleIf: (node) => node.slabOpeningMode === 'destination',
        },
      ],
    },
    {
      label: vi.common.geometry,
      fields: [
        {
          key: 'width',
          kind: 'number',
          unit: 'm',
          min: 0.4,
          max: 1000,
          step: 0.05,
          visibleIf: (node) => node.stairType !== 'straight',
        },
        {
          key: 'stepCount',
          kind: 'number',
          label: vi.common.steps,
          min: 2,
          max: 32,
          step: 1,
          visibleIf: (node) => node.stairType !== 'straight',
        },
        {
          key: 'fillToFloor',
          kind: 'boolean',
          label: vi.common.fillToFloor,
          visibleIf: (node) => node.stairType === 'curved',
        },
        {
          key: 'thickness',
          kind: 'number',
          unit: 'm',
          min: 0.02,
          max: 1000,
          step: 0.01,
          visibleIf: (node) => node.stairType === 'spiral' || !node.fillToFloor,
        },
        {
          key: 'innerRadius',
          kind: 'number',
          label: vi.common.innerRadius,
          unit: 'm',
          min: 0.05,
          max: 1000,
          step: 0.05,
          visibleIf: (node) => node.stairType !== 'straight',
        },
        {
          key: 'sweepAngle',
          kind: 'number',
          label: vi.common.sweepRad,
          min: -Math.PI * 4,
          max: Math.PI * 4,
          step: Math.PI / 180,
          visibleIf: (node) => node.stairType !== 'straight',
        },
        {
          key: 'showCenterColumn',
          kind: 'boolean',
          label: vi.common.centerColumn,
          visibleIf: (node) => node.stairType === 'spiral',
        },
        {
          key: 'showStepSupports',
          kind: 'boolean',
          label: vi.common.stepSupports,
          visibleIf: (node) => node.stairType === 'spiral',
        },
        {
          key: 'topLandingMode',
          kind: 'enum',
          label: vi.common.topLanding,
          options: ['none', 'integrated'],
          display: 'segmented',
          visibleIf: (node) => node.stairType === 'spiral',
        },
        {
          key: 'topLandingDepth',
          kind: 'number',
          label: vi.common.landingDepth,
          unit: 'm',
          min: 0.3,
          max: 1000,
          step: 0.05,
          visibleIf: (node) => node.stairType === 'spiral' && node.topLandingMode === 'integrated',
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
    {
      label: vi.common.railing,
      fields: [
        {
          key: 'railingMode',
          kind: 'enum',
          options: ['none', 'left', 'right', 'both'],
        },
        {
          key: 'railingHeight',
          kind: 'number',
          label: vi.common.railingHeight,
          unit: 'm',
          min: 0.7,
          max: 1.4,
          step: 0.02,
          visibleIf: (node) => node.railingMode !== 'none',
        },
      ],
    },
  ],
  derive: (next, patch, previous) =>
    patch.stairType === 'spiral' && previous?.stairType !== 'spiral'
      ? {
          position: [next.position[0], 0, next.position[2]],
          sweepAngle: (400 * Math.PI) / 180,
        }
      : {},
  customPanel: () => import('./panel'),
}
