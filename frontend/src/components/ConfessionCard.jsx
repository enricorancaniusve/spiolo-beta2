import React, { useState, useRef, useEffect } from 'react'
import { api } from '../api/client'

const EMOJIS = ['😈', '😂', '💀', '🔥', '👀', '🤭']
const CATEGORY_LABELS = { love: 'Amore', school: 'Scuola', secrets: 'Segreti', funny: 'Buffo', drama: 'Drama' }

// Funzione helper per formattare il tempo (es. 1:05)
function formatTime(seconds) {
  if (isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function censor(text) {
  return text.split(' ').map(word => '█'.repeat(Math.max(2, word.length))).join(' ')
}

export default function ConfessionCard({ confession }) {
  const [revealed, setRevealed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0) // Tempo attuale
  const [duration, setDuration] = useState(0)       // Durata totale
  const [reactions, setReactions] = useState(confession.reactions || {})
  const [selectedReaction, setSelectedReaction] = useState(null) // Stato per la reazione colorata
  const audioRef = useRef(null)

  // Costruisce l'URL audio corretto
  const audioSrc = confession.audioUrl
    ? (confession.audioUrl.startsWith('http') ? confession.audioUrl : `${import.meta.env.VITE_API_URL}${confession.audioUrl}`)
    : null

  // Aggiorna la durata quando l'audio viene caricato
  useEffect(() => {
    if (audioRef.current) {
      const handleLoadedMetadata = () => setDuration(audioRef.current.duration);
      audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
      return () => audioRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata);
    }
  }, [audioSrc]);

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

  // Aggiorna i secondi mentre l'audio scorre
  function onTimeUpdate() {
    setCurrentTime(audioRef.current.currentTime)
  }

  function onEnded() {
    setPlaying(false)
    setCurrentTime(0)
    setRevealed(true)
    api.confessions.listen(confession.id).catch(() => {})
  }

  // Gestisce il click sulla reazione
  async function handleReact(emoji) {
    try {
      const data = await api.confessions.react(confession.id, emoji);
      setReactions(data.reactions);
      setSelectedReaction(emoji); // Colora l'emoji cliccata
    } catch (e) {
      console.error(e);
    }
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

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
          
          {/* Traccia audio con secondi (SISTEMATA) */}
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

      {/* Reazioni Circolari e Colorate (SISTEMATE) */}
      <div className="reactions-row">
        {EMOJIS.map(emoji => (
          <button 
            key={emoji} 
            className={`reaction-btn ${selectedReaction === emoji ? 'selected' : ''}`} 
            onClick={() => handleReact(emoji)}
          >
            {emoji} <span>{reactions[emoji] || '0'}</span>
          </button>
        ))}
      </div>
    </article>
  )
}
