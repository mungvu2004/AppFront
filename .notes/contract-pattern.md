# Screen Pattern Contract — T3 Survey

This document records the six-file shape, container structure, seven states, and assertion suite for the screen pattern as it exists in the F/AppFront repository. The authoritative rules are in LUAT_MAN_HINH.md (R-59 through R-73) and CLAUDE.md (sections A, D, E).

Reference screens used for this survey:
- `src/screens/project/ProjectSettings/` (full reference, matches Phần 1 of LUAT_MAN_HINH)
- `src/screens/account/AccountSettings/` (patterns beyond the six files)
- `src/screens/project/CreateProjectModal/` (container and modal pattern)
- `src/screens/auth/AuthScreen/` (route and alternative patterns)
- `src/screens/dashboard/ProjectDashboard/` (implied by R-73 discussion)

---

## (a) THE SIX-FILE SHAPE (R-59)

### Reference: `src/screens/project/ProjectSettings/`

The six-file foundation of every screen:

#### 1. **`index.ts`** — Re-exports for clean importing

```typescript
// src/screens/project/ProjectSettings/index.ts
export { ProjectSettings, ProjectSettingsConnected, ProjectSettingsView } from './ProjectSettings';
export type { ProjectSettingsProps } from './ProjectSettings';
export { ProjectSettingsContainer, ProjectSettingsRoute } from './ProjectSettings.container';
export type { ProjectSettingsContainerProps } from './ProjectSettings.container';
export { projectSettingsQueryKey, toSaveState, useProjectSettings } from './useProjectSettings';
export type {
  ProjectSettingsActions,
  ProjectSettingsDangerAction,
  ProjectSettingsMemberRow,
  ProjectSettingsModel,
  ProjectSettingsProblems,
  ProjectSettingsTabId,
  ProjectSettingsTabModel,
  ProjectSettingsViewProps,
  UseProjectSettingsOptions,
} from './useProjectSettings';
export { createAppProjectSettingsGateway, createProjectSettingsGateway } from './projectSettingsGateway';
export type { /* ...types... */ } from './projectSettingsGateway';
```

**Responsibility:** Re-exports the three primary exports (`View`, `Container`, `hook`) + types. Any gateway file and type file are also re-exported. A caller importing from this directory uses exactly one import path (`@/screens/project/ProjectSettings`).

#### 2. **`<Name>.tsx`** — Pure view component

Example: `ProjectSettings.tsx` (470+ lines) takes `ProjectSettingsViewProps` and renders, period.

```typescript
// Invariant mục D: receives props and renders only
export function ProjectSettingsView(props: ProjectSettingsViewProps): JSX.Element {
  return (
    <div className="...">
      {/* all data and handlers are props; no store, no domain, no API */}
    </div>
  );
}

export interface ProjectSettingsProps {
  readonly state: SevenState;
  readonly isLoading: boolean;
  readonly canEdit: boolean;
  // ... full props payload
}
```

**Imports:** Components from `@/components`, type from `@/lib/testing/sevenStateScenarios` for the `SevenState` type. **Forbidden:** any import from `src/api`, `src/store`, `src/domain`, `src/lib/http`. Enforced by `local/no-data-layer-in-view` ESLint rule (R-60).

**When view exceeds 400 lines (R-22):** Subsection files are split (e.g., `GeneralTab.tsx`, `DangerZoneTab.tsx`) and imported into the view. These sibling files are **not** part of the six-file count; they are fragments of the view file.

#### 3. **`use<Name>.ts`** — Hook that owns the logic

Example: `useProjectSettings.ts` (350+ lines)

```typescript
export function useProjectSettings(options: UseProjectSettingsOptions): ProjectSettingsViewProps {
  const gateway = options.gateway;
  const queryClient = useQueryClient();
  
  // Orchestrates: query (via @tanstack/react-query)
  const query = useQuery({ queryKey: [projectSettingsQueryKey], ... });
  
  // Orchestrates: autosave (via src/lib/autosave)
  const autosave = useMemo(() => createAutosave({ ... }), [...]);
  
  // Orchestrates: undo (via src/lib/mutations/undoTicket)
  const undo = useMemo(() => createUndoTicket({ ... }), [...]);
  
  // Formats numbers/measurements for display (A15: all formatting happens here)
  const formatted = {
    areaUnitLabel: `mét vuông — ví dụ ${formatArea(...)}`,
    snapToleranceLabel: formatLength(model.snapToleranceMm),
  };
  
  return { state, isLoading, ..., ...formatted };
}

export type UseProjectSettingsOptions = {
  readonly gateway: ProjectSettingsGateway;
  readonly projectId: string;
  readonly roles?: readonly ProjectRole[];
  readonly onToast?: (toast: ToastRecord) => void;
  readonly onProjectDeleted?: () => void;
  readonly forceCollapsed?: boolean;
};
```

