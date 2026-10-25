import { ArrowUpRight, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Brand } from './Brand'

export function SiteLayout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  return (
    <div className={pathname === '/about' ? 'site-shell site-shell-dark' : 'site-shell'}>
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
        <div><Link to="/studio">Studio</Link><Link to="/about">About</Link><Link to="/service">Service & support</Link></div>
        <small>© {new Date().getFullYear()} VenueTwin. Product prototype.</small>
      </footer>
    </div>
  )
}
