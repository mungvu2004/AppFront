import { describe, expect, it, vi } from 'vitest';

import { classifyResolution, classifySkew } from '@/domain/quality';
import type { HttpClient, HttpError, Result } from '@/lib/http';
import { createApiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import { ImageQualityAssessmentSchema } from '../schemas';
import { createMockApiClient } from '../__mocks__/client';

const ok = <T>(data: T): Result<T, HttpError> => ({ ok: true, data });

const createHttpMock = (responses: Record<string, unknown> = {}): HttpClient => {
  const get = vi.fn((path: string) => ok(responses[`GET ${path}`] as never)) as unknown as HttpClient['get'];
  const post = vi.fn((path: string) => ok(responses[`POST ${path}`] as never)) as unknown as HttpClient['post'];
  const patch = vi.fn((path: string) => ok(responses[`PATCH ${path}`] as never)) as unknown as HttpClient['patch'];
  const del = vi.fn((path: string) => ok(responses[`DELETE ${path}`] as never)) as unknown as HttpClient['delete'];
  const put = vi.fn((path: string) => ok(responses[`PUT ${path}`] as never)) as unknown as HttpClient['put'];

  return {
    delete: del,
    events: {
      emit: () => undefined,
      on: () => () => undefined,
    },
    get,
    getRecentRequests: () => [],
    patch,
    post,
    put,
  };
};

const projectId = 'project-1';
const floorId = 'L1';

const sampleAssessment = {
  floorId,
  floors: [
    {
      expectedConfidence: 0.82,
      findings: [
        {
          code: 'FRAME_NOT_FOUND',
          id: 'finding-frame',
          region: { heightRatio: 0.96, widthRatio: 0.96, xRatio: 0.02, yRatio: 0.02 },
          severity: 'attention',
        },
      ],
      floorId,
      floorName: 'Tầng 1',
      frame: { isFound: false },
      isMeasured: true,
      measurement: {
        contrastScore: 0.81,
        heightPx: 900,
        noiseScore: 0.14,
        skewDeg: 3.4,
        widthPx: 1240,
      },
      sourceUrl: 'https://example.com/quality/L1.png',
    },
    {
      findings: [],
      floorId: 'L2',
      floorName: 'Tầng 2',
      isMeasured: false,
      sourceUrl: 'https://example.com/quality/L2.png',
    },
  ],
  projectId,
};

describe('ImageQualityAssessmentSchema', () => {
  it('decodes a reading that carries one measured and one unmeasured floor', () => {
    const parsed = ImageQualityAssessmentSchema.safeParse(sampleAssessment);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.floors).toHaveLength(2);
      expect(parsed.data.floors[0]?.measurement?.widthPx).toBe(1240);
      expect(parsed.data.floors[1]?.isMeasured).toBe(false);
      expect(parsed.data.floors[1]?.measurement).toBeUndefined();
    }
  });

  it('rejects a finding with no region, so no detection floats free of the image', () => {
    const [measuredFloor] = sampleAssessment.floors;
    const withoutRegion = {
      ...sampleAssessment,
      floors: [
        {
          ...measuredFloor,
          findings: [{ code: 'FRAME_NOT_FOUND', id: 'finding-frame', severity: 'attention' }],
        },
      ],
    };

    expect(ImageQualityAssessmentSchema.safeParse(withoutRegion).success).toBe(false);
  });

  it('rejects a region coordinate outside the 0..1 ratio range', () => {
    const [measuredFloor] = sampleAssessment.floors;
    const pixelCoordinates = {
      ...sampleAssessment,
      floors: [
        {
          ...measuredFloor,
          findings: [
            {
              code: 'FRAME_NOT_FOUND',
              id: 'finding-frame',
              region: { heightRatio: 0.5, widthRatio: 0.5, xRatio: 620, yRatio: 450 },
              severity: 'attention',
            },
          ],
        },
      ],
    };

    expect(ImageQualityAssessmentSchema.safeParse(pixelCoordinates).success).toBe(false);
  });

  it('rejects a drawing frame that reports three corners instead of four', () => {
    const [measuredFloor] = sampleAssessment.floors;
    const threeCorners = {
      ...sampleAssessment,
      floors: [
        {
          ...measuredFloor,
          frame: {
            corners: [
              { xRatio: 0.04, yRatio: 0.05 },
              { xRatio: 0.96, yRatio: 0.05 },
              { xRatio: 0.96, yRatio: 0.95 },
            ],
            isFound: true,
          },
        },
      ],
    };

    expect(ImageQualityAssessmentSchema.safeParse(threeCorners).success).toBe(false);
  });

  it('rejects a severity outside the three levels the domain knows', () => {
    const [measuredFloor] = sampleAssessment.floors;
    const fourthLevel = {
      ...sampleAssessment,
      floors: [
        {
          ...measuredFloor,
          findings: [
            {
              code: 'FRAME_NOT_FOUND',
              id: 'finding-frame',
              region: { heightRatio: 0.96, widthRatio: 0.96, xRatio: 0.02, yRatio: 0.02 },
              severity: 'verified',
            },
          ],
        },
      ],
    };

    expect(ImageQualityAssessmentSchema.safeParse(fourthLevel).success).toBe(false);
  });

  it('rejects a reading with no floors at all', () => {
    expect(ImageQualityAssessmentSchema.safeParse({ ...sampleAssessment, floors: [] }).success).toBe(false);
  });
});

