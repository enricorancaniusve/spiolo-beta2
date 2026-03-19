import React, { useState, useEffect } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router'
import Home from './pages/Home'
import Trending from './pages/Trending'
import Notifications from './pages/Notifications'
import SpiolaDetail from './pages/SpiolaDetail'
import ComposeForm from './components/ComposeForm'

export default function App() {
  const [showCompose, setShowCompose] = useState(false)
  const location = useLocation()

  // Blocca scroll quando modal aperto
  useEffect(() => {
    document.body.style.overflow = showCompose ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [showCompose])

  // Mostra FAB solo nella home e nel trending (non nella pagina singola)
  const showFab = location.pathname === '/' || location.pathname === '/trending'

  return (
    <>
      <div id="app-wrapper">
        <nav className="main-nav">
          <NavLink to="/" end>Feed</NavLink>
          <NavLink to="/trending">Trending</NavLink>
          <NavLink to="/notifications">Notifiche</NavLink>
        </nav>
        <Routes>
          <Route path="/" element={<Home showCompose={showCompose} setShowCompose={setShowCompose} />} />
          <Route path="/trending" element={<Trending />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/spiola/:id" element={<SpiolaDetail />} />
        </Routes>
        <footer style={{ textAlign: 'center', marginTop: 80, padding: 30, opacity: 0.3, fontSize: '0.7rem' }}>
          SPIOLO — Spiolus paparazzus — 2026
        </footer>
      </div>

      {/* FAB fuori da #root — così position:fixed funziona rispetto alla viewport */}
      {showFab && (
        <div className="fab-container">
          <button className="fab-btn" onClick={() => setShowCompose(v => !v)}>
            🗣️ Spiola
          </button>
        </div>
      )}

      {/* Modal compose — anch'esso fuori da #root */}
      {showCompose && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCompose(false) }}>
          <div className="modal-box">
            <button className="modal-close" onClick={() => setShowCompose(false)}>✕</button>
            <ComposeForm onSubmitted={() => { setShowCompose(false); window.location.reload() }} />
          </div>
        </div>
      )}
    </>
  )
}
