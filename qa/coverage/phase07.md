<!-- qa-sources fe=c08468bf -->
# Phase 07 - Account Settings (SCR-33): FE coverage inventory

Rows come from the QA-07b catalog (`F:/App/AppBack/backend/dieu-phoi/chay/QA-07b/catalog-C1..C4.md`, FE rows C1-C3); flow plan in `flows-C1..C3.md`, reverse index `_flow-ids.tsv`. One `test.step('[<row id>] ...')` per row in the spec named below; `qa/tools/coverage-gate.mjs --phase 07` checks the ids. Backend rows (B07) are in `coverage/phase07-be.md`.
Deferred: `33S-A-026` (change-email click in the password flow) duplicates `33P-A-031` and is covered there (packs.md).

| row id | spec file | flow | layer |
|---|---|---|---|
| 33P-A-001 | `phase07_account.spec.ts` | FL-M-33P-01 | ui |
| 33P-A-003 | `phase07_profile_edge.spec.ts` | FL-33P-02 | ui |
| 33P-A-004 | `phase07_profile_edge.spec.ts` | FL-33P-02 | ui |
| 33P-A-005 | `phase07_profile_edge.spec.ts` | FL-33P-02 | ui |
| 33P-A-006 | `phase07_profile_edge.spec.ts` | FL-33P-02 | ui |
| 33P-A-007 | `phase07_profile_edge.spec.ts` | FL-33P-02 | ui |
| 33P-A-008 | `phase07_profile_edge.spec.ts` | FL-33P-02 | ui |
| 33P-A-009 | `phase07_profile_edge.spec.ts` | FL-33P-01 | ui |
| 33P-A-010 | `phase07_profile_edge.spec.ts` | FL-33P-01 | ui |
| 33P-A-011 | `phase07_account.spec.ts` | FL-M-33P-01 | ui |
| 33P-A-012 | `phase07_account.spec.ts` | FL-M-33P-01 | ui |
| 33P-A-013 | `phase07_profile_edge.spec.ts` | FL-33P-03 | ui |
| 33P-A-014 | `phase07_profile_edge.spec.ts` | FL-33P-03 | ui |
| 33P-A-015 | `phase07_profile_edge.spec.ts` | FL-33P-03 | ui |
| 33P-A-016 | `phase07_profile_edge.spec.ts` | FL-33P-03 | ui |
| 33P-A-017 | `phase07_profile_edge.spec.ts` | FL-33P-03 | ui |
| 33P-A-018 | `phase07_profile_edge.spec.ts` | FL-33P-03 | ui |
| 33P-A-019 | `phase07_profile_b_edge.spec.ts` | FL-33P-04 | ui |
| 33P-A-020 | `phase07_profile_b_edge.spec.ts` | FL-33P-04 | ui |
| 33P-A-021 | `phase07_profile_b_edge.spec.ts` | FL-33P-04 | ui |
| 33P-A-022 | `phase07_profile_b_edge.spec.ts` | FL-33P-04 | ui |
| 33P-A-023 | `phase07_profile_b_edge.spec.ts` | FL-33P-04 | ui |
| 33P-A-024 | `phase07_profile_b_edge.spec.ts` | FL-33P-04 | ui |
| 33P-A-025 | `phase07_profile_b_edge.spec.ts` | FL-33P-04 | ui |
| 33P-A-026 | `phase07_profile_b_edge.spec.ts` | FL-33P-06 | ui |
| 33P-A-027 | `phase07_profile_b_edge.spec.ts` | FL-33P-06 | ui |
| 33P-A-028 | `phase07_profile_b_edge.spec.ts` | FL-33P-06 | ui |
| 33P-A-029 | `phase07_profile_b_edge.spec.ts` | FL-33P-06 | ui |
| 33P-A-030 | `phase07_profile_b_edge.spec.ts` | FL-33P-06 | ui |
| 33P-A-031 | `phase07_profile_edge.spec.ts` | FL-33P-03 | ui |
| 33P-A-032 | `phase07_avatar_edge.spec.ts` | FL-33P-08 | ui |
| 33P-A-033 | `phase07_avatar_edge.spec.ts` | FL-33P-08 | ui |
| 33P-A-034 | `phase07_avatar_edge.spec.ts` | FL-33P-08 | ui |
| 33P-A-035 | `phase07_avatar_edge.spec.ts` | FL-33P-08 | ui |
| 33P-A-036 | `phase07_avatar_edge.spec.ts` | FL-33P-08 | ui |
| 33P-A-037 | `phase07_avatar_edge.spec.ts` | FL-33P-08 | ui |
| 33P-A-038 | `phase07_avatar_edge.spec.ts` | FL-33P-08 | ui |
| 33P-A-039 | `phase07_avatar_edge.spec.ts` | FL-33P-08 | ui |
| 33P-B-001 | `phase07_profile_edge.spec.ts` | FL-33P-02 | ui |
| 33P-B-002 | `phase07_profile_edge.spec.ts` | FL-33P-02 | ui |
| 33P-B-003 | `phase07_profile_edge.spec.ts` | FL-33P-01 | ui |
| 33P-B-004 | `phase07_profile_edge.spec.ts` | FL-33P-01 | ui |
| 33P-B-005 | `phase07_account.spec.ts` | FL-M-33P-01 | ui |
| 33P-B-006 | `phase07_account.spec.ts` | FL-M-33P-01 | ui |
| 33P-B-007 | `phase07_profile_mocked_edge.spec.ts` | FL-33P-10 | ui |
| 33P-B-008 | `phase07_profile_mocked_edge.spec.ts` | FL-33P-10 | ui |
| 33P-B-009 | `phase07_profile_mocked_edge.spec.ts` | FL-33P-10 | ui |
| 33P-B-010 | `phase07_profile_mocked_edge.spec.ts` | FL-33P-10 | ui |
| 33P-B-011 | `phase07_profile_mocked_edge.spec.ts` | FL-33P-10 | ui |
| 33P-B-012 | `phase07_profile_mocked_edge.spec.ts` | FL-33P-10 | ui |
| 33P-B-014 | `phase07_profile_edge.spec.ts` | FL-33P-01 | ui |
| 33P-B-015 | `phase07_profile_b_edge.spec.ts` | FL-33P-04 | ui |
| 33P-B-016 | `phase07_profile_b_edge.spec.ts` | FL-33P-04 | ui |
| 33P-B-017 | `phase07_profile_edge.spec.ts` | FL-33P-03 | ui |
| 33P-B-018 | `phase07_profile_b_edge.spec.ts` | FL-33P-04 | ui |
| 33P-B-019 | `phase07_profile_b_edge.spec.ts` | FL-33P-05 | ui |
| 33P-B-020 | `phase07_profile_b_edge.spec.ts` | FL-33P-04 | ui |
| 33P-B-021 | `phase07_profile_b_edge.spec.ts` | FL-33P-04 | ui |
| 33P-B-022 | `phase07_profile_b_edge.spec.ts` | FL-33P-06 | ui |
| 33P-B-023 | `phase07_profile_b_edge.spec.ts` | FL-33P-06 | ui |
| 33P-B-024 | `phase07_profile_b_edge.spec.ts` | FL-33P-06 | ui |
| 33P-B-025 | `phase07_profile_edge.spec.ts` | FL-33P-03 | ui |
| 33P-B-026 | `phase07_profile_edge.spec.ts` | FL-33P-01 | ui |
| 33P-B-027 | `phase07_profile_edge.spec.ts` | FL-33P-01 | ui |
| 33P-B-028 | `phase07_profile_edge.spec.ts` | FL-33P-01 | ui |
| 33P-B-029 | `phase07_avatar_edge.spec.ts` | FL-33P-08 | ui |
| 33P-B-030 | `phase07_avatar_edge.spec.ts` | FL-33P-08 | ui |
| 33P-B-031 | `phase07_avatar_edge.spec.ts` | FL-33P-09 | ui |
| 33P-B-032 | `phase07_avatar_edge.spec.ts` | FL-33P-09 | ui |
| 33P-C-001 | `phase07_profile_b_edge.spec.ts` | FL-33P-05 | ui |
| 33P-C-002 | `phase07_profile_b_edge.spec.ts` | FL-33P-05 | ui |
| 33P-C-003 | `phase07_profile_b_edge.spec.ts` | FL-33P-05 | ui |
| 33P-C-004 | `phase07_profile_b_edge.spec.ts` | FL-33P-05 | ui |
| 33P-C-005 | `phase07_profile_b_edge.spec.ts` | FL-33P-05 | ui |
| 33P-C-006 | `phase07_profile_b_edge.spec.ts` | FL-33P-07 | ui |
| 33P-C-007 | `phase07_profile_b_edge.spec.ts` | FL-33P-07 | ui |
| 33P-C-008 | `phase07_profile_b_edge.spec.ts` | FL-33P-07 | ui |
| 33P-C-009 | `phase07_profile_b_edge.spec.ts` | FL-33P-07 | ui |
| 33P-C-010 | `phase07_profile_b_edge.spec.ts` | FL-33P-07 | ui |
| 33P-C-011 | `phase07_profile_b_edge.spec.ts` | FL-33P-07 | ui |
| 33P-C-012 | `phase07_profile_b_edge.spec.ts` | FL-33P-07 | ui |
| 33P-C-013 | `phase07_profile_b_edge.spec.ts` | FL-33P-05 | ui |
| 33P-C-014 | `phase07_profile_b_edge.spec.ts` | FL-33P-05 | ui |
| 33P-C-015 | `phase07_profile_b_edge.spec.ts` | FL-33P-05 | ui |
| 33P-C-016 | `phase07_avatar_edge.spec.ts` | FL-33P-09 | ui |
| 33P-C-017 | `phase07_avatar_edge.spec.ts` | FL-33P-09 | ui |
| 33P-C-018 | `phase07_avatar_edge.spec.ts` | FL-33P-09 | ui |
| 33P-C-020 | `phase07_avatar_edge.spec.ts` | FL-33P-08 | ui |
| 33P-C-021 | `phase07_profile_edge.spec.ts` | FL-33P-03 | ui |
| 33P-C-022 | `phase07_profile_mocked_edge.spec.ts` | FL-33P-12 | ui |
| 33P-D-001 | `phase07_profile_edge.spec.ts` | FL-33P-02 | ui |
| 33P-D-002 | `phase07_profile_edge.spec.ts` | FL-33P-02 | ui |
| 33P-D-003 | `phase07_profile_edge.spec.ts` | FL-33P-01 | ui |
| 33P-D-004 | `phase07_profile_b_edge.spec.ts` | FL-33P-04 | ui |
| 33P-E-001 | `phase07_profile_edge.spec.ts` | FL-33P-01 | ui |
| 33P-E-002 | `phase07_profile_edge.spec.ts` | FL-33P-01 | ui |
| 33P-E-003 | `phase07_profile_edge.spec.ts` | FL-33P-01 | ui |
| 33P-E-004 | `phase07_avatar_edge.spec.ts` | FL-33P-08 | ui |
| 33P-E-005 | `phase07_profile_b_edge.spec.ts` | FL-33P-05 | ui |
| 33P-E-006 | `phase07_profile_edge.spec.ts` | FL-33P-01 | ui |
| 33P-E-007 | `phase07_profile_b_edge.spec.ts` | FL-33P-05 | ui |
| 33P-E-008 | `phase07_profile_edge.spec.ts` | FL-33P-03 | ui |
| 33P-E-009 | `phase07_avatar_edge.spec.ts` | FL-33P-08 | ui |
| 33P-E-010 | `phase07_avatar_edge.spec.ts` | FL-33P-08 | ui |
| 33P-E-011 | `phase07_profile_b_edge.spec.ts` | FL-33P-06 | ui |
| 33P-E-012 | `phase07_profile_mocked_edge.spec.ts` | FL-33P-10 | ui |
| 33P-F-001 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33P-U1 | ui |
| 33P-F-002 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33P-U1 | ui |
| 33P-F-003 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33P-U3 | ui |
| 33P-F-004 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33P-U2 | ui |
| 33P-F-005 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33P-U2 | ui |
| 33P-F-006 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33P-U2 | ui |
| 33P-F-007 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33P-U2 | ui |
| 33P-F-008 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33P-U2 | ui |
| 33P-F-009 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33P-U1 | ui |
| 33P-F-010 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33P-U1 | ui |
| 33P-F-011 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33P-U3 | ui |
| 33P-F-012 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33P-U3 | ui |
| 33P-F-013 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33P-U1 | ui |
| 33P-F-014 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33P-U1 | ui |
| 33P-G-001 | `phase07_profile_edge.spec.ts` | FL-33P-01 | ui |
| 33P-G-002 | `phase07_profile_edge.spec.ts` | FL-33P-01 | ui |
| 33P-G-003 | `phase07_account.spec.ts` | FL-M-33P-01 | ui |
| 33P-G-004 | `phase07_profile_edge.spec.ts` | FL-33P-03 | ui |
| 33P-G-005 | `phase07_profile_edge.spec.ts` | FL-33P-03 | ui |
| 33P-G-006 | `phase07_profile_edge.spec.ts` | FL-33P-03 | ui |
| 33P-G-007 | `phase07_profile_edge.spec.ts` | FL-33P-03 | ui |
| 33P-G-008 | `phase07_profile_b_edge.spec.ts` | FL-33P-06 | ui |
| 33P-G-009 | `phase07_profile_mocked_edge.spec.ts` | FL-33P-11 | ui |
| 33P-G-010 | `phase07_profile_mocked_edge.spec.ts` | FL-33P-11 | ui |
| 33P-G-013 | `phase07_profile_mocked_edge.spec.ts` | FL-33P-11 | ui |
| 33P-G-014 | `phase07_profile_mocked_edge.spec.ts` | FL-33P-11 | ui |
| 33P-G-015 | `phase07_profile_mocked_edge.spec.ts` | FL-33P-11 | ui |
| 33P-G-016 | `phase07_profile_mocked_edge.spec.ts` | FL-33P-11 | ui |
| 33P-G-017 | `phase07_profile_mocked_edge.spec.ts` | FL-33P-11 | ui |
| 33P-G-018 | `phase07_avatar_edge.spec.ts` | FL-33P-08 | ui |
| 33P-G-019 | `phase07_avatar_edge.spec.ts` | FL-33P-09 | ui |
| 33P-G-020 | `phase07_avatar_edge.spec.ts` | FL-33P-09 | ui |
| 33P-G-021 | `phase07_avatar_edge.spec.ts` | FL-33P-09 | ui |
| 33P-G-022 | `phase07_avatar_edge.spec.ts` | FL-33P-09 | ui |
| 33P-G-023 | `phase07_avatar_edge.spec.ts` | FL-33P-09 | ui |
| 33P-G-024 | `phase07_profile_mocked_edge.spec.ts` | FL-33P-12 | ui |
| 33P-G-025 | `phase07_avatar_edge.spec.ts` | FL-33P-09 | ui |
| 33P-G-026 | `phase07_avatar_edge.spec.ts` | FL-33P-09 | ui |
| 33P-G-027 | `phase07_profile_mocked_edge.spec.ts` | FL-33P-12 | ui |
| 33P-G-028 | `phase07_profile_mocked_edge.spec.ts` | FL-33P-12 | ui |
| 33P-G-029 | `phase07_profile_mocked_edge.spec.ts` | FL-33P-12 | ui |
| 33R-A-001 | `phase07_prefs_edge.spec.ts` | FL-33R-01 | ui |
| 33R-A-002 | `phase07_prefs_edge.spec.ts` | FL-33R-01 | ui |
| 33R-A-003 | `phase07_prefs_edge.spec.ts` | FL-33R-01 | ui |
| 33R-A-004 | `phase07_prefs_edge.spec.ts` | FL-33R-01 | ui |
| 33R-A-005 | `phase07_prefs_edge.spec.ts` | FL-33R-01 | ui |
| 33R-A-006 | `phase07_prefs_edge.spec.ts` | FL-33R-01 | ui |
| 33R-A-007 | `phase07_prefs_edge.spec.ts` | FL-33R-01 | ui |
| 33R-A-008 | `phase07_prefs_edge.spec.ts` | FL-33R-03 | ui |
| 33R-A-009 | `phase07_prefs_edge.spec.ts` | FL-33R-03 | ui |
| 33R-A-010 | `phase07_prefs_edge.spec.ts` | FL-33R-03 | ui |
| 33R-A-011 | `phase07_prefs_edge.spec.ts` | FL-33R-03 | ui |
| 33R-A-012 | `phase07_prefs_edge.spec.ts` | FL-33R-03 | ui |
| 33R-A-013 | `phase07_prefs_edge.spec.ts` | FL-33R-03 | ui |
| 33R-A-014 | `phase07_prefs_b_edge.spec.ts` | FL-33R-06 | ui |
| 33R-A-015 | `phase07_prefs_b_edge.spec.ts` | FL-33R-06 | ui |
| 33R-A-016 | `phase07_prefs_b_edge.spec.ts` | FL-33R-07 | ui |
| 33R-A-017 | `phase07_prefs_b_edge.spec.ts` | FL-33R-07 | ui |
| 33R-A-018 | `phase07_prefs_b_edge.spec.ts` | FL-33R-08 | ui |
| 33R-A-019 | `phase07_prefs_b_edge.spec.ts` | FL-33R-08 | ui |
| 33R-A-020 | `phase07_prefs_b_edge.spec.ts` | FL-33R-08 | ui |
| 33R-A-021 | `phase07_prefs_b_edge.spec.ts` | FL-33R-08 | ui |
| 33R-A-022 | `phase07_prefs_b_edge.spec.ts` | FL-33R-05 | ui |
| 33R-A-023 | `phase07_prefs_b_edge.spec.ts` | FL-33R-05 | ui |
| 33R-A-024 | `phase07_prefs_b_edge.spec.ts` | FL-33R-05 | ui |
| 33R-B-001 | `phase07_prefs_edge.spec.ts` | FL-33R-02 | ui |
| 33R-B-002 | `phase07_prefs_edge.spec.ts` | FL-33R-02 | ui |
| 33R-B-003 | `phase07_prefs_edge.spec.ts` | FL-33R-02 | ui |
| 33R-B-004 | `phase07_prefs_edge.spec.ts` | FL-33R-02 | ui |
| 33R-B-005 | `phase07_prefs_edge.spec.ts` | FL-33R-04 | ui |
| 33R-B-006 | `phase07_prefs_edge.spec.ts` | FL-33R-04 | ui |
| 33R-B-007 | `phase07_prefs_edge.spec.ts` | FL-33R-04 | ui |
| 33R-B-008 | `phase07_prefs_edge.spec.ts` | FL-33R-04 | ui |
| 33R-B-009 | `phase07_prefs_b_edge.spec.ts` | FL-33R-08 | ui |
| 33R-B-010 | `phase07_prefs_b_edge.spec.ts` | FL-33R-08 | ui |
| 33R-B-011 | `phase07_prefs_b_edge.spec.ts` | FL-33R-07 | ui |
| 33R-B-012 | `phase07_prefs_edge.spec.ts` | FL-33R-04 | ui |
| 33R-C-001 | `phase07_prefs_b_edge.spec.ts` | FL-33R-05 | ui |
| 33R-C-002 | `phase07_prefs_edge.spec.ts` | FL-33R-01 | ui |
| 33R-C-003 | `phase07_prefs_b_edge.spec.ts` | FL-33R-08 | ui |
| 33R-C-004 | `phase07_prefs_b_edge.spec.ts` | FL-33R-08 | ui |
| 33R-C-005 | `phase07_prefs_b_edge.spec.ts` | FL-33R-08 | ui |
| 33R-C-006 | `phase07_prefs_b_edge.spec.ts` | FL-33R-08 | ui |
| 33R-C-007 | `phase07_prefs_b_edge.spec.ts` | FL-33R-08 | ui |
| 33R-C-008 | `phase07_prefs_edge.spec.ts` | FL-33R-03 | ui |
| 33R-C-009 | `phase07_prefs_edge.spec.ts` | FL-33R-03 | ui |
| 33R-C-010 | `phase07_prefs_edge.spec.ts` | FL-33R-03 | ui |
| 33R-D-001 | `phase07_prefs_b_edge.spec.ts` | FL-33R-07 | ui |
| 33R-D-002 | `phase07_prefs_b_edge.spec.ts` | FL-33R-06 | ui |
| 33R-D-003 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33R-09 | ui |
| 33R-E-001 | `phase07_prefs_edge.spec.ts` | FL-33R-02 | ui |
| 33R-E-002 | `phase07_prefs_edge.spec.ts` | FL-33R-02 | ui |
| 33R-E-003 | `phase07_prefs_edge.spec.ts` | FL-33R-02 | ui |
| 33R-E-004 | `phase07_prefs_edge.spec.ts` | FL-33R-03 | ui |
| 33R-E-005 | `phase07_prefs_edge.spec.ts` | FL-33R-03 | ui |
| 33R-E-006 | `phase07_prefs_edge.spec.ts` | FL-33R-01 | ui |
| 33R-E-007 | `phase07_prefs_edge.spec.ts` | FL-33R-02 | ui |
| 33R-E-008 | `phase07_prefs_edge.spec.ts` | FL-33R-02 | ui |
| 33R-E-009 | `phase07_prefs_b_edge.spec.ts` | FL-33R-06 | ui |
| 33R-E-010 | `phase07_prefs_edge.spec.ts` | FL-33R-02 | ui |
| 33R-E-011 | `phase07_prefs_b_edge.spec.ts` | FL-33R-08 | ui |
| 33R-E-012 | `phase07_prefs_edge.spec.ts` | FL-33R-02 | ui |
| 33R-F-001 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33R-09 | ui |
| 33R-F-002 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33R-09 | ui |
| 33R-F-003 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33R-09 | ui |
| 33R-F-004 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33R-09 | ui |
| 33R-F-005 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33R-10 | ui |
| 33R-F-006 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33R-10 | ui |
| 33R-F-007 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33R-10 | ui |
| 33R-F-008 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33R-10 | ui |
| 33R-F-009 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33R-10 | ui |
| 33R-G-001 | `phase07_prefs_edge.spec.ts` | FL-33R-03 | ui |
| 33R-G-002 | `phase07_prefs_b_edge.spec.ts` | FL-33R-06 | ui |
| 33R-G-003 | `phase07_prefs_b_edge.spec.ts` | FL-33R-06 | ui |
| 33R-G-004 | `phase07_prefs_b_edge.spec.ts` | FL-33R-08 | ui |
| 33R-G-005 | `phase07_prefs_edge.spec.ts` | FL-33R-03 | ui |
| 33S-A-001 | `phase07_security_edge.spec.ts` | FL-33S-01 | ui |
| 33S-A-002 | `phase07_security_edge.spec.ts` | FL-33S-04 | ui |
| 33S-A-003 | `phase07_security_edge.spec.ts` | FL-33S-04 | ui |
| 33S-A-004 | `phase07_security_edge.spec.ts` | FL-33S-04 | ui |
| 33S-A-005 | `phase07_security_edge.spec.ts` | FL-33S-04 | ui |
| 33S-A-006 | `phase07_security_edge.spec.ts` | FL-33S-04 | ui |
| 33S-A-007 | `phase07_security_edge.spec.ts` | FL-33S-03 | ui |
| 33S-A-008 | `phase07_security_edge.spec.ts` | FL-33S-03 | ui |
| 33S-A-009 | `phase07_security_edge.spec.ts` | FL-33S-03 | ui |
| 33S-A-010 | `phase07_security_edge.spec.ts` | FL-33S-03 | ui |
| 33S-A-011 | `phase07_security_edge.spec.ts` | FL-33S-03 | ui |
| 33S-A-012 | `phase07_security_edge.spec.ts` | FL-33S-04 | ui |
| 33S-A-013 | `phase07_security_edge.spec.ts` | FL-33S-02 | ui |
| 33S-A-014 | `phase07_security_edge.spec.ts` | FL-33S-02 | ui |
| 33S-A-015 | `phase07_security_edge.spec.ts` | FL-33S-03 | ui |
| 33S-A-016 | `phase07_security_b_edge.spec.ts` | FL-33S-05 | ui |
| 33S-A-017 | `phase07_security_b_edge.spec.ts` | FL-33S-05 | ui |
| 33S-A-018 | `phase07_security_b_edge.spec.ts` | FL-33S-05 | ui |
| 33S-A-019 | `phase07_security_b_edge.spec.ts` | FL-33S-05 | ui |
| 33S-A-020 | `phase07_security_b_edge.spec.ts` | FL-33S-05 | ui |
| 33S-A-021 | `phase07_security_mocked_edge.spec.ts` | FL-33S-08 | ui |
| 33S-A-022 | `phase07_security_mocked_edge.spec.ts` | FL-33S-08 | ui |
| 33S-A-023 | `phase07_security_mocked_edge.spec.ts` | FL-33S-08 | ui |
| 33S-A-024 | `phase07_security_mocked_edge.spec.ts` | FL-33S-08 | ui |
| 33S-B-001 | `phase07_security_edge.spec.ts` | FL-33S-01 | ui |
| 33S-B-002 | `phase07_security_edge.spec.ts` | FL-33S-01 | ui |
| 33S-B-003 | `phase07_security_edge.spec.ts` | FL-33S-01 | ui |
| 33S-B-004 | `phase07_security_edge.spec.ts` | FL-33S-01 | ui |
| 33S-B-005 | `phase07_security_edge.spec.ts` | FL-33S-01 | ui |
| 33S-B-006 | `phase07_security_edge.spec.ts` | FL-33S-01 | ui |
| 33S-B-007 | `phase07_security_edge.spec.ts` | FL-33S-01 | ui |
| 33S-B-008 | `phase07_security_b_edge.spec.ts` | FL-33S-06 | ui |
| 33S-B-009 | `phase07_security_edge.spec.ts` | FL-33S-04 | ui |
| 33S-B-010 | `phase07_security_b_edge.spec.ts` | FL-33S-05 | ui |
| 33S-B-011 | `phase07_security_edge.spec.ts` | FL-33S-04 | ui |
| 33S-B-012 | `phase07_security_edge.spec.ts` | FL-33S-02 | ui |
| 33S-B-013 | `phase07_security_b_edge.spec.ts` | FL-33S-05 | ui |
| 33S-C-001 | `phase07_security_edge.spec.ts` | FL-33S-01 | ui |
| 33S-C-002 | `phase07_security_edge.spec.ts` | FL-33S-01 | ui |
| 33S-C-003 | `phase07_security_edge.spec.ts` | FL-33S-01 | ui |
| 33S-C-004 | `phase07_security_edge.spec.ts` | FL-33S-01 | ui |
| 33S-C-005 | `phase07_security_edge.spec.ts` | FL-33S-01 | ui |
| 33S-C-006 | `phase07_security_edge.spec.ts` | FL-33S-01 | ui |
| 33S-C-007 | `phase07_security_edge.spec.ts` | FL-33S-01 | ui |
| 33S-C-008 | `phase07_security_b_edge.spec.ts` | FL-33S-07 | ui |
| 33S-C-009 | `phase07_security_b_edge.spec.ts` | FL-33S-07 | ui |
| 33S-C-010 | `phase07_security_b_edge.spec.ts` | FL-33S-07 | ui |
| 33S-C-011 | `phase07_security_mocked_edge.spec.ts` | FL-33S-08 | ui |
| 33S-C-012 | `phase07_security_mocked_edge.spec.ts` | FL-33S-08 | ui |
| 33S-C-013 | `phase07_security_mocked_edge.spec.ts` | FL-33S-08 | ui |
| 33S-C-014 | `phase07_security_edge.spec.ts` | FL-33S-03 | ui |
| 33S-C-015 | `phase07_security_mocked_edge.spec.ts` | FL-33S-08 | ui |
| 33S-D-001 | `phase07_security_b_edge.spec.ts` | FL-33S-06 | ui |
| 33S-D-002 | `phase07_security_b_edge.spec.ts` | FL-33S-06 | ui |
| 33S-D-003 | `phase07_security_b_edge.spec.ts` | FL-33S-06 | ui |
| 33S-E-001 | `phase07_security_edge.spec.ts` | FL-33S-02 | ui |
| 33S-E-002 | `phase07_security_edge.spec.ts` | FL-33S-02 | ui |
| 33S-E-003 | `phase07_security_edge.spec.ts` | FL-33S-02 | ui |
| 33S-E-004 | `phase07_security_edge.spec.ts` | FL-33S-04 | ui |
| 33S-E-005 | `phase07_security_edge.spec.ts` | FL-33S-02 | ui |
| 33S-E-006 | `phase07_security_edge.spec.ts` | FL-33S-02 | ui |
| 33S-E-007 | `phase07_security_edge.spec.ts` | FL-33S-03 | ui |
| 33S-E-008 | `phase07_security_edge.spec.ts` | FL-33S-02 | ui |
| 33S-E-009 | `phase07_security_edge.spec.ts` | FL-33S-02 | ui |
| 33S-F-001 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33S-09 | ui |
| 33S-F-002 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33S-09 | ui |
| 33S-F-003 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33S-09 | ui |
| 33S-F-004 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33S-10 | ui |
| 33S-F-005 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33S-10 | ui |
| 33S-F-006 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33S-10 | ui |
| 33S-F-007 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33S-10 | ui |
| 33S-F-008 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33S-10 | ui |
| 33S-F-009 | `phase07_*_ui.spec.ts` (P4, pending merge) | FL-33S-09 | ui |
| 33S-G-001 | `phase07_security_edge.spec.ts` | FL-33S-03 | ui |
| 33S-G-002 | `phase07_security_edge.spec.ts` | FL-33S-03 | ui |
| 33S-G-003 | `phase07_security_edge.spec.ts` | FL-33S-03 | ui |
| 33S-G-004 | `phase07_security_b_edge.spec.ts` | FL-33S-05 | ui |
| 33S-G-005 | `phase07_security_b_edge.spec.ts` | FL-33S-07 | ui |
| 33S-G-007 | `phase07_security_edge.spec.ts` | FL-33S-04 | ui |
