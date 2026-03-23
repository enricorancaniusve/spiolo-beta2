import React, { useEffect, useState, useRef } from 'react'
import { api } from '../api/client'
import ConfessionCard from '../components/ConfessionCard'

const CAT_DATA = [
  { id: null, name: 'Tutti', emoji: '🌐' },
  { id: 'love', name: 'Amore', emoji: '❤️' },
  { id: 'school', name: 'Scuola', emoji: '📚' },
  { id: 'secrets', name: 'Segreti', emoji: '🤫' },
  { id: 'funny', name: 'Buffi', emoji: '😂' },
  { id: 'drama', name: 'Drama', emoji: '🎭' }
]

const PAGE_SIZE = 10
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// ─── Icona persone SVG ────────────────────────────────────────────────────────
const PeopleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0 }}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)

// ─── Device ID anonimo ────────────────────────────────────────────────────────
function getDeviceId() {
  try {
    let id = localStorage.getItem('spiolo_device_id')
    if (!id) {
      id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
      localStorage.setItem('spiolo_device_id', id)
    }
    return id
  } catch {
    return 'dev_anonymous'
  }
}

export default function Home({ showCompose, setShowCompose }) {
  const [confessions, setConfessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [category, setCategory] = useState(null)
  const [stats, setStats] = useState({ total: 0, today: 0 })
  const [online, setOnline] = useState(1)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [visible, setVisible] = useState(false)
  const pingRef = useRef(null)

  // ─── Ping presenza online ───────────────────────────────────────────────────
  async function ping() {
    try {
      const res = await fetch(`${BASE}/api/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: getDeviceId() }),
      })
      const data = await res.json()
      setOnline(data.online || 1)
    } catch {}
  }

  useEffect(() => {
    ping() // ping immediato all'apertura
    pingRef.current = setInterval(ping, 30_000) // poi ogni 30s
    return () => clearInterval(pingRef.current)
  }, [])

  // ─── Carica feed ─────────────────────────────────────────────────────────────
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

        {/* Contatore online */}
        <div className="online-row">
          <PeopleIcon />
          <span>Spioli online:</span>
          <b className="online-count">{online}</b>
        </div>

        <div className="taxonomy-label">
          <div className="taxonomy-title">Spiolus paparazzus — Tassonomia del pettegolezzo</div>
          <p className="taxonomy-text">
            Lo spiolo fotografa le mucche che si tolgono il reggiseno, va a spiare i fidanzamenti dei gabbiani sulla spiaggia, guarda nei frigoriferi, apre la posta, fruga nella spazzatura, sbircia dalla serratura… e poi racconta, maligno, a un altro spiolo, nella catena infinita del pettegolezzo spiolico.
          </p>
        </div>
      </header>

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
              <div key={c.id} className="card-fadein" style={{ animationDelay: `${Math.min(i, 5) * 60}ms` }}>
                <ConfessionCard confession={c} />
              </div>
            ))}
            {hasMore && !loading && (
              <div style={{ textAlign: 'center', padding: '20px 0 40px' }}>
                <button onClick={loadMore} disabled={loadingMore} className="load-more-btn">
                  {loadingMore ? 'Caricamento…' : 'Carica altri segreti'}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
