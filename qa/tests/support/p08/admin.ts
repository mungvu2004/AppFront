/**
 * Phase 08 shared helper for SCR-34..37 (admin: Model Library, Training Jobs, Model Registry, User Management).
 * No spec imports another spec. Short names for sources under `src/screens/admin/`: ML ModelLibrary/ModelLibrary.tsx,
 * MLD ModelLibrary/ModelLibraryDetail.tsx, TJ TrainingJobs/TrainingJobs.tsx, MR ModelRegistry/ModelRegistry.tsx,
 * UM UserManagement/UserManagement.tsx, UMD UserManagement/UserManagementDetail.tsx, UMH UserManagement/useUserManagement.ts,
 * EP src/api/endpoints.ts, MC src/api/adminMlClient.ts. Gateway = AppBack `apps/api/admin_ml_registry/router.py`.
 *
 * Exports:
 *   DESKTOP_VIEWPORTS, DESKTOP                       1920/1440/1024/768 (no 375), 1440x900
 *   ROUTES                                           { library, jobs, registry, users } (paths from src/routes/paths.ts)
 *   API                                              main read endpoint regex per screen; FAMILIES_PATH, familyActivePath(f), familyActiveRe(f)
 *   TITLE, BREADCRUMB_NAV, heading(page, screen)     page headings (library/users: breadcrumb current item, no h1)
 *   DETAIL, CLOSE, MODAL, dialog(page, name?)        detail panel names, close buttons, shared modals
 *   panel(page, label), detailPanel(page, screen)    aside[aria-label=...]
 *   openDetail(page, trigger, screen)                click trigger, wait for the panel, return it
 *   closeTopLayer(page)                              Esc (A12 closes the top layer)
 *   openAdmin(page, screen): Promise<unknown>        goto + wait for the main read 200, returns its parsed body
 *   adminApi(): Promise<APIRequestContext>           signed-in admin client (E2E_ADMIN_EMAIL/PASSWORD); caller disposes
 *   recordActiveVersions(api): Promise<ActiveSnapshot>
 *   restoreActiveVersions(api, snapshot)             PUT each changed family back; call in `finally`
 *   holdResponse(page, urlGlob, method)              { seen, release() } holds the REAL response
 *   adminUser(admin, slot, role = 'engineer')        pool user (own slot)
 *   signInAdminUser(context, user)                   1 login through the context's cookie jar
 *
 * Usage:
 *   const api = await adminApi();
 *   const snap = await recordActiveVersions(api);
 *   try { const body = await openAdmin(page, 'registry'); ... } finally { await restoreActiveVersions(api, snap); await api.dispose(); }
 * Phase 08 is desktop/tablet only; there is no phone viewport.
 */
import { expect } from '@playwright/test';
import type { APIRequestContext, BrowserContext, Locator, Page, Request, Route } from '@playwright/test';

import { ROUTES as APP_ROUTES } from '../../../../e2e/fixtures/routes';
import { navigateThenWaitForApi } from '../../../../e2e/fullstack/apiWatch';
import { signedInApi } from '../api';
import { readAdminCredentials } from '../auth';
import { poolUser, signInPoolUser, type PoolRole, type PoolUser } from '../phase03Seed';

/* ---------------------------------------------------------------- viewports */

/** The only viewports of phase 08 (desktop + tablet; no 375). */
export const DESKTOP_VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
] as const;
export const DESKTOP = { width: 1440, height: 900 } as const;

/* ---------------------------------------------------------------- routes + endpoints */

export const ROUTES = {
  library: APP_ROUTES.adminModels, // src/routes/paths.ts:68 (/admin/models)
  jobs: APP_ROUTES.adminTrainingJobs, // paths.ts:69 (/admin/training/jobs)
  registry: APP_ROUTES.adminTrainingModels, // paths.ts:70 (/admin/training/models)
  users: APP_ROUTES.adminUsers, // paths.ts:71 (/admin/users)
} as const;
export type AdminScreen = keyof typeof ROUTES;

