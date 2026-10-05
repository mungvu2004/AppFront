import { beforeEach, describe, expect, it } from 'vitest';

import type { HttpError } from '@/lib/http';
import { sampleLevelId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { VersionConflictBodySchema } from '../schemas/errors';
import { __resetMockLayerState, createMockApiClient, simulateRemoteLayerEdit } from '../__mocks__/client';

const PROJECT_ID = 'p-1';
const FLOOR_ID = sampleLevelId(0);
const EMPTY = { furniture: [], openings: [], rooms: [], walls: [] };

type Client = ReturnType<typeof createMockApiClient>;

const write = (client: Client, baseVersion: number, body: Awaited<ReturnType<typeof read>> = EMPTY) =>
  client.spatial.writeLayer({ baseVersion, body, floorId: FLOOR_ID, projectId: PROJECT_ID });

const read = async (client: Client) => {
  const result = await client.spatial.readLayer({ floorId: FLOOR_ID, projectId: PROJECT_ID });

  if (!result.ok) {
    throw new Error('read failed');
  }

  return result.data.layer;
};

const failure = (result: Awaited<ReturnType<Client['spatial']['writeLayer']>>): HttpError => {
  if (result.ok) {
    throw new Error('expected a failure');
  }

  return result.error as HttpError;
};

beforeEach(() => {
  __resetMockLayerState();
});

describe('mock layer state', () => {
  it('is shared by two clients', async () => {
    const first = createMockApiClient();
    const second = createMockApiClient();

    const saved = await write(first, 0);

    expect(saved.ok && saved.data.revision).toBe(1);

    const doc = await second.spatial.readLayer({ floorId: FLOOR_ID, projectId: PROJECT_ID });

    expect(doc.ok && doc.data.revision).toBe(1);
  });

  it('answers a stale base with a real HttpError whose 409 body fits the schema', async () => {
    const client = createMockApiClient();

    const seed = await read(client);

    await write(client, 0);

    const error = failure(await write(client, 0, seed));

    expect(error.kind).toBe('http');
    expect(error.status).toBe(409);
    expect(error.code).toBe('VERSION_CONFLICT');
    expect(VersionConflictBodySchema.safeParse(error.raw).success).toBe(true);
  });

  it('answers a base above the revision with 422 on baseVersion', async () => {
    const error = failure(await write(createMockApiClient(), 5));

    expect(error.status).toBe(422);
    expect(error.code).toBe('VALIDATION');
    expect(error.raw).toMatchObject({ field: 'baseVersion' });
  });

  it('answers an identical resend of the last write with 200 and the current revision (C09b)', async () => {
    const client = createMockApiClient();
    const seed = await read(client);
    const first = await write(client, 0);
    const again = await write(client, 0);

    expect(first.ok && again.ok && again.data.revision).toBe(1);

    const other = await write(client, 0, seed);

    expect(failure(other).status).toBe(409);
  });

  it('simulateRemoteLayerEdit bumps the revision and removes one wall', async () => {
    const client = createMockApiClient();
    const before = await read(client);

    simulateRemoteLayerEdit(FLOOR_ID);

    const after = await client.spatial.readLayer({ floorId: FLOOR_ID, projectId: PROJECT_ID });

    expect(before.walls.length).toBeGreaterThan(0);
    expect(after.ok && after.data.revision).toBe(1);
    expect(after.ok && after.data.layer.walls).toHaveLength(before.walls.length - 1);
    expect(failure(await write(client, 0)).status).toBe(409);
  });
});
