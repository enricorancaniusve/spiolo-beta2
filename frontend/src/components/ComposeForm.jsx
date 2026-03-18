import React, { useState, useRef } from 'react'
import { api } from '../api/client'

const CATS = ['love', 'school', 'secrets', 'funny', 'drama']
const CAT_IT = { love: 'Amore', school: 'Scuola', secrets: 'Segreti', funny: 'Buffo', drama: 'Drama' }

// ─── WAV encoder ─────────────────────────────────────────────────────────────
function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const bitDepth = 16
  let audioData

  if (numChannels === 2) {
    const l = buffer.getChannelData(0)
    const r = buffer.getChannelData(1)
    const interleaved = new Float32Array(l.length + r.length)
    for (let i = 0; i < l.length; i++) {
      interleaved[2 * i] = l[i]
      interleaved[2 * i + 1] = r[i]
    }
    audioData = interleaved
  } else {
    audioData = buffer.getChannelData(0)
  }

  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample
  const dataSize = audioData.length * bytesPerSample
  const bufferWav = new ArrayBuffer(44 + dataSize)
  const view = new DataView(bufferWav)

  function writeString(offset, string) {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < audioData.length; i++) {
    let s = Math.max(-1, Math.min(1, audioData[i]))
    s = s < 0 ? s * 0x8000 : s * 0x7FFF
    view.setInt16(offset, s, true)
    offset += bytesPerSample
  }

  return new Blob([bufferWav], { type: 'audio/wav' })
}

// ─── Distorsione vocale: voce grave, irriconoscibile, senza artefatti ─────────
async function processAndAlterAudio(rawBlob) {
  const arrayBuffer = await rawBlob.arrayBuffer()
  const audioContext = new (window.AudioContext || window.webkitAudioContext)()
  const rawAudioBuffer = await audioContext.decodeAudioData(arrayBuffer)
  await audioContext.close()

  // 0.78 = voce più grave e leggermente rallentata, irriconoscibile ma naturale
  const RATE = 0.78

  // +1s di padding per evitare il troncamento dei primi secondi
  const offlineContext = new OfflineAudioContext(
    rawAudioBuffer.numberOfChannels,
    Math.ceil(rawAudioBuffer.length / RATE) + rawAudioBuffer.sampleRate,
    rawAudioBuffer.sampleRate
  )

  const source = offlineContext.createBufferSource()
  source.buffer = rawAudioBuffer
  source.playbackRate.value = RATE
  source.connect(offlineContext.destination)
  source.start(0)

  const rendered = await offlineContext.startRendering()
  return audioBufferToWav(rendered)
}

// ─── Groq Whisper: trascrive l'audio grezzo ───────────────────────────────────
async function transcribeAudio(rawBlob) {
  const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY
  if (!GROQ_API_KEY) throw new Error('VITE_GROQ_API_KEY mancante nel .env')

  const file = new File([rawBlob], 'audio.wav', { type: 'audio/wav' })
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

  if (!res.ok) {
    const err = await res.text()
    console.error('Whisper error:', err)
    throw new Error('Errore trascrizione Whisper')
  }

  const data = await res.json()
  return data.text?.trim() || ''
}

// ─── Groq llama: genera il titolo ────────────────────────────────────────────
async function generateSummary(transcript) {
  const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY
  if (!GROQ_API_KEY) throw new Error('VITE_GROQ_API_KEY mancante nel .env')

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
          content:
            'Sei un assistente per un\'app di pettegolezzi anonimi chiamata "Lo Spiolo". ' +
            'Ricevi la trascrizione di un messaggio vocale anonimo e devi generare un titolo ' +
            'breve e intrigante (massimo 10 parole) che descriva il pettegolezzo senza rivelare troppo. ' +
            'Deve essere curioso e misterioso, come l\'oggetto di una email scandalosa. ' +
            'Rispondi SOLO con il testo del titolo, senza virgolette, senza prefissi, senza punteggiatura finale.',
        },
        {
          role: 'user',
          content: `Trascrizione:\n"${transcript}"`,
        },
      ],
    }),
  })

  if (!res.ok) throw new Error('Errore Groq llama')
  const data = await res.json()
  return data.choices[0].message.content.trim()
}

