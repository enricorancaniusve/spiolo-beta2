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

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await api.confessions.list(category ? { category } : {})
      setConfessions(data?.confessions || [])
      const s = await api.stats()
      setStats({ total: s.confessions_posted || 0, today: s.total_listens || 0 })
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [category])

  return (
    <div className="home-container">
      <header className="app-header">
        <h1 className="page-title">Lo Spiolo</h1>
        <p className="page-subtitle">Non si vede ma c'è. Appostato. In ascolto.</p>
        <div className="stats-row">Spiólate totali: <b>{stats.total}</b>. Oggi: <b>{stats.today}</b></div>
        
        <div className="taxonomy-label">
          <div className="taxonomy-title">Spiolus paparazzus — Tassonomia</div>
          <p className="taxonomy-text">Lo spiolo fruga nella spazzatura, sbircia dalla serratura… e poi racconta.</p>
        </div>

        <button className="btn-primary" onClick={() => setShowCompose(!showCompose)}>
          {showCompose ? 'Chiudi' : '+ Spiola'}
        </button>
      </header>

      {/* COMPONENTE SINGOLO: POSIZIONATO FUORI DAL FEED */}
      {showCompose && (
        <ComposeForm onSubmitted={() => { setShowCompose(false); loadData(); }} />
      )}

      <nav className="tabs-row">
        {CAT_DATA.map(cat => (
          <button key={String(cat.id)} className={`tab-btn ${category === cat.id ? 'active' : ''}`} onClick={() => setCategory(cat.id)}>
            <span className="tab-emoji">{cat.emoji}</span>
            <span className="tab-name">{cat.name}</span>
          </button>
        ))}
      </nav>

      <section className="feed">
        {loading ? <div style={{textAlign: 'center', color: 'var(--text-gray)'}}>Intercettando segreti...</div> : 
          confessions.map(c => <ConfessionCard key={c.id} confession={c} />)
        }
      </section>
    </div>
  )
}