describe('quality api', () => {
  it('reads a floor assessment through the centralized endpoint map', async () => {
    const http = createHttpMock({
      [`GET ${ENDPOINTS.quality.assess(projectId, floorId)}`]: sampleAssessment,
    });
    const client = createApiClient(http);

    const result = await client.quality.assess({ floorId, projectId });

    expect(http.get).toHaveBeenCalledWith(ENDPOINTS.quality.assess(projectId, floorId), undefined);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.floorId).toBe(floorId);
    }
  });

  it('passes Idempotency-Key to both quality writes', async () => {
    const http = createHttpMock({
      [`POST ${ENDPOINTS.quality.straighten(projectId, floorId)}`]: sampleAssessment,
      [`POST ${ENDPOINTS.quality.corners(projectId, floorId)}`]: sampleAssessment,
    });
    const client = createApiClient(http);

    await client.quality.straighten({ floorId, idempotencyKey: 'key-straighten', projectId });
    await client.quality.setCorners({
      body: {
        corners: [
          { xRatio: 0.04, yRatio: 0.05 },
          { xRatio: 0.96, yRatio: 0.05 },
          { xRatio: 0.96, yRatio: 0.95 },
          { xRatio: 0.04, yRatio: 0.95 },
        ],
      },
      floorId,
      idempotencyKey: 'key-corners',
      projectId,
    });

    expect(http.post).toHaveBeenCalledWith(
      ENDPOINTS.quality.straighten(projectId, floorId),
      expect.objectContaining({ idempotencyKey: 'key-straighten' }),
    );
    expect(http.post).toHaveBeenCalledWith(
      ENDPOINTS.quality.corners(projectId, floorId),
      expect.objectContaining({ idempotencyKey: 'key-corners' }),
    );
  });

  it('surfaces a contract violation rather than a half-decoded reading', async () => {
    const http = createHttpMock({
      [`GET ${ENDPOINTS.quality.assess(projectId, floorId)}`]: { floors: 'not a list' },
    });
    const client = createApiClient(http);

    const result = await client.quality.assess({ floorId, projectId });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CONTRACT_VALIDATION');
    }
  });
});

