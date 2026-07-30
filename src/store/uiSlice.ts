import { StateCreator } from 'zustand';

export type ThemeMode = 'light' | 'dark';

export interface UiSlice {
  theme: ThemeMode;
  sidebarOpen: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleSidebar: () => void;
}

export const createUiSlice: StateCreator<UiSlice> = (set) => ({
  theme: 'light', // Light is default per brief
  sidebarOpen: true,
  setTheme: (theme) => set({ theme }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
});
