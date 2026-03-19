import React, { useState, useRef } from 'react'
import { api } from '../api/client'

const CATS = ['love', 'school', 'secrets', 'funny', 'drama']
const CAT_IT = { love: 'Amore', school: 'Scuola', secrets: 'Segreti', funny: 'Buffo', drama: 'Drama' }

// UTILITY ENCODER WAV
function audioBufferToWav(buffer) {
  const numCh = buffer.numberOfChannels; const sampleRate = buffer.sampleRate
  const length = buffer.length * numCh * 2; const arrayBuffer = new ArrayBuffer(44 + length)
  const view = new DataView(arrayBuffer); const write = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)) }
  write(0, 'RIFF'); view.setUint32(4, 36 + length, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * numCh * 2, true);
  view.setUint16(32, numCh * 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, length, true)
  let offset = 44
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]))
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true); offset += 2
    }
  }
  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

// CURVA DISTORSIONE
function makeDistortionCurve(amount) {
  const n_samples = 44100; const curve = new Float32Array(n_samples);
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

export default function ComposeForm({ onSubmitted }) {
  const [step, setStep] = useState('idle'); const [category, setCategory] = useState('secrets')
  const [audioBlob, setAudioBlob] = useState(null); const [summary, setSummary] = useState('')
  const mediaRecorderRef = useRef(null); const chunksRef = useRef([])

  async function distortAudio(blob) {
    const ab = await blob.arrayBuffer(); const ctx = new AudioContext(); const audioBuffer = await ctx.decodeAudioData(ab); await ctx.close()
    const pitch = 1.35; const offlineCtx = new OfflineAudioContext(audioBuffer.numberOfChannels, audioBuffer.length / pitch, audioBuffer.sampleRate)
    const source = offlineCtx.createBufferSource(); source.buffer = audioBuffer; source.playbackRate.value = pitch
    const hp = offlineCtx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 450
    const dist = offlineCtx.createWaveShaper(); dist.curve = makeDistortionCurve(40)
    source.connect(hp); hp.connect(dist); dist.connect(offlineCtx.destination)
    source.start(0); const rendered = await offlineCtx.startRendering(); return audioBufferToWav(rendered)
  }

  async function transcribeAndSummarize(rawBlob) {
    const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY
    const fd = new FormData(); fd.append('file', new File([rawBlob], 'audio.webm')); fd.append('model', 'whisper-large-v3')
    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${GROQ_KEY}` }, body: fd })
    const data = await res.json(); const text = data.text || "Un segreto..."
    const resSum = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: 'Genera un titolo breve (max 8 parole) e misterioso.' }, { role: 'user', content: text }] })
    })
    const dataSum = await resSum.json(); setSummary(dataSum.choices[0].message.content.trim())
  }

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mr = new MediaRecorder(stream); chunksRef.current = []
    mr.ondataavailable = e => chunksRef.current.push(e.data)
    mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop()); setStep('processing')
      const raw = new Blob(chunksRef.current, { type: 'audio/webm' })
      const [distorted] = await Promise.all([distortAudio(raw), transcribeAndSummarize(raw)])
      setAudioBlob(distorted); setStep('preview')
    }
    mediaRecorderRef.current = mr; mr.start(); setStep('recording')
  }

  async function submit() {
    const fd = new FormData(); fd.append('text', summary); fd.append('category', category); fd.append('audio', audioBlob, 'spiolo.wav')
    await api.confessions.create(fd); onSubmitted?.()
  }

  return (
    <div className="compose-area">
      <div className="compose-label">Lo Spiolo — Confessa 🤫</div>
      {step === 'idle' && (
        <div style={{display:'flex', gap:10}}>
          <button className="btn-primary" onClick={startRecording}>🎤 Registra</button>
          <select value={category} onChange={e => setCategory(e.target.value)} style={{background:'#0d1117', color:'white', border:'1px solid #30363d', borderRadius:8, padding:'0 10px'}}>
            {CATS.map(c => <option key={c} value={c}>{CAT_IT[c]}</option>)}
          </select>
        </div>
      )}
      {step === 'recording' && <button className="btn-primary" style={{background:'#da3633'}} onClick={() => mediaRecorderRef.current.stop()}>⏹ Ferma e Cripta</button>}
      {step === 'processing' && <div>⚙️ Offuscamento in corso...</div>}
      {step === 'preview' && (
        <div style={{display:'flex', flexDirection:'column', gap:10}}>
          <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={2} />
          <div style={{display:'flex', gap:10}}>
            <button onClick={() => setStep('idle')}>Annulla</button>
            <button className="btn-primary" onClick={submit}>Spiola ora 🐦</button>
          </div>
        </div>
      )}
    </div>
  )
}
