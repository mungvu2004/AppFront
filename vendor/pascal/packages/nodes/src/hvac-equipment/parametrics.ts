import type { ParametricDescriptor } from '@pascal-app/core'
import type { HvacEquipmentNode } from './schema'
import { vi } from '../i18n/vi'

export const hvacEquipmentParametrics: ParametricDescriptor<HvacEquipmentNode> = {
  groups: [
    {
      label: vi.common.equipment,
      fields: [
        {
          key: 'equipmentType',
          kind: 'enum',
          options: ['furnace', 'air-handler', 'condenser'],
          display: 'segmented',
        },
      ],
    },
    {
      label: vi.common.cabinet,
      fields: [
        { key: 'width', kind: 'number', unit: 'm', min: 0.3, max: 1000, step: 0.05 },
        { key: 'depth', kind: 'number', unit: 'm', min: 0.3, max: 1000, step: 0.05 },
        { key: 'height', kind: 'number', unit: 'm', min: 0.4, max: 1000, step: 0.05 },
      ],
    },
    {
      label: vi.common.supply,
      fields: [
        {
          key: 'supplyShape',
          kind: 'enum',
          options: ['round', 'rect', 'oval'],
          display: 'segmented',
          visibleIf: (n) => n.equipmentType !== 'condenser',
        },
        {
          key: 'supplyDiameter',
          kind: 'number',
          unit: 'in',
          min: 6,
          max: 30,
          step: 1,
          visibleIf: (n) => n.equipmentType !== 'condenser' && n.supplyShape === 'round',
        },
        {
          key: 'supplyWidth',
          kind: 'number',
          unit: 'in',
          min: 6,
          max: 30,
          step: 1,
          visibleIf: (n) => n.equipmentType !== 'condenser' && n.supplyShape !== 'round',
        },
        {
          key: 'supplyHeight',
          kind: 'number',
          unit: 'in',
          min: 6,
          max: 30,
          step: 1,
          visibleIf: (n) => n.equipmentType !== 'condenser' && n.supplyShape !== 'round',
        },
      ],
    },
    {
      label: vi.common.returnPart,
      fields: [
        {
          key: 'returnShape',
          kind: 'enum',
          options: ['round', 'rect', 'oval'],
          display: 'segmented',
          visibleIf: (n) => n.equipmentType !== 'condenser',
        },
        {
          key: 'returnDiameter',
          kind: 'number',
          unit: 'in',
          min: 6,
          max: 30,
          step: 1,
          visibleIf: (n) => n.equipmentType !== 'condenser' && n.returnShape === 'round',
        },
        {
          key: 'returnWidth',
          kind: 'number',
          unit: 'in',
          min: 6,
          max: 30,
          step: 1,
          visibleIf: (n) => n.equipmentType !== 'condenser' && n.returnShape !== 'round',
        },
        {
          key: 'returnHeight',
          kind: 'number',
          unit: 'in',
          min: 6,
          max: 30,
          step: 1,
          visibleIf: (n) => n.equipmentType !== 'condenser' && n.returnShape !== 'round',
        },
      ],
    },
  ],
}
