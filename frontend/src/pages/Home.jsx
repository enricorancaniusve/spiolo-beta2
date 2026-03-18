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
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(category) }, [category])

  function onSubmitted(c) {
    setShowCompose(false)
    setConfessions(prev => [c, ...prev])
  }

  return (
    <main>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 24 }}>
        <div>
          <h1 className="page-title">Pettegolezzi freschi</h1>
          <p className="page-subtitle">Leggi solo dopo aver ascoltato</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCompose(v => !v)}>
          {showCompose ? '✕ Chiudi' : '+ Confessa'}
        </button>
      </div>

      {showCompose && <ComposeForm onSubmitted={onSubmitted} />}

      <div className="tabs-row">
        {CATS.map(c => (
          <button
            key={String(c)}
            className={`tab-btn ${category === c ? 'active' : ''}`}
            onClick={() => setCategory(c)}
          >
            {CAT_IT[String(c)] || c}
          </button>
        ))}
      </div>

      {loading && <div className="loading">Caricamento segreti…</div>}
      {!loading && confessions.length === 0 && (
        <div className="empty-state">Nessuna confessione qui.<br/>Sii il primo spiolo.</div>
      )}
      {confessions.map(c => <ConfessionCard key={c.id} confession={c} />)}
    </main>
  )
}
