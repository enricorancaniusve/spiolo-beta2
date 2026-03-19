import React, { useState, useRef, useEffect } from 'react'
import { api } from '../api/client'

const CAT_IT = { love: 'Amore', school: 'Scuola', secrets: 'Segreti', funny: 'Buffo', drama: 'Drama' }
const EMOJIS = ['😈', '😂', '💀', '🔥', '💬', '😮']
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

function FogVisualizer({ analyser, isPlaying }) {
  const canvasRef = useRef(null); const animRef = useRef(null); const particles = useRef([])
  useEffect(() => {
    particles.current = Array.from({ length: 60 }, () => ({ x: Math.random() * 560, y: Math.random() * 72, vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2, r: Math.random() * 2 + 1 }))
  }, [])
  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d'); const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
    const draw = () => {
      animRef.current = requestAnimationFrame(draw); ctx.fillStyle = 'rgba(13, 13, 18, 0.2)'; ctx.fillRect(0,0,560,72)
      let vol = 0; if (analyser && isPlaying) { analyser.getByteFrequencyData(data); vol = data.reduce((a,b)=>a+b,0) / data.length / 50 }
      particles.current.forEach(p => {
        p.x += p.vx * (1 + vol * 10); p.y += p.vy * (1 + vol * 10); if(p.x<0||p.x>560) p.vx*=-1; if(p.y<0||p.y>72) p.vy*=-1
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r + vol * 5, 0, Math.PI*2); ctx.fillStyle = `rgba(200,200,220,${0.2+vol})`; ctx.fill()
      })
    }
    draw(); return () => cancelAnimationFrame(animRef.current)
  }, [analyser, isPlaying])
  return <canvas ref={canvasRef} width={560} height={72} style={{width:'100%', height:72, borderRadius:10, background:'#0d0d12'}} />
}

export default function ConfessionCard({ confession }) {
  const [playing, setPlaying] = useState(false); const [revealed, setRevealed] = useState(false)
  const [currentTime, setCurrentTime] = useState(0); const [duration, setDuration] = useState(0)
  const [analyser, setAnalyser] = useState(null); const audioRef = useRef(null); const audioCtx = useRef(null)

  const audioSrc = confession.audioUrl?.startsWith('http') ? confession.audioUrl : `${BASE}${confession.audioUrl}`

  function initAudio() {
    if (audioCtx.current) return
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const node = ctx.createAnalyser(); const source = ctx.createMediaElementSource(audioRef.current)
    source.connect(node); node.connect(ctx.destination); audioCtx.current = ctx; setAnalyser(node)
  }

  async function togglePlay() {
    initAudio(); if (audioCtx.current.state === 'suspended') await audioCtx.current.resume()
    if (playing) { audioRef.current.pause(); setPlaying(false) } else { await audioRef.current.play(); setPlaying(true) }
  }

  return (
    <div className="confession-card">
      <div className="card-header">
        <span className="category-badge">{CAT_IT[confession.category]}</span>
        <span style={{color:'var(--text-gray)'}}>{new Date(confession.createdAt).toLocaleDateString()}</span>
      </div>
      <div className="card-text">
        {revealed ? confession.text : <span className="censored-text">{"█".repeat(20)}</span>}
        {!revealed && <div className="unlock-hint">🔒 ASCOLTA PER RIVELARE</div>}
      </div>
      <audio ref={audioRef} src={audioSrc} crossOrigin="anonymous" 
        onLoadedMetadata={() => setDuration(audioRef.current.duration)}
        onTimeUpdate={() => setCurrentTime(audioRef.current.currentTime)}
        onEnded={() => { setPlaying(false); setRevealed(true); api.confessions.listen(confession.id) }} 
      />
      <div className="audio-row">
        <FogVisualizer analyser={analyser} isPlaying={playing} />
        <div style={{display:'flex', alignItems:'center', gap:10, marginTop:10}}>
          <button className="play-btn" onClick={togglePlay}>{playing ? '⏸' : '▶'}</button>
          <div style={{flex:1}} className="progress-container">
            <div className="progress-bar" style={{width:`${(currentTime/duration)*100}%`}} />
          </div>
          <div className="time-display">{Math.floor(currentTime)}s</div>
        </div>
      </div>
      <div className="reactions-row">
        {EMOJIS.map(e => <button key={e} className="reaction-btn" onClick={() => api.confessions.react(confession.id, e)}>
          <span>{e}</span><span className="reaction-count">{confession.reactions?.[e] || 0}</span>
        </button>)}
      </div>
    </div>
  )
}
