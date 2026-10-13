import { describe, expect, it } from 'bun:test'
import { SHORTCUT_CATEGORIES, useShortcutsDialog } from './keyboard-shortcuts-dialog'

/** Key combos only — mouse gestures and bare held modifiers are not bindings. */
const combos = () =>
  SHORTCUT_CATEGORIES.flatMap((category) =>
    category.shortcuts.map((shortcut) => shortcut.keys.join('+')),
  ).filter((combo) => !/click|drag|scroll|wheel/i.test(combo) && combo !== 'Shift')

/**
 * Combos that the table lists twice ON PURPOSE: each meaning applies in a
 * different context (Esc cancels a tool, and with no tool it deselects; R/T
 * rotate whatever is being carried — a selection or an item being placed).
 * Anything else listed twice is a clash — AppFront A12 requires the shortcut
 * list to report duplicates, and this test is that report.
 */
const CONTEXTUAL_DUPLICATES = new Set(['Esc', 'R+T'])

describe('keyboard shortcuts table', () => {
  it('lists the AppFront keys: ? and Ctrl+F', () => {
    expect(combos()).toContain('?')
    expect(combos()).toContain('Cmd/Ctrl+F')
  })

  it('binds no combo twice except the known contextual ones', () => {
    const seen = new Set<string>()
    const clashes = combos().filter((combo) => {
      const dup = seen.has(combo)
      seen.add(combo)
      return dup && !CONTEXTUAL_DUPLICATES.has(combo)
    })
    expect(clashes).toEqual([])
  })

  it('opens through the shared store', () => {
    useShortcutsDialog.getState().setOpen(true)
    expect(useShortcutsDialog.getState().open).toBe(true)
    useShortcutsDialog.getState().setOpen(false)
  })
})
