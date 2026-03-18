import React, { useState, useRef } from 'react'
import { api } from '../api/client'

const CATS = ['love', 'school', 'secrets', 'funny', 'drama']
const CAT_IT = { love: 'Amore', school: 'Scuola', secrets: 'Segreti', funny: 'Buffo', drama: 'Drama' }

// --- HELPER UNICO: Convertitore AudioBuffer -> WAV Blob ---
// Necessario per ricreare un file audio valido dopo il processo di pitch shifting
function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const result = [];
  
  // Interleave canali se stereo
  if (numChannels === 2) {
    const l = buffer.getChannelData(0);
    const r = buffer.getChannelData(1);
    const interleaved = new Float32Array(l.length + r.length);
    for (let i = 0; i < l.length; i++) {
      interleaved[2 * i] = l[i];
      interleaved[2 * i + 1] = r[i];
    }
    result.push(interleaved);
  } else {
    result.push(buffer.getChannelData(0)); // Mono
  }

  const audioData = result[0];
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = audioData.length * bytesPerSample;
  const bufferWav = new ArrayBuffer(44 + dataSize);
  const view = new DataView(bufferWav);

  // Scrive Header WAV RIFF
  function writeString(offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');  // RIFF identifier
  view.setUint32(4, 36 + dataSize, true); // file length
  writeString(8, 'WAVE');  // RIFF type
  writeString(12, 'fmt '); // format chunk identifier
  view.setUint32(16, 16, true);  // format chunk length
  view.setUint16(20, format, true); // sample format (raw)
  view.setUint16(22, numChannels, true); // channel count
  view.setUint32(24, sampleRate, true);  // sample rate
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate (sample rate * block align)
  view.setUint16(32, blockAlign, true);  // block align (channel count * bytes per sample)
  view.setUint16(34, bitDepth, true); // bits per sample
  writeString(36, 'data'); // data chunk identifier
  view.setUint32(40, dataSize, true); // data chunk length

  // Scrive i campioni audio audio PCM 16-bit
  let offset = 44;
  for (let i = 0; i < audioData.length; i++) {
    // Converte Float32 [-1, 1] in Int16 [-32768, 32767]
    let s = Math.max(-1, Math.min(1, audioData[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7FFF;
    view.setInt16(offset, s, true);
    offset += bytesPerSample;
  }

  return new Blob([bufferWav], { type: 'audio/wav' });
}
// --------------------------------------------------------

export default function ComposeForm({ onSubmitted }) {
  const [text, setText] = useState('')
  const [category, setCategory] = useState('secrets')
  const [recording, setRecording] = useState(false)
  const [processingAudio, setProcessingAudio] = useState(false) // Stato per la censura in corso
  const [audioBlob, setAudioBlob] = useState(null)
  const mediaRecorderRef = useRef(null)

  // Fattore di alterazione (1.3x = voce più acuta e veloce, anonima)
  const PITCH_FACTOR = 1.3;

  async function startRecording() {
    try {
      setAudioBlob(null); // Resetta audio precedente
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      const chunks = []
      mr.ondataavailable = (e) => chunks.push(e.data)
      
      // Quando la registrazione si ferma, inizia la censura
      mr.onstop = async () => {
        const rawBlob = new Blob(chunks, { type: 'audio/wav' });
        await processAndAlterAudio(rawBlob);
      }
      
      mr.start()
      setRecording(true)
    } catch (e) { alert("Per favore, consenti l'accesso al microfono!") }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  // --- FUNZIONE CORE DI CENSURA VOCALE (OfflineAudioContext) ---
  // Decodifica l'audio registrato, lo velocizza (pitch shift) e lo ri-encoda come WAV Blob
  async function processAndAlterAudio(rawBlob) {
    setProcessingAudio(true);
    try {
      // 1. Decodifica Blob grezzo in AudioBuffer
      const arrayBuffer = await rawBlob.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const rawAudioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // 2. Crea OfflineAudioContext per renderizzare l'audio processato
      // L'audio velocizzato sarà più corto, calcoliamo la nuova durata
      const newDuration = rawAudioBuffer.duration / PITCH_FACTOR;
      const offlineContext = new OfflineAudioContext(
        rawAudioBuffer.numberOfChannels,
        rawAudioBuffer.sampleRate * newDuration,
        rawAudioBuffer.sampleRate
      );

      // 3. Imposta la sorgente e applica il playbackRate (CENSURA)
      const source = offlineContext.createBufferSource();
      source.buffer = rawAudioBuffer;
      source.playbackRate.value = PITCH_FACTOR; // Velocizza riproduzione (Alza Pitch)
      
      source.connect(offlineContext.destination);
      source.start(0);

      // 4. Renderizza l'audio processato
      const processedAudioBuffer = await offlineContext.startRendering();
      
      // 5. Converte AudioBuffer processato in WAV Blob pronto per l'invio
      const finalWavBlob = audioBufferToWav(processedAudioBuffer);
      setAudioBlob(finalWavBlob);
    
    } catch (e) {
      console.error("Errore censura audio:", e);
      alert("Errore durante la censura della voce. L'audio potrebbe essere normale.");
      setAudioBlob(rawBlob); // Fallback su audio normale in caso di errore
    } finally {
      setProcessingAudio(false);
    }
  }

  async function submit() {
    if (!text && !audioBlob) return
    const fd = new FormData()
    fd.append('text', text || 'Confessione Audio Censurata')
    fd.append('category', category)
    if (audioBlob) fd.append('audio', audioBlob, 'censored.wav')
    
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
        placeholder="Scrivi qui la tua verità anonima... La voce verrà alterata automaticamente." 
      />
      
      <div className="record-row">
        <button 
          className="btn-primary" 
          style={{ background: recording ? '#da3633' : '#238636', color: 'white' }} 
          onClick={recording ? stopRecording : startRecording}
          disabled={processingAudio} // Disabilita se sta processando
        >
          {recording ? '⏹ Stop' : '🎤 Registra Voce'}
        </button>
        
        {processingAudio && <span style={{ color: 'var(--accent)', fontSize: '0.8rem' }}>⚠️ Alterazione voce in corso...</span>}
        {audioBlob && !processingAudio && <span style={{ color: '#58a6ff', fontSize: '0.85rem', fontWeight: 'bold' }}>✓ Audio censurato</span>}
        
        <select 
          className="select-cat" 
          value={category} 
          onChange={(e) => setCategory(e.target.value)}
        >
          {CATS.map(c => <option key={c} value={c}>{CAT_IT[c]}</option>)}
        </select>
      </div>

      <div style={{ textAlign: 'right', marginTop: '10px' }}>
        <button className="btn-primary" onClick={submit} disabled={processingAudio || (!text && !audioBlob)}>Spiola ora</button>
      </div>
    </div>
  )
}
