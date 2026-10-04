import { Box, CalendarDays, Map, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { SharedPlan } from '../components/SharedPlan'
import { VenueScene } from '../components/VenueScene'
import { getSharedProject, type SharedProject } from '../lib/supabaseApi'
import type { SeatRef } from '../types/venue'
import { venueTypeLabel } from '../utils/projectPresets'
import { estimateCapacity } from '../utils/venue'

export function SharedProjectPage() {
  const { token = '' } = useParams()
  const [project, setProject] = useState<SharedProject | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'plan' | 'model'>('model')
  const [selectedSeat, setSelectedSeat] = useState<SeatRef | null>(null)

  useEffect(() => { void getSharedProject(token).then(setProject).catch((reason) => setError(reason instanceof Error ? reason.message : 'The preview could not be loaded.')) }, [token])
  const capacity = useMemo(() => project ? estimateCapacity(project.venue_data) : 0, [project])

  if (error) return <main className="shared-unavailable"><Brand /><h1>Preview unavailable</h1><p>{error}</p><Link to="/">Return to VenueTwin</Link></main>
  if (!project) return <div className="route-loader"><span /></div>

  return <div className="shared-project-page">
    <header><Link to="/"><Brand /></Link><span>READ-ONLY PREVIEW</span><a href="/studio">Create your venue</a></header>
    <main><section className="shared-project-heading"><div><span>{venueTypeLabel(project.venue_data.venueType)}</span><h1>{project.name}</h1><p>Interactive venue preview · Last updated {new Date(project.updated_at).toLocaleDateString()}</p></div><div className="shared-stats"><div><Users /><span><b>{capacity}</b><small>Seats</small></span></div><div><Map /><span><b>{project.venue_data.rows}</b><small>Rows</small></span></div><div><CalendarDays /><span><b>{project.venue_data.sectors}</b><small>Sections</small></span></div></div></section>
      <section className="shared-viewer"><div className="shared-view-switch"><button className={view === 'plan' ? 'active' : ''} onClick={() => setView('plan')}><Map /> 2D plan</button><button className={view === 'model' ? 'active' : ''} onClick={() => setView('model')}><Box /> 3D model</button></div>{view === 'model' ? <VenueScene config={project.venue_data} selectedSeat={selectedSeat} onSeatSelect={setSelectedSeat} /> : <SharedPlan config={project.venue_data} />}{selectedSeat && view === 'model' && <div className="shared-seat-chip"><span>Selected seat</span><b>{selectedSeat.label}</b><button onClick={() => setSelectedSeat(null)}>×</button></div>}</section>
    </main>
    <footer><span>Shared with VenueTwin</span><small>This preview is for visual planning and is not a safety certification.</small></footer>
  </div>
}
