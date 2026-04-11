import React, { useEffect, useState, useRef } from 'react'
import { api } from '../api/client'
import ConfessionCard from '../components/ConfessionCard'
import spioloImg from '../spiolo-main8.svg'

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

function getDeviceId() {
  try {
    let id = localStorage.getItem('spiolo_device_id')
    if (!id) {
      id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
      localStorage.setItem('spiolo_device_id', id)
    }
    return id
  } catch { return 'dev_anonymous' }
}

const PeopleIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0 }}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)

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
  const [scrollY, setScrollY] = useState(0)
  const pingRef = useRef(null)

  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const FULL_HEIGHT = vh
  const SMALL_HEIGHT = Math.round(vh * 0.25)
  const SCROLL_RANGE = FULL_HEIGHT - SMALL_HEIGHT
  const currentHeight = Math.max(SMALL_HEIGHT, FULL_HEIGHT - scrollY)
  const transitionProgress = Math.min(1, scrollY / SCROLL_RANGE)
  const objectPosition = `center ${40 + transitionProgress * 40}%`

  useEffect(() => {
    function handleScroll() { setScrollY(window.scrollY) }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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
    ping()
    pingRef.current = setInterval(ping, 30_000)
    return () => clearInterval(pingRef.current)
  }, [])

  useEffect(() => {
    let isMounted = true
    setVisible(false)
    async function fetchData() {
      setLoading(true); setPage(1); setHasMore(true)
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
      } catch (e) { console.error(e) }
      finally { if (isMounted) setLoading(false) }
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
    } catch (e) { console.error(e) }
    finally { setLoadingMore(false) }
  }

  const bigLogoOpacity = Math.max(0, 1 - transitionProgress * 2)
  const bigLogoSize = 3.2 - transitionProgress * 1.5

  return (
    <div className="home-container">

      {/* ── SPIOLO STICKY ────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 600,
        height: currentHeight,
        zIndex: 10,
        overflow: 'hidden',
        background: '#341d56',
      }}>
        <img
          src={spioloImg}
          alt="Lo Spiolo"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: objectPosition,
            display: 'block',
          }}
        />

        {/* Logo grande sopra la testa */}
        <div style={{
          position: 'absolute',
          top: '18%',
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: bigLogoOpacity,
          pointerEvents: 'none',
        }}>
          <span style={{
            fontFamily: 'Fraunces, serif',
            fontSize: `${bigLogoSize}rem`,
            color: '#fff',
            letterSpacing: '-0.5px',
            textShadow: '0 2px 24px rgba(0,0,0,0.5)',
          }}>
            Lo Spiolo
          </span>
        </div>

        {/* Sfumatura ridotta — solo 20% di altezza e opacità bassa */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '20%',
          background: 'linear-gradient(to bottom, transparent, rgba(46,102,64,0.7))',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Spacer */}
      <div style={{ height: FULL_HEIGHT }} />

      {/* ── FEED ─────────────────────────────────────────────────────── */}
      <div className="bush-feed">

        {/* Stats nel feed */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 20px',
          borderBottom: '1px solid rgba(0,0,0,0.15)',
          background: 'rgba(0,0,0,0.15)',
          fontSize: '0.8rem',
          color: 'rgba(255,255,255,0.6)',
          flexWrap: 'wrap',
          gap: 6,
        }}>
          <span>Spiólate: <b style={{ color: '#f5d800' }}>{(stats.total || 0).toLocaleString('it-IT')}</b> · Oggi: <b style={{ color: '#f5d800' }}>{(stats.today || 0).toLocaleString('it-IT')}</b></span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <PeopleIcon />
            <span>Online: <b style={{ color: '#4ade80' }}>{online}</b></span>
          </div>
        </div>

        <div className="taxonomy-label">
          <div className="taxonomy-title">Spiolus paparazzus — Tassonomia del pettegolezzo</div>
          <p className="taxonomy-text">
            Lo spiolo fotografa le mucche che si tolgono il reggiseno, va a spiare i fidanzamenti dei gabbiani sulla spiaggia, guarda nei frigoriferi, apre la posta, fruga nella spazzatura, sbircia dalla serratura… e poi racconta, maligno, a un altro spiolo, nella catena infinita del pettegolezzo spiolico.
          </p>
        </div>

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

        <section className={`feed ${visible ? 'feed-visible' : ''}`} style={{ paddingBottom: 100 }}>
          {loading ? (
            <div className="feed-loading">Intercettando segreti…</div>
          ) : (
            <>
              {confessions.length === 0 && <div className="feed-empty">Nessun segreto qui.</div>}
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
    </div>
  )
}
