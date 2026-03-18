import React, { useState, useRef } from 'react'
import { api } from '../api/client'

const CATS = ['love', 'school', 'secrets', 'funny', 'drama']
const CAT_IT = { love: 'Amore', school: 'Scuola', secrets: 'Segreti', funny: 'Buffo', drama: 'Drama' }

// ─── WAV encoder (invariato dal tuo codice originale) ────────────────────────
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

// ─── Pitch shifting (invariato dal tuo codice originale) ─────────────────────
async function processAndAlterAudio(rawBlob) {
  const PITCH_FACTOR = 1.3
  const arrayBuffer = await rawBlob.arrayBuffer()
  const audioContext = new (window.AudioContext || window.webkitAudioContext)()
  const rawAudioBuffer = await audioContext.decodeAudioData(arrayBuffer)
  const newDuration = rawAudioBuffer.duration / PITCH_FACTOR
  const offlineContext = new OfflineAudioContext(
    rawAudioBuffer.numberOfChannels,
    rawAudioBuffer.sampleRate * newDuration,
    rawAudioBuffer.sampleRate
  )
  const source = offlineContext.createBufferSource()
  source.buffer = rawAudioBuffer
  source.playbackRate.value = PITCH_FACTOR
  source.connect(offlineContext.destination)
  source.start(0)
  const processed = await offlineContext.startRendering()
  return audioBufferToWav(processed)
}

// ─── Chiama Groq per il riassunto ─────────────────────────────────────────────
// Aggiungi VITE_GROQ_API_KEY nel file .env del frontend
// Ottieni la chiave gratis su: https://console.groq.com
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
      max_tokens: 120,
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content:
            'Sei un assistente per un\'app di pettegolezzi anonimi chiamata "Lo Spiolo". ' +
            'Ricevi la trascrizione di un messaggio vocale anonimo e devi generare un titolo/oggetto ' +
            'breve e intrigante (max 12 parole) che descriva il pettegolezzo senza rivelare troppo. ' +
            'Deve essere curioso, un po\' misterioso, come l\'oggetto di una email scandalosa. ' +
            'Rispondi SOLO con il testo del titolo, senza virgolette o prefissi.',
        },
        {
          role: 'user',
          content: `Trascrizione del messaggio vocale:\n"${transcript}"`,
        },
      ],
    }),
  })

  if (!res.ok) throw new Error('Errore Groq API')
  const data = await res.json()
  return data.choices[0].message.content.trim()
}

// ─── STATI DEL FORM ───────────────────────────────────────────────────────────
// idle → recording → processing (pitch) → summarizing → preview → submitting
// ─────────────────────────────────────────────────────────────────────────────

