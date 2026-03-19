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

    // Volume smoothed — evita salti bruschi
    let smoothVolume = 0

    function draw() {
      animRef.current = requestAnimationFrame(draw)

      // Leggi dati waveform
      if (analyser && isPlaying && dataArray) {
        analyser.getByteTimeDomainData(dataArray)
      }

      // Calcola volume RMS corrente
      let rms = 0
      if (dataArray && isPlaying) {
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128
          rms += v * v
        }
        rms = Math.sqrt(rms / dataArray.length)
      }

      // Smooth del volume — la risposta è lenta, come un sussurro
      smoothVolume += (rms - smoothVolume) * 0.08

      // Sfondo — pulisci completamente ogni frame
      ctx.fillStyle = 'rgb(11, 11, 15)'
      ctx.fillRect(0, 0, W, H)

      // Ampiezza massima dell'onda — quasi piatta a riposo, si alza col volume
      // Min: 2px (piatta), Max: H/2 * 0.75 (mai esagerata)
      const maxAmp = isPlaying
        ? Math.max(2, smoothVolume * H * 2.8)
        : 1.5

      const points = 200 // punti della curva

      // Onda principale — bianco pallido
      ctx.beginPath()
      for (let i = 0; i <= points; i++) {
        const x = (i / points) * W
        let y = H / 2

        if (dataArray && isPlaying && dataArray.length > 0) {
          const idx = Math.floor((i / points) * dataArray.length)
          const raw = (dataArray[idx] - 128) / 128
          y = H / 2 + raw * maxAmp
        } else {
          // Idle: onda sinusoidale quasi piatta e lentissima
          const t = Date.now() / 4000
          y = H / 2 + Math.sin(i * 0.08 + t) * 1.5
        }

        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = `rgba(210, 210, 225, ${isPlaying ? 0.7 + smoothVolume * 0.3 : 0.25})`
      ctx.lineWidth = isPlaying ? 1.2 + smoothVolume * 1.5 : 0.8
      ctx.stroke()

      // Onda fantasma — più sottile, leggermente sfasata, crea profondità
      if (isPlaying) {
        ctx.beginPath()
        for (let i = 0; i <= points; i++) {
          const x = (i / points) * W
          let y = H / 2

          if (dataArray && dataArray.length > 0) {
            const idx = Math.floor((i / points) * dataArray.length)
            const raw = (dataArray[idx] - 128) / 128
            // Leggermente sfasata verticalmente
            y = H / 2 + raw * maxAmp * 0.6 + 1.5
          }

          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = `rgba(180, 180, 210, ${smoothVolume * 0.25})`
        ctx.lineWidth = 0.6
        ctx.stroke()
      }

      // Glow sottile al centro quando parla
      if (isPlaying && smoothVolume > 0.02) {
        const glow = ctx.createLinearGradient(0, 0, 0, H)
        glow.addColorStop(0, 'rgba(0,0,0,0)')
        glow.addColorStop(0.5, `rgba(200, 200, 230, ${smoothVolume * 0.04})`)
        glow.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = glow
        ctx.fillRect(0, 0, W, H)
      }
    }

    // Pulisci al primo render
    ctx.fillStyle = 'rgb(11, 11, 15)'
    ctx.fillRect(0, 0, W, H)

    draw()
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [analyser, isPlaying])

  return (
    <canvas
      ref={canvasRef}
      width={560}
      height={60}
      style={{
        width: '100%',
        height: 60,
        borderRadius: 8,
        display: 'block',
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
    analyserNode.fftSize = 1024
    analyserNode.smoothingTimeConstant = 0.9 // molto smooth — risposta lenta, stile sussurro

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

      {/* Player con visualizzatore sussurro */}
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

              {/* Visualizzatore sussurro */}
              <WhisperVisualizer analyser={analyser} isPlaying={playing} />

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
