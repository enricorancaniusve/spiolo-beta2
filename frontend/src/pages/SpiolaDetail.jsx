import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { api } from '../api/client'
import ConfessionCard from '../components/ConfessionCard'

export default function SpiolaDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [confession, setConfession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
  document.title = 'Lo Spiolo'
  return () => { document.title = 'Lo Spiolo — Spiolus Paparazzus' }
}, [])
  
  useEffect(() => {
    async function load() {
      try {
        const data = await api.confessions.get(id)
        setConfession(data)
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  return (
    <div style={{ paddingBottom: 60 }}>

      {/* Logo + back */}
      <div style={{ marginBottom: 32 }}>
        <h2
          onClick={() => navigate('/')}
          style={{
            fontFamily: 'var(--font-fancy)',
            fontSize: '1.8rem',
            color: 'var(--text-main)',
            margin: '0 0 10px',
            cursor: 'pointer',
            letterSpacing: '-0.5px',
            display: 'inline-block',
          }}
        >
          Lo Spiolo
        </h2>
        <div>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none', border: 'none', color: 'var(--text-gray)',
              cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.82rem',
              padding: 0, display: 'inline-flex', alignItems: 'center', gap: 5,
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-gray)'}
          >
            ← Torna al feed
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '60px 0' }}>
          Intercettando il segreto…
        </div>
      )}

      {notFound && (
        <div style={{ textAlign: 'center', color: 'var(--text-gray)', padding: '60px 0' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🪦</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
            Questo segreto non esiste o è stato rimosso.
          </div>
        </div>
      )}

      {confession && (
        <>
          <div style={{
            fontSize: '0.7rem', color: 'var(--text-gray)',
            fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
            letterSpacing: 1.5, opacity: 0.5, marginBottom: 20,
          }}>
            🗣️ Qualcuno ha spiolato
          </div>
          <ConfessionCard confession={confession} />
        </>
      )}
    </div>
  )
}
