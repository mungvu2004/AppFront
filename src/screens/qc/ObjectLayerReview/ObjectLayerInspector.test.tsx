// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSampleBuilding, sampleFurnitureId, sampleLevelId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { normalizeSpatial } from '@/domain/spatial/normalize';

import { ObjectLayerInspector } from './ObjectLayerInspector';
import { levelOfGraph, objectsOf, toObjectInspector } from './objectLayerReviewGateway';

afterEach(cleanup);

/** Thanh tra của món nội thất mẫu đầu tiên, đổi sang `kind` đã cho. */
const inspectorOf = (kind: 'washingMachine' | 'shower') => {
  const building = createSampleBuilding();
  const levelId = sampleLevelId(0);
  const id = sampleFurnitureId(0);

  building.furniture = building.furniture.map((item) => (item.id === id ? { ...item, levelId, kind } : item));

  const graph = normalizeSpatial(building);
  const object = objectsOf(graph, levelOfGraph(graph, levelId), []).find((candidate) => candidate.entityId === id)!;

  return toObjectInspector(object, null);
};

describe('ObjectLayerInspector ô "Đổi loại nội thất" (S-13)', () => {
  it('liệt kê "Máy giặt" và "Buồng tắm đứng"; chọn thì gọi đổi loại', () => {
    const onChangeFurnitureKind = vi.fn();
    const noop = () => undefined;

    render(
      <ObjectLayerInspector
        inspector={inspectorOf('washingMachine')}
        isViewerRole={false}
        onApprove={noop}
        onAttachToNearestWall={noop}
        onChangeFurnitureKind={onChangeFurnitureKind}
        onChangeSubtype={noop}
        onChangeSwing={noop}
        onDelete={noop}
        onDragPosition={noop}
        onSelectHostWall={noop}
      />,
    );

    fireEvent.click(screen.getByRole('combobox', { name: 'Đổi loại nội thất' }));

    expect(screen.getByRole('option', { name: 'Máy giặt' })).toBeTruthy();
    fireEvent.click(screen.getByRole('option', { name: 'Buồng tắm đứng' }));
    expect(onChangeFurnitureKind).toHaveBeenCalledWith(expect.any(String), 'shower');
  });
});

describe('ObjectLayerInspector nút duyệt đứng yên (U12)', () => {
  it('nút "Duyệt #…" nằm trước mọi ô của thân thẻ, nên chỗ của nó không đổi theo loại đồ', () => {
    const noop = () => undefined;

    render(
      <ObjectLayerInspector
        inspector={{ ...inspectorOf('washingMachine'), reviewed: false, isSuggested: false }}
        isViewerRole={false}
        onApprove={noop}
        onAttachToNearestWall={noop}
        onChangeFurnitureKind={noop}
        onChangeSubtype={noop}
        onChangeSwing={noop}
        onDelete={noop}
        onDragPosition={noop}
        onSelectHostWall={noop}
      />,
    );

    const approve = screen.getByRole('button', { name: /^Duyệt #/u });
    const kind = screen.getByRole('combobox', { name: 'Đổi loại nội thất' });

    expect(approve.compareDocumentPosition(kind) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
