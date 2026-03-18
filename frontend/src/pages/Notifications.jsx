import React, { useEffect, useState } from 'react'
import { api } from '../api/client'

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000
  if (diff < 60) return 'ora'
  if (diff < 3600) return `${Math.floor(diff / 60)}min fa`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h fa`
  return `${Math.floor(diff / 86400)}g fa`
}

export default function Notifications() {
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.notifications.list()
      .then(data => setNotifs(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  async function dismiss(id) {
    await api.notifications.dismiss(id)
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  return (
    <main>
      <h1 className="page-title">Notifiche</h1>
      <p className="page-subtitle">Gli spioni ti hanno risposto</p>

      {loading && <div className="loading">Caricamento notifiche…</div>}
      {!loading && notifs.length === 0 && (
        <div className="empty-state">Silenzio totale.<br/>Nessuno ti spia (ancora).</div>
      )}

      {notifs.map(n => (
        <div key={n.id} style={{
          display: 'flex', alignItems: 'flex-start', gap: 14,
          padding: '14px 0', borderBottom: '1px solid #e8e2d6'
        }}>
          <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>
            {n.type === 'trending' ? '🔥' : (n.emoji || '👀')}
          </span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>{n.message}</p>
            <span className="time">{timeAgo(n.createdAt)}</span>
          </div>
          <button
            onClick={() => dismiss(n.id)}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0 }}
          >✕</button>
        </div>
      ))}
    </main>
  )
}
