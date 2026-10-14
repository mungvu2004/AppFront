/** Phase 09 - BE role matrix, admin positive control, real API (GET only). Flows: flows-C6.md FL-B09-10. */
import { expect, test } from '@playwright/test';

import { FAKE_ID, expectOpen } from './support/p09/P13';
import { adminApi } from './support/p09/roles';

test('API · FL-B09-10 · admin · ma trận quyền BE', async () => {
  test.setTimeout(120_000);
  const api = await adminApi();
  const meRes = await api.get('/api/me');
  expect(meRes.status(), 'setup: GET /api/me').toBe(200);
  const me = (await meRes.json()) as { id: string };
  await test.step('[B09-mld-004] ml_list_datasets', async () => {
    await expectOpen(api, `/api/admin/ml/datasets`, 'B09-mld-004_ml_list_datasets', { statuses: [200], soft: false });
  });
  await test.step('[B09-mld-011] ml_list_dataset_versions', async () => {
    await expectOpen(api, `/api/admin/ml/datasets/${FAKE_ID}/versions`, 'B09-mld-011_ml_list_dataset_versions', { statuses: [200, 404] });
  });
  await test.step('[B09-mlj-004] ml_list_jobs', async () => {
    await expectOpen(api, `/api/admin/ml/training-jobs`, 'B09-mlj-004_ml_list_jobs', { statuses: [200] });
  });
  await test.step('[B09-mlj-011] ml_read_job', async () => {
    await expectOpen(api, `/api/admin/ml/training-jobs/${FAKE_ID}`, 'B09-mlj-011_ml_read_job', { statuses: [200, 404] });
  });
  await test.step('[B09-mlj-018] ml_list_job_metrics', async () => {
    await expectOpen(api, `/api/admin/ml/training-jobs/${FAKE_ID}/metrics`, 'B09-mlj-018_ml_list_job_metrics', { statuses: [200, 404] });
  });
  await test.step('[B09-mlj-022] ml_list_job_logs', async () => {
    await expectOpen(api, `/api/admin/ml/training-jobs/${FAKE_ID}/logs`, 'B09-mlj-022_ml_list_job_logs', { statuses: [200, 404] });
  });
  await test.step('[B09-mlr-004] ml_list_families', async () => {
    await expectOpen(api, `/api/admin/ml/model-families`, 'B09-mlr-004_ml_list_families', { statuses: [200] });
  });
  await test.step('[B09-mlr-011] ml_list_versions', async () => {
    await expectOpen(api, `/api/admin/ml/model-versions`, 'B09-mlr-011_ml_list_versions', { statuses: [200] });
  });
  await test.step('[B09-mlr-018] ml_read_version', async () => {
    await expectOpen(api, `/api/admin/ml/model-versions/${FAKE_ID}`, 'B09-mlr-018_ml_read_version', { statuses: [200, 404] });
  });
  await test.step('[B09-usr-004] users_list_users', async () => {
    await expectOpen(api, `/api/users`, 'B09-usr-004_users_list_users', { statuses: [200] });
  });
  await test.step('[B09-usr-014] users_list_memberships', async () => {
    await expectOpen(api, `/api/users/${me.id}/memberships`, 'B09-usr-014_users_list_memberships', { statuses: [200] });
  });
  await test.step('[B09-usr-018] users_list_activity', async () => {
    await expectOpen(api, `/api/users/${me.id}/activity`, 'B09-usr-018_users_list_activity', { statuses: [200] });
  });
});
