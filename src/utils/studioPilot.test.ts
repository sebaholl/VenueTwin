import { describe, expect, it, beforeEach } from 'vitest'
import { defaultVenue } from '../types/venue'
import { useVenueStore } from '../store/venueStore'
import { applyPilotPlan, checkPilotBase, parsePilotPlan, type PilotPlan, type PilotAction } from './studioPilot'
import { generateSeatLayout } from './venue'
const plan = (actions: PilotAction[], expectedSeatCount: number | null = null): PilotPlan => ({ summary: 'Test proposal', actions, expectedSeatCount, questions: [], limitations: [] })
const evidence = { basis: 'provided' as const, source: 'User brief' }
const stage: PilotAction = { ...evidence, tool: 'set_stage', width: 11, x: 0, z: 0, rotation: 0 }
const row: PilotAction = { ...evidence, tool: 'edit_row', row: 3, seats: null, elevation: .4, offsetX: null, offsetY: null, rotation: null, curve: null, frontRailing: null }
describe('Studio Pilot action execution', () => {
  it('changes the stage without moving seats or mutating the original', () => {
    const original = structuredClone(defaultVenue)
    const next = applyPilotPlan(original, plan([stage]), false)
    expect(next.stageWidth).toBe(11)
    expect(generateSeatLayout(next)).toEqual(generateSeatLayout(original))
    expect(original).toEqual(defaultVenue)
  })
  it('uses 1-based row numbers and preserves untouched row metadata', () => {
    const base = { ...defaultVenue, rowOverrides: { 2: { seats: 9, ticketRow: '3', accessibleSeats: { 0: true }, offsetX: 2 } } }
    const next = applyPilotPlan(base, plan([row]), false)
    expect(next.rowOverrides[2]).toEqual({ ...base.rowOverrides[2], elevation: .4 })
    expect(next.rowOverrides[3]).toBeUndefined()
  })
  it('uses the existing level creation and assignment rules', () => {
    const next = applyPilotPlan(defaultVenue, plan([
      { ...evidence, tool: 'save_level', id: 'balcony', name: 'Balcony', elevation: 4, parapetHeight: .8 },
      { ...evidence, tool: 'assign_rows', firstRow: 3, lastRow: 4, levelId: 'balcony' }, row,
    ]), false)
    expect(generateSeatLayout(next).find((seat) => seat.row === 2)?.position[1]).toBe(4.65)
    expect(next.rowOverrides[4]).toBeUndefined()
  })
  it('rejects an entire plan when a later action fails', () => {
    const base = structuredClone(defaultVenue)
    expect(() => applyPilotPlan(base, plan([stage, { ...row, row: 50 }]), false)).toThrow('does not exist')
    expect(base).toEqual(defaultVenue)
  })
  it('rejects unsupported tools, extra fields, NaN, excessive actions and bad bounds', () => {
    for (const value of [plan([{ ...stage, width: NaN }]), plan([{ ...stage, width: -1 }]), plan(Array(81).fill(stage)), { ...plan([stage]), code: 'run' }, plan([{ ...stage, tool: 'run_python' } as unknown as PilotAction])]) expect(() => parsePilotPlan(value)).toThrow('invalid action plan')
  })
  it('gates estimates and persists the approximation notice', () => {
    const estimated = plan([{ ...stage, basis: 'estimated' }])
    expect(() => applyPilotPlan(defaultVenue, estimated, false)).toThrow('estimates')
    const next = applyPilotPlan(defaultVenue, estimated, true)
    expect(next.studyNotice).toContain('estimated geometry')
    expect(applyPilotPlan(next, estimated, true).studyNotice).toBe(next.studyNotice)
  })
  it('checks actual capacity, including preserved per-row counts', () => {
    const base = { ...defaultVenue, geometry: 'straight' as const, rowOverrides: { 0: { seats: 10 } } }
    expect(() => applyPilotPlan(base, plan([stage], 140), false)).toThrow('generated 136')
    expect(applyPilotPlan(base, plan([stage], 136), false).stageWidth).toBe(11)
  })
  it('supports clarification without inventing a layout', () => {
    expect(applyPilotPlan(defaultVenue, { ...plan([]), questions: ['How many rows?'] }, false)).toEqual(defaultVenue)
  })
  it('rejects stale proposals rather than overwriting concurrent edits', () => {
    const base = JSON.stringify(defaultVenue)
    expect(() => checkPilotBase(defaultVenue, base)).not.toThrow()
    expect(() => checkPilotBase({ ...defaultVenue, name: 'Edited' }, base)).toThrow('changed')
  })
  it('preserves row overrides when setting defaults and removes rows outside the new range', () => {
    const base = { ...defaultVenue, rowOverrides: { 0: { seats: 8, ticketRow: 'First' }, 9: { seats: 3 } } }
    const next = applyPilotPlan(base, plan([{ ...evidence, tool: 'set_seating', rows: 4, seatsPerRow: 12, sectors: 1, geometry: 'straight', rake: .2, curve: 0, seatSpacing: .65, rowSpacing: 1, aisleWidth: 1 }], 44), false)
    expect(next.rowOverrides).toEqual({ 0: base.rowOverrides[0] })
  })
})
describe('Pilot store history', () => {
  beforeEach(() => { useVenueStore.setState({ projectId: 'test', config: structuredClone(defaultVenue), past: [], future: [], transactionStart: null }) })
  it('applies a whole plan as one undoable edit', () => {
    useVenueStore.getState().setConfig(applyPilotPlan(defaultVenue, plan([stage, row]), false))
    expect(useVenueStore.getState().past).toHaveLength(1)
    expect(useVenueStore.getState().config.rowOverrides[2].elevation).toBe(.4)
    useVenueStore.getState().undo()
    expect(useVenueStore.getState().config).toEqual(defaultVenue)
    useVenueStore.getState().redo()
    expect(useVenueStore.getState().config.stageWidth).toBe(11)
  })
})