// ─── COMPONENTE ───────────────────────────────────────────────────────────────
export default function ComposeForm({ onSubmitted }) {
  const [step, setStep] = useState('idle')
  // idle | recording | processing | summarizing | preview | submitting | error

  const [category, setCategory] = useState('secrets')
  const [audioBlob, setAudioBlob] = useState(null)
  const [summaryEdited, setSummaryEdited] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [statusMsg, setStatusMsg] = useState('')

  const mediaRecorderRef = useRef(null)

  async function startRecording() {
    setErrorMsg('')
    setAudioBlob(null)
    setSummaryEdited('')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      const chunks = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const rawBlob = new Blob(chunks, { type: 'audio/webm' })
        await handleRecordingDone(rawBlob)
      }
      mr.start()
      setStep('recording')
    } catch (e) {
      setErrorMsg("Impossibile accedere al microfono. Controlla i permessi.")
      setStep('error')
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setStep('processing')
  }

  async function handleRecordingDone(rawBlob) {
    try {
      setStep('processing')
      setStatusMsg('Distorsione vocale e trascrizione in corso…')

      const [censoredBlob, transcript] = await Promise.all([
        processAndAlterAudio(rawBlob),
        transcribeAudio(rawBlob),
      ])

      setAudioBlob(censoredBlob)

      if (!transcript || transcript.length < 3) {
        setSummaryEdited('Un segreto che non puoi non ascoltare…')
        setStep('preview')
        return
      }

      setStep('summarizing')
      setStatusMsg('Lo Spiolo sta elaborando il titolo…')
      const title = await generateSummary(transcript)

      setSummaryEdited(title)
      setStep('preview')
    } catch (e) {
      console.error(e)
      setErrorMsg(`Errore: ${e.message}. Riprova.`)
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
      setErrorMsg("Errore durante l'invio. Riprova.")
      setStep('error')
    }
  }

  function reset() {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    setStep('idle')
    setAudioBlob(null)
    setSummaryEdited('')
    setErrorMsg('')
  }

  return (
    <div className="compose-area">
      <div className="compose-label">Lo Spiolo — Registra il tuo segreto 🗣️</div>

      {/* idle */}
      {step === 'idle' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="btn-primary"
            style={{ background: '#238636', color: 'white' }}
            onClick={startRecording}
          >
            🎤 Registra il segreto
          </button>
          <select className="select-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATS.map(c => <option key={c} value={c}>{CAT_IT[c]}</option>)}
          </select>
        </div>
      )}

      {/* recording */}
      {step === 'recording' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%', background: '#da3633',
              animation: 'spioloPulse 1s infinite', display: 'inline-block', flexShrink: 0,
            }} />
            <span style={{ color: '#da3633', fontSize: '0.9rem', fontWeight: 600 }}>
              Registrazione in corso… parla pure
            </span>
          </div>
          <button
            className="btn-primary"
            style={{ background: '#da3633', color: 'white' }}
            onClick={stopRecording}
          >
            ⏹ Stop — ho finito
          </button>
        </div>
      )}

      {/* processing / summarizing */}
      {(step === 'processing' || step === 'summarizing') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' }}>
          <span style={{ fontSize: '1.1rem', display: 'inline-block', animation: 'spioloSpin 1s linear infinite' }}>⚙️</span>
          <span style={{ color: 'var(--accent)', fontSize: '0.9rem' }}>{statusMsg}</span>
        </div>
      )}

      {/* preview */}
      {step === 'preview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{
            background: 'rgba(88, 166, 255, 0.07)',
            border: '1px solid rgba(88, 166, 255, 0.25)',
            borderRadius: 10, padding: '12px 14px',
          }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#58a6ff', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>
              ✦ Titolo generato dall'IA — puoi modificarlo
            </div>
            <textarea
              value={summaryEdited}
              onChange={(e) => setSummaryEdited(e.target.value)}
              maxLength={200}
              rows={2}
              style={{
                width: '100%', background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--text)', fontSize: '1rem', fontFamily: 'inherit',
                resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box',
              }}
              placeholder="Il titolo del tuo segreto…"
            />
            <div style={{ fontSize: '0.72rem', color: 'var(--text-gray)', textAlign: 'right' }}>
              {summaryEdited.length}/200
            </div>
          </div>

          <div style={{ fontSize: '0.78rem', color: 'var(--text-gray)', lineHeight: 1.4 }}>
            🔒 Questo testo apparirà <b>censurato</b> agli altri. Si rivela solo dopo l'ascolto.
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
            <button onClick={reset} style={{
              background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
              color: 'var(--text-gray)', padding: '8px 14px', borderRadius: 8,
              cursor: 'pointer', fontSize: '0.85rem',
            }}>↩ Riregistra</button>
            <select className="select-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATS.map(c => <option key={c} value={c}>{CAT_IT[c]}</option>)}
            </select>
            <button className="btn-primary" onClick={submit} disabled={!summaryEdited.trim()}>
              Spiola ora 🗣️
            </button>
          </div>
        </div>
      )}

      {/* submitting */}
      {step === 'submitting' && (
        <div style={{ color: 'var(--text-gray)', fontSize: '0.9rem', padding: '12px 0' }}>
          Pubblicazione in corso…
        </div>
      )}

      {/* error */}
      {step === 'error' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ color: '#da3633', fontSize: '0.85rem' }}>❌ {errorMsg}</div>
          <button onClick={reset} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
            color: 'var(--text-gray)', padding: '8px 14px', borderRadius: 8,
            cursor: 'pointer', fontSize: '0.85rem', alignSelf: 'flex-start',
          }}>↩ Riprova</button>
        </div>
      )}

      <style>{`
        @keyframes spioloPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.4); }
        }
        @keyframes spioloSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
