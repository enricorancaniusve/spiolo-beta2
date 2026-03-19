import React, { useState, useRef } from 'react'
import { api } from '../api/client'

const CATS = ['love', 'school', 'secrets', 'funny', 'drama']
const CAT_IT = { love: 'Amore', school: 'Scuola', secrets: 'Segreti', funny: 'Buffo', drama: 'Drama' }

// ─── WAV encoder ─────────────────────────────────────────────────────────────
function audioBufferToWav(buffer) {
  const numCh = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const length = buffer.length * numCh * 2
  const arrayBuffer = new ArrayBuffer(44 + length)
  const view = new DataView(arrayBuffer)
  const write = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }
  write(0, 'RIFF')
  view.setUint32(4, 36 + length, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numCh, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numCh * 2, true)
  view.setUint16(32, numCh * 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, length, true)
  let offset = 44
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]))
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
      offset += 2
    }
  }
  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

// ─── Distorsione: voce rallentata + effetto telefonico + rumore ───────────────
async function distortAudio(blob) {
  const arrayBuffer = await blob.arrayBuffer()
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  const ctx = new AudioCtx()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
  await ctx.close()

  const sampleRate = audioBuffer.sampleRate
  const numCh = audioBuffer.numberOfChannels
  
  // Rallentamento: 0.85 (15% più lento). Più basso = più lento e cupo.
  const slowFactor = 0.85 
  const newLength = Math.floor(audioBuffer.length / slowFactor)
  
  const offlineCtx = new OfflineAudioContext(numCh, newLength, sampleRate)

  // Sorgente audio con playbackRate modificato
  const source = offlineCtx.createBufferSource()
  source.buffer = audioBuffer
  source.playbackRate.value = slowFactor

  // Filtro passa-banda: effetto "citofono/telefono"
  const bandpass = offlineCtx.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.value = 1800
  bandpass.Q.value = 0.7

  const voiceGain = offlineCtx.createGain()
  voiceGain.gain.value = 0.85

  // Generazione Rumore Bianco (fruscio di fondo)
  const noiseBuffer = offlineCtx.createBuffer(1, newLength, sampleRate)
  const noiseData = noiseBuffer.getChannelData(0)
  for (let i = 0; i < newLength; i++) {
    noiseData[i] = (Math.random() * 2 - 1)
  }
  const noiseSource = offlineCtx.createBufferSource()
  noiseSource.buffer = noiseBuffer

  const noiseFilter = offlineCtx.createBiquadFilter()
  noiseFilter.type = 'highpass'
  noiseFilter.frequency.value = 4500

  const noiseGain = offlineCtx.createGain()
  noiseGain.gain.value = 0.05 

  // Collegamenti (Routing)
  source.connect(bandpass)
  bandpass.connect(voiceGain)
  voiceGain.connect(offlineCtx.destination)

  noiseSource.connect(noiseFilter)
  noiseFilter.connect(noiseGain)
  noiseGain.connect(offlineCtx.destination)

  source.start(0)
  noiseSource.start(0)

  const rendered = await offlineCtx.startRendering()
  return audioBufferToWav(rendered)
}

// ─── Groq Whisper: trascrizione ───────────────────────────────────────────────
async function transcribeAudio(rawBlob) {
  const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY
  if (!GROQ_API_KEY) throw new Error('VITE_GROQ_API_KEY mancante nel .env')

  const file = new File([rawBlob], 'audio.webm', { type: rawBlob.type || 'audio/webm' })
  const formData = new FormData()
  formData.append('file', file)
  formData.append('model', 'whisper-large-v3')
  formData.append('language', 'it')
  formData.append('response_format', 'json')

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    body: formData,
  })

  if (!res.ok) throw new Error('Errore trascrizione Whisper')
  const data = await res.json()
  return data.text?.trim() || ''
}

// ─── Groq Llama: generazione titolo ──────────────────────────────────────────
async function generateSummary(transcript) {
  const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 80,
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content: 'Sei un assistente per "Lo Spiolo". Genera un titolo breve, intrigante e misterioso (max 10 parole) basato sulla trascrizione. Rispondi SOLO con il testo del titolo.',
        },
        { role: 'user', content: `Trascrizione: "${transcript}"` },
      ],
    }),
  })

  if (!res.ok) throw new Error('Errore Groq llama')
  const data = await res.json()
  return data.choices[0].message.content.trim()
}

