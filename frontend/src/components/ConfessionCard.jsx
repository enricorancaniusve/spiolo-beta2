import React, { useState, useRef, useEffect } from 'react'
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
  return text.split(' ').map(word => '█'.repeat(Math.max(2, word.length))).join(' ')
}

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// ─── Visualizzatore Nebbia ────────────────────────────────────────────────────
const PARTICLE_COUNT = 90

function FogVisualizer({ analyser, isPlaying }) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const particlesRef = useRef([])

  // Inizializza le particelle una volta sola
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const W = canvas.width
    const H = canvas.height

    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      baseY: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3,  // deriva orizzontale lenta
      vy: (Math.random() - 0.5) * 0.2,  // deriva verticale lenta
      radius: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.4 + 0.1,
      phase: Math.random() * Math.PI * 2, // fase per oscillazione indipendente
    }))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height

    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null

    let frame = 0

    function draw() {
      animRef.current = requestAnimationFrame(draw)
      frame++

      // Volume corrente (0–1)
      let volume = 0
      if (analyser && isPlaying && dataArray) {
        analyser.getByteFrequencyData(dataArray)
        const sum = dataArray.reduce((a, b) => a + b, 0)
        volume = Math.min(1, (sum / dataArray.length) / 80)
      }

      // Sfondo con fade semi-trasparente — crea scia delle particelle
      ctx.fillStyle = 'rgba(13, 13, 18, 0.18)'
      ctx.fillRect(0, 0, W, H)

      const particles = particlesRef.current

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        // Aggiorna posizione — le particelle si agitano in base al volume
        const agitation = isPlaying ? volume * 3.5 : 0.3
        p.x += p.vx + Math.sin(frame * 0.01 + p.phase) * agitation * 0.4
        p.y += p.vy + Math.cos(frame * 0.013 + p.phase) * agitation * 0.3

        // Wrap ai bordi
        if (p.x < -5) p.x = W + 5
        if (p.x > W + 5) p.x = -5
        if (p.y < -5) p.y = H + 5
        if (p.y > H + 5) p.y = -5

        // Opacità pulsante in base al volume
        const pulseOpacity = p.opacity + (isPlaying ? volume * 0.5 : 0)
        const finalRadius = p.radius + (isPlaying ? volume * 2.5 : 0)

        // Disegna particella con alone sfumato
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, finalRadius * 3)
        gradient.addColorStop(0, `rgba(200, 200, 220, ${Math.min(0.9, pulseOpacity * 1.5)})`)
        gradient.addColorStop(0.4, `rgba(160, 160, 190, ${pulseOpacity * 0.6})`)
        gradient.addColorStop(1, `rgba(100, 100, 140, 0)`)

        ctx.beginPath()
        ctx.arc(p.x, p.y, finalRadius * 3, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()
      }

      // Quando suona: aggiungi un velo di luce centrale pulsante
      if (isPlaying && volume > 0.1) {
        const centerGlow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.6)
        centerGlow.addColorStop(0, `rgba(180, 180, 220, ${volume * 0.06})`)
        centerGlow.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = centerGlow
        ctx.fillRect(0, 0, W, H)
      }
    }

    // Pulisci canvas prima di iniziare
    ctx.fillStyle = 'rgb(13, 13, 18)'
    ctx.fillRect(0, 0, W, H)

    draw()
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [analyser, isPlaying])

  return (
    <canvas
      ref={canvasRef}
      width={560}
      height={72}
      style={{
        width: '100%',
        height: 72,
        borderRadius: 10,
        display: 'block',
        background: 'rgb(13, 13, 18)',
      }}
    />
  )
}

// ─── Componente principale ────────────────────────────────────────────────────
export default function ConfessionCard({ confession }) {
  const [playing, setPlaying] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [reactions, setReactions] = useState(confession.reactions || {})
  const [audioError, setAudioError] = useState(false)
  const [analyser, setAnalyser] = useState(null)

  const audioRef = useRef(null)
  const audioCtxRef = useRef(null)

  const audioSrc = confession.audioUrl
    ? confession.audioUrl.startsWith('http')
      ? confession.audioUrl
      : `${BASE}${confession.audioUrl}`
    : null

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  function handleMetadata() {
    if (audioRef.current) setDuration(audioRef.current.duration)
  }

  function initAnalyser() {
    if (audioCtxRef.current) return
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    const ctx = new AudioCtx()
    audioCtxRef.current = ctx

    const analyserNode = ctx.createAnalyser()
    analyserNode.fftSize = 512
    analyserNode.smoothingTimeConstant = 0.85

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

  async function handleReact(emoji) {
    try {
      const data = await api.confessions.react(confession.id, emoji)
      setReactions(data.reactions)
    } catch (e) {
      console.error('Errore reaction:', e)
    }
  }

  useEffect(() => {
    return () => { if (audioCtxRef.current) audioCtxRef.current.close() }
  }, [])

  return (
    <div className="confession-card">
      {/* Header */}
      <div className="card-header">
        <span className="category-badge">
          {CAT_IT[confession.category] || confession.category}
        </span>
        <span className="card-time">{timeAgo(confession.createdAt)}</span>
      </div>

      {/* Testo censurato / rivelato */}
      <div className="card-text">
        {revealed ? (
          <span>{confession.text}</span>
        ) : (
          <span className="censored-text" title="Ascolta per sbloccare">
            {censorText(confession.text)}
          </span>
        )}
        {!revealed && (
          <div className="unlock-hint">🔒 ASCOLTA PER SBLOCCARE</div>
        )}
      </div>

      {/* Player con nebbia */}
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
                onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
                onEnded={() => {
                  setPlaying(false)
                  setRevealed(true)
                  api.confessions.listen(confession.id).catch(() => {})
                }}
                onError={() => setAudioError(true)}
                preload="metadata"
              />

              {/* Visualizzatore nebbia */}
              <FogVisualizer analyser={analyser} isPlaying={playing} />

              {/* Controlli */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button className="play-btn" onClick={togglePlay}>
                  {playing ? '⏸' : '▶'}
                </button>
                <div className="audio-track" style={{ flex: 1 }}>
                  <div className="progress-container">
                    <div className="progress-bar" style={{ width: `${progress}%` }} />
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

      {/* Reactions */}
      <div className="reactions-row">
        {EMOJIS.map(emoji => (
          <button key={emoji} className="reaction-btn" onClick={() => handleReact(emoji)}>
            <span>{emoji}</span>
            <span className="reaction-count">{reactions[emoji] || 0}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
