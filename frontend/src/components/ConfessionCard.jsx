import React, { useState, useRef, useEffect } from 'react'
import { api } from '../api/client'

const CAT_IT = { love: 'Amore', school: 'Scuola', secrets: 'Segreti', funny: 'Buffo', drama: 'Drama' }
const EMOJIS = ['😈', '😂', '💀', '🔥', '💬', '😮']
const REVEAL_THRESHOLD = 0.80

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

// ─── Icona condivisione SVG ───────────────────────────────────────────────────
const ShareIcon = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"/>
    <circle cx="6" cy="12" r="3"/>
    <circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
)

// ─── Testo censurato con dissolvi ─────────────────────────────────────────────
function CensoredText({ text, progress, revealed }) {
  if (!text) return null
  const words = text.split(' ')

  if (revealed) {
    return (
      <div className="revealed-text-container">
        {words.map((word, i) => (
          <span
            key={i}
            className="revealed-word-final"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            {word}
          </span>
        ))}
      </div>
    )
  }

  const fadeRatio = progress < 0.70 ? 0 : Math.min(1, (progress - 0.70) / 0.10)

  return (
    <div className="censored-bars">
      {words.map((word, i) => (
        <span
          key={i}
          className="censored-bar"
          style={{
            width: `${Math.max(24, word.length * 9)}px`,
            animationDelay: `${(i * 137) % 900}ms`,
            opacity: 1 - fadeRatio * 0.7,
            filter: fadeRatio > 0 ? `blur(${fadeRatio * 2}px)` : 'none',
            transition: 'opacity 0.3s ease, filter 0.3s ease',
          }}
        />
      ))}
    </div>
  )
}

// ─── localStorage helpers ─────────────────────────────────────────────────────
function getSavedReaction(id) {
  try { return localStorage.getItem(`reaction_${id}`) || null } catch { return null }
}
function saveReaction(id, emoji) {
  try { localStorage.setItem(`reaction_${id}`, emoji) } catch {}
}
function clearReaction(id) {
  try { localStorage.removeItem(`reaction_${id}`) } catch {}
}

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// ─── Visualizzatore Sussurro ──────────────────────────────────────────────────
function WhisperVisualizer({ analyser, isPlaying }) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    const dataArray = analyser ? new Uint8Array(analyser.fftSize) : null
    let smoothVolume = 0

    function draw() {
      animRef.current = requestAnimationFrame(draw)
      if (analyser && isPlaying && dataArray) analyser.getByteTimeDomainData(dataArray)

      let rms = 0
      if (dataArray && isPlaying) {
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128
          rms += v * v
        }
        rms = Math.sqrt(rms / dataArray.length)
      }
      smoothVolume += (rms - smoothVolume) * 0.08

      ctx.fillStyle = 'rgb(11, 11, 15)'
      ctx.fillRect(0, 0, W, H)

      const maxAmp = isPlaying ? Math.max(2, smoothVolume * H * 2.8) : 1.5
      const points = 200

      ctx.beginPath()
      for (let i = 0; i <= points; i++) {
        const x = (i / points) * W
        let y = H / 2
        if (dataArray && isPlaying && dataArray.length > 0) {
          const idx = Math.floor((i / points) * dataArray.length)
          const raw = (dataArray[idx] - 128) / 128
          y = H / 2 + raw * maxAmp
        } else {
          const t = Date.now() / 4000
          y = H / 2 + Math.sin(i * 0.08 + t) * 1.5
        }
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = `rgba(210, 210, 225, ${isPlaying ? 0.7 + smoothVolume * 0.3 : 0.25})`
      ctx.lineWidth = isPlaying ? 1.2 + smoothVolume * 1.5 : 0.8
      ctx.stroke()

      if (isPlaying) {
        ctx.beginPath()
        for (let i = 0; i <= points; i++) {
          const x = (i / points) * W
          let y = H / 2
          if (dataArray && dataArray.length > 0) {
            const idx = Math.floor((i / points) * dataArray.length)
            const raw = (dataArray[idx] - 128) / 128
            y = H / 2 + raw * maxAmp * 0.6 + 1.5
          }
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = `rgba(180, 180, 210, ${smoothVolume * 0.25})`
        ctx.lineWidth = 0.6
        ctx.stroke()
      }
    }

    ctx.fillStyle = 'rgb(11, 11, 15)'
    ctx.fillRect(0, 0, W, H)
    draw()
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [analyser, isPlaying])

  return (
    <canvas ref={canvasRef} width={560} height={60}
      style={{ width: '100%', height: 60, borderRadius: 8, display: 'block' }}
    />
  )
}

