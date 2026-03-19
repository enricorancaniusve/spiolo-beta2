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
      <button
        onClick={() => navigate('/')}
        style={{
          background: 'none', border: 'none', color: 'var(--text-gray)',
          cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.85rem',
          padding: '0 0 24px', display: 'flex', alignItems: 'center', gap: 6,
        }}
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
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🪦</div>
          <div>Questo segreto non esiste o è stato rimosso.</div>
        </div>
      )}

      {confession && <ConfessionCard confession={confession} />}
    </div>
  )
}
