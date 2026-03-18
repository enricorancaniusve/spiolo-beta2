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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      const chunks = []
      mr.ondataavailable = (e) => chunks.push(e.data)
      mr.onstop = () => setAudioBlob(new Blob(chunks, { type: 'audio/wav' }))
      mr.start()
      setRecording(true)
    } catch (e) { alert("Per favore, consenti l'accesso al microfono!") }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  async function submit() {
    if (!text && !audioBlob) return
    const fd = new FormData()
    fd.append('text', text || 'Confessione Audio')
    fd.append('category', category)
    if (audioBlob) fd.append('audio', audioBlob, 'confession.wav')
    
    try {
      await api.confessions.create(fd)
      setText('')
      setAudioBlob(null)
      onSubmitted?.()
    } catch (e) { alert("Errore durante l'invio del segreto.") }
  }

  return (
    <div className="compose-area">
      <div className="compose-label">Lo Spiolo — Confessa un segreto 🐦</div>
      
      <textarea 
        value={text} 
        onChange={(e) => setText(e.target.value)} 
        placeholder="Scrivi qui la tua verità anonima..." 
      />
      
      <div className="record-row">
        <button 
          className="btn-primary" 
          style={{ background: recording ? '#da3633' : '#238636', color: 'white' }} 
          onClick={recording ? stopRecording : startRecording}
        >
          {recording ? '⏹ Stop' : '🎤 Registra Voce'}
        </button>
        
        {audioBlob && <span style={{ color: '#58a6ff', fontSize: '0.85rem', fontWeight: 'bold' }}>✓ Audio pronto</span>}
        
        <select 
          className="select-cat" 
          value={category} 
          onChange={(e) => setCategory(e.target.value)}
        >
          {CATS.map(c => <option key={c} value={c}>{CAT_IT[c]}</option>)}
        </select>
      </div>

      <div style={{ textAlign: 'right', marginTop: '10px' }}>
        <button className="btn-primary" onClick={submit}>Spiola ora</button>
      </div>
    </div>
  )
}
