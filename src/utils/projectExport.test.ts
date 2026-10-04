import { describe, expect, it } from 'vitest'
import { defaultVenue } from '../types/venue'
import { projectSlug, renderVenuePlanSvg } from './projectExport'

describe('project export', () => {
  it('creates a safe filename slug', () => {
    expect(projectSlug('Main Hall – 2026!')).toBe('main-hall-2026')
    expect(projectSlug('***')).toBe('venue-project')
  })

  it('renders a complete SVG plan', () => {
    const svg = renderVenuePlanSvg({ ...defaultVenue, name: 'Main Hall' })
    expect(svg).toContain('<svg')
    expect(svg).toContain('Main Hall')
    expect(svg).toContain('STAGE · 12 M')
    expect(svg.match(/<circle/g)?.length).toBeGreaterThan(50)
  })

  it('escapes project names in exported markup', () => {
    const svg = renderVenuePlanSvg({ ...defaultVenue, name: '<script>alert(1)</script>' })
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;script&gt;')
  })
})
