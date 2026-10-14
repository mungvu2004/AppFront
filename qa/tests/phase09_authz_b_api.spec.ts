/** Phase 09 - BE role matrix, viewer (own project, member) through the real API, no browser. Flows: flows-C6.md FL-B09-06..09.
 * Codes: BE access/deps.py:41-43 gate -> 403 FORBIDDEN; projects/access.py:99 -> 403 FORBIDDEN (member lacking permission). */
import { expect, test } from '@playwright/test';

import { FAKE_ID, expectDenied, expectOpen, seedViewerProject } from './support/p09/P13';
import { createProject, deleteSeededProject } from './support/phase03Seed';

test('API · FL-B09-06 · viewer · ma trận quyền BE', async () => {
  test.setTimeout(120_000);
  const s = await seedViewerProject();
  const api = s.viewerApi;
  try {
    await test.step('[B09-mld-002] ml_list_datasets', async () => {
      await expectDenied(api, 'GET', `/api/admin/ml/datasets`, { status: 403, code: 'FORBIDDEN', ev: 'B09-mld-002_ml_list_datasets', soft: false });
    });
    await test.step('[B09-mld-006] ml_create_dataset', async () => {
      await expectDenied(api, 'POST', `/api/admin/ml/datasets`, { status: 403, code: 'FORBIDDEN', ev: 'B09-mld-006_ml_create_dataset' });
    });
    await test.step('[B09-mld-009] ml_list_dataset_versions', async () => {
      await expectDenied(api, 'GET', `/api/admin/ml/datasets/${FAKE_ID}/versions`, { status: 403, code: 'FORBIDDEN', ev: 'B09-mld-009_ml_list_dataset_versions' });
    });
    await test.step('[B09-mld-013] ml_build_dataset_version', async () => {
      await expectDenied(api, 'POST', `/api/admin/ml/datasets/${FAKE_ID}/versions`, { status: 403, code: 'FORBIDDEN', ev: 'B09-mld-013_ml_build_dataset_version' });
    });
    await test.step('[B09-mlj-002] ml_list_jobs', async () => {
      await expectDenied(api, 'GET', `/api/admin/ml/training-jobs`, { status: 403, code: 'FORBIDDEN', ev: 'B09-mlj-002_ml_list_jobs' });
    });
    await test.step('[B09-mlj-006] ml_create_job', async () => {
      await expectDenied(api, 'POST', `/api/admin/ml/training-jobs`, { status: 403, code: 'FORBIDDEN', ev: 'B09-mlj-006_ml_create_job' });
    });
    await test.step('[B09-mlj-009] ml_read_job', async () => {
      await expectDenied(api, 'GET', `/api/admin/ml/training-jobs/${FAKE_ID}`, { status: 403, code: 'FORBIDDEN', ev: 'B09-mlj-009_ml_read_job' });
    });
    await test.step('[B09-mlj-013] ml_cancel_job', async () => {
      await expectDenied(api, 'POST', `/api/admin/ml/training-jobs/${FAKE_ID}/cancel`, { status: 403, code: 'FORBIDDEN', ev: 'B09-mlj-013_ml_cancel_job' });
    });
    await test.step('[B09-mlj-016] ml_list_job_metrics', async () => {
      await expectDenied(api, 'GET', `/api/admin/ml/training-jobs/${FAKE_ID}/metrics`, { status: 403, code: 'FORBIDDEN', ev: 'B09-mlj-016_ml_list_job_metrics' });
    });
    await test.step('[B09-mlj-020] ml_list_job_logs', async () => {
      await expectDenied(api, 'GET', `/api/admin/ml/training-jobs/${FAKE_ID}/logs`, { status: 403, code: 'FORBIDDEN', ev: 'B09-mlj-020_ml_list_job_logs' });
    });
    await test.step('[B09-mlr-002] ml_list_families', async () => {
      await expectDenied(api, 'GET', `/api/admin/ml/model-families`, { status: 403, code: 'FORBIDDEN', ev: 'B09-mlr-002_ml_list_families' });
    });
    await test.step('[B09-mlr-006] ml_activate_version', async () => {
      await expectDenied(api, 'PUT', `/api/admin/ml/model-families/${FAKE_ID}/active`, { status: 403, code: 'FORBIDDEN', ev: 'B09-mlr-006_ml_activate_version' });
    });
    await test.step('[B09-mlr-009] ml_list_versions', async () => {
      await expectDenied(api, 'GET', `/api/admin/ml/model-versions`, { status: 403, code: 'FORBIDDEN', ev: 'B09-mlr-009_ml_list_versions' });
    });
  } finally {
    await s.cleanup();
  }
});

