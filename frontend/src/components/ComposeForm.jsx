import React, { useState } from 'react'
import { useRecorder } from '../hooks/useRecorder'
import { api } from '../api/client'

const CATS = ['love', 'school', 'secrets', 'funny', 'drama']
const CAT_IT = { love: 'Amore', school: 'Scuola', secrets: 'Segreti', funny: 'Buffo', drama: 'Drama' }

export default function ComposeForm({ onSubmitted }) {
  const [text, setText] = useState('')
  const [category, setCategory] = useState('secrets')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const { state: recState, audioBlob, audioUrl, start, stop, reset } = useRecorder()

  async function handleSubmit() {
    if (!text.trim()) return setError('Scrivi qualcosa prima!')
    if (!audioBlob) return setError('Registra il tuo audio prima di inviare.')
    setError('')
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('text', text.trim())
      fd.append('category', category)
      fd.append('audio', audioBlob, 'confessione.wav')
      const result = await api.confessions.create(fd)
      if (result.error) throw new Error(result.error)
      setText('')
      reset()
      onSubmitted?.(result)
    } catch (e) {
      setError(e.message || 'Errore invio')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="compose-area">
      <div className="compose-title">Confessa, spiolo 🐦</div>

      <textarea
        placeholder="Scrivi la tua confessione anonima…"
        value={text}
        onChange={e => setText(e.target.value)}
        maxLength={1000}
      />
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--muted)', textAlign: 'right', marginTop: 4 }}>
        {text.length}/1000
      </div>

      {/* Record */}
      <div className="record-row">
        {recState === 'idle' && (
          <button className="record-btn" onClick={start}>
            <span className="record-dot" /> Registra voce
          </button>
        )}
        {recState === 'recording' && (
          <button className="record-btn recording" onClick={stop}>
            <span className="record-dot" /> Stop registrazione
          </button>
        )}
        {recState === 'processing' && (
          <span className="record-status">⏳ Distorsione voce…</span>
        )}
        {recState === 'done' && (
          <>
            <span className="record-status record-ok">✓ Audio pronto</span>
            <audio src={audioUrl} controls style={{ height: 28, flex: 1 }} />
            <button
              onClick={reset}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ✕ rifai
            </button>
          </>
        )}
        {recState === 'error' && (
          <span className="record-status" style={{ color: 'var(--rust)' }}>
            ✕ Microfono non disponibile
          </span>
        )}
      </div>

      <div className="compose-row">
        <select className="select-cat" value={category} onChange={e => setCategory(e.target.value)}>
          {CATS.map(c => <option key={c} value={c}>{CAT_IT[c]}</option>)}
        </select>
        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={submitting || recState === 'recording' || recState === 'processing'}
        >
          {submitting ? 'Invio…' : 'Spiolaaa 🐦'}
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}
    </div>
  )
}
