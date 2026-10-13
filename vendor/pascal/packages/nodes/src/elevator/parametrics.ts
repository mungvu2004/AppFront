import type { ElevatorNode, ParametricDescriptor } from '@pascal-app/core'
import { vi } from '../i18n/vi'

export const elevatorParametrics: ParametricDescriptor<ElevatorNode> = {
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
    {
      label: vi.common.cab,
      fields: [
        { key: 'width', kind: 'number', unit: 'm', min: 0.8, max: 1000, step: 0.05 },
        { key: 'depth', kind: 'number', unit: 'm', min: 0.8, max: 1000, step: 0.05 },
        { key: 'cabHeight', kind: 'number', unit: 'm', min: 1.8, max: 1000, step: 0.05 },
      ],
    },
    {
      label: vi.common.shaft,
      fields: [
        {
          key: 'shaftWallThickness',
          kind: 'number',
          label: vi.common.wallThickness,
          unit: 'm',
          min: 0.04,
          max: 0.4,
          step: 0.01,
        },
        {
          key: 'shaftStyle',
          kind: 'enum',
          options: ['solid', 'glass'],
          display: 'segmented',
        },
      ],
    },
    {
      label: vi.common.doors,
      fields: [
        { key: 'doorWidth', kind: 'number', unit: 'm', min: 0.45, max: 1000, step: 0.05 },
        { key: 'doorHeight', kind: 'number', unit: 'm', min: 1.2, max: 1000, step: 0.05 },
        {
          key: 'doorStyle',
          kind: 'enum',
          options: ['center-opening', 'single-left', 'single-right'],
        },
        {
          key: 'doorPanelStyle',
          kind: 'enum',
          label: vi.common.panelStyle,
          options: ['glass-frame', 'solid-panel', 'segmented-panel'],
        },
      ],
    },
    {
      label: vi.common.levels,
      fields: [
        { key: 'fromLevelId', kind: 'ref', label: vi.common.fromLevel, refKind: 'level' },
        { key: 'toLevelId', kind: 'ref', label: vi.common.toLevel, refKind: 'level' },
        { key: 'defaultLevelId', kind: 'ref', label: vi.common.defaultLevel, refKind: 'level' },
      ],
    },
    {
      label: vi.common.motion,
      fields: [
        { key: 'speed', kind: 'number', unit: 'm/s', min: 0.5, max: 8, step: 0.1 },
        {
          key: 'doorDurationMs',
          kind: 'number',
          label: vi.common.doorTime,
          unit: 'ms',
          min: 300,
          max: 2200,
          step: 50,
        },
        {
          key: 'dwellMs',
          kind: 'number',
          label: vi.common.dwell,
          unit: 'ms',
          min: 300,
          max: 5000,
          step: 100,
        },
      ],
    },
  ],
  derive: (next) => ({
    doorHeight: Math.min(next.doorHeight, Math.max(1.2, next.cabHeight - 0.1)),
    doorWidth: Math.min(next.doorWidth, Math.max(0.45, next.width - 0.1)),
  }),
  customPanel: () => import('./panel'),
}