export default function ConfessionCard({ confession, hideTitleInCard = false }) {
  const [playing, setPlaying] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [reactions, setReactions] = useState(confession.reactions || {})
  const [audioError, setAudioError] = useState(false)
  const [analyser, setAnalyser] = useState(null)
  const [myReaction, setMyReaction] = useState(() => getSavedReaction(confession.id))
  const [reacting, setReacting] = useState(false)
  const [copied, setCopied] = useState(false)
  const listenedRef = useRef(false)

  const audioRef = useRef(null)
  const audioCtxRef = useRef(null)

  const audioSrc = confession.audioUrl
    ? confession.audioUrl.startsWith('http')
      ? confession.audioUrl
      : `${BASE}${confession.audioUrl}`
    : null

  const progress = duration > 0 ? currentTime / duration : 0
  const progressPct = Math.round(progress * 100)
  const showUnlockProgress = !revealed && progressPct > 0 && progressPct < 80

  function handleTimeUpdate() {
    if (!audioRef.current) return
    const current = audioRef.current.currentTime
    const dur = audioRef.current.duration
    setCurrentTime(current)
    if (dur > 0 && current / dur >= REVEAL_THRESHOLD && !revealed) {
      setRevealed(true)
      if (!listenedRef.current) {
        listenedRef.current = true
        api.confessions.listen(confession.id).catch(() => {})
      }
    }
  }

  function handleMetadata() {
    if (audioRef.current) setDuration(audioRef.current.duration)
  }

  function initAnalyser() {
    if (audioCtxRef.current) return
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    const ctx = new AudioCtx()
    audioCtxRef.current = ctx
    const analyserNode = ctx.createAnalyser()
    analyserNode.fftSize = 1024
    analyserNode.smoothingTimeConstant = 0.9
    const source = ctx.createMediaElementSource(audioRef.current)
    source.connect(analyserNode)
    analyserNode.connect(ctx.destination)
    setAnalyser(analyserNode)
  }

  function togglePlay() {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      initAnalyser()
      if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume()
      audioRef.current.play().catch(() => {})
      setPlaying(true)
    }
  }

  function handleShare() {
    const url = `${window.location.origin}/spiola/${confession.id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      const el = document.createElement('input')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function handleReact(emoji) {
    if (reacting) return
    setReacting(true)
    try {
      if (myReaction === emoji) {
        const res = await fetch(`${BASE}/api/confessions/${confession.id}/react`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emoji }),
        })
        if (res.ok) {
          const data = await res.json()
          setReactions(data.reactions)
          setMyReaction(null)
          clearReaction(confession.id)
        }
      } else {
        const res = await fetch(`${BASE}/api/confessions/${confession.id}/react`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emoji, previousEmoji: myReaction || undefined }),
        })
        if (res.ok) {
          const data = await res.json()
          setReactions(data.reactions)
          setMyReaction(emoji)
          saveReaction(confession.id, emoji)
        }
      }
    } catch (e) {
      console.error('Errore reaction:', e)
    } finally {
      setReacting(false)
    }
  }

  useEffect(() => {
    return () => { if (audioCtxRef.current) audioCtxRef.current.close() }
  }, [])

  return (
    <div className="confession-card">
      <div className="card-header">
        <span className="category-badge">
          {CAT_IT[confession.category] || confession.category}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* 1. Spostato l'orario prima del tasto condivisione */}
          <span className="card-time">{timeAgo(confession.createdAt)}</span>
          
          <button
            onClick={handleShare}
            title={copied ? 'Link copiato!' : 'Condividi spiola'}
            style={{
              background: 'none', border: 'none',
              color: copied ? 'var(--accent)' : 'var(--text-gray)',
              cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', gap: 5,
              fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
              opacity: copied ? 1 : 0.6,
              transition: 'color 0.2s, opacity 0.2s',
            }}
          >
            {copied
              ? <span style={{ color: 'var(--accent)', fontSize: '0.72rem' }}>✓ copiato</span>
              : <ShareIcon size={14} color="currentColor" />
            }
          </button>
        </div>
      </div>

      {!hideTitleInCard && (
        <div className="card-text">
          <CensoredText text={confession.text} progress={progress} revealed={revealed} />
          {!revealed && (
            <div className="unlock-hint">
              {showUnlockProgress
                ? `🔓 ${progressPct}% — continua ad ascoltare`
                : '🔒 ASCOLTA PER SBLOCCARE'}
            </div>
          )}
        </div>
      )}

      {hideTitleInCard && revealed && (
        <div className="card-text" style={{ marginBottom: 4 }}>
          <span style={{ color: 'var(--text-gray)', fontSize: '0.8rem', fontStyle: 'italic' }}>
            🔓 Segreto svelato
          </span>
        </div>
      )}

      {audioSrc && (
        <div className="audio-row" style={{ flexDirection: 'column', gap: 8 }}>
          {audioError ? (
            <div style={{ color: 'var(--record-red)', fontSize: '0.8rem' }}>
              🪦 Questo audio è stato cancellato dal server.
            </div>
          ) : (
            <>
              <audio
                ref={audioRef}
                src={audioSrc}
                crossOrigin="anonymous"
                onLoadedMetadata={handleMetadata}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => {
                  setPlaying(false)
                  setRevealed(true)
                  if (!listenedRef.current) {
                    listenedRef.current = true
                    api.confessions.listen(confession.id).catch(() => {})
                  }
                }}
                onError={() => setAudioError(true)}
                preload="metadata"
              />
              <WhisperVisualizer analyser={analyser} isPlaying={playing} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button className="play-btn" onClick={togglePlay}>
                  {playing ? '⏸' : '▶'}
                </button>
                <div className="audio-track" style={{ flex: 1 }}>
                  <div className="progress-container">
                    <div className="progress-bar" style={{ width: `${progress * 100}%` }} />
                    {!revealed && (
                      <div style={{
                        position: 'absolute', top: 0, left: '80%',
                        width: 2, height: '100%',
                        background: 'rgba(255,255,255,0.25)',
                        borderRadius: 1,
                      }} />
                    )}
                  </div>
                  <div className="time-display">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div className="reactions-row">
        {EMOJIS.map(emoji => (
          <button
            key={emoji}
            className={`reaction-btn${myReaction === emoji ? ' active' : ''}`}
            onClick={() => handleReact(emoji)}
            disabled={reacting}
          >
            <span className="emoji-icon">{emoji}</span>
            <span className="reaction-count">{reactions[emoji] || 0}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
