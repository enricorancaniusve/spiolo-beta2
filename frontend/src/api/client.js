const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  
  // Se la risposta non è OK, proviamo a leggere l'errore o restituiamo lo stato HTTP
  if (!res.ok) {
    const errorText = await res.text(); // Leggiamo come testo per evitare il crash del JSON
    try {
      const errorJson = JSON.parse(errorText);
      throw new Error(errorJson.error || `Errore ${res.status}`);
    } catch (e) {
      throw new Error(`Errore Server (${res.status}): ${errorText.substring(0, 50)}...`);
    }
  }
  
  return res.json();
}

export const api = {
  confessions: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return req(`/api/confessions${qs ? '?' + qs : ''}`);
    },
    trending: () => req('/api/confessions/trending'),
    get: (id) => req(`/api/confessions/${id}`),
    
    // CORRETTA: Ora usa la funzione req e gestisce i dati correttamente
    create: (data) => req('/api/confessions', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data) 
    }),

    listen: (id) => req(`/api/confessions/${id}/listen`, { method: 'POST' }),
    react: (id, emoji) => req(`/api/confessions/${id}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    }),
  },
  notifications: {
    list: () => req('/api/notifications'),
    dismiss: (id) => req(`/api/notifications/${id}`, { method: 'DELETE' }),
  },
  stats: () => req('/api/stats'),
};
