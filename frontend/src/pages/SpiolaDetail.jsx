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

      {/* Back */}
      <button
        onClick={() => navigate('/')}
        style={{
          background: 'none', border: 'none', color: 'var(--text-gray)',
          cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.85rem',
          padding: '0 0 28px', display: 'flex', alignItems: 'center', gap: 6,
          transition: 'color 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-gray)'}
      >
        ← Torna al feed
      </button>

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
          {/* Header pagina singola */}
          <div style={{
            marginBottom: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}>
            <div style={{
              fontSize: '0.7rem',
              color: 'var(--text-gray)',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              opacity: 0.5,
            }}>
              🗣️ Qualcuno ha spiolato
            </div>
            <h2 style={{
              fontFamily: 'var(--font-fancy)',
              fontSize: '1.6rem',
              color: 'var(--text-main)',
              margin: 0,
              lineHeight: 1.3,
              letterSpacing: '-0.3px',
            }}>
              {confession.text}
            </h2>
          </div>

          <ConfessionCard confession={confession} hideTitleInCard />
        </>
      )}
    </div>
  )
}
