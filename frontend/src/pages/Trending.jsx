import React, { useEffect, useState } from 'react'
import { api } from '../api/client'
import ConfessionCard from '../components/ConfessionCard'

export default function Trending() {
  const [confessions, setConfessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.confessions.trending()
      .then(data => setConfessions(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <main>
      <h1 className="page-title">Trending 🔥</h1>
      <p className="page-subtitle">I segreti più spiati degli ultimi 7 giorni</p>
      {loading && <div className="loading">Raccogliendo pettegolezzi…</div>}
      {!loading && confessions.length === 0 && (
        <div className="empty-state">Nessun trending ancora.<br/>Torna domani, spiolo.</div>
      )}
      {confessions.map(c => <ConfessionCard key={c.id} confession={c} />)}
    </main>
  )
}
