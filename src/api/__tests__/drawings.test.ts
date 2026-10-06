import { describe, expect, it, vi } from 'vitest';

import type { HttpClient, HttpError, Result } from '@/lib/http';

import { createApiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import { LatestFloorUploadPageSchema } from '../schemas/uploads';
import { createMockApiClient } from '../__mocks__/client';

const ok = <T>(data: T): Result<T, HttpError> => ({ ok: true, data });

const FIRST = 'upl_01J8Z3K4Q5R6S7T8V9W0XYZAB1';
const SECOND = 'upl_01J8Z3K4Q5R6S7T8V9W0XYZAB2';

/** Chỉ `get` được gọi; đường nào không khai thì trả trang rỗng. */
const httpWith = (responses: Record<string, unknown>): HttpClient =>
  ({
    get: vi.fn((path: string) => ok(responses[path] ?? { items: [] })),
  }) as unknown as HttpClient;

describe('drawings.latestUploads (N7)', () => {
  it('reads the N7 path, follows the cursor and decodes every item', async () => {
    const http = httpWith({
      [ENDPOINTS.drawings.latestUploads('project-1')]: {
        items: [
          {
            floorId: 'L1',
            floorName: 'Tầng 1',
            sourceImageUrl: 'https://example.com/l1.png',
            uploadId: FIRST,
          },
        ],
        nextCursor: 'c 2',
      },
      [ENDPOINTS.drawings.latestUploads('project-1', 'c 2')]: {
        items: [{ floorId: 'L2', floorName: 'Tầng 2', uploadId: SECOND }],
      },
    });

    const result = await createApiClient(http).drawings.latestUploads({ projectId: 'project-1' });

    expect(vi.mocked(http.get).mock.calls.map(([path]) => path)).toEqual([
      '/projects/project-1/drawings/uploads/latest',
      '/projects/project-1/drawings/uploads/latest?cursor=c%202',
    ]);
    expect(result).toEqual({
      ok: true,
      data: [
        { floorId: 'L1', floorName: 'Tầng 1', sourceImageUrl: 'https://example.com/l1.png', uploadId: FIRST },
        { floorId: 'L2', floorName: 'Tầng 2', uploadId: SECOND },
      ],
    });
  });

  it('mock N7 answers a page that passes LatestFloorUploadPageSchema', async () => {
    const result = await createMockApiClient().drawings.latestUploads({ projectId: 'project-1' });

    expect(result.ok).toBe(true);
    expect(LatestFloorUploadPageSchema.safeParse({ items: result.ok ? result.data : [] }).success).toBe(true);
  });

  it('mock N7 stays on schema after a new upload starts', async () => {
    const client = createMockApiClient();
    await client.drawings.initUpload({
      body: { fileName: 'l2.png', floorId: 'L2', mimeType: 'image/png', projectId: 'project-1', sizeBytes: 10 },
    });
    const result = await client.drawings.latestUploads({ projectId: 'project-1' });

    expect(result.ok && result.data.map((upload) => upload.floorId)).toContain('L2');
    expect(LatestFloorUploadPageSchema.safeParse({ items: result.ok ? result.data : [] }).success).toBe(true);
  });
});
