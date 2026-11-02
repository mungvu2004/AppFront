import { describe, expect, it } from 'vitest';

import { DesignConceptSchema, DesignConceptStateSchema } from '../designConcept';

const done = {
  id: 'dcn_01',
  styleId: 'japandi',
  suggested: true,
  status: 'done',
  createdAt: '2026-11-02T01:00:00.000Z',
  startedAt: '2026-11-02T01:00:01.000Z',
  endedAt: '2026-11-02T01:01:00.000Z',
  result: {
    nameVi: 'Japandi',
    summaryVi: 'Gỗ sáng.',
    baseStyle: 'toi-gian',
    wall: { interior: 'library:paint-cream' },
    floor: { wood: 'library:wood-oak' },
    models: { sofa: 'srv-sofa' },
    additions: [
      {
        levelId: 'L-1',
        roomId: 'R-1',
        kind: 'other',
        variant: 'plant',
        centre: { x: 100, y: 200 },
        widthMm: 300,
        depthMm: 300,
        rotationDeg: 90,
      },
    ],
  },
};

describe('DesignConcept (N47/N48)', () => {
  it('nhận concept xong, trường tuỳ chọn vắng', () => {
    expect(DesignConceptSchema.parse(done).result?.additions[0]?.modelId).toBeUndefined();
    expect(
      DesignConceptSchema.parse({ id: 'dcn_02', suggested: true, status: 'queued', createdAt: done.createdAt }).styleId,
    ).toBeUndefined();
  });

  it('W2: null bị từ chối, trường lạ bị từ chối', () => {
    expect(DesignConceptSchema.safeParse({ ...done, failureCode: null }).success).toBe(false);
    expect(DesignConceptSchema.safeParse({ ...done, extra: 1 }).success).toBe(false);
  });

  it('trường đi theo trạng thái: done phải có result + endedAt; failed phải có failureCode', () => {
    expect(DesignConceptSchema.safeParse({ ...done, result: undefined }).success).toBe(false);
    expect(DesignConceptSchema.safeParse({ ...done, status: 'failed', result: undefined }).success).toBe(false);
    expect(
      DesignConceptSchema.safeParse({ ...done, status: 'failed', result: undefined, failureCode: 'X' }).success,
    ).toBe(true);
  });

  it('state: active và suggestedStyleId vắng được', () => {
    expect(DesignConceptStateSchema.parse({ enabled: false })).toEqual({ enabled: false });
    expect(DesignConceptStateSchema.parse({ enabled: true, suggestedStyleId: 'rustic', active: done }).active?.id).toBe(
      'dcn_01',
    );
    expect(DesignConceptStateSchema.safeParse({ enabled: true, active: null }).success).toBe(false);
  });
});
