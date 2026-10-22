import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  realismRoofSegmentDefaults,
  realismWallDefaults,
  setDetailsEnabled,
} from './details'

beforeEach(() => setDetailsEnabled(true))
afterEach(() => setDetailsEnabled(false))

describe('realism details (R6)', () => {
  it('new roof segment gets fascia + auto gutters', () => {
    expect(realismRoofSegmentDefaults()).toEqual({ fascia: true, metadata: { autoGutter: true } })
  })

  it('new wall gets exterior skirting', () => {
    const d = realismWallDefaults() as { skirting: { enabled: boolean; sides: string } }
    expect(d.skirting.enabled).toBe(true)
    expect(d.skirting.sides).toBe('exterior')
  })

  it('tool preset spread after realism defaults wins (same order as vendor patch)', () => {
    const preset = { fascia: false, metadata: { autoGutter: false } }
    expect({ ...realismRoofSegmentDefaults(), ...preset }).toEqual(preset)
    const wallPreset = { skirting: { enabled: false } }
    expect({ ...realismWallDefaults(), ...wallPreset }).toEqual(wallPreset)
  })

  it('flag off -> nothing added', () => {
    setDetailsEnabled(false)
    expect(realismRoofSegmentDefaults()).toEqual({})
    expect(realismWallDefaults()).toEqual({})
  })

  it('returns fresh objects (no shared mutation between nodes)', () => {
    const a = realismWallDefaults() as { skirting: { height: number } }
    a.skirting.height = 9
    expect((realismWallDefaults() as { skirting: { height: number } }).skirting.height).toBe(0.25)
    const r = realismRoofSegmentDefaults() as { metadata: Record<string, unknown> }
    r.metadata.x = 1
    expect(realismRoofSegmentDefaults()).toEqual({ fascia: true, metadata: { autoGutter: true } })
  })
})
