import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { Brand } from './components/Brand'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import './production-viewer.css'
import './managed-site.css'
const Viewer = lazy(() => import('./pages/ProductionViewerPage').then(m => ({ default: m.ProductionViewerPage })))
const operator = import.meta.env.VITE_OPERATOR_NAME, support = import.meta.env.VITE_SUPPORT_EMAIL
export function Service() {
  return <main className="managed-info"><Brand /><h1>Service & support</h1><p>{operator} provides these read-only venue previews.</p><h2>Your venue preview</h2><p>Seat views show an operator-reviewed model or a clearly labelled fictional demonstration. They are approximate: people, event equipment, lighting and venue changes can affect the actual view. No booking or live seat availability is provided.</p><h2>Privacy and access</h2><p>The viewer does not require an account, use analytics, or send data to an AI provider. It downloads the venue package from this website. The hosting provider may retain normal access logs. Anyone with the venue link can view the public package; do not use it for confidential material.</p><h2>Contact</h2><p>For corrections, inaccessible content or loading problems, contact <a href={`mailto:${support}`}>{support}</a>. Include the venue name and version shown in the viewer.</p><nav><a href={import.meta.env.VITE_PRIVACY_URL}>Privacy notice</a><a href={import.meta.env.VITE_TERMS_URL}>Service terms</a><Link to="/">Home</Link></nav></main>
}
export function Home() {
  return <main className="managed-info"><Brand /><p className="managed-eyebrow">YOUR VENUE. YOUR POINT OF VIEW.</p><h1>See the view before you arrive.</h1><p>Open the venue link provided by {operator} to explore the auditorium, choose a seat and look around.</p>{import.meta.env.VITE_MANAGED_DEMO === '1' && <><p>This installation is a fictional demonstration, not a customer release.</p><Link className="managed-home-button" to="/venue?venue=/venues/demo/v1/venue.json">Explore the demonstration</Link></>}<nav><Link to="/service">Service & support</Link><a href={`mailto:${support}`}>Contact the operator</a></nav></main>
}
export function NotFound() { return <main className="managed-info"><Brand /><h1>Page not found</h1><p>Check your venue link, or contact the operator.</p><Link to="/">Return home</Link></main> }
createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><Routes><Route path="/" element={<Home />} /><Route path="/service" element={<Service />} /><Route path="/venue" element={<AppErrorBoundary title="This venue could not be displayed." actionLabel="Reload venue"><Suspense fallback={<main className="managed-empty">Opening venue…</main>}><Viewer /></Suspense></AppErrorBoundary>} /><Route path="*" element={<NotFound />} /></Routes></BrowserRouter></StrictMode>)
