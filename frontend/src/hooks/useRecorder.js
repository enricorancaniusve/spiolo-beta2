import { useState, useRef } from 'react'

// Distorts audio pitch so the speaker is unrecognisable
async function distortAudio(blob) {
  const arrayBuffer = await blob.arrayBuffer()
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  const ctx = new AudioCtx()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)

  // Render at 0.75x speed → pitch down ~4 semitones (voice becomes unrecognisable)
  const rate = 0.72
  const offlineCtx = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    Math.ceil(audioBuffer.length / rate),
    audioBuffer.sampleRate
  )
  const source = offlineCtx.createBufferSource()
  source.buffer = audioBuffer
  source.playbackRate.value = rate
  source.connect(offlineCtx.destination)
  source.start(0)

  const rendered = await offlineCtx.startRendering()

  // Convert back to webm blob via MediaRecorder trick
  return audioBufferToWav(rendered)
}

// Simple WAV encoder
function audioBufferToWav(buffer) {
  const numCh = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const length = buffer.length * numCh * 2
  const arrayBuffer = new ArrayBuffer(44 + length)
  const view = new DataView(arrayBuffer)
  const write = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)) }
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

export function useRecorder() {
  const [state, setState] = useState('idle') // idle | recording | processing | done | error
  const [audioBlob, setAudioBlob] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const mediaRef = useRef(null)
  const chunksRef = useRef([])

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setState('processing')
        try {
          const raw = new Blob(chunksRef.current, { type: 'audio/webm' })
          const distorted = await distortAudio(raw)
          const url = URL.createObjectURL(distorted)
          setAudioBlob(distorted)
          setAudioUrl(url)
          setState('done')
        } catch (e) {
          console.error('Distortion error', e)
          // Fallback: use raw audio
          const raw = new Blob(chunksRef.current, { type: 'audio/webm' })
          setAudioBlob(raw)
          setAudioUrl(URL.createObjectURL(raw))
          setState('done')
        }
      }
      mediaRef.current = recorder
      recorder.start()
      setState('recording')
    } catch (e) {
      setState('error')
    }
  }

  function stop() {
    if (mediaRef.current && mediaRef.current.state === 'recording') {
      mediaRef.current.stop()
    }
  }

  function reset() {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioBlob(null)
    setAudioUrl(null)
    setState('idle')
  }

  return { state, audioBlob, audioUrl, start, stop, reset }
}
