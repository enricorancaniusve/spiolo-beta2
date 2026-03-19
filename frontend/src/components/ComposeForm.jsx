import React, { useState, useRef } from 'react'
import { api } from '../api/client'

const CATS = ['love', 'school', 'secrets', 'funny', 'drama']
const CAT_IT = { love: 'Amore', school: 'Scuola', secrets: 'Segreti', funny: 'Buffo', drama: 'Drama' }
const CAT_EMOJI = { love: '❤️', school: '📚', secrets: '🤫', funny: '😂', drama: '🎭' }

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
  write(0, 'RIFF'); view.setUint32(4, 36 + length, true); write(8, 'WAVE')
  write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true)
  view.setUint16(22, numCh, true); view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numCh * 2, true); view.setUint16(32, numCh * 2, true)
  view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, length, true)
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

// ─── Curva Waveshaper ─────────────────────────────────────────────────────────
function makeDistortionCurve(amount = 25) {
  const samples = 256
  const curve = new Float32Array(samples)
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1
    curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x))
  }
  return curve
}

// ─── Distorsione vocale ───────────────────────────────────────────────────────
async function distortAudio(blob) {
  const arrayBuffer = await blob.arrayBuffer()
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  const ctx = new AudioCtx()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
  await ctx.close()

  const PITCH = 1.35
  const newLength = Math.ceil(audioBuffer.length / PITCH)
  const offlineCtx = new OfflineAudioContext(audioBuffer.numberOfChannels, newLength, audioBuffer.sampleRate)

  const source = offlineCtx.createBufferSource()
  source.buffer = audioBuffer
  source.playbackRate.value = PITCH

  const highpass = offlineCtx.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = 400
  highpass.Q.value = 0.9

  const waveshaper = offlineCtx.createWaveShaper()
  waveshaper.curve = makeDistortionCurve(25)
  waveshaper.oversample = '4x'

  const outputGain = offlineCtx.createGain()
  outputGain.gain.value = 0.85

  source.connect(highpass)
  highpass.connect(waveshaper)
  waveshaper.connect(outputGain)
  outputGain.connect(offlineCtx.destination)
  source.start(0)

  const rendered = await offlineCtx.startRendering()
  return audioBufferToWav(rendered)
}

// ─── Groq Whisper ─────────────────────────────────────────────────────────────
async function transcribeAudio(rawBlob) {
  const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY
  if (!GROQ_API_KEY) throw new Error('VITE_GROQ_API_KEY mancante')
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
  if (!res.ok) throw new Error('Errore Whisper')
  const data = await res.json()
  return data.text?.trim() || ''
}

// ─── Groq llama ───────────────────────────────────────────────────────────────
async function generateSummary(transcript) {
  const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY
  if (!GROQ_API_KEY) throw new Error('VITE_GROQ_API_KEY mancante')
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 80,
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content: 'Sei un assistente per un\'app di pettegolezzi anonimi chiamata "Lo Spiolo". ' +
            'Ricevi la trascrizione di un messaggio vocale anonimo e devi generare un titolo ' +
            'breve e intrigante (massimo 10 parole) che descriva il pettegolezzo senza rivelare troppo. ' +
            'Deve essere curioso e misterioso, come l\'oggetto di una email scandalosa. ' +
            'Rispondi SOLO con il testo del titolo, senza virgolette, senza prefissi, senza punteggiatura finale.',
        },
        { role: 'user', content: `Trascrizione:\n"${transcript}"` },
      ],
    }),
  })
  if (!res.ok) throw new Error('Errore llama')
  const data = await res.json()
  return data.choices[0].message.content.trim()
}

