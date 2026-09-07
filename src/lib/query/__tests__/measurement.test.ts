import { describe, expect, it } from 'vitest';

import { resolveCachePolicyTier } from '../cachePolicy';
import { invalidationMap } from '../invalidation';
import { measurementKeys } from '../queryKeys';

describe('measurementKeys', () => {
  const projectId = 'project-77';

  it('returns equal key values for equal parameters (stable across two calls)', () => {
    expect(measurementKeys.all(projectId)).toEqual(measurementKeys.all(projectId));
  });

  it('scopes different projects to different keys', () => {
    expect(measurementKeys.all('project-1')).not.toEqual(measurementKeys.all('project-2'));
  });

  it('freezes the key and keeps the branch root as a prefix, for invalidation by prefix', () => {
    const key = measurementKeys.all(projectId);
    const root = measurementKeys.all.root();

    expect(Object.isFrozen(key)).toBe(true);
    expect(Object.isFrozen(root)).toBe(true);
    expect(key.slice(0, root.length)).toEqual(root);
  });
});

describe('measurement cache policy', () => {
  it('falls back to the default tier — no override in TIER_BY_DOMAIN, same as most domains', () => {
    expect(resolveCachePolicyTier(measurementKeys.all('project-1'))).toBe('default');
  });
});

describe('measurement invalidation', () => {
  const projectId = 'project-9';

  it('saveMeasurement invalidates exactly the measurement list for that project', () => {
    expect(invalidationMap.saveMeasurement({ projectId })).toEqual([measurementKeys.all(projectId)]);
  });

  it('deleteMeasurement invalidates the same key as saveMeasurement', () => {
    expect(invalidationMap.deleteMeasurement({ projectId })).toEqual(invalidationMap.saveMeasurement({ projectId }));
  });
});
