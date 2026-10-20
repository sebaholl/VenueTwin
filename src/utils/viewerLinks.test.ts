import { describe, expect, it } from 'vitest'
import { defaultVenue } from '../types/venue'
import { resolveSeatLink, seatLink } from './viewerLinks'

describe('published seat links', () => {
  it('round trips a seat independently of display names', () => {
    const url = new URL(seatLink('https://demo.example', '/venues/demo/v1/venue.json', { row: 2, seat: 4 }))
    expect(url.searchParams.get('venue')).toBe('/venues/demo/v1/venue.json')
    expect(resolveSeatLink({ ...defaultVenue, name: 'Renamed' }, url.searchParams.get('seat'))).toMatchObject({ row: 2, seat: 4 })
  })
  it('rejects absent, malformed and unavailable seats', () => {
    for (const id of [null, '', 'r0-s1', 'r-1-s2', 'r1-s999', 'r99-s1', 'r1-s1extra']) expect(resolveSeatLink(defaultVenue, id)).toBeNull()
  })
  it('does not permit links to external manifests or unsafe schemes', () => {
    expect(() => seatLink('https://demo.example', 'https://evil.example/venues/x', { row: 0, seat: 0 })).toThrow()
    expect(() => seatLink('javascript:alert(1)', '/venues/x', { row: 0, seat: 0 })).toThrow()
  })
})
