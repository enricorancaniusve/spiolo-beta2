// ... (import e helper formatTime/censor uguali a prima)

export default function ConfessionCard({ confession }) {
  const [revealed, setRevealed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef(null)

  // URL Robusto: gestisce slash mancanti
  const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '')
  const audioPath = (confession.audioUrl || '').replace(/^\//, '')
  const audioSrc = confession.audioUrl?.startsWith('http') ? confession.audioUrl : `${baseUrl}/${audioPath}`

  const handleMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration)
  }

  // ... (funzioni togglePlay e handleReact uguali a prima)

  return (
    <article className="confession-card">
       {/* ... categoria e testo ... */}
       {confession.audioUrl && (
         <div className="audio-row">
           <audio 
             ref={audioRef} 
             src={audioSrc} 
             onLoadedMetadata={handleMetadata} 
             onTimeUpdate={() => setCurrentTime(audioRef.current.currentTime)}
             onEnded={() => { setPlaying(false); setRevealed(true); }}
             preload="metadata"
           />
           <button className="play-btn" onClick={togglePlay}>{playing ? '⏸' : '▶'}</button>
           <div className="audio-track">
             <div className="progress-container"><div className="progress-bar" style={{ width: `${(currentTime/duration)*100}%` }} /></div>
             <div className="time-display">{formatTime(currentTime)} / {formatTime(duration)}</div>
           </div>
         </div>
       )}
       {/* ... reazioni ... */}
    </article>
  )
}
