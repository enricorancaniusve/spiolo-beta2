import React, { useState, useRef } from 'react'
import { api } from '../api/client'

const EMOJIS = ['😈', '😂', '💀', '🔥', '👀', '🤭']
const CATEGORY_LABELS = { love: 'Amore', school: 'Scuola', secrets: 'Segreti', funny: 'Buffo', drama: 'Drama' }

function censor(text) {
  return text.split(' ').map(word => '█'.repeat(Math.max(2, word.length))).join(' ')
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000
  if (diff < 60) return 'ora'
  if (diff < 3600) return `${Math.floor(diff / 60)}min fa`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h fa`
  return `${Math.floor(diff / 86400)}g fa`
}

const genBars = (n = 30) => Array.from({ length: n }, () => 20 + Math.random() * 60)

export default function ConfessionCard({ confession }) {
  const [revealed, setRevealed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [reactions, setReactions] = useState(confession.reactions || {})
  const audioRef = useRef(null)
  const [bars] = useState(genBars())

  const audioSrc = confession.audioUrl
    ? (confession.audioUrl.startsWith('http') ? confession.audioUrl : `${import.meta.env.VITE_API_URL}${confession.audioUrl}`)
    : null

  async function togglePlay() {
    if (!audioRef.current || !audioSrc) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      await audioRef.current.play()
      setPlaying(true)
    }
  }

  function onTimeUpdate() {
    setProgress(audioRef.current.currentTime / audioRef.current.duration)
  }

  function onEnded() {
    setPlaying(false)
    setProgress(1)
    setRevealed(true)
    api.confessions.listen(confession.id).catch(() => {})
  }

  const playedBars = Math.floor(progress * bars.length)

  return (
    <article className="confession-card">
      <div className="confession-category">
        <span>{CATEGORY_LABELS[confession.category] || confession.category}</span>
      </div>

      <p className="confession-text">
        {revealed ? confession.text : censor(confession.text)}
        {!revealed && <small style={{ display: 'block', color: 'var(--text-gray)', marginTop: 8 }}>🔒 ASCOLTA PER SBLOCCARE</small>}
      </p>

      {audioSrc && (
        <div className="audio-row">
          <audio ref={audioRef} src={audioSrc} onTimeUpdate={onTimeUpdate} onEnded={onEnded} />
          <button className="play-btn" onClick={togglePlay}>{playing ? '⏸' : '▶'}</button>
          <div className="waveform">
            {bars.map((h, i) => (
              <div key={i} className={`waveform-bar ${i < playedBars ? 'played' : ''}`} style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      )}

      <div className="reactions-row">
        {EMOJIS.map(emoji => (
          <button key={emoji} className="reaction-btn" onClick={() => api.confessions.react(confession.id, emoji).then(d => setReactions(d.reactions))}>
            {emoji} {reactions[emoji] || ''}
          </button>
        ))}
      </div>
      <div style={{ textAlign: 'right', fontSize: '0.7rem', color: 'var(--text-gray)', marginTop: 12 }}>
        {timeAgo(confession.createdAt)}
      </div>
    </article>
  )
}
