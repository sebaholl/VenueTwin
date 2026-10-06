import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { SiteLayout } from './components/SiteLayout'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { HomePage } from './pages/HomePage'
import { AboutPage } from './pages/AboutPage'
import { NotFoundPage } from './pages/NotFoundPage'

const StudioPage = lazy(() => import('./pages/StudioPage').then((module) => ({ default: module.StudioPage })))
const SharedProjectPage = lazy(() => import('./pages/SharedProjectPage').then((module) => ({ default: module.SharedProjectPage })))
const CustomerViewerPage = lazy(() => import('./pages/CustomerViewerPage').then((module) => ({ default: module.CustomerViewerPage })))

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="about" element={<AboutPage />} />
      </Route>
      <Route path="studio" element={<AppErrorBoundary><Suspense fallback={<div className="route-loader"><span /></div>}><StudioPage /></Suspense></AppErrorBoundary>} />
      <Route path="share/:token" element={<AppErrorBoundary><Suspense fallback={<div className="route-loader"><span /></div>}><SharedProjectPage /></Suspense></AppErrorBoundary>} />
      <Route path="viewer" element={<AppErrorBoundary title="This venue preview could not be rendered." actionLabel="Reload preview"><Suspense fallback={<div className="route-loader"><span /></div>}><CustomerViewerPage /></Suspense></AppErrorBoundary>} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
