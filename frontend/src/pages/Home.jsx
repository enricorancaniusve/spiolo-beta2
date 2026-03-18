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
      <header style={{ marginBottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Lo Spiolo</h1>
          <p className="page-subtitle">I sussurri che non dovresti sentire.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCompose(v => !v)}>
          {showCompose ? 'Chiudi' : '+ Confessa'}
        </button>
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

      <div className="feed">
        {loading && <div style={{ textAlign: 'center', color: 'var(--text-gray)' }}>Intercettando segreti...</div>}
        {!loading && confessions.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-gray)' }}>Nessuno sta spiando qui.</div>
        )}
        {!loading && confessions.map(c => <ConfessionCard key={c.id} confession={c} />)}
      </div>
    </main>
  )
}