**Responsibility:** Wires the six data/logic modules (`@tanstack/react-query`, `src/lib/autosave`, `src/lib/mutations`, `src/lib/format`, `src/domain` functions, `src/store` if needed). Returns props-shaped data only. Every number, date, and string a user reads is formatted here using token functions from `src/lib/format/**`.

**Pattern:** Receives a **gateway** (dependency injection). Does not call `useToast()` or `useNavigate()` — these are injected as optional callback props (R-73).

#### 4. **`<Name>.container.tsx`** — Wires hook to view + error boundary

Example: `ProjectSettings.container.tsx` (139 lines)

```typescript
// Two exported shapes:

/** The minimal wiring layer — hook + view, no providers yet. */
export function ProjectSettingsContainer(props: ProjectSettingsContainerProps) {
  return (
    <ScreenErrorBoundary
      screenId="project-settings"
      renderFallback={({ report, retry }) => <ProjectSettingsCrashFallback {...} />}
    >
      <WiredProjectSettings {...props} />
    </ScreenErrorBoundary>
  );
}

export interface ProjectSettingsContainerProps {
  readonly projectId: string;
  readonly roles?: readonly ProjectRole[];
  readonly onToast?: (toast: ToastRecord) => void;
  readonly onProjectDeleted?: () => void;
  readonly forceCollapsed?: boolean;
}

/** Router integration — adds Toast.Provider and reads URL params. */
export function ProjectSettingsRoute() {
  const { id } = useParams<{ id: string }>();
  const session = useSession();
  
  return (
    <Toast.Provider>
      <ProjectSettingsRouteBody projectId={id} {...} />
    </Toast.Provider>
  );
}

/** Internal helper — where hook and view meet. */
function WiredProjectSettings(props: ProjectSettingsContainerProps) {
  const gateway = useMemo(() => createAppProjectSettingsGateway(), []);
  const model = useProjectSettings({ gateway, projectId: props.projectId, ... });
  return <ProjectSettingsView {...model} />;
}
```

**Exports:** Two functions—
1. **`<Name>Container`** — the workhorse. Accepts props, wraps view in `ScreenErrorBoundary`, returns a component any other screen can open. Does **not** call `useParams()` or `useToast()`.
2. **`<Name>Route`** — registered in the router. Knows about URL params, `Toast.Provider`, and navigation.

**Error boundary:** Uses `ScreenErrorBoundary` from `src/components/feedback` (not `src/lib/screen-state`). The fallback renders `EmptyState` with text from `report.description` (R-62).

#### 5. **`<Name>.stories.tsx`** — Seven story objects, one per state

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { ProjectSettingsView } from './ProjectSettings';
import type { ProjectSettingsViewProps } from './useProjectSettings';

