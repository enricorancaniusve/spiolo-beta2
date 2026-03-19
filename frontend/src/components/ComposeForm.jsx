import React, { useState, useRef } from 'react'
import { api } from '../api/client'

const CATS = ['love', 'school', 'secrets', 'funny', 'drama']
const CAT_IT = { love: 'Amore', school: 'Scuola', secrets: 'Segreti', funny: 'Buffo', drama: 'Drama' }

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

export default function ComposeForm({ onSubmitted }) {
  const [step, setStep] = useState('idle')
  const [category, setCategory] = useState('secrets')
  const [audioBlob, setAudioBlob] = useState(null)
  const [summary, setSummary] = useState('')
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  async function distortAudio(blob) {
    const ab = await blob.arrayBuffer(); const ctx = new AudioContext(); const audioBuffer = await ctx.decodeAudioData(ab); await ctx.close()
    const pitch = 1.35; const offlineCtx = new OfflineAudioContext(audioBuffer.numberOfChannels, audioBuffer.length / pitch, audioBuffer.sampleRate)
    const source = offlineCtx.createBufferSource(); source.buffer = audioBuffer; source.playbackRate.value = pitch
    const hp = offlineCtx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 450
    const comp = offlineCtx.createDynamicsCompressor(); source.connect(hp); hp.connect(comp); comp.connect(offlineCtx.destination)
    source.start(0); const rendered = await offlineCtx.startRendering(); return audioBufferToWav(rendered)
  }

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mr = new MediaRecorder(stream); chunksRef.current = []
    mr.ondataavailable = e => chunksRef.current.push(e.data)
    mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      setStep('processing')
      const raw = new Blob(chunksRef.current, { type: 'audio/webm' })
      const distorted = await distortAudio(raw)
      setAudioBlob(distorted); setSummary("Un segreto anonimo..."); setStep('preview')
    }
    mediaRecorderRef.current = mr; mr.start(); setStep('recording')
  }

  async function submit() {
    const fd = new FormData(); fd.append('text', summary); fd.append('category', category); fd.append('audio', audioBlob, 'spiolo.wav')
    await api.confessions.create(fd); onSubmitted?.()
  }

  return (
    <div className="compose-area">
      <div className="compose-label">Criptazione Vocale 🤫</div>
      {step === 'idle' && <button className="btn-primary" onClick={startRecording}>🎤 Registra</button>}
      {step === 'recording' && <button className="btn-primary" style={{background:'#da3633'}} onClick={() => mediaRecorderRef.current.stop()}>⏹ Ferma</button>}
      {step === 'processing' && <div>⚙️ Offuscamento in corso...</div>}
      {step === 'preview' && (
        <div style={{display:'flex', flexDirection:'column', gap:10}}>
          <textarea value={summary} onChange={e => setSummary(e.target.value)} />
          <button className="btn-primary" onClick={submit}>Spiola ora 🗣️</button>
        </div>
      )}
    </div>
  )
}
