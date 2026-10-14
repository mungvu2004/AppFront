<!-- qa-sources fe=d50bb248 be=dc510655 -->
# Phase 05 - Backend coverage (AppBack behind the Pascal 3D screens), group B05-G

Source: AppBack `main` `dc510655` (pytest docstrings merged there); FE specs on `qa/phase05`. Plan, catalog and reverse index:
`F:/App/AppBack/backend/dieu-phoi/chay/QA-05c/` - `catalog-C6.md` (117 rows, 9 n/a, 108 needed), `flows-C6.md` (flow steps, `PY-*`,
reverse index), `flows-C4.md` (the 7 measurement `25-G-*` pytest rows), `coverage-ids.txt`. This file only indexes; it does not copy rows.
All `file:line` were read from the specs and from `git grep` on `main`.

Screens served: `/projects/:p/3d`, `/projects/:p/3d/measure`, `/m/du-an/:p`; all sit behind `ProjectSpatialGate`.
Statuses: **api** = step in an API spec on the real stack, **PY** = pytest whose docstring carries `Hàng catalog: [<id>]`,
**n/a** = catalog row with no test (negative source fact, unreachable, or owned by another phase; reason in `catalog-C6.md`).

Test keys:
- **A5** `qa/tests/phase05_3d_viewer_api.spec.ts` - kept measurement suite, 8 tests `FL-A5-01..08` (titles still contain `A05 ·`).
- **BE5** `qa/tests/phase05_3d_api.spec.ts` - new, 4 tests `FL-BE5-01..04` (gate reads, #35 from 3D, other 3D writes, static resources).
- **PY** AppBack pytest, PY table below. Evidence prefix `A05_<row id>_<slug>` (one JSON exchange per step).
- No mocks in this layer. UI mocks that need a 5xx on N15 / #16 are paired in `phase05.md` (not producible on the stack).

## Endpoints called by the phase-05 screens

| E | Method + path | BE handler | Screens |
|---|---|---|---|
| E1 | `GET /api/projects/:p` (#24) | projects/router.py:49 | all |
| E2 | `GET /api/projects/:p/spatial` (N15) | spatial_read/router.py:65-68 -> graph.py | all |
| E3 | `GET /api/projects/:p/rule-config` (N21) | rules/router.py:21-26 | all (errors swallowed) |
| E4 | `PUT /api/projects/:p/floors/:f/spatial/layer` (#35) | spatial_write/router.py:45-67 -> writer.py | /3d edit |
| E5 | `GET /api/projects/:p/floors/:f/spatial/layer` (N16) | spatial_read/router.py:71-87 | /3d reload after a 409 |
| E6-E8 | `GET / POST / DELETE /api/projects/:p/measurements[/:m]` (#16 / #17 / #18) | measurements/router.py:24-44 -> service.py | /3d/measure |
| E9 | `POST /api/projects/:p/property-templates` (#29) | templates/router.py:25-30 | /3d "Luu lam khuon mau" |
| E10 | `GET /api/feature-flags` (#9) | telemetry/router.py:34-39 | global |
| E11 | static `/assets/pascal/*`, `/draco/*`, `/basis/*`, `/pascal/material/**`, `HEAD /`, deep links | deploy/nginx/snippets/app_locations.conf, web.Dockerfile | all |
| E12-E14 | presence / SSE / history / library | none called (E12-E13 negative facts, E14 admin screens only) | - |

## Endpoint x rule (summary)

Per-id owner = reverse index in `flows-C6.md` (`grep "B05-G-0xx"`). "api steps" lists the owning flow and how many ids it holds.

| Group | Endpoint / rule family | Catalog rows | needed | n/a | api steps | PY only |
|---|---|---|---|---|---|---|
| B05-G-001..013 | shared gate: auth, body ceiling, project gate, roles, #24 | 13 | 12 | 1 | FL-A5-01 2, FL-BE5-01 6, FL-BE5-02 1 | 3 |
| B05-G-020..028 | N15 `GET /spatial` | 9 | 8 | 1 | FL-BE5-01 3 | 5 |
| B05-G-030..033 | N21 `GET /rule-config` | 4 | 4 | 0 | FL-BE5-01 1 | 3 |
| B05-G-040..062 | #35 `PUT .../spatial/layer` and N16 reload | 23 | 23 | 0 | FL-BE5-02 8 | 15 |
| B05-G-070..076 | #16 list measurements | 7 | 7 | 0 | FL-A5-02 4, FL-A5-03 1, FL-A5-05 1, FL-A5-08 1 | 0 |
| B05-G-080..101 | #17 create measurement | 22 | 22 | 0 | FL-A5-02 3, FL-A5-03 3, FL-A5-04 4, FL-A5-05 2, FL-A5-06 1, FL-A5-07 1, FL-A5-08 4, FL-BE5-03 4 | 0 |
| B05-G-110..117 | #18 delete measurement | 8 | 8 | 0 | FL-A5-03 2, FL-A5-05 3, FL-A5-07 1 | 2 |
| B05-G-120..126 | #29 `POST /property-templates` | 7 | 7 | 0 | FL-BE5-03 2 | 5 |
| B05-G-130..133 | #9 `GET /feature-flags` | 4 | 2 | 2 | - | 2 |
| B05-G-140..152 | static Pascal resources, headers, web image | 13 | 13 | 0 | FL-BE5-04 11 | 2 |
| B05-G-160..166 | negative facts (no presence / SSE / history / version endpoint) | 7 | 2 | 5 | FL-BE5-02 2 | 0 |

Totals: 117 catalog rows, 9 n/a, 108 needed = 71 api steps + 37 PY-only rows.
n/a ids: `B05-G-009`, `B05-G-028`, `B05-G-132`, `B05-G-133`, `B05-G-160`, `B05-G-161`, `B05-G-164`, `B05-G-165`, `B05-G-166`.

## FL-A5 and FL-BE5 (API specs)

| Flow | Test (file:line) | Steps | Title |
|---|---|---|---|
| FL-BE5-01 | `phase05_3d_api.spec.ts:36` | 10 | gate reads behind /3d, /3d/measure, /m/du-an: anonymous, roles, contract decode, non-member |
| FL-BE5-02 | `phase05_3d_api.spec.ts:136` | 11 | 3D autosave #35: base from N15, conflict with a QC writer, "Tải lại", storey move, audit, demotion |
| FL-BE5-03 | `phase05_3d_api.spec.ts:306` | 6 | writes of the 3D tools besides the layer: pin retry / undo across two sessions, 3D pick values, "Lưu... |
| FL-BE5-04 | `phase05_3d_api.spec.ts:400` | 11 | static Pascal resources and headers of the web image (no auth) |
| FL-A5-01 | `phase05_3d_viewer_api.spec.ts:323` | 3 | wrap A05 · anonymous: #16 / #17 / #18 → 401 UNAUTHENTICATED before the body is read (also truncated ... |
| FL-A5-02 | `phase05_3d_viewer_api.spec.ts:371` | 8 | wrap A05 · create + list: fresh project → #16 []; #17 → 201 for each mode, the stored record is the ... |
| FL-A5-03 | `phase05_3d_viewer_api.spec.ts:462` | 8 | wrap A05 · same id / delete / undo: repeat of the stored body → 200 same record without a touch (als... |
| FL-A5-04 | `phase05_3d_viewer_api.spec.ts:561` | 5 | wrap A05 · #17 body rules → 422 VALIDATION with field (id MS-<4..15 digits> string, name 1..120 afte... |
| FL-A5-05 | `phase05_3d_viewer_api.spec.ts:651` | 8 | wrap A05 · roles: viewer member → #16 200 but #17 / #18 → 403 FORBIDDEN (before Pydantic, W21 and th... |
| FL-A5-06 | `phase05_3d_viewer_api.spec.ts:768` | 2 | wrap A05 · concurrency (C14): two parallel #17 with one id and one body → {201, 200}, same record; o... |
| FL-A5-07 | `phase05_3d_viewer_api.spec.ts:809` | 3 | wrap A05 · Idempotency-Key on #17 / #18 (route idempotency "auto"): malformed key → 422 field idempo... |
| FL-A5-08 | `phase05_3d_viewer_api.spec.ts:863` | 6 | wrap A05 · limits: 200 points per record (201 → 422 field points); 20 000 points per project → next ... |

Steps per flow (id@line):

- FL-BE5-01: B05-G-002@50, B05-G-005@105, B05-G-006@113, B05-G-007@72, B05-G-011@67, B05-G-013@123, B05-G-020@80, B05-G-021@86, B05-G-027@94, B05-G-032@99
- FL-BE5-02: B05-G-008@280, B05-G-040@156, B05-G-041@165, B05-G-042@184, B05-G-043@204, B05-G-044@219, B05-G-052@238, B05-G-060@227, B05-G-062@273, B05-G-162@258, B05-G-163@267
- FL-BE5-03: B05-G-086@324, B05-G-087@334, B05-G-088@346, B05-G-089@353, B05-G-120@373, B05-G-121@387
- FL-BE5-04: B05-G-140@407, B05-G-141@419, B05-G-142@432, B05-G-144@441, B05-G-145@447, B05-G-146@458, B05-G-147@466, B05-G-148@476, B05-G-149@487, B05-G-150@500, B05-G-151@507
- FL-A5-01: 25-G-018@355, B05-G-001@335, B05-G-003@344
- FL-A5-02: 25-G-021@447, B05-G-070@386, B05-G-071@426, B05-G-072@433, B05-G-074@442, B05-G-080@391, B05-G-081@407, B05-G-082@437
- FL-A5-03: 25-G-014@538, 25-G-015@548, B05-G-073@500, B05-G-083@475, B05-G-084@491, B05-G-085@531, B05-G-110@507, B05-G-111@518
- FL-A5-04: 25-G-017@637, B05-G-090@573, B05-G-091@616, B05-G-092@623, B05-G-093@628
- FL-A5-05: 25-G-012@692, 25-G-013@731, B05-G-076@707, B05-G-094@678, B05-G-095@740, B05-G-112@686, B05-G-113@718, B05-G-114@753
- FL-A5-06: 25-G-020@796, B05-G-096@775
- FL-A5-07: 25-G-019@850, B05-G-097@819, B05-G-116@840
- FL-A5-08: 25-G-016@930, B05-G-075@915, B05-G-098@876, B05-G-099@881, B05-G-100@906, B05-G-101@897

## PY - pytest with row ids in the docstring (AppBack `main` dc510655)

| Row id | pytest (file:line, function) |
|---|---|
| `25-G-022` | `apps/api/measurements/tests/test_routes_create.py:441` `test_measurements_create_record__touch_project` |
| `25-G-023` | `apps/api/measurements/tests/test_routes_read_delete.py:110` `test_measurements_list_records__numeric_id_order` |
| `25-G-024` | `apps/api/measurements/tests/test_routes_create.py:421` `test_measurements_create_record__points_max_setting` |
| `25-G-025` | `apps/api/measurements/tests/test_units.py:20` `test_clean_label__trims_and_composes` |
| `25-G-026` | `apps/api/measurements/tests/test_routes_create.py:261` `test_measurements_create_record__negative_zero_equals_zero` |
| `25-G-027` | `apps/api/measurements/tests/test_routes_read_delete.py:233` `test_measurements_delete_record__other_project_id_not_deletable` |
| `25-G-028` | `apps/api/measurements/tests/test_routes_create.py:227` `test_measurements_create_record__id_reuse_after_delete` |
| `B05-G-004` | `apps/api/spatial_write/tests/test_large.py:161` `test_spatial_write_layer_rejects_a_body_over_eight_mebibytes` |
| `B05-G-010` | `apps/api/projects/tests/test_routes_read.py:111` `test_projects_read_project__C01` |
| `B05-G-012` | `apps/api/spatial_read/tests/test_routes_graph.py:180` `test_spatial_read_graph_level_matches_floors_list` |
| `B05-G-022` | `apps/api/spatial_read/tests/test_routes_graph.py:71` `test_spatial_read_graph__C01_empty_project` |
| `B05-G-023` | `apps/api/spatial_read/tests/test_routes_graph.py:129` `test_spatial_read_graph_skips_soft_deleted_floor` |
| `B05-G-024` | `apps/api/spatial_read/tests/test_routes_graph.py:203` `test_spatial_read_graph_building_reviewed_when_every_level_is` |
| `B05-G-025` | `apps/api/spatial_read/tests/test_routes_graph.py:146` `test_spatial_read_graph_query_count_is_flat` |
| `B05-G-026` | `apps/api/spatial_read/tests/test_routes_graph.py:250` `test_spatial_read_graph_when_floor_vanishes_mid_request` |
| `B05-G-030` | `apps/api/rules/tests/test_routes_read.py:23` `test_rules_read_config__C01` |
| `B05-G-031` | `apps/api/rules/tests/test_routes_read.py:43` `test_rules_read_config__C06` |
| `B05-G-033` | `apps/api/rules/tests/test_routes_read.py:75` `test_rules_read_config__stale_entries_filtered` |
| `B05-G-045` | `apps/api/spatial_write/tests/test_routes_errors.py:54` `test_spatial_write_layer_rejects_base_version_above_current` |
| `B05-G-046` | `apps/api/spatial_write/tests/test_routes.py:272` `test_spatial_write_layer__C09b` |
| `B05-G-047` | `apps/api/spatial_write/tests/test_routes.py:254` `test_spatial_write_layer__C09_missing` |
| `B05-G-048` | `apps/api/spatial_write/tests/test_routes.py:173` `test_spatial_write_layer__C07` |
| `B05-G-049` | `apps/api/spatial_write/tests/test_routes.py:154` `test_spatial_write_layer__C06` |
| `B05-G-050` | `apps/api/spatial_write/tests/test_routes.py:194` `test_spatial_write_layer__C08` |
| `B05-G-051` | `apps/api/spatial_write/tests/test_routes_errors.py:92` `test_spatial_write_layer_rejects_wall_of_other_level` |
| `B05-G-053` | `apps/api/spatial_write/tests/test_routes_errors.py:117` `test_spatial_write_layer_rejects_broken_integrity` |
| `B05-G-054` | `apps/api/spatial_write/tests/test_routes.py:113` `test_spatial_write_layer__C02` |
| `B05-G-055` | `packages/domain/spatial/tests/test_model.py:162` `test_broken_constraint_is_rejected` |
| `B05-G-056` | `apps/api/spatial_write/tests/test_routes_errors.py:73` `test_spatial_write_layer_rejects_ai_reviewed_entity` |
| `B05-G-057` | `apps/api/spatial_write/tests/test_writer.py:271` `test_spatial_write_layer_recomputes_room_area` |
| `B05-G-058` | `apps/api/spatial_write/tests/test_routes_errors.py:195` `test_spatial_write_layer_ignores_the_idempotency_key` |
| `B05-G-059` | `apps/api/spatial_write/tests/test_routes.py:345` `test_spatial_write_layer__C14` |
| `B05-G-061` | `apps/api/spatial_read/tests/test_routes_layer.py:37` `test_spatial_read_layer__C01` |
| `B05-G-115` | `apps/api/measurements/tests/test_routes_create.py:227` `test_measurements_create_record__id_reuse_after_delete` |
| `B05-G-117` | `apps/api/measurements/tests/test_routes_create.py:468` `test_measurements_create_record__second_session_and_project_cascade` |
| `B05-G-122` | `apps/api/templates/tests/test_routes.py:314` `test_templates_create_template__no_dedupe` |
| `B05-G-123` | `apps/api/templates/tests/test_routes.py:263` `test_templates_create_template__C07` |
| `B05-G-124` | `apps/api/templates/tests/test_routes.py:251` `test_templates_create_template__C06` |
| `B05-G-125` | `apps/api/templates/tests/test_routes.py:95` `test_templates_list_templates__C15` |
| `B05-G-126` | `apps/api/templates/tests/test_routes.py:366` `test_templates_create_template__touch_project` |
| `B05-G-130` | `apps/api/telemetry/tests/test_feature_flags_route.py:56` `test_telemetry_read_feature_flags__C01` |
| `B05-G-131` | `apps/api/telemetry/tests/test_feature_flags_route.py:101` `test_missing_authorization_is_401` |
| `B05-G-143` | `deploy/tests/test_nginx.py:389` `test_nginx_draco_and_assets_return_404_when_missing` |
| `B05-G-145` | `deploy/tests/test_nginx.py:399` `test_nginx_pascal_static_prefixes_return_404_when_missing` |
| `B05-G-146` | `deploy/tests/test_nginx.py:399` `test_nginx_pascal_static_prefixes_return_404_when_missing` |
| `B05-G-152` | `deploy/tests/test_dockerfiles.py:288` `test_dockerfile_web_has_draco_build_and_wasm_check` |

46 docstring tags (46 distinct ids). Rows whose pytest only partly proves them keep a flow step (`was:` in `flows-C6.md`).
