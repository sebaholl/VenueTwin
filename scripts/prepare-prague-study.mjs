// Explicitly generate an UNVERIFIED real-venue study from the existing Studio layout.
// The only source-backed geometry fact is seat identity; no coordinate is promoted to measured.
import { createServer } from 'vite'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' })
try {
  const { createNationalTheatreSeatingStudy } = await server.ssrLoadModule('/src/utils/nationalTheatreSeating.ts')
  const { productionDraft } = await server.ssrLoadModule('/src/utils/productionContract.ts')
  const config = createNationalTheatreSeatingStudy()
  const draft = await productionDraft(config, 'prague-national-theatre', 1)
  const stalls = draft.seats.filter(seat => seat.level_id === 'stalls')
  if (stalls.length !== 263) throw new Error('Official stalls inventory changed; recheck the source plan.')
  const seats = stalls.map(seat => {
    const matched = /^legacy-r(\d+)-s(\d+)$/.exec(seat.id)
    if (!matched) throw new Error('Unexpected Studio seat identity.')
    const row = Number(matched[1]) + 1, number = Number(matched[2]) + 1
    if (seat.row_label !== String(row)) throw new Error('Studio row identity changed.')
    return { ...seat,
      id: `stalls-r${String(row).padStart(2, '0')}-s${String(number).padStart(2, '0')}`,
      eye_position_m: [seat.position_m[0], seat.position_m[1] + .9, seat.position_m[2]],
    }
  })
  const screen = draft.structures.find(item => item.id === 'legacy-box-1')
  if (!screen) throw new Error('Estimated stage reference is missing.')
  const source = {
    id: 'official-stalls-plan', kind: 'drawing',
    sha256: '37978bed76957e3d976155b88e32389d49992995d6f0976c03175f39b863dbde',
    description: 'Official National Theatre Prague seating PDF at https://media.narodni-divadlo.cz/11302/1764234380-nd-gold.pdf; hash checked 2026-10-23. Supports row/seat identities only, not coordinates or redistribution rights.'
  }
  const document = {
    ...draft,
    name: 'National Theatre Prague · public-source study, UNVERIFIED',
    origin: 'Existing estimated Studio origin. Coordinates, eye heights and stage target are illustrative, not surveyed.',
    sources: [...draft.sources, source],
    seats,
    structures: draft.structures.map(item => ({ ...item,
      kind: item.id === 'legacy-box-0' ? 'stage' : item.id === `legacy-box-${draft.structures.length - 1}` ? 'shell' : 'other',
    })),
    stage_target_m: screen.position_m,
    stage_target_evidence: { status: 'inferred', source_ids: ['legacy-config'], uncertainty_m: null },
    coverage: { ...draft.coverage,
      seat_inventory: { status: 'documented', source_ids: ['official-stalls-plan'], uncertainty_m: null },
    },
  }
  const output = resolve('venue-data/national-theatre-prague/unverified-production-draft.json')
  await mkdir(resolve('venue-data/national-theatre-prague'), { recursive: true })
  await writeFile(output, JSON.stringify(document, null, 2) + '\n')
  console.log(`Wrote ${stalls.length} explicitly unverified seat cameras to ${output}. Never publish as reviewed geometry.`)
} finally { await server.close() }