/** Main read of each screen, matched on the pathname (EP:132-133 library, EP:75 jobs, EP:69 families, EP:325 users). */
export const API: Readonly<Record<AdminScreen, RegExp>> = {
  library: /^\/api\/library$/u,
  jobs: /^\/api\/admin\/ml\/training-jobs$/u,
  registry: /^\/api\/admin\/ml\/model-families$/u,
  users: /^\/api\/users$/u,
};
export const FAMILIES_PATH = '/admin/ml/model-families'; // EP:69, BE router.py GET (N23)
export const familyActivePath = (family: string): string => `${FAMILIES_PATH}/${family}/active`; // EP:70, BE router.py PUT (N24)
export const familyActiveRe = (family: string): RegExp => new RegExp(`^/api${familyActivePath(family)}$`, 'u');

/* ---------------------------------------------------------------- copy */

/** Page heading per screen. Library and Users have no h1: their page title is the breadcrumb current item. */
export const TITLE = {
  library: 'Thư viện model', // ML:38 BREADCRUMB_CURRENT (no h1)
  jobs: 'Huấn luyện model AI', // TJ:30 (h1, TJ:55)
  registry: 'Model AI của chuỗi xử lý', // MR:29 (h1, MR:58)
  users: 'Người dùng', // UMH:134 breadcrumbUsers (aria-current="page", UM:~64; no h1)
} as const;
export const BREADCRUMB_NAV = 'Đường dẫn trang'; // ML:36, TJ:48, MR:51, UM:49

/** Heading locator of a screen: h1 for jobs/registry, breadcrumb current item for library/users. */
export const heading = (page: Page, screen: AdminScreen): Locator =>
  screen === 'jobs' || screen === 'registry'
    ? page.getByRole('heading', { level: 1, name: TITLE[screen], exact: true })
    : page.getByRole('navigation', { name: BREADCRUMB_NAV }).getByText(TITLE[screen], { exact: true });

/** aria-label of each detail panel (aside on desktop; below the aside breakpoint it is a drawer - verify per spec). */
export const DETAIL = {
  library: 'Chi tiết model', // MLD:293
  jobs: 'Chi tiết lượt huấn luyện', // TJ:39,121
  registry: 'Chi tiết phiên bản', // MR:40,208
  users: 'Chi tiết người dùng', // UMD:370
} as const;
export const CLOSE = {
  library: 'Đóng panel chi tiết model', // MLD:306
  users: 'Đóng chi tiết người dùng', // UMD:106
  jobs: 'Đóng', // UNKNOWN — NEED VERIFICATION (TrainingJobDetail.tsx has no panel close button found; close with Esc)
  registry: 'Đóng', // UNKNOWN — NEED VERIFICATION (ModelRegistryDetail.tsx has no close button found; close with Esc)
} as const;

/** Shared modals / dialogs (opened by their trigger; never confirmed here). */
export const MODAL = {
  permissionMatrix: 'Ma trận quyền theo vai trò', // UM:51 (Modal title)
  createJob: 'Tạo lượt huấn luyện', // TrainingJobForm.tsx:19 (close button 'Đóng', :25)
  activate: 'Kích hoạt', // UNKNOWN — NEED VERIFICATION (title is dialog.title from the view model, ModelRegistryActivateDialog.tsx:26; text copied from spec)
} as const;
export const dialog = (page: Page, name?: string): Locator => (name === undefined ? page.getByRole('dialog') : page.getByRole('dialog', { name }));

/* ---------------------------------------------------------------- panels */

export const panel = (page: Page, label: string): Locator => page.locator(`aside[aria-label="${label}"]`); // TJ:121, MR:208
export const detailPanel = (page: Page, screen: AdminScreen): Locator => panel(page, DETAIL[screen]);

/** Clicks `trigger` (a table row button) and waits for the detail panel. */
export async function openDetail(page: Page, trigger: Locator, screen: AdminScreen): Promise<Locator> {
  await trigger.click();
  const detail = detailPanel(page, screen);
  await expect(detail).toBeVisible();
  return detail;
}

