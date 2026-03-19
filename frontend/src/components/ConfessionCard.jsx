import React, { useState, useRef } from 'react'
import { api } from '../api/client'

const CATS = ['love', 'school', 'secrets', 'funny', 'drama']
const CAT_IT = { love: 'Amore', school: 'Scuola', secrets: 'Segreti', funny: 'Buffo', drama: 'Drama' }

// ─── UTILITY: Codifica in formato WAV 16-bit ────────────────────────────────
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

// ─── CURVA DI DISTORSIONE (Saturazione armonica) ───────────────────────────
function makeDistortionCurve(amount) {
  const n_samples = 44100
  const curve = new Float32Array(n_samples)
  const deg = Math.PI / 180
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x))
  }
  return curve
}

// ─── MOTORE DI DISTORSIONE: ANONIMATO TOTALE ────────────────────────────────
async function distortAudio(blob) {
  const arrayBuffer = await blob.arrayBuffer()
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  const tempCtx = new AudioCtx()
  const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer)
  await tempCtx.close()

  const sampleRate = audioBuffer.sampleRate
  const numCh = audioBuffer.numberOfChannels
  
  // Aumentiamo la velocità per alzare il pitch (Voce più acuta/giovane)
  const pitchFactor = 1.30 
  const newLength = Math.floor(audioBuffer.length / pitchFactor)
  
  const offlineCtx = new OfflineAudioContext(numCh, newLength, sampleRate)

  const source = offlineCtx.createBufferSource()
  source.buffer = audioBuffer
  source.playbackRate.value = pitchFactor

  // FILTRO HIGHPASS: Rimuove il "corpo" e le risonanze basse identificative
  const highPass = offlineCtx.createBiquadFilter()
  highPass.type = 'highpass'
  highPass.frequency.setValueAtTime(450, offlineCtx.currentTime)

  // WAVESHAPER: Aggiunge distorsione per mascherare il timbro naturale
  const waveshaper = offlineCtx.createWaveShaper()
  waveshaper.curve = makeDistortionCurve(50)
  waveshaper.oversample = '4x'

  // COMPRESSORE: Livella il volume per chiarezza e maschera i respiri
  const compressor = offlineCtx.createDynamicsCompressor()
  compressor.threshold.setValueAtTime(-20, offlineCtx.currentTime)
  compressor.ratio.setValueAtTime(12, offlineCtx.currentTime)

  // Catena: Sorgente -> Filtro -> Distorsione -> Compressore -> Uscita
  source.connect(highPass)
  highPass.connect(waveshaper)
  waveshaper.connect(compressor)
  compressor.connect(offlineCtx.destination)

  source.start(0)

  const rendered = await offlineCtx.startRendering()
  return audioBufferToWav(rendered)
}

// ─── AI INTEGRATION: Whisper + Llama ────────────────────────────────────────
async function transcribeAudio(rawBlob) {
  const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY
  const file = new File([rawBlob], 'audio.webm', { type: rawBlob.type || 'audio/webm' })
  const formData = new FormData()
  formData.append('file', file)
  formData.append('model', 'whisper-large-v3')
  formData.append('language', 'it')

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    body: formData,
  })
  const data = await res.json()
  return data.text?.trim() || ''
}

async function generateSummary(transcript) {
  const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Sei Lo Spiolo. Crea un titolo breve (max 8 parole) e misterioso basato sul testo fornito.' },
        { role: 'user', content: transcript }
      ],
    }),
  })
  const data = await res.json()
  return data.choices[0].message.content.trim()
}

// ─── COMPONENTE REACT ───────────────────────────────────────────────────────
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
    chunksRef.current = []
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      mr.ondataavailable = (e) => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const rawBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        processAudio(rawBlob)
      }
      mr.start()
      setStep('recording')
    } catch (e) { setErrorMsg("Accesso al microfono negato.") }
  }

  async function processAudio(rawBlob) {
    setStep('processing')
    setStatusMsg('Criptazione identità vocale...')
    try {
      const [distorted, transcript] = await Promise.all([
        distortAudio(rawBlob),
        transcribeAudio(rawBlob)
      ])
      setAudioBlob(distorted)
      
      setStatusMsg('Generazione titolo spiolico...')
      const title = transcript.length > 5 ? await generateSummary(transcript) : "Un segreto anonimo..."
      setSummaryEdited(title)
      setStep('preview')
    } catch (e) { setStep('error'); setErrorMsg("Errore durante l'elaborazione."); }
  }

  async function submit() {
    setStep('submitting')
    const fd = new FormData()
    fd.append('text', summaryEdited)
    fd.append('category', category)
    fd.append('audio', audioBlob, 'spiolo.wav')
    try {
      await api.confessions.create(fd)
      onSubmitted?.()
    } catch (e) { setStep('error'); }
  }

  const reset = () => { setStep('idle'); setAudioBlob(null); }

  return (
    <div className="compose-area">
      <div className="compose-label">Lo Spiolo — Confessa 🤫</div>
      
      {step === 'idle' && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" onClick={startRecording}>🎤 Registra Segreto</button>
          <select className="select-cat" value={category} onChange={e => setCategory(e.target.value)}>
            {CATS.map(c => <option key={c} value={c}>{CAT_IT[c]}</option>)}
          </select>
        </div>
      )}

      {step === 'recording' && (
        <button className="btn-primary" style={{ background: '#da3633' }} onClick={() => mediaRecorderRef.current.stop()}>
          ⏹ Ferma e Cripta
        </button>
      )}

      {(step === 'processing') && <div className="status-msg">⚙️ {statusMsg}</div>}

      {step === 'preview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <textarea 
            className="summary-input"
            value={summaryEdited} 
            onChange={e => setSummaryEdited(e.target.value)} 
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={reset}>Annulla</button>
            <button className="btn-primary" onClick={submit}>Invia allo Spiolo 🐦</button>
          </div>
        </div>
      )}

      {step === 'error' && <div>❌ {errorMsg} <button onClick={reset}>Riprova</button></div>}
    </div>
  )
}
