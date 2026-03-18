import React from 'react'
import { Routes, Route, NavLink } from 'react-router'
import Home from './pages/Home'
import Trending from './pages/Trending'
import Notifications from './pages/Notifications'

export default function App() {
  return (
    <div className="app-shell">
      <header className="header">
        <div className="header-logo"><span>S</span>piolo</div>
        <nav className="header-nav">
          <NavLink to="/" end className={({isActive}) => isActive ? 'active' : ''}>Feed</NavLink>
          <NavLink to="/trending" className={({isActive}) => isActive ? 'active' : ''}>Trending</NavLink>
          <NavLink to="/notifiche" className={({isActive}) => isActive ? 'active' : ''}>Notifiche</NavLink>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/trending" element={<Trending />} />
        <Route path="/notifiche" element={<Notifications />} />
      </Routes>
      <footer style={{ textAlign: 'center', padding: '32px 0 16px', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.08em' }}>
        SPIOLO — <em>Spiolus paparazzus</em> — pettegolezzo anonimo dal 2025
      </footer>
    </div>
  )
}