/** Esc closes the top layer (A12). */
export const closeTopLayer = (page: Page): Promise<void> => page.keyboard.press('Escape');

/* ---------------------------------------------------------------- navigation */

/** goto the screen, wait for its main read (200) and return the parsed body. */
export async function openAdmin(page: Page, screen: AdminScreen): Promise<unknown> {
  const { json } = await navigateThenWaitForApi(page, () => page.goto(ROUTES[screen], { waitUntil: 'commit' }), 'GET', API[screen], [200]);
  return json;
}

/* ---------------------------------------------------------------- api */

/** Signed-in Track A admin (1 real login: count it in the rate-limit budget). Caller disposes. */
export async function adminApi(): Promise<APIRequestContext> {
  const { email, password } = readAdminCredentials();
  return signedInApi(email, password);
}

export type ActiveSnapshot = Readonly<Record<string, string | null>>;
interface FamilyWire {
  readonly family: string;
  readonly activeVersionId?: string;
  readonly revision: number;
}

async function readFamilies(api: APIRequestContext): Promise<FamilyWire[]> {
  const res = await api.get(`/api${FAMILIES_PATH}`);
  expect(res.status(), `GET ${FAMILIES_PATH}`).toBe(200);
  return ((await res.json()) as { items: FamilyWire[] }).items; // BE ModelFamilyPage, MC listFamilies
}

/** family -> activeVersionId (null = classic path). Call BEFORE any activation. */
export async function recordActiveVersions(api: APIRequestContext): Promise<ActiveSnapshot> {
  return Object.fromEntries((await readFamilies(api)).map((f) => [f.family, f.activeVersionId ?? null]));
}

/**
 * PUT every family whose active version differs from `snapshot` back to it. Body (MC:121-125, SetActiveModelVersion):
 * `{ baseVersion: <family.revision>, body: { versionId } }`. versionId null is valid only for wallSegmentation (adminMl.ts:32).
 */
export async function restoreActiveVersions(api: APIRequestContext, snapshot: ActiveSnapshot): Promise<void> {
  for (const f of await readFamilies(api)) {
    const want = snapshot[f.family];
    if (want === undefined || want === (f.activeVersionId ?? null)) continue;
    const res = await api.put(`/api${familyActivePath(f.family)}`, { data: { baseVersion: f.revision, body: { versionId: want } } });
    expect(res.status(), `restore ${f.family}: ${(await res.text()).slice(0, 200)}`).toBe(200);
  }
}

/* ---------------------------------------------------------------- hold a response */

/**
 * Holds the REAL response of the first `method` request matching `urlGlob`: it is fetched upstream at once and fulfilled
 * only on `release()`. `seen` resolves with the request when intercepted. The route is removed on release.
 */
export async function holdResponse(
  page: Page,
  urlGlob: string,
  method: string,
): Promise<{ readonly seen: Promise<Request>; release: () => Promise<void> }> {
  let onSeen: (req: Request) => void = () => undefined;
  const seen = new Promise<Request>((resolve) => {
    onSeen = resolve;
  });
  let letGo: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    letGo = resolve;
  });
  let held: Promise<void> | undefined;
  const handler = async (route: Route): Promise<void> => {
    if (route.request().method() !== method || held !== undefined) {
      await route.fallback();
      return;
    }
    onSeen(route.request());
    held = (async () => {
      const real = await route.fetch();
      await gate;
      await route.fulfill({ response: real });
    })();
    await held;
  };
  await page.route(urlGlob, handler);
  return {
    seen,
    release: async () => {
      letGo();
      await held;
      await page.unroute(urlGlob, handler);
    },
  };
}

/* ---------------------------------------------------------------- pool users */

export const adminUser = (admin: APIRequestContext, slot: string, role: PoolRole = 'engineer'): Promise<PoolUser> => poolUser(admin, role, slot);
export const signInAdminUser = (context: BrowserContext, user: PoolUser): Promise<void> => signInPoolUser(context, user);