const meta = {
  title: 'Screens/Project/ProjectSettings',
  component: ProjectSettingsView,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof ProjectSettingsView>;

export default meta;
type Story = StoryObj<typeof meta>;

// Render the VIEW only, never the container; no providers, no gateway.

export const Empty: Story = {
  args: { state: 'empty', floorCount: 0, ... },
};

export const Loading: Story = {
  args: { state: 'loading', name: '', members: [], ... },
};

export const Partial: Story = {
  args: { state: 'partial', saveState: 'saving', ... },
};

export const Error: Story = {
  args: { state: 'error', errorMessage: 'Lỗi đã xảy ra', ... },
};

export const Success: Story = {
  args: { state: 'success', saveState: 'saved', ... },
};

export const Forbidden: Story = {
  args: { state: 'forbidden', canEdit: false, ... },
};

export const Collapsed: Story = {
  args: { state: 'success', isCollapsed: true, ... },
};
```

**Story names:** Exact seven, in the order of `SEVEN_STATES` — `Empty`, `Loading`, `Partial`, `Error`, `Success`, `Forbidden`, `Collapsed`. These names must match the `SevenState` discriminant values (mục C below).

#### 6. **`<Name>.test.tsx`** — Assertion suite

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderWithProviders } from '@/lib/testing/render';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { SEVEN_STATES } from '@/lib/testing/sevenStateScenarios';
import { ProjectSettings, ProjectSettingsView } from './ProjectSettings';
import { createProjectSettingsGateway } from './projectSettingsGateway';

// R-63: The view must render all seven states without throwing or going blank.
it('renders all seven states of A11', async () => {
  expectSevenStates(
    (scenario) => {
      const { container, unmount } = renderWithProviders(
        <ProjectSettingsView {...scenario} />
      );
      return { container, unmount };
    },
    [Empty.args, Loading.args, Partial.args, Error.args, Success.args, Forbidden.args, Collapsed.args],
  );
});

// R-72: Keyboard is first-class; the screen must survive a full accessibility audit.
it('is accessible by keyboard and screen reader', async () => {
  renderWithProviders(<ProjectSettingsView {...Success.args} />);
  expectAccessible({ requireResolvedContrast: true });
});

// R-72: All visible text must be Vietnamese, properly accented.
it('uses Vietnamese correctly', async () => {
  renderWithProviders(<ProjectSettingsView {...Success.args} />);
  expectVietnamese();
});

// Verify the test file itself isn't using raw colours.
it('contains no hardcoded colours', async () => {
  expectNoRawColor();
});
```

### Beyond the six files: Gateway and section files

`ProjectSettings` also has:
- **`projectSettingsGateway.ts`** — Dependency-injectable interface and factory. The hook receives this as a prop; tests inject a mock; the container wires the real one.
- **`useProjectSettings.ts`** — The hook (listed above as file 3).
- **`GeneralTab.tsx`, `UnitsTab.tsx`, `MembersTab.tsx`, `DangerZoneTab.tsx`** — Subsection views, imported into the main view. When a view exceeds ~400 lines, its major sections are split into sibling files and imported back in. `index.ts` does not re-export them; they are internal.

`AccountSettings` follows the same pattern with multiple section files:
- `ProfileSection.tsx`, `PasswordSection.tsx`, `AppearanceSection.tsx`, etc.
- `useAccountSettings.ts`, `useAccountAuth.ts`, `useAccountPreferences.ts`, `useAccountTables.ts` (multiple hooks, each handling a subsection)
- `accountSettingsGateway.ts`, `accountAuthGateway.ts` (gateways split by domain)

**Pattern:** The six files are immutable. Section files and additional hooks/gateways are grouped in the same directory, all re-exported through `index.ts`.

---

## (b) THE CONTAINER (R-62, R-73)

### The ScreenErrorBoundary pattern (R-62)

All containers wrap their view in `ScreenErrorBoundary` from `src/components/feedback`:

```typescript
import { ScreenErrorBoundary, type ScreenErrorFallback } from '@/components/feedback/ScreenErrorBoundary';

function ProjectSettingsCrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg-app">
      <EmptyState
        icon={<div className="h-8 w-8 rounded-full bg-state-violation-tint" aria-hidden="true" />}
        title={report.description.title}
        description={report.description.description}
        {...(report.retryable ? { action: { label: report.description.primaryButtonLabel, onClick: retry } } : {})}
      />
    </div>
  );
}

export function ProjectSettingsContainer(props: ProjectSettingsContainerProps) {
  return (
    <ScreenErrorBoundary
      screenId="project-settings"
      renderFallback={({ report, retry }) => <ProjectSettingsCrashFallback report={report} retry={retry} />}
    >
      <WiredProjectSettings {...props} />
    </ScreenErrorBoundary>
  );
}
```

**Shape:** The boundary is mounted at the top of the container. If any descendant throws, it catches the error, renders the fallback (using text from `report.description`), and shows a "retry" button if the error is retryable.

**Not the one in `src/lib/screen-state/`:** There are two files with similar names; the one in `src/components/feedback` is the one that is wired up in `src/App.tsx`. The one in `src/lib` is not currently used anywhere.

### Container props (R-73): Opening without writing logic

The container accepts enough props that **any other screen can open it with a single line, no extra wiring needed**.

Example from `CreateProjectModal.container.tsx`:

```typescript
export interface CreateProjectModalContainerProps {
  readonly isOpen: boolean;
  readonly onDismiss: () => void;
  readonly onCreated?: (projectId: string) => void;
  readonly onToast?: (toast: { readonly message: string; readonly onUndo?: () => void }) => void;
  readonly role?: ProjectRole;
  readonly forceCompact?: boolean;
}

/** Mounted from ProjectDashboard like this: */
export function ProjectSettingsContainer(props: ProjectSettingsContainerProps) {
  return (
    <ScreenErrorBoundary {...}>
      <WiredProjectSettings {...props} />
    </ScreenErrorBoundary>
  );
}

// Used in ProjectDashboard:
// <CreateProjectModalContainer 
//   isOpen={isModalOpen} 
//   onDismiss={closeModal} 
//   onToast={addToast} 
// />
```

**Rule:** The container **does not** call `useToast()`, `useNavigate()`, `useParams()`, or `useSession()`. These are passed in as props:
- **`onToast`** — injected by the parent which already has `Toast.Provider`
- **`onDismiss` / `onCreated`** — callbacks to orchestrate navigation or state
- **`projectId` / `roles`** — passed from the route or from the opening screen

This guarantees any screen can open any container without additional setup.

### Example: How CreateProjectModal is opened

From `ProjectDashboard`:

```typescript
const [isModalOpen, setIsModalOpen] = useState(false);

return (
  <Toast.Provider>
    <ProjectDashboardView
      isOpen={isModalOpen}
      onOpenCreateModal={() => setIsModalOpen(true)}
      onCreateProject={(projectId) => {
        setIsModalOpen(false);
        navigate(ROUTES.project.settings(projectId));
      }}
    />
    <CreateProjectModalContainer
      isOpen={isModalOpen}
      onDismiss={() => setIsModalOpen(false)}
      onCreated={(projectId) => /* callback passed into view */}
      onToast={addToast}
    />
  </Toast.Provider>
);
```

---

## (c) THE SEVEN STATES (R-63, A11)

### The SevenState type and union

From `src/lib/testing/sevenStateScenarios.ts`:

```typescript
export const SEVEN_STATES = [
  'empty',      // rỗng — no rows, no load in progress
  'loading',    // đang tải — initial fetch in flight
  'partial',    // một phần — some rows loaded, more to come
  'error',      // lỗi — fetch failed, error shown
  'success',    // thành công — all rows loaded and displayed
  'forbidden',  // không có quyền — user lacks permission
  'collapsed',  // thu gọn — responsive state (UI minimized)
] as const;

export type SevenState = (typeof SEVEN_STATES)[number];

export const SEVEN_STATE_LABELS: Readonly<Record<SevenState, string>> = {
  empty: 'rỗng',
  loading: 'đang tải',
  partial: 'một phần',
  error: 'lỗi',
  success: 'thành công',
  forbidden: 'không có quyền',
  collapsed: 'thu gọn',
};
```

### SevenStateScenario shape

```typescript
export interface SevenStateScenario {
  readonly state: SevenState;
  readonly label: string;  // Vietnamese name for error messages
  readonly rows: readonly SevenStateRow[];
  readonly totalCount: number;  // Total rows, including unloaded
  readonly isLoading: boolean;
  readonly isCollapsed: boolean;
  readonly canView: boolean;  // false only in 'forbidden' state
  readonly error: unknown;    // Non-null only in 'error' state
}

export interface SevenStateRow {
  readonly id: string;
  readonly label: string;
}
```

### expectSevenStates signature and behavior

```typescript
export function expectSevenStates(
  renderScreen: ScreenRenderer,
  scenarios: readonly SevenStateScenario[],
): void;

export type ScreenRenderer = (scenario: SevenStateScenario) => ScreenRenderResult;

export interface ScreenRenderResult {
  readonly container: HTMLElement;
  readonly unmount?: () => void;
}
```

**What it checks:**
1. Exactly one scenario exists per state—no missing, no duplicates.
2. Rendering each scenario does not throw.
3. The resulting container is not blank (at least one child element or text).

**What it does NOT check:**
- The shape of the UI for each state (that's the story visual pass).
- That the state transitions correctly (that's an integration test).
- Text content or specific elements (too specific; varies per screen).

The function throws with a Vietnamese error message naming the state that failed (e.g., `"expectSevenStates: thiếu 1 trong bảy trạng thái — "đang tải""`).

### How a test calls it

From `ProjectSettings.test.tsx`:

```typescript
it('renders all seven states without throwing or going blank (A11, R-63)', () => {
  expectSevenStates(
    (scenario) => {
      const { container, unmount } = renderWithProviders(
        <ProjectSettingsView {...scenario} />
      );
      return { container, unmount };
    },
    SEVEN_STATES.map((state) => {
      switch (state) {
        case 'empty':
          return { state: 'empty', label: 'rỗng', rows: [], totalCount: 0, isLoading: false, isCollapsed: false, canView: true, error: null };
        case 'loading':
          return { state: 'loading', label: 'đang tải', rows: [], totalCount: 48, isLoading: true, isCollapsed: false, canView: true, error: null };
        // ... etc. for all seven
      }
    }),
  );
});
```

### Seven story names

Stories are named exactly after the `SevenState` values (in English, capitalized):
- `Empty`
- `Loading`
- `Partial`
- `Error`
- `Success`
- `Forbidden`
- `Collapsed`

---

## (d) THE ASSERTION SUITE (R-72)

### expectSevenStates (already covered above)

### expectAccessible

**Signature:**
```typescript
export function expectAccessible(options?: AccessibilityOptions): void;

export interface AccessibilityOptions {
  /** When set, a text run with no resolvable color fails rather than being skipped. */
  readonly requireResolvedContrast?: boolean;
}

export interface AccessibilityReport {
  /** Total issues found. */
  readonly issueCount: number;
  /** Text runs where colour could not be resolved (Tailwind classes under jsdom). */
  readonly unresolvedContrast: number;
  /** Other findings. */
  readonly issues: AccessibilityIssue[];
}
```

**What it checks:**
1. **Interactive elements have accessible names** — via `aria-label`, `aria-labelledby`, a bound `<label>`, their own text, `title`, or `placeholder`. Icon-only buttons without `aria-label` fail.
2. **Images have `alt` attributes** — `alt=""` for decorative, `alt="description"` for content. An `<img>` with no `alt` attribute at all fails.
3. **Focus rings are visible** — `outline-none` without a ring class fails; a ring without `ring-offset-2` fails (A12 requires 2px offset). **Known issue:** `Slider.tsx` and `Textarea.tsx` have state-driven rings that fail this check (see section e below).
4. **Text contrasts meet WCAG standards** — 4.5:1 for body text, 3:1 for captions, using WCAG relative-luminance formula.
5. **No hand-arranged tab order** — `tabindex > 0` reorders the whole page; `tabindex="-1"` on an actual control hides it from keyboard. Exception: `data-roving-focus` on list items.

**Known blind spot:** Under jsdom (used by Vitest), stylesheets don't load, so Tailwind classes resolve to nothing. The function skips those contrast checks and reports them in `unresolvedContrast`. With `requireResolvedContrast: true`, a screen that skips any contrast check fails the test — this forces visual testing for contrast via Playwright.

**Usage:**
```typescript
it('is accessible (A12, A13, R-72)', () => {
  renderWithProviders(<ProjectSettingsView {...Success.args} />);
  expectAccessible({ requireResolvedContrast: true });
});
```

### expectVietnamese

**Signature:**
```typescript
export function expectVietnamese(options?: VietnameseOptions): void;

export interface VietnameseOptions {
  /** When false, skip text runs with no diacritics. */
  readonly requireDiacritics?: boolean;  // defaults to true
}
```

**What it checks:**

Three strategies in order:

1. **Diacritics.** A word containing Vietnamese diacritics (including `đ`) is accepted. "Lưu", "đạo", "thành" all pass immediately.

2. **The application's vocabulary.** `src/i18n/vi.json` is the shipped Vietnamese, so every word in it is known-good.
   - Extract words from `vi.json` (cutting out interpolation holes like `{{count}}`).
   - A missing diacritic is reported by suggesting the correctly-accented version from the bundle.
   - Only one suggestion per string if the string as a whole lacks diacritics everywhere; a string with mixed accented/unaccented words is reported as needing a review, not guessed at.

3. **Vietnamese syllable shape.** A syllable is onset + nucleus + coda from closed sets.
   - `danh` decomposes and looks Vietnamese, so it's waved through even without diacritics.
   - `save`, `close`, `loading` cannot decompose and are reported as English.
   - A short blacklist (`the`, `main`, `can`, `run`, `map`, `go`, `no`) names English words that *do* fit Vietnamese shape.

**Critical: How `vi.json` is used**

From `src/i18n/vi.json` (excerpt):

```json
{
  "common": {
    "save": "Lưu",
    "saved_at": "Đã lưu lúc {{time}}",
    "undo": "Hoàn tác",
    "undo_group": "Hoàn tác {{count}} thay đổi"
  },
  "errors": {
    "network": {
      "title": "Mất kết nối",
      "description": "Mất kết nối máy chủ. Kiểm tra mạng rồi thử lại."
    }
  },
  "project": {
    "settings": {
      "savedToast": "Lưu bản vẽ cài đặt thành công"
    }
  }
}
```

**What a new key must look like:**
- **Path:** `object.keys.in.dotted.path` — the nesting matters only for organization; the check flattens it.
- **Value:** Vietnamese text, with diacritics, sentence-style capitalization (A6).
- **Interpolation holes:** `{{variableName}}` is masked during the check; the variable name does not enter the vocabulary.

**Example of passing a key:**
```json
"floorUpload": {
  "title": "Tải bản vẽ",
  "description": "Tải bản vẽ lên hệ thống",
  "uploadButton": "Chọn tệp",
  "dragText": "Hoặc kéo tệp vào đây"
}
```

**Three real existing keys (with paths):**
1. `errors.network.title` → "Mất kết nối" (Vietnamese, properly accented)
2. `common.saved_at` → "Đã lưu lúc {{time}}" (has interpolation)
3. `project.settings.savedToast` → "Lưu bản vẽ cài đặt thành công" (nested path)

**Usage:**
```typescript
it('uses Vietnamese correctly (R-72)', () => {
  renderWithProviders(<ProjectSettingsView {...Success.args} />);
  expectVietnamese();
});
```

### expectNoRawColor

**Signature:**
```typescript
export function expectNoRawColor(filePath?: string, options?: NoRawColorOptions): void;

export const RAW_COLOR_PATTERN = /(#([0-9a-fA-F]{3}){1,2}\b)|(rgb|hsl)a?\(/;
```

**What it checks:** Scans source code and refuses hex codes (`#fff`, `#abcdef`), `rgb()`, `rgba()`, `hsl()`, `hsla()`. The pattern matches exactly what the ESLint rule `local/no-raw-color` refuses.

**When to use:** Production source (`src/lib/`, `src/domain/`, etc.) that decides colours must return token names, not literals. Test files and screen views are already guarded by ESLint.

**Usage:**
```typescript
it('contains no hardcoded colours', () => {
  expectNoRawColor('src/lib/coloring/modes.ts');
});
```

### render and renderWithProviders

**Signature:**
```typescript
export function renderWithProviders(
  ui: RenderableUi,
  options?: RenderWithProvidersOptions,
): ProvidedRenderResult;

export interface ProvidedRenderResult extends RenderResult {
  readonly queryClient: QueryClient;
  readonly translate: TFunction;
}

export interface TestProviderConfig {
  readonly resetStore?: (() => void) | undefined;
  readonly createQueryClient?: (() => QueryClient) | undefined;
}
```

**What it provides:**
- **A fresh QueryClient per render**, with retries off. Cache is discarded on unmount so tests don't cross-contaminate.
- **The Vietnamese i18n bundle**, so a test can call `translate('key')` to get the exact same string the screen reads.
- **Store reset** — if configured in `vitest.setup.ts`, each render gets a clean store. Configuration is via dependency injection, not by importing the store.

**Example setup in `vitest.setup.ts`:**
```typescript
import { configureTestProviders, createStoreReset } from '@/lib/testing/render';
import { useStore } from '@/store';

configureTestProviders({ resetStore: createStoreReset(useStore) });
```

**Usage:**
```typescript
const { container, queryClient, translate } = renderWithProviders(
  <ProjectSettingsView {...props} />,
);

expect(screen.getByText(translate('project.settings.savedToast'))).toBeInTheDocument();
```

---

## (e) COMPONENT ACCESSIBILITY ISSUE: Slider and Textarea (R-72 Blocker)

From the repository's known issues (memory: `slider-textarea-focus-ring-blocks-r72.md`):

### Components with focus-ring failures:

#### ✅ **FAIL: Slider** (`src/components/ui/Slider.tsx:143-155`)

```typescript
// The thumb unconditionally hides the outline, then draws the ring from React state:
<span
  className={clsx(
    'ring-0 outline-none',  // ← outline hidden
    isFocused && 'ring-2 ring-accent ring-offset-2',  // ← ring from onFocus/onBlur
  )}
  onFocus={() => setIsFocused(true)}
  onBlur={() => setIsFocused(false)}
/>
```

**Problem:** The ring is **state-driven**, so it only appears if React state matches. This fails `expectAccessible`'s check for `focus-visible:` semantics. The browser's focus-visible heuristic (e.g., keyboard focus is visible, mouse focus is not) is lost.

**Workaround for screens:** Replace Slider with `NumericField`, which is a text input and has a proper focus ring.

#### ✅ **FAIL: Textarea (when `isReadOnly`)** (`src/components/ui/Textarea.tsx:99`)

```typescript
<textarea
  className={clsx(
    'ring-2 ring-accent ring-offset-2',
    isReadOnly && 'focus-visible:ring-0',  // ← removes ring when read-only
  )}
/>
```

**Problem:** When read-only, `focus-visible:ring-0` wins over `ring-2`, so a keyboard-focused read-only textarea loses its ring entirely.

**Workaround for screens:** Avoid read-only `Textarea` on keyboard-reachable surfaces. Use a non-interactive `<div>` to display text instead.

### Checked: Other components

Inspected and **PASS** `expectAccessible`:
- `Button.tsx` — has `focus-visible:ring-2 ring-offset-2`; passes.
- `IconButton.tsx` — same; passes.
- `Select.tsx` — uses native HTML `<select>` focus semantics; passes.
- `NumericField.tsx` — text input with `focus-visible:ring-2`; passes.
- `Badge.tsx` — non-interactive; N/A.
- `InlineAlert.tsx` — no interactive controls; passes.
- `EmptyState.tsx` — contains buttons which it passes through, then applies styles to; passes if buttons have proper labels.
- `Skeleton.tsx` — non-interactive; N/A.
- `Toast.tsx` — contains buttons and links which are checked; passes if they have labels.

**Implication for FloorUploadScreen:** If using `Select` and `NumericField` (as documented in memory), both pass `expectAccessible`. Avoid `Slider` and read-only `Textarea`.

---

## (f) THE PER-SCREEN CHECK BLOCK (R-65 → R-73)

Substituting `SCREEN=src/screens/upload/FloorUploadScreen`:

```bash
SCREEN=src/screens/upload/FloorUploadScreen

echo "R-59 sáu file:";        ls $SCREEN
echo "R-60 view chạm dữ liệu:"; rg "from '@/(api|store|domain|lib/http)" $SCREEN --glob '*.tsx' --glob '!*.container.tsx' --glob '!*.test.tsx' --glob '!*.stories.tsx'
echo "R-62 ranh giới lỗi:";   rg "<ScreenErrorBoundary" $SCREEN
echo "R-63 bảy trạng thái:";  rg "expectSevenStates" $SCREEN
echo "R-64 tự viết loading:"; rg "useState.*([Ll]oading|error)" $SCREEN
echo "R-65 đường dẫn thô:";   rg "['\"\`](/|https?://)" $SCREEN
echo "R-69 stub/nợ:";         rg "TODO|FIXME|stub|any\b" $SCREEN
echo "R-70 test bị tắt:";     rg "\.(skip|only)\(" $SCREEN
echo "R-71 hằng số thô:";     rg "setTimeout\([^,]*, *[0-9]|duration: *[0-9]" $SCREEN
echo "R-73 container tồn tại:"; ls $SCREEN/*.container.tsx
echo "R-68 phạm vi sửa:";     git diff --name-only

pnpm verify
```

**Expected results:**

| Rule | Command | Expected |
|------|---------|----------|
| R-59 | `ls $SCREEN` | **Must list:** `index.ts`, `FloorUploadScreen.tsx`, `useFloorUploadScreen.ts`, `FloorUploadScreen.container.tsx`, `FloorUploadScreen.stories.tsx`, `FloorUploadScreen.test.tsx` |
| R-60 | rg `from '@/(api|...)` | **Empty** (no data-layer imports in `*.tsx` files, except `*.container.tsx`) |
| R-62 | rg `<ScreenErrorBoundary` | **Has results** — at least one in `*.container.tsx` |
| R-63 | rg `expectSevenStates` | **Has results** — in `*.test.tsx` |
| R-64 | rg `useState.*Loading` | **Empty** (no hand-rolled loading state; use @tanstack/react-query) |
| R-65 | rg hardcoded paths | **Empty** (routes use `ROUTES` from `@/routes/paths`; APIs use `ENDPOINTS` from `@/api/endpoints`) |
| R-69 | rg `TODO\|FIXME` | **Empty** |
| R-70 | rg `skip\|only` | **Empty** |
| R-71 | rg raw durations | **Empty** (use `MOTION_DURATIONS_MS` from `@/lib/motion/tokens`) |
| R-73 | `ls *.container.tsx` | **Must exist:** `FloorUploadScreen.container.tsx` |
| R-68 | `git diff --name-only` | **Only files matching:** `src/screens/upload/FloorUploadScreen/**`, `src/routes/**`, `src/i18n/vi.json` |

---

## (g) ROUTE REGISTRATION (R-65, R-66)

### File structure

**Real location:** `src/routes/` is a directory, not a single file.
- `src/routes/paths.ts` — leaf module, imports nothing. Declares route constants.
- `src/routes/router.tsx` — lazy-loads screens and registers routes.
- `src/routes/index.ts` — re-exports for `@/routes`.

### Registering a route

#### Step 1: Declare the pattern in `src/routes/paths.ts`

```typescript
export const ROUTE_PATTERNS = {
  // ... existing routes ...
  projectUpload: `${PROJECTS_ROOT}/:id/upload`,  // ← line 67
} as const;

export const ROUTES = {
  // ... existing routes ...
  project: {
    upload: (projectId: string): string => `${PROJECTS_ROOT}/${projectId}/upload`,  // ← line 102
  },
} as const;
```

**Current state:** `projectUpload` and `ROUTES.project.upload()` already exist in the file (added in prior work).

#### Step 2: Import the container in `src/routes/router.tsx`

```typescript
const RouteFloorUpload = lazy(() => 
  import('../screens/upload/FloorUploadScreen').then(m => ({ default: m.FloorUploadRoute }))
);
```

#### Step 3: Register the route

```typescript
export const router = createBrowserRouter([
  // ... dev-only routes ...
  { path: ROUTE_PATTERNS.projectUpload, element: suspended(<RouteFloorUpload />) },  // ← replace the Placeholder
  // ... other routes ...
]);
```

**Current state (line 71):**
```typescript
{ path: ROUTE_PATTERNS.projectUpload, element: <Placeholder name="/projects/:id/upload" /> },
```

This line must be replaced with the lazy import.

### Lazy loading pattern

All production screens use `lazy()` + a Suspense boundary:

```typescript
const RouteExample = lazy(() =>
  import('../screens/path/ExampleScreen').then(m => ({ default: m.ExampleRoute }))
);

// Registered as:
{ path: ROUTE_PATTERNS.example, element: suspended(<RouteExample />) },

// Where suspended is:
const suspended = (node: React.ReactNode) => (
  <React.Suspense fallback={<div>Loading...</div>}>{node}</React.Suspense>
);
```

### Import rule (R-65)

- **Screens** import `@/routes/paths` for route constants. Example: `import { ROUTES } from '@/routes/paths'`.
- **The shell** (router, main.tsx, App.tsx) imports `@/routes` (which re-exports from both `paths.ts` and `router.tsx`).

This breaks the import cycle: `paths.ts` has no dependencies, so screens can safely reach for constants without causing a cycle through the router.

---

## Summary of updates needed for FloorUploadScreen

1. Create six files in `src/screens/upload/FloorUploadScreen/`:
   - `index.ts` — re-exports
   - `FloorUploadScreen.tsx` — pure view
   - `useFloorUploadScreen.ts` — hook
   - `FloorUploadScreen.container.tsx` — wired + error boundary
   - `FloorUploadScreen.stories.tsx` — seven stories
   - `FloorUploadScreen.test.tsx` — assertions

2. Add types and gateways as needed (follow `ProjectSettings` and `CreateProjectModal` patterns).

3. Add seven i18n keys to `src/i18n/vi.json` under appropriate nesting (e.g., `floorUpload`).

4. Add routes to `src/routes/router.tsx` (replace `Placeholder` at line 71).

5. Run `pnpm verify` to pass all checks.