// ─── COMPONENTE EXPORT ────────────────────────────────────────────────────────
export default function ComposeForm({ onSubmitted }) {
  const [step, setStep] = useState('idle')
  const [category, setCategory] = useState('secrets')
  const [audioBlob, setAudioBlob] = useState(null)
  const [summaryEdited, setSummaryEdited] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [statusMsg, setStatusMsg] = useState('')

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  async function startRecording() {
    setErrorMsg('')
    setAudioBlob(null)
    setSummaryEdited('')
    chunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mr
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const rawBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await handleRecordingDone(rawBlob)
      }
      mr.start()
      setStep('recording')
    } catch (e) {
      setErrorMsg("Permesso microfono negato.")
      setStep('error')
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    setStep('processing')
  }

  async function handleRecordingDone(rawBlob) {
    try {
      setStep('processing')
      setStatusMsg('Lo Spiolo sta camuffando la tua voce…')

      const [censoredBlob, transcript] = await Promise.all([
        distortAudio(rawBlob),
        transcribeAudio(rawBlob),
      ])

      setAudioBlob(censoredBlob)

      if (!transcript || transcript.length < 3) {
        setSummaryEdited('Un segreto sussurrato nell\'ombra…')
        setStep('preview')
        return
      }

      setStep('summarizing')
      setStatusMsg('Generazione del titolo scandaloso…')
      const title = await generateSummary(transcript)
      setSummaryEdited(title)
      setStep('preview')
    } catch (e) {
      setErrorMsg(`Errore: ${e.message}`)
      setStep('error')
    }
  }

  async function submit() {
    if (!audioBlob || !summaryEdited.trim()) return
    setStep('submitting')

    const fd = new FormData()
    fd.append('text', summaryEdited.trim())
    fd.append('category', category)
    fd.append('audio', audioBlob, 'censored.wav')

    try {
      await api.confessions.create(fd)
      onSubmitted?.()
    } catch (e) {
      setErrorMsg("Errore invio server.")
      setStep('error')
    }
  }

  const reset = () => { setStep('idle'); setAudioBlob(null); setSummaryEdited(''); setErrorMsg(''); }

  return (
    <div className="compose-area">
      <div className="compose-label">Lo Spiolo — Registra il tuo segreto 🗣️</div>

      {step === 'idle' && (
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn-primary" style={{ background: '#238636' }} onClick={startRecording}>🎤 Registra</button>
          <select className="select-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATS.map(c => <option key={c} value={c}>{CAT_IT[c]}</option>)}
          </select>
        </div>
      )}

      {step === 'recording' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ color: '#da3633', fontWeight: 600 }}>🔴 Registrazione in corso...</div>
          <button className="btn-primary" style={{ background: '#da3633' }} onClick={stopRecording}>⏹ Stop</button>
        </div>
      )}

      {(step === 'processing' || step === 'summarizing') && (
        <div style={{ padding: '12px 0', color: 'var(--accent)' }}>⚙️ {statusMsg}</div>
      )}

      {step === 'preview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="preview-box" style={{ background: 'rgba(88,166,255,0.1)', padding: 12, borderRadius: 8 }}>
            <div style={{ fontSize: '0.7rem', color: '#58a6ff', marginBottom: 5 }}>TITOLO GENERATO</div>
            <textarea 
              style={{ width: '100%', background: 'transparent', border: 'none', color: 'white', resize: 'none' }}
              value={summaryEdited} 
              onChange={e => setSummaryEdited(e.target.value)} 
            />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={reset} className="btn-secondary">Annulla</button>
            <button className="btn-primary" onClick={submit}>Spiola ora 🗣️</button>
          </div>
        </div>
      )}

      {step === 'error' && (
        <div style={{ color: '#da3633' }}>{errorMsg} <button onClick={reset}>Riprova</button></div>
      )}

      <style>{`
        .preview-box { border: 1px solid #30363d; }
        .btn-secondary { background: #21262d; border: 1px solid #30363d; color: #c9d1d9; padding: 8px 15px; border-radius: 6px; cursor: pointer; }
      `}</style>
    </div>
  )
}