test('API · FL-B09-07 · viewer · ma trận quyền BE', async () => {
  test.setTimeout(120_000);
  const s = await seedViewerProject();
  const api = s.viewerApi;
  const foreignId = (await createProject(s.admin, 'p09-authz-foreign', 0)).projectId; // viewer is NOT a member
  try {
    await test.step('[B09-mlr-013] ml_upload_version', async () => {
      await expectDenied(api, 'POST', `/api/admin/ml/model-versions`, { status: 403, code: 'FORBIDDEN', ev: 'B09-mlr-013_ml_upload_version', soft: false });
    });
    await test.step('[B09-mlr-016] ml_read_version', async () => {
      await expectDenied(api, 'GET', `/api/admin/ml/model-versions/${FAKE_ID}`, { status: 403, code: 'FORBIDDEN', ev: 'B09-mlr-016_ml_read_version' });
    });
    await test.step('[B09-usr-002] users_list_users', async () => {
      await expectDenied(api, 'GET', `/api/users`, { status: 403, code: 'FORBIDDEN', ev: 'B09-usr-002_users_list_users' });
    });
    await test.step('[B09-usr-006] users_invite_users', async () => {
      await expectDenied(api, 'POST', `/api/users/invitations`, { status: 403, code: 'FORBIDDEN', ev: 'B09-usr-006_users_invite_users' });
    });
    await test.step('[B09-usr-009] users_resend_invitation', async () => {
      await expectDenied(api, 'POST', `/api/users/invitations/${FAKE_ID}/resend`, { status: 403, code: 'FORBIDDEN', ev: 'B09-usr-009_users_resend_invitation' });
    });
    await test.step('[B09-usr-012] users_list_memberships', async () => {
      await expectDenied(api, 'GET', `/api/users/${FAKE_ID}/memberships`, { status: 403, code: 'FORBIDDEN', ev: 'B09-usr-012_users_list_memberships' });
    });
    await test.step('[B09-usr-016] users_list_activity', async () => {
      await expectDenied(api, 'GET', `/api/users/${FAKE_ID}/activity`, { status: 403, code: 'FORBIDDEN', ev: 'B09-usr-016_users_list_activity' });
    });
    await test.step('[B09-usr-020] users_change_role', async () => {
      await expectDenied(api, 'PATCH', `/api/users/${FAKE_ID}/role`, { status: 403, code: 'FORBIDDEN', ev: 'B09-usr-020_users_change_role' });
    });
    await test.step('[B09-usr-023] users_disable_user', async () => {
      await expectDenied(api, 'POST', `/api/users/${FAKE_ID}/disable`, { status: 403, code: 'FORBIDDEN', ev: 'B09-usr-023_users_disable_user' });
    });
    await test.step('[B09-usr-026] users_enable_user', async () => {
      await expectDenied(api, 'POST', `/api/users/${FAKE_ID}/enable`, { status: 403, code: 'FORBIDDEN', ev: 'B09-usr-026_users_enable_user' });
    });
    await test.step('[B09-usr-029] users_delete_user', async () => {
      await expectDenied(api, 'DELETE', `/api/users/${FAKE_ID}`, { status: 403, code: 'FORBIDDEN', ev: 'B09-usr-029_users_delete_user' });
    });
    await test.step('[B09-prj-005] projects_read_project', async () => {
      await expectOpen(api, `/api/projects/${s.projectId}`, 'B09-prj-005_projects_read_project', { statuses: [200] });
    });
    await test.step('[B09-prj-013] projects_lists_own_only', async () => {
      // projects/router.py:44,88 - only own projects are listed
        for (const path of ['/api/projects', '/api/project-summaries']) {
          const res = await api.get(path);
          expect.soft(res.status(), path).toBe(200);
          const text = await res.text();
          expect.soft(text, `${path} lists own project`).toContain(s.projectId);
          expect.soft(text, `${path} hides foreign project`).not.toContain(foreignId);
        }
    });
  } finally {
    await deleteSeededProject(s.admin, foreignId);
    await s.cleanup();
  }
});

