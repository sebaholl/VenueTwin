import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { SiteLayout } from './components/SiteLayout'
import { HomePage } from './pages/HomePage'
import { AboutPage } from './pages/AboutPage'
import { NotFoundPage } from './pages/NotFoundPage'

const StudioPage = lazy(() => import('./pages/StudioPage').then((module) => ({ default: module.StudioPage })))

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="about" element={<AboutPage />} />
      </Route>
      <Route path="studio" element={<Suspense fallback={<div className="route-loader"><span /></div>}><StudioPage /></Suspense>} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
