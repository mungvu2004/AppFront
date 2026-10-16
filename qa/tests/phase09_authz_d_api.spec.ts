/** Phase 09 - BE role matrix, non-member (engineer) on a project they do not belong to. Flows: flows-C6.md FL-B09-11. */
import { expect, test } from '@playwright/test';

import { FAKE_UPLOAD_ID, probeStream } from './support/p09/P13';
import { adminApi, apiAs, roleUser } from './support/p09/roles';
import { createProject, deleteSeededProject } from './support/phase03Seed';

test('API · FL-B09-11 · không-thành-viên (engineer) · ma trận quyền BE', async () => {
  const admin = await adminApi();
  const seeded = await createProject(admin, 'p09-authz-out', 1);
  try {
    const outsider = await roleUser(admin, 'engineer', 'authz-d'); // NOT added as member
    const api = await apiAs(outsider);
    await test.step('[B09-str-002] streams_open_progress', async () => {
      // oracle: drawings/stream_providers.py:44-51 -> 404 NOT_FOUND resource upload (outsider cannot tell 'no access' from 'missing'; not 403)
      const probe = await probeStream(api, `/api/streams/projects/${seeded.projectId}/uploads/${FAKE_UPLOAD_ID}/progress`); // streams/router.py:129-135
      expect(probe.status).toBe(404);
      expect(probe.code).toBe('NOT_FOUND');
      expect(probe.resource).toBe('upload'); // AppBack apps/api/drawings/stream_providers.py:44-51 (CASE.md S06)
    });
  } finally {
    await deleteSeededProject(admin, seeded.projectId);
  }
});
