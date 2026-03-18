import React, { useEffect, useState } from 'react'
import { api } from '../api/client'
import ConfessionCard from '../components/ConfessionCard'
import ComposeForm from '../components/ComposeForm'

const CAT_DATA = [
  { id: null, name: 'Tutti', emoji: '🌐' },
  { id: 'love', name: 'Amore', emoji: '❤️' },
  { id: 'school', name: 'Scuola', emoji: '📚' },
  { id: 'secrets', name: 'Segreti', emoji: '🤫' },
  { id: 'funny', name: 'Buffi', emoji: '😂' },
  { id: 'drama', name: 'Drama', emoji: '🎭' }
]

export default function Home() {
  const [confessions, setConfessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState(null)
  const [showCompose, setShowCompose] = useState(false)
  const [stats, setStats] = useState({ total: 0, today: 0 })

  async function load(cat) {
    setLoading(true)
    try {
      const data = await api.confessions.list(cat ? { category: cat } : {})
      setConfessions(data.confessions || [])
      // Recupera le statistiche reali dal backend
      const statsData = await api.stats();
      setStats({ total: statsData.total || 0, today: statsData.today || 0 });
    } catch (e) { console.error(e) } 
    finally { setLoading(false) }
  }

  useEffect(() => { load(category) }, [category])

  return (
    <main>
      <header className="app-header">
        <h1 className="page-title">Lo Spiolo</h1>
        <p className="page-subtitle">Non si vede ma c'è. Appostato. In ascolto. Pronto a raccontare.</p>
        
        <div className="stats-row">
          Spiólate totali: <b>{stats.total.toLocaleString('it-IT')}</b>. Oggi: <b>{stats.today.toLocaleString('it-IT')}</b>
        </div>
        
        <div className="taxonomy-label">
          <div style={{ fontFamily: 'var(--font-fancy)', color: 'var(--accent)', marginBottom: 8, fontWeight: 600 }}>
            Spiolus paparazzus — Tassonomia del pettegolezzo
          </div>
          <p className="taxonomy-text">
            Lo spiolo fotografa le mucche che si tolgono il reggiseno, va a spiare i fidanzamenti dei gabbiani sulla spiaggia, guarda nei frigoriferi, apre la posta, fruga nella spazzatura, sbircia dalla serratura… e poi racconta, maligno, a un altro spiolo, nella catena infinita del pettegolezzo spiolico.
          </p>
        </div>

        <button className="btn-primary" onClick={() => setShowCompose(v => !v)}>
          {showCompose ? 'Chiudi' : '+ Spiola'}
        </button>
      </header>

      {showCompose && <ComposeForm onSubmitted={() => { setShowCompose(false); load(category); }} />}

      <nav className="tabs-row">
        {CAT_DATA.map(cat => (
          <button
            key={String(cat.id)}
            className={`tab-btn ${category === cat.id ? 'active' : ''}`}
            onClick={() => setCategory(cat.id)}
          >
            <span style={{ fontSize: '1.2rem' }}>{cat.emoji}</span>
            <span style={{ fontSize: '0.6rem', marginTop: 4, textTransform: 'uppercase' }}>{cat.name}</span>
          </button>
        ))}
      </nav>

      <div className="feed">
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-gray)' }}>Intercettando segreti...</div>
        ) : (
          confessions.map(c => <ConfessionCard key={c.id} confession={c} />)
        )}
      </div>
    </main>
  )
}
