import React, { useEffect, useState } from 'react'
import { api } from '../api/client'
import ConfessionCard from '../components/ConfessionCard'
import ComposeForm from '../components/ComposeForm'

const CATS = [null, 'love', 'school', 'secrets', 'funny', 'drama']
const CAT_IT = { null: 'Tutti', love: 'Amore', school: 'Scuola', secrets: 'Segreti', funny: 'Buffo', drama: 'Drama' }

export default function Home() {
  const [confessions, setConfessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState(null)
  const [showCompose, setShowCompose] = useState(false)

  async function load(cat) {
    setLoading(true)
    try {
      const data = await api.confessions.list(cat ? { category: cat } : {})
      setConfessions(data.confessions || [])
    } catch (e) { console.error(e) } 
    finally { setLoading(false) }
  }

  useEffect(() => { load(category) }, [category])

  return (
    <main>
      <header style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="page-title">Lo Spiolo</h1>
          <button className="btn-primary" onClick={() => setShowCompose(v => !v)}>
            {showCompose ? 'Chiudi' : '+ Confessa'}
          </button>
        </div>
        <p className="page-subtitle">I sussurri che non dovresti sentire.</p>
      </header>

      {showCompose && <ComposeForm onSubmitted={() => { setShowCompose(false); load(category); }} />}

      <nav className="tabs-row">
        {CATS.map(c => (
          <button
            key={String(c)}
            className={`tab-btn ${category === c ? 'active' : ''}`}
            onClick={() => setCategory(c)}
          >
            {CAT_IT[String(c)] || c}
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="loading">Intercettando segreti...</div>
      ) : (
        <div className="feed">
          {confessions.length === 0 && <div className="empty-state">Nessuno sta spiando qui.</div>}
          {confessions.map(c => <ConfessionCard key={c.id} confession={c} />)}
        </div>
      )}
    </main>
  )
}
