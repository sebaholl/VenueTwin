export function MiniVenue() {
  const seats = Array.from({ length: 42 })
  return (
    <div className="mini-venue" aria-hidden="true">
      <div className="mini-toolbar"><span /><span /><span /></div>
      <div className="mini-stage"><b>STAGE</b></div>
      <div className="mini-seats">
        {seats.map((_, index) => <i key={index} style={{ animationDelay: `${index * 18}ms` }} />)}
      </div>
      <div className="mini-card">
        <small>SELECTED SEAT</small><strong>G12</strong><span>Excellent view · 92%</span>
      </div>
    </div>
  )
}
