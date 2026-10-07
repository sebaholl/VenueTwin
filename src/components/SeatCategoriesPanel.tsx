import { useState } from 'react'
import type { SeatRef, VenueConfig } from '../types/venue'
import { categorySummary, getCategories, removeCategory } from '../utils/seatCategories'
import { getRowSeats, getRowLabel, getSeatLabel } from '../utils/venue'

type Props = { config: VenueConfig; selectedSeat: SeatRef | null; onSelect: (seat: SeatRef) => void; onChange: (patch: Partial<VenueConfig>) => void }
export function SeatCategoriesPanel({ config, selectedSeat, onSelect, onChange }: Props) {
  const [rowChoice, setRowChoice] = useState(0)
  const row = Math.min(selectedSeat?.row ?? rowChoice, config.rows - 1)
  const seat = Math.min(selectedSeat?.seat ?? 0, getRowSeats(config, row) - 1)
  const categories = getCategories(config)
  const summary = categorySummary(config)
  const override = config.rowOverrides?.[row] ?? {}
  const updateRow = (patch: typeof override) => onChange({ rowOverrides: { ...config.rowOverrides, [row]: { ...override, ...patch } } })
  const money = (value: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency: config.currency ?? 'EUR' }).format(value)
  return <section className="control-section category-panel"><h2>Seat categories</h2>
    <p>Choose a row or seat below, or select a seat in 3D. Row changes clear its individual category overrides.</p>
    <label>Currency<select value={config.currency ?? 'EUR'} onChange={(e) => onChange({ currency: e.target.value as VenueConfig['currency'] })}>{['EUR', 'CZK', 'DKK', 'USD', 'GBP'].map((c) => <option key={c}>{c}</option>)}</select></label>
    <small>Changing currency relabels prices; it does not convert them.</small>
    {categories.map((category) => <fieldset key={category.id}><legend>{category.name}</legend>
      <label>Name<input maxLength={40} value={category.name} onChange={(e) => onChange({ categories: categories.map((c) => c.id === category.id ? { ...c, name: e.target.value } : c) })} /></label>
      <div className="category-fields"><label>Colour<input type="color" value={category.color} onChange={(e) => onChange({ categories: categories.map((c) => c.id === category.id ? { ...c, color: e.target.value } : c) })} /></label>
      <label>Price<input type="number" min="0" max="1000000" step="0.01" placeholder="Not set" value={category.price ?? ''} onChange={(e) => onChange({ categories: categories.map((c) => c.id === category.id ? { ...c, price: e.target.value === '' ? undefined : Math.min(1000000, Math.max(0, Number(e.target.value))) } : c) })} /></label></div>
      {category.id !== 'standard' && <button type="button" onClick={() => onChange(removeCategory(config, category.id))}>Remove · reassign to Standard</button>}
    </fieldset>)}
    <button type="button" disabled={categories.length >= 8} onClick={() => onChange({ categories: [...categories, { id: crypto.randomUUID(), name: 'New category', color: '#a78bfa' }] })}>+ Add category</button>
    <div className="category-fields"><label>Row<select value={row} onChange={(e) => { const next = Number(e.target.value); setRowChoice(next); onSelect({ row: next, seat: 0, label: getSeatLabel(config, next, 0) }) }}>{Array.from({ length: config.rows }, (_, i) => <option key={i} value={i}>{getRowLabel(config, i)}</option>)}</select></label>
    <label>Seat<select value={seat} onChange={(e) => { const next = Number(e.target.value); onSelect({ row, seat: next, label: getSeatLabel(config, row, next) }) }}>{Array.from({ length: getRowSeats(config, row) }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}</select></label></div>
    <label>Whole row category<select value={override.categoryId ?? 'standard'} onChange={(e) => updateRow({ categoryId: e.target.value, seatCategories: {} })}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>Seat category<select value={override.seatCategories?.[seat] ?? ''} onChange={(e) => { const next = { ...override.seatCategories }; if (e.target.value) next[seat] = e.target.value; else delete next[seat]; updateRow({ seatCategories: next }) }}><option value="">Inherit row</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label className="accessible-choice"><input type="checkbox" checked={!!override.accessibleSeats?.[seat]} onChange={(e) => updateRow({ accessibleSeats: { ...override.accessibleSeats, [seat]: e.target.checked } })} /> Accessible seat</label>
    <small>Planning label only; does not certify accessible dimensions or routes.</small>
    <div className="category-summary" aria-live="polite">{summary.counts.map((c) => <div key={c.id}><span><i style={{ background: c.color }} />{c.name}</span><b>{c.count} seats</b></div>)}<div><span>Accessible</span><b>{summary.accessible}</b></div><div><span>Sell-out estimate</span><b>{money(summary.revenue)}</b></div><small>{summary.unpriced ? `${summary.unpriced} seats have no price and are excluded.` : 'All seats priced.'} Gross estimate, before fees and taxes.</small></div>
  </section>
}
