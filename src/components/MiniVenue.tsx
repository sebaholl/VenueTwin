import { useState } from 'react'
import { ArrowUpRight, MousePointer2 } from 'lucide-react'
const choices = [{ label: 'Up close', row: 1, seat: 'B4', description: 'Near the stage' }, { label: 'In the middle', row: 3, seat: 'D4', description: 'A central perspective' }, { label: 'The bigger picture', row: 5, seat: 'F4', description: 'Further back in the room' }]
export function MiniVenue() {
  const [selected, setSelected] = useState(1)
  const [plan, setPlan] = useState(false)
  const choice = choices[selected]
  return <div className={`venue-showcase ${plan ? 'is-plan' : ''}`}>
    <div className="showcase-toolbar"><span><i /> VenueTwin <small>Concept preview</small></span><button type="button" aria-pressed={plan} onClick={() => setPlan(!plan)}>{plan ? 'Show spatial view' : 'Show floor plan'} <ArrowUpRight size={14} /></button></div>
    <div className="showcase-scene" aria-hidden="true">
      <div className="showcase-room"><div className="showcase-screen"><span>THE STAGE</span></div><div className="showcase-sightline" style={{ height: `${70 + choice.row * 37}px` }} />
        <div className="showcase-seats">{Array.from({ length: 42 }, (_, index) => <i key={index} className={index === choice.row * 7 + 3 ? 'selected' : ''} style={{ opacity: Math.floor(index / 7) === choice.row ? 1 : .48 }} />)}</div>
      </div>
      <span className="showcase-axis">VENUE STUDY / 001</span><span className="showcase-scale">Illustrative geometry</span>
    </div>
    <div className="showcase-bottom"><div className="showcase-selection" aria-live="polite"><small>EXPLORE A POSITION</small><strong>{choice.seat} <span>{choice.description}</span></strong></div><div className="showcase-choices" role="group" aria-label="Choose an illustrative seating position">{choices.map((item, index) => <button type="button" key={item.seat} aria-pressed={selected === index} onClick={() => setSelected(index)}>{item.label}</button>)}</div></div>
    <div className="showcase-caption"><MousePointer2 size={13} /> Try a position. Then build a venue of your own.</div>
  </div>
}
