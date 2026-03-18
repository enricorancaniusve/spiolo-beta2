import React, { useState, useRef } from 'react'
import { api } from '../api/client'

const CATS = ['love', 'school', 'secrets', 'funny', 'drama']
const CAT_IT = { love: 'Amore', school: 'Scuola', secrets: 'Segreti', funny: 'Buffo', drama: 'Drama' }

export default function ComposeForm({ onSubmitted }) {
  const [text, setText] = useState('')
  const [category, setCategory] = useState('secrets')
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const mediaRecorderRef = useRef(null)

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mr = new MediaRecorder(stream)
    mediaRecorderRef.current = mr
    mr.ondataavailable = (e) => setAudioBlob(e.data)
    mr.start()
    setRecording(true)
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  async function submit() {
    if (!text && !audioBlob) return
    const fd = new FormData()
    fd.append('text', text || 'Audio Confession')
    fd.append('category', category)
    if (audioBlob) fd.append('audio', audioBlob, 'confession.wav')
    
    await api.confessions.create(fd)
    setText('')
    setAudioBlob(null)
    onSubmitted?.()
  }

  return (
    {/* Classe compose-area per lo style grande e pulito */}
    <div className="compose-area">
      {/* Label grande e pulita */}
      <label className="compose-label">Spiola, confessa... 🐦</label>
      
      {/* Textarea grande con più spazio */}
      <textarea 
        value={text} 
        onChange={(e) => setText(e.target.value)} 
        placeholder="Cosa hai intercettato?" 
      />
      
      <div className="record-row">
        <button className={`record-btn ${recording ? 'recording' : ''}`} onClick={recording ? stopRecording : startRecording}>
          {recording ? '⏹ Fermati' : '🎤 Registra'}
        </button>
        {audioBlob && <span style={{ color: 'var(--record-red)' }}>✓ Audio pronto</span>}
        
        <select className="select-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATS.map(c => <option key={c} value={c}>{CAT_IT[c]}</option>
        ))}
        </select>
      </div>

      <div style={{ textAlign: 'right' }}>
        <button className="btn-primary" onClick={submit}>Invia Segreto</button>
      </div>
    </div>
  )
}
