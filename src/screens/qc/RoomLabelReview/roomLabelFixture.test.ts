import { describe, expect, it } from 'vitest';

import { RoomSchema } from '@/api/schemas/spatial';

import { ROOM_LABEL_FIXTURE_ROOMS, ROOM_LABEL_FIXTURE_ROOMS_UNNAMED, ROOM_LABEL_FIXTURE_UNNAMED_COUNT } from './roomLabelFixture';

describe('RoomLabel fixture', () => {
  it('every default sample room passes the real room schema (no empty name, BE Room.name >= 1)', () => {
    const rejected = ROOM_LABEL_FIXTURE_ROOMS.filter((room) => !RoomSchema.safeParse(room).success).map((room) => room.id);

    expect(rejected).toEqual([]);
  });

  it('the local unnamed variant is exactly what the schema rejects, so the save path blocks it before any PUT', () => {
    const rejected = ROOM_LABEL_FIXTURE_ROOMS_UNNAMED.filter((room) => !RoomSchema.safeParse(room).success);

    expect(rejected).toHaveLength(ROOM_LABEL_FIXTURE_UNNAMED_COUNT);
    expect(rejected.every((room) => room.name === '')).toBe(true);
  });
});
