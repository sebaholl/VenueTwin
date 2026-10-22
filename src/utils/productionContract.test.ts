import { describe, expect, it } from 'vitest'
import { defaultVenue } from '../types/venue'
import { productionDraft } from './productionContract'
import fixture from '../../contracts/fixtures/legacy-draft.json'

describe('production draft adapter', () => {
  it('matches the shared fixture validated by Python and does not mutate legacy projects', async () => {
    const config = { ...defaultVenue, rows: 1, seatsPerRow: 2, geometry: 'straight' as const }
    const before = structuredClone(config)
    expect(await productionDraft(config, 'demo', 1)).toEqual(fixture)
    expect(config).toEqual(before)
  })
  it('never treats legacy generated eyes or geometry as measured', async () => {
    const draft = await productionDraft(defaultVenue, 'demo', 1)
    expect(draft.seats.every(s => s.eye_position_m === null && s.evidence.status === 'inferred')).toBe(true)
    expect(draft.stage_target_m).toBeNull()
    expect(draft.coverage.scale.status).toBe('unknown')
    expect(new Set(draft.seats.map(s => s.id)).size).toBe(draft.seats.length)
  })
  it('rejects invalid identities and existing invalid geometry', async () => {
    await expect(productionDraft(defaultVenue, '../bad', 1)).rejects.toThrow()
    await expect(productionDraft(defaultVenue, 'demo', 1.5)).rejects.toThrow()
    await expect(productionDraft({ ...defaultVenue, rows: NaN }, 'demo', 1)).rejects.toThrow()
  })
})
