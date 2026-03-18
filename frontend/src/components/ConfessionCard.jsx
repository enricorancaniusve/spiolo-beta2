import React, { useState, useRef, useEffect } from 'react'
import { api } from '../api/client'

const EMOJIS = ['😈', '😂', '💀', '🔥', '👀', '🤭']
const CATEGORY_LABELS = { love: 'Amore', school: 'Scuola', secrets: 'Segreti', funny: 'Buffo', drama: 'Drama' }

function censor(text) {
  // Replace each word with a black block of same length
  return text.split(' ').map(word =>
    '█'.repeat(Math.max(2, word.length))
  ).join(' ')
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000
  if (diff < 60) return 'ora'
  if (diff < 3600) return `${Math.floor(diff / 60)}min fa`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h fa`
  return `${Math.floor(diff / 86400)}g fa`
}

// Generate fake waveform bars
function genBars(n = 24) {
  return Array.from({ length: n }, () => 20 + Math.random() * 60)
}

export default function ConfessionCard({ confession }) {
  const [revealed, setRevealed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [reactions, setReactions] = useState(confession.reactions || {})
  const [listenCount, setListenCount] = useState(confession.listenCount || 0)
  const audioRef = useRef(null)
  const barsRef = useRef(genBars())

  const audioSrc = confession.audioUrl
    ? (confession.audioUrl.startsWith('http')
        ? confession.audioUrl
        : `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${confession.audioUrl}`)
    : null

  async function togglePlay() {
    if (!audioRef.current || !audioSrc) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      await audioRef.current.play()
      setPlaying(true)
      if (!revealed) {
        // Count listen & reveal text at end
        try { await api.confessions.listen(confession.id) } catch (_) {}
        setListenCount(c => c + 1)
      }
    }
  }

  function onTimeUpdate() {
    if (!audioRef.current) return
    const pct = audioRef.current.currentTime / (audioRef.current.duration || 1)
    setProgress(pct)
  }

  function onEnded() {
    setPlaying(false)
    setProgress(1)
    setRevealed(true)
  }

  async function addReaction(emoji) {
    try {
      const data = await api.confessions.react(confession.id, emoji)
      setReactions(data.reactions)
    } catch (_) {}
  }

  const bars = barsRef.current
  const playedBars = Math.floor(progress * bars.length)

  return (
    <article className="confession-card">
      <div className="confession-category">
        <span className={`cat-${confession.category}`}>
          {CATEGORY_LABELS[confession.category] || confession.category}
        </span>
      </div>

      <p className="confession-text">
        {revealed
          ? <span className="revealed-text">{confession.text}</span>
          : <span className="censored-text" title="Ascolta per leggere…">{censor(confession.text)}</span>
        }
        {!revealed && (
          <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--muted)', marginTop: 6, letterSpacing: '0.08em' }}>
            🔒 ASCOLTA PER SBLOCCARE
          </span>
        )}
      </p>

      {audioSrc && (
        <>
          <audio
            ref={audioRef}
            src={audioSrc}
            onTimeUpdate={onTimeUpdate}
            onEnded={onEnded}
            preload="metadata"
          />
          <div className="audio-row">
            <button className={`play-btn ${playing ? 'playing' : ''}`} onClick={togglePlay} title="Ascolta">
              {playing ? '⏸' : '▶'}
            </button>
            <div className="waveform">
              {bars.map((h, i) => (
                <div
                  key={i}
                  className={`waveform-bar ${i < playedBars ? 'played' : i === playedBars ? 'active' : ''}`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <span className="listen-count">{listenCount} 👂</span>
          </div>
        </>
      )}

      <div className="reactions-row">
        {EMOJIS.map(emoji => (
          <button key={emoji} className="reaction-btn" onClick={() => addReaction(emoji)}>
            {emoji} <span>{reactions[emoji] || ''}</span>
          </button>
        ))}
      </div>

      <div className="card-footer" style={{ marginTop: 10 }}>
        <span />
        <span className="time">{timeAgo(confession.createdAt)}</span>
      </div>
    </article>
  )
}
