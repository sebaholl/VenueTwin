import { ArrowUpRight, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Brand } from './Brand'

export function SiteLayout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="site-shell">
      <header className="site-header">
        <Brand />
        <button className="menu-button" onClick={() => setOpen((value) => !value)} aria-label="Toggle menu">
          {open ? <X /> : <Menu />}
        </button>
        <nav className={open ? 'site-nav is-open' : 'site-nav'}>
          <NavLink to="/" onClick={() => setOpen(false)}>Product</NavLink>
          <a href="/#workflow" onClick={() => setOpen(false)}>How it works</a>
          <NavLink to="/about" onClick={() => setOpen(false)}>About</NavLink>
          <Link className="button button-dark button-small" to="/studio" onClick={() => setOpen(false)}>
            Open studio <ArrowUpRight size={16} />
          </Link>
        </nav>
      </header>
      <main><Outlet /></main>
      <footer className="footer">
        <Brand />
        <p>Make every seat a confident choice.</p>
        <div><Link to="/studio">Studio</Link><Link to="/about">About</Link></div>
        <small>© {new Date().getFullYear()} VenueTwin. Product prototype.</small>
      </footer>
    </div>
  )
}
