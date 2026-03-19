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

  useEffect(() => {
    let isMounted = true;
    async function fetchData() {
      setLoading(true)
      try {
        const data = await api.confessions.list(category ? { category } : {})
        if (isMounted) setConfessions(data?.confessions || [])

        try {
          const s = await api.stats()
          if (isMounted && s) setStats({ total: s.confessions_posted || 0, today: s.today || 0 })
        } catch (err) { console.warn("Stats non disponibili") }
      } catch (e) {
        console.error("Errore Home:", e)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    fetchData()
    return () => { isMounted = false }
  }, [category])

  return (
    <div className="home-container">
      <header className="app-header">
        <h1 className="page-title">Lo Spiolo</h1>
        <p className="page-subtitle">Non si vede ma c'è. Appostato. In ascolto. Pronto a raccontare.</p>
        
        <div className="stats-row">
          Spiólate totali: <b>{(stats.total || 0).toLocaleString('it-IT')}</b>. Oggi: <b>{(stats.today || 0).toLocaleString('it-IT')}</b>
        </div>
        
        <div className="taxonomy-label">
          <div className="taxonomy-title">Spiolus paparazzus — Tassonomia del pettegolezzo</div>
          <p className="taxonomy-text">
            Lo spiolo fotografa le mucche che si tolgono il reggiseno, va a spiare i fidanzamenti dei gabbiani sulla spiaggia, guarda nei frigoriferi, apre la posta, fruga nella spazzatura, sbircia dalla serratura… e poi racconta, maligno, a un altro spiolo, nella catena infinita del pettegolezzo spiolico.
          </p>
        </div>

        <button className="btn-primary" onClick={() => setShowCompose(!showCompose)}>
          {showCompose ? 'Chiudi' : '+ Spiola'}
        </button>
      </header>

      {showCompose && <ComposeForm onSubmitted={() => { setShowCompose(false); window.location.reload(); }} />}

      <nav className="tabs-row">
        {CAT_DATA.map(cat => (
          <button 
            key={String(cat.id)} 
            className={`tab-btn ${category === cat.id ? 'active' : ''}`}
            onClick={() => setCategory(cat.id)}
          >
            <span className="tab-emoji">{cat.emoji}</span>
            <span className="tab-name">{cat.name}</span>
          </button>
        ))}
      </nav>

      <section className="feed">
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-gray)' }}>Intercettando segreti...</div>
        ) : (
          <>
            {confessions.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '40px 0' }}>Nessun segreto qui.</div>}
            {confessions.map(c => <ConfessionCard key={c.id} confession={c} />)}
          </>
        )}
      </section>
    </div>
  )
}
