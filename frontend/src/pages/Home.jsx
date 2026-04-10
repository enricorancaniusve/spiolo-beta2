import React, { useEffect, useState, useRef } from 'react'
import { api } from '../api/client'
import ConfessionCard from '../components/ConfessionCard'
import spioloImg from '../spiolo-main.svg'

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

// Bordo superiore del cespuglio — SVG organico inline
const BushEdge = () => (
  <svg
    viewBox="0 0 600 60"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'block', width: '100%', marginTop: -2 }}
    preserveAspectRatio="none"
  >
    <path
      d="M0,60 L0,38
        C15,22 28,14 42,20
        C52,26 60,18 72,10
        C82,3 95,8 105,16
        C115,24 125,12 138,6
        C150,0 162,8 172,18
        C182,28 192,14 205,8
        C217,2 228,10 240,20
        C252,30 262,12 275,6
        C287,0 298,10 310,22
        C322,34 332,16 345,8
        C357,0 368,12 380,22
        C392,32 402,14 415,8
        C427,2 438,14 450,24
        C462,34 472,18 485,10
        C497,2 510,12 522,22
        C534,32 545,16 558,10
        C568,5 580,14 600,28
        L600,60 Z"
      fill="#2e6640"
      stroke="#1a3d22"
      strokeWidth="2.5"
    />
    {/* Qualche ciuffo extra per più organicità */}
    <path
      d="M30,36 C36,28 44,24 50,30 C56,36 62,26 70,22 C76,18 84,26 90,34"
      fill="none"
      stroke="#1a3d22"
      strokeWidth="1.5"
      opacity="0.4"
    />
    <path
      d="M280,20 C286,14 294,10 302,16 C310,22 318,12 328,8 C336,4 344,14 352,20"
      fill="none"
      stroke="#1a3d22"
      strokeWidth="1.5"
      opacity="0.4"
    />
    <path
      d="M480,18 C488,10 496,8 504,14 C512,20 520,10 530,8 C540,6 548,16 556,22"
      fill="none"
      stroke="#1a3d22"
      strokeWidth="1.5"
      opacity="0.4"
    />
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
  const isAnchored = scrollY >= SCROLL_RANGE
  const transitionProgress = Math.min(1, scrollY / SCROLL_RANGE)

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

  // Logo: grande e centrato all'inizio, piccolo e a sinistra scrollando
  // transitionProgress 0 = inizio, 1 = ancorato
  const logoFontSize = 3.5 - transitionProgress * 2.4  // da 3.5rem a 1.1rem
  const logoOpacityBig = 1 - transitionProgress * 1.5   // sparisce presto
  const logoBottom = Math.max(20, 60 - transitionProgress * 40) // posizione verticale nell'immagine

  return (
    <div className="home-container">

      {/* ── SPIOLO STICKY ────────────────────────────────────────────── */}
      <div
        style={{
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
          // Nessuna box-shadow sull'immagine
        }}
      >
        <img
          src={spioloImg}
          alt="Lo Spiolo"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            objectPosition: 'center bottom',
            display: 'block',
          }}
        />

        {/* "Lo Spiolo" — grande e centrato all'inizio, scompare scrollando
            (la versione nella nav prende il suo posto) */}
        <div style={{
          position: 'absolute',
          bottom: logoBottom,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: Math.max(0, logoOpacityBig),
          pointerEvents: 'none',
          transition: 'none',
        }}>
          <span style={{
            fontFamily: 'Fraunces, serif',
            fontSize: `${logoFontSize}rem`,
            color: '#fff',
            letterSpacing: '-1px',
            textShadow: '0 2px 20px rgba(0,0,0,0.6)',
            display: 'inline-block',
          }}>
            Lo Spiolo
          </span>
        </div>

        {/* Stats — appaiono quando ancorata */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(6,20,6,0.88)',
          borderTop: '1px solid #1e4a28',
          padding: '7px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 4,
          fontSize: '0.74rem',
          color: '#6a9a6a',
          opacity: transitionProgress,
          pointerEvents: transitionProgress > 0.5 ? 'all' : 'none',
        }}>
          <span>Spiólate: <b style={{ color: '#f5d800' }}>{(stats.total || 0).toLocaleString('it-IT')}</b> · Oggi: <b style={{ color: '#f5d800' }}>{(stats.today || 0).toLocaleString('it-IT')}</b></span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <PeopleIcon />
            <span>Online: <b style={{ color: '#4ade80' }}>{online}</b></span>
          </div>
        </div>
      </div>

      {/* Spacer */}
      <div style={{ height: FULL_HEIGHT }} />

      {/* ── BORDO CESPUGLIO ──────────────────────────────────────────── */}
      <div style={{ background: '#341d56', marginTop: -1 }}>
        <BushEdge />
      </div>

      {/* ── FEED ─────────────────────────────────────────────────────── */}
      <div className="bush-feed">
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
              {confessions.length === 0 && (
                <div className="feed-empty">Nessun segreto qui.</div>
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
    </div>
  )
}
