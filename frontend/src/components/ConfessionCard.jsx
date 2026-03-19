// All'interno di ConfessionCard.jsx...
function initAnalyser() {
  if (audioCtxRef.current) return
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  audioCtxRef.current = ctx
  const analyserNode = ctx.createAnalyser()
  const source = ctx.createMediaElementSource(audioRef.current)
  
  // CONNESSIONE DOPPIA: ANALIZZATORE + CASSE
  source.connect(analyserNode)
  analyserNode.connect(ctx.destination) 
  
  setAnalyser(analyserNode)
}

// Nel render:
<audio
  ref={audioRef}
  src={audioSrc}
  crossOrigin="anonymous" 
  onLoadedMetadata={handleMetadata}
  onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
  // ... resto uguale
/>
