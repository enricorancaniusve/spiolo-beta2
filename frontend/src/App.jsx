import React from 'react'
import { Routes, Route, NavLink } from 'react-router'
import Home from './pages/Home'
import Trending from './pages/Trending'
import Notifications from './pages/Notifications'

export default function App() {
  return (
    <div className="app-container">
      <nav>
        <NavLink to="/" end>Feed</NavLink>
        <NavLink to="/trending">Trending</NavLink>
        <NavLink to="/notifications">Notifiche</NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/trending" element={<Trending />} />
        <Route path="/notifications" element={<Notifications />} />
      </Routes>
    </div>
  )
}
