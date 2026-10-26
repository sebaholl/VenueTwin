import { describe, expect, it, vi, afterEach } from 'vitest'
import { defaultVenue, type VenueConfig } from '../types/venue'
import { applyPilotPlan, pilotSnapshot, type PilotAction, type PilotPlan } from './studioPilot'
import { generateSeatLayout } from './venue'
import { blenderBlueprint } from './blenderBridge'
import { pilotHandover } from './pilotHandover'
import { emptyPilotSession, loadPilotSession, parsePilotSession, savePilotSession } from '../lib/pilotSession'
import { approvalIsCurrent, evidenceSha256 } from '../lib/ownerApproval'
import { generatePilotPlan } from '../../server/studioPilot'
const evidence = { basis: 'provided' as const, source: 'Test fixture: supplied measurements and explicit edits' }
const plan = (actions: PilotAction[]): PilotPlan => ({ summary: 'Fixture proposal', actions, questions: [], limitations: [], expectedSeatCount: null })
const base: VenueConfig = { ...defaultVenue, rows: 3, seatsPerRow: 4, geometry: 'straight', rake: 0, sectors: 1, curve: 0 }
const category: PilotAction = { ...evidence, tool: 'save_category', id: 'premium', name: 'Premium', color: '#abcdef', price: 200 }
afterEach(() => vi.unstubAllGlobals())
describe('Pilot editing round trips', () => {
  it('assigns categories, inherits per-seat prices and cleans references on removal', () => {
    const next = applyPilotPlan(base, plan([category,
      { ...evidence, tool: 'assign_row_category', firstRow: 1, lastRow: 2, categoryId: 'premium' },
      { ...evidence, tool: 'assign_seat_category', row: 1, seat: 2, categoryId: 'standard' },
      { ...evidence, tool: 'label_accessible_seat', row: 1, seat: 2, accessible: true },
      { ...evidence, tool: 'set_currency', currency: 'CZK' },
    ]), false)
    expect(next.rowOverrides[0]).toMatchObject({ categoryId: 'premium', seatCategories: { 1: 'standard' }, accessibleSeats: { 1: true } })
    expect(generateSeatLayout(next)).toHaveLength(12)
    const inherited = applyPilotPlan(next, plan([{ ...evidence, tool: 'assign_seat_category', row: 1, seat: 2, categoryId: null }]), false)
    expect(inherited.rowOverrides[0].seatCategories).toEqual({})
    const removed = applyPilotPlan(inherited, plan([{ ...evidence, tool: 'remove_category', id: 'premium' }]), false)
    expect(removed.rowOverrides[0].categoryId).toBe('standard')
    expect(removed.rowOverrides[0].accessibleSeats).toEqual({ 1: true })
    expect(next.categories?.find((c) => c.id === 'premium')?.price).toBe(200)
  })
  it('rejects invalid targets atomically and never creates wheelchair geometry from labels', () => {
    const snapshot = JSON.stringify(base)
    for (const action of [
      { ...evidence, tool: 'assign_seat_category', row: 1, seat: 5, categoryId: 'premium' },
      { ...evidence, tool: 'assign_row_category', firstRow: 3, lastRow: 2, categoryId: 'premium' },
      { ...evidence, tool: 'assign_seat_category', row: 1, seat: 1, categoryId: 'unknown' },
      { ...evidence, tool: 'remove_category', id: 'standard' },
      { ...evidence, tool: 'remove_obstacle', id: 'unknown' },
      { ...evidence, tool: 'remove_level', id: 'unknown' },
      { ...category, color: 'invalid' },
    ] as PilotAction[]) expect(() => applyPilotPlan(base, plan([category, action]), false)).toThrow()
    expect(JSON.stringify(base)).toBe(snapshot)
  })
  it('creates and explicitly removes arcs and labels without removing row metadata', () => {
    const arc = applyPilotPlan(base, plan([
      { ...evidence, tool: 'set_row_arc', row: 2, radius: 10, degrees: 90 },
      { ...evidence, tool: 'set_row_label', row: 2, label: 'Balcony A' },
    ]), false)
    expect(generateSeatLayout(arc)[4].position).not.toEqual(generateSeatLayout(base)[4].position)
    const reset = applyPilotPlan(arc, plan([{ ...evidence, tool: 'set_row_arc', row: 2, radius: null, degrees: null }]), false)
    expect(reset.rowOverrides[1].ticketRow).toBe('Balcony A')
    expect(generateSeatLayout(reset)[4].position).toEqual(generateSeatLayout(base)[4].position)
    expect(() => applyPilotPlan(base, plan([{ ...evidence, tool: 'set_row_arc', row: 1, radius: 10, degrees: null }]), false)).toThrow('both')
  })
  it('preserves world heights and exported decks when removing the final level', () => {
    const elevated = applyPilotPlan(base, plan([
      { ...evidence, tool: 'save_level', id: 'balcony', name: 'Balcony', elevation: 3, parapetHeight: .8 },
      { ...evidence, tool: 'assign_rows', firstRow: 2, lastRow: 3, levelId: 'balcony' },
    ]), false)
    const next = applyPilotPlan(elevated, plan([{ ...evidence, tool: 'remove_level', id: 'balcony' }]), false)
    expect(generateSeatLayout(next).map((s) => s.position)).toEqual(generateSeatLayout(elevated).map((s) => s.position))
    const deck = blenderBlueprint(next).boxes.find((b) => b.name === 'Approximate row deck 2')!
    expect(deck.position[1] + deck.size[1] / 2).toBeCloseTo(3)
  })
})
describe('Local drafts and handover', () => {
  it('isolates projects and validates restored records', () => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) })
    const session = { ...emptyPilotSession(), brief: 'Keep supplied dimensions.' }
    savePilotSession('one', session)
    expect(loadPilotSession('one').session).toEqual(session)
    expect(loadPilotSession('two').session.brief).toBe('')
    data.set('venuetwin-pilot-v1:one', '{')
    expect(loadPilotSession('one').error).toContain('restore')
    expect(() => parsePilotSession(JSON.stringify({ ...session, brief: 'a'.repeat(12001) }))).toThrow()
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('disabled') } })
    expect(loadPilotSession('one').session).toEqual(emptyPilotSession())
  })
  it('does not label changed geometry or references as matching applied evidence', () => {
    const last = { at: '2026-10-12T10:00:00Z', brief: 'Test', plan: plan([]), snapshot: pilotSnapshot(base), references: 'source A' }
    expect(pilotHandover(base, last, 'source A').evidence.status).toBe('matches-last-applied-proposal')
    expect(pilotHandover({ ...base, stageWidth: 20 }, last, 'source A').evidence.status).toBe('layout-or-references-changed')
    expect(pilotHandover(base, last, 'source B').evidence.status).toBe('layout-or-references-changed')
    expect(pilotHandover(base, null, '').status).toBe('requires-human-review')
  })
  it('migrates old drafts and rejects a saved approval when geometry or evidence changes', async () => {
    const previous = { ...emptyPilotSession(), version: 1 }
    const migrated = parsePilotSession(JSON.stringify(previous))
    expect(migrated.version).toBe(2)
    expect(migrated.pendingApproval).toBeNull()
    const evidence = await evidenceSha256('accepted reference A')
    const packet = { id: 'proposal-one', requestedAt: '2026-10-26T12:00:00Z', brief: 'Keep the stage', plan: plan([]), base: pilotSnapshot(base), evidenceSha256: evidence, allowEstimates: false }
    const session = parsePilotSession(JSON.stringify({ ...emptyPilotSession(), pendingApproval: packet }))
    expect(approvalIsCurrent(session.pendingApproval!, base, evidence)).toBe(true)
    expect(approvalIsCurrent(session.pendingApproval!, { ...base, stageWidth: base.stageWidth + 1 }, evidence)).toBe(false)
    expect(approvalIsCurrent(session.pendingApproval!, base, await evidenceSha256('accepted reference B'))).toBe(false)
    expect(() => parsePilotSession(JSON.stringify({ ...emptyPilotSession(), pendingApproval: { ...packet, evidenceSha256: 'invalid' } }))).toThrow()
  })
})
it('runs a supplied-material fixture through the API boundary, apply, blueprint and handover', async () => {
  const proposed = plan([
    { ...evidence, tool: 'set_room', room: { width: 20, depth: 20, height: 8, x: 0, z: 4, rotation: 0, ceiling: true, floorColor: '#222222', wallColor: '#aaaaaa' } },
    { ...evidence, tool: 'save_room_opening', opening: { id: 'door', wall: 'back', offset: 0, bottom: 0, width: 1.2, height: 2.1 } },
    { ...evidence, tool: 'set_stage_dimensions', depth: 3, screenWidth: 8, screenHeight: 4, screenBottom: .5 },
    category,
    { ...evidence, tool: 'assign_row_category', firstRow: 1, lastRow: 1, categoryId: 'premium' },
  ])
  proposed.expectedSeatCount = 12
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ status: 'completed', output: [{ type: 'function_call', name: 'propose_studio_changes', arguments: JSON.stringify(proposed) }] })))
  const { plan: validated } = await generatePilotPlan({ config: base, brief: 'Use the supplied fixture dimensions.', allowEstimates: false, references: 'Fixture material' }, { apiKey: 'fake', model: 'fixture' }, fetcher)
  const next = applyPilotPlan(base, validated, false)
  const report = pilotHandover(next, { at: new Date().toISOString(), brief: 'Fixture', plan: validated, snapshot: pilotSnapshot(next), references: 'Fixture material' }, 'Fixture material')
  expect(report.capacity).toBe(12)
  expect(report.blenderBlueprint.boxes.some((b) => b.name.startsWith('VT_ROOM_SHELL_END_1_'))).toBe(true)
  expect(report.categories.counts.find((c) => c.id === 'premium')?.count).toBe(4)
  expect(report.blenderBlueprint.seats.map((s) => s.position)).toEqual(generateSeatLayout(next).map((s) => s.position))
  expect(report.evidence.status).toBe('matches-last-applied-proposal')
  expect(fetcher).toHaveBeenCalledTimes(1)
})
