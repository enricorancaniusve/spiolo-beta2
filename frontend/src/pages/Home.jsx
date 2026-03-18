// ... (tutto il resto del codice rimane uguale)

const CAT_DATA = [
  { id: null, name: 'Tutti', emoji: '🌐' },
  { id: 'love', name: 'Amore', emoji: '❤️' },
  { id: 'school', name: 'Scuola', emoji: '📚' },
  { id: 'secrets', name: 'Segreti', emoji: '🤫' },
  { id: 'funny', name: 'Buffi', emoji: '😂' },
  { id: 'drama', name: 'Drama', emoji: '🎭' }
]

export default function Home() {
  // ... (stati e funzioni caricate precedentemente)

  return (
    <main>
      {/* Header, Stats e Taxonomy (già fatti) */}
      <header className="app-header">
        {/* ... (codice header precedente) */}
      </header>

      {/* Sezione Filtri a Cerchio */}
      <nav className="tabs-row">
        {CAT_DATA.map(cat => (
          <button
            key={String(cat.id)}
            className={`tab-btn ${category === cat.id ? 'active' : ''}`}
            onClick={() => setCategory(cat.id)}
          >
            <span className="tab-emoji">{cat.emoji}</span>
            <span className="tab-name">{cat.name}</span>
          </button>
        ))}
      </nav>

      {/* ... (form di invio e feed) */}
    </main>
  )
}