test('API · FL-B09-08 · viewer · ma trận quyền BE', async () => {
  test.setTimeout(120_000);
  const s = await seedViewerProject();
  const api = s.viewerApi;
  try {
    await test.step('[B09-set-003] settings_read_settings', async () => {
      await expectOpen(api, `/api/projects/${s.projectId}/settings`, 'B09-set-003_settings_read_settings', { statuses: [200], soft: false });
    });
    await test.step('[B09-rul-003] rules_read_config', async () => {
      await expectOpen(api, `/api/projects/${s.projectId}/rule-config`, 'B09-rul-003_rules_read_config', { statuses: [200] });
    });
    await test.step('[B09-flr-003] floors_list_floors', async () => {
      await expectOpen(api, `/api/projects/${s.projectId}/floors`, 'B09-flr-003_floors_list_floors', { statuses: [200] });
    });
    await test.step('[B09-spr-003] spatial_read_floor', async () => {
      await expectOpen(api, `/api/projects/${s.projectId}/floors/${s.floorId}/spatial`, 'B09-spr-003_spatial_read_floor', { statuses: [200, 404] });
    });
    await test.step('[B09-spr-006] spatial_read_graph', async () => {
      await expectOpen(api, `/api/projects/${s.projectId}/spatial`, 'B09-spr-006_spatial_read_graph', { statuses: [200, 404] });
    });
    await test.step('[B09-spr-009] spatial_read_layer', async () => {
      await expectOpen(api, `/api/projects/${s.projectId}/floors/${s.floorId}/spatial/layer`, 'B09-spr-009_spatial_read_layer', { statuses: [200, 404] });
    });
    await test.step('[B09-drw-005] drawings_upload_chunk', async () => {
      await expectDenied(api, 'POST', `/api/projects/${s.projectId}/drawings/uploads/${FAKE_ID}/chunks`, { status: 403, code: 'FORBIDDEN', ev: 'B09-drw-005_drawings_upload_chunk' });
    });
    await test.step('[B09-drw-008] drawings_complete_upload', async () => {
      await expectDenied(api, 'POST', `/api/projects/${s.projectId}/drawings/uploads/${FAKE_ID}/complete`, { status: 403, code: 'FORBIDDEN', ev: 'B09-drw-008_drawings_complete_upload' });
    });
    await test.step('[B09-drw-012] drawings_read_progress', async () => {
      await expectOpen(api, `/api/projects/${s.projectId}/drawings/uploads/${FAKE_ID}/progress`, 'B09-drw-012_drawings_read_progress', { statuses: [200, 404] });
    });
    await test.step('[B09-str-003] streams_open_progress', async () => {
      await expectOpen(api, `/api/projects/${s.projectId}/uploads/${FAKE_ID}/progress`, 'B09-str-003_streams_open_progress', { statuses: [200, 404] });
    });
    await test.step('[B09-qlt-003] quality_read_assessment', async () => {
      await expectOpen(api, `/api/projects/${s.projectId}/floors/${s.floorId}/quality`, 'B09-qlt-003_quality_read_assessment', { statuses: [200, 404] });
    });
    await test.step('[B09-tpl-003] templates_list_templates', async () => {
      await expectOpen(api, `/api/projects/${s.projectId}/property-templates`, 'B09-tpl-003_templates_list_templates', { statuses: [200] });
    });
    await test.step('[B09-msr-003] measurements_list_records', async () => {
      await expectOpen(api, `/api/projects/${s.projectId}/measurements`, 'B09-msr-003_measurements_list_records', { statuses: [200] });
    });
  } finally {
    await s.cleanup();
  }
});

test('API · FL-B09-09 · viewer · ma trận quyền BE', async () => {
  test.setTimeout(120_000);
  const s = await seedViewerProject();
  const api = s.viewerApi;
  try {
    await test.step('[B09-ver-003] versions_list_versions', async () => {
      await expectOpen(api, `/api/projects/${s.projectId}/versions`, 'B09-ver-003_versions_list_versions', { statuses: [200], soft: false });
    });
    await test.step('[B09-ver-006] versions_read_version', async () => {
      await expectOpen(api, `/api/projects/${s.projectId}/versions/${s.versionId}`, 'B09-ver-006_versions_read_version', { statuses: [200, 404] });
    });
    await test.step('[B09-ver-009] versions_read_snapshot', async () => {
      await expectOpen(api, `/api/projects/${s.projectId}/versions/${s.versionId}/snapshot`, 'B09-ver-009_versions_read_snapshot', { statuses: [200, 404] });
    });
  } finally {
    await s.cleanup();
  }
});
