import React, { useEffect, useState, useRef, useCallback } from 'react'
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

const PAGE_SIZE = 10

export default function Home() {
  const [confessions, setConfessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [category, setCategory] = useState(null)
  const [showCompose, setShowCompose] = useState(false)
  const [stats, setStats] = useState({ total: 0, today: 0 })
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [visible, setVisible] = useState(false) // per fade-in

  // Carica prima pagina
  useEffect(() => {
    let isMounted = true
    setVisible(false)
    async function fetchData() {
      setLoading(true)
      setPage(1)
      setHasMore(true)
      try {
        const params = { limit: PAGE_SIZE, page: 1 }
        if (category) params.category = category
        const data = await api.confessions.list(params)
        if (isMounted) {
          const list = data?.confessions || []
          setConfessions(list)
          setHasMore(list.length === PAGE_SIZE)
          // Fade-in con piccolo delay
          setTimeout(() => setVisible(true), 50)
        }
        try {
          const s = await api.stats()
          if (isMounted && s) setStats({ total: s.confessions_posted || 0, today: s.today || 0 })
        } catch {}
      } catch (e) {
        console.error('Errore Home:', e)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    fetchData()
    return () => { isMounted = false }
  }, [category])

  // Carica pagina successiva
  async function loadMore() {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const params = { limit: PAGE_SIZE, page: nextPage }
      if (category) params.category = category
      const data = await api.confessions.list(params)
      const newList = data?.confessions || []
      setConfessions(prev => [...prev, ...newList])
      setPage(nextPage)
      setHasMore(newList.length === PAGE_SIZE)
    } catch (e) {
      console.error('Errore loadMore:', e)
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="home-container" style={{ paddingBottom: 100 }}>
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
      </header>

      {showCompose && (
        <ComposeForm onSubmitted={() => {
          setShowCompose(false)
          window.location.reload()
        }} />
      )}

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

      <section className={`feed ${visible ? 'feed-visible' : ''}`}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '40px 0' }}>
            Intercettando segreti…
          </div>
        ) : (
          <>
            {confessions.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '40px 0' }}>
                Nessun segreto qui.
              </div>
            )}
            {confessions.map((c, i) => (
              <div
                key={c.id}
                className="card-fadein"
                style={{ animationDelay: `${Math.min(i, 5) * 60}ms` }}
              >
                <ConfessionCard confession={c} />
              </div>
            ))}

            {/* Bottone carica altri */}
            {hasMore && !loading && (
              <div style={{ textAlign: 'center', padding: '20px 0 40px' }}>
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border-muted)',
                    color: 'var(--text-gray)',
                    padding: '10px 28px',
                    borderRadius: 20,
                    cursor: loadingMore ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem',
                    transition: 'border-color 0.2s, color 0.2s',
                  }}
                >
                  {loadingMore ? 'Caricamento…' : 'Carica altri segreti'}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Bottone "+ Spiola" fisso in basso */}
      <div className="fab-container">
        <button
          className="fab-btn"
          onClick={() => setShowCompose(v => !v)}
        >
          {showCompose ? '✕ Chiudi' : '🗣️ Spiola'}
        </button>
      </div>
    </div>
  )
}
