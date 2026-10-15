import type { StateCreator } from 'zustand';

export type ThemeMode = 'light' | 'dark';

/** Lựa chọn của người dùng; `'system'` giải ra `ThemeMode` theo hệ điều hành (Q2, 33R-C-001). */
export type ThemeChoice = ThemeMode | 'system';

export type PanelSide = 'left' | 'right';

/** Dialogs exist only for creating, deleting and publishing; QC never blocks. */
export type DialogKind = 'createProject' | 'createFloor' | 'deleteEntities' | 'publishVersion';

export const MIN_PANEL_WIDTH_PX = 240;
export const MAX_PANEL_WIDTH_PX = 640;

/**
 * Chrome around the canvas: theme, side panels and the one open dialog.
 *
 * `openDialog` being a single field is what guarantees at most one dialog at a
 * time — showing another replaces the first.
 *
 * The slice is persisted to localStorage between sessions (wired in the store
 * composition), except `openDialog`: a blocking dialog must never reopen
 * uninvited after a reload.
 */
export interface UiSlice {
  /** Chủ đề ĐÃ GIẢI (light/dark) — thứ `<html>` đang mang. */
  theme: ThemeMode;
  /** Lựa chọn người dùng, có thể là 'system'; đây là giá trị lưu ở `app-theme-mode`. */
  themeChoice: ThemeChoice;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  leftPanelWidthPx: number;
  rightPanelWidthPx: number;
  /** The dialog on screen; null when none is. */
  openDialog: DialogKind | null;
  setTheme: (theme: ThemeMode) => void;
  /** `systemPrefersDark` chỉ dùng khi `choice === 'system'`. */
  setThemeChoice: (choice: ThemeChoice, systemPrefersDark: boolean) => void;
  setPanelOpen: (side: PanelSide, open: boolean) => void;
  /** Sets a panel width, clamped to [MIN_PANEL_WIDTH_PX, MAX_PANEL_WIDTH_PX]. */
  setPanelWidth: (side: PanelSide, widthPx: number) => void;
  showDialog: (dialog: DialogKind) => void;
  closeDialog: () => void;
}

const clampPanelWidth = (widthPx: number): number =>
  Math.min(MAX_PANEL_WIDTH_PX, Math.max(MIN_PANEL_WIDTH_PX, widthPx));

export const createUiSlice: StateCreator<UiSlice> = (set) => ({
  theme: 'light', // Light is default per brief
  themeChoice: 'light',
  leftPanelOpen: true,
  rightPanelOpen: true,
  leftPanelWidthPx: 320,
  rightPanelWidthPx: 320,
  openDialog: null,
  setTheme: (theme) => set({ theme, themeChoice: theme }),
  setThemeChoice: (themeChoice, systemPrefersDark) =>
    set({
      themeChoice,
      theme: themeChoice === 'system' ? (systemPrefersDark ? 'dark' : 'light') : themeChoice,
    }),
  setPanelOpen: (side, open) =>
    set(side === 'left' ? { leftPanelOpen: open } : { rightPanelOpen: open }),
  setPanelWidth: (side, widthPx) =>
    set(
      side === 'left'
        ? { leftPanelWidthPx: clampPanelWidth(widthPx) }
        : { rightPanelWidthPx: clampPanelWidth(widthPx) }
    ),
  showDialog: (openDialog) => set({ openDialog }),
  closeDialog: () => set({ openDialog: null }),
});