describe('mock quality data', () => {
  it('serves four floors, two of them measured, so the partial state has something to count', async () => {
    const client = createMockApiClient();

    const result = await client.quality.assess({ floorId, projectId });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.floors).toHaveLength(4);
      expect(result.data.floors.filter((floor) => floor.isMeasured)).toHaveLength(2);
    }
  });

  it('matches the three findings the spec names on the floor being viewed', async () => {
    const client = createMockApiClient();

    const result = await client.quality.assess({ floorId, projectId });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const active = result.data.floors.find((floor) => floor.floorId === floorId);

    expect(active?.expectedConfidence).toBe(0.82);
    expect(active?.measurement).toMatchObject({ heightPx: 900, skewDeg: 3.4, widthPx: 1240 });
    expect(active?.frame?.isFound).toBe(false);
    expect(active?.findings.map((finding) => finding.code)).toEqual([
      'RESOLUTION_TOO_LOW',
      'SKEW_DETECTED',
      'FRAME_NOT_FOUND',
    ]);
  });

  it('anchors every finding to a region inside the image', async () => {
    const client = createMockApiClient();

    const result = await client.quality.assess({ floorId, projectId });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    for (const floor of result.data.floors) {
      for (const finding of floor.findings) {
        expect(finding.region.xRatio).toBeGreaterThanOrEqual(0);
        expect(finding.region.yRatio).toBeGreaterThanOrEqual(0);
        expect(finding.region.widthRatio).toBeLessThanOrEqual(1);
        expect(finding.region.heightRatio).toBeLessThanOrEqual(1);
      }
    }
  });

  it('serves the sample data the domain thresholds grade as poor and attention', async () => {
    const client = createMockApiClient();

    const result = await client.quality.assess({ floorId, projectId });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const active = result.data.floors.find((floor) => floor.floorId === floorId);
    const measurement = active?.measurement;

    expect(measurement).toBeDefined();
    if (measurement === undefined) {
      return;
    }

    expect(classifyResolution(Math.min(measurement.widthPx, measurement.heightPx))).toBe('poor');
    expect(classifySkew(measurement.skewDeg)).toBe('attention');
  });

  it('serves one passing floor at 3.200 x 2.400 px and 0,2 degrees of skew', async () => {
    const client = createMockApiClient();

    const result = await client.quality.assess({ floorId: 'L2', projectId });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const passing = result.data.floors.find((floor) => floor.floorId === 'L2');

    expect(passing?.measurement).toMatchObject({ heightPx: 2400, skewDeg: 0.2, widthPx: 3200 });
    expect(passing?.findings).toEqual([]);
    expect(passing?.frame?.isFound).toBe(true);
  });

  it('drops the skew finding once the drawing has been straightened', async () => {
    const client = createMockApiClient();

    const straightened = await client.quality.straighten({ floorId, projectId });

    expect(straightened.ok).toBe(true);
    if (!straightened.ok) {
      return;
    }

    const active = straightened.data.floors.find((floor) => floor.floorId === floorId);

    expect(active?.findings.map((finding) => finding.code)).not.toContain('SKEW_DETECTED');
    expect(classifySkew(active?.measurement?.skewDeg ?? 0)).toBe('good');
  });

  it('drops the missing-frame finding once four corners are set by hand', async () => {
    const client = createMockApiClient();

    const cropped = await client.quality.setCorners({
      body: {
        corners: [
          { xRatio: 0.04, yRatio: 0.05 },
          { xRatio: 0.96, yRatio: 0.05 },
          { xRatio: 0.96, yRatio: 0.95 },
          { xRatio: 0.04, yRatio: 0.95 },
        ],
      },
      floorId,
      projectId,
    });

    expect(cropped.ok).toBe(true);
    if (!cropped.ok) {
      return;
    }

    const active = cropped.data.floors.find((floor) => floor.floorId === floorId);

    expect(active?.frame?.isFound).toBe(true);
    expect(active?.frame?.corners).toHaveLength(4);
    expect(active?.findings.map((finding) => finding.code)).not.toContain('FRAME_NOT_FOUND');
  });

  it('answers for a floor it has never heard of without throwing', async () => {
    const client = createMockApiClient();

    const straightened = await client.quality.straighten({ floorId: 'floor-unknown', projectId });

    expect(straightened.ok).toBe(true);
    if (straightened.ok) {
      const added = straightened.data.floors.find((floor) => floor.floorId === 'floor-unknown');

      expect(added?.findings).toEqual([]);
    }
  });
});
