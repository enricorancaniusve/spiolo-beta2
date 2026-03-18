import React, { useState, useRef, useEffect } from 'react'
import { api } from '../api/client'

const EMOJIS = ['😈', '😂', '💀', '🔥', '👀', '🤭']
const CATEGORY_LABELS = { love: 'Amore', school: 'Scuola', secrets: 'Segreti', funny: 'Buffo', drama: 'Drama' }

// Helper: Formatta i secondi in 0:00
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Helper: Censura il testo
function censor(text) {
  if (!text) return "";
  return text.split(' ').map(word => '█'.repeat(Math.max(2, word.length))).join(' ')
}

export default function ConfessionCard({ confession }) {
  const [revealed, setRevealed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [reactions, setReactions] = useState(confession.reactions || {})
  const [selectedEmoji, setSelectedEmoji] = useState(null)
  const audioRef = useRef(null)

  // URL Audio Robusto
  const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '')
  const audioPath = (confession.audioUrl || '').replace(/^\//, '')
  const audioSrc = confession.audioUrl?.startsWith('http') ? confession.audioUrl : `${baseUrl}/${audioPath}`

  const handleMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration)
  }

  async function togglePlay() {
    if (!audioRef.current || !confession.audioUrl) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      try {
        await audioRef.current.play()
        setPlaying(true)
      } catch (e) { console.error("Play failed:", e) }
    }
  }

  async function handleReact(emoji) {
    try {
      const data = await api.confessions.react(confession.id, emoji)
      setReactions(data.reactions)
      setSelectedEmoji(emoji)
    } catch (e) { console.error("React failed:", e) }
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <article className="confession-card">
      <div className="confession-category">
        <span className={`cat-${confession.category}`}>
          {CATEGORY_LABELS[confession.category] || confession.category}
        </span>
      </div>

      <p className="confession-text">
        {revealed ? (
          <span className="revealed-text">{confession.text}</span>
        ) : (
          <span className="censored-text">{censor(confession.text)}</span>
        )}
        {!revealed && (
          <small style={{ display: 'block', color: 'var(--text-gray)', marginTop: 8, fontSize: '0.65rem' }}>
            🔒 ASCOLTA PER SBLOCCARE
          </small>
        )}
      </p>

      {confession.audioUrl && (
        <div className="audio-row">
          <audio 
            ref={audioRef} 
            src={audioSrc} 
            onLoadedMetadata={handleMetadata} 
            onTimeUpdate={() => setCurrentTime(audioRef.current.currentTime)}
            onEnded={() => { setPlaying(false); setRevealed(true); api.confessions.listen(confession.id).catch(()=>{}); }}
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
        </div>
      )}

      <div className="reactions-row">
        {EMOJIS.map(emoji => (
          <button 
            key={emoji} 
            className={`reaction-btn ${selectedEmoji === emoji ? 'active' : ''}`} 
            onClick={() => handleReact(emoji)}
          >
            <span className="emoji-icon">{emoji}</span>
            <span className="emoji-count">{reactions[emoji] || 0}</span>
          </button>
        ))}
      </div>
    </article>
  )
}
