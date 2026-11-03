/** @vitest-environment node */
import { describe, expect, it } from 'vitest';

import { LOAD_CAP_MS, LOAD_QUIET_MS, loadDone } from './loadOverlay';

const idle = { builds: 5, buildsDone: 5, started: 3, done: 3, lastActivityAt: 1000 };

describe('loadDone', () => {
  it('gỡ khi có bản dựng mới, hết việc chờ và yên LOAD_QUIET_MS', () => {
    expect(loadDone(idle, 2, 0, 0, 0, 1000 + LOAD_QUIET_MS)).toBe(true);
    expect(loadDone(idle, 2, 0, 0, 0, 1000 + LOAD_QUIET_MS - 1)).toBe(false);
  });
  it('còn pipeline / bản dựng / ảnh / tệp đang tải → chưa gỡ; chưa có bản dựng mới → chưa gỡ', () => {
    const t = 1000 + LOAD_QUIET_MS;
    expect(loadDone({ ...idle, done: 2 }, 2, 0, 0, 0, t)).toBe(false);
    expect(loadDone({ ...idle, buildsDone: 4 }, 2, 0, 0, 0, t)).toBe(false);
    expect(loadDone({ ...idle, texWaiting: 1 }, 2, 0, 0, 0, t)).toBe(false);
    expect(loadDone(idle, 2, 1, 0, 0, t)).toBe(false);
    expect(loadDone(idle, 2, 0, t, 0, t)).toBe(false); // tệp vừa tải xong: chưa yên
    expect(loadDone(idle, 5, 0, 0, 0, t)).toBe(false);
  });
  it('quá LOAD_CAP_MS thì gỡ dù còn việc', () => {
    expect(loadDone({ ...idle, done: 0 }, 5, 3, 0, 0, LOAD_CAP_MS)).toBe(true);
  });
});
