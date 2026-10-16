/**
 * Phase 09 (QA-09 P12): anonymous BE authorization matrix, FL-B09-01..05, API only (no browser, no mocks, no data).
 * Every row: no cookie / Bearer -> 401 `UNAUTHENTICATED` (BE core/auth.py:77,87 via core/routing.py `_principal_of`; streams: streams/router.py authenticate_stream).
 * order: `newApiContext()` sets Origin = web base, so core/origin.py (ORIGIN_MISMATCH 403) is not hit; auth runs before body/path validation.
 */
import { test } from '@playwright/test';

import { newApiContext } from './support/api';
import { FAKE, expectDenied } from './support/p09/P12';

test('API · FL-B09-01 · ẩn danh · ma trận quyền BE', async () => {
  const ctx = await newApiContext();
  try {
    await test.step('[B09-mld-001] ml_list_datasets GET anonymous -> 401', async () => {
      await expectDenied(ctx, 'GET', `/api/admin/ml/datasets`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-mld-001', slug: 'ml-list-datasets', hard: true });
    });
    await test.step('[B09-mld-005] ml_create_dataset POST anonymous -> 401', async () => {
      await expectDenied(ctx, 'POST', `/api/admin/ml/datasets`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-mld-005', slug: 'ml-create-dataset' });
    });
    await test.step('[B09-mld-008] ml_list_dataset_versions GET anonymous -> 401', async () => {
      await expectDenied(ctx, 'GET', `/api/admin/ml/datasets/${FAKE.id}/versions`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-mld-008', slug: 'ml-list-dataset-versions' });
    });
    await test.step('[B09-mld-012] ml_build_dataset_version POST anonymous -> 401', async () => {
      await expectDenied(ctx, 'POST', `/api/admin/ml/datasets/${FAKE.id}/versions`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-mld-012', slug: 'ml-build-dataset-version' });
    });
    await test.step('[B09-mlj-001] ml_list_jobs GET anonymous -> 401', async () => {
      await expectDenied(ctx, 'GET', `/api/admin/ml/training-jobs`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-mlj-001', slug: 'ml-list-jobs' });
    });
    await test.step('[B09-mlj-005] ml_create_job POST anonymous -> 401', async () => {
      await expectDenied(ctx, 'POST', `/api/admin/ml/training-jobs`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-mlj-005', slug: 'ml-create-job' });
    });
    await test.step('[B09-mlj-008] ml_read_job GET anonymous -> 401', async () => {
      await expectDenied(ctx, 'GET', `/api/admin/ml/training-jobs/${FAKE.id}`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-mlj-008', slug: 'ml-read-job' });
    });
    await test.step('[B09-mlj-012] ml_cancel_job POST anonymous -> 401', async () => {
      await expectDenied(ctx, 'POST', `/api/admin/ml/training-jobs/${FAKE.id}/cancel`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-mlj-012', slug: 'ml-cancel-job' });
    });
    await test.step('[B09-mlj-015] ml_list_job_metrics GET anonymous -> 401', async () => {
      await expectDenied(ctx, 'GET', `/api/admin/ml/training-jobs/${FAKE.id}/metrics`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-mlj-015', slug: 'ml-list-job-metrics' });
    });
    await test.step('[B09-mlj-019] ml_list_job_logs GET anonymous -> 401', async () => {
      await expectDenied(ctx, 'GET', `/api/admin/ml/training-jobs/${FAKE.id}/logs`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-mlj-019', slug: 'ml-list-job-logs' });
    });
    await test.step('[B09-mlr-001] ml_list_families GET anonymous -> 401', async () => {
      await expectDenied(ctx, 'GET', `/api/admin/ml/model-families`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-mlr-001', slug: 'ml-list-families' });
    });
    await test.step('[B09-mlr-005] ml_activate_version PUT anonymous -> 401', async () => {
      await expectDenied(ctx, 'PUT', `/api/admin/ml/model-families/${FAKE.family}/active`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-mlr-005', slug: 'ml-activate-version' });
    });
    await test.step('[B09-mlr-008] ml_list_versions GET anonymous -> 401', async () => {
      await expectDenied(ctx, 'GET', `/api/admin/ml/model-versions`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-mlr-008', slug: 'ml-list-versions' });
    });
  } finally {
    await ctx.dispose();
  }
});

test('API · FL-B09-02 · ẩn danh · ma trận quyền BE', async () => {
  const ctx = await newApiContext();
  try {
    await test.step('[B09-mlr-012] ml_upload_version POST anonymous -> 401', async () => {
      await expectDenied(ctx, 'POST', `/api/admin/ml/model-versions`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-mlr-012', slug: 'ml-upload-version', hard: true });
    });
    await test.step('[B09-mlr-015] ml_read_version GET anonymous -> 401', async () => {
      await expectDenied(ctx, 'GET', `/api/admin/ml/model-versions/${FAKE.id}`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-mlr-015', slug: 'ml-read-version' });
    });
    await test.step('[B09-usr-001] users_list_users GET anonymous -> 401', async () => {
      await expectDenied(ctx, 'GET', `/api/users`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-usr-001', slug: 'users-list-users' });
    });
    await test.step('[B09-usr-005] users_invite_users POST anonymous -> 401', async () => {
      await expectDenied(ctx, 'POST', `/api/users/invitations`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-usr-005', slug: 'users-invite-users' });
    });
    await test.step('[B09-usr-008] users_resend_invitation POST anonymous -> 401', async () => {
      await expectDenied(ctx, 'POST', `/api/users/invitations/${FAKE.uid}/resend`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-usr-008', slug: 'users-resend-invitation' });
    });
    await test.step('[B09-usr-011] users_list_memberships GET anonymous -> 401', async () => {
      await expectDenied(ctx, 'GET', `/api/users/${FAKE.uid}/memberships`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-usr-011', slug: 'users-list-memberships' });
    });
    await test.step('[B09-usr-015] users_list_activity GET anonymous -> 401', async () => {
      await expectDenied(ctx, 'GET', `/api/users/${FAKE.uid}/activity`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-usr-015', slug: 'users-list-activity' });
    });
    await test.step('[B09-usr-019] users_change_role PATCH anonymous -> 401', async () => {
      await expectDenied(ctx, 'PATCH', `/api/users/${FAKE.uid}/role`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-usr-019', slug: 'users-change-role' });
    });
    await test.step('[B09-usr-022] users_disable_user POST anonymous -> 401', async () => {
      await expectDenied(ctx, 'POST', `/api/users/${FAKE.uid}/disable`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-usr-022', slug: 'users-disable-user' });
    });
    await test.step('[B09-usr-025] users_enable_user POST anonymous -> 401', async () => {
      await expectDenied(ctx, 'POST', `/api/users/${FAKE.uid}/enable`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-usr-025', slug: 'users-enable-user' });
    });
    await test.step('[B09-usr-028] users_delete_user DELETE anonymous -> 401', async () => {
      await expectDenied(ctx, 'DELETE', `/api/users/${FAKE.uid}`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-usr-028', slug: 'users-delete-user' });
    });
    await test.step('[B09-prj-001] projects_create_project POST anonymous -> 401', async () => {
      await expectDenied(ctx, 'POST', `/api/projects`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-prj-001', slug: 'projects-create-project' });
    });
    await test.step('[B09-prj-003] projects_read_project GET anonymous -> 401', async () => {
      await expectDenied(ctx, 'GET', `/api/projects/${FAKE.pid}`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-prj-003', slug: 'projects-read-project' });
    });
  } finally {
    await ctx.dispose();
  }
});

test('API · FL-B09-03 · ẩn danh · ma trận quyền BE', async () => {
  const ctx = await newApiContext();
  try {
    await test.step('[B09-prj-006] projects_update_project PATCH anonymous -> 401', async () => {
      await expectDenied(ctx, 'PATCH', `/api/projects/${FAKE.pid}`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-prj-006', slug: 'projects-update-project', hard: true });
    });
    await test.step('[B09-prj-009] projects_delete_project DELETE anonymous -> 401', async () => {
      await expectDenied(ctx, 'DELETE', `/api/projects/${FAKE.pid}`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-prj-009', slug: 'projects-delete-project' });
    });
    await test.step('[B09-prj-014] projects_list_projects GET anonymous -> 401', async () => {
      await expectDenied(ctx, 'GET', `/api/projects`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-prj-014', slug: 'projects-list-projects' });
    });
    await test.step('[B09-mem-001] members_add_member POST anonymous -> 401', async () => {
      await expectDenied(ctx, 'POST', `/api/projects/${FAKE.pid}/members`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-mem-001', slug: 'members-add-member' });
    });
    await test.step('[B09-mem-004] members_remove_member DELETE anonymous -> 401', async () => {
      await expectDenied(ctx, 'DELETE', `/api/projects/${FAKE.pid}/members/${FAKE.uid}`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-mem-004', slug: 'members-remove-member' });
    });
    await test.step('[B09-set-001] settings_read_settings GET anonymous -> 401', async () => {
      await expectDenied(ctx, 'GET', `/api/projects/${FAKE.pid}/settings`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-set-001', slug: 'settings-read-settings' });
    });
    await test.step('[B09-set-004] settings_replace_settings PUT anonymous -> 401', async () => {
      await expectDenied(ctx, 'PUT', `/api/projects/${FAKE.pid}/settings`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-set-004', slug: 'settings-replace-settings' });
    });
    await test.step('[B09-rul-001] rules_read_config GET anonymous -> 401', async () => {
      await expectDenied(ctx, 'GET', `/api/projects/${FAKE.pid}/rule-config`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-rul-001', slug: 'rules-read-config' });
    });
    await test.step('[B09-rul-004] rules_replace_config PUT anonymous -> 401', async () => {
      await expectDenied(ctx, 'PUT', `/api/projects/${FAKE.pid}/rule-config`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-rul-004', slug: 'rules-replace-config' });
    });
    await test.step('[B09-flr-001] floors_list_floors GET anonymous -> 401', async () => {
      await expectDenied(ctx, 'GET', `/api/projects/${FAKE.pid}/floors`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-flr-001', slug: 'floors-list-floors' });
    });
    await test.step('[B09-flr-004] floors_create_floor POST anonymous -> 401', async () => {
      await expectDenied(ctx, 'POST', `/api/projects/${FAKE.pid}/floors`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-flr-004', slug: 'floors-create-floor' });
    });
    await test.step('[B09-flr-007] floors_delete_floor DELETE anonymous -> 401', async () => {
      await expectDenied(ctx, 'DELETE', `/api/floors/${FAKE.fid}`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-flr-007', slug: 'floors-delete-floor' });
    });
    await test.step('[B09-flr-010] floors_reorder_floors PATCH anonymous -> 401', async () => {
      await expectDenied(ctx, 'PATCH', `/api/floors/reorder`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-flr-010', slug: 'floors-reorder-floors' });
    });
  } finally {
    await ctx.dispose();
  }
});

test('API · FL-B09-04 · ẩn danh · ma trận quyền BE', async () => {
  const ctx = await newApiContext();
  try {
    await test.step('[B09-flr-013] floors_patch_spatial_floor PATCH anonymous -> 401', async () => {
      await expectDenied(ctx, 'PATCH', `/api/projects/${FAKE.pid}/floors/${FAKE.fid}/spatial`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-flr-013', slug: 'floors-patch-spatial-floor', hard: true });
    });
    await test.step('[B09-spr-001] spatial_read_floor GET anonymous -> 401', async () => {
      await expectDenied(ctx, 'GET', `/api/projects/${FAKE.pid}/floors/${FAKE.fid}/spatial`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-spr-001', slug: 'spatial-read-floor' });
    });
    await test.step('[B09-spr-004] spatial_read_graph GET anonymous -> 401', async () => {
      await expectDenied(ctx, 'GET', `/api/projects/${FAKE.pid}/spatial`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-spr-004', slug: 'spatial-read-graph' });
    });
    await test.step('[B09-spr-007] spatial_read_layer GET anonymous -> 401', async () => {
      await expectDenied(ctx, 'GET', `/api/projects/${FAKE.pid}/floors/${FAKE.fid}/spatial/layer`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-spr-007', slug: 'spatial-read-layer' });
    });
    await test.step('[B09-spw-001] spatial_write_layer PUT anonymous -> 401', async () => {
      await expectDenied(ctx, 'PUT', `/api/projects/${FAKE.pid}/floors/${FAKE.fid}/spatial/layer`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-spw-001', slug: 'spatial-write-layer' });
    });
    await test.step('[B09-drw-001] drawings_init_upload POST anonymous -> 401', async () => {
      await expectDenied(ctx, 'POST', `/api/projects/${FAKE.pid}/floors/${FAKE.fid}/drawings/uploads`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-drw-001', slug: 'drawings-init-upload' });
    });
    await test.step('[B09-drw-004] drawings_upload_chunk POST anonymous -> 401', async () => {
      await expectDenied(ctx, 'POST', `/api/projects/${FAKE.pid}/drawings/uploads/${FAKE.upl}/chunks`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-drw-004', slug: 'drawings-upload-chunk' });
    });
    await test.step('[B09-drw-007] drawings_complete_upload POST anonymous -> 401', async () => {
      await expectDenied(ctx, 'POST', `/api/projects/${FAKE.pid}/drawings/uploads/${FAKE.upl}/complete`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-drw-007', slug: 'drawings-complete-upload' });
    });
    await test.step('[B09-drw-010] drawings_read_progress GET anonymous -> 401', async () => {
      await expectDenied(ctx, 'GET', `/api/projects/${FAKE.pid}/drawings/uploads/${FAKE.upl}/progress`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-drw-010', slug: 'drawings-read-progress' });
    });
    await test.step('[B09-str-001] streams_open_progress GET anonymous -> 401', async () => { // order: public_router prefix /streams (streams/router.py:99); reject_foreign_origin (Origin matches) then authenticate_stream: no stream cookie -> 401
      await expectDenied(ctx, 'GET', `/api/streams/projects/${FAKE.pid}/uploads/${FAKE.upl}/progress`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-str-001', slug: 'streams-open-progress' });
    });
    await test.step('[B09-str-004] streams_open_notifications GET anonymous -> 401', async () => { // order: public_router prefix /streams (streams/router.py:99); reject_foreign_origin (Origin matches) then authenticate_stream: no stream cookie -> 401
      await expectDenied(ctx, 'GET', `/api/streams/notifications`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-str-004', slug: 'streams-open-notifications' });
    });
    await test.step('[B09-qlt-001] quality_read_assessment GET anonymous -> 401', async () => {
      await expectDenied(ctx, 'GET', `/api/projects/${FAKE.pid}/floors/${FAKE.fid}/quality`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-qlt-001', slug: 'quality-read-assessment' });
    });
    await test.step('[B09-qlt-004] quality_set_corners POST anonymous -> 401', async () => {
      await expectDenied(ctx, 'POST', `/api/projects/${FAKE.pid}/floors/${FAKE.fid}/quality/corners`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-qlt-004', slug: 'quality-set-corners' });
    });
  } finally {
    await ctx.dispose();
  }
});

test('API · FL-B09-05 · ẩn danh · ma trận quyền BE', async () => {
  const ctx = await newApiContext();
  try {
    await test.step('[B09-qlt-007] quality_straighten POST anonymous -> 401', async () => {
      await expectDenied(ctx, 'POST', `/api/projects/${FAKE.pid}/floors/${FAKE.fid}/quality/straighten`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-qlt-007', slug: 'quality-straighten', hard: true });
    });
    await test.step('[B09-tpl-001] templates_list_templates GET anonymous -> 401', async () => {
      await expectDenied(ctx, 'GET', `/api/projects/${FAKE.pid}/property-templates`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-tpl-001', slug: 'templates-list-templates' });
    });
    await test.step('[B09-tpl-004] templates_create_template POST anonymous -> 401', async () => {
      await expectDenied(ctx, 'POST', `/api/projects/${FAKE.pid}/property-templates`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-tpl-004', slug: 'templates-create-template' });
    });
    await test.step('[B09-msr-001] measurements_list_records GET anonymous -> 401', async () => {
      await expectDenied(ctx, 'GET', `/api/projects/${FAKE.pid}/measurements`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-msr-001', slug: 'measurements-list-records' });
    });
    await test.step('[B09-msr-004] measurements_create_record POST anonymous -> 401', async () => {
      await expectDenied(ctx, 'POST', `/api/projects/${FAKE.pid}/measurements`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-msr-004', slug: 'measurements-create-record' });
    });
    await test.step('[B09-msr-007] measurements_delete_record DELETE anonymous -> 401', async () => {
      await expectDenied(ctx, 'DELETE', `/api/projects/${FAKE.pid}/measurements/${FAKE.mid}`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-msr-007', slug: 'measurements-delete-record' });
    });
    await test.step('[B09-ver-001] versions_list_versions GET anonymous -> 401', async () => {
      await expectDenied(ctx, 'GET', `/api/projects/${FAKE.pid}/versions`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-ver-001', slug: 'versions-list-versions' });
    });
    await test.step('[B09-ver-004] versions_read_version GET anonymous -> 401', async () => {
      await expectDenied(ctx, 'GET', `/api/projects/${FAKE.pid}/versions/${FAKE.vid}`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-ver-004', slug: 'versions-read-version' });
    });
    await test.step('[B09-ver-007] versions_read_snapshot GET anonymous -> 401', async () => {
      await expectDenied(ctx, 'GET', `/api/projects/${FAKE.pid}/versions/${FAKE.vid}/snapshot`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-ver-007', slug: 'versions-read-snapshot' });
    });
    await test.step('[B09-ver-010] versions_restore_version POST anonymous -> 401', async () => {
      await expectDenied(ctx, 'POST', `/api/projects/${FAKE.pid}/versions/${FAKE.vid}/restore`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-ver-010', slug: 'versions-restore-version' });
    });
    await test.step('[B09-ver-013] versions_label_version PATCH anonymous -> 401', async () => {
      await expectDenied(ctx, 'PATCH', `/api/projects/${FAKE.pid}/versions/${FAKE.vid}/label`, { status: 401, code: 'UNAUTHENTICATED' }, { id: 'B09-ver-013', slug: 'versions-label-version' });
    });
  } finally {
    await ctx.dispose();
  }
});
