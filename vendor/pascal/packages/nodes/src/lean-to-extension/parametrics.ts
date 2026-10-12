import type { LeanToExtensionNode, ParametricDescriptor } from '@pascal-app/core'
import { leanToLowEdgeHeight, MIN_LEAN_TO_POST_HEIGHT, resolveLeanToLayout } from './layout'
import { vi } from '../i18n/vi'

const degrees = (rise: number, run: number) =>
  Math.max(1, Math.min(45, (Math.atan2(rise, Math.max(0.001, run)) * 180) / Math.PI))

const COVERING_MIN_PITCH: Record<LeanToExtensionNode['coveringType'], number | null> = {
  generic: null,
  shingle: 9.5,
  'metal-panel': 2,
}

export function deriveLeanToResizePatch(
  previous: LeanToExtensionNode,
  patch: Partial<LeanToExtensionNode>,
): Partial<LeanToExtensionNode> {
  const changesProjection = Object.hasOwn(patch, 'projection')
  const changesHigh = Object.hasOwn(patch, 'highEdgeHeight')
  const changesLow = Object.hasOwn(patch, 'lowEdgeHeight')
  const changesPitch = Object.hasOwn(patch, 'pitch')
  if (!(changesProjection || changesHigh || changesLow || changesPitch)) return {}

  const projection = patch.projection ?? previous.projection
  let highEdgeHeight = patch.highEdgeHeight ?? previous.highEdgeHeight
  let pitch = patch.pitch ?? previous.pitch
  let lowEdgeHeight = leanToLowEdgeHeight(previous)

  if (changesLow) {
    lowEdgeHeight = patch.lowEdgeHeight ?? lowEdgeHeight
    if (previous.resizeLock === 'preserve-pitch') {
      highEdgeHeight = lowEdgeHeight + projection * Math.tan((pitch * Math.PI) / 180)
    } else {
      pitch = degrees(highEdgeHeight - lowEdgeHeight, projection)
      lowEdgeHeight = highEdgeHeight - projection * Math.tan((pitch * Math.PI) / 180)
    }
  } else if (changesProjection && !changesHigh && !changesPitch) {
    if (previous.resizeLock === 'preserve-high-edge') {
      pitch = degrees(highEdgeHeight - lowEdgeHeight, projection)
    } else if (previous.resizeLock === 'preserve-low-edge') {
      highEdgeHeight = lowEdgeHeight + projection * Math.tan((pitch * Math.PI) / 180)
    } else {
      lowEdgeHeight = highEdgeHeight - projection * Math.tan((pitch * Math.PI) / 180)
    }
  } else if (changesPitch && !changesHigh) {
    if (previous.resizeLock === 'preserve-low-edge') {
      highEdgeHeight = lowEdgeHeight + projection * Math.tan((pitch * Math.PI) / 180)
    } else {
      lowEdgeHeight = highEdgeHeight - projection * Math.tan((pitch * Math.PI) / 180)
    }
  } else if (changesHigh && !changesPitch) {
    if (previous.resizeLock === 'preserve-low-edge') {
      pitch = degrees(highEdgeHeight - lowEdgeHeight, projection)
    }
    lowEdgeHeight = highEdgeHeight - projection * Math.tan((pitch * Math.PI) / 180)
  } else {
    lowEdgeHeight = highEdgeHeight - projection * Math.tan((pitch * Math.PI) / 180)
  }

  return { highEdgeHeight, lowEdgeHeight, pitch }
}

