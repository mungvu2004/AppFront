import { describe, it, expect, beforeEach } from 'vitest';
import { create } from 'zustand';
import { createSelectionSlice, type SelectionSlice } from '../selectionSlice';
import { createToolSlice, type ToolSlice } from '../toolSlice';
import { createViewSlice, MAX_ZOOM, MIN_ZOOM, type ViewSlice } from '../viewSlice';
import { createUiSlice, type UiSlice } from '../uiSlice';
import { PERSIST_STORAGE_KEY, useStore } from '../index';
import type { WallId } from '../../domain/spatial/types';

const wallIdA: WallId = 'W-TESTWALL0A';
const wallIdB: WallId = 'W-TESTWALL0B';

describe('selectionSlice', () => {
  it('replaces the selection in single mode and extends it in multiple mode', () => {
    const store = create<SelectionSlice>()(createSelectionSlice);

    store.getState().select(wallIdA);
    store.getState().select(wallIdB);
    expect(store.getState().selectedIds).toEqual([wallIdB]);

    store.getState().setSelectionMode('multiple');
    store.getState().select(wallIdA);
    store.getState().select(wallIdA);
    expect(store.getState().selectedIds).toEqual([wallIdB, wallIdA]);

    store.getState().deselect(wallIdB);
    expect(store.getState().selectedIds).toEqual([wallIdA]);

    store.getState().clearSelection();
    expect(store.getState().selectedIds).toHaveLength(0);
  });

  it('tracks the hovered id and stores plain ids only', () => {
    const store = create<SelectionSlice>()(createSelectionSlice);

    store.getState().setHovered(wallIdA);
    expect(store.getState().hoveredId).toBe(wallIdA);

    store.getState().setHovered(null);
    expect(store.getState().hoveredId).toBeNull();

    store.getState().setSelection([wallIdA, wallIdB, wallIdA]);

    const state = store.getState();

    expect(state.selectedIds).toEqual([wallIdA, wallIdB]);

    for (const id of state.selectedIds) {
      expect(typeof id).toBe('string');
    }
  });
});

describe('toolSlice', () => {
  it('merges tool options and ends the gesture when the tool changes', () => {
    const store = create<ToolSlice>()(createToolSlice);

    store.getState().setActiveTool('drawWall');
    store.getState().setToolInteracting(true);
    store.getState().setToolOptions({ wallThicknessMm: 220 });

    expect(store.getState().toolOptions.wallThicknessMm).toBe(220);
    expect(store.getState().toolOptions.snapEnabled).toBe(true);

    store.getState().setActiveTool('select');

    expect(store.getState().activeTool).toBe('select');
    expect(store.getState().toolInteracting).toBe(false);
  });
});

describe('viewSlice', () => {
  it('clamps the zoom and toggles layer visibility', () => {
    const store = create<ViewSlice>()(createViewSlice);

    store.getState().setZoom(MAX_ZOOM * 10);
    expect(store.getState().zoom).toBe(MAX_ZOOM);

    store.getState().setZoom(MIN_ZOOM / 10);
    expect(store.getState().zoom).toBe(MIN_ZOOM);

    store.getState().toggleLayerVisibility('dimension');
    expect(store.getState().hiddenLayers).toEqual(['dimension']);

    store.getState().toggleLayerVisibility('dimension');
    expect(store.getState().hiddenLayers).toHaveLength(0);

    store.getState().setViewMode('3d');
    store.getState().setViewCenter({ x: 4800, y: 2100 });
    store.getState().setColorMode('byReviewState');

    const state = store.getState();

    expect(state.viewMode).toBe('3d');
    expect(state.viewCenter).toEqual({ x: 4800, y: 2100 });
    expect(state.colorMode).toBe('byReviewState');
  });
});

describe('uiSlice', () => {
  it('opens the second dialog by closing the first', () => {
    const store = create<UiSlice>()(createUiSlice);

    store.getState().showDialog('createProject');
    expect(store.getState().openDialog).toBe('createProject');

    store.getState().showDialog('publishVersion');

    expect(store.getState().openDialog).toBe('publishVersion');

    store.getState().closeDialog();
    expect(store.getState().openDialog).toBeNull();
  });

  it('clamps panel widths and toggles each side independently', () => {
    const store = create<UiSlice>()(createUiSlice);

    store.getState().setPanelWidth('left', 100000);
    store.getState().setPanelWidth('right', 1);
    store.getState().setPanelOpen('left', false);

    const state = store.getState();

    expect(state.leftPanelWidthPx).toBeLessThanOrEqual(640);
    expect(state.rightPanelWidthPx).toBeGreaterThanOrEqual(240);
    expect(state.leftPanelOpen).toBe(false);
    expect(state.rightPanelOpen).toBe(true);
  });
});

describe('persistence between sessions', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('keeps the panel width across a reload', async () => {
    useStore.getState().setPanelWidth('left', 420);
    useStore.getState().setZoom(2);

    const persistedAtUnload = window.localStorage.getItem(PERSIST_STORAGE_KEY);

    expect(persistedAtUnload).not.toBeNull();

    // A reload starts from default in-memory state and rehydrates from the
    // storage as it was when the page went away.
    useStore.setState({ leftPanelWidthPx: 320, zoom: 1 });
    window.localStorage.setItem(PERSIST_STORAGE_KEY, persistedAtUnload ?? '');
    await useStore.persist.rehydrate();

    expect(useStore.getState().leftPanelWidthPx).toBe(420);
    expect(useStore.getState().zoom).toBe(2);
  });

  it('persists exactly the view and ui fields, never selection or tool state', () => {
    useStore.getState().select(wallIdA);
    useStore.getState().setActiveTool('drawWall');
    useStore.getState().setPanelWidth('right', 480);

    const raw = window.localStorage.getItem(PERSIST_STORAGE_KEY);

    expect(raw).not.toBeNull();

    const persisted: unknown = JSON.parse(raw ?? '{}');
    const persistedState = (persisted as { state: Record<string, unknown> }).state;

    expect(Object.keys(persistedState).sort()).toEqual([
      'colorMode',
      'hiddenLayers',
      'leftPanelOpen',
      'leftPanelWidthPx',
      'rightPanelOpen',
      'rightPanelWidthPx',
      'theme',
      'viewCenter',
      'viewMode',
      'zoom',
    ]);
  });
});
