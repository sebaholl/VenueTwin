import type { VenueConfig } from '../types/venue'
import { venueTypeLabel } from './projectPresets'
import { estimateCapacity, generateSeatLayout } from './venue'

const escapeMarkup = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)
export const projectSlug = (name: string) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'venue-project'

export function renderVenuePlanSvg(config: VenueConfig) {
  const seats = generateSeatLayout(config)
  const stage = config.stagePosition ?? { offsetX: 0, offsetY: 0, rotation: 0 }
  const boundary = (config.planBoundary ?? []).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
  const rows = Array.from({ length: config.rows }, (_, row) => seats.filter((seat) => seat.row === row))
  const planX = 100
  const planY = 110
  const title = escapeMarkup(config.name)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1140" viewBox="0 0 1200 760">
  <defs><pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="#183044" stroke-width="1"/></pattern></defs>
  <rect width="1200" height="760" rx="22" fill="#07111f"/>
  <text x="65" y="58" fill="#5be2c3" font-family="Arial,sans-serif" font-size="11" font-weight="700" letter-spacing="2">VENUE TWIN · ${escapeMarkup(venueTypeLabel(config.venueType).toUpperCase())}</text>
  <text x="65" y="88" fill="#f2f7f6" font-family="Arial,sans-serif" font-size="25" font-weight="700">${title}</text>
  <text x="1135" y="61" text-anchor="end" fill="#5be2c3" font-family="Arial,sans-serif" font-size="24" font-weight="700">${estimateCapacity(config)}</text>
  <text x="1135" y="82" text-anchor="end" fill="#78909a" font-family="Arial,sans-serif" font-size="9" letter-spacing="1">TOTAL SEATS</text>
  <g transform="translate(${planX} ${planY})"><rect width="1000" height="620" rx="14" fill="#0a1725" stroke="#1d3447"/><rect width="1000" height="620" rx="14" fill="url(#grid)"/>
  ${boundary.length >= 3 ? `<polygon points="${boundary.map((point) => `${point.x},${point.y}`).join(' ')}" fill="#5be2c30d" stroke="#5be2c399" stroke-width="2" stroke-dasharray="9 6"/>` : ''}
  <g transform="translate(${500 + stage.offsetX * 24} ${76 + stage.offsetY * 24}) rotate(${stage.rotation})"><rect x="${-(150 + config.stageWidth * 10)}" y="-34" width="${300 + config.stageWidth * 20}" height="68" rx="7" fill="#162d3f" stroke="#577181"/><text y="6" text-anchor="middle" fill="#a4b9b6" font-family="Arial,sans-serif" font-size="13" font-weight="700" letter-spacing="3">STAGE · ${config.stageWidth} M</text></g>
  ${seats.map((seat) => `<circle cx="${500 + seat.position[0] * 24}" cy="${150 + seat.position[2] * 24}" r="5.3" fill="#5be2c3" stroke="#07111f" stroke-width="2"/>`).join('')}
  ${rows.map((rowSeats, row) => rowSeats.length ? `<text x="${Math.min(...rowSeats.map((seat) => 500 + seat.position[0] * 24)) - 24}" y="${150 + rowSeats[0].position[2] * 24 + 4}" text-anchor="middle" fill="#718a93" font-family="Arial,sans-serif" font-size="11" font-weight="700">${String.fromCharCode(65 + row)}</text>` : '').join('')}
  </g></svg>`
}

function svgToPngDataUrl(config: VenueConfig) {
  return new Promise<string>((resolve, reject) => {
    const svg = renderVenuePlanSvg(config)
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas'); canvas.width = 1800; canvas.height = 1140
      const context = canvas.getContext('2d')
      if (!context) { URL.revokeObjectURL(url); reject(new Error('PNG rendering is not supported in this browser.')); return }
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url); resolve(canvas.toDataURL('image/png'))
    }
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('The venue plan could not be rendered.')) }
    image.src = url
  })
}

export async function downloadVenuePlanPng(config: VenueConfig) {
  const dataUrl = await svgToPngDataUrl(config)
  const anchor = document.createElement('a'); anchor.href = dataUrl; anchor.download = `${projectSlug(config.name)}-plan.png`; anchor.click()
}

export async function openVenuePdfReport(config: VenueConfig) {
  const report = window.open('', '_blank')
  if (!report) throw new Error('Allow pop-ups to create the PDF report.')
  report.opener = null
  report.document.write('<title>Preparing VenueTwin report…</title><p style="font:16px Arial;padding:30px">Preparing report…</p>')
  try {
    const plan = await svgToPngDataUrl(config)
    const generated = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date())
    const metrics = [
      ['Capacity', `${estimateCapacity(config)} seats`], ['Venue type', venueTypeLabel(config.venueType)], ['Geometry', config.geometry],
      ['Rows', String(config.rows)], ['Sections', String(config.sectors)], ['Stage width', `${config.stageWidth} m`],
      ['Seat spacing', `${config.seatSpacing ?? 0.72} m`], ['Row spacing', `${config.rowSpacing ?? 0.92} m`],
    ]
    report.document.open()
    report.document.write(`<!doctype html><html><head><title>${escapeMarkup(config.name)} · VenueTwin report</title><style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;color:#07111f;font-family:Arial,sans-serif}header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #07111f;padding-bottom:14px}header small{color:#278675;font-weight:700;letter-spacing:2px}h1{font-size:28px;margin:8px 0 0}.date{text-align:right;color:#6b797d;font-size:10px}.plan{width:100%;margin:20px 0 16px;border-radius:10px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #dce3df;border-radius:10px;overflow:hidden}.metric{padding:12px;border-right:1px solid #dce3df;border-bottom:1px solid #dce3df}.metric:nth-child(4n){border-right:0}.metric:nth-last-child(-n+4){border-bottom:0}.metric span{display:block;color:#788588;font-size:8px;text-transform:uppercase;letter-spacing:.7px}.metric b{display:block;margin-top:5px;font-size:13px;text-transform:capitalize}footer{display:flex;justify-content:space-between;margin-top:18px;color:#7a878a;font-size:8px}.warning{max-width:65%}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><header><div><small>VENUE TWIN · PROJECT REPORT</small><h1>${escapeMarkup(config.name)}</h1></div><div class="date">Generated<br><b>${escapeMarkup(generated)}</b></div></header><img class="plan" src="${plan}" alt="Venue seating plan"><section class="metrics">${metrics.map(([label, value]) => `<div class="metric"><span>${label}</span><b>${escapeMarkup(value)}</b></div>`).join('')}</section><footer><span class="warning">Visual planning estimate only. This report is not an architectural drawing or safety certification.</span><span>venuetwin.online</span></footer><script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`)
    report.document.close()
  } catch (error) { report.close(); throw error }
}