export default function ComposeForm({ onSubmitted }) {
  const [step, setStep] = useState('idle')
  // idle | recording | processing | summarizing | preview | submitting | error

  const [category, setCategory] = useState('secrets')
  const [audioBlob, setAudioBlob] = useState(null)
  const [summaryEdited, setSummaryEdited] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const mediaRecorderRef = useRef(null)
  const transcriptRef = useRef('')
  const recognitionRef = useRef(null)

  const isSpeechSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  // ─── AVVIA registrazione + trascrizione in parallelo ──────────────────────
  async function startRecording() {
    setErrorMsg('')
    setAudioBlob(null)
    setSummaryEdited('')
    transcriptRef.current = ''

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // 1. MediaRecorder per l'audio (poi verrà pitch-shiftato)
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      const chunks = []
      mr.ondataavailable = (e) => chunks.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        await handleRecordingDone(chunks)
      }

      // 2. Web Speech API per la trascrizione, gira in parallelo sullo stesso microfono
      if (isSpeechSupported) {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition
        const recognition = new SR()
        recognition.lang = 'it-IT'
        recognition.continuous = true
        recognition.interimResults = false
        recognition.onresult = (e) => {
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) {
              transcriptRef.current += e.results[i][0].transcript + ' '
            }
          }
        }
        recognition.onerror = (e) => console.warn('Speech recognition error:', e.error)
        recognitionRef.current = recognition
        recognition.start()
      }

      mr.start()
      setStep('recording')
    } catch (e) {
      setErrorMsg("Impossibile accedere al microfono. Controlla i permessi.")
      setStep('error')
    }
  }

  // ─── STOP registrazione ────────────────────────────────────────────────────
  function stopRecording() {
    if (recognitionRef.current) recognitionRef.current.stop()
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    setStep('processing')
  }

  // ─── DOPO stop: pitch shift → riassunto ───────────────────────────────────
  async function handleRecordingDone(chunks) {
    try {
      // Fase 1: pitch shift audio
      setStep('processing')
      const rawBlob = new Blob(chunks, { type: 'audio/wav' })
      const censoredBlob = await processAndAlterAudio(rawBlob)
      setAudioBlob(censoredBlob)

      // Fase 2: riassunto da Groq
      setStep('summarizing')
      const transcript = transcriptRef.current.trim()

      let generatedSummary
      if (!transcript || transcript.length < 5) {
        // Fallback se la trascrizione è vuota (browser non supportato o silenzio)
        generatedSummary = 'Un segreto che non puoi non ascoltare…'
      } else {
        generatedSummary = await generateSummary(transcript)
      }

      setSummaryEdited(generatedSummary)
      setStep('preview')
    } catch (e) {
      console.error(e)
      setErrorMsg("Errore durante l'elaborazione. Riprova.")
      setStep('error')
    }
  }

  // ─── PUBBLICA ──────────────────────────────────────────────────────────────
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
    if (recognitionRef.current) recognitionRef.current.abort()
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    setStep('idle')
    setAudioBlob(null)
    setSummaryEdited('')
    setErrorMsg('')
    transcriptRef.current = ''
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="compose-area">
      <div className="compose-label">Lo Spiolo — Registra il tuo segreto 🐦</div>

      {/* STEP: idle */}
      {step === 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!isSpeechSupported && (
            <div style={{ fontSize: '0.8rem', color: 'var(--accent)', padding: '8px 12px', background: 'rgba(255,200,0,0.08)', borderRadius: 8 }}>
              ⚠️ Usa Chrome o Edge per la trascrizione automatica. Su altri browser il titolo sarà generico.
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="btn-primary"
              style={{ background: '#238636', color: 'white' }}
              onClick={startRecording}
            >
              🎤 Registra il segreto
            </button>
            <select
              className="select-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATS.map(c => <option key={c} value={c}>{CAT_IT[c]}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* STEP: recording */}
      {step === 'recording' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: '#da3633',
              animation: 'spioloPulse 1s infinite',
              display: 'inline-block',
              flexShrink: 0,
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

      {/* STEP: processing / summarizing */}
      {(step === 'processing' || step === 'summarizing') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' }}>
          <span style={{ fontSize: '1.1rem', display: 'inline-block', animation: 'spioloSpin 1s linear infinite' }}>⚙️</span>
          <span style={{ color: 'var(--accent)', fontSize: '0.9rem' }}>
            {step === 'processing'
              ? 'Censura vocale in corso…'
              : 'Lo Spiolo sta elaborando il titolo del tuo segreto…'}
          </span>
        </div>
      )}

      {/* STEP: preview — titolo modificabile */}
      {step === 'preview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div style={{
            background: 'rgba(88, 166, 255, 0.07)',
            border: '1px solid rgba(88, 166, 255, 0.25)',
            borderRadius: 10,
            padding: '12px 14px',
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
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text)',
                fontSize: '1rem',
                fontFamily: 'inherit',
                resize: 'vertical',
                lineHeight: 1.5,
                boxSizing: 'border-box',
              }}
              placeholder="Il titolo del tuo segreto…"
            />
            <div style={{ fontSize: '0.72rem', color: 'var(--text-gray)', textAlign: 'right' }}>
              {summaryEdited.length}/200
            </div>
          </div>

          <div style={{ fontSize: '0.78rem', color: 'var(--text-gray)', lineHeight: 1.4 }}>
            🔒 Questo testo apparirà <b>censurato</b> agli altri utenti. Si rivelerà solo dopo che avranno ascoltato l'audio.
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
            <button
              onClick={reset}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'var(--text-gray)',
                padding: '8px 14px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              ↩ Riregistra
            </button>
            <select
              className="select-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATS.map(c => <option key={c} value={c}>{CAT_IT[c]}</option>)}
            </select>
            <button
              className="btn-primary"
              onClick={submit}
              disabled={!summaryEdited.trim()}
            >
              Spiola ora 🐦
            </button>
          </div>
        </div>
      )}

      {/* STEP: submitting */}
      {step === 'submitting' && (
        <div style={{ color: 'var(--text-gray)', fontSize: '0.9rem', padding: '12px 0' }}>
          Pubblicazione in corso…
        </div>
      )}

      {/* STEP: error */}
      {step === 'error' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ color: '#da3633', fontSize: '0.85rem' }}>❌ {errorMsg}</div>
          <button
            onClick={reset}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'var(--text-gray)',
              padding: '8px 14px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: '0.85rem',
              alignSelf: 'flex-start',
            }}
          >
            ↩ Riprova
          </button>
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