export const leanToExtensionParametrics: ParametricDescriptor<LeanToExtensionNode> = {
  derive: (next, patch, previous = next) => {
    return {
      ...(patch.canopyForm === 'gable' || patch.canopyForm === 'butterfly'
        ? { highSideMode: 'independent-high-beam' as const, autoSpan: false }
        : {}),
      ...(patch.connectionMode === 'manual'
        ? {
            hostRoofId: undefined,
            hostRoofSegmentId: undefined,
            hostRoofEdge: undefined,
            hostRoofEdgeRange: undefined,
            connectionInset: 0,
          }
        : {}),
      ...('roofThickness' in patch || 'shingleThickness' in patch
        ? { matchHostRoofStructure: false }
        : {}),
      ...('span' in patch ? { autoSpan: false } : {}),
      ...(previous.hostKind === 'slab-edge' && typeof patch.highEdgeHeight === 'number'
        ? {
            hostHeightOffset:
              previous.hostHeightOffset + patch.highEdgeHeight - previous.highEdgeHeight,
          }
        : {}),
      ...deriveLeanToResizePatch(previous, patch),
    }
  },
  groups: [
    {
      label: vi.common.size,
      fields: [
        {
          key: 'canopyForm',
          label: vi.common.roofForm,
          kind: 'enum',
          options: ['mono', 'gable', 'butterfly'],
          display: 'segmented',
          visibleIf: (node) => node.hostKind === 'freestanding',
        },
        {
          key: 'autoSpan',
          label: vi.common.matchHostWidth,
          kind: 'boolean',
          visibleIf: (node) => node.hostKind !== 'freestanding',
        },
        {
          key: 'span',
          label: vi.common.width,
          kind: 'number',
          unit: 'm',
          min: 0.5,
          max: 1000,
          step: 0.1,
        },
        {
          key: 'projection',
          label: vi.common.projection,
          kind: 'number',
          unit: 'm',
          min: 0.5,
          max: 1000,
          step: 0.1,
        },
        {
          key: 'highEdgeHeight',
          label: vi.common.highEdgeHeight,
          kind: 'number',
          unit: 'm',
          min: 0.8,
          max: 1000,
          step: 0.05,
          visibleIf: (node) => node.connectionMode === 'manual' || !node.hostRoofSegmentId,
        },
        {
          key: 'pitch',
          label: vi.common.slope,
          kind: 'number',
          unit: '°',
          min: 1,
          max: 45,
          step: 1,
        },
      ],
    },
    {
      label: vi.common.connection,
      fields: [
        {
          key: 'connectionMode',
          label: vi.common.roofConnection,
          kind: 'enum',
          options: ['auto', 'manual'],
          display: 'segmented',
          visibleIf: (node) => node.hostKind === 'wall',
        },
        {
          key: 'highSideMode',
          label: vi.common.highSideSupport,
          kind: 'enum',
          options: ['wall-ledger', 'independent-high-beam'],
          visibleIf: (node) => node.hostKind === 'wall',
        },
        {
          key: 'connectionOffset',
          label: vi.common.connectionOffset,
          kind: 'number',
          unit: 'm',
          min: -1,
          max: 1,
          step: 0.01,
          visibleIf: (node) => node.connectionMode === 'auto' && Boolean(node.hostRoofSegmentId),
        },
        {
          key: 'matchHostRoofMaterial',
          label: vi.common.matchHostRoofMaterial,
          kind: 'boolean',
          visibleIf: (node) => node.connectionMode === 'auto' && Boolean(node.hostRoofId),
        },
        {
          key: 'matchHostRoofStructure',
          label: vi.common.matchHostRoofStructure,
          kind: 'boolean',
          visibleIf: (node) => node.connectionMode === 'auto' && Boolean(node.hostRoofId),
        },
      ],
    },
    {
      label: vi.common.structure,
      fields: [
        {
          key: 'postLayoutMode',
          label: vi.common.postLayout,
          kind: 'enum',
          options: ['count', 'target-spacing'],
        },
        {
          key: 'postCount',
          label: vi.common.postCount,
          kind: 'number',
          min: 2,
          max: 20,
          step: 1,
          visibleIf: (node) => node.postLayoutMode === 'count',
        },
        {
          key: 'postSpacing',
          label: vi.common.postSpacing,
          kind: 'number',
          unit: 'm',
          min: 0.3,
          max: 1000,
          step: 0.1,
          visibleIf: (node) => node.postLayoutMode === 'target-spacing',
        },
        {
          key: 'postWidth',
          label: vi.common.postWidth,
          kind: 'number',
          unit: 'm',
          min: 0.05,
          max: 0.6,
          step: 0.01,
        },
        {
          key: 'postDepth',
          label: vi.common.postDepth,
          kind: 'number',
          unit: 'm',
          min: 0.05,
          max: 0.6,
          step: 0.01,
        },
        {
          key: 'beamHeight',
          label: vi.common.beamHeight,
          kind: 'number',
          unit: 'm',
          min: 0.05,
          max: 0.8,
          step: 0.01,
        },
        {
          key: 'beamWidth',
          label: vi.common.beamWidth,
          kind: 'number',
          unit: 'm',
          min: 0.05,
          max: 0.6,
          step: 0.01,
        },
        {
          key: 'framingStrategy',
          label: vi.common.framing,
          kind: 'enum',
          options: ['hidden', 'rafters', 'purlins', 'covering-specific'],
        },
        {
          key: 'autoMiterCorners',
          label: vi.common.autoMiterCorners,
          kind: 'boolean',
        },
      ],
    },
    {
      label: vi.common.drainage,
      fields: [
        { key: 'gutterEnabled', label: vi.common.gutters, kind: 'boolean' },
        {
          key: 'gutterProfile',
          label: vi.common.gutterProfile,
          kind: 'enum',
          options: ['k-style', 'half-round', 'box'],
          visibleIf: (node) => node.gutterEnabled,
        },
        {
          key: 'gutterSize',
          label: vi.common.gutterSize,
          kind: 'number',
          unit: 'm',
          min: 0.04,
          max: 0.3,
          step: 0.01,
          visibleIf: (node) => node.gutterEnabled,
        },
        {
          key: 'downspoutEnabled',
          label: vi.common.downspout,
          kind: 'boolean',
          visibleIf: (node) => node.gutterEnabled,
        },
        {
          key: 'downspoutPosition',
          label: vi.common.downspoutPosition,
          kind: 'number',
          min: -1,
          max: 1,
          step: 0.05,
          visibleIf: (node) => node.gutterEnabled && node.downspoutEnabled,
        },
      ],
    },
    {
      label: vi.common.advanced,
      fields: [
        {
          key: 'resizeLock',
          label: vi.common.whenResizing,
          kind: 'enum',
          options: ['preserve-high-edge', 'preserve-low-edge', 'preserve-pitch'],
        },
        {
          key: 'lowEdgeHeight',
          label: vi.common.outerEdgeHeight,
          kind: 'number',
          unit: 'm',
          min: 0.2,
          max: 1000,
          step: 0.05,
          visibleIf: (node) => node.connectionMode === 'manual' || !node.hostRoofSegmentId,
        },
        {
          key: 'roofThickness',
          label: vi.common.roofThickness,
          kind: 'number',
          unit: 'm',
          min: 0.02,
          max: 0.5,
          step: 0.01,
        },
        {
          key: 'shingleThickness',
          label: vi.common.shingleThickness,
          kind: 'number',
          unit: 'm',
          min: 0,
          max: 0.5,
          step: 0.005,
        },
        {
          key: 'coveringType',
          label: vi.common.roofCovering,
          kind: 'enum',
          options: ['generic', 'shingle', 'metal-panel'],
        },
        {
          key: 'highOverhang',
          label: vi.common.highSideOverhang,
          kind: 'number',
          unit: 'm',
          min: 0,
          max: 1.5,
          step: 0.05,
        },
        {
          key: 'lowOverhang',
          label: vi.common.outerOverhang,
          kind: 'number',
          unit: 'm',
          min: 0,
          max: 1.5,
          step: 0.05,
        },
        {
          key: 'leftOverhang',
          label: vi.common.leftOverhang,
          kind: 'number',
          unit: 'm',
          min: 0,
          max: 1.5,
          step: 0.05,
        },
        {
          key: 'rightOverhang',
          label: vi.common.rightOverhang,
          kind: 'number',
          unit: 'm',
          min: 0,
          max: 1.5,
          step: 0.05,
        },
        { key: 'sideFlashing', label: vi.common.sideFlashing, kind: 'boolean' },
        {
          key: 'flashingProjection',
          label: vi.common.flashingProjection,
          kind: 'number',
          unit: 'm',
          min: 0.01,
          max: 0.5,
          step: 0.005,
          visibleIf: (node) => node.sideFlashing,
        },
        {
          key: 'flashingHeight',
          label: vi.common.flashingHeight,
          kind: 'number',
          unit: 'm',
          min: 0.03,
          max: 0.5,
          step: 0.01,
          visibleIf: (node) => node.sideFlashing,
        },
        {
          key: 'leftEndCondition',
          label: vi.common.leftEnd,
          kind: 'enum',
          options: ['open', 'wall-abutment', 'joined'],
        },
        {
          key: 'rightEndCondition',
          label: vi.common.rightEnd,
          kind: 'enum',
          options: ['open', 'wall-abutment', 'joined'],
        },
        {
          key: 'ledgerVerticalOffset',
          label: vi.common.highBeamOffset,
          kind: 'number',
          unit: 'm',
          min: -1,
          max: 1,
          step: 0.01,
          visibleIf: (node) => node.highSideMode === 'independent-high-beam',
        },
        {
          key: 'ledgerDepth',
          label: vi.common.highBeamDepth,
          kind: 'number',
          unit: 'm',
          min: 0.03,
          max: 0.5,
          step: 0.01,
          visibleIf: (node) => node.highSideMode === 'independent-high-beam',
        },
        {
          key: 'ledgerHeight',
          label: vi.common.highBeamHeight,
          kind: 'number',
          unit: 'm',
          min: 0.05,
          max: 0.8,
          step: 0.01,
          visibleIf: (node) => node.highSideMode === 'independent-high-beam',
        },
        {
          key: 'lowBeamInset',
          label: vi.common.beamSetback,
          kind: 'number',
          unit: 'm',
          min: 0,
          max: 2,
          step: 0.05,
        },
        {
          key: 'postInset',
          label: vi.common.postInset,
          kind: 'number',
          unit: 'm',
          min: 0,
          max: 3,
          step: 0.05,
        },
        {
          key: 'rafterWidth',
          label: vi.common.rafterWidth,
          kind: 'number',
          unit: 'm',
          min: 0.03,
          max: 0.4,
          step: 0.01,
          visibleIf: (node) => node.framingStrategy === 'rafters',
        },
        {
          key: 'rafterHeight',
          label: vi.common.rafterHeight,
          kind: 'number',
          unit: 'm',
          min: 0.03,
          max: 0.5,
          step: 0.01,
        },
        {
          key: 'rafterSpacing',
          label: vi.common.rafterSpacing,
          kind: 'number',
          unit: 'm',
          min: 0.2,
          max: 3,
          step: 0.05,
          visibleIf: (node) => node.framingStrategy === 'rafters',
        },
        {
          key: 'rafterEndInset',
          label: vi.common.rafterEndInset,
          kind: 'number',
          unit: 'm',
          min: 0,
          max: 3,
          step: 0.05,
          visibleIf: (node) => node.framingStrategy === 'rafters',
        },
        {
          key: 'purlinWidth',
          label: vi.common.purlinWidth,
          kind: 'number',
          unit: 'm',
          min: 0.03,
          max: 0.4,
          step: 0.01,
          visibleIf: (node) =>
            node.framingStrategy === 'purlins' || node.framingStrategy === 'covering-specific',
        },
        {
          key: 'purlinHeight',
          label: vi.common.purlinHeight,
          kind: 'number',
          unit: 'm',
          min: 0.03,
          max: 0.5,
          step: 0.01,
          visibleIf: (node) =>
            node.framingStrategy === 'purlins' || node.framingStrategy === 'covering-specific',
        },
        {
          key: 'purlinSpacing',
          label: vi.common.purlinSpacing,
          kind: 'number',
          unit: 'm',
          min: 0.2,
          max: 3,
          step: 0.05,
          visibleIf: (node) =>
            node.framingStrategy === 'purlins' || node.framingStrategy === 'covering-specific',
        },
        {
          key: 'postBracing',
          label: vi.common.postBracing,
          kind: 'enum',
          options: ['none', 'knee'],
        },
        {
          key: 'footingStyle',
          label: vi.common.footings,
          kind: 'enum',
          options: ['none', 'base-plate', 'concrete-pad'],
        },
      ],
    },
  ],
  invariants: [
    (node) => {
      const layout = resolveLeanToLayout(node)
      return layout.effectivePitchDegrees + 1e-6 < node.pitch
        ? [
            {
              field: 'pitch',
              msg: `Pitch is too steep for the selected height and projection; leave at least ${MIN_LEAN_TO_POST_HEIGHT}m of post height.`,
              severity: 'error' as const,
            },
          ]
        : []
    },
    (node) => {
      const minimum = COVERING_MIN_PITCH[node.coveringType]
      return minimum !== null && node.pitch + 1e-6 < minimum
        ? [
            {
              field: 'pitch',
              msg: `${node.coveringType} covering typically needs at least ${minimum}° pitch; verify the selected product and local requirements.`,
              severity: 'warning' as const,
            },
          ]
        : []
    },
  ],
}
