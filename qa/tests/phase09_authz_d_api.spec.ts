/** Phase 09 - BE role matrix, non-member (engineer) on a project they do not belong to. Flows: flows-C6.md FL-B09-11. */
import { test } from '@playwright/test';

import { FAKE_ID, expectDenied } from './support/p09/P13';
import { adminApi, apiAs, roleUser } from './support/p09/roles';
import { createProject, deleteSeededProject } from './support/phase03Seed';

test('API · FL-B09-11 · không-thành-viên (engineer) · ma trận quyền BE', async () => {
  const admin = await adminApi();
  const seeded = await createProject(admin, 'p09-authz-out', 1);
  try {
    const outsider = await roleUser(admin, 'engineer', 'authz-outsider'); // NOT added as member
    const api = await apiAs(outsider);
    await test.step('[B09-str-002] streams_open_progress', async () => {
      // projects/access.py:91 -> 404 NOT_FOUND resource project (not 403; K08)
      await expectDenied(api, 'GET', `/api/projects/${seeded.projectId}/uploads/${FAKE_ID}/progress`, { status: 404, code: 'NOT_FOUND', resource: 'project', soft: false, ev: 'B09-str-002_streams_open_progress' });
    });
  } finally {
    await deleteSeededProject(admin, seeded.projectId);
  }
});
