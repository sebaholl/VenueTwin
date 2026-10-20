import type { VenueConfig } from '../types/venue'
import { hasSourcedStallsNumbering, ND_SEATING_SOURCE } from '../utils/nationalTheatreSeating'

export function SeatNumberingNote({ config, row }: { config: VenueConfig; row: number }) {
  const sourced = hasSourcedStallsNumbering(config, row)
  return <p className="seat-numbering-note">
    <strong>{sourced ? 'Numbering checked against the official plan' : 'Numbering not verified'}</strong><br />
    {sourced ? 'Stalls sale seats only. Position and view are still approximate.' : 'This row uses study or edited labels. Do not match it to a ticket yet.'}
    {config.studyNotice && <><br /><a href={ND_SEATING_SOURCE} target="_blank" rel="noreferrer">National Theatre seating source ↗</a></>}
  </p>
}
