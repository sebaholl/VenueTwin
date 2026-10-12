import type { VenueConfig } from '../types/venue'
import type { PilotRun } from '../lib/pilotSession'
import { parseViewerConfig } from './customerViewer'
import { pilotSnapshot } from './studioPilot'
import { layoutChecks } from './layoutChecks'
import { blenderBlueprint } from './blenderBridge'
import { generateSeatLayout } from './venue'
import { categorySummary } from './seatCategories'

export function pilotHandover(value: VenueConfig, lastApplied: PilotRun | null, currentReferences: string, now = new Date().toISOString()) {
  const config = parseViewerConfig(value)
  const checks = layoutChecks(config)
  const current = !!lastApplied && lastApplied.snapshot === pilotSnapshot(config) && lastApplied.references === currentReferences
  return {
    format: 'venuetwin-pilot-handover', version: 1, createdAt: now,
    status: 'requires-human-review',
    config, capacity: generateSeatLayout(config).length, categories: categorySummary(config),
    checks,
    evidence: { status: !lastApplied ? 'no-applied-pilot-proposal' : current ? 'matches-last-applied-proposal' : 'layout-or-references-changed', lastApplied, currentReferences },
    blenderBlueprint: blenderBlueprint(config),
    checklist: [
      'Confirm dimensions and seating against the original customer materials; accepted findings are not independently verified.',
      'Resolve or explicitly accept modelling warnings and missing information.',
      'Build the current layout in Model, then inspect the returned GLB.',
      'Check front, back, edge and balcony seat views against known-seat references where available.',
      'Open Preview & share → Customer preview and test mouse, touch and seat links.',
      'Download the viewer manifest and matching model from the viewer; upload both together to a versioned /venues/ folder.',
    ],
    limits: [
      'This report is a modelling handover, not proof of source accuracy, accessibility, building compliance or a successful Blender build.',
      'The general builder produces approximate architecture. Detailed decorative reconstruction requires additional modelling.',
      'Original uploads and the rendered GLB are not embedded. Private briefs and reference text may be included; review before sharing.',
      ...(lastApplied?.plan.limitations ?? []),
    ],
  }
}
