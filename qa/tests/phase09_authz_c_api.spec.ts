/** Phase 09 - BE role matrix, admin positive control, real API (GET only). Flows: flows-C6.md FL-B09-10. */
import { expect, test } from '@playwright/test';

import { expectOpen, firstId } from './support/p09/P13';
import { adminApi } from './support/p09/roles';

test('API · FL-B09-10 · admin · ma trận quyền BE', async () => {
  test.setTimeout(120_000);
  const api = await adminApi();
  const meRes = await api.get('/api/me');
  expect(meRes.status(), 'setup: GET /api/me').toBe(200);
  const me = (await meRes.json()) as { id: string };
  const dataset = await firstId(api, '/api/admin/ml/datasets');
  const job = await firstId(api, '/api/admin/ml/training-jobs');
  const modelVersion = await firstId(api, '/api/admin/ml/model-versions');
  test.info().annotations.push({ type: 'empty-lists', description: JSON.stringify({ dataset, job, modelVersion }) }); // empty list -> detail steps only re-assert the list is 200
  await test.step('[B09-mld-004] ml_list_datasets', async () => {
    await expectOpen(api, `/api/admin/ml/datasets`, 'B09-mld-004_ml_list_datasets', { statuses: [200], soft: false });
  });
  await test.step('[B09-mld-011] ml_list_dataset_versions', async () => {
    await expectOpen(api, dataset ? `/api/admin/ml/datasets/${dataset}/versions` : `/api/admin/ml/datasets`, 'B09-mld-011_ml_list_dataset_versions');
  });
  await test.step('[B09-mlj-004] ml_list_jobs', async () => {
    await expectOpen(api, `/api/admin/ml/training-jobs`, 'B09-mlj-004_ml_list_jobs', { statuses: [200] });
  });
  await test.step('[B09-mlj-011] ml_read_job', async () => {
    await expectOpen(api, job ? `/api/admin/ml/training-jobs/${job}` : `/api/admin/ml/training-jobs`, 'B09-mlj-011_ml_read_job');
  });
  await test.step('[B09-mlj-018] ml_list_job_metrics', async () => {
    await expectOpen(api, job ? `/api/admin/ml/training-jobs/${job}/metrics` : `/api/admin/ml/training-jobs`, 'B09-mlj-018_ml_list_job_metrics');
  });
  await test.step('[B09-mlj-022] ml_list_job_logs', async () => {
    await expectOpen(api, job ? `/api/admin/ml/training-jobs/${job}/logs` : `/api/admin/ml/training-jobs`, 'B09-mlj-022_ml_list_job_logs');
  });
  await test.step('[B09-mlr-004] ml_list_families', async () => {
    await expectOpen(api, `/api/admin/ml/model-families`, 'B09-mlr-004_ml_list_families', { statuses: [200] });
  });
  await test.step('[B09-mlr-011] ml_list_versions', async () => {
    await expectOpen(api, `/api/admin/ml/model-versions`, 'B09-mlr-011_ml_list_versions', { statuses: [200] });
  });
  await test.step('[B09-mlr-018] ml_read_version', async () => {
    await expectOpen(api, modelVersion ? `/api/admin/ml/model-versions/${modelVersion}` : `/api/admin/ml/model-versions`, 'B09-mlr-018_ml_read_version');
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