// ─── COMPONENTE ───────────────────────────────────────────────────────────────
export default function ComposeForm({ onSubmitted }) {
  const [step, setStep] = useState('idle')
  const [category, setCategory] = useState('secrets')
  const [audioBlob, setAudioBlob] = useState(null)
  const [summaryEdited, setSummaryEdited] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [recordSeconds, setRecordSeconds] = useState(0)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  async function startRecording() {
    setErrorMsg('')
    setAudioBlob(null)
    setSummaryEdited('')
    chunksRef.current = []
    setRecordSeconds(0)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mr
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        clearInterval(timerRef.current)
        const rawBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await handleRecordingDone(rawBlob)
      }
      mr.start()
      setStep('recording')
      // Timer secondi
      timerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000)
    } catch (e) {
      setErrorMsg("Impossibile accedere al microfono.")
      setStep('error')
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    clearInterval(timerRef.current)
    setStep('processing')
  }

  async function handleRecordingDone(rawBlob) {
    try {
      setStep('processing')
      setStatusMsg('Censura vocale in corso…')
      const [censoredBlob, transcript] = await Promise.all([
        distortAudio(rawBlob),
        transcribeAudio(rawBlob),
      ])
      setAudioBlob(censoredBlob)

      if (!transcript || transcript.length < 3) {
        setSummaryEdited('Un segreto che non puoi non ascoltare…')
        setStep('preview')
        return
      }

      setStep('summarizing')
      setStatusMsg('Generazione titolo…')
      const title = await generateSummary(transcript)
      setSummaryEdited(title)
      setStep('preview')
    } catch (e) {
      console.error(e)
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
      setStep('idle')
      setAudioBlob(null)
      setSummaryEdited('')
      onSubmitted?.()
    } catch (e) {
      setErrorMsg("Errore durante l'invio.")
      setStep('error')
    }
  }

  function reset() {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    clearInterval(timerRef.current)
    setStep('idle')
    setAudioBlob(null)
    setSummaryEdited('')
    setErrorMsg('')
    chunksRef.current = []
    setRecordSeconds(0)
  }

  const formatSecs = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="compose-form">

      {/* Titolo */}
      <div className="compose-title">
        <span>Registra il tuo segreto</span>
        <span style={{ fontSize: '1.3rem' }}>🗣️</span>
      </div>

      {/* Selezione categoria */}
      <div className="compose-cats">
        {CATS.map(c => (
          <button
            key={c}
            className={`compose-cat-btn${category === c ? ' active' : ''}`}
            onClick={() => setCategory(c)}
          >
            <span>{CAT_EMOJI[c]}</span>
            <span>{CAT_IT[c]}</span>
          </button>
        ))}
      </div>

      {/* idle */}
      {step === 'idle' && (
        <div className="compose-step">
          <p className="compose-hint">Premi il bottone e racconta. La voce verrà alterata automaticamente.</p>
          <button className="compose-record-btn" onClick={startRecording}>
            <span className="compose-record-icon">🎤</span>
            <span>Inizia a registrare</span>
          </button>
        </div>
      )}

      {/* recording */}
      {step === 'recording' && (
        <div className="compose-step">
          <div className="compose-recording-indicator">
            <span className="compose-rec-dot" />
            <span className="compose-rec-label">REC {formatSecs(recordSeconds)}</span>
          </div>
          <p className="compose-hint" style={{ opacity: 0.5 }}>Parla pure, premi stop quando hai finito</p>
          <button className="compose-stop-btn" onClick={stopRecording}>
            <span style={{ fontSize: '1.2rem' }}>⏹</span>
            <span>Stop — ho finito</span>
          </button>
        </div>
      )}

      {/* processing / summarizing */}
      {(step === 'processing' || step === 'summarizing') && (
        <div className="compose-step compose-loading">
          <div className="compose-spinner" />
          <span className="compose-hint">{statusMsg}</span>
        </div>
      )}

      {/* preview */}
      {step === 'preview' && (
        <div className="compose-step">
          <div className="compose-preview-box">
            <div className="compose-preview-label">✦ Titolo generato — puoi modificarlo</div>
            <textarea
              value={summaryEdited}
              onChange={(e) => setSummaryEdited(e.target.value)}
              maxLength={200}
              rows={2}
              className="compose-preview-input"
              placeholder="Il titolo del tuo segreto…"
            />
            <div className="compose-preview-count">{summaryEdited.length}/200</div>
          </div>
          <p className="compose-hint" style={{ opacity: 0.45, fontSize: '0.75rem' }}>
            🔒 Gli altri vedranno questo testo censurato. Si rivela solo dopo l'ascolto.
          </p>
          <div className="compose-preview-actions">
            <button className="compose-back-btn" onClick={reset}>↩ Riregistra</button>
            <button
              className="compose-submit-btn"
              onClick={submit}
              disabled={!summaryEdited.trim()}
            >
              Spiola ora 🗣️
            </button>
          </div>
        </div>
      )}

      {/* submitting */}
      {step === 'submitting' && (
        <div className="compose-step compose-loading">
          <div className="compose-spinner" />
          <span className="compose-hint">Pubblicazione in corso…</span>
        </div>
      )}

      {/* error */}
      {step === 'error' && (
        <div className="compose-step">
          <p style={{ color: '#f85149', fontSize: '0.9rem', margin: 0 }}>❌ {errorMsg}</p>
          <button className="compose-back-btn" onClick={reset} style={{ marginTop: 12 }}>↩ Riprova</button>
        </div>
      )}

      <style>{`
        @keyframes spioloPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.5); }
        }
        @keyframes spioloSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes recPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(248,81,73,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(248,81,73,0); }
        }
      `}</style>
    </div>
  )
}
