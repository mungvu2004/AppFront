import type { Meta, StoryObj } from '@storybook/react';

import { normalizeSpatial } from '@/domain/spatial/normalize';

import { ROOM_LABEL_FIXTURE_ROOMS } from '../RoomLabelReview/roomLabelFixture';
import {
  WALL_LAYER_FIXTURE_BUILDING,
  WALL_LAYER_FIXTURE_LEVEL,
  WALL_LAYER_FIXTURE_WALLS,
} from '../WallLayerReview/wallLayerReviewFixture';
import { QcFloorDoneSummary } from './QcFloorDone';

const meta: Meta<typeof QcFloorDoneSummary> = {
  title: 'QC / L23 / QcFloorDoneSummary',
  component: QcFloorDoneSummary,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="flex flex-col bg-bg-surface" style={{ width: 340, height: 480 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

const FLOOR_ID = WALL_LAYER_FIXTURE_LEVEL.id;

/** Tường của bộ mẫu lớp tường + phòng của bộ mẫu lớp phòng, chung một tầng. */
const GRAPH = normalizeSpatial({
  building: WALL_LAYER_FIXTURE_BUILDING,
  levels: [WALL_LAYER_FIXTURE_LEVEL],
  walls: [...WALL_LAYER_FIXTURE_WALLS],
  openings: [],
  furniture: [],
  rooms: ROOM_LABEL_FIXTURE_ROOMS.map((room) => ({ ...room, levelId: FLOOR_ID })),
  axes: [],
  dimensions: [],
  notes: [],
});

export const Default: StoryObj<typeof QcFloorDoneSummary> = {
  name: 'Tổng kết tầng',
  render: () => <QcFloorDoneSummary floorId={FLOOR_ID} graph={GRAPH} />,
};
