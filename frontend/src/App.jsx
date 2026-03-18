import React from 'react'
import { Routes, Route, NavLink } from 'react-router'
import Home from './pages/Home'
import Trending from './pages/Trending'
import Notifications from './pages/Notifications'

export default function App() {
  return (
    <div id="app-wrapper">
      <nav className="main-nav">
        <NavLink to="/" end>Feed</NavLink>
        <NavLink to="/trending">Trending</NavLink>
        <NavLink to="/notifications">Notifiche</NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/trending" element={<Trending />} />
        <Route path="/notifications" element={<Notifications />} />
      </Routes>
      
      <footer style={{ textAlign: 'center', marginTop: 80, padding: 30, opacity: 0.3, fontSize: '0.7rem' }}>
        SPIOLO — Spiolus paparazzus — 2026
      </footer>
    </div>
  )
}
