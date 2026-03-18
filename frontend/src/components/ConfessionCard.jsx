// Aggiungi questo stato tra gli altri all'inizio del componente
const [audioError, setAudioError] = useState(false)

// Poi, nel render dell'audio, modificalo così:
{confession.audioUrl && (
  <div className="audio-row">
    {audioError ? (
      <div style={{ color: 'var(--record-red)', fontSize: '0.8rem', width: '100%' }}>
        🪦 Questo audio è stato cancellato dal server.
      </div>
    ) : (
      <>
        <audio 
          ref={audioRef} 
          src={audioSrc} 
          onLoadedMetadata={handleMetadata} 
          onTimeUpdate={() => setCurrentTime(audioRef.current.currentTime)}
          onEnded={() => { setPlaying(false); setRevealed(true); api.confessions.listen(confession.id).catch(()=>{}); }}
          onError={() => setAudioError(true)} /* <-- SALVAVITA: Cattura l'errore 404 */
          preload="metadata"
        />
        <button className="play-btn" onClick={togglePlay}>
          {playing ? '⏸' : '▶'}
        </button>
        <div className="audio-track">
          <div className="progress-container">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <div className="time-display">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
      </>
    )}
  </div>
)}
