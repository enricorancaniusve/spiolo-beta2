import React, { useState, useRef } from 'react'
import { api } from '../api/client'

const CAT_IT = { love: 'Amore', school: 'Scuola', secrets: 'Segreti', funny: 'Buffo', drama: 'Drama' }
const EMOJIS = ['😈', '😂', '💀', '🔥', '💬', '😮']

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000
  if (diff < 60) return 'ora'
  if (diff < 3600) return `${Math.floor(diff / 60)}min fa`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h fa`
  return `${Math.floor(diff / 86400)}g fa`
}

function censorText(text) {
  if (!text) return ''
  return text
    .split(' ')
    .map(word => '█'.repeat(Math.max(2, word.length)))
    .join(' ')
}

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function ConfessionCard({ confession }) {
  const [playing, setPlaying] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [reactions, setReactions] = useState(confession.reactions || {})
  const [audioError, setAudioError] = useState(false)

  const audioRef = useRef(null)

  const audioSrc = confession.audioUrl
    ? confession.audioUrl.startsWith('http')
      ? confession.audioUrl
      : `${BASE}${confession.audioUrl}`
    : null

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  function handleMetadata() {
    if (audioRef.current) setDuration(audioRef.current.duration)
  }

  function togglePlay() {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play()
      setPlaying(true)
    }
  }

  async function handleReact(emoji) {
    try {
      const data = await api.confessions.react(confession.id, emoji)
      setReactions(data.reactions)
    } catch (e) {
      console.error('Errore reaction:', e)
    }
  }

  return (
    <div className="confession-card">

      {/* Header: categoria + tempo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ color: 'var(--accent)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
          {CAT_IT[confession.category] || confession.category}
        </span>
        <span style={{ color: 'var(--text-gray)', fontSize: '0.75rem' }}>
          {timeAgo(confession.createdAt)}
        </span>
      </div>

      {/* Testo censurato / rivelato */}
      <div className="confession-text">
        {revealed ? (
          <span>{confession.text}</span>
        ) : (
          <>
            <span className="censored-text">{censorText(confession.text)}</span>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-gray)', marginTop: 6, letterSpacing: 1 }}>
              🔒 ASCOLTA PER SBLOCCARE
            </div>
          </>
        )}
      </div>

      {/* Player audio */}
      {audioSrc && (
        <div className="audio-row">
          {audioError ? (
            <div style={{ color: '#da3633', fontSize: '0.8rem', width: '100%' }}>
              🪦 Questo audio è stato cancellato dal server.
            </div>
          ) : (
            <>
              <audio
                ref={audioRef}
                src={audioSrc}
                onLoadedMetadata={handleMetadata}
                onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
                onEnded={() => {
                  setPlaying(false)
                  setRevealed(true)
                  api.confessions.listen(confession.id).catch(() => {})
                }}
                onError={() => setAudioError(true)}
                preload="metadata"
              />
              <button className="play-btn" onClick={togglePlay}>
                {playing ? '⏸' : '▶'}
              </button>
              <div className="audio-track">
                <div className="progress-container">
                  <div className="progress-bar" style={{ width: `${progress}%` }} />
                </div>
                <div className="time-display">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Reactions */}
      <div className="reactions-row">
        {EMOJIS.map(emoji => (
          <button
            key={emoji}
            className="reaction-btn"
            onClick={() => handleReact(emoji)}
          >
            <span className="emoji-icon">{emoji}</span>
            <span className="emoji-count">{reactions[emoji] || 0}</span>
          </button>
        ))}
      </div>

    </div>
  )
}
